// Generation: players, prospects, teams, schedules, tournament champions.

import {
  CHAMP_COLORS,
  CHAMP_GIMMICKS,
  CHAMP_NAMES,
  DEITY_NAMES,
  PLANS,
  PROSPECT_BLURBS,
  SPECIES_ODDS,
  STARTING_INSTRUCTIONS,
  STARTING_PLANS,
  LEAGUE,
  speciesById,
} from './data';
import type { TeamTemplate } from './data';
import type { Attr, AttrRec, ChampTeam, GameState, Lineup, PlanId, Player, Prospect, Team } from './types';
import { ATTRS, clamp, copyAttrs, genderize, ovr, pick, potStars, rand, zeroAttrs, zeroStats } from './util';

export const SAVE_VERSION = 22; // v5 THE BIG SIX: one league, conferences retired, old saves feed the codex
export const REGULAR_WEEKS = 10; // 6 teams, double round robin
export const UT_WEEKS = 3; // QF, SF, THE UNIVERSAL FINAL
export const ROSTER_SIZE = 9;
export const SELECT_POOL_SIZE = 12;
/** CREDITS, the coach's currency (player energy stays ⚡): +5 a week by
    definition — the week has three paid stops now (scout, practice,
    recruit); the rest you EARN from Scoop, the Dean and the Booster. */
export const STIPEND = 5;
export const CACHE_MAX = 9;
export const AGING_SEASON = 21;
export const LEVEL_CAP = 10;
export const BAG_SIZE = 8; // two rows; THE NOTEBOOK stands tall on the left, forever
export const MAX_PROSPECTS = 9;
/** An overall this high gets pro scouts in the dorm lobby (on THE SLIDE a
    72 is a semifinal-tier starter — the ones who can win you THE BIG BANG
    are exactly the ones the pros come for). */
export const PRO_OVR = 75;

// ---- THE SLIDE: the galaxy's strength ladder, fixed ------------------------------
// Numbers are the average SLOT RATING of a team's six floor players. Your
// tryouts land you 4th–5th in the league; the league top is a real
// program; THE BIG BANG's field sits above all of it, the champion highest.
// Which league team is best reshuffles every summer — the ladder doesn't.

/** the five AI programs in your league, best → worst (±jitter) */
// +2 across the slide (260830): the speech rework made every landed speech a
// net-positive trade (gain 4–5 / lose 2–3, mine only) — under the ^6
// win-share curve that edge compounded to ~+25 wins a career, so the other
// programs stand a step taller to keep the accepted curve (~131 wins/career)
// +1 across the slide (playtest #7): THE COUNTER hands the coach a weekly
// ×0.95 shave on the opponent — worth ~+15 wins/career at the board — so
// the other programs stand a step taller again to keep the accepted curve
// (the cellar door stays at 40: one beatable neighbor keeps the early-career
// seat survivable — headless security floors sank when it rose too)
export const CONF_TIERS = [65, 58, 52, 47, 40];
/** your founding six (walk-ons fill the rest, weaker) */
export const FOUNDER_TIER = 47;
/** THE BIG BANG by round: first round · semifinal · the final */
export const UT_TIERS: [number, number][] = [[64, 74], [70, 80], [74, 84]];
/** the rubber band: per title / per season without a tournament win, and its
    walls. Raised for THE CAMPUS era: a facilities-powered dynasty outgrew
    the old +9 ceiling (headless: 11 titles in ten careers) — the field now
    keeps hunting a repeat champion much longer. */
export const FIELD_HUNT = 4;
export const FIELD_EASE = 2;
export const FIELD_MAX = 16;
export const FIELD_MIN = -6;
/** Meters live around 75. Natural recovery drifts HOME, never past it —
    the extremes (elated/angry, pumped/sleeping) belong to stories. */
export const METER_BASELINE = 75;

