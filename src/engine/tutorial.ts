// THE TUTORIAL SEASON (v5 M3 — WEEK ZERO): one scripted week as season 0.
// A doomed program, week 10 of a lost season, one game to coach. Everything
// is authored — outcomes are pinned, story choices land where the script
// says — and it teaches by DOING and SHOWING, never by explaining mechanics.
// The screens themselves stay untouched: the tutorial is data, not a second
// UI. Its secret job: every character hands the coach one facility, so
// season 1 opens with the whole campus at level 1.
//
// Engine shape: `s.tutorial` is the beat index; state.ts asks
// `tutorialArrive(s, key)` as the coach reaches each screen and queues
// whatever the script hands back. The wrap-up runs as a story CHAIN (each
// beat's `next` pulls the following one), and the last beat tears the
// training wheels off: season-1 TRYOUTS on the existing selection grid.

import { STARTING_INSTRUCTIONS, STARTING_PLANS, STORIES } from './data';
import {
  REGULAR_WEEKS,
  SELECT_POOL_SIZE,
  ensureUniqueJerseys,
  genPlayerAt,
  genProspect,
  genRosterAt,
  genWalkOn,
  observe,
  prospectToPlayer,
} from './gen';
import { autoLineup, verdictLines } from './sim';
import type { GameState, MyGameResult, Player, StoryChoiceView, StoryReq, Team } from './types';
import { ATTRS, addStats, bumpAny, clamp, ovr, rand } from './util';

const TC = (key: string, label: string, opts: Partial<StoryChoiceView> = {}): StoryChoiceView => ({ key, label, ...opts });

function myT(s: GameState): Team {
  return s.teams[s.myTeamId];
}

/** The ecstatic freshman — the tutorial's future: the only Fr on the roster. */
function tutFreshman(s: GameState): Player | null {
  return myT(s).players.find((p) => p.classYear === 0) ?? null;
}

/** The injured standout — the one the patch kit is FOR. */
function tutStandout(s: GameState): Player | null {
  return myT(s).players.find((p) => p.outKind === 'injury') ?? null;
}

/** The rec-center gem (a 5★ ceiling on a board of nobodies) — wherever he is. */
function tutGem(s: GameState): { pr: import('./types').Prospect; where: 'board' | 'pending' } | null {
  const isGem = (pr: import('./types').Prospect): boolean => ovr(pr.pots) >= 70;
  const onBoard = s.prospects.find(isGem);
  if (onBoard) return { pr: onBoard, where: 'board' };
  const pending = s.pendingRecruits.find(isGem);
  return pending ? { pr: pending, where: 'pending' } : null;
}

// ---- boot: the doomed program ------------------------------------------------

