// The orchestrator: the weekly loop, the story engine, THE BAG, the hot seat,
// the energy cache, seasons, the Universal Tournament, and every ending.

import {
  ITEMS,
  TIPS,
  VOYAGE_POOL,
  drillById,
  fragility,
  itemById,
  planById,
  prospectActById,
  rollInjury,
  scanById,
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
  aiPlan,
  autoLineup,
  benchPlayers,
  logistic,
  normalizeLineup,
  reserves,
  simAiGame,
  simMyChampGame,
  simMyLeagueGame,
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
  StoryEvent,
  Team,
} from './types';
import { ATTRS, addStats, bumpAny, bumpAnyPot, clamp, copyAttrs, bestAttr, ovr, pick, rand, roll, zeroStats } from './util';

const SAVE_KEY = 'galactic-coach-save';
const COMMIT_DECAY = 2;
export const SIGNING_PENALTIES = [0, 10, 25, 45, 65, 80, 90, 95];

export function myTeam(s: GameState): Team {
  return s.teams[s.myTeamId];
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

function wheelFactor(mine: PlanId, theirs: PlanId): number {
  if (planById(mine).beats === theirs) return 1.12;
  if (planById(theirs).beats === mine) return 0.89;
  return 1;
}

/** THE WIN METER: a band while unscouted, a point number once you KNOW them. */
export function winMeter(s: GameState): { lo: number; hi: number; exact: boolean } | null {
  const me = myTeam(s);
  let p: number;
  if (isUtWeek(s)) {
    const champ = utOpponent(s);
    if (!champ) return null;
    const mine = teamPower(me, s.plan) * wheelFactor(s.plan, champ.plan);
    p = Math.round(logistic(mine - champ.power) * 100);
  } else {
    const m = myMatchup(s);
    if (!m) return null;
    const oppPlan = aiPlanStable(m.opponent);
    const mine = teamPower(me, s.plan) * wheelFactor(s.plan, oppPlan) * (m.home ? 1.03 : 1);
    const theirs = teamPower(m.opponent, oppPlan) * (m.home ? 1 : 1.03);
    p = Math.round(logistic(mine - theirs) * 100);
  }
  p = clamp(p, 1, 99);
  return s.scoutedOpp ? { lo: p, hi: p, exact: true } : { lo: clamp(p - 15, 1, 99), hi: clamp(p + 15, 1, 99), exact: false };
}

/** The opponent's likely plan, stable within a week (no re-rolling the surprise). */
const planCache = new Map<string, PlanId>();
function aiPlanStable(t: Team): PlanId {
  const key = `${t.id}`;
  if (!planCache.has(key)) planCache.set(key, aiPlan(t));
  return planCache.get(key)!;
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
    return s.version === SAVE_VERSION ? s : null;
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
  return { name: p.name, speciesId: p.speciesId, ovr: ovr(p.attrs), exit, season, career };
}

// ---- Fx: the one place consequences land --------------------------------------------

export function applyFx(s: GameState, fxList: Fx[] | undefined, defaultPlayerId: number | null): void {
  if (!fxList) return;
  const t = myTeam(s);
  for (const fx of fxList) {
    const pid = fx.playerId ?? defaultPlayerId;
    const p = pid !== null ? t.players.find((x) => x.id === pid) : undefined;
    if (fx.coachEnergy) s.energy = clamp(s.energy + fx.coachEnergy, 0, CACHE_MAX);
    if (fx.heatS) s.heatS = clamp(s.heatS + fx.heatS, 0, 100 - s.heatB);
    if (fx.heatB) s.heatB = clamp(s.heatB + fx.heatB, 0, 100 - s.heatS);
    if (fx.legacy) s.legacy += fx.legacy;
    if (fx.teamMood) for (const q of t.players) q.mood = clamp(q.mood + fx.teamMood, 0, 100);
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
      const pr = genProspect(counter, s.season, 'nebula');
      pr.scoutLevel = 1;
      observe(pr);
      s.nextId = counter.nextId;
      s.prospects.push(pr);
    }
    if (fx.addPlayer && t.players.length < ROSTER_SIZE) {
      const counter = { nextId: s.nextId };
      const np = genSpecial(counter, fx.addPlayer);
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
    if (fx.mood) p.mood = clamp(p.mood + fx.mood, 0, 100);
    if (fx.weightKg) p.weightKg = Math.max(35, p.weightKg + fx.weightKg);
    if (fx.outWeeks !== undefined) {
      p.outWeeks = fx.outWeeks;
      p.outReason = fx.outWeeks > 0 ? fx.outReason ?? p.outReason ?? 'unspecified' : '';
      normalizeLineup(t);
    }
    if (fx.commit) {
      const pr = s.prospects[0];
      if (pr) pr.commitPct = clamp(pr.commitPct + fx.commit, 0, 100);
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

  applyFx(s, res.fx, ev.playerId);
  ev.resolvedText = res.text;
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
    s.phase = isUtWeek(s) ? 'matchup' : 'practice';
    maybeTip(s, isUtWeek(s) ? 'matchup' : 'practice');
  }
  if (!s.queue.length && s.phase === 'gamenight' && !s.lastResult && !s.end) simWeek(s);
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
  planCache.clear();
  s.energy = clamp(s.energy + stipendFor(s.season), 0, CACHE_MAX);
  s.trainedThisWeek = false;
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
            text: `${p.name} is back from ${p.outReason || 'his absence'} and cleared to play. The first dunk back is always the loudest.`,
          });
        }
        p.outReason = '';
      }
      p.energy = clamp(p.energy + 14, 0, 100);
      p.mood = clamp(p.mood + (p.mood < 55 ? 3 : -1), 0, 100);
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
    participants = t.players.filter((p) => p.outWeeks === 0 && !s.sitouts.includes(p.id));
    if (!participants.length) return null;
  }
  s.energy -= d.cost;
  s.trainedThisWeek = true;

  const ups: LevelUp[] = [];
  const gainByPlayer = new Map<number, string>();
  const gainNotes: string[] = [];
  if (d.target === 'rest') {
    for (const p of t.players.filter((x) => x.outWeeks === 0)) {
      p.energy = clamp(p.energy + 18, 0, 100);
      p.mood = clamp(p.mood + 4, 0, 100);
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
      xpByPlayer.set(p.id, gained);
      ups.push(...addXp(s, p, gained));
    }
  }

  let report = d.target === 'rest'
    ? 'The facility echoes with the sound of absolutely nothing happening. Everyone comes back looser.'
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

