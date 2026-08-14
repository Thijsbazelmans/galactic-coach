import type { AttrKey, Attrs, NewsEffect } from './types';
export type { NewsEffect };

export interface SpeciesDef {
  id: string;
  name: string;
  mods: Partial<Attrs>;
  /** hard ceiling per attribute — species define what's reachable */
  caps: Attrs;
  /** typical adult ranges: [min, max] */
  heightRange: [number, number];
  weightRange: [number, number];
  desc: string;
  /** which positions this species tends to supply */
  posNote: string;
  /** 0 = common, 1 = uncommon, 2 = far-region */
  rarity: number;
}

export const SPECIES: SpeciesDef[] = [
  {
    id: 'terran',
    name: 'Terran',
    mods: {},
    caps: { agi: 80, str: 80, han: 80, sho: 80, foc: 80, agg: 80, iq: 82, tou: 80 },
    heightRange: [185, 212],
    weightRange: [80, 115],
    desc: 'Baseline bipeds. Solid everywhere, spectacular nowhere — the galaxy simply outbuilds them.',
    posNote: 'any position',
    rarity: 0,
  },
  {
    id: 'hexabrach',
    name: 'Hexabrach',
    mods: { han: 10, agg: 8, tou: 4, agi: -6 },
    caps: { agi: 76, str: 90, han: 99, sho: 86, foc: 86, agg: 96, iq: 86, tou: 92 },
    heightRange: [195, 225],
    weightRange: [100, 140],
    desc: 'Six arms. The best hands in the galaxy, and four spares.',
    posNote: 'forwards & centers',
    rarity: 0,
  },
  {
    id: 'dodecapede',
    name: 'Dodecapede',
    mods: { agi: 14, foc: 4, str: -8 },
    caps: { agi: 99, str: 66, han: 90, sho: 84, foc: 94, agg: 84, iq: 88, tou: 78 },
    heightRange: [170, 195],
    weightRange: [58, 88],
    desc: 'Twelve legs, zero patience. Nothing in the league moves faster.',
    posNote: 'guards',
    rarity: 1,
  },
  {
    id: 'lithoid',
    name: 'Lithoid',
    mods: { str: 14, tou: 12, agg: 8, agi: -10, sho: -14 },
    caps: { agi: 62, str: 99, han: 70, sho: 48, foc: 84, agg: 96, iq: 80, tou: 99 },
    heightRange: [178, 205],
    weightRange: [140, 200],
    desc: 'Sentient rock. Stronger than everyone, forever. Shooting is a rumor to them.',
    posNote: 'centers',
    rarity: 1,
  },
  {
    id: 'luminar',
    name: 'Luminar',
    mods: { sho: 16, foc: 8, iq: 8, str: -12, agg: -6, tou: -8 },
    caps: { agi: 86, str: 52, han: 90, sho: 99, foc: 96, agg: 70, iq: 96, tou: 58 },
    heightRange: [190, 220],
    weightRange: [40, 62],
    desc: 'A being of coherent light. The purest jumper physics allows.',
    posNote: 'guards & wings',
    rarity: 2,
  },
];

export function speciesById(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}

// Eight programs. Real D1 colleges, renamed and relocated to fictional planets.
// bg = jersey/background color, fg = letter color. Deliberately varied — not everyone gets blue.
export const TEAM_TEMPLATES = [
  { name: 'Aurum Orsos', planet: 'Montalvo', region: 'Western Rim', bg: '#2D68C4', fg: '#F2A900' },
  { name: 'Voidfiends', planet: 'Duqat', region: 'Core Worlds', bg: '#2A0A4A', fg: '#E6D5FF' },
  { name: 'Skyhawks', planet: 'Kanzar', region: 'Central Plains Belt', bg: '#C8102E', fg: '#FFE9E9' },
  { name: 'Voidcats', planet: 'Kentaurus', region: 'Bluegrass Nebula', bg: '#1B4D3E', fg: '#C9F2E4' },
  { name: 'Star Heels', planet: 'Novacarina', region: 'Eastern Drift', bg: '#7BAFD4', fg: '#0B2537' },
  { name: 'Voidhounds', planet: 'Zagnar Prime', region: 'Northwest Expanse', bg: '#B33F00', fg: '#FFE1C9' },
  { name: 'Spartans', planet: 'Spartak IX', region: 'Great Lakes Cluster', bg: '#18453B', fg: '#A2E8C7' },
  { name: 'Cosmohounds', planet: 'Connexus', region: 'Eastern Drift', bg: '#4B0F1F', fg: '#F2C6CE' },
];

