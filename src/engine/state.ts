// The orchestrator: the weekly loop, the story engine, THE BAG, the hot seat,
// the energy cache, seasons, the Universal Tournament, and every ending.

import {
  BOOSTER_POOL,
  DEAN_POOL,
  GYM_REQ,
  ITEMS,
  RECRUIT_FLAVOR,
  ROW_REQ,
  SHIP_REQ,
  SMALL_ITEMS,
  SPEECH_FLOP,
  SPEECH_FLOPS,
  SPEECH_FLOP_PREMIUM,
  STARTING_PLANS,
  STAT_WORD,
  TIPS,
  TOURNEY,
  VOYAGE_POOL,
  drillById,
  facCost,
  facLevel,
  facilityById,
  fragility,
  galaxyActById,
  instrById,
  itemById,
  planById,
  rollInjury,
  speciesById,
  storyById,
  weeklyPool,
  type StoryCtx,
  type StoryResolution,
} from './data';
import {
  BAG_SIZE,
  CACHE_MAX,
  CONF_TIERS,
  FIELD_EASE,
  FIELD_HUNT,
  FIELD_MAX,
  FIELD_MIN,
  FOUNDER_TIER,
  LEVEL_CAP,
  MAX_PROSPECTS,
  METER_BASELINE,
  REGULAR_WEEKS,
  ROSTER_SIZE,
  PRO_OVR,
  SAVE_VERSION,
  SELECT_POOL_SIZE,
  ensureUniqueJerseys,
  genChamps,
  genPlayerAt,
  genProspect,
  genRosterAt,
  genSchedule,
  genSpecial,
  genWalkOn,
  newGameState,
  observe,
  posFor,
  prospectToPlayer,
  stipendFor,
  xpNeed,
} from './gen';
import { tutorialArrive, tutorialGemify, tutorialHeld, tutorialRigGame, tutorialWrap } from './tutorial';
import {
  autoLineup,
  benchPlayers,
  checkPosChange,
  creditAiBox,
  floorAvg,
  matchAttrs,
  normalizeLineup,
  reserves,
  simAiGame,
  simMyGame,
  starters,
  tacticsMult,
  verdictLines,
} from './sim';

/** THE TACTICS BOARD: set a scheme (persistent until changed). */
export function setTactic(s: GameState, row: 'o' | 'd', id: string): void {
  if (row === 'o') s.tacO = id;
  else s.tacD = id;
  save(s);
}
import type {
  Alumnus,
  ChampTeam,
  FacId,
  Fx,
  GameState,
  MyGameResult,
  PlanId,
  Player,
  Prospect,
  SpeechFx,
  StoryEvent,
  StoryReq,
  Team,
} from './types';
import { ATTRS, addStats, bumpAny, bumpAnyPot, clamp, copyAttrs, bestAttr, genderize, opTracks, ovr, pick, rand, roll, security, zeroStats } from './util';

export { opTracks, security };

const SAVE_KEY = 'galactic-coach-save';
const COMMIT_DECAY = 1;
export const SIGNING_PENALTIES = [0, 10, 25, 45, 65, 80, 90, 95];

export function myTeam(s: GameState): Team {
  return s.teams[s.myTeamId];
}

/** Names in active use anywhere in the league — new people must not reuse them. */
function takenNames(s: GameState): Set<string> {
  const set = new Set<string>();
  for (const t of s.teams) for (const p of t.players) set.add(p.name);
  for (const pr of s.prospects) set.add(pr.name);
  for (const p of s.selectPool) set.add(p.name);
  for (const p of s.commits) set.add(p.name);
  return set;
}

export function weekLabel(s: GameState): string {
  if (s.season === 0) return s.tutorial !== undefined ? `WEEK ${s.week} — SEASON ZERO` : 'TRYOUTS';
  if (s.week <= REGULAR_WEEKS) return `WEEK ${s.week}/${REGULAR_WEEKS}`;
  return `WEEK ${REGULAR_WEEKS}+${s.week - REGULAR_WEEKS}`;
}

/** The header's short form: W3 · W10+1. */
export function weekShort(s: GameState): string {
  if (s.week <= REGULAR_WEEKS) return `W${s.week}`;
  return `W${REGULAR_WEEKS}+${s.week - REGULAR_WEEKS}`;
}

/** THE BIG BANG round name for a tournament week. */
export function utRoundName(s: GameState): string {
  return TOURNEY.rounds[s.week - REGULAR_WEEKS - 1] ?? TOURNEY.name;
}

export function isUtWeek(s: GameState): boolean {
  return s.week > REGULAR_WEEKS && s.ut !== null;
}

export function sortedStandings(s: GameState): Team[] {
  return [...s.teams].sort(
    (a, b) => b.wins - a.wins || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
  );
}

/** THE LEADERS: conference-wide stat boards, top ten per category. */
export function statLeaders(s: GameState): Record<'pts' | 'reb' | 'stl' | 'ast', { playerId: number; name: string; teamId: number; v: number; gp: number }[]> {
  const keys = ['pts', 'reb', 'stl', 'ast'] as const;
  const out = { pts: [], reb: [], stl: [], ast: [] } as Record<(typeof keys)[number], { playerId: number; name: string; teamId: number; v: number; gp: number }[]>;
  for (const t of s.teams) {
    for (const p of t.players) {
      for (const k of keys) out[k].push({ playerId: p.id, name: p.name, teamId: t.id, v: p.stats[k], gp: p.stats.gp });
    }
  }
  for (const k of keys) out[k] = out[k].sort((a, b) => b.v - a.v).slice(0, 10);
  return out;
}

export function myMatchup(s: GameState): { opponent: Team; home: boolean } | null {
  if (isUtWeek(s)) return null;
  for (const [h, a] of s.schedule[s.week - 1] ?? []) {
    if (h === s.myTeamId) return { opponent: s.teams[a], home: true };
    if (a === s.myTeamId) return { opponent: s.teams[h], home: false };
  }
  return null;
}

export function utOpponent(s: GameState): ChampTeam | null {
  return s.ut ? s.ut.champs[s.ut.myNextOpp] ?? null : null;
}

// ---- persistence ---------------------------------------------------------------

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable; play on */
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) {
      // the old save dies with its version — but its KNOWLEDGE enters the codex
      for (const p of s.knownPlans ?? []) if (!STARTING_PLANS.includes(p)) codexAdd('plans', p);
      for (const d of s.unlockedDrills ?? []) codexAdd('drills', d);
      for (const r of s.unlockedRegions ?? []) codexAdd('regions', r);
      for (const i of s.knownInstr ?? []) if (i !== 'counter') codexAdd('instrs', i);
      return null;
    }
    // in-place migration: the always-available basics exist in every save
    for (const d of ['shootaround', 'scrimmage', 'twodays', 'rest', 'bonfire']) {
      if (!s.unlockedDrills.includes(d)) s.unlockedDrills.push(d);
    }
    for (const r of ['reccenter', 'home', 'nebula', 'outerrim']) {
      if (!s.unlockedRegions.includes(r)) s.unlockedRegions.push(r);
    }
    s.knownInstr = s.knownInstr ?? ['counter'];
    if (!s.knownInstr.includes('counter')) s.knownInstr.push('counter');
    // JOB SECURITY (v5) soft migration: derive the opinion ledgers from the
    // old hot-seat pair once — from then on the tracks own the story
    if (s.opSchool === undefined) {
      s.opSchool = clamp(80 - s.heatS, 10, 90);
      s.opFans = clamp(80 - s.heatB, 10, 90);
      s.opPublic = 60;
      s.expectation = s.utTitles > 0 ? 3 : s.trophies > 0 ? 2 : 1;
    }
    // positions arrived mid-version: older saves get them assigned from the body
    for (const t of s.teams) for (const p of t.players) if (p.pos === undefined) p.pos = posFor(p);
    for (const pr of s.prospects) if (pr.pos === undefined) pr.pos = posFor(pr);
    for (const pr of s.pendingRecruits) if (pr.pos === undefined) pr.pos = posFor(pr);
    for (const p of s.selectPool) if (p.pos === undefined) p.pos = posFor(p);
    for (const p of s.commits) if (p.pos === undefined) p.pos = posFor(p);
    return s;
  } catch {
    return null;
  }
}

export function freshGame(): GameState {
  const s = newGameState();
  // THE CODEX: a new career starts with the standard kit PLUS everything the
  // coach ever learned — drills and routes land now (their facility levels
  // pace them); speeches and instructions return through a story
  const c = loadCodex();
  for (const d of c.drills) if (!s.unlockedDrills.includes(d)) s.unlockedDrills.push(d);
  for (const r of c.regions) if (!s.unlockedRegions.includes(r)) s.unlockedRegions.push(r);
  const plans = c.plans.filter((p) => !s.knownPlans.includes(p as PlanId)) as PlanId[];
  const instrs = c.instrs.filter((i) => !(s.knownInstr ?? []).includes(i));
  if (plans.length || instrs.length) s.codexPending = { plans, instrs };
  save(s);
  return s;
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

// ---- THE CODEX: knowledge survives the coffin --------------------------------
// Fired is game over, but everything the coach ever LEARNED persists across
// careers in one ledger. Drills and routes re-enter a fresh run immediately
// (their facility requirements pace them); speeches and instructions come
// back through the "you remember the words" story.

const CODEX_KEY = 'galactic-coach-codex';

export interface Codex {
  plans: string[];
  drills: string[];
  instrs: string[];
  regions: string[];
}

export function loadCodex(): Codex {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    const c = raw ? (JSON.parse(raw) as Partial<Codex>) : {};
    return { plans: c.plans ?? [], drills: c.drills ?? [], instrs: c.instrs ?? [], regions: c.regions ?? [] };
  } catch {
    return { plans: [], drills: [], instrs: [], regions: [] };
  }
}