// ---- galaxy: scan / scout / recruit -----------------------------------------------------

export function actionScan(s: GameState, regionId: string): string | null {
  const def = scanById(regionId);
  if (!s.unlockedRegions.includes(def.id)) return null;
  if (s.groundedWeeks > 0 && !def.local) return null;
  if (s.energy < def.cost || s.prospects.length >= MAX_PROSPECTS) return null;
  s.energy -= def.cost;
  const counter = { nextId: s.nextId };
  const found: Prospect[] = [];
  for (let i = 0; i < def.count && s.prospects.length + found.length < MAX_PROSPECTS; i++) {
    found.push(genProspect(counter, s.season, def.id));
  }
  s.nextId = counter.nextId;
  s.prospects.push(...found);
  let text = found.length
    ? `Scan complete. New names on the board: ${found.map((p) => `${p.name} (${speciesById(p.speciesId).name})`).join(', ')}.`
    : 'Scan complete. The board is full — nine names, maximum.';

  // scans are voyages: the odds line rolls
  const r = Math.random() * 100;
  if (s.energy === 0 && roll(10)) {
    queueStory(s, 'debt', 'start', null, { cause: 'On the way home from the scan, a gravity snare — a salvage rig reels your ship in like a fish.' });
    text += ' Then the cells run dry in dead space...';
  } else if (r < def.down.pct) {
    if (roll(50)) queueStory(s, 'hullbreach', 'start', null);
    else queueStory(s, 'grounded', 'start', null, { cause: 'A micrometeorite shreds the starboard scoop on the way home.' });
    text += ' The trip home, however...';
  } else if (r < def.down.pct + def.up.pct) {
    if (def.up.cls === 'LOOT') {
      const item = pick(ITEMS.filter((i) => i.rarity !== 'legendary'));
      giveItem(s, item.id);
      text += ` And floating in the debris field: ${item.name}. Finders keepers is maritime law, probably.`;
    } else {
      for (const pr of found) { pr.scoutLevel = Math.min(2, pr.scoutLevel + 1); observe(pr); }
      text += ' The array over-delivers: crisp reads on everyone.';
    }
  }
  save(s);
  return text;
}