// Single names only: spacified deities and holy names from every tradition
// and era — Greek, Norse, Yoruba, Namibian, Catholic, Hindu, Mesoamerican,
// Shinto, Polynesian, Mesopotamian, Slavic, Celtic, Finnish, and beyond.
export const DEITY_NAMES = [
  // Greek & Roman
  'Zeuxx', 'Apollyx', 'Arex', 'Hermezz', 'Poseidrox', 'Hadez-9', 'Dionyzos',
  'Heliox', 'Kronoz', 'Atlazz', 'Jupiteron', 'Marz', 'Neptun-8', 'Vulkann', 'Mercurix',
  // Norse
  'Odynn', 'Thorr', 'Lokee', 'Baldyr', 'Heimdall-7', 'Tyrr', 'Freyr-X',
  // Egyptian
  'Ra-9', 'Anubix', 'Ozirix', 'Horuz', 'Thoth-3', 'Amunn', 'Sobekk',
  // Yoruba, Akan & wider Africa
  'Shangox', 'Ogunn', 'Olorunn', 'Eshuu', 'Obatala-2', 'Anansi-6',
  // Namibian & Southern African
  'Kalungaa', 'Mukurux', 'Huvee', 'Unkuluu', 'Modimoo', 'Nyambe-3',
  // Mesoamerican
  'Quetzal-4', 'Tezcatt', 'Kukulkan-6', 'Chaak', 'Huitzill',
  // Slavic & Baltic
  'Perunn', 'Velezz', 'Svarogg', 'Morozz', 'Perkunazz',
  // Celtic
  'Lughh', 'Dagdaa', 'Brann', 'Morrigann',
  // Shinto & East Asia
  'Raijinn', 'Fujinn', 'Susanoo-9', 'Inarix', 'Wukongg', 'Nezha-X',
  // Polynesian
  'Mauii', 'Tangaroa-3', 'Lono-2', 'Ku-Prime', 'Pele-7',
  // Mesopotamian
  'Mardux', 'Enkii', 'Enlyl', 'Ishtarr', 'Gilgamezz',
  // Hindu-derived
  'Indrax', 'Varunox', 'Agnix', 'Suryon', 'Hanumann-8',
  // Catholic & Christian holy names
  'Ignatiux', 'Xavyer', 'Benedix', 'Augustyn', 'Gabryel', 'Mikha-El',
  'Raffael-9', 'Uriyel', 'Domynic', 'Seraphym', 'Pyus-X', 'Aquinax',
  // Finnish & Arctic
  'Ukko-3', 'Vaino-7', 'Sednaa',
];

export const CLASS_NAMES = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
export const CLASS_ABBR = ['Fr', 'So', 'Jr', 'Sr'];

export interface EventChoiceDef {
  label: string;
  outcome: (playerName: string) => string;
  effect: NewsEffect;
  /** gamble: schedule a randomized payoff N weeks out */
  gambleDelay?: number;
  gamble?: { weight: number; text: (playerName: string) => string; effect: NewsEffect }[];
}

export interface EventDef {
  id: string;
  weight: number;
  text: (playerName: string) => string;
  choices?: EventChoiceDef[];
  auto?: {
    outWeeks?: number;
    outReason?: string;
    moodDelta?: number;
    weightDelta?: number;
    attrDeltas?: Partial<Attrs>;
    resolved: (playerName: string) => string;
  };
}

