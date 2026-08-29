// ============================================================================
// GALACTIC COACH — THE WRITERS' ROOM (design dashboard data)
// ----------------------------------------------------------------------------
// This file mirrors the live game content in src/engine/data.ts (+ trigger
// logic in state.ts). It is the DESIGN VIEW: plain language, organized for
// reading and tweaking. The game does NOT read this file — when you change
// something here (or scribble an idea), tell Claude and it gets wired into
// data.ts for real. Every entry carries its engine id so we can point at it.
//
// Synced against: v4.4.1 (SAVE_VERSION 19), Aug 24 2026.
// ============================================================================

// ---- THE ODDS LINE (the law of the land) -----------------------------------
const ODDS_LEGEND = {
  rungs: [2, 5, 10, 25, 50],
  note: 'Every chance in the game is one of five rungs. No bespoke odds, ever. A printed modifier may double a rung (the cause is always printed). Everything printed is true.',
  boons: {
    BREAKTHROUGH: 'growth: attributes, potential, levels, knowledge',
    SPIRIT: 'hearts: mood, team chemistry',
    WINDFALL: 'luck: credits, favors, the whistle leaning your way',
    LOOT: 'stuff: items for THE BAG',
    INTEL: 'truth: scouting reveals, prospect knowledge',
  },
  dangers: {
    INJURY: 'bodies: weeks out, level loss on the bad ones',
    DRAMA: 'hearts: mood craters, locker-room weather',
    SCANDAL: 'the league: school heat, investigations',
    SHIP: 'the ride: grounded weeks, stranded stories',
    DRAIN: 'the tank: credits or energy leak away',
  },
};

// ---- THE WEEK (where every story comes from) --------------------------------
const WEEK_FLOW = [
  {
    stop: 'GAME NIGHT (Sat)',
    what: 'The game runs on the lineup + the one pregame move. Empties everyone. 25+ points lights a player ON FIRE (+20% until under 12 pts or a night without minutes).',
    dice: [
      'Injury: a player can go down mid-game (landing wrong; an EMPTY TANK biases the roll against you)',
      'THE FROZEN ONE knocks at PLAY, not on a Monday: every player has a PATIENCE (2–6 games in street clothes); past it, a reserve meets you at the locker room door with tip-off minutes away',
      'THE NIGHT\'S INTERRUPTIONS: at the half the live game PAUSES for ON FIRE (25+ pts: LET HIM COOK = whole team +4–6 on the night, 30% a strain Monday · ROTATE = nothing) and an injury (SWAP HIM OUT = team −3–5 tonight · TAPE IT UP = no knock, 50% it doubles Monday). One per player, two per night; medical items appear as choices',
      'The frozen one\'s verdict and the morning-after beats are HELD until YOU WON / YOU LOST has been seen',
    ],
  },
  {
    stop: 'THE RIDE HOME (away games only)',
    what: 'THE TRAVEL LAW: every trip opens on the vehicle + one anticipation line ending in "…" — the next beat is relief or trouble.',
    dice: [
      'Flat broke (0¢): 10% → THE DEBT LADDER (salvage rig, ☠)',
      'Otherwise 25% → a VOYAGE story: if alumni exist, 10% of those become an ALUMNI encounter (void kid → ALUMNI OF THE VOID; else 50/50 golden/dark); otherwise the vendor / the bus kid / the omen',
      'Otherwise: plain travel flavor (one of 5 lines, uneventful)',
    ],
  },
  {
    stop: 'WEEK START (Mon)',
    what: 'The Monday report: weekend recovery per player (shrinks with start-streak), XP banks → LEVEL UP stories knock first, the injured tick down (returns announced as CLEARED TO PLAY).',
    dice: [
      'Scheduled future beats come due (promises, returns, probes, bills)',
      'HOT SEAT: heat ≥50 on a side → that side INTERFERES (once per crossing, re-arms when it cools below 40). Combined heat ≥75 → 50%/week THE SUMMONS (survive it or clean out your office)',
      'Weekly story roll: 1 story, +40% chance of a second (weighted pool below). UT weeks skip all of this',
      '“SCOOP” QUAZAR: 30% (only if a game was played) — a press question about LAST week; THE NOTEBOOK answers it for you if you noted it',
      'THE DEAN drops by: 30% (visit or audit) · THE BOOSTER calls: 30% (gift or shortcut) — independent rolls; some weeks all three, some weeks none',
      'THE SUPPLY CLOSET: 50% — a small single-use item is offered (take it or leave it)',
      'EMPTY POCKETS: credits ≤1 → the dean / the booster / Scoop offers a bailout with strings',
    ],
  },
  {
    stop: '1 · SCOUTING',
    what: 'One board-wide move: SEARCH the galaxy (regions shift WHO you find, never how good) or read THE BIG BOARD (intensity pyramid: cheap reads all 9, dear goes deep on the 3 TARGETS).',
    dice: [
      'Search, flat broke (0¢, off-world): 10% → THE DEBT LADDER (gravity snare)',
      'Search down-roll: 50/50 → HULLBREACH (dossiers spill into the void) or GROUNDED (mech-goblins offer a deal)',
      'Search up-roll: LOOT floating in a debris field, or a free first read',
      'Rec-center down-roll: kids notice where you went looking — a prospect walks or a player takes it personally (−15 mood)',
      'Scout down-roll: SCANDAL (workout), SHIP (road trip) or DRAIN (film night)',
      'Scout up-roll: one prospect does the ONE thing — locked cold (full reveal)',
    ],
  },
  {
    stop: '2 · PRACTICE',
    what: 'Mandatory. Three families: TRAIN (XP → levels bank +2 points YOU place) · SHARPEN (direct points / ceiling work) · RECOVER (meters back). Under 40 energy sits out automatically.',
    dice: [
      'Drill down-roll → INJURY (severity rolled separately: <45 a 1-week tweak · <75 a 2–3 week real one · else 4–6 weeks bio-lab + a level lost; tier-3 glass bodies roll 1.4×) or DRAMA — with the drill\'s own printed cause line',
      'Drill up-roll → ★ BREAKTHROUGH ★ (ceiling +6 or a free level, 50/50)',
    ],
  },
  {
    stop: '3 · RECRUITING',
    what: 'One board-wide move: your own honest work (safe, modest, sincere) or THE BOOSTER\'S HELP (huge swings, printed scandal odds, plausible deniability — his name is on it, mostly).',
    dice: [
      'Per-prospect risk roll: the night backfires on that name (−max gain commit)',
      'Down-roll: SCANDAL (booster: 50% he eats it himself — +8 booster heat, no story) or DRAMA (jersey-number fight)',
      'Up-roll: the night goes LEGENDARY — +5% across the board',
      'Weekly decay: commitment −2 (TARGETS/BACKUPS), −4 on the LAST RESORTS row — kids notice silence twice as fast down there',
    ],
  },
  {
    stop: '4 · MATCHUP (pregame)',
    what: 'Mandatory, once: a SPEECH (a guaranteed TRADE — squad +3–4 in one attribute, −3–4 in its opposite — or THE RALLY: a coin flip on morale, or TAKE IT EASY: −40% burn, softer play) or LAST-MINUTE INSTRUCTIONS (given now, resolved at tip-off). Then tune the lineup until the bars lean your way; every card\'s letter is what he\'s worth in the slot he stands in, and the label names where he belongs.',
    dice: [
      'Speech: work% → squad +1..3 in the attr · ignite% → +3/+4 · down% → one believer stops believing (−25 mood)',
      'Instructions: hit% → their best attr −3..5 tonight · backfire% → YOUR best attr plays down — and THE CAPTAIN\'S ORDER caught = the league reviews the tape next Monday',
    ],
  },
  {
    stop: 'SEASON EDGES',
    what: 'Weeks 10+1 … 10+3: THE BIG BANG (no weekly stories; wheels-up + the round\'s own beat — pomp and scouting report in one). Making it / missing it / going out / winning it each get their own dialogue (confetti where earned). Then departures (pros leave at 72+ OVR, seniors graduate into the alumni pool), signing day — one holo-call per name, the wheel decides, the card shows the whole truth — the summer.',
    dice: [
      'THE ONE YOU CUT: every player discarded at the roster cut schedules a revenge/thank-you beat 2–6 weeks into the season',
      'Offseason: 10% an alumni encounter finds you',
      'Season 21+: the stipend erodes — mortality is a bill',
    ],
  },
];

// ---- STORY FAMILIES ---------------------------------------------------------
// fam keys used below, in display order.
const STORY_FAMILIES = [
  { key: 'weekly', name: 'THE WEEKLY POOL', blurb: 'College happens to people weekly: 1 roll + 40% a second, weighted. A player story picks a healthy player (form-gated where marked); a coach story just knocks.' },
  { key: 'regulars', name: 'THE REGULARS', blurb: 'The dean (by the book) and the booster (illegal help, deniable) drop by even when nothing burns — 30% each per week. The press keeps you honest at the same rate.' },
  { key: 'class', name: 'CLASS POOLS', blurb: 'The landing zones for the printed odds tails. Any INJURY/DRAMA/SCANDAL/BREAKTHROUGH roll, from any source, arrives through one of these — the SOURCE owns the cause line, the CLASS owns the storyline.' },
  { key: 'system', name: 'GROWTH & SYSTEM', blurb: 'Stories the engine itself raises: level-ups, the frozen bench, the cut that comes back around.' },
  { key: 'hotseat', name: 'THE HOT SEAT', blurb: 'State-triggered, never random: cross a heat line and the powers that be walk in. The ladder ends in the long room with the long table.' },
  { key: 'ship', name: 'THE SHIP & THE DEBT', blurb: 'Setbacks are DOORS: a cracked hull is a goblin deal, an empty wallet is a smuggler negotiation, an empty locker is three strange candidates.' },
  { key: 'voyage', name: 'VOYAGES & ALUMNI', blurb: 'The road home rolls: strange encounters at fuel stops, and the players you used to coach — golden, fallen, or taken by the void.' },
  { key: 'knowledge', name: 'KNOWLEDGE', blurb: 'How the coach learns: locked drills, premium speeches, strange instructions, deep-core star charts. Gated on there being something left to learn.' },
  { key: 'echo', name: 'ECHO BEATS', blurb: 'Scheduled payoffs with no (or one) choice: bills come due, probes land, returns land. These are what futureBeats deliver.' },
  { key: 'plumbing', name: 'SYSTEM DIALOGS', blurb: 'The connective tissue: item offers, reveals, travel cards, notices. Not really stories — but their language is still voice.' },
];