function codexAdd(kind: keyof Codex, id: string): void {
  try {
    const c = loadCodex();
    if (c[kind].includes(id)) return;
    c[kind].push(id);
    localStorage.setItem(CODEX_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable; the run still has it */
  }
}

/** DELETE CODEX — START FRESH. Cannot be undone; the current run keeps what
    it already knows. */
export function wipeCodex(): void {
  try {
    localStorage.removeItem(CODEX_KEY);
  } catch {
    /* ignore */
  }
}

// ---- THE NOTEBOOK -----------------------------------------------------------------
// A permanent bag fixture: tap it and something noteworthy from the current
// screen goes in. Notes answer press questions — and, later, story callbacks.

const NOTEBOOK_CAP = 60;

/** Add a note (deduped by key). Returns false if that key is already noted. */
export function addNote(s: GameState, kind: string, key: string, text: string): boolean {
  if (s.notebook.some((n) => n.key === key)) return false;
  s.notebook.unshift({ season: s.season, week: s.week, kind, key, text });
  if (s.notebook.length > NOTEBOOK_CAP) s.notebook.length = NOTEBOOK_CAP;
  save(s);
  return true;
}

export function findNote(s: GameState, key: string): boolean {
  return s.notebook.some((n) => n.key === key);
}

// ---- XP & levels ------------------------------------------------------------------

export interface LevelUp {
  playerId: number;
  name: string;
  level: number;
  points: number;
}

/** XP → levels. Each level banks points the COACH places (a blocking choice
    popup queues up). 10% of levels are breakthroughs: +3 instead of +2. */
export function addXp(s: GameState, p: Player, amount: number): LevelUp[] {
  const ups: LevelUp[] = [];
  p.xp += amount;
  while (p.level < LEVEL_CAP && p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    const points = roll(10) ? 3 : 2;
    queueStory(s, 'levelup', 'start', p.id, { points });
    ups.push({ playerId: p.id, name: p.name, level: p.level, points });
  }
  if (p.level >= LEVEL_CAP) p.xp = 0;
  return ups;
}

export let lastLevelUps: LevelUp[] = [];

/** A player leaves → a statistical ghost: overall + full career box score. */
function toAlum(p: Player, exit: Alumnus['exit'], season: number): Alumnus {
  const career = { ...p.career };
  addStats(career, p.stats);
  return { name: p.name, speciesId: p.speciesId, form: p.form, ovr: ovr(p.attrs), exit, season, career };
}

// ---- Fx: the one place consequences land --------------------------------------------

/** Story mood swings land HARDER than their authored numbers — at a 75
    baseline a shrug isn't drama. Item effects keep their printed values. */
const STORY_MOOD_SCALE = 1.5;
const STORY_TEAM_MOOD_SCALE = 1.25;

export function applyFx(s: GameState, fxList: Fx[] | undefined, defaultPlayerId: number | null, storyMoods = false): void {
  if (!fxList) return;
  const t = myTeam(s);
  const moodOf = (v: number): number => Math.round(v * (storyMoods ? STORY_MOOD_SCALE : 1));
  const teamMoodOf = (v: number): number => Math.round(v * (storyMoods ? STORY_TEAM_MOOD_SCALE : 1));
  for (const fx of fxList) {
    const pid = fx.playerId ?? defaultPlayerId;
    const p = pid !== null ? t.players.find((x) => x.id === pid) : undefined;
    if (fx.coachEnergy) s.energy = clamp(s.energy + fx.coachEnergy, 0, CACHE_MAX);
    // THE OPINION TRACKS: story Fx still speak the historical hot-seat signs
    // (heatS +N = the school likes you N less, heatB = the fans); opP is the
    // public's track and speaks plainly (positive = better)
    if (fx.heatS) s.opSchool = clamp((s.opSchool ?? 60) - fx.heatS, 0, 100);
    if (fx.heatB) s.opFans = clamp((s.opFans ?? 60) - fx.heatB, 0, 100);
    if (fx.opP) s.opPublic = clamp((s.opPublic ?? 60) + fx.opP, 0, 100);
    if (fx.legacy) s.legacy += fx.legacy;
    if (fx.teamMood) for (const q of t.players) q.mood = clamp(q.mood + teamMoodOf(fx.teamMood), 0, 100);
    if (fx.teamEnergyP) for (const q of t.players) q.energy = clamp(q.energy + fx.teamEnergyP, 0, 100);
    if (fx.giveItem) giveItem(s, fx.giveItem);
    if (fx.loseItemIdx !== undefined) s.bag.splice(fx.loseItemIdx, 1);
    // anything GAINED gets THE REVEAL CARD: a follow-up dialog that shows
    // exactly what you received, picker-row preview and all
    if (fx.unlockDrill && !s.unlockedDrills.includes(fx.unlockDrill)) {
      s.unlockedDrills.push(fx.unlockDrill);
      codexAdd('drills', fx.unlockDrill);
      s.careerLog.push(`Learned ${drillById(fx.unlockDrill).name} (season ${s.season}).`);
      queueStory(s, 'reveal', 'start', null, { kind: 'drill', id: fx.unlockDrill });
    }
    if (fx.unlockRegion && !s.unlockedRegions.includes(fx.unlockRegion)) {
      s.unlockedRegions.push(fx.unlockRegion);
      codexAdd('regions', fx.unlockRegion);
      queueStory(s, 'reveal', 'start', null, { kind: 'region', id: fx.unlockRegion });
    }
    if (fx.unlockPlan && !s.knownPlans.includes(fx.unlockPlan)) {
      s.knownPlans.push(fx.unlockPlan);
      codexAdd('plans', fx.unlockPlan);
      s.careerLog.push(`Learned ${planById(fx.unlockPlan).name} (season ${s.season}).`);
      queueStory(s, 'reveal', 'start', null, { kind: 'speech', id: fx.unlockPlan });
    }
    if (fx.unlockInstr && !(s.knownInstr ?? []).includes(fx.unlockInstr)) {
      s.knownInstr = [...(s.knownInstr ?? []), fx.unlockInstr];
      codexAdd('instrs', fx.unlockInstr);
      s.careerLog.push(`Learned ${instrById(fx.unlockInstr).name} (season ${s.season}).`);
      queueStory(s, 'reveal', 'start', null, { kind: 'instr', id: fx.unlockInstr });
    }
    if (fx.intel && s.prospects.length < MAX_PROSPECTS) {
      const counter = { nextId: s.nextId };
      const pr = genProspect(counter, s.season, 'nebula', takenNames(s));
      pr.scoutLevel = 1;
      pr.seenSkill = true; // met the honest way — you saw the shape yourself
      observe(pr);
      s.nextId = counter.nextId;
      s.prospects.push(pr);
    }
    if (fx.addPlayer && t.players.length < ROSTER_SIZE) {
      const counter = { nextId: s.nextId };
      const np = genSpecial(counter, fx.addPlayer, takenNames(s));
      s.nextId = counter.nextId;
      t.players.push(np);
      ensureUniqueJerseys(t.players);
      normalizeLineup(t);
    }
    if (fx.gameover) endCareer(s, fx.gameover === 'void' ? 'LOST TO THE VOID' : fx.gameover === 'retired' ? 'RETIRED' : 'FIRED');
    if (!p) continue;
    if (fx.takePlayer) {
      s.alumni.push(toAlum(p, 'void', s.season));
      t.players = t.players.filter((x) => x.id !== p.id);
      normalizeLineup(t);
      continue;
    }
    if (fx.attr) {
      for (const a of ATTRS) {
        const d = fx.attr[a];
        if (!d) continue;
        p.attrs[a] = d > 0 ? clamp(p.attrs[a] + d, 0, Math.max(p.attrs[a], p.pots[a])) : clamp(p.attrs[a] + d, 0, 25);
      }
    }
    if (fx.potAttr) {
      // ceilings are soft everywhere now — only the 25 scale stands
      for (const a of ATTRS) {
        const d = fx.potAttr[a];
        if (!d) continue;
        p.pots[a] = clamp(p.pots[a] + d, p.attrs[a], 25);
      }
    }
    if (fx.anyAttr) bumpAny(p, fx.anyAttr);
    if (fx.anyPot) bumpAnyPot(p, fx.anyPot);
    if (fx.tense !== undefined) p.tense = fx.tense;
    if (fx.levelDelta) {
      if (fx.levelDelta > 0) {
        for (let i = 0; i < fx.levelDelta && p.level < LEVEL_CAP; i++) {
          p.level++;
          queueStory(s, 'levelup', 'start', p.id, { points: 2 });
        }
      } else {
        p.level = Math.max(0, p.level + fx.levelDelta);
      }
    }
    if (fx.xp) lastLevelUps.push(...addXp(s, p, fx.xp));
    if (fx.energyP) p.energy = clamp(p.energy + fx.energyP, 0, 100);
    if (fx.mood) p.mood = clamp(p.mood + moodOf(fx.mood), 0, 100);
    if (fx.weightKg) p.weightKg = Math.max(35, p.weightKg + fx.weightKg);
    if (fx.outWeeks !== undefined) {
      const wasOut = p.outWeeks > 0;
      p.outWeeks = fx.outWeeks;
      p.outReason = fx.outWeeks > 0 ? fx.outReason ?? p.outReason ?? 'unspecified' : '';
      // the KIND decides which item can shorten it: a running absence keeps
      // its kind (medicine and time machines only change the weeks); a fresh
      // one is AWAY unless the source says injury
      p.outKind = fx.outWeeks > 0 ? fx.outKind ?? (wasOut ? p.outKind ?? 'away' : 'away') : undefined;
      if (fx.outWeeks > 0) { p.onFire = false; p.fireWeeks = 0; } // nothing burns in a bio-lab tank
      normalizeLineup(t);
    }
    if (fx.commit) {
      // word travels: the whole board hears it
      for (const pr of s.prospects) pr.commitPct = clamp(pr.commitPct + fx.commit, 0, 100);
    }
  }
}

function giveItem(s: GameState, itemId: string): void {
  if (s.bag.length < BAG_SIZE) {
    // nothing enters THE BAG unasked: every find is offered — take it or
    // leave it (patches pile up fast when nobody's hurt)
    maybeTip(s, 'bag');
    queueStory(s, 'item_offer', 'start', null, { itemId });
    return;
  }
  queueStory(s, 'bagfull', 'start', null, { itemId });
}

// ---- the story engine ----------------------------------------------------------------

function storyCtx(s: GameState, playerId: number | null, data: Record<string, unknown>): StoryCtx {
  const t = myTeam(s);
  return {
    s,
    player: playerId !== null ? t.players.find((p) => p.id === playerId) ?? null : null,
    data,
    team: () => t.players,
    bestPlayer: () => [...t.players].sort((a, b) => ovr(b.attrs) - ovr(a.attrs))[0] ?? null,
  };
}

/** RETIRED with the tutorial (v5 M3): the assistant no longer lectures
    unprompted — season zero teaches by doing, and the ? button answers on
    demand. The call sites stay as markers of where a screen is first met. */
export function maybeTip(_s: GameState, _key: string): void {
  /* the wordy assistant has left the building */
}

/** THE TUTORIAL SEASON: the script asks for the floor as the coach reaches
    each screen — the beats queue like any other story, the screens stay
    untouched. */
function tutQueue(s: GameState, reqs: StoryReq[]): void {
  for (const r of reqs) queueStory(s, r.defId, r.beat, r.playerId, r.data ?? {});
}

/** The ? button: the assistant explains the current screen, on demand. */
export function showTip(s: GameState, key: string): void {
  if (!TIPS[key] || s.queue.some((e) => e.tag === 'ASSISTANT COACH')) return;
  if (!s.tipsSeen.includes(key)) s.tipsSeen.push(key);
  queueStory(s, 'notice', 'start', null, { tag: 'ASSISTANT COACH', text: TIPS[key] });
  save(s);
}

export function queueStory(
  s: GameState,
  defId: string,
  beat: string,
  playerId: number | null,
  data: Record<string, unknown> = {}
): void {
  const def = storyById(defId);
  const ctx = storyCtx(s, playerId, data);
  const content = def.beat(beat, ctx);
  const ev: StoryEvent = {
    uid: s.nextUid++,
    defId,
    beat,
    tag: content.tag,
    playerId,
    text: content.text,
    choices: content.choices,
    data: { ...data, ...(content.data ?? {}) },
  };
  // the story speaks the player's pronouns — text AND button labels
  const gform = (playerId !== null
    ? myTeam(s).players.find((p) => p.id === playerId)?.form
    : (data.alumForm as 'masc' | 'femme' | 'x' | undefined)) ?? undefined;
  if (gform === 'femme' || gform === 'x') {
    ev.text = genderize(ev.text, gform);
    ev.choices?.forEach((c) => {
      c.label = genderize(c.label, gform);
      // the printed clauses on the tails ("he's FIERCE, careful") too
      if (c.up?.note) c.up = { ...c.up, note: genderize(c.up.note, gform) };
      if (c.down?.note) c.down = { ...c.down, note: genderize(c.down.note, gform) };
    });
  }
  // THE BAG's killer integration: matching items appear as extra choice buttons
  if (def.context && ev.choices) {
    for (const itemId of s.bag) {
      const item = itemById(itemId);
      if (item.context.includes(def.context)) {
        ev.choices.push({
          key: `item:${itemId}`,
          label: `◆ ${item.name} — ${item.effectText}`,
          up: item.up,
          down: item.down,
          itemId,
        });
      }
    }
  }
  s.queue.push(ev);
}

export function currentStory(s: GameState): StoryEvent | null {
  return s.queue[0] ?? null;
}

/** Resolve a choice on the current story. Tap-through stories use key 'ok'. */
export function resolveStory(s: GameState, choiceKey: string): { resolved: StoryEvent; fx: Fx[] } | null {
  const ev = s.queue[0];
  if (!ev) return null;
  lastLevelUps = [];
  // the galaxy can TAKE somebody mid-queue (the ride home's debt collector):
  // a story about a player who is no longer on the roster dissolves quietly
  if (ev.playerId !== null && !myTeam(s).players.some((p) => p.id === ev.playerId)) {
    ev.resolvedText = 'Whoever this was about is no longer on the roster. The galaxy keeps its own schedule.';
    save(s);
    return { resolved: ev, fx: [] };
  }
  const choice = ev.choices?.find((c) => c.key === choiceKey);
  if (choice?.cost && s.energy < choice.cost) return null;
  if (choice?.cost) s.energy = clamp(s.energy - choice.cost, 0, CACHE_MAX);

  let res: StoryResolution;
  if (choice?.itemId) {
    const item = itemById(choice.itemId);
    const idx = s.bag.indexOf(choice.itemId);
    if (idx >= 0) s.bag.splice(idx, 1);
    if (item.rarity === 'legendary') s.legendariesUsed.push(item.id);
    res = item.use(storyCtx(s, ev.playerId, ev.data ?? {}));
  } else {
    const def = storyById(ev.defId);
    res = def.resolve(choiceKey, storyCtx(s, ev.playerId, ev.data ?? {}), ev);
  }

  const rpid = res.fx?.find((f) => f.playerId !== undefined)?.playerId ?? ev.playerId;
  const rform = (rpid !== null ? myTeam(s).players.find((p) => p.id === rpid)?.form : (ev.data?.alumForm as 'masc' | 'femme' | 'x' | undefined)) ?? undefined;
  // a story about him resolving releases the held breath (the fx below may
  // hold it again — delayed outcomes keep him NERVOUS until the result beat)
  if (ev.playerId !== null) {
    const tp = myTeam(s).players.find((p) => p.id === ev.playerId);
    if (tp) tp.tense = false;
  }
  // story consequences swing harder than item effects (items print exact numbers)
  const before = s.queue.length;
  applyFx(s, res.fx, ev.playerId, !choice?.itemId);
  ev.resolvedText = genderize(res.text, rform);
  for (const f of res.follow ?? []) {
    s.futureBeats.push({ weeksLeft: f.weeks, defId: f.defId ?? ev.defId, beat: f.beat, playerId: f.playerId !== undefined ? f.playerId : ev.playerId, data: f.data });
  }
  if (res.next) queueStory(s, res.next.defId, res.next.beat, res.next.playerId !== undefined ? res.next.playerId : ev.playerId, res.next.data ?? {});
  // NOTHING butts in: whatever this resolution spawned (the reveal card, the
  // item offer, the next beat) plays right after THIS story — never behind
  // some unrelated story that was already waiting
  if (s.queue.length > before && s.queue[0] === ev) {
    const spawned = s.queue.splice(before);
    s.queue.splice(1, 0, ...spawned);
  }
  save(s);
  return { resolved: ev, fx: res.fx ?? [] };
}

/** Dismiss the current (resolved or choice-less) story. */
export function dismissStory(s: GameState): void {
  s.queue.shift();
  if (!s.queue.length && s.phase === 'stories') {
    s.phase = isUtWeek(s) ? 'matchup' : 'facilities';
    maybeTip(s, isUtWeek(s) ? 'matchup' : 'facilities');
  }
  if (!s.queue.length && s.phase === 'gamenight' && !s.lastResult && !s.end) simWeek(s);
  // the night's interruptions are answered: the horn can sound
  if (!s.queue.length && s.phase === 'gamenight' && s.gamePending && !s.midStories?.length && !s.end) finalizeGame(s);
  // the frozen one was told to earn it: the door closes and the ball goes up
  if (!s.queue.length && s.phase === 'matchup' && s.resumePlay) {
    s.resumePlay = false;
    playGame(s);
  }
  save(s);
}

/** The live game is half done: the night's interruptions get the floor. */
export function releaseMidStories(s: GameState): void {
  if (!s.midStories?.length) return;
  s.queue.push(...s.midStories);
  s.midStories = [];
  save(s);
}

/** The horn's consequences (the frozen one's verdict, the morning-after
    beats) were held while the game played — release them once the score is
    seen. */
export function releaseHeldStories(s: GameState): void {
  if (!s.heldStories?.length) return;
  s.queue.push(...s.heldStories);
  s.heldStories = [];
  save(s);
}

// ---- week start ---------------------------------------------------------------------

type StoryDefer = (defId: string, beat: string, playerId: number | null, data?: Record<string, unknown>) => void;

/** THE HOT SEAT LADDER (v5): below 50 the questions get harder (the story
    sites handle that); below 30 the ANGRIEST constituency sets terms, at
    most every third week; below 20 every week has a price — the summons.
    Seasons 1–2 are the grace period: the floor holds at 25 and nobody comes. */
function checkJobSecurity(s: GameState, defer: StoryDefer): void {
  if (s.season <= 2) return;
  const sec = security(s);
  if (sec >= 30) return;
  const o = opTracks(s);
  const ranked: [string, number][] = [['school', o.school], ['fans', o.fans], ['players', o.players], ['pub', o.pub]];
  ranked.sort((a, b) => a[1] - b[1]);
  const lowest = ranked[0][0];
  if (sec < 20) {
    // pay to stay — weekly, until the gauge climbs or the vote happens
    defer('summons', 'start', null, { side: lowest === 'school' ? 'school' : lowest === 'fans' ? 'boost' : 'joint' });
    return;
  }
  if (s.lastDemand && s.lastDemand.season === s.season && s.week - s.lastDemand.week < 3) return;
  s.lastDemand = { season: s.season, week: s.week };
  if (lowest === 'school') defer('interfere_school', 'start', null);
  else if (lowest === 'fans') defer('interfere_boost', 'start', null);
  else if (lowest === 'players') defer('drama', 'start', null, { cause: "The captains call a players-only meeting and don't invite you. The sound through the door is not encouraging." });
  else defer('scandal', 'start', null, { cause: 'The Gazette runs a front-pager — "IS THE PROGRAM OUT OF CONTROL?" — and Scoop is outside with a recorder and a deadline.' });
}

/** Scoop's material: a multiple-choice question about LAST week, with the
    true answer and the notebook key that would answer it for you. */
function buildScoopQuestion(
  s: GameState,
  week: number,
  mvp: string | null,
  top: string | null,
  roster: string[],
  results: string[]
): Record<string, unknown> | null {
  const kinds: string[] = [];
  if (mvp && roster.length >= 4) kinds.push('mvp');
  if (top && roster.length >= 4) kinds.push('top');
  if (results.length) kinds.push('other');
  const board = statLeaders(s).pts;
  if (board[0] && board[0].v >= 10 && board.length >= 4) kinds.push('lead');
  if (!kinds.length) return null;
  const kind = pick(kinds);
  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
  if (kind === 'lead') {
    const right = board[0].name;
    const decoys = shuffle(board.slice(1, 7).map((e) => e.name).filter((n) => n !== right)).slice(0, 3);
    if (decoys.length < 3) return null;
    const opts = shuffle([right, ...decoys]);
    return {
      q: 'The scoring race, coach — who leads the conference in points right now?',
      opts, answer: opts.indexOf(right), noteKey: `lead:${s.season}:${week}`,
    };
  }
  if (kind === 'other') {
    const line = pick(results);
    const m = line.match(/^(.*) (\d+) — (\d+) (.*)$/);
    if (!m) return null;
    const winner = m[1];
    const loser = m[4];
    const others = s.teams.map((tm) => tm.name).filter((n) => n !== winner && n !== loser);
    const opts = shuffle([winner, loser, ...shuffle(others).slice(0, 2)]);
    return {
      q: `Your league, coach — who beat the ${loser} last week?`,
      opts, answer: opts.indexOf(winner), noteKey: `res:${s.season}:${week}`,
    };
  }
  const right = (kind === 'mvp' ? mvp : top)!;
  const decoys = shuffle(roster.filter((n) => n !== right)).slice(0, 3);
  const opts = shuffle([right, ...decoys]);
  return {
    q: kind === 'mvp'
      ? 'For the Gazette, coach: who took the MVP honors in your last game?'
      : 'For the Gazette, coach: who led your team in scoring last game?',
    opts, answer: opts.indexOf(right), noteKey: `mvp:${s.season}:${week}`,
  };
}

function startWeek(s: GameState): void {
  const t = myTeam(s);
  // what the weekend left behind (before the flags reset wipe it)
  const lastGame = new Map(s.postGame.map((r) => [r.playerId, r]));
  const hadGame = s.postGame.length > 0;
  // the ride home: only for regular away weekends — tournament weeks stay on
  // the road (their travel_out below is the trip; no doubled bus scenes)
  const wasAway = !!s.lastResult && !s.lastResult.home && !isUtWeek(s);
  // THE STADIUM's gate: a home weekend pays its level in credits, folded
  // into the dean's envelope
  const gate = !!s.lastResult && s.lastResult.home && !isUtWeek(s) ? facLevel(s, 'stadium') : 0;
  // the press reads last week before the reset wipes it (Scoop's material)
  const pressWeek = s.week - 1;
  const lastBox = s.lastResult?.box ?? [];
  const pressMvp = lastBox.find((r) => r.playerId === s.lastResult?.mvpId)?.name ?? null;
  const pressTop = lastBox[0]?.name ?? null;
  const pressRoster = lastBox.map((r) => r.name);
  const pressResults = [...s.resultsLog];

  // the stipend: on the road it just arrives; on a home week the dean HANDS
  // it over — it lands when her budget dialog resolves, counter and all
  const stipend = stipendFor(s.season);
  if (isUtWeek(s)) s.energy = clamp(s.energy + stipend, 0, CACHE_MAX);
  // premium speeches recharge
  if (s.speechCooldowns) {
    for (const k of Object.keys(s.speechCooldowns)) {
      s.speechCooldowns[k] = Math.max(0, (s.speechCooldowns[k] ?? 0) - 1);
      if (!s.speechCooldowns[k]) delete s.speechCooldowns[k];
    }
  }
  // the pricey drills and board moves recharge on the same clock
  if (s.actCooldowns) {
    for (const k of Object.keys(s.actCooldowns)) {
      s.actCooldowns[k] = Math.max(0, (s.actCooldowns[k] ?? 0) - 1);
      if (!s.actCooldowns[k]) delete s.actCooldowns[k];
    }
  }
  // the opinion ledgers drift home: one point toward neutral, every week —
  // except that the dean reads the TABLE: a program losing badly (sub-.350
  // from week 4 on) erodes the school's patience instead of drifting up
  const home60 = (v: number | undefined): number => { const x = v ?? 60; return x + Math.sign(60 - x); };
  const played = t.wins + t.losses;
  const losingBadly = s.week >= 4 && played >= 3 && t.wins / Math.max(1, played) < 0.35;
  s.opSchool = losingBadly ? clamp((s.opSchool ?? 60) - 1, 0, 100) : home60(s.opSchool);
  s.opFans = home60(s.opFans);
  s.opPublic = home60(s.opPublic);
  s.trainedThisWeek = false;
  s.scoutActWk = false;
  s.recruitActWk = false;
  s.moppedWk = false;
  s.mopDiscount = false;
  s.pregameWk = false;
  s.speechFx = null;
  s.speechTook = undefined;
  s.oppFx = null;
  s.instrPending = null;
  s.easyNight = false;
  s.midStories = [];
  s.gamePending = false;
  s.sitouts = [];
  s.drillReport = null;
  s.voyageRolled = false;
  s.pregameFlags = {};
  s.lastResult = null;
  s.postGame = [];
  s.resultsLog = [];
  s.resultsWeek = [];
  if (s.groundedWeeks > 0) s.groundedWeeks--;

  // TWO BUCKETS: PRE is last week wrapping up — the returns, the dean's
  // envelope, the weekend's consequences — and it plays BEFORE the WEEK
  // START report; LATER is the NEW week's stories, and they knock only
  // after the coach has seen the roster and walked into the building.
  const pre: StoryReq[] = [];
  const deferPre: StoryDefer = (defId, beat, playerId, data = {}) => pre.push({ defId, beat, playerId, data });
  const later: StoryReq[] = [];
  const defer: StoryDefer = (defId, beat, playerId, data = {}) => later.push({ defId, beat, playerId, data });

  // THE LEADERS' buzz: sitting top-three in a conference category is a small
  // weekly mood drip — the campus notices
  const hotIds = new Set<number>();
  if (!isUtWeek(s) && s.week > 2) {
    const LB = statLeaders(s);
    for (const k of ['pts', 'reb', 'stl', 'ast'] as const) {
      LB[k].slice(0, 3).forEach((e) => { if (e.teamId === s.myTeamId && e.v > 0) hotIds.add(e.playerId); });
    }
  }

  s.weekRecap = [];
  for (const team of s.teams) {
    const mine = team.id === s.myTeamId;
    for (const p of team.players) {
      // absences tick down NOW, before the report — the WEEK START screen
      // shows the truth of the NEW week, and the return is told first. A
      // dedicated return story coming due (the festival, the exchange)
      // replaces the generic notice: nobody steps off the bus twice.
      if (p.outWeeks > 0 && --p.outWeeks === 0) {
        if (mine && !s.futureBeats.some((fb) => fb.playerId === p.id && fb.weeksLeft <= 1)) {
          deferPre('notice', 'start', p.id, {
            tag: 'CLEARED TO PLAY',
            text: `${p.name} is back from ${p.outReason || 'the long absence'} and cleared to play. The first dunk back is always the loudest.`,
          });
        }
        p.outReason = '';
      }
      // THE WEEKEND BUMP: everyone recovers hard toward the 75 baseline —
      // but the bump SHRINKS with every consecutive start (streak 1 → +40,
      // 2 → +28, 3 → +16 …). Stack your starters and the tank stops filling.
      // A body that DIDN'T play blows past the baseline — a week in street
      // clothes can fill the tank to 100: sitting someone out is a real
      // COACHING move, so it's yours alone (the AI's perfect-rotation
      // autopilot would milk it harder than any human could).
      const preE = p.energy;
      const preM = p.mood;
      const streak = p.startStreak ?? 0;
      // THE CRYO BAY: my weekend bump grows +15% per level and the tank tops
      // out higher (77/79/81); the other programs run stock recovery. Tuned
      // HARD: the AI has no campus, and under the ^6 win-share curve every
      // sustained percent of mine-only meter edge is worth ~2 wins a season
      // (headless found this the fun way — 0 titles became 15). The bonus is
      // multiplicative so it can never cancel the start-streak decay.
      const cryo = mine ? facLevel(s, 'cryo') : 0;
      const eCap = METER_BASELINE + 2 * cryo;
      const rec = Math.round(Math.max(8, 40 - 12 * Math.max(0, streak - 1)) * (1 + 0.15 * cryo));
      if (mine && p.onFire && p.outWeeks === 0) {
        // ON FIRE: adrenaline recovers him harder and carries him ABOVE the
        // baseline — but every week the streak lives, the body owes more
        // (the tip-off injury roll climbs with fireWeeks)
        p.fireWeeks = (p.fireWeeks ?? 0) + 1;
        p.energy = Math.min(Math.max(92, eCap), p.energy + rec + 10);
      } else if (mine && p.dnp > 0 && p.outWeeks === 0) {
        p.energy = Math.min(100, p.energy + 45 + rand(16));
      } else {
        p.energy = p.energy < eCap
          ? Math.min(eCap, p.energy + rec)
          : Math.max(eCap, p.energy - 2);
      }
      // college kids are MOODY: the drift home is stingy on the way up,
      // quicker on the way down — and any given Monday can just be a bad one.
      // GREEK ROW raises where "home" is for MY campus (+1 per level past 1).
      const mBase = METER_BASELINE + (mine ? facLevel(s, 'greekrow') - 1 : 0);
      p.mood = p.mood < mBase
        ? Math.min(mBase, p.mood + 4)
        : Math.max(mBase, p.mood - 5);
      if (roll(25)) p.mood = clamp(p.mood - (2 + rand(6)), 0, 100);
      if (mine && hotIds.has(p.id)) p.mood = clamp(p.mood + 2, 0, 100);
      if (team.id === s.myTeamId) {
        s.weekRecap.push({
          playerId: p.id,
          energyP: p.energy - preE,
          mood: p.mood - preM,
          xpGain: lastGame.get(p.id)?.xpGain ?? 0,
        });
      }
    }
    // AI campus life, abstracted: the other programs have festivals, dramas
    // and frozen-out benches too — we just never see them. Without this tax
    // the baseline economy would make MY stories a pure handicap.
    if (team.id !== s.myTeamId) {
      const alive = team.players.filter((p) => p.outWeeks === 0);
      if (alive.length) {
        const q = pick(alive);
        q.mood = clamp(q.mood - (6 + rand(10)), 0, 100);
        if (roll(30)) {
          const w = pick(alive);
          w.energy = clamp(w.energy - (6 + rand(8)), 0, 100);
        }
      }
    }
  }

  // kids notice silence — and the LAST RESORTS row can tell it's the last
  // resorts row: commitment decays twice as fast down there. Ink doesn't
  // wane: a SIGNED name stays signed.
  s.prospects.forEach((pr, ix) => {
    if (!pr.signed) pr.commitPct = Math.max(0, pr.commitPct - (ix >= 6 ? COMMIT_DECAY * 2 : COMMIT_DECAY));
    if (pr.bannedWeeks > 0) pr.bannedWeeks--;
  });

  // THE WEEKLY BUDGET: the dean, the envelope, the snark — right after the
  // returns, before the weekend's consequences (tournament weeks: on the
  // road). The stadium's home-game gate rides in the same envelope.
  if (!isUtWeek(s)) deferPre('dean_budget', 'start', null, { amt: stipend + gate });

  // scheduled beats come due — consequences and returns wrap up LAST week,
  // so they speak before the report
  for (const fb of [...s.futureBeats]) {
    fb.weeksLeft--;
    if (fb.weeksLeft <= 0) {
      s.futureBeats.splice(s.futureBeats.indexOf(fb), 1);
      const stillHere = fb.playerId === null || t.players.some((p) => p.id === fb.playerId);
      if (stillHere) deferPre(fb.defId, fb.beat, fb.playerId, fb.data ?? {});
    }
  }

  checkJobSecurity(s, defer);

  if (isUtWeek(s) && s.ut) {
    // tournament rounds are voyages: wheels up, then the round's own beat —
    // the pomp and the scouting report in one breath
    defer('travel_out', 'start', null);
    const champ = utOpponent(s);
    if (champ) {
      defer('bigbang_round', 'start', null, {
        round: s.ut.round, opp: champ.name.toUpperCase(), gimmick: champ.gimmick, planId: champ.plan,
      });
    }
  } else {
    // 1 weekly story, 40% a second one — college happens to people weekly.
    // THE LIBRARY quiets the academic fires: its level shaves those weights.
    const wOf = (d: { weight?: number; context?: string }): number => {
      const w = d.weight ?? 1;
      return d.context === 'academic' ? Math.max(0.5, w - (facLevel(s, 'library') - 1)) : w;
    };
    const n = 1 + (roll(40) ? 1 : 0);
    const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      const pool = weeklyPool(s);
      if (!pool.length) break;
      const total = pool.reduce((a, d) => a + wOf(d), 0);
      let r = Math.random() * total;
      let def = pool[0];
      for (const d of pool) {
        r -= wOf(d);
        if (r <= 0) { def = d; break; }
      }
      if (def.kind === 'player') {
        const candidates = t.players.filter((p) => p.outWeeks === 0 && !used.has(p.id) && (!def.forms || def.forms.includes(p.form ?? 'masc')));
        if (!candidates.length) continue;
        const p = pick(candidates);
        used.add(p.id);
        defer(def.id, 'start', p.id);
      } else {
        defer(def.id, 'start', null);
      }
    }

    // THE PRESS + THE REGULARS: 30% each, independent — some weeks you meet
    // all three, some weeks none. Scoop keeps you honest; the dean wants it
    // by the book; the booster's help is illegal and can backfire.
    // (The supply-closet drip lives on the FACILITIES screen now: the janitor
    // pays in kind when you GRAB A MOP.)
    if (roll(30) && hadGame) {
      const q = buildScoopQuestion(s, pressWeek, pressMvp, pressTop, pressRoster, pressResults);
      if (q) defer('scoop_question', 'start', null, q);
    }
    if (roll(30)) defer(pick(DEAN_POOL), 'start', null);
    if (roll(30)) defer(pick(BOOSTER_POOL), 'start', null);
    // flat broke: one of the characters offers a way to scrape up credits
    if (s.energy + stipend <= 1) defer('bailout', 'start', null, { who: pick(['dean', 'booster', 'scoop']) });
  }

  // THE RETRAINING, silent: when a player's numbers outgrow his listed spot
  // the label follows quietly — before the report is drawn up
  for (const p of t.players) checkPosChange(p);
  normalizeLineup(t);
  if (hadGame) {
    // the weekend rhythm: the ride home → the wrap-up dialogues (returns,
    // the dean's envelope, the consequences, the level-ups) → WEEK START →
    // the building (where the NEW week's stories wait)
    s.storedStories = later;
    s.phase = 'weekstart';
    if (wasAway) rollTravelHome(s);
    for (const req of pre) queueStory(s, req.defId, req.beat, req.playerId, req.data ?? {});
    // the weekend's XP banks BEFORE the report — level-ups knock with the rest
    for (const row of s.weekRecap ?? []) {
      if (row.xpGain <= 0) continue;
      const p = t.players.find((x) => x.id === row.playerId);
      if (p) lastLevelUps.push(...addXp(s, p, row.xpGain));
    }
  } else {
    for (const req of [...pre, ...later]) queueStory(s, req.defId, req.beat, req.playerId, req.data ?? {});
    s.storedStories = [];
    s.phase = s.queue.length ? 'stories' : isUtWeek(s) ? 'matchup' : 'facilities';
  }
  save(s);
}