/** The weekly credit stipend erodes from season 21 — mortality is a bill. */
export function stipendFor(season: number): number {
  return Math.max(0, STIPEND - Math.ceil(Math.max(0, season - (AGING_SEASON - 1)) / 2));
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

// ---- attribute rolls (THE GROWTH & SPECIES rework) --------------------------
// Every player's potential OVERALL lands in one of five bands; each species
// carries the band odds (terran and nimbus are exact mirrors). The potential
// is distributed along the species' compass shape profile; the current
// attributes are a level-scaled fraction of the potential. The only hard
// walls anywhere are the 0–25 scale and level 10.

const BANDS: [number, number][] = [[0, 19], [20, 39], [40, 59], [60, 79], [80, 99]];

function rollBandIx(speciesId: string): number {
  const sp = speciesById(speciesId);
  let r = Math.random() * 100;
  for (let i = 0; i < 5; i++) {
    r -= sp.bands[i];
    if (r <= 0) return i;
  }
  return 4;
}

/** Roll a potential OVERALL from the species' band odds; shift nudges the
    landed band (gems up, rec-center bodies down) and luck takes the worst
    (−1) or best (+1) of two rolls — walk-ons are generally not very good,
    with an exception here or there. Never off the scale. */
export function rollPotOvr(speciesId: string, shift = 0, luck = 0): number {
  let ix = rollBandIx(speciesId);
  if (luck !== 0) {
    const second = rollBandIx(speciesId);
    ix = luck > 0 ? Math.max(ix, second) : Math.min(ix, second);
  }
  ix = clamp(ix + shift, 0, 4);
  const [lo, hi] = BANDS[ix];
  return lo + rand(hi - lo + 1);
}

const OPP: Record<Attr, Attr> = { skl: 'ath', ath: 'skl', frc: 'brn', brn: 'frc' };

/** Distribute a target OVERALL across the four attributes along the species
    shape profile (biased attrs pull ~2×) plus personal variation — and, half
    the time, a personal SPIKE: one attribute doubled, its opposite halved.
    That's where the fierce guard and the thinking center come from. */
function distribute(speciesId: string, target: number): AttrRec {
  const sp = speciesById(speciesId);
  const w = zeroAttrs();
  let tw = 0;
  const spike: Attr | null = Math.random() < 0.5 ? pick(ATTRS) : null;
  for (const a of ATTRS) {
    w[a] = (sp.bias.includes(a) ? 2.1 : 1) * (0.6 + Math.random() * 0.8);
    if (spike === a) w[a] *= 2;
    if (spike && OPP[spike] === a) w[a] *= 0.55;
    tw += w[a];
  }
  const out = zeroAttrs();
  for (const a of ATTRS) out[a] = clamp(Math.round((w[a] / tw) * target), 0, 25);
  let left = target - ovr(out);
  let guard = 0;
  while (left > 0 && guard++ < 120) {
    const room = ATTRS.filter((a) => out[a] < 25);
    if (!room.length) break;
    out[pick(room)]++;
    left--;
  }
  while (left < 0 && guard++ < 120) {
    const room = ATTRS.filter((a) => out[a] > 0);
    if (!room.length) break;
    out[pick(room)]--;
    left++;
  }
  return out;
}

/** Where he is now: a level-scaled fraction of where he can go. */
function currentFromPots(pots: AttrRec, level: number): AttrRec {
  const f = clamp(0.32 + 0.065 * level + (Math.random() * 0.12 - 0.06), 0.15, 1);
  const attrs = zeroAttrs();
  for (const a of ATTRS) {
    attrs[a] = clamp(Math.round(pots[a] * clamp(f + (Math.random() * 0.14 - 0.07), 0.1, 1)), 0, pots[a]);
  }
  return attrs;
}

/** POSITION is assigned at generation, from the body with some drift:
    short kids grow up guards, tall ones centers — mostly. The drift is
    where the 190cm center and the 200cm point guard come from. */
export function posFor(b: { heightCm: number }): number {
  const base = b.heightCm < 183 ? 0 : b.heightCm < 197 ? 1 : 2;
  if (Math.random() < 0.22) return clamp(base + (Math.random() < 0.5 ? -1 : 1), 0, 2);
  return base;
}

/** Nimbus, gelid and robota are genderless — they/them. */
const X_SPECIES = new Set(['nimbus', 'gelid', 'robota']);

export function formFor(speciesId: string): 'masc' | 'femme' | 'x' {
  if (X_SPECIES.has(speciesId)) return 'x';
  return Math.random() < 0.5 ? 'femme' : 'masc';
}

function rollBody(speciesId: string): { heightCm: number; weightKg: number } {
  const sp = speciesById(speciesId);
  return {
    heightCm: sp.heightRange[0] + rand(sp.heightRange[1] - sp.heightRange[0] + 1),
    weightKg: sp.weightRange[0] + rand(sp.weightRange[1] - sp.weightRange[0] + 1),
  };
}

/** Weighted species roll from an odds table (data.ts SPECIES_ODDS). */
export function rollSpecies(odds: [string, number][]): string {
  const total = odds.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of odds) {
    r -= w;
    if (r <= 0) return id;
  }
  return odds[0][0];
}

