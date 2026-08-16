// Core data model for v1.0 (see SPEC.md). Everything here must stay
// plain-JSON-serializable — saves depend on it. All story/behavior functions
// live in data.ts and are looked up by id.

// ---- the odds line ----------------------------------------------------------

/** Every chance in the game is one of five rungs. No bespoke odds, ever. */
export type Rung = 2 | 5 | 10 | 25 | 50;

export type BoonClass = 'BREAKTHROUGH' | 'SPIRIT' | 'WINDFALL' | 'LOOT' | 'INTEL';
export type DangerClass = 'INJURY' | 'DRAMA' | 'SCANDAL' | 'SHIP' | 'DRAIN';

export interface OddsTail {
  pct: number; // a rung, possibly doubled by a printed modifier
  cls: BoonClass | DangerClass;
  note?: string; // printed cause of a modifier ("Raijinn ⚡ low")
}

// ---- axes & poles -----------------------------------------------------------

/** BUILD: 0 = pure Strong, 100 = pure Quick. HEAD: 0 = pure Fierce, 100 = pure Savvy. */
export type Pole = 'strong' | 'quick' | 'fierce' | 'savvy';

export type PlanId = 'pound' | 'blitz' | 'swarm' | 'clockwork';

// ---- species (interface only — real species design is its own session) ------

export interface SpeciesDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  /** max lean per pole (0–100): how far from center a member can ever sit */
  poleCaps: Record<Pole, number>;
  heightRange: [number, number];
  weightRange: [number, number];
  desc: string;
  rarity: number;
}

// ---- players ----------------------------------------------------------------

export interface Player {
  id: number;
  name: string;
  speciesId: string;
  /** 0=Fr 1=So 2=Jr 3=Sr */
  classYear: number;
  jersey: number;
  heightCm: number;
  weightKg: number;
  /** the two axes, 0–100, 50 = dead center */
  build: number;
  head: number;
  /** the ONLY big number: 0–99 */
  skill: number;
  /** hidden personal cap on SKILL — the UI only ever shows stars */
  potential: number;
  /** 0–10 hard cap; how much growth is left in the tank */
  level: number;
  xp: number;
  /** live meters 0–100; energy mutes BUILD, mood mutes HEAD */
  energy: number;
  mood: number;
  outWeeks: number;
  outReason: string;
  /** consecutive games without minutes */
  dnp: number;
  walkOn?: boolean;
  gem?: boolean;
  special?: 'daughter' | 'droid';
}

export interface Lineup {
  starters: (number | null)[];
  bench: (number | null)[];
}