/** Set season zero up and hand back the opening beats (the caller queues). */
export function tutorialBoot(s: GameState, teamId: number): StoryReq[] {
  s.myTeamId = teamId;
  s.season = 0;
  s.week = REGULAR_WEEKS; // week 10 of a lost season — one game to coach
  s.energy = 0;
  s.bag = [];
  // the gauge starts in the yellow: three characters will each hand the
  // coach +25 of faith before the week is out
  s.opSchool = 30;
  s.opFans = 35;
  s.opPublic = 35;
  s.expectation = 1;
  // the campus at LEVEL ZERO — the only place level 0 ever exists
  s.facilities = { ship: 0, gym: 0, cryo: 0, library: 0, stadium: 0, greekrow: 0 };
  // the coach knows ONE page tonight — the rally (the head cheerleader's
  // gift); the standard kit returns when the training wheels come off
  s.knownPlans = ['rally'];
  s.knownInstr = [];

  const counter = { nextId: s.nextId };
  const names = new Set<string>();

  // the league around you — real enough to have buried you all season
  for (const team of s.teams) {
    if (team.id === teamId) continue;
    team.players = genRosterAt(counter, 38 + rand(9), names);
    autoLineup(team);
    team.wins = 5 + rand(4);
    team.losses = 9 - Math.min(9, team.wins - 1);
  }

  // MY roster: a sorry bunch, mostly seniors — plus the three who matter
  const t = myT(s);
  const star = genPlayerAt(counter, 62, 3, undefined, names);
  star.outWeeks = 2;
  star.outKind = 'away';
  star.outReason = 'academic suspension';
  const standout = genPlayerAt(counter, 48, 1, undefined, names);
  standout.form = 'femme';
  standout.outWeeks = 1;
  standout.outKind = 'injury';
  standout.outReason = 'a bad tweak';
  const fresh = genPlayerAt(counter, 24, 0, undefined, names, 55); // the ceiling you can't see yet
  fresh.energy = 100;
  fresh.mood = 100;
  const roster: Player[] = [star, standout, fresh];
  // five gassed seniors and one quiet junior — the leftovers of a lost year
  for (let i = 0; i < 6; i++) {
    const p = genPlayerAt(counter, 12 + rand(13), i === 5 ? 2 : 3, undefined, names);
    p.energy = 15 + rand(20);
    p.mood = 40 + rand(20);
    roster.push(p);
  }
  t.players = roster;
  ensureUniqueJerseys(roster);
  autoLineup(t);
  t.wins = 1;
  t.losses = 8;

  // THE BIG BOARD: nine question marks, all terrible (≤15 OVR, 1–2★)
  s.prospects = [];
  s.pendingRecruits = [];
  for (let i = 0; i < 9; i++) {
    const pr = genProspect(counter, 0, 'reccenter', names);
    for (const a of ATTRS) {
      pr.attrs[a] = Math.min(pr.attrs[a], 4);
      pr.pots[a] = clamp(pr.pots[a], pr.attrs[a], 8);
    }
    pr.digits = 0;
    pr.seenSkill = false;
    pr.seenPot = false;
    pr.scoutLevel = 0;
    observe(pr);
    s.prospects.push(pr);
  }

  // week ten, on the road: the schedule's last page gets rewritten so the
  // one game that matters is yours, away — against a beatable-ish nobody
  const others = s.teams.map((x) => x.id).filter((id) => id !== teamId);
  const oppId = others[0];
  s.teams[oppId].players = genRosterAt(counter, 27 + rand(4), names);
  autoLineup(s.teams[oppId]);
  s.schedule[REGULAR_WEEKS - 1] = [
    [oppId, teamId],
    [others[1], others[2]],
    [others[3], others[4]],
  ];

  s.nextId = counter.nextId;
  s.phase = 'weekstart';
  s.storedStories = [];
  s.weekRecap = [];
  s.tutorial = 4;
  return [
    { defId: 'tut_call', beat: 'start', playerId: null },
    { defId: 'tut_dean', beat: 'start', playerId: null },
    { defId: 'tut_roster', beat: 'start', playerId: null },
    { defId: 'tut_haywire', beat: 'start', playerId: star.id },
  ];
}

// ---- the script asks for the floor as the coach reaches each screen ----------

export function tutorialArrive(s: GameState, key: string): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (key === 'facilities' && at < 6) {
    s.tutorial = 6;
    return [
      { defId: 'tut_hoop', beat: 'start', playerId: null },
      { defId: 'tut_janitor', beat: 'start', playerId: null },
    ];
  }
  if (key === 'scouting' && at < 7) {
    s.tutorial = 7;
    return [{ defId: 'tut_cheer', beat: 'start', playerId: null }];
  }
  if (key === 'practice' && at < 8) {
    s.tutorial = 8;
    return [{ defId: 'tut_practice', beat: 'start', playerId: null }];
  }
  if (key === 'recruiting' && at < 9) {
    s.tutorial = 9;
    return [{ defId: 'tut_booster', beat: 'start', playerId: null }];
  }
  if (key === 'matchup' && at < 11) {
    s.tutorial = 11;
    return [
      { defId: 'tut_scoop', beat: 'start', playerId: null },
      { defId: 'tut_bus', beat: 'start', playerId: null },
    ];
  }
  if (key === 'midgame' && at < 12) {
    s.tutorial = 12;
    const fr = tutFreshman(s);
    return fr ? [{ defId: 'fire_live', beat: 'start', playerId: fr.id, data: { pts: 26 } }] : [];
  }
  return [];
}

/** The horn's consequences, scripted: queued by finalizeGame, held until the
    score has been seen (the bookie won BIG; the notebook gets its lesson). */
