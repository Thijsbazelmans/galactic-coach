// The sim (SPEC §4) on the column grid: 9 slots, row-major.
// Rows: 0 = starters, 1 = bench, 2 = reserves.
// Columns: 0 = BACKCOURT, 1 = WING, 2 = FRONTCOURT — positionless, but three
// tiny dribblers can't guard a frontcourt and three walls can't bring the
// ball up. The penalty is printed on the card (MISCAST).

import { PLANS, planById } from './data';
import type { ChampTeam, GameState, MyGameResult, PlanId, Player, Team } from './types';
import { clamp, effLean, lean, pick, rand } from './util';

export const COL_LABELS = ['BACKCOURT', 'WING', 'FRONTCOURT'];

export function available(p: Player): boolean {
  return p.outWeeks === 0;
}

function byId(t: Team, id: number | null): Player | null {
  return id === null ? null : t.players.find((p) => p.id === id) ?? null;
}

// ---- column fit ------------------------------------------------------------------

/** Backcourt punishes Strong-leaners; frontcourt punishes Quick-leaners. Wing forgives. */
export function slotMult(p: Player, col: number): number {
  if (col === 0) return 1 - 0.25 * (lean(p, 'strong') / 100);
  if (col === 2) return 1 - 0.25 * (lean(p, 'quick') / 100);
  return 1;
}

/** Column preference score for auto-placement (higher = better fit). */
function colScore(p: Player, col: number): number {
  if (col === 0) return p.build; // quick side fits the backcourt
  if (col === 2) return 100 - p.build; // strong side fits the frontcourt
  return 60 - Math.abs(p.build - 50) / 2;
}

// ---- lineup ------------------------------------------------------------------------

export function slotPlayer(t: Team, idx: number): Player | null {
  return byId(t, t.lineup.slots[idx] ?? null);
}

function rowPlayers(t: Team, row: number): Player[] {
  return [0, 1, 2].map((c) => slotPlayer(t, row * 3 + c)).filter((p): p is Player => !!p);
}

export function starters(t: Team): Player[] {
  return rowPlayers(t, 0);
}
export function benchPlayers(t: Team): Player[] {
  return rowPlayers(t, 1);
}
export function reserves(t: Team): Player[] {
  return rowPlayers(t, 2);
}

/**
 * Keep the grid legal: every rostered player in exactly one slot, empties
 * filled by column fit, and the unavailable SINK to the reserve row of their
 * own column while everyone behind them moves up.
 */
export function normalizeLineup(t: Team): void {
  const slots: (number | null)[] = Array.from({ length: 9 }, (_, i) => t.lineup.slots[i] ?? null);
  const seen = new Set<number>();
  for (let i = 0; i < 9; i++) {
    const p = byId(t, slots[i]);
    if (!p || seen.has(p.id)) slots[i] = null;
    else seen.add(p.id);
  }
  // place the unplaced: best empty slot by (row, column fit)
  const pool = t.players.filter((p) => !seen.has(p.id)).sort((a, b) => b.skill - a.skill);
  for (const p of pool) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (slots[i] !== null) continue;
      const row = Math.floor(i / 3);
      const score = colScore(p, i % 3) - row * 200; // higher rows first
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) slots[best] = p.id;
  }
  // column sink: available keep their order, the hurt drop to the bottom
  for (let c = 0; c < 3; c++) {
    const col = [0, 1, 2].map((r) => byId(t, slots[r * 3 + c]));
    const up = col.filter((p): p is Player => !!p && available(p));
    const down = col.filter((p): p is Player => !!p && !available(p));
    const ordered = [...up, ...down];
    for (let r = 0; r < 3; r++) slots[r * 3 + c] = ordered[r]?.id ?? null;
  }
  t.lineup.slots = slots;
}

