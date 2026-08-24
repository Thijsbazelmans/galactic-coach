// GALACTIC COACH v1.1 — the app frame. No scrolling, ever (recent phones):
// stats always on top, THE BAG + navigation always at the bottom, and between
// them the 3×3 grid — which IS your lineup — with a fourth row for controls.
// Popups take over the middle; the bag stays reachable, items drag right in.

import {
  ATTR_LABEL,
  ATTR_SHORT,
  CLASS_ABBR,
  DRILLS,
  GALAXY_ACTS,
  PLANS,
  drillKind,
  galaxyActById,
  itemById,
  planById,
  speciesById,
  storyById,
} from './engine/data';
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, matchAttrs, slotMult, slotPlayer, winShare } from './engine/sim';
import {
  type LevelUp,
  actionGalaxy,
  beginWeek,
  chooseTeam,
  confirmBoard,
  continueFromResult,
  convincePro,
  currentStory,
  deliverHalftimeSpeech,
  deliverSpeech,
  dismissStory,
  effectiveChances,
  finalizeRoster,
  freshGame,
  isUtWeek,
  itemAllowedNow,
  letGoPro,
  load,
  myMatchup,
  myTeam,
  playGame,
  playSecondHalf,
  queueStory,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  save,
  showTip,
  sortedStandings,
  starters,
  swapBoardSlot,
  toGalaxy,
  toMatchup,
  toSigning,
  toggleProspect,
  toggleTips,
  useItem,
  utOpponent,
  weekLabel,
  wipeSave,
} from './engine/state';
import type { Attr, AttrRec, GameState, PlanId, Player, Prospect, SpeechFx, Team } from './engine/types';
import type { Fx } from './engine/types';
import { ATTRS, clamp, copyAttrs, genderize, ovr, perGame, potStars } from './engine/util';
import { PRACTICE_KIT, energyBucket, figureHtml, iconOutlinedUrl, iconUrl, moodBucket, rigSpriteHtml, sceneHtml, type FigureId, type FigureMood, type Kit, type RigView, type SceneId } from './rig';

const VERSION = 'v4.0';

let state: GameState = load() ?? freshGame();

// ---- THE RAMP: one hue per save ------------------------------------------------

let rampH = 140;
let rampS = 60;

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function ramp(t: number): string {
  const tt = clamp(t, 0, 1);
  const l = 18 + tt * 79;
  const s = rampS * (1 - tt * 0.7);
  return `hsl(${Math.round(rampH)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function vc(v: number): string {
  return ramp(0.2 + 0.8 * (clamp(v, 0, 100) / 100));
}

function setRamp(): void {
  const t = state.myTeamId >= 0 ? myTeam(state) : null;
  const [h, s] = hexToHsl(t ? t.bg : '#177245');
  rampH = h;
  rampS = Math.max(35, s);
  const root = document.documentElement.style;
  root.setProperty('--r20', ramp(0.05));
  root.setProperty('--r35', ramp(0.25));
  root.setProperty('--r55', ramp(0.5));
  root.setProperty('--r75', ramp(0.75));
  root.setProperty('--r95', ramp(1));
  root.setProperty('--rbg', `hsl(${Math.round(rampH)} ${Math.round(rampS * 0.6)}% 5%)`);
  root.setProperty('--rpanel', `hsl(${Math.round(rampH)} ${Math.round(rampS * 0.5)}% 9%)`);
  root.setProperty('--rline', `hsl(${Math.round(rampH)} ${Math.round(rampS * 0.5)}% 20%)`);
}

// ---- transient UI state -----------------------------------------------------------

// The story cycle: anticipation → the verdict → the impact (stats animate,
// full focus) → the mitigating choice → the cycle repeats for the outcome.
type StoryMode = 'antic' | 'reveal' | 'choices' | 'r-antic' | 'r-reveal' | 'impact';
let storyMode: StoryMode = 'antic';
let storyUid = -1;
let stageTyped = false;

interface ImpRow {
  label: string;
  from?: number;
  to?: number;
  text?: string;
  up: boolean;
  color?: string;
}
let impact: { pid: number | null; rows: ImpRow[] } | null = null;
let impactPlayed = false;
let impactTimers: number[] = [];
let coachOpen = false;
let itemUi: string | null = null;
let toast: string | null = null;
let drillSheet = false;
// pickers DEFAULT to the free option every week — spending ⚡ takes a
// deliberate trip into the menu
let selectedDrill = 'rest';
let galaxySheet = false;
let selGalaxy = 'reccenter';
let selSpeech: PlanId | null = null;
let speechSheet = false;
/** picker defaults + sticker batches reset when the calendar turns */
let uiWeekKey = '';
/** what the chosen story choice meant to the player (acting at CHOICE time) */
let chosenWant: 'love' | 'hate' | null = null;
/** THE ANIMATION BUILD: staged screen builds fire only on a screen CHANGE */
let builtKey = '';
/** rope→dial: the matchup OVERALL rope's rect, captured as PLAY is held */
let ropeFrom: DOMRect | null = null;
/** THE NUMBER CASCADE: pre-change bar snapshot (restored, then animated) */
let barsPre: { vals: string[]; fills: string[][] }[] | null = null;
let cascTimers: number[] = [];
/** a landed speech waits for its toast to close, then cascades */
let speechCasc: { attr: Attr; amt: number } | null = null;
/** once-only stickers: batch key → 'landing' (animating) | 'seen' */
const stickerBatches = new Map<string, 'landing' | 'seen'>();
let gxResult: { text: string; cost: number; played: boolean; art?: string } | null = null;
/** how the story's resolution moved the hot seat (drives the dean/booster verdict + the job-bar flash) */
let heatShift: { dS: number; dB: number } | null = null;
let jobAnimDone = false;
/** the selection grid: 12 slots (9 squad in lineup order + the CUT row) */
let selSlots: number[] | null = null;
/** the two are-you-sure dialogs before anyone is lost forever */
let cutConfirm = false;
let boardConfirm = false;
// game night: H1 needle → the locker room → H2 needle → verdict → standings
let gnStage: 'beat' | 'half' | 'beat2' | 'verdict' | 'table' = 'beat';
let progressTimer: number | null = null;
let floatTimers: number[] = [];

let typeTimer: number | null = null;
let typeState: { el: HTMLElement; text: string; done: () => void } | null = null;

const app = document.getElementById('app')!;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function teamLabel(t: Team): string {
  return `${t.planet} ${t.name}`;
}

function chip(label: string, bg: string, fg: string, small = false): string {
  return `<span class="chip ${small ? 'small' : ''}" style="background:${bg};color:${fg}">${esc(label)}</span>`;
}

// ---- floaters -------------------------------------------------------------------------

/** Team-wide changes land top-left → across the starters, then the bench, then
    the reserves — the same sweep every time. */
function slotOrderIds(): number[] {
  return myTeam(state).lineup.slots.filter((x): x is number => x !== null);
}

/** EVERY spent ⚡ blasts away over the energy bar — huge, one per cell. */
function floatEnergyBig(n: number): void {
  const bar = document.querySelector('.ebar');
  if (!bar || n <= 0) return;
  for (let i = 0; i < n; i++) {
    floatTimers.push(
      window.setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'efloat big';
        el.textContent = '-1⚡';
        bar.appendChild(el);
        window.setTimeout(() => el.remove(), 900);
      }, i * 300)
    );
  }
}

/** Drill results become STICKERS on the cards — swept in slot order, each
    landing ON the stat it changed (once; results seen are seen). */
let drillStickers: Map<number, { text: string; up?: boolean; anchor?: 'main' | 'xp' | 'ovr' | 'energy' | 'mood'; blink?: boolean }[]> | null = null;
let gxStickers: Map<number, { text: string; up?: boolean; anchor?: 'main' | 'xp' | 'ovr' | 'energy' | 'mood'; blink?: boolean }[]> | null = null;

function stickDrill(out: { xpByPlayer: Map<number, number>; gainByPlayer: Map<number, string>; levelUps: LevelUp[] }, cost: number): void {
  floatEnergyBig(cost);
  drillStickers = new Map();
  slotOrderIds().forEach((pid) => {
    const msgs: { text: string; up?: boolean; anchor?: 'main' | 'xp' | 'ovr' | 'energy' | 'mood' }[] = [];
    const g = out.gainByPlayer.get(pid);
    if (g) msgs.push({ text: g, up: true, anchor: 'ovr' });
    const xp = out.xpByPlayer.get(pid);
    if (xp) msgs.push({ text: `+${xp} XP`, anchor: 'xp' });
    if (out.levelUps.some((lu) => lu.playerId === pid)) msgs.push({ text: '★ LEVEL UP', up: true });
    if (msgs.length) drillStickers!.set(pid, msgs);
  });
}

// ---- the impact reveal: snapshot → resolve → diff → animate -----------------------

interface PlayerSnap {
  attrs: AttrRec; pots: AttrRec; level: number; energy: number; mood: number; outWeeks: number;
}
interface Snap {
  energy: number; heatS: number; heatB: number; legacy: number;
  players: Map<number, PlayerSnap>;
}

function snapState(): Snap {
  const t = myTeam(state);
  return {
    energy: state.energy, heatS: state.heatS, heatB: state.heatB, legacy: state.legacy,
    players: new Map(t.players.map((p) => [p.id, {
      attrs: copyAttrs(p.attrs), pots: copyAttrs(p.pots),
      level: p.level, energy: p.energy, mood: p.mood, outWeeks: p.outWeeks,
    }])),
  };
}

/** Diff the world before/after a resolution into celebration rows. */
function buildImpact(snap: Snap, fxList: Fx[], pid: number | null): { pid: number | null; rows: ImpRow[] } {
  const t = myTeam(state);
  const rows: ImpRow[] = [];
  const was = pid !== null ? snap.players.get(pid) : undefined;
  const p = pid !== null ? t.players.find((x) => x.id === pid) : undefined;
  if (was && !p) rows.push({ label: '', text: 'GONE', up: false });
  if (was && p) {
    for (const a of ATTRS) {
      if (p.attrs[a] !== was.attrs[a]) {
        rows.push({ label: ATTR_LABEL[a], from: was.attrs[a], to: p.attrs[a], up: p.attrs[a] > was.attrs[a], color: vc(p.attrs[a] * 4) });
      }
    }
    if (ovr(p.attrs) !== ovr(was.attrs)) rows.push({ label: 'OVERALL', from: ovr(was.attrs), to: ovr(p.attrs), up: ovr(p.attrs) > ovr(was.attrs), color: vc(ovr(p.attrs) * 1.6) });
    if (p.level !== was.level) rows.push({ label: 'LEVEL', from: was.level, to: p.level, up: p.level > was.level });
    const xpGain = fxList.reduce((a, f) => a + ((f.playerId ?? pid) === pid ? f.xp ?? 0 : 0), 0);
    if (xpGain > 0 && p.level === was.level) rows.push({ label: 'XP', text: `+${xpGain}`, up: true });
    const potD = ovr(p.pots) - ovr(was.pots);
    if (potD !== 0) rows.push({ label: 'POTENTIAL', text: `${potD > 0 ? '+' : ''}${potD} CEILING`, up: potD > 0 });
    if (p.energy !== was.energy) rows.push({ label: 'ENERGY ⚡', from: was.energy, to: p.energy, up: p.energy > was.energy, color: vc(p.energy) });
    if (p.mood !== was.mood) rows.push({ label: 'MOOD', from: was.mood, to: p.mood, up: p.mood > was.mood, color: vc(p.mood) });
    if (p.outWeeks > 0 && p.outWeeks !== was.outWeeks) rows.push({ label: 'OUT', text: `${p.outWeeks} WEEK${p.outWeeks > 1 ? 'S' : ''}`, up: false });
    if (p.outWeeks === 0 && was.outWeeks > 0) rows.push({ label: 'BACK', text: 'READY TO PLAY', up: true });
  }
  // the rest of the squad, collapsed
  const others = t.players.filter((q) => q.id !== pid && snap.players.has(q.id));
  for (const key of ['mood', 'energy'] as const) {
    const changed = others.filter((q) => q[key] !== snap.players.get(q.id)![key]);
    if (!changed.length) continue;
    const d = changed[0][key] - snap.players.get(changed[0].id)![key];
    const label = changed.length > 1 ? 'THE SQUAD' : changed[0].name;
    rows.push({ label, text: `${key.toUpperCase()} ${d > 0 ? '+' : ''}${d}`, up: d > 0 });
  }
  // the coach's world
  if (state.energy !== snap.energy) rows.push({ label: '⚡ ENERGY', from: snap.energy, to: state.energy, up: state.energy > snap.energy });
  const sec0 = 100 - snap.heatS - snap.heatB;
  const sec1 = 100 - state.heatS - state.heatB;
  if (sec1 !== sec0) rows.push({ label: 'JOB SECURITY', from: sec0, to: sec1, up: sec1 > sec0 });
  if (state.legacy !== snap.legacy) rows.push({ label: 'LEGACY', from: snap.legacy, to: state.legacy, up: state.legacy > snap.legacy });
  return { pid, rows };
}

/** The anticipation, then the verdict: split on the paragraph break when
    the author gave one, on the first sentence otherwise. */
function splitBeats(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const para = t.split(/\n{2,}/);
  if (para.length > 1) return [para[0], para.slice(1).join('\n\n')];
  const m = t.match(/^([\s\S]{10,}?[.!?…]["')]?)\s+([\s\S]{20,})$/);
  return m ? [m[1], m[2]] : [t];
}

/** Resolve a story choice and arm the outcome cycle (beats → impact). */
function doResolve(key: string): void {
  const ev = currentStory(state);
  if (!ev) return;
  const snap = snapState();
  const choice = ev.choices?.find((c) => c.key === key);
  const cost = choice?.cost ?? 0;
  const res = resolveStory(state, key);
  if (!res) return;
  chosenWant = choice?.want ?? null;
  if (cost > 0) floatEnergyBig(cost);
  heatShift = { dS: state.heatS - snap.heatS, dB: state.heatB - snap.heatB };
  jobAnimDone = false;
  impact = buildImpact(snap, res.fx, res.resolved.playerId ?? ev.playerId);
  impactPlayed = false;
  const rBeats = splitBeats(res.resolved.resolvedText ?? '');
  if (rBeats.length) {
    storyMode = rBeats.length > 1 ? 'r-antic' : 'r-reveal';
  } else if (impact.rows.length) {
    storyMode = 'impact';
  } else {
    dismissStory(state);
    storyUid = -1;
  }
  stageTyped = false;
}

function clearImpactTimers(): void {
  for (const tm of impactTimers) { clearTimeout(tm); clearInterval(tm); }
  impactTimers = [];
}

/** One stat at a time: land, count, pop. Tap skips to the end. */
function animateImpact(): void {
  clearImpactTimers();
  const rowEls = [...document.querySelectorAll('.imp-row')] as HTMLElement[];
  rowEls.forEach((row, i) => {
    impactTimers.push(window.setTimeout(() => {
      row.classList.add('show');
      const val = row.querySelector('.imp-val') as HTMLElement | null;
      const land = (): void => row.classList.add('landed');
      if (val?.dataset.from !== undefined) {
        const from = Number(val.dataset.from);
        const to = Number(val.dataset.to);
        const steps = 12;
        let step = 0;
        const iv = window.setInterval(() => {
          step++;
          val!.textContent = String(Math.round(from + (to - from) * (step / steps)));
          if (step >= steps) { clearInterval(iv); land(); }
        }, 45);
        impactTimers.push(iv);
      } else {
        land();
      }
    }, 400 + i * 850));
  });
  impactTimers.push(window.setTimeout(() => { impactPlayed = true; }, 400 + rowEls.length * 850 + 600));
}

function finishImpactNow(): void {
  clearImpactTimers();
  document.querySelectorAll('.imp-row').forEach((row) => {
    row.classList.add('show', 'landed');
    const val = row.querySelector('.imp-val') as HTMLElement | null;
    if (val?.dataset.to !== undefined) val.textContent = val.dataset.to;
  });
  impactPlayed = true;
}

function clearFloatTimers(): void {
  for (const t of floatTimers) clearTimeout(t);
  floatTimers = [];
}

// ---- typewriter ---------------------------------------------------------------------------

// The full text is present (invisibly) from the first tick, so the layout is
// final before a single letter shows — nothing reflows, nothing recenters.
function typewrite(el: HTMLElement | null, text: string, done: () => void): void {
  stopType();
  if (!el) { done(); return; }
  typeState = { el, text, done };
  const chars = Array.from(text); // code points — emoji never get cut in half
  let i = 0;
  const paint = (): void => {
    // a single wrapper child: flex parents see ONE item whose size is the
    // final text from tick zero — the reveal boundary never moves anything
    el.innerHTML = `<span class="tw-line">${esc(chars.slice(0, i).join(''))}<span class="tw-rest">${esc(chars.slice(i).join(''))}</span></span>`;
  };
  paint();
  typeTimer = window.setInterval(() => {
    i += 2;
    paint();
    if (i >= chars.length) { stopType(); el.textContent = text; done(); }
  }, 16);
}

function stopType(): void {
  if (typeTimer !== null) { clearInterval(typeTimer); typeTimer = null; }
}

function finishTypeNow(): boolean {
  if (typeTimer === null || !typeState) return false;
  stopType();
  typeState.el.textContent = typeState.text;
  const done = typeState.done;
  typeState = null;
  done();
  return true;
}

// ---- the odds line ---------------------------------------------------------------------------

function oddsLine(up?: { pct: number; cls: string; note?: string }, down?: { pct: number; cls: string; note?: string }, cost?: number): string {
  const parts: string[] = [];
  if (cost) parts.push(`<span class="cost">${cost}⚡</span>`);
  if (up) parts.push(`<span class="tail up">▲ ${up.pct}% ${up.cls}${up.note ? ` <i>(${esc(up.note)})</i>` : ''}</span>`);
  if (down) parts.push(`<span class="tail down">▼ ${down.pct}% ${down.cls}${down.note ? ` <i>(${esc(down.note)})</i>` : ''}</span>`);
  return parts.length ? `<span class="odds">${parts.join(' ')}</span>` : '';
}

// ---- the kite compass ----------------------------------------------------------
// One shape says everything: SKL up, ATH right, FRC down, BRN left. The solid
// kite is who he is, the outline is his potential, the faint dashes are where
// the season started. Prospects render as a cloud that scouting sharpens.

function kitePoints(v: AttrRec): string {
  const R = (x: number): number => 6 + (clamp(x, 0, 25) / 25) * 40;
  return `50,${(50 - R(v.skl)).toFixed(1)} ${(50 + R(v.ath)).toFixed(1)},50 50,${(50 + R(v.frc)).toFixed(1)} ${(50 - R(v.brn)).toFixed(1)},50`;
}

// ---- the full-bleed square card -------------------------------------------------
// The whole card IS the compass: a full-width square kite with the sprite in
// its middle, name+year on a strip up top, the OVERALL big in the bottom-left,
// and a circular counter in the bottom-right. Mood, energy and size read from
// the sprite itself (sprite pass in progress) — no meters on the card.

function ringCounter(pct: number, label: string, val: string, title = ''): string {
  const clamped = clamp(Math.round(pct), 0, 100);
  return `<span class="kring" ${title ? `title="${title}"` : ''}>
    <svg viewBox="0 0 36 36">
      <circle class="krbg" cx="18" cy="18" r="15.9155"/>
      <circle class="krfill" cx="18" cy="18" r="15.9155" stroke-dasharray="${clamped} 100"/>
    </svg>
    <span class="krtxt"><i>${label}</i><b>${val}</b></span>
  </span>`;
}

interface SqOpts {
  pot?: AttrRec | null;
  start?: AttrRec | null;
  fuzz?: 0 | 1 | 2;
  /** a total stranger: no shape at all — the axes wait, empty */
  hide?: boolean;
  /** pre-rendered sprite HTML (the animated rig), centered in the kite */
  sprite?: string | null;
  /** per-attribute numbers printed under the corner labels */
  nums?: Record<Attr, string> | null;
  nameHtml: string; // the top strip
  blHtml?: string; // bottom-left (the big number)
  brHtml?: string; // bottom-right (a ring or a chip)
  centerHtml?: string; // dead center (?? / range / number)
}

function squareKite(cur: AttrRec, o: SqOpts): string {
  const lab = (a: Attr, cls: string): string =>
    `<span class="klabel ${o.nums ? 'inline' : ''} ${cls}"><i>${ATTR_SHORT[a]}</i>${o.nums ? ` <b>${o.nums[a]}</b>` : ''}</span>`;
  const fuzz = o.fuzz ?? 0;
  // an unscouted shape is a CLOUD, not a diamond: three jittered ghosts under
  // a real gaussian blur — nothing sharp survives
  const pts = kitePoints(cur);
  const shape = o.hide
    ? ''
    : fuzz
      ? `<g class="k-cloud" filter="url(#kblur${fuzz})">
        <polygon points="${pts}" transform="rotate(-9 50 50) translate(-3 2)"/>
        <polygon points="${pts}" transform="rotate(8 50 50) translate(3 -2)"/>
        <polygon points="${pts}" transform="scale(1.08) translate(-4 -4)"/>
        <polygon points="${pts}"/>
      </g>`
      : `<polygon class="k-cur" points="${pts}"/>`;
  return `<div class="ksq ${fuzz ? `fuzzy${fuzz}` : ''}">
    <svg class="ksvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${fuzz ? `<defs>
        <filter id="kblur1" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
        <filter id="kblur2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>
      </defs>` : ''}
      <line class="k-axis" x1="50" y1="4" x2="50" y2="96"/>
      <line class="k-axis" x1="4" y1="50" x2="96" y2="50"/>
      ${o.pot ? `<polygon class="k-pot" points="${kitePoints(o.pot)}"/>` : ''}
      ${o.start ? `<polygon class="k-start" points="${kitePoints(o.start)}"/>` : ''}
      ${shape}
    </svg>
    ${lab('skl', 'n')}${lab('ath', 'e')}${lab('frc', 's')}${lab('brn', 'w')}
    ${o.sprite ?? ''}
    <div class="ktop">${o.nameHtml}</div>
    ${o.blHtml ? `<span class="kbl">${o.blHtml}</span>` : ''}
    ${o.brHtml ? `<span class="kbr">${o.brHtml}</span>` : ''}
    ${o.centerHtml ? `<span class="kcenter">${o.centerHtml}</span>` : ''}
  </div>`;
}

