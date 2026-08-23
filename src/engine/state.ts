// The orchestrator: the weekly loop, the story engine, THE BAG, the hot seat,
// the energy cache, seasons, the Universal Tournament, and every ending.

import {
  ITEMS,
  TIPS,
  VOYAGE_POOL,
  drillById,
  fragility,
  galaxyActById,
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
  genProspect,
  genSchedule,
  genSpecial,
  genWalkOn,
  newGameState,
  observe,
  prospectToPlayer,
  stipendFor,
  xpNeed,
} from './gen';
import {
  autoLineup,
  benchPlayers,
  normalizeLineup,
  reserves,
  simAiGame,
  simMyGameH1,
  simMyGameH2,
  starters,
  teamPower,
} from './sim';
import type {
  Alumnus,
  ChampTeam,
  Fx,
  GameState,
  PlanId,
  Player,
  Prospect,
  SpeechFx,
  StoryEvent,
  Team,
} from './types';
import { ATTRS, addStats, bumpAny, bumpAnyPot, clamp, copyAttrs, bestAttr, genderize, ovr, pick, rand, roll, zeroStats } from './util';

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
  if (s.season === 0) return 'TRYOUTS';
  if (s.week <= REGULAR_WEEKS) return `WEEK ${s.week}/${REGULAR_WEEKS}`;
  return ['THE QUARTERFINAL', 'THE SEMIFINAL', 'THE UNIVERSAL FINAL'][s.week - REGULAR_WEEKS - 1] ?? '';
}

export function isUtWeek(s: GameState): boolean {
  return s.week > REGULAR_WEEKS && s.ut !== null;
}

export function sortedStandings(s: GameState): Team[] {
  return [...s.teams].sort(
    (a, b) => b.wins - a.wins || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
  );
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
    if (s.version !== SAVE_VERSION) return null;
    // in-place migration: the always-available basics exist in every save
    for (const d of ['shootaround', 'scrimmage', 'twodays', 'rest', 'bonfire']) {
      if (!s.unlockedDrills.includes(d)) s.unlockedDrills.push(d);
    }
    for (const r of ['reccenter', 'home', 'nebula', 'outerrim']) {
      if (!s.unlockedRegions.includes(r)) s.unlockedRegions.push(r);
    }
    return s;
  } catch {
    return null;
  }
}