/** WEEK START → the building: the report has been read — the NEW week's
    stories fire now (the wrap-up already played before the report). */
export function beginWeek(s: GameState): void {
  if (s.phase !== 'weekstart' || s.queue.length) return;
  const t = myTeam(s);
  for (const req of s.storedStories ?? []) {
    // the weekend can TAKE somebody — his stored story leaves with him
    if (req.playerId !== null && !t.players.some((p) => p.id === req.playerId)) continue;
    queueStory(s, req.defId, req.beat, req.playerId, req.data ?? {});
  }
  s.storedStories = [];
  s.phase = s.queue.length ? 'stories' : isUtWeek(s) ? 'matchup' : 'facilities';
  if (s.phase === 'facilities') maybeTip(s, 'facilities');
  if (s.phase === 'matchup') maybeTip(s, 'matchup');
  if (s.tutorial !== undefined) tutQueue(s, tutorialArrive(s, s.phase));
  save(s);
}

// ---- FACILITIES: the campus stop ---------------------------------------------------------

/** FACILITIES → SCOUTING: the campus stop is free — the mop is optional. */
export function toScouting(s: GameState): void {
  if (s.queue.length || s.phase !== 'facilities') return;
  s.phase = 'scouting';
  maybeTip(s, 'scouting');
  if (s.tutorial !== undefined) tutQueue(s, tutorialArrive(s, 'scouting'));
  save(s);
}

