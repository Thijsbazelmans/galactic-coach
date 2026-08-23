// The sim (SPEC §4) on the column grid: 9 slots, row-major.
// Rows: 0 = starters, 1 = bench, 2 = reserves.
// Columns: 0 = BACKCOURT, 1 = WING, 2 = FRONTCOURT — position is BODY SIZE,
// not a stat: small bodies run the backcourt, big bodies hold the frontcourt.
// The penalty is printed on the card (MISCAST).

import { ATTR_STAT, PLANS, planById } from './data';
import type { AttrRec, BoxRow, ChampTeam, GameState, MyGameResult, PlanId, Player, Team } from './types';
import { ATTRS, attrEff, clamp, effOvr, ovr, pick, rand, sizeIndex, zeroAttrs } from './util';

export const COL_LABELS = ['BACKCOURT', 'WING', 'FRONTCOURT'];

export function available(p: Player): boolean {
  return p.outWeeks === 0;
}

function byId(t: Team, id: number | null): Player | null {
  return id === null ? null : t.players.find((p) => p.id === id) ?? null;
}

// ---- column fit: pure body size ---------------------------------------------
// Size 0=XS … 4=XL. A wall in the backcourt or a waterbug in the frontcourt
// pays up to −25%. The wing forgives almost everything.

const MISCAST: number[][] = [
  // sizeIdx:      XS    S     M     L     XL
  /* backcourt */ [0, 0, 8, 16, 25],
  /* wing      */ [0, 0, 0, 0, 0], // the wing forgives everything
  /* frontcourt*/ [25, 16, 8, 0, 0],
];

export function slotMult(p: Player, col: number): number {
  return 1 - MISCAST[col][sizeIndex(p)] / 100;
}

