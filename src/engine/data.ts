// All game content: species, teams, names, drills, regions, recruiting acts,
// THE BAG, the Universal Tournament pools, and the story registry.
// Content is data + pure decision functions; the engine (state.ts) applies Fx.

import type {
  Attr,
  FacId,
  Fx,
  GameState,
  OddsTail,
  PlanId,
  Player,
  SpeciesDef,
  StoryChoiceView,
  StoryEvent,
} from './types';
import { ATTRS, clamp, genderize, ovr, pick, rand, roll, security } from './util';

export const CLASS_ABBR = ['Fr', 'So', 'Jr', 'Sr'];

// ---- species (THE GROWTH & SPECIES rework) ----------------------------------
// Hard attr caps are DEAD. A species now carries two dials:
//   BIAS — the compass shape profile (0–2 attributes it leans into; terran and
//          nimbus are balanced in all four directions, the other six each get
//          one of six distinct 1–2-axis profiles).
//   BANDS — potential-OVR odds over 0–19/20–39/40–59/60–79/80–99. Terran and
//          nimbus are exact mirrors; the rest sit between. NO chance is ever 0:
//          a 99-potential terran can walk out of the rec center, and a found
//          nimbus can still be a dud.
// SIZE is separate: it lives in height/weight and decides position fit.
// Tier still feeds fragility (tier 3 = glass bodies).

export const SPECIES: SpeciesDef[] = [
  {
    id: 'terran',
    name: 'Terran',
    tier: 1,
    bias: [],
    bands: [3, 12, 30, 35, 20],
    heightRange: [176, 204],
    weightRange: [76, 110],
    desc: 'Baseline bipeds. Balanced in every direction, rarely blessed in any. The galaxy simply outrolls them.',
    rarity: 0,
  },
  {
    id: 'hexid',
    name: 'Hexid',
    tier: 2,
    bias: ['ath'],
    bands: [2, 8, 26, 38, 26],
    heightRange: [158, 186],
    weightRange: [48, 80],
    desc: 'Insectoid on six legs and six tiny high-tops. Nothing in the league moves faster, or lower.',
    rarity: 1,
  },
  {
    id: 'quadran',
    name: 'Quadran',
    tier: 2,
    bias: ['ath', 'frc'],
    bands: [2, 8, 26, 38, 26],
    heightRange: [196, 224],
    weightRange: [118, 175],
    desc: 'Hunched heavy-worlder with four arms and tusks. The upper pair handles the ball; the lower pair handles you.',
    rarity: 1,
  },
  {
    id: 'petran',
    name: 'Petran',
    tier: 2,
    bias: ['frc'],
    bands: [2, 8, 26, 38, 26],
    heightRange: [188, 214],
    weightRange: [140, 200],
    desc: 'Stone golem, cracked plating, patient as geology. Every drive dies on it — and every shot it takes is an actual brick.',
    rarity: 1,
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    tier: 3,
    bias: [],
    bands: [1, 3, 10, 30, 56],
    heightRange: [188, 218],
    weightRange: [40, 62],
    desc: 'Translucent gas-form floating above a pair of empty regulation high-tops. Balanced everywhere, blessed almost always.',
    rarity: 3,
  },
  {
    id: 'gelid',
    name: 'Gelid',
    tier: 3,
    bias: ['skl', 'brn'],
    bands: [1, 5, 18, 38, 38],
    heightRange: [168, 200],
    weightRange: [60, 95],
    desc: 'A liquid body stacked in rings, melting into its own puddle. Flows through any defense and sees every passing lane.',
    rarity: 2,
  },
  {
    id: 'robota',
    name: 'Robota',
    tier: 3,
    bias: ['skl'],
    bands: [1, 5, 18, 38, 38],
    heightRange: [186, 212],
    weightRange: [120, 170],
    desc: 'Factory-built baller: piston shins, a jumper machined to tolerance, a motor that never files a complaint.',
    rarity: 2,
  },
  {
    id: 'oculid',
    name: 'Oculid',
    tier: 2,
    bias: ['brn'],
    bands: [1, 5, 18, 38, 38],
    heightRange: [152, 178],
    weightRange: [45, 75],
    desc: 'Four legs, four tiny high-tops, and eyes on stalks that see every pocket you dribble into.',
    rarity: 2,
  },
];

export function speciesById(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}

/** Tier-3 consequences, provisional: glass bodies get hurt and gas out faster. */
export function fragility(speciesId: string): number {
  return speciesById(speciesId).tier === 3 ? 2 : 1;
}

// ---- the league: THE BIG SIX ------------------------------------------------
// One league, six legendary programs — five blue bloods and the Fab Five,
// each a wink at a real school, each instantly readable by its home colors
// (no two share a dominant color; the home bg also drives the UI ramp).
// Names and colors stay editable until the first season tips off.

export interface TeamTemplate {
  name: string;
  planet: string;
  region: string;
  bg: string;
  fg: string;
}

export interface LeagueDef {
  name: string;
  sub: string;
  teams: TeamTemplate[];
}

export const LEAGUE: LeagueDef = {
  name: 'THE BIG SIX',
  sub: 'Six programs. One of them is about to hire you.',
  teams: [
    { name: 'Star Heels', planet: 'Novacarina', region: 'Eastern Drift', bg: '#4A9ED4', fg: '#0B2537' },
    { name: 'Ursa Majors', planet: 'Montalvo', region: 'Western Rim', bg: '#2D68C4', fg: '#F2A900' },
    { name: 'Wolvernauts', planet: 'Ferrix-V', region: 'Great Lakes Nebula', bg: '#FFCB05', fg: '#00274C' },
    { name: 'Spacehawks', planet: 'Kanzar', region: 'Central Plains Belt', bg: '#E8000D', fg: '#0051BA' },
    { name: 'Voidfiends', planet: 'Duqat', region: 'Gothic Belt', bg: '#F3F6FF', fg: '#00539B' },
    { name: 'Whooshers', planet: 'Bloomingtron', region: 'Candy Stripe Belt', bg: '#990000', fg: '#F2E9D4' },
  ],
};

export const DEITY_NAMES = [
  'Zeuxx', 'Apollyx', 'Arex', 'Hermezz', 'Poseidrox', 'Hadezz', 'Dionyzos',
  'Heliox', 'Kronoz', 'Atlazz', 'Jupiteron', 'Marz', 'Neptunn', 'Vulkann', 'Mercurix',
  'Odynn', 'Thorr', 'Lokee', 'Baldyr', 'Heimdahl', 'Tyrr', 'Freyrr',
  'Raa', 'Anubix', 'Ozirix', 'Horuz', 'Thotth', 'Amunn', 'Sobekk',
  'Shangox', 'Ogunn', 'Olorunn', 'Eshuu', 'Obatalla', 'Anansix',
  'Kalungaa', 'Mukurux', 'Huvee', 'Unkuluu', 'Modimoo', 'Nyambee',
  'Quetzall', 'Tezcatt', 'Kukulkann', 'Chaak', 'Huitzill',
  'Perunn', 'Velezz', 'Svarogg', 'Morozz', 'Perkunazz',
  'Lughh', 'Dagdaa', 'Brann', 'Morrigann',
  'Raijinn', 'Fujinn', 'Susanoox', 'Inarix', 'Wukongg', 'Nezhaa',
  'Mauii', 'Tangaroaa', 'Lonoo', 'Kuu', 'Pelee',
  'Mardux', 'Enkii', 'Enlyl', 'Ishtarr', 'Gilgamezz',
  'Indrax', 'Varunox', 'Agnix', 'Suryon', 'Hanumann',
  'Ignatiux', 'Xavyer', 'Benedix', 'Augustyn', 'Gabryel', 'Mikhael',
  'Raffaell', 'Uriyel', 'Domynic', 'Seraphym', 'Pyux', 'Aquinax',
  'Ukkoo', 'Vainoo', 'Sednaa',
  'Athenna', 'Heraa', 'Artemyx', 'Aphroditee', 'Persephonee', 'Demetra',
  'Nyxx', 'Selenee', 'Gaiaa', 'Rheaa', 'Hekatee', 'Irys', 'Eoss',
  'Frigga', 'Siff', 'Idunna', 'Skadee', 'Hellia', 'Sigynn', 'Ranna',
  'Bastett', 'Sekhmett', 'Hathorr', 'Nuut', 'Maatt', 'Nephtys', 'Serqett',
  'Oyaa', 'Oshunn', 'Yemojaa', 'Mawuu', 'Alaa', 'Asaseyaa',
  'Inannaa', 'Ereshka', 'Tiamatt', 'Ninsunn', 'Nammuu', 'Antuu',
  'Saraswatee', 'Lakshmee', 'Parvatee', 'Durgaa', 'Sitaa', 'Taraa', 'Kalii', 'Ushass',
  'Guanyinn', 'Nuwaa', 'Xiwangmuu', 'Changxee', 'Mazuu',
  'Amaterasuu', 'Izanamee', 'Bentenn', 'Uzumee', 'Konohanaa',
  'Hinaa', 'Lakaa', 'Haumeaa', 'Sinaa', 'Papaa', 'Rangee',
  'Coatlee', 'Ixchell', 'Itzell', 'Xochee', 'Chalchee',
  'Marzannaa', 'Ladaa', 'Mokoshh', 'Zoryaa', 'Vesnaa', 'Devanaa',
  'Brigidd', 'Danuu', 'Ainee', 'Boannee', 'Eponaa', 'Rhiannonn', 'Cerridwenn',
  'Louhee', 'Ilmatarr', 'Mielikkee', 'Kuutarr',
  'Astartee', 'Cybelee', 'Vestaa', 'Junoo', 'Ceress', 'Fortunaa', 'Aurorra',
  'Lunaa', 'Floraa', 'Bellonaa', 'Nikee', 'Tychee', 'Circee', 'Calypsoo',
  'Medeaa', 'Pandorra', 'Cassandraa', 'Andromedaa', 'Atalantaa', 'Penthesileaa',
  'Chandraa', 'Adityaa', 'Yamii', 'Rohinee', 'Revatee',
];

// ---- THE SPEECH --------------------------------------------------------------
// A speech is a SHIFT: the whole squad plays +gain in the speech's attribute
// tonight and −loss in its OPPOSITE (SKILL ↔ ATHLETICISM, BRAINS ↔
// FIERCENESS). Four standard speeches, one per attribute; premium speeches
// (found in stories) trade better and recharge. It plays in two beats: you
// say the words and LEAVE THE ROOM for effect; when you come back in, the
// scene tells you whether it took — some nights (SPEECH_FLOP) it doesn't.
// Scenes are written to follow "When you come back in, …".

/** % of nights a shift speech simply doesn't take (premium ones are surer). */
export const SPEECH_FLOP = 15;
export const SPEECH_FLOP_PREMIUM = 8;

/** When you come back in and nothing changed — the funny ways to say it. */
export const SPEECH_FLOPS = [
  'everybody is on their phones. One of them is watching a video of a different coach\'s speech.',
  'the room is exactly as you left it, except the whiteboard now says GO SPORTS in your handwriting. You didn\'t write that.',
  'your assistant is finishing your sentence for you. Badly. The room applauds him.',
  'somebody asks if you\'re okay. You were gone four seconds.',
  'the squad is debating whether you left for effect or for the bathroom. The bathroom wins the vote.',
  'they\'re still waiting for the second half of the speech. There was no second half.',
  'the room has resumed its previous conversation, which was about sandwiches.',
  'the captain is re-enacting your speech for the freshmen. It is a very good impression. It is not a kind one.',
];

export interface PlanDef {
  id: PlanId;
  name: string;
  /** the coach's words */
  speech: string;
  /** 'shift' trades attributes · 'rally' gambles on morale · 'easy' coasts */
  kind: 'shift' | 'rally' | 'easy';
  attr: Attr;
  /** the attribute the speech TAKES from */
  off: Attr;
  /** squad +min..max in attr tonight */
  gain: [number, number];
  /** squad −min..max in the opposite tonight */
  loss: [number, number];
  /** what the room does when the words land — one scene per speech */
  scene: string;
  fantasy: string;
  premium?: boolean;
  /** premium finds recharge: weeks before this speech can be given again */
  cooldown?: number;
}

export const PLANS: PlanDef[] = [
  // every real speech needs a week to breathe — the same words two Fridays
  // in a row are just noise (TAKE IT EASY alone is always available)
  { id: 'showtime', name: 'SHOWTIME', speech: 'SHOOTERS SHOOT', kind: 'shift', attr: 'skl', off: 'ath', gain: [4, 5], loss: [2, 3], cooldown: 1, scene: "the whole team is doing trick shots for the 'gram. Somebody banks one in off the assistant coach's head.", fantasy: 'Shooters shoot. Rise over anything they pack in — and forget about running.' },
  { id: 'rungun', name: 'RUN & GUN', speech: 'RUN THEM RAGGED', kind: 'shift', attr: 'ath', off: 'skl', gain: [4, 5], loss: [2, 3], cooldown: 1, scene: 'they\'re bench-pressing the cheerleaders. The cheerleaders seem fine with it.', fantasy: 'Outrun everything. Seven seconds or less. Nobody said anything about making shots.' },
  { id: 'lockdown', name: 'LOCKDOWN', speech: 'MAKE THEM HATE THE BALL', kind: 'shift', attr: 'frc', off: 'brn', gain: [4, 5], loss: [2, 3], cooldown: 1, scene: 'somebody is headbutting a locker, lovingly. Then somebody else does. The locker will need replacing.', fantasy: 'Full-court terror. Make them hate the ball. Thinking is for the bus ride home.' },
  { id: 'clockwork', name: 'CLOCKWORK', speech: 'USE YOUR BRAINS', kind: 'shift', attr: 'brn', off: 'frc', gain: [4, 5], loss: [2, 3], cooldown: 1, scene: 'a quiet confidence has settled over the room. Is someone humming "ohm"? Are they ALL?', fantasy: 'The system. Every cut scripted. Nobody gets angry, nobody gets a steal.' },
  { id: 'rally', name: 'THE RALLY', speech: 'THIS IS OUR HOUSE', kind: 'rally', attr: 'skl', off: 'skl', gain: [0, 0], loss: [0, 0], cooldown: 1, scene: 'chairs are scraping back. Somebody is pounding a locker in rhythm, and the rhythm is spreading.', fantasy: 'No X\'s, no O\'s — just the roof, and whether it stays on. A coin flip on morale; a sliver of chance it goes very right, or very wrong.' },
  { id: 'easy', name: 'TAKE IT EASY', speech: 'SAVE SOMETHING FOR NEXT WEEK', kind: 'easy', attr: 'ath', off: 'ath', gain: [0, 0], loss: [0, 0], scene: 'somebody is yawning, on purpose. The starters are stretching like it\'s a Tuesday.', fantasy: 'Coast tonight: the floor players burn far less energy, and you play a little softer for it. Lose, and a coasting room takes it badly.' },
  // premium speeches — found in stories: a better trade, 3-week recharge
  { id: 'warcry', name: 'THE WAR CRY', speech: 'TONIGHT WE ARE ANIMALS', kind: 'shift', attr: 'frc', off: 'brn', gain: [7, 8], loss: [2, 3], scene: 'the chant is going up in old Quadran. The paint on the far wall is peeling a little.', fantasy: 'An old Quadran battle chant. The paint peels.', premium: true, cooldown: 3 },
  { id: 'zenmind', name: 'THE STILL POND', speech: 'BE THE STILL POND', kind: 'shift', attr: 'brn', off: 'frc', gain: [7, 8], loss: [2, 3], scene: 'the room is so quiet you can hear the arena breathing through the wall.', fantasy: 'The oracle taught you this one. The gym goes quiet inside.', premium: true, cooldown: 3 },
  { id: 'stardust', name: 'STARDUST', speech: 'BE UNGUARDABLE', kind: 'shift', attr: 'skl', off: 'ath', gain: [7, 8], loss: [2, 3], scene: 'somebody is spinning a ball on one finger and hasn\'t looked at it once.', fantasy: 'A retired Nimbus legend whispered it once. Nets have feared it since.', premium: true, cooldown: 3 },
  { id: 'engine', name: 'THE ENGINE', speech: 'LEGS ARE A LIE', kind: 'shift', attr: 'ath', off: 'skl', gain: [7, 8], loss: [2, 3], scene: 'the whole room is bouncing. The floor has opinions about it.', fantasy: 'A Robota conditioning mantra. The floor gets smaller for everyone else.', premium: true, cooldown: 3 },
];

export function planById(id: PlanId): PlanDef {
  return PLANS.find((p) => p.id === id)!;
}

/** The four standard speeches every coach knows. Premium ones are KNOWLEDGE. */
export const STARTING_PLANS: PlanId[] = ['showtime', 'rungun', 'lockdown', 'clockwork', 'rally', 'easy'];

// ---- LAST-MINUTE INSTRUCTIONS ------------------------------------------------
// The other pregame move: instead of rousing the room, you play the tape.
// Call their set right and their game dies a little tonight; call it wrong
// and nothing happens; get READ, and it's your own game that craters. The
// standard counter is known from day one; the strange ones are KNOWLEDGE.

export interface InstrDef {
  id: string;
  name: string;
  /** the coach's call, printed on the button */
  call: string;
  cost: number;
  /** % you called it: their BEST attribute plays −oppAmt tonight */
  hit: number;
  oppAmt: number;
  /** % they saw it coming: YOUR best attribute plays −selfAmt (the captain's
      order gets CAUGHT instead — heat, and the league reviews the tape) */
  backfire: number;
  selfAmt: number;
  desc: string;
  premium?: boolean;
  /** premium finds recharge (shares the speech-cooldown ledger) */
  cooldown?: number;
}

export const INSTRUCTIONS: InstrDef[] = [
  {
    id: 'counter', name: 'COUNTER THE SET', call: 'SIT ON THEIR OPENER', cost: 0,
    hit: 35, oppAmt: 3, backfire: 20, selfAmt: 3,
    desc: 'You watched the tape twice. If they run what you think they run, it dies at half court.',
  },
  {
    id: 'medium', name: 'THE MEDIUM OF BLORGON-6', call: 'HE SEES THEIR WHOLE NIGHT', cost: 2,
    hit: 70, oppAmt: 4, backfire: 5, selfAmt: 2, premium: true, cooldown: 3,
    desc: 'A medium in the locker room, eyes rolled back, calling their sets before they call them.',
  },
  {
    id: 'takeout', name: "THE CAPTAIN'S ORDER", call: 'TAKE OUT THEIR STAR. QUIETLY.', cost: 1,
    hit: 50, oppAmt: 5, backfire: 20, selfAmt: 0, premium: true, cooldown: 4,
    desc: 'One hard screen, early, memorable. Nobody saw anything. Unless somebody saw.',
  },
];

export function instrById(id: string): InstrDef {
  return INSTRUCTIONS.find((i) => i.id === id) ?? INSTRUCTIONS[0];
}

export const STARTING_INSTRUCTIONS = ['counter'];

/** THE BIG BANG: eight champions, one universe (the old "Universal
    Tournament" — the galaxy's Big Dance). */
export const TOURNEY = {
  name: 'THE BIG BANG',
  short: 'BIG BANG',
  rounds: ['THE FIRST ROUND', 'THE SEMIFINAL', 'THE BIG BANG FINAL'],
};

export const ATTR_LABEL: Record<Attr, string> = {
  skl: 'SKILL', ath: 'ATHLETICISM', frc: 'FIERCENESS', brn: 'BRAINS',
};
export const ATTR_SHORT: Record<Attr, string> = {
  skl: 'SKL', ath: 'ATH', frc: 'FRC', brn: 'BRN',
};
/** The box-score stat each attribute drives (one system everywhere):
    skilled players score, fierce ones rebound, athletes steal, brains assist. */
export const ATTR_STAT: Record<Attr, 'pts' | 'reb' | 'stl' | 'ast'> = {
  skl: 'pts', ath: 'stl', frc: 'reb', brn: 'ast',
};
/** Stats spelled out — display language, never column shorthand. */
export const STAT_WORD: Record<'pts' | 'reb' | 'stl' | 'ast', string> = {
  pts: 'points', reb: 'rebounds', stl: 'steals', ast: 'assists',
};

// ---- the drill board -----------------------------------------------------------

export interface DrillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  /** the slow universal track: XP toward levels (levels bank +2 free points) */
  xp: [number, number];
  /** the fast fixed track: direct attribute points — the DRILL picks where */
  gain?: Partial<Record<Attr, number>>;
  /** ceiling work: % chance per player of +1 potential on a random attribute */
  potChance?: number;
  /** 'squad' trains everyone not sitting; 'one' trains a single pick; 'rest' recovers */
  target: 'squad' | 'one' | 'rest';
  /** rest drills: what the squad gets back */
  recover?: { energy: number; mood: number };
  up: OddsTail;
  down: OddsTail;
  energyCost: number; // player energy drained by participating
  injuryBias: number; // 0 mild … 2 severe
  cause: (name: string) => string;
}

/** The three practice families: earn XP / hammer stats / get the squad back. */
export function drillKind(d: DrillDef): 'train' | 'sharpen' | 'recover' {
  if (d.target === 'rest') return 'recover';
  if (d.gain || d.potChance) return 'sharpen';
  return 'train';
}

export const DRILLS: DrillDef[] = [
  {
    id: 'shootaround',
    name: 'SHOOTAROUND',
    desc: 'Racks of shots under the practice dome. Nothing in space is safe, but this is close.',
    cost: 1,
    xp: [2, 4],
    target: 'squad',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'INJURY' },
    energyCost: 3,
    injuryBias: 0,
    cause: (n) => `${n} rolled an ankle stepping on a loose ball during shootaround. A loose ball. In shootaround.`,
  },
  {
    id: 'scrimmage',
    name: 'FULL SCRIMMAGE',
    desc: 'Starters against bench, refs bribed with sandwiches, everything at game speed.',
    cost: 2,
    xp: [4, 6],
    target: 'squad',
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 5, cls: 'INJURY' },
    energyCost: 6,
    injuryBias: 0,
    cause: (n) => `${n} took a charge in scrimmage from a teammate who forgot it was scrimmage.`,
  },
  {
    id: 'twodays',
    name: 'TWO-A-DAYS',
    desc: 'Morning session, evening session, complaints filed in between. The classic, for a reason.',
    cost: 3,
    xp: [6, 9],
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    energyCost: 10,
    injuryBias: 1,
    cause: (n) => `${n}'s legs gave out halfway through the evening session of two-a-days.`,
  },
  {
    id: 'rest',
    name: 'TEAM REST',
    desc: 'Cancel everything. Recovery tanks, naps, and the sound of nothing happening.',
    cost: 0,
    xp: [0, 0],
    target: 'rest',
    recover: { energy: 21, mood: 4 },
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 5, cls: 'DRAMA' },
    energyCost: 0,
    injuryBias: 0,
    cause: (n) => `${n}, unsupervised, went quad-racing in a crater on a borrowed grav-board.`,
  },
  {
    id: 'bonfire',
    name: 'BONFIRE NIGHT',
    desc: 'Marshmallows, ghost stories, someone brings a guitar with eleven strings. The squad remembers it likes itself.',
    cost: 1,
    xp: [0, 0],
    target: 'rest',
    recover: { energy: 6, mood: 14 },
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    energyCost: 0,
    injuryBias: 0,
    cause: (n) => `${n} told the one ghost story the freshmen were not ready for. Nobody slept.`,
  },
  // ---- discovered methods: direct points, the drill decides where -------------
  {
    id: 'asteroid',
    name: 'ASTEROID PUSHES',
    desc: 'The whole squad pushes the practice asteroid up the gravity ramp until something changes.',
    cost: 2,
    xp: [2, 4],
    gain: { ath: 1 },
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    energyCost: 10,
    injuryBias: 1,
    cause: (n) => `${n} got his arm stuck between two practice asteroids and saw no way out but to have a teammate rip him free.`,
  },
  {
    id: 'meteor',
    name: 'METEOR DODGING',
    desc: 'Live meteors, real stakes. Teaches touch AND foot speed to whoever survives the hour.',
    cost: 3,
    xp: [2, 4],
    gain: { skl: 1, ath: 1 },
    target: 'squad',
    up: { pct: 10, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    energyCost: 12,
    injuryBias: 2,
    cause: (n) => `${n} dodged eleven meteors with a backflip each. The twelfth did not care about backflips.`,
  },
  {
    id: 'sparring',
    name: 'GRAVITY CAGE',
    desc: 'Double gravity, one ball, no whistle, everybody in. What comes out is meaner.',
    cost: 2,
    xp: [2, 4],
    gain: { frc: 1 },
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    energyCost: 10,
    injuryBias: 1,
    cause: (n) => `${n} won the cage bout but left his shoulder somewhere inside it.`,
  },
  {
    id: 'dreamlab',
    name: 'THE DREAM LAB',
    desc: 'The squad sleeps in tanks and practices in shared lucid dreams. Ceilings are negotiable in there.',
    cost: 3,
    xp: [1, 3],
    potChance: 50,
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'DRAMA' },
    energyCost: 4,
    injuryBias: 0,
    cause: (n) => `${n} refused to wake up for two days. The dream, reportedly, was going great.`,
  },
  {
    id: 'filmroom',
    name: 'THE FILM CRYPT',
    desc: 'Ten thousand seasons of galactic film, fed straight into the whole room until the floor slows down.',
    cost: 2,
    xp: [2, 4],
    gain: { brn: 1 },
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 5, cls: 'DRAMA' },
    energyCost: 6,
    injuryBias: 0,
    cause: (n) => `${n} came out of the crypt after nine hours arguing with a play from 400 years ago. Loudly. At teammates.`,
  },
];

export function drillById(id: string): DrillDef {
  return DRILLS.find((d) => d.id === id) ?? DRILLS[0];
}

// ---- THE CAMPUS (v5): six facilities, levels 0–3 ------------------------------
// One law: THE FACILITY OPENS THE TERRITORY; THE STORIES FILL IT. Built
// levels unlock the standard options; story-found content carries a facility
// requirement of its own — finding a deep-core chart at ship 1 isn't a dud,
// it's the reason to upgrade. Level 0 exists only in the tutorial.

export interface FacilityDef {
  id: FacId;
  name: string;
  /** what the campus offers at each level, 0–3 */
  blurbs: [string, string, string, string];
  /** the one-week-later arrival beat's opening line */
  arrive: string;
}