export function actionProspect(s: GameState, prospectId: number, actId: string): string | null {
  const pr = s.prospects.find((x) => x.id === prospectId);
  const act = prospectActById(actId);
  if (!pr || s.energy < act.cost) return null;
  if (act.kind === 'recruit' && pr.bannedWeeks > 0) return null;
  s.energy -= act.cost;
  let text: string;
  const r = Math.random() * 100;

  if (act.kind === 'scout') {
    pr.scoutLevel = Math.min(2, pr.scoutLevel + 1);
    observe(pr);
    if (actId === 'database') {
      pr.scoutLevel = 2;
      observe(pr);
      text = `The database opens like a confession: ${pr.name}, measured to the decimal. You know him better than his own coach now.`;
      if (r < act.down.pct) {
        queueStory(s, 'scandal', 'start', null, { cause: 'The combine database seller kept receipts. Sellers always keep receipts.' });
        text += ' The seller, meanwhile, kept receipts...';
      }
    } else {
      text = pr.scoutLevel >= 2
        ? `You watch ${pr.name} play a full game. The cloud burns off: his shape is TRUE, current and ceiling both.`
        : `You watch ${pr.name} warm up and play a half. The cloud thins.`;
      if (r >= act.down.pct && r < act.down.pct + act.up.pct) {
        pr.scoutLevel = 2;
        observe(pr);
        text += ' And late in the game he does the ONE thing that tells you everything. Locked.';
      }
    }
  } else {
    const gain = act.gain![0] + rand(act.gain![1] - act.gain![0] + 1);
    if (r < act.down.pct) {
      if (act.down.cls === 'SCANDAL') {
        pr.bannedWeeks = 2 + rand(2);
        pr.commitPct = clamp(pr.commitPct + Math.round(gain / 2), 0, 95);
        queueStory(s, 'scandal', 'start', null, { cause: `League snoops photograph you and ${pr.name} splitting the flambéed comet. The maître d' sells the holos within the hour.` });
        text = `The dinner is legendary — right up until the flashbulbs. NO CONTACT order: ${pr.bannedWeeks} weeks.`;
      } else {
        pr.commitPct = clamp(pr.commitPct - 20, 0, 95);
        text = `${pr.name} gets caught in a brawl over somebody's cheerleader girlfriend and leaves with a black eye and second thoughts. Commitment −20%.`;
      }
    } else if (r < act.down.pct + act.up.pct) {
      pr.commitPct = clamp(pr.commitPct + gain + 10, 0, 95);
      text = `${pr.name} has the night of his LIFE. He calls his mother from the shuttle to talk about your program. +${gain + 10}% → ${pr.commitPct}%.`;
    } else {
      pr.commitPct = clamp(pr.commitPct + gain, 0, 95);
      text = `${pr.name} leaves wearing one of your team caps. Where did he even get that? +${gain}% → ${pr.commitPct}%.`;
    }
  }
  save(s);
  return text;
}

export function actionDropProspect(s: GameState, prospectId: number): void {
  s.prospects = s.prospects.filter((x) => x.id !== prospectId);
  save(s);
}

// ---- matchup ---------------------------------------------------------------------------

export function setPlan(s: GameState, plan: PlanId): void {
  if (!s.knownPlans.includes(plan)) return; // unlearned tactics live in stories
  s.plan = plan;
  save(s);
}

export function scoutOpponent(s: GameState): boolean {
  if (s.scoutedOpp || s.energy < 1) return false;
  s.energy--;
  s.scoutedOpp = true;
  save(s);
  return true;
}

export function oppPlanHint(s: GameState): PlanId | null {
  if (!s.scoutedOpp) return null;
  if (isUtWeek(s)) return utOpponent(s)?.plan ?? null;
  const m = myMatchup(s);
  return m ? aiPlanStable(m.opponent) : null;
}

/** Use a bag item outside a story (drawer / matchup / practice / galaxy). */
export function useItem(s: GameState, itemId: string, ctxData: Record<string, unknown> = {}): string | null {
  const idx = s.bag.indexOf(itemId);
  if (idx < 0) return null;
  const item = itemById(itemId);
  if (item.rarity === 'legendary' && s.legendariesUsed.includes(item.id)) return null;
  const phaseCtx: Record<string, string[]> = {
    practice: ['practice'],
    matchup: ['pregame'],
    galaxy: ['recruiting'],
    stories: ['mood'],
    gamenight: [],
    departures: [], signing: [], growth: [], teamSelect: [], pickTeam: [], gameover: [],
  };
  const allowed = [...(phaseCtx[s.phase] ?? []), 'mood'];
  if (!item.context.some((c) => allowed.includes(c))) return null;
  s.bag.splice(idx, 1);
  if (item.rarity === 'legendary') s.legendariesUsed.push(item.id);
  lastLevelUps = [];
  const res = item.use(storyCtx(s, (ctxData.playerId as number | null) ?? null, ctxData));
  applyFx(s, res.fx, (ctxData.playerId as number | null) ?? null);
  for (const f of res.follow ?? []) {
    s.futureBeats.push({ weeksLeft: f.weeks, defId: f.defId ?? 'breakthrough', beat: f.beat, playerId: f.playerId ?? null, data: f.data });
  }
  if (res.next) queueStory(s, res.next.defId, res.next.beat, res.next.playerId ?? null, res.next.data ?? {});
  save(s);
  return res.text;
}

