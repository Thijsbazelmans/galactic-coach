// GALACTIC COACH v1.1 — the app frame. No scrolling, ever (recent phones):
// stats always on top, THE BAG + navigation always at the bottom, and between
// them the 3×3 grid — which IS your lineup — with a fourth row for controls.
// Popups take over the middle; the bag stays reachable, items drag right in.

import {
  ATTR_LABEL,
  ATTR_SHORT,
  CLASS_ABBR,
  DRILLS,
  PLANS,
  PROSPECT_ACTS,
  SCAN_REGIONS,
  itemById,
  planById,
} from './engine/data';
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, ROSTER_SIZE, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, slotMult, slotPlayer, teamRating, wheel } from './engine/sim';
import {
  type LevelUp,
  actionDropProspect,
  actionProspect,
  actionScan,
  chooseTeam,
  continueFromResult,
  convincePro,
  currentStory,
  deliverSpeech,
  dismissStory,
  effectiveChances,
  finalizeRoster,
  freshGame,
  isUtWeek,
  letGoPro,
  load,
  myMatchup,
  myTeam,
  oppPlanHint,
  playGame,
  queueStory,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  save,
  scoutOpponent,
  showTip,
  sortedStandings,
  startNewSeason,
  starters,
  toGalaxy,
  toMatchup,
  toPractice,
  toSigning,
  toggleProspect,
  toggleTips,
  useItem,
  utOpponent,
  weekLabel,
  wipeSave,
} from './engine/state';
import type { Attr, AttrRec, GameState, PlanId, Player, Prospect, Team } from './engine/types';
import type { Fx } from './engine/types';
import { ATTRS, clamp, copyAttrs, ovr, perGame, potStars } from './engine/util';
import { PRACTICE_KIT, energyBucket, iconUrl, moodBucket, rigSpriteHtml, type Kit, type RigView } from './rig';

const VERSION = 'v2.0';

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
let selectedDrill = 'shootaround';
let galaxySheet: 'discover' | 'scout' | 'recruit' | null = null;
let selDiscover = 'home';
let selScout = 'attend';
let selRecruit = 'tour';
let selProspect: number | null = null;
let selSpeech: PlanId | null = null;
let speechSheet = false;
let selEmpty = false;
let dropConfirm: number | null = null;
let gxResult: { text: string; cost: number; played: boolean } | null = null;
let poolSelected: Set<number> | null = null;
let gnStage: 'beat' | 'verdict' | 'table' = 'beat';
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

function floatCard(pid: number, msgs: { text: string; up?: boolean }[], startDelay = 0): void {
  msgs.forEach((m, i) => {
    floatTimers.push(
      window.setTimeout(() => {
        document.querySelectorAll(`[data-pid="${pid}"]`).forEach((card) => {
          const el = document.createElement('div');
          el.className = `floater ${m.up === false ? 'down' : m.up ? 'up' : ''}`;
          el.textContent = m.text;
          (el as HTMLElement).style.left = `${8 + (i % 2) * 30}px`;
          card.appendChild(el);
          card.classList.add('flash');
          window.setTimeout(() => el.remove(), 1600);
          window.setTimeout(() => card.classList.remove('flash'), 600);
        });
      }, startDelay + i * 420)
    );
  });
}

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

