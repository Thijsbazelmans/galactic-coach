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
  // tryouts: confirm the preselected nine (hold buttons fire via executeAction path — click won't work on .hold)
  // simulate the hold by calling the action directly through a synthetic pointer flow is overkill;
  // instead reach into the exported action: the nav button is .hold, so trigger its data-action via gc? Use dispatch.
  const holdBtn = app.querySelector('[data-action="confirm-roster"]');
  if (!holdBtn) throw new Error('confirm-roster button missing');
  // tryouts preselect only the 6 returners — tap unpicked cards until nine
  for (let i = 0; i < 12; i++) {
    if (app.querySelectorAll('.pcard.picked').length >= 9) break;
    const unpicked = app.querySelectorAll('.pcard:not(.picked)')[0] as unknown as { click?: () => void } | undefined;
    unpicked?.click?.();
  }
  if (app.querySelectorAll('.pcard.picked').length !== 9) throw new Error('could not pick nine at tryouts');
  // holds run through executeAction after a timer; emulate by dispatching pointer events is fragile in happy-dom.
  // The click handler ignores .hold buttons, so call the same path the hold would:
  const mainMod = await import('../src/main');
  void mainMod;
  // fall back: hold buttons call executeAction(action,id) — replicate via exposed dev handle if present
  const anyWin = win as unknown as { gcAction?: (a: string, id: string) => void };
  if (!anyWin.gcAction) throw new Error('gcAction dev handle missing (expose it for the smoke test)');
  anyWin.gcAction('confirm-roster', '');
  drain();
  if (!['stories', 'practice'].includes(state().phase)) throw new Error(`expected season start, got ${state().phase}`);
  drain();
  if (state().phase !== 'practice') throw new Error(`expected practice, got ${state().phase}`);

  // the three lenses render
  if (!app.innerHTML.includes('lensbar')) throw new Error('lens bar missing');
  (app.querySelectorAll('[data-action="lens-set"]')[1] as unknown as { click: () => void }).click();
  if (!app.innerHTML.includes('stcol')) throw new Error('stats lens did not render');
  (app.querySelectorAll('[data-action="lens-set"]')[2] as unknown as { click: () => void }).click();
  if (!app.innerHTML.includes('kpot')) throw new Error('potential lens did not render');
  must('[data-action="lens-set"]', 'lens set 0');

  // the square card: kite, OVR bottom-left, XP ring bottom-right
  if (!app.innerHTML.includes('kovr')) throw new Error('card OVR missing');
  if (!app.innerHTML.includes('kring')) throw new Error('XP ring missing');
  if (!app.innerHTML.includes('k-pot')) throw new Error('potential outline missing');
  if (!app.innerHTML.includes('ksprite')) throw new Error('centered sprite missing');

  // practice: hold RUN (default SHOOTAROUND) via the action handle
  if (!app.querySelector('[data-action="drill-run"]')) throw new Error('RUN button missing');
  anyWin.gcAction('drill-run', '');
  drain();
  if (!gc.state().trainedThisWeek) throw new Error('practice did not run');
  if (app.querySelector('[data-action="drill-run"]:not([disabled])')) throw new Error('practice should be once per week');

  // galaxy (nav buttons are hold-to-commit now — use the action handle)
  if (!app.querySelector('[data-action="to-galaxy"]')) throw new Error('TO RECRUITING button missing');
  anyWin.gcAction('to-galaxy', '');
  drain();
  if (state().phase !== 'galaxy') throw new Error(`expected galaxy, got ${state().phase}`);
  // recruiting: empty slot selected by default → DISCOVER; after the find,
  // the fresh prospect is highlighted → SCOUT + RECRUIT
  if (app.querySelectorAll('[data-action="gx-run"]').length !== 1) throw new Error('DISCOVER button missing');
  const nBefore = (gc.state() as any).prospects.length;
  anyWin.gcAction('gx-run', 'discover');
  if ((gc.state() as any).prospects.length !== nBefore + 1) throw new Error('discover did not add a prospect');
  // dismiss the result dialog
  if (!click('[data-action="gx-result-tap"]')) throw new Error('result dialog missing');
  click('[data-action="gx-result-tap"]');
  drain();
  if (app.querySelectorAll('[data-action="gx-run"]').length !== 2) throw new Error('SCOUT/RECRUIT buttons missing after discover');

  // matchup: plan chips render, unlearned chips locked
  if (!app.querySelector('[data-action="to-matchup"]')) throw new Error('TO MATCHUP button missing');
  anyWin.gcAction('to-matchup', '');
  drain();
  if (state().phase !== 'matchup') throw new Error(`expected matchup, got ${state().phase}`);
  // no game before the speech
  if (!app.querySelector('[data-action="speech-run"]')) throw new Error('SPEECH button missing');
  anyWin.gcAction('play-game', '');
  if (state().phase !== 'matchup') throw new Error('game started without a speech');
  anyWin.gcAction('speech-run', '');
  if (!(gc.state() as any).speechWk) throw new Error('speech did not commit');
  if (!app.innerHTML.includes('tbars mu')) throw new Error('matchup bars missing');

  // play the game → FIRST HALF needle, then HALFTIME
  anyWin.gcAction('play-game', '');
  drain();
  // sim may wait on queue; drain again then check the half is open
  drain();
  type GnState = {
    phase: string;
    halftime: { box: unknown[]; myH1: number; oppH1: number } | null;
    speechH2?: boolean;
    lastResult: { box: unknown[]; h1?: object; h2?: object; myScore: number; oppScore: number } | null;
  };
  let st = state() as unknown as GnState;
  if (st.phase !== 'gamenight') throw new Error(`expected gamenight, got ${st.phase}`);
  if (!st.halftime) throw new Error('no halftime after play — H1 did not sim');
  if (st.lastResult) throw new Error('game finished without a halftime');
  if (!Array.isArray(st.halftime.box) || !st.halftime.box.length) throw new Error('H1 box missing');

  // skip the H1 needle (tap) → the locker room
  const ns1 = app.querySelector('#needle-stage') as unknown as { click?: () => void } | null;
  if (!ns1?.click) throw new Error('H1 needle stage missing');
  ns1.click();
  if (!app.innerHTML.includes('HALFTIME')) throw new Error('halftime screen missing after H1 needle');
  if (!app.innerHTML.includes('HALFTIME SPEECH')) throw new Error('halftime speech row missing');

  // no second half before the halftime speech
  anyWin.gcAction('play-h2', '');
  if ((state() as unknown as GnState).lastResult) throw new Error('H2 played without a halftime speech');
  anyWin.gcAction('speech-run', '');
  if (!(state() as unknown as GnState).speechH2) throw new Error('halftime speech did not commit');

  // SECOND HALF → the final
  anyWin.gcAction('play-h2', '');
  drain();
  st = state() as unknown as GnState;
  if (!st.lastResult) throw new Error('no game result after the second half');
  if (st.halftime) throw new Error('halftime never closed');
  if (!st.lastResult.h1 || !st.lastResult.h2) throw new Error('halves missing from result');
  if (!Array.isArray(st.lastResult.box) || !st.lastResult.box.length) throw new Error('box score missing from result');
  // skip the H2 needle → the verdict
  const ns2 = app.querySelector('#needle-stage') as unknown as { click?: () => void } | null;
  ns2?.click?.();
  if (!/VICTORY|DEFEAT/.test(app.innerHTML)) throw new Error('verdict missing after H2 needle');

  console.log('UI SMOKE OK — pick team → tryouts → lenses → drill → galaxy → matchup → H1 → halftime → H2 → verdict, box score present');
}

main().catch((e) => {
  console.error('UI SMOKE FAILED:', e);
  process.exit(1);
});
