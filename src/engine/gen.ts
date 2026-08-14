import {
  DEITY_NAMES,
  PROSPECT_BLURBS,
  SCAN_REGIONS,
  SPECIES,
  TEAM_TEMPLATES,
  WALKON_BLURBS,
  speciesById,
} from './data';
import type { AttrKey, Attrs, GameState, Lineup, Player, Prospect, Team } from './types';

export const SAVE_VERSION = 8;
/** double round robin */
export const REGULAR_WEEKS = 14;
/** quarterfinals, semifinals, the Galactic Final */
export const TOTAL_WEEKS = 17;
export const BASE_ENERGY = 3;
export const ROSTER_SIZE = 9;
export const SELECT_POOL_SIZE = 12;

export const ATTR_KEYS: AttrKey[] = ['agi', 'str', 'han', 'sho', 'foc', 'agg', 'iq', 'tou'];

export function rand(n: number): number {
  return Math.floor(Math.random() * n);
}
export function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)];
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function genName(): string {
  return pick(DEITY_NAMES);
}

// ---- height/weight caps ---------------------------------------------------
// Very tall bodies cap agility; very light bodies cap strength. Weight swings
// (worry, binge eating) move these caps, which can drag the attribute down.

export function agiCap(heightCm: number, weightKg: number): number {
  return Math.round(clamp(99 - Math.max(0, heightCm - 200) * 0.9 - Math.max(0, weightKg - 115) * 0.35, 15, 99));
}

export function strCap(weightKg: number): number {
  return Math.round(clamp(99 - Math.max(0, 85 - weightKg) * 1.0, 15, 99));
}

export function attrCap(
  p: { heightCm: number; weightKg: number; potential: number; speciesId: string },
  k: AttrKey
): number {
  const sc = speciesById(p.speciesId).caps[k];
  if (k === 'agi') return Math.min(agiCap(p.heightCm, p.weightKg), sc);
  if (k === 'str') return Math.min(strCap(p.weightKg), sc);
  return sc;
}

/** Re-clamp capped attributes after height/weight changes. */
export function applyCaps(p: Player): void {
  p.attrs.agi = Math.min(p.attrs.agi, agiCap(p.heightCm, p.weightKg));
  p.attrs.str = Math.min(p.attrs.str, strCap(p.weightKg));
}

// ---- generation -----------------------------------------------------------

function rollBody(speciesId: string): { heightCm: number; weightKg: number } {
  const sp = speciesById(speciesId);
  const [h0, h1] = sp.heightRange;
  const [w0, w1] = sp.weightRange;
  return { heightCm: h0 + rand(h1 - h0 + 1), weightKg: w0 + rand(w1 - w0 + 1) };
}

function rollAttrs(speciesId: string, body: { heightCm: number; weightKg: number }, quality: number): Attrs {
  const sp = speciesById(speciesId);
  const attrs = {} as Attrs;
  for (const k of ATTR_KEYS) {
    const base = 34 + quality + rand(25) + (sp.mods[k] ?? 0);
    attrs[k] = clamp(base, 10, sp.caps[k]);
  }
  attrs.agi = Math.min(attrs.agi, agiCap(body.heightCm, body.weightKg));
  attrs.str = Math.min(attrs.str, strCap(body.weightKg));
  return attrs;
}

/** A player's natural position, derived from build and skills. Fixed for life.
 *  Clearly guard-shaped or center-shaped players get G/C; the rest are forwards. */
const POS_BIAS: Record<string, { g: number; c: number; fWidth: number }> = {
  terran: { g: 0, c: 0, fWidth: 18 },
  hexabrach: { g: -6, c: 6, fWidth: 30 }, // forwards & centers
  dodecapede: { g: 24, c: -10, fWidth: 14 }, // guards
  lithoid: { g: -14, c: 24, fWidth: 14 }, // centers
  luminar: { g: 14, c: -10, fWidth: 22 }, // guards & wings
};

export function preferredPos(attrs: Attrs, heightCm: number, speciesId: string): 'G' | 'F' | 'C' {
  const bias = POS_BIAS[speciesId] ?? POS_BIAS.terran;
  const g = attrs.agi + attrs.han + attrs.sho + Math.max(0, 190 - heightCm) * 0.8 + bias.g;
  const c = (attrs.str + attrs.agg + attrs.tou) * 0.94 + Math.max(0, heightCm - 198) * 0.8 + bias.c;
  if (Math.abs(g - c) < bias.fWidth) return 'F';
  return g > c ? 'G' : 'C';
}

