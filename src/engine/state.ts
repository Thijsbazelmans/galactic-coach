import {
  COACH_EVENTS,
  EVENTS,
  REST_LINES,
  REST_MISHAPS,
  SCAN_FLAVOR_LINES,
  SCHMOOZE_SUCCESS_LINES,
  TRAINING_TYPES,
  schmoozeById,
  scanById,
  speciesById,
  trainingById,
} from './data';
import {
  BASE_ENERGY,
  REGULAR_WEEKS,
  ROSTER_SIZE,
  SAVE_VERSION,
  SELECT_POOL_SIZE,
  STAT_KEYS,
  TOTAL_WEEKS,
  clamp,
  ensureUniqueJerseys,
  genProspect,
  genSchedule,
  genWalkOn,
  newGameState,
  pick,
  rand,
  rawOverall,
  statCap,
  xpNeed,
} from './gen';
import { autoLineup, normalizeLineup, overall, reserves, simGame } from './sim';
import type {
  GameState,
  NewsEffect,
  NewsItem,
  Player,
  PlayerDeltas,
  PressQuestion,
  Prospect,
  StatKey,
  Team,
} from './types';

const SAVE_KEY = 'galactic-coach-save';
const COMMIT_DECAY = 2;
const MAX_PROSPECTS = 9;
export const SIGNING_PENALTIES = [0, 10, 25, 45, 65, 80, 90, 95];

export function myTeam(s: GameState): Team {
  return s.teams[s.myTeamId];
}

function weekGames(s: GameState): [number, number][] {
  if (s.week <= REGULAR_WEEKS) return s.schedule[s.week - 1] ?? [];
  return s.playoff?.games ?? [];
}

export function myMatchup(s: GameState): { opponent: Team; home: boolean } | null {
  for (const [h, a] of weekGames(s)) {
    if (h === s.myTeamId) return { opponent: s.teams[a], home: true };
    if (a === s.myTeamId) return { opponent: s.teams[h], home: false };
  }
  return null;
}

export function weekLabel(s: GameState): string {
  if (s.season === 0) return 'TRYOUTS';
  if (s.week <= REGULAR_WEEKS) return `WEEK ${s.week}/${REGULAR_WEEKS}`;
  return ['QUARTERFINALS', 'SEMIFINALS', 'THE GALACTIC FINAL'][s.week - REGULAR_WEEKS - 1] ?? '';
}

export function legacyScore(s: GameState): number {
  return s.trophies * 100 + s.totalWins * 5 + s.integrity;
}

export function sortedStandings(s: GameState): Team[] {
  return [...s.teams].sort(
    (a, b) => b.wins - a.wins || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
  );
}

// ---- XP & level-ups -------------------------------------------------------

/** Grant XP; level-ups queue point packets for the coach to assign. */
export function addXp(p: Player, amount: number): void {
  p.xp += amount;
  let need = xpNeed(p);
  while (p.xp >= need) {
    p.xp -= need;
    const breakthrough = Math.random() < 0.15;
    p.pendingPoints.push(breakthrough ? 5 : 1 + rand(3));
    need = xpNeed(p);
  }
}

/** Spend the oldest pending packet on one stat. */
export function assignStatPoints(s: GameState, playerId: number, k: StatKey): number | null {
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!p || !p.pendingPoints.length) return null;
  const packet = p.pendingPoints.shift()!;
  p.stats[k] = clamp(p.stats[k] + packet, 5, statCap(p, k));
  save(s);
  return packet;
}

export function pendingLevelUps(s: GameState): Player[] {
  return myTeam(s).players.filter((p) => p.pendingPoints.length > 0);
}

// ---- press conference -----------------------------------------------------

