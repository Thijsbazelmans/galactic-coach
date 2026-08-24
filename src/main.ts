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
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, REGULAR_WEEKS, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, matchAttrs, slotMult, slotPlayer, winShare } from './engine/sim';
import {
  actionGalaxy,
  addNote,
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
  speechCooldown,
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
import { ATTRS, clamp, copyAttrs, genderize, ovr, perGame, potStars, rand } from './engine/util';
import { PRACTICE_KIT, energyBucket, figureHtml, iconOutlinedUrl, iconUrl, moodBucket, rigSpriteHtml, sceneHtml, skinTone, type FigureId, type FigureMood, type Kit, type RigView, type SceneId } from './rig';

const VERSION = 'v4.2';

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
/** header dialogs (blocked while a story is up — no cheating on Scoop) */
let schedOpen = false;
let standOpen = false;
let notebookOpen = false;
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

/** EVERY spent ⚡ blasts away over the energy bar — huge, one per cell. */
function floatEnergyBig(n: number): void {
  const bar = document.querySelector('.ebar');
  if (!bar || n <= 0) return;
  for (let i = 0; i < n; i++) {
    floatTimers.push(
      window.setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'efloat big';
        el.textContent = '-1¢';
        bar.appendChild(el);
        window.setTimeout(() => el.remove(), 900);
      }, i * 300)
    );
  }
}

/** Drill results blink IN PLACE on the cards (the change language): a
    pre-run snapshot diffs into per-card deltas — energy/mood gauge bands,
    the XP arc, LVL and OVR number swaps. Once seen, seen. */
let drillDeltas: Map<number, CardDelta> | null = null;
/** Board results (facet reveals, commit swings) cycle in the main spot; a
    commit swing also carries its old value for the ring's change language. */
let gxStickers: Map<number, { text: string; up?: boolean; commitFrom?: number }[]> | null = null;

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
  if (state.energy !== snap.energy) rows.push({ label: '¢ CREDITS', from: snap.energy, to: state.energy, up: state.energy > snap.energy });
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
  if (cost) parts.push(`<span class="cost">${cost}¢</span>`);
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