export function genPlayer(counter: { nextId: number }, quality: number, classYear?: number): Player {
  const pool = SPECIES.filter((s) => s.rarity <= 1);
  const species = pick(pool);
  const body = rollBody(species.id);
  const attrs = rollAttrs(species.id, body, quality);
  return {
    id: counter.nextId++,
    name: genName(),
    speciesId: species.id,
    classYear: classYear ?? rand(4),
    pos: preferredPos(attrs, body.heightCm, species.id),
    jersey: rand(56),
    ...body,
    attrs,
    potential: clamp(60 + rand(35), 60, 95),
    fitness: 75 + rand(20),
    mood: 55 + rand(25),
    outWeeks: 0,
    outReason: '',
  };
}

export function genProspect(counter: { nextId: number }, seasonNo: number, regionId: string): Prospect {
  const region = SCAN_REGIONS.find((r) => r.id === regionId) ?? SCAN_REGIONS[0];
  const speciesId = pick(region.pool);
  const body = rollBody(speciesId);
  const attrs = rollAttrs(speciesId, body, 6 + rand(12) + Math.min(seasonNo, 4) + region.qualityBonus);
  return {
    id: counter.nextId++,
    name: genName(),
    speciesId,
    pos: preferredPos(attrs, body.heightCm, speciesId),
    ...body,
    attrs,
    potential: clamp(68 + rand(28) + region.potentialBonus, 68, 99),
    blurb: pick(PROSPECT_BLURBS),
    commitPct: 0,
    bannedWeeks: 0,
    selected: false,
  };
}

export function genWalkOn(counter: { nextId: number }): Player {
  const gem = Math.random() < 0.12;
  // any class year: wide-eyed freshmen, JuCo transfers, final-year gym rats
  const classYear = rand(4);
  const p = genPlayer(counter, gem ? 16 + rand(8) : -14 + rand(6), classYear);
  p.walkOn = true;
  p.gem = gem;
  if (gem) p.potential = clamp(80 + rand(16), 80, 96);
  else p.potential = clamp(45 + rand(20), 45, 65);
  p.name = `${p.name}`;
  return p;
}

export function walkOnBlurb(): string {
  return pick(WALKON_BLURBS);
}

/** Reassign duplicate jersey numbers so no two teammates share one. */
export function ensureUniqueJerseys(players: Player[]): void {
  const used = new Set<number>();
  for (const p of players) {
    while (used.has(p.jersey)) p.jersey = (p.jersey + 1 + rand(7)) % 100;
    used.add(p.jersey);
  }
}

export function emptyLineup(): Lineup {
  return { starters: { G: null, F: null, C: null }, bench: { G: null, F: null, C: null } };
}

function genTeam(counter: { nextId: number }, idx: number): Team {
  const t = TEAM_TEMPLATES[idx];
  const players: Player[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) players.push(genPlayer(counter, rand(10)));
  ensureUniqueJerseys(players);
  return {
    id: idx,
    name: t.name,
    planet: t.planet,
    region: t.region,
    bg: t.bg,
    fg: t.fg,
    players,
    lineup: emptyLineup(),
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

/** Double round robin via the circle method: 8 teams, 14 weeks, 4 games/week.
 *  Second half repeats the first with home/away flipped. */
export function genSchedule(teamCount: number): [number, number][][] {
  const ids = Array.from({ length: teamCount }, (_, i) => i);
  const half: [number, number][][] = [];
  for (let w = 0; w < teamCount - 1; w++) {
    const games: [number, number][] = [];
    for (let i = 0; i < teamCount / 2; i++) {
      const a = ids[i];
      const b = ids[teamCount - 1 - i];
      games.push(w % 2 === 0 ? [a, b] : [b, a]);
    }
    half.push(games);
    ids.splice(1, 0, ids.pop()!);
  }
  const back = half.map((games) => games.map(([h, a]) => [a, h] as [number, number]));
  return [...half, ...back];
}

export function newGameState(): GameState {
  const counter = { nextId: 1 };
  const teams = TEAM_TEMPLATES.map((_, i) => genTeam(counter, i));
  return {
    version: SAVE_VERSION,
    season: 1,
    week: 1,
    phase: 'pickTeam',
    myTeamId: -1,
    teams,
    schedule: genSchedule(teams.length),
    integrity: 50,
    trophies: 0,
    totalWins: 0,
    news: [],
    futureNews: [],
    prospects: [],
    energy: BASE_ENERGY,
    press: null,
    shipDamaged: false,
    lastTraining: null,
    restReport: null,
    unlockedTraining: ['asteroid', 'horizon'],
    unlockedRegions: ['home', 'nebula', 'outerrim'],
    restCount: 0,
    tactics: { pace: 0, plays: 0, scheme: 0 },
    oppScouted: false,
    proDeparts: [],
    recruitLog: [],
    postGame: [],
    playoff: null,
    commits: [],
    selectPool: [],
    signingResults: [],
    lastResults: [],
    seasonChampion: null,
    nextId: counter.nextId,
  };
}
