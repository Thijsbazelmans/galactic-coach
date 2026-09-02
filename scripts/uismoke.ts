// UI smoke test: boots the real app in happy-dom, clicks through the core
// flow (pick team → tryouts → stories → all three lenses → drill → galaxy →
// matchup → game night), and fails on any thrown error or empty render.
// Run: npx tsx scripts/uismoke.ts

import { Window } from 'happy-dom';

const win = new Window({ url: 'http://localhost/' });
const doc = win.document;
doc.body.innerHTML = '<div id="app"></div>';

// canvas stub: the rig draws, we don't look
const proto = (win as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype;
proto.getContext = () =>
  new Proxy({}, { get: (_t, k) => (k === 'fillStyle' ? '#000' : () => undefined) });
proto.toDataURL = () => 'data:image/png;base64,';

const g = globalThis as Record<string, unknown>;
g.window = win;
g.document = doc;
g.localStorage = win.localStorage;
g.HTMLElement = (win as unknown as Record<string, unknown>).HTMLElement;
g.Element = (win as unknown as Record<string, unknown>).Element;

// a veteran's codex sits in storage: the new-career dialog must offer BOTH
// paths (keep the knowledge → tryouts · start fresh → the tutorial)
win.localStorage.setItem('galactic-coach-codex', JSON.stringify({ plans: ['warcry'], drills: [], instrs: [], regions: [] }));

async function main(): Promise<void> {
  await import('../src/main');
  const gc = (win as unknown as { gc?: { state: () => { phase: string; queue: unknown[] } } }).gc
    ?? (globalThis as unknown as { gc?: { state: () => { phase: string; queue: unknown[] } } }).gc;
  if (!gc) throw new Error('gc dev handle missing');
  const app = doc.getElementById('app')!;
  const state = (): { phase: string; queue: unknown[] } => gc.state();

  const click = (selector: string): boolean => {
    const el = app.querySelector(selector) as unknown as { click?: () => void } | null;
    if (!el?.click) return false;
    el.click();
    return true;
  };
  const must = (selector: string, label: string): void => {
    if (!click(selector)) {
      console.error(app.innerHTML.slice(0, 3000));
      throw new Error(`could not click ${label} (${selector}) in phase ${state().phase}`);
    }
  };
  const anyWin = win as unknown as { gcAction: (a: string, id: string) => void };
  const drain = (max = 400): void => {
    for (let i = 0; i < max && state().queue.length; i++) {
      const q = (gc.state() as any).queue[0];
      // season zero's press question resolves off the NOTEBOOK, not the panel
      if (q?.defId === 'tut_scoop2' && !q.resolvedText) {
        click('.bslot.notebook');
        continue;
      }
      // THE ERASURE's GONE page keeps the empty card (sneakers, name) in the
      // art slot — no dashed ghost box
      if (q?.defId === 'tut_haywire3' && app.querySelector('.impactpanel')) {
        if (app.querySelector('.ghostbox')) throw new Error('the GONE page should keep the player card, not a ghost box');
        if (!app.querySelector('.storyart .modalcard')) throw new Error('the GONE page lost the empty card');
        goneSeen = true;
      }
      // THE REVEAL CARD: a find shows the very row it adds to the sheet
      if (q?.defId === 'reveal' && app.querySelector('.revealbox .revealrow')) revealSeen = true;
      // the dean's gauge beat waits on the GAUGE: open it over her, close it
      if (q?.defId === 'tut_dean1b' && !((gc.state() as any).tutSeen ?? []).includes('dean-gauge')) {
        if (!click('[data-action="job-open"]')) throw new Error('the job gauge did not answer over the dean');
        if (!click('.modalback[data-action="job-close"]')) throw new Error('the job menu did not open over the dean');
        continue;
      }
      // choice buttons are hold-to-commit (clicks are ignored) — fire the action
      const c = app.querySelector('[data-action="story-choice"]:not([disabled])');
      if (c) {
        anyWin.gcAction('story-choice', c.getAttribute('data-id') ?? 'ok');
        continue;
      }
      if (!click('[data-action="story-tap"]')) break;
    }
  };
  let goneSeen = false;
  let revealSeen = false;
  const toasts = (): void => {
    for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* beats */ }
  };
  const walkSkip = (): void => {
    if ((gc.state() as any).tutWalk) anyWin.gcAction('tut-walk-skip', '');
  };

  // everyone lands on MARCH MANIACS: press start (anywhere) → the wizard
  if (!app.querySelector('.titlescreen')) throw new Error('title screen missing');
  if (!app.innerHTML.includes('A NEW CAREER AWAITS')) throw new Error('fresh title should offer a new career');
  must('[data-action="press-start"]', 'press start');
  // the career menu: no save → START FRESH is the only door
  if (!app.innerHTML.includes('START FRESH')) throw new Error('the career menu must offer START FRESH');
  if (app.querySelector('[data-action="menu-continue"]')) throw new Error('CONTINUE CAREER must hide without a save');
  must('[data-action="menu-new"]', 'start fresh');
  // wizard step 1 — with a codex present: keep the knowledge, or burn it
  if (!app.innerHTML.includes('MARCH MANIACS')) throw new Error('wizard screen missing');
  if (!app.innerHTML.includes('CODEX')) throw new Error('codex step missing');
  if (app.innerHTML.includes('3-on-3')) throw new Error('the old tagline must be gone');
  if (!app.innerHTML.includes('KEEP THE CODEX')) throw new Error('the keep-knowledge path is missing');
  if (!app.innerHTML.includes('BURN THE CODEX')) throw new Error('the burn-the-codex path is missing');
  must('[data-action="setup-codex-keep"]', 'keep the codex');
  // wizard step 2 — THE BIG SIX: six editable programs, tap one, it wears YOU
  if (!app.innerHTML.includes('THE BIG SIX')) throw new Error('the league headline is missing');
  if (app.querySelectorAll('.teampickbtn.hold[data-action="setup-confirm"]').length !== 6) throw new Error('six hold-to-coach programs must show');
  if (!app.innerHTML.includes('Star Heels')) throw new Error('the Star Heels left the league');
  if (!app.innerHTML.includes('Whooshers')) throw new Error('the Whooshers left the league');
  // the ✎ modal: rename a rival and repaint it via the swatch picker
  anyWin.gcAction('setup-edit', '4');
  const edName = doc.getElementById('ed-name') as unknown as { value: string } | null;
  if (!edName) throw new Error('the edit modal did not open');
  // the two picked colors show as tiles; the 32-grid is an overlay per tile
  if (app.querySelectorAll('[data-action="setup-pick-open"]').length !== 2) throw new Error('the kit modal should show the two color tiles');
  if (app.querySelector('[data-action="setup-swatch-bg"]')) throw new Error('the swatch grid must wait for a tile tap');
  anyWin.gcAction('setup-pick-open', 'bg');
  if (!app.querySelector('[data-action="setup-swatch-bg"]')) throw new Error('the MAIN swatch overlay did not open');
  anyWin.gcAction('setup-swatch-bg', '#003057');
  if (app.querySelector('.pickback')) throw new Error('a swatch pick should close the overlay');
  anyWin.gcAction('setup-pick-open', 'fg');
  if (!app.querySelector('.swatch.dead')) throw new Error('the TEXT overlay should blank the unreadable swatches');
  anyWin.gcAction('setup-pick-close', '');
  if (app.querySelector('.pickback')) throw new Error('the overlay backdrop should close it');
  // a re-render follows the swatch pick: grab the rebuilt input before typing
  const edName2 = doc.getElementById('ed-name') as unknown as { value: string } | null;
  if (!edName2) throw new Error('the edit modal lost its name input');
  edName2.value = 'Real Blue Devils';
  anyWin.gcAction('setup-edit-save', '');
  const rival = (gc.state() as any).teams[4];
  if (rival.name !== 'Real Blue Devils' || rival.bg !== '#003057') throw new Error('the program edit did not stick');
  // LOCK IT IN → the codex skipped the tutorial, straight to tryouts
  anyWin.gcAction('setup-confirm', '0'); // HOLD the Star Heels
  if (state().phase !== 'teamSelect') throw new Error(`expected teamSelect, got ${state().phase}`);
  if ((gc.state() as any).teams[0].name !== 'Star Heels') throw new Error('the league teams did not seed');
  drain();
  if (!anyWin.gcAction) throw new Error('gcAction dev handle missing (expose it for the smoke test)');
  // TRYOUTS: the selection grid — 4 rows, the bottom one is the CUT
  if (!app.innerHTML.includes('cutrow')) throw new Error('selection grid CUT row missing');
  if (app.querySelectorAll('.pcard').length !== 12) throw new Error('selection grid should show all 12');
  // the confirm flow: nav opens the are-you-sure, the hold commits the cut
  anyWin.gcAction('cut-confirm-open', '');
  if (!app.innerHTML.includes('lost to you forever')) throw new Error('cut confirm dialog missing');
  anyWin.gcAction('confirm-roster', '');
  drain();
  if (!['stories', 'facilities'].includes(state().phase)) throw new Error(`expected season start, got ${state().phase}`);
  drain();
  if (state().phase !== 'facilities') throw new Error(`expected facilities, got ${state().phase}`);

  // FACILITIES: six tiles, ONE campus move a week — the mop is the free
  // floor, an upgrade the spend; the picks live in the ▾ menu
  if (!app.innerHTML.includes('FACILITIES')) throw new Error('facilities screen missing');
  if (!app.innerHTML.includes('GRAB A MOP')) throw new Error('the mop is missing from the nav');
  if (app.querySelectorAll('.facrow').length !== 6) throw new Error('expected six facility tiles');
  if (!app.querySelector('.navbar [data-action="fac-run"]')) throw new Error('campus move missing from the nav');
  if (app.innerHTML.includes('LVL 1 —') || app.innerHTML.includes('/4')) throw new Error('facility tiles should not talk in levels');
  // mandatory action: the nav refuses to move on until one lands
  anyWin.gcAction('to-scouting', '');
  if (state().phase !== 'facilities') throw new Error('left the campus without a move');
  const e0 = (gc.state() as any).energy;
  anyWin.gcAction('fac-pick', 'cryo');
  anyWin.gcAction('fac-run', '');
  if (!(gc.state() as any).futureBeats.some((b: any) => b.defId === 'facility_arrives')) throw new Error('upgrade not ordered');
  if ((gc.state() as any).energy >= e0) throw new Error('upgrade cost nothing');
  if (!(gc.state() as any).facActWk) throw new Error('the campus move did not land');
  toasts();
  drain();
  anyWin.gcAction('to-scouting', '');
  drain();
  if (state().phase !== 'scouting') throw new Error(`expected scouting after the campus, got ${state().phase}`);

  // the bottom stack (Aug 29 order): lens tabs → the big button → the bag
  const stack = [...app.querySelectorAll('.navbar, .lensbar, .bagbar')].map((el) => (el as unknown as { className: string }).className.split(' ')[0]);
  if (stack.join(',') !== 'lensbar,navbar,bagbar') throw new Error(`bottom stack out of order: ${stack.join(',')}`);
  if (!app.innerHTML.includes('bagbar tworow')) throw new Error('two-row bag missing');
  if (!app.innerHTML.includes('bslot filled notebook tall')) throw new Error('tall notebook slot missing');
  if (app.querySelectorAll('.bslot').length !== 9) throw new Error('expected notebook + 8 item slots');

  // SCOUTING: the board opens FULL — nine names, mostly strangers
  const prospects = (gc.state() as any).prospects;
  if (prospects.length !== 9) throw new Error(`expected 9 prospects on the board, got ${prospects.length}`);
  if (prospects.every((p: any) => p.seenSkill && p.seenPot && p.digits >= 2)) throw new Error('the opening board should not be fully known');
  if (!app.innerHTML.includes('prq')) throw new Error('?? masks missing on the board');
  if (!app.innerHTML.includes('TARGETS')) throw new Error('priority-board row labels missing');
  // the species signs the STATS card, in their skin color
  (app.querySelectorAll('[data-action="lens-set"]')[1] as unknown as { click: () => void }).click();
  if (!app.innerHTML.includes('prspecies') || !app.innerHTML.includes('TERRAN')) throw new Error('species missing on the STATS card');
  must('[data-action="lens-set"]', 'back to BIG BOARD');
  // the picker defaults to the FREE option (LOCAL REC CENTER) on the nav
  if (!app.innerHTML.includes('LOCAL REC CENTER')) throw new Error('free scouting option not the default');
  if (!app.querySelector('.navbar [data-action="gx-run"]')) throw new Error('scouting action missing from the nav');
  if (app.querySelectorAll('.navbar [data-action="gx-sheet"]').length !== 2) throw new Error('expected a ▾ arrow on BOTH sides');
  // scoped actions speak in "up to": never a demand for exactly six
  anyWin.gcAction('gx-sheet', '');
  if (app.innerHTML.includes('PICK 6') && !app.innerHTML.includes('PICK UP TO 6')) throw new Error('scoped actions should read PICK UP TO');
  if (app.innerHTML.includes('needs the SCOUTING SHIP') || app.innerHTML.includes('needs GREEK ROW')) throw new Error('gated moves should stay undiscovered, not name their level');
  anyWin.gcAction('gx-pick', 'filmnight');
  // mandatory action: the nav refuses to move on until one lands
  anyWin.gcAction('to-practice', '');
  if (state().phase !== 'scouting') throw new Error('left scouting without an action');
  anyWin.gcAction('gx-run', '');
  if (!(gc.state() as any).scoutActWk) throw new Error('scouting action did not land');
  if (!prospects.some((p: any) => p.seenSkill || p.seenPot || p.digits > 0)) throw new Error('scout revealed nothing');
  // dismiss the result dialog
  if (!click('[data-action="gx-result-tap"]')) throw new Error('result dialog missing');
  click('[data-action="gx-result-tap"]');
  drain();
  if (app.querySelector('[data-action="gx-run"]')) throw new Error('scouting action should be once per week');

  // PRACTICE
  anyWin.gcAction('to-practice', '');
  drain();
  if (state().phase !== 'practice') throw new Error(`expected practice, got ${state().phase}`);

  // the three lenses render: ROSTER / STATS / ABILITIES
  if (!app.innerHTML.includes('lensbar')) throw new Error('lens bar missing');
  if (!app.innerHTML.includes('ROSTER')) throw new Error('ROSTER lens name missing');
  (app.querySelectorAll('[data-action="lens-set"]')[1] as unknown as { click: () => void }).click();
  if (!app.innerHTML.includes('stcol')) throw new Error('stats lens did not render');
  (app.querySelectorAll('[data-action="lens-set"]')[2] as unknown as { click: () => void }).click();
  if (!app.innerHTML.includes('kpot')) throw new Error('abilities lens did not render');
  if (!app.innerHTML.includes('k-pot')) throw new Error('potential outline missing on ABILITIES');
  must('[data-action="lens-set"]', 'lens set 0');

  // the ROSTER card: LED gauges, the slot GRADE bottom-left, XP ring bottom-right
  if (!app.innerHTML.includes('kgrade')) throw new Error('card grade missing');
  if (app.innerHTML.includes('MISCAST')) throw new Error('MISCAST should be dead');
  if (!app.innerHTML.includes('kring')) throw new Error('XP ring missing');
  if (!app.innerHTML.includes('gauge gl')) throw new Error('energy gauge missing');
  if (!app.innerHTML.includes('gauge gr')) throw new Error('mood gauge missing');
  if (!app.innerHTML.includes('gled')) throw new Error('LED gauge rects missing');
  if (!app.innerHTML.includes('ksprite')) throw new Error('centered sprite missing');

  // THE TACTICS BOARD: two rows between the grid and the bars, middles lit
  // by default (TRIANGLE / MAN 2 MAN), persistent until changed
  if (app.querySelectorAll('.tacboard .tacrow').length !== 2) throw new Error('tactics board missing');
  if (app.querySelectorAll('.tacboard .tacbtn').length !== 6) throw new Error('expected six tactic buttons');
  const selTacs = [...app.querySelectorAll('.tacbtn.sel b')].map((el) => (el as unknown as { textContent: string }).textContent);
  if (selTacs.join(',') !== 'TRIANGLE,MAN 2 MAN') throw new Error(`wrong default tactics: ${selTacs.join(',')}`);
  anyWin.gcAction('tac-set', 'd:zone');
  if ((gc.state() as any).tacD !== 'zone') throw new Error('tactic did not persist to state');
  // the math, engine-side (the DOM number is mid-cascade at this moment):
  // ZONE = BRAINS ×1.2, FIERCENESS ×0.8, team-wide
  const sim = await import('../src/engine/sim');
  const st2 = gc.state() as any;
  const me2 = st2.teams[st2.myTeamId];
  const plain = sim.matchAttrs(me2);
  const zoned = sim.matchAttrs(me2, null, undefined, sim.tacticsMult(st2.tacO, st2.tacD));
  if (Math.abs(zoned.brn - plain.brn * 1.2) > 0.2) throw new Error(`ZONE brn off: ${plain.brn} → ${zoned.brn}`);
  if (Math.abs(zoned.frc - plain.frc * 0.8) > 0.2) throw new Error(`ZONE frc off: ${plain.frc} → ${zoned.frc}`);
  anyWin.gcAction('tac-set', 'd:man'); // back to neutral for the rest of the run

  // MANDATORY practice: the nav IS the action button until the drill runs
  if (!app.querySelector('.navbar [data-action="drill-run"]')) throw new Error('RUN button missing from the nav');
  anyWin.gcAction('to-recruiting', ''); // must refuse
  if (state().phase !== 'practice') throw new Error('left practice without training');
  anyWin.gcAction('drill-run', '');
  drain();
  if (!gc.state().trainedThisWeek) throw new Error('practice did not run');
  if (app.querySelector('[data-action="drill-run"]')) throw new Error('RUN should hand the nav back after practice');

  // RECRUITING: its own stop — free floor is the group chat
  anyWin.gcAction('to-recruiting', '');
  drain();
  if (state().phase !== 'recruiting') throw new Error(`expected recruiting, got ${state().phase}`);
  if (!app.innerHTML.includes('THE GROUP HOLO-CHAT')) throw new Error('free recruiting option not the default');
  anyWin.gcAction('to-matchup', '');
  if (state().phase !== 'recruiting') throw new Error('left recruiting without an action');
  anyWin.gcAction('gx-run', '');
  if (!(gc.state() as any).recruitActWk) throw new Error('recruiting action did not land');
  if (!click('[data-action="gx-result-tap"]')) throw new Error('recruiting result dialog missing');
  click('[data-action="gx-result-tap"]');
  drain();

  // the first game is AWAY (flip the fixture if the draw made it home): the
  // week-turn-after-the-ride-home path below needs a bus to come back on
  {
    const s0 = gc.state() as any;
    const pairs = s0.schedule[s0.week - 1] as [number, number][];
    const ix = pairs.findIndex(([h]) => h === s0.myTeamId);
    if (ix >= 0) pairs[ix] = [pairs[ix][1], pairs[ix][0]];
  }
  // matchup
  anyWin.gcAction('to-matchup', '');
  drain();
  if (state().phase !== 'matchup') throw new Error(`expected matchup, got ${state().phase}`);
  // the PREGAME MOVE is the nav action; no game before it lands
  if (!app.querySelector('.navbar [data-action="speech-run"]')) throw new Error('pregame move missing from the nav');
  anyWin.gcAction('play-game', '');
  if (state().phase !== 'matchup') throw new Error('game started without a pregame move');
  // the picker offers BOTH families: speeches and instructions
  if (!click('.navbar [data-action="speech-sheet"]')) throw new Error('pregame ▾ arrow missing');
  if (!app.innerHTML.includes('LAST-MINUTE INSTRUCTIONS')) throw new Error('instructions missing from the pregame sheet');
  if (!app.innerHTML.includes('COUNTER THE SET')) throw new Error('the standard counter missing from the sheet');
  anyWin.gcAction('speech-pick', 'showtime');
  anyWin.gcAction('speech-run', '');
  if (!(gc.state() as any).pregameWk) throw new Error('the pregame move did not commit');
  // the recharge starts now — and is FRESH: Monday's tick must skip it
  if ((gc.state() as any).speechCooldowns?.showtime !== 1) throw new Error('SHOWTIME should be recharging for a week');
  if (!((gc.state() as any).freshWk ?? []).includes('sc:showtime')) throw new Error('a recharge set this week should be marked fresh');
  // the speech verdict lands as a two-beat toast (the words, then the
  // trade) — tap it through until it closes
  toasts();
  if (app.querySelector('[data-action="toast-tap"]')) throw new Error('the speech toast never closed');
  if (!app.innerHTML.includes('tbars mu')) throw new Error('matchup bars missing');
  // the opponent scout is DEAD: their bars are simply there, for free
  if (!app.innerHTML.includes('tbopp')) throw new Error('opponent bars not visible for free');
  if (app.innerHTML.includes('scoutbtn')) throw new Error('the scout button should be gone');
  if (!app.querySelector('.navbar [data-action="play-game"]')) throw new Error('PLAY missing from the nav after the speech');

  // play the game → the whole night runs on one split
  anyWin.gcAction('play-game', '');
  drain();
  drain();
  type GnState = {
    phase: string;
    lastResult: { box: unknown[]; myScore: number; oppScore: number; win: boolean } | null;
  };
  const st = state() as unknown as GnState;
  if (st.phase !== 'gamenight') throw new Error(`expected gamenight, got ${st.phase}`);
  if (!st.lastResult) throw new Error('no result after play — the game did not sim');
  if (!Array.isArray(st.lastResult.box) || !st.lastResult.box.length) throw new Error('box score missing from result');
  if (st.lastResult.myScore === st.lastResult.oppScore) throw new Error('the game ended tied');

  // the bookie prints the odds before the ball goes up — his FIGURE stays
  // out of the in-game screen (illustrations are for dialogs)
  if (!app.innerHTML.includes('THE BOOKIE')) throw new Error('the bookie line is missing');
  if (app.innerHTML.includes('bookiefig')) throw new Error('the bookie figure should be gone from the in-game screen');
  // M5 COURT CARDS: three mini-cards on the floor under the rope, each with
  // a rig sprite and a name — my side only (the opponent stays cards-less)
  if (app.querySelectorAll('#court .ccard').length !== 3) throw new Error('the court should hold three cards at tip-off');
  if (app.querySelectorAll('#court .ccard .cspr').length !== 3) throw new Error('court cards should wear sprites');
  if (app.querySelectorAll('#court .ccard .cname').length !== 3) throw new Error('court cards should wear names');
  // skip the live game (tap) → the night's interruptions may speak at the
  // half (answer them, the game resumes) → YOU WON / YOU LOST on the same screen
  for (let i = 0; i < 3 && app.querySelector('#needle-stage') && !/YOU WON|YOU LOST/.test(app.innerHTML); i++) {
    const ns1 = app.querySelector('#needle-stage') as unknown as { click?: () => void } | null;
    if (!ns1?.click) throw new Error('live game stage missing');
    ns1.click();
    drain();
  }
  if (!/YOU WON|YOU LOST/.test(app.innerHTML)) throw new Error('YOU WON / YOU LOST missing after the horn');
  if ((gc.state() as any).gamePending) throw new Error('the game never finalized');
  if (!app.querySelector('.navbar [data-action="gn-recap"]')) throw new Error('RECAP continue missing');
  if (app.querySelector('.navbar .navmain.hold')) throw new Error('continue should be a plain tap, not a hold');

  // → the horn's consequences speak now (held during the game), then THE RECAP
  anyWin.gcAction('gn-recap', '');
  drain();
  if (!/VICTORY|DEFEAT/.test(app.innerHTML)) throw new Error('recap screen missing');
  if (!app.innerHTML.includes('recapfaces') || !app.innerHTML.includes('GAME MVP')) throw new Error('MVP face missing on the recap');
  // → the box score grid in THREE passes (lines → XP → tanks), no dragging
  anyWin.gcAction('gn-verdict', '');
  if (!app.innerHTML.includes('BOX SCORE')) throw new Error('box score screen missing');
  if (!app.innerHTML.includes('GAME MVP')) throw new Error('MVP tag missing on the box-score grid');
  if (app.querySelector('.grid .pcard.grabbable')) throw new Error('the box score should not allow rearranging');
  if (app.innerHTML.includes('notebook tall pulse')) throw new Error('the notebook must not blink for note-taking (only for answers)');
  if (app.innerHTML.includes('BANKED XP')) throw new Error('XP belongs to WEEK START, not the box score');
  // the notebook takes the WHOLE night down — scores, MVP, and where my
  // names sit on the conference boards
  click('.bslot.notebook');
  toasts();
  if (!(gc.state() as any).notebook.some((n: any) => n.kind === 'lead' && n.text.includes('league leaders'))) throw new Error('the notebook should note the leaderboards');
  anyWin.gcAction('gn-pass', ''); // → ⚡ & MOOD
  // → the standings — WITH the leaderboard tab riding along
  anyWin.gcAction('gn-table', '');
  if (!app.innerHTML.includes('THE STANDINGS')) throw new Error('standings screen missing');
  if (!app.innerHTML.includes('THE LEADERS')) throw new Error('the leaders tab is missing from the post-game standings');
  must('[data-action="stand-tab"][data-id="leaders"]', 'the post-game leaders tab');
  if (!app.innerHTML.includes('POINTS')) throw new Error('the leaders lists did not render post-game');
  must('[data-action="stand-tab"][data-id="table"]', 'back to the table');
  if (app.innerHTML.includes('AROUND THE LEAGUE')) throw new Error('other results should have left the standings screen');
  const wasAway = !!(gc.state() as any).lastResult && !(gc.state() as any).lastResult.home;
  anyWin.gcAction('continue-result', '');
  // THE WEEK TURN: the calendar flips before the dean shows up — but AFTER
  // the ride home from an away game (playtest #10)
  if (wasAway) {
    const q0 = (gc.state() as any).queue[0];
    if (!q0) throw new Error('an away weekend should open on the ride home');
    if (app.innerHTML.includes('weekturn')) throw new Error('the week turn must wait for the ride home');
    for (let i = 0; i < 40 && (gc.state() as any).queue[0]?.uid === q0.uid; i++) {
      const c = app.querySelector('[data-action="story-choice"]:not([disabled])');
      if (c) anyWin.gcAction('story-choice', c.getAttribute('data-id') ?? 'ok');
      else click('[data-action="story-tap"]');
    }
    if ((gc.state() as any).queue[0]?.uid === q0.uid) throw new Error('the ride home never ended');
    console.log(`week turn held for the ride home (${q0.defId}) — then flipped`);
  }
  if (!app.innerHTML.includes('weekturn')) throw new Error('the week-turn animation is missing');
  must('[data-action="week-turn-close"]', 'flip the calendar');
  drain(); // the wrap-up dialogues: returns, the dean's envelope
  if (state().phase !== 'weekstart') throw new Error(`expected weekstart, got ${state().phase}`);
  // "1w recharge" is a FULL week off: the speech given Friday is still
  // recharging on Monday, and the fresh mark is spent (playtest #11)
  if ((gc.state() as any).speechCooldowns?.showtime !== 1) throw new Error('SHOWTIME must still be recharging the week after it was given');
  if (((gc.state() as any).freshWk ?? []).length) throw new Error('the fresh marks should clear on the tick');
  if (!app.innerHTML.includes('WEEK START')) throw new Error('WEEK START screen missing');
  if ((gc.state() as any).facilities.cryo === 2) throw new Error('the upgrade should land at the CAMPUS door, not on the Monday report');
  anyWin.gcAction('begin-week', '');
  drain(); // …the crates land as you walk into the building
  if (state().phase !== 'facilities') {
    const q = (gc.state() as any).queue[0];
    throw new Error(`expected facilities after week start, got ${state().phase} (stuck on ${q?.defId}/${q?.beat} "${q?.tag}" · choices ${JSON.stringify(q?.choices?.map((c: any) => [c.key, c.cost, c.disabled]))} · ¢${(gc.state() as any).energy})`);
  }
  if ((gc.state() as any).facilities.cryo !== 2) throw new Error('the ordered upgrade never arrived');
  anyWin.gcAction('fac-run', ''); // the weekly mop
  toasts();
  drain();
  anyWin.gcAction('to-scouting', '');
  drain();
  if (state().phase !== 'scouting') throw new Error(`expected scouting after the campus, got ${state().phase}`);

  // THE CAMPUS CAST + SEASON MOMENTS (260830): the new illustrations render
  // without throwing (canvas is stubbed — we assert the scene/figure box shows)
  const storyFn = (gc as unknown as { story: (d: string, b: string, p: number | null, dt?: Record<string, unknown>) => void }).story;
  for (const [defId, data] of [
    ['oracle', {}],
    ['goblin_bill', {}],
    ['bigbang_invite', { place: 1, record: '9-1' }],
    ['bigbang_out', { round: 0, opp: 'KRO WRAITHS', score: '55-70' }],
  ] as [string, Record<string, unknown>][]) {
    storyFn(defId, 'start', null, data);
    if (!app.innerHTML.includes('storypanel')) throw new Error(`story panel missing for ${defId}`);
    if (!app.innerHTML.includes('scenebox')) throw new Error(`illustration missing for ${defId}`);
    drain();
  }

  // ---- THE TUTORIAL SEASON (v5 M4.1): season zero, paced, locked, walked ----
  anyWin.gcAction('new-game', ''); // no title screen on an in-session reset
  if (!app.innerHTML.includes('BURN THE CODEX')) throw new Error('burn-the-codex path missing on the second career');
  anyWin.gcAction('setup-codex-burn', ''); // wipe the codex, coach season zero
  if (app.querySelectorAll('.teampickbtn.hold').length !== 6) throw new Error('the six programs missing on the second career');
  anyWin.gcAction('setup-confirm', '2'); // HOLD a program
  const st3 = (): any => gc.state() as any;
  if (st3().tutorial === undefined) throw new Error('the tutorial did not arm');
  if (Object.values(st3().facilities).some((v) => v !== 0)) throw new Error('the tutorial campus should start at level 0');
  const me3 = (): any => st3().teams[st3().myTeamId];
  drain(); // the call · the dean points at the gauge (drain taps it) · the credit · the machine
  if (me3().wins !== 0 || me3().losses !== 9) throw new Error(`season zero must stand 0–9, got ${me3().wins}–${me3().losses}`);
  if (!me3().players.some((p: any) => p.stats.gp > 0)) throw new Error('the lost season should show in the stats');
  if (!(st3().tutSeen ?? []).includes('dean-gauge')) throw new Error('the dean\'s gauge lesson never landed');
  if (app.innerHTML.includes('class="jrv"')) throw new Error('the four opinions must be numberless bars');
  if (st3().energy !== 1) throw new Error(`the dean hands exactly one credit, got ${st3().energy}`);
  if (!st3().bag.includes('timeloop')) throw new Error('the time machine never entered the bag');
  if (st3().phase !== 'weekstart') throw new Error(`expected weekstart in season zero, got ${st3().phase}`);
  // season zero's LEADERS: four columns, not one OVR list four times
  {
    const pool = st3().teams.filter((t: any) => t.id !== st3().myTeamId).flatMap((t: any) => t.players);
    const lead = (k: string): number => [...pool].sort((a: any, b: any) => b.stats[k] - a.stats[k])[0].id;
    if (new Set(['pts', 'reb', 'stl', 'ast'].map(lead)).size < 2) throw new Error('season-zero leaders should differ by column');
  }
  // the freshman must be the WORST rating on the roster
  {
    const fr = me3().players.find((p: any) => p.classYear === 0);
    const worst = Math.min(...me3().players.map((p: any) => p.attrs.skl + p.attrs.ath + p.attrs.frc + p.attrs.brn));
    if (!fr || fr.attrs.skl + fr.attrs.ath + fr.attrs.frc + fr.attrs.brn !== worst) throw new Error('the freshman should have the worst OVR');
  }
  // THE WALK: intro dialog first (drained above), then the roster spotlight
  if (!st3().tutWalk || st3().tutWalk.key !== 'roster') throw new Error('the roster walk did not arm');
  if (!app.innerHTML.includes('tutwalk')) throw new Error('the walk box did not render');
  // THE LOCK: off-script clicks are dead while the walk holds the floor
  anyWin.gcAction('tut-walk-tap', ''); // (finishes the typed line)
  click('[data-action="begin-week"]');
  if (st3().phase !== 'weekstart') throw new Error('THE LOCK failed: continued mid-walk');
  anyWin.gcAction('tut-walk-skip', '');
  drain(); // the idea arrives · the assistant blesses it
  // now the machine must be DRAGGED onto the star — the walk demands it
  if (!st3().tutWalk || st3().tutWalk.key !== 'timeloop') throw new Error('the timeloop walk did not arm');
  const star3 = me3().players.find((p: any) => p.outKind === 'away');
  if (!star3) throw new Error('the suspended star is missing');
  const rosterBefore = me3().players.length;
  (gc as any).drop('timeloop', 'p', star3.id);
  drain(); // the mishap: the star is ERASED — the assistant's institutional shrug
  if (!goneSeen) throw new Error('the GONE page never showed');
  if (me3().players.some((p: any) => p.id === star3.id)) throw new Error('the haywire beat must erase the star');
  if (me3().players.length !== rosterBefore - 1) throw new Error('the roster should stand one body short');
  if (!st3().alumni.some((a: any) => a.name === star3.name)) throw new Error('the erased star should rest in the alumni ledger');
  if (st3().bag.includes('timeloop')) throw new Error('the machine should dissolve into a smell');
  anyWin.gcAction('begin-week', '');
  drain(); // the campus intro
  if (st3().phase !== 'facilities') throw new Error(`expected facilities in season zero, got ${st3().phase}`);
  walkSkip(); // the campus walk
  anyWin.gcAction('fac-run', ''); // GRAB THE MOP (the only tutorial move)
  drain(); // mop → janitor → patch (take only) → the assistant's read → the dean's hoop
  if (!st3().bag.includes('patch')) throw new Error('the janitor never handed the patch kit');
  if (!st3().futureBeats.some((b: any) => b.data?.facId === 'gym')) throw new Error("the dean's hoop should read ARRIVING");
  if (!app.innerHTML.includes('tuthint')) throw new Error('tutorial hint bar missing');
  anyWin.gcAction('to-scouting', '');
  drain(); // the scouting intro ("what intel did the last coach leave?")
  // the board opens UNREAD and the notebook is still an empty pocket
  if (st3().prospects.every((p: any) => p.digits >= 2)) throw new Error('the board must open unread — the reveal waits for the cheerleader');
  if (app.querySelector('.bslot.notebook')) throw new Error('the notebook must stay hidden until the cheer');
  // the board walk's free look keeps the lens tabs LOCKED (a board of ??)
  if (!st3().tutWalk || st3().tutWalk.key !== 'board') throw new Error('the board walk did not arm');
  for (let i = 0; i < 4; i++) { anyWin.gcAction('tut-walk-tap', ''); anyWin.gcAction('tut-walk-tap', ''); }
  if (st3().tutWalk?.ix !== 4) throw new Error(`expected the board free look, got step ${st3().tutWalk?.ix}`);
  if (app.querySelector('.tutfade')) throw new Error('the board free look should not dim');
  if (!app.querySelector('[data-action="lens-set"][data-id="2"].tutoff')) throw new Error('POTENTIAL must stay locked during the board free look');
  walkSkip(); // the board walk (the intel, the rows, a free look)
  drain(); // the cheerleader cartwheels in: SCHOOL SPIRIT, shouted back
  if (!st3().tutWalk || st3().tutWalk.key !== 'cheernote') throw new Error('the write-it-down walk did not arm');
  if (!app.querySelector('.bslot.notebook')) throw new Error('the notebook must appear for the cheer');
  click('.bslot.notebook'); // WRITE IT DOWN
  toasts();
  if (!st3().notebook.some((n: any) => n.key === 'cheer:0')) throw new Error('the cheer never landed in the notebook');
  drain(); // the marker board reveal → GREEK ROW
  if (!st3().prospects.every((p: any) => p.digits >= 2)) throw new Error('the cheerleader should reveal the whole board');
  if (st3().facilities.greekrow !== 1) throw new Error('Kappa Nebula should open GREEK ROW 1');
  walkSkip(); // the star-rating lesson (POTENTIAL, the stars, locked ratings)
  drain(); // the ship talk ("these kids won't amount to much")
  walkSkip(); // the search walk (the bus, the rec center)
  anyWin.gcAction('gx-run', ''); // LOCAL REC CENTER — free, pinned to find the gem
  click('[data-action="gx-result-tap"]');
  click('[data-action="gx-result-tap"]');
  drain();
  walkSkip(); // the POTENTIAL walk (??, the stars) …
  drain(); // …THEN the five-star outburst takes the whole screen…
  walkSkip(); // …then the board-only-holds-nine walk
  const stateMod = await import('../src/engine/state');
  if (st3().pendingRecruits.length) {
    // the board was full: swap the 5★ kid on, let a nobody go
    stateMod.swapBoardSlot(st3(), 9, 8);
    // …and once he's ON the board he can't be dragged off it, swapped out,
    // or cut (playtest #10)
    const gemPr = st3().prospects[8];
    const nobody = st3().pendingRecruits[0];
    (gc as any).pdrop(9, gemPr.id);
    toasts();
    if (st3().prospects[8]?.id !== gemPr.id) throw new Error('the kid must not leave the board by drag');
    (gc as any).pdrop(8, nobody.id);
    toasts();
    if (st3().prospects[8]?.id !== gemPr.id) throw new Error('a nobody must not swap into the kid\'s slot');
    stateMod.swapBoardSlot(st3(), 8, 9); // force him into the OUT row…
    anyWin.gcAction('board-confirm-open', '');
    anyWin.gcAction('board-confirm-do', '');
    toasts();
    if (!st3().pendingRecruits.some((p: any) => p.id === gemPr.id)) throw new Error('confirming with the kid in the OUT row must refuse');
    stateMod.swapBoardSlot(st3(), 9, 8); // …and back on
    anyWin.gcAction('board-confirm-open', '');
    anyWin.gcAction('board-confirm-do', '');
    toasts();
    if (!st3().prospects.some((p: any) => p.id === gemPr.id)) throw new Error('the kid should survive the confirm');
  }
  anyWin.gcAction('to-practice', '');
  drain(); // the practice intro
  // piece-meal reveal: no team bars, no tactics board before their steps
  if (!st3().tutWalk || st3().tutWalk.key !== 'practice') throw new Error('the practice walk did not arm');
  if (app.innerHTML.includes('tacboard')) throw new Error('the tactics board must stay hidden until its lesson');
  if (app.innerHTML.includes('tbars')) throw new Error('the team bars must stay hidden until their lesson');
  // the freshman is pinned to the RESERVES row for the drag lesson
  {
    const fr = me3().players.find((p: any) => p.classYear === 0);
    if (fr && me3().lineup.slots.indexOf(fr.id) < 6) throw new Error('the freshman must open in the reserves');
  }
  walkSkip(); // the practice walk (skipping flushes the reveal marks)
  if (!app.innerHTML.includes('tacboard')) throw new Error('the skip must reveal the tactics board');
  // the patch lands on the standout (the walk step normally forces this)
  {
    const hurt = me3().players.find((p: any) => p.outKind === 'injury');
    if (hurt) {
      (gc as any).drop('patch', 'p', hurt.id);
      toasts();
      if (me3().players.some((p: any) => p.outKind === 'injury')) throw new Error('the patch kit should clear the injury');
    }
  }
  anyWin.gcAction('drill-run', ''); // TEAM REST — season zero's miracle week off
  drain();
  if (me3().players.some((p: any) => p.outWeeks === 0 && p.energy < 80)) throw new Error('the tutorial rest should put the whole squad in the green');
  // the bars keep blinking their gains after the cascade, across re-renders
  await new Promise((r) => setTimeout(r, 2800));
  anyWin.gcAction('noop', '');
  if (!app.querySelector('.tbar.tbglow')) throw new Error('the changed bars should stay lit after practice');
  if (!app.querySelector('.tbdelta')) throw new Error('the gain bands should still blink after a re-render');
  // the guarantee: even rested, nobody out-grades the full-tank freshman
  {
    const sim = await import('../src/engine/sim');
    const fr = me3().players.find((p: any) => p.classYear === 0);
    if (fr) {
      const gOf = (p: any): number => sim.gradeRating(p, sim.bestCol(p));
      // vs the SENIORS — the patched standout is allowed to shine
      const best = Math.max(...me3().players.filter((p: any) => p.outWeeks === 0 && p.id !== fr.id && p.classYear >= 2).map(gOf));
      if (gOf(fr) < best) throw new Error(`the freshman must out-grade every senior after the rest (fr ${gOf(fr)} vs ${best})`);
    }
  }
  walkSkip(); // "a rested squad grades better"
  anyWin.gcAction('to-recruiting', '');
  drain(); // the recruiting intro
  walkSkip(); // the recruiting walk
  anyWin.gcAction('gx-run', ''); // THE GROUP HOLO-CHAT
  click('[data-action="gx-result-tap"]');
  click('[data-action="gx-result-tap"]');
  drain(); // the assistant's stamp line lands first
  walkSkip(); // one more look at the sad board
  drain(); // THEN the booster: faith (+25), then the BLANK CHECK (take only)
  if (!st3().bag.includes('check')) throw new Error('the booster never left the blank check');
  // the check must land on the kid before the bus leaves
  anyWin.gcAction('to-matchup', '');
  if (st3().phase !== 'matchup') {
    walkSkip(); // the check walk
    const gem = st3().prospects.find((p: any) => p.pots.skl + p.pots.ath + p.pots.frc + p.pots.brn >= 70);
    if (!gem) throw new Error('the rec-center gem is missing from the board');
    (gc as any).drop('check', 'pr', gem.id);
    toasts();
    if (!st3().prospects.some((p: any) => p.signed)) throw new Error('the blank check should sign the rec-center kid');
  }
  // the lineup lesson normally parks these two — the walk was skipped, so
  // park them by hand: the freshman at starting guard, the standout at center
  {
    // (read the slots fresh each time — the lineup array is replaced on the
    // way into the matchup)
    const park = (pid: number, at: number): void => {
      const slots = me3().lineup.slots as (number | null)[];
      const from = slots.indexOf(pid);
      if (from < 0 || from === at) return;
      const tmp = slots[at];
      slots[at] = pid;
      slots[from] = tmp;
    };
    const fr = me3().players.find((p: any) => p.classYear === 0);
    const so = me3().players.find((p: any) => p.form === 'femme' && p.classYear === 1);
    // …but FIRST the gate must be seen refusing: bench them both
    if (fr) park(fr.id, 7);
    if (so && so.outWeeks === 0) park(so.id, 8);
    anyWin.gcAction('to-matchup', '');
    drain(); // Scoop (three beats), then the breakdown and the goblins
    if (st3().phase !== 'matchup') throw new Error(`expected matchup, got ${st3().phase}`);
    if (st3().energy !== 1) throw new Error('the goblin gag must hand the credit back');
    // GAME NIGHT's gate: the best two must START — the hold refuses until they do
    if (!st3().tutWalk || st3().tutWalk.key !== 'matchup' || st3().tutWalk.ix !== 0) throw new Error('the matchup walk should open on the best-two gate');
    if (!app.innerHTML.includes('START YOUR BEST TWO FIRST')) throw new Error('the gate should refuse with the best two benched');
    anyWin.gcAction('tut-walk-hold', '');
    if (st3().tutWalk?.ix !== 0) throw new Error('the hold must not pass a failing gate');
    if (fr) park(fr.id, 0);
    if (so && so.outWeeks === 0) park(so.id, 2);
    anyWin.gcAction('tut-walk-hold', '');
    if (st3().tutWalk?.ix !== 1) throw new Error(`the gate should pass once both start (ix ${st3().tutWalk?.ix})`);
  }
  walkSkip(); // the matchup walk (the bars, the assistant's despair) — hands off to the cheerleader
  drain(); // "You WROTE IT DOWN. Use it."
  if (!st3().tutWalk || st3().tutWalk.key !== 'speechnote') throw new Error('the speech-from-the-page walk did not arm');
  click('.bslot.notebook'); // the page comes out: THE CHEER runs as a scene
  toasts();
  if (st3().knownPlans.includes('rally')) throw new Error('GO GO GO must not be on the sheet before the cheer runs');
  drain(); // the cheer → the room explodes → "bottle it" → GO GO GO learned, THE REVEAL CARD
  if (!st3().pregameWk) throw new Error('the cheer never became the speech');
  if (st3().speechTook !== true) throw new Error('the tutorial cheer must land');
  if (!st3().knownPlans.includes('rally')) throw new Error('GO GO GO should join the sheet');
  if (!st3().careerLog.some((l: string) => l.startsWith('Learned GO GO GO'))) throw new Error('GO GO GO should arrive as a find (the reveal card)');
  if (!revealSeen) throw new Error('the reveal card never showed the GO GO GO row');
  if (me3().players.some((p: any) => p.outWeeks === 0 && p.mood < 80)) throw new Error('the cheer should put the room at 80+ mood');
  walkSkip(); // "slightly is STEALABLE" — the post-cheer gauge read
  // the freshman STARTS the finale — top row, no exceptions
  {
    const fr = me3().players.find((p: any) => p.classYear === 0);
    if (fr && !me3().lineup.slots.slice(0, 3).includes(fr.id)) throw new Error('the freshman must START the finale (top row)');
  }
  anyWin.gcAction('play-game', '');
  drain(); // the bookie says hello, favoring the opposition
  // M5 COURT CARDS in season zero: the rally forced the freshman into the
  // top six — his card either opens on the floor or swaps in with the bench
  // pair at 40% of the clock
  {
    const fr = me3().players.find((p: any) => p.classYear === 0);
    if (app.querySelectorAll('#court .ccard').length !== 3) throw new Error('the tutorial court should hold three cards');
    if (fr && !app.querySelector(`#court .ccard[data-cpid="${fr.id}"]`)) throw new Error("the freshman starts — his card must open on the court");
  }
  for (let i = 0; i < 4 && app.querySelector('#needle-stage') && !/YOU WON/.test(app.innerHTML); i++) {
    (app.querySelector('#needle-stage') as unknown as { click?: () => void } | null)?.click?.();
    drain(); // the freshman catches fire — LET HIM COOK is the only door
  }
  if (!/YOU WON/.test(app.innerHTML)) throw new Error('the tutorial game must be WON');
  // the night reads TIGHT, lightly the opponent's way (the rig lands the upset)
  {
    const share = st3().lastResult?.share ?? 0;
    // the dealt night ADDS UP: the box's points are the final score (#11)
    const boxPts = (st3().lastResult?.box ?? []).reduce((a: number, r: any) => a + r.pts, 0);
    if (boxPts !== st3().lastResult?.myScore) throw new Error(`the tutorial box (${boxPts}) must add up to the score (${st3().lastResult?.myScore})`);
    if (share < 0.4 || share > 0.5) throw new Error(`the finale must be dealt tight and opponent-leaning, got share ${share.toFixed(2)}`);
  }
  anyWin.gcAction('gn-recap', '');
  drain(); // the bookie's cryo unit falls off a truck
  if (st3().facilities.cryo !== 1) throw new Error("the bookie's cryo unit never fell off the truck");
  anyWin.gcAction('gn-verdict', '');
  // THE NOTEBOOK lesson lands MID box score: tap it, the walk advances
  if (!st3().tutWalk || st3().tutWalk.key !== 'notebook') throw new Error('the notebook walk did not arm on the box score');
  click('.bslot.notebook');
  toasts();
  if (st3().tutWalk) throw new Error('the notebook tap should finish the walk');
  if (!st3().notebook.length) throw new Error('the note never landed');
  anyWin.gcAction('gn-pass', '');
  anyWin.gcAction('gn-table', '');
  anyWin.gcAction('continue-result', '');
  drain(); // the road home: attendant, the kid (1¢ meal), the gifts, the nerd, the GOODBYE, tryouts
  if (st3().phase !== 'teamSelect') throw new Error(`expected teamSelect after the wrap, got ${st3().phase}`);
  if (st3().tutorial === undefined) throw new Error('the assistant stays through the tryouts');
  if (st3().energy !== 0) throw new Error('the hot meal should spend the last credit');
  if (Object.values(st3().facilities).some((v) => v !== 1)) throw new Error('six gifts: the campus must stand at level 1');
  if (st3().selectPool.length !== 12) throw new Error(`the tryouts pool should hold 12, got ${st3().selectPool.length}`);
  if (st3().knownPlans.length < 6) throw new Error('the standard speeches should return with season 1');
  anyWin.gcAction('cut-confirm-open', '');
  anyWin.gcAction('confirm-roster', '');
  // the SEASON 1 page flip, then the dean's terms open the season
  if (!app.innerHTML.includes('wtseason')) throw new Error('the SEASON 1 flip is missing after the cut');
  anyWin.gcAction('week-turn-close', '');
  if (st3().queue.some((q: any) => q.defId === 'dean_intro')) throw new Error('tutorial coaches heard the terms in season zero — no dean_intro');
  if (!st3().queue.some((q: any) => q.defId === 'dean_budget')) throw new Error("season 1 must open with the dean's envelope");
  drain(); // the envelope → season one's Monday
  if (st3().tutorial !== undefined) throw new Error('the tutorial should end with the cut');
  if (st3().season !== 1) throw new Error(`season 1 should begin after tutorial tryouts, got ${st3().season}`);

  console.log('UI SMOKE OK — new-career paths → tryouts → one campus move → scouting → lenses → drill → recruiting → pregame → live game → box score + leaders note → standings w/ leaders tab → WEEK TURN → arrival at the campus door → campus cast → TUTORIAL season zero (the call, walks, lock, timeloop, mop, cheer-in-the-notebook, marker board, five-star, piece-meal practice, stamp, check, cheer-off-the-page + reveal card, notebook, goodbye-then-tryouts, SEASON 1 flip, dean\'s terms)');
}

main().catch((e) => {
  console.error('UI SMOKE FAILED:', e);
  process.exit(1);
});
