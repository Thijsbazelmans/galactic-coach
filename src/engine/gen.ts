// Generation: players, prospects, teams, schedules, tournament champions.

import {
  CHAMP_COLORS,
  CHAMP_GIMMICKS,
  CHAMP_NAMES,
  DEITY_NAMES,
  PLANS,
  PROSPECT_BLURBS,
  SPECIES,
  TEAM_TEMPLATES,
  scanById,
  speciesById,
} from './data';
import type { ChampTeam, GameState, Lineup, PlanId, Player, Pole, Prospect, Team } from './types';
import { clamp, lean, pick, rand, star } from './util';

export const SAVE_VERSION = 11;
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

/** Weekly stipend shrinks by 1 per season from season 21. Mortality is an energy bill. */
export function stipendFor(season: number): number {
  return Math.max(0, STIPEND - Math.max(0, season - (AGING_SEASON - 1)));
}

/** XP needed to clear the given level. Early levels take weeks; late ones a season. */
export function xpNeed(level: number): number {
  return 20 + level * 12;
}

export function genName(): string {
  return pick(DEITY_NAMES);
}

// ---- axes -------------------------------------------------------------------

/** Roll an axis position within species caps: pick a pole (weighted by cap), then a lean. */
function rollAxis(capA: number, capB: number): number {
  // A = the low end of the axis (strong/fierce), B = the high end (quick/savvy)
  const towardA = Math.random() < capA / (capA + capB);
  const cap = towardA ? capA : capB;
  const l = Math.round(cap * (0.25 + Math.random() * 0.75)); // species members actually express their species
  return towardA ? 50 - Math.round(l / 2) : 50 + Math.round(l / 2);
}

function rollBody(speciesId: string): { heightCm: number; weightKg: number } {
  const sp = speciesById(speciesId);
  return {
    heightCm: sp.heightRange[0] + rand(sp.heightRange[1] - sp.heightRange[0] + 1),
    weightKg: sp.weightRange[0] + rand(sp.weightRange[1] - sp.weightRange[0] + 1),
  };
}

/** Clamp an axis back inside species caps (events can push; species anatomy pushes back). */
export function clampAxes(p: { speciesId: string; build: number; head: number }): void {
  const caps = speciesById(p.speciesId).poleCaps;
  p.build = clamp(p.build, 50 - Math.round(caps.strong / 2), 50 + Math.round(caps.quick / 2));
  p.head = clamp(p.head, 50 - Math.round(caps.fierce / 2), 50 + Math.round(caps.savvy / 2));
}

// ---- players -----------------------------------------------------------------

function levelForClass(classYear: number): number {
  return Math.min(LEVEL_CAP, classYear * 2 + rand(3));
}

export function genPlayer(counter: { nextId: number }, quality: number, classYear?: number, speciesId?: string): Player {
  const pool = SPECIES.filter((sp) => sp.rarity <= 1);
  const sp = speciesId ? speciesById(speciesId) : pick(pool);
  const cy = classYear ?? rand(4);
  const level = levelForClass(cy);
  const skill = clamp(22 + quality + rand(18) + level * 3, 5, 90);
  return {
    id: counter.nextId++,
    name: genName(),
    speciesId: sp.id,
    classYear: cy,
    jersey: rand(56),
    ...rollBody(sp.id),
    build: rollAxis(sp.poleCaps.strong, sp.poleCaps.quick),
    head: rollAxis(sp.poleCaps.fierce, sp.poleCaps.savvy),
    skill,
    potential: clamp(skill + 8 + rand(28), skill + 5, 99),
    level,
    xp: 0,
    energy: 70 + rand(25),
    mood: 55 + rand(25),
    outWeeks: 0,
    outReason: '',
    dnp: 0,
  };
}

export function genWalkOn(counter: { nextId: number }): Player {
  const gem = Math.random() < 0.12;
  const p = genPlayer(counter, gem ? 14 + rand(8) : -12 + rand(6), rand(4));
  p.walkOn = true;
  p.gem = gem;
  p.potential = gem ? clamp(80 + rand(18), 80, 99) : clamp(p.skill + 5 + rand(15), p.skill + 5, 70);
  return p;
}

export function genSpecial(counter: { nextId: number }, kind: 'walkon' | 'gem' | 'daughter' | 'droid'): Player {
  if (kind === 'daughter') {
    const p = genPlayer(counter, 12, 1, 'terran');
    p.name = 'Minervva';
    p.special = 'daughter';
    p.potential = clamp(p.skill + 20, 0, 99);
    return p;
  }
  if (kind === 'droid') {
    const p = genPlayer(counter, 18, 2, 'lithoid');
    p.name = 'UNIT-7';
    p.special = 'droid';
    p.mood = 100; // it does not feel. probably.
    return p;
  }
  const p = genWalkOn(counter);
  if (kind === 'gem') {
    p.gem = true;
    p.skill = clamp(p.skill + 12, 5, 90);
    p.potential = clamp(85 + rand(14), 85, 99);
  }
  return p;
}

