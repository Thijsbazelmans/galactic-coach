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

  if (!app.innerHTML.includes('GALACTIC COACH')) throw new Error('pick-team screen missing');
  must('[data-action="pick-team"]', 'pick team');
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
  if (!['stories', 'scouting'].includes(state().phase)) throw new Error(`expected season start, got ${state().phase}`);
  drain();
  if (state().phase !== 'scouting') throw new Error(`expected scouting, got ${state().phase}`);

  // the thumb-first bottom stack: nav → lens tabs → the two-row bag, in order
  const stack = [...app.querySelectorAll('.navbar, .lensbar, .bagbar')].map((el) => (el as unknown as { className: string }).className.split(' ')[0]);
  if (stack.join(',') !== 'navbar,lensbar,bagbar') throw new Error(`bottom stack out of order: ${stack.join(',')}`);
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
  // the speech verdict lands as a toast — dismiss it
  click('[data-action="toast-tap"]');
  click('[data-action="toast-tap"]');
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

  // skip the live game (tap) → YOU WON / YOU LOST on the same screen
  const ns1 = app.querySelector('#needle-stage') as unknown as { click?: () => void } | null;
  if (!ns1?.click) throw new Error('live game stage missing');
  ns1.click();
  if (!/YOU WON|YOU LOST/.test(app.innerHTML)) throw new Error('YOU WON / YOU LOST missing after the horn');
  if (!app.querySelector('.navbar [data-action="gn-verdict"]')) throw new Error('BOX SCORE continue missing');

  // → the horn's consequences speak now (held during the game), then the box score grid
  anyWin.gcAction('gn-verdict', '');
  drain();
  if (!/VICTORY|DEFEAT/.test(app.innerHTML)) throw new Error('box score screen missing');
  if (!app.innerHTML.includes('GAME MVP')) throw new Error('MVP tag missing on the box-score grid');

  // → the league results with the standings underneath → NEXT WEEK
  anyWin.gcAction('gn-table', '');
  if (!app.innerHTML.includes('AROUND THE LEAGUE')) throw new Error('league screen missing');
  if (!app.innerHTML.includes('standings')) throw new Error('standings table missing under the results');
  anyWin.gcAction('continue-result', '');
  drain(); // travel-home story, if the game was away
  if (state().phase !== 'weekstart') throw new Error(`expected weekstart, got ${state().phase}`);
  if (!app.innerHTML.includes('WEEK START')) throw new Error('WEEK START screen missing');
  anyWin.gcAction('begin-week', '');
  drain();
  if (state().phase !== 'scouting') throw new Error(`expected scouting after week start, got ${state().phase}`);

  console.log('UI SMOKE OK — pick team → tryouts → scouting → lenses → drill → recruiting → pregame move → live game → YOU WON/LOST → box score → league → WEEK START → scouting');
}

main().catch((e) => {
  console.error('UI SMOKE FAILED:', e);
  process.exit(1);
});