// ---- game night ----------------------------------------------------------------------------

export function toMatchup(s: GameState): void {
  if (s.phase === 'stories' && s.queue.length) return;
  normalizeLineup(myTeam(s));
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
  s.phase = 'galaxy';
  maybeTip(s, 'galaxy');
  save(s);
}

/** PLAY (held). Away weeks voyage first; the sim runs when the queue clears. */
export function playGame(s: GameState): void {
  s.phase = 'gamenight';
  s.lastResult = null;
  if (!s.voyageRolled) {
    s.voyageRolled = true;
    const m = myMatchup(s);
    const away = isUtWeek(s) || (m ? !m.home : false);
    if (away) {
      if (s.energy === 0 && roll(10)) {
        queueStory(s, 'debt', 'start', null);
      } else if (roll(25)) {
        if (s.alumni.length && roll(10)) {
          const alum = pick(s.alumni);
          queueStory(s, alum.exit === 'void' ? 'alum_void' : roll(50) ? 'alum_gold' : 'alum_dark', 'start', null, {
            alumName: alum.name, exit: alum.exit, season: alum.season,
          });
        } else {
          queueStory(s, pick(VOYAGE_POOL), 'start', null);
        }
      }
    }
  }
  if (!s.queue.length && !s.end) simWeek(s);
  save(s);
}