/** Order an upgrade: costs credits now, ARRIVES next week with its own beat. */
export function upgradeFacility(s: GameState, id: FacId): { cost: number; text: string } | null {
  if (s.phase !== 'facilities') return null;
  const lvl = facLevel(s, id);
  if (lvl >= 3) return null;
  if (s.futureBeats.some((fb) => fb.defId === 'facility_arrives' && fb.data?.facId === id)) return null;
  const cost = Math.max(1, facCost(lvl + 1) - (s.mopDiscount ? 2 : 0));
  if (s.energy < cost) return null;
  s.energy -= cost;
  s.mopDiscount = false;
  s.futureBeats.push({ weeksLeft: 1, defId: 'facility_arrives', beat: 'start', playerId: null, data: { facId: id } });
  save(s);
  const fd = facilityById(id);
  return { cost, text: `${fd.name} — the order is in. The crates land NEXT WEEK.` };
}

/** GRAB A MOP: once a week, free. Mostly the janitor pays in kind (the
    supply drip lives here now); sometimes he "knows a guy"; sometimes the
    floors just shine. */
export function grabMop(s: GameState): string | null {
  if (s.phase !== 'facilities' || s.moppedWk) return null;
  s.moppedWk = true;
  const r = Math.random() * 100;
  if (r < 45) {
    queueStory(s, 'supply', 'start', null, { itemId: pick(SMALL_ITEMS) });
    save(s);
    return null;
  }
  if (r < 60) {
    s.mopDiscount = true;
    save(s);
    return 'You mop; the janitor talks. He "knows a guy" — 2¢ off any upgrade you order THIS week.';
  }
  save(s);
  return pick([
    'You mop half the hallway before the janitor takes it back, nodding once. The floors shine. Somewhere, goodwill accrues.',
    'Twenty minutes of honest mopping. The janitor says nothing, but the supply closet door stands open a little wider than usual.',
    'You mop. A freshman sees you mopping. By practice, the whole team has heard the coach mops. This is, on balance, good.',
  ]);
}

export function toggleSitout(s: GameState, playerId: number): void {
  const i = s.sitouts.indexOf(playerId);
  if (i >= 0) s.sitouts.splice(i, 1);
  else s.sitouts.push(playerId);
  save(s);
}

export interface DrillOutcome {
  report: string;
  xpByPlayer: Map<number, number>;
  /** direct attribute points landed, per player, e.g. "+1 ATH +1 SKL" */
  gainByPlayer: Map<number, string>;
  levelUps: LevelUp[];
}

/** Whole squad (minus sit-outs). Train as often as your ⚡ allows — the
    odds line rolls fresh every time. */
export function runDrill(s: GameState, drillId: string, onePlayerId?: number): DrillOutcome | null {
  if (s.trainedThisWeek) return null; // one practice per week — choose well
  if (!s.unlockedDrills.includes(drillId)) return null;
  if (facLevel(s, 'gym') < (GYM_REQ[drillId] ?? 2)) return null; // the building decides
  if ((s.actCooldowns?.[drillId] ?? 0) > 0) return null; // still recharging
  const d = drillById(drillId);
  if (s.energy < d.cost) return null;
  const t = myTeam(s);
  lastLevelUps = [];
  const xpByPlayer = new Map<number, number>();
  let participants: Player[];
  if (d.target === 'one') {
    const p = t.players.find((x) => x.id === onePlayerId && x.outWeeks === 0);
    if (!p) return null;
    participants = [p];
  } else if (d.target === 'rest') {
    participants = [];
  } else {
    // anyone under 40 energy sits out automatically — no martyrs
    participants = t.players.filter((p) => p.outWeeks === 0 && p.energy >= 40);
    if (!participants.length) return null;
  }
  s.energy -= d.cost;
  s.trainedThisWeek = true;
  // the pricey sessions can't run back to back: 2¢ rests a week, 3¢ two
  if (d.cost >= 2) s.actCooldowns = { ...(s.actCooldowns ?? {}), [drillId]: d.cost - 1 };

  const ups: LevelUp[] = [];
  const gainByPlayer = new Map<number, string>();
  const gainNotes: string[] = [];
  if (d.target === 'rest') {
    // a deliberate rest week climbs past the baseline — but only stories and
    // items reach the true extremes (cap 85)
    const rec = d.recover ?? { energy: 21, mood: 4 };
    for (const p of t.players.filter((x) => x.outWeeks === 0)) {
      if (p.energy < 85) p.energy = Math.min(85, p.energy + rec.energy);
      if (p.mood < 85) p.mood = Math.min(85, p.mood + rec.mood);
    }
  } else {
    for (const p of participants) {
      let gained = d.xp[0] + rand(d.xp[1] - d.xp[0] + 1);
      p.energy = clamp(p.energy - d.energyCost, 0, 100);
      // the fast fixed track: the drill hammers points into exact attributes
      if (d.gain) {
        const landedBits: string[] = [];
        for (const a of ATTRS) {
          let n = d.gain[a] ?? 0;
          // THE ARCHIVE: a level-3 library feeds the film crypt's BRAINS harder
          if (n && a === 'brn' && d.id === 'filmroom' && facLevel(s, 'library') >= 3) n += 1;
          if (!n) continue;
          const before = p.attrs[a];
          p.attrs[a] = Math.min(p.pots[a], p.attrs[a] + n);
          if (p.attrs[a] > before) landedBits.push(`+${p.attrs[a] - before} ${a.toUpperCase()}`);
        }
        if (landedBits.length) {
          gainByPlayer.set(p.id, landedBits.join(' '));
          gainNotes.push(`${p.name} ${landedBits.join(' ')}`);
        } else {
          gained += 8; // at his ceiling there — the reps bank as XP instead
          gainNotes.push(`${p.name} is at his ceiling there — the reps banked as XP`);
        }
      }
      // ceiling work: the dream lab raises where a player can GO
      if (d.potChance && roll(d.potChance)) {
        if (bumpAnyPot(p, 1)) {
          const bit = '+1 CEILING';
          gainByPlayer.set(p.id, gainByPlayer.has(p.id) ? `${gainByPlayer.get(p.id)} ${bit}` : bit);
          gainNotes.push(`${p.name} ${bit}`);
        }
      }
      xpByPlayer.set(p.id, gained);
      ups.push(...addXp(s, p, gained));
    }
  }

  let report = d.target === 'rest'
    ? d.id === 'bonfire'
      ? 'The bonfire burns down to embers and inside jokes. The squad comes back liking each other again.'
      : 'The facility echoes with the sound of absolutely nothing happening. Everyone comes back looser.'
    : gainNotes.length
      ? `${d.name}: ${gainNotes.join(' · ')}.`
      : `${d.name}: the squad puts the work in.`;

  // the odds line rolls once for the session — sit-outs are how you protect people
  const r = Math.random() * 100;
  if (r < d.down.pct) {
    const pool = d.target === 'rest' ? t.players.filter((p) => p.outWeeks === 0) : participants;
    if (pool.length) {
      const weight = (p: Player): number => (p.energy <= 30 ? 2 : 1) * (p.attrs.frc >= 14 ? 1.5 : 1) * fragility(p.speciesId);
      const total = pool.reduce((a, p) => a + weight(p), 0);
      let rr = Math.random() * total;
      let victim = pool[0];
      for (const p of pool) { rr -= weight(p); if (rr <= 0) { victim = p; break; } }
      if (d.down.cls === 'INJURY') {
        const inj = rollInjury(d.injuryBias, fragility(victim.speciesId));
        queueStory(s, 'injury', 'start', victim.id, { weeks: inj.weeks, label: inj.label, levelLoss: inj.levelLoss, cause: d.cause(victim.name) });
        report += ` Then the whistle you never want to blow: down goes ${victim.name}.`;
      } else {
        queueStory(s, 'drama', 'start', victim.id, { cause: d.cause(victim.name) });
        report += ` And then, of course, a situation.`;
      }
    }
  } else if (r < d.down.pct + d.up.pct) {
    if (d.up.cls === 'BREAKTHROUGH') {
      const pool = participants.length ? participants : t.players.filter((p) => p.outWeeks === 0);
      const p = pick(pool);
      queueStory(s, 'breakthrough', 'start', p.id, { cause: `Mid-${d.name.toLowerCase()}, the gym goes quiet.` });
      report += ` And something HAPPENED out there.`;
    } else {
      for (const p of t.players) p.mood = clamp(p.mood + 8, 0, 100);
      report += ` The vibes ascend. Squad mood up.`;
    }
  }

  s.drillReport = report;
  save(s);
  return { report, xpByPlayer, gainByPlayer, levelUps: ups };
}

// ---- galaxy: ONE action per week, always board-wide -------------------------------------

export interface GalaxyResult {
  text: string;
  /** per-prospect stickers for the board (+the commit ring's change delta) */
  perProspect: Map<number, { text: string; up?: boolean; commitFrom?: number }[]>;
  /** search trips show the ride: the saucer for deep space, the bus for
      local trips (the rec center is a drive, not a launch) */
  art?: 'saucer-hoop' | 'saucer-stranded' | 'saucer-move' | 'bus-hoop';
}

/** Reveal one unrevealed facet of a prospect. Returns the sticker, or null when
    everything is already known. */
function revealFacet(pr: Prospect): { text: string; up?: boolean } | null {
  // three looks and you know him: a digit, the other digit, then the whole
  // shape — abilities AND ceiling, exact. No clouds in between.
  if (pr.digits < 2) {
    pr.digits = (pr.digits + 1) as 0 | 1 | 2;
    return { text: pr.digits >= 2 ? 'THE NUMBER' : 'A DIGIT', up: true };
  }
  if (!pr.seenSkill || !pr.seenPot) {
    pr.seenSkill = true;
    pr.seenPot = true;
    pr.scoutLevel = Math.max(pr.scoutLevel, 4);
    observe(pr);
    return { text: 'THE WHOLE PICTURE', up: true };
  }
  return null;
}

/** A NEW NAME never arrives a total stranger: one thing is known on
    discovery — a digit of the rating (two in three) or the ceiling stars. */
function discoveryReveal(pr: Prospect): void {
  if (roll(67) || pr.digits >= 2) {
    pr.digits = Math.min(2, pr.digits + 1) as 0 | 1 | 2;
  } else {
    pr.seenPot = true;
  }
  pr.scoutLevel = Math.max(pr.scoutLevel, 1);
  observe(pr);
}

/** Fully reveal a prospect (the combine locks somebody cold). */
function revealAll(pr: Prospect): void {
  pr.seenSkill = true;
  pr.seenPot = true;
  pr.digits = 2;
  pr.scoutLevel = Math.max(pr.scoutLevel, 4);
  observe(pr);
}

/** ONE move per section: SCOUTING (search for new names / sharpen the known
    ones) and RECRUITING (your own charm / the booster's radioactive help)
    are separate weekly stops. A scoped action (3/6) works the names YOU
    highlighted; with no picks it falls back to the rows top-down (the
    harness still plays by priority). */