export const FACILITIES: FacilityDef[] = [
  {
    id: 'ship', name: 'SCOUTING SHIP',
    blurbs: ['no ship — a bus pass and somebody\'s grainy film collection', 'home-planet range', 'nebula range — and THE STORM LAYERS open', 'outer-rim range; found DEEP CORE charts are flyable'],
    arrive: 'A new ship squats on the pad overnight, still warm from somebody else\'s registration. The janitor pretends not to know how it got there.',
  },
  {
    id: 'gym', name: 'THE GYM',
    blurbs: ['a gym with no hoop; the echo is impressive', 'a hoop: shootaround', 'a full court: scrimmage and two-a-days', 'the lab wing: the strange methods can be installed'],
    arrive: 'Contractors in zero-g harnesses hammer all weekend. Monday morning the net still smells of fresh nylon.',
  },
  {
    id: 'cryo', name: 'CRYO BAY',
    blurbs: ['an ice-filled dumpster', 'one pod: the weekend bump firms up (⚡ tops at 77)', 'a bank of pods (⚡ tops at 79)', 'the pro clinic\'s freezer (⚡ tops at 81)'],
    arrive: 'The pods hiss when they land, breathing white. Somebody has already taped a name to the best one.',
  },
  {
    id: 'library', name: 'THE LIBRARY',
    blurbs: ['one sad shelf of speculative fiction', 'a tutoring corner: study weeks help', 'real stacks: fewer academic fires', 'the archive: film study feeds BRAINS harder'],
    arrive: 'Crates of books arrive addressed to "the basketball school, apparently". The nerd has them shelved by tip-off.',
  },
  {
    id: 'stadium', name: 'THE STADIUM',
    blurbs: ['splintered bleachers, free to sit on', 'a gate: +1¢ per home game', 'real stands: +2¢ per home game', 'the bowl: +3¢ — and a home loss stings the fans less'],
    arrive: 'The steel goes up in a weekend. The echo of the first bounced ball takes a full second to come back.',
  },
  {
    id: 'greekrow', name: 'GREEK ROW',
    blurbs: ['a group chat that mostly leaves you on read', 'the open house', 'the dinner — and the booster takes your calls', 'skyboxes and duffel bags; the campus hums'],
    arrive: 'Banners unroll down the row and a sound system of dubious wattage gets carried up somebody\'s stairs.',
  },
];

export function facilityById(id: FacId): FacilityDef {
  return FACILITIES.find((f) => f.id === id)!;
}

/** Upgrading TO level n costs 3n¢ (a season is 2–3 upgrades, by design). */
export function facCost(target: number): number {
  return target * 3;
}

export function facLevel(s: GameState, id: FacId): number {
  return s.facilities?.[id] ?? 1;
}

/** What each built level reaches. Anything not listed defaults high — a
    found thing without an entry wants a serious building. */
export const SHIP_REQ: Record<string, number> = { reccenter: 0, home: 1, nebula: 2, stormlayers: 2, outerrim: 3, deepcore: 3 };
export const GYM_REQ: Record<string, number> = { rest: 0, bonfire: 0, shootaround: 1, scrimmage: 2, twodays: 2, asteroid: 2, sparring: 2, filmroom: 2, dreamlab: 3, meteor: 3 };
export const ROW_REQ: Record<string, number> = { groupchat: 0, letters: 0, openhouse: 1, dinner: 2, carepack: 2, skybox: 3, bagdrop: 3 };

// ---- the galaxy: TWO weekly sections now, reading THE PRIORITY BOARD -----------
// SCOUTING (search for talent OR read the board) and RECRUITING (work the
// board yourself OR call the booster) are separate stops in the week. The
// board IS a lineup: rows are priority tiers — TARGETS (top) / BACKUPS /
// LAST RESORTS — dragged exactly like the squad grid. Techniques are an
// intensity pyramid over the rows: cheap touches ALL 9 lightly · mid works
// the TOP 6 · dear goes deep on TARGETS only. Regions are RARITY DIALS:
// they shift WHO you find, never how good they are. Direct recruiting is
// low risk / low reward; the BOOSTER's help swings huge — with plausible
// deniability when it blows up (his name is on it, mostly).

export interface GalaxyActDef {
  id: string;
  kind: 'scout' | 'recruit' | 'search';
  /** recruiting family: your own honest work, or the booster's */
  via?: 'direct' | 'booster';
  name: string;
  desc: string;
  cost: number;
  /** scout/recruit: how many board slots the action reads (top-down).
      Undefined = all 9. */
  scope?: 6 | 3;
  /** scout: facet reveals per prospect [min,max] */
  reveals?: [number, number];
  /** recruit: commit % range [min,max] */
  gain?: [number, number];
  /** recruit: per-prospect % chance the night backfires on that name */
  risk?: number;
  /** search: % chance of finding TWO */
  twoChance?: number;
  /** search: reachable with a grounded ship */
  local?: boolean;
  up: OddsTail;
  down: OddsTail;
}

/** Region rarity dials: who steps into the light, by species weight. The
    OUTER RIM is where nimbus appear (the deep core, once discovered, still
    reaches them — it reaches everything). 'opening' is the season-opening
    board: heavily terran, a slim chance per slot of a specialist, and a
    1-in-1000 nimbus just sitting there. */
export const SPECIES_ODDS: Record<string, [string, number][]> = {
  reccenter: [['terran', 100]],
  home: [['terran', 85], ['quadran', 4], ['hexid', 4], ['petran', 4], ['oculid', 1], ['robota', 1], ['gelid', 1]],
  nebula: [['terran', 46], ['quadran', 14], ['hexid', 14], ['petran', 14], ['oculid', 4], ['robota', 4], ['gelid', 4]],
  // inside the gas giant: the floaty species live in the cloud decks
  stormlayers: [['terran', 18], ['hexid', 12], ['gelid', 38], ['oculid', 12], ['quadran', 6], ['petran', 6], ['robota', 4], ['nimbus', 4]],
  outerrim: [['terran', 13], ['quadran', 13], ['hexid', 13], ['petran', 13], ['oculid', 12], ['robota', 12], ['gelid', 12], ['nimbus', 12]],
  deepcore: [['terran', 10], ['quadran', 12], ['hexid', 12], ['petran', 12], ['oculid', 14], ['robota', 14], ['gelid', 14], ['nimbus', 12]],
  opening: [['terran', 84.9], ['quadran', 4], ['hexid', 4], ['petran', 4], ['oculid', 1], ['robota', 1], ['gelid', 1], ['nimbus', 0.1]],
};

export const GALAXY_ACTS: GalaxyActDef[] = [
  // ---- SCOUT (the intensity pyramid reads the rows) ----
  {
    id: 'filmnight', kind: 'scout', name: 'FILM NIGHT', cost: 1, reveals: [1, 1],
    desc: 'Grainy feeds from nine gyms. One honest look at everybody.',
    up: { pct: 5, cls: 'INTEL' }, down: { pct: 2, cls: 'DRAIN' },
  },
  {
    id: 'roadtrip', kind: 'scout', name: 'SCOUTING ROAD TRIP', cost: 2, reveals: [1, 2], scope: 6,
    desc: 'A week in the shuttle for the six names that matter most.',
    up: { pct: 10, cls: 'INTEL' }, down: { pct: 5, cls: 'SHIP' },
  },
  {
    id: 'workout', kind: 'scout', name: 'PRIVATE WORKOUT', cost: 3, reveals: [2, 3], scope: 3,
    desc: 'Your gym, your drills, your stopwatch — the TARGETS, read deep.',
    up: { pct: 25, cls: 'INTEL' }, down: { pct: 10, cls: 'SCANDAL' },
  },
  // ---- RECRUIT, the DIRECT family: low risk, low reward, your own name ----
  {
    id: 'groupchat', kind: 'recruit', via: 'direct', name: 'THE GROUP HOLO-CHAT', cost: 0, gain: [2, 6], risk: 1,
    desc: 'Nine names, one thread, zero budget. Presence counts for something.',
    up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' },
  },
  {
    id: 'letters', kind: 'recruit', via: 'direct', name: 'HOLO-LETTERS', cost: 1, gain: [4, 10], risk: 2,
    desc: 'Nine handwritten holograms. Safe. Modest. Sincere.',
    up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' },
  },
  {
    id: 'openhouse', kind: 'recruit', via: 'direct', name: 'CAMPUS OPEN HOUSE', cost: 2, gain: [6, 14], risk: 4, scope: 6,
    desc: 'The top six visit at once. The gravy-fries do most of the talking.',
    up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' },
  },
  {
    id: 'dinner', kind: 'recruit', via: 'direct', name: 'THE DINNER', cost: 3, gain: [10, 20], risk: 6, scope: 3,
    desc: 'You, the TARGETS, and a chef with too many arms. Warm, honest, effective.',
    up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' },
  },
  // ---- RECRUIT, the BOOSTER family: huge swings, his fingerprints (mostly) ----
  {
    id: 'carepack', kind: 'recruit', via: 'booster', name: 'BOOSTER CARE PACKAGES', cost: 1, gain: [7, 15], risk: 6,
    desc: 'Nine crates "from a fan". Sneakers that fit suspiciously well.',
    up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'SCANDAL', note: 'deniable — his name is on the crates' },
  },
  {
    id: 'skybox', kind: 'recruit', via: 'booster', name: 'THE SKYBOX WEEKEND', cost: 2, gain: [10, 24], risk: 8, scope: 6,
    desc: 'The top six watch a pro game from the booster\'s skybox. Amateurism weeps.',
    up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 15, cls: 'SCANDAL', note: 'deniable — you were "not there"' },
  },
  {
    id: 'bagdrop', kind: 'recruit', via: 'booster', name: 'THE BAG DROP', cost: 3, gain: [16, 40], risk: 12, scope: 3,
    desc: 'The TARGETS each find a duffel bag in their locker. Nobody counts it out loud.',
    up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL', note: 'deniable, barely' },
  },
  // ---- SEARCH (the 0⚡ floor lives here; regions are rarity dials) ----
  {
    id: 'reccenter', kind: 'search', name: 'LOCAL REC CENTER', cost: 0, local: true,
    desc: 'Terrans only. And kids notice where you went looking.',
    up: { pct: 2, cls: 'INTEL' }, down: { pct: 5, cls: 'DRAMA' },
  },
  {
    id: 'home', kind: 'search', name: 'HOME PLANET', cost: 1, local: true,
    desc: 'Terrans wall to wall — with the rare off-world transfer in the stands.',
    up: { pct: 2, cls: 'INTEL' }, down: { pct: 2, cls: 'SHIP' },
  },
  {
    id: 'nebula', kind: 'search', name: 'LOCAL NEBULA', cost: 2,
    desc: 'Hexid blurs, Quadran storms, Petran walls. Real specialists, mild turbulence.',
    up: { pct: 5, cls: 'INTEL' }, down: { pct: 10, cls: 'SHIP' },
  },
  {
    id: 'stormlayers', kind: 'search', name: 'THE STORM LAYERS', cost: 2, twoChance: 10,
    desc: 'Inside the nearby gas giant: floaty talent in the cloud decks. The pressure has opinions.',
    up: { pct: 5, cls: 'INTEL' }, down: { pct: 15, cls: 'DRAMA' },
  },
  {
    id: 'outerrim', kind: 'search', name: 'OUTER RIM', cost: 3, twoChance: 15,
    desc: 'The strangest talent in known space — and the only charted skies where a Nimbus drifts by.',
    up: { pct: 5, cls: 'LOOT' }, down: { pct: 25, cls: 'SHIP' },
  },
  {
    id: 'deepcore', kind: 'search', name: 'DEEP CORE', cost: 3, twoChance: 20,
    desc: 'The old charts were real. Every species, the rarest of them often, gravity that eats ships.',
    up: { pct: 10, cls: 'LOOT' }, down: { pct: 25, cls: 'SHIP' },
  },
];

/** THE TRAIL talks: how each recruiting night actually went, before the
    tally — three ways each, the booster's the most radioactive. */
export const RECRUIT_FLAVOR: Record<string, string[]> = {
  groupchat: [
    'You type "hey team 🏀" into a thread with nine teenagers and receive four thumbs-ups, one "who dis", and a reaction you\'re fairly sure is a vegetable.',
    'The group chat is alive at 2am with a debate about the best pregame snack. You contribute "hydration". Silence. Then, slowly, hearts.',
    'Somebody adds their grandmother to the thread by mistake. She stays. She is, by the end of the week, the most committed name on the board.',
  ],
  letters: [
    'Nine holograms, hand-written, each one a little shakier than the last. The ninth kid frames his. The first kid\'s mother asks if you\'re okay.',
    'The holo-letters arrive mid-homeroom and stand up on nine desks at once, saying nine names in your voice. Three teachers file complaints. Six kids file the letters.',
    'You misspell one name and the hologram apologizes for you, unprompted, for eleven seconds. Somehow this lands.',
  ],
  openhouse: [
    'Six recruits, one campus tour, one cafeteria. The gravy-fries do exactly what the gravy-fries have always done. Two kids ask if the dorm has a hoop. It does now.',
    'The open house runs long because the mascot won\'t stop doing the worm in the quad. Nobody wants to leave while the worm is happening.',
    'Your assistant gives the tour, gets lost inside the science wing, and improvises a speech about "finding your way" that the recruits are still quoting on the bus home.',
  ],
  dinner: [
    'The chef with too many arms plates nine courses simultaneously. The TARGETS are impressed. The TARGETS are also, briefly, unable to see over the food.',
    'Course seven is a soup that changes flavor when you compliment it. You compliment it forty times. The recruits watch you do this and decide you are, at least, sincere.',
    'Dinner ends with the chef juggling the dessert. A recruit catches a flan. That recruit talks about nothing else for a week.',
  ],
  carepack: [
    'Nine crates leave the loading dock "from a fan". By lunch three unboxing streams are live and one kid is wearing every item at once, including the crate.',
    'The care packages arrive with no return address and a smell of cigar. One recruit\'s dad opens his in the driveway and says "well now" very slowly.',
    'The sneakers fit suspiciously well. The hoodie fits suspiciously well. The booster, watching the streams from a hot tub, fits suspiciously well too.',
  ],
  skybox: [
    'Six recruits, one skybox, one pro game, a shrimp tower the height of a freshman. The booster narrates the fourth quarter like he owns the team. He might.',
    'The skybox has a button that lowers a hoop from the ceiling. The recruits find it at halftime. The pro game is, for eleven minutes, not the main event.',
    'You were "not there". A photo exists of you not being there, holding a shrimp. The booster assures you it\'s a very forgettable shrimp.',
  ],
  bagdrop: [
    'Three lockers, three duffel bags, three zippers that sound like a starting gun. Nobody counts it out loud. Everybody counts it.',
    'The duffel bags are monogrammed, which the booster calls "a classy touch" and the league would call "exhibit A". The TARGETS call them heavy.',
    'One recruit brings his bag back, says it was "too much", and leaves it on your desk. It is somehow heavier than before. He is, mysteriously, more committed.',
  ],
};

export function galaxyActById(id: string): GalaxyActDef {
  return GALAXY_ACTS.find((a) => a.id === id) ?? GALAXY_ACTS[0];
}

// ---- THE BAG ----------------------------------------------------------------------

export interface StoryResolution {
  text: string;
  fx?: Fx[];
  follow?: { weeks: number; beat: string; defId?: string; playerId?: number | null; data?: Record<string, unknown> }[];
  next?: { defId: string; beat: string; playerId?: number | null; data?: Record<string, unknown> };
}

export interface StoryCtx {
  s: GameState;
  player: Player | null;
  data: Record<string, unknown>;
  /** engine-provided helpers, so data stays pure */
  team: () => Player[];
  bestPlayer: () => Player | null;
}

export interface ItemDef {
  id: string;
  name: string;
  /** ≤5 chars for the always-visible bag bar */
  short: string;
  rarity: 'common' | 'rare' | 'legendary';
  flavor: string;
  effectText: string;
  context: string[];
  /** every item DRAGS: 'player' onto one squad card, 'prospect' onto one
      big-board card, 'team' anywhere on the screen (the whole squad / the
      night / the coach's world). Printed on the bag slot and the card. */
  target: 'player' | 'prospect' | 'team';
  /** a refusal reason means the drop bounces WITHOUT consuming the item */
  check?: (ctx: StoryCtx) => string | null;
  up?: OddsTail;
  down?: OddsTail;
  use: (ctx: StoryCtx) => StoryResolution;
}

function tails(up: number, down: number): 'up' | 'down' | 'mid' {
  const r = Math.random() * 100;
  if (r < down) return 'down';
  if (r < down + up) return 'up';
  return 'mid';
}

/** MEDICAL items work on injuries only — and on any week of them. */
function medicalCheck(p: Player | null, idle: string): string | null {
  if (!p || p.outWeeks === 0) return `nobody hurt there — ${idle}`;
  if (p.outKind !== 'injury') return `that's not an injury (${p.outReason}) — medicine can't hurry it, time can`;
  return null;
}

/** Take `weeks` off an injury, with a small chance the cure adds one. */
function medicalUse(p: Player, weeks: number, riskPct: number, good: string, bad: string): StoryResolution {
  if (roll(riskPct)) return { text: `${bad} ${p.name}: ${p.outWeeks} weeks → ${p.outWeeks + 1}.`, fx: [{ playerId: p.id, outWeeks: p.outWeeks + 1, outReason: p.outReason }] };
  const left = Math.max(0, p.outWeeks - weeks);
  return {
    text: left === 0 ? `${good} ${p.name} jogs it off like it never happened.` : `${good} ${p.name}: ${p.outWeeks} weeks → ${left}.`,
    fx: [{ playerId: p.id, outWeeks: left, outReason: p.outReason }],
  };
}

/** TIME items work on non-injury absences: he lives the weeks, we don't. */
function timeCheck(p: Player | null, idle: string): string | null {
  if (!p || p.outWeeks === 0) return `nobody away there — ${idle}`;
  if (p.outKind === 'injury') return `that's an injury (${p.outReason}) — time heals it no faster, medicine does`;
  return null;
}

/** Take `weeks` off an absence, with a chance he gets lost in time instead. */
function timeUse(p: Player, weeks: number, riskPct: number): StoryResolution {
  if (roll(riskPct)) {
    return { text: `The field flickers. ${p.name} steps out a week LATER than he went in, holding a newspaper from a Thursday that hasn't happened. ${p.outWeeks} weeks → ${p.outWeeks + 1}.`, fx: [{ playerId: p.id, outWeeks: p.outWeeks + 1, outReason: p.outReason }] };
  }
  const left = Math.max(0, p.outWeeks - weeks);
  return {
    text: left === 0
      ? `The field hums. For ${p.name} the whole absence happens between two of your heartbeats. He's back — and slightly tanned.`
      : `The field hums. ${p.name} lives ${weeks === 1 ? 'a week' : `${weeks} weeks`} of ${p.outReason || 'it'} while you blink. ${p.outWeeks} weeks → ${left}.`,
    fx: [{ playerId: p.id, outWeeks: left, outReason: p.outReason }],
  };
}