export const EVENTS: EventDef[] = [
  {
    id: 'blaster',
    weight: 2,
    text: (p) =>
      `${p} was cleaning his blaster in the dorm when it went off and took his shooting arm clean off at the shoulder. Campus medics report he is in stable condition and excellent spirits.`,
    auto: {
      outWeeks: 4,
      outReason: 'bio-lab (regrowing arm)',
      attrDeltas: { str: -6 },
      moodDelta: -8,
      resolved: () =>
        `He'll spend 4 weeks in a bio-lab tank while the new arm comes in. Strength takes a hit — the new arm ships factory-fresh, no muscle memory included.`,
    },
  },
  {
    id: 'cheating',
    weight: 3,
    text: (p) =>
      `${p} got caught cheating on his Intro to Asteroid Ethics midterm. The professor is furious. The athletic department is asking what you want to do about it.`,
    choices: [
      {
        label: 'Suspend him 2 weeks and make him retake it',
        outcome: (p) => `${p} sits two weeks and retakes the exam honestly. He passes with a C-. He is weirdly proud of the C-.`,
        effect: { integrityDelta: 8, outWeeks: 2, outReason: 'academic suspension', moodDelta: -5 },
      },
      {
        label: 'Lean on the professor. He plays.',
        outcome: () => `The grade quietly becomes a B. The professor now leaves the arena early whenever your team is winning.`,
        effect: { integrityDelta: -10 },
      },
    ],
  },
  {
    id: 'cheerleader',
    weight: 3,
    text: (p) =>
      `${p} comes to your office, pale. A cheerleader from Zeta Squadron is pregnant, and he's the father. He has no idea what to do and, for some reason, thinks you will.`,
    choices: [
      {
        label: 'Give him the week off to handle it like an adult',
        outcome: (p) => `${p} misses a game, goes to every appointment, and comes back more grown-up than he left. The team notices.`,
        effect: { integrityDelta: 7, outWeeks: 1, outReason: 'personal leave', moodDelta: 8 },
      },
      {
        label: '"Season first. Deal with it in the offseason."',
        outcome: (p) => `${p} stays in the lineup, but his head is somewhere else entirely. He's stopped eating properly, too.`,
        effect: { integrityDelta: -8, moodDelta: -15, weightDelta: -5 },
      },
    ],
  },
  {
    id: 'rampage',
    weight: 2,
    text: (p) =>
      `${p} lost his temper in a study group and put all five of his lab partners in the hospital. No fatalities — this is college, not the frontier — but the Dean wants blood. Metaphorically.`,
    choices: [
      {
        label: 'Two weeks out, mandatory anger-management pods',
        outcome: (p) => `${p} completes the pod program and hand-writes five apology letters. One lab partner frames theirs.`,
        effect: { integrityDelta: 8, outWeeks: 2, outReason: 'anger-management pods', moodDelta: 5 },
      },
      {
        label: '"His species is just like that." He plays.',
        outcome: () => `The Dean's office issues a statement calling your program "a disgrace with an excellent record." Boosters love the second half of that sentence.`,
        effect: { integrityDelta: -12 },
      },
    ],
  },
  {
    id: 'exchange',
    weight: 2,
    text: (p) =>
      `${p} has been selected for a prestigious 3-week academic exchange on the Scholar-Ring of Alexandria-One. It would be huge for his future. It would also be huge for your rotation, in the bad way.`,
    choices: [
      {
        label: "Let him go. It's college.",
        outcome: (p) => `${p} sends weekly holo-postcards. He comes back three weeks later measurably smarter and insufferable about it.`,
        effect: { integrityDelta: 10, outWeeks: 3, outReason: 'academic exchange', moodDelta: 10, attrDeltas: { iq: 4 } },
      },
      {
        label: "Deny the request. He's here to play.",
        outcome: () => `He says he understands. He does not understand. His advisor files a complaint.`,
        effect: { integrityDelta: -6, moodDelta: -12 },
      },
    ],
  },
  {
    id: 'holiday',
    weight: 4,
    text: (p) => {
      const fests = [
        'the High Festival', 'the Harvest Festival', 'the Moon-Hatching', 'Ancestor Week',
        'the Feast of the Second Sun', 'the Great Molting', 'Gravity Day', 'the Festival of a Thousand Cousins',
      ];
      const fest = fests[Math.floor(Math.random() * fests.length)];
      const lines = [
        `${p} is at your door with a packed duffel bag. It's ${fest} back on his home planet this week — every cousin, grandmother and hatchmate will be there. He wants to go home.`,
        `A shuttle ticket is already booked: ${fest} starts in two days on ${p}'s home planet, and his grandmother has, quote, "already cooked". He's asking permission, technically.`,
        `${p} hasn't missed ${fest} since he could walk on however many legs he has. His whole home planet shuts down for it. He's looking at you with all of his eyes.`,
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    },
    choices: [
      {
        label: 'Let him go. Family is family.',
        outcome: (p) => `${p} boards the long-haul shuttle with a smile you haven't seen since preseason. What comes back... we'll find out.`,
        effect: { integrityDelta: 5, outWeeks: 1, outReason: 'home for the High Festival' },
        gambleDelay: 1,
        gamble: [
          {
            weight: 2,
            text: (p) => `${p} is back from the Festival — on crutches. Traditional cliff-diving, third cousin's dare. The bio-lab says two more weeks.`,
            effect: { outWeeks: 2, outReason: 'festival cliff-diving injury', fitnessDelta: -20 },
          },
          {
            weight: 2,
            text: (p) => `${p} is back from the Festival... married. There are also, somehow, triplets. He keeps drifting off mid-drill to look at holos of them.`,
            effect: { moodDelta: -8, attrDeltas: { foc: -4 } },
          },
          {
            weight: 3,
            text: (p) => `${p} is back from the Festival glowing. Grandma's cooking, twelve naps, zero basketball. He looks five years younger.`,
            effect: { moodDelta: 22, fitnessDelta: 15 },
          },
          {
            weight: 2,
            text: (p) => `${p} is back from the Festival with six new abs. Apparently the ceremonial gravity-crunches are not ceremonial.`,
            effect: { attrDeltas: { str: 5, tou: 2 }, moodDelta: 8 },
          },
          {
            weight: 1,
            text: (p) => `${p} is back — and something's off. Time dilation on the pilgrimage route: he's been shooting on his uncle's hoop for three subjective years. His release is silk.`,
            effect: { attrDeltas: { sho: 6, foc: 3 }, moodDelta: 5 },
          },
        ],
      },
      {
        label: '"Playoffs are made in weeks like this." He stays.',
        outcome: (p) => `${p} nods and walks out without a word. His cousins send him a group holo from the Festival every night. He watches all of them.`,
        effect: { integrityDelta: -6, moodDelta: -14 },
      },
    ],
  },
  {
    id: 'diet',
    weight: 3,
    text: (p) =>
      `${p} has discovered the all-mineral diet of the Lithoid monks and wants to try it for a week. His plate at the training table is, at this moment, gravel.`,
    choices: [
      {
        label: 'Let him crunch. What could go wrong?',
        outcome: (p) => `${p} thanks you solemnly and salts a piece of granite. Results next week.`,
        effect: {},
        gambleDelay: 1,
        gamble: [
          {
            weight: 2,
            text: (p) => `The monk diet worked?? ${p} is denser somehow. The training staff refuses to explain the scale readout.`,
            effect: { attrDeltas: { str: 4, tou: 4 }, weightDelta: 6 },
          },
          {
            weight: 2,
            text: (p) => `${p} spent three days of the mineral week in the medical bay. Turns out he is not a Lithoid monk.`,
            effect: { fitnessDelta: -25, moodDelta: -6 },
          },
          {
            weight: 1,
            text: (p) => `${p} quit the mineral diet on day two and ate an entire celebration cake about it. He regrets nothing.`,
            effect: { weightDelta: 4, moodDelta: 10 },
          },
        ],
      },
      {
        label: 'Confiscate the gravel',
        outcome: (p) => `${p} sulks through practice. The monks send you a strongly-worded stone tablet.`,
        effect: { moodDelta: -6 },
      },
    ],
  },
  {
    id: 'streamer',
    weight: 2,
    text: (p) =>
      `${p} went viral on the galactic streams last night — 40 million views of him dunking over a parked shuttle. He now has a manager, a ring light, and opinions about "his brand".`,
    choices: [
      {
        label: 'Lean into it. Free publicity for the program.',
        outcome: (p) => `${p}'s follower count triples. So does the line outside the arena. He now signs autographs with a stage name.`,
        effect: { moodDelta: 12, attrDeltas: { foc: -3 } },
      },
      {
        label: 'Phones stay in lockers. Forever.',
        outcome: (p) => `${p} posts one final holo: a picture of his locker, captioned "the grind". His manager quits.`,
        effect: { moodDelta: -8, attrDeltas: { foc: 2 }, integrityDelta: 3 },
      },
    ],
  },
  {
    id: 'voidpup',
    weight: 2,
    text: (p) =>
      `${p} found a void-pup abandoned behind the arena and smuggled it into the dorms. It has too many teeth and it loves him unconditionally. Pets are, strictly speaking, forbidden.`,
    choices: [
      {
        label: 'The team has a mascot now',
        outcome: () => `The void-pup attends every practice from a courtside crate. Morale is illegal levels of high. It has eaten two whistles.`,
        effect: { moodDelta: 10, integrityDelta: -2 },
        gambleDelay: 2,
        gamble: [
          { weight: 2, text: (p) => `The void-pup has doubled in size and learned to fetch rebounds. ${p} is doing extra conditioning just chasing it.`, effect: { fitnessDelta: 10, moodDelta: 5 } },
          { weight: 1, text: (p) => `The void-pup phased through a wall into the Dean's office and unmade his desk. ${p} took the blame. There is paperwork.`, effect: { integrityDelta: -6, moodDelta: -4 } },
        ],
      },
      {
        label: 'Take it to the shelter',
        outcome: (p) => `${p} visits the shelter every day after practice. Every. Single. Day.`,
        effect: { moodDelta: -6, integrityDelta: 4 },
      },
    ],
  },
  {
    id: 'booster',
    weight: 2,
    text: (p) =>
      `A booster in a chrome suit "happens to run into" ${p} and offers him a personal off-books training pod, the kind pros use. Strictly against amateurism rules, obviously.`,
    choices: [
      {
        label: 'Report the booster to the league',
        outcome: () => `The league sends you a commendation hologram. The booster sends you a very cold holiday card.`,
        effect: { integrityDelta: 6 },
      },
      {
        label: 'Look the other way',
        outcome: (p) => `${p} comes back from "visiting his aunt" noticeably sharper. You ask no questions, which is itself an answer.`,
        effect: { integrityDelta: -9, attrDeltas: { sho: 3, han: 3 } },
      },
    ],
  },
];

// ---- weekly actions -------------------------------------------------------

export interface TrainingDef {
  id: string;
  name: string;
  attrs: [AttrKey, AttrKey];
  desc: string;
  scene: string[];
}

export const TRAINING_TYPES: TrainingDef[] = [
  {
    id: 'asteroid',
    name: 'ASTEROID PUSHES',
    attrs: ['str', 'tou'],
    desc: 'Push the practice asteroid up the gravity ramp. Builds strength and toughness, plus a healthy fear of gravity.',
    scene: ['Strapping in...', 'The asteroid does not want to move.', 'IT MOVES.'],
  },
  {
    id: 'laser',
    name: 'LASER DODGING',
    attrs: ['agi', 'foc'],
    desc: 'The training lasers are set to "sting". Footwork and focus, learned quickly.',
    scene: ['Lasers warming up...', 'pew pew pew', 'Only minor scorch marks today.'],
  },
  {
    id: 'horizon',
    name: 'EVENT-HORIZON SHOOTAROUND',
    attrs: ['sho', 'han'],
    desc: 'Shooting drills over a small captive black hole. If your handle is loose, the ball is simply gone.',
    scene: ['Deploying the tiny black hole...', 'Three balls lost to spacetime.', 'The stroke is looking pure.'],
  },
  {
    id: 'holofilm',
    name: 'HOLO-FILM STUDY',
    attrs: ['iq', 'foc'],
    desc: "Three hours in the holodeck watching last week's mistakes at life size. Painful. Effective.",
    scene: ['Dimming the lights...', 'Someone groans at their own turnover.', 'Notes were taken.'],
  },
  {
    id: 'mascot',
    name: 'MASCOT SPARRING',
    attrs: ['agg', 'tou'],
    desc: 'Three rounds of post defense against Boulder, the Lithoid mascot. Boulder does not go easy.',
    scene: ['Boulder cracks his knuckles. It takes a while.', 'Thud. Thud. THUD.', 'Everyone survived. Probably tougher now.'],
  },
];

export function trainingById(id: string): TrainingDef {
  return TRAINING_TYPES.find((t) => t.id === id) ?? TRAINING_TYPES[0];
}

export interface SchmoozeDef {
  id: string;
  name: string;
  desc: string;
  gain: [number, number]; // min..max commit %
  riskPct: number;
  riskText: (prospectName: string) => string;
  /** what the mishap does */
  riskIntegrity?: number;
  riskCommitDelta?: number;
  riskHalvesGain?: boolean;
  /** league no-contact order: can't schmooze this prospect for N weeks */
  riskBanWeeks?: number;
}

export const SCHMOOZE_METHODS: SchmoozeDef[] = [
  {
    id: 'dinner',
    name: 'Dinner at the Restaurant at the End of the Galaxy',
    desc: 'Twelve courses, a window seat for the apocalypse, zero discretion. Huge swing — if the league snoops don\'t spot you.',
    gain: [20, 30],
    riskPct: 25,
    riskText: (p) =>
      `League snoops photograph you and ${p} splitting the flambéed comet. An improper-benefits inquiry is opened, the maître d' sells the holos to the tabloids, and the league slaps you with a NO-CONTACT ORDER on ${p}.`,
    riskIntegrity: -8,
    riskHalvesGain: true,
    riskBanWeeks: 2,
  },
  {
    id: 'sorority',
    name: 'A night at the Kappa Kappa Nebula house',
    desc: 'The rowdiest house on campus shows him the time of his life. Usually.',
    gain: [12, 22],
    riskPct: 20,
    riskText: (p) =>
      `${p} gets caught in a brawl over somebody's cheerleader girlfriend and leaves with a black eye and second thoughts about your program.`,
    riskCommitDelta: -20,
  },
  {
    id: 'tour',
    name: 'Campus tour & cafeteria voucher',
    desc: 'Safe. Modest. The gravy-fries do most of the talking.',
    gain: [6, 12],
    riskPct: 0,
    riskText: () => '',
  },
];

export function schmoozeById(id: string): SchmoozeDef {
  return SCHMOOZE_METHODS.find((m) => m.id === id) ?? SCHMOOZE_METHODS[0];
}

export interface ScanDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  count: number;
  /** which species can turn up */
  pool: string[];
  qualityBonus: number;
  potentialBonus: number;
  riskPct: number;
  riskText: string;
  /** doesn't need the ship */
  local?: boolean;
}