export function actionGalaxy(s: GameState, actId: string, targetIds?: number[]): GalaxyResult | null {
  const act = galaxyActById(actId);
  if (s.pendingRecruits.length) return null;
  if (act.kind === 'recruit') {
    if (s.phase !== 'recruiting' || s.recruitActWk) return null;
  } else {
    if (s.phase !== 'scouting' || s.scoutActWk) return null;
  }
  if (s.energy < act.cost) return null;
  if ((s.actCooldowns?.[act.id] ?? 0) > 0) return null; // still recharging
  if (act.kind === 'search' && !s.unlockedRegions.includes(act.id)) return null;
  if (act.kind === 'search' && facLevel(s, 'ship') < (SHIP_REQ[act.id] ?? 3)) return null; // the ship decides the range
  if (act.kind === 'search' && s.groundedWeeks > 0 && !act.local) return null;
  if (act.kind === 'recruit' && facLevel(s, 'greekrow') < (ROW_REQ[act.id] ?? 0)) return null; // the row decides the charm
  if (act.kind !== 'search' && !s.prospects.length) return null;
  s.energy -= act.cost;
  if (act.kind === 'recruit') s.recruitActWk = true;
  else s.scoutActWk = true;
  // the big plays can't run every week: 2¢ rests a week, 3¢ two — no duffel
  // bags two Fridays in a row
  if (act.cost >= 2) s.actCooldowns = { ...(s.actCooldowns ?? {}), [act.id]: act.cost - 1 };
  const per = new Map<number, { text: string; up?: boolean; commitFrom?: number }[]>();
  let text: string;
  let art: GalaxyResult['art'];
  const r = Math.random() * 100;
  // the working set: your highlighted names, or the rows top-down
  const picked = targetIds?.length
    ? s.prospects.filter((pr) => targetIds.includes(pr.id))
    : s.prospects.slice(0, act.scope ?? 9);
  // ink is ink: a SIGNED name needs no charming (scouting him still works)
  const scoped = act.kind === 'recruit' ? picked.filter((pr) => !pr.signed) : picked;
  const scopeWord = targetIds?.length
    ? scoped.length === 1 ? 'the one you picked' : `the ${scoped.length} you picked`
    : act.scope === 3 ? 'THE TARGETS' : act.scope === 6 ? 'the top six' : 'all nine';

  if (act.kind === 'scout') {
    let revealed = 0;
    for (const pr of scoped) {
      const n = act.reveals![0] + rand(act.reveals![1] - act.reveals![0] + 1);
      const msgs: { text: string; up?: boolean }[] = [];
      for (let i = 0; i < n; i++) {
        const m = revealFacet(pr);
        if (!m) break;
        msgs.push(m);
        revealed++;
      }
      if (msgs.length) {
        pr.scoutLevel++;
        observe(pr);
        per.set(pr.id, msgs);
      }
    }
    text = revealed
      ? `${act.name}: the reports on ${scopeWord} come back. ${revealed} new piece${revealed === 1 ? '' : 's'} of the truth land${revealed === 1 ? 's' : ''} on the board.`
      : `${act.name}: the reports on ${scopeWord} come back saying what you already knew. Read cold.`;
    if (r < act.down.pct) {
      if (act.down.cls === 'SCANDAL') {
        queueStory(s, 'scandal', 'start', null, { cause: 'Hosting nine amateurs in your gym with travel paid is, the league notes, EXACTLY the thing the rulebook is about.' });
        text += ' The league, meanwhile, counted the shuttle tickets...';
      } else if (act.down.cls === 'SHIP') {
        queueStory(s, 'grounded', 'start', null, { cause: 'Nine gyms in seven systems is a lot of atmosphere re-entries.' });
        text += ' The shuttle, however, felt every mile...';
      } else {
        s.energy = clamp(s.energy - 1, 0, CACHE_MAX);
        text += ' The feed subscriptions auto-renewed. Of course they did. (−1¢)';
      }
    } else if (r < act.down.pct + act.up.pct && scoped.length) {
      const lucky = pick(scoped);
      revealAll(lucky);
      per.set(lucky.id, [{ text: 'LOCKED COLD', up: true }]);
      text += ` And ${lucky.name} does the ONE thing that tells you everything. Locked, cold.`;
    }
  } else if (act.kind === 'recruit') {
    let ups = 0;
    let downs = 0;
    const soured: Prospect[] = [];
    for (const pr of scoped) {
      if (pr.bannedWeeks > 0) {
        per.set(pr.id, [{ text: 'NO CONTACT', up: false }]);
        continue;
      }
      const commitFrom = pr.commitPct;
      if (roll(act.risk ?? 0)) {
        const d = act.gain![1];
        pr.commitPct = clamp(pr.commitPct - d, 0, 95);
        per.set(pr.id, [{ text: `COMMITMENT −${d}`, up: false, commitFrom }]);
        downs++;
        soured.push(pr);
      } else {
        const g = act.gain![0] + rand(act.gain![1] - act.gain![0] + 1);
        pr.commitPct = clamp(pr.commitPct + g, 0, 95);
        per.set(pr.id, [{ text: `COMMITMENT +${g}`, up: true, commitFrom }]);
        ups++;
      }
    }
    const tally = ups === 0 && downs === 0
      ? `Nobody moves. ${scopeWord === 'all nine' ? 'The whole board' : `${scopeWord[0].toUpperCase()}${scopeWord.slice(1)}`} heard you, and stayed exactly where it was.`
      : `${ups ? `${ups} name${ups === 1 ? '' : 's'} lean${ups === 1 ? 's' : ''} in` : ''}${ups && downs ? ' — ' : ''}${downs ? `${downs} lean${downs === 1 ? 's' : ''} away` : ''}.`;
    const flavor = RECRUIT_FLAVOR[act.id];
    text = `${flavor ? pick(flavor) : `${act.name}: the trail hears from you.`}\n\n${tally}`;
    // a lean AWAY is a story, not a sticker: each soured name knocks
    for (const pr of soured) {
      queueStory(s, 'lean_away', 'start', null, { prospectId: pr.id, name: pr.name, prForm: pr.form, alumForm: pr.form });
    }
    if (r < act.down.pct) {
      if (act.down.cls === 'SCANDAL') {
        // the booster's PLAUSIBLE DENIABILITY: half the time his name is on
        // it, not yours — his patience frays, but the league looks past you
        if (act.via === 'booster' && roll(50)) {
          s.opFans = clamp((s.opFans ?? 60) - 8, 0, 100);
          text += ' The league sniffs around — and finds only the booster\'s fingerprints. He eats it, tips his hat, and remembers.';
        } else {
          queueStory(s, 'scandal', 'start', null, {
            cause: act.via === 'booster'
              ? 'A league investigator holds up a duffel bag with a very traceable monogram. The deniability was less plausible than advertised.'
              : 'The recruiting-night photos reach the league office before the dessert course ends. Twelve courses of evidence.',
          });
          text += ' The flashbulbs, meanwhile...';
        }
      } else {
        queueStory(s, 'drama', 'start', null, { cause: 'Two recruits discover they were promised the same jersey number, loudly, in front of everyone.' });
        text += ' It gets loud at the punch bowl...';
      }
    } else if (r < act.down.pct + act.up.pct) {
      for (const pr of scoped) {
        if (pr.bannedWeeks > 0) continue;
        pr.commitPct = clamp(pr.commitPct + 5, 0, 95);
      }
      text += ` And the night goes LEGENDARY — ${scopeWord === 'all nine' ? 'the whole board talks' : `${scopeWord} talk`} about it for a week. COMMITMENT +5 across it.`;
    }
  } else {
    // search: new talent — a full board means somebody must go
    const counter = { nextId: s.nextId };
    const names = takenNames(s);
    const found: Prospect[] = [genProspect(counter, s.season, act.id, names)];
    if (act.twoChance && roll(act.twoChance)) found.push(genProspect(counter, s.season, act.id, names));
    // SEASON ZERO pins the find: the rec-center trip turns up the ??-rated
    // 5★ kid — the reason not to cut the stranger
    if (s.tutorial !== undefined && found[0]) tutorialGemify(found[0]);
    s.nextId = counter.nextId;
    // the ride matches the trip: local searches take the bus (the rec
    // center is a drive, not a launch); deep space takes the saucer
    art = act.local ? 'bus-hoop' : 'saucer-hoop';
    for (const pr of found) discoveryReveal(pr);
    text = `${act.name}: ${found.map((p) => `${p.name}, a ${speciesById(p.speciesId).name}`).join(' — and ')} steps into the light.`;
    for (const pr of found) {
      if (s.prospects.length < MAX_PROSPECTS) {
        s.prospects.push(pr);
        per.set(pr.id, [{ text: 'NEW', up: true }]);
      } else {
        s.pendingRecruits.push(pr);
      }
    }
    if (s.pendingRecruits.length) {
      // the full-board rules read ONCE (tutorial voice); after that the
      // trail talks about the kid instead
      if (!s.tipsSeen.includes('boardfull')) {
        s.tipsSeen.push('boardfull');
        text += ' The board is FULL — take the new name on and somebody gets forgotten forever, or let the new one walk.';
      } else {
        const fresh = s.pendingRecruits[s.pendingRecruits.length - 1];
        text += ` Word from the bleachers: "${fresh.blurb}"`;
      }
    }
    if (act.id === 'reccenter' && r < act.down.pct) {
      // kids notice where you went looking
      if (s.prospects.length && roll(50)) {
        const gone = pick(s.prospects.filter((p) => !s.pendingRecruits.includes(p)) as Prospect[]);
        s.prospects = s.prospects.filter((p) => p.id !== gone.id);
        text += ` Word gets around that you spent the week at the REC CENTER. ${gone.name} takes it personally and takes ${gone.form === 'femme' ? 'her' : gone.form === 'x' ? 'their' : 'his'} name off your board.`;
      } else {
        const t = myTeam(s);
        const p = pick(t.players);
        p.mood = clamp(p.mood - 15, 0, 100);
        text += ` ${p.name} hears where you went looking for ${p.form === 'femme' ? 'her' : p.form === 'x' ? 'their' : 'his'} replacement and takes it personally.`;
      }
    } else if (act.id !== 'reccenter') {
      if (s.energy === 0 && roll(10)) {
        queueStory(s, 'debt', 'start', null, { art: 'saucer', cause: 'On the way home from the search, a gravity snare — a salvage rig reels your ship in like a fish.' });
        text += ' Then the credits run dry in dead space...';
        art = 'saucer-stranded';
      } else if (r < act.down.pct) {
        if (roll(50)) queueStory(s, 'hullbreach', 'start', null);
        else queueStory(s, 'grounded', 'start', null, { cause: 'A micrometeorite shreds the starboard scoop on the way home.' });
        text += ' The trip home, however...';
        art = 'saucer-stranded';
      } else if (r < act.down.pct + act.up.pct) {
        if (act.up.cls === 'LOOT') {
          const item = pick(ITEMS.filter((i) => i.rarity !== 'legendary'));
          giveItem(s, item.id);
          text += ` And floating in the debris field: ${item.name}. Finders keepers is maritime law, probably.`;
        } else {
          for (const pr of found) {
            revealFacet(pr);
            observe(pr);
          }
          text += ' The array over-delivers: a first read comes free.';
        }
      }
    }
  }
  save(s);
  return { text, perProspect: per, art };
}

/** Swap between the board (0–8) and the 4th row (9–11: the pending names). */
export function swapBoardSlot(s: GameState, from: number, to: number): void {
  const get = (i: number): Prospect | null => (i < 9 ? s.prospects[i] ?? null : s.pendingRecruits[i - 9] ?? null);
  const a = get(from);
  const b = get(to);
  if (!a && !b) return;
  // ink is ink: a SIGNED name cannot be moved off the board
  if ((a?.signed || b?.signed) && (from >= 9 || to >= 9)) return;
  const set = (i: number, pr: Prospect | null): void => {
    if (i < 9) {
      if (pr) s.prospects[i] = pr;
      else s.prospects.splice(i, 1);
    } else {
      if (pr) s.pendingRecruits[i - 9] = pr;
      else s.pendingRecruits.splice(i - 9, 1);
    }
  };
  if (a && b) {
    set(from, b);
    set(to, a);
  } else if (a && !b) {
    if ((from < 9) === (to < 9)) {
      // an empty slot inside the board: reorder — the drag IS the targeting
      if (from < 9) {
        s.prospects.splice(from, 1);
        s.prospects.splice(Math.min(to, s.prospects.length), 0, a);
      }
    } else {
      set(from, null);
      if (to < 9) s.prospects.push(a);
      else s.pendingRecruits.push(a);
    }
  }
  save(s);
}

/** The 4th row empties FOREVER: whoever sits there when you confirm is gone. */
export function confirmBoard(s: GameState): string[] {
  const dropped = s.pendingRecruits.map((p) => p.name);
  s.pendingRecruits = [];
  save(s);
  return dropped;
}


// ---- matchup ---------------------------------------------------------------------------

/** THE SPEECH: mandatory, once, before tip-off. Two beats: you say the words
    and leave the room for effect (tap); when you come back in, the scene says
    whether it took. A shift speech that takes is a TRADE — the squad plays
    +gain in its attribute and −loss in the opposite (SKILL ↔ ATHLETICISM ·
    BRAINS ↔ FIERCENESS); some nights it simply doesn't take. */
function rollSpeech(s: GameState, plan: PlanId): { fx: SpeechFx[]; text: string; took: boolean } {
  const pl = planById(plan);
  const t = myTeam(s);
  const exit = `"Tonight, ${pl.speech}," you say — and you leave the room for dramatic effect.`;
  const back = 'When you come back in,';
  if (pl.kind === 'rally') {
    // no X's and O's: a coin flip on morale, a sliver of chance either way
    const r = Math.random() * 100;
    if (r < 2) { for (const p of t.players) p.mood = clamp(p.mood - 20, 0, 100); return { took: false, fx: [], text: `${exit}\n\n${back} somebody is laughing. Then somebody else. The room deflates like a tire. Squad MOOD −20.` }; }
    if (r < 4) { for (const p of t.players) p.mood = clamp(p.mood + 25, 0, 100); return { took: true, fx: [], text: `${exit}\n\n${back} the roof is OFF. Chairs are over. Somebody is crying. The other team can hear it through the wall. Squad MOOD +25.` }; }
    if (r < 52) { for (const p of t.players) p.mood = clamp(p.mood + 12, 0, 100); return { took: true, fx: [], text: `${exit}\n\n${back} ${pl.scene} The room is on its feet. Squad MOOD +12.` }; }
    return { took: false, fx: [], text: `${exit}\n\n${back} ${pick(SPEECH_FLOPS)} Tonight it doesn't take. The rest is on them.` };
  }
  if (pl.kind === 'easy') {
    s.easyNight = true;
    return { took: true, fx: [], text: `${exit}\n\n${back} ${pl.scene} The floor players will burn far less tonight — and play a touch softer for it. Lose, and this room takes it badly.` };
  }
  if (roll(pl.premium ? SPEECH_FLOP_PREMIUM : SPEECH_FLOP)) {
    return { took: false, fx: [], text: `${exit}\n\n${back} ${pick(SPEECH_FLOPS)} Tonight it doesn't take: the squad plays as it is.` };
  }
  const gain = pl.gain[0] + rand(pl.gain[1] - pl.gain[0] + 1);
  const loss = pl.loss[0] + rand(pl.loss[1] - pl.loss[0] + 1);
  const A = pl.attr.toUpperCase();
  const O = pl.off.toUpperCase();
  return {
    took: true,
    fx: [{ attr: pl.attr, amt: gain }, { attr: pl.off, amt: -loss }],
    text: `${exit}\n\n${back} ${pl.scene} Tonight the squad plays +${gain} ${A} — and gives up ${loss} ${O} to do it.`,
  };
}

/** Weeks before this speech can be given again (premium finds recharge). */
export function speechCooldown(s: GameState, plan: PlanId): number {
  return s.speechCooldowns?.[plan] ?? 0;
}

/** Weeks before a drill / board action can run again (the pricey ones rest). */
export function actCooldown(s: GameState, id: string): number {
  return s.actCooldowns?.[id] ?? 0;
}

export function deliverSpeech(s: GameState, plan: PlanId): string | null {
  if (s.pregameWk || !s.knownPlans.includes(plan) || speechCooldown(s, plan) > 0) return null;
  s.plan = plan;
  s.pregameWk = true;
  const out = rollSpeech(s, plan);
  s.speechFx = out.fx;
  s.speechTook = out.took;
  const cd = planById(plan).cooldown;
  if (cd) s.speechCooldowns = { ...(s.speechCooldowns ?? {}), [plan]: cd };
  save(s);
  return out.text;
}

/** LAST-MINUTE INSTRUCTIONS — the other pregame move: play the tape instead
    of rousing the room. Call their set and their BEST attribute plays −amt
    tonight; call it wrong and nothing happens; get READ and your own best
    attribute craters (the captain's order gets CAUGHT instead: heat now, the
    league reviews the tape Monday). */
export function deliverInstructions(s: GameState, instrId: string): string | null {
  const it = instrById(instrId);
  if (s.pregameWk || !(s.knownInstr ?? []).includes(instrId) || speechCooldown(s, instrId as PlanId) > 0) return null;
  if (s.energy < it.cost) return null;
  s.energy -= it.cost;
  s.pregameWk = true;
  if (it.cooldown) s.speechCooldowns = { ...(s.speechCooldowns ?? {}), [instrId]: it.cooldown };
  // the call is MADE now; whether it lands you learn at tip-off
  s.instrPending = instrId;
  save(s);
  if (instrId === 'takeout') return `You take your captain aside. Two sentences. He nods without looking at you.\n\nYou'll know at tip-off.`;
  if (instrId === 'medium') return `The medium sways in the corner of the locker room, eyes rolled back, and whispers their whole night to you.\n\nYou'll know at tip-off whether he saw it right.`;
  return `"${it.call}," you tell the room, and draw their opener on the board twice.\n\nWhether that's what they run, you'll know at tip-off.`;
}

/** Tip-off: the instruction resolves — the story the coach reads before the
    ball goes up. */