export interface Team {
  id: number;
  name: string;
  planet: string;
  region: string;
  bg: string;
  fg: string;
  players: Player[];
  lineup: Lineup;
  plan: PlanId;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

// ---- prospects (everything the coach knows is an observation) ---------------

export interface Prospect {
  id: number;
  name: string;
  speciesId: string;
  heightCm: number;
  weightKg: number;
  /** the truth (hidden until scouted) */
  build: number;
  head: number;
  skill: number;
  potential: number;
  /** 0 = a rumor, 1 = one look (±1 star), 2 = locked truth */
  scoutLevel: number;
  seenSkillStar: number;
  seenPotStar: number;
  seenBuild: number;
  seenHead: number;
  blurb: string;
  commitPct: number;
  bannedWeeks: number;
  selected: boolean;
}

// ---- stories -----------------------------------------------------------------

export interface StoryChoiceView {
  key: string;
  label: string;
  cost?: number; // ⚡, printed
  up?: OddsTail;
  down?: OddsTail;
  itemId?: string; // set when this button is an injected bag item
  disabled?: string; // printed reason
}

/** A materialized popup, fully serializable. Behavior lives in data.ts by defId. */
export interface StoryEvent {
  uid: number;
  defId: string;
  beat: string;
  tag: string;
  playerId: number | null;
  text: string;
  choices?: StoryChoiceView[];
  resolvedText?: string;
  data?: Record<string, unknown>;
}

export interface FutureBeat {
  weeksLeft: number;
  defId: string;
  beat: string;
  playerId: number | null;
  data?: Record<string, unknown>;
}

/** Anything a resolved choice can do. Applied by the engine, floated by the UI. */
export interface Fx {
  playerId?: number; // override target (defaults to the event's player)
  skill?: number;
  xp?: number;
  levelDelta?: number;
  potential?: number;
  build?: number;
  head?: number;
  energyP?: number;
  mood?: number;
  teamMood?: number;
  teamEnergyP?: number;
  outWeeks?: number;
  outReason?: string;
  coachEnergy?: number;
  heatS?: number;
  heatB?: number;
  legacy?: number;
  giveItem?: string;
  loseItemIdx?: number;
  unlockDrill?: string;
  unlockRegion?: string;
  commit?: number; // recruiting context: prospect commitment delta
  intel?: boolean; // recruiting context: sharpen the prospect
  takePlayer?: boolean; // remove target from roster → alumnus of the void
  addPlayer?: 'walkon' | 'gem' | 'daughter' | 'droid';
  weightKg?: number;
  gameover?: 'void' | 'fired';
}

// ---- alumni -------------------------------------------------------------------

export interface Alumnus {
  name: string;
  speciesId: string;
  skill: number;
  /** how he left: 'pro' | 'grad' | 'void' */
  exit: 'pro' | 'grad' | 'void';
  season: number;
}

// ---- game results ---------------------------------------------------------------

export interface MyGameResult {
  win: boolean;
  myScore: number;
  oppScore: number;
  oppName: string;
  planMine: PlanId;
  planOpp: PlanId;
  wheel: 'win' | 'lose' | 'tie';
  wheelLine: string;
  heroLine: string;
  boxLine: string;
}

export interface PlayerDeltas {
  playerId: number;
  energyP: number;
  mood: number;
  xpGain: number;
}

// ---- the Universal Tournament -----------------------------------------------

export interface ChampTeam {
  name: string;
  gimmick: string;
  bg: string;
  fg: string;
  plan: PlanId;
  power: number;
  /** three dots for the scout-report blob */
  dots: { build: number; head: number }[];
}

export interface UtState {
  round: number; // 0=QF 1=SF 2=FINAL
  champs: ChampTeam[]; // the 7 others
  myNextOpp: number; // index into champs
  log: string[];
}

// ---- career -------------------------------------------------------------------

export interface CareerEnd {
  cause: 'RETIRED' | 'FIRED' | 'LOST TO THE VOID';
  text: string;
}

// ---- state ----------------------------------------------------------------------

export type Phase =
  | 'pickTeam'
  | 'teamSelect'
  | 'stories'
  | 'practice'
  | 'galaxy'
  | 'matchup'
  | 'gamenight'
  | 'departures'
  | 'signing'
  | 'growth'
  | 'gameover';

export interface ProDepart {
  playerId: number;
  name: string;
  resolved: boolean;
  staying: boolean;
  note: string;
}

export interface GameState {
  version: number;
  season: number;
  week: number;
  phase: Phase;
  myTeamId: number;
  teams: Team[];
  schedule: [number, number][][];

  /** the coach's power cells: cache 0–12, stipend +6/week (shrinks from season 21) */
  energy: number;

  /** THE HOT SEAT: school heat fills from the left, booster heat from the right */
  heatS: number;
  heatB: number;
  /** one interference per crossing; resets when that side cools below 40 */
  interferedS: boolean;
  interferedB: boolean;

  legacy: number;
  trophies: number;
  utTitles: number;
  totalWins: number;

  /** popup queue for the current phase + scheduled future beats */
  queue: StoryEvent[];
  futureBeats: FutureBeat[];

  prospects: Prospect[];
  bag: string[]; // item ids, max 5
  legendariesUsed: string[]; // reset each season

  unlockedDrills: string[];
  unlockedRegions: string[];
  /** one-time assistant-coach explainers, by key */
  tipsSeen: string[];
  /** the ship: 0 = flying; >0 = grounded (home-planet scouting only, no deep scans) */
  groundedWeeks: number;

  /** weekly flags */
  trainedThisWeek: boolean;
  sitouts: number[];
  scoutedOpp: boolean;
  drillReport: string | null;
  voyageRolled: boolean;

  plan: PlanId;
  pregameFlags: { wallet?: boolean; cloak?: boolean };
  lastResult: MyGameResult | null;
  postGame: PlayerDeltas[];
  resultsLog: string[]; // other games this week, one line each

  ut: UtState | null;
  alumni: Alumnus[];
  voidReturnUsed: boolean;

  proDeparts: ProDepart[];
  commits: Player[];
  selectPool: Player[];
  signingResults: string[];
  seasonNotes: string[];
  seasonChampion: string | null;

  end: CareerEnd | null;
  careerLog: string[];

  nextId: number;
  nextUid: number;
}