/** The league at large: terrans everywhere, one nimbus per blue moon. */
const LEAGUE_ODDS: [string, number][] = [
  ['terran', 56], ['quadran', 11], ['hexid', 11], ['petran', 11],
  ['oculid', 3], ['robota', 3], ['gelid', 3], ['nimbus', 2],
];

// ---- players -----------------------------------------------------------------

/** Starting levels by class: Fr 0 · So 2–6 · Jr 4–8 · Sr 6–10. */
function levelForClass(classYear: number): number {
  if (classYear <= 0) return 0;
  return Math.min(LEVEL_CAP, classYear * 2 + rand(5));
}

export function genPlayer(counter: { nextId: number }, bandShift: number, classYear?: number, speciesId?: string, taken?: Set<string>, luck = 0, levelScale = 1): Player {
  const spId = speciesId ?? rollSpecies(LEAGUE_ODDS);
  const cy = classYear ?? rand(4);
  const level = Math.round(levelForClass(cy) * levelScale);
  const pots = distribute(spId, rollPotOvr(spId, bandShift, luck));
  const attrs = currentFromPots(pots, level);
  const body = rollBody(spId);
  return {
    id: counter.nextId++,
    name: genName(taken),
    speciesId: spId,
    classYear: cy,
    form: formFor(spId),
    jersey: rand(56),
    ...body,
    pos: posFor(body),
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
    patience: 2 + rand(5),
  };
}

/** A player built to a TARGET overall (THE SLIDE): the ceiling sits some way
    above it, the level follows from how much of that ceiling he already is.
    Used for every roster you never scout — the other programs, your founding
    six — so the ladder holds regardless of what the band dice would say. */
export function genPlayerAt(counter: { nextId: number }, target: number, classYear?: number, speciesId?: string, taken?: Set<string>, headroom = 8 + rand(22)): Player {
  const spId = speciesId ?? rollSpecies(LEAGUE_ODDS);
  const cy = classYear ?? rand(4);
  const cur = clamp(Math.round(target), 4, 96);
  const potOvr = clamp(cur + headroom, cur + 2, 99);
  const pots = distribute(spId, potOvr);
  const attrs = zeroAttrs();
  for (const a of ATTRS) attrs[a] = clamp(Math.round(pots[a] * (cur / potOvr) + (Math.random() * 1.6 - 0.8)), 0, pots[a]);
  // settle the rounding onto the target
  let guard = 0;
  while (ovr(attrs) < cur && guard++ < 60) {
    const room = ATTRS.filter((a) => attrs[a] < pots[a]);
    if (!room.length) break;
    attrs[pick(room)]++;
  }
  while (ovr(attrs) > cur && guard++ < 120) {
    const room = ATTRS.filter((a) => attrs[a] > 0);
    if (!room.length) break;
    attrs[pick(room)]--;
  }
  const frac = ovr(attrs) / Math.max(1, ovr(pots));
  const level = clamp(Math.round((frac - 0.32) / 0.065), 0, LEVEL_CAP);
  const body = rollBody(spId);
  return {
    id: counter.nextId++,
    name: genName(taken),
    speciesId: spId,
    classYear: cy,
    form: formFor(spId),
    jersey: rand(56),
    ...body,
    pos: posFor(body),
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
    patience: 2 + rand(5),
  };
}

/** Nine bodies around a tier: six around the target, three a step below —
    the six who play average the tier. */
export function genRosterAt(counter: { nextId: number }, tier: number, taken: Set<string>): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) {
    const t = i < 6 ? tier - 5 + rand(11) : tier - 14 + rand(9);
    players.push(genPlayerAt(counter, t, undefined, undefined, taken));
  }
  ensureUniqueJerseys(players);
  return players;
}