export const SCAN_REGIONS: ScanDef[] = [
  {
    id: 'home',
    name: 'Scan the Home Planet',
    desc: 'Terrans, wall to wall. Reliable, cheap, and capped — a Terran never becomes a monster.',
    cost: 1,
    count: 2,
    pool: ['terran'],
    qualityBonus: 0,
    potentialBonus: 0,
    riskPct: 0,
    riskText: '',
    local: true,
  },
  {
    id: 'nebula',
    name: 'Scan the Local Nebula',
    desc: 'Hexabrach forwards, Dodecapede guards, Lithoid centers. Real specialists, mild turbulence.',
    cost: 2,
    count: 2,
    pool: ['hexabrach', 'dodecapede', 'lithoid'],
    qualityBonus: 3,
    potentialBonus: 3,
    riskPct: 10,
    riskText: 'A nebula squall cracks the scout-scoop. The ship is grounded — home-planet scouting only until next season.',
  },
  {
    id: 'outerrim',
    name: 'Scan the Outer Rim',
    desc: 'Luminar sharpshooters and the strangest specialists in known space. The micrometeorites are not a rumor.',
    cost: 3,
    count: 2,
    pool: ['luminar', 'hexabrach', 'dodecapede', 'lithoid'],
    qualityBonus: 6,
    potentialBonus: 6,
    riskPct: 25,
    riskText: 'A micrometeorite shreds the starboard scout-scoop on the way home. The ship is grounded — home-planet scouting only until next season.',
  },
  {
    id: 'deepcore',
    name: 'Scan the Deep Core',
    desc: 'The old charts were real. Every species, generational talent, gravity that eats ships.',
    cost: 3,
    count: 2,
    pool: ['terran', 'hexabrach', 'dodecapede', 'lithoid', 'luminar'],
    qualityBonus: 12,
    potentialBonus: 10,
    riskPct: 20,
    riskText: 'The Core swallows a stabilizer fin. The ship is grounded — home-planet scouting only until next season.',
  },
];