export function tutorialHeld(s: GameState): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (at >= 13) return [];
  s.tutorial = 13;
  return [
    { defId: 'tut_notebook', beat: 'start', playerId: null },
    { defId: 'tut_cryo', beat: 'start', playerId: null },
  ];
}

/** Season zero has no next Monday: NEXT WEEK opens the wrap-up chain instead. */
export function tutorialWrap(s: GameState): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (at >= 14) return [];
  s.tutorial = 14;
  return [{ defId: 'tut_road', beat: 'start', playerId: null }];
}

/** The rec-center find, pinned: a ??-rated 5★ kid — the ceiling shows, the
    number doesn't. The lesson writes itself: don't cut the gem. */
export function tutorialGemify(pr: import('./types').Prospect): void {
  pr.pots = { skl: 21 + rand(3), ath: 20 + rand(3), frc: 18 + rand(3), brn: 19 + rand(3) };
  for (const a of ATTRS) pr.attrs[a] = Math.min(pr.pots[a], Math.round(pr.pots[a] * 0.45));
  pr.level = 3;
  pr.seenPot = true; // the stars show…
  pr.seenSkill = false; // …the shape doesn't…
  pr.digits = 0; // …and the rating reads ??
  pr.scoutLevel = 4;
  observe(pr);
  pr.blurb = 'Shoots until the floodlight gives out. The floodlight blinks first.';
}

// ---- the rigged game ---------------------------------------------------------

/** SEASON ZERO deals its own night: the upset lands, the freshman goes for
    26, nobody gets hurt. The bookie's printed line stays a slight underdog. */
export function tutorialRigGame(s: GameState, r: MyGameResult): void {
  const t = myT(s);
  if (!r.win) {
    const my = Math.max(r.myScore, r.oppScore + 2);
    r.oppScore = Math.min(r.oppScore, my - 2);
    r.myScore = my;
    r.win = true;
  }
  r.bookiePct = 42; // a slight underdog, as promised
  const fr = tutFreshman(s);
  if (fr && fr.outWeeks === 0) {
    let row = r.box.find((x) => x.playerId === fr.id);
    if (!row) {
      row = { playerId: fr.id, name: fr.name, pts: 0, reb: 2, stl: 1, ast: 1 };
      r.box.unshift(row);
    }
    row.pts = Math.max(row.pts, 26);
    r.box.sort((a, b) => b.pts - a.pts);
    r.mvpId = fr.id;
  }
  const lines = verdictLines(t, r.planMine, true, r.share, Math.abs(r.myScore - r.oppScore), r.box, r.forms);
  r.wheelLine = lines.wheelLine;
  r.heroLine = lines.heroLine;
}

// ---- the assistant's one-line cue above the nav ------------------------------

export function tutorialHint(s: GameState, stage: string): string | null {
  if (s.tutorial === undefined) return null;
  switch (s.phase) {
    case 'weekstart':
      return "Your roster, coach — flip the three lenses up top when you're curious. CONTINUE when you've seen enough: the campus waits.";
    case 'facilities':
      return 'Level zero, all of it. Nothing here you can afford — GRAB A MOP if you like, then CONTINUE TO SCOUTING.';
    case 'scouting': {
      if (s.pendingRecruits.length) return 'The board is full — DRAG the new kid onto it and let a nobody go. (Not the kid. Keep the kid.)';
      if (!s.scoutActWk) return "Nine question marks. Run the LOCAL REC CENTER search — it's free, and it's all the range we've got.";
      return "Board's done. CONTINUE TO PRACTICE.";
    }
    case 'practice': {
      const hurt = tutStandout(s);
      if (hurt && hurt.outWeeks > 0 && s.bag.includes('patch')) return `Drag the PATCH KIT onto ${hurt.name} — she plays tonight if you do.`;
      if (!s.trainedThisWeek) return 'The letter on each card is what they\'re worth where they stand — drag the fresh legs onto the floor. Then hold RUN: TEAM REST is all this gym allows.';
      return 'Tap a tactic on the board if you\'re curious — the bars lean. CONTINUE when you\'re done.';
    }
    case 'recruiting':
      return s.recruitActWk
        ? "CONTINUE TO THE MATCHUP — there's a game tonight."
        : 'Fire up THE GROUP HOLO-CHAT — free, gentle, everywhere at once.';
    case 'matchup':
      return s.pregameWk
        ? 'Hold PLAY. Win it.'
        : 'One page in your playbook tonight: THE RALLY. Give the speech, then hold PLAY.';
    case 'gamenight':
      if (stage === 'beat') return 'Tap the court to run the clock.';
      if (stage === 'verdict') return "Tap ▤ THE NOTEBOOK, bottom-left — note things you'll be asked about. Then on, through the night.";
      return null;
    default:
      return null;
  }
}

