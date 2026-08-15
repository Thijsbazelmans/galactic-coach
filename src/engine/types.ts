// Core data model. Everything here must stay plain-JSON-serializable
// (saves, and eventually cross-platform ports, depend on it).

/** The four stats. Physical rides fitness, Mental rides mood. */
export type StatKey = 'phy' | 'men' | 'off' | 'def';

export type Stats = Record<StatKey, number>;

export type Slot = 'G' | 'F' | 'C';

export interface Player {
  id: number;
  name: string;
  speciesId: string;
  /** 0=Fr 1=So 2=Jr 3=Sr */
  classYear: number;
  /** preferred position — playing elsewhere costs 20% (adjacent) or 50% (G↔C) */
  pos: Slot;
  /** jersey number, unique within a team */
  jersey: number;
  heightCm: number;
  weightKg: number;
  stats: Stats;
  /** growth ceiling — XP comes slower as overall approaches it */
  potential: number;
  /** progress toward the next level-up */
  xp: number;
  /** queued level-up point packets awaiting the coach's assignment */
  pendingPoints: number[];
  fitness: number;
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
  bg: string;
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
  stats: Stats;
  potential: number;
  blurb: string;
  commitPct: number;
  bannedWeeks: number;
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
  statDeltas?: Partial<Stats>;
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
  gambleDelay?: number;
  gamble?: { weight: number; text: string; effect: NewsEffect }[];
}

export interface FutureNews {
  weeksLeft: number;
  playerId: number | null;
  text: string;
  effect?: NewsEffect;
}

export interface NewsItem {
  playerId: number | null;
  text: string;
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

export interface PlayerDeltas {
  playerId: number;
  fit: number;
  mood: number;
  xpGain: number;
  role: 'starter' | 'bench' | 'reserve';
}

export interface Playoff {
  round: number;
  games: [number, number][];
  alive: number[];
}

export interface ProDepart {
  playerId: number;
  name: string;
  resolved: boolean;
  staying: boolean;
  note: string;
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
  week: number;
  phase: Phase;
  myTeamId: number;
  teams: Team[];
  schedule: [number, number][][];
  integrity: number;
  trophies: number;
  totalWins: number;
  news: NewsItem[];
  futureNews: FutureNews[];
  prospects: Prospect[];
  energy: number;
  press: PressQuestion | null;
  shipDamaged: boolean;
  unlockedTraining: string[];
  unlockedRegions: string[];
  restReport: string | null;
  restCount: number;
  proDeparts: ProDepart[];
  recruitLog: string[];
  postGame: PlayerDeltas[];
  playoff: Playoff | null;
  commits: Player[];
  selectPool: Player[];
  signingResults: string[];
  lastResults: GameResult[];
  seasonChampion: string | null;
  nextId: number;
}