function shuffleWithCorrect(options: string[], correct: string): { options: string[]; correctIdx: number } {
  const all = [...options];
  for (let i = all.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { options: all, correctIdx: all.indexOf(correct) };
}

function genPress(s: GameState): PressQuestion | null {
  const results = s.lastResults;
  if (!results.length) return null;
  const mine = results.find((r) => r.homeId === s.myTeamId || r.awayId === s.myTeamId);
  const variants: PressQuestion[] = [];

  if (mine) {
    const h = s.teams[mine.homeId];
    const a = s.teams[mine.awayId];
    const correct = `${h.name} ${mine.homeScore} — ${mine.awayScore} ${a.name}`;
    const wrongs = [
      `${h.name} ${mine.homeScore + 2 + rand(4)} — ${mine.awayScore} ${a.name}`,
      `${h.name} ${Math.max(0, mine.homeScore - 3 - rand(3))} — ${mine.awayScore + 2} ${a.name}`,
      `${h.name} ${mine.awayScore} — ${mine.homeScore} ${a.name}`,
    ];
    const q = shuffleWithCorrect([correct, ...wrongs], correct);
    variants.push({ text: `"Coach! What was the final score of last week's game?"`, ...q, answered: false });

    const myBox = mine.box.filter((b) => b.teamId === s.myTeamId);
    if (myBox.length >= 1 && myTeam(s).players.length >= 4) {
      const top = myBox[0];
      const others = myTeam(s).players
        .filter((p) => p.id !== top.playerId)
        .slice(0, 3)
        .map((p) => p.name);
      const q2 = shuffleWithCorrect([top.name, ...others], top.name);
      variants.push({ text: `"Coach! Who led your team in scoring last week?"`, ...q2, answered: false });
    }
  }

  const other = results.find((r) => r !== mine);
  if (other) {
    const h = s.teams[other.homeId];
    const a = s.teams[other.awayId];
    const winner = other.homeScore > other.awayScore ? h : a;
    const q3 = shuffleWithCorrect([h.name, a.name], winner.name);
    variants.push({
      text: `"Coach! Do you even watch the rest of the league? Who won on ${h.planet} last week?"`,
      ...q3,
      answered: false,
    });
  }

  return variants.length ? pick(variants) : null;
}

export function answerPress(s: GameState, idx: number): void {
  if (!s.press || s.press.answered) return;
  s.press.answered = true;
  s.press.wasCorrect = idx === s.press.correctIdx;
  if (s.press.wasCorrect) s.energy++;
  save(s);
}

// ---- effects --------------------------------------------------------------

function applyStatDeltas(player: Player, deltas: Partial<Record<StatKey, number>>): void {
  for (const [k, d] of Object.entries(deltas)) {
    player.stats[k as StatKey] = clamp(player.stats[k as StatKey] + (d ?? 0), 5, statCap(player, k as StatKey));
  }
}

function applyEffect(s: GameState, player: Player | undefined, eff: NewsEffect): void {
  if (eff.integrityDelta) s.integrity = clamp(s.integrity + eff.integrityDelta, 0, 100);
  if (eff.energyDelta) s.energy = Math.max(0, s.energy + eff.energyDelta);
  if (eff.shipDamage) s.shipDamaged = true;
  if (eff.teamMoodDelta || eff.teamFitnessDelta) {
    for (const p of myTeam(s).players) {
      if (eff.teamMoodDelta) p.mood = clamp(p.mood + eff.teamMoodDelta, 0, 100);
      if (eff.teamFitnessDelta) p.fitness = clamp(p.fitness + eff.teamFitnessDelta, 0, 100);
    }
  }
  if (eff.unlockTraining) {
    const locked = TRAINING_TYPES.filter((t) => !s.unlockedTraining.includes(t.id));
    if (locked.length) {
      const t = pick(locked);
      s.unlockedTraining.push(t.id);
      s.news.push({ playerId: null, text: `NEW TRAINING METHOD: ${t.name} — ${t.desc}` });
    }
  }
  if (eff.unlockRegion && !s.unlockedRegions.includes(eff.unlockRegion)) {
    const r = scanById(eff.unlockRegion);
    s.unlockedRegions.push(eff.unlockRegion);
    s.news.push({ playerId: null, text: `NEW REGION ON THE SCOUTING CONSOLE: ${r.name.replace('Scan the ', 'the ')} — ${r.desc}` });
  }
  if (!player) return;
  if (eff.outWeeks) { player.outWeeks = eff.outWeeks; player.outReason = eff.outReason ?? ''; }
  if (eff.moodDelta) player.mood = clamp(player.mood + eff.moodDelta, 0, 100);
  if (eff.fitnessDelta) player.fitness = clamp(player.fitness + eff.fitnessDelta, 0, 100);
  if (eff.weightDelta) player.weightKg = Math.max(35, player.weightKg + eff.weightDelta);
  if (eff.statDeltas) applyStatDeltas(player, eff.statDeltas);
}

// ---- week start -----------------------------------------------------------

function rollEventNews(s: GameState): void {
  const eventCount = 1 + (Math.random() < 0.25 ? 1 : 0);
  const hit = new Set<number>();
  for (let i = 0; i < eventCount; i++) {
    const candidates = myTeam(s).players.filter((p) => p.outWeeks === 0 && !hit.has(p.id));
    if (!candidates.length) break;
    const player = pick(candidates);
    hit.add(player.id);
    const pool = Math.random() < 0.75 ? EVENTS.filter((e) => e.choices) : EVENTS;
    const totalWeight = pool.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * totalWeight;
    let def = pool[0];
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) { def = e; break; }
    }
    const item: NewsItem = { playerId: player.id, text: def.text(player.name) };
    if (def.auto) {
      applyEffect(s, player, def.auto);
      item.resolvedText = def.auto.resolved(player.name);
    } else if (def.choices) {
      item.choices = def.choices.map((c) => ({
        label: c.label,
        outcome: c.outcome(player.name),
        ...c.effect,
        gambleDelay: c.gambleDelay,
        gamble: c.gamble?.map((g) => ({ weight: g.weight, text: g.text(player.name), effect: g.effect })),
      }));
    }
    s.news.push(item);
  }

  // coach storylines: ~30% of weeks, when one is eligible
  if (Math.random() < 0.3) {
    const eligible = COACH_EVENTS.filter((e) => e.when(s));
    if (eligible.length) {
      const def = pick(eligible);
      s.news.push({
        playerId: null,
        text: def.text,
        choices: def.choices.map((c) => ({
          label: c.label,
          outcome: c.outcome,
          ...c.effect,
          gambleDelay: c.gambleDelay,
          gamble: c.gamble?.map((g) => ({ weight: g.weight, text: g.text, effect: g.effect })),
        })),
      });
    }
  }
}

