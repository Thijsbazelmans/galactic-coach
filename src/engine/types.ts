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

/** Speech ids (the old tactics are speeches now; premium ones come from stories). */
export type PlanId = 'showtime' | 'rungun' | 'lockdown' | 'clockwork' | 'warcry' | 'zenmind' | 'stardust' | 'engine';

/** A landed speech: the room ignited — every player plays +amt in that attribute. */
export interface SpeechFx {
  attr: Attr;
  amt: number;
}

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

// ---- species (THE GROWTH & SPECIES rework) -----------------------------------
// Hard attr caps are DEAD: a species shapes WHERE the talent points (bias) and
// HOW MUCH ceiling the galaxy deals it (band odds). The only hard walls left
// are the 0–25 attribute scale and level 10.

export interface SpeciesDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  /** compass shape profile: the 0–2 attributes this species leans into.
      terran & nimbus are balanced (empty). Six species, six distinct biases. */
  bias: Attr[];
  /** potential-band odds (%, sums 100) over 0–19/20–39/40–59/60–79/80–99 */
  bands: [number, number, number, number, number];
  heightRange: [number, number];
  weightRange: [number, number];
  desc: string;
  /** 0 = everywhere · 1 = pretty common · 2 = fairly rare · 3 = very rare */
  rarity: number;
}

// ---- players ----------------------------------------------------------------

export interface Player {
  id: number;
  name: string;
  speciesId: string;
  /** 0=Fr 1=So 2=Jr 3=Sr */
  classYear: number;
  /** body form + pronouns: femme she/her, x they/them (nimbus/gelid/robota) */
  form?: 'masc' | 'femme' | 'x';
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
  /** consecutive games STARTED — the weekend recovery shrinks as it stacks */
  startStreak?: number;
  /** a delayed-outcome story is hanging over him — the sprite stays NERVOUS
      (worried) until the result beat lands */
  tense?: boolean;
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
// A fresh name is a total stranger: no clouds, all ??'s. Scouting reveals
// FACETS one by one — the ability cloud, the potential cloud, and the two
// rating digits (?? → X? or ?X → XX).

export interface Prospect {
  id: number;
  name: string;
  speciesId: string;
  form?: 'masc' | 'femme' | 'x';
  heightCm: number;
  weightKg: number;
  /** the truth (hidden until scouted) */
  attrs: AttrRec;
  pots: AttrRec;
  /** scout actions absorbed — the observation fuzz tightens with each */
  scoutLevel: number;
  /** the coach's observation, error shrinking with scoutLevel */
  seenAttrs: AttrRec;
  seenPots: AttrRec;
  /** revealed facets */
  seenSkill: boolean; // the ability cloud shows
  seenPot: boolean; // the potential cloud shows
  digits: 0 | 1 | 2; // rating digits revealed: ?? → X?/?X → XX
  digitFirst: 'tens' | 'ones'; // which digit the first reveal uncovered
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
  /** what the PLAYER wants: his reaction lands the moment you pick —
      'love' = this keeps him playing/going (elated), 'hate' = it sidelines
      him (mad). Undefined = the outcome decides the acting. */
  want?: 'love' | 'hate';
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
  /** a delayed outcome hangs over him: he stays NERVOUS until the result
      beat lands (cleared automatically when his next story resolves) */
  tense?: boolean;
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
  form?: 'masc' | 'femme' | 'x';
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

/** One half's needle: my score, their score, my rope share, where it landed. */
export interface HalfScore {
  my: number;
  opp: number;
  share: number;
  needle: number;
}

export interface MyGameResult {
  win: boolean;
  myScore: number;
  oppScore: number;
  oppName: string;
  planMine: PlanId;
  wheelLine: string;
  heroLine: string;
  boxLine: string;
  box: BoxRow[];
  /** THE NEEDLE: my win share of the rope (0–1) and where the needle landed
      (the second half's pair; kept top-level for old saves mid-game-night) */
  share: number;
  needle: number;
  home: boolean;
  /** HALFTIME: the two halves (absent only on pre-halftime saves) */
  h1?: HalfScore;
  h2?: HalfScore;
  /** tonight's MVP — best combined line; his card wears the tag */
  mvpId?: number;
}

/** The game paused between halves: everything H2 needs to pick it back up. */
export interface HalftimeState {
  myH1: number;
  oppH1: number;
  share: number;
  needle: number;
  /** the pregame speech (its attribute colors the box-score dealing) */
  planMine: PlanId;
  /** H1 box rows — stickers at the half; season stats commit after H2 */
  box: BoxRow[];
  home: boolean;
  oppName: string;
  /** halftime energy drains by player id (negative), folded into postGame */
  drains: Record<number, number>;
  /** THE FORM ROLL: a real hidden per-game roll the halftime stickers reveal —
      1 = STANDOUT! (plays +15%, the hot night teaches him something),
      -1 = OFF DAY (plays −15%). Rolled for the H1 floor, holds all game. */
  forms?: Record<number, 1 | -1>;
  /** what the STANDOUT bump landed, per player ("+1 ATH") — for the sticker */
  formGain?: Record<number, string>;
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
  | 'weekstart'
  | 'stories'
  | 'practice'
  | 'galaxy'
  | 'matchup'
  | 'gamenight'
  | 'departures'
  | 'signing'
  | 'gameover';

/** A story waiting for the week to properly begin (they knock after WEEK START). */
export interface StoryReq {
  defId: string;
  beat: string;
  playerId: number | null;
  data?: Record<string, unknown>;
}

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
  /** search results waiting in the 4th row — swap them onto the board or let them go */
  pendingRecruits: Prospect[];
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
  /** recruiting: ONE board-wide action per week (scout all / recruit all / search) */
  galaxyActWk: boolean;
  /** the coach's speech: mandatory, once, before tip-off */
  speechWk?: boolean;
  /** HALFTIME: the second speech (its own roll) */
  speechH2?: boolean;
  planH2?: PlanId | null;
  /** rolled speech outcomes: the room ignited (or null) — one per half */
  speechFx?: SpeechFx | null;
  speechFxH2?: SpeechFx | null;
  sitouts: number[];
  drillReport: string | null;
  voyageRolled: boolean;

  plan: PlanId;
  pregameFlags: { wallet?: boolean; cloak?: boolean; alarm?: boolean };
  /** set when H1 is in the books and the locker room is waiting */
  halftime?: HalftimeState | null;
  lastResult: MyGameResult | null;
  postGame: PlayerDeltas[];
  /** WEEK START: the Monday report — banked XP + the weekend's recovery per player */
  weekRecap?: PlayerDeltas[];
  /** the week's stories, held until the coach walks into the building */
  storedStories?: StoryReq[];
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