export function freshGame(): GameState {
  const s = newGameState();
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
    if (fx.heatS) s.heatS = clamp(s.heatS + fx.heatS, 0, 100 - s.heatB);
    if (fx.heatB) s.heatB = clamp(s.heatB + fx.heatB, 0, 100 - s.heatS);
    if (fx.legacy) s.legacy += fx.legacy;
    if (fx.teamMood) for (const q of t.players) q.mood = clamp(q.mood + teamMoodOf(fx.teamMood), 0, 100);
    if (fx.teamEnergyP) for (const q of t.players) q.energy = clamp(q.energy + fx.teamEnergyP, 0, 100);
    if (fx.giveItem) giveItem(s, fx.giveItem);
    if (fx.loseItemIdx !== undefined) s.bag.splice(fx.loseItemIdx, 1);
    if (fx.unlockDrill && !s.unlockedDrills.includes(fx.unlockDrill)) {
      s.unlockedDrills.push(fx.unlockDrill);
      s.careerLog.push(`Learned ${drillById(fx.unlockDrill).name} (season ${s.season}).`);
    }
    if (fx.unlockRegion && !s.unlockedRegions.includes(fx.unlockRegion)) s.unlockedRegions.push(fx.unlockRegion);
    if (fx.unlockPlan && !s.knownPlans.includes(fx.unlockPlan)) {
      s.knownPlans.push(fx.unlockPlan);
      s.careerLog.push(`Learned ${planById(fx.unlockPlan).name} (season ${s.season}).`);
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
    if (fx.gameover) endCareer(s, fx.gameover === 'void' ? 'LOST TO THE VOID' : 'FIRED');
    if (!p) continue;
    if (fx.takePlayer) {
      s.alumni.push(toAlum(p, 'void', s.season));
      t.players = t.players.filter((x) => x.id !== p.id);
      normalizeLineup(t);
      continue;
    }
    const caps = speciesById(p.speciesId).attrCaps;
    if (fx.attr) {
      for (const a of ATTRS) {
        const d = fx.attr[a];
        if (!d) continue;
        p.attrs[a] = d > 0 ? clamp(p.attrs[a] + d, 0, Math.max(p.attrs[a], p.pots[a])) : clamp(p.attrs[a] + d, 0, caps[a]);
      }
    }
    if (fx.potAttr) {
      for (const a of ATTRS) {
        const d = fx.potAttr[a];
        if (!d) continue;
        p.pots[a] = clamp(p.pots[a] + d, p.attrs[a], caps[a]);
      }
    }
    if (fx.anyAttr) bumpAny(p, fx.anyAttr);
    if (fx.anyPot) bumpAnyPot(p, caps, fx.anyPot);
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
      p.outWeeks = fx.outWeeks;
      p.outReason = fx.outWeeks > 0 ? fx.outReason ?? p.outReason ?? 'unspecified' : '';
      if (fx.outWeeks > 0) p.onFire = false; // nothing burns in a bio-lab tank
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
    s.bag.push(itemId);
    maybeTip(s, 'bag');
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

/** The assistant coach explains each screen exactly once, then trusts you. */
export function maybeTip(s: GameState, key: string): void {
  if (!s.tipsAuto || s.tipsSeen.includes(key) || !TIPS[key]) return;
  s.tipsSeen.push(key);
  queueStory(s, 'notice', 'start', null, { tag: 'ASSISTANT COACH', text: TIPS[key] });
}

/** The ? button: the assistant explains the current screen, on demand. */
export function showTip(s: GameState, key: string): void {
  if (!TIPS[key] || s.queue.some((e) => e.tag === 'ASSISTANT COACH')) return;
  if (!s.tipsSeen.includes(key)) s.tipsSeen.push(key);
  queueStory(s, 'notice', 'start', null, { tag: 'ASSISTANT COACH', text: TIPS[key] });
  save(s);
}

export function toggleTips(s: GameState): void {
  s.tipsAuto = !s.tipsAuto;
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
    : (data.alumForm as 'masc' | 'femme' | undefined)) ?? undefined;
  if (gform === 'femme') {
    ev.text = genderize(ev.text, gform);
    ev.choices?.forEach((c) => { c.label = genderize(c.label, gform); });
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
  const rform = (rpid !== null ? myTeam(s).players.find((p) => p.id === rpid)?.form : (ev.data?.alumForm as 'masc' | 'femme' | undefined)) ?? undefined;
  // story consequences swing harder than item effects (items print exact numbers)
  applyFx(s, res.fx, ev.playerId, !choice?.itemId);
  ev.resolvedText = genderize(res.text, rform);
  for (const f of res.follow ?? []) {
    s.futureBeats.push({ weeksLeft: f.weeks, defId: f.defId ?? ev.defId, beat: f.beat, playerId: f.playerId !== undefined ? f.playerId : ev.playerId, data: f.data });
  }
  if (res.next) queueStory(s, res.next.defId, res.next.beat, res.next.playerId !== undefined ? res.next.playerId : ev.playerId, res.next.data ?? {});
  save(s);
  return { resolved: ev, fx: res.fx ?? [] };
}

/** Dismiss the current (resolved or choice-less) story. */
export function dismissStory(s: GameState): void {
  s.queue.shift();
  if (!s.queue.length && s.phase === 'stories') {
    if (isUtWeek(s)) rollTravel(s);
    s.phase = isUtWeek(s) ? 'matchup' : 'practice';
    maybeTip(s, isUtWeek(s) ? 'matchup' : 'practice');
  }
  if (!s.queue.length && s.phase === 'gamenight' && !s.lastResult && !s.halftime && !s.end) simWeek(s);
  save(s);
}

// ---- week start ---------------------------------------------------------------------

function checkHotSeat(s: GameState): void {
  if (s.heatS < 40) s.interferedS = false;
  if (s.heatB < 40) s.interferedB = false;
  if (s.heatS + s.heatB >= 75 && roll(50)) {
    const side = s.heatS > s.heatB + 10 ? 'school' : s.heatB > s.heatS + 10 ? 'boost' : 'joint';
    queueStory(s, 'summons', 'start', null, { side });
    return;
  }
  if (s.heatS >= 50 && !s.interferedS) {
    s.interferedS = true;
    queueStory(s, 'interfere_school', 'start', null);
  }
  if (s.heatB >= 50 && !s.interferedB) {
    s.interferedB = true;
    queueStory(s, 'interfere_boost', 'start', null);
  }
}

function startWeek(s: GameState): void {
  const t = myTeam(s);
  s.energy = clamp(s.energy + stipendFor(s.season), 0, CACHE_MAX);
  s.trainedThisWeek = false;
  s.galaxyActWk = false;
  s.speechWk = false;
  s.speechH2 = false;
  s.planH2 = null;
  s.speechFx = null;
  s.speechFxH2 = null;
  s.halftime = null;
  s.sitouts = [];
  s.scoutedOpp = false;
  s.drillReport = null;
  s.voyageRolled = false;
  s.pregameFlags = {};
  s.lastResult = null;
  s.postGame = [];
  s.resultsLog = [];
  if (s.groundedWeeks > 0) s.groundedWeeks--;

  for (const team of s.teams) {
    for (const p of team.players) {
      if (p.outWeeks > 0 && --p.outWeeks === 0) {
        if (team.id === s.myTeamId) {
          queueStory(s, 'notice', 'start', p.id, {
            tag: 'CLEARED TO PLAY',
            text: `${p.name} is back from ${p.outReason || 'the long absence'} and cleared to play. The first dunk back is always the loudest.`,
          });
        }
        p.outReason = '';
      }
      // meters drift HOME to the 75 baseline — natural recovery never passes
      // it; the extremes (elated/angry, pumped/sleeping) belong to stories.
      // A starter burns ~−12/week net, so three straight starts land him in
      // the 30s: bench him, rest him, or watch him break.
      p.energy = p.energy < METER_BASELINE
        ? Math.min(METER_BASELINE, p.energy + 14)
        : Math.max(METER_BASELINE, p.energy - 2);
      p.mood = p.mood < METER_BASELINE
        ? Math.min(METER_BASELINE, p.mood + 5)
        : Math.max(METER_BASELINE, p.mood - 3);
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

  for (const pr of s.prospects) {
    pr.commitPct = Math.max(0, pr.commitPct - COMMIT_DECAY);
    if (pr.bannedWeeks > 0) pr.bannedWeeks--;
  }

  // scheduled beats come due
  for (const fb of [...s.futureBeats]) {
    fb.weeksLeft--;
    if (fb.weeksLeft <= 0) {
      s.futureBeats.splice(s.futureBeats.indexOf(fb), 1);
      const stillHere = fb.playerId === null || t.players.some((p) => p.id === fb.playerId);
      if (stillHere) queueStory(s, fb.defId, fb.beat, fb.playerId, fb.data ?? {});
    }
  }

  checkHotSeat(s);

  if (isUtWeek(s)) {
    const champ = utOpponent(s);
    if (champ) {
      queueStory(s, 'notice', 'start', null, {
        tag: 'SCOUTING REPORT',
        text: `${champ.name.toUpperCase()}\n\n"${champ.gimmick}" — that's the word from three systems over. The scout's read: they live in ${planById(champ.plan).name}. ${weekLabel(s)}. Win or go home.`,
      });
      s.scoutedOpp = true;
    }
  } else {
    // 1 weekly story, 25% a second one
    const n = 1 + (roll(25) ? 1 : 0);
    const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      const pool = weeklyPool(s);
      if (!pool.length) break;
      const total = pool.reduce((a, d) => a + (d.weight ?? 1), 0);
      let r = Math.random() * total;
      let def = pool[0];
      for (const d of pool) {
        r -= d.weight ?? 1;
        if (r <= 0) { def = d; break; }
      }
      if (def.kind === 'player') {
        const candidates = t.players.filter((p) => p.outWeeks === 0 && !used.has(p.id));
        if (!candidates.length) continue;
        const p = pick(candidates);
        used.add(p.id);
        queueStory(s, def.id, 'start', p.id, def.id === 'festival' ? {} : {});
      } else {
        queueStory(s, def.id, 'start', null);
      }
    }
  }

  normalizeLineup(t);
  s.phase = 'stories';
  if (!s.queue.length) s.phase = isUtWeek(s) ? 'matchup' : 'practice';
  save(s);
}

// ---- practice: the drill board -----------------------------------------------------------

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
          const n = d.gain[a];
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
        const caps = speciesById(p.speciesId).attrCaps;
        if (bumpAnyPot(p, caps, 1)) {
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
  /** per-prospect stickers for the board */
  perProspect: Map<number, { text: string; up?: boolean }[]>;
}

/** Reveal one unrevealed facet of a prospect. Returns the sticker, or null when
    everything is already known. */
function revealFacet(pr: Prospect): { text: string; up?: boolean } | null {
  const facets: ('skill' | 'pot' | 'digit')[] = [];
  if (!pr.seenSkill) facets.push('skill');
  if (!pr.seenPot) facets.push('pot');
  if (pr.digits < 2) facets.push('digit');
  if (!facets.length) return null;
  const f = pick(facets);
  if (f === 'skill') {
    pr.seenSkill = true;
    return { text: 'THE SHAPE', up: true };
  }
  if (f === 'pot') {
    pr.seenPot = true;
    return { text: 'THE CEILING', up: true };
  }
  pr.digits = (pr.digits + 1) as 0 | 1 | 2;
  return { text: pr.digits >= 2 ? 'THE NUMBER' : 'A DIGIT', up: true };
}

/** Fully reveal a prospect (the combine locks somebody cold). */
function revealAll(pr: Prospect): void {
  pr.seenSkill = true;
  pr.seenPot = true;
  pr.digits = 2;
  pr.scoutLevel = Math.max(pr.scoutLevel, 4);
  observe(pr);
}

/** THE WEEKLY MOVE: one action, always the whole board. Scout sharpens every
    name, recruit works every name, search brings new names to the 4th row. */
export function actionGalaxy(s: GameState, actId: string): GalaxyResult | null {
  const act = galaxyActById(actId);
  if (s.galaxyActWk || s.pendingRecruits.length) return null;
  if (s.energy < act.cost) return null;
  if (act.kind === 'search' && !s.unlockedRegions.includes(act.id)) return null;
  if (act.kind === 'search' && s.groundedWeeks > 0 && !act.local) return null;
  if (act.kind !== 'search' && !s.prospects.length) return null;
  s.energy -= act.cost;
  s.galaxyActWk = true;
  const per = new Map<number, { text: string; up?: boolean }[]>();
  let text: string;
  const r = Math.random() * 100;

  if (act.kind === 'scout') {
    let revealed = 0;
    for (const pr of s.prospects) {
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
      ? `${act.name}: nine reports come back. ${revealed} new piece${revealed === 1 ? '' : 's'} of the truth land on the board.`
      : `${act.name}: the reports come back saying what you already knew. The board is read cold.`;
    if (r < act.down.pct) {
      if (act.down.cls === 'SCANDAL') {
        queueStory(s, 'scandal', 'start', null, { cause: 'Hosting nine amateurs in your gym with travel paid is, the league notes, EXACTLY the thing the rulebook is about.' });
        text += ' The league, meanwhile, counted the shuttle tickets...';
      } else if (act.down.cls === 'SHIP') {
        queueStory(s, 'grounded', 'start', null, { cause: 'Nine gyms in seven systems is a lot of atmosphere re-entries.' });
        text += ' The shuttle, however, felt every mile...';
      } else {
        s.energy = clamp(s.energy - 1, 0, CACHE_MAX);
        text += ' The feed subscriptions auto-renewed. Of course they did. (−1⚡)';
      }
    } else if (r < act.down.pct + act.up.pct && s.prospects.length) {
      const lucky = pick(s.prospects);
      revealAll(lucky);
      per.set(lucky.id, [{ text: 'LOCKED COLD', up: true }]);
      text += ` And ${lucky.name} does the ONE thing that tells you everything. Locked, cold.`;
    }
  } else if (act.kind === 'recruit') {
    let ups = 0;
    let downs = 0;
    for (const pr of s.prospects) {
      if (pr.bannedWeeks > 0) {
        per.set(pr.id, [{ text: 'NO CONTACT', up: false }]);
        continue;
      }
      if (roll(act.risk ?? 0)) {
        const d = act.gain![1];
        pr.commitPct = clamp(pr.commitPct - d, 0, 95);
        per.set(pr.id, [{ text: `−${d}% COMMIT`, up: false }]);
        downs++;
      } else {
        const g = act.gain![0] + rand(act.gain![1] - act.gain![0] + 1);
        pr.commitPct = clamp(pr.commitPct + g, 0, 95);
        per.set(pr.id, [{ text: `+${g}% COMMIT`, up: true }]);
        ups++;
      }
    }
    text = `${act.name}: the whole board hears from you. ${ups} name${ups === 1 ? '' : 's'} lean${ups === 1 ? 's' : ''} in${downs ? `, ${downs} lean${downs === 1 ? 's' : ''} away` : ''}.`;
    if (r < act.down.pct) {
      if (act.down.cls === 'SCANDAL') {
        queueStory(s, 'scandal', 'start', null, { cause: 'The gala photos reach the league office before the dessert course ends. Twelve courses of evidence.' });
        text += ' The flashbulbs, meanwhile...';
      } else {
        queueStory(s, 'drama', 'start', null, { cause: 'Two recruits discover they were promised the same jersey number, loudly, in front of everyone.' });
        text += ' It gets loud at the punch bowl...';
      }
    } else if (r < act.down.pct + act.up.pct) {
      for (const pr of s.prospects) {
        if (pr.bannedWeeks > 0) continue;
        pr.commitPct = clamp(pr.commitPct + 5, 0, 95);
      }
      text += ' And the night goes LEGENDARY — the whole board talks about it for a week. +5% everywhere.';
    }
  } else {
    // search: new talent — a full board means somebody must go
    const counter = { nextId: s.nextId };
    const names = takenNames(s);
    const found: Prospect[] = [genProspect(counter, s.season, act.id, names)];
    if (act.twoChance && roll(act.twoChance)) found.push(genProspect(counter, s.season, act.id, names));
    s.nextId = counter.nextId;
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
      text += ' The board is FULL — take the new name on and somebody gets forgotten forever, or let the new one walk.';
    }
    if (act.id === 'reccenter' && r < act.down.pct) {
      // kids notice where you went looking
      if (s.prospects.length && roll(50)) {
        const gone = pick(s.prospects.filter((p) => !s.pendingRecruits.includes(p)) as Prospect[]);
        s.prospects = s.prospects.filter((p) => p.id !== gone.id);
        text += ` Word gets around that you spent the week at the REC CENTER. ${gone.name} takes it personally and takes ${gone.form === 'femme' ? 'her' : 'his'} name off your board.`;
      } else {
        const t = myTeam(s);
        const p = pick(t.players);
        p.mood = clamp(p.mood - 15, 0, 100);
        text += ` ${p.name} hears where you went looking for ${p.form === 'femme' ? 'her' : 'his'} replacement and takes it personally.`;
      }
    } else if (act.id !== 'reccenter') {
      if (s.energy === 0 && roll(10)) {
        queueStory(s, 'debt', 'start', null, { cause: 'On the way home from the search, a gravity snare — a salvage rig reels your ship in like a fish.' });
        text += ' Then the cells run dry in dead space...';
      } else if (r < act.down.pct) {
        if (roll(50)) queueStory(s, 'hullbreach', 'start', null);
        else queueStory(s, 'grounded', 'start', null, { cause: 'A micrometeorite shreds the starboard scoop on the way home.' });
        text += ' The trip home, however...';
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
  return { text, perProspect: per };
}

/** Swap between the board (0–8) and the 4th row (9–11: the pending names). */
export function swapBoardSlot(s: GameState, from: number, to: number): void {
  const get = (i: number): Prospect | null => (i < 9 ? s.prospects[i] ?? null : s.pendingRecruits[i - 9] ?? null);
  const a = get(from);
  const b = get(to);
  if (!a && !b) return;
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
    // moving into an empty slot: only meaningful across the rows
    if ((from < 9) === (to < 9)) return;
    set(from, null);
    if (to < 9) s.prospects.push(a);
    else s.pendingRecruits.push(a);
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

export function actionDropProspect(s: GameState, prospectId: number): void {
  s.prospects = s.prospects.filter((x) => x.id !== prospectId);
  save(s);
}

// ---- matchup ---------------------------------------------------------------------------

/** THE SPEECH: mandatory, once, a gamble. Small chance the room IGNITES
    (+attr for everyone tonight), smaller chance somebody stops believing.
    Returns the outcome text (the room's verdict), or null if refused. */
function rollSpeech(s: GameState, plan: PlanId): { fx: SpeechFx | null; text: string } {
  const pl = planById(plan);
  const t = myTeam(s);
  const r = Math.random() * 100;
  if (r < pl.down) {
    const pool = t.players.filter((p) => p.outWeeks === 0);
    const p = pool.length ? pick(pool) : null;
    if (p) {
      p.mood = clamp(p.mood - 25, 0, 100);
      return { fx: null, text: genderize(`"${pl.speech}," you say. ${p.name} looks at the floor. He's heard this one before, and tonight he doesn't believe a word of it. MOOD −25.`, p.form) };
    }
    return { fx: null, text: `"${pl.speech}," you say, to a very quiet room.` };
  }
  if (r < pl.down + pl.up) {
    return {
      fx: { attr: pl.attr, amt: pl.boost },
      text: `"${pl.speech}!" — and the room IGNITES. Chairs go over. Somebody headbutts a locker, affectionately. The whole squad plays +${pl.boost} ${pl.attr.toUpperCase()} tonight.`,
    };
  }
  return { fx: null, text: `"${pl.speech}," you say. Nods. A few slapped shoulders. The room heard you. The rest is on them.` };
}

export function deliverSpeech(s: GameState, plan: PlanId): string | null {
  if (s.speechWk || !s.knownPlans.includes(plan)) return null;
  s.plan = plan;
  s.speechWk = true;
  const out = rollSpeech(s, plan);
  s.speechFx = out.fx;
  save(s);
  return out.text;
}

export function scoutOpponent(s: GameState): boolean {
  if (s.scoutedOpp || s.energy < 1) return false;
  s.energy--;
  s.scoutedOpp = true;
  save(s);
  return true;
}

/** Which item contexts the current phase accepts ('mood' is always welcome). */
export function itemAllowedNow(s: GameState, itemId: string): boolean {
  const item = itemById(itemId);
  const phaseCtx: Record<string, string[]> = {
    practice: ['practice'],
    matchup: ['pregame'],
    galaxy: ['recruiting'],
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
  s.bag.splice(idx, 1);
  if (item.rarity === 'legendary') s.legendariesUsed.push(item.id);
  lastLevelUps = [];
  const res = item.use(storyCtx(s, (ctxData.playerId as number | null) ?? null, ctxData));
  const ipid = res.fx?.find((f) => f.playerId !== undefined)?.playerId ?? (ctxData.playerId as number | null) ?? null;
  const iform = ipid !== null ? myTeam(s).players.find((p) => p.id === ipid)?.form : undefined;
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

/** Away weeks open with the bus: a voyage story, a debt snare, or plain void. */
export function rollTravel(s: GameState): void {
  if (s.voyageRolled) return;
  const m = myMatchup(s);
  const away = isUtWeek(s) || (m ? !m.home : false);
  if (!away) return;
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

export function toMatchup(s: GameState): void {
  if (s.phase === 'stories' && s.queue.length) return;
  // recruiting is mandatory: no matchup before the board-wide move lands
  if (s.phase === 'galaxy' && (!s.galaxyActWk || s.pendingRecruits.length)) return;
  normalizeLineup(myTeam(s));
  rollTravel(s);
  s.phase = 'matchup';
  maybeTip(s, 'matchup');
  save(s);
}

export function toPractice(s: GameState): void {
  if (s.queue.length) return;
  s.phase = 'practice';
  save(s);
}

export function toGalaxy(s: GameState): void {
  if (s.queue.length) return;
  if (!s.trainedThisWeek) return; // practice is mandatory — there's a 0⚡ option
  s.phase = 'galaxy';
  maybeTip(s, 'galaxy');
  save(s);
}

/** PLAY (held). Away weeks voyage first; H1 sims when the queue clears. */
export function playGame(s: GameState): void {
  if (!s.speechWk) return; // no tip-off before the speech
  s.phase = 'gamenight';
  s.lastResult = null;
  s.halftime = null;
  if (!s.queue.length && !s.end) simWeek(s);
  save(s);
}

/** An AI roster living a game night the way mine does: floor players spend
    by row, reserves get their night off (back toward the baseline only). */
function aiPostGame(t: Team, won: boolean, halfAlreadySpent: boolean): void {
  const st = new Set(starters(t).map((p) => p.id));
  const bn = new Set(benchPlayers(t).map((p) => p.id));
  for (const p of t.players) {
    if (p.outWeeks > 0) continue;
    if (st.has(p.id)) p.energy = clamp(p.energy - (8 + rand(3)) - (halfAlreadySpent ? 0 : 8 + rand(3)), 0, 100);
    else if (bn.has(p.id)) p.energy = clamp(p.energy - (5 + rand(3)) - (halfAlreadySpent ? 0 : 4 + rand(2)), 0, 100);
    else if (p.energy < METER_BASELINE) p.energy = Math.min(METER_BASELINE, p.energy + 8);
    p.mood = clamp(p.mood + (won ? 4 : -5), 0, 100);
    if (p.level < LEVEL_CAP && Math.random() < 0.15) { p.level++; bumpAny(p, 2); }
  }
}

/** The week's games: everyone else's whole night, but MY game stops at the
    half — s.halftime holds it open until the locker room lets it back out. */
function simWeek(s: GameState): void {
  const me = myTeam(s);
  normalizeLineup(me);
  lastLevelUps = [];

  if (isUtWeek(s) && s.ut) {
    const champ = utOpponent(s);
    if (!champ) return;
    simMyGameH1(s, me, null, champ, true);
    save(s);
    return;
  }

  const m = myMatchup(s);
  for (const t of s.teams) if (t.id !== s.myTeamId) autoLineup(t);
  const games = s.schedule[s.week - 1] ?? [];
  for (const [h, a] of games) {
    if (h === s.myTeamId || a === s.myTeamId) {
      if (!m) continue;
      simMyGameH1(s, me, m.opponent, null, m.home);
    } else {
      const g = simAiGame(s.teams[h], s.teams[a]);
      g.winner.wins++; g.loser.losses++;
      g.winner.pointsFor += g.scoreW; g.winner.pointsAgainst += g.scoreL;
      g.loser.pointsFor += g.scoreL; g.loser.pointsAgainst += g.scoreW;
      s.resultsLog.push(`${g.winner.name} ${g.scoreW} — ${g.scoreL} ${g.loser.name}`);
      // AI squads drift forward — and feel their results like we do:
      // floor players spend, reserves recover, moods swing
      aiPostGame(g.winner, true, false);
      aiPostGame(g.loser, false, false);
    }
  }
  save(s);
}

/** HALFTIME SPEECH: mandatory before the second half — its own fresh roll. */
export function deliverHalftimeSpeech(s: GameState, plan: PlanId): string | null {
  if (!s.halftime || s.speechH2 || !s.knownPlans.includes(plan)) return null;
  s.planH2 = plan;
  s.speechH2 = true;
  const out = rollSpeech(s, plan);
  s.speechFxH2 = out.fx;
  save(s);
  return out.text;
}

/** THE SECOND HALF: sim H2 from the new lineup/speeches/meters, then land the
    whole night — standings, heat, meters, ON FIRE — once, on full-game totals. */
export function playSecondHalf(s: GameState): void {
  if (!s.halftime || !s.speechH2 || s.lastResult) return;
  const me = myTeam(s);
  normalizeLineup(me);
  lastLevelUps = [];
  const drains = s.halftime.drains;

  if (isUtWeek(s) && s.ut) {
    const champ = utOpponent(s);
    if (!champ) return;
    const out = simMyGameH2(s, me, null, champ);
    s.lastResult = out.result;
    s.halftime = null;
    applyGameEffects(s, out.won, drains);
    s.ut.log.push(`${weekLabel(s)}: ${out.won ? 'W' : 'L'} ${out.result.myScore}–${out.result.oppScore} vs ${champ.name}`);
    if (out.won) {
      s.heatB = clamp(s.heatB - 6, 0, 100);
    } else {
      s.heatB = clamp(s.heatB + 4, 0, 100 - s.heatS);
    }
    save(s);
    return;
  }

  const m = myMatchup(s);
  if (!m) return;
  const out = simMyGameH2(s, me, m.opponent, null);
  s.lastResult = out.result;
  s.halftime = null;
  const winner = out.won ? me : m.opponent;
  const loser = out.won ? m.opponent : me;
  winner.wins++; loser.losses++;
  winner.pointsFor += Math.max(out.result.myScore, out.result.oppScore);
  winner.pointsAgainst += Math.min(out.result.myScore, out.result.oppScore);
  loser.pointsFor += Math.min(out.result.myScore, out.result.oppScore);
  loser.pointsAgainst += Math.max(out.result.myScore, out.result.oppScore);
  if (out.won) { s.totalWins++; s.heatB = clamp(s.heatB - 4, 0, 100); }
  else s.heatB = clamp(s.heatB + 4, 0, 100 - s.heatS);
  applyGameEffects(s, out.won, drains);
  // the other locker room lives the same night we do (half already spent)
  aiPostGame(m.opponent, !out.won, true);
  // clean weeks slowly cool the school
  s.heatS = clamp(s.heatS - 1, 0, 100);
  save(s);
}

/** The whole night lands here ONCE, after H2 — the second half of the energy
    drain (the first half went at halftime, `halfDrains` folds it into the
    stickers), full-game XP, injuries, and ON FIRE on full-game totals. */
function applyGameEffects(s: GameState, won: boolean, halfDrains: Record<number, number> = {}): void {
  const me = myTeam(s);
  const st = new Set(starters(me).map((p) => p.id));
  const bn = new Set(benchPlayers(me).map((p) => p.id));
  const played = new Set((s.lastResult?.box ?? []).map((r) => r.playerId));
  s.postGame = [];
  for (const p of me.players) {
    if (p.outWeeks > 0) continue;
    const pre = { e: p.energy, m: p.mood };
    let xpGain = 0;
    if (st.has(p.id)) {
      const lowEnergy = p.energy <= 30;
      p.energy = clamp(p.energy - (8 + rand(3)), 0, 100);
      p.mood = clamp(p.mood + 2, 0, 100);
      xpGain = 8 + rand(5);
      p.dnp = 0;
      if (roll(lowEnergy ? 25 : 2)) {
        const inj = rollInjury(lowEnergy ? 1 : 0, fragility(p.speciesId));
        queueStory(s, 'injury', 'start', p.id, {
          weeks: inj.weeks, label: inj.label, levelLoss: inj.levelLoss,
          cause: lowEnergy
            ? `${p.name} went down mid-game, untouched. He had nothing left — you played him on an empty tank and everyone in the building knew it.`
            : `${p.name} landed wrong on a routine drive. The arena goes quiet.`,
        });
      }
    } else if (bn.has(p.id) || played.has(p.id)) {
      // the bench — or an H1 body parked in the reserves at the half
      p.energy = clamp(p.energy - (5 + rand(3)), 0, 100);
      xpGain = 4 + rand(3);
      p.dnp = 0;
    } else {
      // a night off recovers — but only back toward the baseline
      if (p.energy < METER_BASELINE) p.energy = Math.min(METER_BASELINE, p.energy + 8);
      p.dnp++;
      p.mood = clamp(p.mood - (p.dnp >= 3 ? 8 : 4), 0, 100);
      // a long freeze becomes a STORY: the frozen-out talk, then worse
      if ((p.dnp === 4 && roll(50)) || (p.dnp >= 6 && p.dnp % 3 === 0)) {
        queueStory(s, 'frozen', 'start', p.id, { games: p.dnp });
      }
    }
    p.mood = clamp(p.mood + (won ? 4 : -5), 0, 100);
    if (xpGain > 0) lastLevelUps.push(...addXp(s, p, xpGain));
    s.postGame.push({ playerId: p.id, energyP: p.energy - pre.e + (halfDrains[p.id] ?? 0), mood: p.mood - pre.m, xpGain });
  }

  // ON FIRE (printed rule): 25+ points lights a man up — everything he has
  // plays +20% until he cools off (under 12 points, or a night without minutes).
  const FIRE_ON = 25;
  const FIRE_KEEP = 12;
  const box = s.lastResult?.box ?? [];
  for (const p of me.players) {
    const row = box.find((r) => r.playerId === p.id);
    const d = s.postGame.find((x) => x.playerId === p.id);
    if (p.onFire) {
      if (!row || row.pts < FIRE_KEEP || p.outWeeks > 0) {
        p.onFire = false;
        if (d) d.fire = 'out';
      }
    } else if (row && row.pts >= FIRE_ON && p.outWeeks === 0) {
      p.onFire = true;
      if (d) d.fire = 'lit';
      queueStory(s, 'notice', 'start', p.id, {
        tag: '🔥 ON FIRE',
        text: `${p.name} drops ${row.pts} and the rim starts SMOKING.\n\nHe is ON FIRE — everything he has plays +20% until he cools off (under ${FIRE_KEEP} points, or a night without minutes).`,
      });
    }
  }
}

// ---- week/season advance -----------------------------------------------------------------

export function continueFromResult(s: GameState): void {
  if (s.end) return;
  if (isUtWeek(s) && s.ut) {
    const wonRound = s.lastResult?.win ?? false;
    if (!wonRound) { endSeason(s, null); return; }
    if (s.ut.round >= 2) {
      // THE UNIVERSAL TITLE
      s.utTitles++;
      s.trophies++;
      s.legacy += 10;
      s.careerLog.push(`Season ${s.season}: WON THE UNIVERSAL TOURNAMENT.`);
      const legendaries = ITEMS.filter((i) => i.rarity === 'legendary');
      giveItem(s, pick(legendaries).id);
      endSeason(s, 'You cut the net in zero gravity. The confetti simply never lands.');
      return;
    }
    s.ut.round++;
    // the other champions play each other; a stronger one awaits
    s.ut.myNextOpp = clamp(s.ut.myNextOpp + 1 + rand(2), 0, s.ut.champs.length - 1);
    s.week++;
    startWeek(s);
    return;
  }
  if (s.week >= REGULAR_WEEKS) {
    const table = sortedStandings(s);
    if (table[0].id === s.myTeamId) {
      const me = myTeam(s);
      s.legacy += 3;
      s.trophies++;
      s.careerLog.push(`Season ${s.season}: won the conference (${me.wins}–${me.losses}).`);
      s.ut = { round: 0, champs: genChamps(teamPower(me), s.season), myNextOpp: 0, log: [] };
      s.week++;
      startWeek(s);
      return;
    }
    endSeason(s, null);
    return;
  }
  s.week++;
  startWeek(s);
}

// ---- offseason ------------------------------------------------------------------------------

function endSeason(s: GameState, utNote: string | null): void {
  const t = myTeam(s);
  const table = sortedStandings(s);
  const place = table.findIndex((x) => x.id === s.myTeamId) + 1;
  s.seasonChampion = `${table[0].planet} ${table[0].name}`;
  s.seasonNotes = [];
  if (utNote) s.seasonNotes.push(utNote);
  if (s.ut && !utNote) {
    s.seasonNotes.push(`The Universal Tournament run ends: ${s.ut.log.join(' · ')}.`);
    s.legacy += s.ut.round * 2;
  }
  s.seasonNotes.push(
    place === 1
      ? `You finished FIRST (${t.wins}–${t.losses}).`
      : `You finished ${place}${['','st','nd','rd'][place] ?? 'th'} (${t.wins}–${t.losses}). Only first place goes to the Universal Tournament. The boosters know that too.`
  );
  if (!s.ut && place > 1) s.careerLog.push(`Season ${s.season}: finished ${place}.`);
  s.ut = null;

  // pro departures: elite overalls may declare, any class year
  s.proDeparts = t.players
    .filter((p) => ovr(p.attrs) >= PRO_OVR)
    .map((p) => ({ playerId: p.id, name: p.name, resolved: false, staying: false, note: '' }));

  // seniors graduate now (into the alumni pool)
  const seniors = t.players.filter((p) => p.classYear >= 3 && !s.proDeparts.some((d) => d.playerId === p.id));
  for (const p of seniors) {
    const alum = toAlum(p, 'grad', s.season);
    s.alumni.push(alum);
    s.legacy += 1;
    s.seasonNotes.push(`${p.name} graduates with ${alum.career.pts} career points. The banner says THANK YOU in four languages.`);
  }
  t.players = t.players.filter((p) => p.classYear < 3 || s.proDeparts.some((d) => d.playerId === p.id));

  // alumni encounters find you in the offseason sometimes
  if (s.alumni.length && roll(10)) {
    const alum = pick(s.alumni);
    queueStory(s, alum.exit === 'void' ? 'alum_void' : roll(50) ? 'alum_gold' : 'alum_dark', 'start', null, {
      alumName: alum.name, exit: alum.exit, season: alum.season,
    });
  }

  // AI teams roll over
  for (const team of s.teams) {
    if (team.id === s.myTeamId) continue;
    team.players = team.players.filter((p) => p.classYear < 3 && ovr(p.attrs) < PRO_OVR);
    for (const p of team.players) {
      p.classYear++;
      bumpAny(p, 1 + rand(3));
      p.energy = METER_BASELINE - 3 + rand(9);
      p.mood = clamp(p.mood + 15, 60, 85);
      p.outWeeks = 0; p.outReason = '';
    }
    const counter = { nextId: s.nextId };
    const names = takenNames(s);
    while (team.players.length < ROSTER_SIZE) {
      team.players.push(prospectToPlayer(genProspect(counter, s.season, Math.random() < 0.3 ? 'outerrim' : 'nebula', names)));
    }
    s.nextId = counter.nextId;
    ensureUniqueJerseys(team.players);
    autoLineup(team);
  }

  s.heatS = clamp(s.heatS - 5, 0, 100);
  s.heatB = clamp(s.heatB - 8, 0, 100);
  s.legendariesUsed = [];
  s.signingResults = [];
  s.commits = [];
  s.phase = 'departures';
  save(s);
}

export function convincePro(s: GameState, playerId: number): void {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!d || !p) return;
  d.resolved = true;
  const chance = clamp(15 + (p.mood - 40), 10, 80);
  if (Math.random() * 100 < chance) {
    d.staying = true;
    d.note = `You talk about legacy, unfinished business, banners. ${p.name} STAYS. (${chance}% — and you hit it.)`;
  } else {
    d.staying = false;
    d.note = genderize(`${p.name} listens politely, then shows you the contract already on his holo. Gone. (${chance}% — missed.)`, p.form);
    departPro(s, p);
  }
  save(s);
}

export function letGoPro(s: GameState, playerId: number): void {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!d || !p) return;
  d.resolved = true;
  d.staying = false;
  d.note = `You shake his hand and tell him to make the galaxy proud. Draft night will have your program's name in it.`;
  departPro(s, p);
  save(s);
}

function departPro(s: GameState, p: Player): void {
  s.alumni.push(toAlum(p, 'pro', s.season));
  s.legacy += 2;
  myTeam(s).players = myTeam(s).players.filter((x) => x.id !== p.id);
}

export function retire(s: GameState): void {
  endCareer(s, 'RETIRED');
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
  if (pr) pr.selected = !pr.selected;
  save(s);
}

export function effectiveChances(s: GameState): { prospect: Prospect; pct: number }[] {
  return s.prospects
    .filter((p) => p.selected)
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((prospect, i) => ({ prospect, pct: Math.max(0, prospect.commitPct - (SIGNING_PENALTIES[i] ?? 95)) }));
}

export function resolveSigning(s: GameState): void {
  for (const { prospect, pct } of effectiveChances(s)) {
    if (Math.random() * 100 < pct) {
      s.commits.push(prospectToPlayer(prospect));
      s.signingResults.push(genderize(`✓ ${prospect.name} COMMITS! (${pct}% held) He announces it by skywriting over your stadium.`, prospect.form));
    } else {
      s.signingResults.push(genderize(`✗ ${prospect.name} signs elsewhere (${pct}% missed). His holo-agent says it "wasn't personal." It was a little personal.`, prospect.form));
    }
  }
  if (!s.signingResults.length) s.signingResults.push('You pursued nobody. The recruiting trail is quiet. Too quiet.');
  // the verdicts get their OWN dialogue box
  queueStory(s, 'notice', 'start', null, { tag: 'SIGNING DAY', text: s.signingResults.join('\n') });

  // THE SUMMER: the returners develop BEFORE you pick — its own dialogue box
  const t = myTeam(s);
  const notes: string[] = [];
  for (const p of t.players) {
    p.classYear = Math.min(3, p.classYear + 1);
    const bump = bumpAny(p, 1 + rand(3));
    let driftNote = '';
    if (roll(25)) {
      // his body keeps leaning into what his species is
      const sp = speciesById(p.speciesId);
      const a = bestAttr(sp.attrCaps);
      const before = p.attrs[a];
      p.attrs[a] = Math.min(p.pots[a], p.attrs[a] + 2);
      if (p.attrs[a] > before) driftNote = ` — and his body kept leaning into what it is (+${p.attrs[a] - before} ${a.toUpperCase()})`;
    }
    p.energy = METER_BASELINE - 3 + rand(9);
    p.mood = clamp(p.mood + 15, 60, 85);
    p.outWeeks = 0; p.outReason = ''; p.dnp = 0;
    notes.push(genderize(`${p.name}: +${bump} over the summer${driftNote}.`, p.form));
  }
  if (notes.length) queueStory(s, 'notice', 'start', null, { tag: 'THE SUMMER', text: notes.join('\n') });

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
    if (ovr(p.attrs) >= 38 && roll(25)) {
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
  }
  for (const t of s.teams) { t.wins = 0; t.losses = 0; t.pointsFor = 0; t.pointsAgainst = 0; }
  s.schedule = genSchedule(s.teams.length);
  s.commits = [];
  s.selectPool = [];
  s.signingResults = [];
  s.seasonChampion = null;
  s.groundedWeeks = 0;
  s.proDeparts = [];
  s.ut = null;
  normalizeLineup(myTeam(s)); // keeps the arrangement from the selection grid
  // a FULL board of nine total strangers — the season's recruiting raw material
  s.prospects = [];
  s.pendingRecruits = [];
  const counter = { nextId: s.nextId };
  const names = takenNames(s);
  const regions = ['home', 'home', 'nebula', 'nebula', 'nebula', 'outerrim', 'outerrim'];
  if (s.unlockedRegions.includes('deepcore')) regions.push('deepcore');
  for (let i = 0; i < MAX_PROSPECTS; i++) s.prospects.push(genProspect(counter, s.season, pick(regions), names));
  s.nextId = counter.nextId;
  startWeek(s);
}

// ---- new game -------------------------------------------------------------------------------

export function chooseTeam(s: GameState, teamId: number): void {
  s.myTeamId = teamId;
  for (const t of s.teams) autoLineup(t);
  s.season = 0;
  const t = myTeam(s);
  t.players = t.players.slice(0, 6);
  for (const p of t.players) if (p.classYear === 0) p.classYear = 1 + rand(3);
  const pool: Player[] = [...t.players];
  const counter = { nextId: s.nextId };
  const names = takenNames(s);
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter, names));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.signingResults = [];
  s.phase = 'teamSelect';
  maybeTip(s, 'tryouts');
  save(s);
}

export { reserves, starters, benchPlayers };