function startWeek(s: GameState): void {
  s.press = genPress(s);
  s.news = [];
  s.energy = BASE_ENERGY;
  s.restReport = null;
  s.recruitLog = [];
  s.postGame = [];

  if (s.week > REGULAR_WEEKS) setupPlayoffRound(s);

  // gamble payoffs come due
  for (const fn of [...s.futureNews]) {
    fn.weeksLeft--;
    if (fn.weeksLeft <= 0) {
      const player = myTeam(s).players.find((p) => p.id === fn.playerId);
      if (fn.effect) applyEffect(s, player, fn.effect);
      s.news.push({ playerId: fn.playerId, text: fn.text });
      s.futureNews.splice(s.futureNews.indexOf(fn), 1);
    }
  }

  for (const t of s.teams) {
    for (const p of t.players) {
      if (p.outWeeks > 0 && --p.outWeeks === 0) {
        if (t.id === s.myTeamId) {
          s.news.push({ playerId: p.id, text: `${p.name} is back from ${p.outReason || 'his absence'} and cleared to play.` });
        }
        p.outReason = '';
      }
      p.fitness = clamp(p.fitness + 12, 0, 100);
      p.mood = clamp(p.mood + (p.mood < 55 ? 3 : -2), 0, 100);
      if (p.fitness < 35) p.mood = clamp(p.mood - 2, 0, 100);
    }
  }

  for (const p of myTeam(s).players) {
    if (p.mood < 35 && Math.random() < 0.4) {
      if (Math.random() < 0.5) {
        p.weightKg += 5;
        s.news.push({ playerId: p.id, text: `${p.name} is miserable and has discovered the dining hall's unlimited gravy-fries. He's up 5 kilos and it shows in his first step.` });
      } else {
        p.weightKg = Math.max(35, p.weightKg - 4);
        s.news.push({ playerId: p.id, text: `${p.name} is worrying himself thin. He's down 4 kilos and getting shoved off his spot.` });
      }
    }
  }

  for (const pr of s.prospects) {
    pr.commitPct = Math.max(0, pr.commitPct - COMMIT_DECAY);
    if (pr.bannedWeeks > 0) pr.bannedWeeks--;
  }

  rollEventNews(s);
  normalizeLineup(myTeam(s));
  s.phase = 'news';
  save(s);
}