// ---- the beats ---------------------------------------------------------------

STORIES.push(
  // 01 · SETUP — the call
  {
    id: 'tut_call',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE CALL',
      text: 'Your assistant meets you at the spaceport with a clipboard and the face of a man who has read it. "Program\'s in shambles, coach. League investigation open, press circling, and the fans chased the last coach off-planet. Literally. There\'s footage."\n\nHe hands you a whistle that has seen things.',
      choices: [TC('in', '"WHAT\'S IN IT FOR ME?"')],
    }),
    resolve: () => ({
      text: '"One game left in a dead season, a roster of seniors counting the days, and —" he checks the clipboard, "— a salary." He shakes your hand anyway. Somebody has to be the adult in the room, and everyone here has decided it\'s you.',
    }),
  },
  // 02 · SETUP — the dean: the gauge, a credit, a machine from the trash
  {
    id: 'tut_dean',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE DEAN',
      text: 'The dean is waiting in your office, already pouring two cups. "I played here, you know. Class of — never mind the class." She taps the JOB SECURITY gauge glowing at the top of your screen. "Four opinions hold that bar up: the school, the fans, the players, the public. Right now the only one holding is mine."\n\nShe slides a single credit across the desk — and a device shaped like an alarm clock with opinions. "From the country-club trash. A LOCAL TIME MACHINE, the label says. The board wouldn\'t approve a budget, so I improvised."',
      choices: [TC('take', 'TAKE THE CREDIT AND THE MACHINE')],
    }),
    resolve: (_k, ctx) => {
      if (ctx.s.bag.length < 8 && !ctx.s.bag.includes('timeloop')) ctx.s.bag.push('timeloop');
      return {
        text: 'The credit lands in the bar up top — that\'s the program\'s money, and it buys everything from drills to bus repairs. The machine goes into THE BAG at the bottom of the screen, next to the notebook that is always there.\n\n"Her faith alone," your assistant murmurs, watching the gauge climb, "is holding this job up."',
        fx: [{ heatS: -25, coachEnergy: 1 }],
      };
    },
  },
  // 03 · SETUP — the roster
  {
    id: 'tut_roster',
    kind: 'coach',
    figure: 'assistant',
    beat: (_b, ctx) => {
      const t = myT(ctx.s);
      const star = t.players.find((p) => p.outKind === 'away');
      const hurt = t.players.find((p) => p.outKind === 'injury');
      const fr = tutFreshman(ctx.s);
      return {
        tag: 'THE ROSTER',
        text: `The assistant walks you down the grid behind this dialog — your lineup, always: top row starts, middle row is the bench, bottom row watches.\n\n"Mostly seniors playing out the string. ${star ? `${star.name} is the one real player — suspended two weeks, academics.` : ''} ${hurt ? `${hurt.name} would start every night anywhere — hurt, back in a week.` : ''} ${fr ? `And the freshman, ${fr.name}: can't rate him, meters full, grins at walls. Keep an eye on that one.` : ''}"\n\nThe pods you see are the exhausted and the absent, on ice. Flip the three lenses — ROSTER, STATS, ABILITIES — when the dialog closes.`,
      };
    },
    resolve: () => ({ text: '' }),
  },
  // 04 · SETUP — the time machine goes haywire
  {
    id: 'tut_haywire',
    kind: 'player',
    beat: (_b, ctx) => ({
      tag: 'THE LOCAL TIME MACHINE',
      text: `A thought arrives, the way bad ideas do, fully dressed: the suspension is two weeks long — and you own a machine that eats weeks.\n\n${ctx.player?.name ?? 'Your star'} watches you point the country-club clock at his paperwork.`,
      choices: [TC('point', 'POINT IT AT THE PAPERWORK', { down: { pct: 50, cls: 'DRAMA', note: 'it was in the trash for a reason' } })],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const ix = s.bag.indexOf('timeloop');
      if (ix >= 0) s.bag.splice(ix, 1);
      const p = ctx.player;
      return {
        text: `The machine whirs, hiccups, and runs BACKWARD. ${p?.name ?? 'Your star'} is now lost somewhere in time — six weeks out, well past graduation. The machine dissolves into a smell.\n\nThe locker room takes it exactly as well as you'd think, and the gauge up top dips with their mood: the players' opinion of you is their MOOD, live. Tap the gauge for the four voices; tap the header rows for the schedule and the standings. It was in the trash for a reason.`,
        fx: [{ playerId: p?.id, outWeeks: 6, outReason: 'lost in time', outKind: 'away' }, { teamMood: -12 }],
      };
    },
  },
  // 05 · WEEK — facilities: no money, no gym, one complaint
  {
    id: 'tut_hoop',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE CAMPUS, SUCH AS IT IS',
      text: 'The FACILITIES screen, coach: six buildings, every one at level zero. The "cryo bay" is an ice-filled dumpster. The gym has no hoop.\n\nYou mention the hoop to the dean. She looks at the bare wall for a long moment. "I have one. In my backyard. It\'s regulation — mostly. Give me a week."',
      choices: [TC('ok', '"A HOOP IS A HOOP"')],
    }),
    resolve: () => ({
      text: 'Upgrades work like that everywhere: ordered now, landed NEXT WEEK, always with somebody carrying something up a stairwell. The dean\'s hoop arrives with the new season — THE GYM, level 1. One building down. Watch this week: the whole campus has friends like her.',
    }),
  },
  // 06 · WEEK — the janitor pays in kind
  {
    id: 'tut_janitor',
    kind: 'coach',
    figure: 'janitor',
    beat: () => ({
      tag: 'THE SUPPLY CLOSET',
      text: 'On your way off the screen, the janitor blocks the door with his cart, looks both ways, and sets a PATCH KIT on top of your clipboard. He nods at it once, then at you, then leaves before thanks can happen.',
      choices: [TC('take', 'POCKET THE PATCH KIT')],
    }),
    resolve: (_k, ctx) => {
      if (ctx.s.bag.length < 8 && !ctx.s.bag.includes('patch')) ctx.s.bag.push('patch');
      return { text: 'Into THE BAG it goes. Items drag straight onto the people they\'re for — remember that at practice. The mop by the door, incidentally, is free to grab, any week, forever. He remembers who grabs it.' };
    },
  },
  // 07 · WEEK — the head cheerleader reads the board and opens the row
  {
    id: 'tut_cheer',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: 'SCOUTING: nine names on the big board, nine question marks. The head cheerleader appears at your shoulder, reads your face, and sighs.\n\n"I\'ve seen every one of these kids on campus visits. Give me the marker." She uncaps it with her teeth and fills in the whole board from memory.',
      choices: [TC('watch', 'WATCH HER WORK')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      for (const pr of s.prospects) {
        pr.digits = 2;
        pr.seenSkill = true;
        pr.seenPot = true;
        pr.scoutLevel = Math.max(pr.scoutLevel, 4);
        observe(pr);
      }
      if (s.facilities) s.facilities.greekrow = 1;
      return {
        text: 'The truth, in marker: all terrible. Two stars, tops, any of them.\n\n"You want better rooms," she says, "you need better parties. Kappa Nebula\'s doors are open to the program now — that\'s GREEK ROW, level 1, and that\'s me." On her way out she teaches you the words to THE RALLY — the speech for rooms that need a roof raised.\n\nScouting is one move a week. The LOCAL REC CENTER search is free. Go look anyway — the board can always surprise you.',
      };
    },
  },
  // 08 · WEEK — practice: grades, the patch, the tactics board
  {
    id: 'tut_practice',
    kind: 'coach',
    figure: 'assistant',
    beat: (_b, ctx) => {
      const hurt = tutStandout(ctx.s);
      const fr = tutFreshman(ctx.s);
      return {
        tag: 'PRACTICE',
        text: `"Look at the letters, not the numbers," the assistant says, tapping the cards. "The grade is what a body is worth in that slot, TONIGHT — ${fr ? `and ${fr.name}, full tanks, grades over half the tired seniors twice his rating` : 'and fresh legs outgrade tired talent'}. Drag the fresh ones onto the floor."\n\n${hurt && hurt.outWeeks > 0 ? `"And the patch kit the janitor slipped you — drag it onto ${hurt.name}. She plays tonight if you do."` : '"Everyone who can stand is standing. Good."'}\n\n"This gym has no hoop, so TEAM REST is the whole menu — hold RUN. The tactics board below the grid is yours too: tap a scheme, watch the bars lean."`,
      };
    },
    resolve: () => ({ text: '' }),
  },
  // 09 · WEEK — the booster and the blank check
  {
    id: 'tut_booster',
    kind: 'coach',
    figure: 'booster',
    beat: () => ({
      tag: 'THE VOICE OF THE FANS',
      text: 'RECRUITING is its own stop: one charm move a week, and the free GROUP HOLO-CHAT reaches everybody a little.\n\nBefore you can open it, a chrome suit fills the doorway. "Coach. I speak for the fans, and the fans have decided to believe in you. Don\'t ask why — it wasn\'t unanimous." The gauge climbs +25 while he\'s still talking.',
      choices: [TC('check', 'ABOUT THAT KID FROM THE REC CENTER…')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const gem = tutGem(s);
      if (gem) gem.pr.signed = true;
      return {
        text: gem
          ? `He produces a BLANK CHECK the way other people produce business cards. "The rec-center kid? Done." ${gem.pr.name} is SIGNED — ink, not maybe: the card wears it, and no letter can unsend it.\n\n"That's what the fans' help looks like, coach. It gets bigger. It gets messier. You'll see."`
          : 'He produces a BLANK CHECK the way other people produce business cards — then frowns at your board. "Nobody worth the ink this week. Keep it in mind: my help gets bigger, and messier."',
        fx: [{ heatB: -25 }],
      };
    },
  },
  // 10 · WEEK — Scoop questions the signing
  {
    id: 'tut_scoop',
    kind: 'coach',
    figure: 'scoop',
    beat: () => ({
      tag: '“SCOOP” QUAZAR · ON AIR',
      text: 'The press finds you at the matchup screen. Scoop Quazar, six legs, one fedora, recorder out: "A five-star talent signs off ONE conversation, coach. To THIS program. Walk me through that."',
      choices: [TC('bluff', '"FRIENDS OF THE FAMILY"', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL', note: 'he checks things' } })],
    }),
    resolve: () => ({
      text: '"Friends of the family," he repeats, and — this once — the recorder clicks off. "Everybody\'s got friends. Even this program, apparently." The piece runs almost warm, and the gauge finishes its climb: +25 from the public.\n\nHe\'ll be back most weeks with QUESTIONS about games and stats. Answer from memory, or let THE NOTEBOOK answer — if you wrote things down.',
      fx: [{ opP: 25 }],
    }),
  },
  // 11 · WEEK — the bus breaks down
  {
    id: 'tut_bus',
    kind: 'coach',
    figure: 'goblin',
    beat: () => ({
      tag: 'BREAKDOWN',
      text: 'Halfway to the away game the bus shudders, coughs, and pulls into a service asteroid run by mech-goblins. The word FORFEIT starts practicing its entrance.\n\nThe head goblin quotes you exactly one credit — which is, exactly, everything you have.',
      choices: [
        TC('pay', 'PAY THE MECH-GOBLINS (1¢)', { cost: 1 }),
        TC('plead', 'PROMISE THEM SEASON TICKETS'),
      ],
    }),
    resolve: (key) => {
      if (key === 'pay') {
        return {
          text: 'You hand over the credit. The goblin swipes it through a terminal that immediately catches fire. "Broken," she shrugs, fixing your bus anyway and handing the credit back out of professional embarrassment.\n\nYou keep the credit and make tip-off. Travel does this, coach — setbacks are doors, and some of them are funny.',
          fx: [{ coachEnergy: 1 }],
        };
      }
      return {
        text: '"Season tickets," the goblin repeats, unimpressed — then fixes the bus anyway, because the terminal is broken and pride is pride. You keep your credit and make tip-off.\n\nTravel does this, coach — setbacks are doors, and some of them are funny.',
      };
    },
  },
  // 12b · after the horn — the notebook lesson, then the bookie's gratitude
  {
    id: 'tut_notebook',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'WRITE IT DOWN',
      text: 'The assistant taps the tall ▤ slot at the bottom-left of the screen. "The notebook, coach. Tap it on any screen worth remembering — the box score, the standings, the leaders — and it writes the page down.\n\nScoop asks about last week, every week. A coach who keeps notes never gets caught flat."',
    }),
    resolve: () => ({ text: '' }),
  },
  {
    id: 'tut_cryo',
    kind: 'coach',
    figure: 'bookie',
    beat: () => ({
      tag: 'THE BOOKIE SETTLES UP',
      text: 'The bookie is waiting outside the visitors\' gym, radiating the specific joy of a man who had you as a slight underdog and bet accordingly.\n\n"Coach. Beautiful upset. BEAUTIFUL. Listen —" a truck horn sounds, somewhere close, "— a cryo unit is about to fall off a truck outside your gym. Tragic. Nobody will claim it. You understand."',
      choices: [TC('understand', 'YOU UNDERSTAND')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      if (s.facilities) s.facilities.cryo = 1;
      return { text: 'By the time you\'re home, the CRYO BAY stands at level 1 and the ice-filled dumpster has retired with honors. That\'s two buildings gifted, coach. The week isn\'t done being generous.' };
    },
  },
  // 13 · WRAP — the road home and the kid on the deserted hoop
  {
    id: 'tut_road',
    kind: 'coach',
    art: 'bus',
    artEvent: 'hoop',
    beat: () => ({
      tag: 'THE ROAD HOME',
      text: 'The bus threads the dark, the win still warm in it…\n\nAt a refuel stop on a nothing moon, a kid is shooting alone on a deserted hoop under one working floodlight. Form like a metronome. He doesn\'t stop when the whole team files out to watch.',
      choices: [TC('meal', 'BUY HIM A HOT MEAL', { up: { pct: 50, cls: 'SPIRIT', note: 'voyages find people' } })],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const counter = { nextId: s.nextId };
      const kid = genPlayerAt(counter, 28 + rand(8), 0, undefined, undefined, 22 + rand(12));
      s.nextId = counter.nextId;
      s.commits.push(kid);
      return {
        text: `One hot meal and forty minutes of jump-shot talk later, ${kid.name} has your holo-code and two-thirds of his heart committed. (He signs. Kids you feed always sign.)\n\nVoyages find people, coach — the galaxy hands things to teams in motion.`,
        next: { defId: 'tut_dean2', beat: 'start', playerId: null },
      };
    },
  },
  // 14 · WRAP — signing day: three characters, three gifts, one envelope
  {
    id: 'tut_dean2',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'SIGNING DAY',
      text: 'Back on campus, the dean is directing two contractors and a truckload of bleacher steel with her coffee hand.\n\n"A small stadium. Over the summer. Don\'t thank me — sell it out." She hands you the week\'s envelope while the steel rings: five credits, same as every Monday from here on. The stipend is the heartbeat, coach. The rest you earn.',
      choices: [TC('take', 'TAKE THE ENVELOPE')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      if (s.facilities) s.facilities.stadium = 1;
      return {
        text: 'THE STADIUM, level 1 — a gate that pays a credit per home game. Three buildings down.',
        fx: [{ coachEnergy: 5 }],
        next: { defId: 'tut_scoop2', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_scoop2',
    kind: 'coach',
    figure: 'scoop',
    beat: (_b, ctx) => {
      const s = ctx.s;
      const noted = s.notebook.some((n) => n.key === `mvp:${s.season}:${s.week}`);
      return {
        tag: 'ONE MORE QUESTION',
        text: noted
          ? 'Scoop again, recorder out: "For the record, coach — who led your team in scoring in the finale?"\n\nYou don\'t even blink. You read it straight off the notebook page, stat line and all.'
          : 'Scoop again, recorder out: "For the record, coach — who led your team in scoring in the finale?"\n\nYou answer from memory, close enough to true, and he lets it stand.',
      };
    },
    resolve: (_k, ctx) => {
      const s = ctx.s;
      if (s.facilities) s.facilities.library = 1;
      return {
        text: 'Scoop lowers the recorder, genuinely moved. "A coach who keeps RECORDS." He clears six legs\' worth of throat. "The Gazette\'s archive — every box score I ever filed. It\'s going to your school library. Somebody there should care about numbers."\n\nTHE LIBRARY, level 1. Four.',
        fx: [{ opP: 3 }],
        next: { defId: 'tut_booster2', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_booster2',
    kind: 'coach',
    figure: 'booster',
    beat: () => ({
      tag: 'THE CAR',
      text: 'The booster is leaning against something under a tarp in the parking lot, jingling keys.\n\n"Every coach needs a car." He pulls the tarp: it is a spaceship. Dented, loud, home-planet range at best. "A car," he repeats, daring you to disagree.',
      choices: [TC('keys', 'TAKE THE KEYS')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      if (s.facilities) s.facilities.ship = 1;
      return {
        text: 'THE SCOUTING SHIP, level 1 — the home planet is in range now, and the galaxy past it is a reason to build. With the dean\'s hoop landing over the summer, that\'s six characters, six gifts: the campus stands at level 1, all of it, and every level after this one you\'ll build yourself.',
        next: { defId: 'tut_bye', beat: 'start', playerId: null },
      };
    },
  },
  // 15 · WRAP — season 1 tryouts: goodbye, assistant
  {
    id: 'tut_bye',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE TRAINING WHEELS',
      text: 'The assistant hands you the clipboard — the whole clipboard.\n\n"Tryouts are yours, coach. Two recruits inked, the freshman had a summer you would not believe, the standout\'s healthy, and the walk-on line goes around the block. Cut it down to nine and start SEASON ONE."\n\nHe puts on his hat. "You know where the ? button is. That\'s me now. It was an honor."',
      choices: [TC('bye', 'IT WAS. GO HOME.')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const t = myT(s);
      // the standard kit returns with the training wheels off
      s.knownPlans = [...STARTING_PLANS];
      s.knownInstr = [...STARTING_INSTRUCTIONS];
      s.facilities = { ship: 1, gym: 1, cryo: 1, library: 1, stadium: 1, greekrow: 1 };
      // the one lost in time stays lost — the void keeps its own schedule
      const lost = t.players.filter((p) => p.outKind === 'away' && p.outWeeks > 4);
      for (const p of lost) {
        const career = { ...p.career };
        addStats(career, p.stats);
        s.alumni.push({ name: p.name, speciesId: p.speciesId, form: p.form, ovr: ovr(p.attrs), exit: 'void', season: 0, career });
      }
      // seniors walk; the fire freshman and the standout carry the flag
      t.players = t.players.filter((p) => p.classYear < 3 && !lost.includes(p));
      for (const p of t.players) {
        p.classYear = Math.min(3, p.classYear + 1);
        p.onFire = false;
        p.fireWeeks = 0;
        p.outWeeks = 0;
        p.outReason = '';
        p.outKind = undefined;
        p.energy = 75;
        p.mood = 80;
        p.startStreak = 0;
        p.dnp = 0;
        p.stats = { gp: 0, pts: 0, reb: 0, stl: 0, ast: 0, mvp: 0 };
      }
      // the freshman's big summer
      const fr = [...t.players].sort((a, b) => ovr(b.pots) - ovr(a.pots))[0];
      if (fr) bumpAny(fr, 5);
      // the blank-check kid inks in beside the road kid
      for (const pr of s.prospects.filter((x) => x.signed)) s.commits.push(prospectToPlayer(pr));
      s.prospects = [];
      s.pendingRecruits = [];
      // the selection grid: returners, recruits, walk-ons off the street
      const counter = { nextId: s.nextId };
      const names = new Set<string>();
      for (const team of s.teams) for (const p of team.players) names.add(p.name);
      for (const p of s.commits) names.add(p.name);
      const pool: Player[] = [...t.players, ...s.commits];
      while (pool.length < SELECT_POOL_SIZE) pool.push(genWalkOn(counter, names));
      s.nextId = counter.nextId;
      s.selectPool = pool;
      s.signingResults = [];
      s.summerRecap = [];
      s.futureBeats = [];
      s.lastResult = null;
      s.postGame = [];
      s.resultsLog = [];
      s.resultsWeek = [];
      s.phase = 'teamSelect';
      delete s.tutorial;
      return { text: '' };
    },
  }
);