// ---- the three lenses (THE CARD REWORK) -----------------------------------------
// One squad, three questions: ROSTER (who is he RIGHT NOW — energy left, mood
// right, no compass), STATS (what has he done), ABILITIES (the compass — where
// he points, where he started, how far the ceiling goes). The recruiting deck
// reads BIG BOARD / STATS / POTENTIAL. Same faces, same places.

type Lens = 0 | 1 | 2;
const LENS_NAMES = ['ROSTER', 'STATS', 'ABILITIES'];
const PROSPECT_LENS_NAMES = ['BIG BOARD', 'STATS', 'POTENTIAL'];
let lens: Lens = 0;

// ---- the edge gauges: tapered LEDs hugging the ROSTER card ----------------------
// LEFT = ENERGY (lightning bolt), RIGHT = MOOD (face) — 1/3 of the card wide
// at the top, tapering to 1/8 at the bottom; icon brightness follows the
// value and BLINKS below 25%.

function edgeGauge(side: 'l' | 'r', value: number, kind: 'bolt' | 'face', pid: number): string {
  const v = clamp(Math.round(value), 0, 100);
  const id = `gg${pid}${side}`;
  const taper = side === 'l' ? '0,0 100,0 37.5,100 0,100' : '0,0 100,0 100,100 62.5,100';
  const segs = [12.5, 25, 37.5, 50, 62.5, 75, 87.5]
    .map((y) => `<line x1="0" y1="${y}" x2="100" y2="${y}"/>`).join('');
  return `<span class="gauge g${side}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><clipPath id="${id}"><polygon points="${taper}"/></clipPath></defs>
      <polygon class="gbg" points="${taper}"/>
      <rect class="gfill" x="0" y="${100 - v}" width="100" height="${v}" clip-path="url(#${id})" style="fill:${vc(value)}"/>
      <g class="gsegs" clip-path="url(#${id})">${segs}</g>
    </svg>
    <img class="gicon ${v < 25 ? 'blink' : ''}" src="${iconOutlinedUrl(kind, vc(value))}" alt=""/>
  </span>`;
}

// ---- stickers: ONE main slot under the name; the rest stick ON the stat -------
// they change (+XP on the ring, +SKL on the OVERALL, −MOOD on the mood gauge).

interface Sticker {
  text: string;
  up?: boolean;
  anchor?: 'main' | 'xp' | 'ovr' | 'energy' | 'mood';
  blink?: boolean;
}

function stickersHtml(stickers: Sticker[] | undefined, delay: number, animate: boolean): string {
  if (!stickers?.length) return '';
  const groups = new Map<string, Sticker[]>();
  for (const st of stickers) {
    const a = st.anchor ?? 'main';
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a)!.push(st);
  }
  let i = 0;
  return [...groups.entries()].map(([anchor, list]) => `<div class="stickers anch-${anchor}">${list.map((st) =>
    `<div class="sticker ${st.up === false ? 'down' : ''} ${st.blink ? 'blink' : ''} ${animate ? '' : 'landed'}"
      style="${animate ? `animation-delay:${delay + i++ * 220}ms` : ''}">${esc(st.text)}</div>`).join('')}</div>`).join('');
}

/** The sprite tells the truth: mood, energy, size and fire, straight from the
    rig — and a delayed-outcome story holds him NERVOUS until the result. */
function rigView(p: Player, story?: 'good' | 'bad' | 'worried'): RigView {
  const held = story ?? (p.tense ? 'worried' : undefined);
  if (held) {
    // in a story the STATE is the story's: neutral → the emotion, no ball
    return {
      id: p.id, speciesId: p.speciesId, heightCm: p.heightCm, weightKg: p.weightKg,
      jersey: p.jersey, form: p.form, mood: 'neutral', energy: 'normal',
      fire: !!p.onFire && p.outWeeks === 0, story: held,
    };
  }
  return {
    id: p.id,
    speciesId: p.speciesId,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    jersey: p.jersey,
    form: p.form,
    mood: moodBucket(p.mood),
    energy: p.outWeeks > 0 ? 'exhausted' : energyBucket(p.energy),
    fire: !!p.onFire && p.outWeeks === 0,
  };
}

interface CardOpts {
  lens?: Lens;
  kit?: Kit;
  /** story acting: sprite state comes from the news, not the meters */
  story?: 'good' | 'bad' | 'worried';
  /** the story's card backdrop: ABILITIES compass or the ROSTER gauges */
  storyView?: 'abilities' | 'meters';
  /** results land one by one, each ON the stat it changed */
  stickers?: Sticker[];
  stickerDelay?: number;
  /** false = the batch already landed once: show static, never replay */
  stickerAnimate?: boolean;
  tag?: string;
  /** extra class on the cardtag ('mvp' = bright, bordered) */
  tagCls?: string;
  inert?: boolean;
  draggable?: boolean;
  /** halftime: the reserves stayed in the locker room — greyed, unswappable */
  locked?: boolean;
  sitout?: boolean;
  miscast?: number; // % penalty to print
  pick?: boolean; // selection screens
  /** THE SCOPE PREVIEW: this card is inside / outside a pending scoped action */
  scope?: 'in' | 'out';
}

