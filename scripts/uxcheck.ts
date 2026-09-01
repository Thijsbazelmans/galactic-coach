// Tutorial UX check: boots the app in happy-dom and walks the roster walk
// step by step — free-look steps undim, header chrome hides right, thought
// arrives in the body, walk box wears the right pos.
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
const doc = win.document;
doc.body.innerHTML = '<div id="app"></div>';
const proto = (win as any).HTMLCanvasElement.prototype;
proto.getContext = () => new Proxy({}, { get: (_t, k) => (k === 'fillStyle' ? '#000' : () => undefined) });
proto.toDataURL = () => 'data:image/png;base64,';
const g = globalThis as Record<string, unknown>;
g.window = win; g.document = doc; g.localStorage = win.localStorage;
g.HTMLElement = (win as any).HTMLElement; g.Element = (win as any).Element;
win.localStorage.setItem('galactic-coach-codex', JSON.stringify({ plans: ['warcry'], drills: [], instrs: [], regions: [] }));

async function main(): Promise<void> {
  await import('../src/main');
  const gc = (win as any).gc; const anyWin = win as any;
  const app = doc.getElementById('app')!;
  const st = (): any => gc.state();
  const click = (sel: string): boolean => { const el = app.querySelector(sel) as any; if (!el?.click) return false; el.click(); return true; };
  const drain = (): void => {
    for (let i = 0; i < 400 && st().queue.length; i++) {
      const q = st().queue[0];
      // the thought must arrive IN THE BODY, headerless
      if (q?.defId === 'tut_haywire') {
        if (q.tag !== '') throw new Error(`the thought still wears a header: ${q.tag}`);
        if (!q.text.startsWith('A thought arrives')) throw new Error('the thought line is missing from the body');
        if (app.innerHTML.includes('<span class="tag"></span>')) throw new Error('an empty tag pill rendered');
      }
      const c = app.querySelector('[data-action="story-choice"]:not([disabled])');
      if (c) { anyWin.gcAction('story-choice', c.getAttribute('data-id') ?? 'ok'); continue; }
      if (!click('[data-action="story-tap"]')) break;
    }
  };
  click('[data-action="press-start"]');
  anyWin.gcAction('setup-codex-burn', '');
  anyWin.gcAction('setup-conf', 'acc');
  anyWin.gcAction('setup-team', '0');
  anyWin.gcAction('setup-confirm', '');
  drain();
  if (st().tutWalk?.key !== 'roster') throw new Error(`roster walk missing, got ${st().tutWalk?.key}`);

  // header chrome in season zero: no ?, live ⚙, no notebook
  if (app.querySelector('[data-action="help"]')) throw new Error('the ? button must hide in season zero');
  const gear = app.querySelector('[data-action="coach-open"]');
  if (!gear) throw new Error('the ⚙ button is missing');
  if ((gear.getAttribute('class') ?? '').includes('tutoff')) throw new Error('the ⚙ button is locked');
  if (app.querySelector('.bslot.notebook')) throw new Error('the notebook must hide before it is taught');
  if (app.querySelectorAll('.bslot').length !== 9) throw new Error('the empty pocket must keep the bag shape');
  click('[data-action="coach-open"]'); // through the real click gate
  if (!app.innerHTML.includes('THE COACH')) throw new Error('the settings modal did not open');
  click('[data-action="coach-close"]');
  if (app.innerHTML.includes('THE COACH')) throw new Error('the settings modal did not close');

  const tap = (): void => { anyWin.gcAction('tut-walk-tap', ''); anyWin.gcAction('tut-walk-tap', ''); };
  const fadeCount = (): number => app.querySelectorAll('.tutfade').length;
  const walkPos = (): string => app.querySelector('.tutwalk')?.getAttribute('class') ?? '(no box)';
  const steps = st().tutWalk.steps;
  for (let guard = 0; st().tutWalk && st().tutWalk.key === 'roster'; guard++) {
    if (guard > 40) throw new Error(`walk stuck at ix ${st().tutWalk.ix}`);
    const step = steps[st().tutWalk.ix];
    const adv = step.advance ?? 'tap';
    const free = !step.hi;
    console.log(`step ${st().tutWalk.ix}: hi=${step.hi ?? 'FREE'} pos=${step.pos ?? 'bot'} adv=${adv} · fades=${fadeCount()} · box=[${walkPos()}]`);
    if (free && fadeCount() > 0) throw new Error(`free step ${st().tutWalk.ix} still dims`);
    if (!free && fadeCount() === 0) throw new Error(`spotlit step ${st().tutWalk.ix} does not dim`);
    // during a FREE look the cards must answer taps (card is TUT_ALWAYS)
    if (free && !click('.pcard[data-action="card"]')) throw new Error('free step: cards not tappable');
    if (adv.startsWith('lens:')) {
      if (!click(`[data-action="lens-set"][data-id="${adv.slice(5)}"]`)) throw new Error(`lens tab ${adv.slice(5)} unclickable`);
    } else tap();
  }
  console.log('roster walk complete — free-look steps verified');
  drain();
  if (st().tutWalk?.key !== 'timeloop') throw new Error('timeloop walk did not arm');
  const slot = app.querySelector('.bslot[data-bagitem="timeloop"]');
  if (!slot || (slot.getAttribute('class') ?? '').includes('tutoff')) throw new Error('timeloop slot dead');
  console.log('UX CHECK OK');
}
main().catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1); });
