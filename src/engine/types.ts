// Core data model. Everything here must stay plain-JSON-serializable
// (saves, and eventually cross-platform ports, depend on it).

/** 8 attributes, displayed as 4 stats of 2 parts each:
 *  Physical: agi/str · Technical: han/sho · Defense: foc/agg · Mental: iq/tou */
export type AttrKey = 'agi' | 'str' | 'han' | 'sho' | 'foc' | 'agg' | 'iq' | 'tou';

export type Slot = 'G' | 'F' | 'C';

export type Attrs = Record<AttrKey, number>;

export interface Player {
  id: number;
  name: string;
  speciesId: string;
  /** 0=Freshman 1=Sophomore 2=Junior 3=Senior */
  classYear: number;
  /** preferred position — playing elsewhere costs 20% (adjacent) or 50% (G↔C) */
  pos: Slot;
  /** jersey number, unique within a team */
  jersey: number;
  heightCm: number;
  weightKg: number;
  attrs: Attrs;
  /** growth ceiling for training/development */
  potential: number;
  /** 0-100, constantly moving; boosts/drags strength & agility */
  fitness: number;
  /** 0-100, constantly moving; boosts/drags focus & iq */
  mood: number;
  outWeeks: number;
  outReason: string;
  walkOn?: boolean;
  gem?: boolean;
}

export interface Lineup {
  starters: Record<Slot, number | null>;
  bench: Record<Slot, number | null>;
}

export interface Team {
  id: number;
  name: string;
  planet: string;
  region: string;
  /** jersey background */
  bg: string;
  /** letter color */
  fg: string;
  players: Player[];
  lineup: Lineup;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Prospect {
  id: number;
  name: string;
  speciesId: string;
  pos: Slot;
  heightCm: number;
  weightKg: number;
  attrs: Attrs;
  potential: number;
  blurb: string;
  /** built up week by week via schmoozing */
  commitPct: number;
  /** league caught you wining him — no contact for this many weeks */
  bannedWeeks: number;
  /** ticked on the signing-day screen */
  selected: boolean;
}

/** Anything a news event can do to a player, the team, or the coach. */
export interface NewsEffect {
  integrityDelta?: number;
  moodDelta?: number;
  weightDelta?: number;
  fitnessDelta?: number;
  outWeeks?: number;
  outReason?: string;
  attrDeltas?: Partial<Attrs>;
  /** coach-level effects */
  energyDelta?: number;
  teamMoodDelta?: number;
  teamFitnessDelta?: number;
  unlockTraining?: boolean;
  unlockRegion?: string;
  shipDamage?: boolean;
}

export interface EventChoice extends NewsEffect {
  label: string;
  outcome: string;
  /** gamble: the real outcome lands later as future news */
  gambleDelay?: number;
  gamble?: { weight: number; text: string; effect: NewsEffect }[];
}

/** A news item scheduled to land in a future week (gamble payoffs). */
export interface FutureNews {
  weeksLeft: number;
  playerId: number | null;
  text: string;
  effect?: NewsEffect;
}

export interface NewsItem {
  playerId: number | null;
  text: string;
  /** present = a decision the coach must make before continuing */
  choices?: EventChoice[];
  resolvedText?: string;
}

export interface PressQuestion {
  text: string;
  options: string[];
  correctIdx: number;
  answered: boolean;
  wasCorrect?: boolean;
}

/** what one game did to one of my players — for the post-game animation */
export interface PlayerDeltas {
  playerId: number;
  fit: number;
  mood: number;
  xp: { attr: AttrKey; amt: number }[];
  role: 'starter' | 'bench' | 'reserve';
}

export interface Playoff {
  /** 0 = quarterfinals, 1 = semifinals, 2 = the Galactic Final */
  round: number;
  games: [number, number][];
  alive: number[];
}

export interface TrainingResult {
  typeId: string;
  lines: { playerId: number; name: string; gains: Partial<Attrs>; breakthrough: boolean }[];
}

export interface BoxLine {
  playerId: number;
  name: string;
  teamId: number;
  pts: number;
}

export interface GameResult {
  homeId: number;
  awayId: number;
  homeScore: number;
  awayScore: number;
  box: BoxLine[];
  starLine: string;
}

/** -1..1 sliders. pace: slow↔fast · plays: freelance↔run-plays · scheme: press↔zone */
export interface TacticsSet {
  pace: number;
  plays: number;
  scheme: number;
}

export interface ProDepart {
  playerId: number;
  name: string;
  resolved: boolean;
  staying: boolean;
  note: string;
}

export type Phase =
  | 'pickTeam'
  | 'news'
  | 'training'
  | 'scouting'
  | 'lineup'
  | 'result'
  | 'recruiting'
  | 'teamSelect';

export interface GameState {
  version: number;
  season: number;
  week: number; // 1-based
  phase: Phase;
  myTeamId: number;
  teams: Team[];
  /** schedule[week-1] = list of [homeId, awayId] */
  schedule: [number, number][][];
  integrity: number;
  trophies: number;
  totalWins: number;
  news: NewsItem[];
  futureNews: FutureNews[];
  prospects: Prospect[];
  /** weekly action budget; press-conference bonus can push it to 4 */
  energy: number;
  press: PressQuestion | null;
  /** scan mishap: no more scans until next season */
  shipDamaged: boolean;
  lastTraining: TrainingResult | null;
  restReport: string | null;
  /** coach skill tree: which training methods & scan regions you know */
  unlockedTraining: string[];
  unlockedRegions: string[];
  /** week-off uses this season; mishap odds climb with each one */
  restCount: number;
  tactics: TacticsSet;
  oppScouted: boolean;
  proDeparts: ProDepart[];
  recruitLog: string[];
  postGame: PlayerDeltas[];
  playoff: Playoff | null;
  /** signed recruits waiting for the team-selection screen */
  commits: Player[];
  /** the 12-player pool on the team-selection screen */
  selectPool: Player[];
  signingResults: string[];
  lastResults: GameResult[];
  seasonChampion: string | null;
  nextId: number;
}
