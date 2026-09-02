// THE TUTORIAL SEASON (v5 M4 — WEEK ZERO, paced): one scripted week as
// season 0. A doomed program, week 10 of a lost season (0–9), one game to
// coach. Everything is authored — outcomes are pinned, story choices land
// where the script says — and it teaches by DOING and SHOWING, one thing at
// a time. Every screen opens with ONE full-screen assistant line (the story
// voice), then explanation happens on the live screen through THE WALK: a
// floating box, one spotlight per step, everything else dimmed AND locked.
// Its secret job stays: every character hands the coach one facility, so
// season 1 opens with the whole campus at level 1.
//
// Engine shape: `s.tutorial` is the stage index (TUT_AT). state.ts asks
// `tutorialArrive(s, key)` as the coach reaches each point; the UI asks
// `tutorialWalkStart(s, gnStage)` when the floor is quiet (queueing the
// screen's `tutorialIntro` dialog first), runs the walk, and gates every
// click through `tutorialAllows`.

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

/** The stage ladder of season zero. */
export const TUT_AT = {
  BOOT: 1,
  FAC: 2,
  SCOUT: 3,
  PRACTICE: 4,
  RECRUIT: 5,
  RECRUITED: 6,
  MATCHUP: 7,
  SPEECH: 8,
  BOOKIE: 9,
  MIDGAME: 10,
  HELD: 11,
  WRAP: 12,
  TRYOUTS: 13,
} as const;

function myT(s: GameState): Team {
  return s.teams[s.myTeamId];
}

/** The ecstatic freshman — the tutorial's future: the only Fr on the roster. */
export function tutFreshman(s: GameState): Player | null {
  return myT(s).players.find((p) => p.classYear === 0) ?? null;
}

/** The injured standout — the one the patch kit is FOR. Once patched she
    loses the injury tag, so the fallback finds her by class: season zero's
    only sophomore (playtest #8: the old lookup went null after the patch and
    the best-two gate could never pass). */
export function tutStandout(s: GameState): Player | null {
  const ps = myT(s).players;
  return ps.find((p) => p.outKind === 'injury') ?? ps.find((p) => p.classYear === 1) ?? null;
}

/** The suspended star (later: the one the machine erases). */
export function tutStar(s: GameState): Player | null {
  return myT(s).players.find((p) => p.outKind === 'away') ?? null;
}

/** The rec-center gem (a 5★ ceiling on a board of nobodies) — wherever he is. */
export function tutGem(s: GameState): { pr: import('./types').Prospect; where: 'board' | 'pending' } | null {
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
  // the four standard speeches are on the sheet (the assistant explains the
  // trade) — THE RALLY arrives with the cheerleader, game night
  s.knownPlans = [...STARTING_PLANS];
  s.knownInstr = [];

  const counter = { nextId: s.nextId };
  const names = new Set<string>();

  // the league around you — real enough to have buried you all season, with
  // nine games of stats tilted by their attributes, so THE LEADERS read like
  // a real season: different names on every board (playtest #6)
  for (const team of s.teams) {
    if (team.id === teamId) continue;
    team.players = genRosterAt(counter, 38 + rand(9), names);
    autoLineup(team);
    team.wins = 5 + rand(4);
    team.losses = 9 - team.wins;
    for (const p of team.players) {
      const gp = 8 + rand(2);
      p.stats = {
        gp,
        pts: Math.round(gp * (3 + rand(5) + p.attrs.skl * 0.55)),
        reb: Math.round(gp * (1 + rand(3) + p.attrs.frc * 0.35)),
        stl: Math.round(gp * (0.4 + Math.random() + p.attrs.ath * 0.12)),
        ast: Math.round(gp * (0.6 + Math.random() + p.attrs.brn * 0.18)),
        mvp: 0,
      };
    }
  }

  // MY roster: a sorry bunch, mostly seniors — plus the three who matter.
  // The numbers are STORY numbers (playtest #6): a genuine 80+ superstar, a
  // 35–45 standout, teens across the seniors, and a freshman under 10 whose
  // letter is carried entirely by THE CONDITION BONUS — full tanks read a C
  // in his column while the gassed, miserable rest read F.
  const t = myT(s);
  const star = genPlayerAt(counter, 82, 3, undefined, names);
  star.outWeeks = 2;
  star.outKind = 'away';
  star.outReason = 'academic suspension';
  const standout = genPlayerAt(counter, 40, 1, undefined, names);
  standout.form = 'femme';
  standout.outWeeks = 1;
  standout.outKind = 'injury';
  standout.outReason = 'a bad tweak';
  // the standout is ALWAYS a center: the practice walk parks her in the
  // frontcourt and the finale check looks for her there
  standout.attrs = { skl: 8, ath: 14, frc: 12, brn: 6 };
  standout.pos = 2;
  standout.pos2 = undefined;
  for (const a of ATTRS) standout.pots[a] = Math.max(standout.pots[a], standout.attrs[a]);
  standout.startAttrs = { ...standout.attrs };
  // the freshman: the WORST rating on the roster — but full tanks, and he
  // grins at walls (the ceiling is the secret). ALWAYS a guard, and brainy:
  // the position lesson needs him a C in the backcourt and an F standing in
  // the frontcourt, every single run.
  const fresh = genPlayerAt(counter, 9, 0, undefined, names, 55);
  fresh.attrs = { skl: 2, ath: 1, frc: 1, brn: 5 };
  fresh.pos = 0;
  fresh.pos2 = undefined;
  fresh.heightCm = 168;
  fresh.weightKg = 62;
  for (const a of ATTRS) fresh.pots[a] = Math.max(fresh.pots[a], fresh.attrs[a]);
  fresh.startAttrs = { ...fresh.attrs };
  fresh.energy = 100;
  fresh.mood = 100;
  const roster: Player[] = [star, standout, fresh];
  // five gassed seniors and one quiet junior — the leftovers of a lost year.
  // Teens across the board; even the rest week leaves them F's (their mood
  // is shot), and only game night's cheer lifts the room to D's.
  for (let i = 0; i < 6; i++) {
    const p = genPlayerAt(counter, 10 + rand(7), i === 5 ? 2 : 3, undefined, names);
    p.energy = i < 2 ? 55 + rand(10) : 15 + rand(20);
    p.mood = 38 + rand(9);
    roster.push(p);
  }
  t.players = roster;
  ensureUniqueJerseys(roster);
  autoLineup(t);
  // 0–9: the user's win has to be the FIRST of the season
  t.wins = 0;
  t.losses = 9;
  t.pointsFor = 9 * (38 + rand(8));
  t.pointsAgainst = 9 * (61 + rand(8));

  // the STATS lens must read like a lost season: nine games of sad box scores
  const seed = (p: Player, gp: number, ppg: number): void => {
    p.stats = {
      gp,
      pts: Math.max(0, Math.round(gp * (ppg + Math.random() - 0.5))),
      reb: Math.round(gp * (0.5 + Math.random() * (p.attrs.frc > 10 ? 3 : 1.4))),
      stl: Math.round(gp * (0.3 + Math.random() * 1.1)),
      ast: Math.round(gp * (0.4 + Math.random() * (p.attrs.brn > 10 ? 2.4 : 1.2))),
      mvp: 0,
    };
  };
  seed(star, 7, 24); // a genuine superstar's line — suspended for the last two
  star.stats.mvp = 2;
  seed(standout, 8, 11);
  seed(fresh, 4, 1); // garbage minutes, big grin
  for (const p of roster) if (p.stats.gp === 0) seed(p, 8 + rand(2), 3 + rand(3));

  // the freshman belongs in the RESERVES — the walk points him out down there
  {
    const slots = t.lineup.slots;
    const fi = slots.indexOf(fresh.id);
    if (fi >= 0 && fi < 6) {
      const ri = [6, 7, 8].find((i) => slots[i] !== null && slots[i] !== fresh.id) ?? 8;
      const tmp = slots[ri];
      slots[ri] = fresh.id;
      slots[fi] = tmp;
    }
  }

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
    pr.commitPct = 10 + rand(21); // mild interest from the nobodies…
    observe(pr);
    s.prospects.push(pr);
  }

  // week ten, on the road: the schedule's last page gets rewritten so the
  // one game that matters is yours, away — against a beatable-ish nobody
  const others = s.teams.map((x) => x.id).filter((id) => id !== teamId);
  const oppId = others[0];
  // tuned to the new teens-roster: before the cheer the gauge reads like a
  // clobbering; after the room's mood lifts it reads tight and lightly THEIR
  // way (the rig still lands the upset; the bookie prints 42%)
  s.teams[oppId].players = genRosterAt(counter, 24 + rand(3), names);
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
  s.tutorial = TUT_AT.BOOT;
  s.tutSeen = [];
  delete s.tutWalk;
  return [
    { defId: 'tut_call0', beat: 'start', playerId: null },
    { defId: 'tut_dean', beat: 'start', playerId: null },
  ];
}