// The card, phone-first, one lens at a time. ROSTER: sprite centered, tapered
// ENERGY/MOOD gauges hugging the edges (no compass), OVR bottom-left, XP ring
// (LVL inside) bottom-right. STATS: the season box score. ABILITIES: the
// compass square, layered — dashes where the season started, outline where he
// can go, POT chip instead of the ring.
function playerCard(p: Player, opts: CardOpts = {}): string {
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const out = p.outWeeks > 0;
  const sprite = (scale: number, cls: string): string => rigSpriteHtml(rigView(p, opts.story), kit, scale, cls);
  const l = opts.lens ?? 0;
  const xpPct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  const nameHtml = `<span class="kname">${p.onFire ? '🔥 ' : ''}${esc(p.name)}</span>
      <span class="kyear">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>`;
  const ovrHtml = `<b class="kovr" style="color:${vc(ovr(p.attrs) * 1.6)}">${ovr(p.attrs)}</b>`;
  const ring = ringCounter(xpPct, 'LVL', String(p.level), `level ${p.level}/${LEVEL_CAP} · xp ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)}`);
  let body: string;
  if (opts.story && opts.storyView === 'abilities') {
    // growth stories act in front of the compass
    body = squareKite(p.attrs, {
      pot: p.pots,
      start: p.startAttrs,
      sprite: sprite(1.75, 'ksprite'),
      nameHtml,
      blHtml: ovrHtml,
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${vc(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
    });
  } else if (l === 1 && !opts.story) {
    // the same square, sprite in the same spot — labels flank left (team
    // color), numbers flank right (white), one aligned row each
    const st = p.stats;
    const rows: [string, string][] = [
      ['GmPl', String(st.gp)],
      ['Pts', String(st.pts)],
      ['PPG', perGame(st, 'pts')],
      ['Reb', String(st.reb)],
      ['RPG', perGame(st, 'reb')],
      ['Stl', String(st.stl)],
      ['SPG', perGame(st, 'stl')],
      ['Ast', String(st.ast)],
      ['APG', perGame(st, 'ast')],
      ['MVP', String(st.mvp ?? 0)],
    ];
    body = `<div class="ksq">
      ${sprite(1.75, 'ksprite')}
      <div class="ktop">${nameHtml}</div>
      <div class="stcol sl" style="color:${kit.fg}">${rows.map((r) => `<span>${r[0]}</span>`).join('')}</div>
      <div class="stcol sr">${rows.map((r) => `<b>${r[1]}</b>`).join('')}</div>
    </div>`;
  } else if (l === 2 && !opts.story) {
    body = squareKite(p.attrs, {
      pot: p.pots,
      start: p.startAttrs,
      nameHtml,
      blHtml: ovrHtml,
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${vc(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
    });
  } else {
    // ROSTER — the default view, the compass gone: the sprite between two
    // tapered edge gauges (⚡ left, mood right)
    body = `<div class="ksq roster">
      ${sprite(1.75, 'ksprite')}
      <div class="ktop">${nameHtml}</div>
      ${edgeGauge('l', p.energy, 'bolt', p.id)}
      ${edgeGauge('r', p.mood, 'face', p.id)}
      <span class="kbl">${ovrHtml}</span>
      <span class="kbr">${ring}</span>
    </div>`;
  }
  return `<div class="pcard lens${l} sq ${out ? 'pout' : ''} ${opts.locked ? 'hlock' : ''} ${opts.draggable && !out && !opts.locked && l === 0 ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    ${body}
    ${stickersHtml(opts.stickers, opts.stickerDelay ?? 0, opts.stickerAnimate !== false)}
    ${out ? `<div class="ptag">OUT ${p.outWeeks}w</div>` : ''}
    ${opts.sitout && l === 0 ? '<div class="ptag dimtag">SITS OUT</div>' : ''}
    ${opts.miscast && opts.miscast >= 8 && !out && l === 0 ? `<div class="ptag">MISCAST −${opts.miscast}%</div>` : ''}
    ${opts.tag ? `<div class="cardtag ${opts.tagCls ?? ''}">${opts.tag}</div>` : ''}
  </div>`;
}

/** The masked rating: ?? → 4? or ?7 → 47. Digits reveal one at a time. */
function prospectMask(pr: Prospect): string {
  const n = String(ovr(pr.seenAttrs)).padStart(2, '0');
  if (pr.digits >= 2) return n;
  if (pr.digits === 1) return pr.digitFirst === 'tens' ? `${n[0]}?` : `?${n[1]}`;
  return '??';
}

// Prospects wear the same square in the BIG BOARD deck — but a fresh name is
// a TOTAL stranger: all ??'s. Scouting reveals facets one at a time: the
// ability cloud, the ceiling stars, the two rating digits. The SPECIES is
// always named — species is free information; scouting is for how good they
// are. Reading «NIMBUS» on an unscouted card should quicken the pulse.
function prospectCard(pr: Prospect, l: Lens, opts: { draggable?: boolean; dim?: boolean; scope?: 'in' | 'out'; stickerAnimate?: boolean } = {}): string {
  const img = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite');
  const fuzz: 0 | 1 | 2 = pr.scoutLevel >= 4 ? 0 : pr.scoutLevel >= 2 ? 1 : 2;
  const sp = speciesById(pr.speciesId);
  const spCls = sp.rarity >= 3 ? 'sprare blink' : sp.rarity === 2 ? 'sprare' : '';
  const nameHtml = `<span class="kname">${esc(pr.name)}</span>
      <span class="kyear ${spCls}">${sp.name.toUpperCase()}</span>`;
  const ring = ringCounter(pr.commitPct, 'COM', `${pr.commitPct}`, `commitment ${pr.commitPct}%`);
  const imgDim = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite dimspr');
  // the rating unmasks digit by digit — ?? → 4? / ?7 → 47
  const mask = prospectMask(pr);
  const maskHtml = pr.digits >= 2
    ? `<b class="kovr" style="color:${vc(ovr(pr.seenAttrs) * 1.6)}">${mask}</b>`
    : `<span class="kovr prq">${mask}</span>`;
  let body: string;
  if (l === 1) {
    // STATS: no box scores yet — the scout's one-line read over a dimmed sprite
    body = `<div class="ksq">
      ${imgDim}
      <div class="ktop">${nameHtml}</div>
      <div class="prblurb">${esc(pr.blurb)}</div>
    </div>`;
  } else if (l === 2) {
    // POTENTIAL: the cloud of CURRENT skills; the ceiling reads as STARS in
    // the center of that cloud
    const n = potStars(ovr(pr.seenPots));
    const stars = !pr.seenPot
      ? `<span class="prq">??</span>`
      : `<span class="prstars"><span>${'★'.repeat(Math.min(2, n))}${'☆'.repeat(Math.max(0, 2 - n))}</span><span>${'★'.repeat(Math.max(0, Math.min(3, n - 2)))}${'☆'.repeat(3 - Math.max(0, Math.min(3, n - 2)))}</span></span>`;
    body = squareKite(pr.seenAttrs, {
      hide: !pr.seenSkill,
      fuzz: Math.max(1, fuzz) as 1 | 2,
      nameHtml,
      blHtml: maskHtml,
      brHtml: ring,
      centerHtml: stars,
    });
  } else {
    // BIG BOARD — no compass: the stranger himself, the masked rating, the
    // commitment ring
    body = `<div class="ksq roster">
      ${img}
      <div class="ktop">${nameHtml}</div>
      <span class="kbl">${maskHtml}</span>
      <span class="kbr">${ring}</span>
    </div>`;
  }
  const stick = gxStickers?.get(pr.id) as Sticker[] | undefined;
  return `<div class="pcard prospect sq ${opts.draggable ? 'grabbable' : ''} ${opts.dim ? 'cutcard' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}" data-kind="pr" data-pid="${pr.id}">
    ${body}
    ${stickersHtml(stick, 0, opts.stickerAnimate !== false)}
    ${pr.bannedWeeks > 0 ? `<div class="ptag blink">BANNED ${pr.bannedWeeks}w</div>` : ''}
  </div>`;
}

// ---- header (always there) ---------------------------------------------------------------------

// JOB SECURITY: a bright bar the darkness eats from both ends —
// A+ = the school's heat (left), $ = the boosters' (right); an icon blinks
// once that side's approval drops under 25% (heat ≥ 75).
function jobBar(s: GameState): string {
  return `<div class="jobbar" title="job security — school heat ${s.heatS} · booster heat ${s.heatB}">
    <img class="jicon ${s.heatS >= 75 ? 'blink' : ''}" src="${iconUrl('aplus', ramp(0.75))}" alt=""/>
    <div class="jtrack">
      <div class="jdark l" style="width:${s.heatS}%"></div>
      <div class="jdark r" style="width:${s.heatB}%"></div>
      <span class="jlabel">JOB SECURITY</span>
    </div>
    <img class="jicon ${s.heatB >= 75 ? 'blink' : ''}" src="${iconUrl('dollar', ramp(0.75))}" alt=""/>
  </div>`;
}

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const cells = Array.from({ length: CACHE_MAX }, (_, i) =>
    `<span class="ecell ${i < s.energy ? 'on' : ''}" style="${i < s.energy ? `background:${ramp(0.35 + 0.55 * (i / CACHE_MAX))}` : ''}"></span>`
  ).join('');
  const jobFlash = storyMode === 'impact' && heatShift !== null && (heatShift.dS !== 0 || heatShift.dB !== 0) && currentStory(s);
  return `<div class="topbar ${gxResult ? 'spotlight' : ''} ${jobFlash ? 'jobflash' : ''}">
    <div class="hgrid">
      ${chip(t.name, t.bg, t.fg)}
      ${jobBar(s)}
      <span class="weeklab">S<b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b> · ${t.wins}–${t.losses}</span>
      <div class="ebar" title="energy ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">
        <img class="jicon ${s.energy < 4 ? 'blink' : 'ghost'}" src="${iconUrl('alert', ramp(0.9))}" alt=""/>
        <div class="etrack ${s.energy === 0 ? 'blink' : ''}">${cells}</div>
        <img class="jicon" src="${iconUrl('bolt', ramp(0.75))}" alt=""/>
      </div>
    </div>
    <div class="hbtns-col">
      <button class="hbtn" data-action="help">?</button>
      <button class="hbtn" data-action="coach-open">⚙</button>
    </div>
  </div>`;
}

// ---- THE BAG bar (always there) -------------------------------------------------------------------

function bagBar(s: GameState): string {
  const ev = currentStory(s);
  const usableInStory = new Set(
    (ev?.choices ?? []).filter((c) => c.itemId && !ev?.resolvedText).map((c) => c.itemId as string)
  );
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const id = s.bag[i];
    if (!id) return '<div class="bslot empty">·</div>';
    const item = itemById(id);
    const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
    return `<button class="bslot filled ${item.rarity} ${usableInStory.has(id) ? 'pulse' : ''} ${spent ? 'spent' : ''}"
      data-action="bag-item" data-id="${item.id}" data-bagitem="${item.id}">◆<span class="bshort">${item.short}</span></button>`;
  }).join('');
  return `<div class="bagbar">${slots}</div>`;
}

// ---- the grid (IS the lineup) -----------------------------------------------------------------------

const ROW_LABELS = ['START', 'BENCH', 'RESERVES'];

/** Once per action: a sticker batch animates the first time it renders,
    survives re-renders statically while landing, and after that either stays
    (game/half/week reports — info you tune with) or is gone (results were
    seen). */
function stickerBatch(key: string, persist: boolean): { render: boolean; animate: boolean } {
  const st = stickerBatches.get(key);
  if (st === 'seen') return { render: persist, animate: false };
  if (st === 'landing') return { render: true, animate: false };
  stickerBatches.set(key, 'landing');
  window.setTimeout(() => stickerBatches.set(key, 'seen'), 3600);
  return { render: true, animate: true };
}

function gridHtml(s: GameState, draggable: boolean, gridLens: Lens = 0, scopeSet: Set<number> | null = null): string {
  const t = myTeam(s);
  const isPractice = s.phase === 'practice';
  const showGame = s.phase === 'gamenight' && !!s.lastResult && gnStage !== 'beat';
  const showDrill = isPractice && s.trainedThisWeek && drillStickers !== null;
  const colHead = `<div class="colhead"><span class="rowlabel"></span>${COL_LABELS.map((c) => `<span>${c}</span>`).join('')}</div>`;
  const statLine = (row: { pts: number; reb: number; ast: number; stl: number }): string =>
    `${row.pts}P·${row.reb}R·${row.ast}A·${row.stl}S`;
  // one batch per screenful of results — resolved lazily so quiet renders
  // never arm it
  let batchInfo: { render: boolean; animate: boolean } | null = null;
  const batchFor = (key: string, persist: boolean): { render: boolean; animate: boolean } => {
    if (!batchInfo) batchInfo = stickerBatch(key, persist);
    return batchInfo;
  };
  const wkKey = `${s.season}:${s.week}`;
  const rows: string[] = [];
  let sweep = 0;
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const p = slotPlayer(t, idx);
      const mult = p && r < 2 ? slotMult(p, c) : 1;
      let stickers: Sticker[] | undefined;
      let stickerDelay = 0;
      let stickerAnimate = true;
      let tag: string | undefined;
      if (p && showGame) {
        // THE FINAL HORN: the night's line, the tank, the mood — XP waits
        // for the WEEK START report
        if (s.lastResult?.mvpId === p.id) tag = '★ GAME MVP';
        const d = s.postGame.find((x) => x.playerId === p.id);
        const row = s.lastResult?.box.find((x) => x.playerId === p.id);
        if (d || row) {
          const b = batchFor(`game:${wkKey}`, true);
          if (b.render) {
            stickers = [];
            stickerAnimate = b.animate;
            if (d?.fire === 'lit') stickers.push({ text: '🔥 ON FIRE', up: true });
            if (d?.fire === 'out') stickers.push({ text: '🔥 out', up: false });
            if (row) stickers.push({ text: statLine(row), up: row.pts >= 20 ? true : undefined });
            if (d && d.energyP !== 0) stickers.push({ text: `${d.energyP > 0 ? '+' : ''}${d.energyP}⚡`, up: d.energyP > 0, anchor: 'energy' });
            if (d && d.mood !== 0) stickers.push({ text: `${d.mood > 0 ? '+' : ''}${d.mood} MOOD`, up: d.mood > 0, anchor: 'mood' });
            stickerDelay = 300 + sweep * 260;
            sweep++;
          }
        }
      } else if (p && s.phase === 'gamenight' && gnStage === 'half' && s.halftime) {
        // the H1 line + the burn stick to every card — and the FORM ROLL
        // shows its hand: STANDOUT! rides on, OFF DAY begs for the bench,
        // TIRED blinks on an empty tank. Swaps answer all three.
        const ht = s.halftime;
        const row = ht.box.find((x) => x.playerId === p.id);
        const drain = ht.drains[p.id];
        const form = ht.forms?.[p.id];
        const gassed = r < 2 && p.outWeeks === 0 && p.energy <= 30;
        if (row || drain || form || gassed) {
          const b = batchFor(`half:${wkKey}`, true);
          if (b.render) {
            stickers = [];
            stickerAnimate = b.animate;
            if (form === 1) {
              stickers.push({ text: 'STANDOUT!', up: true });
              const gain = ht.formGain?.[p.id];
              if (gain) stickers.push({ text: gain, up: true, anchor: 'ovr' });
            }
            if (form === -1) stickers.push({ text: 'OFF DAY', up: false });
            if (row) stickers.push({ text: statLine(row), up: row.pts >= 10 ? true : undefined });
            if (gassed) stickers.push({ text: 'TIRED', up: false, anchor: 'energy', blink: true });
            else if (drain) stickers.push({ text: `${drain}⚡`, up: false, anchor: 'energy' });
            stickerDelay = 250 + sweep * 180;
            sweep++;
          }
        }
      } else if (p && s.phase === 'weekstart') {
        // THE MONDAY REPORT: banked XP + the weekend's ⚡ recovery — a small
        // bump means stacked starts. Mood drift is bookkeeping, not news.
        const wk = s.weekRecap?.find((x) => x.playerId === p.id);
        if (wk && (wk.xpGain > 0 || wk.energyP !== 0)) {
          const b = batchFor(`wk:${wkKey}`, true);
          if (b.render) {
            stickers = [];
            stickerAnimate = b.animate;
            if (wk.xpGain > 0) stickers.push({ text: `+${wk.xpGain} XP`, up: true, anchor: 'xp' });
            if (wk.energyP !== 0) stickers.push({ text: `${wk.energyP > 0 ? '+' : ''}${wk.energyP}⚡`, up: wk.energyP > 0, anchor: 'energy' });
            stickerDelay = 250 + sweep * 200;
            sweep++;
          }
        }
      } else if (p && showDrill) {
        const msgs = drillStickers!.get(p.id);
        if (msgs?.length) {
          const b = batchFor(`drill:${wkKey}`, false);
          if (b.render) {
            stickers = msgs;
            stickerAnimate = b.animate;
            stickerDelay = 350 + sweep * 240;
            sweep++;
          }
        }
      }
      // halftime: no fresh legs off the reserve bench — that row is locked
      const halfLock = s.phase === 'gamenight' && gnStage === 'half' && r === 2;
      const scope = scopeSet && p ? (scopeSet.has(p.id) ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell dropzone" data-zone="${idx}">
        ${p
          ? playerCard(p, { lens: gridLens, draggable: draggable && !halfLock, locked: halfLock, sitout: isPractice && p.outWeeks === 0 && p.energy < 40, miscast: Math.round((1 - mult) * 100), stickers, stickerDelay, stickerAnimate, tag, tagCls: tag ? 'mvp' : undefined, scope })
          : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${ROW_LABELS[r]}</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

// THE PRIORITY BOARD: rows are priority tiers, dragged exactly like the squad
// grid, any time — the drag IS the targeting. CUTS stays the transient 4th
// row during search swaps.
const BOARD_ROW_LABELS = ['TARGETS', 'BACKUPS', 'LAST RESORTS'];

function prospectGridHtml(s: GameState, scopeCount: number | null = null): string {
  // a blank column-header row keeps the cards in exactly the same spot as
  // the practice grid — screens must not jump
  const colHead = `<div class="colhead"><span class="rowlabel"></span><span></span><span></span><span></span></div>`;
  const swapping = s.pendingRecruits.length > 0;
  const gxBatch = gxStickers ? stickerBatch(`gx:${s.season}:${s.week}`, false) : null;
  if (gxBatch && !gxBatch.render) gxStickers = null; // seen is seen
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const pr = s.prospects[idx];
      const scope = scopeCount !== null && pr ? (idx < scopeCount ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell dropzone" data-zone="${idx}">${pr
        ? prospectCard(pr, lens, { draggable: lens === 0, scope, stickerAnimate: gxBatch?.animate ?? true })
        : `<div class="pod empty">·</div>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${BOARD_ROW_LABELS[r]}</div>${cells}</div>`);
  }
  // the 4th row exists only while new names wait — whoever sits there when
  // you confirm is gone forever
  if (swapping) {
    const cells = [0, 1, 2].map((c) => {
      const pr = s.pendingRecruits[c];
      return `<div class="gcell dropzone" data-zone="${9 + c}">${pr
        ? prospectCard(pr, lens, { draggable: lens === 0, dim: true })
        : `<div class="pod empty">·</div>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow cutrow"><div class="rowlabel">OUT</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

// ---- the story takeover (hides grid + fourth row; the bag stays) ------------------------------------

function impactHtml(s: GameState): string {
  if (!impact) return '';
  const imp = impact;
  const t = myTeam(s);
  const p = imp.pid !== null ? t.players.find((x) => x.id === imp.pid) : undefined;
  const rows = imp.rows.map((r) => `<div class="imp-row ${r.up ? 'up' : 'down'}">
    <span class="imp-lab">${esc(r.label)}</span>
    ${r.from !== undefined
      ? `<span class="imp-val" data-from="${r.from}" data-to="${r.to}" style="${r.color ? `color:${r.color}` : ''}">${r.from}</span>`
      : `<span class="imp-text">${esc(r.text ?? '')}</span>`}
    <span class="imp-arrow">${r.up ? '▲' : '▼'}</span>
  </div>`).join('');
  return `<div class="impactpanel">
    ${p ? `<span class="imp-sprite">${rigSpriteHtml(rigView(p, imp.rows.some((r) => !r.up) ? 'bad' : 'good'), { bg: t.bg, fg: t.fg }, 2)}</span><div class="imp-name">${esc(p.name)}</div>` : ''}
    <div class="imp-rows">${rows}</div>
  </div>`;
}

// One thing at a time: a typed beat, OR the decision, OR the impact.
/** Good news lights the sprite up; everything else makes it sweat. */
function storySentiment(tag: string): 'good' | 'bad' {
  return /BREAKTHROUGH|LEVEL UP|ON FIRE|CLEARED/.test(tag) ? 'good' : 'bad';
}

/** The dean's/booster's read of the resolution: heat toward them DOWN =
    they love you (elated), UP = they don't (mad), unmoved = neutral. */
function figureVerdict(figure: FigureId): FigureMood {
  if (!heatShift) return 'neutral';
  const d = figure === 'dean' ? heatShift.dS : heatShift.dB;
  return d < 0 ? 'elated' : d > 0 ? 'mad' : 'neutral';
}

/** The story's illustration: the player ACTING (worried → the verdict), the
    bus/saucer (ALWAYS starts moving, then the scene lands with the verdict),
    or the dean/booster sweating over what you'll pick. */
function storyArt(s: GameState, ev: { defId: string; playerId: number | null; tag: string; data?: Record<string, unknown>; resolvedText?: string; choices?: unknown[] }): string {
  const t0 = myTeam(s);
  const kit = { bg: t0.bg, fg: t0.fg };
  const def = storyById(ev.defId);
  const p = ev.playerId !== null ? t0.players.find((x) => x.id === ev.playerId) : undefined;
  const resolved = !!ev.resolvedText;
  if (p) {
    // the reaction lands at CHOICE time: what the PLAYER wanted decides the
    // acting the moment you pick; only unauthored choices fall back to the
    // outcome's read
    const acting: 'good' | 'bad' | 'worried' = resolved
      ? chosenWant
        ? (chosenWant === 'love' ? 'good' : 'bad')
        : (impact && impact.rows.some((r) => !r.up) ? 'bad' : 'good')
      : ev.choices?.length ? 'worried' : storySentiment(ev.tag);
    // the story picks its card backdrop: the ABILITIES compass for growth
    // stories, the energy/mood gauges for everything else
    return `<div class="modalcard">${playerCard(p, { inert: true, story: acting, storyView: def.card ?? 'meters' })}</div>`;
  }
  const figure: FigureId | undefined = def.figure === 'side'
    ? ((ev.data?.side as string) === 'school' ? 'dean' : 'booster')
    : def.figure;
  if (figure) {
    const mood: FigureMood = resolved ? figureVerdict(figure) : 'worried';
    return `<div class="scenebox">${figureHtml(figure, mood, kit, 3)}</div>`;
  }
  const artKind = (ev.data?.art as 'bus' | 'saucer' | undefined) ?? def.art;
  if (artKind) {
    // the law: the ship ALWAYS starts moving; the event scene lands with the news
    const moving = storyMode === 'antic' || !def.artEvent;
    const scene = (moving ? `${artKind}-move` : `${artKind}-${def.artEvent}`) as SceneId;
    const flip = artKind === 'bus' && ev.defId !== 'travel_out' && moving; // heading home
    return `<div class="scenebox">${sceneHtml(scene, kit, 3, flip)}</div>`;
  }
  return '';
}

function storyPanel(s: GameState): string {
  const ev = currentStory(s)!;
  const p = ev.playerId !== null ? myTeam(s).players.find((x) => x.id === ev.playerId) : undefined;
  const art = storyArt(s, ev);
  if (storyMode === 'impact') {
    return `<div class="storypanel" data-action="story-tap" id="storypanel">
      <span class="tag">${esc(ev.tag)}</span>
      ${p ? '' : art}
      ${impactHtml(s)}
      <div class="modal-actions" id="modal-actions"><div class="taphint">▸ tap</div></div>
    </div>`;
  }
  const pendingChoices = !!ev.choices?.length && !ev.resolvedText;
  if (pendingChoices) {
    // the FINAL layout from the very first beat — tag, card and text box are
    // all in place before anything types, so nothing ever bounces or resizes
    const beats = splitBeats(ev.text);
    const inChoices = storyMode === 'choices';
    let actions: string;
    if (inChoices) {
      actions = ev.choices!
        .filter((c) => !c.itemId) // items live in THE BAG below — tap or drag them in
        .map((c) => {
          const cant = c.cost !== undefined && s.energy < c.cost;
          return `<button class="wide hold" data-action="story-choice" data-id="${esc(c.key)}" ${cant || c.disabled ? 'disabled' : ''}>
            ${esc(c.label)}${cant ? ' — NOT ENOUGH ⚡' : ''}<br/>${oddsLine(c.up, c.down, c.cost)}</button>`;
        }).join('');
    } else {
      actions = '<div class="taphint">▸ tap</div>';
    }
    return `<div class="storypanel" data-action="story-tap" id="storypanel">
      <span class="tag">${esc(ev.tag)}</span>
      ${art}
      ${inChoices
        ? `<div class="typebox">${esc(beats[beats.length - 1])}</div>`
        : `<div class="typebox" id="typebox"></div>`}
      <div class="modal-actions ${inChoices ? '' : 'hide'}" id="modal-actions">${actions}</div>
    </div>`;
  }
  // a single typed beat, center stage (this layout never gains elements mid-read)
  return `<div class="storypanel" data-action="story-tap" id="storypanel">
    <span class="tag">${esc(ev.tag)}</span>
    ${art}
    <div class="typebox beatbox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div>`;
}

// ---- stages (middle content per phase) -----------------------------------------------------------------

function ordinal(n: number): string {
  return `${n}${['', 'st', 'nd', 'rd'][n] ?? 'th'}`;
}

const BAR_ROWS: { a: Attr | 'all'; label: string }[] = [
  { a: 'skl', label: 'SKILL' },
  { a: 'ath', label: 'ATHLETICISM' },
  { a: 'frc', label: 'FIERCENESS' },
  { a: 'brn', label: 'BRAINS' },
  { a: 'all', label: 'OVERALL' },
];

/** PRACTICE: five progress bars + division rank per row — on the MATCH
    weighting (starters ×75% + bench ×25%, unavailable bodies add nothing),
    exactly the numbers the ropes will run on. */
function teamBarsPractice(s: GameState): string {
  const t = myTeam(s);
  const all = s.teams.map((tm) => ({ id: tm.id, sums: matchAttrs(tm) }));
  const mine = all.find((x) => x.id === t.id)!.sums;
  const rows = BAR_ROWS.map(({ a, label }) => {
    const val = (x: AttrRec): number => (a === 'all' ? ovr(x) : x[a]);
    const max = a === 'all' ? 460 : 130;
    const rank = 1 + all.filter((x) => x.id !== t.id && val(x.sums) > val(mine)).length;
    return `<div class="tbar ${a === 'all' ? 'big' : ''}">
      <span class="tbl">${label}</span>
      <b class="tbv">${Math.round(val(mine))}</b>
      <span class="tbtrack"><span class="tbfill" style="width:${Math.min(100, (val(mine) / max) * 100)}%;background:${t.bg}"></span></span>
      <span class="tbr">${ordinal(rank)}</span>
    </div>`;
  }).join('');
  return `<div class="tbars">${rows}</div>`;
}

/** MATCHUP: away on the left, home on the right — the ropes run on the real
    match values (75/25 lineup, energy×mood curve, miscast, fire, form, a
    landed speech). The opponent's bars are ALWAYS visible for free — this is
    a lineup-tuning screen and tuning needs a visible opponent. The OVERALL
    rope's split IS the win chance the needle lands on. */
function teamBarsMatchup(s: GameState, opts: { fx?: SpeechFx | null; noVs?: boolean; forms?: Record<number, 1 | -1> } = {}): string {
  const t = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const home = isUtWeek(s) ? true : m?.home ?? true;
  const opp = champ
    ? { name: champ.name, bg: champ.bg, fg: champ.fg }
    : m
      ? { name: m.opponent.name, bg: m.opponent.bg, fg: m.opponent.fg }
      : { name: '?', bg: '#333', fg: '#ccc' };
  const mineChip = { name: t.name, bg: t.bg, fg: t.fg };
  const away = home ? opp : mineChip;
  const homeT = home ? mineChip : opp;
  const clash = Math.min(Math.abs(hue(away.bg) - hue(homeT.bg)), 360 - Math.abs(hue(away.bg) - hue(homeT.bg))) < 40;
  const vsRow = `<div class="tbar vsrow">
    <span class="tbl"></span><b class="tbv"></b>
    <span class="vs-track">
      <span class="vsl">${clash ? chip(away.name, away.fg, away.bg, true) : chip(away.name, away.bg, away.fg, true)}</span>
      <span class="vsat">@</span>
      <span class="vsr">${chip(homeT.name, homeT.bg, homeT.fg, true)}</span>
    </span>
    <b class="tbv"></b>
  </div>`;
  const fx = opts.fx !== undefined ? opts.fx : s.speechFx ?? null;
  const mine = matchAttrs(t, fx, opts.forms);
  const mineTotal = ovr(mine);
  let theirs: AttrRec | null = null;
  let theirsTotal = 0;
  let oppBg = '#666';
  if (champ) {
    // distribute the champion's power along their scouted kite
    const w = ATTRS.map((a) => champ.kite[a]);
    const tw = w.reduce((x, y) => x + y, 0) || 1;
    theirs = { skl: 0, ath: 0, frc: 0, brn: 0 };
    ATTRS.forEach((a, i) => { theirs![a] = (champ.power * w[i]) / tw; });
    theirsTotal = champ.power;
    oppBg = champ.bg;
  } else if (m) {
    theirs = matchAttrs(m.opponent);
    theirsTotal = ovr(theirs);
    oppBg = m.opponent.bg;
  }
  const rows = BAR_ROWS.map(({ a, label }) => {
    const big = a === 'all';
    const mv = big ? mineTotal : mine[a];
    const tv = theirs ? (big ? theirsTotal : theirs[a]) : null;
    let myPct: number;
    if (tv !== null) {
      // the OVERALL rope shows the true win chance (venue folded in)
      if (big) {
        myPct = winShare(mv * (home ? 1.03 : 1), tv * (home ? 1 : 1.03)) * 100;
      } else {
        myPct = (mv / Math.max(1, mv + tv)) * 100;
      }
    } else {
      myPct = Math.min(100, (mv / (big ? 460 : 130)) * 100);
    }
    const myFill = `<span class="tbfill" style="width:${myPct}%;background:${t.bg}"></span>`;
    const oppFill = tv !== null ? `<span class="tbopp" style="width:${100 - myPct}%;background:${oppBg}"></span>` : '';
    const track = home
      ? `<span class="tbtrack ${tv !== null ? 'tug' : ''} rtl">${oppFill}${myFill}</span>`
      : `<span class="tbtrack ${tv !== null ? 'tug' : ''}">${myFill}${oppFill}</span>`;
    const myNum = `<b class="tbv">${Math.round(mv)}</b>`;
    const oppNum = tv !== null ? `<b class="tbv opp">${Math.round(tv)}</b>` : `<b class="tbv opp dim">??</b>`;
    const left = home ? oppNum : myNum;
    const right = home ? myNum : oppNum;
    return `<div class="tbar ${big ? 'big' : ''}">
      <span class="tbl">${label}</span>
      ${left}
      ${track}
      ${right}
    </div>`;
  }).join('');
  return `<div class="mu-bars"><div class="tbars mu">${opts.noVs ? '' : vsRow}${rows}</div></div>`;
}

function lensBar(names: string[] = LENS_NAMES): string {
  const tabs = names.map((n, i) =>
    `<button class="lenstab ${lens === i ? 'sel' : ''}" data-action="lens-set" data-id="${i}">${n}</button>`).join('');
  return `<div class="lensbar">${tabs}</div>`;
}

function drillRecap(d: (typeof DRILLS)[number]): string {
  if (d.target === 'rest') {
    const rec = d.recover ?? { energy: 21, mood: 4 };
    const bits = [rec.energy >= rec.mood ? `squad ⚡ +${rec.energy}` : '', rec.mood > rec.energy ? `squad MOOD +${rec.mood}` : ''].filter(Boolean);
    return `${bits.join(' ')} · ${d.cost ? `${d.cost}⚡` : '0⚡'}`;
  }
  const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
  const pot = d.potChance ? `${d.potChance}% +1 CEILING` : '';
  return `${[gains, pot].filter(Boolean).join(' · ') || `+${d.xp[0]}–${d.xp[1]} XP`} · SQUAD · ${d.cost}⚡`;
}

/** WEEK START: the Monday report — the weekend's recovery and banked XP per
    player, before the building (and the week's stories) opens. */
function stageWeekstart(s: GameState): string {
  return `<h2 class="gridhead">${weekLabel(s)} <span class="venuetag" style="background:var(--r35);color:var(--rbg)">WEEK START</span></h2>
    ${gridHtml(s, false, 0)}`;
}

function stagePractice(s: GameState): string {
  const d = DRILLS.find((x) => x.id === selectedDrill)!;
  const spent = s.trainedThisWeek;
  // THE SCOPE PREVIEW: a non-default squad drill blinks the button in sync
  // with everyone it will actually touch; the rest of the screen dims
  const scoped = !spent && lens === 0 && d.target === 'squad' && selectedDrill !== 'rest';
  const scopeSet = scoped
    ? new Set(myTeam(s).players.filter((p) => p.outWeeks === 0 && p.energy >= 40).map((p) => p.id))
    : null;
  // training can only be RUN from the ROSTER view — on the other lenses the
  // row keeps its space (the team gauges must NOT move) but goes ghost
  const fourth = `<div class="fourthrow actrow ${lens !== 0 ? 'ghostrow' : ''}"><span class="actwrap runwrap">
      <button class="actmain hold ${scoped ? 'scopehl' : ''}" data-action="drill-run" ${spent || s.energy < d.cost ? 'disabled' : ''}>
        <b>▶ RUN — ${d.name}</b><span class="actsub">${spent ? '✓ THIS WEEK' : s.energy < d.cost ? `NEED ${d.cost}⚡` : drillRecap(d)}</span>
      </button>
      <button class="actarrow" data-action="drill-sheet" ${spent ? 'disabled' : ''}>▾</button>
    </span></div>`;
  return `<h2 class="gridhead">PRACTICE</h2>${gridHtml(s, lens === 0, lens, scopeSet)}<div class="botstack">${teamBarsPractice(s)}${fourth}</div>`;
}

/** «ALL 9» / «TOP 6» / «TARGETS» — the scope, printed everywhere. */
function gxScopeWord(act: (typeof GALAXY_ACTS)[number]): string {
  return act.scope === 3 ? 'TARGETS' : act.scope === 6 ? 'TOP 6' : 'ALL 9';
}

/** One-line recap of a galaxy act for the main button. */
function gxActSub(act: (typeof GALAXY_ACTS)[number]): string {
  if (act.kind === 'scout') return `reveal ${act.reveals![0]}–${act.reveals![1]} facets · ${gxScopeWord(act)} · ${act.cost}⚡`;
  if (act.kind === 'recruit') return `+${act.gain![0]}–${act.gain![1]}% commit · ${gxScopeWord(act)} · ${act.cost}⚡`;
  return `new talent for the board · ${act.cost ? `${act.cost}⚡` : 'FREE'}`;
}

const GX_VERB = { scout: 'SCOUT', recruit: 'RECRUIT', search: 'SEARCH' } as const;

function stageGalaxy(s: GameState): string {
  const act = galaxyActById(selGalaxy);
  const grounded = s.groundedWeeks > 0 && act.kind === 'search' && !act.local;
  const swapping = s.pendingRecruits.length > 0;
  const done = s.galaxyActWk;
  const disabled = grounded ? 'GROUNDED' : s.energy < act.cost ? `NEED ${act.cost}⚡` : false;
  // THE SCOPE PREVIEW: a row-scoped method blinks the button in sync with
  // every impacted card while the rest of the board dims
  const scoped = !done && !swapping && !disabled && act.kind !== 'search' && s.prospects.length > 0;
  const scopeCount = scoped ? (act.scope ?? 9) : null;
  const button = swapping
    ? ''
    : `<span class="actwrap runwrap">
      <button class="actmain hold ${scoped && act.scope ? 'scopehl' : ''}" data-action="gx-run" ${disabled || done ? 'disabled' : ''}>
        <b>▶ ${GX_VERB[act.kind]} — ${act.name}</b><span class="actsub">${done ? '✓ THIS WEEK' : disabled ? esc(disabled) : gxActSub(act)}</span>
      </button>
      <button class="actarrow" data-action="gx-sheet" ${done ? 'disabled' : ''}>▾</button>
    </span>`;
  return `<h2 class="gridhead">RECRUITING</h2>
    ${prospectGridHtml(s, scopeCount !== null && act.scope ? scopeCount : null)}
    <div class="botstack">
      ${s.groundedWeeks > 0 && !swapping ? `<div class="fourthrow slim"><div class="report blink">SHIP GROUNDED ${s.groundedWeeks}w — local searches only</div></div>` : ''}
      ${swapping ? '' : `<div class="fourthrow actrow">${button}</div>`}
    </div>`;
}

function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const d = mx - mn;
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h * 360;
}

/** The speech picker's current selection (falls back to the committed plan). */
function speechSel(s: GameState): PlanId {
  return selSpeech && s.knownPlans.includes(selSpeech) ? selSpeech : s.knownPlans.includes(s.plan) ? s.plan : s.knownPlans[0];
}

/** «▶ SPEECH — …» + ▾ — a mandatory gamble, one per half. */
function speechRow(s: GameState, half: boolean): string {
  const sel = speechSel(s);
  const pl = planById(sel);
  const spoken = half ? !!s.speechH2 : !!s.speechWk;
  const committed = half ? s.planH2 ?? s.plan : s.plan;
  const landed = half ? s.speechFxH2 : s.speechFx;
  const spokenSub = landed
    ? `🔥 THE ROOM IGNITED — squad +${landed.amt} ${ATTR_SHORT[landed.attr]} tonight`
    : half ? '✓ THE ROOM HEARD IT' : '✓ THIS WEEK';
  return `<div class="fourthrow actrow"><span class="actwrap runwrap">
      <button class="actmain hold" data-action="speech-run" ${spoken ? 'disabled' : ''}>
        <b>▶ ${half ? 'HALFTIME SPEECH' : 'SPEECH'} — ${spoken ? planById(committed).speech : pl.speech}</b>
        <span class="actsub">${spoken ? spokenSub : `${pl.up}% squad +${pl.boost} ${ATTR_SHORT[pl.attr]} · ${pl.down}% a believer lost · FREE`}</span>
      </button>
      <button class="actarrow" data-action="speech-sheet" ${spoken ? 'disabled' : ''}>▾</button>
    </span></div>`;
}

function stageMatchup(s: GameState): string {
  const speech = speechRow(s, false);
  const m0 = myMatchup(s);
  const homeGame = isUtWeek(s) ? true : m0?.home ?? true;
  const host = homeGame
    ? { bg: myTeam(s).bg, fg: myTeam(s).fg }
    : m0
      ? { bg: m0.opponent.bg, fg: m0.opponent.fg }
      : { bg: '#333', fg: '#ccc' };
  return `<h2 class="gridhead">MATCHUP <span class="venuetag" style="background:${host.bg};color:${host.fg}">${homeGame ? 'HOME GAME' : 'AWAY GAME'}</span></h2>
    ${gridHtml(s, true)}
    <div class="botstack">${teamBarsMatchup(s)}${speech}</div>`;
}

// the speech picker: which gamble does the room hear tonight?
function speechSheetHtml(s: GameState): string {
  if (!speechSheet) return '';
  const sel = selSpeech ?? s.plan;
  let hidden = 0;
  const items = PLANS.map((pl) => {
    if (!s.knownPlans.includes(pl.id)) { hidden++; return ''; }
    return `<button class="drill ${sel === pl.id ? 'sel' : ''}" data-action="speech-pick" data-id="${pl.id}">
      <b>${pl.speech}</b> <span class="xpg">${ATTR_LABEL[pl.attr]}</span>
      ${oddsLine({ pct: pl.up, cls: 'SPIRIT', note: `squad +${pl.boost} ${ATTR_SHORT[pl.attr]}` }, { pct: pl.down, cls: 'DRAMA', note: 'a believer lost' })}<br/>
      <span class="ddesc">${esc(pl.fantasy)}</span>
    </button>`;
  }).join('');
  return `<div class="modalback sheet" data-action="speech-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">THE SPEECH</span>
    ${items}
    ${hidden ? `<div class="sheethint dim">▓ ${hidden} speech${hidden === 1 ? '' : 'es'} unlearned</div>` : ''}
    <div class="scrollmore">▼</div>
  </div></div>`;
}

/** The big rope + needle, shared by both halves (away on the left, always). */
function needleStage(s: GameState, title: string, subLine: string, share: number, home: boolean, oppName: string): string {
  const t = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const oppBg = champ ? champ.bg : m ? m.opponent.bg : '#888';
  const awayShare = home ? 1 - share : share;
  return `<div class="needle-stage" id="needle-stage">
    <div class="ns-title">${title}</div>
    <div class="ns-vs">${esc(home ? oppName : teamLabel(t))} <span class="dim">@</span> ${esc(home ? teamLabel(t) : oppName)}</div>
    ${subLine}
    <div class="bigrope">
      <span class="brfill" style="width:${awayShare * 100}%;background:${home ? oppBg : t.bg}"></span>
      <span class="brfill r" style="width:${(1 - awayShare) * 100}%;background:${home ? t.bg : oppBg}"></span>
      <span class="brsplit" style="left:${awayShare * 100}%"></span>
      <div class="needle" id="needle"></div>
    </div>
  </div>`;
}

/** HALFTIME: the scoreboard, the grid wide open (swap anyone), each card's H1
    line stuck on, the honest post-drain ropes, and the second speech. */
function stageHalftime(s: GameState): string {
  const ht = s.halftime!;
  const t = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const opp = champ
    ? { name: champ.name, bg: champ.bg, fg: champ.fg }
    : m
      ? { name: m.opponent.name, bg: m.opponent.bg, fg: m.opponent.fg }
      : { name: '?', bg: '#333', fg: '#ccc' };
  const mineChip = { name: t.name, bg: t.bg, fg: t.fg, score: ht.myH1 };
  const oppChip = { ...opp, score: ht.oppH1 };
  const away = ht.home ? oppChip : mineChip;
  const homeT = ht.home ? mineChip : oppChip;
  const clash = Math.min(Math.abs(hue(away.bg) - hue(homeT.bg)), 360 - Math.abs(hue(away.bg) - hue(homeT.bg))) < 40;
  const scoreline = `<div class="halfline">
    ${clash ? chip(away.name, away.fg, away.bg, true) : chip(away.name, away.bg, away.fg, true)}
    <b>${away.score}</b><span class="dim">@</span><b>${homeT.score}</b>
    ${chip(homeT.name, homeT.bg, homeT.fg, true)}
  </div>`;
  // the gassed-starter call-out lives ON the cards now: a blinking TIRED
  // sticker over the empty tank (gridHtml), not a strip that costs a row
  return `<h2 class="gridhead">HALFTIME</h2>
    ${scoreline}
    ${gridHtml(s, true)}
    <div class="botstack">
      ${teamBarsMatchup(s, { fx: s.speechFxH2 ?? null, noVs: true, forms: ht.forms })}
      ${speechRow(s, true)}
    </div>`;
}

function stageGamenight(s: GameState): string {
  const ht = s.halftime;
  const r = s.lastResult;
  if (!r && !ht) {
    return `<h2>GAME NIGHT</h2><div class="report dim">The shuttle hums...</div>`;
  }
  if (gnStage === 'beat' && ht && !r) {
    return needleStage(s, '« TIP OFF »', '', ht.share, ht.home, ht.oppName);
  }
  if (gnStage === 'half' && ht && !r) {
    return stageHalftime(s);
  }
  if (!r) return `<h2>GAME NIGHT</h2><div class="report dim">The shuttle hums...</div>`;
  if (gnStage === 'beat' || gnStage === 'beat2') {
    // the H2 needle (or the whole night for a pre-halftime save)
    const sub = r.h1
      ? `<div class="ns-vs dim">FIRST HALF · ${r.home ? r.h1.opp : r.h1.my} @ ${r.home ? r.h1.my : r.h1.opp}</div>`
      : '';
    return needleStage(s, r.h1 ? 'SECOND HALF' : 'TIP-OFF', sub, (r.h2 ?? r).share, r.home, r.oppName);
  }
  if (gnStage === 'verdict') {
    // the grid holds its usual spot (header → grid, like every screen);
    // the recap reads below it
    const halves = r.h1 && r.h2 ? `<div class="vline dim">H1 ${r.h1.my}–${r.h1.opp} · H2 ${r.h2.my}–${r.h2.opp}</div>` : '';
    return `<h2 class="gridhead ${r.win ? 'won' : 'lost'}">${r.win ? 'VICTORY' : 'DEFEAT'} ${r.myScore}–${r.oppScore}</h2>
      ${gridHtml(s, true)}
      <div class="botstack"><div class="verdict">
        ${halves}
        <div class="vline">${esc(r.wheelLine)}</div>
        <div class="vline">${esc(r.heroLine)}</div>
        <div class="vline dim">${esc(r.boxLine)}</div>
      </div></div>`;
  }
  const table = !isUtWeek(s)
    ? `<table class="standings">${sortedStandings(s)
        .map((t, i) => `<tr class="${t.id === s.myTeamId ? 'me' : ''}">
          <td>${i + 1}. ${chip(t.name, t.bg, t.fg, true)}</td><td class="num">${t.wins}–${t.losses}</td></tr>
          ${i === 1 ? '<tr class="utline"><td colspan="2">▲ THE UNIVERSAL TOURNAMENT ▲</td></tr>' : ''}`)
        .join('')}</table>`
    : `<div class="report">${(s.ut?.log ?? []).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
  const others = s.resultsLog.length
    ? `<div class="report dim">${s.resultsLog.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
    : '';
  return `<h2>STANDINGS</h2>${table}${others}`;
}

// ---- full views in the same frame ----------------------------------------------------------------------

// THE SELECTION GRID: the same 3×3 squad grid plus a 4th row — the door.
// Drag players between rows; slots 0–8 (in lineup order) stay, the bottom
// row is CUT, forever, after one last are-you-sure.
const SELECT_ROW_LABELS = ['START', 'BENCH', 'RESERVES', 'CUT'];

function selectSlotIds(s: GameState): number[] {
  if (selSlots === null || selSlots.length !== s.selectPool.length || selSlots.some((id) => !s.selectPool.some((p) => p.id === id))) {
    // reading order: returners first, then the new recruits, then walk-ons
    selSlots = s.selectPool.map((p) => p.id);
  }
  return selSlots;
}

function stageTeamSelect(s: GameState): string {
  const slots = selectSlotIds(s);
  const returning = new Set(myTeam(s).players.map((p) => p.id));
  const commits = new Set(s.commits.map((p) => p.id));
  const byId = new Map(s.selectPool.map((p) => [p.id, p]));
  const colHead = `<div class="colhead"><span class="rowlabel"></span><span></span><span></span><span></span></div>`;
  const rows: string[] = [];
  for (let r = 0; r < 4; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const p = byId.get(slots[idx]);
      if (!p) return `<div class="gcell dropzone" data-zone="${idx}"><div class="pod empty">·</div></div>`;
      const tag = returning.has(p.id) ? 'RETURNER' : commits.has(p.id) ? 'RECRUIT' : 'WALK-ON';
      return `<div class="gcell dropzone" data-zone="${idx}">${playerCard(p, {
        lens,
        tag,
        draggable: lens === 0,
        kit: returning.has(p.id) || commits.has(p.id) ? undefined : PRACTICE_KIT,
      })}</div>`;
    }).join('');
    rows.push(`<div class="gridrow ${r === 3 ? 'cutrow' : ''}"><div class="rowlabel">${SELECT_ROW_LABELS[r]}</div>${cells}</div>`);
  }
  return `<h2 class="gridhead">${s.season === 0 ? 'TRYOUTS' : `SEASON ${s.season + 1} ROSTER`}</h2>
    <div class="grid">${colHead}${rows.join('')}</div>`;
}

function stageDepartures(s: GameState): string {
  const notes = s.seasonNotes.map((x) => `<div>${esc(x)}</div>`).join('');
  const pros = s.proDeparts.length
    ? s.proDeparts.map((d) => {
        if (d.resolved) return `<div class="propane">${esc(d.note)}</div>`;
        const p = myTeam(s).players.find((x) => x.id === d.playerId);
        const chance = p ? clamp(15 + (p.mood - 40), 10, 80) : 15;
        return `<div class="propane"><b>${esc(d.name)}</b> ${genderize('has pro scouts in his dorm lobby.', p?.form)}
          <button class="hold" data-action="convince-pro" data-id="${d.playerId}">${genderize('KEEP HIM', p?.form)} ${oddsLine({ pct: chance as 2, cls: 'SPIRIT' }, { pct: (100 - chance) as 2, cls: 'DRAMA' })}</button>
          <button class="hold" data-action="letgo-pro" data-id="${d.playerId}">${genderize('LET HIM FLY', p?.form)}</button></div>`;
      }).join('')
    : '';
  return `<h2>OFFSEASON</h2>
    <div class="report">${notes}</div>
    ${pros}
    <div class="report">LEGACY <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b>
      <span class="dim">· ${s.trophies}🏆 · ${s.utTitles} UT · ${s.totalWins}W</span><br/>
      <button class="hold danger" data-action="retire">🏁 RETIRE — LOCK IN YOUR LEGACY</button></div>`;
}

function stageSigning(s: GameState): string {
  const chances = effectiveChances(s);
  const rows = [...s.prospects]
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((pr) => {
      const eff = chances.find((c) => c.prospect.id === pr.id);
      const seen = ovr(pr.seenAttrs);
      const ability = pr.digits >= 2
        ? `<b style="color:${vc(seen * 1.6)}">${seen}</b>`
        : `<b class="dim">${prospectMask(pr)}</b>`;
      const stars = pr.seenPot ? '★'.repeat(potStars(ovr(pr.seenPots))) : '<span class="dim">??</span>';
      return `<tr>
        <td><button class="signbtn" data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑' : '☐'}</button></td>
        <td>${esc(pr.name)}</td>
        <td class="num">${ability}</td>
        <td class="num">${stars}</td>
        <td class="num" style="color:${vc(pr.commitPct)}">${pr.commitPct}%</td>
        <td class="num">${pr.selected && eff ? `<b style="color:${vc(eff.pct)}">→${eff.pct}%</b>` : ''}</td>
      </tr>`;
    })
    .join('');
  return `<h2>SIGNING DAY</h2>
    <table>${rows || '<tr><td class="dim">You scouted nobody. Enjoy the walk-ons.</td></tr>'}</table>`;
}

function stageGameover(s: GameState): string {
  const e = s.end!;
  return `<div class="tombstone">
    <h1 class="blink">${esc(e.cause)}</h1>
    <p class="sub">${esc(e.text)}</p>
    <div class="report">
      <div>SEASONS <b>${s.season}</b> · LEGACY <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b></div>
      <div>${s.trophies}🏆 · ${s.utTitles} UNIVERSAL · ${s.totalWins} WINS</div>
    </div>
    ${s.careerLog.length ? `<div class="report dim">${s.careerLog.slice(-8).map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
  </div>`;
}

function stagePickTeam(s: GameState): string {
  const cards = s.teams.map((t) => {
    const avg = Math.round(t.players.reduce((a, p) => a + ovr(p.attrs), 0) / t.players.length);
    return `<button class="teampickbtn" data-action="pick-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
      <b>${esc(teamLabel(t))}</b><br/><span>${esc(t.region)} · avg overall ${avg}</span></button>`;
  }).join('');
  return `<h1>GALACTIC COACH</h1>
    <p class="sub">3-on-3. Every choice has two tails.</p>
    <div class="teampick">${cards}</div>`;
}

// ---- nav (always there) ------------------------------------------------------------------------------------

// One nav language everywhere: a single full-width hold-to-commit button that
// names what's next — DIMMED (not hidden) whenever an action must land first.
function navMain(label: string, action: string, disabled = false): string {
  return `<button class="primary hold navmain" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
function nav(s: GameState): string {
  if (currentStory(s)) return navMain('THE GALAXY IS TALKING…', 'noop', true);
  switch (s.phase) {
    case 'pickTeam':
      return navMain('CHOOSE YOUR PROGRAM', 'noop', true);
    case 'teamSelect':
      return navMain('CONFIRM SQUAD', 'cut-confirm-open');
    case 'weekstart':
      return navMain(isUtWeek(s) ? 'TO MATCHUP' : 'TO PRACTICE', 'begin-week');
    case 'practice':
      return navMain(s.trainedThisWeek ? 'TO RECRUITING' : 'PRACTICE FIRST', 'to-galaxy', !s.trainedThisWeek);
    case 'galaxy':
      if (s.pendingRecruits.length) return navMain('CONFIRM THE BOARD', 'board-confirm-open');
      return navMain(s.galaxyActWk ? 'TO MATCHUP' : 'TAKE AN ACTION FIRST', 'to-matchup', !s.galaxyActWk);
    case 'matchup':
      return navMain(s.speechWk ? 'PLAY' : 'SPEECH FIRST', 'play-game', !s.speechWk);
    case 'gamenight': {
      if (gnStage === 'half' && s.halftime && !s.lastResult)
        return navMain(s.speechH2 ? 'SECOND HALF' : 'SPEECH FIRST', 'play-h2', !s.speechH2);
      if (!s.lastResult || gnStage === 'beat' || gnStage === 'beat2') return navMain('…', 'noop', true);
      if (gnStage === 'verdict') return navMain('STANDINGS', 'gn-table');
      return navMain('NEXT WEEK', 'continue-result');
    }
    case 'departures': {
      const unresolved = s.proDeparts.some((d) => !d.resolved);
      return navMain(unresolved ? 'YOUR STARS FIRST' : 'SIGNING DAY', 'to-signing', unresolved);
    }
    case 'signing':
      return navMain('SEND LETTERS', 'do-signing');
    case 'gameover':
      return navMain('NEW GAME', 'new-game-direct');
    default:
      return '';
  }
}

// ---- overlays --------------------------------------------------------------------------------------------------

// the practice picker, grouped into its three families
const DRILL_KIND_LABEL = { train: 'TRAIN — earn XP', sharpen: 'SHARPEN — direct gains', recover: 'RECOVER — get the squad back' } as const;

function drillSheetHtml(s: GameState): string {
  if (!drillSheet) return '';
  let hidden = 0;
  const groups = (['train', 'sharpen', 'recover'] as const).map((kind) => {
    const drills = DRILLS.filter((d) => drillKind(d) === kind).map((d) => {
      // undiscovered methods stay off the sheet — the galaxy will tell you
      if (!s.unlockedDrills.includes(d.id)) { hidden++; return ''; }
      const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
      const what = gains
        ? `<span class="xpg gaintag">${gains}</span>`
        : d.potChance
          ? `<span class="xpg gaintag">${d.potChance}% +1 CEILING</span>`
          : d.xp[1] > 0
            ? `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP</span>`
            : `<span class="xpg">${(d.recover?.mood ?? 0) > (d.recover?.energy ?? 0) ? 'squad MOOD up' : 'squad ⚡ up'}</span>`;
      return `<button class="drill ${selectedDrill === d.id ? 'sel' : ''}" data-action="drill-pick" data-id="${d.id}">
        <b>${d.name}</b> ${what}
        ${oddsLine(d.up, d.down, d.cost)}
      </button>`;
    }).join('');
    return drills ? `<div class="sheethead">${DRILL_KIND_LABEL[kind]}</div>${drills}` : '';
  }).join('');
  return `<div class="modalback sheet" data-action="drill-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">THE PRACTICE</span>
    ${groups}
    ${hidden ? `<div class="sheethint dim">▓ ${hidden} method${hidden === 1 ? '' : 's'} undiscovered</div>` : ''}
    <div class="scrollmore">▼</div>
  </div></div>`;
}

// the galaxy picker: all three families in one sheet, grouped
const GX_KIND_LABEL = { scout: 'SCOUT — reveal the board', recruit: 'RECRUIT — work the board', search: 'SEARCH — new talent' } as const;

function galaxySheetHtml(s: GameState): string {
  if (!galaxySheet) return '';
  let hidden = 0;
  const groups = (['scout', 'recruit', 'search'] as const).map((kind) => {
    const acts = GALAXY_ACTS.filter((a) => a.kind === kind).map((a) => {
      // uncharted regions stay off the sheet until the charts are yours
      if (a.kind === 'search' && !s.unlockedRegions.includes(a.id)) { hidden++; return ''; }
      const grounded = s.groundedWeeks > 0 && a.kind === 'search' && !a.local;
      const what = a.reveals
        ? `<span class="xpg">${a.reveals[0]}–${a.reveals[1]} facets · ${gxScopeWord(a)}</span>`
        : a.gain
          ? `<span class="xpg">+${a.gain[0]}–${a.gain[1]}% · ${gxScopeWord(a)}${a.risk ? ` · ${a.risk}% backfire each` : ''}</span>`
          : `<span class="xpg">1${a.twoChance ? '–2' : ''} new name${a.twoChance ? 's' : ''}</span>`;
      return `<button class="drill ${selGalaxy === a.id ? 'sel' : ''}" data-action="gx-pick" data-id="${a.id}" ${grounded ? 'disabled' : ''}>
        <b>${a.name}</b>${grounded ? ' <span class="blink">GROUNDED</span>' : ''} ${what}
        ${oddsLine(a.up, a.down, a.cost)}<br/>
        <span class="ddesc">${esc(a.desc)}</span>
      </button>`;
    }).join('');
    return acts ? `<div class="sheethead">${GX_KIND_LABEL[kind]}</div>${acts}` : '';
  }).join('');
  return `<div class="modalback sheet" data-action="gx-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">THE WEEK'S MOVE</span>
    ${groups}
    ${hidden ? `<div class="sheethint dim">▓ ${hidden} region${hidden === 1 ? '' : 's'} uncharted</div>` : ''}
    <div class="scrollmore">▼</div>
  </div></div>`;
}

// the two are-you-sure dialogs before anyone is lost forever
function cutConfirmHtml(s: GameState): string {
  if (!cutConfirm || selSlots === null) return '';
  const byId = new Map(s.selectPool.map((p) => [p.id, p]));
  const cut = selSlots.slice(9).map((id) => byId.get(id)).filter((p): p is Player => !!p);
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE CUT</span>
    <p>${cut.length ? `${cut.map((p) => `<b>${esc(p.name)}</b>`).join(', ')} will be released. These players will be <b>lost to you forever</b>. Are you sure?` : 'Confirm this squad?'}</p>
    <button class="wide hold danger" data-action="confirm-roster">✂ CONFIRM${cut.length ? ` — CUT ${cut.length}` : ''}</button>
    <button class="wide" data-action="cut-confirm-close">GO BACK</button>
  </div></div>`;
}

function boardConfirmHtml(s: GameState): string {
  if (!boardConfirm || !s.pendingRecruits.length) return '';
  const names = s.pendingRecruits.map((p) => `<b>${esc(p.name)}</b>`).join(', ');
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE BOARD</span>
    <p>${names} ${s.pendingRecruits.length === 1 ? 'walks' : 'walk'} away now. Whoever leaves the board is <b>lost to you forever</b>. Are you sure?</p>
    <button class="wide hold danger" data-action="board-confirm-do">✕ LET ${s.pendingRecruits.length === 1 ? 'THIS ONE' : 'THEM'} GO</button>
    <button class="wide" data-action="board-confirm-close">GO BACK</button>
  </div></div>`;
}

// THE RESULT: everything darkens except the energy bar, the spent ⚡ blasts
// away one cell at a time, then the typewriter says what happened.
function gxResultHtml(s: GameState): string {
  if (!gxResult) return '';
  const t = myTeam(s);
  // a search is a saucer trip: it flies out first; the verdict scene lands
  // when the report finishes typing (postRender swaps it)
  const scene = gxResult.art
    ? `<div class="scenebox" id="gxscene">${sceneHtml('saucer-move', { bg: t.bg, fg: t.fg }, 3)}</div>`
    : '';
  return `<div class="modalback gxback" data-action="gx-result-tap"><div class="modal gxmodal">
    <span class="tag">THE TRAIL</span>
    ${scene}
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div></div>`;
}

function itemModalHtml(s: GameState): string {
  if (!itemUi) return '';
  const item = itemById(itemUi);
  const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
  const ev = currentStory(s);
  const storyKey = ev?.choices?.find((c) => c.itemId === item.id && !ev.resolvedText)?.key ?? null;
  const phaseOk = !ev && ['practice', 'matchup', 'galaxy'].includes(s.phase) && itemAllowedNow(s, item.id);
  const needsDrag = item.target === 'player' && storyKey === null && phaseOk;
  const usable = !spent && !needsDrag && (storyKey !== null || phaseOk);
  return `<div class="modalback" data-action="item-close"><div class="modal">
    <div class="itemcard ${item.rarity}">
      <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
      <i class="dim">${esc(item.flavor)}</i><br/>
      ${esc(item.effectText)}<br/>${oddsLine(item.up, item.down)}
    </div>
    <button class="wide hold" data-action="use-item" data-id="${item.id}" ${usable ? '' : 'disabled'}>
      ${spent ? 'USED THIS SEASON' : storyKey ? '◆ USE IT ON THIS STORY' : needsDrag ? '↷ DRAG IT ONTO A PLAYER' : usable ? 'USE NOW' : 'NOT THE MOMENT'}</button>
    <button class="wide" data-action="item-close">CLOSE</button>
  </div></div>`;
}

function coachModalHtml(s: GameState): string {
  if (!coachOpen) return '';
  const drills = DRILLS.map((d) =>
    s.unlockedDrills.includes(d.id) ? `<div>✓ ${d.name}</div>` : `<div class="dim">▓▓▓ undiscovered</div>`
  ).join('');
  const regions = GALAXY_ACTS.filter((a) => a.kind === 'search').map((r) =>
    s.unlockedRegions.includes(r.id) ? `<div>✓ ${r.name}</div>` : `<div class="dim">▓▓▓ uncharted</div>`
  ).join('');
  const tactics = PLANS.map((pl) =>
    s.knownPlans.includes(pl.id) ? `<div>✓ ${pl.name} <span class="dim">(${ATTR_LABEL[pl.attr]})</span></div>` : `<div class="dim">▓▓▓ unlearned speech</div>`
  ).join('');
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE COACH</span>
    <div class="report">LEGACY <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b>
      · ${s.trophies}🏆 · ${s.utTitles} UT · ${s.totalWins}W · season ${s.season}${s.season >= 20 ? ' <span class="blink">— you feel the years</span>' : ''}</div>
    <div class="report"><b>KNOWLEDGE</b>${tactics}${drills}${regions}</div>
    <button class="wide" data-action="toggle-tips">ASSISTANT AUTO-TIPS: ${s.tipsAuto ? 'ON' : 'OFF'}</button>
    <p class="dim">GALACTIC COACH ${VERSION}</p>
    <button class="wide danger hold" data-action="new-game">NEW GAME (wipes this save)</button>
    <button class="wide" data-action="coach-close">CLOSE</button>
  </div></div>`;
}

function toastModalHtml(): string {
  if (!toast) return '';
  return `<div class="modalback"><div class="modal" data-action="toast-tap">
    <span class="tag">OUTCOME</span>
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap to continue</div></div>
  </div></div>`;
}

// ---- render ------------------------------------------------------------------------------------------------

function render(): void {
  if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
  stopType();
  setRamp();

  // a fresh week: pickers fall back to the FREE option (spending ⚡ takes a
  // deliberate trip into the menu) and old sticker batches are forgotten
  const wk = `${state.season}:${state.week}`;
  if (wk !== uiWeekKey) {
    uiWeekKey = wk;
    selectedDrill = 'rest';
    selGalaxy = 'reccenter';
    selSpeech = null;
    stickerBatches.clear();
  }

  const ev = currentStory(state);
  if (ev && ev.uid !== storyUid) {
    storyUid = ev.uid;
    stageTyped = false;
    impact = null;
    impactPlayed = false;
    heatShift = null;
    jobAnimDone = false;
    chosenWant = null;
    if (ev.resolvedText) {
      storyMode = splitBeats(ev.resolvedText).length > 1 ? 'r-antic' : 'r-reveal';
    } else {
      storyMode = splitBeats(ev.text).length > 1 ? 'antic' : 'reveal';
    }
  }

  let middle: string;
  const takeover = ev !== null && state.phase !== 'pickTeam' && state.phase !== 'gameover';
  if (state.phase === 'pickTeam') middle = stagePickTeam(state);
  else if (state.phase === 'gameover') middle = stageGameover(state);
  else if (takeover) middle = storyPanel(state);
  else {
    switch (state.phase) {
      case 'teamSelect': middle = stageTeamSelect(state); break;
      case 'weekstart': middle = stageWeekstart(state); break;
      case 'practice': middle = stagePractice(state); break;
      case 'galaxy': middle = stageGalaxy(state); break;
      case 'matchup': middle = stageMatchup(state); break;
      case 'gamenight': middle = stageGamenight(state); break;
      case 'departures': middle = stageDepartures(state); break;
      case 'signing': middle = stageSigning(state); break;
      default: middle = `<h2>THIS WEEK</h2>`;
    }
  }

  // popups live INSIDE the middle: the stats bar, THE BAG and the nav stay
  // visible (⚡ readable while a story asks you to spend it) — the nav just dims.
  const overlays = drillSheetHtml(state) + galaxySheetHtml(state) + speechSheetHtml(state) + gxResultHtml(state) + cutConfirmHtml(state) + boardConfirmHtml(state) + toastModalHtml() + itemModalHtml(state) + coachModalHtml(state);
  const modalOpen = drillSheet || speechSheet || coachOpen || itemUi !== null || toast !== null || galaxySheet || gxResult !== null || cutConfirm || boardConfirm;
  const navHtml = `<div class="navbar ${modalOpen ? 'dimmed' : ''}">${nav(state)}</div>`;
  const lensHtml = (state.phase === 'practice' || state.phase === 'galaxy' || state.phase === 'teamSelect') && !ev
    ? lensBar(state.phase === 'galaxy' ? PROSPECT_LENS_NAMES : LENS_NAMES)
    : '';
  const frame = state.phase === 'pickTeam' || state.phase === 'gameover'
    ? `<div class="midwrap"><div class="middle solo">${middle}</div>${overlays}</div>${navHtml}`
    : `${headerHtml(state)}<div class="midwrap"><div class="middle">${middle}</div>${overlays}</div>${bagBar(state)}${lensHtml}${navHtml}`;

  // THE ANIMATION BUILD: a screen CHANGE builds in stages — title first (you
  // know where you are), content next, the action button last (you know where
  // to go). Re-renders of the same screen appear instantly, nothing dances.
  const screenKey = takeover ? 'story' : `${state.phase}|${gnStage}`;
  const doBuild = screenKey !== builtKey;
  builtKey = screenKey;
  app.className = doBuild
    ? state.phase === 'gamenight' && gnStage === 'half' ? 'build build-half' : 'build'
    : '';

  app.innerHTML = frame;
  postRender();
}

function revealActions(): void {
  document.getElementById('modal-actions')?.classList.remove('hide');
}

// ---- THE NUMBER CASCADE ---------------------------------------------------------
// Results must be SEEN: whenever the ropes move (a drag-swap, a drill, a
// landed speech) the freshly rendered POST values get wound back to the PRE
// snapshot, then counted and swept forward row by row — OVERALL last and
// loudest, each number pulling the eye.

let cascArmed: 'bars' | 'speech' | null = null;

function clearCascTimers(): void {
  for (const tm of cascTimers) { clearTimeout(tm); clearInterval(tm); }
  cascTimers = [];
}

/** Snapshot the currently rendered team bars (call BEFORE the change). */
function captureBars(): void {
  const rows = [...document.querySelectorAll('.tbars .tbar')] as HTMLElement[];
  barsPre = rows.length
    ? rows.map((row) => ({
        vals: ([...row.querySelectorAll('.tbv')] as HTMLElement[]).map((el) => el.textContent ?? ''),
        fills: [([...row.querySelectorAll('.tbfill, .tbopp')] as HTMLElement[]).map((el) => el.style.width)],
      }))
    : null;
}

function cascadeBars(): void {
  const pre = barsPre;
  barsPre = null;
  if (!pre) return;
  const rows = [...document.querySelectorAll('.tbars .tbar')] as HTMLElement[];
  if (!rows.length) return;
  const posts = rows.map((row, i) => {
    const vEls = [...row.querySelectorAll('.tbv')] as HTMLElement[];
    const fEls = [...row.querySelectorAll('.tbfill, .tbopp')] as HTMLElement[];
    const post = { vals: vEls.map((el) => el.textContent ?? ''), fills: fEls.map((el) => el.style.width) };
    const p = pre[i];
    const preFills = p?.fills[0] ?? [];
    const moved = !!p && p.vals.length === post.vals.length && preFills.length === post.fills.length
      && (p.vals.join() !== post.vals.join() || preFills.join() !== post.fills.join());
    if (moved) {
      // wind back synchronously (pre-paint) — the change must never land silently
      vEls.forEach((el, j) => { el.textContent = p.vals[j]; });
      fEls.forEach((el, j) => { el.style.transition = 'none'; el.style.width = preFills[j]; });
    }
    return { row, vEls, fEls, post, p, preFills, moved };
  });
  const changed = posts.filter((x) => x.moved);
  if (!changed.length) return;
  changed.forEach((c, ix) => {
    const isBig = c.row.classList.contains('big');
    const at = 220 + ix * 240 + (isBig ? 260 : 0);
    cascTimers.push(window.setTimeout(() => {
      c.row.classList.add(isBig ? 'cascbig' : 'cascflash');
      c.fEls.forEach((el, j) => { el.style.transition = ''; el.style.width = c.post.fills[j]; });
      c.vEls.forEach((el, j) => {
        const from = parseInt(c.p!.vals[j], 10);
        const to = parseInt(c.post.vals[j], 10);
        if (isNaN(from) || isNaN(to) || from === to) { el.textContent = c.post.vals[j]; return; }
        const steps = 10;
        let st = 0;
        const iv = window.setInterval(() => {
          st++;
          el.textContent = String(Math.round(from + (to - from) * (st / steps)));
          if (st >= steps) clearInterval(iv);
        }, 42);
        cascTimers.push(iv);
      });
      cascTimers.push(window.setTimeout(() => c.row.classList.remove('cascflash', 'cascbig'), 950));
    }, at));
  });
}

/** A landed speech: the ignition pops on every floor card, THEN the attribute
    bar climbs, THEN OVERALL — the full chain, quite extreme on purpose. */
function runSpeechCascade(): void {
  const casc = speechCasc;
  speechCasc = null;
  if (!casc) { cascadeBars(); return; }
  const t = myTeam(state);
  const floor = t.lineup.slots.slice(0, 6).filter((x): x is number => x !== null);
  floor.forEach((pid, i) => {
    cascTimers.push(window.setTimeout(() => {
      const card = document.querySelector(`.pcard[data-pid="${pid}"]`);
      if (!card) return;
      const el = document.createElement('div');
      el.className = 'stickers anch-ovr';
      el.innerHTML = `<div class="sticker">+${casc.amt} ${ATTR_SHORT[casc.attr]}</div>`;
      card.appendChild(el);
    }, 140 + i * 150));
  });
  cascTimers.push(window.setTimeout(() => cascadeBars(), 140 + floor.length * 150 + 260));
}

// ---- rope → dial: PLAY grows the OVERALL rope into the game dial ---------------

function flipRope(): boolean {
  const from = ropeFrom;
  ropeFrom = null;
  if (!from) return false;
  const rope = document.querySelector('.bigrope') as HTMLElement | null;
  if (!rope) return false;
  const to = rope.getBoundingClientRect();
  if (!to.width || !to.height) return false;
  rope.style.transformOrigin = '0 0';
  rope.style.transition = 'none';
  rope.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${Math.max(0.15, from.height / to.height)})`;
  void rope.offsetWidth;
  rope.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.25,1)';
  rope.style.transform = 'none';
  return true;
}

function currentBeatText(ev: { text: string; resolvedText?: string }): string | null {
  const beats = splitBeats(ev.text);
  const rBeats = splitBeats(ev.resolvedText ?? '');
  switch (storyMode) {
    case 'antic': return beats[0] ?? '';
    case 'reveal': return beats.length > 1 ? beats[1] : beats[0] ?? '';
    case 'r-antic': return rBeats[0] ?? '';
    case 'r-reveal': return rBeats.length > 1 ? rBeats[1] : rBeats[0] ?? '';
    default: return null;
  }
}

function postRender(): void {
  if (gxResult && !gxResult.played) {
    gxResult.played = true;
    const r = gxResult;
    floatEnergyBig(r.cost);
    const box0 = document.getElementById('typebox');
    floatTimers.push(window.setTimeout(() => {
      if (gxResult === r) typewrite(box0 as HTMLElement | null, r.text, () => {
        revealActions();
        // the saucer lands its verdict scene as the report finishes
        if (r.art && r.art !== 'saucer-move') {
          const el = document.getElementById('gxscene');
          const t = myTeam(state);
          if (el) el.innerHTML = sceneHtml(r.art as SceneId, { bg: t.bg, fg: t.fg }, 3);
        }
      });
    }, r.cost * 300 + 350));
    return;
  }
  const ev = currentStory(state);
  const box = document.getElementById('typebox');
  const overlayText = toast;
  if (box && overlayText !== undefined && overlayText !== null) {
    typewrite(box, overlayText, revealActions);
  } else if (ev) {
    const text = box ? currentBeatText(ev) : null;
    if (box && text !== null) {
      typewrite(box, text, () => {
        stageTyped = true;
        // the verdict is out and a decision is waiting — bring it up
        if (storyMode === 'reveal' && ev.choices && !ev.resolvedText) {
          storyMode = 'choices';
          render();
        } else {
          revealActions();
        }
      });
    }
    if (storyMode === 'impact' && !impactPlayed) animateImpact();
    // THE HOT SEAT moves like the energy blast: everything else dims and the
    // job-security darkness visibly eats (or gives back) its ground
    if (storyMode === 'impact' && heatShift && (heatShift.dS !== 0 || heatShift.dB !== 0) && !jobAnimDone) {
      jobAnimDone = true;
      const l = document.querySelector('.jobbar .jdark.l') as HTMLElement | null;
      const rr = document.querySelector('.jobbar .jdark.r') as HTMLElement | null;
      if (l && rr) {
        l.style.transition = 'none';
        rr.style.transition = 'none';
        l.style.width = `${state.heatS - heatShift.dS}%`;
        rr.style.width = `${state.heatB - heatShift.dB}%`;
        void l.offsetWidth; // reflow so the transition sees the old widths
        impactTimers.push(window.setTimeout(() => {
          l.style.transition = 'width 1.1s ease';
          rr.style.transition = 'width 1.1s ease';
          l.style.width = `${state.heatS}%`;
          rr.style.width = `${state.heatB}%`;
        }, 500));
      }
    }
  }

  if (state.phase === 'gamenight' && !state.queue.length) {
    const ht = state.halftime;
    const r = state.lastResult;
    if ((gnStage === 'beat' && ht && !r) || ((gnStage === 'beat' || gnStage === 'beat2') && r)) {
      // the OVERALL rope GROWS into the game dial, then the needle sweeps
      const flipped = flipRope();
      const go = (): void => {
        if (gnStage === 'beat' && state.halftime && !state.lastResult) {
          animateNeedle(state.halftime.needle, state.halftime.home, () => { gnStage = 'half'; render(); });
        } else if (state.lastResult) {
          const rr = state.lastResult;
          animateNeedle((rr.h2 ?? rr).needle, rr.home, () => { gnStage = 'verdict'; render(); });
        }
      };
      if (flipped) floatTimers.push(window.setTimeout(go, 650));
      else go();
    }
  }

  // THE NUMBER CASCADE fires once the screen is quiet (no overlay on top)
  if (cascArmed && !gxResult && !toast && !currentStory(state)) {
    const kind = cascArmed;
    cascArmed = null;
    clearCascTimers();
    if (kind === 'speech') runSpeechCascade();
    else cascadeBars();
  }

  // picker sheets that overflow SHOW they scroll (fade edge + ▼, until read)
  document.querySelectorAll('.modal.scrolly').forEach((m) => {
    const el = m as HTMLElement;
    const update = (): void => {
      const can = el.scrollHeight > el.clientHeight + 6;
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 14;
      el.classList.toggle('canscroll', can && !atEnd);
    };
    update();
    el.addEventListener('scroll', update);
  });
}

function animateNeedle(needlePos: number, home: boolean, onDone: () => void): void {
  const el = document.getElementById('needle');
  if (!el) return;
  const target = (home ? 1 - needlePos : needlePos) * 100; // away-left display
  const SWEEP_MS = 1500;
  const LAND_MS = 900;
  const start = performance.now();
  let landFrom = 50;
  const finish = (): void => {
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    onDone();
    // deltas land as STICKERS on the cards (rendered by gridHtml) and stay
  };
  progressTimer = window.setInterval(() => {
    const t = performance.now() - start;
    if (t < SWEEP_MS) {
      // full-width ping-pong sweeps, slowing down
      const phase = (t / SWEEP_MS) * 2.4;
      const tri = Math.abs(((phase * 2) % 2) - 1); // 0..1..0
      landFrom = tri * 100;
      el.style.left = `${landFrom}%`;
    } else if (t < SWEEP_MS + LAND_MS) {
      // decelerate into the landing spot with a damped wobble
      const x = (t - SWEEP_MS) / LAND_MS;
      const ease = 1 - Math.pow(1 - x, 3);
      const wobble = Math.exp(-4 * x) * Math.sin(x * 14) * 6;
      el.style.left = `${landFrom + (target - landFrom) * ease + wobble * (1 - x)}%`;
    } else {
      el.style.left = `${target}%`;
      el.classList.add('landed');
      if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
      window.setTimeout(finish, 550);
    }
  }, 16);
  document.getElementById('needle-stage')?.addEventListener('click', () => {
    el.style.left = `${target}%`;
    el.classList.add('landed');
    finish();
  });
}

// ---- hold-to-commit -----------------------------------------------------------------------------------------

let holdEl: HTMLElement | null = null;
let holdTimer = 0;

function startHold(el: HTMLElement): void {
  cancelHold();
  holdEl = el;
  el.classList.add('holding');
  holdTimer = window.setTimeout(() => {
    el.classList.remove('holding');
    const a = el.getAttribute('data-action')!;
    const id = el.getAttribute('data-id') ?? '';
    holdEl = null;
    executeAction(a, id);
    render();
  }, 800);
}

function cancelHold(showHint = false): void {
  if (!holdEl) return;
  clearTimeout(holdTimer);
  holdEl.classList.remove('holding');
  if (showHint) {
    holdEl.classList.add('wiggle');
    const el = holdEl;
    setTimeout(() => el.classList.remove('wiggle'), 500);
  }
  holdEl = null;
}

document.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest('button.hold') as HTMLElement | null;
  if (el && !el.hasAttribute('disabled')) startHold(el);
});
document.addEventListener('pointerup', (e) => {
  if (holdEl) {
    const el = (e.target as HTMLElement).closest('button.hold');
    cancelHold(el === holdEl);
  }
});
document.addEventListener('pointercancel', () => cancelHold());

// ---- drag: lineup cards AND bag items -------------------------------------------------------------------------

interface PtrDrag {
  pointerId: number;
  kind: 'card' | 'item' | 'pr';
  pid: number;
  itemId: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  holdTimer: number;
  ghost: HTMLElement | null;
}
let ptr: PtrDrag | null = null;
let suppressClick = false;

function gridDraggablePhase(): boolean {
  return ['practice', 'matchup', 'gamenight', 'teamSelect', 'galaxy'].includes(state.phase) && !currentStory(state);
}

function handleDrop(zoneIdx: number, playerId: number): void {
  // lineup changes must move the stats BOLDLY: snapshot the bars, the render
  // after the swap winds back and counts forward (THE NUMBER CASCADE)
  if (['matchup', 'gamenight', 'practice'].includes(state.phase)) {
    captureBars();
    cascArmed = 'bars';
  }
  // the selection grid: swap any two of the 12 slots (the CUT row included)
  if (state.phase === 'teamSelect') {
    if (!selSlots) return;
    const from = selSlots.indexOf(playerId);
    if (from < 0 || from === zoneIdx || zoneIdx >= selSlots.length) return;
    const tmp = selSlots[zoneIdx];
    selSlots[zoneIdx] = playerId;
    selSlots[from] = tmp;
    return;
  }
  const t = myTeam(state);
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.outWeeks > 0) return;
  const from = t.lineup.slots.indexOf(playerId);
  if (from < 0 || from === zoneIdx) return;
  // halftime: reserves are locked — swaps live between starters and bench only
  if (state.phase === 'gamenight' && gnStage === 'half' && (from >= 6 || zoneIdx >= 6)) return;
  const occupant = t.lineup.slots[zoneIdx];
  t.lineup.slots[zoneIdx] = playerId;
  t.lineup.slots[from] = occupant;
  // unavailable players sink back down their column
  for (let c = 0; c < 3; c++) {
    const idxs = [c, c + 3, c + 6];
    const members = idxs.map((i) => (t.lineup.slots[i] !== null ? t.players.find((x) => x.id === t.lineup.slots[i]) ?? null : null));
    const up = members.filter((x): x is Player => !!x && x.outWeeks === 0);
    const down = members.filter((x): x is Player => !!x && x.outWeeks > 0);
    const ordered = [...up, ...down];
    idxs.forEach((i, r) => { t.lineup.slots[i] = ordered[r]?.id ?? null; });
  }
  save(state);
}

/** The recruiting board swap: prospect between the board and the 4th row. */
function handleProspectDrop(zoneIdx: number, prospectId: number): void {
  const boardIdx = state.prospects.findIndex((x) => x.id === prospectId);
  const pendIdx = state.pendingRecruits.findIndex((x) => x.id === prospectId);
  const from = boardIdx >= 0 ? boardIdx : pendIdx >= 0 ? 9 + pendIdx : -1;
  if (from < 0 || from === zoneIdx) return;
  swapBoardSlot(state, from, zoneIdx);
}

function dropItemOnStory(itemId: string): void {
  const ev = currentStory(state);
  const key = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
  if (!key) return;
  doResolve(key);
}

/** A player item dragged onto a card: the individual action lands there. */
function dropItemOnPlayer(itemId: string, playerId: number): void {
  const text = useItem(state, itemId, { playerId });
  if (text) toast = text;
}

function activateDrag(): void {
  if (!ptr || ptr.active) return;
  ptr.active = true;
  const rect = ptr.el.getBoundingClientRect();
  const ghost = ptr.el.cloneNode(true) as HTMLElement;
  ghost.classList.add('dragghost');
  ghost.style.width = `${rect.width}px`;
  document.body.appendChild(ghost);
  ptr.ghost = ghost;
  ptr.el.classList.add('draglift');
  moveGhost();
}

function moveGhost(): void {
  if (!ptr?.ghost) return;
  ptr.ghost.style.left = `${ptr.lastX - ptr.ghost.offsetWidth / 2}px`;
  ptr.ghost.style.top = `${ptr.lastY - 46}px`;
  document.querySelectorAll('.dropzone.dragover, .storypanel.dragover, .pcard.dragover').forEach((z) => z.classList.remove('dragover'));
  targetAtPoint()?.classList.add('dragover');
}

function targetAtPoint(): Element | null {
  if (!ptr) return null;
  const el = document.elementFromPoint(ptr.lastX, ptr.lastY);
  if (!el) return null;
  if (ptr.kind === 'item') {
    if (currentStory(state)) return el.closest('.storypanel');
    // a player item lands on a squad card
    const card = el.closest('.pcard[data-pid]');
    if (card && card.getAttribute('data-kind') !== 'pr') return card;
    return null;
  }
  const zone = el.closest('.dropzone');
  // halftime: the reserve row takes no drops — it never lights up either
  if (zone && state.phase === 'gamenight' && gnStage === 'half' && Number(zone.getAttribute('data-zone')) >= 6) return null;
  return zone;
}

function endDrag(drop: boolean): void {
  if (!ptr) return;
  clearTimeout(ptr.holdTimer);
  if (ptr.active) {
    const target = drop ? targetAtPoint() : null;
    ptr.ghost?.remove();
    ptr.el.classList.remove('draglift');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    document.querySelectorAll('.dropzone.dragover, .storypanel.dragover, .pcard.dragover').forEach((z) => z.classList.remove('dragover'));
    if (target) {
      if (ptr.kind === 'card') handleDrop(Number(target.getAttribute('data-zone')), ptr.pid);
      else if (ptr.kind === 'pr') handleProspectDrop(Number(target.getAttribute('data-zone')), ptr.pid);
      else if (currentStory(state)) dropItemOnStory(ptr.itemId);
      else dropItemOnPlayer(ptr.itemId, Number(target.getAttribute('data-pid')));
      ptr = null;
      render();
      return;
    }
  }
  ptr = null;
}

app.addEventListener('pointerdown', (e) => {
  const bag = (e.target as HTMLElement).closest('.bslot.filled') as HTMLElement | null;
  if (bag) {
    const itemId = bag.getAttribute('data-bagitem')!;
    const playerDrag = itemById(itemId).target === 'player' && itemAllowedNow(state, itemId)
      && ['practice', 'matchup', 'gamenight'].includes(state.phase) && !currentStory(state);
    if (currentStory(state) || playerDrag) {
      ptr = {
        pointerId: e.pointerId, kind: 'item', pid: -1, itemId, el: bag,
        startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
        active: false, holdTimer: 0, ghost: null,
      };
      if (e.pointerType === 'touch') ptr.holdTimer = window.setTimeout(() => activateDrag(), 220);
      return;
    }
    return;
  }
  if (!gridDraggablePhase()) return;
  const card = (e.target as HTMLElement).closest('.pcard.grabbable') as HTMLElement | null;
  if (!card) return;
  ptr = {
    pointerId: e.pointerId,
    kind: card.getAttribute('data-kind') === 'pr' ? 'pr' : 'card',
    pid: Number(card.getAttribute('data-pid')),
    itemId: '',
    el: card,
    startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
    active: false, holdTimer: 0, ghost: null,
  };
  if (e.pointerType === 'touch') ptr.holdTimer = window.setTimeout(() => activateDrag(), 250);
});
document.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.pointerId) return;
  ptr.lastX = e.clientX;
  ptr.lastY = e.clientY;
  const dist = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);
  if (!ptr.active) {
    // any real movement starts the drag — no hold required, no cancel path
    if (dist > 6) activateDrag();
    return;
  }
  moveGhost();
});
document.addEventListener('pointerup', (e) => {
  if (ptr && e.pointerId === ptr.pointerId) endDrag(true);
});
document.addEventListener('pointercancel', () => endDrag(false));

