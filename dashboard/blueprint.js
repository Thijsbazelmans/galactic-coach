// ============================================================================
// THE STORY WEB — v5.0 design blueprint (dictated Aug 24, 2026)
// ----------------------------------------------------------------------------
// The new model: stories are a modular, intertwined WEB. This file holds the
// vocabulary (trigger moments, characters, outcomes), the risk-sticker rules,
// and the seed modules. The BUILDER tab composes new modules from these
// pieces; drafts live in the browser (localStorage) until exported to Claude.
// NOT WIRED INTO THE GAME YET — the engine rework follows Thijs's GO.
// ============================================================================

const MODEL = {
  domains: [
    { key: 'job', name: "THE COACH'S JOB SECURITY", desc: 'School heat, booster heat, legacy, and the two terminal doors: FIRED and LOST TO THE VOID.' },
    { key: 'resources', name: "THE COACH'S ACTIONS & ITEMS", desc: 'Credits, the bag, knowledge (drills, speeches, instructions, star charts), the ship, the big board.' },
    { key: 'availability', name: "A PLAYER'S AVAILABILITY", desc: 'Injuries, suspensions, leaves, departures, arrivals. Who is in the building this week.' },
    { key: 'ability', name: "A PLAYER'S ABILITIES", desc: 'The four attributes, potential, levels, XP — and the live meters, mood and energy.' },
  ],
  dice: {
    faces: ['CATASTROPHE', 'BAD', 'NOTHING', 'GOOD', 'MIRACLE'],
    note: 'Every answer rolls exactly five outcomes, weights summing 100 (e.g. 2/5/84/8/1). Every face except NOTHING is either a DIRECT RESULT (from the outcome list) or a TRIGGER for another story module — optionally with a variable delay, so the player doesn\'t always know an event was an outcome of something earlier.',
  },
  laws: [
    'A story module only exists through its impact on the four domains. If it touches none of them, it\'s flavor, not a story.',
    'Outcome is always chance AND choice: no choice-free punishments, no roll-free rewards.',
    'Every module needs a trigger; every trigger is brought by a CHARACTER at a MOMENT. You meet different characters at different times and places.',
    'Choice UI shows ONE number — the chance of a good outcome (GOOD+MIRACLE) — plus a risk sticker. The five weights stay under the hood. The numbers still never lie; they just say less.',
    'Buttons are TERSE. The fun lines move to the AFTERMATH: choice → anticipation dialogue → THEN the result lands.',
    'NOTHING still gets a line. "The oracle hoos and haas for a full hour. Nothing happens, except now you\'re hungry." IS the nothing face.',
  ],
};

// ---- RISK STICKERS ----------------------------------------------------------
// Shown instead of full odds: GOOD% (G+M) + one sticker for the bad side.
// Thresholds are Claude's proposal — Thijs tunes.
const RISK = {
  rules: [
    { id: 'safe', label: 'safe', color: '#e5e7eb', test: 'CATASTROPHE+BAD ≤ 4' },
    { id: 'sure', label: 'sure?', color: '#fde047', test: 'CATASTROPHE+BAD ≤ 12' },
    { id: 'risky', label: 'risky', color: '#fb923c', test: 'CATASTROPHE+BAD ≤ 30' },
    { id: 'danger', label: 'DANGER', color: '#ef4444', test: 'CATASTROPHE+BAD > 30, or CATASTROPHE alone ≥ 10 (blinks)' },
  ],
  sticker(dice) {
    const bad = dice[0] + dice[1];
    if (bad > 30 || dice[0] >= 10) return 'danger';
    if (bad > 12) return 'risky';
    if (bad > 4) return 'sure';
    return 'safe';
  },
  good(dice) { return dice[3] + dice[4]; },
};

