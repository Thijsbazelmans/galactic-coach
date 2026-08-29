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
export type PlanId = 'showtime' | 'rungun' | 'lockdown' | 'clockwork' | 'warcry' | 'zenmind' | 'stardust' | 'engine' | 'rally' | 'easy';

/** A landed speech: the room ignited — every player plays +amt in that attribute. */
export interface SpeechFx {
  attr: Attr;
  amt: number;
}

// ---- the box score ----------------------------------------------------------
// One stat per attribute: points=SKL, rebounds=FRC, steals=ATH, assists=BRN —
// brainy players run the offense, fierce ones own the glass, athletes jump
// the passing lanes, skilled ones score. Distribution, not outcomes.

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
  /** his POSITION, assigned at generation: 0 = G (backcourt), 1 = F (wing),
      2 = C (frontcourt). Standing elsewhere costs a mismatch penalty —
      unless his numbers there are as good as at home (train a forward
      enough BRAINS and he's a guard who can also play forward). */
  pos?: number;
  /** a retrained position keeps the old one as a second home: no mismatch
      penalty at either */
  pos2?: number;
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
  /** WHY he's out: an injury (medicine takes weeks off it) or an absence —
      festival, exchange, suspension, a newborn (only time itself helps) */
  outKind?: 'injury' | 'away';
  /** consecutive games without minutes */
  dnp: number;
  /** consecutive games STARTED — the weekend recovery shrinks as it stacks */
  startStreak?: number;
  /** a delayed-outcome story is hanging over him — the sprite stays NERVOUS
      (worried) until the result beat lands */
  tense?: boolean;
  /** games in street clothes before he knocks on your door (2–6, his temper) */
  patience?: number;
  /** the dnp count at his last complaint — he knocks again `patience` later */
  gripe?: number;
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
  /** his position (G/F/C) — scoutable; the sprite's size is a giveaway */
  pos?: number;
  /** the truth (hidden until scouted) */
  attrs: AttrRec;
  pots: AttrRec;
  /** college-readiness: the level he'd join at (2–4) — his numbers are where
      that level puts him on his ceiling */
  level?: number;
  /** scout actions absorbed — the observation fuzz tightens with each */
  scoutLevel: number;
  /** the coach's observation, error shrinking with scoutLevel */
  seenAttrs: AttrRec;
  seenPots: AttrRec;
  /** revealed facets */
  seenSkill: boolean; // the ability cloud shows
  seenPot: boolean; // the potential cloud shows
  seenPos?: boolean; // his position (G/F/C) is known
  /** the BLANK CHECK landed: he signed then and there — greyed on the
      board, unremovable, committed */
  signed?: boolean;
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
  /** injury (medical items apply) or away (time items apply); an unset kind
      on a fresh absence means AWAY, on a running absence keeps what it was */
  outKind?: 'injury' | 'away';
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
  unlockInstr?: string;
  commit?: number; // recruiting context: prospect commitment delta
  intel?: boolean; // recruiting context: sharpen the prospect
  takePlayer?: boolean; // remove target from roster → alumnus of the void
  addPlayer?: 'walkon' | 'gem' | 'daughter' | 'droid';
  weightKg?: number;
  gameover?: 'void' | 'fired' | 'retired';
}

// ---- THE NOTEBOOK -------------------------------------------------------------
// A permanent fixture of THE BAG: tap it during a dialog or screen and it
// notes something noteworthy. Notes answer press questions and (later) feed
// story callbacks.

export interface NotebookEntry {
  season: number;
  week: number;
  /** 'story' | 'mvp' | 'results' | 'opp' | 'screen' */
  kind: string;
  /** lookup/dedupe key, e.g. 'mvp:1:3' */
  key: string;
  text: string;
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
  /** THE ROPE: my win share (0–1) and where the night landed on it */
  share: number;
  needle: number;
  home: boolean;
  /** tonight's MVP — best combined line; his card wears the tag */
  mvpId?: number;
  /** THE FORM ROLL: 1 = STANDOUT! (played +15%, learned something), -1 = OFF
      DAY (played −15%) — revealed on the box-score grid */
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
  /** match power (≈ top-six average × 3 — the same number the bars run on) */
  power: number;
  /** the bracket tier this champion was sized for: 0 = first round · 1 = semi · 2 = final */
  tier: number;
  /** the average player rating of their top six (the slide: 65–75 / 70–80 / 75–85) */
  avg: number;
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
  | 'scouting'
  | 'practice'
  | 'recruiting'
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
  /** THE RUBBER BAND on the slide: every BIG BANG title raises the field
      (+3 per title, cap +9); a season without a tournament win eases it
      (−2, floor −6). Applied to the champions' averages, half to the
      conference tiers. */
  fieldShift?: number;
  totalWins: number;