function rollInstruction(s: GameState, instrId: string): string {
  const it = instrById(instrId);
  const me = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const theirBest = champ ? bestAttr(champ.kite) : m ? bestAttr(matchAttrs(m.opponent)) : 'skl';
  const myBest = bestAttr(matchAttrs(me, null, undefined, tacticsMult(s.tacO, s.tacD)));
  const A = theirBest.toUpperCase();
  const r = Math.random() * 100;
  if (r < it.hit) {
    s.oppFx = { attr: theirBest, amt: -it.oppAmt };
    if (instrId === 'takeout') {
      return `The first screen of warmups is early, hard, and extremely memorable. Their star spends the night looking over ${it.oppAmt > 0 ? 'both shoulders' : 'a shoulder'} — they play −${it.oppAmt} ${A} tonight. Nobody saw anything.`;
    }
    return `"${it.call}," you say — and you CALLED IT. Their whole opener dies at half court. They play −${it.oppAmt} ${A} tonight.`;
  }
  if (r < it.hit + it.backfire) {
    if (instrId === 'takeout') {
      // caught: no edge tonight, heat now, the league reviews the tape Monday
      const capt = starters(me).filter((p) => p.outWeeks === 0).sort((a, b) => b.attrs.frc - a.attrs.frc)[0] ?? null;
      s.opPublic = clamp((s.opPublic ?? 60) - 6, 0, 100); // the league saw it — so did everyone
      if (capt) {
        s.futureBeats.push({ weeksLeft: 1, defId: 'tape_review', beat: 'start', playerId: capt.id, data: {} });
        return `${capt.name} sets the screen — and a courtside stream catches every choreographed inch of it. No edge tonight, the refs watching your bench all game, and the league "will be reviewing the tape."`;
      }
      return 'The plan leaks before warmups end. No edge tonight, and the league office sends a one-line holo: "we saw that."';
    }
    s.speechFx = [{ attr: myBest, amt: -it.selfAmt }];
    return `"${it.call}," you said. They knew. They KNEW — they baited the counter and your whole game plan folds around it. Your squad plays −${it.selfAmt} ${myBest.toUpperCase()} tonight.`;
  }
  if (instrId === 'medium') return 'The medium hums, sways, and predicts a sport that has not been invented yet. The locker room applauds politely. Nothing happens.';
  if (instrId === 'takeout') return 'Warmups end and the look never comes — their star stretches on the far baseline, surrounded by teammates, and your captain never gets within a screen of him. Nobody saw anything, because nothing happened.';
  return `"${it.call}," you said. Tip-off comes — and they open in something else entirely. Nothing gained, nothing lost.`;
}

/** Which item contexts the current phase accepts ('mood' is always welcome).
    Player-target items are usable whenever a player grid is on screen;
    recruit-target items whenever the big board is. */
export function itemAllowedNow(s: GameState, itemId: string): boolean {
  const item = itemById(itemId);
  if (item.target === 'player' && ['practice', 'matchup', 'weekstart', 'gamenight', 'teamSelect'].includes(s.phase)) return true;
  if (item.target === 'prospect' && ['scouting', 'recruiting', 'signing'].includes(s.phase)) return true;
  const phaseCtx: Record<string, string[]> = {
    practice: ['practice'],
    matchup: ['pregame'],
    scouting: ['recruiting'],
    recruiting: ['recruiting'],
    stories: ['mood'],
  };
  const allowed = [...(phaseCtx[s.phase] ?? []), 'mood'];
  return item.context.some((c) => allowed.includes(c));
}

/** Use a bag item outside a story (drawer / matchup / practice / galaxy). */
export function useItem(s: GameState, itemId: string, ctxData: Record<string, unknown> = {}): string | null {
  const idx = s.bag.indexOf(itemId);
  if (idx < 0) return null;
  const item = itemById(itemId);
  if (item.rarity === 'legendary' && s.legendariesUsed.includes(item.id)) return null;
  if (!itemAllowedNow(s, itemId)) return null;
  // a refusal bounces the drop WITHOUT consuming the item
  const deny = item.check?.(storyCtx(s, (ctxData.playerId as number | null) ?? null, ctxData));
  if (deny) return `◆ ${item.name}: ${deny}.`;
  s.bag.splice(idx, 1);
  if (item.rarity === 'legendary') s.legendariesUsed.push(item.id);
  lastLevelUps = [];
  const res = item.use(storyCtx(s, (ctxData.playerId as number | null) ?? null, ctxData));
  const ipid = res.fx?.find((f) => f.playerId !== undefined)?.playerId ?? (ctxData.playerId as number | null) ?? null;
  // a recruit item speaks the RECRUIT's pronouns
  const iform = ipid !== null
    ? myTeam(s).players.find((p) => p.id === ipid)?.form
    : ctxData.prospectId !== undefined ? s.prospects.find((pr) => pr.id === ctxData.prospectId)?.form : undefined;
  res.text = genderize(res.text, iform);
  applyFx(s, res.fx, (ctxData.playerId as number | null) ?? null);
  for (const f of res.follow ?? []) {
    s.futureBeats.push({ weeksLeft: f.weeks, defId: f.defId ?? 'breakthrough', beat: f.beat, playerId: f.playerId ?? null, data: f.data });
  }
  if (res.next) queueStory(s, res.next.defId, res.next.beat, res.next.playerId ?? null, res.next.data ?? {});
  save(s);
  return res.text;
}

// ---- game night ----------------------------------------------------------------------------

/** THE RIDE HOME: an away weekend ends on the bus — a voyage story, a debt
    snare, or plain uneventful void. Fires before the WEEK START report. */
export function rollTravelHome(s: GameState): void {
  if (s.voyageRolled) return;
  s.voyageRolled = true;
  if (s.energy === 0 && roll(10)) {
    queueStory(s, 'debt', 'start', null);
  } else if (roll(25)) {
    if (s.alumni.length && roll(10)) {
      const alum = pick(s.alumni);
      queueStory(s, alum.exit === 'void' ? 'alum_void' : roll(50) ? 'alum_gold' : 'alum_dark', 'start', null, {
        alumName: alum.name, alumForm: alum.form, exit: alum.exit, season: alum.season,
      });
    } else {
      queueStory(s, pick(VOYAGE_POOL), 'start', null);
    }
  } else {
    queueStory(s, 'travel', 'start', null);
  }
}

/** SCOUTING → PRACTICE: the board move is mandatory (the rec center is free). */
export function toPractice(s: GameState): void {
  if (s.queue.length) return;
  if (s.phase === 'scouting' && (!s.scoutActWk || s.pendingRecruits.length)) return;
  s.phase = 'practice';
  maybeTip(s, 'practice');
  if (s.tutorial !== undefined) tutQueue(s, tutorialArrive(s, 'practice'));
  save(s);
}

/** PRACTICE → RECRUITING: practice is mandatory (rest is the free floor). */
export function toRecruiting(s: GameState): void {
  if (s.queue.length) return;
  if (!s.trainedThisWeek) return;
  s.phase = 'recruiting';
  maybeTip(s, 'recruiting');
  if (s.tutorial !== undefined) tutQueue(s, tutorialArrive(s, 'recruiting'));
  save(s);
}

/** RECRUITING → MATCHUP: the charm move is mandatory (the group chat is free). */
export function toMatchup(s: GameState): void {
  if (s.phase === 'stories' && s.queue.length) return;
  if (s.phase === 'recruiting' && !s.recruitActWk) return;
  normalizeLineup(myTeam(s));
  // wheels up: every away game opens with the bus heading out
  const m = myMatchup(s);
  if (m && !m.home && s.phase === 'recruiting') queueStory(s, 'travel_out', 'start', null);
  s.phase = 'matchup';
  maybeTip(s, 'matchup');
  if (s.tutorial !== undefined) tutQueue(s, tutorialArrive(s, 'matchup'));
  save(s);
}

/** THE FROZEN ONE knocks at PLAY: a reserve past his patience (and not
    already heard this stretch) meets you at the locker room door. */
function frozenKnock(s: GameState): Player | null {
  const me = myTeam(s);
  const floor = new Set(me.lineup.slots.slice(0, 6).filter((x): x is number => x !== null));
  const angry = me.players
    .filter((p) => p.outWeeks === 0 && !floor.has(p.id))
    .filter((p) => {
      const patience = p.patience ?? 4;
      return p.dnp >= patience && p.dnp >= (p.gripe ?? 0) + patience;
    })
    .sort((a, b) => b.dnp - (b.patience ?? 4) - (a.dnp - (a.patience ?? 4)));
  return angry[0] ?? null;
}

/** PLAY (held). The frozen one may stop you at the door first (false = no
    tip-off yet, the story has the floor); otherwise the game sims when the
    queue clears. */
export function playGame(s: GameState): boolean {
  if (!s.pregameWk) return false; // no tip-off before the pregame move
  if (s.phase === 'matchup' && !s.queue.length) {
    const knock = frozenKnock(s);
    if (knock) {
      knock.gripe = knock.dnp;
      queueStory(s, 'frozen', 'start', knock.id, { games: knock.dnp });
      save(s);
      return false;
    }
  }
  const me = myTeam(s);
  s.preGame = { wins: me.wins, losses: me.losses, rank: 1 + sortedStandings(s).findIndex((t) => t.id === s.myTeamId) };
  s.prevRanks = Object.fromEntries(sortedStandings(s).map((t, i) => [t.id, i + 1]));
  s.phase = 'gamenight';
  s.lastResult = null;
  // the last-minute instruction resolves NOW, as the ball is about to go up
  if (s.instrPending) {
    const text = rollInstruction(s, s.instrPending);
    s.instrPending = null;
    queueStory(s, 'notice', 'start', null, { tag: 'LAST-MINUTE INSTRUCTIONS', text });
  }
  if (!s.queue.length && !s.end) simWeek(s);
  save(s);
  return true;
}

/** THE SUCCESS CYCLE: what a result does to THE FANS' track, indexed by
    expectation (0 = came from the cellar … 4 = defending champions). A
    champion's fans treat every loss as betrayal; a cellar crowd throws a
    parade for any win. */
const FAN_WIN = [6, 5, 4, 3, 2];
const FAN_LOSS = [1, 2, 3, 4, 6];

function fansResult(s: GameState, won: boolean, home: boolean): void {
  // the honeymoon ends with season 2: from then on the fans are never fully
  // apathetic — a loss always costs at least a little
  const exp = clamp(Math.max(s.season >= 3 ? 1 : 0, s.expectation ?? 1), 0, 4);
  let d = won ? FAN_WIN[exp] : -FAN_LOSS[exp];
  // THE BOWL: a full level-3 stadium takes the edge off a home loss
  if (!won && home && facLevel(s, 'stadium') >= 3) d = Math.min(0, d + 1);
  s.opFans = clamp((s.opFans ?? 60) + d, 0, 100);
}

/** An AI roster living a game night the way mine does: floor players spend
    by row (a full game runs starters near empty), streaks stack, and the
    role-weighted mood verdict lands the same way. */
function aiPostGame(t: Team, won: boolean): void {
  const st = new Set(starters(t).map((p) => p.id));
  const bn = new Set(benchPlayers(t).map((p) => p.id));
  for (const p of t.players) {
    if (p.outWeeks > 0) continue;
    const floor = st.has(p.id) || bn.has(p.id);
    if (st.has(p.id)) {
      p.energy = clamp(p.energy - (30 + rand(29)), 0, 100);
      p.mood = clamp(p.mood + (won ? 8 : -3), 0, 100);
      p.startStreak = (p.startStreak ?? 0) + 1;
      p.dnp = 0;
    } else if (bn.has(p.id)) {
      p.energy = clamp(p.energy - (16 + rand(15)), 0, 100);
      p.mood = clamp(p.mood + (won ? 5 : -5), 0, 100);
      p.startStreak = 0;
      p.dnp = 0;
    } else {
      p.mood = clamp(p.mood + (won ? 2 : -8), 0, 100);
      p.startStreak = 0;
      p.dnp++; // their benches breathe on the same Mondays mine do
    }
    // the other gyms have hot nights too: the STANDOUT drip lands league-wide
    if (floor && roll(10)) bumpAny(p, 1);
    if (p.level < LEVEL_CAP && Math.random() < 0.18) { p.level++; bumpAny(p, 2); }
  }
}

/** The week's games: mine runs whole — lineup, one speech, the horn — and the
    rest of the league plays out around it. */
/** Tip-off: MY game sims, and the night's interruptions are rolled (ON FIRE
    / an injury — one per player, two per night at most) and held for the
    live game's halfway point. Nothing is FINAL until they're answered. */
function simWeek(s: GameState): void {
  const me = myTeam(s);
  normalizeLineup(me);
  lastLevelUps = [];
  for (const t of s.teams) if (t.id !== s.myTeamId) autoLineup(t);
  const champ = isUtWeek(s) && s.ut ? utOpponent(s) : null;
  const m = champ ? null : myMatchup(s);
  if (!champ && !m) return;
  const out = simMyGame(s, me, m ? m.opponent : null, champ, m ? m.home : true);
  s.lastResult = out.result;
  s.gamePending = true;
  s.gameShift = 0;
  s.gameInjuries = [];
  const held = s.queue.length;
  if (s.tutorial !== undefined) {
    // SEASON ZERO deals its own night: the upset lands, the freshman
    // catches fire, nobody gets hurt
    tutorialRigGame(s, out.result);
    tutQueue(s, tutorialArrive(s, 'midgame'));
  } else {
    rollMidEvents(s, me, out.result);
  }
  s.midStories = s.queue.splice(held);
  if (!s.midStories.length) finalizeGame(s);
  save(s);
}

const FIRE_ON = 25;

/** The interruptions: a floor player with 25+ points can catch FIRE; a
    starter can go down (an empty tank makes it likely). One per player,
    two per night. */
function rollMidEvents(s: GameState, me: Team, r: MyGameResult): void {
  type Ev = { p: Player; kind: 'fire' | 'injury'; data: Record<string, unknown> };
  const evs: Ev[] = [];
  const st = new Set(starters(me).map((p) => p.id));
  for (const p of me.players) {
    if (p.outWeeks > 0) continue;
    const row = r.box.find((x) => x.playerId === p.id);
    if (!row) continue;
    const mine: Ev[] = [];
    if (row.pts >= FIRE_ON && !p.onFire) mine.push({ p, kind: 'fire', data: { pts: row.pts } });
    if (st.has(p.id)) {
      const midGame = p.energy - (15 + rand(15));
      const lowEnergy = midGame <= 30;
      // ON FIRE burns the body: a touch riskier from night one, and the
      // risk climbs with every WEEK the streak has lived
      let pct = lowEnergy ? 25 : 4;
      if (p.onFire) pct = Math.min(45, pct + 4 + 4 * (p.fireWeeks ?? 0));
      if (roll(pct)) {
        const inj = rollInjury(lowEnergy ? 1 : 0, fragility(p.speciesId));
        mine.push({ p, kind: 'injury', data: {
          weeks: inj.weeks, label: inj.label, levelLoss: inj.levelLoss,
          cause: lowEnergy
            ? `${p.name} goes down mid-game, untouched. He had nothing left — you played him on an empty tank and everyone in the building knows it.`
            : `${p.name} lands wrong on a routine drive. The arena goes quiet.`,
        } });
      }
    }
    if (mine.length) evs.push(mine.length > 1 ? mine[rand(mine.length)] : mine[0]);
  }
  for (const ev of evs.sort(() => Math.random() - 0.5).slice(0, 2)) {
    queueStory(s, ev.kind === 'fire' ? 'fire_live' : 'injury_live', 'start', ev.p.id, ev.data);
  }
}

/** THE HORN: the mid-game choices land (the score shifts, the injuries
    apply), then the league plays out around it and the night's effects
    hit the roster. Everything this spawns waits for YOU WON / YOU LOST. */