export function newsBlocked(s: GameState): boolean {
  if (s.press && !s.press.answered) return true;
  return s.news.some((n) => n.choices && !n.resolvedText);
}

export interface ResolvedEffects {
  playerId: number | null;
  moodDelta: number;
  fitnessDelta: number;
  weightDelta: number;
  outWeeks: number;
  statDeltas: Partial<Record<StatKey, number>>;
}

export function resolveNews(s: GameState, newsIdx: number, choiceIdx: number): ResolvedEffects | null {
  const item = s.news[newsIdx];
  if (!item || !item.choices || item.resolvedText) return null;
  const c = item.choices[choiceIdx];
  if (c.energyDelta && s.energy + c.energyDelta < 0) return null;
  const player = myTeam(s).players.find((p) => p.id === item.playerId);
  applyEffect(s, player, c);
  if (player) normalizeLineup(myTeam(s));
  if (c.gamble && c.gamble.length) {
    const total = c.gamble.reduce((a, g) => a + g.weight, 0);
    let r = Math.random() * total;
    let outcome = c.gamble[0];
    for (const g of c.gamble) {
      r -= g.weight;
      if (r <= 0) { outcome = g; break; }
    }
    s.futureNews.push({
      weeksLeft: c.gambleDelay ?? 1,
      playerId: item.playerId,
      text: outcome.text,
      effect: outcome.effect,
    });
  }
  item.resolvedText = c.outcome;
  save(s);
  return {
    playerId: item.playerId,
    moodDelta: c.moodDelta ?? 0,
    fitnessDelta: c.fitnessDelta ?? 0,
    weightDelta: c.weightDelta ?? 0,
    outWeeks: c.outWeeks ?? 0,
    statDeltas: c.statDeltas ?? {},
  };
}

// ---- phase transitions ----------------------------------------------------

export function chooseTeam(s: GameState, teamId: number): void {
  s.myTeamId = teamId;
  for (const t of s.teams) autoLineup(t);
  s.season = 0;
  const t = myTeam(s);
  t.players = t.players.slice(0, 6);
  for (const p of t.players) {
    if (p.classYear === 0) p.classYear = 1 + rand(3);
  }
  const pool: Player[] = [...t.players];
  const counter = { nextId: s.nextId };
  while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter));
  s.nextId = counter.nextId;
  s.selectPool = pool;
  s.signingResults = [
    "FIRST PRACTICE. Six players from last year's squad, a gym full of hopefuls, and one clipboard: yours. Pick your nine.",
  ];
  s.phase = 'teamSelect';
  save(s);
}

export function goNews(s: GameState): void {
  s.phase = 'news';
  save(s);
}

export function toTraining(s: GameState): void {
  if (s.phase === 'news' && newsBlocked(s)) return;
  s.phase = 'training';
  save(s);
}

export function toScouting(s: GameState): void {
  s.phase = 'scouting';
  save(s);
}

export function toLineup(s: GameState): void {
  normalizeLineup(myTeam(s));
  s.phase = 'lineup';
  save(s);
}

// ---- energy actions -------------------------------------------------------

function spend(s: GameState, n = 1): boolean {
  if (s.energy < n) return false;
  s.energy -= n;
  return true;
}

/** 1⚡: one player, one method, XP gained. Returns the XP or null. */
export function actionTrain(s: GameState, typeId: string, playerId: number): number | null {
  if (!s.unlockedTraining.includes(typeId)) return null;
  const def = trainingById(typeId);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!p || p.outWeeks > 0 || !spend(s)) return null;
  const gained = def.xp[0] + rand(def.xp[1] - def.xp[0] + 1);
  p.fitness = clamp(p.fitness - 6, 0, 100);
  addXp(p, gained);
  save(s);
  return gained;
}