export function scanById(id: string): ScanDef {
  return SCAN_REGIONS.find((r) => r.id === id) ?? SCAN_REGIONS[0];
}

// Coach storylines: 1-2 questions, outcomes good / nothing / bad.
// These target the COACH (playerId null) and can unlock training methods & regions.
export interface CoachEventDef {
  id: string;
  text: string;
  when: (s: { unlockedTraining: string[]; unlockedRegions: string[]; week: number; energy: number }) => boolean;
  choices: {
    label: string;
    outcome: string;
    effect: NewsEffect;
    gambleDelay?: number;
    gamble?: { weight: number; text: string; effect: NewsEffect }[];
  }[];
}

export const COACH_EVENTS: CoachEventDef[] = [
  {
    id: 'seminar',
    text: 'An embossed holo-invitation: the Galactic Coaching Seminar on Blorgon 6, this week. Two days of drills, film, and lukewarm banquet food with the best minds in the game.',
    when: (s) => s.unlockedTraining.length < 5 && s.energy >= 2,
    choices: [
      {
        label: 'Attend (2⚡)',
        outcome: 'You pack a bag and catch the red-eye to Blorgon 6. Name tag, drill circuits, a keynote titled "The Post-Post Post Game".',
        effect: { energyDelta: -2 },
        gambleDelay: 1,
        gamble: [
          { weight: 3, text: 'The Blorgon 6 seminar paid off — a legendary assistant walked you through a whole new training method, step by step.', effect: { unlockTraining: true } },
          { weight: 1, text: 'The Blorgon 6 seminar was six hours of trust falls and a pyramid scheme about "vertical culture". You learned nothing.', effect: {} },
          { weight: 1, text: 'You caught Blorgon flu at the seminar buffet and sneezed through every session. The team spent the week worried about you.', effect: { teamMoodDelta: -5 } },
        ],
      },
      {
        label: 'Toss the invitation',
        outcome: 'You have games to win. The invitation folds itself into a paper shuttle and flies off, offended.',
        effect: {},
      },
    ],
  },
  {
    id: 'oracle',
    text: 'On the way back from a scouting run, your ship drops out of warp above an uncharted moon. On its surface: a single hut, a single light, and — your instruments insist — a single very old basketball hoop.',
    when: (s) => s.unlockedTraining.length < 5 && s.week > 2,
    choices: [
      {
        label: 'Land and knock',
        outcome: 'The door opens before you knock. "You are late," says the oracle, who has never met you.',
        effect: {},
        gambleDelay: 1,
        gamble: [
          { weight: 3, text: 'The oracle watched you shoot free throws for an hour, sighed, and taught you a training method your species has not invented yet.', effect: { unlockTraining: true } },
          { weight: 1, text: 'The oracle spoke only in riddles about "the pick and the roll within". You left with incense in your clothes and nothing else.', effect: {} },
          { weight: 1, text: 'The oracle\'s moon had opinions about your landing gear. The ship is grounded while parts ship from the Core.', effect: { shipDamage: true } },
        ],
      },
      {
        label: 'Stay in orbit and warp home',
        outcome: 'Some doors are better left unknocked. The hoop watches you leave.',
        effect: {},
      },
    ],
  },
  {
    id: 'starcharts',
    text: 'A retired scout sells memorabilia outside the arena. Between the pennants: a cracked datapad labeled "CORE ROUTES — DO NOT FLY". She wants your integrity, not your money: an endorsement of her dubious autobiography.',
    when: (s) => !s.unlockedRegions.includes('deepcore') && s.week > 4,
    choices: [
      {
        label: 'Endorse the book, take the charts',
        outcome: 'Your name now graces the back cover of "I Scouted The Void (And The Void Scouted Back)". The datapad hums to life.',
        effect: { integrityDelta: -5 },
        gambleDelay: 1,
        gamble: [
          { weight: 3, text: 'The charts are REAL. Deep Core routes, annotated in three languages. A whole new region opens on the scouting console.', effect: { unlockRegion: 'deepcore' } },
          { weight: 1, text: 'The charts are a menu from a noodle bar on Kanzar. A very good noodle bar, to be fair.', effect: { teamMoodDelta: 3 } },
        ],
      },
      {
        label: 'Decline politely',
        outcome: 'She shrugs and sells the datapad to the Voidfiends\' coach instead. You will think about this forever.',
        effect: {},
      },
    ],
  },
];