// ---- TRIGGER MOMENTS --------------------------------------------------------
// WHERE and WHEN a character can accost you. A module lists the moments it
// can spawn at; the engine rolls who shows up there.
const MOMENTS = [
  { id: 'weekstart', name: 'WEEK START', where: 'The building, Monday morning', desc: 'The report is read, the injured limp in, and somebody is already waiting outside your office.', cast: ['dean', 'press', 'equipment', 'player', 'janitor'] },
  { id: 'postgame', name: 'POST-GAME', where: 'The tunnel, right after the final horn (home games)', desc: 'Emotions are loud, quotes are quotable, and the Dean saw the whole thing from her seats.', cast: ['dean', 'press', 'cheerleader', 'booster', 'player'] },
  { id: 'ridehome', name: 'THE RIDE HOME', where: 'The bus, after away games', desc: 'The travel law: the vehicle speeds through the dark, one line ends in "…", and then the night decides.', cast: ['formerplayer', 'vendor', 'hermit', 'smuggler', 'player'] },
  { id: 'deepspace', name: 'DEEP SPACE', where: 'Outer-rim / deep-core searches and long away hauls', desc: 'Uncharted skies. The only place the strange ones live — oracles, goblin starbases, salvage rigs with payment plans.', cast: ['oracle', 'goblins', 'smuggler', 'attendant'] },
  { id: 'localtravel', name: 'LOCAL TRAVEL', where: 'Home-planet & nebula trips', desc: 'Fuel stops, transfer stations, rec-center gyms. Civilization, mostly.', cast: ['hermit', 'prospect', 'attendant', 'vendor'] },
  { id: 'practice', name: 'PRACTICE', where: 'The gym', desc: 'Sweat, drills, and whoever has keys to the building.', cast: ['player', 'xarter', 'janitor', 'equipment'] },
  { id: 'recruiting', name: 'RECRUITING TIME', where: 'The board, the visits, the dinners', desc: 'The booster\'s natural habitat. Families, promises, duffel bags.', cast: ['booster', 'prospect', 'formerplayer'] },
  { id: 'pregame', name: 'PREGAME', where: 'Matchup night, before tip-off', desc: 'The tape is watched, the whistle is for sale, the room wants a speech.', cast: ['booster', 'referee', 'press'] },
  { id: 'campus', name: 'CAMPUS', where: 'Anywhere on school grounds, during the week', desc: 'Where player stories live: dorms, classrooms, the training table, the stands.', cast: ['player', 'dean', 'cheerleader', 'janitor'] },
  { id: 'offseason', name: 'THE OFFSEASON', where: 'Departures, signing day, the summer', desc: 'Goodbyes, contracts, and old faces with new stories.', cast: ['formerplayer', 'dean', 'booster', 'prospect'] },
  { id: 'state', name: 'PRESSURE VALVES', where: '(condition-triggered, not a place)', desc: 'The world reacts to a number crossing a line: heat ≥50 / ≥75, credits at zero, a bench freeze at 4 DNPs, an empty locker, a level-up.', cast: ['dean', 'booster', 'press', 'smuggler', 'player'] },
  { id: 'chained', name: 'FROM ANOTHER STORY', where: '(an outcome triggered it)', desc: 'The web itself: a face on someone\'s die pointed here — instantly, or 1–5 weeks later so the causality stays hidden.', cast: ['(whoever the module names)'] },
];