export const ITEMS: ItemDef[] = [
  {
    id: 'vial',
    short: 'VIAL',
    name: "BEELZEBUB'S VIAL",
    rarity: 'rare',
    flavor: '"One sip. Ask nothing." — the doctor on stAroid-5',
    effectText: 'an injured player: back on their feet tonight, full energy',
    context: ['injury', 'pregame'],
    target: 'player',
    check: (ctx) => medicalCheck(ctx.player, 'the vial waits'),
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The vial glints. Nobody needs it. You put it away slowly.' };
      const t = tails(2, 25);
      if (t === 'down') {
        return {
          text: `${p.name} downs the vial and feels INCREDIBLE — for six hours. Then his legs stop answering. The team doctor won't even look at you. 3 weeks in the medbay.`,
          fx: [{ playerId: p.id, outWeeks: 3, outReason: 'Beelzebub aftermath', outKind: 'injury', levelDelta: -1, mood: -10 }],
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} downs the vial. Whatever was wrong with him is gone — and something extra came with it. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, outWeeks: 0, energyP: 100, anyAttr: 2, mood: 10 }],
        };
      }
      return {
        text: `${p.name} downs the vial, shudders once, and stands up like nothing ever happened. You ask nothing.`,
        fx: [{ playerId: p.id, outWeeks: 0, energyP: 100 }],
      };
    },
  },
  {
    id: 'xarter',
    short: 'XART',
    name: "XARTER'S INVITATION",
    rarity: 'legendary',
    flavor: 'The mind-controlling trainer takes one pupil a year.',
    effectText: 'one player: a level, instantly, and a body rebuilt for speed',
    context: ['practice'],
    target: 'player',
    check: (ctx) => (ctx.player && ctx.player.outWeeks === 0 ? null : 'not fit to travel to Xarter like that'),
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'SCANDAL' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.team().filter((q) => q.outWeeks === 0).sort((a, b) => b.attrs.ath - a.attrs.ath)[0] ?? null;
      if (!p) return { text: 'Nobody is fit to travel to Xarter. The invitation dissolves.' };
      const t = tails(5, 10);
      const base: Fx = { playerId: p.id, levelDelta: 1, attr: { ath: 2 } };
      if (t === 'down') {
        return {
          text: `${p.name} returns from Coach Xarter faster than physics — and wrong behind the eyes. Mid-scrimmage he bites a teammate's leg. The league opens a file with your name on it.`,
          fx: [base, { playerId: p.id, outWeeks: 3, outReason: 'suspension (the biting)', outKind: 'away', attr: { frc: 2, brn: -2 } }, { heatS: 15 }],
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} returns from Coach Xarter transformed. His first step now happens slightly before he decides to take it.`,
          fx: [base, { playerId: p.id, anyAttr: 2, mood: 10 }],
        };
      }
      return { text: `${p.name} returns from Coach Xarter a week later, faster, quieter, and unwilling to discuss it.`, fx: [base] };
    },
  },
  {
    id: 'chrono',
    short: 'CHRNO',
    name: 'CHRONO SIP',
    rarity: 'legendary',
    flavor: 'Time is a liquid if you know the right bartender.',
    effectText: 'one player: three levels of growth, instantly',
    context: ['practice'],
    target: 'player',
    check: (ctx) => (ctx.player && ctx.player.level < 10 ? null : 'already who they will be'),
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.team().filter((q) => q.outWeeks === 0 && q.level < 10).sort((a, b) => ovr(b.pots) - ovr(a.pots))[0] ?? null;
      if (!p) return { text: 'Everyone is already who they will be. The sip goes flat.' };
      const t = tails(2, 10);
      if (t === 'down') {
        return {
          text: `${p.name} takes the sip and trains three subjective years in one afternoon. He also AGES three subjective years. Registrar says that's a class year. He's suddenly asking about graduation.`,
          fx: [{ playerId: p.id, levelDelta: 3 }, { playerId: p.id, mood: -5 }],
          next: { defId: 'chrono_age', beat: 'start', playerId: p.id },
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} takes the sip and comes back with three years of work in his hands — and a ceiling you can no longer see. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, levelDelta: 3, anyPot: 8 }],
        };
      }
      return { text: `${p.name} takes the sip. Three subjective years of empty-gym reps land in his body at once. He sits down for a while.`, fx: [{ playerId: p.id, levelDelta: 3 }] };
    },
  },
  {
    id: 'icepack',
    short: 'ICE',
    name: 'METEOR ICE PACK',
    rarity: 'common',
    flavor: 'Cold from before the solar system. The honest one.',
    effectText: 'MEDICAL · an injury: recovery time halved',
    context: ['injury'],
    target: 'player',
    check: (ctx) => medicalCheck(ctx.player, 'the ice sweats patiently'),
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'INJURY' },
    use: (ctx) => {
      const p = ctx.player;
      if (!p || p.outWeeks === 0) return { text: 'Nobody is hurt. The ice pack sweats patiently.' };
      if (roll(2)) return { text: `The meteor ice is TOO cold. ${p.name} adds a week of frostbite to the diagnosis.`, fx: [{ playerId: p.id, outWeeks: p.outWeeks + 1, outReason: p.outReason }] };
      const newWeeks = Math.max(1, Math.ceil(p.outWeeks / 2));
      return {
        text: `The meteor ice does its ancient work. ${p.name}'s recovery: ${p.outWeeks} weeks → ${newWeeks}.`,
        fx: [{ playerId: p.id, outWeeks: newWeeks, outReason: p.outReason }],
      };
    },
  },
  {
    id: 'espresso',
    short: 'ESPR',
    name: 'NEBULA ESPRESSO',
    rarity: 'common',
    flavor: 'Brewed under pressure. Like everyone here.',
    effectText: 'THE SQUAD: +20 energy tonight, −30 crash next week',
    context: ['pregame'],
    target: 'team',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: () => ({
      text: 'The squad downs the espresso. Pupils the size of moons. Tonight they are LIMITLESS. Next week is next week.',
      fx: [{ teamEnergyP: 20 }],
      follow: [{ weeks: 1, beat: 'start', defId: 'espresso_crash', playerId: null }],
    }),
  },
  {
    id: 'karaoke',
    short: 'KARA',
    name: 'MOOD KARAOKE CHIP',
    rarity: 'common',
    flavor: 'Contains every power ballad ever written, in every language, at once.',
    effectText: 'THE SQUAD: mood +15',
    context: ['mood', 'practice'],
    target: 'team',
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const t = tails(5, 2);
      if (t === 'down') {
        const p = pick(ctx.team());
        return { text: `Karaoke night. ${p.name} hogs the mic for two straight hours and the room turns on him.`, fx: [{ teamMood: 8 }, { playerId: p.id, mood: -10 }] };
      }
      if (t === 'up') return { text: 'Karaoke night ascends. Three-part harmony. Someone cries. The team leaves as brothers.', fx: [{ teamMood: 25 }] };
      return { text: 'Karaoke night. Off-key, off the rails, exactly right.', fx: [{ teamMood: 15 }] };
    },
  },
  {
    id: 'hologram',
    short: 'HOLO',
    name: 'STUDY-BUDDY HOLOGRAM',
    rarity: 'common',
    flavor: 'A tutor of light. Extremely thorough. Slightly too thorough.',
    effectText: 'one player: they pass the exam (or a study week: +1 BRAINS, −10 energy)',
    context: ['academic'],
    target: 'player',
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'SCANDAL' },
    use: (ctx) => {
      const p = ctx.player;
      if (!p) return { text: 'No exams loom. The hologram recites poetry to itself.' };
      if (!ctx.data.exam && p.outWeeks === 0) {
        // no exam looming: a study week, thorough as ever
        return { text: `${p.name} studies with the hologram for a week. It quizzes him in his sleep. He passes things that weren't even assigned.`, fx: [{ playerId: p.id, attr: { brn: 1 }, energyP: -10 }] };
      }
      const t = tails(2, 10);
      if (t === 'down') {
        return {
          text: `The hologram, being thorough, SAT THE EXAM ITSELF wearing ${p.name}'s face. It scored a perfect 100, which was the giveaway. Identity-fraud paperwork is en route.`,
          fx: [{ heatS: 15 }, { playerId: p.id, outWeeks: 1, outReason: 'hologram hearing', outKind: 'away' }],
        };
      }
      if (t === 'up') return { text: `${p.name} studies with the hologram and something CLICKS. He aces it — and his game IQ came along.`, fx: [{ playerId: p.id, outWeeks: 0, attr: { brn: 2 }, mood: 8 }] };
      return { text: `${p.name} passes. The hologram bows and folds itself into a point of light.`, fx: [{ playerId: p.id, outWeeks: 0, mood: 5 }] };
    },
  },
  {
    id: 'vip',
    short: 'VIP',
    name: 'KAPPA NEBULA VIP PASS',
    rarity: 'rare',
    flavor: 'Laminated. Glowing. Slightly sticky.',
    effectText: 'one recruit falls in love with campus: commitment +25%',
    context: ['recruiting'],
    target: 'prospect',
    check: (ctx) => {
      const pr = ctx.s.prospects.find((x) => x.id === ctx.data.prospectId);
      return pr?.signed ? 'they already signed — they live here now' : null;
    },
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 25, cls: 'DRAMA' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined
        ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId)
        : ctx.s.prospects.length ? pick(ctx.s.prospects) : undefined;
      if (!pr) return { text: 'Nobody to impress. The pass glows anyway.' };
      const t = tails(5, 25);
      if (t === 'down') {
        pr.commitPct = clamp(pr.commitPct - 20, 0, 95);
        return { text: `The VIP night ends in a brawl over somebody's cheerleader girlfriend. ${pr.name} leaves with a black eye and second thoughts. Commitment −20%.` };
      }
      pr.commitPct = clamp(pr.commitPct + 25, 0, 95);
      if (t === 'up') {
        pr.seenSkill = true;
        pr.seenPot = true;
        pr.digits = 2;
        pr.scoutLevel = 4;
        pr.seenAttrs = { ...pr.attrs };
        pr.seenPots = { ...pr.pots };
        return { text: `${pr.name} has the night of his life — and plays pickup at 3am while your assistant takes notes. Commitment +25%, and now you KNOW him.` };
      }
      return { text: `${pr.name} has the time of his life. He leaves wearing one of your team caps. Commitment +25%.` };
    },
  },
  {
    id: 'boots',
    short: 'BOOTS',
    name: 'GRAVITY BOOTS',
    rarity: 'rare',
    flavor: 'Every step is leg day.',
    effectText: 'one player: a body permanently rebuilt, +ATHLETICISM',
    context: ['practice'],
    target: 'player',
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    use: (ctx) => {
      const squad = ctx.team().filter((p) => p.outWeeks === 0);
      const p = ctx.player ?? squad.sort((a, b) => b.attrs.ath - a.attrs.ath)[0] ?? null;
      if (!p) return { text: 'No legs available for leg day.' };
      const t = tails(2, 25);
      if (t === 'down') {
        return { text: `${p.name} wears the gravity boots for a week and his ankle files a formal complaint. 2 weeks.`, fx: [{ playerId: p.id, attr: { ath: 1 }, outWeeks: 2, outReason: 'gravity ankle', outKind: 'injury' }] };
      }
      if (t === 'up') return { text: `${p.name} wears the gravity boots and becomes LOAD-BEARING. The floor creaks respectfully.`, fx: [{ playerId: p.id, attr: { ath: 2 }, anyAttr: 2 }] };
      return { text: `${p.name} trains a week in the gravity boots. His footsteps now have bass.`, fx: [{ playerId: p.id, attr: { ath: 2 } }] };
    },
  },
  {
    id: 'wallet',
    short: 'WALLT',
    name: 'THE REFEREE\'S "LOST" WALLET',
    rarity: 'rare',
    flavor: 'You found it. You could return it. You could return it COURTSIDE.',
    effectText: 'TONIGHT: the whistle leans your way',
    context: ['pregame'],
    target: 'team',
    up: { pct: 2, cls: 'WINDFALL' },
    down: { pct: 50, cls: 'SCANDAL' },
    use: (ctx) => {
      const t = tails(2, 50);
      if (t === 'down') {
        return { text: 'The referee accepts the wallet, photographs you accepting his acceptance, and forwards everything to the league. The school board would like a word.', fx: [{ heatS: 25 }] };
      }
      ctx.s.pregameFlags.wallet = true;
      if (t === 'up') return { text: 'The referee pockets the wallet AND comps you his food-court vouchers. Tonight, the whistle sings your song.', fx: [{ coachEnergy: 1 }] };
      return { text: 'The referee pockets the wallet without breaking eye contact. Tonight, ties go to you.' };
    },
  },
  {
    id: 'cloak',
    short: 'CLOAK',
    name: 'CLOAKING DOUBT',
    rarity: 'rare',
    flavor: 'A device that makes your game plan look like every game plan.',
    effectText: "TONIGHT: their coach prepared for the wrong team",
    context: ['pregame'],
    target: 'team',
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      ctx.s.pregameFlags.cloak = true;
      const t = tails(5, 2);
      if (t === 'up') return { text: 'The cloak hums. Their coach prepares for four different teams and, in the film room, briefly weeps. You can HEAR which plan they panicked into.', fx: [{ coachEnergy: 0 }] };
      if (t === 'down') return { text: 'The cloak hums so loudly your own huddle gets confused for a minute. It still works.', fx: [{ teamMood: -3 }] };
      return { text: 'The cloak hums. Tonight, their scouting report is a coin flip.' };
    },
  },
  {
    id: 'whistle',
    short: 'WHSTL',
    name: 'THE GOLDEN WHISTLE',
    rarity: 'common',
    flavor: 'Blow it once and one player hears nothing else for a week.',
    effectText: 'one player: a private training session, +1 attribute',
    context: ['practice'],
    target: 'player',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 2, cls: 'DRAIN' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The whistle glints. Nobody reports for extra work.' };
      const t = tails(5, 2);
      if (t === 'up') return { text: `A week of one-on-one mornings and ${p.name} finds TWO new gears. The whistle approves.`, fx: [{ playerId: p.id, anyAttr: 2, mood: 5 }] };
      if (t === 'down') return { text: `${p.name} puts the work in but leaves the week running on fumes.`, fx: [{ playerId: p.id, anyAttr: 1, energyP: -15 }] };
      return { text: `A week of private sessions. ${p.name} comes out sharper.`, fx: [{ playerId: p.id, anyAttr: 1 }] };
    },
  },
  {
    id: 'talk',
    short: 'TALK',
    name: 'THE QUIET WORD',
    rarity: 'common',
    flavor: 'A closed office door and two cups of nebula tea.',
    effectText: 'one player: a private talk, mood +20, energy +10',
    context: ['mood', 'practice'],
    target: 'player',
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The office stays quiet. The tea goes cold.' };
      const t = tails(5, 2);
      if (t === 'up') return { text: `You and ${p.name} talk for two hours. He tells you the real thing. Everything after this is easier.`, fx: [{ playerId: p.id, mood: 30, energyP: 10 }] };
      if (t === 'down') return { text: `The talk goes sideways — you said the wrong name at the wrong moment. ${p.name} leaves colder than he came.`, fx: [{ playerId: p.id, mood: -8 }] };
      return { text: `Tea, silence, then the truth. ${p.name} walks out lighter.`, fx: [{ playerId: p.id, mood: 20, energyP: 10 }] };
    },
  },
  {
    id: 'mixtape',
    short: 'TAPE',
    name: 'HYPE MIXTAPE',
    rarity: 'common',
    flavor: "Forty minutes of their own highlights set to Quadran war drums.",
    effectText: 'one player: mood +25',
    context: ['mood'],
    target: 'player',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The mixtape plays to an empty locker room. It still slaps.' };
      return { text: `${p.name} watches his own highlights until curfew. He walks into practice like a season finale.`, fx: [{ playerId: p.id, mood: 25 }] };
    },
  },
  {
    id: 'nappod',
    short: 'NAP',
    name: 'NAP POD PASS',
    rarity: 'common',
    flavor: 'One session in the faculty-only zero-G sleep pod. Do not tell the faculty.',
    effectText: 'one player: energy +40',
    context: ['practice', 'pregame'],
    target: 'player',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The pod hums, unused. Somewhere, a professor naps unaware of how close it was.' };
      return { text: `${p.name} sleeps nine dreamless zero-G hours and wakes up ready to fight a moon.`, fx: [{ playerId: p.id, energyP: 40 }] };
    },
  },
  {
    id: 'telescope',
    short: 'SCOPE',
    name: 'STARLIGHT TELESCOPE',
    rarity: 'rare',
    flavor: 'Point it at a player and it shows you who they could be.',
    effectText: 'one player: potential +2',
    context: ['practice'],
    target: 'player',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'You point the telescope at the empty gym. It shows you the gym, but better.' };
      const t = tails(5, 2);
      if (t === 'up') return { text: `You show ${p.name} what the telescope sees. He stares for a long time, then goes back inside and starts over, bigger.`, fx: [{ playerId: p.id, anyPot: 4, mood: 8 }] };
      return { text: `You show ${p.name} the ceiling the telescope found. It's higher than the one he'd accepted.`, fx: [{ playerId: p.id, anyPot: 2 }] };
    },
  },
  {
    id: 'protein',
    short: 'BARS',
    name: 'PROTO-PROTEIN BARS',
    rarity: 'common',
    flavor: 'Tastes like drywall. Works like a miracle.',
    effectText: 'THE SQUAD: energy +8',
    context: ['practice', 'pregame'],
    target: 'team',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: () => ({ text: 'The squad chews through the crate with the joyless efficiency of professionals. Legs feel new.', fx: [{ teamEnergyP: 8 }] }),
  },
  {
    id: 'poster',
    short: 'POSTR',
    name: 'SIGNED LEGEND POSTER',
    rarity: 'common',
    flavor: 'A holo-poster of the greatest to ever do it, signed in three dimensions.',
    effectText: 'THE SQUAD: mood +10',
    context: ['mood', 'practice'],
    target: 'team',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: () => ({ text: 'The poster goes up in the locker room. Everyone pretends not to look at it. Everyone looks at it.', fx: [{ teamMood: 10 }] }),
  },
  {
    id: 'alarm',
    short: 'ALARM',
    name: 'FIRE ALARM CODES',
    rarity: 'rare',
    flavor: "The access codes to the visitors' hotel fire panel. You didn't buy these. Officially.",
    effectText: 'TONIGHT: their hotel evacuates at 3am — they play tired',
    context: ['pregame'],
    target: 'team',
    up: { pct: 2, cls: 'WINDFALL' },
    down: { pct: 25, cls: 'SCANDAL' },
    use: (ctx) => {
      ctx.s.pregameFlags.alarm = true;
      const t = tails(2, 25);
      if (t === 'down') {
        return { text: 'The alarm goes off at 3am, beautifully. So does the hotel security cam feed, straight to the league office.', fx: [{ heatS: 15 }] };
      }
      if (t === 'up') return { text: 'The alarm fires THREE times. Their star spends the night on the curb in a blanket. You feel bad. You feel great.', fx: [] };
      return { text: 'The alarm sings at 3am. Tonight their legs answer half a beat late.', fx: [] };
    },
  },
  {
    id: 'seer',
    short: 'LENS',
    name: "THE SEER'S LENS",
    rarity: 'rare',
    flavor: 'Ground from the eye of a dead comet. Shows only true things.',
    effectText: 'one recruit: fully revealed',
    context: ['recruiting'],
    target: 'prospect',
    check: (ctx) => {
      const pr = ctx.s.prospects.find((x) => x.id === ctx.data.prospectId);
      return pr && pr.seenSkill && pr.seenPot && pr.digits >= 2 ? 'you already know everything about them' : null;
    },
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const pool = ctx.s.prospects.filter((pr) => !pr.seenSkill || !pr.seenPot || pr.digits < 2);
      const pr = ctx.data.prospectId !== undefined
        ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId) ?? null
        : pool.length ? pick(pool) : null;
      if (!pr) return { text: 'You raise the lens to the board. You already know everything it could tell you.' };
      pr.seenSkill = true;
      pr.seenPot = true;
      pr.digits = 2;
      pr.scoutLevel = 4;
      pr.seenAttrs = { ...pr.attrs };
      pr.seenPots = { ...pr.pots };
      return { text: `You raise the lens and ${pr.name} resolves into perfect focus — every number, every ceiling, true.` };
    },
  },
  {
    id: 'check',
    short: 'CHECK',
    name: "BOOSTER'S BLANK CHECK",
    rarity: 'rare',
    flavor: 'The amount is blank. The strings are not.',
    effectText: 'one recruit SIGNS. Today. Ink, done, no letter needed.',
    context: ['recruiting'],
    target: 'prospect',
    check: (ctx) => {
      const pr = ctx.s.prospects.find((x) => x.id === ctx.data.prospectId);
      return pr?.signed ? 'that ink is already dry' : null;
    },
    up: { pct: 2, cls: 'LOOT' },
    down: { pct: 25, cls: 'SCANDAL' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined
        ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId)
        : [...ctx.s.prospects].filter((x) => !x.signed).sort((a, b) => ovr(b.pots) - ovr(a.pots))[0];
      if (!pr) return { text: 'Nobody to buy. The check flutters, unspent.' };
      // he signs THEN AND THERE: locked on the board until signing day
      pr.commitPct = 100;
      pr.selected = true;
      pr.signed = true;
      const t = tails(2, 25);
      if (t === 'down') {
        return {
          text: `${pr.name} signs on the spot — pen still warm, letter of intent framed by dinnertime. So does the check: into a league evidence folder, eventually. You can feel the investigation coming like weather.`,
          follow: [{ weeks: 4, beat: 'start', defId: 'check_probe', playerId: null }],
        };
      }
      return { text: `${pr.name} signs on the spot. Done. Sealed. Nothing wanes, nothing waits for signing day. The booster winks at you across the parking lot for an uncomfortably long time.` };
    },
  },
  // the commitment boosters: a CHUNK now, and chunks can wane — two weights
  {
    id: 'pledge',
    short: 'PLEDG',
    name: "BOOSTER'S PLEDGE",
    rarity: 'common',
    flavor: 'A handshake, a promise, a hat with your logo already on it.',
    effectText: 'one recruit: commitment +20% (it can still wane)',
    context: ['recruiting'],
    target: 'prospect',
    check: (ctx) => {
      const pr = ctx.s.prospects.find((x) => x.id === ctx.data.prospectId);
      return pr?.signed ? 'they already signed — nothing left to pledge' : null;
    },
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 5, cls: 'DRAMA' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined
        ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId)
        : ctx.s.prospects.filter((x) => !x.signed)[0];
      if (!pr) return { text: 'Nobody to pledge to. The hat stays in the box.' };
      const t = tails(5, 5);
      if (t === 'down') {
        pr.commitPct = clamp(pr.commitPct + 8, 0, 95);
        return { text: `${pr.name} takes the pledge politely — and posts the hat on a resale stream an hour later. Commitment +8%, dignity −some.` };
      }
      pr.commitPct = clamp(pr.commitPct + (t === 'up' ? 28 : 20), 0, 95);
      return { text: t === 'up'
        ? `${pr.name} wears the hat to school the next day. THE HAT IS WORKING. Commitment +28%.`
        : `${pr.name} shakes on it and keeps the hat. Commitment +20% — for now. Commitments wane; hats fade.` };
    },
  },
  {
    id: 'warchest',
    short: 'CHEST',
    name: 'THE WAR CHEST',
    rarity: 'rare',
    flavor: 'A crate of "recruiting materials". It clinks.',
    effectText: 'one recruit: commitment +40%',
    context: ['recruiting'],
    target: 'prospect',
    check: (ctx) => {
      const pr = ctx.s.prospects.find((x) => x.id === ctx.data.prospectId);
      return pr?.signed ? 'they already signed — save the chest' : null;
    },
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 10, cls: 'SCANDAL' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined
        ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId)
        : ctx.s.prospects.filter((x) => !x.signed)[0];
      if (!pr) return { text: 'Nobody to impress. The chest clinks, unopened.' };
      const t = tails(5, 10);
      pr.commitPct = clamp(pr.commitPct + (t === 'up' ? 50 : 40), 0, 95);
      if (t === 'down') {
        return { text: `${pr.name} leans WAY in — and so does a league auditor who counted the crates on the loading dock. Commitment +40%.`, fx: [{ heatS: 8 }] };
      }
      return { text: t === 'up'
        ? `The chest opens. ${pr.name}'s whole holo-feed is your program for a week. Commitment +50%.`
        : `The chest opens. ${pr.name} leans in hard. Commitment +40% — a chunk, not a signature. Chunks can wane.` };
    },
  },
];

// ---- THE SUPPLY CLOSET: small single-use items that find you most weeks ------

ITEMS.push(
  {
    id: 'patch',
    short: 'PATCH',
    name: 'PATCH KIT',
    rarity: 'common',
    flavor: 'Tape, spray, and a lie about how bad it looked.',
    effectText: 'MEDICAL · an injury: one week off it',
    context: ['injury'],
    target: 'player',
    check: (ctx) => medicalCheck(ctx.player, 'the tape stays in the roll'),
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 5, cls: 'INJURY' },
    use: (ctx) => medicalUse(ctx.player!, 1, ctx.s.tutorial !== undefined ? 0 : 5, 'Tape, spray, done.', 'The tape lied about how bad it looked.'),
  },
  {
    id: 'snakeoil',
    short: 'OIL',
    name: 'SNAKE OIL',
    rarity: 'common',
    flavor: 'From a man with a cart, a hat, and no fixed address.',
    effectText: 'MEDICAL · an injury: usually a week off it. Usually.',
    context: ['injury'],
    target: 'player',
    check: (ctx) => medicalCheck(ctx.player, 'the salesman shrugs'),
    up: { pct: 10, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    use: (ctx) => {
      const p = ctx.player!;
      const t = tails(10, 10);
      if (t === 'up') return { text: `The oil works ABSURDLY well. ${p.name} walks in two days later asking why everyone looks so surprised.`, fx: [{ playerId: p.id, outWeeks: Math.max(0, p.outWeeks - 2), outReason: p.outReason }] };
      if (t === 'down') return { text: `The oil was, it turns out, actual snake. ${p.name} adds a rash and a week.`, fx: [{ playerId: p.id, outWeeks: p.outWeeks + 1, outReason: p.outReason }] };
      if (roll(30)) return { text: `The oil smells like a promise and does nothing. ${p.name} heals on schedule.` };
      return { text: `The oil does... something. ${p.name} is a week ahead of the chart, and nobody wants to know why.`, fx: [{ playerId: p.id, outWeeks: Math.max(0, p.outWeeks - 1), outReason: p.outReason }] };
    },
  },
  {
    id: 'cryo',
    short: 'CRYO',
    name: 'CRYO CHAMBER TOKEN',
    rarity: 'rare',
    flavor: 'One session in the pro clinic\'s freezer. Bring a blanket.',
    effectText: 'MEDICAL · an injury: two weeks off it',
    context: ['injury'],
    target: 'player',
    check: (ctx) => medicalCheck(ctx.player, 'the chamber hums for nobody'),
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    use: (ctx) => medicalUse(ctx.player!, 2, 10, 'The chamber hisses open.', 'The chamber hisses open a day late — frostbite on top of everything.'),
  },
  {
    id: 'pocketweek',
    short: 'WEEK',
    name: 'A POCKET WEEK',
    rarity: 'common',
    flavor: 'A localized time machine the size of a lunchbox. They live the week; you don\'t.',
    effectText: 'TIME · an absence (not an injury): one week less of it',
    context: ['away'],
    target: 'player',
    check: (ctx) => timeCheck(ctx.player, 'the lunchbox stays shut'),
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 8, cls: 'DRAMA' },
    use: (ctx) => timeUse(ctx.player!, 1, 8),
  },
  {
    id: 'timeloop',
    short: 'LOOP',
    name: 'THE LOCALIZED TIME LOOP',
    rarity: 'rare',
    flavor: 'A ring of light around one person. Inside it, Tuesday happens fourteen times.',
    effectText: 'TIME · an absence (not an injury): two weeks less of it',
    context: ['away'],
    target: 'player',
    check: (ctx) => timeCheck(ctx.player, 'the ring finds nobody to circle'),
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 15, cls: 'DRAMA' },
    use: (ctx) => timeUse(ctx.player!, 2, 15),
  },
  {
    id: 'juice',
    short: 'JUICE',
    name: 'VOLT JUICE',
    rarity: 'common',
    flavor: 'Carbonated. Possibly sentient. Definitely effective.',
    effectText: 'one player: +25 energy',
    context: ['practice', 'pregame'],
    target: 'player',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The juice fizzes at nobody.' };
      return { text: `${p.name} downs the Volt Juice and vibrates gently for an hour. Legs: back.`, fx: [{ playerId: p.id, energyP: 25 }] };
    },
  },
  {
    id: 'cocoa',
    short: 'COCOA',
    name: 'NEBULA COCOA',
    rarity: 'common',
    flavor: 'Warm the way home planets are warm.',
    effectText: 'one player: +12 mood',
    context: ['mood'],
    target: 'player',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The cocoa steams alone.' };
      return { text: `${p.name} wraps both hands around the mug and exhales a whole week.`, fx: [{ playerId: p.id, mood: 12 }] };
    },
  },
  {
    id: 'pass',
    short: 'PASS',
    name: 'GYM GUEST PASS',
    rarity: 'common',
    flavor: 'After-hours access to the pro facility across town.',
    effectText: 'one player: +10 XP',
    context: ['practice'],
    target: 'player',
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 2, cls: 'DRAIN' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The pass expires unstamped.' };
      return { text: `${p.name} gets a night on the pro floor. The rims are the same height. Everything else is different.`, fx: [{ playerId: p.id, xp: 10 }] };
    },
  }
);

// ---- POWER ITEMS (v5 M3): the spiral needs a bailout to exist as loot --------
// Fans fall → ultimatum → mood falls → Players fall. These are the levers.
ITEMS.push(
  {
    id: 'puffpiece',
    short: 'PUFF',
    name: 'THE PUFF PIECE',
    rarity: 'rare',
    flavor: 'Scoop owes you one. He hates that he owes you one.',
    effectText: 'THE PUBLIC +20 — and Scoop leaves you his own notes on the week',
    context: ['mood'],
    target: 'team',
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const s = ctx.s;
      // he empties his notebook into yours: the week's answers, pre-written
      const jot = (kind: string, key: string, text: string): void => {
        if (!s.notebook.some((n) => n.key === key)) s.notebook.unshift({ season: s.season, week: s.week, kind, key, text });
      };
      const r = s.lastResult;
      if (r) {
        const mvp = r.box.find((x) => x.playerId === r.mvpId)?.name ?? '—';
        const top = r.box[0];
        jot('mvp', `mvp:${s.season}:${s.week}`, `${r.win ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${r.oppName} · MVP ${mvp} · top scorer ${top ? `${top.name} (${top.pts})` : '—'}`);
        jot('results', `res:${s.season}:${s.week}`, [`my game: ${r.win ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${r.oppName}`, ...s.resultsLog].join(' · '));
      }
      const tops: string[] = [];
      for (const k of ['pts', 'reb', 'stl', 'ast'] as const) {
        let best: { name: string; v: number } | null = null;
        for (const t of s.teams) for (const p of t.players) if (!best || p.stats[k] > best.v) best = { name: p.name, v: p.stats[k] };
        tops.push(`${STAT_WORD[k]}: ${best?.name ?? '—'} (${best?.v ?? 0})`);
      }
      jot('lead', `lead:${s.season}:${s.week}`, `league leaders — ${tops.join(' · ')}`);
      return {
        text: 'The piece runs Sunday: two columns, one flattering photograph, the word "architect" used without irony. Folded inside your copy: Scoop\'s own notes on the week, in handwriting neater than his hat suggests.',
        fx: [{ opP: 20 }],
      };
    },
  },
  {
    id: 'alumnigala',
    short: 'GALA',
    name: 'THE ALUMNI GALA',
    rarity: 'rare',
    flavor: 'Three hundred people who once rushed this court, back in one room.',
    effectText: '3¢ · every opinion +8 — the campus remembers it likes basketball',
    context: ['mood'],
    target: 'team',
    check: (ctx) => (ctx.s.energy >= 3 ? null : 'the caterers want 3¢ up front'),
    up: { pct: 10, cls: 'WINDFALL' },
    down: { pct: 2, cls: 'DRAIN' },
    use: () => {
      const t = tails(10, 2);
      const base: Fx = { coachEnergy: -3, heatS: -8, heatB: -8, opP: 8, teamMood: 6 };
      if (t === 'up') {
        return { text: 'The gala runs three hours past the permit. Old banners come down off the truck, somebody re-hangs a buzzer-beater on the holo-loop, and an alum presses an envelope into your hand "for the program". Every voice on campus softens.', fx: [base, { coachEnergy: 2 }] };
      }
      if (t === 'down') {
        return { text: 'The gala lands — the room sings the fight song twice — but the open bar was a mistake you will be paying for monthly. (−1¢ more.)', fx: [base, { coachEnergy: -1 }] };
      }
      return { text: 'The gala fills the old gym with people who remember it louder. The dean laughs at a booster\'s joke. Scoop dances, badly, with the head cheerleader\'s grandmother. The campus remembers it likes basketball.', fx: [base] };
    },
  },
  {
    id: 'pardon',
    short: 'GRACE',
    name: 'THE FORGIVING SEASON',
    rarity: 'legendary',
    flavor: 'A holiday so old the league rulebook just says "observed".',
    effectText: 'an ultimatum, cancelled — whoever set it respects the nerve',
    context: ['ultimatum'],
    target: 'team',
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const s = ctx.s;
      s.lastDemand = { season: s.season, week: s.week }; // the terms rest a while
      return {
        text: 'You invoke THE FORGIVING SEASON — the old rite, the open palm. The room goes quiet, then somebody laughs despite themselves, and the list of demands goes back into the briefcase unread. Grudging respect is still respect.',
        fx: [{ heatS: -12, heatB: -12, opP: 5, teamMood: 4 }],
      };
    },
  },
  {
    id: 'gooseegg',
    short: 'EGG',
    name: 'GOLDEN GOOSE EGG',
    rarity: 'legendary',
    flavor: 'Heavy, warm, and stamped by a bank with no address.',
    effectText: '+6¢, once — a facilities fund from a mystery donor. Scoop gets curious…',
    context: ['mood'],
    target: 'team',
    up: { pct: 2, cls: 'WINDFALL' },
    down: { pct: 25, cls: 'DRAMA' },
    use: () => ({
      text: 'The egg cracks open on your desk: six credits in unmarked chips and a note that reads "FOR THE PROGRAM. ASK NOTHING." You ask nothing. Somewhere across campus, a fedora tilts toward your window.',
      fx: [{ coachEnergy: 6 }],
      follow: [{ weeks: 1, beat: 'start', defId: 'goose_press', playerId: null }],
    }),
  }
);

/** The supply-closet drip: an item most weeks — small, single-use, meant to
    be SPENT (the notebook holds the fifth slot forever). */
export const SMALL_ITEMS = ['patch', 'juice', 'cocoa', 'pass', 'protein', 'poster', 'snakeoil', 'pocketweek'];

export function itemById(id: string): ItemDef {
  return ITEMS.find((i) => i.id === id)!;
}

// ---- Universal Tournament content -----------------------------------------------

export const CHAMP_NAMES = [
  ['Kro', 'Nebular Wraiths'], ['Vantor-3', 'Sun Eaters'], ['Ophee', 'Comet Queens'],
  ['Drexal', 'Iron Choir'], ['Bulwark-9', 'Gravity Saints'], ['Xyphos', 'Star Serpents'],
  ['Molt', 'Hatchling Kings'], ['Verdant-2', 'Moss Titans'], ['Kessel Minor', 'Void Larks'],
  ['Thrace-7', 'Plasma Prophets'], ['Ummber', 'Dust Devils'], ['Neon Roa', 'Lightbenders'],
];

