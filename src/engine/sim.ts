// The sim (SPEC §4): SKILL is never muted, leans are, the wheel decides ±12%,
// and the whole thing fits on one screen. Tactics = read their shape, pick the
// counter, get graded out loud.

import { PLANS, planById } from './data';
import type { ChampTeam, GameState, MyGameResult, PlanId, Player, Team } from './types';
import { clamp, effLean, pick, rand } from './util';

export function available(p: Player): boolean {
  return p.outWeeks === 0;
}

// ---- lineup -------------------------------------------------------------------

function byId(t: Team, id: number | null): Player | null {
  return id === null ? null : t.players.find((p) => p.id === id) ?? null;
}

/** Strip unavailable players, fill holes from reserves by skill. */
export function normalizeLineup(t: Team): void {
  const seen = new Set<number>();
  for (const row of ['starters', 'bench'] as const) {
    for (let i = 0; i < 3; i++) {
      const p = byId(t, t.lineup[row][i]);
      if (!p || !available(p) || seen.has(p.id)) t.lineup[row][i] = null;
      else seen.add(p.id);
    }
  }
  const pool = t.players.filter((p) => available(p) && !seen.has(p.id)).sort((a, b) => b.skill - a.skill);
  for (const row of ['starters', 'bench'] as const) {
    for (let i = 0; i < 3; i++) {
      if (t.lineup[row][i] === null && pool.length) t.lineup[row][i] = pool.shift()!.id;
    }
  }
}

export function autoLineup(t: Team): void {
  t.lineup = { starters: [null, null, null], bench: [null, null, null] };
  normalizeLineup(t);
}

export function starters(t: Team): Player[] {
  return t.lineup.starters.map((id) => byId(t, id)).filter((p): p is Player => !!p);
}
export function benchPlayers(t: Team): Player[] {
  return t.lineup.bench.map((id) => byId(t, id)).filter((p): p is Player => !!p);
}
export function reserves(t: Team): Player[] {
  const used = new Set([...t.lineup.starters, ...t.lineup.bench].filter((x): x is number => x !== null));
  return t.players.filter((p) => !used.has(p.id));
}

// ---- power ---------------------------------------------------------------------

export function playerPower(p: Player, plan: PlanId): number {
  return p.skill + effLean(p, planById(plan).pole) * 0.5;
}

export function teamPower(t: Team, plan: PlanId): number {
  return (
    starters(t).reduce((a, p) => a + playerPower(p, plan), 0) +
    benchPlayers(t).reduce((a, p) => a + playerPower(p, plan), 0) * 0.3
  );
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

// ---- the game itself ----------------------------------------------------------------

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
  const st = starters(me);
  if (!st.length) return { wheelLine, heroLine: 'You fielded nobody. The scoreboard noticed.' };
  const fit = (p: Player): number => effLean(p, mine.pole);
  const hero = [...st].sort((a, b) => fit(b) - fit(a))[0];
  const goat = [...st].sort((a, b) => fit(a) - fit(b))[0];
  const goatMuted =
    (mine.pole === 'strong' || mine.pole === 'quick' ? goat.energy : goat.mood) <= 40;
  const heroLine = won
    ? `${hero.name} was built for this.`
    : goatMuted
      ? `${goat.name} played half a step slow — ${mine.pole === 'strong' || mine.pole === 'quick' ? '⚡ was low' : 'his head wasn\'t here'}.`
      : `${goat.name} never fit the plan tonight.`;
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

/** Clamp helper re-exported for state.ts convenience. */
export { clamp };