// ---- THE STORIES ------------------------------------------------------------
// Fields: id (data.ts), fam, name, who ('player'|'coach'), weight (weekly pool
// weight; absent = not in the weekly roll), forms (player-form gate), when
// (extra gate), trigger (how it fires), beats [{key, setup, choices}], where
// choices = {label, cost¢, up, down, want, out: {up, mid, down, ...}} — up/down
// are the PRINTED tails, out are the actual outcomes. follow/chain = spacing.
const STORIES = [

  // ================= THE WEEKLY POOL =================
  {
    id: 'festival', fam: 'weekly', name: 'THE PACKED DUFFEL / THE FESTIVAL', who: 'player', weight: 4,
    trigger: 'Weekly roll (heaviest weight in the pool).',
    beats: [
      {
        key: 'start', setup: 'He\'s at your door with a packed duffel bag, asking for time off. He hasn\'t said why.',
        choices: [
          { label: '"SURE." (ask nothing)', up: '5% SPIRIT', down: '10% DRAMA', want: 'love', out: { up: 'He hugs you. He has never hugged anything. (+18 mood, 1w leave)', mid: 'You sign the slip. (+5 mood, 1w leave)', down: '"He didn\'t even ask." It didn\'t land the way you meant it. (−10 mood, 1w leave)' } },
          { label: '"WHY?"', up: '50% SPIRIT', down: '25% DRAMA — doubles if he\'s FIERCE (14+), and the cause is printed', out: { up: 'He softens: it\'s a festival back home → jumps to the ASK beat, now you\'re negotiating', mid: '"Just... home stuff." You sign, don\'t push. (1w leave, +3 mood) — unless he has BRAINS 14+: 25% he lies smoothly. There was no family thing. There was a music festival. (+8 mood)', down: 'His jaw sets. "Forget it." The door doesn\'t quite slam, which is worse. (−12 mood)' } },
        ],
      },
      {
        key: 'ask', setup: 'It\'s [festival name] on his home planet — the whole world shuts down for it. He wants TWO WEEKS. He\'s looking at you with all of his eyes.',
        choices: [
          { label: 'TWO WEEKS. SEE THE COUSINS.', up: '10% SPIRIT', down: '10% INJURY', want: 'love', out: { mid: 'He boards the long-haul shuttle smiling. (2w out, +10 mood, tense until the return)' } },
          { label: '"ONE WEEK. BRING ME LEFTOVERS."', up: '5% SPIRIT', down: '25% DRAMA', out: { mid: 'He negotiates hard, settles, promises leftovers. (1w out, +4 mood)', down: 'His hatch-brother calls to say the family "noticed the discount." (−8 extra mood)' } },
          { label: 'PLAYOFFS ARE MADE IN WEEKS LIKE THIS.', up: '2% BREAKTHROUGH', down: '25% DRAMA', want: 'hate', out: { up: 'He channels it — every drill personal. You feel a little bad about how well this worked. (−6 mood, +12 XP)', mid: 'He stays. Professionally cold. (−10 mood)', down: 'The cousins group-holo every night. He watches all of them. (−16 mood)' } },
        ],
      },
    ],
    follow: 'Leaving schedules THE RETURN (below) for the week after he\'s back.',
    chain: 'festival_return',
  },
  {
    id: 'festival_return', fam: 'weekly', name: 'THE RETURN (festival payoff)', who: 'player',
    trigger: 'Scheduled: fires 1 week after the festival leave ends. No choice — the trip already happened; this is the reveal.',
    beats: [
      {
        key: 'start', setup: 'Rolled outcome table (the whole story is the dice):',
        choices: [
          { label: '15% — back ON CRUTCHES: traditional cliff-diving, third cousin\'s dare (+2w out, −20 energy)' },
          { label: '15% — back MARRIED. There are, somehow, triplets. (−6 mood, +1 BRN)' },
          { label: '35% — back GLOWING: grandma\'s cooking, twelve naps. (+22 mood, +20 energy)' },
          { label: '20% — back with SIX NEW ABS: ceremonial gravity-crunches. (+2 ATH, +8 mood)' },
          { label: '13% — TIME DILATION on the pilgrimage route: three subjective years on his uncle\'s hoop. His release is silk. (+30 XP)' },
          { label: '2% — TRANSFORMED. The elders saw something in him and told him what it was. 1 in 50, and you WON it. (+8 potential, +15 mood)' },
        ],
      },
    ],
  },
  {
    id: 'diet', fam: 'weekly', name: 'THE MINERAL DIET', who: 'player', weight: 3,
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'He\'s discovered the all-mineral diet of the Petran monks. His plate at the training table is, at this moment, gravel.',
        choices: [
          { label: 'LET HIM CRUNCH', up: '25% BREAKTHROUGH', down: '25% INJURY', want: 'love', out: { up: 'The monk diet WORKED?? He is denser somehow. The monks send a care package. (+2 ATH, +6kg, +5 mood, +protein bars)', mid: 'He quit on day two and ate an entire celebration cake about it. Regrets nothing. (+10 mood, +3kg)', down: 'Three days of mineral week in the medical bay. He is not a Petran monk. (−30 energy, −6 mood, 1w out)' } },
          { label: 'CONFISCATE THE GRAVEL', up: '2% SPIRIT', down: '10% DRAMA', want: 'hate', out: { up: 'He accepts defeat with visible relief. He just wanted someone to stop him. (+5 mood)', mid: 'The gravel goes in a drawer. The drawer now rattles when the team bus passes. (−4 mood)', down: 'He sulks. The monks send a strongly-worded stone tablet. (−8 mood)' } },
        ],
      },
    ],
  },
  {
    id: 'cheating', fam: 'weekly', name: 'THE ASTEROID ETHICS MIDTERM', who: 'player', weight: 3, context: 'academic',
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'Caught cheating on his Intro to Asteroid Ethics midterm. The professor is furious. The athletic department asks what you want done.',
        choices: [
          { label: 'SUSPEND HIM 2 WEEKS, RETAKE IT HONESTLY', up: '10% SPIRIT', down: '2% DRAMA', want: 'hate', out: { up: 'He passes with a C- and is weirdly proud of it. The whole team studies harder for a month. (2w out, −8 school heat, +5 team mood)', mid: 'The professor nods at you in the corridor. The school notices. (2w out, −8 heat)', down: 'He blames you for every minute of the two weeks. (extra −6 mood)' } },
          { label: 'LEAN ON THE PROFESSOR. HE PLAYS.', up: '5% WINDFALL', down: '25% SCANDAL', want: 'love', out: { up: 'The grade becomes a B. The professor gets a parking spot. Everyone is bought and nobody is happy, but he PLAYS. (+8 heat)', mid: 'The professor now leaves the arena early whenever your team is winning. (+8 heat)', down: 'Two weeks later the professor loudly becomes a whistleblower → CHAINS into THE LEAGUE CALLS (scandal) with the grade-change as cause. (+10 heat first)' } },
        ],
      },
    ],
    chain: 'scandal (on the down tail)',
  },
  {
    id: 'cheerleader', fam: 'weekly', name: 'THE CHEERLEADER (a baby is coming)', who: 'player', weight: 3,
    trigger: 'Weekly roll. Femme-aware: the text flips if the player is the pregnant one.',
    beats: [
      {
        key: 'start', setup: 'He comes to your office, pale. A cheerleader from Zeta Squadron is pregnant, and he\'s the father. (Femme version: she\'s pregnant, and the season has never looked longer.) For some reason they think you\'ll know what to do.',
        choices: [
          { label: 'A WEEK OFF. HANDLE IT LIKE AN ADULT.', up: '25% SPIRIT', down: '2% DRAMA', want: 'love', out: { up: 'Misses a game, attends every appointment, comes back more grown-up than he left. The team talks about it quietly and well. (1w out, +10 mood, +2 BRN, +5 team mood, −4 heat)', mid: 'Takes the week, handles his business, comes back steadier. (1w out, +8 mood, +1 BRN)', down: 'Comes back with MORE questions. You are apparently the godparent now? There was no form for this. (1w out, +3 mood)' } },
          { label: '"SEASON FIRST. OFFSEASON PROBLEM."', up: '2% WINDFALL', down: '50% DRAMA', want: 'hate', out: { up: 'He somehow compartmentalizes. You have created a professional. You are not sure you\'re proud. (−5 mood, +1 BRN, tense)', mid: 'He plays on, hollow-eyed. The scoreboard doesn\'t know. Everyone else does. (−12 mood, tense)', down: 'He\'s stopped eating properly. Zeta Squadron now boos your bench, specifically. (−18 mood, −4kg, +5 heat, tense)' } },
        ],
      },
    ],
    follow: 'EITHER WAY the baby arrives: THE NEWBORN is scheduled 6–9 weeks out.',
    chain: 'newborn',
  },
  {
    id: 'newborn', fam: 'weekly', name: 'THE NEWBORN (the long arc pays off)', who: 'player',
    trigger: 'Scheduled 6–9 weeks after THE CHEERLEADER, whatever you chose.',
    beats: [
      { key: 'start', setup: 'The baby is HERE — loud, healthy, already palming a plush basketball. The whole squad crowds the projection (or fills the medbay hallway in pajamas).', choices: [ { label: '(no choice — a jersey the size of a sock appears in the locker, squad-stitched. Some seasons hand you a banner. This one handed you this.) (+15 mood, +6 team mood; femme version: +1w leave)' } ] },
    ],
  },
  {
    id: 'rampage', fam: 'weekly', name: 'THE STUDY-GROUP RAMPAGE', who: 'player', weight: 2, context: 'discipline',
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'He lost his temper in a study group and put all five lab partners in the hospital. No fatalities — this is college, not the frontier — but the Dean wants blood. Metaphorically.',
        choices: [
          { label: 'TWO WEEKS OUT, ANGER-MANAGEMENT PODS', up: '10% SPIRIT', down: '2% DRAMA', want: 'hate', out: { up: 'Five hand-written apology letters; one gets framed. He comes back with a stillness that frightens opponents more than the temper did. (2w out, +2 BRN, −8 heat, +8 mood)', mid: 'Pod time served, letters written, Dean stands down. (2w out, +2 BRN, −8 heat)' } },
          { label: '"HIS SPECIES IS JUST LIKE THAT." HE PLAYS.', up: '5% WINDFALL', down: '25% SCANDAL', want: 'love', out: { up: 'He plays FURIOUS. The boosters send a fruit basket shaped like a fist. (+8 heat, −8 booster heat, +5 mood, +protein bars)', mid: 'The Dean starts attending your games just to glare. (+10 heat)', down: '"A disgrace with an excellent record." → CHAINS into THE LEAGUE CALLS with the thick folder. (+15 heat first)' } },
        ],
      },
    ],
    chain: 'scandal (on the down tail)',
  },
  {
    id: 'exchange', fam: 'weekly', name: 'THE SCHOLAR-RING EXCHANGE', who: 'player', weight: 2,
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'Selected for a prestigious 3-week academic exchange on the Scholar-Ring of Alexandria-One. Huge for his future. Also huge for your rotation, in the bad way.',
        choices: [
          { label: "LET HIM GO. IT'S COLLEGE.", up: '25% BREAKTHROUGH', down: '2% DRAMA', want: 'love', out: { up: 'Returns measurably smarter and insufferable about it — and brought you something from their observatory. (3w out, +10 mood, −6 heat, +2 BRN, +STARLIGHT TELESCOPE)', mid: 'Returns with a Scholar-Ring hoodie he never takes off. (3w out, +1 BRN, −6 heat)', down: 'He loves it there SO much. His postcards start mentioning "options". You sleep worse. (3w out, +5 extra mood)' } },
          { label: "DENY IT. HE'S HERE TO PLAY.", up: '2% WINDFALL', down: '25% DRAMA', want: 'hate', out: { up: '"Next cycle," he says, and buries himself in film. (−3 mood, +8 XP)', mid: 'He nods, once. The word "no" sits between you for the rest of the season. (−8 mood)', down: 'His advisor files a complaint with the school. (−12 mood, +8 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'streamer', fam: 'weekly', name: 'THE VIRAL DUNK', who: 'player', weight: 2,
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: '40 million views of him dunking over a parked shuttle. He now has a manager, a ring light, and opinions about "his brand".',
        choices: [
          { label: 'LEAN INTO IT. FREE PUBLICITY.', up: '10% WINDFALL', down: '25% DRAMA', want: 'love', out: { up: 'Follower count triples, so does the season-ticket line. A sponsor crate arrives for THE BAG. (+12 mood, −10 booster heat, +HYPE MIXTAPE)', mid: 'Practice attendance: perfect. Practice focus: negotiable. (+10 mood)', down: 'He signs autographs with a stage name and reviews his own highlights during film study. The locker room has opinions too. (+8 mood, −1 BRN, −6 team mood)' } },
          { label: 'PHONES STAY IN LOCKERS. FOREVER.', up: '10% BREAKTHROUGH', down: '10% DRAMA', want: 'hate', out: { up: 'Freed from the algorithm, he has the best practice week of his life. (−3 mood, +12 XP)', mid: 'The ring light goes on a shelf, pointed at nothing, like a lighthouse for a sea that left. (−5 mood, +5 XP)', down: 'One final holo — his locker, captioned "the grind" — then a week of sulking. His manager quits via skywriting. (−10 mood)' } },
        ],
      },
    ],
  },
  {
    id: 'voidpup', fam: 'weekly', name: 'THE VOID-PUP', who: 'player', weight: 2,
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'He found a void-pup abandoned behind the arena and smuggled it into the dorms. It has too many teeth and it loves him unconditionally. Pets are, strictly speaking, forbidden.',
        choices: [
          { label: 'THE TEAM HAS A MASCOT NOW', up: '25% SPIRIT', down: '10% SCANDAL', want: 'love', out: { up: 'It learns to fetch rebounds. Morale is illegal levels of high. It has eaten two whistles — and dug up something shiny for THE BAG. (+12 team mood, +5 energy, +item)', mid: 'The void-pup becomes furniture with teeth. The team is 30% happier and 100% more bitten. (+10 team mood)', down: 'It phased through a wall into the Dean\'s office and unmade her desk. He took the blame. There is paperwork. (+5 team mood, +10 heat)' } },
          { label: 'TAKE IT TO THE SHELTER', up: '5% SPIRIT', down: '10% DRAMA', want: 'hate', out: { up: 'The shelter names it after your program; season-ticket holders adopt it in a week. Everyone wins, even the whistles. (+2 mood, −3 heat)', mid: 'He keeps a photo in his locker. The photo blinks. (−5 mood)', down: 'He visits the shelter every day after practice. Every. Single. Day. (−8 mood)' } },
        ],
      },
    ],
  },
  {
    id: 'booster_pod', fam: 'weekly', name: 'THE OFF-BOOKS TRAINING POD', who: 'player', weight: 2,
    trigger: 'Weekly roll.',
    beats: [
      {
        key: 'start', setup: 'A booster in a chrome suit "happens to run into" him and offers a personal off-books training pod — the kind pros use. Strictly against amateurism rules, obviously.',
        choices: [
          { label: 'REPORT THE BOOSTER TO THE LEAGUE', up: '5% SPIRIT', down: '25% DRAMA', want: 'hate', out: { up: 'Commendation hologram AND the booster fined into another tax bracket. The school frames the hologram. (−12 heat)', mid: 'The league opens a file. The booster sends a very cold holiday card. (−8 heat, +6 booster heat)', down: 'Commendation from the league, a season of very cold silence from the boosters. (−8 heat, +12 booster heat)' } },
          { label: 'LOOK THE OTHER WAY', up: '25% BREAKTHROUGH', down: '25% SCANDAL', want: 'love', out: { up: 'Back from "visiting his aunt" noticeably sharper, carrying a gift bag "from the aunt". You ask no questions, which is itself an answer. (+15 XP, −5 booster heat, +NAP POD PASS)', mid: '5am pod sessions, twice. Nothing happens. Probably nothing happened. (+8 XP)', down: 'Photographed entering the facility by a fan account with 4 followers and terrifying reach → CHAINS into THE LEAGUE CALLS. (+10 XP first)' } },
        ],
      },
    ],
    chain: 'scandal (on the down tail)',
  },
  {
    id: 'runaway_sister', fam: 'weekly', name: 'THE KID IN THE STANDS (femme arc)', who: 'player', weight: 2, forms: ['femme'],
    trigger: 'Weekly roll — only lands on a femme player.',
    beats: [
      {
        key: 'start', setup: 'Her little sister is discovered sleeping in the equipment room, having stowed away on three freighters to watch her big sister play. The family is calling. The kid refuses to leave before game night.',
        choices: [
          { label: 'A SEAT ON THE BENCH, THEN HOME', up: '25% SPIRIT', down: '5% DRAMA', want: 'love', out: { up: 'The kid calls every play before it happens from the end of the bench. She plays the game of her life with someone to play it for. (+18 mood, +10 XP, +5 team mood)', mid: 'One kid asleep on a shoulder bag by the fourth quarter. The shuttle home leaves Monday, full of stories. (+12 mood)', down: 'A delight — until she livestreams the entire locker room speech. The league has opinions about broadcast rights. (+10 mood, +6 heat)' } },
          { label: 'FIRST SHUTTLE HOME. RULES ARE RULES.', up: '2% SPIRIT', down: '25% DRAMA', want: 'hate', out: { up: 'The kid negotiates a signed ball, a courtside video call, and a promise in writing — from the shuttle gate. Future agent. (−3 mood)', mid: 'She waves until it\'s a dot, then plays the week on autopilot. (−8 mood)', down: 'Her warm-ups get very precise. The kid\'s empty seat stays empty all season in her head. (−14 mood)' } },
        ],
      },
    ],
  },

  // ================= THE REGULARS =================
  {
    id: 'dean_visit', fam: 'regulars', name: 'THE DEAN DROPS BY (tai chi)', who: 'coach', figure: 'dean',
    trigger: '30%/week: one of the two DEAN stories is picked at random.',
    beats: [
      {
        key: 'start', setup: 'The Dean appears holding two cups of faculty coffee, one of which is for herself. The Provost "would love" the arena Thursday evening. For low-gravity tai chi. Faculty only.',
        choices: [
          { label: 'LEND THE ARENA. SIP THE COFFEE.', up: '10% SPIRIT', down: '5% DRAIN', out: { up: 'The Provost, mid-pose, approves your equipment requisition from THIS YEAR. (−8 heat, +item)', mid: 'Forty professors do slow-motion kicks under your championship banner. It costs you nothing but the image. (−6 heat)', down: 'Incense and entitlement; the squad shoots around in the parking lot, muttering. (−6 heat, −4 squad energy)' } },
          { label: '"THURSDAY IS SHOOTAROUND, DEAN."', up: '5% SPIRIT', down: '10% DRAMA', out: { up: '"A program with priorities." She respects it, visibly, against her will. (+2 heat, +3 team mood)', mid: 'She books the aquatics dome instead. Somewhere, swimmers suffer. (+4 heat)', down: 'She leaves without finishing her coffee. The requisition forms develop "processing delays". (+8 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'dean_audit', fam: 'regulars', name: "THE DEAN'S AUDIT (study hall)", who: 'coach', figure: 'dean',
    trigger: '30%/week dean roll. Targets your lowest-BRAINS healthy player.',
    beats: [
      {
        key: 'start', setup: 'The Dean arrives with a clipboard and the academic ledger. [The dumbest transcript] is, in her words, "an away game." She wants a mandatory study-hall week. By the book.',
        choices: [
          { label: 'BOOK THE LIBRARY. BY THE BOOK.', up: '10% SPIRIT', down: '5% DRAMA', out: { up: 'He discovers the playbook is just a book. Game IQ up, Dean stamps something approvingly. (−8 heat, +1 BRN, −6 energy, +1¢)', mid: 'The Dean initials every page. The program looks clean because it is, briefly. (−8 heat, +1 BRN, −6 energy)', down: 'He passes the audit and files a formal complaint about the chairs. (extra −5 mood)' } },
          { label: '"HE STUDIES FILM. THAT COUNTS."', up: '5% WINDFALL', down: '25% SCANDAL', out: { up: 'You defend film study so well the Dean requests a seat at the next session. She takes notes. Good ones. (−2 heat)', mid: 'The Dean leaves unconvinced. The clipboard will return. (+6 heat)', down: 'The theory does not survive contact with the faculty senate. (+12 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'booster_gift', fam: 'regulars', name: 'A CHROME SUIT CALLS (the crate)', who: 'coach', figure: 'booster',
    trigger: '30%/week: one of the two BOOSTER stories is picked at random.',
    beats: [
      {
        key: 'start', setup: 'A booster leans on your doorframe like he financed it, which he might have. There\'s a crate in the hallway "that fell off a freighter". He wants nothing in return. He says "nothing" twice.',
        choices: [
          { label: 'TAKE THE CRATE', up: '10% LOOT', down: '10% SCANDAL', out: { up: 'TWO items inside. The booster waves from the parking lot for a full minute. (2 random non-legendary items, −8 booster heat)', mid: 'One item. No strings visible. Strings are rarely visible. (−6 booster heat)', down: 'One item — and a league tracking sticker nobody noticed until now. (+item, −6 booster heat, +10 school heat)' } },
          { label: 'DOORS CLOSE. CRATE STAYS OUTSIDE.', up: '5% SPIRIT', down: '10% DRAMA', out: { up: 'You decline so gracefully he tells the council you have "character". (+2 booster heat)', mid: '"Next season, coach." (+4 booster heat)', down: 'The crate ticks softly for three days, then disappears. So does some patience. (+8 booster heat)' } },
        ],
      },
    ],
  },
  {
    id: 'booster_shortcut', fam: 'regulars', name: 'A CHROME SUIT CALLS (the travel office)', who: 'coach', figure: 'booster',
    trigger: '30%/week booster roll.',
    beats: [
      {
        key: 'start', setup: 'He "knows a guy" at the league travel office — your next opponent\'s shuttle permits could develop... complications. They\'d arrive exhausted. Nobody would ever know. Probably.',
        choices: [
          { label: 'MAKE THE CALL', up: '5% WINDFALL', down: '25% SCANDAL', out: { up: 'Three customs queues and a fumigation bay. They arrive gray. (opponent plays tired tonight, −8 booster heat)', mid: 'A travel ordeal. You feel bad. You feel great. (tired opponent, −5 booster heat, +2 school heat)', down: 'The permits develop complications — and so does a league paper trail with your area code on it. (tired opponent, −6 booster, +10 school heat)' } },
          { label: 'HANG UP THE IDEA', up: '5% SPIRIT', down: '10% DRAMA', out: { up: '"Integrity," he says, like a stock he might buy. (+2 booster heat, +2 team mood)', mid: 'Somewhere, an opponent sleeps soundly, unaware. (+4 booster heat)', down: 'The cigar dims by exactly one lumen. "Suit yourself, coach." (+6 booster heat)' } },
        ],
      },
    ],
  },
  {
    id: 'scoop_question', fam: 'regulars', name: '“SCOOP” QUAZAR · ON AIR', who: 'coach', figure: 'scoop',
    trigger: '30%/week, only if a game was played: a multiple-choice question about LAST week (your MVP, a score, an opponent...). If THE NOTEBOOK holds the note, a ▤ button answers for you.',
    beats: [
      {
        key: 'start', setup: 'A press question with 2–4 options. The recorder is running, coach.',
        choices: [
          { label: 'ANSWER RIGHT (or read the notebook)', out: { up: '25%: "A coach who WATCHES." Friendly piece + 2¢ stipend', mid: 'Friendly piece + 1¢' } },
          { label: 'ANSWER WRONG', out: { mid: 'The piece prints your answer next to the correct one, in a larger font. (+2 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'bailout', fam: 'regulars', name: 'EMPTY POCKETS (the bailout)', who: 'coach', figure: 'side',
    trigger: 'Fires when your credits are ≤1 at week start. The character is rolled: dean / booster / Scoop.',
    beats: [
      {
        key: 'start', setup: 'DEAN: the emergency faculty fund envelope + a lecture pending. · BOOSTER: a roll of bills that could stop a meteor, "Rough month, coach?" · SCOOP: a paid exclusive — "SIX LEGS IN THE DOOR: A WEEK INSIDE A BROKE PROGRAM."',
        choices: [
          { label: 'TAKE THE DEAN\'S ENVELOPE', up: '5% SPIRIT', down: '2% DRAMA', out: { mid: 'Two credits, a bookmark that says INTEGRITY, an eleven-minute lecture. Worth it. (+2¢, −2 heat)' } },
          { label: 'TAKE THE BOOSTER\'S ROLL', up: '10% WINDFALL', down: '10% SCANDAL', out: { up: '"We take care of our own." You are, apparently, his own now. (+3¢, −6 booster heat)', mid: 'The ledger he doesn\'t show you gains a line. (+3¢, −3 booster, +3 school heat)', down: 'Bills peeled off in front of a window. A window with a photographer behind it. (+3¢, −4 booster, +8 school heat)' } },
          { label: 'GIVE SCOOP THE EXCLUSIVE', up: '5% WINDFALL', down: '25% DRAMA', out: { up: 'The broke-program-with-heart angle. Donations trickle. (+3¢, −3 heat)', mid: 'One flattering photo, one unflattering quote. Even. (+2¢)', down: 'Fair — but titled "THE COACH WHO COUNTS COUCH CUSHIONS." (+2¢, +5 heat)' } },
          { label: 'A PROGRAM PAYS ITS OWN WAY', up: '5% SPIRIT', down: '5% DRAMA', out: { up: 'The squad notices. Broke, but nobody\'s creature. (+4 team mood)', mid: 'Pride is free. Everything else, notably, is not.' } },
        ],
      },
    ],
  },

  // ================= CLASS POOLS =================
  {
    id: 'injury', fam: 'class', name: 'INJURY REPORT', who: 'player', context: 'injury',
    trigger: 'Any INJURY tail landing, from any source (drills, game night, items, stories). The SOURCE supplies the cause line; severity is rolled here: <45 → 1w tweak · <75 → 2–3w real injury · else 4–6w bio-lab + level loss. Tier-3 species roll ×1.4; drill bias adds +12/point.',
    beats: [
      {
        key: 'start', setup: '[Cause line from the source.] The med-scanner calls it [label]: N weeks out.',
        choices: [
          { label: 'LET IT HEAL (Nw out)', up: '2% BREAKTHROUGH', down: '2% INJURY', out: { up: 'His mother, it turns out, knows a way to regrow anything overnight. She sends you a casserole. 1 in 50, and you WON it. (0w out, +15 mood)', mid: 'The tank hums. N weeks of waiting starts now.', down: 'A complication: one extra week, and the med staff\'s tone got shorter.' } },
          { label: 'TAPE IT UP — HE PLAYS (only if ≤3 weeks)', up: '10% BREAKTHROUGH', down: '50% INJURY', want: 'love', out: { up: 'Pain is a teacher, apparently. (+1 FRC, +10 XP, +6 mood)', mid: 'He grits through the week. It holds. Barely. (−20 energy)', down: 'Something GOES. N weeks becomes N×2. The med staff writes your name on a whiteboard with an unkind diagram. (−8 mood, level loss at 4w+)' } },
        ],
      },
    ],
  },
  {
    id: 'drama', fam: 'class', name: 'LOCKER ROOM (drama)', who: 'player', context: 'mood',
    trigger: 'Any DRAMA tail landing. Default cause: "[He] slammed a locker hard enough to dent it, and nobody will say why."',
    beats: [
      {
        key: 'start', setup: '[Cause line.] The room has gone quiet in the bad way.',
        choices: [
          { label: 'CALL A TEAM MEETING (1¢)', cost: 1, up: '25% SPIRIT', down: '5% DRAMA', out: { up: 'Someone finally says the true thing out loud. The room exhales. (+15 team mood)', mid: 'You talk. They listen, mostly. It helps, some. (+6)', down: 'The meeting turns into a tribunal. Old grievances get new lawyers. (−8)' } },
          { label: 'LET IT BLOW OVER', up: '5% SPIRIT', down: '25% DRAMA', out: { up: 'By Thursday it has somehow become an inside joke. Teams are strange weather. (+6)', mid: 'It simmers, then settles. Mostly. (−3)', down: 'It does not blow over. It recruits. (−10 team, −10 player)' } },
        ],
      },
    ],
  },
  {
    id: 'scandal', fam: 'class', name: 'THE LEAGUE CALLS (scandal)', who: 'coach', figure: 'dean',
    trigger: 'Any SCANDAL tail landing, plus chained arrivals (cheating, rampage, booster pod, recruiting busts...). The cause line names the crime.',
    beats: [
      {
        key: 'start', setup: '[Cause line — default: an investigator in your lobby, holding a folder like it owes him money.] How do you play it?',
        choices: [
          { label: 'OWN IT, TAKE THE HIT', up: '10% SPIRIT', down: '2% SCANDAL', out: { up: 'You own it so completely the press conference becomes a redemption arc. (+5 heat, +5 team mood)', mid: 'You take the hit standing up. It costs, but it costs once. (+10 heat)' } },
          { label: 'DENY EVERYTHING', up: '25% WINDFALL', down: '25% SCANDAL', out: { up: 'The denial HOLDS. The folder was mostly receipts from a noodle bar. (no heat)', mid: 'The league can\'t prove it. The school can\'t forget it. (+12 heat)', down: 'The denial collapses in four days. Now it\'s the thing AND the cover-up of the thing. (+20 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'breakthrough', fam: 'class', name: '★ BREAKTHROUGH ★', who: 'player',
    trigger: 'Any BREAKTHROUGH tail landing (mostly drill up-rolls). No choice — you just watch it happen.',
    beats: [
      { key: 'start', setup: '[Cause.] He just did something nobody practiced. Everyone saw it. Nobody can explain it.', choices: [ { label: '(50/50) His ceiling just moved. You felt it move. (+6 potential, +10 mood) — OR — He has leveled his whole game up overnight. (+1 level, +10 mood)' } ] },
    ],
  },

  // ================= GROWTH & SYSTEM =================
  {
    id: 'levelup', fam: 'system', name: '★ LEVEL UP ★', who: 'player',
    trigger: 'XP banks Monday at WEEK START; clearing a level (need = 20 + 12×level) knocks first thing. Each level banks +2 points — the coach places them.',
    beats: [
      {
        key: 'start', setup: 'He hits LEVEL N. The work has banked +2 points — and where they land is a coach\'s call. One button per attribute, showing the exact move.',
        choices: [
          { label: 'SKILL', out: { mid: 'He lives in the gym for a week. The net starts making that sound.' } },
          { label: 'ATHLETICISM', out: { mid: 'He rebuilds his body one brutal morning at a time. The floor feels smaller now.' } },
          { label: 'FIERCENESS', out: { mid: 'He finds the mean streak and makes it a tool. Opponents will learn his name the hard way.' } },
          { label: 'BRAINS', out: { mid: 'He starts seeing the floor two passes early. The game slows down for him.' } },
          { label: '(an attribute AT its ceiling can still take +1 — and the +1 DRAGS the potential up with it: "Everyone watches the ceiling move.")' },
        ],
      },
    ],
  },
  {
    id: 'frozen', fam: 'system', name: 'THE FROZEN ONE', who: 'player', context: 'mood',
    trigger: 'At PLAY: a reserve past his PATIENCE (2–6 games in street clothes, rolled per player) meets you at the locker room door. He knocks again a full patience later if still frozen.',
    beats: [
      {
        key: 'start', setup: 'Tip-off is in twenty minutes and he\'s at the locker room door with his warm-ups still on. "Coach. N games. I haven\'t played in N games."',
        choices: [
          { label: 'YOU\'RE RIGHT — YOU PLAY TONIGHT', up: 'SPIRIT', down: 'DRAMA — now put him on the floor', want: 'love', out: { mid: '"Okay, coach." He\'s already stretching. Back to the LINEUP SCREEN — the floor as it stands is remembered. (+8 mood, TENSE)' } },
          { label: '"EARN IT. NOT TONIGHT."', up: 'BREAKTHROUGH (rare)', down: 'DRAMA', want: 'hate', out: { up: 'He takes it personally — in the useful way. (−4 mood, +15 XP)', mid: 'He nods once, the way people nod when they\'ve stopped listening. Tip-off resumes the moment the story closes. (−14 mood)' } },
        ],
      },
      {
        key: 'kept (after the game)', setup: 'He checked in tonight — real minutes, real sweat. He nods at you once.',
        choices: [ { label: '—', out: { mid: 'Word gets around: this coach means what he says. (+8 mood, +2 team mood)' } } ],
      },
      {
        key: 'broken (after the game)', setup: '"You said I\'d play tonight." He\'s in the tunnel in a warm-up jacket that never came off. He doesn\'t slam anything. That\'s the worst part.',
        choices: [ { label: '—', out: { mid: 'DOUBLE MAD: whatever you tell him next, he has already decided what it\'s worth. (−30 mood, −3 team mood)' } } ],
      },
      {
        key: 'unfair (after the game, the one he displaced — 60%; else 35% a random teammate)', setup: '"So X complains, and X plays? What do the rest of us have to do — cry?" A few heads turn.',
        choices: [ { label: '—', out: { mid: 'You tell him minutes are earned. He says "apparently not." (−12 mood)' } } ],
      },
    ],
    follow: 'The cleanest PROMISE structure in the game now happens inside ONE night: the knock at PLAY → the lineup screen → the horn reads who actually stood on the floor.',
  },
  {
    id: 'cut_revenge', fam: 'system', name: 'THE ONE YOU CUT', who: 'coach',
    trigger: 'Every player discarded at the roster cut schedules this 2–6 weeks into the season. Variant rolled when it lands.',
    beats: [
      {
        key: 'start', setup: 'Three variants:',
        choices: [
          { label: 'V1 — he drops 40 in a rec-league stream with your program\'s name on his shoes. Crossed out. The squad has all seen it. Twice. → 50/50: the locker room laughs it off (+5 booster heat) / practice that week is QUIET (−6 team mood)' },
          { label: 'V2 — signed by a rival rec league, telling a streamer with 9M followers exactly which coach "couldn\'t see it". The quote has your name in it. → "narrative control" lunch (+8 booster heat)' },
          { label: 'V3 — a handwritten letter: "The cut lit a fire. Thank you for the fuel." A ticket stub from his first semi-pro start folded inside. You read it three times. → pinned to the corkboard (+1 legacy, +3 team mood)' },
        ],
      },
    ],
  },

  // ================= THE HOT SEAT =================
  {
    id: 'interfere_school', fam: 'hotseat', name: 'THE SCHOOL INTERFERES', who: 'coach', figure: 'dean',
    trigger: 'School heat crosses 50 (fires once per crossing; re-arms when it cools below 40).',
    beats: [
      {
        key: 'start', setup: 'The Provost is in your office, uninvited, rearranging your trophies by "moral weight". She has a list of demands and a pen that costs more than your ship.',
        choices: [
          { label: 'SUSPEND YOUR BEST PLAYER 1 WEEK (contrition)', up: '5% SPIRIT', down: '10% DRAMA', out: { mid: 'He sits "for the culture of the program." The locker room, surprisingly, gets it — or doesn\'t (−8 team mood on the down roll). (1w out, −8 his mood, −18 heat)' } },
          { label: 'FUND HER ETHICS WING (3¢)', cost: 3, up: '2% SPIRIT', down: '2% DRAIN', out: { mid: 'There will be a plaque. Your name on it is spelled almost correctly. (−15 heat)' } },
          { label: 'SHOW HER THE DOOR', up: '10% SPIRIT', down: '25% SCANDAL', out: { up: 'She momentarily respects you. The trophies go back in win order. (+5 heat, +5 team mood)', mid: 'She leaves without a word, which costs you more sleep than shouting would have. (+8 heat)', down: 'By Friday there is a faculty senate resolution with your name in the title. (+15 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'interfere_boost', fam: 'hotseat', name: 'THE BOOSTERS INTERFERE', who: 'coach', figure: 'booster',
    trigger: 'Booster heat crosses 50 (same once-per-crossing arming).',
    beats: [
      {
        key: 'start', setup: 'Three boosters in matching chrome suits occupy your office like weather. They\'ve seen the standings. They have "thoughts". The tallest one keeps touching your whiteboard.',
        choices: [
          { label: 'THROW THE APPEASEMENT GALA (3¢)', cost: 3, up: '10% LOOT', down: '2% DRAIN', out: { up: 'Somebody auctions a moon. A chrome suit presses something into your hand "for the stretch run". (−20 booster heat, +NEBULA ESPRESSO)', mid: 'Shrimp towers, a laser quartet, three speeches about "winning culture". (−18 booster heat)' } },
          { label: 'PROMISE THEM THE TOURNAMENT', up: '5% SPIRIT', down: '25% DRAMA', out: { mid: 'Said with enough conviction that you briefly believe it yourself. (−12 booster heat)', down: 'They have a guy whose whole job is writing down what you promise. (−10 booster heat... for now)' } },
          { label: 'THROW THEM OUT', up: '10% SPIRIT', down: '25% SCANDAL', out: { up: 'Legend by dinnertime. Boosters respect exactly one thing and you just did it. (−8 booster heat)', mid: '"We\'ll be watching," says the tallest one, watching. (+5)', down: 'Their checkbooks leave with them, loudly. (+12)' } },
        ],
      },
    ],
  },
  {
    id: 'summons', fam: 'hotseat', name: '⚠ THE SUMMONS', who: 'coach', figure: 'side',
    trigger: 'Combined heat ≥75 → 50% per week. The leaning side (10+ hotter) hosts; near-equal = both, together, agreeing on exactly one thing.',
    beats: [
      {
        key: 'start', setup: 'The long room with the long table. Your seat, notably, has been made hot. This is the conversation. Survive it or clean out your office.',
        choices: [
          { label: 'SACRIFICE THE BAG (lose every item)', up: '5% SPIRIT', down: '2% DRAMA', out: { mid: 'You empty THE BAG onto the long table — every favor and vial you were saving. The room inspects your ruin and is satisfied. (−25/−25 heat)' } },
          { label: 'BUY YOUR SEAT BACK (5¢)', cost: 5, up: '2% SPIRIT', down: '2% DRAIN', out: { mid: 'Apologies, galas, review boards, one enormous commemorative bench. Your seat cools. (−20/−20 heat)' } },
          { label: 'REFUSE. LET THEM SWING.', up: '10% SPIRIT', down: '50% SCANDAL', out: { up: 'The room BLINKS. You survive by one hand. You will never know whose. (−10/−10 heat, +8 team mood)', mid: 'You barely survive the vote and leave the long room older. (+5/+5 heat)', down: 'The vote is short. GAME OVER — FIRED.' } },
        ],
      },
    ],
  },

  // ================= THE SHIP & THE DEBT =================
  {
    id: 'grounded', fam: 'ship', name: 'THE SHIP (grounded / the goblins)', who: 'coach', art: 'saucer',
    trigger: 'SHIP tails from searches/scouting; the oracle\'s down-roll. Cause line printed (cracked hull, shredded scoop, lunar debris...).',
    beats: [
      {
        key: 'start', setup: '[Ride line…] [Cause.] As you limp back sub-warp, a starbase of mech-goblins radios in: they can fix it, cheap, "mostly honest".',
        choices: [
          { label: 'LET THE GOBLINS FIX IT', up: '50% WINDFALL', down: '50% SHIP', out: { up: 'They hand it back BETTER. The bill — 3 credits — arrives next week engraved on a small meteor. They also left a mint.', down: 'They fail spectacularly. Your ship is grounded at THEIR base wearing half its engine. Every week after: 25% they finish ("several parts are new, several are \'new\'"). Meanwhile: a hot tub you did not order and cannot afford.' } },
          { label: 'LIMP HOME. 3 WEEKS GROUNDED.', up: '2% SPIRIT', down: '2% DRAIN', out: { mid: 'Maneuvering thrusters all the way. Grounded = home-planet scouting only, no deep searches.' } },
        ],
      },
    ],
    chain: 'goblin_bill (the invoice) / weekly goblin_hold beats until they finish',
  },
  {
    id: 'hullbreach', fam: 'ship', name: 'THE HULL BREACH (dossiers in the void)', who: 'coach', art: 'saucer',
    trigger: '50% of search down-rolls (the other half is GROUNDED).',
    beats: [
      {
        key: 'start', setup: 'A micrometeorite shreds the cargo bay — and your scout reports fly out through the hole. Every dossier, spinning off in a slow, expensive constellation.',
        choices: [
          { label: 'WATCH THEM GO', up: '2% INTEL', down: '2% DRAIN', out: { mid: 'A season of scouting drifts off sunward. Somewhere out there, a very informed comet. Every prospect on the board is a stranger again.' } },
          { label: 'SUIT UP AND CHASE THEM (1¢)', cost: 1, up: '50% INTEL', down: '10% INJURY', out: { up: 'You spacewalk with a net like a lunatic and catch nearly all of it. The intel survives.', mid: 'Two folders and a lot of vacuum. Intel: gone.', down: 'A meteorite catches you back. Intel gone and your shoulder clicks now.' } },
        ],
      },
    ],
  },
  {
    id: 'debt', fam: 'ship', name: '☠ THE DEBT LADDER', who: 'coach', art: 'bus',
    trigger: 'Stranded with ZERO credits: 10% on a broke away-ride home, 10% on a broke off-world search. The game\'s darkest door.',
    beats: [
      {
        key: 'start', setup: '[Ride line…] A salvage rig answers the distress call, lights like teeth. The tow bill is more than you have — you have NOTHING. They open negotiations, if that\'s the word.',
        choices: [
          { label: 'PAY IN LOOT (give up an item — only if the bag has any)', up: '2% SPIRIT', down: '2% DRAMA', out: { mid: 'They take it with the reverence of people who know exactly what it\'s worth. You ride home in silence.' } },
          { label: 'CALL A BOOSTER, BEG', up: '5% WINDFALL', down: '25% SCANDAL', out: { up: 'Paid without questions and, horrifyingly, without conditions. "You owe me a story sometime, coach." Somehow that\'s worse. (+8 heat)', mid: 'The favor goes in a ledger you will never be shown, next to your name. (+10 heat, −8 booster heat)', down: 'The wire is VISIBLE. League forensic accountants love visible. (+20 heat)' } },
          { label: 'YOU HAVE NOTHING TO GIVE', up: '2% SPIRIT', down: '50% SHIP', out: { up: 'The captain finds your laminated play card genuinely interesting and takes it as payment. 1 in 50, and you WON it.', mid: 'They take the good seats — the SEATS. Everyone stands for a week. (−10 mood, −10 energy)', down: 'The captain smiles like a hull breach. → THE PEOPLE BEAT.' } },
        ],
      },
      {
        key: 'people', setup: 'The smuggler captain walks your bench with a jeweler\'s eye and points at your BEST PLAYER. "Him. He works the engine room until the debt clears. Debts here don\'t clear." They have taste. They also have a tractor beam.',
        choices: [
          { label: 'HAND HIM OVER', up: '2% SPIRIT', down: '2% DRAMA', out: { mid: 'You shake his hand at the airlock and cannot find one single word. He nods like it\'s a road game. The team will not look at you this week. (player GONE → alumni of the void, −18 team mood) → THE EMPTY LOCKER' } },
          { label: 'OFFER SOMEONE ELSE', up: '50% SPIRIT', down: '50% DRAMA', out: { up: '"Untapped engine-room potential." The captain squints... and takes your WORST player instead. (−15 team mood) → THE EMPTY LOCKER', down: 'The captain takes offense — and takes your star anyway, plus your dignity as a tip. (−20 team mood) → THE EMPTY LOCKER' } },
          { label: 'REFUSE THEM EVERYTHING', up: '2% SPIRIT', down: '50% SHIP', out: { up: 'A patrol cruiser drops out of warp at exactly the right moment. You will never be this lucky again. 1 in 50, and you WON it. (+10 team mood)', down: 'They cut the tow line and leave you to the dark. GAME OVER — LOST TO THE VOID.' } },
        ],
      },
    ],
    chain: 'locker → (daughter_favor | droid_probe) · the taken player can return years later via ALUMNI OF THE VOID',
  },
  {
    id: 'locker', fam: 'ship', name: 'THE EMPTY LOCKER', who: 'coach',
    trigger: 'Chained: fires immediately after the debt ladder takes a player. You need a ninth body by tip-off.',
    beats: [
      {
        key: 'start', setup: 'One locker stands empty and the league does not care why. The candidates, such as they are:',
        choices: [
          { label: 'THE TRAINING-SQUAD WALK-ON', up: '2% BREAKTHROUGH', down: '2% DRAMA', out: { up: 'In his first scrimmage he does something that makes your assistant drop the clipboard. A GEM. 1 in 50, and you WON it.', mid: 'He cries a little. He earned the right. (a modest walk-on joins)' } },
          { label: "THE DEAN'S DAUGHTER (she's good. that's the problem.)", up: '5% SPIRIT', down: '10% SCANDAL', out: { mid: 'Minervva signs the eligibility forms her mother happens to have on hand. The Dean now attends every practice "as family". (+5 heat; FAMILY SEATS scheduled in 4 weeks)' } },
          { label: 'THE DROID A BOOSTER BUILT (suspiciously excellent)', up: '5% BREAKTHROUGH', down: '25% SCANDAL', out: { mid: 'UNIT-7 unfolds from a crate with a jersey already on. Its blood is technically coolant. Species: "undeclared". (eligibility probe scheduled in 3 weeks)' } },
        ],
      },
    ],
    chain: 'daughter_favor (4w) / droid_probe (3w)',
  },
  {
    id: 'daughter_favor', fam: 'ship', name: 'FAMILY SEATS (the Dean\'s daughter)', who: 'coach', figure: 'dean',
    trigger: 'Scheduled 4 weeks after signing Minervva.',
    beats: [
      {
        key: 'start', setup: 'The Dean "wonders aloud", in your doorway, whether her daughter shouldn\'t be STARTING. She wonders it while holding the eligibility forms she could unsign.',
        choices: [
          { label: 'START HER THIS WEEK', up: '5% SPIRIT', down: '10% DRAMA', out: { mid: 'She plays well enough that the question answers itself. This time. (−8 heat)', down: 'The locker room does the math on WHY, out loud. (−8 team mood, −8 heat)' } },
          { label: '"SHE PLAYS WHEN SHE EARNS IT."', up: '10% SPIRIT', down: '25% SCANDAL', out: { up: 'She backs you IN THE MEETING. The Dean leaves defeated by her own bloodline. (+8 team mood)', mid: 'The Dean withdraws, wounded, to wonder aloud in other doorways. (+5 heat)', down: 'The eligibility forms develop "processing delays". (+12 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'droid_probe', fam: 'ship', name: 'THE WARRANTY CARD (UNIT-7 probe)', who: 'coach', figure: 'dean',
    trigger: 'Scheduled 3 weeks after signing UNIT-7.',
    beats: [
      {
        key: 'start', setup: 'A league eligibility officer would like to discuss UNIT-7\'s "birth certificate", which appears to be a warranty card.',
        choices: [
          { label: '"SHOW ME THE RULE AGAINST DROIDS."', up: '25% WINDFALL', down: '25% SCANDAL', out: { up: 'There IS no rule. The league writes one on the spot — effective NEXT season. UNIT-7 plays on, gleaming, grandfathered.', mid: 'The hearing adjourns without ruling. UNIT-7 does perfect form shooting against the hallway wall, which does not help the optics. (+5 heat)', down: 'The league invents a rule with a straight face. UNIT-7 suspended 3w; the school inherits the headline. (+15 heat)' } },
          { label: 'QUIETLY BENCH THE DROID', out: { mid: 'UNIT-7 takes the bench without complaint, then refiles the entire equipment room by win probability. (−5 heat, −5 its mood)' } },
        ],
      },
    ],
  },

  // ================= VOYAGES & ALUMNI =================
  {
    id: 'vendor', fam: 'voyage', name: 'THE COAT OF MIRACLES', who: 'coach', art: 'bus',
    trigger: 'Voyage roll on an away ride home (25% a voyage; 1-in-3 of the plain voyages).',
    beats: [
      {
        key: 'start', setup: 'Fuel stop at a station shaped like a grin. A vendor unrolls a coat lined with unlabeled miracles. "For the discerning coach," she says, discerning you instantly.',
        choices: [
          { label: 'BUY SOMETHING UNLABELED (2¢)', cost: 2, up: '10% LOOT', down: '10% SCANDAL', out: { up: 'She throws in a second item "for luck". The coat approves of you now.', mid: 'Unlabeled, unquestioned, un-receipted. (+1 random item)', down: 'The league, it turns out, photographs this station. Of course it does. (+item, +8 heat)' } },
          { label: 'KEEP WALKING', out: { mid: 'The coat rustles with disappointment.' } },
        ],
      },
    ],
  },
  {
    id: 'bus_prospect', fam: 'voyage', name: 'THE KID ON THE BUS', who: 'coach', art: 'bus',
    trigger: 'Voyage roll.',
    beats: [
      {
        key: 'start', setup: 'Hours deep into the ride home, something rhythmic taps behind you: a kid doing ball-handling drills in zero-G with his seatbelt ON, because the driver asked. Fundamentals AND manners.',
        choices: [
          { label: 'SLIDE HIM YOUR CARD', up: '10% INTEL', down: '2% DRAMA', out: { mid: 'He reads it twice and does another set, harder. A name for the board, met the honest way. (board full: he promises to call next season. Kids never call.)' } },
          { label: 'YOU NEED THE SLEEP', up: '2% SPIRIT', down: '5% DRAMA', out: { mid: 'You\'ve seen a thousand kids dribble on a thousand buses. Probably fine.', down: 'Two seasons from now that kid drops 40 on you in the tournament and waves at your bench. You will remember the seatbelt.' } },
        ],
      },
    ],
  },
  {
    id: 'omen', fam: 'voyage', name: 'THE EXHAUST READER', who: 'coach', art: 'bus',
    trigger: 'Voyage roll.',
    beats: [
      {
        key: 'start', setup: 'A hermit at the transfer station reads engine exhaust the way others read palms. "A name on your board," she says. "I have seen who they really are."',
        choices: [
          { label: 'LISTEN', up: '50% INTEL', down: '5% DRAMA', out: { up: 'She traces a kid\'s whole career in spilled coolant — one unknown prospect fully revealed, ceiling and all. Free truth from beyond the veil.', mid: '"Tall," she says finally. "Some of them. Others, less so."', down: 'She describes YOUR team\'s weaknesses, loudly, to the whole terminal. The team pretends not to hear. The team heard. (−5 team mood)' } },
          { label: 'TIP HER AND BOARD', out: { mid: 'She palms the coin and tells the BUS its future instead. The bus seems reassured.' } },
        ],
      },
    ],
  },
  {
    id: 'alum_gold', fam: 'voyage', name: 'ALUMNI · THE GOLDEN ONE', who: 'coach', art: 'bus',
    trigger: 'Alumni encounter roll (rides home + 10% offseason): a former player, 50/50 golden or dark.',
    beats: [
      { key: 'start', setup: 'He thanks you tonight on a galactic broadcast, by name, twice. The phone in your office starts ringing before he finishes.', choices: [ { label: '(no choice) +2 legacy, −5 booster heat, +5% commitment across the recruiting board' } ] },
    ],
  },
  {
    id: 'alum_dark', fam: 'voyage', name: 'ALUMNI · THE FALLEN ONE', who: 'coach', art: 'bus',
    trigger: 'Alumni encounter roll.',
    beats: [
      {
        key: 'start', setup: 'On the streets of Oblox-4: "Coach? ...Can you spare some money?" It\'s him. YOUR him — class of season N. The galaxy has not been kind since.',
        choices: [
          { label: 'BUY HIM DINNER. MAKE CALLS. (1¢)', cost: 1, up: '25% SPIRIT', down: '10% DRAMA', out: { up: 'A cot, a job title invented on the spot ("shooting consultant"), and six weeks later he\'s upright and telling every recruit\'s family what kind of program this really is. (+3 legacy, +5 team mood)', mid: 'He texts you a photo of his first paycheck. You keep it. (+2 legacy)', down: 'He takes the help, then vanishes with the petty cash. You report it. It was still right to try. (+1 legacy)' } },
          { label: 'PRESS A COIN IN HIS HAND AND WALK', up: '2% SPIRIT', down: '25% SCANDAL', out: { up: 'You hate yourself into action by the corner — he\'s gone. You hire an investigator. To be continued, you swear. (−1 legacy)', mid: 'The arena lights are very bright tonight and you deserve none of them. (−2 legacy, −3 team mood)', down: 'A stream account catches the whole thing at 4K. The school reads captions. (−3 legacy, +10 heat)' } },
        ],
      },
    ],
  },
  {
    id: 'alum_void', fam: 'voyage', name: 'ALUMNI OF THE VOID', who: 'coach', art: 'bus',
    trigger: 'Alumni encounter roll when the alumnus was TAKEN by the debt ladder. The one that got away.',
    beats: [
      {
        key: 'start', setup: 'A freight manifest, a blurry stream clip, a jersey number you\'d know anywhere: he\'s ALIVE, playing engine-room pickup in a belt colony, and by every account STRONGER THAN EVER. The debt, word is, has been "renegotiated".',
        choices: [
          { label: 'BRING HIM HOME (once, ever)', up: '25% BREAKTHROUGH', down: '10% SHIP', out: { up: 'Waiting at the dock, bag packed, twice the player who left. The disaster of that season is now the best thing that ever happened to this program. "For the bag." (+4 legacy, +15 team mood, +BEELZEBUB\'S VIAL)', mid: 'Not eligible anymore — the years happened — but he takes a seat on your bench as an assistant, and the whole galaxy knows you came back for him. (+3 legacy, +12 team mood)', down: 'He chooses the belt. "I\'m the best player in three systems out here, coach." You shake hands as equals. Somehow that\'s a win too. (−2¢, +2 legacy)' } },
          { label: 'LET HIM WRITE HIS OWN STORY', up: '10% SPIRIT', down: '5% DRAMA', out: { up: 'You follow his colony box scores like scripture. You frame the blurry clip. (+1 legacy)', mid: 'Some debts pay themselves forward.', down: 'Next season\'s tournament scouting report will include a familiar name on an unfamiliar roster. He remembers everything, including whose fault it was.' } },
        ],
      },
    ],
  },

  // ================= KNOWLEDGE =================
  {
    id: 'seminar', fam: 'knowledge', name: 'THE COACHING SEMINAR', who: 'coach', weight: 2,
    when: 'Only while drills/speeches/instructions remain unlearned.',
    trigger: 'Weekly roll (gated).',
    beats: [
      {
        key: 'start', setup: 'An embossed holo-invitation: the Galactic Coaching Seminar on Blorgon 6, this week. Two days of drills, film, and lukewarm banquet food with the best minds in the game.',
        choices: [
          { label: 'ATTEND (2¢)', cost: 2, up: '50% BREAKTHROUGH', down: '10% DRAMA', out: { up: 'A legendary assistant walks you through [a random unknown drill/speech/instruction], step by step. Yours now, forever.', mid: 'Six hours of trust falls and a pyramid scheme about "vertical culture". You learned nothing, and it cost you the trip.', down: 'Blorgon flu from the seminar buffet. The team spends the week worried about you. (−5 team mood)' } },
          { label: 'TOSS THE INVITATION', out: { mid: 'The invitation folds itself into a paper shuttle and flies off, offended.' } },
        ],
      },
    ],
  },
  {
    id: 'oracle', fam: 'knowledge', name: 'THE ORACLE\'S MOON', who: 'coach', weight: 2,
    when: 'Knowledge remains + week 3 or later.',
    trigger: 'Weekly roll (gated).',
    beats: [
      {
        key: 'start', setup: 'Your ship drops out of warp above an uncharted moon. On its surface: a single hut, a single light, and — your instruments insist — a single very old basketball hoop.',
        choices: [
          { label: 'LAND AND KNOCK', up: '50% BREAKTHROUGH', down: '25% SHIP', out: { up: '"You are late," says the oracle, who has never met you. An hour later you know [a method your species has not invented yet].', mid: 'Riddles about "the pick and the roll within". You leave with incense in your clothes and nothing else.', down: 'The oracle\'s moon has opinions about your landing gear. → GROUNDED (goblin deal).' } },
          { label: 'STAY IN ORBIT. WARP HOME.', out: { mid: 'Some doors are better left unknocked. The hoop watches you leave.' } },
        ],
      },
    ],
    chain: 'grounded (on the down tail)',
  },
  {
    id: 'starcharts', fam: 'knowledge', name: 'THE CRACKED DATAPAD (deep core charts)', who: 'coach', weight: 2,
    when: 'Deep Core still locked + week 4 or later.',
    trigger: 'Weekly roll (gated). The only way to unlock the DEEP CORE region.',
    beats: [
      {
        key: 'start', setup: 'A retired scout sells memorabilia outside the arena. Between the pennants: a cracked datapad labeled "CORE ROUTES — DO NOT FLY". She wants an endorsement of her dubious autobiography, not money.',
        choices: [
          { label: 'ENDORSE THE BOOK, TAKE THE CHARTS', up: '50% INTEL', down: '10% SCANDAL', out: { up: 'Your name now graces the back cover of "I Scouted The Void (And The Void Scouted Back)". REAL Deep Core routes, annotated in three languages. (DEEP CORE unlocked)', mid: 'The charts are a menu from a noodle bar on Kanzar. A very good noodle bar, to be fair. (+3 team mood)', down: 'The charts are real — and so is chapter 7, describing your recruiting methods in avoidable detail. (DEEP CORE unlocked, +10 heat)' } },
          { label: 'DECLINE POLITELY', out: { mid: 'She sells the datapad to the Voidfiends\' coach instead. You will think about this forever.' } },
        ],
      },
    ],
  },

  // ================= ECHO BEATS =================
  { id: 'goblin_bill', fam: 'echo', name: 'THE BILL (goblins)', who: 'coach', trigger: '1 week after the goblins fix your ship on the up-roll.', beats: [ { key: 'start', setup: 'The mech-goblin invoice arrives, engraved on a small meteor: 3 CREDITS. They also left a mint. (−3¢)' } ] },
  { id: 'espresso_crash', fam: 'echo', name: 'THE CRASH (espresso)', who: 'coach', trigger: '1 week after NEBULA ESPRESSO.', beats: [ { key: 'start', setup: 'The nebula espresso bill comes due. The squad moves like seaweed. Practice is held at a whisper. (−30 squad energy)' } ] },
  { id: 'check_probe', fam: 'echo', name: 'THE SUBPOENA (blank check)', who: 'coach', trigger: '4 weeks after the BOOSTER\'S BLANK CHECK down-roll.', beats: [ { key: 'start', setup: 'The blank check cleared. So did the league\'s subpoena. The investigation you felt coming has arrived, with weather of its own. (+20 heat)' } ] },
  { id: 'chrono_age', fam: 'echo', name: 'REGISTRAR (chrono sip)', who: 'player', trigger: 'Chained from CHRONO SIP\'s down-roll.', beats: [ { key: 'start', setup: 'The registrar\'s office has reviewed his "subjective years" and ruled: they count. He is now a class year older. There is a form. There is always a form.' } ] },
  { id: 'tape_review', fam: 'echo', name: 'THE LEAGUE SAW THE TAPE', who: 'player', trigger: 'Next Monday after THE CAPTAIN\'S ORDER backfires (caught).', beats: [ { key: 'start', setup: 'The screen he set on their star has been slowed down, zoomed in, and watched eleven times by a league disciplinary panel. It looks exactly like what it was. (2w suspension, −8 mood, +8 heat. The panel\'s report uses the word "choreographed". The Dean uses worse.)' } ] },

  // ================= SYSTEM DIALOGS =================
  { id: 'supply', fam: 'plumbing', name: 'THE SUPPLY CLOSET', who: 'coach', trigger: '50%/week: the equipment manager leaves a small item on your desk with a sticky note: "found this. don\'t ask."', beats: [ { key: 'start', setup: 'TAKE IT (into the bag; a full bag = a kid outside the arena walks off with it, delighted) or LEAVE IT ON THE DESK (re-donated to the mystery it came from).' } ] },
  { id: 'item_offer', fam: 'plumbing', name: '◆ AN ITEM FINDS YOU', who: 'coach', trigger: 'Every found/gifted item passes through this take-it-or-leave-it gate.', beats: [ { key: 'start', setup: '[Item name]. [Flavor line]. → INTO THE BAG / LEAVE IT — THE BAG IS FOR BETTER THINGS.' } ] },
  { id: 'bagfull', fam: 'plumbing', name: 'THE BAG IS FULL', who: 'coach', trigger: 'An item lands while all 8 slots are taken.', beats: [ { key: 'start', setup: 'Eight slots, that\'s the law. You watch a kid outside the arena walk off with it, delighted. Use your items, coach.' } ] },
  { id: 'travel_out', fam: 'plumbing', name: 'THE ROAD (wheels up)', who: 'coach', trigger: 'Every away game + every UT round opens with the bus heading out.', beats: [ { key: 'start', setup: '"Wheels up. The bus points its nose at a stranger\'s sun…" + one of 5 outbound flavor lines (aux-cable politics, freshmen pressed to the glass...).' } ] },
  { id: 'travel', fam: 'plumbing', name: 'THE ROAD HOME (uneventful)', who: 'coach', trigger: 'The ~65% of away rides where nothing happens.', beats: [ { key: 'start', setup: 'One of 5 ride-anticipation lines ending in "…", then one of 5 uneventful-void lines (the 51-card deck, six parsecs of smooth jazz...).' } ] },
  { id: 'notice', fam: 'plumbing', name: 'NOTICE (announcement card)', who: 'coach', trigger: 'Utility: CLEARED TO PLAY returns, UT scouting reports, any tap-through news.', beats: [ { key: 'start', setup: 'Tag + text passed in by the engine. Nothing decided.' } ] },
  { id: 'reveal', fam: 'plumbing', name: '★ THE REVEAL CARD ★', who: 'coach', trigger: 'Anything gained (speech, drill, instruction, star charts, item) gets its own dialog showing exactly what you received.', beats: [ { key: 'start', setup: '"[X] is yours now, forever. The next room you say it in will believe you." (per-kind copy)' } ] },
];

// ---- THE BAG (items) --------------------------------------------------------
// context = where the slot pulses; target = who it's for and where it DRAGS: 'player' onto a squad card · 'prospect' onto a big-board card · 'team' anywhere on the stage. Every item drags; the bag slot wears the badge (● ONE / ● RECRUIT / ●●● TEAM).
const ITEMS = [
  { id: 'vial', name: "BEELZEBUB'S VIAL", short: 'VIAL', rarity: 'rare', context: ['injury', 'pregame'], target: 'player', flavor: '"One sip. Ask nothing." — the doctor on stAroid-5', effect: 'MEDICAL · an injured player: back on his feet tonight, full energy (refuses non-injury absences)', up: '2% BREAKTHROUGH', down: '25% INJURY', out: { up: 'Whatever was wrong is gone — and something extra came with it. (+2 attr pts)', mid: 'He shudders once and stands up like nothing ever happened. You ask nothing.', down: 'INCREDIBLE for six hours; then his legs stop answering. 3 weeks in the medbay, −1 level. The team doctor won\'t even look at you.' } },
  { id: 'xarter', name: "XARTER'S INVITATION", short: 'XART', rarity: 'legendary', context: ['practice'], target: 'player', flavor: 'The mind-controlling trainer takes one pupil a year.', effect: 'the player you DROP it on: a level, instantly, and a body rebuilt for speed', up: '5% BREAKTHROUGH', down: '10% SCANDAL', out: { up: 'His first step now happens slightly before he decides to take it. (+1 level, +2 ATH, +2 more)', mid: 'Faster, quieter, and unwilling to discuss it. (+1 level, +2 ATH)', down: 'Wrong behind the eyes: mid-scrimmage he bites a teammate\'s leg. Suspension + a league file with your name on it. (+2 FRC, −2 BRN, 3w out, +15 heat)' } },
  { id: 'chrono', name: 'CHRONO SIP', short: 'CHRNO', rarity: 'legendary', context: ['practice'], target: 'player', flavor: 'Time is a liquid if you know the right bartender.', effect: 'the player you DROP it on: three levels of growth, instantly', up: '2% BREAKTHROUGH', down: '10% DRAMA', out: { up: 'Three years of work in his hands — and a ceiling you can no longer see. (+3 levels, +8 potential)', mid: 'Three subjective years of empty-gym reps land in his body at once. He sits down for a while. (+3 levels)', down: 'He also AGES three subjective years. The registrar says that\'s a class year. (+3 levels, then the REGISTRAR beat)' } },
  { id: 'icepack', name: 'METEOR ICE PACK', short: 'ICE', rarity: 'common', context: ['injury'], target: 'player', flavor: 'Cold from before the solar system. The honest one.', effect: 'MEDICAL · an injury: recovery time halved (2% frostbite: +1 week)', up: '2% SPIRIT', down: '2% INJURY', out: { mid: 'The meteor ice does its ancient work: N weeks → ceil(N/2).' } },
  { id: 'espresso', name: 'NEBULA ESPRESSO', short: 'ESPR', rarity: 'common', context: ['pregame'], target: 'team', flavor: 'Brewed under pressure. Like everyone here.', effect: 'squad +20 energy tonight, −30 crash next week', up: '2% SPIRIT', down: '2% DRAMA', out: { mid: 'Pupils the size of moons. Tonight they are LIMITLESS. Next week is next week. (THE CRASH scheduled)' } },
  { id: 'karaoke', name: 'MOOD KARAOKE CHIP', short: 'KARA', rarity: 'common', context: ['mood', 'practice'], target: 'team', flavor: 'Contains every power ballad ever written, in every language, at once.', effect: 'squad mood +15', up: '5% SPIRIT', down: '2% DRAMA', out: { up: 'Three-part harmony. Someone cries. The team leaves as brothers. (+25)', mid: 'Off-key, off the rails, exactly right. (+15)', down: 'Someone hogs the mic for two straight hours and the room turns on him. (+8 team, −10 him)' } },
  { id: 'hologram', name: 'STUDY-BUDDY HOLOGRAM', short: 'HOLO', rarity: 'common', context: ['academic'], target: 'player', flavor: 'A tutor of light. Extremely thorough. Slightly too thorough.', effect: 'the exam story: he passes · dropped on a player otherwise: a study week, +1 BRAINS, −10 energy', up: '2% BREAKTHROUGH', down: '10% SCANDAL', out: { up: 'Something CLICKS. He aces it — and his game IQ came along. (+2 BRN, +8 mood)', mid: 'He passes. The hologram bows and folds itself into a point of light.', down: 'The hologram SAT THE EXAM ITSELF wearing his face. It scored a perfect 100, which was the giveaway. (+15 heat, 1w hearing)' } },
  { id: 'vip', name: 'KAPPA NEBULA VIP PASS', short: 'VIP', rarity: 'rare', context: ['recruiting'], target: 'prospect', flavor: 'Laminated. Glowing. Slightly sticky.', effect: 'the recruit you DROP it on falls in love with campus: commitment +25%', up: '5% INTEL', down: '25% DRAMA', out: { up: 'He plays pickup at 3am while your assistant takes notes. +25% AND fully revealed.', mid: 'He leaves wearing one of your team caps. (+25%)', down: 'The VIP night ends in a brawl over somebody\'s cheerleader girlfriend. (−20%)' } },
  { id: 'boots', name: 'GRAVITY BOOTS', short: 'BOOTS', rarity: 'rare', context: ['practice'], target: 'player', flavor: 'Every step is leg day.', effect: 'a body permanently rebuilt: +ATHLETICISM', up: '2% BREAKTHROUGH', down: '25% INJURY', out: { up: 'He becomes LOAD-BEARING. The floor creaks respectfully. (+2 ATH, +2 more)', mid: 'His footsteps now have bass. (+2 ATH)', down: 'His ankle files a formal complaint. (+1 ATH, 2w out)' } },
  { id: 'wallet', name: 'THE REFEREE\'S "LOST" WALLET', short: 'WALLT', rarity: 'rare', context: ['pregame'], target: 'team', flavor: 'You found it. You could return it. You could return it COURTSIDE.', effect: 'tonight, the whistle leans your way', up: '2% WINDFALL', down: '50% SCANDAL', out: { up: 'He pockets it AND comps you his food-court vouchers. (+1¢, whistle yours)', mid: 'He pockets it without breaking eye contact. Ties go to you.', down: 'He photographs you accepting his acceptance and forwards everything to the league. (+25 heat)' } },
  { id: 'cloak', name: 'CLOAKING DOUBT', short: 'CLOAK', rarity: 'rare', context: ['pregame'], target: 'team', flavor: 'A device that makes your game plan look like every game plan.', effect: "opponent's plan is random tonight", up: '5% INTEL', down: '2% DRAMA', out: { up: 'Their coach prepares for four different teams and, in the film room, briefly weeps. You can HEAR which plan they panicked into.', mid: 'Tonight, their scouting report is a coin flip.', down: 'The cloak hums so loudly your own huddle gets confused for a minute. It still works. (−3 team mood)' } },
  { id: 'whistle', name: 'THE GOLDEN WHISTLE', short: 'WHSTL', rarity: 'common', context: ['practice'], target: 'player', flavor: 'Blow it once and one player hears nothing else for a week.', effect: 'private training session: +1 attribute', up: '5% BREAKTHROUGH', down: '2% DRAIN', out: { up: 'A week of one-on-one mornings and he finds TWO new gears. (+2)', mid: 'He comes out sharper. (+1)', down: 'The work lands but he leaves the week on fumes. (+1, −15 energy)' } },
  { id: 'talk', name: 'THE QUIET WORD', short: 'TALK', rarity: 'common', context: ['mood', 'practice'], target: 'player', flavor: 'A closed office door and two cups of nebula tea.', effect: 'a private talk: mood +20, energy +10', up: '5% SPIRIT', down: '2% DRAMA', out: { up: 'He tells you the real thing. Everything after this is easier. (+30 mood)', mid: 'Tea, silence, then the truth. He walks out lighter. (+20/+10)', down: 'You said the wrong name at the wrong moment. He leaves colder than he came. (−8)' } },
  { id: 'mixtape', name: 'HYPE MIXTAPE', short: 'TAPE', rarity: 'common', context: ['mood'], target: 'player', flavor: 'Forty minutes of his own highlights set to Quadran war drums.', effect: 'one player: mood +25', out: { mid: 'He watches his own highlights until curfew and walks into practice like a season finale.' } },
  { id: 'nappod', name: 'NAP POD PASS', short: 'NAP', rarity: 'common', context: ['practice', 'pregame'], target: 'player', flavor: 'One session in the faculty-only zero-G sleep pod. Do not tell the faculty.', effect: 'one player: energy +40', out: { mid: 'Nine dreamless zero-G hours; he wakes up ready to fight a moon.' } },
  { id: 'telescope', name: 'STARLIGHT TELESCOPE', short: 'SCOPE', rarity: 'rare', context: ['practice'], target: 'player', flavor: 'Point it at a player and it shows you who they could be.', effect: 'one player: potential +2', up: '5% BREAKTHROUGH', down: '2% DRAMA', out: { up: 'He stares for a long time, then goes back inside and starts over, bigger. (+4 potential, +8 mood)', mid: 'The ceiling it found is higher than the one he\'d accepted. (+2 potential)' } },
  { id: 'protein', name: 'PROTO-PROTEIN BARS', short: 'BARS', rarity: 'common', context: ['practice', 'pregame'], target: 'team', flavor: 'Tastes like drywall. Works like a miracle.', effect: 'squad energy +8', out: { mid: 'The squad chews through the crate with the joyless efficiency of professionals. Legs feel new.' } },
  { id: 'poster', name: 'SIGNED LEGEND POSTER', short: 'POSTR', rarity: 'common', context: ['mood', 'practice'], target: 'team', flavor: 'A holo-poster of the greatest to ever do it, signed in three dimensions.', effect: 'squad mood +10', out: { mid: 'Everyone pretends not to look at it. Everyone looks at it.' } },
  { id: 'alarm', name: 'FIRE ALARM CODES', short: 'ALARM', rarity: 'rare', context: ['pregame'], target: 'team', flavor: "The access codes to the visitors' hotel fire panel. You didn't buy these. Officially.", effect: 'their hotel evacuates at 3am — they play tired', up: '2% WINDFALL', down: '25% SCANDAL', out: { up: 'It fires THREE times. Their star spends the night on the curb in a blanket. You feel bad. You feel great.', mid: 'The alarm sings at 3am. Tonight their legs answer half a beat late.', down: 'So does the hotel security cam feed, straight to the league office. (+15 heat)' } },
  { id: 'seer', name: "THE SEER'S LENS", short: 'LENS', rarity: 'rare', context: ['recruiting'], target: 'prospect', flavor: 'Ground from the eye of a dead comet. Shows only true things.', effect: 'the recruit you DROP it on: fully revealed (refuses one you already know cold)', out: { mid: 'A random un-fully-known prospect resolves into perfect focus — every number, every ceiling, true.' } },
  { id: 'check', name: "BOOSTER'S BLANK CHECK", short: 'CHECK', rarity: 'rare', context: ['recruiting'], target: 'prospect', flavor: 'The amount is blank. The strings are not.', effect: 'the recruit you DROP it on signs. Today.', up: '2% LOOT', down: '25% SCANDAL', out: { mid: 'He signs on the spot. The booster winks at you across the parking lot for an uncomfortably long time.', down: 'So does the check — into a league evidence folder. THE SUBPOENA lands in 4 weeks. (+20 heat)' } },
  // the supply-closet drip (small, meant to be SPENT)
  { id: 'patch', name: 'PATCH KIT', short: 'PATCH', rarity: 'common', supply: true, context: ['injury'], target: 'player', flavor: 'Tape, spray, and a lie about how bad it looked.', effect: 'MEDICAL · an injury: one week off it, any week, compounding', down: '5% INJURY', out: { mid: 'Tape, spray, done. N weeks → N−1 (0 = he jogs it off).', down: 'The tape lied about how bad it looked. +1 week.' } },
  { id: 'snakeoil', name: 'SNAKE OIL', short: 'OIL', rarity: 'common', supply: true, context: ['injury'], target: 'player', flavor: 'From a man with a cart, a hat, and no fixed address.', effect: 'MEDICAL · an injury: usually a week off it. Usually.', up: '10% BREAKTHROUGH', down: '10% INJURY', out: { up: 'Works ABSURDLY well: −2 weeks.', mid: '−1 week (70%) · or nothing at all (30%)', down: 'It was actual snake. A rash and +1 week.' } },
  { id: 'cryo', name: 'CRYO CHAMBER TOKEN', short: 'CRYO', rarity: 'rare', context: ['injury'], target: 'player', flavor: 'One session in the pro clinic\'s freezer. Bring a blanket.', effect: 'MEDICAL · an injury: two weeks off it', up: '5% BREAKTHROUGH', down: '10% INJURY', out: { mid: 'The chamber hisses open. N → N−2.', down: 'A day late — frostbite on top. +1 week.' } },
  { id: 'pocketweek', name: 'A POCKET WEEK', short: 'WEEK', rarity: 'common', supply: true, context: ['away'], target: 'player', flavor: 'A localized time machine the size of a lunchbox. He lives the week; you don\'t.', effect: 'TIME · a non-injury absence (festival, exchange, suspension, the newborn…): one week less of it, compounding', up: '2% SPIRIT', down: '8% DRAMA', out: { mid: 'He lives a week of it while you blink. N → N−1.', down: 'LOST IN TIME: he steps out a week LATER, holding a newspaper from a Thursday that hasn\'t happened. +1 week.' } },
  { id: 'timeloop', name: 'THE LOCALIZED TIME LOOP', short: 'LOOP', rarity: 'rare', context: ['away'], target: 'player', flavor: 'A ring of light around one person. Inside it, Tuesday happens fourteen times.', effect: 'TIME · a non-injury absence: two weeks less of it', up: '2% SPIRIT', down: '15% DRAMA', out: { mid: 'N → N−2.', down: 'LOST IN TIME: +1 week.' } },
  { id: 'juice', name: 'VOLT JUICE', short: 'JUICE', rarity: 'common', supply: true, context: ['practice', 'pregame'], target: 'player', flavor: 'Carbonated. Possibly sentient. Definitely effective.', effect: 'one player: +25 energy', out: { mid: 'He vibrates gently for an hour. Legs: back.' } },
  { id: 'cocoa', name: 'NEBULA COCOA', short: 'COCOA', rarity: 'common', supply: true, context: ['mood'], target: 'player', flavor: 'Warm the way home planets are warm.', effect: 'one player: +12 mood', out: { mid: 'He wraps both hands around the mug and exhales a whole week.' } },
  { id: 'pass', name: 'GYM GUEST PASS', short: 'PASS', rarity: 'common', supply: true, context: ['practice'], target: 'player', flavor: 'After-hours access to the pro facility across town.', effect: 'one player: +10 XP', out: { mid: 'A night on the pro floor. The rims are the same height. Everything else is different.' } },
];
const SUPPLY_DRIP = ['patch', 'juice', 'cocoa', 'pass', 'protein', 'poster', 'snakeoil', 'pocketweek'];

// ---- ACTIONS PER SCREEN -----------------------------------------------------
const ACTIONS = {
  scouting: {
    name: '1 · SCOUTING (one board-wide move)',
    groups: [
      {
        name: 'READ THE BOARD (the intensity pyramid)', rows: [
          { id: 'filmnight', name: 'FILM NIGHT', cost: 1, scope: 'all 9', effect: '1 facet reveal each', up: '5% INTEL', down: '2% DRAIN', desc: 'Grainy feeds from nine gyms. One honest look at everybody.' },
          { id: 'roadtrip', name: 'SCOUTING ROAD TRIP', cost: 2, scope: 'top 6', effect: '1–2 reveals each', up: '10% INTEL', down: '5% SHIP', desc: 'A week in the shuttle for the six names that matter most.' },
          { id: 'workout', name: 'PRIVATE WORKOUT', cost: 3, scope: 'TARGETS (3)', effect: '2–3 reveals each', up: '25% INTEL', down: '10% SCANDAL', desc: 'Your gym, your drills, your stopwatch — the TARGETS, read deep.' },
        ],
      },
      {
        name: 'SEARCH THE GALAXY (regions are rarity dials — WHO, never how good)', rows: [
          { id: 'reccenter', name: 'LOCAL REC CENTER', cost: 0, scope: 'grounded-safe', effect: '1 prospect · terrans only', up: '2% INTEL', down: '5% DRAMA', desc: 'Terrans only. And kids notice where you went looking.' },
          { id: 'home', name: 'HOME PLANET', cost: 1, scope: 'grounded-safe', effect: '1 prospect · 85% terran', up: '2% INTEL', down: '2% SHIP', desc: 'Terrans wall to wall — with the rare off-world transfer in the stands.' },
          { id: 'nebula', name: 'LOCAL NEBULA', cost: 2, scope: '', effect: '1 prospect · specialists common', up: '5% INTEL', down: '10% SHIP', desc: 'Hexid blurs, Quadran storms, Petran walls. Real specialists, mild turbulence.' },
          { id: 'outerrim', name: 'OUTER RIM', cost: 3, scope: '15% two', effect: 'every species incl. NIMBUS (12%)', up: '5% LOOT', down: '25% SHIP', desc: 'The strangest talent in known space — and the only charted skies where a Nimbus drifts by.' },
          { id: 'deepcore', name: 'DEEP CORE (unlock via star charts)', cost: 3, scope: '20% two', effect: 'rarest species most often', up: '10% LOOT', down: '25% SHIP', desc: 'The old charts were real. Gravity that eats ships.' },
        ],
      },
    ],
  },
  recruiting: {
    name: '3 · RECRUITING (one board-wide move)',
    groups: [
      {
        name: 'YOUR OWN WORK (low risk, low reward, your name)', rows: [
          { id: 'groupchat', name: 'THE GROUP HOLO-CHAT', cost: 0, scope: 'all 9', effect: '+2–6% commit · 1% per-name backfire', up: '2% SPIRIT', down: '2% DRAMA', desc: 'Nine names, one thread, zero budget. Presence counts for something.' },
          { id: 'letters', name: 'HOLO-LETTERS', cost: 1, scope: 'all 9', effect: '+4–10% · 2% backfire', up: '2% SPIRIT', down: '2% DRAMA', desc: 'Nine handwritten holograms. Safe. Modest. Sincere.' },
          { id: 'openhouse', name: 'CAMPUS OPEN HOUSE', cost: 2, scope: 'top 6', effect: '+6–14% · 4% backfire', up: '5% SPIRIT', down: '5% DRAMA', desc: 'The top six visit at once. The gravy-fries do most of the talking.' },
          { id: 'dinner', name: 'THE DINNER', cost: 3, scope: 'TARGETS (3)', effect: '+10–20% · 6% backfire', up: '10% SPIRIT', down: '10% DRAMA', desc: 'You, the TARGETS, and a chef with too many arms. Warm, honest, effective.' },
        ],
      },
      {
        name: "THE BOOSTER'S HELP (huge swings, his fingerprints — mostly)", rows: [
          { id: 'carepack', name: 'BOOSTER CARE PACKAGES', cost: 1, scope: 'all 9', effect: '+7–15% · 6% backfire', up: '5% SPIRIT', down: '10% SCANDAL (deniable — his name is on the crates)', desc: 'Nine crates "from a fan". Sneakers that fit suspiciously well.' },
          { id: 'skybox', name: 'THE SKYBOX WEEKEND', cost: 2, scope: 'top 6', effect: '+10–24% · 8% backfire', up: '5% SPIRIT', down: '15% SCANDAL (deniable — you were "not there")', desc: "The top six watch a pro game from the booster's skybox. Amateurism weeps." },
          { id: 'bagdrop', name: 'THE BAG DROP', cost: 3, scope: 'TARGETS (3)', effect: '+16–40% · 12% backfire', up: '10% SPIRIT', down: '25% SCANDAL (deniable, barely)', desc: 'The TARGETS each find a duffel bag in their locker. Nobody counts it out loud.' },
        ],
      },
    ],
  },
  practice: {
    name: '2 · PRACTICE (mandatory — pick one and HOLD RUN)',
    groups: [
      {
        name: 'TRAIN (XP — levels bank +2 points YOU place)', rows: [
          { id: 'shootaround', name: 'SHOOTAROUND', cost: 1, effect: '2–4 XP · −3 energy', up: '2% SPIRIT', down: '2% INJURY', desc: 'Racks of shots under the practice dome. Injury cause: "rolled an ankle stepping on a loose ball. A loose ball. In shootaround."' },
          { id: 'scrimmage', name: 'FULL SCRIMMAGE', cost: 2, effect: '4–6 XP · −6 energy', up: '5% SPIRIT', down: '5% INJURY', desc: 'Starters against bench, refs bribed with sandwiches. Cause: "took a charge from a teammate who forgot it was scrimmage."' },
          { id: 'twodays', name: 'TWO-A-DAYS', cost: 3, effect: '6–9 XP · −10 energy · bias 1', up: '5% BREAKTHROUGH', down: '10% INJURY', desc: 'Morning session, evening session, complaints filed in between. Cause: "legs gave out halfway through the evening session."' },
        ],
      },
      {
        name: 'SHARPEN (direct points — the drill picks where) · discovered via KNOWLEDGE', rows: [
          { id: 'asteroid', name: 'ASTEROID PUSHES', cost: 2, effect: '+1 ATH squad · 2–4 XP · −10 energy · bias 1', up: '5% BREAKTHROUGH', down: '10% INJURY', desc: 'The whole squad pushes the practice asteroid up the gravity ramp until something changes.' },
          { id: 'meteor', name: 'METEOR DODGING', cost: 3, effect: '+1 SKL +1 ATH · −12 energy · bias 2', up: '10% BREAKTHROUGH', down: '25% INJURY', desc: 'Live meteors, real stakes. Cause: "dodged eleven meteors with a backflip each. The twelfth did not care about backflips."' },
          { id: 'sparring', name: 'GRAVITY CAGE', cost: 2, effect: '+1 FRC · −10 energy · bias 1', up: '5% BREAKTHROUGH', down: '10% INJURY', desc: 'Double gravity, one ball, no whistle, everybody in. What comes out is meaner.' },
          { id: 'filmroom', name: 'THE FILM CRYPT', cost: 2, effect: '+1 BRN · −6 energy', up: '5% BREAKTHROUGH', down: '5% DRAMA', desc: 'Ten thousand seasons of galactic film fed straight into the room until the floor slows down.' },
          { id: 'dreamlab', name: 'THE DREAM LAB', cost: 3, effect: '50%/player: +1 potential · −4 energy', up: '5% BREAKTHROUGH', down: '10% DRAMA', desc: 'The squad sleeps in tanks and practices in shared lucid dreams. Ceilings are negotiable in there.' },
        ],
      },
      {
        name: 'RECOVER (meters back)', rows: [
          { id: 'rest', name: 'TEAM REST', cost: 0, effect: '+21 energy · +4 mood', up: '2% SPIRIT', down: '5% DRAMA', desc: 'Cancel everything. Danger cause: "unsupervised, went quad-racing in a crater on a borrowed grav-board."' },
          { id: 'bonfire', name: 'BONFIRE NIGHT', cost: 1, effect: '+6 energy · +14 mood', up: '5% SPIRIT', down: '2% DRAMA', desc: 'Marshmallows, ghost stories, a guitar with eleven strings. The squad remembers it likes itself.' },
        ],
      },
    ],
  },
  pregame: {
    name: '4 · THE PREGAME MOVE (mandatory, once)',
    groups: [
      {
        name: 'SPEECHES — standard (known from day one)', rows: [
          { id: 'showtime', name: 'SHOWTIME — "SHOOTERS SHOOT"', effect: 'squad +3–4 SKL · −3–4 ATH, guaranteed', desc: 'Shooters shoot. Rise over anything they pack in — and forget about running.' },
          { id: 'rungun', name: 'RUN & GUN — "RUN THEM RAGGED"', effect: 'squad +3–4 ATH · −3–4 SKL', desc: 'Outrun everything. Seven seconds or less. Nobody said anything about making shots.' },
          { id: 'lockdown', name: 'LOCKDOWN — "MAKE THEM HATE THE BALL"', effect: 'squad +3–4 FRC · −3–4 BRN', desc: 'Full-court terror. Thinking is for the bus ride home.' },
          { id: 'clockwork', name: 'CLOCKWORK — "USE YOUR BRAINS"', effect: 'squad +3–4 BRN · −3–4 FRC', desc: 'The system. Every cut scripted. Nobody gets angry, nobody gets a steal.' },
          { id: 'rally', name: 'THE RALLY — "THIS IS OUR HOUSE"', effect: 'no attributes: 48% squad MOOD +12 · 48% nothing · 2% the roof comes off (+25) · 2% it lands wrong (−20)', desc: 'Get them riled up.' },
          { id: 'easy', name: 'TAKE IT EASY — "SAVE SOMETHING FOR NEXT WEEK"', effect: 'floor players burn 40% less ⚡ · you play ×0.93 · a loss costs extra mood (−6 starters / −4 bench)', desc: 'Coast tonight.' },
        ],
      },
      {
        name: 'SPEECHES — premium (found in stories · 3-week recharge)', rows: [
          { id: 'warcry', name: 'THE WAR CRY — "TONIGHT WE ARE ANIMALS"', effect: 'squad +5–6 FRC · −2–3 BRN (a better trade)', desc: 'An old Quadran battle chant. The paint peels.' },
          { id: 'zenmind', name: 'THE STILL POND — "BE THE STILL POND"', effect: 'squad +5–6 BRN · −2–3 FRC', desc: 'The oracle taught you this one. The gym goes quiet inside.' },
          { id: 'stardust', name: 'STARDUST — "BE UNGUARDABLE"', effect: 'squad +5–6 SKL · −2–3 ATH', desc: 'A retired Nimbus legend whispered it once. Nets have feared it since.' },
          { id: 'engine', name: 'THE ENGINE — "LEGS ARE A LIE"', effect: 'squad +5–6 ATH · −2–3 SKL', desc: 'A Robota conditioning mantra. The floor gets smaller for everyone else.' },
        ],
      },
      {
        name: 'LAST-MINUTE INSTRUCTIONS — play the tape instead', rows: [
          { id: 'counter', name: 'COUNTER THE SET — "SIT ON THEIR OPENER"', cost: 0, effect: '35% hit (their best −3) · 20% READ (your best −3)', desc: 'You watched the tape twice. Known from day one.' },
          { id: 'medium', name: 'THE MEDIUM OF BLORGON-6 — "HE SEES THEIR WHOLE NIGHT"', cost: 2, effect: '70% hit (−4) · 5% read (−2) · 3-week recharge', desc: 'A medium in the locker room, eyes rolled back, calling their sets before they call them. (premium)' },
          { id: 'takeout', name: "THE CAPTAIN'S ORDER — \"TAKE OUT THEIR STAR. QUIETLY.\"", cost: 1, effect: '50% hit (−5) · 20% CAUGHT → the league reviews the tape Monday (2w suspension + heat) · 4-week recharge', desc: 'One hard screen, early, memorable. Nobody saw anything. Unless somebody saw. (premium)' },
        ],
      },
    ],
  },
};

// ---- THE WORLD --------------------------------------------------------------
const SPECIES = [
  { id: 'terran', name: 'Terran', tier: 1, bias: '—', bands: '38/30/20/10/2', size: '176–204cm · 76–110kg', rarity: 'everywhere', desc: 'Baseline bipeds. Balanced in every direction, rarely blessed in any. The galaxy simply outrolls them.' },
  { id: 'hexid', name: 'Hexid', tier: 2, bias: 'ATH', bands: '20/28/26/18/8', size: '158–186cm · 48–80kg', rarity: 'pretty common', desc: 'Insectoid on six legs and six tiny high-tops. Nothing in the league moves faster, or lower.' },
  { id: 'quadran', name: 'Quadran', tier: 2, bias: 'ATH+FRC', bands: '20/28/26/18/8', size: '196–224cm · 118–175kg', rarity: 'pretty common', desc: 'Hunched heavy-worlder with four arms and tusks. The upper pair handles the ball; the lower pair handles you.' },
  { id: 'petran', name: 'Petran', tier: 2, bias: 'FRC', bands: '20/28/26/18/8', size: '188–214cm · 140–200kg', rarity: 'pretty common', desc: 'Stone golem, cracked plating, patient as geology. Every drive dies on it — and every shot it takes is an actual brick.' },
  { id: 'oculid', name: 'Oculid', tier: 2, bias: 'BRN', bands: '10/20/25/25/20', size: '152–178cm · 45–75kg', rarity: 'fairly rare', desc: 'Four legs, four tiny high-tops, and eyes on stalks that see every pocket you dribble into.' },
  { id: 'gelid', name: 'Gelid', tier: 3, bias: 'SKL+BRN', bands: '10/20/25/25/20', size: '168–200cm · 60–95kg', rarity: 'fairly rare', desc: 'A liquid body stacked in rings, melting into its own puddle. Flows through any defense and sees every passing lane. (they/them · glass body)' },
  { id: 'robota', name: 'Robota', tier: 3, bias: 'SKL', bands: '10/20/25/25/20', size: '186–212cm · 120–170kg', rarity: 'fairly rare', desc: 'Factory-built baller: piston shins, a jumper machined to tolerance, a motor that never files a complaint. (they/them · glass body)' },
  { id: 'nimbus', name: 'Nimbus', tier: 3, bias: '—', bands: '2/10/20/30/38', size: '188–218cm · 40–62kg', rarity: 'very rare', desc: 'Translucent gas-form floating above a pair of empty regulation high-tops. Balanced everywhere, blessed almost always. (they/them · glass body)' },
];

const LEAGUE = [
  { name: 'Aurum Orsos', planet: 'Montalvo', region: 'Western Rim', colors: ['#2D68C4', '#F2A900'] },
  { name: 'Voidfiends', planet: 'Duqat', region: 'Core Worlds', colors: ['#5B21B6', '#E6D5FF'] },
  { name: 'Skyhawks', planet: 'Kanzar', region: 'Central Plains Belt', colors: ['#C8102E', '#FFE9E9'] },
  { name: 'Voidcats', planet: 'Kentaurus', region: 'Bluegrass Nebula', colors: ['#177245', '#C9F2E4'] },
  { name: 'Star Heels', planet: 'Novacarina', region: 'Eastern Drift', colors: ['#4A9ED4', '#0B2537'] },
  { name: 'Voidhounds', planet: 'Zagnar Prime', region: 'Northwest Expanse', colors: ['#C25E10', '#FFE1C9'] },
];

const UT_TEAMS = [
  'Kro Nebular Wraiths', 'Vantor-3 Sun Eaters', 'Ophee Comet Queens', 'Drexal Iron Choir',
  'Bulwark-9 Gravity Saints', 'Xyphos Star Serpents', 'Molt Hatchling Kings', 'Verdant-2 Moss Titans',
  'Kessel Minor Void Larks', 'Thrace-7 Plasma Prophets', 'Ummber Dust Devils', 'Neon Roa Lightbenders',
];
const UT_GIMMICKS = [
  'undefeated in three galaxies', 'all-Lithoid front line, all of it angry', 'coached by a sentient cloud with a whistle',
  'won their conference by forfeit — nobody will play them', 'their home arena orbits inside a star',
  'their fans are, legally speaking, a swarm', 'every player is the same age, which is 9,000',
  'run one play. It has never been stopped.', 'their point guard is wanted in two systems', 'they practice in double gravity, for fun',
];

const NAMED_CHARACTERS = [
  { name: 'THE DEAN', role: 'The school made flesh. By the book, coffee for herself, requisition forms as leverage. Mother of Minervva.' },
  { name: 'THE BOOSTER(S)', role: 'Chrome suits, cigars, plausible deniability. Illegal help that mostly lands on his name. Patience measured in heat.' },
  { name: '“SCOOP” QUAZAR', role: 'The press. Fedora, antennae, a recorder that is always running. Asks about LAST week; pays a stipend for straight answers.' },
  { name: 'MINERVVA', role: "The Dean's daughter. She's good. That's the problem. Signs via THE EMPTY LOCKER." },
  { name: 'UNIT-7', role: 'The droid a booster built. Perfect jumper, coolant blood, species "undeclared", mood pinned at 100. It does not feel. Probably.' },
  { name: 'THE MECH-GOBLINS', role: 'Starbase repair crew. Cheap, "mostly honest", invoices engraved on small meteors. Installed a hot tub once.' },
  { name: 'THE SMUGGLER CAPTAIN', role: 'The debt ladder\'s face. A jeweler\'s eye for your best player. Debts here don\'t clear.' },
  { name: 'THE ORACLE', role: 'A hut, a light, a very old hoop on an uncharted moon. Teaches methods your species has not invented yet.' },
  { name: 'COACH XARTER', role: 'The mind-controlling trainer. Takes one pupil a year. Results guaranteed. Side effects: biting.' },
  { name: 'THE PETRAN MONKS', role: 'All-mineral diet. Correspondence by stone tablet. Occasionally right.' },
];

// The name pool: one unisex pool of galactic deities (form is rolled
// separately — femme/masc/x is body+pronouns, not the name).
const NAME_POOL_NOTE = 'Player, prospect and walk-on names all draw from one ~190-name pool of galactically-mangled deities (double letters are the house style: Zeuxx, Thorr, Oshunn, Amaterasuu). Names are unique among active players; the pool spans Greek, Norse, Egyptian, Yoruba/African, Mesoamerican, Slavic, Celtic, Asian, Polynesian, Mesopotamian, Hindu and more — plus a saints row (Ignatiux, Xavyer, Benedix...).';
const NAME_SAMPLE = ['Zeuxx', 'Apollyx', 'Hermezz', 'Poseidrox', 'Odynn', 'Thorr', 'Lokee', 'Raa', 'Anubix', 'Shangox', 'Ogunn', 'Anansix', 'Quetzall', 'Kukulkann', 'Perunn', 'Lughh', 'Raijinn', 'Wukongg', 'Mauii', 'Pelee', 'Gilgamezz', 'Indrax', 'Hanumann', 'Ignatiux', 'Seraphym', 'Athenna', 'Artemyx', 'Nyxx', 'Gaiaa', 'Frigga', 'Skadee', 'Bastett', 'Sekhmett', 'Oyaa', 'Yemojaa', 'Inannaa', 'Tiamatt', 'Lakshmee', 'Durgaa', 'Kalii', 'Guanyinn', 'Amaterasuu', 'Ixchell', 'Marzannaa', 'Brigidd', 'Rhiannonn', 'Louhee', 'Fortunaa', 'Circee', 'Andromedaa', 'Chandraa'];

const FLAVOR_POOLS = [
  { name: 'PROSPECT BLURBS (8)', items: ['Plays angry. Studies angrier.', 'Homeschooled on a mining barge. Unbothered by crowds.', 'Three-time intramural MVP of an orbital prep academy.', 'His coach says he\'s "a project." His transcript says the same.', 'Genuinely came for the education. Weird kid. Great motor.', 'Grew four inches on the shuttle ride to the tryout.', "Dean's list. Also wanted in two systems for unpaid parking drones.", 'Warms up in silence. Referees find it upsetting.'] },
  { name: 'WALK-ON BLURBS (4)', items: ['Won the halftime shooting contest twice. Insists that counts.', 'Showed up to tryouts in jeans. Made every layup.', 'The rec-center legend your assistant keeps mentioning.', 'Filed the walk-on paperwork in crayon. Enthusiasm: elite.'] },
  { name: 'FESTIVALS (8)', items: ['the High Festival', 'the Harvest Festival', 'the Moon-Hatching', 'Ancestor Week', 'the Feast of the Second Sun', 'the Great Molting', 'Gravity Day', 'the Festival of a Thousand Cousins'] },
  { name: 'RIDE ANTICIPATION (5 — every trip opens with one, ending in "…")', items: ['The ride home starts quiet. The void hums past the windows…', 'The bus threads the dark between two systems, running lights blinking…', 'Warp speed. The stars stretch into lines and the cabin goes still…', 'The long haul home. The autopilot clears its throat…', 'Halfway home, deep in nobody\'s sky…'] },
  { name: 'TRAVEL OUT (5)', items: ['The scouting report is taped to the cabin wall and somebody has already drawn a mustache on their center.', 'The bus climbs out of the atmosphere on schedule. The starters sleep. The freshmen press their faces to the glass.', 'Away game. The driver puts on the pregame playlist; it is one song, eleven hours long, and nobody complains.', 'The team bus points its nose at a stranger\'s sun. Everyone chews the same brand of gum. Ritual is ritual.', 'Departure is smooth. Somewhere behind you, your home arena shrinks to a bright dot with a scoreboard in it.'] },
  { name: 'TRAVEL HOME, UNEVENTFUL (5)', items: ['Travel was uninspiring. The void between planets is famously boring; the team sleeps in shifts and argues about the aux cable.', 'Eleven hours of warp. Somebody brought a deck of cards with 51 cards in it. The mystery of the missing card outlasts the trip.', 'The team bus hits light speed on schedule for once. The driver takes the applause with one modest antenna.', 'A quiet ride. The rookies watch the stars go by; the seniors have seen stars before and sleep like cargo.', 'The autopilot plays smooth jazz for six parsecs. Nobody knows how to turn it off. The team arrives strangely calm.'] },
  { name: 'SCAN FLAVOR (3)', items: ['Scan complete. New names on the board:', 'The long-range array pings twice. Fresh dossiers:', 'The scout-scoop comes back full. On the board:'] },
];

// ---- THE MODULE KIT ---------------------------------------------------------
// The modular proposal: a few FIXED STRUCTURES (already true of every story in
// the game) + pluggable MODULES so one story can play out many ways. The
// structures below are descriptive today; the module slots are the build plan.
const STRUCTURES = [
  {
    id: 'S1', name: 'THE NOTICE', shape: 'text → tap through',
    desc: 'One beat, no choice. News, reveals, travel cards, echo payoffs. The voice does all the work.',
    examples: 'travel, notice, reveal, goblin_bill, espresso_crash, newborn, breakthrough',
  },
  {
    id: 'S2', name: 'THE FORK', shape: 'setup → 2–3 choices → each rolls ▲up / ■mid / ▼down',
    desc: 'The workhorse. Every choice prints its two tails; want:love/hate sets the player\'s face the moment you pick. The numbers never lie. The people sometimes do.',
    examples: 'diet, streamer, voidpup, dean_visit, scandal, drama, vendor... (most of the registry)',
  },
  {
    id: 'S3', name: 'THE PROMISE', shape: 'fork → a choice schedules a FUTURE BEAT (N weeks) → the payoff reads what actually happened',
    desc: 'Choices with a fuse. The player goes TENSE (worried sprite) until the result lands. The best ones CHECK reality: THE FROZEN ONE\'s promise reads who actually stood on the floor at the horn.',
    examples: 'frozen (promise at PLAY → kept/broken/unfair at the horn), festival (leave → return), cheerleader (→ newborn, 6–9w), check (→ subpoena, 4w), locker (→ daughter_favor 4w / droid_probe 3w)',
  },
  {
    id: 'S4', name: 'THE CHAIN', shape: 'a resolution jumps DIRECTLY into another story (next:)',
    desc: 'Doors between stories, same sitting or same beat. Down-tails that escalate into the scandal storyline are the house pattern: the crime is the cause line, the class pool owns what happens next.',
    examples: 'cheating→scandal, rampage→scandal, booster_pod→scandal, debt→locker, oracle→grounded, festival start→ask',
  },
  {
    id: 'S5', name: 'THE LADDER', shape: 'state-triggered escalation, never random',
    desc: 'The world reacts to a number crossing a line: heat ≥50 → interference; combined ≥75 → the summons; DNPs past his PATIENCE → the frozen one (at PLAY); 0¢ stranded → the debt ladder; ≤1¢ → the bailout. Pressure valves, not dice.',
    examples: 'interfere_school/boost → summons · frozen · debt → locker · bailout',
  },
  {
    id: 'S6', name: 'THE TABLE', shape: 'no choice — a weighted outcome table IS the story',
    desc: 'The player already made the choice weeks ago; now the galaxy rolls. Weights are the tuning dial and the rare top entry is always a jackpot ("1 in 50, and you WON it").',
    examples: 'festival_return (6 outcomes), cut_revenge (3 variants), locker\'s walk-on gem roll',
  },
];

const MODULE_SLOTS = [
  {
    slot: 'OPENER', status: 'already modular in places',
    what: 'The cause/arrival line. Sources already inject causes into the class pools (every drill has its own injury line; every scandal names its crime), and RIDE_ANTIC rotates the travel opener.',
    plan: 'Formalize: every story gets an opener POOL instead of one fixed line. Adding voice = adding lines, zero logic.',
  },
  {
    slot: 'DILEMMA', status: 'to build',
    what: 'The choice set. Today each story hard-codes its 2–3 buttons.',
    plan: 'Make choice-sets swappable: the same setup (say, a player wants time off) can offer different dilemma modules — the bargain (full/half/no), the interrogation (ask why), the delegation (let the captain decide). The game picks one at spawn → the "same" story replays differently.',
  },
  {
    slot: 'OUTCOME', status: 'pattern exists (festival_return)',
    what: 'What actually lands. Today most forks have exactly one up/mid/down text per choice.',
    plan: 'Outcome POOLS per tail: three different "it went great" payoffs, rolled. Shared outcome modules (an injury table, a mood table, a heat table) reused across stories so new stories are mostly prose.',
  },
  {
    slot: 'ECHO', status: 'engine support exists (futureBeats)',
    what: 'The scheduled follow-up: weeks + payoff. Promise checks, bills, probes, returns.',
    plan: 'Pluggable echoes: any story can bolt on "…and in N weeks, [module]" — a thank-you, a relapse, a press callback (Scoop already asks about last week; he could ask about THIS).',
  },
  {
    slot: 'CAST', status: 'partly there (figure: dean/booster/scoop/side)',
    what: 'Who delivers it. The bailout already runs one script with three skins (dean/booster/scoop, each with different odds).',
    plan: 'More one-script-many-skins stories: the same favor asked by the dean vs the booster IS two stories to the player.',
  },
];

const MODULE_EXAMPLE = `// A story authored the modular way (the target format — plain data, no code):
{
  id: 'timeoff',                    // structure: S3 THE PROMISE
  who: 'player',
  opener: [                         // OPENER pool — one is rolled
    'He\\'s at your door with a packed duffel bag.',
    'His hatch-mother called the front office. Twice.',
    'A printed leave form is on your desk, filled out in perfect block letters.',
  ],
  dilemma: 'bargain',               // DILEMMA module: full / half / refuse
  outcomes: {                       // OUTCOME pools per tail (rolled)
    full:   { table: 'glorious_return' },   // shared module: crutches/married/glowing/abs/...
    half:   { table: 'modest_return' },
    refuse: { table: 'resentment' },        // shared module: channels-it / cold / cousins-holo
  },
  echo: { weeks: '+1 after return', module: 'return_reveal' },
}
// New content then = new openers, new tables, new skins — I wire the format
// into data.ts once and stories become prose-only work.`;

// ---- TUNING CONSTANTS (the dials) -------------------------------------------
const CONSTANTS = [
  ['Season length', '10 league weeks (6 teams, double round robin) + 3 UT weeks (QF/SF/FINAL)'],
  ['Stipend', '+5¢/week · cache max 9¢ · erodes from season 21 (mortality is a bill)'],
  ['Roster / bag / board', '9 players · 8 bag slots (+ the notebook, forever) · 9 prospects'],
  ['Meters', 'baseline 75 — natural recovery drifts HOME, never past it; the extremes belong to stories'],
  ['Levels', 'cap 10 · need = 20 + 12×level XP · each level banks +2 coach-placed points'],
  ['Weekly stories', '1 + 40% a second · Scoop 30% (post-game) · dean 30% · booster 30% · supply 50%'],
  ['Ride home', 'broke: 10% debt · else 25% voyage (10% of those: alumni) · else uneventful'],
  ['Hot seat', 'interfere at 50 heat (re-arms <40) · summons at 75 combined, 50%/week · offseason: 10% alumni encounter'],
  ['On fire', 'lights at 25+ pts (+20% everything) · out below 12 pts or a night without minutes'],
  ['Frozen one', 'per-player PATIENCE 2–6 games; knocks at PLAY; again a full patience later'],
  ['Cut revenge', 'every cut player, 2–6 weeks into the season'],
  ['Pro departures', 'OVR 72+ gets pro scouts in the dorm lobby at season end'],
  ['THE SLIDE', 'conference AI floors 62/55/49/44/38 (reshuffled every summer, settled to tier) · you start ~47 (4th–5th) · THE BIG BANG: first round 62–72 · semi 68–78 · final 72–82 — never sized to you'],
  ['THE RUBBER BAND', 'fieldShift: +3 per BIG BANG title (cap +9) · −2 per season without a tournament win (floor −6) · full on the champions, half on the conference tiers'],
  ['Absence kinds', 'INJURY (medicine: patch −1, snake oil, cryo −2, ice ½, the vial) vs AWAY (time machines: pocket week −1, time loop −2) — each refuses the other; every early return carries a small +1-week risk'],
  ['Recruit reveal', 'three looks: a digit · the other digit · THE WHOLE PICTURE (abilities + ceiling, exact). No clouds. Opening board / rec center / home roll a band DOWN; nebula and outer rim straight; deep core best-of-two'],
  ['Spikes', 'half of all players carry a personal spike: one attribute ×2, its opposite ×0.55 — fierce guards, thinking centers'],
  ['Season close', 'THE BOOKS CLOSE (season result dialogue) → one GRADUATION dialogue per senior (his card) → the dean\'s RETIRE question when you press the button'],
  ['The grade', 'ROSTER shows F–S for the SLOT: backcourt reads BRN ×1.5 / ATH ×0.5, frontcourt the mirror, wing even; size fit XS→XL backcourt 1/1/.92/.84/.76 (frontcourt mirrored, wing .92 at the extremes) · S ≥80 · A 65 · B 50 · C 35 · D 20 · F'],
  ['No percentages', 'choices/actions print WORDS only: ▲/▼ tails weighted dim (≤5) · plain (≤12) · bright (≤35) · blinking (>35); the wheel shows an arc, not a number'],
  ['Injury table', '<45 → 1w tweak · <75 → 2–3w · else 4–6w + level loss · tier-3 ×1.4 · bias +12/pt'],
  ['Recruit decay', '−2%/week, −4% on the LAST RESORTS row · signing day: letter 2 keeps −10, 3rd −25, 4th −45'],
];