export function genWalkOn(counter: { nextId: number }, taken?: Set<string>): Player {
  // walk-ons are walk-ons for a reason: worst of two band rolls, a band
  // down, and half the class levels — except the occasional GEM (a solid
  // find, not a franchise: best of two rolls, no band shift — a free
  // championship core should never wander in off the street)
  const gem = Math.random() < 0.07;
  const p = genPlayer(counter, gem ? 0 : -1, rand(4), undefined, taken, gem ? 1 : -1, gem ? 1 : 0.5);
  p.walkOn = true;
  p.gem = gem;
  return p;
}

export function genSpecial(counter: { nextId: number }, kind: 'walkon' | 'gem' | 'daughter' | 'droid', taken?: Set<string>): Player {
  if (kind === 'daughter') {
    const p = genPlayer(counter, 1, 1, 'terran');
    p.name = 'Minervva';
    p.form = 'femme';
    p.special = 'daughter';
    return p;
  }
  if (kind === 'droid') {
    const p = genPlayer(counter, 1, 2, 'robota');
    p.name = 'UNIT-7';
    p.special = 'droid';
    p.mood = 100; // it does not feel. probably.
    return p;
  }
  const p = genPlayer(counter, kind === 'gem' ? 1 : -1, rand(4), undefined, taken, kind === 'gem' ? 1 : -1, kind === 'gem' ? 1 : 0.5);
  p.walkOn = true;
  p.gem = kind === 'gem';
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
  const bias = pr.scoutLevel <= 1 ? 0.6 + Math.random() * 0.9 : 1;
  const fuzz = Math.max(0, 4 - pr.scoutLevel);
  const potFuzz = Math.max(1, fuzz);
  for (const a of ATTRS) {
    pr.seenAttrs[a] = fuzz ? clamp(Math.round(pr.attrs[a] * bias) + rand(fuzz * 2 + 1) - fuzz, 0, 25) : pr.attrs[a];
    pr.seenPots[a] = clamp(Math.round(pr.pots[a] * bias) + rand(potFuzz * 2 + 1) - potFuzz, pr.seenAttrs[a], 25);
  }
  // THE STARS LOCK IN (playtest #6): the first rating a coach ever SEES is
  // the one the board keeps saying — a sharper look never rewrites a shown
  // star count (it could read a hair off the truth; it can't read sloppy)
  if (pr.seenPot && pr.starsShown === undefined) pr.starsShown = potStars(ovr(pr.seenPots));
}

/** Where the stars are: the opening board and the local searches roll a
    band DOWN (a 4★ kid is a find, not a Tuesday); the nebula and the outer
    rim roll straight; the deep core takes the best of two. */
const REGION_ROLL: Record<string, { shift: number; luck: number }> = {
  opening: { shift: -1, luck: 0 },
  reccenter: { shift: -1, luck: -1 },
  home: { shift: -1, luck: 0 },
  nebula: { shift: 0, luck: 0 },
  stormlayers: { shift: 0, luck: 0 },
  outerrim: { shift: 0, luck: 0 },
  deepcore: { shift: 0, luck: 1 },
};

/** A prospect from a region's rarity dial. The region shifts WHO you find —
    and how far you had to fly says something about how good. */