// ---- CHARACTERS -------------------------------------------------------------
// The extendable cast. Every trigger is brought by one of these.
const CHARACTERS = [
  { id: 'dean', name: 'THE DEAN', color: '#4a9ed4', status: 'live', moments: ['weekstart', 'postgame', 'campus', 'state', 'offseason'], voice: 'The school made flesh. By the book, coffee for herself, requisition forms as leverage. Mother of Minervva. Talks to you right after games or at the start of a week.' },
  { id: 'booster', name: 'THE BOOSTER', color: '#f2a900', status: 'live', moments: ['recruiting', 'pregame', 'postgame', 'state'], voice: 'Chrome suit, cigar, plausible deniability. Usually materializes around recruiting time. His help is illegal and his ledger is invisible.' },
  { id: 'press', name: '“SCOOP” QUAZAR', color: '#a78bfa', status: 'live', moments: ['postgame', 'weekstart', 'pregame', 'state'], voice: 'The press. Fedora, antennae, a recorder that is always running. Asks about last week; pays for straight answers; prints everything.' },
  { id: 'oracle', name: 'THE ORACLE', color: '#67d8e8', status: 'live', moments: ['deepspace'], voice: 'A hut, a light, a very old hoop on an uncharted moon. Only found when you are truly far from home. Knows things she should not; charges in stranger currency than credits.' },
  { id: 'player', name: 'A PLAYER', color: '#4ade80', status: 'live', moments: ['campus', 'practice', 'weekstart', 'postgame', 'ridehome'], voice: 'The roster itself: festivals, diets, void-pups, viral dunks, benched hearts. Picked to fit the story (form-gates apply).' },
  { id: 'formerplayer', name: 'A FORMER PLAYER', color: '#94a3b8', status: 'live', moments: ['ridehome', 'offseason', 'recruiting', 'chained'], voice: 'Golden, fallen, or taken by the void. The program\'s past walking back in. Legacy moves when they do.' },
  { id: 'prospect', name: 'A PROSPECT', color: '#86efac', status: 'live', moments: ['recruiting', 'localtravel'], voice: 'A name on the board (or one that wants to be). Kids notice everything: silence, rec centers, the bottom row.' },
  { id: 'goblins', name: 'THE MECH-GOBLINS', color: '#fb923c', status: 'live', moments: ['deepspace', 'chained'], voice: 'Starbase repair crew. Cheap, "mostly honest", invoices engraved on small meteors. Once installed a hot tub nobody ordered.' },
  { id: 'smuggler', name: 'THE SMUGGLER CAPTAIN', color: '#f87171', status: 'live', moments: ['deepspace', 'ridehome', 'state'], voice: 'Answers distress calls with a jeweler\'s eye and a tractor beam. Debts here don\'t clear.' },
  { id: 'vendor', name: 'THE VENDOR', color: '#e879f9', status: 'live', moments: ['ridehome', 'localtravel'], voice: 'A coat lined with unlabeled miracles, unrolled at fuel stops. "For the discerning coach."' },
  { id: 'hermit', name: 'THE EXHAUST READER', color: '#7dd3fc', status: 'live', moments: ['localtravel', 'ridehome'], voice: 'Reads engine exhaust the way others read palms. (Candidate to fold into the Oracle\'s family.)' },
  { id: 'equipment', name: 'THE EQUIPMENT MANAGER', color: '#cbd5e1', status: 'live', moments: ['weekstart', 'practice'], voice: 'Leaves things on your desk with sticky notes. "found this. don\'t ask."' },
  { id: 'referee', name: 'THE REFEREE', color: '#fde047', status: 'live', moments: ['pregame'], voice: 'Loses wallets. Finds them courtside. Never breaks eye contact.' },
  { id: 'xarter', name: 'COACH XARTER', color: '#c084fc', status: 'live', moments: ['practice', 'chained'], voice: 'The mind-controlling trainer. Takes one pupil a year. Results guaranteed; side effects include biting.' },
  { id: 'cheerleader', name: 'THE HEAD CHEERLEADER', color: '#fb7185', status: 'new (Thijs)', moments: ['postgame', 'campus', 'pregame'], voice: 'Runs the loudest organization on campus that isn\'t yours. Knows every rumor two days early. Zeta Squadron connections.' },
  { id: 'attendant', name: 'THE GAS-PLANET ATTENDANT', color: '#5eead4', status: 'new (Thijs)', moments: ['localtravel', 'deepspace'], voice: 'Every fuel line in three systems, one attendant. Sees every team bus in the league pass through — and remembers the tips.' },
  { id: 'janitor', name: 'THE JANITOR', color: '#a3e635', status: 'new (Thijs)', moments: ['practice', 'weekstart', 'campus'], voice: 'Has keys to everything, including the gym at 4am. Has seen forty coaches come and go. Occasionally sweeps up the truth.' },
];