// ---- the script asks for the floor as the coach reaches each point -----------

export function tutorialArrive(s: GameState, key: string): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (key === 'facilities' && at < TUT_AT.FAC) {
    s.tutorial = TUT_AT.FAC;
    return []; // the intro + walk speak first; the dean waits by her car
  }
  if (key === 'scouting' && at < TUT_AT.SCOUT) {
    s.tutorial = TUT_AT.SCOUT;
    return []; // intro → the cheerleader → the walk → the search
  }
  if (key === 'practice' && at < TUT_AT.PRACTICE) {
    s.tutorial = TUT_AT.PRACTICE;
    // pin the freshman to the RESERVES row: the sunk absentees can have
    // shoved him up a row, and the drag-him-onto-the-floor lesson needs him
    // at the bottom, every time
    const t = myT(s);
    const fr = tutFreshman(s);
    if (fr) {
      const slots = t.lineup.slots;
      const fi = slots.indexOf(fr.id);
      if (fi >= 0 && fi < 6) {
        const ri = [6, 7, 8].find((i) => {
          const occ = t.players.find((p) => p.id === slots[i]);
          return !occ || occ.outWeeks === 0;
        }) ?? 8;
        const tmp = slots[ri];
        slots[ri] = fr.id;
        slots[fi] = tmp;
      }
    }
    return [];
  }
  if (key === 'recruiting' && at < TUT_AT.RECRUIT) {
    s.tutorial = TUT_AT.RECRUIT;
    return [];
  }
  // the charm move landed: a few sad percent — the assistant says so
  if (key === 'recruited' && at < TUT_AT.RECRUITED) {
    s.tutorial = TUT_AT.RECRUITED;
    return [{ defId: 'tut_stamp', beat: 'start', playerId: null }];
  }
  // the week wraps toward the game: Scoop, then the bus (ONE bus, one
  // direction — the breakdown scene is the trip)
  if (key === 'matchup' && at < TUT_AT.MATCHUP) {
    s.tutorial = TUT_AT.MATCHUP;
    return [
      { defId: 'tut_scoop', beat: 'start', playerId: null },
      { defId: 'tut_bus', beat: 'start', playerId: null },
    ];
  }
  // the speech LANDED: the room is loud — the assistant takes it in
  if (key === 'speech' && at < TUT_AT.SPEECH) {
    s.tutorial = TUT_AT.SPEECH;
    return [{ defId: 'tut_pumped', beat: 'start', playerId: null }];
  }
  // PLAY: the bookie says hello and names his favorite (not you)
  if (key === 'pregame' && at < TUT_AT.BOOKIE) {
    s.tutorial = TUT_AT.BOOKIE;
    return [{ defId: 'tut_bookie', beat: 'start', playerId: null }];
  }
  if (key === 'midgame' && at < TUT_AT.MIDGAME) {
    s.tutorial = TUT_AT.MIDGAME;
    const fr = tutFreshman(s);
    return fr ? [{ defId: 'fire_live', beat: 'start', playerId: fr.id, data: { pts: 26 } }] : [];
  }
  return [];
}

/** The horn's consequences, scripted: the bookie won BIG — held until the
    score has been seen. */
export function tutorialHeld(s: GameState): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (at >= TUT_AT.HELD) return [];
  s.tutorial = TUT_AT.HELD;
  return [{ defId: 'tut_cryo', beat: 'start', playerId: null }];
}

/** Season zero has no next Monday: NEXT WEEK opens the wrap-up chain instead. */
export function tutorialWrap(s: GameState): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (at >= TUT_AT.WRAP) return [];
  s.tutorial = TUT_AT.WRAP;
  return [{ defId: 'tut_road', beat: 'start', playerId: null }];
}

// ---- THE WALK: the assistant's floating spotlight, one step at a time --------

export interface TutStep {
  text: string;
  /** who speaks (label on the box) */
  who?: string;
  /** what gets the spotlight: 'grid' 'row:0..2' 'p:<id>' 'pr:<id>' 'ids:a,b'
      'ge:a,b' (energy gauges) 'gm:a,b' (mood gauges) 'ovr:<id>' 'lens:0..2'
      'nav' 'tac' 'bars' 'board' 'rows' 'fac' 'patch' 'check' 'timeloop'
      'notebook' 'jobbar' */
  hi?: string;
  /** where the box floats (default 'bot'); 'low' pins it to the very bottom
      of the screen, OVER the locked nav and bag — grid talk never covers
      the grid */
  pos?: 'top' | 'mid' | 'bot' | 'low' | 'lens';
  /** how the step advances: default tap on the box; 'lens:N' waits for that
      lens tab, 'note' for a notebook entry, 'item:<id>' for that item
      landing, 'floor:<pid>' for that player dragged into the top rows,
      'swap:gem' for the gem dragged onto the board, 'tac' for a scheme tap */
  advance?: string;
  /** pushed into tutSeen the moment this step takes the floor — the render
      reads these to REVEAL hidden pieces (m:bars, m:tac) */
  mark?: string;
  /** the step advances on a HOLD button in the box instead of a tap */
  hold?: boolean;
  /** the hold refuses until the gate passes ('bestfive': the freshman and
      the standout both START — top row) */
  gate?: string;
  /** a FREE look (no spotlight) that still keeps the lens tabs locked —
      the board of ?? has nothing worth a tab yet */
  lock?: boolean;
}

/** Every screen opens with ONE full-screen assistant line — the walk's
    floating boxes take over after it. Keyed by walk key. */
export function tutorialIntro(s: GameState, key: string): string | null {
  void s;
  switch (key) {
    case 'roster':
      return "This is your team, coach — what's left of one. Mostly seniors playing out the string of a lost season.";
    case 'facilities':
      return 'The campus. Six facilities — and every one of them is a level-zero disgrace.';
    case 'board':
      return "Scouting, coach: finding TALENT — kids who might join the program NEXT season. Let's see what intel the last coach left you.";

    case 'practice':
      return 'Practice: where you set the lineup and put the squad through a week of work.';
    case 'recruiting':
      return "Recruiting: convincing the kids you scouted to actually SIGN here next season. You can call, charm and host — but you can't buy them gifts. …Or at least, you can't be SEEN doing it.";
    case 'matchup':
      return 'Game night, coach. What a week to get here: a mopped gym, a patched starter, a five-star signature — and one game to show for it.';
    default:
      return null;
  }
}

/** Which walk wants the floor right now (null = none). The UI calls this
    only when no story holds the stage. */
export function tutorialWalkStart(s: GameState, gnStage: string): string | null {
  if (s.tutorial === undefined || s.tutWalk) return null;
  const at = s.tutorial;
  const seen = s.tutSeen ?? [];
  const want = (key: string): string | null => (seen.includes(key) ? null : key);
  if (s.phase === 'weekstart' && at >= TUT_AT.BOOT) {
    if (!seen.includes('roster')) return 'roster';
    // the haywire idea has landed: the machine must be pointed at the star
    const star = tutStar(s);
    if (seen.includes('haywire-idea') && s.bag.includes('timeloop') && star) return want('timeloop');
    return null;
  }
  if (s.phase === 'facilities' && at >= TUT_AT.FAC) return want('facilities');
  if (s.phase === 'scouting' && at >= TUT_AT.SCOUT) {
    if (!seen.includes('board')) return 'board';
    // the cheer has been shouted back: now it gets WRITTEN DOWN
    if (seen.includes('cheer0') && !seen.includes('cheernote')) return 'cheernote';
    // the marker board is legible: the star-rating lesson, then the ship talk
    if (seen.includes('boardread') && !seen.includes('starlesson')) return 'starlesson';
    // the board is inked and the ship talk is done: point at the nav
    if (seen.includes('shipless') && !s.scoutActWk) return want('search');
    const gem = tutGem(s);
    if (s.scoutActWk && gem) {
      if (!seen.includes('potential')) return 'potential';
      // the outburst has landed: now the board-only-holds-nine lesson
      if (seen.includes('fivestar') && gem.where === 'pending') return want('potential2');
    }
    return null;
  }
  if (s.phase === 'practice' && at >= TUT_AT.PRACTICE) {
    if (!seen.includes('practice')) return 'practice';
    if (s.trainedThisWeek) return want('practice2');
    return null;
  }
  if (s.phase === 'recruiting' && at >= TUT_AT.RECRUIT) {
    if (!seen.includes('recruiting')) return 'recruiting';
    // the sad holo-chat result has been read: one more look at the board
    if (seen.includes('stamp') && !seen.includes('sadboard')) return 'sadboard';
    const gem = tutGem(s);
    if (s.bag.includes('check') && gem?.where === 'board' && !gem.pr.signed) return want('check');
    return null;
  }
  if (s.phase === 'matchup' && at >= TUT_AT.MATCHUP && !s.pregameWk && seen.includes('cheerspeech') && !seen.includes('speechnote')) return 'speechnote';
  if (s.phase === 'matchup' && at >= TUT_AT.MATCHUP && !s.pregameWk) return want('matchup');
  // the cheer landed: one more look at the gauge — slightly is stealable now
  if (s.phase === 'matchup' && at >= TUT_AT.MATCHUP && s.pregameWk && seen.includes('cheered')) return want('matchup2');
  if (s.phase === 'gamenight' && gnStage === 'verdict' && at >= TUT_AT.HELD) return want('notebook');
  return null;
}