export function genProspect(counter: { nextId: number }, _seasonNo: number, searchId: string, taken?: Set<string>): Prospect {
  const odds = SPECIES_ODDS[searchId] ?? SPECIES_ODDS.home;
  const spId = rollSpecies(odds);
  const rr = REGION_ROLL[searchId] ?? REGION_ROLL.home;
  const pots = distribute(spId, rollPotOvr(spId, rr.shift, rr.luck));
  // college-ready: a recruit arrives at level 2–4 — a third to a half of his
  // ceiling already — so a good class can turn a program in two seasons
  const level = 2 + rand(3);
  const attrs = currentFromPots(pots, level);
  const form = formFor(spId);
  const body = rollBody(spId);
  const pr: Prospect = {
    id: counter.nextId++,
    name: genName(taken),
    speciesId: spId,
    form,
    ...body,
    pos: posFor(body),
    attrs,
    pots,
    level,
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

/** Scouted recruits join at the readiness they were scouted at (level 2–4), 0 XP. */
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
    pos: pr.pos ?? posFor(pr),
    attrs: copyAttrs(pr.attrs),
    pots: copyAttrs(pr.pots),
    startAttrs: copyAttrs(pr.attrs),
    stats: zeroStats(),
    career: zeroStats(),
    level: pr.level ?? 2 + rand(3),
    xp: 0,
    energy: METER_BASELINE - 5 + rand(11),
    mood: METER_BASELINE - 5 + rand(11),
    outWeeks: 0,
    outReason: '',
    dnp: 0,
    patience: 2 + rand(5),
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

function genTeam(counter: { nextId: number }, idx: number, taken: Set<string>, t: TeamTemplate): Team {
  // a placeholder roster: chooseTeam() re-tiers the whole league around
  // whichever program you pick (THE SLIDE)
  const players = genRosterAt(counter, CONF_TIERS[2], taken);
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

// ---- THE BIG BANG -------------------------------------------------------------------

/** THE BIG BANG field: seven champions on the fixed slide — four first-round
    tiers (62–72), two semifinal tiers (68–78), one final tier (72–82) — plus
    THE RUBBER BAND (`shift`): the field hunts a champion and eases off a
    program that fell. The galaxy does not size itself to you: you climb to
    it, and then it climbs a little too. */
export function genChamps(shift = 0): ChampTeam[] {
  const names = [...CHAMP_NAMES];
  const champs: ChampTeam[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = rand(names.length);
    const [planet, name] = names.splice(idx, 1)[0];
    const plan: PlanId = pick(PLANS).id;
    const planAttr = PLANS.find((p) => p.id === plan)!.attr;
    const tier = i < 4 ? 0 : i < 6 ? 1 : 2;
    const [lo, hi] = UT_TIERS[tier];
    const avg = clamp(lo + rand(hi - lo + 1) + Math.round(shift), 30, 96);
    // a representative team kite, spiked toward the plan's attribute, sized
    // to the average
    const kite = zeroAttrs();
    for (const a of ATTRS) kite[a] = clamp(Math.round((avg / 4) * (a === planAttr ? 1.35 : 0.88) + rand(3) - 1), 1, 25);
    const colors = CHAMP_COLORS[i % CHAMP_COLORS.length];
    champs.push({
      name: `${planet} ${name}`,
      gimmick: pick(CHAMP_GIMMICKS),
      bg: colors[0],
      fg: colors[1],
      plan,
      // the bars run on six floor players at 75/25: three starters ×0.75 +
      // three bench ×0.25 = the average × 3
      power: Math.round(avg * 3),
      tier,
      avg,
      kite,
    });
  }
  return champs;
}

// ---- fresh state -----------------------------------------------------------------------

export function newGameState(): GameState {
  const counter = { nextId: 1 };
  const takenNames = new Set<string>();
  const teams = LEAGUE.teams.map((tt, i) => genTeam(counter, i, takenNames, tt));
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
    // JOB SECURITY: the school starts hopeful, everyone else neutral, and a
    // brand-new program is expected to deliver next to nothing
    opSchool: 70,
    opFans: 60,
    opPublic: 60,
    expectation: 1,
    legacy: 0,
    trophies: 0,
    utTitles: 0,
    totalWins: 0,
    queue: [],
    futureBeats: [],
    prospects: [],
    pendingRecruits: [],
    bag: [],
    notebook: [],
    legendariesUsed: [],
    unlockedDrills: ['shootaround', 'scrimmage', 'twodays', 'rest', 'bonfire'],
    unlockedRegions: ['reccenter', 'home', 'nebula', 'stormlayers', 'outerrim'],
    // THE CAMPUS: a normal career opens with everything at level 1 (the
    // level-0 squalor belongs to the tutorial) — the LEVELS gate what the
    // known drills/regions/acts above actually reach
    facilities: { ship: 1, gym: 1, cryo: 1, library: 1, stadium: 1, greekrow: 1 },
    knownPlans: [...STARTING_PLANS],
    knownInstr: [...STARTING_INSTRUCTIONS],
    tipsSeen: [],
    tipsAuto: false, // instinct first — a proper succinct tutorial comes later (? still works)
    groundedWeeks: 0,
    trainedThisWeek: false,
    scoutActWk: false,
    recruitActWk: false,
    speechFx: null,
    oppFx: null,
    sitouts: [],
    drillReport: null,
    voyageRolled: false,
    tacO: 'triangle',
    tacD: 'man',
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