/** 1⚡: cancel practice, everyone recovers. Repeat at your peril. */
export function actionRest(s: GameState): boolean {
  if (!spend(s)) return false;
  for (const p of myTeam(s).players) {
    p.fitness = clamp(p.fitness + 15, 0, 100);
    p.mood = clamp(p.mood + 5, 0, 100);
  }
  let text = pick(REST_LINES);
  s.restCount++;
  const mishapChance = Math.max(0, s.restCount - 1) * 0.25;
  if (Math.random() < mishapChance) {
    const victims = myTeam(s).players.filter((p) => p.outWeeks === 0);
    if (victims.length) {
      const v = pick(victims);
      v.outWeeks = 2;
      v.outReason = 'lollygagging injury';
      text += ` ${pick(REST_MISHAPS)(v.name)}`;
      normalizeLineup(myTeam(s));
    }
  }
  s.restReport = text;
  save(s);
  return true;
}

export function actionSchmooze(s: GameState, prospectId: number, methodId: string): string | null {
  const pr = s.prospects.find((x) => x.id === prospectId);
  if (!pr || pr.bannedWeeks > 0 || !spend(s)) return null;
  const m = schmoozeById(methodId);
  let gain = m.gain[0] + rand(m.gain[1] - m.gain[0] + 1);
  let text: string;
  if (m.riskPct > 0 && Math.random() * 100 < m.riskPct) {
    if (m.riskHalvesGain) gain = Math.round(gain / 2);
    if (m.riskCommitDelta) gain = m.riskCommitDelta;
    if (m.riskIntegrity) s.integrity = clamp(s.integrity + m.riskIntegrity, 0, 100);
    if (m.riskBanWeeks) pr.bannedWeeks = m.riskBanWeeks + rand(2);
    text = m.riskText(pr.name);
    pr.commitPct = clamp(pr.commitPct + gain, 0, 95);
    text += ` (${pr.name}: ${gain >= 0 ? '+' : ''}${gain}% → ${pr.commitPct}%${m.riskBanWeeks ? `, NO CONTACT ${pr.bannedWeeks}w` : ''})`;
  } else {
    pr.commitPct = clamp(pr.commitPct + gain, 0, 95);
    text = pick(SCHMOOZE_SUCCESS_LINES)(pr.name, gain, pr.commitPct);
  }
  s.recruitLog.push(text);
  save(s);
  return text;
}

export function actionScan(s: GameState, regionId: string): string | null {
  const def = scanById(regionId);
  if (!s.unlockedRegions.includes(def.id)) return null;
  if (s.shipDamaged && !def.local) return null;
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
    ? `${pick(SCAN_FLAVOR_LINES)} ${found.map((p) => `${p.name} (${speciesById(p.speciesId).name} ${p.pos})`).join(', ')}.`
    : "Scan complete. The radar is full — the prospect board fits 9 names, maximum.";
  if (def.riskPct > 0 && Math.random() * 100 < def.riskPct) {
    s.shipDamaged = true;
    text += ` ${def.riskText}`;
  }
  s.recruitLog.push(text);
  save(s);
  return text;
}

export function actionDropProspect(s: GameState, prospectId: number): void {
  const pr = s.prospects.find((x) => x.id === prospectId);
  if (!pr) return;
  s.prospects = s.prospects.filter((x) => x.id !== prospectId);
  s.recruitLog.push(`You stop returning ${pr.name}'s calls. His holo-agent takes it about as well as expected.`);
  save(s);
}

function seedProspects(s: GameState, n: number): void {
  const counter = { nextId: s.nextId };
  for (let i = 0; i < n; i++) s.prospects.push(genProspect(counter, s.season, Math.random() < 0.5 ? 'home' : 'nebula'));
  s.nextId = counter.nextId;
}

// ---- the game -------------------------------------------------------------

