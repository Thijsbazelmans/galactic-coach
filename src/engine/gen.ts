// Generation: players, prospects, teams, schedules, tournament champions.

import {
  CHAMP_COLORS,
  CHAMP_GIMMICKS,
  CHAMP_NAMES,
  DEITY_NAMES,
  PLANS,
  PROSPECT_BLURBS,
  SPECIES,
  STARTING_PLANS,
  TEAM_TEMPLATES,
  galaxyActById,
  speciesById,
} from './data';
import type { AttrRec, ChampTeam, GameState, Lineup, PlanId, Player, Prospect, Team } from './types';
import { ATTRS, clamp, copyAttrs, genderize, ovr, pick, rand, zeroAttrs, zeroStats } from './util';

export const SAVE_VERSION = 15;
export const REGULAR_WEEKS = 10; // 6 teams, double round robin
export const UT_WEEKS = 3; // QF, SF, THE UNIVERSAL FINAL
export const ROSTER_SIZE = 9;
export const SELECT_POOL_SIZE = 12;
export const STIPEND = 6;
export const CACHE_MAX = 12;
export const AGING_SEASON = 21;
export const LEVEL_CAP = 10;
export const BAG_SIZE = 5;
export const MAX_PROSPECTS = 9;
/** An overall this high gets pro scouts in the dorm lobby. */
export const PRO_OVR = 52;
/** Meters live around 75. Natural recovery drifts HOME, never past it —
    the extremes (elated/angry, pumped/sleeping) belong to stories. */
export const METER_BASELINE = 75;

/** Weekly stipend shrinks by 1 per season from season 21. Mortality is an energy bill. */
export function stipendFor(season: number): number {
  return Math.max(0, STIPEND - Math.max(0, season - (AGING_SEASON - 1)));
}

/** XP needed to clear the given level. Early levels take weeks; late ones a season. */
export function xpNeed(level: number): number {
  return 20 + level * 12;
}

/** Pick a name nobody active is using; only a truly exhausted pool repeats. */
export function genName(taken?: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = pick(DEITY_NAMES);
    if (!taken?.has(n)) {
      taken?.add(n);
      return n;
    }
  }
  return pick(DEITY_NAMES);
}

// ---- attribute rolls --------------------------------------------------------

/** Distribute a target OVERALL across the four attributes, shaped by the
    species caps plus personal variation — members actually express their species. */
function rollAttrs(caps: AttrRec, target: number): AttrRec {
  const w = zeroAttrs();
  let tw = 0;
  for (const a of ATTRS) {
    w[a] = Math.pow(Math.max(1, caps[a]), 1.4) * (0.6 + Math.random() * 0.8);
    tw += w[a];
  }
  const attrs = zeroAttrs();
  for (const a of ATTRS) attrs[a] = clamp(Math.round((w[a] / tw) * target), 0, caps[a]);
  // spend the clamped/rounded remainder wherever there's room
  let left = target - ovr(attrs);
  let guard = 0;
  while (left > 0 && guard++ < 60) {
    const room = ATTRS.filter((a) => attrs[a] < caps[a]);
    if (!room.length) break;
    attrs[pick(room)]++;
    left--;
  }
  return attrs;
}

/** Personal ceilings: current + a rolled headroom per attribute, inside caps.
    A lopsided roll here is a lopsided potential square — that's the design. */
function rollPots(caps: AttrRec, attrs: AttrRec, headroom: number): AttrRec {
  const pots = zeroAttrs();
  for (const a of ATTRS) pots[a] = clamp(attrs[a] + rand(headroom + 1), attrs[a], caps[a]);
  // guarantee SOME road ahead if the species allows it
  let guard = 0;
  while (ovr(pots) - ovr(attrs) < 3 && guard++ < 20) {
    const room = ATTRS.filter((a) => pots[a] < caps[a]);
    if (!room.length) break;
    pots[pick(room)]++;
  }
  return pots;
}

function capSum(speciesId: string): number {
  return ovr(speciesById(speciesId).attrCaps);
}

function rollBody(speciesId: string): { heightCm: number; weightKg: number } {
  const sp = speciesById(speciesId);
  return {
    heightCm: sp.heightRange[0] + rand(sp.heightRange[1] - sp.heightRange[0] + 1),
    weightKg: sp.weightRange[0] + rand(sp.weightRange[1] - sp.weightRange[0] + 1),
  };
}

// ---- players -----------------------------------------------------------------

function levelForClass(classYear: number): number {
  return Math.min(LEVEL_CAP, classYear * 2 + rand(3));
}

const CLASS_HEADROOM = [9, 7, 5, 3];