export function finalizeGame(s: GameState): void {
  const me = myTeam(s);
  const r = s.lastResult;
  if (!r || !s.gamePending) return;
  s.gamePending = false;
  const held = s.queue.length;
  // the night's shift: what letting them cook (or pulling the hurt one) did
  const shift = s.gameShift ?? 0;
  if (shift) {
    r.myScore = Math.max(0, r.myScore + shift);
    if (r.myScore === r.oppScore) r.myScore += shift > 0 ? 1 : -1;
    const top = r.box[0];
    if (top) top.pts = Math.max(0, top.pts + shift);
    const wonNow = r.myScore > r.oppScore;
    if (wonNow !== r.win) {
      r.win = wonNow;
      const lines = verdictLines(me, r.planMine, wonNow, r.share, Math.abs(r.myScore - r.oppScore), r.box, r.forms);
      r.wheelLine = lines.wheelLine;
      r.heroLine = lines.heroLine;
    }
  }
  s.gameShift = 0;
  const won = r.win;

  if (isUtWeek(s) && s.ut) {
    const champ = utOpponent(s);
    applyGameEffects(s, won);
    s.myResults = [...(s.myResults ?? []), { week: s.week, win: won, text: `${won ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${champ?.name ?? r.oppName}` }];
    s.ut.log.push(`${weekShort(s)}: ${won ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${champ?.name ?? r.oppName}`);
    // tournament nights: a win thrills the fans; a loss on the big stage
    // barely stings — you made the dance
    s.opFans = clamp((s.opFans ?? 60) + (won ? 5 : -2), 0, 100);
  } else {
    const m = myMatchup(s);
    const games = s.schedule[s.week - 1] ?? [];
    for (const [h, a] of games) {
      if (h === s.myTeamId || a === s.myTeamId) {
        if (!m) continue;
        const winner = won ? me : m.opponent;
        const loser = won ? m.opponent : me;
        winner.wins++; loser.losses++;
        winner.pointsFor += Math.max(r.myScore, r.oppScore);
        winner.pointsAgainst += Math.min(r.myScore, r.oppScore);
        loser.pointsFor += Math.min(r.myScore, r.oppScore);
        loser.pointsAgainst += Math.max(r.myScore, r.oppScore);
        if (won) s.totalWins++;
        fansResult(s, won, r.home); // THE SUCCESS CYCLE decides how hard it lands
        s.myResults = [...(s.myResults ?? []), { week: s.week, win: won, text: `${won ? 'W' : 'L'} ${r.myScore}–${r.oppScore} ${r.home ? 'vs' : '@'} ${m.opponent.name}` }];
        applyGameEffects(s, won);
        // the other locker room lives the same night we do — box score included
        aiPostGame(m.opponent, !won);
        creditAiBox(m.opponent, r.oppScore);
      } else {
        const g = simAiGame(s.teams[h], s.teams[a]);
        g.winner.wins++; g.loser.losses++;
        g.winner.pointsFor += g.scoreW; g.winner.pointsAgainst += g.scoreL;
        g.loser.pointsFor += g.scoreL; g.loser.pointsAgainst += g.scoreW;
        s.resultsLog.push(`${g.winner.name} ${g.scoreW} — ${g.scoreL} ${g.loser.name}`);
        s.resultsWeek = [...(s.resultsWeek ?? []), { h, a, hs: g.winner.id === h ? g.scoreW : g.scoreL, as: g.winner.id === a ? g.scoreW : g.scoreL }];
        // AI squads drift forward — and feel their results like we do:
        // floor players spend, reserves recover, moods swing, LINES land
        aiPostGame(g.winner, true);
        aiPostGame(g.loser, false);
        creditAiBox(g.winner, g.scoreW);
        creditAiBox(g.loser, g.scoreL);
      }
    }
  }
  s.easyNight = false;
  // the tutorial's post-horn beats (the notebook lesson, the bookie's cryo
  // unit) queue here so they hold with everything else
  if (s.tutorial !== undefined) tutQueue(s, tutorialHeld(s));
  // NEVER mid-game: the frozen one's verdict, the fire going out — all of it
  // holds until YOU WON / YOU LOST has been seen
  if (s.queue.length > held) s.heldStories = [...(s.heldStories ?? []), ...s.queue.splice(held)];
  save(s);
}

/** THE FORM ROLL colors the verdict: a STANDOUT rides a win higher and
    shrugs a loss off; an OFF DAY barely enjoys the win and eats the loss. */
function formMood(base: number, form: 1 | -1 | undefined, won: boolean): number {
  if (form === 1) return won ? base + 4 : Math.round(base / 2);
  if (form === -1) return won ? Math.round(base / 2) : base - 5;
  return base;
}

/** The whole night lands here ONCE, after the horn — the full-game energy
    burn, injuries, and ON FIRE on full-game totals. A full game runs a
    starter close to EMPTY; the big recovery bump waits for WEEK START, and
    it shrinks with every consecutive start. XP is banked here and paid out
    at WEEK START too. The mood verdict is role-weighted: a win lifts the
    ones who fought for it, a loss stings hardest in street clothes. */
function applyGameEffects(s: GameState, won: boolean): void {
  const me = myTeam(s);
  const st = new Set(starters(me).map((p) => p.id));
  const bn = new Set(benchPlayers(me).map((p) => p.id));
  const played = new Set((s.lastResult?.box ?? []).map((r) => r.playerId));
  const injuredTonight = new Set((s.lastResult?.box ?? []).filter((r) => me.players.find((p) => p.id === r.playerId && p.outWeeks > 0)).map((r) => r.playerId));
  const burn = s.easyNight ? 0.6 : 1; // TAKE IT EASY: the floor coasts
  s.postGame = [];
  for (const p of me.players) {
    if (p.outWeeks > 0 && !injuredTonight.has(p.id)) continue;
    const pre = { e: p.energy, m: p.mood };
    let xpGain = 0;
    if (st.has(p.id)) {
      // a full game burns 30–58⚡ (the injury roll happened courtside)
      p.energy = clamp(p.energy - Math.round((30 + rand(29)) * burn), 0, 100);
      p.mood = clamp(p.mood + formMood(won ? 8 : -3, s.lastResult?.forms?.[p.id], won) - (s.easyNight && !won ? 6 : 0), 0, 100);
      xpGain = 14 + rand(7);
      p.dnp = 0;
      p.startStreak = (p.startStreak ?? 0) + 1;
    } else if (bn.has(p.id) || played.has(p.id)) {
      p.energy = clamp(p.energy - Math.round((16 + rand(15)) * burn), 0, 100);
      p.mood = clamp(p.mood + formMood(won ? 5 : -5, s.lastResult?.forms?.[p.id], won) - (s.easyNight && !won ? 4 : 0), 0, 100);
      xpGain = 8 + rand(5);
      p.dnp = 0;
      p.gripe = 0;
      p.startStreak = 0;
    } else {
      // street clothes: a win barely reaches them, a loss festers — and the
      // freeze itself becomes THE FROZEN ONE at the next PLAY, once his
      // patience runs out (he knocks at the door, not on a Monday)
      p.dnp++;
      p.startStreak = 0;
      p.mood = clamp(p.mood + (won ? 2 : -8) - (p.dnp >= 3 ? 6 : 3), 0, 100);
    }
    if (st.has(p.id)) p.gripe = 0;
    s.postGame.push({ playerId: p.id, energyP: p.energy - pre.e, mood: p.mood - pre.m, xpGain });
  }

  // THE PROMISE: you told the frozen one he'd play tonight. Did he?
  const promise = s.promise;
  s.promise = null;
  if (promise) {
    const kid = me.players.find((p) => p.id === promise.playerId);
    if (kid) {
      const onFloor = st.has(kid.id) || bn.has(kid.id) || played.has(kid.id);
      if (!onFloor) {
        // double mad: the word was given, and the seat was the same seat
        queueStory(s, 'frozen', 'broken', kid.id);
      } else {
        queueStory(s, 'frozen', 'kept', kid.id);
        // the one HE displaced can hold it against you
        const displaced = me.players.filter((p) => promise.floor.includes(p.id) && !st.has(p.id) && !bn.has(p.id) && p.outWeeks === 0);
        const grump = displaced.length ? pick(displaced) : roll(35) ? pick(me.players.filter((p) => p.id !== kid.id && p.outWeeks === 0)) : null;
        if (grump && roll(displaced.length ? 60 : 35)) queueStory(s, 'frozen', 'unfair', grump.id, { who: kid.name });
      }
    }
  }

  // injuries decided at courtside land NOW — but nobody moves: the hurt
  // keep their slot through the box score, and sink to the reserves only
  // when the new week's roster report is drawn up (startWeek normalizes)
  for (const inj of s.gameInjuries ?? []) {
    const p = me.players.find((x) => x.id === inj.playerId);
    if (!p) continue;
    p.outWeeks = Math.min(8, inj.weeks);
    p.outReason = inj.label;
    p.outKind = 'injury';
    if (inj.levelLoss) p.level = Math.max(0, p.level - 1);
  }
  s.gameInjuries = [];

  // ON FIRE lights at COURTSIDE now (the coach lets him cook, or doesn't);
  // here it only cools: under 12 points, a night without minutes, or hurt.
  const FIRE_KEEP = 12;
  const box = s.lastResult?.box ?? [];
  for (const p of me.players) {
    const row = box.find((r) => r.playerId === p.id);
    const d = s.postGame.find((x) => x.playerId === p.id);
    if (p.onFire && (!row || row.pts < FIRE_KEEP || p.outWeeks > 0)) {
      p.onFire = false;
      p.fireWeeks = 0;
      if (d) d.fire = 'out';
    }
  }
}

// ---- week/season advance -----------------------------------------------------------------

export function continueFromResult(s: GameState): void {
  if (s.end) return;
  if (s.tutorial !== undefined) {
    // SEASON ZERO has no next Monday: the wrap-up chain takes the floor —
    // the road home, the gifts, the goodbye, then season-1 tryouts
    s.preGame = null;
    s.phase = 'departures';
    tutQueue(s, tutorialWrap(s));
    save(s);
    return;
  }
  s.preGame = null;
  if (isUtWeek(s) && s.ut) {
    const wonRound = s.lastResult?.win ?? false;
    const champ = utOpponent(s);
    const score = s.lastResult ? `${s.lastResult.myScore}–${s.lastResult.oppScore}` : '';
    if (!wonRound) {
      queueStory(s, 'bigbang_out', 'start', null, { round: s.ut.round, opp: champ?.name ?? 'the champions', score });
      endSeason(s, null);
      return;
    }
    if (s.ut.round >= 2) {
      // CHAMPIONS OF THE UNIVERSE
      s.utTitles++;
      s.trophies++;
      s.legacy += 10;
      // the field starts hunting you
      s.fieldShift = Math.min(FIELD_MAX, (s.fieldShift ?? 0) + FIELD_HUNT);
      s.careerLog.push(`Season ${s.season}: WON ${TOURNEY.name}.`);
      queueStory(s, 'bigbang_champs', 'start', null, { opp: champ?.name ?? 'the last champion', score, fete: true });
      const legendaries = ITEMS.filter((i) => i.rarity === 'legendary');
      giveItem(s, pick(legendaries).id);
      endSeason(s, 'You cut the net in zero gravity. The confetti simply never lands.');
      return;
    }
    s.ut.round++;
    // the bracket climbs THE SLIDE: a semifinal-tier champion, then the final's
    s.ut.myNextOpp = s.ut.round === 1 ? 4 + rand(2) : 6;
    s.week++;
    startWeek(s);
    return;
  }
  if (s.week >= REGULAR_WEEKS) {
    // the TOP TWO board the shuttle to THE BIG BANG — the crown still belongs
    // to first place alone
    const table = sortedStandings(s);
    const place = table.findIndex((x) => x.id === s.myTeamId) + 1;
    const me = myTeam(s);
    const rec = `${me.wins}–${me.losses}`;
    if (place <= 2) {
      if (place === 1) {
        s.legacy += 3;
        s.trophies++;
        s.careerLog.push(`Season ${s.season}: won the conference (${rec}).`);
      } else {
        s.legacy += 1;
        s.careerLog.push(`Season ${s.season}: runner-up (${rec}) — took the second shuttle to ${TOURNEY.name}.`);
      }
      // the field sits on the slide (62–72 · 68–78 · 72–82) plus THE RUBBER
      // BAND: it hunts a champion and eases off a program that fell
      s.ut = { round: 0, champs: genChamps(s.fieldShift ?? 0), myNextOpp: rand(4), log: [] };
      queueStory(s, 'bigbang_invite', 'start', null, { place, record: rec, fete: true });
      s.week++;
      startWeek(s);
      return;
    }
    queueStory(s, 'season_over', 'start', null, { place, record: rec });
    endSeason(s, null);
    return;
  }
  s.week++;
  startWeek(s);
}

// ---- offseason ------------------------------------------------------------------------------