// ---- prospects ------------------------------------------------------------------

/** Refresh the coach's observation of a prospect at its current scout level. */
export function observe(pr: Prospect): void {
  const err = pr.scoutLevel >= 2 ? 0 : pr.scoutLevel === 1 ? (rand(2) === 0 ? 0 : pick([-1, 1])) : pick([-1, 0, 1]);
  const errP = pr.scoutLevel >= 2 ? 0 : pr.scoutLevel === 1 ? (rand(2) === 0 ? 0 : pick([-1, 1])) : pick([-1, 0, 1]);
  pr.seenSkillStar = clamp(star(pr.skill) + err, 1, 5);
  pr.seenPotStar = clamp(star(pr.potential) + errP, pr.seenSkillStar, 5);
  const fuzz = pr.scoutLevel >= 2 ? 0 : pr.scoutLevel === 1 ? 8 : 18;
  pr.seenBuild = clamp(pr.build + rand(fuzz * 2 + 1) - fuzz, 0, 100);
  pr.seenHead = clamp(pr.head + rand(fuzz * 2 + 1) - fuzz, 0, 100);
}

export function genProspect(counter: { nextId: number }, seasonNo: number, regionId: string): Prospect {
  const region = scanById(regionId);
  const sp = speciesById(pick(region.pool));
  const quality = 4 + rand(12) + Math.min(seasonNo, 5) + region.skillBonus;
  const skill = clamp(18 + quality + rand(14), 5, 80);
  const pr: Prospect = {
    id: counter.nextId++,
    name: genName(),
    speciesId: sp.id,
    ...rollBody(sp.id),
    build: rollAxis(sp.poleCaps.strong, sp.poleCaps.quick),
    head: rollAxis(sp.poleCaps.fierce, sp.poleCaps.savvy),
    skill,
    potential: clamp(skill + 12 + rand(26) + region.potBonus, skill + 8, 99),
    scoutLevel: 0,
    seenSkillStar: 1,
    seenPotStar: 1,
    seenBuild: 50,
    seenHead: 50,
    blurb: pick(PROSPECT_BLURBS),
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
    classYear: 0,
    jersey: rand(56),
    heightCm: pr.heightCm,
    weightKg: pr.weightKg,
    build: pr.build,
    head: pr.head,
    skill: pr.skill,
    potential: pr.potential,
    level: rand(2),
    xp: 0,
    energy: 80 + rand(15),
    mood: 60 + rand(20),
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
  return { starters: [null, null, null], bench: [null, null, null] };
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
    plan: 'pound',
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

export function genChamps(myPower: number, season: number): ChampTeam[] {
  const names = [...CHAMP_NAMES];
  const champs: ChampTeam[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = rand(names.length);
    const [planet, name] = names.splice(idx, 1)[0];
    const plan: PlanId = pick(PLANS).id;
    const pole: Pole = PLANS.find((p) => p.id === plan)!.pole;
    // dots clustered around the plan's pole
    const dots = Array.from({ length: 3 }, () => {
      const l = 40 + rand(50);
      const off = rand(30) - 15;
      const build = pole === 'strong' ? 50 - l / 2 : pole === 'quick' ? 50 + l / 2 : 50 + off;
      const head = pole === 'fierce' ? 50 - l / 2 : pole === 'savvy' ? 50 + l / 2 : 50 + off;
      return { build: clamp(Math.round(build), 5, 95), head: clamp(Math.round(head), 5, 95) };
    });
    const colors = CHAMP_COLORS[i % CHAMP_COLORS.length];
    champs.push({
      name: `${planet} ${name}`,
      gimmick: pick(CHAMP_GIMMICKS),
      bg: colors[0],
      fg: colors[1],
      plan,
      // rounds get harder; the final scales hardest
      power: Math.round(myPower * (0.9 + rand(15) / 100) + season * 2 + i * 3),
      dots,
    });
  }
  return champs;
}

// ---- fresh state -----------------------------------------------------------------------

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
    bag: [],
    legendariesUsed: [],
    unlockedDrills: ['shootaround', 'asteroid', 'rest'],
    unlockedRegions: ['home', 'nebula', 'outerrim'],
    tipsSeen: [],
    groundedWeeks: 0,
    trainedThisWeek: false,
    sitouts: [],
    scoutedOpp: false,
    drillReport: null,
    voyageRolled: false,
    plan: 'pound',
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

/** A team's dominant pole, for AI plans and scouting hints. */
export function teamPole(players: Player[]): Pole {
  const poles: Pole[] = ['strong', 'quick', 'fierce', 'savvy'];
  const top = [...players].sort((a, b) => b.skill - a.skill).slice(0, 3);
  return poles.reduce((best, pl) => {
    const sum = (x: Pole): number => top.reduce((acc, p) => acc + lean(p, x), 0);
    return sum(pl) > sum(best) ? pl : best;
  }, 'strong');
}
