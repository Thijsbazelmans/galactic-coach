// THE TUTORIAL SEASON (v5 M4 — WEEK ZERO, paced): one scripted week as
// season 0. A doomed program, week 10 of a lost season (0–9), one game to
// coach. Everything is authored — outcomes are pinned, story choices land
// where the script says — and it teaches by DOING and SHOWING, one thing at
// a time. Full-screen dialogs are for STORY MOMENTS; explanation happens on
// the live screen through THE WALK: the assistant's floating box, one
// spotlight per step, tap to advance. Its secret job stays: every character
// hands the coach one facility, so season 1 opens with the campus at level 1.
//
// Engine shape: `s.tutorial` is the stage index (TUT_AT). state.ts asks
// `tutorialArrive(s, key)` as the coach reaches each screen; the UI asks
// `tutorialWalkStart(s, gnStage)` when the floor is quiet and runs the walk;
// a finished walk hands its follow-up stories back via `tutorialWalkDone`.

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

/** The injured standout — the one the patch kit is FOR. */
export function tutStandout(s: GameState): Player | null {
  return myT(s).players.find((p) => p.outKind === 'injury') ?? null;
}

/** The suspended star (later: the one lost in time). */
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
  // every regular speech is on the sheet (the assistant explains them on the
  // matchup) — but tonight only THE RALLY will actually be given
  s.knownPlans = [...STARTING_PLANS];
  s.knownInstr = [];

  const counter = { nextId: s.nextId };
  const names = new Set<string>();

  // the league around you — real enough to have buried you all season
  for (const team of s.teams) {
    if (team.id === teamId) continue;
    team.players = genRosterAt(counter, 38 + rand(9), names);
    autoLineup(team);
    team.wins = 5 + rand(4);
    team.losses = 9 - team.wins;
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
  seed(star, 7, 15); // suspended for the last two
  star.stats.mvp = 2;
  seed(standout, 8, 11);
  seed(fresh, 4, 2); // garbage minutes, big grin
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
  s.tutorial = TUT_AT.BOOT;
  s.tutSeen = [];
  delete s.tutWalk;
  return [
    { defId: 'tut_call', beat: 'start', playerId: null },
    { defId: 'tut_dean', beat: 'start', playerId: null },
  ];
}

// ---- the script asks for the floor as the coach reaches each point -----------

