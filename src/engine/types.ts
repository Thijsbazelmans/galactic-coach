// Core data model for v2.0 (the four-attribute rework). Everything here must
// stay plain-JSON-serializable — saves depend on it. All story/behavior
// functions live in data.ts and are looked up by id.

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

// ---- the four attributes ----------------------------------------------------
// Each runs 0–25. OVERALL = the sum (theoretical max 100; species caps keep
// every real player below it). Position is NOT an attribute — it's body size.

export type Attr = 'skl' | 'ath' | 'frc' | 'brn';
export type AttrRec = Record<Attr, number>;

export type PlanId = 'showtime' | 'rungun' | 'lockdown' | 'clockwork';

// ---- the box score ----------------------------------------------------------
// One stat per attribute: points=SKL, rebounds=ATH, steals=FRC, assists=BRN.

export interface StatLine {
  gp: number;
  pts: number;
  reb: number;
  stl: number;
  ast: number;
  /** in-game MVP awards: best combined line on the team that night */
  mvp: number;
}

// ---- species (interface only — real species design is its own session) ------

export interface SpeciesDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  /** hard per-attribute ceiling (0–25) — no member ever exceeds these */
  attrCaps: AttrRec;
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
  /** body form + pronouns (she/her for femme); old saves default to masc */
  form?: 'masc' | 'femme';
  jersey: number;
  heightCm: number;
  weightKg: number;
  /** the four attributes, 0–25 each */
  attrs: AttrRec;
  /** per-attribute personal ceiling: attrs ≤ pots ≤ species caps */
  pots: AttrRec;
  /** season-start snapshot (the GROWTH lens shows the journey) */
  startAttrs: AttrRec;
  /** this season's box-score totals */
  stats: StatLine;
  /** past seasons, folded in at each season end */
  career: StatLine;
  /** 0–10 hard cap; each level banks +2 points the coach assigns */
  level: number;
  xp: number;
  /** live meters 0–100; energy mutes ATH+FRC, mood mutes SKL+BRN */
  energy: number;
  mood: number;
  /** the hot streak: 20+ points lights it, everything plays +20% until he cools */
  onFire?: boolean;
  outWeeks: number;
  outReason: string;
  /** consecutive games without minutes */
  dnp: number;
  walkOn?: boolean;
  gem?: boolean;
  special?: 'daughter' | 'droid';
}

/** The grid IS the lineup: 9 slots row-major. Rows: starters/bench/reserves.
    Columns: 0 backcourt, 1 wing, 2 frontcourt. */
export interface Lineup {
  slots: (number | null)[];
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
  form?: 'masc' | 'femme';
  heightCm: number;
  weightKg: number;
  /** the truth (hidden until scouted) */
  attrs: AttrRec;
  pots: AttrRec;
  /** 0 = a rumor (cloud), 1 = one look (haze), 2 = locked truth */
  scoutLevel: number;
  /** the coach's observation, error shrinking with scoutLevel */
  seenAttrs: AttrRec;
  seenPots: AttrRec;
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
  /** direct attribute deltas (positive clamps at the player's pots) */
  attr?: Partial<AttrRec>;
  /** per-attribute potential deltas (clamped between attrs and species caps) */
  potAttr?: Partial<AttrRec>;
  /** n points sprinkled onto random attributes below their pots (negative removes) */
  anyAttr?: number;
  /** n potential points sprinkled onto random attributes below species caps */
  anyPot?: number;
  xp?: number;
  levelDelta?: number;
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
  unlockPlan?: PlanId;
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
  form?: 'masc' | 'femme';
  ovr: number;
  /** how he left: 'pro' | 'grad' | 'void' */
  exit: 'pro' | 'grad' | 'void';
  season: number;
  /** full career box-score totals — the statistical ghost he leaves behind */
  career: StatLine;
}

// ---- game results ---------------------------------------------------------------

export interface BoxRow {
  playerId: number;
  name: string;
  pts: number;
  reb: number;
  stl: number;
  ast: number;
}

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
  box: BoxRow[];
}

export interface PlayerDeltas {
  playerId: number;
  energyP: number;
  mood: number;
  xpGain: number;
  fire?: 'lit' | 'out';
}

// ---- the Universal Tournament -----------------------------------------------

export interface ChampTeam {
  name: string;
  gimmick: string;
  bg: string;
  fg: string;
  plan: PlanId;
  power: number;
  /** the scout-report shape: a representative team kite */
  kite: AttrRec;
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
  /** the tactics the coach has learned — the others wait in stories */
  knownPlans: PlanId[];
  /** one-time assistant-coach explainers, by key */
  tipsSeen: string[];
  /** auto-show tips (the ? button always works) */
  tipsAuto: boolean;
  /** the ship: 0 = flying; >0 = grounded (home-planet scouting only, no deep scans) */
  groundedWeeks: number;

  /** weekly flags */
  trainedThisWeek: boolean;
  /** recruiting rations: one DISCOVER, one SCOUT, one RECRUIT per week */
  discoveredWk?: boolean;
  scoutActWk?: boolean;
  recruitActWk?: boolean;
  /** the coach's speech: commits the game plan, once, before tip-off */
  speechWk?: boolean;
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