/** The scout's read on a champion, by the speech they live in — written the
    way a scout talks after three redeyes and too much station coffee. */
export const CHAMP_STYLE: Record<PlanId, string[]> = {
  showtime: ['they shoot from the parking lot, and the parking lot is in orbit', 'every possession ends in a shot that should be illegal and isn\'t'],
  rungun: ['they run you back to last Tuesday', 'their warmup lap lapped our shuttle'],
  lockdown: ['they steal your dribble, your lunch, and one of my pens', 'my clipboard came back with a bruise'],
  clockwork: ['they\'ve read your playbook, your diary, and your mind, in that order', 'they run one play 94 ways and apologize for none of them'],
  warcry: ['the chant alone is worth six points', 'they warm up by headbutting the stanchion'],
  zenmind: ['they play so calm the shot clock relaxes', 'I fell asleep scouting them. I woke up down 12'],
  stardust: ['their handles have handles', 'the ball never touched the floor. I timed it'],
  engine: ['their legs don\'t know what a fourth quarter is', 'they pressed me on the way to my seat'],
  rally: ['their locker room can be heard from the next system', 'their morale has its own gravity well'],
  easy: ['they coast until they don\'t, and then it\'s over', 'they save everything for the exact minute you relax'],
};

export const CHAMP_GIMMICKS = [
  'undefeated in three galaxies',
  'all-Lithoid front line, all of it angry',
  'coached by a sentient cloud with a whistle',
  'won their league by forfeit — nobody will play them',
  'their home arena orbits inside a star',
  'their fans are, legally speaking, a swarm',
  'every player is the same age, which is 9,000',
  'run one play. It has never been stopped.',
  'their point guard is wanted in two systems',
  'they practice in double gravity, for fun',
];

export const CHAMP_COLORS: [string, string][] = [
  ['#8E1600', '#FFD9CC'], ['#B78400', '#241A00'], ['#005F73', '#CFFAFE'],
  ['#3F3F46', '#FDE047'], ['#6D28D9', '#DDD6FE'], ['#0F766E', '#CCFBF1'],
  ['#9D174D', '#FCE7F3'], ['#3F6212', '#ECFCCB'],
];

// ---- flavor pools -----------------------------------------------------------------

export const PROSPECT_BLURBS = [
  'Plays angry. Studies angrier.',
  'Homeschooled on a mining barge. Unbothered by crowds.',
  'Three-time intramural MVP of an orbital prep academy.',
  'His coach says he\'s "a project." His transcript says the same.',
  'Genuinely came for the education. Weird kid. Great motor.',
  'Grew four inches on the shuttle ride to the tryout.',
  "Dean's list. Also wanted in two systems for unpaid parking drones.",
  'Warms up in silence. Referees find it upsetting.',
];

export const WALKON_BLURBS = [
  'Won the halftime shooting contest twice. Insists that counts.',
  'Showed up to tryouts in jeans. Made every layup.',
  'The rec-center legend your assistant keeps mentioning.',
  'Filed the walk-on paperwork in crayon. Enthusiasm: elite.',
];

export const SCAN_FLAVOR = [
  'Scan complete. New names on the board:',
  'The long-range array pings twice. Fresh dossiers:',
  'The scout-scoop comes back full. On the board:',
];

const FESTS = [
  'the High Festival', 'the Harvest Festival', 'the Moon-Hatching', 'Ancestor Week',
  'the Feast of the Second Sun', 'the Great Molting', 'Gravity Day', 'the Festival of a Thousand Cousins',
];

// ---- injuries: one shared pool, many causes (SPEC §10.1) ---------------------------

export interface InjuryRoll {
  weeks: number;
  label: string;
  levelLoss: boolean;
}

/** Severity is drama's job; the printed rung was only the chance. */
export function rollInjury(bias: number, fragile: number): InjuryRoll {
  const r = Math.random() * 100 * (fragile > 1 ? 1.4 : 1) + bias * 12;
  if (r < 45) return { weeks: 1, label: 'a bad tweak', levelLoss: false };
  if (r < 75) return { weeks: 2 + rand(2), label: 'a real injury', levelLoss: false };
  return { weeks: 4 + rand(3), label: 'a bio-lab stay', levelLoss: true };
}

// ---- THE STORY REGISTRY -------------------------------------------------------------
// Two layers: cause flavors (owned by the source) + class-owned storylines.
// Every def is (beat, resolve). Everything printed is true (law 5).

export interface StoryBeatContent {
  tag: string;
  text: string;
  choices?: StoryChoiceView[];
  data?: Record<string, unknown>;
}

export interface StoryDef {
  id: string;
  kind: 'player' | 'coach';
  weight?: number;
  context?: string;
  /** the story panel illustration: a ship (always STARTS moving, then
      transitions to `artEvent` once the story says what happened), or a
      character who acts the stakes (worried → mad/elated/neutral). 'side'
      picks dean/booster from the event's data.side (the summons). Vehicle
      kind can be overridden per event via data.art. */
  art?: 'bus' | 'saucer';
  artEvent?: 'stranded' | 'hoop';
  figure?: 'dean' | 'booster' | 'scoop' | 'janitor' | 'assistant' | 'attendant' | 'oracle' | 'cheerleader' | 'nerd' | 'ref' | 'bookie' | 'goblin' | 'side';
  /** the card backdrop behind the acting sprite: the ABILITIES compass for
      growth stories, the energy/mood gauges (ROSTER) for everything else */
  card?: 'abilities' | 'meters';
  /** restrict the weekly-pool player roll to these body forms */
  forms?: ('masc' | 'femme' | 'x')[];
  when?: (s: GameState) => boolean;
  beat: (beatKey: string, ctx: StoryCtx) => StoryBeatContent;
  resolve: (choiceKey: string, ctx: StoryCtx, ev: StoryEvent) => StoryResolution;
}

const C = (key: string, label: string, opts: Partial<StoryChoiceView> = {}): StoryChoiceView => ({ key, label, ...opts });

function pname(ctx: StoryCtx): string {
  return ctx.player?.name ?? 'the kid';
}

/** Printed odds shifted by the player's head — with the cause shown (law 5). */
function headMod(p: Player | null, base: number, attr: 'frc' | 'brn'): { pct: number; note?: string } {
  if (!p) return { pct: base };
  if (p.attrs[attr] >= 14) return { pct: Math.min(90, base * 2), note: attr === 'frc' ? "he's FIERCE, careful" : "he's got BRAINS — or says he does" };
  return { pct: base };
}

/** Something the coach doesn't know yet: a locked drill, an unlearned
    speech, or a strange last-minute instruction. */
function pickKnowledge(s: GameState): { kind: 'drill' | 'plan' | 'instr'; id: string; name: string } | null {
  const options: { kind: 'drill' | 'plan' | 'instr'; id: string; name: string }[] = [
    ...DRILLS.filter((d) => !s.unlockedDrills.includes(d.id)).map((d) => ({ kind: 'drill' as const, id: d.id, name: d.name })),
    ...PLANS.filter((pl) => !s.knownPlans.includes(pl.id)).map((pl) => ({ kind: 'plan' as const, id: pl.id, name: pl.name })),
    ...INSTRUCTIONS.filter((it) => !(s.knownInstr ?? []).includes(it.id)).map((it) => ({ kind: 'instr' as const, id: it.id, name: it.name })),
  ];
  return options.length ? pick(options) : null;
}