// ---- OUTCOMES ---------------------------------------------------------------
// The atomic results a die face can land. side: reward|punish. domain maps to
// MODEL.domains. trigger: what this outcome can itself set off (the web!),
// with the delay that hides the causality.
const OUTCOMES = [
  // -- rewards --
  { id: 'credits_up', name: '+ CREDITS (1–3¢)', side: 'reward', domain: 'resources', mech: 'coach currency', trigger: null },
  { id: 'item_gain', name: '+ ITEM', side: 'reward', domain: 'resources', mech: 'specific or rolled; supply / rare / legendary', trigger: 'the take-it-or-leave-it offer; a full bag → the bagfull scene' },
  { id: 'knowledge', name: '+ KNOWLEDGE', side: 'reward', domain: 'resources', mech: 'unlock a drill / speech / instruction', trigger: 'the reveal card' },
  { id: 'region', name: '+ STAR CHARTS', side: 'reward', domain: 'resources', mech: 'unlock a search region (deep core)', trigger: null },
  { id: 'heal', name: 'HEALED', side: 'reward', domain: 'availability', mech: 'injury erased or halved', trigger: null },
  { id: 'player_gain', name: '+ PLAYER (roster)', side: 'reward', domain: 'availability', mech: 'walk-on / gem / special / instant recruit', trigger: 'arrival stories; specials bring their own arcs (family seats 4w, droid probe 3w); a mid-season add can bump somebody → departure stories' },
  { id: 'board_add', name: '+ PROSPECT (board)', side: 'reward', domain: 'resources', mech: 'a new name on the big board', trigger: 'a full board forces a discard → the one you let go' },
  { id: 'board_reveal', name: 'PROSPECT REVEALED', side: 'reward', domain: 'resources', mech: 'facets or full truth', trigger: null },
  { id: 'commit_up', name: '+ COMMITMENT', side: 'reward', domain: 'resources', mech: 'a recruit leans in (+N%)', trigger: null },
  { id: 'attr_up', name: '+ ATTRIBUTE(S)', side: 'reward', domain: 'ability', mech: 'direct points, chosen or rolled', trigger: null },
  { id: 'pot_up', name: '+ POTENTIAL', side: 'reward', domain: 'ability', mech: 'the ceiling moves', trigger: null },
  { id: 'level_up', name: '+ LEVEL / XP', side: 'reward', domain: 'ability', mech: 'levels bank +2 coach-placed points', trigger: 'the level-up choice knocks at week start' },
  { id: 'mood_up', name: '+ MOOD', side: 'reward', domain: 'ability', mech: 'one player or the squad', trigger: null },
  { id: 'energy_up', name: '+ ENERGY', side: 'reward', domain: 'ability', mech: 'one player or the squad', trigger: null },
  { id: 'heat_down', name: '− HEAT', side: 'reward', domain: 'job', mech: 'school or booster side cools', trigger: 'cooling below 40 re-arms that side\'s interference' },
  { id: 'legacy_up', name: '+ LEGACY', side: 'reward', domain: 'job', mech: 'the career score climbs', trigger: null },
  // -- punishments --
  { id: 'injury_short', name: 'INJURY · 1 WEEK', side: 'punish', domain: 'availability', mech: 'a bad tweak', trigger: 'the injury storyline (heal / tape it up)' },
  { id: 'injury_mid', name: 'INJURY · 2–3 WEEKS', side: 'punish', domain: 'availability', mech: 'a real injury', trigger: 'the injury storyline' },
  { id: 'injury_long', name: 'INJURY · 4–6 WEEKS', side: 'punish', domain: 'availability', mech: 'a bio-lab stay; a level is lost', trigger: 'the injury storyline' },
  { id: 'suspended', name: 'SUSPENDED / ON LEAVE', side: 'punish', domain: 'availability', mech: 'N weeks out, non-medical', trigger: 'the return is news (CLEARED TO PLAY); leaves can schedule a return story' },
  { id: 'player_lost', name: 'PLAYER LOST', side: 'punish', domain: 'availability', mech: 'taken, quit, or gone — off the roster for good', trigger: 'THE EMPTY LOCKER now · former-player encounters later (delay: seasons)' },
  { id: 'mood_down', name: '− MOOD', side: 'punish', domain: 'ability', mech: 'one player or the squad; TENSE marks a hanging outcome', trigger: 'a cratered room can spiral into locker-room drama' },
  { id: 'energy_down', name: '− ENERGY', side: 'punish', domain: 'ability', mech: 'one player or the squad', trigger: 'an empty tank biases game-night injury rolls' },
  { id: 'attr_down', name: '− ATTRIBUTE / LEVEL', side: 'punish', domain: 'ability', mech: 'rare, story-only', trigger: null },
  { id: 'heat_up_s', name: '+ SCHOOL HEAT', side: 'punish', domain: 'job', mech: 'the league, the Dean, the senate', trigger: 'crossing 50 → THE SCHOOL INTERFERES · combined 75 → THE SUMMONS' },
  { id: 'heat_up_b', name: '+ BOOSTER HEAT', side: 'punish', domain: 'job', mech: 'the chrome suits lose patience', trigger: 'crossing 50 → THE BOOSTERS INTERFERE · combined 75 → THE SUMMONS' },
  { id: 'legacy_down', name: '− LEGACY', side: 'punish', domain: 'job', mech: 'the career score bleeds', trigger: null },
  { id: 'credits_loss', name: '− CREDITS', side: 'punish', domain: 'resources', mech: 'bills, bribes, tows', trigger: 'hitting ≤1¢ → THE BAILOUT · 0¢ stranded → THE DEBT LADDER' },
  { id: 'item_loss', name: '− ITEM / BAG WIPE', side: 'punish', domain: 'resources', mech: 'one item taken, or the whole bag sacrificed', trigger: null },
  { id: 'intel_wipe', name: 'INTEL WIPED', side: 'punish', domain: 'resources', mech: 'every prospect a stranger again', trigger: null },
  { id: 'commit_down', name: '− COMMITMENT / PROSPECT LEAVES', side: 'punish', domain: 'resources', mech: 'a recruit cools or walks', trigger: 'a walked star recruit can resurface on a rival (delay: next season)' },
  { id: 'grounded', name: 'SHIP GROUNDED', side: 'punish', domain: 'resources', mech: '3w (or 12w at the goblin base): home-planet scouting only', trigger: 'the goblin repair arc; weekly "almost done" beats' },
  { id: 'aging', name: '+1 CLASS YEAR', side: 'punish', domain: 'availability', mech: 'the registrar counts subjective years', trigger: 'an early graduation looms' },
  { id: 'gameover_fired', name: 'GAME OVER · FIRED', side: 'punish', domain: 'job', mech: 'the vote is short', trigger: '(terminal)' },
  { id: 'gameover_void', name: 'GAME OVER · LOST TO THE VOID', side: 'punish', domain: 'job', mech: 'the dark takes the bus', trigger: '(terminal)' },
];