export function genPlayer(counter: { nextId: number }, quality: number, classYear?: number, speciesId?: string, taken?: Set<string>): Player {
  const pool = SPECIES.filter((sp) => sp.rarity <= 1);
  const sp = speciesId ? speciesById(speciesId) : pick(pool);
  const cy = classYear ?? rand(4);
  const level = levelForClass(cy);
  const target = clamp(Math.round((22 + quality + rand(18) + level * 3) * 0.55), 6, capSum(sp.id) - 2);
  const attrs = rollAttrs(sp.attrCaps, target);
  const pots = rollPots(sp.attrCaps, attrs, CLASS_HEADROOM[Math.min(cy, 3)]);
  return {
    id: counter.nextId++,
    name: genName(taken),
    speciesId: sp.id,
    classYear: cy,
    form: Math.random() < 0.5 ? 'femme' : 'masc',
    jersey: rand(56),
    ...rollBody(sp.id),
    attrs,
    pots,
    startAttrs: copyAttrs(attrs),
    stats: zeroStats(),
    career: zeroStats(),
    level,
    xp: 0,
    energy: METER_BASELINE - 5 + rand(11),
    mood: METER_BASELINE - 5 + rand(11),
    outWeeks: 0,
    outReason: '',
    dnp: 0,
  };
}

export function genWalkOn(counter: { nextId: number }, taken?: Set<string>): Player {
  const gem = Math.random() < 0.12;
  const p = genPlayer(counter, gem ? 14 + rand(8) : -12 + rand(6), rand(4), undefined, taken);
  p.walkOn = true;
  p.gem = gem;
  if (gem) {
    const caps = speciesById(p.speciesId).attrCaps;
    for (const a of ATTRS) p.pots[a] = clamp(caps[a] - rand(3), p.attrs[a], caps[a]);
  }
  return p;
}

export function genSpecial(counter: { nextId: number }, kind: 'walkon' | 'gem' | 'daughter' | 'droid', taken?: Set<string>): Player {
  if (kind === 'daughter') {
    const p = genPlayer(counter, 12, 1, 'terran');
    p.name = 'Minervva';
    p.form = 'femme';
    p.special = 'daughter';
    const caps = speciesById('terran').attrCaps;
    for (const a of ATTRS) p.pots[a] = clamp(p.attrs[a] + 5, p.attrs[a], caps[a]);
    return p;
  }
  if (kind === 'droid') {
    const p = genPlayer(counter, 18, 2, 'robota');
    p.name = 'UNIT-7';
    p.special = 'droid';
    p.mood = 100; // it does not feel. probably.
    return p;
  }
  const p = genWalkOn(counter, taken);
  if (kind === 'gem') {
    p.gem = true;
    const caps = speciesById(p.speciesId).attrCaps;
    for (const a of ATTRS) {
      p.attrs[a] = clamp(p.attrs[a] + 2, 0, caps[a]);
      p.pots[a] = clamp(caps[a] - rand(2), p.attrs[a], caps[a]);
    }
    p.startAttrs = copyAttrs(p.attrs);
  }
  return p;
}

// ---- prospects ------------------------------------------------------------------

/** Refresh the coach's observation of a prospect at its current scout level.
    A stranger's report is a wild guess (±4 with a hype/slander bias); each
    scout action tightens the read; four looks is the truth. */
export function observe(pr: Prospect): void {
  // ABILITY sharpens toward truth; POTENTIAL keeps at least ±1 of projection
  // until he actually signs. Early reads can be WAY off: one shared
  // hype/slander bias (×0.6–1.5) on top of per-attribute noise.
  const caps = speciesById(pr.speciesId).attrCaps;
  const bias = pr.scoutLevel <= 1 ? 0.6 + Math.random() * 0.9 : 1;
  const fuzz = Math.max(0, 4 - pr.scoutLevel);
  const potFuzz = Math.max(1, fuzz);
  for (const a of ATTRS) {
    pr.seenAttrs[a] = fuzz ? clamp(Math.round(pr.attrs[a] * bias) + rand(fuzz * 2 + 1) - fuzz, 0, caps[a]) : pr.attrs[a];
    pr.seenPots[a] = clamp(Math.round(pr.pots[a] * bias) + rand(potFuzz * 2 + 1) - potFuzz, pr.seenAttrs[a], caps[a]);
  }
}

export function genProspect(counter: { nextId: number }, seasonNo: number, searchId: string, taken?: Set<string>): Prospect {
  const act = galaxyActById(searchId);
  const pool = act.pool ?? ['terran'];
  const sp = speciesById(pick(pool));
  const quality = 4 + rand(12) + Math.min(seasonNo, 5) + (act.skillBonus ?? 0);
  const target = clamp(Math.round((18 + quality + rand(14)) * 0.55), 6, capSum(sp.id) - 4);
  const attrs = rollAttrs(sp.attrCaps, target);
  const pots = rollPots(sp.attrCaps, attrs, 7 + Math.round((act.potBonus ?? 0) * 0.4));
  const form: 'masc' | 'femme' = Math.random() < 0.5 ? 'femme' : 'masc';
  const pr: Prospect = {
    id: counter.nextId++,
    name: genName(taken),
    speciesId: sp.id,
    form,
    ...rollBody(sp.id),
    attrs,
    pots,
    scoutLevel: 0,
    seenAttrs: copyAttrs(attrs),
    seenPots: copyAttrs(pots),
    seenSkill: false,
    seenPot: false,
    digits: 0,
    digitFirst: Math.random() < 0.5 ? 'tens' : 'ones',
    blurb: genderize(pick(PROSPECT_BLURBS), form),
    commitPct: 0,
    bannedWeeks: 0,
    selected: false,
  };
  observe(pr);
  return pr;
}