// (lens switching is tabs-only — a swipe gesture fought the card drag)
document.addEventListener('touchmove', (e) => { if (ptr?.active) e.preventDefault(); }, { passive: false });

// ---- actions ----------------------------------------------------------------------------------------------------

const PHASE_TIP: Record<string, string> = {
  teamSelect: 'tryouts',
  stories: 'stories',
  practice: 'practice',
  galaxy: 'galaxy',
  matchup: 'matchup',
  gamenight: 'gamenight',
  departures: 'departures',
  signing: 'signing',
  growth: 'departures',
};

function executeAction(action: string, id: string): void {
  switch (action) {
    case 'pick-team': chooseTeam(state, Number(id)); break;

    case 'story-choice':
      doResolve(id);
      break;

    case 'drill-run': {
      const d = DRILLS.find((x) => x.id === selectedDrill)!;
      captureBars();
      const out = runDrill(state, selectedDrill);
      if (out) {
        stickDrill(out, d.cost);
        cascArmed = 'bars';
      }
      break;
    }

    case 'begin-week': beginWeek(state); break;
    case 'to-galaxy': drillSheet = false; drillStickers = null; toGalaxy(state); break;
    case 'to-matchup': galaxySheet = false; gxStickers = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'gn-table': gnStage = 'table'; clearFloatTimers(); break;
    case 'continue-result': gnStage = 'beat'; clearFloatTimers(); drillStickers = null; gxStickers = null; continueFromResult(state); break;

    case 'gx-run': {
      const act = galaxyActById(selGalaxy);
      const out = actionGalaxy(state, selGalaxy);
      if (out) {
        if (out.perProspect.size) gxStickers = out.perProspect;
        gxResult = { text: out.text, cost: act.cost, played: false, art: out.art };
      }
      break;
    }

    case 'cut-confirm-open': cutConfirm = true; break;
    case 'board-confirm-open': boardConfirm = true; break;
    case 'gx-pick': selGalaxy = id; galaxySheet = false; break;
    case 'drill-pick': selectedDrill = id; drillSheet = false; break;
    case 'speech-pick': selSpeech = id as PlanId; speechSheet = false; break;
    case 'board-confirm-do': {
      const gone = confirmBoard(state);
      boardConfirm = false;
      if (gone.length) toast = `${gone.join(' and ')} walk${gone.length === 1 ? 's' : ''} out of the story. The galaxy is big; you will not find ${gone.length === 1 ? 'them' : 'them'} again.`;
      break;
    }
    case 'noop': break;

    case 'speech-run': {
      const sel = speechSel(state);
      captureBars();
      const half = state.phase === 'gamenight';
      const text = half ? deliverHalftimeSpeech(state, sel) : deliverSpeech(state, sel);
      if (text) {
        toast = text;
        const fx = half ? state.speechFxH2 : state.speechFx;
        if (fx) {
          // the ignition cascades once the toast closes: cards → bar → OVERALL
          speechCasc = { attr: fx.attr, amt: fx.amt };
          cascArmed = 'speech';
        } else {
          barsPre = null;
        }
      }
      break;
    }
    case 'play-game':
      gnStage = 'beat';
      clearFloatTimers();
      ropeFrom = (document.querySelector('.tbars.mu .tbar.big .tbtrack') as HTMLElement | null)?.getBoundingClientRect() ?? null;
      playGame(state);
      break;
    case 'play-h2':
      gnStage = 'beat2';
      clearFloatTimers();
      ropeFrom = (document.querySelector('.tbars.mu .tbar.big .tbtrack') as HTMLElement | null)?.getBoundingClientRect() ?? null;
      playSecondHalf(state);
      break;

    case 'convince-pro': convincePro(state, Number(id)); break;
    case 'letgo-pro': letGoPro(state, Number(id)); break;
    case 'retire': retire(state); break;
    case 'do-signing': selSlots = null; resolveSigning(state); break;
    case 'confirm-roster':
      if (selSlots && finalizeRoster(state, selSlots.slice(0, 9))) {
        selSlots = null;
        cutConfirm = false;
      }
      break;

    case 'use-item': {
      const itemId = id;
      const ev = currentStory(state);
      const storyKey = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
      itemUi = null;
      if (storyKey) {
        doResolve(storyKey);
      } else {
        const text = useItem(state, itemId, {});
        if (text) toast = text;
      }
      break;
    }
    case 'new-game':
    case 'new-game-direct':
      wipeSave();
      state = freshGame();
      lens = 0;
      coachOpen = false;
      itemUi = null;
      toast = null;
      galaxySheet = false;
      selGalaxy = 'reccenter';
      selectedDrill = 'rest';
      selSlots = null;
      cutConfirm = false;
      boardConfirm = false;
      drillSheet = false;
      break;
  }
}

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action')!;
  const id = el.getAttribute('data-id') ?? '';
  if (el.classList.contains('hold')) return;

  switch (action) {
    case 'story-tap': {
      const ev = currentStory(state);
      if (!ev) break;
      if (storyMode === 'impact') {
        if (!impactPlayed) { finishImpactNow(); return; } // first tap: land everything
        clearFloatTimers();
        clearImpactTimers();
        impact = null;
        dismissStory(state);
        storyUid = -1;
        break;
      }
      if (finishTypeNow()) return; // finish the current beat instantly
      if (!stageTyped || storyMode === 'choices') return;
      if (storyMode === 'antic') { storyMode = 'reveal'; stageTyped = false; break; }
      if (storyMode === 'r-antic') { storyMode = 'r-reveal'; stageTyped = false; break; }
      if (storyMode === 'r-reveal') {
        if (impact && impact.rows.length) { storyMode = 'impact'; impactPlayed = false; break; }
        impact = null;
        dismissStory(state);
        storyUid = -1;
        break;
      }
      // 'reveal' with no pending choices: tap-through story resolves now
      doResolve('ok');
      break;
    }

    case 'card':
      break;
    case 'gx-result-tap':
      if (finishTypeNow()) return;
      clearFloatTimers();
      gxResult = null;
      break;
    case 'gx-sheet': galaxySheet = true; break;
    case 'gx-sheet-close': if (e.target === el) galaxySheet = false; break;
    case 'cut-confirm-close': cutConfirm = false; break;
    case 'board-confirm-close': boardConfirm = false; break;
    case 'speech-sheet': speechSheet = true; break;
    case 'speech-sheet-close': if (e.target === el) speechSheet = false; break;
    case 'toast-tap':
      if (finishTypeNow()) return;
      toast = null;
      break;

    case 'lens-set': lens = (Number(id) % 3) as Lens; break;

    case 'drill-sheet': drillSheet = true; break;
    case 'drill-sheet-close': if (e.target === el) drillSheet = false; break;

    case 'bag-item': itemUi = id; break;
    case 'item-close': itemUi = null; break;
    case 'coach-open': coachOpen = true; break;
    case 'coach-close': coachOpen = false; break;
    case 'toggle-tips': toggleTips(state); break;
    case 'help': {
      const key = PHASE_TIP[state.phase];
      if (key) showTip(state, key);
      break;
    }

    case 'pursue': toggleProspect(state, Number(id)); break;

    default:
      executeAction(action, id);
      break;
  }
  render();
});

// dev handles (gcAction also powers the headless UI smoke test)
(window as unknown as { gcAction: (a: string, id: string) => void }).gcAction = (a, id) => {
  executeAction(a, id);
  render();
};
(window as unknown as { gc: unknown }).gc = {
  state: () => state,
  starters,
  story: (defId: string, beat: string, playerId: number | null, data?: Record<string, unknown>) => {
    queueStory(state, defId, beat, playerId, data ?? {});
    render();
  },
  ui: () => ({ storyMode, stageTyped, impact, impactPlayed }),
};

render();