export function playGame(s: GameState): void {
  normalizeLineup(myTeam(s));
  for (const t of s.teams) if (t.id !== s.myTeamId) autoLineup(t);

  const results = weekGames(s).map(([h, a]) => simGame(s.teams[h], s.teams[a]));
  s.postGame = [];

  for (const r of results) {
    const home = s.teams[r.homeId];
    const away = s.teams[r.awayId];
    home.pointsFor += r.homeScore; home.pointsAgainst += r.awayScore;
    away.pointsFor += r.awayScore; away.pointsAgainst += r.homeScore;
    const winner = r.homeScore > r.awayScore ? home : away;
    const loser = winner === home ? away : home;
    winner.wins++; loser.losses++;
    if (winner.id === s.myTeamId) s.totalWins++;

    for (const t of [home, away]) {
      const won = t === winner;
      const res = new Set(reserves(t).map((p) => p.id));
      const starterIds = new Set(Object.values(t.lineup.starters).filter((x): x is number => x !== null));
      for (const p of t.players) {
        if (p.outWeeks > 0) continue;
        const preFit = p.fitness;
        const preMood = p.mood;
        let role: PlayerDeltas['role'];
        let xpGain = 0;
        if (starterIds.has(p.id)) {
          role = 'starter';
          p.fitness = clamp(p.fitness - (14 + rand(7)), 0, 100);
          p.mood = clamp(p.mood + 2, 0, 100);
          xpGain = 9 + rand(5);
        } else if (!res.has(p.id)) {
          role = 'bench';
          p.fitness = clamp(p.fitness - (7 + rand(5)), 0, 100);
          xpGain = 4 + rand(3);
        } else {
          role = 'reserve';
          p.mood = clamp(p.mood - 4, 0, 100);
        }
        p.mood = clamp(p.mood + (won ? 4 : -4), 0, 100);
        if (xpGain > 0) addXp(p, xpGain);
        if (t.id === s.myTeamId) {
          s.postGame.push({ playerId: p.id, fit: p.fitness - preFit, mood: p.mood - preMood, xpGain, role });
        }
      }
    }
  }
  s.lastResults = results;
  s.phase = 'result';
  save(s);
}

export function continueFromResult(s: GameState): void {
  if (s.week >= TOTAL_WEEKS) endSeason(s);
  else {
    s.week++;
    startWeek(s);
  }
}

// ---- playoffs -------------------------------------------------------------

function setupPlayoffRound(s: GameState): void {
  if (s.week === REGULAR_WEEKS + 1) {
    const seeds = sortedStandings(s).map((t) => t.id);
    s.playoff = {
      round: 0,
      alive: seeds,
      games: [
        [seeds[0], seeds[7]],
        [seeds[3], seeds[4]],
        [seeds[1], seeds[6]],
        [seeds[2], seeds[5]],
      ],
    };
  } else if (s.playoff && s.week > REGULAR_WEEKS + 1) {
    const winners: number[] = [];
    for (const r of s.lastResults) {
      winners.push(r.homeScore > r.awayScore ? r.homeId : r.awayId);
    }
    s.playoff.round++;
    s.playoff.alive = winners;
    const games: [number, number][] = [];
    for (let i = 0; i < winners.length; i += 2) games.push([winners[i], winners[i + 1]]);
    s.playoff.games = games;
  }
}

// ---- offseason ------------------------------------------------------------

