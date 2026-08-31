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

const { default: _ } = { default: null };

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
  const drain = (max = 400): void => {
    for (let i = 0; i < max && state().queue.length; i++) {
      // choice buttons are hold-to-commit (clicks are ignored) — fire the action
      const c = app.querySelector('[data-action="story-choice"]:not([disabled])');
      if (c) {
        (win as unknown as { gcAction: (a: string, id: string) => void }).gcAction('story-choice', c.getAttribute('data-id') ?? 'ok');
        continue;
      }
      if (!click('[data-action="story-tap"]')) break;
    }
  };

  // everyone lands on MARCH MANIACS: press start (anywhere) → the program pick
  if (!app.querySelector('.titlescreen')) throw new Error('title screen missing');
  if (!app.innerHTML.includes('A NEW CAREER AWAITS')) throw new Error('fresh title should offer a new career');
  must('[data-action="press-start"]', 'press start');
  if (!app.innerHTML.includes('GALACTIC COACH')) throw new Error('pick-team screen missing');
  must('[data-action="pick-team"]', 'pick team');
  // FIRST TIME PLAYING? — the veteran path skips straight to tryouts
  if (!app.innerHTML.includes('FIRST TIME PLAYING?')) throw new Error('first-time ask missing after pick');
  must('[data-action="tut-skip"]', 'skip the tutorial');
  if (state().phase !== 'teamSelect') throw new Error(`expected teamSelect, got ${state().phase}`);
  drain();
  const anyWin = win as unknown as { gcAction?: (a: string, id: string) => void };
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

  // FACILITIES: six buildings, the mop, and an upgrade ordered for next week
  if (!app.innerHTML.includes('FACILITIES')) throw new Error('facilities screen missing');
  if (!app.innerHTML.includes('GRAB A MOP')) throw new Error('the mop is missing');
  if (app.querySelectorAll('.facrow').length !== 6) throw new Error('expected six facility rows');
  const e0 = (gc.state() as any).energy;
  anyWin.gcAction('fac-upgrade', 'cryo');
  if (!(gc.state() as any).futureBeats.some((b: any) => b.defId === 'facility_arrives')) throw new Error('upgrade not ordered');
  if ((gc.state() as any).energy >= e0) throw new Error('upgrade cost nothing');
  for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* the order confirmation */ }
  anyWin.gcAction('grab-mop', '');
  for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* mop flavor */ }
  drain(); // or the janitor hands an item instead
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
  // mandatory action: the nav refuses to move on until one lands
  anyWin.gcAction('to-practice', '');
  if (state().phase !== 'scouting') throw new Error('left scouting without an action');
  // pick FILM NIGHT (all 9) and run it — every prospect gains a facet
  anyWin.gcAction('gx-pick', 'filmnight');
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
  // the speech verdict lands as a two-beat toast (the words, then the
  // trade) — tap it through until it closes
  for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* type → beat → close */ }
  if (app.querySelector('[data-action="toast-tap"]')) throw new Error('the speech toast never closed');
  if (!app.innerHTML.includes('tbars mu')) throw new Error('matchup bars missing')
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

  // the bookie prints the odds before the ball goes up
  if (!app.innerHTML.includes('THE BOOKIE')) throw new Error('the bookie line is missing');
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
  anyWin.gcAction('gn-pass', ''); // → ⚡ & MOOD
  // → the standings → NEXT WEEK
  anyWin.gcAction('gn-table', '');
  if (!app.innerHTML.includes('THE STANDINGS')) throw new Error('standings screen missing');
  if (app.innerHTML.includes('AROUND THE LEAGUE')) throw new Error('other results should have left the standings screen');
  anyWin.gcAction('continue-result', '');
  drain(); // the wrap-up dialogues: returns, the dean, the cryo bay arriving
  if (state().phase !== 'weekstart') throw new Error(`expected weekstart, got ${state().phase}`);
  if (!app.innerHTML.includes('WEEK START')) throw new Error('WEEK START screen missing');
  if ((gc.state() as any).facilities.cryo !== 2) throw new Error('the ordered upgrade never arrived');
  anyWin.gcAction('begin-week', '');
  drain();
  if (state().phase !== 'facilities') {
    const q = (gc.state() as any).queue[0];
    throw new Error(`expected facilities after week start, got ${state().phase} (stuck on ${q?.defId}/${q?.beat} "${q?.tag}" · choices ${JSON.stringify(q?.choices?.map((c: any) => [c.key, c.cost, c.disabled]))} · ¢${(gc.state() as any).energy})`);
  }
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

  // ---- THE TUTORIAL SEASON (v5 M3): season zero, scripted, taught by doing ----
  anyWin.gcAction('new-game', ''); // no title screen on an in-session reset
  must('[data-action="pick-team"]', 'pick team (tutorial run)');
  must('[data-action="tut-yes"]', 'first time — coach the tutorial');
  const st3 = (): any => gc.state() as any;
  if (st3().tutorial === undefined) throw new Error('the tutorial did not arm');
  if (Object.values(st3().facilities).some((v) => v !== 0)) throw new Error('the tutorial campus should start at level 0');
  drain(); // the call, the dean, the roster, the haywire machine
  if (st3().phase !== 'weekstart') throw new Error(`expected weekstart in season zero, got ${st3().phase}`);
  anyWin.gcAction('begin-week', '');
  drain(); // the hoop complaint, the janitor's patch kit
  if (st3().phase !== 'facilities') throw new Error(`expected facilities in season zero, got ${st3().phase}`);
  if (!app.innerHTML.includes('tuthint')) throw new Error('tutorial hint bar missing');
  if (!st3().bag.includes('patch')) throw new Error('the janitor never handed the patch kit');
  anyWin.gcAction('to-scouting', '');
  drain(); // the head cheerleader reveals the board
  if (!st3().prospects.every((p: any) => p.digits >= 2)) throw new Error('the cheerleader should reveal the whole board');
  if (st3().facilities.greekrow !== 1) throw new Error('Kappa Nebula should open GREEK ROW 1');
  anyWin.gcAction('gx-run', ''); // LOCAL REC CENTER — free, and pinned to find the gem
  click('[data-action="gx-result-tap"]');
  click('[data-action="gx-result-tap"]');
  drain();
  const stateMod = await import('../src/engine/state');
  if (st3().pendingRecruits.length) {
    // the board was full: swap the 5★ kid on, let a nobody go
    stateMod.swapBoardSlot(st3(), 9, 8);
    anyWin.gcAction('board-confirm-open', '');
    anyWin.gcAction('board-confirm-do', '');
    for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* the walk-away toast */ }
  }
  anyWin.gcAction('to-practice', '');
  drain(); // the assistant on grades and the patch
  anyWin.gcAction('drill-run', ''); // TEAM REST — the whole menu at gym 0
  drain();
  anyWin.gcAction('to-recruiting', '');
  drain(); // the booster, the blank check
  if (!st3().prospects.some((p: any) => p.signed)) throw new Error('the blank check should sign the rec-center kid');
  anyWin.gcAction('gx-run', ''); // THE GROUP HOLO-CHAT
  click('[data-action="gx-result-tap"]');
  click('[data-action="gx-result-tap"]');
  drain();
  anyWin.gcAction('to-matchup', '');
  drain(); // wheels up, Scoop's question, the bus breakdown
  anyWin.gcAction('speech-run', ''); // THE RALLY — the only page in the book
  for (let i = 0; i < 8 && click('[data-action="toast-tap"]'); i++) { /* the speech verdict */ }
  anyWin.gcAction('play-game', '');
  drain();
  for (let i = 0; i < 4 && app.querySelector('#needle-stage') && !/YOU WON/.test(app.innerHTML); i++) {
    (app.querySelector('#needle-stage') as unknown as { click?: () => void } | null)?.click?.();
    drain(); // the freshman catches fire at the half
  }
  if (!/YOU WON/.test(app.innerHTML)) throw new Error('the tutorial game must be WON');
  anyWin.gcAction('gn-recap', '');
  drain(); // the notebook lesson, the bookie's cryo unit
  if (st3().facilities.cryo !== 1) throw new Error("the bookie's cryo unit never fell off the truck");
  anyWin.gcAction('gn-verdict', '');
  anyWin.gcAction('gn-pass', '');
  anyWin.gcAction('gn-table', '');
  anyWin.gcAction('continue-result', '');
  drain(); // the road home, the gifts, goodbye assistant
  if (st3().tutorial !== undefined) throw new Error('the tutorial should end at tryouts');
  if (st3().phase !== 'teamSelect') throw new Error(`expected teamSelect after the wrap, got ${st3().phase}`);
  if (Object.values(st3().facilities).some((v) => v !== 1)) throw new Error('six gifts: the campus must stand at level 1');
  if (st3().selectPool.length !== 12) throw new Error(`the tryouts pool should hold 12, got ${st3().selectPool.length}`);
  if (st3().knownPlans.length < 6) throw new Error('the standard speeches should return with season 1');
  anyWin.gcAction('cut-confirm-open', '');
  anyWin.gcAction('confirm-roster', '');
  drain();
  if (st3().season !== 1) throw new Error(`season 1 should begin after tutorial tryouts, got ${st3().season}`);

  console.log('UI SMOKE OK — pick team → tryouts → scouting → lenses → drill → recruiting → pregame move → live game → YOU WON/LOST → box score → league → WEEK START → scouting → campus cast renders → TUTORIAL season zero start to finish');
}

main().catch((e) => {
  console.error('UI SMOKE FAILED:', e);
  process.exit(1);
});