/** Drill results sweep the grid in slot order, one player at a time. */
function floatDrill(out: { xpByPlayer: Map<number, number>; gainByPlayer: Map<number, string>; levelUps: LevelUp[] }, cost: number): void {
  floatEnergyBig(cost);
  const base = 350 + cost * 300;
  slotOrderIds().forEach((pid, i) => {
    const msgs: { text: string; up?: boolean }[] = [];
    const g = out.gainByPlayer.get(pid);
    if (g) msgs.push({ text: g, up: true });
    const xp = out.xpByPlayer.get(pid);
    if (xp) msgs.push({ text: `+${xp} XP` });
    if (msgs.length) floatCard(pid, msgs, base + i * 240);
  });
  out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL ${lu.level}`, up: true }], base + 9 * 240 + i * 300));
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
  if (state.energy !== snap.energy) rows.push({ label: '⚡ CELLS', from: snap.energy, to: state.energy, up: state.energy > snap.energy });
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
  const cost = ev.choices?.find((c) => c.key === key)?.cost ?? 0;
  const res = resolveStory(state, key);
  if (!res) return;
  if (cost > 0) floatEnergyBig(cost);
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
  const shape = fuzz
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

// ---- the three lenses -----------------------------------------------------------
// One squad, three questions: SKILLS (who is he), STATS (what has he done),
// GROWTH (where did he start, how far can he go). Same faces, same places.

type Lens = 0 | 1 | 2;
const LENS_NAMES = ['ABILITIES', 'STATS', 'POTENTIAL'];
let lens: Lens = 0;

/** The sprite tells the truth: mood, energy, size and fire, straight from the rig. */
function rigView(p: Player, story?: 'good' | 'bad'): RigView {
  if (story) {
    // in a story the STATE is the story's: neutral → the emotion, no ball
    return {
      id: p.id, speciesId: p.speciesId, heightCm: p.heightCm, weightKg: p.weightKg,
      jersey: p.jersey, mood: 'neutral', energy: 'normal',
      fire: !!p.onFire && p.outWeeks === 0, story,
    };
  }
  return {
    id: p.id,
    speciesId: p.speciesId,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    jersey: p.jersey,
    mood: moodBucket(p.mood),
    energy: p.outWeeks > 0 ? 'exhausted' : energyBucket(p.energy),
    fire: !!p.onFire && p.outWeeks === 0,
  };
}

interface CardOpts {
  lens?: Lens;
  kit?: Kit;
  /** story acting: sprite state comes from the news, not the meters */
  story?: 'good' | 'bad';
  tag?: string;
  inert?: boolean;
  draggable?: boolean;
  sitout?: boolean;
  miscast?: number; // % penalty to print
  pick?: boolean; // selection screens
}

// The card, phone-first, one lens at a time. SKILLS: the full-bleed square
// kite, sprite centered, OVR bottom-left, XP ring (LVL inside) bottom-right.
// STATS: the season box score. GROWTH: the same square, layered — dashes where
// the season started, outline where he can go, POT chip instead of the ring.
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
  let body: string;
  if (l === 1) {
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
  } else if (l === 2) {
    body = squareKite(p.attrs, {
      pot: p.pots,
      start: p.startAttrs,
      nameHtml,
      blHtml: ovrHtml,
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${vc(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
    });
  } else {
    body = squareKite(p.attrs, {
      pot: p.pots,
      sprite: sprite(1.75, 'ksprite'),
      nameHtml,
      blHtml: ovrHtml,
      brHtml: ringCounter(xpPct, 'LVL', String(p.level), `level ${p.level}/${LEVEL_CAP} · xp ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)}`),
    });
  }
  return `<div class="pcard lens${l} sq ${out ? 'pout' : ''} ${opts.draggable && !out && l === 0 ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    ${body}
    ${out ? `<div class="ptag">OUT ${p.outWeeks}w</div>` : ''}
    ${opts.sitout && l === 0 ? '<div class="ptag dimtag">SITS OUT</div>' : ''}
    ${opts.miscast && opts.miscast >= 8 && !out && l === 0 ? `<div class="ptag">MISCAST −${opts.miscast}%</div>` : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
  </div>`;
}

// Prospects wear the same square and the same three lenses. ABILITY sharpens
// to truth with scouting (?? → a range → the number); POTENTIAL never gets past
// stars until he signs — the cloud is the ceiling. ✕ forgets him forever.
function prospectCard(pr: Prospect, l: Lens): string {
  const img = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite');
  const known = pr.scoutLevel;
  const nameHtml = `<span class="kname">${esc(pr.name)}</span><button class="kx" data-action="pr-forget" data-id="${pr.id}">✕</button>`;
  const ring = ringCounter(pr.commitPct, 'COM', `${pr.commitPct}`, `commitment ${pr.commitPct}%`);
  const imgDim = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite dimspr');
  let body: string;
  if (l === 1) {
    // STATS: no box scores yet — the scout's one-line read over a dimmed sprite
    body = `<div class="ksq">
      ${imgDim}
      <div class="ktop">${nameHtml}</div>
      <div class="prblurb">${esc(pr.blurb)}</div>
    </div>`;
  } else if (l === 2) {
    // POTENTIAL: the ceiling as a cloud + a star guess (truth only at signing)
    const n = potStars(ovr(pr.seenPots));
    const stars = known === 0
      ? `<span class="prq">??</span>`
      : `<span class="prstars"><span>${'★'.repeat(Math.min(2, n))}${'☆'.repeat(Math.max(0, 2 - n))}</span><span>${'★'.repeat(Math.max(0, Math.min(3, n - 2)))}${'☆'.repeat(3 - Math.max(0, Math.min(3, n - 2)))}</span></span>`;
    body = squareKite(pr.seenPots, {
      fuzz: known >= 2 ? 1 : 2,
      nameHtml,
      blHtml: stars,
      brHtml: ring,
    });
  } else {
    // ABILITY: the cloud sharpens — ?? → a two-row range → the number (bottom-left)
    const seen = ovr(pr.seenAttrs);
    const bl = known >= 2
      ? `<b class="kovr" style="color:${vc(seen * 1.6)}">${seen}</b>`
      : known === 1
        ? `<span class="krange">${Math.max(0, seen - 6)}<br/>–${seen + 6}</span>`
        : `<span class="kovr prq">??</span>`;
    body = squareKite(pr.seenAttrs, {
      fuzz: known >= 2 ? 0 : known === 1 ? 1 : 2,
      sprite: img,
      nameHtml,
      blHtml: bl,
      brHtml: ring,
    });
  }
  return `<div class="pcard prospect sq ${selProspect === pr.id ? 'selpr' : ''}" data-action="pr-select" data-id="${pr.id}" data-pid="p${pr.id}">
    ${body}
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
  return `<div class="topbar ${gxResult ? 'spotlight' : ''}">
    <div class="hgrid">
      ${chip(t.name, t.bg, t.fg)}
      ${jobBar(s)}
      <span class="weeklab">S<b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b> · ${t.wins}–${t.losses}</span>
      <div class="ebar" title="power cells ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">
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

const ROW_LABELS = ['START', 'BENCH', 'RES'];

function gridHtml(s: GameState, draggable: boolean, gridLens: Lens = 0): string {
  const t = myTeam(s);
  const isPractice = s.phase === 'practice';
  const colHead = `<div class="colhead"><span class="rowlabel"></span>${COL_LABELS.map((c) => `<span>${c}</span>`).join('')}</div>`;
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const p = slotPlayer(t, idx);
      const mult = p && r < 2 ? slotMult(p, c) : 1;
      return `<div class="gcell dropzone" data-zone="${idx}">
        ${p
          ? playerCard(p, { lens: gridLens, draggable, sitout: isPractice && p.outWeeks === 0 && p.energy < 40, miscast: Math.round((1 - mult) * 100) })
          : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${ROW_LABELS[r]}</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

function prospectGridHtml(s: GameState): string {
  // a blank column-header row keeps the cards in exactly the same spot as
  // the practice grid — screens must not jump
  const colHead = `<div class="colhead"><span class="rowlabel"></span><span></span><span></span><span></span></div>`;
  const sel = gxSelection(s);
  const firstEmpty = s.prospects.length;
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const pr = s.prospects[idx];
      const podSel = sel.kind === 'empty' && idx === firstEmpty;
      return `<div class="gcell">${pr
        ? prospectCard(pr, lens)
        : `<button class="pod empty ${podSel ? 'selpr' : ''}" data-action="gx-empty">+</button>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel"></div>${cells}</div>`);
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

function storyPanel(s: GameState): string {
  const ev = currentStory(s)!;
  const p = ev.playerId !== null ? myTeam(s).players.find((x) => x.id === ev.playerId) : undefined;
  if (storyMode === 'impact') {
    return `<div class="storypanel" data-action="story-tap" id="storypanel">
      <span class="tag">${esc(ev.tag)}</span>
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
      ${p ? `<div class="modalcard">${playerCard(p, { inert: true, story: storySentiment(ev.tag) })}</div>` : ''}
      ${inChoices
        ? `<div class="typebox">${esc(beats[beats.length - 1])}</div>`
        : `<div class="typebox" id="typebox"></div>`}
      <div class="modal-actions ${inChoices ? '' : 'hide'}" id="modal-actions">${actions}</div>
    </div>`;
  }
  // a single typed beat, center stage (this layout never gains elements mid-read)
  return `<div class="storypanel" data-action="story-tap" id="storypanel">
    <span class="tag">${esc(ev.tag)}</span>
    <div class="typebox beatbox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div>`;
}

// ---- stages (middle content per phase) -----------------------------------------------------------------

/** Unweighted team totals: every available player's attributes, straight sum. */
function teamAttrSums(players: Player[]): AttrRec {
  const sums = { skl: 0, ath: 0, frc: 0, brn: 0 };
  for (const p of players) {
    if (p.outWeeks > 0) continue;
    for (const a of ATTRS) sums[a] += p.attrs[a];
  }
  return sums;
}

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

/** PRACTICE: five progress bars (max 225 / 900) + division rank per row. */
function teamBarsPractice(s: GameState): string {
  const t = myTeam(s);
  const all = s.teams.map((tm) => ({ id: tm.id, sums: teamAttrSums(tm.players) }));
  const mine = all.find((x) => x.id === t.id)!.sums;
  const rows = BAR_ROWS.map(({ a, label }) => {
    const val = (x: AttrRec): number => (a === 'all' ? ovr(x) : x[a]);
    const max = a === 'all' ? 900 : 225;
    const rank = 1 + all.filter((x) => x.id !== t.id && val(x.sums) > val(mine)).length;
    return `<div class="tbar ${a === 'all' ? 'big' : ''}">
      <span class="tbl">${label}</span>
      <span class="tbtrack"><span class="tbfill" style="width:${Math.min(100, (val(mine) / max) * 100)}%;background:${t.bg}"></span></span>
      <b class="tbv">${val(mine)}</b>
      <span class="tbr">${ordinal(rank)}</span>
    </div>`;
  }).join('');
  return `<div class="tbars">${rows}</div>`;
}

/** MATCHUP: away on the left, home on the right — a tug-of-war once scouted.
    Numbers sit on their team's side; the speech (once given) weights your rope. */
function teamBarsMatchup(s: GameState): string {
  const t = myTeam(s);
  const m = myMatchup(s);
  const home = isUtWeek(s) ? true : m?.home ?? true;
  const mineRaw = teamAttrSums(t.players);
  const myAttr = s.speechWk ? planById(s.plan).attr : null;
  let theirsRaw: AttrRec | null = null;
  let theirAttr: Attr | null = null;
  let oppBg = '#666';
  if (s.scoutedOpp) {
    if (isUtWeek(s)) {
      const c = utOpponent(s);
      if (c) {
        theirsRaw = { skl: c.kite.skl * 9, ath: c.kite.ath * 9, frc: c.kite.frc * 9, brn: c.kite.brn * 9 };
        theirAttr = planById(c.plan).attr;
        oppBg = c.bg;
      }
    } else {
      const hint = oppPlanHint(s);
      if (m && hint) {
        theirsRaw = teamAttrSums(m.opponent.players);
        theirAttr = planById(hint).attr;
        oppBg = m.opponent.bg;
      }
    }
  }
  const w = (x: AttrRec, boost: Attr | null, a: Attr): number => Math.round(x[a] * (a === boost ? 2.5 : 1));
  const rows = BAR_ROWS.map(({ a, label }) => {
    const big = a === 'all';
    const mv = big ? ATTRS.reduce((acc, k) => acc + w(mineRaw, myAttr, k), 0) : w(mineRaw, myAttr, a);
    const tv = theirsRaw ? (big ? ATTRS.reduce((acc, k) => acc + w(theirsRaw!, theirAttr, k), 0) : w(theirsRaw, theirAttr, a)) : null;
    const myPct = tv !== null ? (mv / Math.max(1, mv + tv)) * 100 : Math.min(100, (mv / ((big ? 900 : 225) * 1.6)) * 100);
    // away fills from the LEFT, home from the RIGHT
    const myFill = `<span class="tbfill" style="width:${tv !== null ? myPct : myPct}%;background:${t.bg}"></span>`;
    const oppFill = tv !== null ? `<span class="tbopp" style="width:${100 - myPct}%;background:${oppBg}"></span>` : '';
    const track = home
      ? `<span class="tbtrack ${tv !== null ? 'tug' : ''} rtl">${oppFill}${myFill}</span>`
      : `<span class="tbtrack ${tv !== null ? 'tug' : ''}">${myFill}${oppFill}</span>`;
    const myNum = `<b class="tbv">${mv}</b>`;
    const oppNum = tv !== null ? `<b class="tbv opp">${tv}</b>` : `<b class="tbv opp dim">??</b>`;
    const left = home ? oppNum : myNum;
    const right = home ? myNum : oppNum;
    return `<div class="tbar ${big ? 'big' : ''}">
      ${left}
      <span class="tblc"><span class="tbl">${label}</span>${track}</span>
      ${right}
    </div>`;
  }).join('');
  return `<div class="tbars mu">${rows}</div>`;
}

function lensBar(): string {
  const tabs = LENS_NAMES.map((n, i) =>
    `<button class="lenstab ${lens === i ? 'sel' : ''}" data-action="lens-set" data-id="${i}">${n}</button>`).join('');
  return `<div class="lensbar">${tabs}</div>`;
}

function stagePractice(s: GameState): string {
  let fourth: string;
  const d = DRILLS.find((x) => x.id === selectedDrill)!;
  if (lens !== 0) {
    fourth = '';
  } else {
    const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
    const recap = d.target === 'rest'
      ? 'squad ⚡ up · 0⚡'
      : `${gains || `+${d.xp[0]}–${d.xp[1]} XP`} · SQUAD · ${d.cost}⚡`;
    const spent = s.trainedThisWeek;
    fourth = `<div class="fourthrow actrow"><span class="actwrap runwrap">
      <button class="actmain hold" data-action="drill-run" ${spent || s.energy < d.cost ? 'disabled' : ''}>
        <b>▶ RUN — ${d.name}</b><span class="actsub">${spent ? '✓ THIS WEEK' : s.energy < d.cost ? `NEED ${d.cost}⚡` : recap}</span>
      </button>
      <button class="actarrow" data-action="drill-sheet" ${spent ? 'disabled' : ''}>▾</button>
    </span></div>`;
  }
  return `<h2 class="gridhead">PRACTICE</h2>${gridHtml(s, lens === 0, lens)}${teamBarsPractice(s)}${fourth}`;
}

/** [HOLD main action | ▾ variant picker] — the shared two-part button. */
function actBtn(kind: 'discover' | 'scout' | 'recruit', verb: string, variant: string, sub: string, disabled: string | false, done: boolean): string {
  return `<span class="actwrap">
    <button class="actmain hold" data-action="gx-run" data-id="${kind}" ${disabled || done ? 'disabled' : ''}>
      <b>▶ ${verb} — ${variant}</b><span class="actsub">${done ? '✓ THIS WEEK' : disabled ? esc(disabled) : sub}</span>
    </button>
    <button class="actarrow" data-action="gx-sheet" data-id="${kind}" ${done ? 'disabled' : ''}>▾</button>
  </span>`;
}

/** What's highlighted on the board: a prospect, or the next empty slot. */
function gxSelection(s: GameState): { kind: 'pr'; pr: Prospect } | { kind: 'empty' } | { kind: 'none' } {
  const pr = s.prospects.find((x) => x.id === selProspect) ?? null;
  if (pr && !selEmpty) return { kind: 'pr', pr };
  if (s.prospects.length < 9) return { kind: 'empty' };
  if (s.prospects[0]) return { kind: 'pr', pr: s.prospects[0] };
  return { kind: 'none' };
}

function stageGalaxy(s: GameState): string {
  const sel = gxSelection(s);
  const reg = SCAN_REGIONS.find((r) => r.id === selDiscover)!;
  const sAct = PROSPECT_ACTS.find((a) => a.id === selScout)!;
  const rAct = PROSPECT_ACTS.find((a) => a.id === selRecruit)!;
  const grounded = s.groundedWeeks > 0 && !reg.local;
  let buttons: string;
  if (sel.kind === 'pr') {
    const pr = sel.pr;
    buttons =
      actBtn('scout', 'SCOUT', sAct.name, `the cloud sharpens · ${sAct.cost}⚡`,
        (pr.scoutLevel >= 2 && 'KNOWN COLD') || (s.energy < sAct.cost && `NEED ${sAct.cost}⚡`), !!s.scoutActWk) +
      actBtn('recruit', 'RECRUIT', rAct.name, `+${rAct.gain?.[0] ?? 0}–${rAct.gain?.[1] ?? 0}% commit · ${rAct.cost}⚡`,
        (pr.bannedWeeks > 0 && `BANNED ${pr.bannedWeeks}w`) || (s.energy < rAct.cost && `NEED ${rAct.cost}⚡`), !!s.recruitActWk);
  } else if (sel.kind === 'empty') {
    buttons = actBtn('discover', 'DISCOVER', reg.name, `one new name for the board · ${reg.cost}⚡`,
      (grounded && 'GROUNDED') || (s.energy < reg.cost && `NEED ${reg.cost}⚡`), !!s.discoveredWk);
  } else {
    buttons = '';
  }
  return `<h2 class="gridhead">RECRUITING</h2>
    ${prospectGridHtml(s)}
    ${s.groundedWeeks > 0 ? `<div class="fourthrow"><div class="report blink">SHIP GROUNDED ${s.groundedWeeks}w — home scans only</div></div>` : ''}
    <div class="fourthrow actcol">${buttons}</div>`;
}

function stageMatchup(s: GameState): string {
  const m = myMatchup(s);
  const t = myTeam(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const oppName = champ ? champ.name : m ? `${m.opponent.planet} ${m.opponent.name}` : '?';
  const home = champ ? true : m?.home ?? true;
  const awayName = home ? oppName : teamLabel(t);
  const homeName = home ? teamLabel(t) : oppName;
  const scoutBtn = s.scoutedOpp
    ? ''
    : `<button class="hold scoutbtn" data-action="scout-opp" ${s.energy < 1 ? 'disabled' : ''}>SCOUT<br/>1⚡</button>`;
  const sel = selSpeech && s.knownPlans.includes(selSpeech) ? selSpeech : s.knownPlans.includes(s.plan) ? s.plan : s.knownPlans[0];
  const pl = planById(sel);
  const spoken = !!s.speechWk;
  const speech = `<div class="fourthrow actrow"><span class="actwrap runwrap">
      <button class="actmain hold" data-action="speech-run" ${spoken ? 'disabled' : ''}>
        <b>▶ SPEECH — ${spoken ? planById(s.plan).speech : pl.speech}</b>
        <span class="actsub">${spoken ? '✓ THIS WEEK' : `+${ATTR_LABEL[pl.attr]} · FREE`}</span>
      </button>
      <button class="actarrow" data-action="speech-sheet" ${spoken ? 'disabled' : ''}>▾</button>
    </span></div>`;
  return `<h2 class="gridhead">MATCHUP</h2>
    ${gridHtml(s, true)}
    <div class="mu-vs"><b>${esc(awayName)}</b> <span class="dim">@</span> <b>${esc(homeName)}</b></div>
    <div class="mu-bars">${teamBarsMatchup(s)}${scoutBtn}</div>
    ${speech}`;
}

// the speech picker: which truth does the room hear tonight?
function speechSheetHtml(s: GameState): string {
  if (!speechSheet) return '';
  const hint = s.scoutedOpp ? oppPlanHint(s) : null;
  const sel = selSpeech ?? s.plan;
  const items = PLANS.map((pl) => {
    if (!s.knownPlans.includes(pl.id)) return `<div class="drill locked">▓▓▓▓ <span class="dim">undiscovered speech</span></div>`;
    let vs = '';
    if (hint) {
      const wl = wheel(pl.id, hint);
      vs = wl === 'win' ? ' ▲' : wl === 'lose' ? ' ▼' : '';
    }
    return `<button class="drill ${sel === pl.id ? 'sel' : ''}" data-action="speech-pick" data-id="${pl.id}">
      <b>${pl.speech}</b>${vs} <span class="xpg">+${ATTR_LABEL[pl.attr]} · ${teamRating(myTeam(s), pl.id)}</span><br/>
      <span class="ddesc">${esc(pl.fantasy)}</span>
    </button>`;
  }).join('');
  return `<div class="modalback sheet" data-action="speech-sheet-close"><div class="modal sheetup">
    <span class="tag">THE SPEECH</span>
    ${items}
  </div></div>`;
}

function stageGamenight(s: GameState): string {
  if (!s.lastResult) {
    return `<h2>GAME NIGHT</h2><div class="report dim">The shuttle hums...</div>`;
  }
  const r = s.lastResult;
  if (gnStage === 'beat') {
    return `<div id="progress-wrap">
      <div id="progress-label">Tip-off...</div>
      <div class="bar"><div class="fill" id="progress-fill"></div></div>
    </div>`;
  }
  if (gnStage === 'verdict') {
    return `<h2 class="${r.win ? 'won' : 'lost'}">${r.win ? 'VICTORY' : 'DEFEAT'} ${r.myScore}–${r.oppScore}</h2>
      <div class="verdict">
        <div class="vline">${esc(r.wheelLine)}</div>
        <div class="vline">${esc(r.heroLine)}</div>
        <div class="vline dim">${esc(r.boxLine)}</div>
      </div>
      ${gridHtml(s, true)}`;
  }
  const table = !isUtWeek(s)
    ? `<table class="standings">${sortedStandings(s)
        .map((t, i) => `<tr class="${t.id === s.myTeamId ? 'me' : ''}">
          <td>${i + 1}. ${chip(t.name, t.bg, t.fg, true)}</td><td class="num">${t.wins}–${t.losses}</td></tr>
          ${i === 0 ? '<tr class="utline"><td colspan="2">▲ THE UNIVERSAL TOURNAMENT ▲</td></tr>' : ''}`)
        .join('')}</table>`
    : `<div class="report">${(s.ut?.log ?? []).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
  const others = s.resultsLog.length
    ? `<div class="report dim">${s.resultsLog.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
    : '';
  return `<h2>STANDINGS</h2>${table}${others}`;
}

// ---- full views in the same frame ----------------------------------------------------------------------

function stageTeamSelect(s: GameState): string {
  if (poolSelected === null) {
    poolSelected = new Set(
      [...s.selectPool].filter((p) => !p.walkOn).sort((a, b) => ovr(b.attrs) - ovr(a.attrs)).slice(0, ROSTER_SIZE).map((p) => p.id)
    );
  }
  const returning = new Set(myTeam(s).players.map((p) => p.id));
  const commits = new Set(s.commits.map((p) => p.id));
  const sorted = [...s.selectPool].sort((a, b) => ovr(b.attrs) - ovr(a.attrs));
  const rows: string[] = [];
  for (let r = 0; r < Math.ceil(sorted.length / 3); r++) {
    const cells = sorted.slice(r * 3, r * 3 + 3).map((p) => {
      const tag = returning.has(p.id) ? 'RETURNER' : commits.has(p.id) ? 'RECRUIT' : 'WALK-ON';
      return `<div class="gcell">${playerCard(p, { tag, pick: poolSelected!.has(p.id), kit: returning.has(p.id) || commits.has(p.id) ? undefined : PRACTICE_KIT })}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel"></div>${cells}</div>`);
  }
  const n = poolSelected.size;
  const results = s.signingResults.length
    ? `<div class="report">${s.signingResults.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`
    : '';
  return `<h2>${s.season === 0 ? 'TRYOUTS' : 'ROSTER'} — ${n}/${ROSTER_SIZE}</h2>${results}<div class="grid scroll">${rows.join('')}</div>`;
}

function stageDepartures(s: GameState): string {
  const notes = s.seasonNotes.map((x) => `<div>${esc(x)}</div>`).join('');
  const pros = s.proDeparts.length
    ? s.proDeparts.map((d) => {
        if (d.resolved) return `<div class="propane">${esc(d.note)}</div>`;
        const p = myTeam(s).players.find((x) => x.id === d.playerId);
        const chance = p ? clamp(15 + (p.mood - 40), 10, 80) : 15;
        return `<div class="propane"><b>${esc(d.name)}</b> has pro scouts in his dorm lobby.
          <button class="hold" data-action="convince-pro" data-id="${d.playerId}">KEEP HIM ${oddsLine({ pct: chance as 2, cls: 'SPIRIT' }, { pct: (100 - chance) as 2, cls: 'DRAMA' })}</button>
          <button class="hold" data-action="letgo-pro" data-id="${d.playerId}">LET HIM FLY</button></div>`;
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
      const ability = pr.scoutLevel >= 2
        ? `<b style="color:${vc(seen * 1.6)}">${seen}</b>`
        : pr.scoutLevel === 1
          ? `<b>${Math.max(0, seen - 6)}–${seen + 6}</b>`
          : '<b class="dim">??</b>'
      const stars = pr.scoutLevel === 0 ? '<span class="dim">??</span>' : '★'.repeat(potStars(ovr(pr.seenPots)));
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

function stageGrowth(s: GameState): string {
  return `<h2>GROWTH</h2>
    <div class="report">${s.seasonNotes.map((x) => `<div>${esc(x)}</div>`).join('')}</div>`;
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

// One nav language everywhere: an optional small BACK on the left, and one
// hold-to-commit button — always the same size — that names what's next.
function navMain(label: string, action: string, disabled = false): string {
  return `<button class="primary hold navmain" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
function navBack(action: string): string {
  return `<button class="navback" data-action="${action}">BACK</button>`;
}

function nav(s: GameState): string {
  if (currentStory(s)) return `<span class="navnote dim">the galaxy is talking…</span>`;
  switch (s.phase) {
    case 'pickTeam':
      return `<span class="navnote dim">choose your program above</span>`;
    case 'teamSelect':
      return `<span></span>${navMain(poolSelected?.size === ROSTER_SIZE ? 'START' : `PICK ${ROSTER_SIZE}`, 'confirm-roster', poolSelected?.size !== ROSTER_SIZE)}`;
    case 'practice':
      return `<span></span>${navMain('TO RECRUITING', 'to-galaxy')}`;
    case 'galaxy':
      return `${navBack('to-practice')}${navMain('TO MATCHUP', 'to-matchup')}`;
    case 'matchup':
      return `${isUtWeek(s) ? '<span></span>' : navBack('to-galaxy')}${navMain(s.speechWk ? 'PLAY' : 'SPEECH FIRST', 'play-game', !s.speechWk)}`;
    case 'gamenight': {
      if (!s.lastResult || gnStage === 'beat') return `<span class="navnote dim">…</span>`;
      if (gnStage === 'verdict') return `<span></span>${navMain('STANDINGS', 'gn-table')}`;
      return `<span></span>${navMain('NEXT WEEK', 'continue-result')}`;
    }
    case 'departures': {
      const unresolved = s.proDeparts.some((d) => !d.resolved);
      return `<span></span>${navMain(unresolved ? 'YOUR STARS FIRST' : 'SIGNING DAY', 'to-signing', unresolved)}`;
    }
    case 'signing':
      return `<span></span>${navMain('SEND LETTERS', 'do-signing')}`;
    case 'growth':
      return `<span></span>${navMain(`SEASON ${s.season + 1}`, 'new-season')}`;
    case 'gameover':
      return `<span></span>${navMain('NEW GAME', 'new-game-direct')}`;
    default:
      return '';
  }
}

// ---- overlays --------------------------------------------------------------------------------------------------

function drillSheetHtml(s: GameState): string {
  if (!drillSheet) return '';
  const drills = DRILLS.map((d) => {
    const unlocked = s.unlockedDrills.includes(d.id);
    if (!unlocked) return `<div class="drill locked">▓▓▓▓ <span class="dim">undiscovered method</span></div>`;
    const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
    const what = gains
      ? `<span class="xpg gaintag">${gains}${d.target === 'one' ? ' · ONE PLAYER' : ''}</span>`
      : d.xp[1] > 0
        ? `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP${d.target === 'one' ? ' · ONE PLAYER' : ''}</span>`
        : '<span class="xpg">squad ⚡ up</span>';
    return `<button class="drill ${selectedDrill === d.id ? 'sel' : ''}" data-action="drill-pick" data-id="${d.id}">
      <b>${d.name}</b> ${what}
      ${oddsLine(d.up, d.down, d.cost)}
    </button>`;
  }).join('');
  return `<div class="modalback sheet" data-action="drill-sheet-close"><div class="modal sheetup">
    <span class="tag">THE PRACTICE</span>
    ${drills}
  </div></div>`;
}

// the discover / scout / recruit variant pickers — small, non-scrolling
function galaxySheetHtml(s: GameState): string {
  if (!galaxySheet) return '';
  let items: string;
  if (galaxySheet === 'discover') {
    items = SCAN_REGIONS.filter((r) => s.unlockedRegions.includes(r.id)).map((r) => {
      const grounded = s.groundedWeeks > 0 && !r.local;
      return `<button class="drill ${selDiscover === r.id ? 'sel' : ''}" data-action="gx-pick" data-id="${r.id}" ${grounded ? 'disabled' : ''}>
        <b>${r.name}</b>${grounded ? ' <span class="blink">GROUNDED</span>' : ''} ${oddsLine(r.up, r.down, r.cost)}
      </button>`;
    }).join('');
  } else {
    const kind = galaxySheet === 'scout' ? 'scout' : 'recruit';
    items = PROSPECT_ACTS.filter((a) => a.kind === kind).map((a) =>
      `<button class="drill ${(kind === 'scout' ? selScout : selRecruit) === a.id ? 'sel' : ''}" data-action="gx-pick" data-id="${a.id}">
        <b>${a.name}</b>${a.gain ? ` <span class="xpg">+${a.gain[0]}–${a.gain[1]}%</span>` : ''} ${oddsLine(a.up, a.down, a.cost)}
      </button>`
    ).join('');
  }
  return `<div class="modalback sheet" data-action="gx-sheet-close"><div class="modal sheetup">
    <span class="tag">${galaxySheet.toUpperCase()}</span>
    ${items}
  </div></div>`;
}

// THE RESULT: everything darkens except the energy bar, the spent ⚡ blasts
// away one cell at a time, then the typewriter says what happened.
function gxResultHtml(): string {
  if (!gxResult) return '';
  return `<div class="modalback gxback" data-action="gx-result-tap"><div class="modal gxmodal">
    <span class="tag">THE TRAIL</span>
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div></div>`;
}

// forgetting a prospect is forever — say so once
function dropConfirmHtml(s: GameState): string {
  if (dropConfirm === null) return '';
  const pr = s.prospects.find((x) => x.id === dropConfirm);
  if (!pr) return '';
  return `<div class="modalback"><div class="modal">
    <span class="tag">FORGET HIM?</span>
    <p>Are you sure you want to forget about ${esc(pr.name)}? You won't be able to find him again.</p>
    <button class="wide hold danger" data-action="pr-drop" data-id="${pr.id}">✕ FORGET ${esc(pr.name.toUpperCase())}</button>
    <button class="wide" data-action="pr-drop-cancel">KEEP HIM</button>
  </div></div>`;
}

function itemModalHtml(s: GameState): string {
  if (!itemUi) return '';
  const item = itemById(itemUi);
  const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
  const ev = currentStory(s);
  const storyKey = ev?.choices?.find((c) => c.itemId === item.id && !ev.resolvedText)?.key ?? null;
  const phaseOk = !ev && ['practice', 'matchup', 'galaxy'].includes(s.phase);
  const usable = !spent && (storyKey !== null || phaseOk);
  return `<div class="modalback" data-action="item-close"><div class="modal">
    <div class="itemcard ${item.rarity}">
      <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
      <i class="dim">${esc(item.flavor)}</i><br/>
      ${esc(item.effectText)}<br/>${oddsLine(item.up, item.down)}
    </div>
    <button class="wide hold" data-action="use-item" data-id="${item.id}" ${usable ? '' : 'disabled'}>
      ${spent ? 'USED THIS SEASON' : storyKey ? '◆ USE IT ON THIS STORY' : usable ? 'USE NOW' : 'NOT THE MOMENT'}</button>
    <button class="wide" data-action="item-close">CLOSE</button>
  </div></div>`;
}

function coachModalHtml(s: GameState): string {
  if (!coachOpen) return '';
  const drills = DRILLS.map((d) =>
    s.unlockedDrills.includes(d.id) ? `<div>✓ ${d.name}</div>` : `<div class="dim">▓▓▓ undiscovered</div>`
  ).join('');
  const regions = SCAN_REGIONS.map((r) =>
    s.unlockedRegions.includes(r.id) ? `<div>✓ ${r.name}</div>` : `<div class="dim">▓▓▓ uncharted</div>`
  ).join('');
  const tactics = PLANS.map((pl) =>
    s.knownPlans.includes(pl.id) ? `<div>✓ ${pl.name} <span class="dim">(${ATTR_LABEL[pl.attr]})</span></div>` : `<div class="dim">▓▓▓ unlearned tactic</div>`
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

  const ev = currentStory(state);
  if (ev && ev.uid !== storyUid) {
    storyUid = ev.uid;
    stageTyped = false;
    impact = null;
    impactPlayed = false;
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
      case 'practice': middle = stagePractice(state); break;
      case 'galaxy': middle = stageGalaxy(state); break;
      case 'matchup': middle = stageMatchup(state); break;
      case 'gamenight': middle = stageGamenight(state); break;
      case 'departures': middle = stageDepartures(state); break;
      case 'signing': middle = stageSigning(state); break;
      case 'growth': middle = stageGrowth(state); break;
      default: middle = `<h2>THIS WEEK</h2>`;
    }
  }

  // popups live INSIDE the middle: the stats bar, THE BAG and the nav stay
  // visible (⚡ readable while a story asks you to spend it) — the nav just dims.
  const overlays = drillSheetHtml(state) + galaxySheetHtml(state) + speechSheetHtml(state) + gxResultHtml() + dropConfirmHtml(state) + toastModalHtml() + itemModalHtml(state) + coachModalHtml(state);
  const modalOpen = drillSheet || speechSheet || coachOpen || itemUi !== null || toast !== null || galaxySheet !== null || dropConfirm !== null || gxResult !== null;
  const navHtml = `<div class="navbar ${modalOpen ? 'dimmed' : ''}">${nav(state)}</div>`;
  const lensHtml = (state.phase === 'practice' || state.phase === 'galaxy') && !ev ? lensBar() : '';
  const frame = state.phase === 'pickTeam' || state.phase === 'gameover'
    ? `<div class="midwrap"><div class="middle solo">${middle}</div>${overlays}</div>${navHtml}`
    : `${headerHtml(state)}<div class="midwrap"><div class="middle">${middle}</div>${overlays}</div>${bagBar(state)}${lensHtml}${navHtml}`;

  app.innerHTML = frame;
  postRender();
}

function revealActions(): void {
  document.getElementById('modal-actions')?.classList.remove('hide');
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
      if (gxResult === r) typewrite(box0 as HTMLElement | null, r.text, revealActions);
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
  }

  if (state.phase === 'gamenight' && state.lastResult && gnStage === 'beat' && !state.queue.length) {
    animateProgress();
  }
}

function animateProgress(): void {
  const stages = ['Tip-off!', 'First half...', 'Halftime. You point at the whiteboard.', 'Second half...', 'Crunch time...', 'Final horn.'];
  const TICKS = 24;
  let tick = 0;
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const finish = (): void => {
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    gnStage = 'verdict';
    render();
    // deltas land as STICKERS on the cards (rendered by gridHtml) and stay
  };
  progressTimer = window.setInterval(() => {
    tick++;
    if (tick > TICKS) { finish(); return; }
    if (fill) fill.style.width = `${Math.round((tick / TICKS) * 100)}%`;
    if (label) label.textContent = stages[Math.min(stages.length - 1, Math.floor((tick / TICKS) * stages.length))];
  }, 90);
  document.getElementById('progress-wrap')?.addEventListener('click', finish);
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
  kind: 'card' | 'item';
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
  return ['practice', 'matchup', 'gamenight'].includes(state.phase) && !currentStory(state);
}

function handleDrop(zoneIdx: number, playerId: number): void {
  const t = myTeam(state);
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.outWeeks > 0) return;
  const from = t.lineup.slots.indexOf(playerId);
  if (from < 0 || from === zoneIdx) return;
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

function dropItemOnStory(itemId: string): void {
  const ev = currentStory(state);
  const key = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
  if (!key) return;
  doResolve(key);
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
  document.querySelectorAll('.dropzone.dragover, .storypanel.dragover').forEach((z) => z.classList.remove('dragover'));
  targetAtPoint()?.classList.add('dragover');
}

function targetAtPoint(): Element | null {
  if (!ptr) return null;
  const el = document.elementFromPoint(ptr.lastX, ptr.lastY);
  if (!el) return null;
  return ptr.kind === 'item' ? el.closest('.storypanel') : el.closest('.dropzone');
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
    document.querySelectorAll('.dropzone.dragover, .storypanel.dragover').forEach((z) => z.classList.remove('dragover'));
    if (target) {
      if (ptr.kind === 'card') handleDrop(Number(target.getAttribute('data-zone')), ptr.pid);
      else dropItemOnStory(ptr.itemId);
      ptr = null;
      render();
      return;
    }
  }
  ptr = null;
}

app.addEventListener('pointerdown', (e) => {
  const bag = (e.target as HTMLElement).closest('.bslot.filled') as HTMLElement | null;
  if (bag && currentStory(state)) {
    ptr = {
      pointerId: e.pointerId, kind: 'item', pid: -1, itemId: bag.getAttribute('data-bagitem')!, el: bag,
      startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
      active: false, holdTimer: 0, ghost: null,
    };
    if (e.pointerType === 'touch') ptr.holdTimer = window.setTimeout(() => activateDrag(), 220);
    return;
  }
  if (!gridDraggablePhase()) return;
  const card = (e.target as HTMLElement).closest('.pcard.grabbable') as HTMLElement | null;
  if (!card) return;
  ptr = {
    pointerId: e.pointerId, kind: 'card', pid: Number(card.getAttribute('data-pid')), itemId: '', el: card,
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
      const out = runDrill(state, selectedDrill);
      if (out) floatDrill(out, d.cost);
      break;
    }

    case 'to-practice': toPractice(state); break;
    case 'to-galaxy': drillSheet = false; toGalaxy(state); break;
    case 'to-matchup': galaxySheet = null; dropConfirm = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'gn-table': gnStage = 'table'; clearFloatTimers(); break;
    case 'continue-result': gnStage = 'beat'; clearFloatTimers(); continueFromResult(state); break;

    case 'pr-drop': {
      actionDropProspect(state, Number(id));
      if (selProspect === Number(id)) selProspect = null;
      dropConfirm = null;
      break;
    }

    case 'gx-run': {
      if (id === 'discover') {
        const reg = SCAN_REGIONS.find((r) => r.id === selDiscover)!;
        const text = actionScan(state, selDiscover);
        if (text !== null) {
          const fresh = state.prospects[state.prospects.length - 1];
          if (fresh) { selProspect = fresh.id; selEmpty = false; }
          gxResult = { text, cost: reg.cost, played: false };
        }
      } else {
        const sel = gxSelection(state);
        if (sel.kind !== 'pr') break;
        const actId = id === 'scout' ? selScout : selRecruit;
        const act = PROSPECT_ACTS.find((a) => a.id === actId)!;
        const text = actionProspect(state, sel.pr.id, actId);
        if (text !== null) gxResult = { text, cost: act.cost, played: false };
      }
      break;
    }

    case 'scout-opp': if (scoutOpponent(state)) floatEnergyBig(1); break;
    case 'speech-run': {
      const sel = selSpeech && state.knownPlans.includes(selSpeech) ? selSpeech : state.knownPlans.includes(state.plan) ? state.plan : state.knownPlans[0];
      deliverSpeech(state, sel);
      break;
    }
    case 'play-game': gnStage = 'beat'; clearFloatTimers(); playGame(state); break;

    case 'convince-pro': convincePro(state, Number(id)); break;
    case 'letgo-pro': letGoPro(state, Number(id)); break;
    case 'retire': retire(state); break;
    case 'do-signing': poolSelected = null; resolveSigning(state); break;
    case 'confirm-roster':
      if (poolSelected && finalizeRoster(state, [...poolSelected])) {
        poolSelected = null;
      }
      break;
    case 'new-season': startNewSeason(state); break;

    case 'use-item': {
      const itemId = id;
      const ev = currentStory(state);
      const storyKey = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
      itemUi = null;
      if (storyKey) {
        doResolve(storyKey);
      } else {
        const text = useItem(state, itemId, selProspect !== null ? { prospectId: selProspect } : {});
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
      galaxySheet = null;
      dropConfirm = null;
      selProspect = null;
      selectedDrill = 'shootaround';
      poolSelected = null;
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

    case 'card': {
      const pid = Number(id);
      if (currentStory(state)) break;
      if (state.phase === 'teamSelect') {
        if (poolSelected) {
          if (poolSelected.has(pid)) poolSelected.delete(pid);
          else if (poolSelected.size < ROSTER_SIZE) poolSelected.add(pid);
        }
      }
      break;
    }
    case 'pr-select': selProspect = Number(id); selEmpty = false; break;
    case 'gx-empty': selProspect = null; selEmpty = true; break;
    case 'gx-result-tap':
      if (finishTypeNow()) return;
      clearFloatTimers();
      gxResult = null;
      break;
    case 'pr-forget': dropConfirm = Number(id); break;
    case 'pr-drop-cancel': dropConfirm = null; break;
    case 'gx-sheet': galaxySheet = id as 'discover' | 'scout' | 'recruit'; break;
    case 'gx-sheet-close': if (e.target === el) galaxySheet = null; break;
    case 'gx-pick':
      if (galaxySheet === 'discover') selDiscover = id;
      else if (galaxySheet === 'scout') selScout = id;
      else if (galaxySheet === 'recruit') selRecruit = id;
      galaxySheet = null;
      break;
    case 'drill-pick': selectedDrill = id; drillSheet = false; break;
    case 'speech-sheet': speechSheet = true; break;
    case 'speech-sheet-close': if (e.target === el) speechSheet = false; break;
    case 'speech-pick': selSpeech = id as PlanId; speechSheet = false; break;
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
