import { clamp, emptyLineup, rand } from './gen';
import type { BoxLine, GameResult, Player, Slot, StatKey, Team } from './types';

// ---- effective stats ------------------------------------------------------
// Fitness drags/boosts Physical; mood does the same for Mental.

export function effStat(p: Player, k: StatKey): number {
  let v = p.stats[k];
  if (k === 'phy') v += (p.fitness - 75) * 0.25;
  if (k === 'men') v += (p.mood - 60) * 0.25;
  return clamp(Math.round(v), 1, 99);
}

// ---- position & rating ----------------------------------------------------

export const SLOT_ORDER: Slot[] = ['G', 'F', 'C'];

/** Out-of-position penalty: adjacent position −20%, G↔C −50%. */
export function posMult(pref: Slot, slot: Slot): number {
  if (pref === slot) return 1;
  if ((pref === 'G' && slot === 'C') || (pref === 'C' && slot === 'G')) return 0.5;
  return 0.8;
}

/** 0-100: current overall (fitness/mood baked in), no position context. */
export function overall(p: Player): number {
  return Math.round((effStat(p, 'phy') + effStat(p, 'men') + effStat(p, 'off') + effStat(p, 'def')) / 4);
}

/** Overall as it plays in a given slot (out-of-position penalty applied). */
export function ovrInSlot(p: Player, slot: Slot): number {
  return Math.round(overall(p) * posMult(p.pos, slot));
}

// ---- lineup management ----------------------------------------------------

export function available(p: Player): boolean {
  return p.outWeeks === 0;
}

function byId(t: Team, id: number | null): Player | null {
  if (id === null) return null;
  return t.players.find((p) => p.id === id) ?? null;
}

/** Strip unavailable/missing players, then fill empty slots from reserves by rating. */
export function normalizeLineup(t: Team): void {
  const seen = new Set<number>();
  for (const row of ['starters', 'bench'] as const) {
    for (const s of SLOT_ORDER) {
      const p = byId(t, t.lineup[row][s]);
      if (!p || !available(p) || seen.has(p.id)) t.lineup[row][s] = null;
      else seen.add(p.id);
    }
  }
  const pool = t.players.filter((p) => available(p) && !seen.has(p.id));
  for (const row of ['starters', 'bench'] as const) {
    for (const s of SLOT_ORDER) {
      if (t.lineup[row][s] === null && pool.length > 0) {
        const idx = pool.reduce((bi, p, i) => (ovrInSlot(p, s) > ovrInSlot(pool[bi], s) ? i : bi), 0);
        t.lineup[row][s] = pool.splice(idx, 1)[0].id;
      }
    }
  }
}

/** AI teams: rebuild the whole lineup from scratch by best fit. */
export function autoLineup(t: Team): void {
  t.lineup = emptyLineup();
  normalizeLineup(t);
}

export function reserves(t: Team): Player[] {
  const used = new Set<number>();
  for (const row of ['starters', 'bench'] as const) {
    for (const s of SLOT_ORDER) {
      const id = t.lineup[row][s];
      if (id !== null) used.add(id);
    }
  }
  return t.players.filter((p) => !used.has(p.id));
}

// ---- game simulation ------------------------------------------------------

interface SlotPair { starter: Player | null; bench: Player | null; slot: Slot }

function slotPairs(t: Team): SlotPair[] {
  return SLOT_ORDER.map((s) => ({
    slot: s,
    starter: byId(t, t.lineup.starters[s]),
    bench: byId(t, t.lineup.bench[s]),
  }));
}

const SCRUB = 22; // an empty slot plays like nobody, because it is nobody

function offSkill(p: Player): number {
  return effStat(p, 'off') * 0.5 + effStat(p, 'phy') * 0.25 + effStat(p, 'men') * 0.25;
}
function defSkill(p: Player): number {
  return effStat(p, 'def') * 0.55 + effStat(p, 'phy') * 0.25 + effStat(p, 'men') * 0.2;
}

function pairValue(pair: SlotPair, kind: 'off' | 'def'): number {
  const val = (p: Player | null): number => {
    if (!p) return SCRUB;
    const skill = kind === 'off' ? offSkill(p) : defSkill(p);
    return (0.5 * overall(p) + 0.5 * skill) * posMult(p.pos, pair.slot);
  };
  return 0.7 * val(pair.starter) + 0.3 * val(pair.bench);
}

function teamStrength(t: Team): { off: number; def: number; sho: number } {
  const pairs = slotPairs(t);
  const off = pairs.reduce((a, p) => a + pairValue(p, 'off'), 0) / 3;
  const def = pairs.reduce((a, p) => a + pairValue(p, 'def'), 0) / 3;
  const shooters = pairs.flatMap((p) => [p.starter, p.bench]).filter((p): p is Player => !!p);
  const sho = shooters.length ? shooters.reduce((a, p) => a + effStat(p, 'off'), 0) / shooters.length : SCRUB;
  return { off, def, sho };
}

function pickScorer(t: Team): Player | null {
  const pairs = slotPairs(t);
  const pool: { p: Player; w: number }[] = [];
  for (const pair of pairs) {
    if (pair.starter) pool.push({ p: pair.starter, w: 0.72 * (offSkill(pair.starter) + 20) });
    if (pair.bench) pool.push({ p: pair.bench, w: 0.28 * (offSkill(pair.bench) + 20) });
  }
  if (!pool.length) return null;
  let r = Math.random() * pool.reduce((a, x) => a + x.w, 0);
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.p;
  }
  return pool[pool.length - 1].p;
}

export function simGame(home: Team, away: Team): GameResult {
  const H = teamStrength(home);
  const A = teamStrength(away);
  const pts: Record<number, number> = {};
  const score: Record<number, number> = { [home.id]: 0, [away.id]: 0 };

  const possession = (off: Team, offS: typeof H, defS: typeof H): void => {
    const homeCourt = off.id === home.id ? 1.5 : 0;
    const p = clamp(0.42 + (offS.off - defS.def + homeCourt) * 0.006, 0.2, 0.68);
    if (Math.random() < p) {
      const three = Math.random() < clamp(0.3 + (offS.sho - 50) * 0.004, 0.14, 0.5);
      const scorer = pickScorer(off);
      const v = three ? 3 : 2;
      score[off.id] += v;
      if (scorer) pts[scorer.id] = (pts[scorer.id] ?? 0) + v;
    }
  };

  const rounds = 29 + rand(5);
  for (let i = 0; i < rounds; i++) {
    possession(home, H, A);
    possession(away, A, H);
  }
  while (score[home.id] === score[away.id]) {
    for (let i = 0; i < 4; i++) {
      possession(home, H, A);
      possession(away, A, H);
    }
  }

  const box: BoxLine[] = [];
  for (const t of [home, away]) {
    for (const p of t.players) {
      if (pts[p.id] !== undefined) box.push({ playerId: p.id, name: p.name, teamId: t.id, pts: pts[p.id] });
    }
  }
  box.sort((a, b) => b.pts - a.pts);
  const star = box[0];
  const starTeam = star ? (star.teamId === home.id ? home : away) : null;

  return {
    homeId: home.id,
    awayId: away.id,
    homeScore: score[home.id],
    awayScore: score[away.id],
    box,
    starLine: star && starTeam ? `Star of the game: ${star.name} (${starTeam.name}), ${star.pts} pts` : '',
  };
}