function ringCounter(
  pct: number,
  label: string,
  val: string,
  title = '',
  opts: { deltaFromPct?: number; lvlFrom?: number } = {}
): string {
  const clamped = clamp(Math.round(pct), 0, 100);
  // the change language on the ring: the added/removed arc blinks, and a
  // level change swaps the number old-dim ↔ new-bright
  const from = opts.deltaFromPct !== undefined ? clamp(Math.round(opts.deltaFromPct), 0, 100) : null;
  let seg = '';
  if (from !== null && from !== clamped) {
    const lo = Math.min(from, clamped);
    const hi = Math.max(from, clamped);
    seg = `<circle class="krdelta ${clamped >= from ? 'up' : 'down'}" cx="18" cy="18" r="15.9155" stroke-dasharray="${hi - lo} 100" stroke-dashoffset="${-lo}" style="animation-delay:-${wallPhase(SWAP_MS)}ms"/>`;
  }
  const valHtml = opts.lvlFrom !== undefined && String(opts.lvlFrom) !== val
    ? numSwap(opts.lvlFrom, val, 'var(--r95)', 'krnum')
    : `<b>${val}</b>`;
  return `<span class="kring" ${title ? `title="${title}"` : ''}>
    <svg viewBox="0 0 36 36">
      <circle class="krbg" cx="18" cy="18" r="15.9155"/>
      <circle class="krfill" cx="18" cy="18" r="15.9155" stroke-dasharray="${clamped} 100"/>
      ${seg}
    </svg>
    <span class="krtxt"><i>${label}</i>${valHtml}</span>
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

// ---- THE CHANGE LANGUAGE --------------------------------------------------------
// Most stickers are DEAD: a change animates IN PLACE instead. A changed
// number blinks old-dim ↔ new-bright; a changed gauge blinks its removed
// segment dimly / added segment brightly — one language everywhere (cards,
// rings, team bars). Everything blinks on the same wall clock, so
// re-renders never restart it.

function wallPhase(dur: number): number {
  return Math.round(performance.now()) % dur;
}

const SWAP_MS = 1400;

/** The change-direction law: UP blinks the new value BRIGHT, DOWN blinks it
    DARK (the old value shows the opposite weight). */
function numSwap(from: number | string, to: number | string, colorTo: string, cls = ''): string {
  const down = typeof from === 'number' && typeof to === 'number' && to < from;
  const d = `animation-delay:-${wallPhase(SWAP_MS)}ms`;
  const oldStyle = down ? `color:var(--r75);${d}` : d;
  const newStyle = down ? `color:var(--r35);${d}` : `color:${colorTo};${d}`;
  return `<span class="numswap ${cls} ${down ? 'nsdown' : ''}"><span class="ns-old" style="${oldStyle}">${from}</span><span class="ns-new" style="${newStyle}">${to}</span></span>`;
}

// ---- the two sticker spots that survive ----------------------------------------
// MAIN (under the name): box scores + things happening (+ MISCAST).
// HI (across the player, aligned with the gauge bottoms): MVP / STANDOUT /
// OFF DAY / TIRED. Two or more labels in one spot change out back to back.

interface SpotLabel { text: string; up?: boolean; blink?: boolean }

function spotHtml(spot: 'main' | 'hi', labels: SpotLabel[] | undefined, pop: boolean, popDelay = 0): string {
  if (!labels?.length) return '';
  const list = labels.slice(0, 3);
  const n = list.length;
  const dur = n * 1800;
  return `<div class="spot spot-${spot}">${list.map((l, i) => {
    const anim = n > 1
      ? `animation:cyc${n} ${dur}ms infinite;animation-delay:${i * 1800 - wallPhase(dur)}ms`
      : pop ? `animation-delay:${popDelay}ms` : '';
    return `<div class="sticker ${l.up === false ? 'down' : ''} ${l.blink ? 'blink' : ''} ${n > 1 ? 'cyc' : pop ? '' : 'landed'}" style="${anim}">${esc(l.text)}</div>`;
  }).join('')}</div>`;
}

/** What an action changed on one card — rendered as in-place blinks. */
interface CardDelta {
  e?: number; // energy delta (gauge band)
  m?: number; // mood delta (gauge band)
  xpFromPct?: number; // XP ring: the added/removed arc blinks
  xpProjPct?: number; // WEEK START: the ring shows the incoming payout
  lvlFrom?: number; // LVL number swap
  ovrFrom?: number; // OVERALL number swap
}

// ---- the edge gauges: curved LEDs hugging the ROSTER card -----------------------
// LEFT = ENERGY (bolt), RIGHT = MOOD (face) — 1/3 of the card wide at the
// top, CURVING down to ~1/8 at the bottom; the brightness gradient lives in
// the fill (bottom darker, top brighter); the icon follows the value and
// BLINKS below 25%. A delta band blinks removed-dim / added-bright.

function edgeGauge(side: 'l' | 'r', value: number, kind: 'boltx' | 'facex', pid: number, delta = 0): string {
  const v = clamp(Math.round(value), 0, 100);
  const old = clamp(Math.round(value - delta), 0, 100);
  const id = `gg${pid}${side}`;
  const shape = side === 'l'
    ? 'M0,0 L100,0 Q46,52 37.5,100 L0,100 Z'
    : 'M100,0 L0,0 Q54,52 62.5,100 L100,100 Z';
  const bright = vc(value);
  const dark = ramp(clamp(0.2 + 0.8 * (v / 100) - 0.3, 0.05, 1));
  const segs = [12.5, 25, 37.5, 50, 62.5, 75, 87.5]
    .map((y) => `<line x1="0" y1="${y}" x2="100" y2="${y}"/>`).join('');
  const lo = Math.min(v, old);
  const hi = Math.max(v, old);
  const band = delta !== 0 && hi > lo
    ? `<rect class="gband ${delta > 0 ? 'up' : 'down'}" x="0" y="${100 - hi}" width="100" height="${hi - lo}" clip-path="url(#${id})" style="animation-delay:-${wallPhase(SWAP_MS)}ms"/>`
    : '';
  return `<span class="gauge g${side}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id="${id}"><path d="${shape}"/></clipPath>
        <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${bright}"/>
        </linearGradient>
      </defs>
      <path class="gbg" d="${shape}"/>
      <rect class="gfill" x="0" y="${100 - v}" width="100" height="${v}" clip-path="url(#${id})" fill="url(#${id}f)"/>
      ${band}
      <g class="gsegs" clip-path="url(#${id})">${segs}</g>
    </svg>
    <img class="gicon ${v < 25 ? 'blink' : ''}" src="${iconOutlinedUrl(kind, bright)}" alt=""/>
  </span>`;
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
  /** what the action changed — blinks in place (gauges, ring, OVR) */
  delta?: CardDelta;
  /** MAIN spot labels (box score, things happening) — cycle when >1 */
  mainLabels?: SpotLabel[];
  /** HI spot labels (MVP / STANDOUT / OFF DAY / TIRED) — across the player */
  hiLabels?: SpotLabel[];
  /** pop the labels in (first render of a batch); afterwards they stand */
  labelPop?: boolean;
  popDelay?: number;
  /** matchup: the bare current-ability diamond behind the player */
  diamond?: boolean;
  tag?: string;
  /** extra class on the cardtag */
  tagCls?: string;
  inert?: boolean;
  draggable?: boolean;
  /** halftime: the reserves stayed in the locker room — greyed, unswappable */
  locked?: boolean;
  sitout?: boolean;
  miscast?: number; // % penalty — main label + the OVR blinks its real cost
  pick?: boolean; // selection screens
  /** THE SCOPE PREVIEW: this card is inside / outside a pending scoped action */
  scope?: 'in' | 'out';
}

/** The OVR corner: a small label above the number (mirrors the LVL ring).
    A changed number — or a miscast's effective number — blinks in place. */
function ovrBlock(p: Player, opts: { from?: number; miscast?: number } = {}): string {
  const o = ovr(p.attrs);
  const color = vc(o * 1.6);
  let num: string;
  if (opts.from !== undefined && opts.from !== o) num = numSwap(opts.from, o, color, 'kovr');
  else if (opts.miscast && opts.miscast >= 8) {
    const eff = Math.max(0, Math.round(o * (1 - opts.miscast / 100)));
    num = numSwap(o, eff, color, 'kovr');
  } else num = `<b class="kovr" style="color:${color}">${o}</b>`;
  return `<span class="ovrwrap"><i class="klab">OVR</i>${num}</span>`;
}

// The card, phone-first, one lens at a time. ROSTER: sprite centered, curved
// ENERGY/MOOD gauges hugging the edges (no compass), OVR bottom-left, XP ring
// (LVL inside) bottom-right — changes blink in place. STATS: the season box
// score. ABILITIES: the compass square, layered — dashes where the season
// started, outline where he can go, POT chip instead of the ring.
function playerCard(p: Player, opts: CardOpts = {}): string {
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const out = p.outWeeks > 0;
  const sprite = (scale: number, cls: string): string => rigSpriteHtml(rigView(p, opts.story), kit, scale, cls);
  const l = opts.lens ?? 0;
  const xpPct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  const nameHtml = `<span class="kname">${p.onFire ? '🔥 ' : ''}${esc(p.name)}</span>
      <span class="kyear">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>`;
  const d = opts.delta;
  const showMiscast = !!opts.miscast && opts.miscast >= 8 && !out && l === 0 && !opts.story;
  const ring = ringCounter(d?.xpProjPct ?? xpPct, 'LVL', String(p.level), `level ${p.level}/${LEVEL_CAP} · xp ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)}`, { deltaFromPct: d?.xpFromPct, lvlFrom: d?.lvlFrom });
  let body: string;
  if (opts.story && opts.storyView === 'abilities') {
    // growth stories act in front of the compass
    body = squareKite(p.attrs, {
      pot: p.pots,
      start: p.startAttrs,
      sprite: sprite(1.75, 'ksprite'),
      nameHtml,
      blHtml: ovrBlock(p),
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
      blHtml: ovrBlock(p),
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${vc(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
    });
  } else {
    // ROSTER — the default view, the compass gone: the sprite between two
    // curved edge gauges (⚡ left, mood right); on the matchup, the bare
    // current-ability diamond glows behind him
    body = `<div class="ksq roster">
      ${opts.diamond ? `<svg class="ksvg bare" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon class="k-cur" points="${kitePoints(p.attrs)}"/></svg>` : ''}
      ${sprite(1.75, 'ksprite')}
      <div class="ktop">${nameHtml}</div>
      ${edgeGauge('l', p.energy, 'boltx', p.id, d?.e ?? 0)}
      ${edgeGauge('r', p.mood, 'facex', p.id, d?.m ?? 0)}
      <span class="kbl">${ovrBlock(p, { from: d?.ovrFrom, miscast: showMiscast ? opts.miscast : 0 })}</span>
      <span class="kbr">${ring}</span>
    </div>`;
  }
  const mains: SpotLabel[] = [...(opts.mainLabels ?? [])];
  if (showMiscast) mains.push({ text: `MISCAST −${opts.miscast}%`, up: false });
  const his: SpotLabel[] = [...(opts.hiLabels ?? [])];
  if (opts.sitout && l === 0 && !opts.story) his.push({ text: 'SITS OUT', up: false });
  return `<div class="pcard lens${l} sq ${out ? 'pout' : ''} ${opts.locked ? 'hlock' : ''} ${opts.draggable && !out && !opts.locked && l === 0 ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    ${body}
    ${spotHtml('main', mains, opts.labelPop !== false, opts.popDelay ?? 0)}
    ${spotHtml('hi', his, opts.labelPop !== false, (opts.popDelay ?? 0) + 200)}
    ${out ? `<div class="ptag">OUT ${p.outWeeks}w</div>` : ''}
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
// free information — it prints at the BOTTOM of the STATS card, in their
// actual skin color. Reading «NIMBUS» there should quicken the pulse.
interface ProspectCardOpts {
  draggable?: boolean;
  dim?: boolean;
  scope?: 'in' | 'out';
  labelPop?: boolean;
  /** SIGNING DAY on the board: tap to pursue; the effective % labels the card */
  signing?: { selected: boolean; effPct?: number };
}