/** The steps of one walk, written for THIS state (names and all). */
export function tutorialWalkSteps(s: GameState, key: string): TutStep[] {
  const S = (t: TutStep): TutStep => t; // keeps literals narrow inside spreads
  const star = tutStar(s);
  const hurt = tutStandout(s);
  const fresh = tutFreshman(s);
  const gem = tutGem(s);
  const t = myT(s);
  const seniors = t.players.filter((p) => p.classYear >= 3 && p.id !== star?.id);
  const senIds = seniors.map((p) => p.id).join(',');
  switch (key) {
    case 'roster':
      return [
        { text: 'The seniors. Look at those tanks.', hi: `ids:${senIds}`, pos: 'low' },
        { text: 'The LEFT gauge on a card is ENERGY — how much a player has left this week. Theirs are running on fumes.', hi: `ge:${senIds}`, pos: 'low' },
        { text: 'The RIGHT gauge is MOOD. A lost season does this to a room.', hi: `gm:${senIds}`, pos: 'low' },
        ...(star ? [
          S({ text: `${star.name}. Look at that OVR — head and shoulders the best player here.`, hi: `ovr:${star.id}`, pos: 'low' }),
          S({ text: 'And suspended. Academics — two more weeks.', hi: `p:${star.id}`, pos: 'low' }),
        ] : []),
        ...(hurt ? [S({ text: `${hurt.name} would start every night, anywhere. Hurt — back in a week.`, hi: `p:${hurt.id}`, pos: 'low' })] : []),
        ...(fresh ? [S({ text: `And the freshman, ${fresh.name} — the WORST rating on this roster. Couldn't sink a shot if his life depended on it. But the tanks are always full, and he grins at walls.`, hi: `ovr:${fresh.id}`, pos: 'low' })] : []),
        { text: 'Top row STARTS tonight.', hi: 'row:0', pos: 'low' },
        { text: 'Middle row is the BENCH.', hi: 'row:1', pos: 'low' },
        { text: 'Bottom row watches — the RESERVES.', hi: 'row:2', pos: 'low' },
        { text: 'Tap STATS — the season so far.', hi: 'lens:1', pos: 'bot', advance: 'lens:1' },
        // no hi: the lights come UP — the coach reads the wreckage in peace
        { text: "It has not been pretty. Take a good look — tap here when you're done.", pos: 'low' },
        { text: 'Tap ABILITIES.', hi: 'lens:2', pos: 'bot', advance: 'lens:2' },
        // the lesson floats over the DIMMED bottom half, covering nothing lit
        { text: 'Every player is four things: SKILL (SKL), ATHLETICISM (ATH), FIERCENESS (FRC), BRAINS (BRN). The shape in the middle is their current ability, the outline around it is their potential — with the exact numbers in the corners.', hi: 'grid', pos: 'low' },
        { text: 'Have a look around — tap here when you are ready.', pos: 'low' },
        // this step only ever shows to a coach on the WRONG tab — the walk
        // auto-skips it when the lens already reads ROSTER
        { text: 'Meet me back on the ROSTER screen.', hi: 'lens:0', pos: 'bot', advance: 'lens:0' },
      ];
    case 'timeloop':
      return star
        ? [S({ text: `Drag the LOCAL TIME MACHINE from THE BAG onto ${star.name} — two weeks of suspension, gone. What could possibly go wrong.`, hi: 'timeloop', pos: 'top', advance: 'item:timeloop' })]
        : [];
    case 'facilities':
      return [
        { text: "The gym has no hoop. The 'cryo bay' is an ice-filled dumpster. You get the idea.", hi: 'fac', pos: 'low' },
        { text: "You get to make ONE campus move a week — if you can afford it, upgrade one facility at a time. Our one credit buys us nothing, so instead: Hold ▶ GRAB A MOP.", hi: 'nav', pos: 'lens' },
      ];
    case 'board':
      return [
        { text: 'The intel, such as it is: nine names, nine question marks. The last coach scouted NOBODY.', hi: 'board', pos: 'low' },
        { text: 'The rows are your PRIORITY. Top row: THE TARGETS — the kids you actually want.', hi: 'row:0', pos: 'low' },
        { text: 'Middle row: THE BACKUPS — in case the targets say no.', hi: 'row:1', pos: 'low' },
        { text: 'Bottom row: LAST RESORTS. Somebody has to hold the clipboard. Drag names between rows to reorder them, any time.', hi: 'row:2', pos: 'low' },
        // a free look at a board of ?? — the tabs stay locked a while longer
        { text: "Have a look around — tap here when you're done.", pos: 'low', lock: true },
      ];
    case 'cheernote':
      return [
        { text: "That cheer, coach — WRITE IT DOWN. Whatever lands in ▤ THE NOTEBOOK, you keep. Tap it.", hi: 'notebook', pos: 'top', advance: 'note' },
      ];
    case 'search':
      return [
        { text: 'One scouting move a week. No ship — so it\'s the bus, and the free LOCAL REC CENTER. Hold ▶ SEARCH.', hi: 'nav', pos: 'lens' },
      ];
    case 'starlesson':
      return [
        { text: 'The cheerleader gave us everything we need to know. Tap POTENTIAL.', hi: 'lens:2', pos: 'bot', advance: 'lens:2' },
        { text: 'The STARS guess how good a kid could BECOME — one star a warm body, five a legend.', hi: 'board', pos: 'low' },
        { text: 'Two stars, tops, anywhere on this board.', hi: 'board', pos: 'low' },
        { text: 'Back to the BOARD.', hi: 'lens:0', pos: 'bot', advance: 'lens:0' },
      ];
    case 'sadboard':
      return [
        { text: "One more look at the board: a row of maybes — and one kid who won't return your calls.", hi: 'board', pos: 'low' },
      ];
    case 'speechnote':
      return [
        { text: 'Tap ▤ THE NOTEBOOK — the words are in there.', hi: 'notebook', pos: 'top', advance: 'note' },
      ];
    case 'potential':
      return gem
        ? [
            S({ text: `There they are — ${gem.pr.name}. And we know NOTHING: the rating reads ??. Nobody has seen them play a real game.`, hi: `pr:${gem.pr.id}`, pos: 'top' }),
            S({ text: 'Maybe we can find out something about their future? Tap POTENTIAL.', hi: 'lens:2', pos: 'bot', advance: 'lens:2' }),
            S({ text: 'FIVE. STARS.', hi: `pr:${gem.pr.id}`, pos: 'top' }),
          ]
        : [];
    case 'potential2':
      return gem && gem.where === 'pending'
        ? [
            // 'bot': the kid sits in the found row at the foot of the grid —
            // the box must not cover the very card it points at
            S({ text: `The board only holds nine, and it's full — drag ${gem.pr.name} onto it and bump a nobody down.`, hi: `pr:${gem.pr.id}`, pos: 'bot', advance: 'swap:gem' }),
            S({ text: 'Whoever sits in the bottom row when you confirm walks away forever. Anybody but the kid. CONFIRM THE BOARD.', hi: 'nav', pos: 'lens' }),
          ]
        : [];
    case 'practice':
      return [
        // the floor stays FROZEN through the letter lesson (playtest #8): the
        // rows, the letters, the shapes — the first drag is the freshman's
        { text: 'The floor: STARTERS on top, the BENCH in the middle, RESERVES at the bottom.', hi: 'grid', pos: 'low' },
        { text: 'The LETTERS on the cards: what each player is WORTH in that spot tonight.', hi: 'grid', pos: 'low' },
        { text: 'Tap ABILITIES.', hi: 'lens:2', pos: 'bot', advance: 'lens:2' },
        { text: 'Small shapes, everywhere. This roster\'s numbers are… modest. The seniors\' too.', hi: 'grid', pos: 'low' },
        { text: 'Back to the ROSTER.', hi: 'lens:0', pos: 'bot', advance: 'lens:0' },
        { text: 'And modest numbers, gassed and miserable, read F. But a letter is MORE than the numbers: ENERGY and MOOD move it just as much — in both directions!', hi: `ids:${senIds}`, pos: 'low' },
        ...(fresh ? [
          S({ text: `The freshman: the worst RATING in the room — and the only full tank in the building. Players move by DRAGGING: drag ${fresh.name} up onto the floor.`, hi: `p:${fresh.id}`, pos: 'low', advance: `floor:${fresh.id}` }),
          S({ text: 'Look at that letter! Full tanks play a kid ABOVE his numbers.', hi: `p:${fresh.id}`, pos: 'low' }),
          S({ text: `And WHERE he stands matters: ${fresh.name} is a GUARD — brains read big in the BACKCOURT and sag in the FRONTCOURT. Slide him along the top row and watch the letter change.`, hi: 'grid', pos: 'low' }),
          S({ text: `Park ${fresh.name} in the starting BACKCOURT — top row, left.`, hi: `p:${fresh.id}`, pos: 'low', advance: `spot:${fresh.id}:0` }),
        ] : []),
        ...(hurt && hurt.outWeeks > 0 && s.bag.includes('patch')
          ? [S({ text: `Now ${hurt.name} — she'd start every night, healthy. …Wait. The PATCH KIT! Drag it onto her: she plays tonight if you do.`, hi: 'patch', pos: 'top', advance: 'item:patch' })]
          : []),
        ...(hurt ? [S({ text: `${hurt.name} is a CENTER — the FRONTCOURT is hers. Park her in the starting FRONTCOURT: top row, right.`, hi: `p:${hurt.id}`, pos: 'low', advance: `spot:${hurt.id}:2` })] : []),
        { text: "Now — the TEAM BARS: your team's strength, line by line, ranked against the rest of the league.", hi: 'bars', pos: 'top', mark: 'm:bars' },
        // a free look, boxed at the very bottom: the bars are the lesson, so
        // nothing may cover them. Starting the best two is GAME NIGHT's gate
        { text: "Your best players in their best spots move the lines. Shuffle the rest of the five around — watch the bars lean. Tap here when you're done.", pos: 'bot' },
        { text: 'As well as positions, you tell the players WHAT to practice: THE STRATEGY. Tap a different scheme — our bars lean into it. A slightly better chance to not lose. A girl can dream, right?!', hi: 'tac', pos: 'top', advance: 'tac', mark: 'm:tac' },
        { text: "Play with the schemes for a bit — watch the bars lean. Tap here when you've found one you like.", pos: 'top' },
        { text: 'You can run ONE practice each week. But we have no hoop — so all we can give them is a week of REST. They could use it. Hold ▶ RUN.', hi: 'nav', pos: 'lens' },
      ];
    case 'practice2':
      return [
        { text: 'Look at that — a rested squad grades better across the board. Energy IS talent, coach. On to RECRUITING.', hi: 'grid', pos: 'low' },
      ];
    case 'recruiting':
      return [
        { text: 'Under every name: the COMMITMENT gauge — how close each kid is to signing here.', hi: 'board', pos: 'low' },
        ...(gem && !gem.pr.signed
          ? [S({ text: `A few of the nobodies show a flicker of interest. ${gem.pr.name}? They barely know you exist.`, hi: `pr:${gem.pr.id}`, pos: 'low' })]
          : []),
        { text: 'You can run one recruiting action a week. Try to convince them — the free GROUP HOLO-CHAT is all we can afford. Hold ▶ RECRUIT.', hi: 'nav', pos: 'lens' },
      ];
    case 'check':
      return gem && !gem.pr.signed
        ? [S({ text: `Drop the BLANK CHECK on ${gem.pr.name}. Ink, now — no letter, no waiting, no losing them.`, hi: 'check', pos: 'top', advance: 'item:check' })]
        : [];
    case 'matchup':
      return [
        // the gate lives HERE, where it matters: the best two START tonight
        // (skips itself when the lineup already holds)
        ...(fresh && hurt
          ? [S({ text: `First things first — tonight's FIVE. ${fresh.name} and ${hurt.name} are the best we have: make sure both START. Top row.`, pos: 'bot', hold: true, gate: 'bestfive' })]
          : []),
        { text: "The bars: you against them, line by line. The big OVERALL gauge is tonight's win chance.", hi: 'bars', pos: 'top' },
        { text: "And… oh. Oh no. They're going to eat us alive, coach. After the week we've had, I don't know what else there is to give.", hi: 'bars', pos: 'top' },
      ];
    case 'matchup2':
      return [
        { text: 'Look at the gauge now. Still theirs — but only SLIGHTLY. And slightly, coach? Slightly is STEALABLE.', hi: 'bars', pos: 'top' },
      ];
    case 'notebook':
      return [
        { text: 'A night worth remembering. Tap ▤ THE NOTEBOOK — it writes the page down. Scoop asks about last week, every week.', hi: 'notebook', pos: 'top', advance: 'note' },
      ];
    default:
      return [];
  }
}