function simWeek(s: GameState): void {
  const me = myTeam(s);
  normalizeLineup(me);
  lastLevelUps = [];

  if (isUtWeek(s) && s.ut) {
    const champ = utOpponent(s);
    if (!champ) return;
    const out = simMyChampGame(s, me, champ);
    s.lastResult = out.result;
    applyGameEffects(s, out.won);
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
  for (const t of s.teams) if (t.id !== s.myTeamId) autoLineup(t);
  const games = s.schedule[s.week - 1] ?? [];
  for (const [h, a] of games) {
    if (h === s.myTeamId || a === s.myTeamId) {
      if (!m) continue;
      const out = simMyLeagueGame(s, me, m.opponent, m.home);
      s.lastResult = out.result;
      const winner = out.won ? me : m.opponent;
      const loser = out.won ? m.opponent : me;
      winner.wins++; loser.losses++;
      winner.pointsFor += Math.max(out.result.myScore, out.result.oppScore);
      winner.pointsAgainst += Math.min(out.result.myScore, out.result.oppScore);
      loser.pointsFor += Math.min(out.result.myScore, out.result.oppScore);
      loser.pointsAgainst += Math.max(out.result.myScore, out.result.oppScore);
      if (out.won) { s.totalWins++; s.heatB = clamp(s.heatB - 4, 0, 100); }
      else s.heatB = clamp(s.heatB + 4, 0, 100 - s.heatS);
      applyGameEffects(s, out.won);
    } else {
      const g = simAiGame(s.teams[h], s.teams[a]);
      g.winner.wins++; g.loser.losses++;
      g.winner.pointsFor += g.scoreW; g.winner.pointsAgainst += g.scoreL;
      g.loser.pointsFor += g.scoreL; g.loser.pointsAgainst += g.scoreW;
      s.resultsLog.push(`${g.winner.name} ${g.scoreW} — ${g.scoreL} ${g.loser.name}`);
      // AI squads drift forward
      for (const p of [...g.winner.players, ...g.loser.players]) {
        p.energy = clamp(p.energy - 14, 0, 100);
        if (p.level < LEVEL_CAP && Math.random() < 0.15) { p.level++; bumpAny(p, 2); }
      }
    }
  }
  // clean weeks slowly cool the school
  s.heatS = clamp(s.heatS - 1, 0, 100);
  save(s);
}

function applyGameEffects(s: GameState, won: boolean): void {
  const me = myTeam(s);
  const st = new Set(starters(me).map((p) => p.id));
  const bn = new Set(benchPlayers(me).map((p) => p.id));
  s.postGame = [];
  for (const p of me.players) {
    if (p.outWeeks > 0) continue;
    const pre = { e: p.energy, m: p.mood };
    let xpGain = 0;
    if (st.has(p.id)) {
      const lowEnergy = p.energy <= 30;
      p.energy = clamp(p.energy - (14 + rand(6)), 0, 100);
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
    } else if (bn.has(p.id)) {
      p.energy = clamp(p.energy - (8 + rand(5)), 0, 100);
      xpGain = 4 + rand(3);
      p.dnp = 0;
    } else {
      p.energy = clamp(p.energy + 8, 0, 100);
      p.dnp++;
      if (p.dnp >= 3) p.mood = clamp(p.mood - 5, 0, 100);
    }
    p.mood = clamp(p.mood + (won ? 5 : -5), 0, 100);
    if (xpGain > 0) lastLevelUps.push(...addXp(s, p, xpGain));
    s.postGame.push({ playerId: p.id, energyP: p.energy - pre.e, mood: p.mood - pre.m, xpGain });
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
      s.ut = { round: 0, champs: genChamps(teamPower(me, s.plan), s.season), myNextOpp: 0, log: [] };
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
      p.energy = 80 + rand(15);
      p.mood = clamp(p.mood + 10, 30, 90);
      p.outWeeks = 0; p.outReason = '';
    }
    const counter = { nextId: s.nextId };
    while (team.players.length < ROSTER_SIZE) {
      team.players.push(prospectToPlayer(genProspect(counter, s.season, Math.random() < 0.3 ? 'outerrim' : 'nebula')));
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
    d.note = `${p.name} listens politely, then shows you the contract already on his holo. Gone. (${chance}% — missed.)`;
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
      s.signingResults.push(`✓ ${prospect.name} COMMITS! (${pct}% held) He announces it by skywriting over your stadium.`);
    } else {
      s.signingResults.push(`✗ ${prospect.name} signs elsewhere (${pct}% missed). His holo-agent says it "wasn't personal." It was a little personal.`);
    }
  }
  if (!s.signingResults.length) s.signingResults.push('You pursued nobody. The recruiting trail is quiet. Too quiet.');

  const pool: Player[] = [...myTeam(s).players, ...s.commits];
  const counter = { nextId: s.nextId };
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.phase = 'teamSelect';
  save(s);
}

export function finalizeRoster(s: GameState, chosenIds: number[]): boolean {
  if (chosenIds.length !== ROSTER_SIZE) return false;
  const chosen = s.selectPool.filter((p) => chosenIds.includes(p.id));
  if (chosen.length !== ROSTER_SIZE) return false;
  const t = myTeam(s);
  t.players = chosen;
  ensureUniqueJerseys(t.players);

  if (s.season === 0) {
    // tryouts complete: straight into season 1
    startNewSeason(s);
    return true;
  }

  // GROWTH: the summer finds everyone
  s.seasonNotes = [];
  for (const p of t.players) {
    const wasRet = !s.commits.some((c) => c.id === p.id) && !p.walkOn;
    p.classYear = Math.min(3, p.classYear + (wasRet ? 1 : 0));
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
    p.energy = 85 + rand(15);
    p.mood = clamp(p.mood + 10, 40, 95);
    p.outWeeks = 0; p.outReason = ''; p.dnp = 0;
    s.seasonNotes.push(`${p.name}: +${bump} over the summer${driftNote}.`);
  }
  s.phase = 'growth';
  save(s);
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
  }
  for (const t of s.teams) { t.wins = 0; t.losses = 0; t.pointsFor = 0; t.pointsAgainst = 0; }
  s.schedule = genSchedule(s.teams.length);
  s.prospects = [];
  s.commits = [];
  s.selectPool = [];
  s.signingResults = [];
  s.seasonChampion = null;
  s.groundedWeeks = 0;
  s.proDeparts = [];
  s.ut = null;
  autoLineup(myTeam(s));
  const counter = { nextId: s.nextId };
  for (let i = 0; i < 2; i++) s.prospects.push(genProspect(counter, s.season, Math.random() < 0.5 ? 'home' : 'nebula'));
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
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.signingResults = [];
  s.phase = 'teamSelect';
  maybeTip(s, 'tryouts');
  save(s);
}

export { reserves, starters, benchPlayers };