function prospectCard(pr: Prospect, l: Lens, opts: ProspectCardOpts = {}): string {
  const img = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite');
  const fuzz: 0 | 1 | 2 = pr.scoutLevel >= 4 ? 0 : pr.scoutLevel >= 2 ? 1 : 2;
  const sp = speciesById(pr.speciesId);
  const spCls = sp.rarity >= 3 ? 'sprare blink' : sp.rarity === 2 ? 'sprare' : '';
  const nameHtml = `<span class="kname">${esc(pr.name)}</span>`;
  // the COM ring speaks the change language: the swing blinks on the arc
  const commitFrom = gxStickers?.get(pr.id)?.find((st) => st.commitFrom !== undefined)?.commitFrom;
  const ring = ringCounter(pr.commitPct, 'COM', `${pr.commitPct}`, `commitment ${pr.commitPct}%`, { deltaFromPct: commitFrom });
  const imgDim = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite dimspr');
  // the rating unmasks digit by digit — ?? → 4? / ?7 → 47
  const mask = prospectMask(pr);
  const maskNum = pr.digits >= 2
    ? `<b class="kovr" style="color:${vc(ovr(pr.seenAttrs) * 1.6)}">${mask}</b>`
    : `<span class="kovr prq">${mask}</span>`;
  const maskHtml = `<span class="ovrwrap"><i class="klab">OVR</i>${maskNum}</span>`;
  let body: string;
  if (l === 1) {
    // STATS: the scout's one-line read, centered, over a dimmed sprite —
    // the species signs it at the bottom, in their own skin color
    body = `<div class="ksq">
      ${imgDim}
      <div class="ktop">${nameHtml}</div>
      <div class="prblurb centered">${esc(pr.blurb)}</div>
      <div class="prspecies ${spCls}" style="color:${skinTone(pr.speciesId, pr.id)}">${sp.name.toUpperCase()}</div>
    </div>`;
  } else if (l === 2) {
    // POTENTIAL: the ceiling (?? or the stars) sits DEAD CENTER, the cloud
    // of CURRENT skills showing behind and around it
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
  const mains: SpotLabel[] = (gxStickers?.get(pr.id) ?? []).map((st) => ({ text: st.text, up: st.up }));
  if (opts.signing?.selected) mains.push({ text: opts.signing.effPct !== undefined ? `LETTER →${opts.signing.effPct}%` : 'LETTER', up: true });
  const act = opts.signing ? `data-action="pursue" data-id="${pr.id}"` : '';
  return `<div class="pcard prospect sq ${opts.draggable ? 'grabbable' : ''} ${opts.dim ? 'cutcard' : ''} ${opts.signing?.selected ? 'picked' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}" data-kind="pr" data-pid="${pr.id}" ${act}>
    ${body}
    ${spotHtml('main', mains, opts.labelPop !== false)}
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

/** Who's next: the header always names the coming game. */
function nextOppLabel(s: GameState): string {
  const t = myTeam(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  if (champ) return `${t.name} vs ${champ.name}`;
  const m = myMatchup(s);
  if (m) return m.home ? `${t.name} vs ${m.opponent.name}` : `${t.name} @ ${m.opponent.name}`;
  return t.name;
}

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const cells = Array.from({ length: CACHE_MAX }, (_, i) =>
    `<span class="ecell ${i < s.energy ? 'on' : ''}" style="${i < s.energy ? `background:${ramp(0.35 + 0.55 * (i / CACHE_MAX))}` : ''}"></span>`
  ).join('');
  const jobFlash = storyMode === 'impact' && heatShift !== null && (heatShift.dS !== 0 || heatShift.dB !== 0) && currentStory(s);
  const rank = ordinal(1 + sortedStandings(s).findIndex((x) => x.id === s.myTeamId));
  return `<div class="topbar ${gxResult ? 'spotlight' : ''} ${jobFlash ? 'jobflash' : ''}">
    <div class="hgrid">
      <button class="chip hchip" data-action="sched-open" style="background:${t.bg};color:${t.fg}">${esc(nextOppLabel(s))}</button>
      ${jobBar(s)}
      <button class="weeklab hrow" data-action="stand-open">S<b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b> · ${t.wins}–${t.losses} · <b>${rank}</b></button>
      <div class="ebar" title="credits ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">
        <img class="jicon ${s.energy < 2 ? 'blink' : 'ghost'}" src="${iconUrl('alert', ramp(0.9))}" alt=""/>
        <div class="etrack ${s.energy === 0 ? 'blink' : ''}">${cells}</div>
        <img class="jicon" src="${iconUrl('credit', ramp(0.75))}" alt=""/>
      </div>
    </div>
    <div class="hbtns-col">
      <button class="hbtn" data-action="help">?</button>
      <button class="hbtn" data-action="coach-open">⚙</button>
    </div>
  </div>`;
}

// the schedule + standings dialogs (tap the header rows) — BLOCKED while a
// story is up: Scoop's questions must be answered from memory or the notebook
function schedModalHtml(s: GameState): string {
  if (!schedOpen) return '';
  const t = myTeam(s);
  const rows: string[] = [];
  for (let w = 1; w <= REGULAR_WEEKS; w++) {
    const g = (s.schedule[w - 1] ?? []).find(([h, a]) => h === s.myTeamId || a === s.myTeamId);
    if (!g) continue;
    const home = g[0] === s.myTeamId;
    const opp = s.teams[home ? g[1] : g[0]];
    const res = s.myResults?.find((r) => r.week === w);
    const now = w === s.week && !isUtWeek(s);
    rows.push(`<tr class="${now ? 'me' : ''}">
      <td>W${w}</td>
      <td>${home ? 'vs' : '@'} ${chip(opp.name, opp.bg, opp.fg, true)}</td>
      <td class="num">${res ? esc(res.text.split(' ').slice(0, 2).join(' ')) : now ? '◂ NOW' : ''}</td>
    </tr>`);
  }
  const utRows = (s.ut?.log ?? []).map((l) => `<tr><td colspan="3" class="dim">${esc(l)}</td></tr>`).join('');
  return `<div class="modalback" data-action="sched-close"><div class="modal">
    <span class="tag">THE SEASON — ${esc(t.name).toUpperCase()}</span>
    <table class="schedtable">${rows.join('')}${utRows}</table>
    <button class="wide" data-action="sched-close">CLOSE</button>
  </div></div>`;
}

function standModalHtml(s: GameState): string {
  if (!standOpen) return '';
  const table = sortedStandings(s)
    .map((tm, i) => `<tr class="${tm.id === s.myTeamId ? 'me' : ''}">
      <td>${i + 1}. ${chip(tm.name, tm.bg, tm.fg, true)}</td><td class="num">${tm.wins}–${tm.losses}</td></tr>
      ${i === 1 ? '<tr class="utline"><td colspan="2">▲ THE UNIVERSAL TOURNAMENT ▲</td></tr>' : ''}`)
    .join('');
  return `<div class="modalback" data-action="stand-close"><div class="modal">
    <span class="tag">THE STANDINGS</span>
    <table class="standings">${table}</table>
    <button class="wide" data-action="stand-close">CLOSE</button>
  </div></div>`;
}

// ---- THE BAG bar (always there) -------------------------------------------------------------------

function bagBar(s: GameState): string {
  const ev = currentStory(s);
  const usableInStory = new Set(
    (ev?.choices ?? []).filter((c) => c.itemId && !ev?.resolvedText).map((c) => c.itemId as string)
  );
  // THE NOTEBOOK holds the first slot, forever — during a Scoop question it
  // pulses if the answer is on its pages
  const canAnswer = ev?.defId === 'scoop_question' && !ev.resolvedText
    && s.notebook.some((n) => n.key === ev.data?.noteKey);
  const noteSlot = `<button class="bslot filled notebook ${canAnswer ? 'pulse' : ''}" data-action="notebook">▤<span class="bshort">NOTES</span></button>`;
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const id = s.bag[i];
    if (!id) return '<div class="bslot empty">·</div>';
    const item = itemById(id);
    const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
    return `<button class="bslot filled ${item.rarity} ${usableInStory.has(id) ? 'pulse' : ''} ${spent ? 'spent' : ''}"
      data-action="bag-item" data-id="${item.id}" data-bagitem="${item.id}">◆<span class="bshort">${item.short}</span></button>`;
  }).join('');
  return `<div class="bagbar">${noteSlot}${slots}</div>`;
}

// ---- THE NOTEBOOK: tap it and something noteworthy goes in --------------------

function takeNote(): boolean {
  const s = state;
  const ev = currentStory(s);
  if (ev) {
    const src = ev.resolvedText ?? ev.text;
    const snippet = src.replace(/\s+/g, ' ').trim().slice(0, 110);
    return addNote(s, 'story', `story:${ev.uid}`, `«${snippet}${src.length > 110 ? '…' : ''}» — ${ev.tag}`);
  }
  if (s.phase === 'gamenight' && s.lastResult && gnStage === 'table') {
    const lines = [`my game: ${s.lastResult.win ? 'W' : 'L'} ${s.lastResult.myScore}–${s.lastResult.oppScore} vs ${s.lastResult.oppName}`, ...s.resultsLog];
    return addNote(s, 'results', `res:${s.season}:${s.week}`, lines.join(' · '));
  }
  if (s.phase === 'gamenight' && s.lastResult) {
    const r = s.lastResult;
    const mvp = r.box.find((x) => x.playerId === r.mvpId)?.name ?? '—';
    const top = r.box[0];
    return addNote(s, 'mvp', `mvp:${s.season}:${s.week}`,
      `${r.win ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${r.oppName} · MVP ${mvp} · top scorer ${top ? `${top.name} (${top.pts})` : '—'}`);
  }
  if (s.phase === 'matchup' || s.phase === 'gamenight') {
    return addNote(s, 'opp', `opp:${s.season}:${s.week}`, `week ${s.week}: ${nextOppLabel(s)}`);
  }
  return false;
}

function notebookModalHtml(s: GameState): string {
  if (!notebookOpen) return '';
  const rows = s.notebook.length
    ? s.notebook.map((n) => `<div class="notebookrow"><span class="dim">S${n.season} W${n.week}</span> ${esc(n.text)}</div>`).join('')
    : '<div class="dim">Blank pages. Tap the notebook on a screen worth remembering.</div>';
  return `<div class="modalback" data-action="notebook-close"><div class="modal scrolly">
    <span class="tag">▤ THE NOTEBOOK</span>
    ${rows}
    <button class="wide" data-action="notebook-close">CLOSE</button>
  </div></div>`;
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
  const showDrill = isPractice && s.trainedThisWeek && drillDeltas !== null;
  const diamond = s.phase === 'matchup';
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
      let delta: CardDelta | undefined;
      let mains: SpotLabel[] | undefined;
      let his: SpotLabel[] | undefined;
      let labelPop = true;
      let popDelay = 0;
      if (p && showGame) {
        // THE FINAL HORN: the line in the main spot, the meters blinking
        // their deltas in place, the MVP smack across the player — XP waits
        // for the WEEK START report. (ON FIRE needs no label: he burns.)
        const d = s.postGame.find((x) => x.playerId === p.id);
        const row = s.lastResult?.box.find((x) => x.playerId === p.id);
        if (d || row) {
          const b = batchFor(`game:${wkKey}`, true);
          if (b.render) {
            delta = { e: d?.energyP ?? 0, m: d?.mood ?? 0 };
            mains = row ? [{ text: statLine(row), up: row.pts >= 20 ? true : undefined }] : [];
            if (s.lastResult?.mvpId === p.id) his = [{ text: '★ GAME MVP', up: true }];
            labelPop = b.animate;
            popDelay = 320 + sweep * 300;
            sweep++;
          }
        }
      } else if (p && s.phase === 'gamenight' && gnStage === 'half' && s.halftime) {
        // HALFTIME: the H1 line up top, the burn blinking on the gauge, and
        // the FORM ROLL smack across the player — STANDOUT! rides on, OFF
        // DAY begs for the bench, TIRED blinks on an empty tank.
        const ht = s.halftime;
        const row = ht.box.find((x) => x.playerId === p.id);
        const drain = ht.drains[p.id];
        const form = ht.forms?.[p.id];
        const gassed = r < 2 && p.outWeeks === 0 && p.energy <= 30;
        if (row || drain || form || gassed) {
          const b = batchFor(`half:${wkKey}`, true);
          if (b.render) {
            delta = { e: drain ?? 0 };
            mains = row ? [{ text: statLine(row), up: row.pts >= 10 ? true : undefined }] : [];
            his = [];
            if (form === 1) {
              const gain = ht.formGain?.[p.id];
              his.push({ text: `STANDOUT!${gain ? ` ${gain}` : ''}`, up: true });
              if (gain) delta.ovrFrom = ovr(p.attrs) - 1;
            }
            if (form === -1) his.push({ text: 'OFF DAY', up: false });
            if (gassed) his.push({ text: 'TIRED', up: false, blink: true });
            labelPop = b.animate;
            popDelay = 300 + sweep * 220;
            sweep++;
          }
        }
      } else if (p && s.phase === 'weekstart') {
        // THE MONDAY REPORT: banked XP as news in the main spot, the weekend
        // ⚡ bump blinking on the gauge — a small bump means stacked starts.
        // Mood drift is bookkeeping, not news.
        const wk = s.weekRecap?.find((x) => x.playerId === p.id);
        if (wk && (wk.xpGain > 0 || wk.energyP !== 0)) {
          const b = batchFor(`wk:${wkKey}`, true);
          if (b.render) {
            delta = { e: wk.energyP };
            if (wk.xpGain > 0) {
              // the banked payout, on the ring: the incoming arc blinks bright
              const need = p.level >= LEVEL_CAP ? 0 : xpNeed(p.level);
              if (need > 0) {
                delta.xpFromPct = Math.min(100, Math.round((p.xp / need) * 100));
                delta.xpProjPct = Math.min(100, Math.round(((p.xp + wk.xpGain) / need) * 100));
              }
              mains = [{ text: `+${wk.xpGain} XP`, up: true }];
            }
            labelPop = b.animate;
            popDelay = 280 + sweep * 220;
            sweep++;
          }
        }
      } else if (p && showDrill) {
        const rec = drillDeltas!.get(p.id);
        if (rec) {
          const b = batchFor(`drill:${wkKey}`, false);
          if (b.render) {
            delta = rec;
            labelPop = b.animate;
            popDelay = 350 + sweep * 260;
            sweep++;
          }
        }
      }
      // halftime: no fresh legs off the reserve bench — that row is locked
      const halfLock = s.phase === 'gamenight' && gnStage === 'half' && r === 2;
      const scope = scopeSet && p ? (scopeSet.has(p.id) ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell dropzone" data-zone="${idx}">
        ${p
          ? playerCard(p, { lens: gridLens, draggable: draggable && !halfLock, locked: halfLock, sitout: isPractice && p.outWeeks === 0 && p.energy < 40, miscast: Math.round((1 - mult) * 100), delta, mainLabels: mains, hiLabels: his, labelPop, popDelay, diamond, scope })
          : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${ROW_LABELS[r]}</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

// THE PRIORITY BOARD: rows are priority tiers, dragged exactly like the squad
// grid, any time — on EVERY lens; the drag IS the targeting. CUTS stays the
// transient 4th row during search swaps. On SIGNING DAY the same board takes
// the letters: tap a name to pursue it.
const BOARD_ROW_LABELS = ['TARGETS', 'BACKUPS', 'LAST RESORTS'];

function prospectGridHtml(s: GameState, scopeCount: number | null = null, signing = false): string {
  // a blank column-header row keeps the cards in exactly the same spot as
  // the practice grid — screens must not jump
  const colHead = `<div class="colhead"><span class="rowlabel"></span><span></span><span></span><span></span></div>`;
  const swapping = s.pendingRecruits.length > 0;
  const gxBatch = gxStickers ? stickerBatch(`gx:${s.season}:${s.week}`, false) : null;
  if (gxBatch && !gxBatch.render) gxStickers = null; // seen is seen
  const chances = signing ? effectiveChances(s) : [];
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const pr = s.prospects[idx];
      const scope = scopeCount !== null && pr ? (idx < scopeCount ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell ${signing ? '' : 'dropzone'}" data-zone="${idx}">${pr
        ? prospectCard(pr, lens, {
            draggable: !signing,
            scope,
            labelPop: gxBatch?.animate ?? true,
            signing: signing ? { selected: pr.selected, effPct: chances.find((x) => x.prospect.id === pr.id)?.pct } : undefined,
          })
        : `<div class="pod empty">·</div>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${BOARD_ROW_LABELS[r]}</div>${cells}</div>`);
  }
  // the 4th row exists only while new names wait — whoever sits there when
  // you confirm is gone forever
  if (swapping && !signing) {
    const cells = [0, 1, 2].map((c) => {
      const pr = s.pendingRecruits[c];
      return `<div class="gcell dropzone" data-zone="${9 + c}">${pr
        ? prospectCard(pr, lens, { draggable: true, dim: true })
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

/** THE REVEAL CARD's preview: the actual picker row / item card of what you
    just received — so «WAR CRY» is never a mystery word in the sand. */
function revealPreview(kind: string, id: string): string {
  if (kind === 'speech') {
    const pl = PLANS.find((x) => x.id === id);
    if (!pl) return '';
    return `<div class="drill sel revealrow">
      <b>${pl.speech}</b> <span class="xpg">${ATTR_LABEL[pl.attr]}</span> <span class="xpg gaintag">${pl.workPct + pl.up}% +${pl.work[0]}–${pl.work[1]} ${ATTR_SHORT[pl.attr]}</span>${pl.cooldown ? ` <span class="xpg">${pl.cooldown}w recharge</span>` : ''}
      ${oddsLine({ pct: pl.up, cls: 'SPIRIT', note: `IGNITES: squad +${pl.boost}` }, { pct: pl.down, cls: 'DRAMA', note: 'a believer lost' })}<br/>
      <span class="ddesc">${esc(pl.fantasy)}</span>
    </div>`;
  }
  if (kind === 'drill') {
    const d = DRILLS.find((x) => x.id === id);
    if (!d) return '';
    const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
    const what = gains
      ? `<span class="xpg gaintag">${gains}</span>`
      : d.potChance
        ? `<span class="xpg gaintag">${d.potChance}% +1 CEILING</span>`
        : `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP</span>`;
    return `<div class="drill sel revealrow">
      <b>${d.name}</b> ${what}
      ${oddsLine(d.up, d.down, d.cost)}<br/>
      <span class="ddesc">${esc(d.desc)}</span>
    </div>`;
  }
  if (kind === 'region') {
    const a = GALAXY_ACTS.find((x) => x.id === id);
    if (!a) return '';
    return `<div class="drill sel revealrow">
      <b>${a.name}</b> <span class="xpg">1${a.twoChance ? '–2' : ''} new name${a.twoChance ? 's' : ''}</span>
      ${oddsLine(a.up, a.down, a.cost)}<br/>
      <span class="ddesc">${esc(a.desc)}</span>
    </div>`;
  }
  const item = itemById(id);
  return `<div class="itemcard ${item.rarity} revealrow">
    <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
    <i class="dim">${esc(item.flavor)}</i><br/>
    ${esc(item.effectText)}<br/>${oddsLine(item.up, item.down)}
  </div>`;
}

/** The story's illustration: the player ACTING (worried → the verdict), the
    bus/saucer (ALWAYS starts moving, then the scene lands with the verdict),
    or the dean/booster sweating over what you'll pick. */
function storyArt(s: GameState, ev: { defId: string; playerId: number | null; tag: string; data?: Record<string, unknown>; resolvedText?: string; choices?: unknown[] }): string {
  const t0 = myTeam(s);
  const kit = { bg: t0.bg, fg: t0.fg };
  const def = storyById(ev.defId);
  // the reveal card previews the actual thing you received
  if (ev.defId === 'reveal') {
    return `<div class="revealbox">${revealPreview((ev.data?.kind as string) ?? 'item', (ev.data?.id as string) ?? '')}</div>`;
  }
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
  const side = ev.data?.side as string | undefined;
  const figure: FigureId | undefined = def.figure === 'side'
    ? (side === 'school' || side === 'dean' ? 'dean' : side === 'scoop' ? 'scoop' : 'booster')
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
            ${esc(c.label)}${cant ? ' — NOT ENOUGH ¢' : ''}<br/>${oddsLine(c.up, c.down, c.cost)}</button>`;
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
function teamBarsMatchup(s: GameState, opts: { fx?: SpeechFx | SpeechFx[] | null; noVs?: boolean; forms?: Record<number, 1 | -1> } = {}): string {
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
    return `${bits.join(' ')} · ${d.cost ? `${d.cost}¢` : '0¢'}`;
  }
  const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
  const pot = d.potChance ? `${d.potChance}% +1 CEILING` : '';
  return `${[gains, pot].filter(Boolean).join(' · ') || `+${d.xp[0]}–${d.xp[1]} XP`} · SQUAD · ${d.cost}¢`;
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
        <b>▶ RUN — ${d.name}</b><span class="actsub">${spent ? '✓ THIS WEEK' : s.energy < d.cost ? `NEED ${d.cost}¢` : drillRecap(d)}</span>
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
  if (act.kind === 'scout') return `reveal ${act.reveals![0]}–${act.reveals![1]} facets · ${gxScopeWord(act)} · ${act.cost}¢`;
  if (act.kind === 'recruit') return `+${act.gain![0]}–${act.gain![1]}% commit · ${gxScopeWord(act)} · ${act.cost}¢`;
  return `new talent for the board · ${act.cost ? `${act.cost}¢` : 'FREE'}`;
}

const GX_VERB = { scout: 'SCOUT', recruit: 'RECRUIT', search: 'SEARCH' } as const;

function stageGalaxy(s: GameState): string {
  const act = galaxyActById(selGalaxy);
  const grounded = s.groundedWeeks > 0 && act.kind === 'search' && !act.local;
  const swapping = s.pendingRecruits.length > 0;
  const done = s.galaxyActWk;
  const disabled = grounded ? 'GROUNDED' : s.energy < act.cost ? `NEED ${act.cost}¢` : false;
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

/** The speech picker's current selection. At halftime the pregame speech is
    off the table — it's still ringing in their ears. */
function speechSel(s: GameState): PlanId {
  const half = s.phase === 'gamenight';
  const ok = (id: PlanId): boolean => s.knownPlans.includes(id) && (!half || id !== s.plan) && speechCooldown(s, id) === 0;
  if (selSpeech && ok(selSpeech)) return selSpeech;
  if (ok(s.plan)) return s.plan;
  return s.knownPlans.find(ok) ?? s.knownPlans[0];
}

/** «▶ SPEECH — …» + ▾ — a mandatory gamble, one per half. */
function speechRow(s: GameState, half: boolean): string {
  const sel = speechSel(s);
  const pl = planById(sel);
  const spoken = half ? !!s.speechH2 : !!s.speechWk;
  const committed = half ? s.planH2 ?? s.plan : s.plan;
  const landed = half ? s.speechFxH2 : s.speechFx;
  const ignited = landed && landed.amt >= planById(committed).boost;
  const spokenSub = landed
    ? ignited
      ? `🔥 THE ROOM IGNITED — squad +${landed.amt} ${ATTR_SHORT[landed.attr]} tonight`
      : `✓ the words LAND — squad +${landed.amt} ${ATTR_SHORT[landed.attr]} tonight`
    : '— the room heard you. the rest is on them';
  return `<div class="fourthrow actrow"><span class="actwrap runwrap">
      <button class="actmain hold" data-action="speech-run" ${spoken ? 'disabled' : ''}>
        <b>▶ ${half ? 'HALFTIME SPEECH' : 'SPEECH'} — ${spoken ? planById(committed).speech : pl.speech}</b>
        <span class="actsub">${spoken ? spokenSub : `${pl.workPct + pl.up}% squad +${pl.work[0]}–${pl.work[1]} ${ATTR_SHORT[pl.attr]} · ${pl.up}% IGNITES +${pl.boost} · ${pl.down}% a believer lost`}</span>
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
  const sel = speechSel(s);
  const half = s.phase === 'gamenight';
  let hidden = 0;
  const items = PLANS.map((pl) => {
    if (!s.knownPlans.includes(pl.id)) { hidden++; return ''; }
    if (half && pl.id === s.plan) {
      // the pregame speech is still working the room — no repeats
      return `<div class="drill locked"><b>${pl.speech}</b> <span class="dim">— still ringing in their ears (pregame)</span></div>`;
    }
    const cd = speechCooldown(s, pl.id);
    if (cd > 0) {
      return `<div class="drill locked"><b>${pl.speech}</b> <span class="dim">— recharging, ${cd} week${cd === 1 ? '' : 's'}</span></div>`;
    }
    return `<button class="drill ${sel === pl.id ? 'sel' : ''}" data-action="speech-pick" data-id="${pl.id}">
      <b>${pl.speech}</b> <span class="xpg">${ATTR_LABEL[pl.attr]}</span> <span class="xpg gaintag">${pl.workPct + pl.up}% +${pl.work[0]}–${pl.work[1]} ${ATTR_SHORT[pl.attr]}</span>${pl.cooldown ? ` <span class="xpg">${pl.cooldown}w recharge</span>` : ''}
      ${oddsLine({ pct: pl.up, cls: 'SPIRIT', note: `IGNITES: squad +${pl.boost}` }, { pct: pl.down, cls: 'DRAMA', note: 'a believer lost' })}<br/>
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

/** THE LIVE GAME dial (away on the left, always): the score ticks up in
    1–3 point bursts while each team's color FILLS from the rating separator
    toward its own edge. Filling past your side's edge means you're beating
    the rating — the separator gets PUSHED. The score rides the separator. */
function needleStage(s: GameState, title: string, subLine: string, share: number, home: boolean, oppName: string): string {
  const t = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const oppBg = champ ? champ.bg : m ? m.opponent.bg : '#888';
  const awayShare = home ? 1 - share : share;
  const sep = awayShare * 100;
  return `<div class="needle-stage" id="needle-stage">
    <div class="ns-title">${title}</div>
    <div class="ns-vs">${esc(home ? oppName : teamLabel(t))} <span class="dim">@</span> ${esc(home ? teamLabel(t) : oppName)}</div>
    ${subLine}
    <div class="bigrope live" id="bigrope">
      <span class="lg-rating" style="left:${sep}%"></span>
      <span class="lg-fill" id="lgl" style="left:${sep}%;width:0%;background:${home ? oppBg : t.bg}"></span>
      <span class="lg-fill" id="lgr" style="left:${sep}%;width:0%;background:${home ? t.bg : oppBg}"></span>
      <span class="brsplit" id="lgsep" style="left:${sep}%"></span>
      <div class="livescore" id="livescore" style="left:${sep}%"><b id="lsl">0</b><span class="lsdot">·</span><b id="lsr">0</b></div>
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
      ${teamBarsMatchup(s, { fx: [s.speechFx, s.speechFxH2].filter((f): f is SpeechFx => !!f), noVs: true, forms: ht.forms })}
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
      // THE SUMMER lands here, on the grid: a returner's growth blinks the
      // old OVR into the new one, right on the card
      const sum = s.summerRecap?.find((x) => x.playerId === p.id);
      const grew = sum && sum.ovrFrom !== ovr(p.attrs);
      const sumBatch = grew || sum?.note ? stickerBatch(`sum:${s.season}`, true) : null;
      return `<div class="gcell dropzone" data-zone="${idx}">${playerCard(p, {
        lens,
        tag,
        draggable: lens === 0,
        kit: returning.has(p.id) || commits.has(p.id) ? undefined : PRACTICE_KIT,
        delta: grew && sumBatch?.render ? { ovrFrom: sum.ovrFrom } : undefined,
        mainLabels: sumBatch?.render
          ? [
              ...(grew ? [{ text: `THE SUMMER +${ovr(p.attrs) - sum.ovrFrom}`, up: true }] : []),
              ...(sum?.note ? [{ text: sum.note, up: true }] : []),
            ]
          : undefined,
        labelPop: sumBatch?.animate ?? true,
        popDelay: 250 + idx * 180,
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
  // SIGNING DAY happens ON the board, not in a list: tap a name to send the
  // letter; the card wears its effective chance. The rows still read
  // TARGETS / BACKUPS / LAST RESORTS — priority was always the point.
  return `<h2 class="gridhead">SIGNING DAY</h2>
    ${prospectGridHtml(s, null, true)}
    ${s.prospects.length ? '' : `<div class="report dim">You scouted nobody. Enjoy the walk-ons.</div>`}`;
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
  // the players being discussed stand IN the dialog — look them in the eye
  const cards = cut.length
    ? `<div class="confirmcards">${cut.map((p) => playerCard(p, { inert: true, kit: PRACTICE_KIT, labelPop: false })).join('')}</div>`
    : '';
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE CUT</span>
    ${cards}
    <p>${cut.length ? `${cut.map((p) => `<b>${esc(p.name)}</b>`).join(', ')} will be released. These players will be <b>lost to you forever</b>. Are you sure?` : 'Confirm this squad?'}</p>
    <button class="wide hold danger" data-action="confirm-roster">✂ CONFIRM${cut.length ? ` — CUT ${cut.length}` : ''}</button>
    <button class="wide" data-action="cut-confirm-close">GO BACK</button>
  </div></div>`;
}

function boardConfirmHtml(s: GameState): string {
  if (!boardConfirm || !s.pendingRecruits.length) return '';
  const names = s.pendingRecruits.map((p) => `<b>${esc(p.name)}</b>`).join(', ');
  const cards = `<div class="confirmcards">${s.pendingRecruits.map((pr) => prospectCard(pr, 0, { labelPop: false })).join('')}</div>`;
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE BOARD</span>
    ${cards}
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
  // a screen CHANGE: the build animation arms, and the lens falls back to
  // the MAIN view (ROSTER, BIG BOARD, ...) — computed BEFORE the middle
  // renders so the reset actually shows
  const takeover = ev !== null && state.phase !== 'pickTeam' && state.phase !== 'gameover';
  const screenKey = takeover ? 'story' : `${state.phase}|${gnStage}`;
  const doBuild = screenKey !== builtKey;
  builtKey = screenKey;
  if (doBuild && !takeover) lens = 0;

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
  const overlays = drillSheetHtml(state) + galaxySheetHtml(state) + speechSheetHtml(state) + gxResultHtml(state) + cutConfirmHtml(state) + boardConfirmHtml(state) + toastModalHtml() + itemModalHtml(state) + coachModalHtml(state) + schedModalHtml(state) + standModalHtml(state) + notebookModalHtml(state);
  const modalOpen = drillSheet || speechSheet || coachOpen || itemUi !== null || toast !== null || galaxySheet || gxResult !== null || cutConfirm || boardConfirm || schedOpen || standOpen || notebookOpen;
  const navHtml = `<div class="navbar ${modalOpen ? 'dimmed' : ''}">${nav(state)}</div>`;
  const lensHtml = (state.phase === 'practice' || state.phase === 'galaxy' || state.phase === 'teamSelect' || state.phase === 'signing') && !ev
    ? lensBar(state.phase === 'galaxy' || state.phase === 'signing' ? PROSPECT_LENS_NAMES : LENS_NAMES)
    : '';
  const frame = state.phase === 'pickTeam' || state.phase === 'gameover'
    ? `<div class="midwrap"><div class="middle solo">${middle}</div>${overlays}</div>${navHtml}`
    : `${headerHtml(state)}<div class="midwrap"><div class="middle">${middle}</div>${overlays}</div>${bagBar(state)}${lensHtml}${navHtml}`;

  // THE ANIMATION BUILD: a screen CHANGE builds in stages — title first (you
  // know where you are), content next, the action button last (you know where
  // to go). Re-renders of the same screen appear instantly, nothing dances.
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
    const at = 280 + ix * 300 + (isBig ? 320 : 0);
    cascTimers.push(window.setTimeout(() => {
      c.row.classList.add(isBig ? 'cascbig' : 'cascflash');
      c.fEls.forEach((el, j) => {
        const preW = parseFloat(c.preFills[j]);
        const postW = parseFloat(c.post.fills[j]);
        el.style.transition = '';
        el.style.width = c.post.fills[j];
        // the delta itself stays visible: the amount ADDED blinks brightly,
        // the amount that CAME OFF blinks darkly, right on the bar
        if (el.classList.contains('tbfill') && !isNaN(preW) && !isNaN(postW) && Math.abs(postW - preW) > 0.4) {
          const track = el.parentElement;
          if (track) {
            const band = document.createElement('span');
            band.className = `tbdelta ${postW > preW ? 'up' : 'down'}`;
            const lo = Math.min(preW, postW);
            if (track.classList.contains('rtl')) band.style.right = `${lo}%`;
            else band.style.left = `${lo}%`;
            band.style.width = `${Math.abs(postW - preW)}%`;
            band.style.animationDelay = `-${wallPhase(SWAP_MS)}ms`;
            track.appendChild(band);
          }
        }
      });
      c.vEls.forEach((el, j) => {
        const from = parseInt(c.p!.vals[j], 10);
        const to = parseInt(c.post.vals[j], 10);
        if (isNaN(from) || isNaN(to) || from === to) { el.textContent = c.post.vals[j]; return; }
        // the direction law, counted: rising numbers brighten, falling dim
        el.style.color = to > from ? '#fff' : 'var(--r35)';
        const steps = 12;
        let st = 0;
        const iv = window.setInterval(() => {
          st++;
          el.textContent = String(Math.round(from + (to - from) * (st / steps)));
          if (st >= steps) { clearInterval(iv); cascTimers.push(window.setTimeout(() => { el.style.color = ''; }, 1400)); }
        }, 50);
        cascTimers.push(iv);
      });
      cascTimers.push(window.setTimeout(() => c.row.classList.remove('cascflash', 'cascbig'), 1050));
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
      // the ignition borrows the main spot, then hands it back
      const standing = card.querySelector('.spot.spot-main') as HTMLElement | null;
      if (standing) standing.style.visibility = 'hidden';
      const el = document.createElement('div');
      el.className = 'spot spot-main';
      el.innerHTML = `<div class="sticker">+${casc.amt} ${ATTR_SHORT[casc.attr]}</div>`;
      card.appendChild(el);
      cascTimers.push(window.setTimeout(() => {
        el.remove();
        if (standing) standing.style.visibility = '';
      }, 2400));
    }, 140 + i * 150));
  });
  cascTimers.push(window.setTimeout(() => cascadeBars(), 140 + floor.length * 150 + 260));
}

// ---- THE ROLL WHEEL: chance moments play out in real time ----------------------
// A circular LED wheel — bright segments = success, dark = failure — with a
// needle that spins fast, slows, and lands. Appended to <body> so the state
// underneath can already be resolved while the wheel keeps the suspense.

function showWheel(chancePct: number, success: boolean, label: string, onDone: () => void): void {
  const pct = clamp(Math.round(chancePct), 1, 99);
  // the success zone starts at 12 o'clock; land the needle inside the truth
  const landPct = success ? Math.random() * pct : pct + Math.random() * (100 - pct);
  const landDeg = landPct * 3.6;
  const overlay = document.createElement('div');
  overlay.className = 'wheelback';
  overlay.innerHTML = `
    <div class="wheelbox">
      <div class="wheellabel">${esc(label)}</div>
      <div class="wheel">
        <svg viewBox="0 0 36 36">
          <circle class="whdark" cx="18" cy="18" r="15.9155"/>
          <circle class="whbright" cx="18" cy="18" r="15.9155" stroke-dasharray="${pct} 100"/>
        </svg>
        <div class="whneedle" id="whneedle"></div>
        <div class="whpct">${pct}%</div>
      </div>
      <div class="wheelverdict hide" id="whverdict">${success ? '▲ IT LANDS' : '▼ IT MISSES'}</div>
    </div>`;
  document.body.appendChild(overlay);
  const needle = overlay.querySelector('#whneedle') as HTMLElement;
  const verdict = overlay.querySelector('#whverdict') as HTMLElement;
  requestAnimationFrame(() => {
    void needle.offsetWidth;
    needle.style.transition = 'transform 2.3s cubic-bezier(.12,.8,.2,1)';
    needle.style.transform = `rotate(${1080 + 180 + landDeg}deg)`;
  });
  const finish = (): void => {
    verdict.classList.remove('hide');
    verdict.classList.add(success ? 'up' : 'down');
    window.setTimeout(() => { overlay.remove(); onDone(); }, 900);
  };
  const t1 = window.setTimeout(finish, 2450);
  overlay.addEventListener('click', () => {
    clearTimeout(t1);
    needle.style.transition = 'none';
    needle.style.transform = `rotate(${1080 + 180 + landDeg}deg)`;
    finish();
  });
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
  rope.style.transition = 'transform 0.75s cubic-bezier(.2,.8,.25,1)';
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
          const ht2 = state.halftime;
          animateLiveGame(ht2.myH1, ht2.oppH1, ht2.share, ht2.home, () => { gnStage = 'half'; render(); });
        } else if (state.lastResult) {
          const rr = state.lastResult;
          const h2 = rr.h2 ?? { my: rr.myScore, opp: rr.oppScore, share: rr.share };
          animateLiveGame(h2.my, h2.opp, h2.share, rr.home, () => { gnStage = 'verdict'; render(); });
        }
      };
      if (flipped) floatTimers.push(window.setTimeout(go, 800));
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

function animateLiveGame(myPts: number, oppPts: number, share: number, home: boolean, onDone: () => void): void {
  const lgl = document.getElementById('lgl');
  const lgr = document.getElementById('lgr');
  const lgsep = document.getElementById('lgsep');
  const score = document.getElementById('livescore');
  const lsl = document.getElementById('lsl');
  const lsr = document.getElementById('lsr');
  if (!lgl || !lgr || !lgsep || !score || !lsl || !lsr) { onDone(); return; }
  const sep0 = (home ? 1 - share : share) * 100;
  const leftFinal = home ? oppPts : myPts;
  const rightFinal = home ? myPts : oppPts;
  const total = Math.max(1, leftFinal + rightFinal);
  // equal ground per point: at the EXPECTED split both bars kiss their edges
  // exactly at the buzzer — outscoring your rating pushes the separator
  const k = 100 / total;
  let l = 0;
  let r = 0;
  let done = false;
  const apply = (): void => {
    const lw = l * k;
    const rw = r * k;
    const overL = Math.max(0, lw - sep0);
    const overR = Math.max(0, rw - (100 - sep0));
    const sep = clamp(sep0 + overL - overR, 2, 98);
    const lW = Math.min(lw, sep);
    const rW = Math.min(rw, 100 - sep);
    lgl.style.left = `${sep - lW}%`;
    lgl.style.width = `${lW}%`;
    lgr.style.left = `${sep}%`;
    lgr.style.width = `${rW}%`;
    lgsep.style.left = `${sep}%`;
    score.style.left = `${sep}%`;
    lsl.textContent = String(l);
    lsr.textContent = String(r);
  };
  apply();
  const finish = (skip = false): void => {
    if (done) return;
    done = true;
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    l = leftFinal;
    r = rightFinal;
    apply();
    lgsep.classList.add('landed');
    if (skip) onDone();
    else window.setTimeout(onDone, 850);
  };
  progressTimer = window.setInterval(() => {
    const remL = leftFinal - l;
    const remR = rightFinal - r;
    if (remL <= 0 && remR <= 0) { finish(); return; }
    // whoever has more scoring left is likelier to score next
    const left = Math.random() * (remL + remR) < remL;
    const amt = Math.min(1 + rand(3), left ? remL : remR);
    if (left) l += amt; else r += amt;
    apply();
  }, 170);
  document.getElementById('needle-stage')?.addEventListener('click', () => finish(true));
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
      // the change language needs before/after: snapshot, run, diff per card
      const pre = new Map(myTeam(state).players.map((p) => [p.id, {
        e: p.energy, m: p.mood, xp: p.xp, lvl: p.level, ovr: ovr(p.attrs),
        need: p.level >= LEVEL_CAP ? 0 : xpNeed(p.level),
      }]));
      const out = runDrill(state, selectedDrill);
      if (out) {
        floatEnergyBig(d.cost);
        drillDeltas = new Map();
        for (const p of myTeam(state).players) {
          const b = pre.get(p.id);
          if (!b) continue;
          const rec: CardDelta = {};
          if (p.energy !== b.e) rec.e = p.energy - b.e;
          if (p.mood !== b.m) rec.m = p.mood - b.m;
          if (p.level !== b.lvl) rec.lvlFrom = b.lvl;
          else if (p.xp !== b.xp && b.need > 0) rec.xpFromPct = Math.min(100, Math.round((b.xp / b.need) * 100));
          if (ovr(p.attrs) !== b.ovr) rec.ovrFrom = b.ovr;
          if (Object.keys(rec).length) drillDeltas.set(p.id, rec);
        }
        cascArmed = 'bars';
      }
      break;
    }

    case 'begin-week': beginWeek(state); break;
    case 'to-galaxy': drillSheet = false; drillDeltas = null; toGalaxy(state); break;
    case 'to-matchup': galaxySheet = false; gxStickers = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'gn-table': gnStage = 'table'; clearFloatTimers(); break;
    case 'continue-result': gnStage = 'beat'; clearFloatTimers(); drillDeltas = null; gxStickers = null; continueFromResult(state); break;

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

    case 'convince-pro': {
      const p = myTeam(state).players.find((x) => x.id === Number(id));
      const out = convincePro(state, Number(id));
      // the diceroll plays out LIVE: the wheel spins over the resolved truth
      if (out) showWheel(out.chance, out.staying, p ? `KEEPING ${p.name.toUpperCase()}?` : 'THE TALK', () => render());
      break;
    }
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
    case 'sched-open': if (!currentStory(state)) schedOpen = true; break;
    case 'sched-close': schedOpen = false; break;
    case 'stand-open': if (!currentStory(state)) standOpen = true; break;
    case 'stand-close': standOpen = false; break;
    case 'notebook': {
      const ev = currentStory(state);
      // during Scoop's question the notebook ANSWERS (if it has the note)
      if (ev?.defId === 'scoop_question' && !ev.resolvedText) {
        if (state.notebook.some((n) => n.key === ev.data?.noteKey)) doResolve('notebook');
        else toast = '▤ THE NOTEBOOK: the pages are blank on this one, coach.';
        break;
      }
      // otherwise: note something noteworthy — or browse the pages
      if (takeNote()) toast = `▤ NOTED: ${esc(state.notebook[0].text.slice(0, 90))}${state.notebook[0].text.length > 90 ? '…' : ''}`;
      else notebookOpen = true;
      break;
    }
    case 'notebook-close': notebookOpen = false; break;
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