/** A finished walk hands back its follow-up stories (the caller queues). */
export function tutorialWalkDone(s: GameState, key: string): StoryReq[] {
  const star = tutStar(s);
  if (key === 'starlesson') return [{ defId: 'tut_ship0', beat: 'start', playerId: null }];
  if (key === 'roster' && star && s.bag.includes('timeloop')) {
    return [{ defId: 'tut_haywire', beat: 'start', playerId: star.id }];
  }
  if (key === 'board') return [{ defId: 'tut_cheer0', beat: 'start', playerId: null }];
  if (key === 'potential') return [{ defId: 'tut_fivestar', beat: 'start', playerId: null }];
  if (key === 'cheernote') return [{ defId: 'tut_cheer', beat: 'start', playerId: null }];
  if (key === 'sadboard') return [{ defId: 'tut_booster', beat: 'start', playerId: null }];
  if (key === 'matchup') return [{ defId: 'tut_cheer_speech', beat: 'start', playerId: null }];
  return [];
}

// ---- THE LOCK: during season zero, only the scripted next move works ---------
// Story flows, toasts and the walk's own taps always pass; while a walk step
// waits, ONLY its deed passes; between walks, each phase allows exactly the
// scripted action. Everything else is dimmed and dead.

const TUT_ALWAYS = new Set([
  'story-tap', 'story-choice', 'toast-tap', 'gx-result-tap', 'tut-walk-tap',
  'tut-walk-hold', 'tut-walk-skip', 'card', 'noop', 'week-turn-close', 'item-close',
  'press-start', // a reload mid-walk still lands on the title screen — START must work
  'menu-continue', 'menu-new', 'menu-back', // …and so must the career menu behind it
  'coach-open', 'coach-close', // the settings gear always answers…
  'new-game', // …and NEW GAME inside it is the universal escape hatch
]);

export function tutorialAllows(s: GameState, action: string, id: string): boolean {
  if (s.tutorial === undefined) return true;
  if (TUT_ALWAYS.has(action)) return true;
  const step = s.tutWalk?.steps?.[s.tutWalk.ix];
  if (step) {
    const adv = step.advance ?? 'tap';
    if (adv === `lens:${id}` && action === 'lens-set') return true;
    if (adv === 'note' && action === 'notebook') return true;
    if (adv === 'tac' && action === 'tac-set') return true;
    // the scripted item must stay ALIVE: tutoff would kill the pointerdown
    // that starts the very drag the step is asking for
    if (adv === `item:${id}` && action === 'bag-item') return true;
    // a FREE look (no spotlight) really is free: the lens tabs answer, and
    // on the practice floor so does the tactics board
    if (!step.hi && !step.lock && ['lens-set', 'tac-set'].includes(action)) return true;
    return false;
  }
  // between walks the top menu is a safe room: the standings, the schedule
  // and the job gauge answer everywhere — there is no harm in looking
  if (['stand-open', 'stand-tab', 'stand-close', 'sched-open', 'sched-close', 'job-open', 'job-close'].includes(action)) return true;
  switch (s.phase) {
    case 'weekstart':
      // …and so do the lenses on the Monday screen
      return ['begin-week', 'lens-set'].includes(action);
    case 'facilities':
      return s.facActWk ? action === 'to-scouting' : action === 'fac-run';
    case 'scouting':
      if (s.pendingRecruits.length) return ['board-confirm-open', 'board-confirm-do', 'board-confirm-close', 'lens-set'].includes(action);
      return s.scoutActWk ? ['to-practice', 'lens-set'].includes(action) : action === 'gx-run';
    case 'practice':
      // the ▾ picker stays live so the coach learns it exists — season zero
      // just stocks it with exactly one drill (REST)
      return s.trainedThisWeek
        ? ['to-recruiting', 'lens-set', 'tac-set'].includes(action)
        : ['drill-run', 'drill-sheet', 'drill-sheet-close', 'drill-pick', 'tac-set', 'lens-set'].includes(action);
    case 'recruiting':
      return s.recruitActWk ? ['to-matchup', 'lens-set'].includes(action) : ['gx-run', 'lens-set'].includes(action);
    case 'matchup':
      // the cheer IS tonight's speech: the notebook delivers it — the speech
      // sheet stays closed until season one
      return s.pregameWk
        ? action === 'play-game'
        : ['notebook', 'lens-set'].includes(action);
    case 'gamenight':
      return ['gn-recap', 'gn-verdict', 'gn-pass', 'gn-table', 'continue-result', 'stand-tab'].includes(action);
    case 'teamSelect':
      return ['cut-confirm-open', 'confirm-roster', 'cut-confirm-close', 'lens-set'].includes(action);
    default:
      return true;
  }
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
  pr.commitPct = 0; // he doesn't know the program exists — yet
  observe(pr);
  pr.blurb = 'Shoots until the floodlight gives out. The floodlight blinks first.';
}