export const STORIES: StoryDef[] = [
  // ---- the level-up: XP banked, the coach decides where the growth lands ------
  // NEVER a dead end: an attribute with room takes points freely up to its
  // potential; an attribute AT its potential can still take exactly +1 —
  // and the +1 DRAGS the potential up with it. The only hard walls are the
  // 25 scale and level 10.
  {
    id: 'levelup',
    kind: 'player',
    card: 'abilities',
    beat: (_b, ctx) => {
      const p = ctx.player!;
      const pts = (ctx.data.points as number) ?? 2;
      const open = ATTRS.filter((a) => p.attrs[a] < 25);
      // choices run the compass clockwise: SKL, FRC, ATH, BRN
      const COMPASS: Attr[] = ['skl', 'frc', 'ath', 'brn'];
      return {
        tag: '★ LEVEL UP ★',
        text: `${p.name} hits LEVEL ${p.level}. The work has banked +${pts} points — and where they land is a coach's call.`,
        choices: open.length
          ? COMPASS.map((a) => {
              if (p.attrs[a] >= 25) return C(a, `${ATTR_LABEL[a]}  25 — THE SCALE ENDS`, { disabled: 'the scale ends here' });
              const room = p.pots[a] - p.attrs[a];
              const take = room <= 0 ? 1 : Math.min(room, pts);
              return C(a, `${ATTR_LABEL[a]}  ${p.attrs[a]} → ${p.attrs[a] + take}${room <= 0 ? ' ▲ PAST THE CEILING' : ''}`);
            })
          : [C('done', 'THE SCALE HAS NOTHING LEFT. SHAKE HIS HAND.')],
      };
    },
    resolve: (key, ctx) => {
      const p = ctx.player;
      if (!p) return { text: 'The banked points leave with him. Growth belongs to whoever shows up.' };
      const pts = (ctx.data.points as number) ?? 2;
      if (key === 'done') return { text: `${p.name} has maxed the scale itself. That's not sad. That's a finished monument.`, fx: [{ mood: 5 }] };
      const a = key as Attr;
      const room = p.pots[a] - p.attrs[a];
      const lines: Record<Attr, string> = {
        skl: `${p.name} lives in the gym for a week. The net starts making that sound.`,
        ath: `${p.name} rebuilds his body one brutal morning at a time. The floor feels smaller now.`,
        frc: `${p.name} finds the mean streak and makes it a tool. Opponents will learn his name the hard way.`,
        brn: `${p.name} starts seeing the floor two passes early. The game slows down for him.`,
      };
      if (room <= 0) {
        // the +1 past potential drags the ceiling up with it
        return {
          text: `${lines[a]} Everyone said he was finished growing there. Everyone watches the ceiling move.`,
          fx: [{ potAttr: { [a]: 1 } }, { attr: { [a]: 1 } }],
        };
      }
      return { text: lines[a], fx: [{ attr: { [a]: Math.min(room, pts) } }] };
    },
  },
  // ---- the injury storyline (class pool: INJURY) — reached from every cause ----
  {
    id: 'injury',
    kind: 'player',
    context: 'injury',
    beat: (_b, ctx) => {
      const weeks = ctx.data.weeks as number;
      const cause = ctx.data.cause as string;
      const label = ctx.data.label as string;
      const canPush = weeks <= 3;
      return {
        tag: 'INJURY REPORT',
        text: `${cause}\n\nThe med-scanner calls it ${label}: ${weeks} week${weeks === 1 ? '' : 's'} out.`,
        choices: [
          C('heal', `LET IT HEAL (${weeks}w out)`, { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'INJURY' } }),
          ...(canPush
            ? [C('push', 'TAPE IT UP — HE PLAYS', { up: { pct: 10, cls: 'BREAKTHROUGH' }, down: { pct: 50, cls: 'INJURY' }, want: 'love' })]
            : []),
        ],
      };
    },
    resolve: (key, ctx) => {
      const p = ctx.player!;
      const weeks = ctx.data.weeks as number;
      const levelLoss = ctx.data.levelLoss as boolean;
      const label = (ctx.data.label as string) ?? 'the injury';
      if (key === 'push') {
        const t = tails(10, 50);
        if (t === 'down') {
          // a doubled injury still tops out at 8 weeks — a season has limits
          const dbl = Math.min(8, weeks * 2);
          return {
            text: `${p.name} plays through it and something GOES. What was ${weeks} weeks is now ${dbl}. The med staff writes your name on a whiteboard with an unkind diagram.`,
            fx: [{ playerId: p.id, outWeeks: dbl, outReason: label, outKind: 'injury', mood: -8, ...(dbl >= 4 ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
          };
        }
        if (t === 'up') {
          return { text: `${p.name} tapes it, plays, and finds a gear he didn't know he had. Pain is a teacher, apparently.`, fx: [{ playerId: p.id, attr: { frc: 1 }, xp: 10, mood: 6 }] };
        }
        return { text: `${p.name} grits through the week. It holds. Barely.`, fx: [{ playerId: p.id, energyP: -20 }] };
      }
      // heal
      const t = tails(2, 2);
      if (t === 'up') {
        return {
          text: `${p.name} goes home to heal — and comes back the NEXT MORNING. His mother, it turns out, knows a way to regrow anything overnight. She sends you a casserole. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, outWeeks: 0, mood: 15 }],
        };
      }
      if (t === 'down') {
        return {
          text: `${p.name} settles in to heal — then a complication. One extra week, and the med staff's tone got shorter.`,
          fx: [{ playerId: p.id, outWeeks: weeks + 1, outReason: `${label} (complication)`, outKind: 'injury', ...(weeks + 1 >= 4 && levelLoss ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
        };
      }
      return {
        text: `${p.name} settles into the bio-lab. The tank hums. ${weeks} week${weeks === 1 ? '' : 's'} of waiting starts now.`,
        fx: [{ playerId: p.id, outWeeks: weeks, outReason: label, outKind: 'injury', ...(levelLoss ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
      };
    },
  },

  // ---- generic drama & scandal pools -----------------------------------------
  {
    id: 'drama',
    kind: 'player',
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'LOCKER ROOM',
      text: `${ctx.data.cause ?? `${pname(ctx)} slammed a locker hard enough to dent it, and nobody will say why.`}\n\nThe room has gone quiet in the bad way.`,
      choices: [
        C('meeting', 'CALL A TEAM MEETING (1¢)', { cost: 1, up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
        C('ignore', 'LET IT BLOW OVER', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player;
      if (key === 'meeting') {
        const t = tails(25, 5);
        if (t === 'up') return { text: 'The meeting runs long. Someone finally says the true thing out loud. The room exhales.', fx: [{ teamMood: 15 }] };
        if (t === 'down') return { text: 'The meeting turns into a tribunal. Old grievances get new lawyers.', fx: [{ teamMood: -8 }] };
        return { text: 'You talk. They listen, mostly. It helps, some.', fx: [{ teamMood: 6 }] };
      }
      const t = tails(5, 25);
      if (t === 'down') return { text: 'It does not blow over. It recruits.', fx: [{ teamMood: -10 }, ...(p ? [{ playerId: p.id, mood: -10 } as Fx] : [])] };
      if (t === 'up') return { text: 'By Thursday it has somehow become an inside joke. Teams are strange weather.', fx: [{ teamMood: 6 }] };
      return { text: 'It simmers, then settles. Mostly.', fx: [{ teamMood: -3 }] };
    },
  },
  // ---- THE FROZEN ONE: he knocks at PLAY, not on a Monday --------------------
  // Every player has a PATIENCE (2–6 games in street clothes). Cross it and he
  // meets you at the locker room door with tip-off minutes away. Say he's
  // right and the lineup is yours again — put him on the floor or eat a
  // broken promise after the game (double mad). Put him on and the one HE
  // displaced can hold it against you after the game instead.
  {
    id: 'frozen',
    kind: 'player',
    context: 'mood',
    beat: (b, ctx) => {
      const p = pname(ctx);
      if (b === 'broken') {
        return { tag: 'THE FROZEN ONE', text: `"You said I'd play tonight." ${p} is standing in the tunnel in a warm-up jacket that never came off.\n\nHe doesn't slam anything. That's the worst part.` };
      }
      if (b === 'kept') {
        return { tag: 'THE FROZEN ONE', text: `${p} checked in tonight — real minutes, real sweat. In the locker room he nods at you once.\n\nPromises kept are rare currency out here.` };
      }
      if (b === 'unfair') {
        const who = (ctx.data.who as string) ?? 'the kid';
        return { tag: 'LOCKER ROOM', text: `${p} corners you after the game. "So ${who} complains, and ${who} plays? What do the rest of us have to do — cry?"\n\nA few heads turn. They heard it too.` };
      }
      const games = (ctx.data.games as number) ?? 4;
      return {
        tag: 'THE FROZEN ONE',
        text: `Tip-off is in twenty minutes and ${p} is at the locker room door with his warm-ups still on. "Coach. ${games} games. I haven't played in ${games} games."\n\nThe whole room pretends not to listen.`,
        choices: [
          C('promise', "YOU'RE RIGHT — YOU PLAY TONIGHT", { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA', note: 'now put him on the floor' }, want: 'love' }),
          C('earn', '"EARN IT. NOT TONIGHT."', { up: { pct: 5, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'DRAMA' }, want: 'hate' }),
        ],
      };
    },
    resolve: (key, ctx, ev) => {
      const p = ctx.player!;
      const s = ctx.s;
      if (ev.beat === 'broken') return { text: `${p.name} watched from the same seat, again. Whatever you tell him next, he has already decided what it's worth.`, fx: [{ mood: -30 }, { teamMood: -3 }] };
      if (ev.beat === 'kept') return { text: 'Word gets around: this coach means what he says.', fx: [{ mood: 8, teamMood: 2 }] };
      if (ev.beat === 'unfair') return { text: 'You tell him minutes are earned. He says "apparently not." The room files it away.', fx: [{ mood: -12 }] };
      if (key === 'promise') {
        // the lineup screen is yours again — the floor as it stands NOW is
        // remembered, so whoever he bumps can take it personally later
        const floor = s.teams[s.myTeamId].lineup.slots.slice(0, 6).filter((x): x is number => x !== null);
        s.promise = { playerId: p.id, floor, week: s.week };
        return {
          text: `"Okay, coach." ${p.name} is already stretching.\n\nNow get him on the floor — the lineup is still yours to set.`,
          fx: [{ mood: 8, tense: true }],
        };
      }
      // earn it: tip-off resumes the moment this closes
      s.resumePlay = true;
      if (roll(5)) return { text: `${p.name} takes it personally — in the useful way. He'll practice like the gym owes him money.`, fx: [{ mood: -4, xp: 15 }] };
      return { text: `${p.name} nods once, the way people nod when they've stopped listening. Tip-off.`, fx: [{ mood: -14 }] };
    },
  },
  {
    id: 'scandal',
    kind: 'coach',
    figure: 'dean',
    beat: (_b, ctx) => ({
      tag: 'THE LEAGUE CALLS',
      text: `${ctx.data.cause ?? 'A league investigator is in your lobby, holding a folder like it owes him money.'}\n\nHow do you play it?`,
      choices: [
        C('own', 'OWN IT, TAKE THE HIT', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'SCANDAL' } }),
        C('deny', 'DENY EVERYTHING', { up: { pct: 25, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      // a league affair plays out in PUBLIC — Scoop's track eats most of it,
      // the school board the rest
      if (key === 'own') {
        const t = tails(10, 2);
        if (t === 'up') return { text: 'You own it so completely the press conference becomes a redemption arc. The school hates the headline and respects the spine.', fx: [{ opP: -4, heatS: 2, teamMood: 5 }] };
        return { text: 'You take the hit standing up. It costs, but it costs once.', fx: [{ opP: -7, heatS: 3 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: 'The denial HOLDS. The folder, it turns out, was mostly receipts from a noodle bar.', fx: [] };
      if (t === 'down') return { text: 'The denial collapses in four days. Now it\'s the thing AND the cover-up of the thing.', fx: [{ opP: -14, heatS: 6 }] };
      return { text: 'The league can\'t prove it. The school can\'t forget it.', fx: [{ opP: -8, heatS: 4 }] };
    },
  },

  // ---- breakthrough pool (class: BREAKTHROUGH) ---------------------------------
  {
    id: 'breakthrough',
    kind: 'player',
    card: 'abilities',
    beat: (_b, ctx) => ({
      tag: '★ BREAKTHROUGH ★',
      text: `${ctx.data.cause ?? 'Mid-drill, the gym goes quiet.'}\n\n${pname(ctx)} just did something nobody practiced. Everyone saw it. Nobody can explain it.`,
    }),
    resolve: (_key, ctx) => {
      const p = ctx.player!;
      if (Math.random() < 0.5) {
        return { text: `${p.name}'s ceiling just moved. You felt it move.`, fx: [{ playerId: p.id, anyPot: 6, mood: 10 }] };
      }
      return { text: `${p.name} has leveled his whole game up overnight.`, fx: [{ playerId: p.id, levelDelta: 1, mood: 10 }] };
    },
  },

  // ---- weekly player stories (ported to the two-tier template) ------------------
  {
    id: 'festival',
    kind: 'player',
    weight: 4,
    context: 'mood',
    beat: (b, ctx) => {
      const p = pname(ctx);
      if (b === 'ask') {
        const fest = ctx.data.fest as string;
        return {
          tag: 'CAMPUS STORY',
          text: `It's ${fest} on ${p}'s home planet — the whole world shuts down for it. He wants two weeks. He's looking at you with all of his eyes.`,
          choices: [
            C('full', 'TWO WEEKS. SEE THE COUSINS.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 10, cls: 'INJURY' }, want: 'love' }),
            C('bargain', '"ONE WEEK. BRING ME LEFTOVERS."', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
            C('no', 'PLAYOFFS ARE MADE IN WEEKS LIKE THIS.', { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'DRAMA' }, want: 'hate' }),
          ],
        };
      }
      return {
        tag: 'CAMPUS STORY',
        text: `${p} is at your door with a packed duffel bag. He's asking for time off. He hasn't said why.`,
        choices: [
          C('sure', '"SURE." (ask nothing)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' }, want: 'love' }),
          (() => {
            const m = headMod(ctx.player, 25, 'frc');
            return C('why', '"WHY?"', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: m.pct as 2 | 5 | 10 | 25 | 50, cls: 'DRAMA', note: m.note } as OddsTail });
          })(),
        ],
      };
    },
    resolve: (key, ctx, ev) => {
      const p = ctx.player!;
      if (ev.beat === 'ask') {
        if (key === 'no') {
          const t = tails(2, 25);
          if (t === 'down') return { text: `${p.name} nods and walks out without a word. His cousins send a group holo from the festival every night. He watches all of them.`, fx: [{ playerId: p.id, mood: -16 }] };
          if (t === 'up') return { text: `${p.name} channels it. Every drill this week is personal. You feel a little bad about how well this worked.`, fx: [{ playerId: p.id, mood: -6, xp: 12 }] };
          return { text: `${p.name} stays. He's professional about it. Professionally cold.`, fx: [{ playerId: p.id, mood: -10 }] };
        }
        const weeks = key === 'full' ? 2 : 1;
        const res: StoryResolution = {
          text: key === 'full'
            ? `${p.name} boards the long-haul shuttle with a smile you haven't seen since preseason.`
            : `${p.name} negotiates hard, settles for one week, and promises leftovers. There will be leftovers.`,
          fx: [{ playerId: p.id, outWeeks: weeks, outReason: 'home for the festival', mood: key === 'full' ? 10 : 4, tense: true }],
          follow: [{ weeks: weeks + 1, beat: 'start', defId: 'festival_return', playerId: p.id, data: { full: key === 'full' } }],
        };
        if (key === 'bargain' && tails(5, 25) === 'down') {
          res.text += ` His hatch-brother calls you personally to say the family "noticed the discount."`;
          res.fx!.push({ playerId: p.id, mood: -8 });
        }
        return res;
      }
      // beat 'start'
      if (key === 'sure') {
        const t = tails(5, 10);
        const base: StoryResolution = {
          text: `You sign the slip without a question. ${p.name} blinks.`,
          fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave, unexplained' }],
        };
        if (t === 'up') { base.text += ' Then he hugs you. You have never seen him hug anything.'; base.fx!.push({ playerId: p.id, mood: 18 }); }
        else if (t === 'down') { base.text += ` Later you overhear him: "he didn't even ask." It didn't land the way you meant it.`; base.fx!.push({ playerId: p.id, mood: -10 }); }
        else base.fx!.push({ playerId: p.id, mood: 5 });
        return base;
      }
      // why?
      const m = headMod(p, 25, 'frc');
      const t = tails(50, m.pct);
      if (t === 'down') return { text: `${p.name}'s jaw sets. "Forget it." He leaves the slip on your desk and the door doesn't quite slam, which is worse.`, fx: [{ playerId: p.id, mood: -12 }] };
      if (t === 'up') {
        return {
          text: `He softens. It's ${pick(FESTS)} back home — every cousin, grandmother, and hatchmate. Now you're negotiating.`,
          next: { defId: 'festival', beat: 'ask', playerId: p.id, data: { fest: pick(FESTS) } },
        };
      }
      if (p.attrs.brn >= 14 && tails(25, 0) === 'up') {
        return { text: `"Family thing," he says smoothly. You sign the slip. (Weeks later you learn there was no family thing. There was a music festival. He has BRAINS. People with brains lie well.)`, fx: [{ playerId: p.id, outWeeks: 1, outReason: '"family thing"', mood: 8 }] };
      }
      return { text: `"Just... home stuff, coach." You sign the slip and don't push.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'home stuff', mood: 3 }] };
    },
  },
  {
    id: 'festival_return',
    kind: 'player',
    beat: (_b, ctx) => {
      const roll = Math.random() * 100;
      const p = pname(ctx);
      let text: string;
      let fx: Fx[];
      if (roll < 15) { text = `${p} is back from the festival — on crutches. Traditional cliff-diving, third cousin's dare. Two more weeks.`; fx = [{ outWeeks: 2, outKind: 'injury', outReason: 'festival cliff-diving', energyP: -20 }]; }
      else if (roll < 30) { text = `${p} is back from the festival... married. There are also, somehow, triplets. He keeps drifting off mid-drill to look at holos of them.`; fx = [{ mood: -6, attr: { brn: 1 } }]; }
      else if (roll < 65) { text = `${p} is back from the festival glowing. Grandma's cooking, twelve naps, zero basketball. He looks five years younger.`; fx = [{ mood: 22, energyP: 20 }]; }
      else if (roll < 85) { text = `${p} is back from the festival with six new abs. The ceremonial gravity-crunches are not ceremonial.`; fx = [{ attr: { ath: 2 }, mood: 8 }]; }
      else if (roll < 98) { text = `${p} is back and something's off — time dilation on the pilgrimage route. He's been shooting on his uncle's hoop for three subjective years. His release is silk.`; fx = [{ xp: 30, mood: 5 }]; }
      else { text = `${p} is back from the festival TRANSFORMED. The elders saw something in him and told him what it was. 1 in 50, and you WON it.`; fx = [{ anyPot: 8, mood: 15 }]; }
      ctx.data.text = text;
      ctx.data.fx = fx;
      return { tag: 'THE RETURN', text };
    },
    resolve: (_key, ctx) => ({ text: '', fx: (ctx.data.fx as Fx[] | undefined)?.map((f) => ({ ...f, playerId: ctx.player?.id })) ?? [] }),
  },
  {
    id: 'diet',
    kind: 'player',
    weight: 3,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} has discovered the all-mineral diet of the Petran monks and wants to try it for a week. His plate at the training table is, at this moment, gravel.`,
      choices: [
        C('allow', 'LET HIM CRUNCH', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'INJURY' }, want: 'love' }),
        C('confiscate', 'CONFISCATE THE GRAVEL', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' }, want: 'hate' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'confiscate') {
        const t = tails(2, 10);
        if (t === 'down') return { text: `${p.name} sulks through practice. The monks send you a strongly-worded stone tablet.`, fx: [{ playerId: p.id, mood: -8 }] };
        if (t === 'up') return { text: `${p.name} accepts defeat and eats a normal dinner with visible relief. He just wanted someone to stop him.`, fx: [{ playerId: p.id, mood: 5 }] };
        return { text: 'The gravel goes in a drawer. The drawer now rattles when the team bus passes.', fx: [{ playerId: p.id, mood: -4 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: `The monk diet WORKED?? ${p.name} is denser somehow. The training staff refuses to explain the scale readout. The monks, impressed, send a care package.`, fx: [{ playerId: p.id, attr: { ath: 2 }, weightKg: 6, mood: 5 }, { giveItem: 'protein' }] };
      if (t === 'down') return { text: `${p.name} spent three days of mineral week in the medical bay. He is not, it turns out, a Petran monk.`, fx: [{ playerId: p.id, energyP: -30, mood: -6, outWeeks: 1, outKind: 'injury', outReason: 'gravel recovery' }] };
      return { text: `${p.name} quit the mineral diet on day two and ate an entire celebration cake about it. He regrets nothing.`, fx: [{ playerId: p.id, mood: 10, weightKg: 3 }] };
    },
  },
  {
    id: 'cheating',
    kind: 'player',
    weight: 3,
    context: 'academic',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} got caught cheating on his Intro to Asteroid Ethics midterm. The professor is furious. The athletic department is asking what you want done.`,
      choices: [
        C('suspend', 'SUSPEND HIM 2 WEEKS, RETAKE IT HONESTLY', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' }, want: 'hate' }),
        C('lean', 'LEAN ON THE PROFESSOR. HE PLAYS.', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' }, want: 'love' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'suspend') {
        const t = tails(10, 2);
        const base: Fx[] = [{ playerId: p.id, outWeeks: 2, outReason: 'academic suspension', mood: -5 }, { heatS: -8 }];
        if (t === 'up') return { text: `${p.name} sits two weeks, retakes it honestly, and passes with a C-. He is weirdly proud of the C-. The whole team studies harder for a month.`, fx: [...base, { teamMood: 5 }] };
        if (t === 'down') return { text: `${p.name} sits his two weeks and blames you for every minute of them.`, fx: [...base, { playerId: p.id, mood: -6 }] };
        return { text: `${p.name} sits two weeks and retakes the exam honestly. The professor nods at you in the corridor. The school notices.`, fx: base };
      }
      const t = tails(5, 25);
      if (t === 'down') {
        return {
          text: 'The grade quietly becomes a B. Two weeks later, the professor loudly becomes a whistleblower.',
          fx: [{ heatS: 10 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'The Asteroid Ethics grade-change has reached the league office, professor\'s testimony attached.' } },
        };
      }
      if (t === 'up') return { text: 'The grade quietly becomes a B. The professor gets a parking spot. Everyone is bought and nobody is happy, but he PLAYS.', fx: [{ heatS: 8 }] };
      return { text: 'The grade quietly becomes a B. The professor now leaves the arena early whenever your team is winning.', fx: [{ heatS: 8 }] };
    },
  },
  {
    id: 'cheerleader',
    kind: 'player',
    weight: 3,
    context: 'mood',
    beat: (_b, ctx) => {
      const femme = ctx.player?.form === 'femme';
      return {
        tag: 'CAMPUS STORY',
        text: femme
          ? `${pname(ctx)} comes to your office, pale. She's pregnant — the father is a cheerleader from Zeta Squadron — and the season has never looked longer. For some reason she thinks you'll know what to do.`
          : `${pname(ctx)} comes to your office, pale. A cheerleader from Zeta Squadron is pregnant, and he's the father. He has no idea what to do and, for some reason, thinks you will.`,
        choices: [
          C('leave', femme ? 'A WEEK OFF. FIGURE IT OUT TOGETHER.' : 'A WEEK OFF. HANDLE IT LIKE AN ADULT.', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' }, want: 'love' }),
          C('season', '"SEASON FIRST. OFFSEASON PROBLEM."', { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 50, cls: 'DRAMA' }, want: 'hate' }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const p = ctx.player!;
      const femme = p.form === 'femme';
      // the long arc: whatever you decide tonight, the baby arrives anyway
      const arc = [{ weeks: 6 + rand(4), beat: 'start', defId: 'newborn', playerId: p.id }];
      let res: StoryResolution;
      if (key === 'leave') {
        const t = tails(25, 2);
        if (femme) {
          if (t === 'up') res = { text: `${p.name} takes the week, makes her plan with her people, and walks back into the gym with a calendar and a to-do list that would frighten a fleet admiral. The team noticed. The team talks about it quietly and well.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 10, attr: { brn: 2 } }, { teamMood: 5 }, { heatS: -4 }] };
          else if (t === 'down') res = { text: `${p.name} takes the week — and comes back with MORE questions. You are apparently the godparent now? There was no form for this.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 3 }] };
          else res = { text: `${p.name} takes the week and handles her business. She comes back steadier.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 8, attr: { brn: 1 } }] };
        } else if (t === 'up') res = { text: `${p.name} misses a game, attends every appointment, and comes back more grown-up than he left. The team noticed. The team talks about it quietly and well.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 10, attr: { brn: 2 } }, { teamMood: 5 }, { heatS: -4 }] };
        else if (t === 'down') res = { text: `${p.name} takes the week — and comes back with MORE questions. You are apparently the godfather now? There was no form for this.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 3 }] };
        else res = { text: `${p.name} takes the week and handles his business. He comes back steadier.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 8, attr: { brn: 1 } }] };
      } else {
        const t = tails(2, 50);
        if (femme) {
          if (t === 'down') res = { text: `${p.name} stays in the lineup with the whole galaxy on her shoulders. She's stopped sleeping. Zeta Squadron now boos your bench, specifically, and the medical staff files a note with your name underlined.`, fx: [{ playerId: p.id, mood: -18, energyP: -15, tense: true }, { heatS: 8 }] };
          else if (t === 'up') res = { text: `${p.name} somehow compartmentalizes. You have created a professional. You are not sure you're proud.`, fx: [{ playerId: p.id, mood: -5, attr: { brn: 1 }, tense: true }] };
          else res = { text: `${p.name} plays on, jaw set. The scoreboard doesn't know. Everyone else does.`, fx: [{ playerId: p.id, mood: -12, tense: true }] };
        } else if (t === 'down') res = { text: `${p.name} stays in the lineup with his head somewhere else entirely. He's stopped eating properly. Zeta Squadron now boos your bench, specifically.`, fx: [{ playerId: p.id, mood: -18, weightKg: -4, tense: true }, { heatS: 5 }] };
        else if (t === 'up') res = { text: `${p.name} somehow compartmentalizes. You have created a professional. You are not sure you're proud.`, fx: [{ playerId: p.id, mood: -5, attr: { brn: 1 }, tense: true }] };
        else res = { text: `${p.name} plays on, hollow-eyed. The scoreboard doesn't know. Everyone else does.`, fx: [{ playerId: p.id, mood: -12, tense: true }] };
      }
      res.follow = arc;
      return res;
    },
  },
  // ---- THE NEWBORN (the pregnancy long-arc pays off) --------------------------
  {
    id: 'newborn',
    kind: 'player',
    beat: (_b, ctx) => {
      const femme = ctx.player?.form === 'femme';
      return {
        tag: 'THE NEWBORN',
        text: femme
          ? `${pname(ctx)} calls from the medbay at 4am. The baby is HERE — loud, healthy, already palming a plush basketball. The whole squad is in the hallway in pajamas.`
          : `${pname(ctx)} bursts into practice holding a holo: the baby is HERE — loud, healthy, already palming a plush basketball. The whole squad crowds the projection.`,
      };
    },
    resolve: (_k, ctx) => {
      const p = ctx.player!;
      const femme = p.form === 'femme';
      return {
        text: `A jersey the size of a sock appears in ${femme ? 'her' : 'his'} locker, squad-stitched, number and all. Some seasons hand you a banner. This one handed you this.`,
        fx: [femme ? { playerId: p.id, outWeeks: 1, outReason: 'the newborn', mood: 15 } : { playerId: p.id, mood: 15 }, { teamMood: 6 }],
      };
    },
  },
  {
    id: 'rampage',
    kind: 'player',
    weight: 2,
    context: 'discipline',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} lost his temper in a study group and put all five of his lab partners in the hospital. No fatalities — this is college, not the frontier — but the Dean wants blood. Metaphorically.`,
      choices: [
        C('pods', 'TWO WEEKS OUT, ANGER-MANAGEMENT PODS', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' }, want: 'hate' }),
        C('plays', '"HIS SPECIES IS JUST LIKE THAT." HE PLAYS.', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' }, want: 'love' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'pods') {
        const t = tails(10, 2);
        const base: Fx[] = [{ playerId: p.id, outWeeks: 2, outReason: 'anger-management pods', attr: { brn: 2 } }, { heatS: -8 }];
        if (t === 'up') return { text: `${p.name} completes the pod program and hand-writes five apology letters. One lab partner frames theirs. He comes back with a stillness that frightens opponents more than the temper did.`, fx: [...base, { playerId: p.id, mood: 8 }] };
        return { text: `${p.name} does his pod time and writes his letters. The Dean's office stands down.`, fx: base };
      }
      const t = tails(5, 25);
      if (t === 'down') {
        return {
          text: `The Dean's office issues a statement calling your program "a disgrace with an excellent record." The league would like to discuss the second half of that sentence.`,
          fx: [{ heatS: 15 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'Five hospitalized lab partners and a coach who shrugged. The folder is thick.' } },
        };
      }
      if (t === 'up') return { text: 'He plays. He plays FURIOUS. The boosters send you a fruit basket shaped like a fist, with protein bars under the fruit.', fx: [{ heatS: 8, heatB: -8 }, { playerId: p.id, mood: 5 }, { giveItem: 'protein' }] };
      return { text: `He plays. The Dean starts attending your games just to glare.`, fx: [{ heatS: 10 }] };
    },
  },
  {
    id: 'exchange',
    kind: 'player',
    weight: 2,
    beat: (b, ctx) => b === 'return'
      ? { tag: 'THE RETURN', text: `The shuttle from Alexandria-One lands and ${pname(ctx)} steps off with a bag full of books and a look you can't read yet…` }
      : ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} has been selected for a prestigious 3-week academic exchange on the Scholar-Ring of Alexandria-One. Huge for his future. Also huge for your rotation, in the bad way.`,
      choices: [
        C('go', "LET HIM GO. IT'S COLLEGE.", { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'DRAMA' }, want: 'love' }),
        C('deny', "DENY IT. HE'S HERE TO PLAY.", { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 25, cls: 'DRAMA' }, want: 'hate' }),
      ],
    }),
    resolve: (key, ctx, ev) => {
      const p = ctx.player!;
      if (ev.beat === 'return') {
        const t = tails(25, 2);
        if (t === 'up') return { text: `Measurably smarter and insufferable about it. The Scholar-Ring rewired how ${p.name} sees the floor — and he brought you something from their observatory.`, fx: [{ playerId: p.id, attr: { brn: 2 }, potAttr: { brn: 1 }, mood: 6 }, { giveItem: 'telescope' }] };
        if (t === 'down') return { text: `${p.name} loved it there SO much. The first thing he says is the word "options". You sleep worse.`, fx: [{ playerId: p.id, attr: { brn: 1 }, mood: -4 }] };
        return { text: `${p.name} is back, a little smarter, wearing a Scholar-Ring hoodie he will never take off.`, fx: [{ playerId: p.id, attr: { brn: 1 }, mood: 4 }] };
      }
      if (key === 'go') {
        // the result waits for the bus home: three weeks of not knowing
        return {
          text: `${p.name} waves at you, sadly, as the shuttle to Alexandria-One lifts off. Three weeks. The rotation feels the hole by Tuesday.`,
          fx: [{ playerId: p.id, outWeeks: 3, outReason: 'academic exchange', mood: 10, tense: true }, { heatS: -6 }],
          follow: [{ weeks: 3, beat: 'return' }],
        };
      }
      const t = tails(2, 25);
      if (t === 'down') return { text: `He says he understands. He does not understand. His advisor files a complaint with the school.`, fx: [{ playerId: p.id, mood: -12 }, { heatS: 8 }] };
      if (t === 'up') return { text: `He shrugs it off faster than you feared. "Next cycle," he says, and buries himself in film.`, fx: [{ playerId: p.id, mood: -3, xp: 8 }] };
      return { text: `He nods, once. The word "no" sits between you for the rest of the season.`, fx: [{ playerId: p.id, mood: -8 }] };
    },
  },
  {
    id: 'streamer',
    kind: 'player',
    weight: 2,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} went viral on the galactic streams last night — 40 million views of him dunking over a parked shuttle. He now has a manager, a ring light, and opinions about "his brand".`,
      choices: [
        C('lean', 'LEAN INTO IT. FREE PUBLICITY.', { up: { pct: 10, cls: 'WINDFALL' }, down: { pct: 25, cls: 'DRAMA' }, want: 'love' }),
        C('lockers', 'PHONES STAY IN LOCKERS. FOREVER.', { up: { pct: 10, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'DRAMA' }, want: 'hate' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'lean') {
        const t = tails(10, 25);
        if (t === 'up') return { text: `${p.name}'s follower count triples and so does the season-ticket line. The boosters are DELIGHTED — a sponsor crate arrives for THE BAG.`, fx: [{ playerId: p.id, mood: 12 }, { heatB: -10 }, { giveItem: 'mixtape' }] };
        if (t === 'down') return { text: `${p.name} now signs autographs with a stage name and reviews his own highlights during film study. The locker room has opinions about "his brand" too.`, fx: [{ playerId: p.id, mood: 8, attr: { brn: -1 } }, { teamMood: -6 }] };
        return { text: `${p.name} rides the wave. Practice attendance: perfect. Practice focus: negotiable.`, fx: [{ playerId: p.id, mood: 10 }] };
      }
      const t = tails(10, 10);
      if (t === 'down') return { text: `${p.name} posts one final holo — his locker, captioned "the grind" — and sulks for a week. His manager quits via skywriting.`, fx: [{ playerId: p.id, mood: -10 }] };
      if (t === 'up') return { text: `${p.name} hands the phone over and, freed from the algorithm, has the best practice week of his life.`, fx: [{ playerId: p.id, mood: -3, xp: 12 }] };
      return { text: `Phones go in lockers. The ring light goes on a shelf, pointed at nothing, like a lighthouse for a sea that left.`, fx: [{ playerId: p.id, mood: -5, xp: 5 }] };
    },
  },
  {
    id: 'voidpup',
    kind: 'player',
    weight: 2,
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} found a void-pup abandoned behind the arena and smuggled it into the dorms. It has too many teeth and it loves him unconditionally. Pets are, strictly speaking, forbidden.`,
      choices: [
        C('mascot', 'THE TEAM HAS A MASCOT NOW', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 10, cls: 'SCANDAL' }, want: 'love' }),
        C('shelter', 'TAKE IT TO THE SHELTER', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' }, want: 'hate' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'mascot') {
        const t = tails(25, 10);
        if (t === 'up') return { text: 'The void-pup attends every practice from a courtside crate and learns to fetch rebounds. Morale is illegal levels of high. It has eaten two whistles — and dug up something shiny for THE BAG.', fx: [{ teamMood: 12 }, { teamEnergyP: 5 }, { giveItem: 'poster' }] };
        if (t === 'down') return { text: `The void-pup phased through a wall into the Dean's office and unmade her desk. ${p.name} took the blame. There is paperwork.`, fx: [{ teamMood: 5 }, { heatS: 10 }] };
        return { text: 'The void-pup becomes furniture with teeth. The team is 30% happier and 100% more bitten.', fx: [{ teamMood: 10 }] };
      }
      const t = tails(5, 10);
      if (t === 'down') return { text: `${p.name} visits the shelter every day after practice. Every. Single. Day. He is not over it.`, fx: [{ playerId: p.id, mood: -8 }] };
      if (t === 'up') return { text: `The shelter names the void-pup after your program. Season-ticket holders adopt it within a week. Everyone wins, even the whistles.`, fx: [{ playerId: p.id, mood: 2 }, { heatS: -3 }] };
      return { text: `The shelter takes it in. ${p.name} keeps a photo in his locker. The photo blinks.`, fx: [{ playerId: p.id, mood: -5 }] };
    },
  },
  {
    id: 'booster_pod',
    kind: 'player',
    weight: 2,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `A booster in a chrome suit "happens to run into" ${pname(ctx)} and offers him a personal off-books training pod — the kind pros use. Strictly against amateurism rules, obviously.`,
      choices: [
        C('report', 'REPORT THE BOOSTER TO THE LEAGUE', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' }, want: 'hate' }),
        C('blind', 'LOOK THE OTHER WAY', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SCANDAL' }, want: 'love' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'report') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'The league sends a commendation hologram. The boosters send a season of very cold silence. Their patience with you drops audibly.', fx: [{ heatS: -8, heatB: 12 }] };
        if (t === 'up') return { text: 'The league sends a commendation hologram AND fines the booster into another tax bracket. The school frames the hologram.', fx: [{ heatS: -12 }] };
        return { text: 'The league opens a file. The booster sends you a very cold holiday card.', fx: [{ heatS: -8, heatB: 6 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: `${p.name} comes back from "visiting his aunt" noticeably sharper — and carrying a gift bag "from the aunt". You ask no questions, which is itself an answer.`, fx: [{ playerId: p.id, xp: 15 }, { heatB: -5 }, { giveItem: 'nappod' }] };
      if (t === 'down') {
        return {
          text: `${p.name} gets photographed entering the pod facility by a fan account with 4 followers and terrifying reach.`,
          fx: [{ playerId: p.id, xp: 10 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'The off-books training pod is on the front page of every stream in the league.' } },
        };
      }
      return { text: `${p.name} trains in the pod at 5am, twice. Nothing happens. Probably nothing happened.`, fx: [{ playerId: p.id, xp: 8 }] };
    },
  },

  // ---- THE REGULARS: the dean & the booster drop by even when nothing burns ----
  // (they used to appear only past the heat thresholds — a clean program never
  // met them; now they have a weekly-pool presence, illustrations acting)
  {
    id: 'dean_visit',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: "THE DEAN DROPS BY",
      text: 'The Dean appears in your doorway holding two cups of faculty coffee, one of which is for herself. The Provost, she mentions, "would love" the arena Thursday evening. For low-gravity tai chi. Faculty only.',
      choices: [
        C('lend', 'LEND THE ARENA. SIP THE COFFEE.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAIN' } }),
        C('refuse', '"THURSDAY IS SHOOTAROUND, DEAN."', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'lend') {
        const t = tails(10, 5);
        if (t === 'up') return { text: 'The tai chi is a hit. The Provost, mid-pose, approves your equipment requisition from THIS YEAR instead of next. Something useful falls off the truck.', fx: [{ heatS: -8, giveItem: 'poster' }] };
        if (t === 'down') return { text: 'The faculty leaves the arena smelling of incense and entitlement. The squad shoots around in the parking lot, muttering.', fx: [{ heatS: -6, teamEnergyP: -4 }] };
        return { text: 'Forty professors do slow-motion kicks under your championship banner. The Dean beams at you the whole time. It costs you nothing but the image.', fx: [{ heatS: -6 }] };
      }
      const t = tails(5, 10);
      if (t === 'up') return { text: 'The Dean nods slowly. "A program with priorities." She respects it, visibly, against her will.', fx: [{ heatS: 2, teamMood: 3 }] };
      if (t === 'down') return { text: 'The Dean leaves without finishing her coffee. The requisition forms develop "processing delays".', fx: [{ heatS: 8 }] };
      return { text: 'The Dean shrugs and books the aquatics dome instead. Somewhere, swimmers suffer.', fx: [{ heatS: 4 }] };
    },
  },
  {
    id: 'booster_gift',
    kind: 'coach',
    figure: 'booster',
    beat: () => ({
      tag: 'A CHROME SUIT CALLS',
      text: 'A booster leans on your doorframe like he financed it, which he might have. There\'s a crate in the hallway "that fell off a freighter". He wants nothing in return. He says "nothing" twice.',
      choices: [
        C('accept', 'TAKE THE CRATE', { up: { pct: 10, cls: 'LOOT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('decline', 'DOORS CLOSE. CRATE STAYS OUTSIDE.', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'accept') {
        const commons = ITEMS.filter((i) => i.rarity !== 'legendary');
        const item = pick(commons);
        const t = tails(10, 10);
        if (t === 'down') return { text: `The crate holds ${item.name} — and a league tracking sticker nobody noticed until now. Somewhere, a compliance officer smiles.`, fx: [{ giveItem: item.id, heatB: -6, heatS: 10 }] };
        if (t === 'up') { const extra = pick(commons); return { text: `The crate holds ${item.name} AND ${extra.name}. The booster waves from the parking lot for a full minute.`, fx: [{ giveItem: item.id }, { giveItem: extra.id }, { heatB: -8 }] }; }
        return { text: `The crate holds ${item.name}. No strings visible. Strings are rarely visible.`, fx: [{ giveItem: item.id }, { heatB: -6 }] };
      }
      const t = tails(5, 10);
      if (t === 'up') return { text: 'You decline so gracefully the booster tells the council you have "character". Coming from him, unclear.', fx: [{ heatB: 2 }] };
      if (t === 'down') return { text: 'The crate sits in the hallway for three days, ticking softly, then disappears. So does some of the boosters\' patience.', fx: [{ heatB: 8 }] };
      return { text: 'The crate leaves. The booster\'s smile doesn\'t. "Next season, coach."', fx: [{ heatB: 4 }] };
    },
  },
  // ---- more of THE REGULARS (the 30% weekly rolls pick from the pools) --------
  {
    id: 'dean_audit',
    kind: 'coach',
    figure: 'dean',
    beat: (_b, ctx) => {
      const squad = ctx.team().filter((p) => p.outWeeks === 0);
      const lowest = [...squad].sort((a, b) => a.attrs.brn - b.attrs.brn)[0];
      ctx.data.targetId = lowest?.id ?? null;
      return {
        tag: "THE DEAN'S AUDIT",
        text: `The Dean arrives with a clipboard and the academic ledger. ${lowest ? `${lowest.name}'s transcript` : 'A transcript'} is, in her words, "an away game." She wants a mandatory study-hall week. By the book.`,
        choices: [
          C('comply', 'BOOK THE LIBRARY. BY THE BOOK.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
          C('refuse', '"HE STUDIES FILM. THAT COUNTS."', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const p = ctx.team().find((x) => x.id === ctx.data.targetId) ?? null;
      if (key === 'comply') {
        const t = tails(10, 5);
        const base: Fx[] = [{ heatS: -8 }, ...(p ? [{ playerId: p.id, attr: { brn: 1 }, energyP: -6 } as Fx] : [])];
        if (t === 'up') return { text: `${p ? p.name : 'The kid'} discovers, in the library, that the playbook is just a book. Game IQ up, Dean satisfied — she stamps something approvingly.`, fx: [...base, { coachEnergy: 1 }] };
        if (t === 'down') return { text: `A week of flashcards. ${p ? p.name : 'The kid'} passes the audit and files a formal complaint about the chairs.`, fx: [...base, ...(p ? [{ playerId: p.id, mood: -5 } as Fx] : [])] };
        return { text: 'Study hall happens. The Dean initials every page of it. The program looks clean because it is, briefly.', fx: base };
      }
      const t = tails(5, 25);
      if (t === 'down') return { text: 'The Dean audits HARDER. The film-counts-as-studying theory does not survive contact with the faculty senate.', fx: [{ heatS: 12 }] };
      if (t === 'up') return { text: 'You defend film study with such conviction the Dean requests a seat at the next session. She takes notes. Good ones.', fx: [{ heatS: -2 }] };
      return { text: 'The Dean leaves unconvinced. The clipboard will return.', fx: [{ heatS: 6 }] };
    },
  },
  {
    id: 'booster_shortcut',
    kind: 'coach',
    figure: 'booster',
    beat: () => ({
      tag: 'A CHROME SUIT CALLS',
      text: 'The booster leans in, cigar first. He "knows a guy" at the league travel office — your next opponent\'s shuttle permits could develop... complications. They\'d arrive exhausted. Nobody would ever know. Probably.',
      choices: [
        C('take', 'MAKE THE CALL', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
        C('decline', 'HANG UP THE IDEA', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'take') {
        const t = tails(5, 25);
        ctx.s.pregameFlags.alarm = true; // they arrive with cardboard legs
        if (t === 'down') return { text: 'The permits "develop complications" — and so does a league paper trail with your area code on it.', fx: [{ heatB: -6, heatS: 10 }] };
        if (t === 'up') return { text: 'Their shuttle reroutes through three customs queues and a fumigation bay. They arrive gray. The booster winks across the parking lot.', fx: [{ heatB: -8 }] };
        return { text: 'Their travel day becomes a travel ordeal. You feel bad. You feel great.', fx: [{ heatB: -5, heatS: 2 }] };
      }
      const t = tails(5, 10);
      if (t === 'down') return { text: 'You decline. The booster\'s cigar dims by exactly one lumen. "Suit yourself, coach."', fx: [{ heatB: 6 }] };
      if (t === 'up') return { text: 'You decline so cleanly he respects it. "Integrity," he says, like a stock he might buy.', fx: [{ heatB: 2, teamMood: 2 }] };
      return { text: 'You hang up the idea. Somewhere, an opponent sleeps soundly, unaware.', fx: [{ heatB: 4 }] };
    },
  },
  // ---- «SCOOP» QUAZAR: the press keeps you honest -------------------------------
  {
    id: 'scoop_question',
    kind: 'coach',
    figure: 'scoop',
    beat: (_b, ctx) => {
      const opts = (ctx.data.opts as string[]) ?? [];
      const choices = opts.map((o, i) => C(String(i), o.toUpperCase()));
      // the notebook answers for you — if you noted it
      if (ctx.s.notebook.some((n) => n.key === ctx.data.noteKey)) {
        choices.push(C('notebook', '▤ THE NOTEBOOK HAS IT'));
      }
      return {
        tag: '“SCOOP” QUAZAR · ON AIR',
        text: `${ctx.data.q as string}\n\nThe recorder is running, coach.`,
        choices,
      };
    },
    resolve: (key, ctx) => {
      const answer = ctx.data.answer as number;
      const opts = (ctx.data.opts as string[]) ?? [];
      const right = opts[answer] ?? '';
      const correct = key === 'notebook' || Number(key) === answer;
      if (correct) {
        const two = tails(25, 0) === 'up';
        return {
          text: key === 'notebook'
            ? `You read it straight off the page: "${right}." Scoop taps his fedora. "A coach who keeps notes. The Gazette respects that." The piece runs friendly — with a stipend.`
            : `"${right}," you say, no hesitation. Scoop's antennae perk. "A coach who WATCHES. Refreshing." The piece runs friendly — with a stipend.`,
          fx: [{ coachEnergy: two ? 2 : 1 }, { opP: 3 }],
        };
      }
      return {
        text: `Scoop lets the silence run exactly one column-inch too long. "It was ${right}, coach." The piece prints your answer next to the correct one, in a larger font.`,
        fx: [{ opP: -4 }],
      };
    },
  },
  // ---- THE SUPPLY CLOSET + the broke-week bailout --------------------------------
  // every offered item is TAKE IT or LEAVE IT — the bag is small and patches
  // pile up fast when nobody's hurt
  {
    id: 'supply',
    kind: 'coach',
    figure: 'janitor',
    beat: (_b, ctx) => {
      const item = itemById((ctx.data.itemId as string) ?? 'protein');
      return {
        tag: 'THE SUPPLY CLOSET',
        text: `The janitor wheels his cart past your door, stops, and sets ${item.name} on your desk without a word. The mop keeps dripping. He waits.`,
        choices: [
          C('take', `TAKE IT — ${item.effectText.toUpperCase()}`),
          C('leave', 'LEAVE IT ON THE DESK'),
        ],
      };
    },
    resolve: (key, ctx) => {
      const itemId = (ctx.data.itemId as string) ?? 'protein';
      const item = itemById(itemId);
      if (key === 'leave') {
        return { text: `You slide ${item.name} back across the desk. The janitor shrugs, pockets it, and re-donates it to the mystery it came from.` };
      }
      if (ctx.s.bag.length >= 8) {
        return { text: `You reach for ${item.name} — and THE BAG has no room. A kid outside the arena walks off with it, delighted.` };
      }
      ctx.s.bag.push(itemId);
      return { text: `${item.name} goes into THE BAG.` };
    },
  },
  // ---- the take-or-leave offer: every found/gifted item passes through here ----
  {
    id: 'item_offer',
    kind: 'coach',
    beat: (_b, ctx) => {
      const item = itemById((ctx.data.itemId as string) ?? 'protein');
      // SEASON ZERO hands you exactly what the script needs — no leaving it
      const choices = ctx.s.tutorial !== undefined
        ? [C('take', 'INTO THE BAG')]
        : [
            C('take', 'INTO THE BAG'),
            C('leave', 'LEAVE IT — THE BAG IS FOR BETTER THINGS'),
          ];
      return {
        tag: '◆ AN ITEM FINDS YOU',
        text: `${item.name}. ${item.flavor}`,
        choices,
      };
    },
    resolve: (key, ctx) => {
      const itemId = (ctx.data.itemId as string) ?? 'protein';
      const item = itemById(itemId);
      if (key === 'leave') {
        return { text: `You leave ${item.name} where the galaxy dropped it. Somebody else's bargain now.` };
      }
      if (ctx.s.bag.length >= 8) {
        return { text: `You reach for ${item.name} — and THE BAG has no room. A kid outside the arena walks off with it, delighted.` };
      }
      ctx.s.bag.push(itemId);
      return { text: `${item.name} goes into THE BAG.` };
    },
  },
  {
    id: 'bailout',
    kind: 'coach',
    figure: 'side',
    beat: (_b, ctx) => {
      const who = (ctx.data.who as string) ?? 'dean';
      ctx.data.side = who;
      if (who === 'dean') {
        return {
          tag: 'EMPTY POCKETS',
          text: 'The credit ledger reads zero and the Dean, somehow, already knows. She appears with the emergency faculty fund envelope and a look that files itself under "lecture pending".',
          choices: [
            C('take', 'TAKE THE ENVELOPE (AND THE LECTURE)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
            C('pride', 'A PROGRAM PAYS ITS OWN WAY', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
          ],
        };
      }
      if (who === 'booster') {
        return {
          tag: 'EMPTY POCKETS',
          text: 'The credit ledger reads zero. A chrome suit materializes beside your desk, already peeling bills off a roll that could stop a meteor. "Rough month, coach?"',
          choices: [
            C('take', 'TAKE THE ROLL', { up: { pct: 10, cls: 'WINDFALL' }, down: { pct: 10, cls: 'SCANDAL' } }),
            C('pride', 'A PROGRAM PAYS ITS OWN WAY', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
          ],
        };
      }
      return {
        tag: 'EMPTY POCKETS',
        text: 'The credit ledger reads zero. Scoop Quazar offers a paid exclusive: "SIX LEGS IN THE DOOR: A WEEK INSIDE A BROKE PROGRAM." He promises to be fair. He promises nothing else.',
        choices: [
          C('take', 'GIVE THE EXCLUSIVE', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'DRAMA' } }),
          C('pride', 'A PROGRAM PAYS ITS OWN WAY', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const who = (ctx.data.who as string) ?? 'dean';
      if (key === 'pride') {
        const t = tails(5, 5);
        if (t === 'up') return { text: 'You decline with a straight back. The squad notices. Broke, but nobody\'s creature.', fx: [{ teamMood: 4 }] };
        if (t === 'down') return { text: 'You decline. The week proceeds to be exactly as broke as advertised.', fx: [] };
        return { text: 'You decline politely. Pride is free. Everything else, notably, is not.', fx: [] };
      }
      if (who === 'dean') {
        return { text: 'The envelope holds two credits and a bookmark that says INTEGRITY. The lecture runs eleven minutes. Worth it.', fx: [{ coachEnergy: 2, heatS: -2 }] };
      }
      if (who === 'booster') {
        const t = tails(10, 10);
        if (t === 'down') return { text: 'Three credits, peeled off in front of a window. A window with a photographer behind it.', fx: [{ coachEnergy: 3, heatB: -4, heatS: 8 }] };
        if (t === 'up') return { text: 'Three credits and a wink. "We take care of our own." You are, apparently, his own now.', fx: [{ coachEnergy: 3, heatB: -6 }] };
        return { text: 'Three credits change hands. The ledger he doesn\'t show you gains a line.', fx: [{ coachEnergy: 3, heatB: -3, heatS: 3 }] };
      }
      const t = tails(5, 25);
      if (t === 'down') return { text: 'The exclusive runs. It is fair. It is also titled "THE COACH WHO COUNTS COUCH CUSHIONS." Two credits, some dignity.', fx: [{ coachEnergy: 2, heatS: 5 }] };
      if (t === 'up') return { text: 'The exclusive runs warm — the broke-program-with-heart angle. Donations trickle. Scoop tips his fedora.', fx: [{ coachEnergy: 3, heatS: -3 }] };
      return { text: 'The exclusive runs. Two credits, one flattering photo, one unflattering quote. Even.', fx: [{ coachEnergy: 2 }] };
    },
  },

  // ---- a femme arc: the kid in the stands -------------------------------------
  {
    id: 'runaway_sister',
    kind: 'player',
    weight: 2,
    forms: ['femme'],
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)}'s little sister is discovered sleeping in the equipment room, having stowed away on three freighters to watch her big sister play. The family is calling. The kid refuses to leave before game night.`,
      choices: [
        C('bench', 'A SEAT ON THE BENCH, THEN HOME', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' }, want: 'love' }),
        C('sendback', 'FIRST SHUTTLE HOME. RULES ARE RULES.', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' }, want: 'hate' }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'bench') {
        const t = tails(25, 5);
        if (t === 'up') return { text: `The kid sits at the end of the bench in an oversized team jacket and calls every play before it happens. ${p.name} plays the game of her life with someone to play it for.`, fx: [{ playerId: p.id, mood: 18, xp: 10 }, { teamMood: 5 }] };
        if (t === 'down') return { text: `The kid is a delight until she livestreams the entire locker room speech. The league has opinions about broadcast rights.`, fx: [{ playerId: p.id, mood: 10 }, { heatS: 6 }] };
        return { text: `One game, one bench seat, one kid asleep on ${p.name}'s shoulder bag by the fourth quarter. The shuttle home leaves Monday, full of stories.`, fx: [{ playerId: p.id, mood: 12 }] };
      }
      const t = tails(2, 25);
      if (t === 'down') return { text: `${p.name} says nothing at practice. Her warm-ups get very precise. The kid's empty seat stays empty all season in her head.`, fx: [{ playerId: p.id, mood: -14 }] };
      if (t === 'up') return { text: `The kid negotiates a compromise from the shuttle gate: a signed ball, a video call courtside, and a promise in writing. Future agent. ${p.name} half-smiles.`, fx: [{ playerId: p.id, mood: -3 }] };
      return { text: `The shuttle leaves. ${p.name} waves until it's a dot. She plays the week on autopilot.`, fx: [{ playerId: p.id, mood: -8 }] };
    },
  },

  // ---- KNOWLEDGE storylines ---------------------------------------------------
  // The knowledge pool: undiscovered drills AND unlearned tactics.
  {
    id: 'seminar',
    kind: 'coach',
    weight: 2,
    when: (s) => s.unlockedDrills.length < DRILLS.length || s.knownPlans.length < PLANS.length,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'An embossed holo-invitation: the Galactic Coaching Seminar on Blorgon 6, this week. Two days of drills, film, and lukewarm banquet food with the best minds in the game.',
      choices: [
        C('attend', 'ATTEND (2¢)', { cost: 2, up: { pct: 50, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('toss', 'TOSS THE INVITATION', { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'toss') {
        return { text: 'You have games to win. The invitation folds itself into a paper shuttle and flies off, offended.', fx: [] };
      }
      const t = tails(50, 10);
      const k = pickKnowledge(ctx.s);
      if (t === 'up' && k) {
        if (k.kind === 'drill') return { text: `Blorgon 6 pays off — a legendary assistant walks you through ${k.name}, step by step. It's yours now, forever.`, fx: [{ unlockDrill: k.id }] };
        if (k.kind === 'instr') return { text: `Blorgon 6 pays off — in the hotel bar, a stranger teaches you ${k.name}. You check the lobby twice on the way out.`, fx: [{ unlockInstr: k.id }] };
        return { text: `Blorgon 6 pays off — a retired champion coach diagrams ${k.name} on a napkin until it clicks. A whole new way to play, yours forever.`, fx: [{ unlockPlan: k.id as PlanId }] };
      }
      if (t === 'down') return { text: 'You catch Blorgon flu at the seminar buffet and sneeze through every session. The team spends the week worried about you.', fx: [{ teamMood: -5 }] };
      return { text: 'Six hours of trust falls and a pyramid scheme about "vertical culture". You learned nothing, and it cost you the trip.' };
    },
  },
  {
    id: 'oracle',
    kind: 'coach',
    weight: 2,
    figure: 'oracle',
    // a story that opens mid-flight can only fire when the ship actually flies
    when: (s) => (s.unlockedDrills.length < DRILLS.length || s.knownPlans.length < PLANS.length) && s.week > 2 && s.groundedWeeks === 0,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'On the way back from a scouting run, your ship drops out of warp above an uncharted moon. On its surface: a single hut, a single light, and — your instruments insist — a single very old basketball hoop.',
      choices: [
        C('land', 'LAND AND KNOCK', { up: { pct: 50, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SHIP' } }),
        C('leave', 'STAY IN ORBIT. WARP HOME.', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'leave') return { text: 'Some doors are better left unknocked. The hoop watches you leave.', fx: [] };
      const t = tails(50, 25);
      const k = pickKnowledge(ctx.s);
      if (t === 'up' && k) {
        if (k.kind === 'drill') return { text: `The door opens before you knock. "You are late," says the oracle, who has never met you. An hour later you know ${k.name} — a method your species has not invented yet.`, fx: [{ unlockDrill: k.id }] };
        if (k.kind === 'instr') return { text: `The door opens before you knock. The oracle whispers ${k.name} into your ear and closes the door. You will use this. You already know you will.`, fx: [{ unlockInstr: k.id }] };
        return { text: `The door opens before you knock. The oracle draws ${k.name} in the dust with one long finger, and suddenly it's obvious. It was always obvious. You just couldn't see it.`, fx: [{ unlockPlan: k.id as PlanId }] };
      }
      if (t === 'down') {
        return {
          text: "The oracle's moon has opinions about your landing gear.",
          next: { defId: 'grounded', beat: 'start', playerId: null, data: { cause: 'Your landing struts are lunar debris now.' } },
        };
      }
      return { text: 'The oracle speaks only in riddles about "the pick and the roll within". You leave with incense in your clothes and nothing else.', fx: [] };
    },
  },
  {
    id: 'starcharts',
    kind: 'coach',
    weight: 2,
    when: (s) => !s.unlockedRegions.includes('deepcore') && s.week > 3,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'A retired scout sells memorabilia outside the arena. Between the pennants: a cracked datapad labeled "CORE ROUTES — DO NOT FLY". She wants an endorsement of her dubious autobiography, not money.',
      choices: [
        C('endorse', 'ENDORSE THE BOOK, TAKE THE CHARTS', { up: { pct: 50, cls: 'INTEL' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('decline', 'DECLINE POLITELY', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'decline') return { text: "She shrugs and sells the datapad to the Voidfiends' coach instead. You will think about this forever.", fx: [] };
      const t = tails(50, 10);
      if (t === 'up') return { text: 'Your name now graces the back cover of "I Scouted The Void (And The Void Scouted Back)". The datapad hums to life: REAL Deep Core routes, annotated in three languages.', fx: [{ unlockRegion: 'deepcore' }] };
      if (t === 'down') return { text: 'The charts are real — and so is chapter 7, in which she describes your recruiting methods in avoidable detail. The school reads books, it turns out.', fx: [{ unlockRegion: 'deepcore' }, { heatS: 10 }] };
      return { text: 'The charts are a menu from a noodle bar on Kanzar. A very good noodle bar, to be fair.', fx: [{ teamMood: 3 }] };
    },
  },

  // ---- ship setbacks are DOORS (law 4) ------------------------------------------
  {
    id: 'grounded',
    kind: 'coach',
    art: 'saucer',
    artEvent: 'stranded',
    beat: (b, ctx) => {
      if (b === 'goblin_hold') {
        return { tag: 'THE SHIP', text: 'Weekly transmission from the mech-goblin starbase: your ship is "almost done". There is laughing in the background of the recording.' };
      }
      return {
        tag: 'THE SHIP',
        text: `${pick(RIDE_ANTIC)}\n\n${ctx.data.cause ?? 'Turbulence cracks the hull on the way home.'} As you limp back sub-warp, a starbase of mech-goblins radios in: they can fix it, cheap, "mostly honest".`,
        choices: [
          C('goblins', 'LET THE GOBLINS FIX IT', { up: { pct: 50, cls: 'WINDFALL' }, down: { pct: 50, cls: 'SHIP' } }),
          C('limp', 'LIMP HOME. 3 WEEKS GROUNDED.', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      if (ctx.data.hold) {
        if (Math.random() < 0.25) {
          ctx.s.groundedWeeks = 0;
          return { text: 'The goblins deliver. The ship gleams. Several parts are new, several are "new". You fly.' };
        }
        return { text: 'Not this week. The goblins have installed a hot tub you did not order and cannot afford.', follow: [{ weeks: 1, beat: 'goblin_hold', defId: 'grounded', playerId: null, data: { hold: true, figure: 'goblin' } }] };
      }
      if (key === 'limp') {
        ctx.s.groundedWeeks = 3;
        return { text: 'You limp home on maneuvering thrusters. The ship is grounded 3 weeks. Home-planet scouting only.', fx: [] };
      }
      if (tails(50, 50) === 'up') {
        return { text: 'The goblins swarm the hull, argue in sparks, and hand it back BETTER. The bill: 3 credits off next week\'s stipend. Fair, honestly.', follow: [{ weeks: 1, beat: 'start', defId: 'goblin_bill', playerId: null }] };
      }
      ctx.s.groundedWeeks = 12;
      return {
        text: 'The goblins fail spectacularly. Your ship is now grounded at THEIR base, wearing half its engine. You take a space-bus home. Every week, a chance they finish.',
        follow: [{ weeks: 1, beat: 'goblin_hold', defId: 'grounded', playerId: null, data: { hold: true, figure: 'goblin' } }],
      };
    },
  },
  {
    id: 'hullbreach',
    kind: 'coach',
    art: 'saucer',
    artEvent: 'stranded',
    beat: () => ({
      tag: 'THE SHIP',
      text: `${pick(RIDE_ANTIC)}\n\nA micrometeorite shreds the cargo bay — and your scout reports fly out through the hole. Every dossier, spinning off into the void in a slow, expensive constellation.`,
      choices: [
        C('accept', 'WATCH THEM GO', { up: { pct: 2, cls: 'INTEL' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('eva', 'SUIT UP AND CHASE THEM (1¢)', { cost: 1, up: { pct: 50, cls: 'INTEL' }, down: { pct: 10, cls: 'INJURY' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const wipe = (): void => {
        // the intel goes — and so does the ORDER: the board refiles itself
        // in no sequence you remember, so re-scouting really starts over
        // (unless you remember their actual names. Unlikely.)
        for (const pr of ctx.s.prospects) {
          pr.scoutLevel = 0;
          pr.seenSkill = false;
          pr.seenPot = false;
          pr.digits = 0;
        }
        ctx.s.prospects.sort(() => Math.random() - 0.5);
      };
      if (key === 'eva') {
        const t = tails(50, 10);
        if (t === 'up') return { text: 'You spacewalk with a net like a lunatic and catch nearly all of it. The scouting intel survives.', };
        if (t === 'down') { wipe(); return { text: 'You catch three dossiers and a meteorite catches you. The intel is gone and your shoulder clicks now.', }; }
        wipe();
        return { text: 'You catch two folders and a lot of vacuum. The rest is a constellation now. Intel: gone, and the board refiles itself in an order you have never seen.', };
      }
      wipe();
      return { text: 'You watch a season of scouting drift off sunward. Somewhere out there, a very informed comet. Every prospect on the board is a stranger again — and the refiled board is in no order you remember.', fx: [] };
    },
  },

  // ---- follow-up bill beats -------------------------------------------------------
  {
    id: 'goblin_bill',
    kind: 'coach',
    figure: 'goblin',
    beat: () => ({ tag: 'THE BILL', text: 'The mech-goblin invoice arrives, engraved on a small meteor: 3 CREDITS. They also left a mint.' }),
    resolve: () => ({ text: '', fx: [{ coachEnergy: -3 }] }),
  },
  // the captain's order got CAUGHT: the league reviews the tape on Monday
  {
    id: 'tape_review',
    kind: 'player',
    figure: undefined,
    beat: (_b, ctx) => ({
      tag: 'THE LEAGUE SAW THE TAPE',
      text: `The screen ${pname(ctx)} set on their star has been slowed down, zoomed in, and watched eleven times by a league disciplinary panel.\n\nIt looks exactly like what it was.`,
    }),
    resolve: (_k, ctx) => {
      const p = ctx.player;
      if (!p) return { text: 'The suspension letter arrives for a player who is no longer yours to suspend.', fx: [{ opP: -5 }] };
      return {
        text: `${p.name} is suspended two weeks. The panel's report uses the word "choreographed". The Dean uses worse.`,
        fx: [{ playerId: p.id, outWeeks: 2, outReason: 'suspension (the screen)', mood: -8 }, { opP: -8, heatS: 3 }],
      };
    },
  },
  {
    id: 'espresso_crash',
    kind: 'coach',
    beat: () => ({ tag: 'THE CRASH', text: 'The nebula espresso bill comes due. The squad moves like seaweed. Practice is held at a whisper.' }),
    resolve: () => ({ text: '', fx: [{ teamEnergyP: -30 }] }),
  },
  {
    id: 'check_probe',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({ tag: 'THE LEAGUE CALLS', text: "The blank check cleared. So did the league's subpoena. The investigation you felt coming has arrived, with weather of its own." }),
    resolve: () => ({ text: '', fx: [{ opP: -14, heatS: 7 }] }),
  },
  {
    id: 'chrono_age',
    kind: 'player',
    beat: (_b, ctx) => ({ tag: 'REGISTRAR', text: `The registrar's office has reviewed ${pname(ctx)}'s "subjective years" and ruled: they count. He is now a class year older. There is a form. There is always a form.` }),
    resolve: (_k, ctx) => {
      const p = ctx.player;
      if (p) p.classYear = Math.min(3, p.classYear + 1);
      return { text: '', fx: [] };
    },
  },

  // ---- THE HOT SEAT ----------------------------------------------------------------
  {
    id: 'interfere_school',
    kind: 'coach',
    context: 'ultimatum',
    figure: 'dean',
    beat: () => ({
      tag: 'THE SCHOOL INTERFERES',
      text: 'The Provost is in your office, uninvited, rearranging your trophies by "moral weight". The school\'s patience with your methods has run out. She has a list of demands and a pen that costs more than your ship.',
      choices: [
        C('comply', 'SUSPEND YOUR BEST PLAYER 1 WEEK (a show of contrition)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('donate', 'FUND HER ETHICS WING (3¢)', { cost: 3, up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('defy', 'SHOW HER THE DOOR', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'comply') {
        const p = ctx.bestPlayer();
        if (!p) return { text: 'There is nobody left to suspend. The Provost finds this, somehow, worse.', fx: [{ heatS: -10 }] };
        const t = tails(5, 10);
        const fx: Fx[] = [{ playerId: p.id, outWeeks: 1, outReason: 'contrition suspension', mood: -8 }, { heatS: -18 }];
        if (t === 'down') fx.push({ teamMood: -8 });
        return { text: `${p.name} sits a week "for the culture of the program." The Provost nods. ${t === 'down' ? 'The locker room does not.' : 'The locker room, surprisingly, gets it.'}`, fx };
      }
      if (key === 'donate') return { text: 'You fund the ethics wing. There will be a plaque. Your name on it is spelled almost correctly.', fx: [{ heatS: -15 }] };
      const t = tails(10, 25);
      if (t === 'up') return { text: 'You show her the door with such conviction that she momentarily respects you. The heat stays. The trophies go back in win order.', fx: [{ heatS: 5, teamMood: 5 }] };
      if (t === 'down') return { text: 'She leaves. By Friday there is a faculty senate resolution with your name in the title.', fx: [{ heatS: 15 }] };
      return { text: 'She leaves without a word, which costs you more sleep than shouting would have.', fx: [{ heatS: 8 }] };
    },
  },
  {
    id: 'interfere_boost',
    kind: 'coach',
    context: 'ultimatum',
    figure: 'booster',
    beat: () => ({
      tag: 'THE BOOSTERS INTERFERE',
      text: 'Three boosters in matching chrome suits occupy your office like weather. They\'ve seen the standings. They have "thoughts". The tallest one keeps touching your whiteboard.',
      choices: [
        C('gala', 'THROW THE APPEASEMENT GALA (3¢)', { cost: 3, up: { pct: 10, cls: 'LOOT' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('promise', 'PROMISE THEM THE TOURNAMENT', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
        C('defy', 'THROW THEM OUT', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'gala') {
        const t = tails(10, 2);
        if (t === 'up') return { text: 'The gala is a triumph. Somebody auctions a moon. A chrome suit presses something into your hand "for the stretch run".', fx: [{ heatB: -20, giveItem: 'espresso' }] };
        return { text: 'Shrimp towers, a laser quartet, three speeches about "winning culture". The boosters leave soothed.', fx: [{ heatB: -18 }] };
      }
      if (key === 'promise') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'You promise them the tournament. They write it down. They have a guy whose whole job is writing down what you promise.', fx: [{ heatB: -10 }] };
        return { text: 'You promise them the tournament with enough conviction that you briefly believe it yourself.', fx: [{ heatB: -12 }] };
      }
      const t = tails(10, 25);
      if (t === 'up') return { text: 'You throw them out and the story becomes legend by dinnertime. Boosters respect exactly one thing and you just did it.', fx: [{ heatB: -8 }] };
      if (t === 'down') return { text: 'You throw them out. Their checkbooks leave with them, loudly.', fx: [{ heatB: 12 }] };
      return { text: 'They leave, straightening their chrome. "We\'ll be watching," says the tallest one, watching.', fx: [{ heatB: 5 }] };
    },
  },
  {
    id: 'summons',
    kind: 'coach',
    context: 'ultimatum',
    figure: 'side',
    beat: (_b, ctx) => {
      const lean = (ctx.data.side as string) ?? 'joint';
      const who = lean === 'school' ? 'The Provost, flanked by lawyers,' : lean === 'boost' ? 'The booster council, in funeral chrome,' : 'The Provost AND the booster council, together, agreeing on exactly one thing,';
      return {
        tag: '⚠ THE SUMMONS',
        text: `${who} summons you to the long room with the long table. Your seat, notably, has been made hot. This is the conversation. Survive it or clean out your office.`,
        choices: [
          C('sacrifice', 'SACRIFICE THE BAG (lose every item)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
          C('pay', 'BUY YOUR SEAT BACK (5¢)', { cost: 5, up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
          C('refuse', 'REFUSE. LET THEM SWING.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SCANDAL' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      if (key === 'sacrifice') {
        const n = ctx.s.bag.length;
        ctx.s.bag = [];
        return { text: `You empty THE BAG onto the long table — ${n} item${n === 1 ? '' : 's'}, every favor and vial you were saving. The room inspects your ruin and is satisfied.`, fx: [{ heatS: -25, heatB: -25 }] };
      }
      if (key === 'pay') return { text: 'You spend everything you have on apologies, galas, review boards, and one enormous commemorative bench. Your seat cools.', fx: [{ heatS: -20, heatB: -20 }] };
      const t = tails(10, 50);
      if (t === 'up') return { text: 'You refuse — and the room BLINKS. Somewhere in the vote, you survive by one hand. You will never know whose.', fx: [{ heatS: -10, heatB: -10, teamMood: 8 }] };
      if (t === 'down') return { text: 'You refuse. The vote is short.', fx: [{ gameover: 'fired' }] };
      return { text: 'You refuse, barely survive the vote, and leave the long room older.', fx: [{ heatS: 5, heatB: 5 }] };
    },
  },

  // ---- THE DEBT LADDER + THE EMPTY LOCKER ---------------------------------------------
  {
    id: 'debt',
    kind: 'coach',
    art: 'bus',
    artEvent: 'stranded',
    beat: (b, ctx) => {
      if (b === 'people') {
        const best = ctx.bestPlayer();
        const name = best?.name ?? 'your best player';
        return {
          tag: '☠ THE DEBT LADDER',
          text: genderize(`The smuggler captain walks your bench with a jeweler's eye and points at ${name}. "Him. He works the engine room until the debt clears. Debts here don't clear."\n\nThey have taste. They also have a tractor beam.`, best?.form),
          data: { targetId: best?.id ?? null },
          choices: [
            C('hand', `HAND OVER ${name.toUpperCase()}`, { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
            C('counter', 'OFFER SOMEONE ELSE', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 50, cls: 'DRAMA' } }),
            C('refuse', 'REFUSE THEM EVERYTHING', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SHIP' } }),
          ],
        };
      }
      const hasItems = ctx.s.bag.length > 0;
      return {
        tag: '☠ EMPTY POCKETS',
        text: `${pick(RIDE_ANTIC)}\n\n${ctx.data.cause ?? 'A meteor swarm shreds the team bus in dead space.'} A salvage rig answers the distress call, lights like teeth. The tow bill is more than you have — you have NOTHING. They open negotiations, if that's the word.`,
        choices: [
          ...(hasItems ? [C('loot', `PAY IN LOOT (give up an item)`, { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } })] : []),
          C('favor', 'CALL A BOOSTER, BEG', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
          C('nothing', 'YOU HAVE NOTHING TO GIVE', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SHIP' } }),
        ],
      };
    },
    resolve: (key, ctx, ev) => {
      const s = ctx.s;
      if (ev.beat === 'people') {
        const targetId = (ev.data?.targetId as number | null) ?? null;
        const target = s.teams[s.myTeamId].players.find((p) => p.id === targetId) ?? ctx.bestPlayer();
        if (key === 'refuse') {
          const t = tails(2, 50);
          if (t === 'up') return { text: 'You refuse everything — and a patrol cruiser drops out of warp at exactly the right moment. The smugglers scatter. You will never be this lucky again. 1 in 50, and you WON it.', fx: [{ teamMood: 10 }] };
          return { text: 'You refuse them everything. They shrug, cut the tow line, and leave you to the dark.', fx: [{ gameover: 'void' }] };
        }
        if (key === 'counter' && target) {
          const others = s.teams[s.myTeamId].players.filter((p) => p.id !== target.id);
          const alt = others.sort((a, b) => ovr(a.attrs) - ovr(b.attrs))[0];
          const t = tails(50, 50);
          if (t === 'up' && alt) {
            return {
              text: `You offer ${alt.name} instead, talking fast about "untapped engine-room potential". The captain squints... and takes the deal. ${alt.name} is gone. The team watches the airlock close.`,
              fx: [{ playerId: alt.id, takePlayer: true }, { teamMood: -15 }],
              next: { defId: 'locker', beat: 'start', playerId: null },
            };
          }
          return {
            text: `You offer a substitute. The captain takes offense — and takes ${target.name} anyway, plus your dignity as a tip.`,
            fx: [{ playerId: target.id, takePlayer: true }, { teamMood: -20 }],
            next: { defId: 'locker', beat: 'start', playerId: null },
          };
        }
        if (target) {
          return {
            text: genderize(`You shake ${target.name}'s hand at the airlock and cannot find one single word. He nods like it's a road game. The doors close. The team will not look at you this week.`, target.form),
            fx: [{ playerId: target.id, takePlayer: true }, { teamMood: -18 }],
            next: { defId: 'locker', beat: 'start', playerId: null },
          };
        }
        return { text: 'There is nobody left to take. The smugglers, disgusted, leave you to the dark.', fx: [{ gameover: 'void' }] };
      }
      // beat 'start'
      if (key === 'loot' && s.bag.length) {
        const idx = rand(s.bag.length);
        const item = itemById(s.bag[idx]);
        return { text: `They take ${item.name} with the reverence of people who know exactly what it's worth. The tow line hums. You ride home in silence.`, fx: [{ loseItemIdx: idx }] };
      }
      if (key === 'favor') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'A booster wires the ransom before you finish the sentence — and the wire is VISIBLE. League forensic accountants love visible.', fx: [{ heatB: -5, heatS: 20 }] };
        if (t === 'up') return { text: 'A booster pays without questions and, horrifyingly, without conditions. "You owe me a story sometime, coach." That\'s all. Somehow that\'s worse.', fx: [{ heatS: 8 }] };
        return { text: 'A booster pays the rig. The favor goes in a ledger you will never be shown, next to your name.', fx: [{ heatS: 10, heatB: -8 }] };
      }
      // nothing left → they shop the roster
      const t = tails(2, 50);
      if (t === 'up') return { text: 'You turn out your pockets: lint, a whistle, a laminated play card. The captain finds the play card genuinely interesting and takes it as payment. 1 in 50, and you WON it.', fx: [] };
      if (t === 'mid') return { text: 'They sweep the bus for valuables, take the good seats — the SEATS — and leave you drifting toward home at a crawl. Everyone stands for a week.', fx: [{ teamMood: -10, teamEnergyP: -10 }] };
      return {
        text: 'The captain smiles like a hull breach.',
        next: { defId: 'debt', beat: 'people', playerId: null },
      };
    },
  },
  {
    id: 'locker',
    kind: 'coach',
    beat: () => ({
      tag: 'THE EMPTY LOCKER',
      text: 'One locker stands empty and the league does not care why: you need a ninth body by tip-off. The candidates, such as they are:',
      choices: [
        C('walkon', 'THE TRAINING-SQUAD WALK-ON', { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('daughter', "THE DEAN'S DAUGHTER (she's good. that's the problem.)", { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('droid', 'THE DROID A BOOSTER BUILT (suspiciously excellent)', { up: { pct: 5, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'daughter') {
        return {
          text: 'Minervva signs the eligibility forms her mother happens to have on hand. She IS good. The Dean now attends every practice "as family". The school owns a piece of your lineup and knows it.',
          fx: [{ addPlayer: 'daughter' }, { heatS: 5 }],
          follow: [{ weeks: 4, beat: 'start', defId: 'daughter_favor', playerId: null }],
        };
      }
      if (key === 'droid') {
        return {
          text: 'UNIT-7 unfolds from a crate with a jersey already on. Its jumper is perfect. Its blood is technically coolant. The paperwork lists its species as "undeclared".',
          fx: [{ addPlayer: 'droid' }],
          follow: [{ weeks: 3, beat: 'start', defId: 'droid_probe', playerId: null }],
        };
      }
      const t = tails(2, 2);
      if (t === 'up') {
        return { text: 'The training-squad kid gets the locker — and in his first scrimmage does something that makes your assistant drop the clipboard. A GEM. 1 in 50, and you WON it.', fx: [{ addPlayer: 'gem' }] };
      }
      return { text: 'The training-squad kid gets the locker. He cries a little. He earned the right.', fx: [{ addPlayer: 'walkon' }] };
    },
  },
  {
    id: 'daughter_favor',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'FAMILY SEATS',
      text: 'The Dean "wonders aloud", in your doorway, whether her daughter shouldn\'t be STARTING. She wonders it while holding the eligibility forms she could unsign.',
      choices: [
        C('start', 'START HER THIS WEEK', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('merit', '"SHE PLAYS WHEN SHE EARNS IT."', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'start') {
        const t = tails(5, 10);
        if (t === 'down') return { text: 'She starts. The locker room does the math on WHY, out loud.', fx: [{ teamMood: -8, heatS: -8 }] };
        return { text: 'She starts, and plays well enough that the question answers itself. This time.', fx: [{ heatS: -8 }] };
      }
      const t = tails(10, 25);
      if (t === 'up') return { text: 'She backs you IN THE MEETING. "I play when I earn it." The Dean leaves defeated by her own bloodline.', fx: [{ teamMood: 8 }] };
      if (t === 'down') return { text: 'The Dean unsmiles. The eligibility forms develop "processing delays".', fx: [{ heatS: 12 }] };
      return { text: 'The Dean withdraws, wounded, to wonder aloud in other doorways.', fx: [{ heatS: 5 }] };
    },
  },
  {
    id: 'droid_probe',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE LEAGUE CALLS',
      text: 'A league eligibility officer would like to discuss UNIT-7\'s "birth certificate", which appears to be a warranty card.',
      choices: [
        C('defend', '"SHOW ME THE RULE AGAINST DROIDS."', { up: { pct: 25, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
        C('bench', 'QUIETLY BENCH THE DROID', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const droid = ctx.team().find((p) => p.special === 'droid');
      if (key === 'defend') {
        const t = tails(25, 25);
        if (t === 'up') return { text: 'There IS no rule against droids. The league writes one on the spot — effective NEXT season. UNIT-7 plays on, gleaming, grandfathered.', fx: [] };
        if (t === 'down') return { text: 'The league finds a rule, or invents one with a straight face. UNIT-7 is suspended and the school inherits the headline.', fx: [{ heatS: 15 }, ...(droid ? [{ playerId: droid.id, outWeeks: 3, outReason: 'eligibility review' } as Fx] : [])] };
        return { text: 'The hearing adjourns without a ruling. UNIT-7 waits in the hallway, doing perfect form shooting against the wall, which does not help the optics.', fx: [{ heatS: 5 }] };
      }
      return { text: 'UNIT-7 takes the bench without complaint, then quietly refiles the entire equipment room by win probability.', fx: [{ heatS: -5 }, ...(droid ? [{ playerId: droid.id, mood: -5 } as Fx] : [])] };
    },
  },

  // ---- ALUMNI (random encounters; LEGACY moves only as story outcomes) ----------------
  {
    id: 'alum_gold',
    kind: 'coach',
    art: 'bus',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'An old player';
      return { tag: 'ALUMNI', text: `${name} — YOUR ${ctx.data.exit === 'pro' ? 'pro' : 'graduate'}, class of season ${ctx.data.season} — thanks you tonight on a galactic broadcast, by name, twice. The phone in your office starts ringing before he finishes.` };
    },
    resolve: (_k, ctx) => ({ text: '', fx: [{ legacy: 2, heatB: -5 }, ...(ctx.s.prospects.length ? [{ commit: 5 } as Fx] : [])] }),
  },
  {
    id: 'alum_dark',
    kind: 'coach',
    art: 'bus',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'someone';
      return {
        tag: 'ALUMNI',
        text: `On the streets of Oblox-4, between the shuttle port and the arena, a voice: "Coach? ...Can you spare some money?"\n\nIt's ${name}. Your ${name} — class of season ${ctx.data.season}. The galaxy has not been kind since.`,
        choices: [
          C('help', 'BUY HIM DINNER. MAKE CALLS. (1¢)', { cost: 1, up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
          C('walk', 'PRESS A COIN IN HIS HAND AND WALK', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      if (key === 'help') {
        const t = tails(25, 10);
        if (t === 'up') return { text: `Dinner, calls, a cot in the equipment room, a job title invented on the spot: "shooting consultant". Six weeks later ${name} is upright, employed, and telling every recruit's family what kind of program this really is.`, fx: [{ legacy: 3, teamMood: 5 }] };
        if (t === 'down') return { text: `You buy dinner and make calls. ${name} takes the help, then vanishes with the equipment-room petty cash. You make the second-hardest call and report it. It was still right to try.`, fx: [{ legacy: 1 }] };
        return { text: `Dinner, calls, a start. ${name} texts you a photo of his first paycheck. You keep it.`, fx: [{ legacy: 2 }] };
      }
      const t = tails(2, 25);
      if (t === 'down') return { text: `You walk. A stream account catches the whole thing at 4K. The caption writes itself, and the school reads captions.`, fx: [{ legacy: -3, heatS: 10 }] };
      if (t === 'up') return { text: `You walk — and hate yourself into action by the corner. You turn around. He's gone. You hire an investigator to find him. To be continued, you swear.`, fx: [{ legacy: -1 }] };
      return { text: `You press a coin in his hand and keep walking. The arena lights are very bright tonight and you deserve none of them.`, fx: [{ legacy: -2, teamMood: -3 }] };
    },
  },
  {
    id: 'alum_void',
    kind: 'coach',
    art: 'bus',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      const canReturn = !ctx.s.voidReturnUsed;
      return {
        tag: 'ALUMNI OF THE VOID',
        text: `A freight manifest, a blurry stream clip, a jersey number you'd know anywhere: ${name} — the one the smugglers took — is ALIVE, playing engine-room pickup in a belt colony, and by every account STRONGER THAN EVER. The debt, word is, has been "renegotiated".`,
        choices: [
          ...(canReturn ? [C('home', 'BRING HIM HOME (once, ever)', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'SHIP' } })] : []),
          C('watch', 'LET HIM WRITE HIS OWN STORY', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      if (key === 'home') {
        ctx.s.voidReturnUsed = true;
        const t = tails(25, 10);
        if (t === 'down') return { text: `You fly out to the belt colony. The smugglers remember you fondly, which costs 2 credits in "docking fees". ${name} meets you at the airlock — and chooses the belt. "I'm the best player in three systems out here, coach." You shake hands as equals. Somehow that's a win too.`, fx: [{ coachEnergy: -2, legacy: 2 }] };
        if (t === 'up') return { text: `You fly out with his old jersey. He's waiting at the dock, bag packed, twice the player who left. The disaster of that season is now the best thing that ever happened to this program. He hands you something from the engine room: "for the bag."`, fx: [{ legacy: 4, teamMood: 15, giveItem: 'vial' }] };
        return { text: `You bring ${name} home to a locker room that will not stop hugging him. He's not eligible to play — the years happened — but he takes a seat on your bench as an assistant, and the whole galaxy knows you came back for him.`, fx: [{ legacy: 3, teamMood: 12 }] };
      }
      const t = tails(10, 5);
      if (t === 'up') return { text: `You follow his colony league box scores like scripture. He's happy out there. You frame the blurry clip.`, fx: [{ legacy: 1 }] };
      if (t === 'down') return { text: `Next season's BIG BANG scouting report will include a familiar name on an unfamiliar roster. He remembers everything, including whose fault it was.`, fx: [] };
      return { text: `He's out there, stronger than ever, writing his own story. Some debts pay themselves forward.`, fx: [] };
    },
  },

  // ---- VOYAGES ------------------------------------------------------------------------
  {
    id: 'vendor',
    kind: 'coach',
    art: 'bus',
    beat: () => ({
      tag: 'VOYAGE',
      text: 'The bus drops out of warp for fuel at a station shaped like a grin…\n\nOn the concourse, a vendor unrolls a coat lined with unlabeled miracles. "For the discerning coach," she says, discerning you instantly.',
      choices: [
        C('buy', 'BUY SOMETHING UNLABELED (2¢)', { cost: 2, up: { pct: 10, cls: 'LOOT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('pass', 'KEEP WALKING', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'pass') return { text: 'You keep walking. The coat rustles with disappointment.', fx: [] };
      const commons = ITEMS.filter((i) => i.rarity !== 'legendary');
      const item = pick(commons);
      const t = tails(10, 10);
      if (t === 'down') return { text: `You buy ${item.name}. The league, it turns out, photographs this station. Of course it does.`, fx: [{ giveItem: item.id, heatS: 8 }] };
      if (t === 'up') { const extra = pick(commons); return { text: `You buy ${item.name} and she throws in ${extra.name} "for luck". The coat approves of you now.`, fx: [{ giveItem: item.id }, { giveItem: extra.id }] }; }
      return { text: `You buy ${item.name}, unlabeled, unquestioned, un-receipted.`, fx: [{ giveItem: item.id }] };
    },
  },
  {
    id: 'bus_prospect',
    kind: 'coach',
    art: 'bus',
    artEvent: 'hoop',
    beat: () => ({
      tag: 'VOYAGE',
      text: 'Hours deep into the ride home, the cabin lights dim and something rhythmic taps behind you…\n\nA kid is doing ball-handling drills in zero-G with his seatbelt ON, because the driver asked. Fundamentals AND manners.',
      choices: [
        C('card', 'SLIDE HIM YOUR CARD', { up: { pct: 10, cls: 'INTEL' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('sleep', 'YOU NEED THE SLEEP', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'sleep') {
        const t = tails(2, 5);
        if (t === 'down') return { text: 'You sleep. Two seasons from now that kid drops 40 on you in the tournament and waves at your bench. You will remember the seatbelt.', fx: [] };
        return { text: 'You sleep the sleep of a coach who has seen a thousand kids dribble on a thousand buses. Probably fine.', fx: [] };
      }
      if (ctx.s.prospects.length >= 9) return { text: 'You slide him your card — and remember the board is FULL. He promises to call next season. Kids never call.', fx: [] };
      return { text: 'You slide him your card. He reads it twice and does another set, harder. A name for the board, met the honest way.', fx: [{ intel: true }] };
    },
  },
  {
    id: 'omen',
    kind: 'coach',
    figure: 'attendant',
    beat: () => ({
      tag: 'THE FUEL STOP',
      text: 'The bus sets down for fuel, and the attendant — a gelid in a service cap, rings rippling under the coveralls — watches the exhaust far too closely…\n\nThey read engine exhaust the way others read palms. "A name on your board," they say. "I have seen who they really are."',
      choices: [
        C('listen', 'LISTEN', { up: { pct: 50, cls: 'INTEL' }, down: { pct: 5, cls: 'DRAMA' } }),
        C('tip', 'TIP THEM AND BOARD', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'tip') return { text: 'You tip them. They palm the coin, top off the tank, and tell the BUS its future instead. The bus seems reassured.', fx: [] };
      const t = tails(50, 5);
      if (t === 'up') {
        const pool = ctx.s.prospects.filter((pr) => !pr.seenSkill || !pr.seenPot || pr.digits < 2);
        const pr = pool.length ? pick(pool) : null;
        if (!pr) return { text: 'They squint at your board through the fumes and find nothing you don\'t already know. "Thorough," they allow, and wipe the windshield.', fx: [] };
        pr.seenSkill = true;
        pr.seenPot = true;
        pr.digits = 2;
        pr.scoutLevel = 4;
        pr.seenAttrs = { ...pr.attrs };
        pr.seenPots = { ...pr.pots };
        return { text: `They trace a kid's whole career in spilled coolant on the forecourt — it's ${pr.name}, resolved to the digit, ceiling and all. Free truth, plus a full tank.`, fx: [] };
      }
      if (t === 'down') return { text: 'They describe, in perfect detail, YOUR team\'s weaknesses, loudly, over the pump intercom. The team pretends not to hear. The team heard.', fx: [{ teamMood: -5 }] };
      return { text: '"Tall," they say finally. "Some of them. Others, less so." You thank them for nothing in particular and pay for the fuel.', fx: [] };
    },
  },
];

// one-time explainers from the assistant coach (shown once, then never again)
// HELP, NOT LECTURES (v5 M3): the ? button answers exactly one question —
// "where do I press next, and what does it do?" Two sentences, max. The deep
// rules stay the game's actual fun; the tutorial teaches the rest by doing.
export const TIPS: Record<string, string> = {
  tryouts:
    "Drag players between the rows — the top three are your squad, the bottom row is the door, forever. The letter on every card is what they're worth in that exact slot; CONFIRM when it reads right.",
  practice:
    'Pick a drill with ▾, then hold RUN — one practice a week, TEAM REST is free. Anyone under 40⚡ sits out on their own.',
  lenses:
    'One squad, three lenses: ROSTER is right now, STATS is the season, ABILITIES is the shape and the ceiling. Same nine faces, same nine places.',
  facilities:
    'Tap ▲ to order an upgrade — it costs now and lands NEXT WEEK. The mop is free, and the janitor remembers who grabs it.',
  scouting:
    'Pick a move with ▾ and press the big button — one board move a week, the REC CENTER is free. The rows are your priority: TARGETS get the deep looks.',
  recruiting:
    "Pick your charm with ▾ and press the big button — one move a week, the GROUP CHAT is free. The booster's options swing harder and can blow up.",
  matchup:
    "Drag the lineup until the bars lean your way, make the pregame move with ▾, then hold PLAY. The OVERALL gauge is tonight's win chance.",
  signing:
    "Tap a name to send a letter — every letter past the first costs commitment. SEND LETTERS when you've chosen, and the wheel answers.",
  bag:
    'Tap an item for its terms, or drag it onto a player, a recruit, or a story. THE NOTEBOOK on the left writes down whatever screen you tap it on.',
  grid:
    "Hold and drag to rearrange — top row starts, middle is the bench, bottom watches. Small bodies left, big right; the letter is what they're worth where they stand.",
  stories:
    'Tap to advance. Every choice prints its two tails — how good and how bad it can go; the words lean, the tails never lie.',
  gamenight:
    'Tap the court to run the clock to the horn, then tap through the verdict, the box score and the table with the big button. XP lands Monday, at WEEK START.',
  departures:
    "Talk to each star the pros are circling — the wheel decides — then continue to SIGNING DAY. RETIRE sits at the bottom, for when you're ready to lock in the legacy.",
};

// THE TRAVEL LAW: every trip opens on the vehicle speeding through space with
// one anticipation line ending in "…" — the NEXT beat is the relief ("travel
// was uneventful") or the trouble (the image changes and the story continues).
export const RIDE_ANTIC = [
  'The ride home starts quiet. The void hums past the windows…',
  'The bus threads the dark between two systems, running lights blinking…',
  'Warp speed. The stars stretch into lines and the cabin goes still…',
  'The long haul home. The autopilot clears its throat…',
  'Halfway home, deep in nobody\'s sky…',
];

// the ride home: an away weekend ends on the bus, heading screen-left
STORIES.push({
  id: 'travel',
  kind: 'coach',
  art: 'bus',
  beat: (_b, ctx) => ({ tag: 'THE ROAD HOME', text: `${pick(RIDE_ANTIC)}\n\n${(ctx.data.text as string) ?? pick(TRAVEL_FLAVOR)}` }),
  resolve: () => ({ text: '' }),
});

// wheels up: every away game opens with the bus heading out, screen-right
STORIES.push({
  id: 'travel_out',
  kind: 'coach',
  art: 'bus',
  beat: () => ({ tag: 'THE ROAD', text: `Wheels up. The bus points its nose at a stranger's sun…\n\n${pick(TRAVEL_OUT_FLAVOR)}` }),
  resolve: () => ({ text: '' }),
});

// a tap-through announcement: text in, nothing decided
STORIES.push({
  id: 'notice',
  kind: 'coach',
  beat: (_b, ctx) => ({ tag: (ctx.data.tag as string) ?? 'NEWS', text: (ctx.data.text as string) ?? '' }),
  resolve: () => ({ text: '' }),
});

// THE REVEAL CARD: anything gained gets its own dialog showing exactly what
// you received — the UI renders the picker-row preview from data.kind/id
STORIES.push({
  id: 'reveal',
  kind: 'coach',
  beat: (_b, ctx) => {
    const kind = ctx.data.kind as string;
    const id = ctx.data.id as string;
    if (kind === 'speech') {
      const pl = PLANS.find((x) => x.id === id)!;
      return { tag: '★ NEW LOCKER ROOM SPEECH ★', text: `${pl.name} is yours now, forever. The next room you say it in will believe you.` };
    }
    if (kind === 'drill') {
      const d = drillById(id);
      return { tag: '★ NEW PRACTICE METHOD ★', text: `${d.name} joins the practice board. The squad doesn't know what's coming.` };
    }
    if (kind === 'instr') {
      const it = instrById(id);
      return { tag: '★ NEW LAST-MINUTE INSTRUCTION ★', text: `${it.name} is in your pregame arsenal now. Some game nights call for words. Some call for this.` };
    }
    if (kind === 'region') {
      const a = galaxyActById(id);
      return { tag: '★ NEW STAR CHARTS ★', text: `${a.name} is on your search charts now. Somewhere out there, a kid is warming up.` };
    }
    const item = itemById(id);
    return { tag: '★ NEW ITEM IN THE BAG ★', text: `${item.name} goes into THE BAG.` };
  },
  resolve: () => ({ text: '' }),
});

// bag overflow: five slots is the LAW — a full bag means the new thing is lost.
// (Use your items, coach.)
STORIES.push({
  id: 'bagfull',
  kind: 'coach',
  beat: (_b, ctx) => {
    const incoming = itemById(ctx.data.itemId as string);
    return {
      tag: 'THE BAG IS FULL',
      text: `${incoming.name} lands in your hands — and THE BAG has no room. Eight slots, that's the law. You watch a kid outside the arena walk off with it, delighted.\n\nUse your items, coach.`,
    };
  },
  resolve: () => ({ text: '' }),
});

// the one you cut: players discarded at the roster cut remember it —
// three ways it comes back around, rolled when the beat lands
STORIES.push({
  id: 'cut_revenge',
  kind: 'coach',
  beat: (_b, ctx) => {
    const name = (ctx.data.cutName as string) ?? 'The one you cut';
    const their = ctx.data.cutForm === 'femme' ? 'her' : ctx.data.cutForm === 'x' ? 'their' : 'his';
    let v = ctx.data.variant as number | undefined;
    if (v === undefined) { v = rand(3); ctx.data.variant = v; }
    const texts = [
      `${name} — the one you let go at the cut — just dropped 40 in a rec-league stream with your program's name written on ${their} shoes. Crossed out.\n\nThe squad has all seen it. Twice.`,
      `${name} — the one you let go at the cut — is on every feed this morning, signed by a rival program's rec league, telling a streamer with 9 million followers exactly which coach "couldn't see it".\n\nThe quote has your name in it.`,
      `A handwritten letter arrives from ${name} — the one you let go at the cut. "The cut lit a fire," it says. "Thank you for the fuel." Folded inside: a ticket stub from ${their} first semi-pro start.\n\nYou read it three times.`,
    ];
    return { tag: 'THE ONE YOU CUT', text: texts[v] ?? texts[0] };
  },
  resolve: (_k, ctx) => {
    const v = (ctx.data.variant as number) ?? 0;
    if (v === 2) return { text: 'You pin the stub to the corkboard where the squad will see it. Some cuts cut forward.', fx: [{ legacy: 1, teamMood: 3 }] };
    if (v === 1) return { text: 'The boosters call an emergency lunch about "narrative control". There is no controlling this narrative.', fx: [{ heatB: 8 }] };
    if (Math.random() < 0.5) {
      return { text: 'The locker room laughs it off, mostly. The boosters do not laugh at all.', fx: [{ heatB: 5 }] };
    }
    return { text: 'Practice that week is QUIET. Some cuts cut back.', fx: [{ teamMood: -6 }] };
  },
});

// SIGNING DAY, one name at a time: the holo-line rings, the wheel decides,
// and the card shows the whole truth for the first time — signed or not
STORIES.push({
  id: 'signing_verdict',
  kind: 'coach',
  beat: (_b, ctx) => {
    const name = (ctx.data.name as string) ?? 'The kid';
    const commit = ctx.data.commit === true;
    const missed = (ctx.data.pct as number) ?? 0;
    const line = commit
      ? pick([
          `${name} COMMITS. He announces it by skywriting over your stadium — the spelling is mostly right.`,
          `${name} COMMITS. "Where do I sign," he says, already signing.`,
          `${name} COMMITS. His mother cries. Your assistant cries. The holo-line cuts out mid-cry.`,
        ])
      : missed <= 0
        ? `${name} never picks up. The letter, it turns out, arrived with four others — his holo-agent says the pile was "insulting."`
        : pick([
            `${name} signs elsewhere. His holo-agent says it "wasn't personal." It was a little personal.`,
            `${name} goes with the other program — the one with the pool. You don't have a pool.`,
            `${name} says thank you, sincerely, and then says no, sincerely.`,
          ]);
    return { tag: 'SIGNING DAY', text: `${name}'s holo-line rings. The whole staff leans in…\n\n${line}` };
  },
  resolve: () => ({ text: '' }),
});

// ---- THE BIG BANG: the moments that deserve confetti (or a long walk) --------
STORIES.push({
  id: 'bigbang_invite',
  kind: 'coach',
  beat: (_b, ctx) => {
    const place = (ctx.data.place as number) ?? 1;
    const rec = (ctx.data.record as string) ?? '';
    return {
      tag: `★ ${TOURNEY.name} ★`,
      text: place === 1
        ? `The final standings post and the gym goes SILENT for one full second before it explodes.\n\nLEAGUE CHAMPIONS (${rec}). The invitation to ${TOURNEY.name} lands on your desk with a sonic boom. Eight champions. One universe. You are one of the eight.`
        : `The final standings post: second place (${rec}). The room holds its breath — and then the holo-line rings.\n\nTHE SECOND SHUTTLE IS YOURS. ${TOURNEY.name}: eight champions, one universe. You are one of the eight. Pack light.`,
    };
  },
  resolve: () => ({ text: '', fx: [{ teamMood: 10 }] }),
});

STORIES.push({
  id: 'bigbang_round',
  kind: 'coach',
  beat: (_b, ctx) => {
    const round = (ctx.data.round as number) ?? 0;
    const opp = (ctx.data.opp as string) ?? 'a champion';
    const gimmick = (ctx.data.gimmick as string) ?? '';
    const styleLines = CHAMP_STYLE[(ctx.data.planId as PlanId)] ?? ['the tape is upsetting'];
    const style = pick(styleLines);
    const heads = [
      `Eight champions arrived. The bracket is posted on a wall the size of a moon, and your name is on it.\n\nFIRST ROUND: ${opp}. "${gimmick}" — that's the word from three systems over. The scout's read, verbatim: "${style}." Win or go home.`,
      `You're THROUGH. Four teams left in the whole universe, and one of them is yours.\n\nTHE SEMIFINAL: ${opp}. "${gimmick}" — the scout couldn't stop talking about them. His exact words: "${style}." Win or go home.`,
      `Two teams left. TWO. Every screen in the galaxy is tuned to one court, and you're walking out onto it.\n\n${TOURNEY.rounds[2]}: ${opp}. "${gimmick}." The scout's last report before he retired on the spot: "${style}." Forty minutes from forever.`,
    ];
    return { tag: TOURNEY.rounds[round] ?? TOURNEY.name, text: heads[round] ?? heads[0] };
  },
  resolve: () => ({ text: '' }),
});

STORIES.push({
  id: 'bigbang_out',
  kind: 'coach',
  beat: (_b, ctx) => {
    const round = (ctx.data.round as number) ?? 0;
    const opp = (ctx.data.opp as string) ?? 'the champions';
    const score = (ctx.data.score as string) ?? '';
    const lines = [
      `The horn. ${opp} ${score}. The first round is where most dreams go, and yours went there too.\n\nThe bus home is quiet in the way buses are quiet when nobody wants to be the first to say it was still a great season.`,
      `The horn. ${opp} ${score}. A semifinal. Four teams left in the universe and you were one of them.\n\nThe seniors sit on the floor of the locker room for a long time. Nobody tells them to get up.`,
      `The horn. ${opp} ${score}. One game from forever.\n\nThe confetti falls for somebody else. You watch every piece of it land. Next year, you tell the room. Next year, the room tells you back.`,
    ];
    return { tag: 'ELIMINATED', text: lines[round] ?? lines[0] };
  },
  resolve: () => ({ text: '', fx: [{ teamMood: -4 }] }),
});

STORIES.push({
  id: 'bigbang_champs',
  kind: 'coach',
  beat: (_b, ctx) => {
    const opp = (ctx.data.opp as string) ?? 'the last champion standing';
    const score = (ctx.data.score as string) ?? '';
    return {
      tag: '★★★ CHAMPIONS OF THE UNIVERSE ★★★',
      text: `The horn. ${opp} ${score}.\n\nYOU WON ${TOURNEY.name}. You cut the net in zero gravity. The confetti simply never lands. Somewhere a booster is buying a planet. Somewhere the dean is crying into a spreadsheet. The banner will hang in that gym until the sun goes out.`,
    };
  },
  resolve: () => ({ text: '', fx: [{ teamMood: 20 }] }),
});

STORIES.push({
  id: 'season_over',
  kind: 'coach',
  figure: 'dean',
  beat: (_b, ctx) => {
    const place = (ctx.data.place as number) ?? 3;
    const rec = (ctx.data.record as string) ?? '';
    const ord = `${place}${['', 'st', 'nd', 'rd'][place] ?? 'th'}`;
    return {
      tag: 'SEASON OVER',
      text: `The final standings post. ${ord} (${rec}).\n\nThe shuttle to ${TOURNEY.name} leaves without you. The dean watches it go from her office window, then watches you.`,
    };
  },
  resolve: () => ({ text: '' }),
});

// ---- THE NIGHT'S INTERRUPTIONS: the live game pauses, the coach decides ----
// One per player per game, two per night at most. ON FIRE lifts the whole
// team if you let them cook (and taxes the body Monday); an injury knocks
// the team if you pull them, or waits until Monday to show its real size if
// you tape it up. Medical items in THE BAG show up as choices here too.
STORIES.push({
  id: 'fire_live',
  kind: 'player',
  beat: (b, ctx) => {
    const p = pname(ctx);
    if (b === 'after') {
      const label = (ctx.data.label as string) ?? 'a strain';
      const weeks = (ctx.data.weeks as number) ?? 1;
      return { tag: 'THE MORNING AFTER', text: `${p} pulls up lame in Monday's shootaround — the fire took its toll. The trainer says ${label}: ${weeks} week${weeks === 1 ? '' : 's'}.` };
    }
    const pts = (ctx.data.pts as number) ?? 25;
    // SEASON ZERO's fire is the story: benching him is not on the menu
    const choices = ctx.s.tutorial !== undefined
      ? [C('cook', 'LET HIM COOK', { up: { pct: 50, cls: 'SPIRIT', note: 'the whole team lifts' }, down: { pct: 25, cls: 'INJURY', note: 'the body pays Monday' }, want: 'love' })]
      : [
          C('cook', 'LET HIM COOK', { up: { pct: 50, cls: 'SPIRIT', note: 'the whole team lifts' }, down: { pct: 25, cls: 'INJURY', note: 'the body pays Monday' }, want: 'love' }),
          C('rotate', 'ROTATE AS NORMAL', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' }, want: 'hate' }),
        ];
    return {
      tag: '🔥 ON FIRE',
      text: `${p} is playing LIGHTS OUT tonight — ${pts} already and counting. He is setting the rim on fire. Literally: the net is smoking.\n\nThe bench is on its feet. So is the other coach.`,
      choices,
    };
  },
  resolve: (key, ctx, ev) => {
    const p = ctx.player!;
    const s = ctx.s;
    if (ev.beat === 'after') {
      const weeks = (ctx.data.weeks as number) ?? 1;
      return { text: 'Fire is a loan. This is the interest.', fx: [{ playerId: p.id, outWeeks: weeks, outReason: (ctx.data.label as string) ?? 'a strain', outKind: 'injury', mood: -4 }] };
    }
    if (key === 'cook') {
      const bump = 4 + rand(3);
      s.gameShift = (s.gameShift ?? 0) + bump;
      p.onFire = true;
      p.fireWeeks = 0; // the streak starts tonight — the risk climbs weekly
      const inj = rollInjury(0, fragility(p.speciesId));
      return {
        text: `You leave him in. The whole building leans forward and the whole TEAM plays up to him. +${bump} on the night.`,
        fx: [{ playerId: p.id, mood: 10 }, { teamMood: 4 }],
        follow: roll(15) ? [{ weeks: 1, beat: 'after', data: { label: inj.label, weeks: Math.max(1, Math.min(2, inj.weeks)) } }] : [],
      };
    }
    return { text: `You go to the bench like it's any other night. ${p.name} sits, still smoking, and the moment cools politely. Everyone's fresh for next week.`, fx: [{ playerId: p.id, mood: -6 }] };
  },
});

STORIES.push({
  id: 'injury_live',
  kind: 'player',
  context: 'injury',
  beat: (b, ctx) => {
    const p = pname(ctx);
    const weeks = (ctx.data.weeks as number) ?? 1;
    const label = (ctx.data.label as string) ?? 'a knock';
    if (b === 'worse') {
      const extra = (ctx.data.extra as number) ?? weeks;
      return { tag: 'THE MORNING AFTER', text: `${p} can't put weight on it Monday. It was worse than the tape let on — ${extra} more week${extra === 1 ? '' : 's'} on top.` };
    }
    return {
      tag: 'INJURY',
      text: `${(ctx.data.cause as string) ?? `${p} goes down.`}\n\nThe trainer's face says ${label}: ${weeks} week${weeks === 1 ? '' : 's'}, if he stops now.`,
      choices: [
        C('swap', 'SWAP HIM OUT', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 50, cls: 'DRAIN', note: 'the team takes the knock tonight' }, want: 'hate' }),
        C('tape', 'TAPE IT UP — HE STAYS IN', { up: { pct: 25, cls: 'SPIRIT', note: 'no knock tonight' }, down: { pct: 50, cls: 'INJURY', note: 'Monday may be worse' }, want: 'love' }),
      ],
    };
  },
  resolve: (key, ctx, ev) => {
    const p = ctx.player!;
    const s = ctx.s;
    const weeks = (ctx.data.weeks as number) ?? 1;
    const label = (ctx.data.label as string) ?? 'a knock';
    const levelLoss = ctx.data.levelLoss === true;
    if (ev.beat === 'worse') {
      const extra = (ctx.data.extra as number) ?? weeks;
      return { text: 'The tape was optimistic. The scan is not.', fx: [{ playerId: p.id, outWeeks: Math.min(8, p.outWeeks + extra), outReason: p.outReason || label, outKind: 'injury', mood: -6 }] };
    }
    s.gameInjuries = [...(s.gameInjuries ?? []), { playerId: p.id, weeks, label, levelLoss, tape: key === 'tape' }];
    if (key === 'tape') {
      return {
        text: `Tape, spray, a lie about how bad it looked. ${p.name} finishes the game on one good leg and no knock lands on the team tonight. Monday will tell you what it cost.`,
        fx: [{ playerId: p.id, mood: 4 }],
        follow: roll(50) ? [{ weeks: 1, beat: 'worse', data: { weeks, label, extra: Math.max(1, weeks) } }] : [],
      };
    }
    const knock = 3 + rand(3);
    s.gameShift = (s.gameShift ?? 0) - knock;
    return { text: `${p.name} goes to the tunnel with a towel over his head. The bench closes ranks, and the night gets ${knock} points harder.`, fx: [{ playerId: p.id, mood: -5 }, { teamMood: -3 }] };
  },
});

// ---- the season closes: its own dialogues -------------------------------------
STORIES.push({
  id: 'season_result',
  kind: 'coach',
  beat: (_b, ctx) => ({ tag: `SEASON ${ctx.data.season ?? ''} — THE BOOKS CLOSE`, text: (ctx.data.text as string) ?? '' }),
  resolve: () => ({ text: '' }),
});

STORIES.push({
  id: 'graduation',
  kind: 'coach',
  beat: (_b, ctx) => {
    const name = (ctx.data.name as string) ?? 'A senior';
    const pts = (ctx.data.pts as number) ?? 0;
    const gp = (ctx.data.gp as number) ?? 0;
    const lines = [
      `${name} walks across the stage in a gown two sizes too small, ${gp} games and ${pts} points in the rear-view mirror. The banner says THANK YOU in four languages.`,
      `${name} graduates. Cap, gown, a diploma in a language he can't read yet. ${pts} career points. He hugs you longer than either of you expected.`,
      `${name} is done. ${gp} games, ${pts} points, and a locker that's suddenly just a locker. He leaves his practice jersey folded on your desk.`,
    ];
    return { tag: '🎓 GRADUATION', text: pick(lines) };
  },
  resolve: () => ({ text: '', fx: [{ legacy: 1 }] }),
});

STORIES.push({
  id: 'retire_ask',
  kind: 'coach',
  figure: 'dean',
  beat: (_b, ctx) => ({
    tag: 'THE QUESTION',
    text: `The dean finds you in the empty gym after the last game. "${ctx.data.seasons ?? 'A few'} seasons," she says. "Some coaches know when to walk out while the nets are still warm."\n\nShe doesn't say which kind you are.`,
    choices: [
      C('stay', 'ONE MORE SEASON', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      C('go', 'RETIRE — LOCK IN THE LEGACY', { up: { pct: 50, cls: 'WINDFALL' }, down: { pct: 50, cls: 'DRAMA', note: 'there is no coming back' } }),
    ],
  }),
  resolve: (key) => key === 'go'
    ? { text: 'You walk out of the gym while the nets are still warm, and the galaxy applauds you home.', fx: [{ gameover: 'retired' }] }
    : { text: '"Good," she says, and means it. The recruiting trail is already warm.' },
});

// ---- THE WEEKLY BUDGET: every week opens with the dean and the envelope ------
// A reminder of what this is: your job, for the school. Also her spot for a
// snarky comment about how that job is going.
STORIES.push({
  id: 'dean_budget',
  kind: 'coach',
  figure: 'dean',
  beat: (_b, ctx) => {
    const amt = (ctx.data.amt as number) ?? 5;
    const s = ctx.s;
    const sec = security(s);
    const snark = amt === 0
      ? 'She hands you an envelope with nothing in it. "The board feels you\'ve been... compensated in experience." You have been coaching a very long time.'
      : sec <= 40
        ? `"${amt} credits," she says, holding the envelope a beat too long. "The board asked me to remind you that severance comes in a thinner envelope."`
        : sec <= 55
          ? `"${amt} credits. Spend them better than last week's." She smiles the way auditors smile.`
          : s.trophies > 0
            ? `"${amt} credits, coach." She almost hands it over warmly. "The trophy case is doing your negotiating for you."`
            : `"${amt} credits. The school's investment in you, week by week. No pressure." There is pressure.`;
    return {
      tag: 'THE WEEKLY BUDGET',
      text: `The dean is at your office with an envelope.\n\n${snark}`,
    };
  },
  // the envelope opens on resolve: the credits count up on screen and blast
  // into the top bar
  resolve: (_k, ctx) => ({ text: '', fx: [{ coachEnergy: (ctx.data.amt as number) ?? 0 }] }),
});

// ---- the recruit who LEANS AWAY: that's a story, not a sticker ---------------
// Fired after a recruiting action for each name that soured; it can escalate.
STORIES.push({
  id: 'lean_away',
  kind: 'coach',
  context: 'recruiting',
  beat: (_b, ctx) => {
    const name = (ctx.data.name as string) ?? 'A recruit';
    return {
      tag: 'THE COLD SHOULDER',
      text: genderize(`Word comes back from the trail: ${name} has gone cold on you. His holo-agent uses the phrase "exploring the galaxy's options." Something you did — or something somebody said you did — is doing laps around his homeroom.`, ctx.data.prForm as 'masc' | 'femme' | 'x' | undefined),
      choices: [
        C('call', 'CALL HIM PERSONALLY (1¢)', { cost: 1, up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA', note: 'it can get worse' } }),
        C('space', 'GIVE HIM SPACE', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA', note: 'cold can freeze' } }),
      ],
    };
  },
  resolve: (key, ctx) => {
    const form = ctx.data.prForm as 'masc' | 'femme' | 'x' | undefined;
    const pr = ctx.s.prospects.find((x) => x.id === (ctx.data.prospectId as number));
    const g = (t: string): string => genderize(t, form);
    // the verdict drives the recruit's acting on the card
    const verdict = (v: 'good' | 'bad' | 'neutral'): void => { ctx.data.verdict = v; };
    if (key === 'call') {
      const t = tails(50, 10);
      if (t === 'up') {
        if (pr) pr.commitPct = clamp(pr.commitPct + 12, 0, 95);
        verdict('good');
        return { text: g(`You call. No staff, no script — twenty minutes about his jumper and his grandmother's cooking. By the end he's laughing. COMMITMENT +12: the lean comes back your way.`) };
      }
      if (t === 'down') {
        if (pr) { pr.commitPct = Math.max(0, pr.commitPct - 10); pr.bannedWeeks = Math.max(pr.bannedWeeks, 2); }
        verdict('bad');
        return { text: g(`You call — mid-dinner, at the rival program's recruiting dinner. His holo-agent declares a two-week NO CONTACT window, loudly, in front of everyone. COMMITMENT −10.`) };
      }
      if (pr) pr.commitPct = clamp(pr.commitPct + 5, 0, 95);
      verdict('good');
      return { text: g(`You call. It's polite. It's fine. It's a +5 kind of call — the freeze stops spreading, at least.`) };
    }
    const t = tails(10, 25);
    if (t === 'down') {
      if (pr) pr.commitPct = Math.max(0, pr.commitPct - 8);
      verdict('bad');
      return { text: g(`You give him space. The rival program gives him a highlight reel with his name in gold letters. COMMITMENT −8 — cold froze.`) };
    }
    if (t === 'up') {
      if (pr) pr.commitPct = clamp(pr.commitPct + 8, 0, 95);
      verdict('good');
      return { text: g(`You give him space — and the silence reads as confidence. His coach tells him "programs that beg, need." COMMITMENT +8.`) };
    }
    verdict('neutral');
    return { text: g(`You give him space. He keeps it. The board holds its breath on that name.`) };
  },
});

// ---- the commitment weather: recruits change their minds on their own --------
STORIES.push({
  id: 'commit_swing',
  kind: 'coach',
  weight: 2,
  when: (s) => s.prospects.some((pr) => !pr.signed && (pr.commitPct > 5 || pr.digits > 0)),
  beat: (_b, ctx) => {
    const pool = ctx.s.prospects.filter((pr) => !pr.signed);
    const pr = pool.length ? pick(pool) : null;
    ctx.data.prospectId = pr?.id ?? null;
    const up = Math.random() < 0.5;
    ctx.data.up = up;
    ctx.data.verdict = up ? 'good' : 'bad';
    ctx.data.alumForm = pr?.form;
    const name = pr?.name ?? 'A name on your board';
    const upLines = [
      `${name}'s cousin got into your school's astro-engineering program, and suddenly your campus is "family". The lean is coming YOUR way.`,
      `${name} caught your last game on a bar stream three systems over and reposted the final dunk with four exclamation points.`,
      `${name}'s coach played against your program once and lost, and has apparently never stopped talking about the gym.`,
    ];
    const downLines = [
      `${name} visited a rival campus "just to see it." There are photos. In one of them he's wearing their scarf.`,
      `${name}'s holo-agent has started saying "market value" in every sentence. A bigger program has entered the group chat.`,
      `${name} read a stream thread about your bench minutes and has QUESTIONS his coach can't answer.`,
    ];
    return {
      tag: 'THE RECRUITING TRAIL',
      text: pr ? pick(up ? upLines : downLines) : 'The trail is quiet this week. Suspiciously quiet.',
    };
  },
  resolve: (_k, ctx) => {
    const pr = ctx.s.prospects.find((x) => x.id === (ctx.data.prospectId as number | null));
    if (!pr) return { text: '' };
    const up = ctx.data.up === true;
    const d = 6 + rand(9);
    pr.commitPct = up ? clamp(pr.commitPct + d, 0, 95) : Math.max(0, pr.commitPct - d);
    return { text: up ? `${pr.name}: COMMITMENT +${d}.` : `${pr.name}: COMMITMENT −${d}.` };
  },
});

// ---- THE GROWTH SPURT: a body rewrites itself overnight ----------------------
STORIES.push({
  id: 'growth_spurt',
  kind: 'player',
  weight: 1,
  card: 'abilities',
  beat: (_b, ctx) => {
    const p = ctx.player!;
    const small = p.heightCm < 190;
    ctx.data.grow = small || (p.heightCm < 205 && Math.random() < 0.5);
    return {
      tag: 'THE GROWTH SPURT',
      text: ctx.data.grow
        ? `${p.name} reports to practice unable to fit through the door he fit through Friday. The team doctor measures him twice, then measures the chart. He has grown out of this world — jersey, shoes, position, all of it suddenly negotiable.`
        : `${p.name} reports to practice... shorter. Notably shorter. The team doctor blames "a gravity rebound thing" and refuses to elaborate. His whole game just moved closer to the floor.`,
    };
  },
  resolve: (_k, ctx) => {
    const p = ctx.player!;
    const grow = ctx.data.grow === true;
    if (grow) {
      p.heightCm += 24 + rand(14);
      p.weightKg += 25 + rand(20);
    } else {
      p.heightCm = Math.max(150, p.heightCm - (24 + rand(14)));
      p.weightKg = Math.max(40, p.weightKg - (20 + rand(15)));
    }
    return {
      text: grow
        ? `The new frame comes with new leverage. The equipment budget weeps; the frontcourt beckons. Check where he stands now — the columns read him differently.`
        : `Lower center of gravity, faster first step, a whole new angle on the game. Check where he stands now — the columns read him differently.`,
      fx: [{ playerId: p.id, ...(grow ? { attr: { frc: 1 } } : { attr: { ath: 1 } }), mood: grow ? 8 : -4 }],
    };
  },
});

// ---- THE CAMPUS GROWS: the ordered upgrade lands, one week later --------------
STORIES.push({
  id: 'facility_arrives',
  kind: 'coach',
  figure: 'janitor',
  beat: (_b, ctx) => {
    const fd = facilityById(ctx.data.facId as FacId);
    const nxt = Math.min(3, facLevel(ctx.s, fd.id) + 1);
    return { tag: '★ THE CAMPUS GROWS ★', text: `${fd.arrive}\n\n${fd.name} stands at LEVEL ${nxt}: ${fd.blurbs[nxt]}.` };
  },
  resolve: (_k, ctx) => {
    const id = ctx.data.facId as FacId;
    const s = ctx.s;
    const cur: Record<FacId, number> = { ship: 1, gym: 1, cryo: 1, library: 1, stadium: 1, greekrow: 1, ...(s.facilities ?? {}) };
    cur[id] = Math.min(3, (cur[id] ?? 1) + 1);
    s.facilities = cur;
    return { text: '' };
  },
});

// ---- THE CODEX pays out: a past career's speeches and tricks come back --------
STORIES.push({
  id: 'codex_recall',
  kind: 'coach',
  weight: 3,
  figure: 'assistant',
  when: (s) => !!s.codexPending && (s.codexPending.plans.length > 0 || s.codexPending.instrs.length > 0),
  beat: () => ({
    tag: 'YOU REMEMBER THE WORDS',
    text: 'Halfway through drawing up a play, your hand keeps going — old diagrams, old chants, whole speeches from another gym in another life.\n\nA coach keeps what a coach earns.',
  }),
  resolve: (_k, ctx) => {
    const s = ctx.s;
    const pend = s.codexPending;
    s.codexPending = undefined;
    if (!pend) return { text: '' };
    return {
      text: 'It all comes back.',
      fx: [
        ...pend.plans.map((p) => ({ unlockPlan: p }) as Fx),
        ...pend.instrs.map((i) => ({ unlockInstr: i }) as Fx),
      ],
    };
  },
});

// ---- THE LEADERS' season titles: one crown per stat --------------------------
STORIES.push({
  id: 'stat_title',
  kind: 'player',
  beat: (_b, ctx) => ({
    tag: `★ ${ctx.data.title as string} ★`,
    text: `${pname(ctx)} finishes the season as ${ctx.data.title}: ${ctx.data.line}, best in the league.\n\nThe trophy is a little ugly. Nobody cares. It's going in the case.`,
  }),
  resolve: () => ({ text: '', fx: [{ mood: 15, xp: 25 }, { legacy: 1 }] }),
});

// ---- the GOLDEN GOOSE EGG's tail: money without a name makes the papers ------
STORIES.push({
  id: 'goose_press',
  kind: 'coach',
  figure: 'scoop',
  beat: () => ({
    tag: 'THE GAZETTE GETS CURIOUS',
    text: 'Scoop is at your door holding a bank statement like a subpoena. "Six credits, coach. From NOBODY. I looked nobody up — nobody doesn\'t bank here." The recorder is already running.',
    choices: [
      C('friend', '"AN ANONYMOUS FRIEND OF THE PROGRAM"', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL', note: 'he keeps digging' } }),
      C('books', 'OPEN THE BOOKS — SHOW HIM EVERYTHING', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
    ],
  }),
  resolve: (key) => {
    if (key === 'books') {
      const t = tails(50, 5);
      if (t === 'down') return { text: 'You open every ledger. He finds a parking violation from three seasons ago and runs THAT instead. Journalism.', fx: [{ opP: -2 }] };
      return { text: 'You slide the whole ledger across the desk. He reads it twice, finds nothing, and prints a column about transparency with your name spelled correctly. High praise.', fx: [{ opP: 6 }] };
    }
    const t = tails(25, 25);
    if (t === 'down') return { text: '"A friend," he repeats, writing it down slowly enough to hurt. The follow-up piece has a question mark in the headline. Those are never good.', fx: [{ opP: -8 }] };
    if (t === 'up') return { text: 'He narrows every eye he has, then shrugs. "Program\'s got friends. That\'s a story too, I guess." It runs small, on page six.', fx: [{ opP: 2 }] };
    return { text: 'He doesn\'t buy it. He can\'t disprove it either. The piece runs neutral, itching between every line.', fx: [{ opP: -2 }] };
  },
});

export function storyById(id: string): StoryDef {
  const def = STORIES.find((st) => st.id === id);
  if (!def) throw new Error(`unknown story: ${id}`);
  return def;
}

/** The weekly random pool: player + coach stories with a weight. */
export function weeklyPool(s: GameState): StoryDef[] {
  return STORIES.filter((st) => st.weight && (!st.when || st.when(s)));
}

export const VOYAGE_POOL = ['vendor', 'bus_prospect', 'omen'];

/** THE REGULARS: the 30%-a-week rolls pick from these. */
export const DEAN_POOL = ['dean_visit', 'dean_audit'];
export const BOOSTER_POOL = ['booster_gift', 'booster_shortcut'];

/** Wheels up: the outbound leg is all nerves and aux-cable politics. */
export const TRAVEL_OUT_FLAVOR = [
  'The scouting report is taped to the cabin wall and somebody has already drawn a mustache on their center.',
  'The bus climbs out of the atmosphere on schedule. The starters sleep. The freshmen press their faces to the glass.',
  'Away game. The driver puts on the pregame playlist; it is one song, eleven hours long, and nobody complains.',
  'Everyone chews the same brand of gum on the climb out. Ritual is ritual.',
  'Departure is smooth. Somewhere behind you, your home arena shrinks to a bright dot with a scoreboard in it.',
];

/** Away weeks: most trips are just... space. The bus hums. */
export const TRAVEL_FLAVOR = [
  'Travel was uninspiring. The void between planets is famously boring; the team sleeps in shifts and argues about the aux cable.',
  'Eleven hours of warp. Somebody brought a deck of cards with 51 cards in it. The mystery of the missing card outlasts the trip.',
  'The team bus hits light speed on schedule for once. The driver takes the applause with one modest antenna.',
  'A quiet ride. The rookies watch the stars go by; the seniors have seen stars before and sleep like cargo.',
  'The autopilot plays smooth jazz for six parsecs. Nobody knows how to turn it off. The team arrives strangely calm.',
];