function endSeason(s: GameState): void {
  const final = s.lastResults[0];
  const champ = final
    ? s.teams[final.homeScore > final.awayScore ? final.homeId : final.awayId]
    : sortedStandings(s)[0];
  s.seasonChampion = `${champ.planet} ${champ.name}`;
  if (champ.id === s.myTeamId) s.trophies++;
  s.playoff = null;

  s.proDeparts = myTeam(s).players
    .filter((p) => overall(p) >= 85)
    .map((p) => ({ playerId: p.id, name: p.name, resolved: false, staying: false, note: '' }));

  for (const t of s.teams) {
    if (t.id !== s.myTeamId) t.players = t.players.filter((p) => overall(p) < 85);
    t.players = t.players.filter((p) => p.classYear < 3);
    for (const p of t.players) {
      p.classYear++;
      addXp(p, 20 + rand(15)); // an offseason of gym time
      // AI players auto-assign their level-ups; yours wait for you
      if (t.id !== s.myTeamId) {
        while (p.pendingPoints.length) {
          const packet = p.pendingPoints.shift()!;
          const k = pick(STAT_KEYS);
          p.stats[k] = clamp(p.stats[k] + packet, 5, statCap(p, k));
        }
      }
      p.outWeeks = 0; p.outReason = '';
      p.fitness = clamp(75 + rand(20), 0, 100);
      p.mood = clamp(p.mood + 10, 30, 90);
    }
    if (t.id !== s.myTeamId) {
      const counter = { nextId: s.nextId };
      while (t.players.length < ROSTER_SIZE) {
        const rookie = genProspect(counter, s.season, Math.random() < 0.3 ? 'outerrim' : 'nebula');
        t.players.push(prospectToPlayer(rookie));
      }
      s.nextId = counter.nextId;
      ensureUniqueJerseys(t.players);
      autoLineup(t);
    }
  }

  s.signingResults = [];
  s.commits = [];
  s.phase = 'recruiting';
  save(s);
}

function prospectToPlayer(pr: Prospect): Player {
  return {
    id: pr.id,
    name: pr.name,
    speciesId: pr.speciesId,
    classYear: 0,
    pos: pr.pos,
    jersey: Math.floor(Math.random() * 56),
    heightCm: pr.heightCm,
    weightKg: pr.weightKg,
    stats: pr.stats,
    potential: pr.potential,
    xp: 0,
    pendingPoints: [],
    fitness: 80 + rand(15),
    mood: 60 + rand(20),
    outWeeks: 0,
    outReason: '',
  };
}

export function convincePro(s: GameState, playerId: number): void {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  const p = myTeam(s).players.find((x) => x.id === playerId);
  if (!d || !p) return;
  d.resolved = true;
  const chance = clamp(15 + (p.mood - 40), 10, 80);
  if (Math.random() * 100 < chance) {
    d.staying = true;
    d.note = `You talk about legacy, about unfinished business, about banners. ${p.name} stays. (${chance}% and you hit it.)`;
  } else {
    d.staying = false;
    d.note = `${p.name} listens politely, then shows you the contract already on his holo. Gone. (${chance}% — missed.)`;
    myTeam(s).players = myTeam(s).players.filter((x) => x.id !== playerId);
  }
  save(s);
}

export function letGoPro(s: GameState, playerId: number): void {
  const d = s.proDeparts.find((x) => x.playerId === playerId && !x.resolved);
  if (!d) return;
  d.resolved = true;
  d.staying = false;
  d.note = `You shake his hand and tell him to make the galaxy proud. Draft night will have your program's name in it.`;
  myTeam(s).players = myTeam(s).players.filter((x) => x.id !== playerId);
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
    .map((prospect, i) => ({
      prospect,
      pct: Math.max(0, prospect.commitPct - (SIGNING_PENALTIES[i] ?? 95)),
    }));
}

export function resolveSigning(s: GameState): void {
  for (const d of s.proDeparts.filter((x) => !x.resolved)) {
    d.resolved = true;
    myTeam(s).players = myTeam(s).players.filter((x) => x.id !== d.playerId);
  }
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
  myTeam(s).players = chosen;
  ensureUniqueJerseys(myTeam(s).players);

  s.season++;
  s.week = 1;
  for (const t of s.teams) {
    t.wins = 0; t.losses = 0; t.pointsFor = 0; t.pointsAgainst = 0;
  }
  s.schedule = genSchedule(s.teams.length);
  s.prospects = [];
  s.commits = [];
  s.selectPool = [];
  s.signingResults = [];
  s.seasonChampion = null;
  s.shipDamaged = false;
  s.playoff = null;
  s.restCount = 0;
  s.proDeparts = [];
  s.lastResults = [];
  autoLineup(myTeam(s));
  seedProspects(s, 2);
  startWeek(s);
  return true;
}

// ---- persistence ----------------------------------------------------------

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable; play on without saves */
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
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export { rawOverall, xpNeed };