export const SCHMOOZE_SUCCESS_LINES = [
  (p: string, g: number, t: number) => `${p} has the time of his life. Commitment +${g}% → ${t}%.`,
  (p: string, g: number, t: number) => `${p} laughs at all your jokes, even the bad ones. +${g}% → ${t}%.`,
  (p: string, g: number, t: number) => `${p} leaves wearing one of your team caps. Where did he even get that? +${g}% → ${t}%.`,
  (p: string, g: number, t: number) => `${p} calls his mother from the shuttle home to talk about your program. +${g}% → ${t}%.`,
];

export const SCAN_FLAVOR_LINES = [
  'Scan complete. New prospects on the radar:',
  'The long-range array pings twice. Fresh names on the board:',
  'Your assistant slides two dossiers across the desk. New on the radar:',
  'The scout-scoop comes back full. On the board:',
];

export const REST_LINES = [
  'You cancel everything. The team sleeps, eats, floats in the recovery tanks, and remembers what legs are for.',
  'Spa week. The training facility echoes with the sound of absolutely nothing happening.',
  'You take the whole squad to the hot springs on the dark side of the moon. Everyone comes back loose.',
];

export const REST_MISHAPS = [
  (p: string) => `Of course, with all that free time, ${p} went lollygagging in a local crater on a borrowed grav-board and snapped his ankle. Two weeks.`,
  (p: string) => `Unsupervised, ${p} attempted to backflip off the dormitory roof into the recovery pool. He missed the pool. Two weeks.`,
  (p: string) => `${p} entered an unsanctioned asteroid-diving contest "for fun" and won second place and a fractured everything. Two weeks.`,
];

export const PROSPECT_BLURBS = [
  'Plays angry. Studies angrier.',
  'Homeschooled on a mining barge. Unbothered by crowds.',
  'Three-time intramural MVP of an orbital prep academy.',
  'His coach says he\'s "a project." His transcript says the same.',
  'Genuinely came for the education. Weird kid. Great motor.',
  'Grew four inches on the shuttle ride to the tryout.',
  'Left-handed. Well — left-handed six times over.',
  "Dean's list. Also, wanted in two systems for unpaid parking drones.",
];

export const WALKON_BLURBS = [
  'Won the halftime shooting contest twice. Insists that counts.',
  'Showed up to tryouts in jeans. Made every layup.',
  'The rec-center legend your assistant keeps mentioning.',
  'Filed the walk-on paperwork in crayon. Enthusiasm: elite.',
];