/** Column preference score for auto-placement (higher = better fit). */
function colScore(p: Player, col: number): number {
  return 100 - MISCAST[col][sizeIndex(p)] * 4;
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
  const pool = t.players.filter((p) => !seen.has(p.id)).sort((a, b) => ovr(b.attrs) - ovr(a.attrs));
  for (const p of pool) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (slots[i] !== null) continue;
      const row = Math.floor(i / 3);
      const score = colScore(p, i % 3) - row * 500; // higher rows first
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

/** AI teams: best six on the floor, sorted into columns by body size. */
export function autoLineup(t: Team): void {
  const ranked = [...t.players].filter(available).sort((a, b) => ovr(b.attrs) - ovr(a.attrs));
  const rows = [ranked.slice(0, 3), ranked.slice(3, 6), ranked.slice(6, 9)];
  const slots: (number | null)[] = Array.from({ length: 9 }, () => null);
  rows.forEach((trio, r) => {
    const bySize = [...trio].sort((a, b) => sizeIndex(b) - sizeIndex(a)); // biggest first
    // biggest → frontcourt, smallest → backcourt, middle → wing
    if (bySize[0]) slots[r * 3 + 2] = bySize[0].id;
    if (bySize[1]) slots[r * 3 + 1] = bySize[1].id;
    if (bySize[2]) slots[r * 3 + 0] = bySize[2].id;
  });
  t.lineup.slots = slots;
  normalizeLineup(t);
}

// ---- power ---------------------------------------------------------------------------
// A tactic bets the game on ONE attribute: it counts 2.5× while the other
// three count 1×. Meters mute (energy → body, mood → head), size miscasts tax.

export function playerPower(p: Player, plan: PlanId, col: number): number {
  return (effOvr(p) + 1.5 * attrEff(p, planById(plan).attr)) * slotMult(p, col);
}

/** The sim's team strength: starters full, bench at 30%. */
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

/** The DISPLAY number: one team rating on the player-OVR scale.
    Starters weigh 75%, bench 25%, reserves nothing. */
export function teamRating(t: Team, plan: PlanId): number {
  const rate = (p: Player, c: number): number => playerPower(p, plan, c) / 1.5;
  const st: number[] = [];
  const bn: number[] = [];
  for (let c = 0; c < 3; c++) {
    const s = slotPlayer(t, c);
    if (s && available(s)) st.push(rate(s, c));
    const b = slotPlayer(t, 3 + c);
    if (b && available(b)) bn.push(rate(b, c));
  }
  const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
  return Math.round(0.75 * avg(st) + 0.25 * avg(bn));
}

/** The average kite of a team's starters — the scouting-report shape. */
export function teamKite(t: Team): AttrRec {
  const st = starters(t);
  const k = zeroAttrs();
  if (!st.length) return k;
  for (const a of ATTRS) k[a] = Math.round(st.reduce((s, p) => s + p.attrs[a], 0) / st.length);
  return k;
}

export function wheel(mine: PlanId, theirs: PlanId): 'win' | 'lose' | 'tie' {
  if (planById(mine).beats === theirs) return 'win';
  if (planById(theirs).beats === mine) return 'lose';
  return 'tie';
}

const WHEEL_F = { win: 1.12, lose: 0.89, tie: 1.0 };

export function aiPlan(t: Team): PlanId {
  if (Math.random() < 0.15) return pick(PLANS).id; // the occasional surprise
  return PLANS.reduce((best, pl) => (teamPower(t, pl.id) > teamPower(t, best) ? pl.id : best), PLANS[0].id);
}

export function logistic(diff: number): number {
  return 1 / (1 + Math.exp(-diff / 18));
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

// ---- the box score: 4 stats, one per attribute, dealt from the team totals ----

function dealStat(pool: { p: Player; w: number }[], total: number, weigh: (p: Player) => number): Map<number, number> {
  const out = new Map<number, number>();
  const ws = pool.map((x) => x.w * (1 + weigh(x.p)));
  const tw = ws.reduce((a, x) => a + x, 0) || 1;
  let dealt = 0;
  pool.forEach((x, i) => {
    const n = Math.round((ws[i] / tw) * total);
    out.set(x.p.id, n);
    dealt += n;
  });
  // rounding drift lands on the heaviest hand
  if (pool.length) {
    const top = pool.reduce((b, x, i) => (ws[i] > ws[b.i] ? { i, x } : b), { i: 0, x: pool[0] });
    out.set(top.x.p.id, Math.max(0, (out.get(top.x.p.id) ?? 0) + (total - dealt)));
  }
  return out;
}

/** Deal my team's box score from the final score, write season stats, return rows. */
export function dealBox(me: Team, myScore: number, plan: PlanId): BoxRow[] {
  const pool = [
    ...starters(me).filter(available).map((p) => ({ p, w: 3 })),
    ...benchPlayers(me).filter(available).map((p) => ({ p, w: 1 })),
  ];
  if (!pool.length) return [];
  const pts = dealStat(pool, myScore, (p) => attrEff(p, 'skl') + attrEff(p, 'ath') * 0.3);
  const reb = dealStat(pool, 16 + rand(12), (p) => attrEff(p, 'ath') + sizeIndex(p) * 2);
  const stl = dealStat(pool, 3 + rand(6) + (plan === 'lockdown' ? 3 : 0), (p) => attrEff(p, 'frc'));
  const ast = dealStat(pool, 6 + rand(8) + (plan === 'clockwork' ? 3 : 0), (p) => attrEff(p, 'brn'));
  const rows: BoxRow[] = pool.map(({ p }) => {
    const row: BoxRow = {
      playerId: p.id,
      name: p.name,
      pts: pts.get(p.id) ?? 0,
      reb: reb.get(p.id) ?? 0,
      stl: stl.get(p.id) ?? 0,
      ast: ast.get(p.id) ?? 0,
    };
    p.stats.gp++;
    p.stats.pts += row.pts;
    p.stats.reb += row.reb;
    p.stats.stl += row.stl;
    p.stats.ast += row.ast;
    return row;
  });
  return rows.sort((a, b) => b.pts - a.pts);
}

function boxLineFrom(rows: BoxRow[]): string {
  if (!rows.length) return '';
  const top = rows[0];
  const extras: string[] = [];
  const bestReb = [...rows].sort((a, b) => b.reb - a.reb)[0];
  const bestAst = [...rows].sort((a, b) => b.ast - a.ast)[0];
  if (bestReb.playerId !== top.playerId && bestReb.reb >= 6) extras.push(`${bestReb.name} owned the glass (${bestReb.reb} reb)`);
  else if (bestAst.playerId !== top.playerId && bestAst.ast >= 5) extras.push(`${bestAst.name} ran the show (${bestAst.ast} ast)`);
  return `${top.name} led the way with ${top.pts} points.${extras.length ? ` ${extras[0]}.` : ''}`;
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
  const fit = (p: Player): number => attrEff(p, mine.attr);
  const hero = [...st].sort((a, b) => fit(b.p) - fit(a.p))[0].p;
  const goatX = [...st].sort((a, b) => fit(a.p) - fit(b.p))[0];
  const goat = goatX.p;
  const goatMuted = (mine.attr === 'ath' || mine.attr === 'frc' ? goat.energy : goat.mood) <= 40;
  let heroLine: string;
  if (won) heroLine = `${hero.name} was built for this.`;
  else if (miscast.length) heroLine = `${miscast[0].p.name} was miscast in the ${COL_LABELS[miscast[0].c].toLowerCase()} all night.`;
  else if (goatMuted) heroLine = `${goat.name} played half a step slow — ${mine.attr === 'ath' || mine.attr === 'frc' ? '⚡ was low' : "his head wasn't here"}.`;
  else heroLine = `${goat.name} never fit the plan tonight — his ${ATTR_STAT[mine.attr]} column says it all.`;
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
  const box = dealBox(me, sc.my, s.plan);
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
      boxLine: boxLineFrom(box),
      box,
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
  const box = dealBox(me, sc.my, s.plan);
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
      boxLine: boxLineFrom(box),
      box,
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