function endSeason(s: GameState, utNote: string | null): void {
  const t = myTeam(s);
  // the last game's XP has no Monday to land on: it rides into the summer
  // and pays out to the returnees on the selection grid, on top of growth
  s.carryXp = {};
  for (const row of s.postGame) if (row.xpGain > 0) s.carryXp[row.playerId] = row.xpGain;
  s.postGame = [];
  const table = sortedStandings(s);
  const place = table.findIndex((x) => x.id === s.myTeamId) + 1;
  s.seasonChampion = `${table[0].planet} ${table[0].name}`;
  s.seasonNotes = [];
  if (utNote) s.seasonNotes.push(utNote);
  if (s.ut && !utNote) {
    s.seasonNotes.push(`${TOURNEY.name} run: ${s.ut.log.join(' · ')}.`);
    s.legacy += s.ut.round * 2;
  }
  // THE RUBBER BAND eases: a season without a tournament WIN (missed it, or
  // out in the first round) lets the field relax a notch
  if (!utNote && (!s.ut || s.ut.round === 0)) s.fieldShift = Math.max(FIELD_MIN, (s.fieldShift ?? 0) - FIELD_EASE);
  // the standings line knows whether you actually RODE the shuttle: a
  // runner-up who played the tournament doesn't get scolded about missing it
  const rode = !!utNote || !!s.ut;
  // THE SUCCESS CYCLE resets: what the fans will expect of NEXT season
  s.expectation = utNote ? 4 : rode ? 3 : place <= 3 ? 2 : place <= 4 ? 1 : 0;
  s.seasonNotes.push(
    place === 1
      ? `You finished FIRST (${t.wins}–${t.losses}).`
      : rode
        ? `Regular season: ${place}${['','st','nd','rd'][place] ?? 'th'} (${t.wins}–${t.losses}) — the second shuttle carried you to ${TOURNEY.name}.`
        : `You finished ${place}${['','st','nd','rd'][place] ?? 'th'} (${t.wins}–${t.losses}). Only the top two board the shuttle to ${TOURNEY.name}. The boosters know that too.`
  );
  if (!s.ut && place > 1) s.careerLog.push(`Season ${s.season}: finished ${place}.`);
  s.ut = null;

  // pro departures: elite overalls may declare, any class year
  s.proDeparts = t.players
    .filter((p) => ovr(p.attrs) >= PRO_OVR)
    .map((p) => ({ playerId: p.id, name: p.name, resolved: false, staying: false, note: '' }));

  // THE BOOKS CLOSE: the season's result is its own dialogue
  queueStory(s, 'season_result', 'start', null, {
    season: s.season,
    text: `${s.seasonNotes.join('\n\n')}${s.proDeparts.length ? `\n\nPro scouts are in the dorm lobby for ${s.proDeparts.map((d) => d.name).join(' and ')}.` : ''}`,
  });

  // THE LEADERS' season titles: one crown per stat, conference-wide
  const LB = statLeaders(s);
  const TITLE_NAMES: ['pts' | 'reb' | 'stl' | 'ast', string][] = [
    ['pts', 'THE SCORING CHAMP'], ['reb', 'THE BOARD KING'], ['stl', 'THE LOCKPICK'], ['ast', 'THE MAESTRO'],
  ];
  for (const [k, title] of TITLE_NAMES) {
    const top = LB[k][0];
    if (!top || top.v <= 0 || top.gp < 5) continue;
    const line = `${top.v} ${STAT_WORD[k]}`;
    s.seasonNotes.push(`${title}: ${top.name} (${s.teams[top.teamId].name}, ${line}).`);
    if (top.teamId === s.myTeamId) queueStory(s, 'stat_title', 'start', top.playerId, { title, line });
  }
  // seniors graduate now (into the alumni pool) — each one gets the stage
  const seniors = t.players.filter((p) => p.classYear >= 3 && !s.proDeparts.some((d) => d.playerId === p.id));
  for (const p of seniors) {
    const alum = toAlum(p, 'grad', s.season);
    s.alumni.push(alum);
    s.seasonNotes.push(`${p.name} graduates with ${alum.career.pts} career points.`);
    queueStory(s, 'graduation', 'start', null, {
      name: p.name, pts: alum.career.pts, gp: alum.career.gp, alumForm: p.form,
      player: { ...p, stats: { ...p.stats }, career: { ...p.career }, attrs: { ...p.attrs }, pots: { ...p.pots }, startAttrs: { ...p.startAttrs } },
    });
  }
  t.players = t.players.filter((p) => p.classYear < 3 || s.proDeparts.some((d) => d.playerId === p.id));

  // alumni encounters find you in the offseason sometimes
  if (s.alumni.length && roll(10)) {
    const alum = pick(s.alumni);
    queueStory(s, alum.exit === 'void' ? 'alum_void' : roll(50) ? 'alum_gold' : 'alum_dark', 'start', null, {
      alumName: alum.name, exit: alum.exit, season: alum.season,
    });
  }

  // AI teams roll over — and THE SLIDE reshuffles: which program is the
  // conference's best changes every summer, the ladder itself never does
  const tiers = [...CONF_TIERS].sort(() => Math.random() - 0.5);
  let ti = 0;
  for (const team of s.teams) {
    if (team.id === s.myTeamId) continue;
    // half the rubber band reaches the conference: a champion's league
    // gets a little hungrier, a fallen program's a little kinder
    const target = tiers[ti++] - 2 + rand(5) + Math.round((s.fieldShift ?? 0) / 2);
    team.players = team.players.filter((p) => p.classYear < 3 && ovr(p.attrs) < PRO_OVR);
    for (const p of team.players) {
      // the season's lines fold into their careers, league-wide
      addStats(p.career, p.stats);
      p.stats = zeroStats();
      p.classYear++;
      bumpAny(p, 3 + rand(3));
      p.energy = METER_BASELINE - 3 + rand(9);
      p.mood = clamp(p.mood + 15, 60, 85);
      p.outWeeks = 0; p.outReason = '';
    }
    const counter = { nextId: s.nextId };
    const names = takenNames(s);
    // the other programs refill with transfer bodies built to their tier
    while (team.players.length < ROSTER_SIZE) {
      team.players.push(genPlayerAt(counter, target - 6 + rand(13), rand(4), undefined, names));
    }
    s.nextId = counter.nextId;
    ensureUniqueJerseys(team.players);
    settleTier(team, target);
  }

  // the summer cools every opinion toward neutral — grudges fade, so does glory
  const summerDrift = (v: number | undefined): number => { const x = v ?? 60; return x + clamp(60 - x, -8, 8); };
  s.opSchool = summerDrift(s.opSchool);
  s.opFans = summerDrift(s.opFans);
  s.opPublic = summerDrift(s.opPublic);
  // …but the board reads the standings too: a cellar finish costs the
  // school's patience even in a season nobody expected anything of
  if (place >= 5) s.opSchool = clamp((s.opSchool ?? 60) - (place === 6 ? 8 : 4), 0, 100);
  s.lastDemand = undefined;
  s.legendariesUsed = [];
  s.signingResults = [];
  s.commits = [];
  s.phase = 'departures';
  save(s);
}

/** The convince roll — returned so THE ROLL WHEEL can play it out live. */
export function convincePro(s: GameState, playerId: number): { staying: boolean; chance: number } | null {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!d || !p) return null;
  d.resolved = true;
  const chance = clamp(15 + (p.mood - 40), 10, 80);
  const staying = Math.random() * 100 < chance;
  if (staying) {
    d.staying = true;
    d.note = `You talk about legacy, unfinished business, banners. ${p.name} STAYS. (${chance}% — and you hit it.)`;
  } else {
    d.staying = false;
    d.note = genderize(`${p.name} listens politely, then shows you the contract already on his holo. Gone. (${chance}% — missed.)`, p.form);
    departPro(s, p);
  }
  save(s);
  return { staying, chance };
}

export function letGoPro(s: GameState, playerId: number): void {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!d || !p) return;
  d.resolved = true;
  d.staying = false;
  d.note = genderize(`You shake his hand and tell him to make the galaxy proud. Draft night will have your program's name in it.`, p.form);
  departPro(s, p);
  save(s);
}

function departPro(s: GameState, p: Player): void {
  s.alumni.push(toAlum(p, 'pro', s.season));
  s.legacy += 2;
  myTeam(s).players = myTeam(s).players.filter((x) => x.id !== p.id);
}

/** The RETIRE button asks first — the dean, in the empty gym. */
export function retire(s: GameState): void {
  if (s.queue.some((e) => e.defId === 'retire_ask')) return;
  queueStory(s, 'retire_ask', 'start', null, { seasons: s.season });
  save(s);
}

function endCareer(s: GameState, cause: 'RETIRED' | 'FIRED' | 'LOST TO THE VOID'): void {
  const texts = {
    RETIRED: 'You walk out of the gym while the nets are still warm, and the galaxy applauds you home.',
    FIRED: 'Security is polite about the box of your things. The box is small. The years were not.',
    'LOST TO THE VOID': 'The distress beacon blinks a while longer, then stops. The galaxy forgets. Somewhere, a whistle floats.',
  };
  s.end = { cause, text: texts[cause] };
  s.phase = 'gameover';
  s.queue = [];
  save(s);
}

export function toSigning(s: GameState): void {
  if (s.proDeparts.some((d) => !d.resolved) || s.queue.length) return;
  s.phase = 'signing';
  maybeTip(s, 'signing');
  save(s);
}

export function toggleProspect(s: GameState, id: number): void {
  const pr = s.prospects.find((x) => x.id === id);
  if (pr && !pr.signed) pr.selected = !pr.selected;
  save(s);
}

/** The letter ladder — SIGNED names are outside it: their ink is dry. */
export function effectiveChances(s: GameState): { prospect: Prospect; pct: number }[] {
  return s.prospects
    .filter((p) => p.selected && !p.signed)
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((prospect, i) => ({ prospect, pct: Math.max(0, prospect.commitPct - (SIGNING_PENALTIES[i] ?? 95)) }));
}

export function resolveSigning(s: GameState): void {
  // the blank-check names first: no wheel, no ladder — the ink was dry weeks ago
  for (const prospect of s.prospects.filter((p) => p.signed)) {
    s.commits.push(prospectToPlayer(prospect));
    s.signingResults.push(`✓ ${prospect.name} signed weeks ago`);
    queueStory(s, 'signing_verdict', 'start', null, {
      prospectId: prospect.id, name: prospect.name, commit: true, pct: 100, alumForm: prospect.form,
    });
  }
  // then one holo-call per letter: the wheel decides, the card shows the
  // whole truth for the first time — signed or not
  for (const { prospect, pct } of effectiveChances(s)) {
    const commit = Math.random() * 100 < pct;
    if (commit) {
      s.commits.push(prospectToPlayer(prospect));
      s.signingResults.push(`✓ ${prospect.name} commits`);
    } else {
      s.signingResults.push(`✗ ${prospect.name} signs elsewhere`);
    }
    queueStory(s, 'signing_verdict', 'start', null, {
      prospectId: prospect.id, name: prospect.name, commit, pct, wheel: true, alumForm: prospect.form,
    });
  }
  if (!s.signingResults.length) {
    s.signingResults.push('You pursued nobody.');
    queueStory(s, 'notice', 'start', null, { tag: 'SIGNING DAY', text: 'You pursued nobody. The recruiting trail is quiet. Too quiet.' });
  }

  // THE SUMMER: the returners develop BEFORE you pick — and it shows ON the
  // selection grid (old OVR blinking into the new one), not in a list dialog
  const t = myTeam(s);
  s.summerRecap = [];
  for (const p of t.players) {
    const ovrFrom = ovr(p.attrs);
    p.classYear = Math.min(3, p.classYear + 1);
    bumpAny(p, 1 + rand(3));
    let leaned = false;
    if (roll(25)) {
      // his body keeps leaning into what his species is (balanced species
      // lean into whatever HE already is)
      const sp = speciesById(p.speciesId);
      const a = sp.bias.length ? pick(sp.bias) : bestAttr(p.pots);
      const before = p.attrs[a];
      p.attrs[a] = Math.min(p.pots[a], p.attrs[a] + 2);
      leaned = p.attrs[a] > before;
    }
    p.energy = METER_BASELINE - 3 + rand(9);
    p.mood = clamp(p.mood + 15, 60, 85);
    p.outWeeks = 0; p.outReason = ''; p.dnp = 0; p.startStreak = 0;
    checkPosChange(p); // a summer's growth can rewrite the label quietly
    // the last game's XP lands now, with the summer — the extra boost
    const carried = s.carryXp?.[p.id] ?? 0;
    if (carried > 0) lastLevelUps.push(...addXp(s, p, carried));
    const notes = [leaned ? 'LEANED IN' : '', carried > 0 ? `+${carried} XP` : ''].filter(Boolean);
    s.summerRecap.push({ playerId: p.id, ovrFrom, note: notes.length ? notes.join(' · ') : undefined });
  }
  s.carryXp = {};

  // the pool, in reading order: returners first, then the new recruits,
  // then walk-ons filling the empty seats
  const pool: Player[] = [...t.players, ...s.commits];
  const counter = { nextId: s.nextId };
  const names = takenNames(s);
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter, names));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.phase = 'teamSelect';
  maybeTip(s, 'tryouts');
  save(s);
}

/** The cut, from the selection grid: slots[0..8] (in lineup order) stay, the
    rest are gone forever. Cutting somebody real plants a revenge seed. */
export function finalizeRoster(s: GameState, chosenIds: number[]): boolean {
  if (chosenIds.length !== ROSTER_SIZE) return false;
  const byId = new Map(s.selectPool.map((p) => [p.id, p]));
  const chosen = chosenIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  if (chosen.length !== ROSTER_SIZE) return false;
  const t = myTeam(s);
  const cut = s.selectPool.filter((p) => !chosenIds.includes(p.id));
  t.players = chosen;
  ensureUniqueJerseys(t.players);
  // the grid you arranged IS the opening lineup
  t.lineup.slots = chosen.map((p) => p.id);

  // the ones you let go remember it
  for (const p of cut) {
    if (ovr(p.attrs) >= 45 && roll(25)) {
      s.futureBeats.push({ weeksLeft: 2 + rand(5), defId: 'cut_revenge', beat: 'start', playerId: null, data: { cutName: p.name, cutForm: p.form } });
      break; // one grudge per summer is plenty
    }
  }

  startNewSeason(s);
  return true;
}

export function startNewSeason(s: GameState): void {
  s.season++;
  s.week = 1;
  // last season's box scores fold into careers; the GROWTH lens re-baselines
  for (const p of myTeam(s).players) {
    addStats(p.career, p.stats);
    p.stats = zeroStats();
    p.startAttrs = copyAttrs(p.attrs);
    p.onFire = false; // summer puts every fire out
    p.fireWeeks = 0;
  }
  for (const t of s.teams) { t.wins = 0; t.losses = 0; t.pointsFor = 0; t.pointsAgainst = 0; }
  s.schedule = genSchedule(s.teams.length);
  s.commits = [];
  s.selectPool = [];
  s.signingResults = [];
  s.summerRecap = [];
  s.myResults = [];
  s.seasonChampion = null;
  s.groundedWeeks = 0;
  s.proDeparts = [];
  s.ut = null;
  normalizeLineup(myTeam(s)); // keeps the arrangement from the selection grid
  // a FULL board of nine total strangers — the season's recruiting raw
  // material, rolled on the opening distribution: heavily terran, a slim
  // chance per slot of a specialist, and a 1-in-1000 nimbus just sitting there
  s.prospects = [];
  s.pendingRecruits = [];
  const counter = { nextId: s.nextId };
  const names = takenNames(s);
  for (let i = 0; i < MAX_PROSPECTS; i++) {
    const pr = genProspect(counter, s.season, 'opening', names);
    // word travels over the summer: one thing is known about every name
    discoveryReveal(pr);
    s.prospects.push(pr);
  }
  s.nextId = counter.nextId;
  startWeek(s);
}

// ---- new game -------------------------------------------------------------------------------

/** Nudge a roster until its six floor players average the tier (±2):
    up by dragging attributes (and ceilings) along, down by shaving them. */
function settleTier(team: Team, target: number): void {
  autoLineup(team);
  for (let guard = 0; guard < 400; guard++) {
    const avg = floorAvg(team);
    if (Math.abs(avg - target) <= 2) break;
    const floor = team.lineup.slots.slice(0, 6).map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
    if (!floor.length) break;
    const p = pick(floor);
    if (avg < target) {
      const room = ATTRS.filter((a) => p.attrs[a] < 25);
      if (!room.length) continue;
      const a = pick(room);
      p.attrs[a]++;
      if (p.pots[a] < p.attrs[a]) p.pots[a] = p.attrs[a];
    } else {
      const room = ATTRS.filter((a) => p.attrs[a] > 0);
      if (!room.length) continue;
      p.attrs[pick(room)]--;
    }
    if (guard % 8 === 7) autoLineup(team);
  }
  for (const p of team.players) p.startAttrs = copyAttrs(p.attrs);
  autoLineup(team);
}

export function chooseTeam(s: GameState, teamId: number): void {
  s.myTeamId = teamId;
  s.season = 0;
  const t = myTeam(s);
  const counter = { nextId: s.nextId };
  // THE SLIDE, built around your pick: the five other programs take the
  // conference tiers (shuffled — the best changes every year), your founding
  // six sit around the founder tier: 4th–5th, with everything to build
  const names = new Set<string>();
  const tiers = [...CONF_TIERS].sort(() => Math.random() - 0.5);
  let ti = 0;
  for (const team of s.teams) {
    if (team.id === teamId) continue;
    const target = tiers[ti++] - 2 + rand(5);
    team.players = genRosterAt(counter, target, names);
    settleTier(team, target);
  }
  t.players = [];
  for (let i = 0; i < 6; i++) {
    t.players.push(genPlayerAt(counter, FOUNDER_TIER - 8 + rand(17), rand(3), undefined, names, 12 + rand(24)));
  }
  ensureUniqueJerseys(t.players);
  const pool: Player[] = [...t.players];
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter, names));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.signingResults = [];
  s.phase = 'teamSelect';
  maybeTip(s, 'tryouts');
  save(s);
}

export { reserves, starters, benchPlayers };
