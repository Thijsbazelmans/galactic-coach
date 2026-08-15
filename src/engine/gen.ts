import {
  DEITY_NAMES,
  PROSPECT_BLURBS,
  SCAN_REGIONS,
  SPECIES,
  TEAM_TEMPLATES,
  WALKON_BLURBS,
  speciesById,
} from './data';
import type { GameState, Lineup, Player, Prospect, StatKey, Stats, Team } from './types';

export const SAVE_VERSION = 9;
/** double round robin */
export const REGULAR_WEEKS = 14;
/** quarterfinals, semifinals, the Galactic Final */
export const TOTAL_WEEKS = 17;
export const BASE_ENERGY = 6;
export const ROSTER_SIZE = 9;
export const SELECT_POOL_SIZE = 12;

export const STAT_KEYS: StatKey[] = ['phy', 'men', 'off', 'def'];

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

export function statCap(p: { speciesId: string }, k: StatKey): number {
  return speciesById(p.speciesId).caps[k];
}

export function rawOverall(stats: Stats): number {
  return Math.round((stats.phy + stats.men + stats.off + stats.def) / 4);
}

/** XP needed for the next level-up: grows with quality, spikes near potential. */
export function xpNeed(p: { stats: Stats; potential: number }): number {
  const raw = rawOverall(p.stats);
  return Math.round(24 + Math.max(0, raw - 40) * 2.2 + Math.max(0, raw - (p.potential - 8)) * 8);
}

// ---- generation -----------------------------------------------------------

function rollBody(speciesId: string): { heightCm: number; weightKg: number } {
  const sp = speciesById(speciesId);
  const [h0, h1] = sp.heightRange;
  const [w0, w1] = sp.weightRange;
  return { heightCm: h0 + rand(h1 - h0 + 1), weightKg: w0 + rand(w1 - w0 + 1) };
}

function rollStats(speciesId: string, quality: number): Stats {
  const sp = speciesById(speciesId);
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const base = 34 + quality + rand(25) + (sp.mods[k] ?? 0);
    stats[k] = clamp(base, 10, sp.caps[k]);
  }
  return stats;
}

const POS_BIAS: Record<string, { g: number; c: number; fWidth: number }> = {
  terran: { g: 0, c: 0, fWidth: 16 },
  hexabrach: { g: -6, c: 6, fWidth: 26 },
  dodecapede: { g: 22, c: -10, fWidth: 13 },
  lithoid: { g: -14, c: 22, fWidth: 13 },
  luminar: { g: 14, c: -10, fWidth: 20 },
};

export function preferredPos(stats: Stats, heightCm: number, speciesId: string): 'G' | 'F' | 'C' {
  const bias = POS_BIAS[speciesId] ?? POS_BIAS.terran;
  const g = stats.off * 0.9 + stats.men * 0.5 + Math.max(0, 190 - heightCm) * 0.9 + bias.g;
  const c = stats.phy * 0.6 + stats.def * 0.8 + Math.max(0, heightCm - 198) * 0.9 + bias.c;
  if (Math.abs(g - c) < bias.fWidth) return 'F';
  return g > c ? 'G' : 'C';
}

export function genPlayer(counter: { nextId: number }, quality: number, classYear?: number): Player {
  const pool = SPECIES.filter((s) => s.rarity <= 1);
  const species = pick(pool);
  const body = rollBody(species.id);
  const stats = rollStats(species.id, quality);
  return {
    id: counter.nextId++,
    name: genName(),
    speciesId: species.id,
    classYear: classYear ?? rand(4),
    pos: preferredPos(stats, body.heightCm, species.id),
    jersey: rand(56),
    ...body,
    stats,
    potential: clamp(60 + rand(35), 60, 95),
    xp: 0,
    pendingPoints: [],
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
  const stats = rollStats(speciesId, 6 + rand(12) + Math.min(seasonNo, 4) + region.qualityBonus);
  return {
    id: counter.nextId++,
    name: genName(),
    speciesId,
    pos: preferredPos(stats, body.heightCm, speciesId),
    ...body,
    stats,
    potential: clamp(68 + rand(28) + region.potentialBonus, 68, 99),
    blurb: pick(PROSPECT_BLURBS),
    commitPct: 0,
    bannedWeeks: 0,
    selected: false,
  };
}

export function genWalkOn(counter: { nextId: number }): Player {
  const gem = Math.random() < 0.12;
  const classYear = rand(4);
  const p = genPlayer(counter, gem ? 16 + rand(8) : -14 + rand(6), classYear);
  p.walkOn = true;
  p.gem = gem;
  if (gem) p.potential = clamp(80 + rand(16), 80, 96);
  else p.potential = clamp(45 + rand(20), 45, 65);
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

/** Double round robin via the circle method: 8 teams, 14 weeks, 4 games/week. */
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
    unlockedTraining: ['asteroid', 'horizon'],
    unlockedRegions: ['home', 'nebula', 'outerrim'],
    restReport: null,
    restCount: 0,
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