  /** popup queue for the current phase + scheduled future beats */
  queue: StoryEvent[];
  futureBeats: FutureBeat[];

  prospects: Prospect[];
  /** search results waiting in the 4th row — swap them onto the board or let them go */
  pendingRecruits: Prospect[];
  bag: string[]; // item ids, max 8 (the notebook stands tall beside them, forever)
  /** THE NOTEBOOK: newest first, capped */
  notebook: NotebookEntry[];
  legendariesUsed: string[]; // reset each season

  unlockedDrills: string[];
  unlockedRegions: string[];
  /** the tactics the coach has learned — the others wait in stories */
  knownPlans: PlanId[];
  /** last-minute instructions learned (the counter is known from day one) */
  knownInstr?: string[];
  /** one-time assistant-coach explainers, by key */
  tipsSeen: string[];
  /** auto-show tips (the ? button always works) */
  tipsAuto: boolean;
  /** the ship: 0 = flying; >0 = grounded (home-planet scouting only, no deep scans) */
  groundedWeeks: number;

  /** weekly flags */
  trainedThisWeek: boolean;
  /** SCOUTING: one board-wide move (search for talent / read the board) */
  scoutActWk: boolean;
  /** RECRUITING: one board-wide move (your own work / the booster's help) */
  recruitActWk: boolean;
  /** the pregame move: mandatory, once — a SPEECH or LAST-MINUTE INSTRUCTIONS */
  pregameWk?: boolean;
  /** THE SPEECH is a SHIFT: +amt in one attribute, −amt in its opposite — two
      entries (or one negative entry: an instruction that got READ) */
  speechFx?: SpeechFx[] | null;
  /** a landed instruction: THEIR side plays this (amt is negative) */
  oppFx?: SpeechFx | null;
  /** premium speeches recharge: planId → weeks until it can be given again */
  speechCooldowns?: Record<string, number>;
  sitouts: number[];
  drillReport: string | null;
  voyageRolled: boolean;

  plan: PlanId;
  pregameFlags: { wallet?: boolean; cloak?: boolean; alarm?: boolean };
  lastResult: MyGameResult | null;
  postGame: PlayerDeltas[];
  /** everything the horn caused (injuries, ON FIRE, the frozen one's verdict)
      waits here until the final score has been seen — never mid-game */
  heldStories?: StoryEvent[];
  /** the record as it stood at tip-off: the header shows THIS while the game
      plays — the result is only news at the horn */
  preGame?: { wins: number; losses: number; rank: number } | null;
  /** THE FROZEN ONE knocked at PLAY and you promised him the floor tonight:
      who, and who stood on the floor when you said it (so the one HE displaces
      can hold it against you after the game) */
  promise?: { playerId: number; floor: number[]; week: number } | null;
  /** the frozen one was told to earn it — tip-off resumes the moment the
      story closes */
  resumePlay?: boolean;
  /** THE NIGHT'S INTERRUPTIONS: ON FIRE / an injury, rolled at tip-off and
      held until the live game is half done — then the coach decides */
  midStories?: StoryEvent[];
  /** the game is simmed but not FINAL: the mid-game choices still shift it */
  gamePending?: boolean;
  /** what the mid-game choices did to the night (+ cook · − a swapped-out injury) */
  gameShift?: number;
  /** injuries decided mid-game, applied when the horn sounds */
  gameInjuries?: { playerId: number; weeks: number; label: string; levelLoss: boolean; tape: boolean }[];
  /** the last-minute instruction is GIVEN on the matchup screen and only
      resolves at tip-off */
  instrPending?: string | null;
  /** TAKE IT EASY: the squad coasts tonight (less burn, less power) */
  easyNight?: boolean;
  /** WEEK START: the Monday report — banked XP + the weekend's recovery per player */
  weekRecap?: PlayerDeltas[];
  /** the week's stories, held until the coach walks into the building */
  storedStories?: StoryReq[];
  resultsLog: string[]; // other games this week, one line each

  ut: UtState | null;
  /** my season so far, one line per played game (the schedule dialog) */
  myResults?: { week: number; win: boolean; text: string }[];
  alumni: Alumnus[];
  voidReturnUsed: boolean;

  proDeparts: ProDepart[];
  commits: Player[];
  selectPool: Player[];
  /** THE SUMMER, shown on the selection grid: per-returner growth (old OVR →
      the card's number now, blinking the delta in place) */
  summerRecap?: { playerId: number; ovrFrom: number; note?: string }[];
  signingResults: string[];
  seasonNotes: string[];
  seasonChampion: string | null;

  end: CareerEnd | null;
  careerLog: string[];

  nextId: number;
  nextUid: number;
}