export function prospectToPlayer(pr: Prospect): Player {
  return {
    id: pr.id,
    name: pr.name,
    speciesId: pr.speciesId,
    form: pr.form,
    classYear: 0,
    jersey: rand(56),
    heightCm: pr.heightCm,
    weightKg: pr.weightKg,
    attrs: copyAttrs(pr.attrs),
    pots: copyAttrs(pr.pots),
    startAttrs: copyAttrs(pr.attrs),
    stats: zeroStats(),
    career: zeroStats(),
    level: rand(2),
    xp: 0,
    energy: METER_BASELINE - 5 + rand(11),
    mood: METER_BASELINE - 5 + rand(11),
    outWeeks: 0,
    outReason: '',
    dnp: 0,
  };
}

// ---- teams & schedule -------------------------------------------------------------

export function ensureUniqueJerseys(players: Player[]): void {
  const used = new Set<number>();
  for (const p of players) {
    while (used.has(p.jersey)) p.jersey = (p.jersey + 1 + rand(7)) % 100;
    used.add(p.jersey);
  }
}

export function emptyLineup(): Lineup {
  return { slots: Array.from({ length: 9 }, () => null) };
}

function genTeam(counter: { nextId: number }, idx: number, taken: Set<string>): Team {
  const t = TEAM_TEMPLATES[idx];
  const players: Player[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) players.push(genPlayer(counter, rand(10), undefined, undefined, taken));
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
    plan: 'showtime',
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

/** Double round robin via the circle method: 6 teams → 10 weeks, 3 games/week. */
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

// ---- the Universal Tournament -------------------------------------------------------

export function genChamps(myPower: number, _season: number): ChampTeam[] {
  const names = [...CHAMP_NAMES];
  const champs: ChampTeam[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = rand(names.length);
    const [planet, name] = names.splice(idx, 1)[0];
    const plan: PlanId = pick(PLANS).id;
    const planAttr = PLANS.find((p) => p.id === plan)!.attr;
    // a representative team kite, spiked toward the plan's attribute
    const kite = zeroAttrs();
    for (const a of ATTRS) kite[a] = a === planAttr ? 16 + rand(8) : 5 + rand(9);
    const colors = CHAMP_COLORS[i % CHAMP_COLORS.length];
    champs.push({
      name: `${planet} ${name}`,
      gimmick: pick(CHAMP_GIMMICKS),
      bg: colors[0],
      fg: colors[1],
      plan,
      // champions are your equal on a good day — and the rounds get harder
      power: Math.round(myPower * (1.02 + rand(18) / 100 + i * 0.02)),
      kite,
    });
  }
  return champs;
}

// ---- fresh state -----------------------------------------------------------------------

export function newGameState(): GameState {
  const counter = { nextId: 1 };
  const takenNames = new Set<string>();
  const teams = TEAM_TEMPLATES.map((_, i) => genTeam(counter, i, takenNames));
  return {
    version: SAVE_VERSION,
    season: 1,
    week: 1,
    phase: 'pickTeam',
    myTeamId: -1,
    teams,
    schedule: genSchedule(teams.length),
    energy: STIPEND,
    heatS: 0,
    heatB: 0,
    interferedS: false,
    interferedB: false,
    legacy: 0,
    trophies: 0,
    utTitles: 0,
    totalWins: 0,
    queue: [],
    futureBeats: [],
    prospects: [],
    pendingRecruits: [],
    bag: [],
    legendariesUsed: [],
    unlockedDrills: ['shootaround', 'scrimmage', 'twodays', 'rest', 'bonfire'],
    unlockedRegions: ['reccenter', 'home', 'nebula', 'outerrim'],
    knownPlans: [...STARTING_PLANS],
    tipsSeen: [],
    tipsAuto: false, // instinct first — a proper succinct tutorial comes later (? still works)
    groundedWeeks: 0,
    trainedThisWeek: false,
    galaxyActWk: false,
    speechFx: null,
    speechFxH2: null,
    sitouts: [],
    scoutedOpp: false,
    drillReport: null,
    voyageRolled: false,
    plan: 'showtime',
    pregameFlags: {},
    lastResult: null,
    postGame: [],
    resultsLog: [],
    ut: null,
    alumni: [],
    voidReturnUsed: false,
    proDeparts: [],
    commits: [],
    selectPool: [],
    signingResults: [],
    seasonNotes: [],
    seasonChampion: null,
    end: null,
    careerLog: [],
    nextId: counter.nextId,
    nextUid: 1,
  };
}