export function tutorialArrive(s: GameState, key: string): StoryReq[] {
  const at = s.tutorial ?? 0;
  if (key === 'facilities' && at < TUT_AT.FAC) {
    s.tutorial = TUT_AT.FAC;
    return []; // the walk speaks first; the dean waits in the parking lot
  }
  if (key === 'scouting' && at < TUT_AT.SCOUT) {
    s.tutorial = TUT_AT.SCOUT;
    return []; // the walk explains the board; the cheerleader comes after
  }
  if (key === 'practice' && at < TUT_AT.PRACTICE) {
    s.tutorial = TUT_AT.PRACTICE;
    return [];
  }
  if (key === 'recruiting' && at < TUT_AT.RECRUIT) {
    s.tutorial = TUT_AT.RECRUIT;
    return [];
  }
  // the charm move landed: the booster fills the doorway
  if (key === 'recruited' && at < TUT_AT.RECRUITED) {
    s.tutorial = TUT_AT.RECRUITED;
    return [{ defId: 'tut_booster', beat: 'start', playerId: null }];
  }
  // the week wraps toward the game: Scoop first, THEN wheels up, THEN the bus
  if (key === 'matchup' && at < TUT_AT.MATCHUP) {
    s.tutorial = TUT_AT.MATCHUP;
    return [
      { defId: 'tut_scoop', beat: 'start', playerId: null },
      { defId: 'travel_out', beat: 'start', playerId: null },
      { defId: 'tut_bus', beat: 'start', playerId: null },
    ];
  }
  // the first speech attempt: the cheerleader walks in with the words
  if (key === 'speech' && at < TUT_AT.SPEECH) {
    s.tutorial = TUT_AT.SPEECH;
    return [{ defId: 'tut_cheer_speech', beat: 'start', playerId: null }];
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
  /** what gets the spotlight: 'grid' 'row:0..2' 'p:<id>' 'pr:<id>' 'lens:0..2'
      'nav' 'bag:<itemId>' 'notebook' 'tac' 'bars' 'board' 'fac' 'jobbar' */
  hi?: string;
  /** where the box floats (default 'bot') */
  pos?: 'top' | 'mid' | 'bot';
  /** how the step advances: default tap on the box; 'lens:N' waits for that
      lens tab, 'note' for a notebook entry, 'item:<id>' for that item landing */
  advance?: string;
}

/** Which walk wants the floor right now (null = none). The UI calls this
    only when no story holds the stage. */
export function tutorialWalkStart(s: GameState, gnStage: string): string | null {
  if (s.tutorial === undefined || s.tutWalk) return null;
  const at = s.tutorial;
  const seen = s.tutSeen ?? [];
  const want = (key: string): string | null => (seen.includes(key) ? null : key);
  if (s.phase === 'weekstart' && at >= TUT_AT.BOOT) return want('roster');
  if (s.phase === 'facilities' && at >= TUT_AT.FAC) return want('facilities');
  if (s.phase === 'scouting' && at >= TUT_AT.SCOUT) {
    if (!seen.includes('board')) return 'board';
    const gem = tutGem(s);
    if (s.scoutActWk && !s.pendingRecruits.length && gem?.where === 'board') return want('potential');
    return null;
  }
  if (s.phase === 'practice' && at >= TUT_AT.PRACTICE) return want('practice');
  if (s.phase === 'recruiting' && at >= TUT_AT.RECRUIT) {
    if (!seen.includes('recruiting')) return 'recruiting';
    const gem = tutGem(s);
    if (s.bag.includes('check') && gem?.where === 'board' && !gem.pr.signed) return want('check');
    return null;
  }
  if (s.phase === 'matchup' && at >= TUT_AT.MATCHUP && !s.pregameWk) return want('matchup');
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
  switch (key) {
    case 'roster':
      return [
        { text: 'This is your team, coach.', hi: 'grid' },
        { text: 'Mostly tired seniors playing out the string. Look at those tanks.', hi: `ids:${seniors.map((p) => p.id).join(',')}` },
        ...(star ? [S({ text: `${star.name} is the one real player — suspended two weeks. Academics.`, hi: `p:${star.id}` })] : []),
        ...(hurt ? [S({ text: `${hurt.name} would start every night anywhere. Hurt — back in a week.`, hi: `p:${hurt.id}` })] : []),
        ...(fresh ? [S({ text: `And the freshman, ${fresh.name}: can't rate him, meters full, grins at walls. Keep an eye on that one.`, hi: `p:${fresh.id}` })] : []),
        { text: 'Top row STARTS tonight.', hi: 'row:0', pos: 'bot' },
        { text: 'Middle row is the BENCH.', hi: 'row:1', pos: 'top' },
        { text: 'Bottom row watches — the RESERVES. Drag cards to move people around.', hi: 'row:2', pos: 'top' },
        { text: "Tap STATS — the season so far. It has not been pretty.", hi: 'lens:1', pos: 'top', advance: 'lens:1' },
        { text: 'Tap ABILITIES — the shape of a player, and the outline is how far the ceiling goes.', hi: 'lens:2', pos: 'top', advance: 'lens:2' },
        { text: 'And back to the ROSTER.', hi: 'lens:0', pos: 'top', advance: 'lens:0' },
      ];
    case 'facilities':
      return [
        { text: 'The campus. Six facilities — and every one of them is a level-zero disgrace.', hi: 'fac' },
        { text: 'The gym has no hoop. The "cryo bay" is an ice-filled dumpster. You get the idea.', hi: 'fac' },
        { text: 'One campus move a week: order an upgrade — or grab a mop. Guess which one we can afford.', hi: 'nav' },
      ];
    case 'board':
      return [
        { text: 'The big board: nine names, nine question marks. Scouting is finding out who they are.', hi: 'board' },
        { text: 'The rows are your priority — TARGETS up top, LAST RESORTS at the bottom. Drag to reorder.', hi: 'rows' },
        { text: "One scouting move a week. The LOCAL REC CENTER search is free — and it's all the range this program has.", hi: 'nav' },
      ];
    case 'potential':
      return gem
        ? [
            S({ text: `The new kid, ${gem.pr.name}. The rating reads ?? — nobody has seen him play a real game.`, hi: `pr:${gem.pr.id}` }),
            S({ text: 'Tap POTENTIAL.', hi: 'lens:2', pos: 'top', advance: 'lens:2' }),
            S({ text: 'The stars are an estimate of how good a player could BECOME. Five. On this board, that is not a typo.', hi: `pr:${gem.pr.id}` }),
            S({ text: 'Whatever you do this week, coach — keep the kid.', hi: `pr:${gem.pr.id}` }),
          ]
        : [];
    case 'practice':
      return [
        { text: 'Practice. Look at the LETTERS, not the numbers — the grade is what a body is worth in that slot, tonight.', hi: 'grid' },
        ...(fresh ? [S({ text: `${fresh.name}, full tanks — fresh legs outgrade tired talent. Drag him onto the floor.`, hi: `p:${fresh.id}` })] : []),
        ...(hurt && hurt.outWeeks > 0 && s.bag.includes('patch')
          ? [S({ text: `The janitor's PATCH KIT — drag it onto ${hurt.name}. She plays tonight if you do.`, hi: 'patch', pos: 'top', advance: 'item:patch' })]
          : []),
        { text: 'The tactics board: tap a scheme and watch the bars lean. It stays set until you change it.', hi: 'tac' },
        { text: 'This gym has no hoop, so TEAM REST is the whole menu. Hold ▶ RUN.', hi: 'nav' },
      ];
    case 'recruiting':
      return [
        { text: 'Recruiting: one charm move a week to win the board over.', hi: 'board' },
        { text: 'The good moves need credits or facilities. We have neither. The free GROUP HOLO-CHAT it is.', hi: 'nav' },
        ...(gem && !gem.pr.signed
          ? [S({ text: `And ${gem.pr.name}? At this rate he signs with a real program before we can afford a stamp.`, hi: `pr:${gem.pr.id}` })]
          : []),
      ];
    case 'check':
      return gem && !gem.pr.signed
        ? [S({ text: `Drop the BLANK CHECK on ${gem.pr.name}. Ink, now — no letter, no waiting, no losing him.`, hi: 'check', pos: 'top', advance: 'item:check' })]
        : [];
    case 'matchup':
      return [
        { text: 'The matchup. What a week: a mopped gym, a patched starter, a five-star signature — and one game to show for it.', hi: 'bars' },
        { text: "The bars are you against them, line by line. The big OVERALL rope is tonight's win chance.", hi: 'bars' },
        { text: 'Before tip-off you give the room a SPEECH — every speech trades one thing for another. Pick with ▾, then hold the button.', hi: 'nav' },
      ];
    case 'notebook':
      return [
        { text: "A night worth remembering. Tap ▤ THE NOTEBOOK — it writes the page down. Scoop asks about last week, every week.", hi: 'notebook', pos: 'top', advance: 'note' },
      ];
    default:
      return [];
  }
}

/** A finished walk hands back its follow-up stories (the caller queues). */
export function tutorialWalkDone(s: GameState, key: string): StoryReq[] {
  const star = tutStar(s);
  if (key === 'roster' && star && s.bag.includes('timeloop')) {
    return [{ defId: 'tut_haywire', beat: 'start', playerId: star.id }];
  }
  if (key === 'facilities') return [{ defId: 'tut_hoop', beat: 'start', playerId: null }];
  if (key === 'board') return [{ defId: 'tut_cheer', beat: 'start', playerId: null }];
  return [];
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
      return "Your roster, coach. CONTINUE when you've seen enough — the campus waits.";
    case 'facilities':
      return s.facActWk ? 'CONTINUE TO SCOUTING.' : "Hold ▶ GRAB A MOP — the one campus move we can afford.";
    case 'scouting': {
      if (s.pendingRecruits.length) return 'The board is full — DRAG the new kid onto it and let a nobody go. (Not the kid. Keep the kid.)';
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
      return s.pregameWk ? 'Hold PLAY. Win it.' : 'Hold ▶ SPEECH — give them THE RALLY.';
    case 'gamenight':
      if (stage === 'beat') return 'Tap the court to run the clock.';
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
      text: 'Your assistant meets you at the spaceport with a clipboard and the face of someone who has read it. "Program\'s in shambles, coach. League investigation open, press circling, and the fans chased the last coach off-planet. Literally. There\'s footage."\n\nShe hands you a whistle that has seen things.',
      choices: [TC('in', '"WHAT\'S IN IT FOR ME?"')],
    }),
    resolve: () => ({
      text: '"One game left in a dead season, a roster of seniors counting the days, and —" she checks the clipboard, "— a salary." She shakes your hand anyway. Somebody has to be the adult in the room, and everyone here has decided it\'s you.',
    }),
  },
  // 02 · SETUP — the dean, in three sips: the gauge · the credit · the machine
  {
    id: 'tut_dean',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE DEAN',
      text: 'The dean is waiting in your office, already pouring two cups. "I played here, you know. Class of — never mind the class."\n\nShe taps the JOB SECURITY gauge blinking at the top of your screen. "Four opinions hold that bar up: the school, the fans, the players, the public. Right now the only one holding is mine."',
      choices: [TC('on', '"I WON\'T LET YOU DOWN"')],
    }),
    resolve: () => ({
      text: '',
      fx: [{ heatS: -25 }],
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
      choices: [TC('take', 'TAKE THE CREDIT')],
    }),
    resolve: () => ({
      text: '',
      fx: [{ coachEnergy: 1 }],
      next: { defId: 'tut_dean_item', beat: 'start', playerId: null },
    }),
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
    resolve: () => ({
      text: '',
      fx: [{ giveItem: 'timeloop' }],
    }),
  },
  // 03 · SETUP — the time machine goes haywire
  {
    id: 'tut_haywire',
    kind: 'player',
    beat: (_b, ctx) => ({
      tag: 'THE LOCAL TIME MACHINE',
      text: `A thought arrives, the way bad ideas do, fully dressed: the suspension is two weeks long — and the machine in THE BAG eats weeks.\n\n${ctx.player?.name ?? 'Your star'} watches you point the country-club clock at his paperwork.`,
      choices: [TC('point', 'POINT IT AT THE PAPERWORK', { down: { pct: 50, cls: 'DRAMA', note: 'it was in the trash for a reason' } })],
    }),
    resolve: (_k, ctx) => {
      const s = ctx.s;
      const ix = s.bag.indexOf('timeloop');
      if (ix >= 0) s.bag.splice(ix, 1);
      const p = ctx.player;
      return {
        text: `The machine whirs, hiccups, and runs BACKWARD. ${p?.name ?? 'Your star'} is now lost somewhere in time — six weeks out, well past graduation. The machine dissolves into a smell.\n\nThe locker room takes it exactly as well as you'd think. It was in the trash for a reason.`,
        fx: [{ playerId: p?.id, outWeeks: 6, outReason: 'lost in time', outKind: 'away' }, { teamMood: -12 }],
      };
    },
  },
  // 04 · WEEK — the dean at her car: the hoop
  {
    id: 'tut_hoop',
    kind: 'coach',
    figure: 'dean',
    beat: () => ({
      tag: 'THE PARKING LOT',
      text: 'Crossing the lot you catch the dean unlocking her car, and ask the obvious question: why does the gym not have a hoop?\n\nShe looks back at the building for a long moment. "I have one. In my backyard. It\'s regulation — mostly. Give me a week."',
      choices: [TC('ok', '"A HOOP IS A HOOP"')],
    }),
    resolve: (_k, ctx) => {
      // the campus screen changes NOW: THE GYM reads ARRIVING NEXT WEEK
      ctx.s.futureBeats.push({ weeksLeft: 1, defId: 'facility_arrives', beat: 'start', playerId: null, data: { facId: 'gym' } });
      return { text: '' };
    },
  },
  // 05 · WEEK — the mop, then the janitor pays in kind
  {
    id: 'tut_mop',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE MOP',
      text: '"This place is a mess," you say, to nobody in particular — and take the mop off its hook.\n\n"Coach, you don\'t have to—" The assistant looks at you for a second, sighs, and grabs the other mop.',
    }),
    resolve: () => ({ text: '', next: { defId: 'tut_janitor', beat: 'start', playerId: null } }),
  },
  {
    id: 'tut_janitor',
    kind: 'coach',
    figure: 'janitor',
    beat: () => ({
      tag: 'THE SUPPLY CLOSET',
      text: 'Halfway down the hallway the janitor blocks the way with his cart, looks both ways, and sets a PATCH KIT on top of your clipboard.\n\nHe nods once — at it, then at you — and leaves before thanks can happen.',
      choices: [TC('take', 'NOD BACK')],
    }),
    resolve: () => ({ text: '', fx: [{ giveItem: 'patch' }] }),
  },
  // 06 · WEEK — the head cheerleader reads the board, opens the row, teaches the words
  {
    id: 'tut_cheer',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: 'The head cheerleader appears at your shoulder, reads the board, then reads your face, and sighs.\n\n"I\'ve seen every one of these kids on campus visits. Give me the marker." She uncaps it with her teeth.',
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
      return { text: '', next: { defId: 'tut_cheer3', beat: 'start', playerId: null } };
    },
  },
  {
    id: 'tut_cheer3',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE WORDS',
      text: 'On her way out she teaches you the words to THE RALLY — a speech for rooms that need the roof raised.\n\n"Save it for a night that matters. You\'ll know the night."',
    }),
    resolve: () => ({ text: '' }),
  },
  // 07 · WEEK — the booster: faith first, then the ink
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
      fx: [{ heatB: -25 }],
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
  // 08 · WEEK — Scoop questions the week, before the bus leaves
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
        choices: [TC('bluff', '"FRIENDS OF THE FAMILY"', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL', note: 'he checks things' } })],
      };
    },
    resolve: () => ({
      text: '"Friends of the family," he repeats, and — this once — the recorder clicks off. "Everybody\'s got friends. Even this program, apparently." The piece runs almost warm.\n\nHe\'ll be back most weeks with QUESTIONS. Answer from memory — or let THE NOTEBOOK answer, if you wrote things down.',
      fx: [{ opP: 25 }],
    }),
  },
  // 09 · WEEK — the bus breaks down (the assistant frames the stakes FIRST)
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
      tag: 'THE CREDIT',
      text: 'Then you remember it: the dean\'s credit, still in your pocket.\n\nThe assistant is already on the horn with a local crew. "Mech-goblins. Five minutes out. Coach… they don\'t work for free."',
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
  // 10 · PREGAME — the cheerleader brings the words back
  {
    id: 'tut_cheer_speech',
    kind: 'coach',
    figure: 'cheerleader',
    beat: () => ({
      tag: 'THE HEAD CHEERLEADER',
      text: 'Before you can open your mouth, the head cheerleader leans in the visitors\' doorway. She came on her own credit.\n\n"The words I taught you, coach. THE RALLY. This room needs its roof raised — trust me, I know rooms."',
      choices: [TC('ok', '"THIS IS OUR HOUSE"')],
    }),
    resolve: () => ({ text: '' }),
  },
  // 11 · PREGAME — the bookie says hello
  {
    id: 'tut_bookie',
    kind: 'coach',
    figure: 'bookie',
    beat: () => ({
      tag: 'THE BOOKIE',
      text: 'A wide hat and a wider smile materialize at courtside, chalking numbers onto a little board.\n\n"No offense, coach — I\'ve got you as the underdog tonight. Numbers are numbers. Prove mine wrong and I\'ll be the happiest loser in the building."',
    }),
    resolve: () => ({ text: '' }),
  },
  // 12 · after the horn — the bookie settles up
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
      return { text: 'By the time you\'re home, a CRYO BAY stands where the ice-filled dumpster used to be — still cold from the truck. The dumpster retires with honors.' };
    },
  },
  // 13 · WRAP — the road home: the attendant, the kid, the last credit
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
        text: `One hot meal and forty minutes of jump-shot talk later, ${kid.name} has your holo-code and two-thirds of his heart committed. (He signs. Kids you feed always sign.)`,
        next: { defId: 'tut_dean2', beat: 'start', playerId: null },
      };
    },
  },
  // 14 · WRAP — the gifts: the stadium, the archive, the "car"
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
      return { text: '', next: { defId: 'tut_scoop2', beat: 'start', playerId: null } };
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
      const s = ctx.s;
      if (s.facilities) s.facilities.library = 1;
      const noted = key === 'notebook';
      return {
        text: noted
          ? 'You don\'t even blink — you read it straight off the notebook page, stat line and all.\n\nScoop lowers the recorder, genuinely moved. "A coach who keeps RECORDS." He clears six legs\' worth of throat. "The Gazette\'s archive — every box score I ever filed — goes to your school library. Somebody there should care about numbers."'
          : 'You answer from memory, close enough to true, and he lets it stand.\n\n"The Gazette\'s archive — every box score I ever filed — goes to your school library anyway. Somebody there should learn to write things down."',
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
      if (ctx.s.facilities) ctx.s.facilities.ship = 1;
      return {
        text: 'THE SCOUTING SHIP, such as it is — the home planet is in range now, and the galaxy past it is a reason to build.',
        next: { defId: 'tut_bye', beat: 'start', playerId: null },
      };
    },
  },
  // 15 · WRAP — season 1 tryouts (the goodbye waits until AFTER the cut)
  {
    id: 'tut_bye',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'TRYOUTS',
      text: 'The assistant hands you the clipboard — the whole clipboard.\n\n"Tryouts, coach. Two recruits inked, the freshman had a summer you would not believe, the standout\'s healthy, and the walk-on line goes around the block. Cut it down to nine and start SEASON ONE."',
      choices: [TC('go', 'RUN THE TRYOUTS')],
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
      // the assistant stays through the tryouts — the goodbye comes after
      s.tutorial = TUT_AT.TRYOUTS;
      delete s.tutWalk;
      return { text: '' };
    },
  },
  // 16 · after the cut — goodbye, assistant
  {
    id: 'tut_bye2',
    kind: 'coach',
    figure: 'assistant',
    beat: () => ({
      tag: 'THE TRAINING WHEELS',
      text: 'The assistant watches your nine warm up for a long minute, then puts on her hat.\n\n"You know where the ? button is. That\'s me now. It was an honor, coach."',
      choices: [TC('bye', 'IT WAS. GO HOME.')],
    }),
    resolve: () => ({ text: '' }),
  }
);