/** AI teams: best six on the floor, sorted into columns by build. */
export function autoLineup(t: Team): void {
  const ranked = [...t.players].filter(available).sort((a, b) => b.skill - a.skill);
  const rows = [ranked.slice(0, 3), ranked.slice(3, 6), ranked.slice(6, 9)];
  const slots: (number | null)[] = Array.from({ length: 9 }, () => null);
  rows.forEach((trio, r) => {
    const byBuild = [...trio].sort((a, b) => a.build - b.build); // strong first
    // strongest → frontcourt, quickest → backcourt, middle → wing
    if (byBuild[0]) slots[r * 3 + 2] = byBuild[0].id;
    if (byBuild[1]) slots[r * 3 + 1] = byBuild[1].id;
    if (byBuild[2]) slots[r * 3 + 0] = byBuild[2].id;
  });
  t.lineup.slots = slots;
  normalizeLineup(t);
}

// ---- power ---------------------------------------------------------------------------

export function playerPower(p: Player, plan: PlanId, col: number): number {
  return (p.skill + effLean(p, planById(plan).pole) * 0.5) * slotMult(p, col);
}

export function teamPower(t: Team, plan: PlanId): number {
  let sum = 0;
  for (let c = 0; c < 3; c++) {
    const st = slotPlayer(t, c);
    if (st) sum += playerPower(st, plan, c);
    const bn = slotPlayer(t, 3 + c);
    if (bn) sum += playerPower(bn, plan, c) * 0.3;
  }
  return sum;
}

/** Average effective lean of the starters toward the plan's pole (0–100). */
export function planFit(t: Team, plan: PlanId): number {
  const st = starters(t);
  if (!st.length) return 0;
  return Math.round(st.reduce((a, p) => a + effLean(p, planById(plan).pole), 0) / st.length);
}

export function wheel(mine: PlanId, theirs: PlanId): 'win' | 'lose' | 'tie' {
  if (planById(mine).beats === theirs) return 'win';
  if (planById(theirs).beats === mine) return 'lose';
  return 'tie';
}

const WHEEL_F = { win: 1.12, lose: 0.89, tie: 1.0 };

export function aiPlan(t: Team): PlanId {
  if (Math.random() < 0.15) return pick(PLANS).id; // the occasional surprise
  return PLANS.reduce((best, pl) => (planFit(t, pl.id) > planFit(t, best) ? pl.id : best), 'pound' as PlanId);
}

export function logistic(diff: number): number {
  return 1 / (1 + Math.exp(-diff / 28));
}

// ---- the game itself --------------------------------------------------------------------

function scoreLines(pWin: number, won: boolean): { my: number; opp: number } {
  const margin = 1 + rand(5) + Math.round(Math.abs(pWin - 0.5) * 24);
  const base = 52 + rand(16);
  return won ? { my: base + margin, opp: base } : { my: base, opp: base + margin };
}

export interface SimOutcome {
  result: MyGameResult;
  won: boolean;
}

function verdictLines(
  me: Team,
  myPlan: PlanId,
  oppPlan: PlanId,
  w: 'win' | 'lose' | 'tie',
  won: boolean
): { wheelLine: string; heroLine: string } {
  const mine = planById(myPlan);
  const theirs = planById(oppPlan);
  let wheelLine: string;
  if (w === 'win') wheelLine = `Your ${mine.name} broke their ${theirs.name}. ${mine.beatLine}`;
  else if (w === 'lose') wheelLine = `They saw ${mine.name} coming — their ${theirs.name} was built to beat it.`;
  else wheelLine = `${mine.name} vs ${theirs.name}: no counter either way. It came down to the players.`;
  const st = [0, 1, 2].map((c) => ({ p: slotPlayer(me, c), c })).filter((x): x is { p: Player; c: number } => !!x.p);
  if (!st.length) return { wheelLine, heroLine: 'You fielded nobody. The scoreboard noticed.' };
  const miscast = st.filter((x) => slotMult(x.p, x.c) < 0.88);
  const fit = (p: Player): number => effLean(p, mine.pole);
  const hero = [...st].sort((a, b) => fit(b.p) - fit(a.p))[0].p;
  const goatX = [...st].sort((a, b) => fit(a.p) - fit(b.p))[0];
  const goat = goatX.p;
  const goatMuted = (mine.pole === 'strong' || mine.pole === 'quick' ? goat.energy : goat.mood) <= 40;
  let heroLine: string;
  if (won) heroLine = `${hero.name} was built for this.`;
  else if (miscast.length) heroLine = `${miscast[0].p.name} was miscast in the ${COL_LABELS[miscast[0].c].toLowerCase()} all night.`;
  else if (goatMuted) heroLine = `${goat.name} played half a step slow — ${mine.pole === 'strong' || mine.pole === 'quick' ? '⚡ was low' : "his head wasn't here"}.`;
  else heroLine = `${goat.name} never fit the plan tonight.`;
  return { wheelLine, heroLine };
}