// ---- SEED MODULES -----------------------------------------------------------
// The new format, live. faces: c/b/n/g/m; `tell` is the aftermath dialogue
// (anticipation first, results second); `fx` is the mechanics — outcome ids
// and `chain:<module> (+delay)` links. The web map parses the chain: links.
const SEED_MODULES = [
  {
    id: 'oracle_chosen', name: 'THE CHOSEN ONE', status: 'seed',
    character: 'oracle', moments: ['deepspace'],
    setup: 'Deep in uncharted space, the oracle\'s moon swings into view uninvited. She is already outside the hut, looking at your ship like it\'s late. "There is a chosen one," she says. "I can point the way."',
    choices: [
      {
        label: 'GO FIND THE CHOSEN ONE', cost: 0, dice: [2, 5, 84, 8, 1],
        faces: {
          c: { tell: 'She points one long finger — straight into a meteor field that is on no chart because no one has survived it to chart it. The hull screams. You make it to a rock in the middle of a nebula. The ship does not make it further.', fx: 'chain:meteor_crash (now)' },
          b: { tell: 'She asks for one drop of blood from your worst player, "to host the spirit of the chosen one." The cut takes. The spirit never comes. On the ride back the kid burns with an alien fever no medbay recognizes, and he does not make it home.', fx: 'player_lost → chain:empty_locker (now) · former-player-of-the-void encounters (delay: seasons)' },
          n: { tell: 'The oracle hoos and haas for a full hour. Nothing happens, except now you\'re hungry.', fx: '' },
          g: { tell: 'She shows you tape of her nephew. Grainy, sideways, shot through a window — and the kid is honestly pretty good. A name for the big board.', fx: 'board_add' },
          m: { tell: 'Her eyes roll white; your PILOT\'s eyes roll white. The ship flies itself three systems over to a dying planet where a five-star recruit is waiting at the landing pad, bag packed, like he knew. He joins the roster TODAY.', fx: 'player_gain (roster, 5★) · the roster squeeze can bump somebody → chain:alum_dark (delay: next season)' },
        },
      },
      {
        label: 'THANK HER AND KEEP FLYING', cost: 0, dice: [0, 2, 93, 5, 0],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'She watches your ship leave and says one word to the void. Your autopilot develops opinions for a week.', fx: 'energy_down (squad, small)' },
          n: { tell: 'You warp home. The hoop on her moon watches you go.', fx: '' },
          g: { tell: 'She nods once — approving, for reasons of her own, of a coach who knows which doors not to open. A coin flicks into your airlock.', fx: 'credits_up (+1¢)' },
          m: { tell: '', fx: '' },
        },
      },
    ],
  },
  {
    id: 'meteor_crash', name: 'DEAD ON A ROCK', status: 'seed',
    character: 'goblins', moments: ['chained'],
    setup: 'The ship is wreckage on a rock in the middle of a nebula. After six silent hours, a mech-goblin tow rig blinks closer — patient as a vulture with a payment plan.',
    choices: [
      {
        label: 'PAY 1¢ FOR THE TOW', cost: 1, dice: [0, 10, 60, 25, 5],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'They tow you — to THEIR starbase, where the repair estimate arrives engraved on a meteor with a lot of zeros on it.', fx: 'chain:goblin_repair (now, at their base)' },
          n: { tell: 'They haul you home sub-warp, whistling something in weld-sparks. The ship needs real work before it flies again.', fx: 'grounded (3w) · chain:goblin_repair (now)' },
          g: { tell: 'The tow crew patches the worst of it EN ROUTE, out of professional embarrassment. "Couldn\'t look at it," the foregoblin says.', fx: 'grounded (1w)' },
          m: { tell: 'Halfway home the rig detours through a derelict battle-fleet "for parts" and the goblins hand you a souvenir off a dead flagship, still warm.', fx: 'item_gain (rare)' },
        },
      },
      {
        label: 'REFUSE. FLAG SOMEONE DOWN.', cost: 0, dice: [15, 35, 45, 4, 1],
        faces: {
          c: { tell: 'Nobody comes. The nebula is beautiful and completely indifferent.', fx: 'gameover_void' },
          b: { tell: 'Someone answers. The lights come in slow, like teeth. It\'s a salvage rig — and you have nothing to pay with.', fx: 'chain:debt_ladder (now)' },
          n: { tell: 'A league patrol tug picks you up eleven hours later and lectures you about beacon protocol the entire ride home.', fx: 'grounded (3w)' },
          g: { tell: 'A freighter captain who played college ball two systems over tows you for free — for one autographed team cap and a story he can keep.', fx: 'grounded (1w)' },
          m: { tell: 'The first ship past is a luxury liner. The passengers adopt your stranded squad as the cruise\'s entertainment; you disembark rested, fed, and richer.', fx: 'credits_up (+2¢) · energy_up (squad)' },
        },
      },
    ],
  },
  {
    id: 'goblin_repair', name: 'THE GOBLIN REPAIR', status: 'seed',
    character: 'goblins', moments: ['chained', 'deepspace'],
    setup: 'The mech-goblins circle your broken ship, arguing in sparks. The foregoblin slides over on a magnet-skate: they can fix it. Cheap. "Mostly honest."',
    choices: [
      {
        label: 'LET THE GOBLINS FIX IT', cost: 0, dice: [0, 45, 5, 40, 10],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'They fail spectacularly. Your ship is grounded at THEIR base wearing half its engine, and they have installed a hot tub you did not order and cannot afford. Every week: a transmission that it\'s "almost done". There is laughing in the background.', fx: 'grounded (12w, 25%/week they finish)' },
          n: { tell: 'They fix exactly the parts that were broken and not one bolt more. Fair, eerily fair.', fx: 'credits_loss (−1¢)' },
          g: { tell: 'They swarm the hull, argue in sparks, and hand it back BETTER. The bill arrives next week engraved on a small meteor. They also left a mint.', fx: 'chain:goblin_bill (+1w, −3¢)' },
          m: { tell: 'They rebuild it with parts from something much, much faster. Nobody asks where the parts came from. The ship now hums a low note that makes dock officials nervous.', fx: 'ship flies NOW · item_gain (supply)' },
        },
      },
      {
        label: 'LIMP HOME YOURSELF', cost: 0, dice: [0, 5, 90, 5, 0],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'The maneuvering thrusters give out over your own arena. The landing is survivable and extremely public.', fx: 'grounded (4w) · heat_up_s (+3)' },
          n: { tell: 'Three weeks of thruster-crawl. The squad learns every card game in the galaxy.', fx: 'grounded (3w)' },
          g: { tell: 'A tail-wind nebula current carries you home early. The bus still smells like ozone, but it flies.', fx: 'grounded (2w)' },
          m: { tell: '', fx: '' },
        },
      },
    ],
  },
  {
    id: 'empty_locker', name: 'THE EMPTY LOCKER', status: 'seed',
    character: 'dean', moments: ['state', 'chained'],
    setup: 'One locker stands empty and the league does not care why: you need a ninth body by tip-off. The Dean appears in your doorway holding eligibility forms she has, somehow, already filled out. The candidates, such as they are:',
    choices: [
      {
        label: 'THE TRAINING-SQUAD WALK-ON', cost: 0, dice: [0, 0, 93, 5, 2],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: '', fx: '' },
          n: { tell: 'The training-squad kid gets the locker. He cries a little. He earned the right.', fx: 'player_gain (walk-on)' },
          g: { tell: 'The kid brings his entire rec-league fan club to his first game. Loudest section in the building.', fx: 'player_gain (walk-on) · mood_up (squad)' },
          m: { tell: 'In his first scrimmage he does something that makes your assistant drop the clipboard. A GEM. 1 in 50, and you WON it.', fx: 'player_gain (gem)' },
        },
      },
      {
        label: "THE DEAN'S DAUGHTER", cost: 0, dice: [0, 10, 85, 5, 0],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'Minervva signs — and the locker room does the math on the last name out loud, in the shower echo, where everything carries.', fx: 'player_gain (Minervva) · mood_down (squad) · chain:daughter_favor (+4w)' },
          n: { tell: 'Minervva signs the forms her mother happens to have on hand. She IS good. The Dean now attends every practice "as family".', fx: 'player_gain (Minervva) · heat_up_s (+5) · chain:daughter_favor (+4w)' },
          g: { tell: 'Minervva signs — and is better than the tape. The Dean\'s seats get closer to the bench every game and you genuinely do not mind yet.', fx: 'player_gain (Minervva, plays up a band) · chain:daughter_favor (+4w)' },
          m: { tell: '', fx: '' },
        },
      },
      {
        label: 'THE DROID A BOOSTER BUILT', cost: 0, dice: [0, 25, 65, 10, 0],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'UNIT-7 unfolds from a crate mid-practice, in front of a visiting league official who was here about parking.', fx: 'player_gain (UNIT-7) · chain:droid_probe (+1w)' },
          n: { tell: 'UNIT-7 unfolds from a crate with a jersey already on. Its jumper is perfect. Its blood is technically coolant. Species: "undeclared".', fx: 'player_gain (UNIT-7) · chain:droid_probe (+3w)' },
          g: { tell: 'UNIT-7\'s first practice ends with the entire squad trying to learn its release. It teaches, patiently, in metric.', fx: 'player_gain (UNIT-7) · xp (squad, small) · chain:droid_probe (+3w)' },
          m: { tell: '', fx: '' },
        },
      },
    ],
  },
  {
    id: 'alum_dark', name: 'THE FALLEN ONE', status: 'seed',
    character: 'formerplayer', moments: ['ridehome', 'offseason', 'chained'],
    setup: 'On the streets of Oblox-4, between the shuttle port and the arena, a voice: "Coach? ...Can you spare some money?" It\'s him. YOUR him. The galaxy has not been kind since.',
    choices: [
      {
        label: 'DINNER, CALLS, A COT (1¢)', cost: 1, dice: [0, 10, 60, 30, 0],
        faces: {
          c: { tell: '', fx: '' },
          b: { tell: 'He takes the help, then vanishes with the equipment-room petty cash. You make the second-hardest call and report it. It was still right to try.', fx: 'legacy_up (+1) · credits_loss (−1¢)' },
          n: { tell: 'Dinner, calls, a start. He texts you a photo of his first paycheck. You keep it.', fx: 'legacy_up (+2)' },
          g: { tell: 'A job title invented on the spot: "shooting consultant." Six weeks later he\'s upright, employed, and telling every recruit\'s family what kind of program this really is.', fx: 'legacy_up (+3) · commit_up (board-wide)' },
          m: { tell: '', fx: '' },
        },
      },
      {
        label: 'A COIN AND KEEP WALKING', cost: 0, dice: [25, 40, 30, 5, 0],
        faces: {
          c: { tell: 'A stream account catches the whole thing at 4K. The caption writes itself, and the school reads captions.', fx: 'legacy_down (−3) · heat_up_s (+10)' },
          b: { tell: 'You press a coin in his hand and keep walking. The arena lights are very bright tonight and you deserve none of them.', fx: 'legacy_down (−2) · mood_down (squad, small)' },
          n: { tell: 'You walk. You tell yourself you\'ll do something later. Later is a place you have never once visited.', fx: 'legacy_down (−1)' },
          g: { tell: 'You hate yourself into action by the corner — he\'s gone. You hire an investigator to find him. To be continued, you swear.', fx: '(open thread → chain:alum_dark (delay: 2–6w, second meeting)' },
          m: { tell: '', fx: '' },
        },
      },
    ],
  },
];