// ---- the rigged game ---------------------------------------------------------

/** SEASON ZERO deals its own night: the upset lands, the freshman goes for
    26, nobody gets hurt. The bookie's printed line stays a slight underdog. */
export function tutorialRigGame(s: GameState, r: MyGameResult): void {
  const t = myT(s);
  // the whole night is DEALT: a tight score, an upset by a nose — never a
  // blowout, whatever the sim rolled (forms and the rally swing too hard)
  r.oppScore = 58 + rand(6);
  r.myScore = r.oppScore + 2 + rand(3);
  r.win = true;
  r.share = 0.45; // the gauge read them slightly ahead — and you stole it
  r.needle = r.share;
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

/** What the top bar shows so far: nothing until the story introduces it. */
export function tutorialHeader(s: GameState): { credits: boolean; sched: boolean } {
  const at = s.tutorial ?? 0;
  return {
    credits: s.energy > 0 || s.bag.length > 0 || at >= TUT_AT.FAC,
    sched: at >= TUT_AT.MATCHUP,
  };
}

// ---- the assistant's one-line cue above the nav ------------------------------

export function tutorialHint(s: GameState, stage: string): string | null {
  if (s.tutorial === undefined || s.tutWalk) return null;
  switch (s.phase) {
    case 'weekstart':
      return "Seen enough? CONTINUE — the campus waits.";
    case 'facilities':
      return s.facActWk ? 'CONTINUE TO SCOUTING.' : "Hold ▶ GRAB A MOP — the one campus move we can afford.";
    case 'scouting': {
      if (s.pendingRecruits.length) return 'Drag the kid ONTO the board, bump a nobody down — then CONFIRM THE BOARD.';
      if (!s.scoutActWk) return 'Hold ▶ SEARCH — the LOCAL REC CENTER is free, and the board can always surprise you.';
      return "Board's done. CONTINUE TO PRACTICE.";
    }
    case 'practice': {
      const hurt = tutStandout(s);
      if (hurt && hurt.outWeeks > 0 && s.bag.includes('patch')) return `Drag the PATCH KIT onto ${hurt.name} — she plays tonight if you do.`;
      if (!s.trainedThisWeek) return 'Hold ▶ RUN — TEAM REST is all this gym allows.';
      return "CONTINUE when you're done.";
    }
    case 'recruiting': {
      const gem = tutGem(s);
      if (!s.recruitActWk) return 'Hold ▶ RECRUIT — THE GROUP HOLO-CHAT is free, gentle, everywhere at once.';
      if (s.bag.includes('check') && gem?.where === 'board' && !gem.pr.signed) return `Drag the BLANK CHECK onto ${gem.pr.name}.`;
      return "CONTINUE TO THE MATCHUP — there's a game tonight.";
    }
    case 'matchup':
      return s.pregameWk ? 'Hold PLAY. Win it.' : 'The cheer is in ▤ THE NOTEBOOK — bottom left.';
    case 'gamenight':
      if (stage === 'beat') return 'Tap the court to run the clock.';
      return null;
    default:
      return null;
  }
}

// ---- the beats ---------------------------------------------------------------

STORIES.push(
  // 00 · the screen-opening line: ONE full-screen assistant beat per screen
  {
    id: 'tut_intro',
    kind: 'coach',
    beat: (_b, ctx) => ({
      tag: 'ASSISTANT COACH',
      text: (ctx.data.text as string) ?? '',
    }),
    resolve: () => ({ text: '' }),
  },
  // 01 · SETUP — the call: the apartment, the holo-phone, the shuttle
  {
    id: 'tut_call0',
    kind: 'coach',
    beat: () => ({
      tag: 'THE CALL',
      text: 'You close the door of your windowless apartment in the shady part of the moon-base — mostly to drown out your landlord\'s calls about the three rent checks you owe her.\n\nYou pour the last sip of Moon-Shine™ and settle in for another night of worrying, when the holo-phone rings.',
      choices: [TC('answer', 'ANSWER IT'), TC('ignore', 'LET IT RING')],
    }),
    resolve: (key) => {
      if (key === 'ignore') {
        // the dead end never rewinds the scene: it rings again, and the
        // only door left is picking up
        return {
          text: 'You let it ring. It stops — then starts again, the exact same length, somehow more polite about it.\n\nThe landlord\'s texts, meanwhile, have started mentioning the phone BY NAME.',
          next: { defId: 'tut_call0r', beat: 'start', playerId: null },
        };
      }
      return { text: '', next: { defId: 'tut_call0b', beat: 'start', playerId: null } };
    },
  },
  {
    id: 'tut_call0r',
    kind: 'coach',
    beat: () => ({
      tag: 'THE CALL',
      text: 'It rings again.',
      choices: [TC('answer', 'ANSWER IT')],
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_call0b', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_call0b',
    kind: 'coach',
    beat: (_b, ctx) => {
      const t = ctx.s.teams[ctx.s.myTeamId];
      return {
        tag: 'THE CALL',
        text: `On the other side: a face you vaguely remember — an old student of yours. She\'s an assistant coach now, for the basketball team at the university on ${t.planet.toUpperCase()}.\n\n"Coach. The ${t.name.toUpperCase()} need you."`,
        choices: [TC('go', '"…WHEN DO I START?"')],
      };
    },
    resolve: (_k, ctx) => {
      const t = ctx.s.teams[ctx.s.myTeamId];
      return {
        text: `The next morning, you close the door of your apartment for the last time, and board a shuttle to ${t.planet.toUpperCase()}…`,
        next: { defId: 'tut_call', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_call',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE SPACEPORT',
      text: 'Your assistant meets you at the spaceport with a clipboard and the face of someone who has read it. "Program\'s in shambles, coach. League investigation open, press circling, and the fans chased the last coach off-planet. Literally. There\'s footage."\n\nShe hands you a whistle that has seen things.',
      choices: [TC('in', '"WHAT\'S IN IT FOR ME?"')],
    }),
    resolve: () => ({
      text: '"What\'s in it for me" — you bluff.\n\n"One game left in a dead season, a roster of seniors counting the days, and —" she checks the clipboard, "— a salary." She shakes your hand anyway. Somebody has to be the adult in the room, and everyone here has decided it\'s you.',
    }),
  },
  // 02 · SETUP — the dean, in three sips: the gauge · the credit · the machine
  {
    id: 'tut_dean',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE DEAN',
      // no button: the dialog waits until the coach TAPS the blinking gauge
      // (the UI opens the four opinions over the dean, then lets her go on)
      text: 'The dean is waiting in your office, already pouring two cups. "Let me be clear, coach: I don\'t care about sports. I need GRADUATION numbers. Students who study, behave, and walk out of here with a diploma."\n\nShe points her cup at the JOB SECURITY gauge blinking at the top of your screen.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_dean1b', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_dean1b',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE DEAN',
      text: '"Four opinions hold that bar up: the school, the fans, the players, the public. Right now the only one holding is mine — because I value your… passion. Yes. Let\'s call it passion."',
      choices: [TC('on', '"I WON\'T LET YOU DOWN"')],
    }),
    resolve: () => ({
      text: '',
      next: { defId: 'tut_dean_credit', beat: 'start', playerId: null },
    }),
  },
  {
    id: 'tut_dean_credit',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE BUDGET',
      text: 'She slides a single credit across the desk.\n\n"This is all the budget that\'s left for the season. Good thing there\'s only one game left. Good luck."',
      choices: [TC('take', 'TAKE THE CREDIT'), TC('more', '"WHAT HAPPENED TO THE BUDGET?"')],
    }),
    resolve: (key) => {
      if (key === 'more') {
        return {
          text: '"Basketball happened to the budget, coach. Twenty-six consecutive years of it."\n\nShe does not blink. The credit does not multiply.',
          next: { defId: 'tut_dean_credit', beat: 'start', playerId: null },
        };
      }
      return {
        text: '',
        fx: [{ coachEnergy: 1 }],
        next: { defId: 'tut_dean_item', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_dean_item',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'ONE MORE THING',
      text: '"I almost forgot." She produces a device shaped like an alarm clock with opinions. "Found it in the faculty-lounge trash. A LOCAL TIME MACHINE, the label says — point it at somebody who\'s AWAY and it eats weeks off the wait."\n\n"Allegedly. It was in the trash."',
      choices: [TC('take', '"MAYBE I CAN USE IT"')],
    }),
    // the offer dialog itself carries the assistant's read of the card (the
    // item_offer beat wears her voice in season zero) — she talks while the
    // device is actually on screen
    resolve: () => ({
      text: '',
      fx: [{ giveItem: 'timeloop' }],
    }),
  },
  // 03 · SETUP — the time machine: the idea, the blessing, the drag, the mishap
  {
    id: 'tut_haywire',
    kind: 'player',
    beat: (_b, ctx) => ({
      tag: '',
      text: `A thought arrives, the way bad ideas do: fully dressed. The suspension is two weeks long — and the machine in THE BAG eats weeks.\n\n${ctx.player?.name ?? 'Your star'} pretends not to notice you looking at his paperwork.`,
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_haywire2', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_haywire2',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"Coach — YES. The time machine!" The assistant is already holding the paperwork out to you.\n\n"Point it at the suspension. That\'s a GREAT idea."',
      choices: [TC('ok', '"WHAT COULD GO WRONG?"'), TC('risky', '"THAT FEELS TOO RISKY"')],
    }),
    resolve: (key, ctx) => {
      if (key === 'risky') {
        // the dead end: the institution talks you back to the question
        return {
          text: '"If we play tonight without our star, we have NO chance. The risk is minimal, coach."',
          next: { defId: 'tut_haywire2', beat: 'start', playerId: null },
        };
      }
      (ctx.s.tutSeen ??= []).push('haywire-idea');
      return { text: '' };
    },
  },
  {
    id: 'tut_haywire3',
    kind: 'player',
    beat: (_b, ctx) => ({
      tag: 'THE LOCAL TIME MACHINE',
      text: `The machine whirs, hiccups — and runs BACKWARD.\n\nThere is a small, polite pop: the sound of a timeline deciding it can do without somebody. Where ${ctx.player?.name ?? 'your star'} stood — a pair of sneakers, still warm.\n\nThe machine dissolves into a smell.`,
    }),
    resolve: (_k, ctx) => {
      const p = ctx.player;
      // HIS page first: the roster loses him here, alone — the locker room
      // reacts on the NEXT beat
      return {
        text: '',
        fx: [{ playerId: p?.id, takePlayer: true }],
        next: { defId: 'tut_haywire3b', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_haywire3b',
    kind: 'coach',
    beat: () => ({
      tag: '',
      text: 'The locker room takes it exactly as well as you\'d think. Somebody closes his locker, gently. Nobody says the word "erased."\n\nThe time machine was in the trash for a reason.',
    }),
    resolve: () => ({
      text: 'The room\'s MOOD is one of the four opinions holding up your JOB SECURITY. It is currently letting go of the bar.',
      fx: [{ teamMood: -12 }],
      next: { defId: 'tut_haywire4', beat: 'start', playerId: null },
    }),
  },
  {
    id: 'tut_haywire4',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"Oh wow." The assistant checks the machine\'s warning label, which is also gone. "The chances of that were MINUSCULE. I guess they\'re never zero…"\n\nShe brightens, the way institutions do. "Well — he was graduating in a couple of weeks anyway. He was never going to play for us again either way. Paperwork-wise this is almost clean."',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_haywire5', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_haywire5',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"Now that you\'ve met the team — let\'s move on to the campus, shall we?"',
    }),
    resolve: () => ({ text: '' }),
  },
  // 04 · WEEK — the mop, the janitor, the assistant's read, then the dean
  {
    id: 'tut_mop',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE MOP',
      text: '"This place is a mess," you say, to nobody in particular — and take the mop off its hook.\n\n"Coach, you don\'t have to—" The assistant looks at you for a second, sighs, and grabs the other mop.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_mop2', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_mop2',
    kind: 'coach',
    beat: () => ({
      tag: 'THE MOP',
      text: 'The two of you mop the floor in a contemplative silence.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_janitor', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_janitor',
    kind: 'coach',
    figure: 'janitor',
    beat: () => ({
      tag: 'THE SUPPLY CLOSET',
      text: 'Halfway down the corridor the janitor blocks your path with his cart, glances left, then right, and sets a PATCH KIT on top of your clipboard.\n\nHe nods once — at it, then at you — and leaves before thanks can happen.',
      choices: [TC('take', 'NOD BACK')],
    }),
    resolve: () => ({ text: '', fx: [{ giveItem: 'patch' }], next: { defId: 'tut_patchnote', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_patchnote',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: 'The assistant peers into THE BAG and whistles.\n\n"A PATCH KIT, coach — that\'s a week off an injury, if you put it on the right player. Somebody plays this weekend after all."',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_hoop', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_hoop',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE PARKING LOT',
      text: 'Through the window you spot the dean unlocking her car, and lean out to ask the obvious question: why does the gym not have a hoop?\n\nShe looks back at the building for a long moment. "I have one. In my backyard. It\'s regulation — mostly. Give me a week."',
      choices: [TC('ok', '"A HOOP IS A HOOP"')],
    }),
    resolve: (_k, ctx) => {
      // the campus screen changes NOW: THE GYM reads ARRIVING NEXT WEEK
      ctx.s.futureBeats.push({ weeksLeft: 1, defId: 'facility_arrives', beat: 'start', playerId: null, data: { facId: 'gym' } });
      return { text: '' };
    },
  },
  // 05 · WEEK — the head cheerleader: the cheer, the notebook, THEN the marker
  {
    id: 'tut_cheer0',
    kind: 'coach',
    figure: 'cheerleader',
    beat: (_b, ctx) => {
      const t = ctx.s.teams[ctx.s.myTeamId];
      const nm = t.name.toUpperCase();
      return {
        tag: 'THE HEAD CHEERLEADER',
        text: `Someone cartwheels in through the door. "Hey! Are you the new coach? You look like you could use some SCHOOL SPIRIT!"\n\n"Repeat after me: Go! Go! ${nm}! Go, go, go, ${nm}!"`,
        choices: [TC('go', '"GO… GO…?"')],
      };
    },
    resolve: (_k, ctx) => {
      (ctx.s.tutSeen ??= []).push('cheer0');
      return { text: 'Surprisingly, shouting it back makes you feel a lot better.\n\nYou should remember her cheer.' };
    },
  },
  {
    id: 'tut_cheer',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: 'On her way out she catches sight of your board — all question marks — and stops dead. She reads it, then reads your face, and sighs.\n\n"I\'ve seen every one of these kids on campus visits. Give me the marker." She uncaps it with her teeth.',
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
      return {
        text: 'She fills in the whole board from memory.\n\nThe truth, in marker: all terrible. Two stars, tops, any of them.',
        next: { defId: 'tut_cheer2', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_cheer2',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: '"You want better names," she says, capping the marker, "you need better parties."\n\n"Kappa Nebula\'s doors are open to the program now. That\'s GREEK ROW — and that\'s me."',
      choices: [TC('ok', '"NOTED"')],
    }),
    resolve: (_k, ctx) => {
      if (ctx.s.facilities) ctx.s.facilities.greekrow = 1;
      // the marker board is legible now: the star lesson takes the floor
      // (the walk), and the ship talk waits on the far side of it
      (ctx.s.tutSeen ??= []).push('boardread');
      return { text: '' };
    },
  },
  {
    id: 'tut_ship0',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"Two stars won\'t win you anything, coach — these kids won\'t amount to much," the assistant says, watching the cheerleader go. "With a real SHIP you could scout anywhere in the galaxy you could reach."\n\n"We don\'t have a ship. We have a bus pass — and the LOCAL REC CENTER."',
      choices: [TC('ok', '"THE REC CENTER IT IS"')],
    }),
    resolve: (_k, ctx) => {
      (ctx.s.tutSeen ??= []).push('shipless');
      return { text: '' };
    },
  },
  // 05b · the outburst — AFTER the potential lesson has sunk in
  {
    id: 'tut_fivestar',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: "Coach! A FIVE-STAR recruit?? I have never seen one of those before!\n\nLet's hope they want to come play for US.",
    }),
    resolve: (_k, ctx) => {
      (ctx.s.tutSeen ??= []).push('fivestar');
      return { text: '' };
    },
  },
  // 06 · WEEK — the sad holo-chat, then the booster: faith first, then the ink
  {
    id: 'tut_stamp',
    kind: 'coach',
    figure: 'assistant',
    beat: (_b, ctx) => {
      const gem = tutGem(ctx.s);
      return {
        tag: 'ASSISTANT COACH',
        text: `The holo-chat lands… a few percent, board-wide. The assistant watches ${gem ? gem.pr.name : 'the rec-center kid'} not call back.\n\n"At this rate they\'ll graduate from somewhere else before we can afford to reimburse them the stamp on a commitment letter."`,
      };
    },
    resolve: (_k, ctx) => {
      (ctx.s.tutSeen ??= []).push('stamp');
      return { text: '' };
    },
  },
  {
    id: 'tut_booster',
    kind: 'coach',
    figure: 'booster',
    beat: () => ({
      tag: 'THE VOICE OF THE FANS',
      text: 'A chrome suit fills the doorway before the holo-chat even cools.\n\n"Coach. I speak for the fans, and the fans have decided to believe in you. Don\'t ask why — it wasn\'t unanimous."',
      choices: [TC('who', '"AND YOU ARE…?"')],
    }),
    resolve: () => ({
      text: '',
      next: { defId: 'tut_check', beat: 'start', playerId: null },
    }),
  },
  {
    id: 'tut_check',
    kind: 'coach',
    figure: 'booster',
    beat: (_b, ctx) => {
      const gem = tutGem(ctx.s);
      return {
        tag: 'THE BLANK CHECK',
        text: gem && !gem.pr.signed
          ? `He produces a BLANK CHECK the way other people produce business cards.\n\n"That kid from the rec center? The fans would like him in your colors. My treat." He sets it on the desk and leaves without waiting for thanks.`
          : 'He produces a BLANK CHECK the way other people produce business cards — then frowns at your board.\n\n"Nobody worth the ink this week. Keep it anyway. My help gets bigger. It gets messier. You\'ll see."',
      };
    },
    resolve: () => ({ text: '', fx: [{ giveItem: 'check' }] }),
  },
  // 07 · WEEK — Scoop questions the week, before the bus leaves
  {
    id: 'tut_scoop',
    kind: 'coach',
    figure: 'scoop',
    beat: (_b, ctx) => {
      const gem = tutGem(ctx.s);
      return {
        tag: '“SCOOP” QUAZAR · ON AIR',
        text: gem?.pr.signed
          ? 'The press catches you boarding the bus. Scoop Quazar, six legs, one fedora, recorder out: "A five-star talent signs off ONE conversation, coach. To THIS program. Walk me through that."'
          : 'The press catches you boarding the bus. Scoop Quazar, six legs, one fedora, recorder out: "Oh-and-nine, coach, and you\'re smiling. Give me a quote worth six legs standing here."',
        choices: [TC('bluff', '"THEY\'RE A FRIEND OF THE FAMILY"', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL', note: 'he checks things' } })],
      };
    },
    resolve: () => ({
      text: '"A friend of the family," he repeats, and — this once — the recorder clicks off. "Everybody\'s got friends. Even this program, apparently."',
      next: { defId: 'tut_scoop_b', beat: 'start', playerId: null },
    }),
  },
  {
    id: 'tut_scoop_b',
    kind: 'coach',
    figure: 'scoop',
    beat: () => ({
      tag: '“SCOOP” QUAZAR · IN PRINT',
      text: 'The piece runs almost warm.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_scoop_c', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_scoop_c',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"He\'ll be back most weeks with difficult questions," the assistant says, watching the recorder disappear into a coat with too many pockets.',
      choices: [TC('ok', '"NOTED"')],
    }),
    resolve: () => ({ text: '"Make sure you are prepared for them."' }),
  },
  // 08 · WEEK — the bus breaks down (the assistant frames the stakes FIRST)
  {
    id: 'tut_bus',
    kind: 'coach',
    art: 'bus',
    artEvent: 'stranded',
    beat: () => ({
      tag: 'BREAKDOWN',
      text: 'Halfway to the away game the bus shudders, coughs, and drifts into a service asteroid…\n\n"Coach — if we don\'t make tip-off, we FORFEIT. Automatic loss. The team will be devastated, the booster will be furious, and the dean… I don\'t want to find out about the dean."',
      choices: [TC('think', 'THINK, COACH. THINK.')],
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_bus2', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_bus2',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE PLAN',
      text: '"We could call the mech-goblins," the assistant offers. "But coach — they don\'t work for free."\n\nThen you remember it: the dean\'s credit, still in your pocket. The assistant is already on the horn.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_goblin', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_goblin',
    kind: 'coach',
    figure: 'goblin',
    beat: () => ({
      tag: 'THE MECH-GOBLINS',
      text: 'The head goblin slides out from under the bus before it has fully stopped rolling, sniffs the engine once, and names her price.\n\n"One credit." Which is, exactly, everything you have.',
      choices: [
        TC('pay', 'PAY THE MECH-GOBLINS (1¢)', { cost: 1 }),
        TC('plead', 'PROMISE THEM SEASON TICKETS'),
      ],
    }),
    resolve: (key) => {
      if (key === 'plead') {
        return {
          text: '"Season tickets," she repeats, unimpressed. The wrench does not come out.\n\nSomewhere behind you, the word FORFEIT clears its throat.',
          next: { defId: 'tut_goblin2', beat: 'start', playerId: null },
        };
      }
      return {
        text: 'You hand over the credit. The goblin swipes it through a terminal that immediately catches fire. "Broken," she shrugs — fixing your bus anyway and handing the credit back out of professional embarrassment.\n\nYou make tip-off with your credit still in your pocket.',
        fx: [{ coachEnergy: 1 }],
      };
    },
  },
  {
    id: 'tut_goblin2',
    kind: 'coach',
    figure: 'goblin',
    beat: () => ({
      tag: 'THE MECH-GOBLINS',
      text: 'She holds out an oil-black palm and waits. Goblins can wait a very long time.',
      choices: [TC('pay', 'PAY THE MECH-GOBLINS (1¢)', { cost: 1 })],
    }),
    resolve: () => ({
      text: 'You hand over the credit. The goblin swipes it through a terminal that immediately catches fire. "Broken," she shrugs — fixing your bus anyway and handing the credit back out of professional embarrassment.\n\nYou make tip-off with your credit still in your pocket.',
      fx: [{ coachEnergy: 1 }],
    }),
  },
  // 09 · PREGAME — the cheerleader points at the notebook
  {
    id: 'tut_cheer_speech',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: 'The head cheerleader is somehow already in the visitors\' locker room — she came on her own credit.\n\n"Coach." She points at your pocket. "You WROTE IT DOWN. The cheer. Use it."',
      choices: [TC('ok', 'REACH FOR THE NOTEBOOK')],
    }),
    resolve: (_k, ctx) => {
      (ctx.s.tutSeen ??= []).push('cheerspeech');
      return { text: '' };
    },
  },
  // 09b · THE CHEER, run off the page: the room answers, the roof lifts,
  // and only then does it become a speech you own (OUR HOUSE, greyed for
  // tonight — you already said it)
  {
    id: 'tut_cheerrun',
    kind: 'coach',
    beat: (_b, ctx) => {
      const nm = ctx.s.teams[ctx.s.myTeamId].name.toUpperCase();
      return {
        tag: 'THE PAGE COMES OUT',
        text: `You unfold the notebook and read it exactly as written, which is the only way you know it:\n\n"GO! GO! ${nm}!"`,
        choices: [TC('go', '"GO, GO, GO!"')],
      };
    },
    resolve: (_k, ctx) => {
      const nm = ctx.s.teams[ctx.s.myTeamId].name.toUpperCase();
      return {
        text: `A beat of silence — the dangerous kind.\n\nThen the room answers: "GO, GO, GO, ${nm}!" — and EXPLODES. Chairs scraping back, lockers drumming, somebody chanting half a beat off. Even the seniors are on their feet.`,
        fx: [{ teamMood: 48 }],
        next: { defId: 'tut_pumped', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_pumped',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'ASSISTANT COACH',
      text: '"Whatever you just did, coach," the assistant grins over the noise, "bottle it."',
      choices: [TC('bottle', 'BOTTLE IT')],
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_ourhouse', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_ourhouse',
    kind: 'coach',
    beat: () => ({
      tag: 'A SPEECH IS BORN',
      text: 'You write one line under the cheer, for every game night to come: THIS IS OUR HOUSE.\n\nIt goes on your sheet with the others — though tonight it\'s already been said. Tonight you just hit PLAY.',
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      // tonight's speech IS the cheer: delivered, landed, lineup locked
      s.pregameWk = true;
      s.speechTook = true;
      s.plan = 'rally';
      (s.tutSeen ??= []).push('cheered');
      return { text: '', fx: [{ unlockPlan: 'rally' }] };
    },
  },
  // 10 · PREGAME — the bookie says hello
  {
    id: 'tut_bookie',
    kind: 'coach',
    figure: 'bookie',
    beat: () => ({
      tag: 'THE BOOKIE',
      text: 'A wide hat and a wider smile wait for you in the tunnel to the court, chalking numbers onto a little board.\n\n"No offense, coach — I\'ve got you as the underdog tonight. Numbers are numbers. I don\'t make them; I only collect on them." He taps the board twice, gently, the way you knock on a coffin. "Prove mine wrong and I\'ll be the happiest loser in the building. It happens less than you\'d hope."',
    }),
    resolve: () => ({ text: '' }),
  },
  // 11 · after the horn — the bookie settles up
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
      if (ctx.s.facilities) ctx.s.facilities.cryo = 1;
      return { text: 'By the time you\'re home, a CRYO BAY stands where the ice-filled dumpster used to be — still cold from the truck. The dumpster retires with honors.\n\nNobody mentions a price. Somewhere, all the same, a ledger you will never be shown opens a column with your name at the top.' };
    },
  },
  // 12 · WRAP — the road home: the attendant, the kid, the last credit
  {
    id: 'tut_road',
    kind: 'coach',
    art: 'bus',
    artEvent: 'hoop',
    beat: () => ({
      tag: 'THE ROAD HOME',
      text: 'The bus threads the dark, the win still warm in it…\n\nAt a refuel stop on a nothing moon, a kid is shooting alone on a deserted hoop under one working floodlight. Form like a metronome. He doesn\'t stop when the whole team files out to watch.',
      choices: [TC('watch', 'WATCH A WHILE')],
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_attend', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_attend',
    kind: 'coach',
    figure: 'attendant',
    beat: () => ({
      tag: 'THE GAS-STATION ATTENDANT',
      text: 'The attendant tops off the bus without ever taking their eyes off the kid.\n\n"Out here every night. Rain, meteor showers, doesn\'t matter. Nobody\'s ever stopped to watch before."',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_kid', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_kid',
    kind: 'coach',
    beat: (_b, ctx) => {
      const s = ctx.s;
      const counter = { nextId: s.nextId };
      const kid = genPlayerAt(counter, 28 + rand(8), 0, undefined, undefined, 22 + rand(12));
      s.nextId = counter.nextId;
      return {
        tag: 'THE KID AT THE HOOP',
        text: `You walk over between racks. The kid's name is ${kid.name}. He talks the way he shoots — not much, all rhythm — and he hasn't eaten since the floodlight came on.\n\nThe diner sign behind the pumps is still lit.`,
        choices: [TC('meal', 'BUY HIM A HOT MEAL (1¢)', { cost: 1, up: { pct: 50, cls: 'SPIRIT', note: 'voyages find people' } })],
        data: { player: kid },
      };
    },
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const kid = ctx.data.player as Player;
      s.commits.push(kid);
      return {
        text: `One hot meal and forty minutes of jump-shot talk later, ${kid.name} has your holo-code and two-thirds of his heart committed.\n\n"He'll sign," the assistant says, watching him drain another one. "Kids you feed always sign."`,
        next: { defId: 'tut_dean2', beat: 'start', playerId: null },
      };
    },
  },
  // 12b · the LETTER: the real signing-day wheel, run once with training
  // wheels — rigged, because kids you feed always sign
  {
    id: 'tut_kid2',
    kind: 'coach',
    beat: (_b, ctx) => {
      const kid = ctx.s.commits[ctx.s.commits.length - 1];
      return {
        tag: 'THE FIRST LETTER',
        text: `One more piece of business: the commitment letter — to a kid on a nothing moon, from the program that stopped to watch him shoot. Every signing ends like this: a letter, a number, and a wheel you don't control.\n\nHis holo-line rings…`,
        data: { wheel: true, pct: 62, commit: true, name: kid?.name ?? 'The kid' },
      };
    },
    resolve: (_k, ctx) => {
      const kid = ctx.s.commits[ctx.s.commits.length - 1];
      return {
        text: `${kid?.name ?? 'The kid'} COMMITS before the wheel even settles. Kids you feed always sign.`,
        next: { defId: 'tut_booster2', beat: 'start', playerId: null },
      };
    },
  },
  // 13 · WRAP — the gifts: the stadium, the archive & the nerd, the "car"
  {
    id: 'tut_dean2',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'BLEACHER STEEL',
      text: 'Back on campus, the dean is directing two contractors and a truckload of bleacher steel with her coffee hand.\n\n"A small stadium. Over the summer. Don\'t thank me — sell it out."',
      choices: [TC('ok', '"EVERY SEAT"')],
    }),
    resolve: (_k, ctx) => {
      if (ctx.s.facilities) ctx.s.facilities.stadium = 1;
      // her opinion arrives with her steel: the characters reward the WEEK,
      // not the handshake (playtest #6)
      return { text: '', fx: [{ heatS: -25 }], next: { defId: 'tut_scoop2', beat: 'start', playerId: null } };
    },
  },
  {
    id: 'tut_scoop2',
    kind: 'coach',
    figure: 'scoop',
    beat: (_b, ctx) => ({
      tag: 'ONE MORE QUESTION',
      text: 'Scoop again, recorder out: "For the record, coach — who led your team in scoring in the finale?"\n\nThe notebook in your pocket feels suddenly heavy.',
      data: { noteKey: `mvp:${ctx.s.season}:${ctx.s.week}` },
    }),
    resolve: (key, ctx) => {
      const noted = key === 'notebook';
      // the used page leaves the book — spent pages don't clutter season one
      if (noted) ctx.s.notebook = ctx.s.notebook.filter((n) => n.key !== ctx.data.noteKey);
      return {
        text: noted
          ? 'You don\'t even blink — you read it straight off the notebook page, stat line and all.\n\nScoop lowers the recorder, genuinely moved. "A coach who keeps RECORDS." He clears six legs\' worth of throat…'
          : 'You answer from memory, close enough to true, and he lets it stand.\n\n"Somebody in this program should learn to write things down." He clears six legs\' worth of throat…',
        fx: [{ opP: 3 }],
        next: { defId: 'tut_scoop2b', beat: 'start', playerId: null },
      };
    },
  },
  {
    id: 'tut_scoop2b',
    kind: 'coach',
    figure: 'scoop',
    beat: () => ({
      tag: 'ONE MORE QUESTION',
      text: '"What a breath of fresh air. As a thank-you: the Gazette\'s archive — every box score I ever filed — goes to your school library."',
      choices: [TC('ok', 'THANK HIM')],
    }),
    resolve: () => ({
      text: 'You thank him — and can\'t help wondering if he\'s really just cleaning out his garage.',
      fx: [{ opP: 25 }],
      next: { defId: 'tut_nerd', beat: 'start', playerId: null },
    }),
  },
  {
    id: 'tut_nerd',
    kind: 'coach',
    figure: 'nerd',
    beat: () => ({
      tag: 'THE LIBRARY DOOR',
      text: 'A student is waiting at the library steps, buried to the elbows in Gazette crates, glasses fogged with joy.\n\n"Hi. I\'m the librarian. Until this morning that meant guarding one shelf of damp magazines. It\'s an actual LIBRARY now." They shelve the first box score like scripture. "Send your athletes over when they\'re failing something. I\'ll tutor them. …Reluctantly. But I will."',
      choices: [TC('ok', '"WELCOME TO THE PROGRAM"')],
    }),
    resolve: (_k, ctx) => {
      if (ctx.s.facilities) ctx.s.facilities.library = 1;
      // the road kid's letter goes out before the booster's "car" arrives
      return { text: '', next: { defId: 'tut_kid2', beat: 'start', playerId: null } };
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
      if (ctx.s.facilities) ctx.s.facilities.ship = 1;
      return {
        text: 'THE SCOUTING SHIP, such as it is — the home planet is in range now, and the galaxy past it is a reason to build.',
        fx: [{ heatB: -25 }],
        next: { defId: 'tut_bye', beat: 'start', playerId: null },
      };
    },
  },
  // 14 · WRAP — the goodbye comes BEFORE the tryouts, then the cut
  {
    id: 'tut_bye',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'TRYOUTS',
      text: 'The assistant hands you the clipboard — the whole clipboard.\n\n"Tryouts, coach. Two recruits inked, the freshman had a summer you would not believe, the standout\'s healthy, and the walk-on line goes around the block. Cut it down to nine and start SEASON ONE."',
      choices: [TC('go', 'RUN THE TRYOUTS')],
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_bye2', beat: 'start', playerId: null } }),
  },
  // 15 · the goodbye — and only THEN the selection grid
  {
    id: 'tut_bye2',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE TRAINING WHEELS',
      text: 'She puts on her hat before you reach the gym doors.\n\n"See that ? button, top right of your screen? That\'s me now. It was an honor, coach."',
      choices: [TC('bye', 'IT WAS. GO HOME.')],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const t = myT(s);
      // the standard kit returns with the training wheels off
      s.knownPlans = [...STARTING_PLANS];
      s.knownInstr = [...STARTING_INSTRUCTIONS];
      s.facilities = { ship: 1, gym: 1, cryo: 1, library: 1, stadium: 1, greekrow: 1 };
      // anyone still lost past the horizon walks to the void (the erased star
      // already rests in the alumni ledger — this catches any stragglers)
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
      // the LOCK holds through the tryouts (confirm-the-roster only)
      s.tutorial = TUT_AT.TRYOUTS;
      delete s.tutWalk;
      return { text: '' };
    },
  },
  // 16 · SEASON ONE opens on the dean's terms — every new career, tutorial
  // or not (finalizeRoster queues it in front of her envelope)
  {
    id: 'dean_intro',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE DEAN',
      text: '"I hear you\'re taking over the basketball program."\n\nThe dean does not sit down.',
      choices: [TC('ok', '"THAT\'S ME"')],
    }),
    resolve: () => ({
      text: '"Personally, I don\'t care about sports — I just want this school to keep its excellent graduation record. For that, I need every student — your players included — keeping their GPA up and behaving."',
    }),
  }
);