export function simMyLeagueGame(s: GameState, me: Team, opp: Team, home: boolean): SimOutcome {
  const oppPlan = s.pregameFlags.cloak ? pick(PLANS).id : aiPlan(opp);
  let w = wheel(s.plan, oppPlan);
  if (s.pregameFlags.wallet && w === 'tie') w = 'win';
  const mine = teamPower(me, s.plan) * WHEEL_F[w] * (home ? 1.03 : 1);
  const theirs = teamPower(opp, oppPlan) * (home ? 1 : 1.03);
  const p = logistic(mine - theirs);
  const won = Math.random() < p;
  const sc = scoreLines(p, won);
  const { wheelLine, heroLine } = verdictLines(me, s.plan, oppPlan, w, won);
  const st = starters(me);
  const top = st.length ? pick(st) : null;
  return {
    won,
    result: {
      win: won,
      myScore: sc.my,
      oppScore: sc.opp,
      oppName: `${opp.planet} ${opp.name}`,
      planMine: s.plan,
      planOpp: oppPlan,
      wheel: w,
      wheelLine,
      heroLine,
      boxLine: top ? `${top.name} led the way with ${12 + rand(14)} points.` : '',
    },
  };
}

export function simMyChampGame(s: GameState, me: Team, champ: ChampTeam): SimOutcome {
  const oppPlan = s.pregameFlags.cloak ? pick(PLANS).id : champ.plan;
  let w = wheel(s.plan, oppPlan);
  if (s.pregameFlags.wallet && w === 'tie') w = 'win';
  const mine = teamPower(me, s.plan) * WHEEL_F[w];
  const p = logistic(mine - champ.power);
  const won = Math.random() < p;
  const sc = scoreLines(p, won);
  const { wheelLine, heroLine } = verdictLines(me, s.plan, oppPlan, w, won);
  const st = starters(me);
  const top = st.length ? pick(st) : null;
  return {
    won,
    result: {
      win: won,
      myScore: sc.my,
      oppScore: sc.opp,
      oppName: champ.name,
      planMine: s.plan,
      planOpp: oppPlan,
      wheel: w,
      wheelLine,
      heroLine,
      boxLine: top ? `${top.name} left everything on that floor: ${14 + rand(16)} points.` : '',
    },
  };
}

/** AI vs AI league game: plans auto, straight power roll. */
export function simAiGame(a: Team, b: Team): { winner: Team; loser: Team; scoreW: number; scoreL: number } {
  const pa = teamPower(a, aiPlan(a)) * 1.03;
  const pb = teamPower(b, aiPlan(b));
  const aWins = Math.random() < logistic(pa - pb);
  const margin = 1 + rand(9);
  const base = 52 + rand(16);
  return aWins
    ? { winner: a, loser: b, scoreW: base + margin, scoreL: base }
    : { winner: b, loser: a, scoreW: base + margin, scoreL: base };
}

export { clamp };
