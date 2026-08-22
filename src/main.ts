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
  speciesById,
} from './engine/data';
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, ROSTER_SIZE, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, slotMult, slotPlayer, teamKite, teamRating, wheel } from './engine/sim';
import {
  actionDropProspect,
  actionProspect,
  actionScan,
  chooseTeam,
  continueFromResult,
  convincePro,
  currentStory,
  dismissStory,
  effectiveChances,
  finalizeRoster,
  freshGame,
  isUtWeek,
  lastLevelUps,
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
  setPlan,
  showTip,
  sortedStandings,
  startNewSeason,
  starters,
  toGalaxy,
  toMatchup,
  toPractice,
  toSigning,
  toggleProspect,
  toggleSitout,
  toggleTips,
  useItem,
  utOpponent,
  weekLabel,
  winMeter,
  wipeSave,
} from './engine/state';
import type { AttrRec, GameState, PlanId, Player, Prospect, Team } from './engine/types';
import type { Fx } from './engine/types';
import { ATTRS, SIZE_LABELS, attrEff, clamp, copyAttrs, ovr, perGame, sizeIndex } from './engine/util';
import { PRACTICE_KIT, iconUrl, spriteUrl, type Kit } from './rig';

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
let prospectUi: { id: number; text?: string } | null = null;
let scanUi: { open: boolean; text?: string } | null = null;
let drillSheet = false;
let drillPickOne: string | null = null;
let detailPlayerId: number | null = null;
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
  const res = resolveStory(state, key);
  if (!res) return;
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

function typewrite(el: HTMLElement | null, text: string, done: () => void): void {
  stopType();
  if (!el) { done(); return; }
  typeState = { el, text, done };
  let i = 0;
  el.textContent = '';
  typeTimer = window.setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) { stopType(); done(); }
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

interface KiteOpts {
  pot?: AttrRec | null;
  start?: AttrRec | null;
  caps?: AttrRec | null;
  ovrText?: string;
  fuzz?: 0 | 1 | 2; // scouting cloud: 2 = rumor, 1 = one look, 0 = truth
  cls?: string; // 'mini' | 'grow' | 'full'
}

function kite(cur: AttrRec, opts: KiteOpts = {}): string {
  const fuzz = opts.fuzz ?? 0;
  return `<div class="kite ${opts.cls ?? 'mini'} ${fuzz ? `fuzzy${fuzz}` : ''}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <line class="k-axis" x1="50" y1="4" x2="50" y2="96"/>
      <line class="k-axis" x1="4" y1="50" x2="96" y2="50"/>
      ${opts.caps ? `<polygon class="k-caps" points="${kitePoints(opts.caps)}"/>` : ''}
      ${opts.pot ? `<polygon class="k-pot" points="${kitePoints(opts.pot)}"/>` : ''}
      ${opts.start ? `<polygon class="k-start" points="${kitePoints(opts.start)}"/>` : ''}
      <polygon class="k-cur" points="${kitePoints(cur)}"/>
    </svg>
    <span class="klabel n">SKL</span><span class="klabel e">ATH</span>
    <span class="klabel s">FRC</span><span class="klabel w">BRN</span>
    ${opts.ovrText !== undefined ? `<span class="k-ovr">${opts.ovrText}</span>` : ''}
  </div>`;
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
  sprite?: string | null;
  nameHtml: string; // the top strip
  blHtml: string; // bottom-left (the big number)
  brHtml: string; // bottom-right (a ring or a chip)
}

function squareKite(cur: AttrRec, o: SqOpts): string {
  return `<div class="ksq ${o.fuzz ? `fuzzy${o.fuzz}` : ''}">
    <svg class="ksvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line class="k-axis" x1="50" y1="4" x2="50" y2="96"/>
      <line class="k-axis" x1="4" y1="50" x2="96" y2="50"/>
      ${o.pot ? `<polygon class="k-pot" points="${kitePoints(o.pot)}"/>` : ''}
      ${o.start ? `<polygon class="k-start" points="${kitePoints(o.start)}"/>` : ''}
      <polygon class="k-cur" points="${kitePoints(cur)}"/>
    </svg>
    <span class="klabel n">SKL</span><span class="klabel e">ATH</span>
    <span class="klabel s">FRC</span><span class="klabel w">BRN</span>
    ${o.sprite ? `<img class="ksprite" src="${o.sprite}" alt="" draggable="false"/>` : ''}
    <div class="ktop">${o.nameHtml}</div>
    <span class="kbl">${o.blHtml}</span>
    <span class="kbr">${o.brHtml}</span>
  </div>`;
}

// ---- the three lenses -----------------------------------------------------------
// One squad, three questions: SKILLS (who is he), STATS (what has he done),
// GROWTH (where did he start, how far can he go). Same faces, same places.

type Lens = 0 | 1 | 2;
const LENS_NAMES = ['SKILLS', 'STATS', 'GROWTH'];
let lens: Lens = 0;

type CrownKey = 'pts' | 'reb' | 'stl' | 'ast';
const STAT_KEYS: CrownKey[] = ['pts', 'reb', 'stl', 'ast'];
const STAT_LABEL: Record<CrownKey, string> = { pts: 'PTS', reb: 'REB', stl: 'STL', ast: 'AST' };

/** Who leads the roster in each per-game stat (season lens crowns). */
function crownMap(players: Player[]): Map<CrownKey, number> {
  const m = new Map<CrownKey, number>();
  for (const k of STAT_KEYS) {
    let best: Player | null = null;
    let bestV = 0;
    for (const p of players) {
      if (p.stats.gp === 0) continue;
      const v = p.stats[k] / p.stats.gp;
      if (v > bestV) { bestV = v; best = p; }
    }
    if (best && bestV > 0) m.set(k, best.id);
  }
  return m;
}

interface CardOpts {
  lens?: Lens;
  kit?: Kit;
  tag?: string;
  inert?: boolean;
  draggable?: boolean;
  sitout?: boolean;
  miscast?: number; // % penalty to print
  pick?: boolean; // selection screens
  crowns?: Map<CrownKey, number>;
}

function cardHead(p: Player, opts: CardOpts): string {
  return `<div class="pc-head">
      <span class="pc-lvl">L${p.level}</span>
      <span class="pc-name" ${opts.inert ? '' : `data-action="detail" data-id="${p.id}"`}>${esc(p.name)}</span>
      <span class="pc-year">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>
    </div>`;
}

// The card, phone-first, one lens at a time. SKILLS: the full-bleed square
// kite, sprite centered, OVR bottom-left, XP ring (LVL inside) bottom-right.
// STATS: the season box score. GROWTH: the same square, layered — dashes where
// the season started, outline where he can go, POT chip instead of the ring.
function playerCard(p: Player, opts: CardOpts = {}): string {
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const out = p.outWeeks > 0;
  const img = spriteUrl(p, kit, p.jersey);
  const l = opts.lens ?? 0;
  const xpPct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  const nameHtml = `<span class="kname" ${opts.inert ? '' : `data-action="detail" data-id="${p.id}"`}>${esc(p.name)}</span>
      <span class="kyear">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>`;
  const ovrHtml = `<b class="kovr" style="color:${vc(ovr(p.attrs) * 1.6)}">${ovr(p.attrs)}</b>`;
  let body: string;
  if (l === 1) {
    const cells = STAT_KEYS.map((k) => {
      const crown = opts.crowns?.get(k) === p.id;
      return `<div class="strow ${crown ? 'lead' : ''}"><i>${STAT_LABEL[k]}</i><b>${perGame(p.stats, k)}</b>${crown ? '<span class="crown">♛</span>' : ''}</div>`;
    }).join('');
    body = `${cardHead(p, opts)}<div class="pc-stats">
        <img class="sprite tiny" src="${img}" alt="" draggable="false"/>
        <div class="stgrid">${cells}</div>
      </div>
      <div class="pc-gp">GP ${p.stats.gp}${p.career.gp ? ` · CAREER ${p.career.gp}` : ''}</div>`;
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
      sprite: img,
      nameHtml,
      blHtml: ovrHtml,
      brHtml: ringCounter(xpPct, 'LVL', String(p.level), `level ${p.level}/${LEVEL_CAP} · xp ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)}`),
    });
  }
  return `<div class="pcard lens${l} ${l !== 1 ? 'sq' : ''} ${out ? 'pout' : ''} ${opts.draggable && !out && l === 0 ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    ${body}
    ${out ? `<div class="ptag blink">OUT ${p.outWeeks}w</div>` : ''}
    ${opts.sitout && l === 0 ? '<div class="ptag dimtag">SITS OUT</div>' : ''}
    ${opts.miscast && opts.miscast >= 8 && !out && l === 0 ? `<div class="ptag">MISCAST −${opts.miscast}%</div>` : ''}
    ${opts.pick !== undefined ? `<div class="picktag ${opts.pick ? 'on' : ''}">${opts.pick ? '☑ ON THE SQUAD' : '☐ TAP TO PICK'}</div>` : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
  </div>`;
}

// Prospects wear the same square: the kite as a CLOUD that scouting sharpens,
// sprite centered, seen OVERALL bottom-left, the commit ring bottom-right.
function prospectCard(pr: Prospect): string {
  const img = spriteUrl(pr, PRACTICE_KIT, null);
  const known = pr.scoutLevel;
  const q = known < 2 ? '?' : '';
  return `<div class="pcard prospect sq" data-action="pcell" data-id="${pr.id}" data-pid="p${pr.id}">
    ${squareKite(pr.seenAttrs, {
      pot: pr.seenPots,
      fuzz: known >= 2 ? 0 : known === 1 ? 1 : 2,
      sprite: img,
      nameHtml: `<span class="kname">${esc(pr.name)}</span><span class="kyear">${SIZE_LABELS[sizeIndex(pr)]}</span>`,
      blHtml: `<b class="kovr" style="color:${vc(ovr(pr.seenAttrs) * 1.6)}">${ovr(pr.seenAttrs)}${q}</b>`,
      brHtml: ringCounter(pr.commitPct, 'COM', `${pr.commitPct}`, `commitment ${pr.commitPct}%`),
    })}
    ${pr.bannedWeeks > 0 ? `<div class="ptag blink">BANNED ${pr.bannedWeeks}w</div>` : ''}
  </div>`;
}

// ---- header (always there) ---------------------------------------------------------------------

// JOB SECURITY: a bright bar the darkness eats from both ends —
// scholar cap = the school's heat (left), shades = the boosters' (right).
function jobBar(s: GameState): string {
  const danger = s.heatS + s.heatB >= 75;
  return `<div class="jobbar ${danger ? 'blink' : ''}" title="job security — school heat ${s.heatS} · booster heat ${s.heatB}">
    <img class="jicon" src="${iconUrl('cap', ramp(0.75))}" alt=""/>
    <div class="jtrack">
      <div class="jdark l" style="width:${s.heatS}%"></div>
      <div class="jdark r" style="width:${s.heatB}%"></div>
      <span class="jlabel">JOB SECURITY</span>
    </div>
    <img class="jicon" src="${iconUrl('shades', ramp(0.75))}" alt=""/>
  </div>`;
}

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const cells = Array.from({ length: CACHE_MAX }, (_, i) =>
    `<span class="ecell ${i < s.energy ? 'on' : ''}" style="${i < s.energy ? `background:${ramp(0.35 + 0.55 * (i / CACHE_MAX))}` : ''}"></span>`
  ).join('');
  return `<div class="topbar">
    <div class="hrow hrow1">
      ${chip(t.name, t.bg, t.fg)}
      <span class="seasoninfo">S<b>${Math.max(1, s.season)}</b></span>
      ${jobBar(s)}
      <span class="hbtns">
        <button class="hbtn" data-action="help">?</button>
        <button class="hbtn" data-action="coach-open">⚙</button>
      </span>
    </div>
    <div class="hrow hrow2">
      <span class="weeklab"><b>${weekLabel(s)}</b> · ${t.wins}–${t.losses}</span>
      <span class="ecache ${s.energy === 0 ? 'blink' : ''}" title="power cells ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">${cells}⚡</span>
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
  const crowns = gridLens === 1 ? crownMap(t.players) : undefined;
  const colHead = `<div class="colhead"><span class="rowlabel"></span>${COL_LABELS.map((c) => `<span>${c}</span>`).join('')}</div>`;
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const p = slotPlayer(t, idx);
      const mult = p && r < 2 ? slotMult(p, c) : 1;
      return `<div class="gcell dropzone" data-zone="${idx}">
        ${p
          ? playerCard(p, { lens: gridLens, crowns, draggable, sitout: isPractice && s.sitouts.includes(p.id), miscast: Math.round((1 - mult) * 100) })
          : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${ROW_LABELS[r]}</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

function prospectGridHtml(s: GameState): string {
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const pr = s.prospects[r * 3 + c];
      return `<div class="gcell">${pr ? prospectCard(pr) : '<button class="pod empty scanpod" data-action="scancell">+ SCAN</button>'}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${r === 0 ? 'BOARD' : ''}</div>${cells}</div>`);
  }
  return `<div class="grid">${rows.join('')}</div>`;
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
    ${p ? `<img class="imp-sprite" src="${spriteUrl(p, { bg: t.bg, fg: t.fg }, p.jersey)}" alt=""/><div class="imp-name">${esc(p.name)}</div>` : ''}
    <div class="imp-rows">${rows}</div>
  </div>`;
}

// One thing at a time: a typed beat, OR the decision, OR the impact.
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
  if (storyMode === 'choices' && ev.choices && !ev.resolvedText) {
    const beats = splitBeats(ev.text);
    let actions = ev.choices
      .filter((c) => !c.itemId) // items live in THE BAG below — tap or drag them in
      .map((c) => {
        const cant = c.cost !== undefined && s.energy < c.cost;
        return `<button class="wide hold" data-action="story-choice" data-id="${esc(c.key)}" ${cant || c.disabled ? 'disabled' : ''}>
          ${esc(c.label)}${cant ? ' — NOT ENOUGH ⚡' : ''}<br/>${oddsLine(c.up, c.down, c.cost)}</button>`;
      }).join('');
    if (ev.choices.some((c) => c.itemId)) {
      actions += `<div class="itemhint blink">◆ something in THE BAG could help — tap it below</div>`;
    }
    return `<div class="storypanel" data-action="story-tap" id="storypanel">
      <span class="tag">${esc(ev.tag)}</span>
      ${p ? `<div class="modalcard">${playerCard(p, { inert: true })}</div>` : ''}
      <div class="typebox">${esc(beats[beats.length - 1])}</div>
      <div class="modal-actions" id="modal-actions">${actions}</div>
    </div>`;
  }
  // a single typed beat, center stage
  return `<div class="storypanel" data-action="story-tap" id="storypanel">
    <span class="tag">${esc(ev.tag)}</span>
    <div class="typebox beatbox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div>`;
}

// ---- stages (middle content per phase) -----------------------------------------------------------------

function lensBar(): string {
  const tabs = LENS_NAMES.map((n, i) =>
    `<button class="lenstab ${lens === i ? 'sel' : ''}" data-action="lens-set" data-id="${i}">${n}</button>`).join('');
  return `<div class="lensbar">
    <button class="lensarrow" data-action="lens-prev">‹</button>${tabs}<button class="lensarrow" data-action="lens-next">›</button>
  </div>`;
}

function stagePractice(s: GameState): string {
  const t = myTeam(s);
  let fourth: string;
  if (lens === 1) {
    const top = [...t.players].filter((p) => p.stats.gp > 0).sort((a, b) => b.stats.pts / b.stats.gp - a.stats.pts / a.stats.gp)[0];
    fourth = `<div class="fourthrow"><div class="report">SEASON ${t.wins}–${t.losses} · ${t.pointsFor} PF / ${t.pointsAgainst} PA${top ? ` · ${esc(top.name)} leads at ${perGame(top.stats, 'pts')} ppg` : ''}</div></div>`;
  } else if (lens === 2) {
    const fresh = t.players.filter((p) => p.classYear >= 3).length;
    fourth = `<div class="fourthrow"><div class="report dim">dashes = season start · outline = potential${fresh ? ` · ${fresh} senior${fresh > 1 ? 's' : ''} in the final year` : ''}</div></div>`;
  } else {
    fourth = drillPickOne
      ? `<div class="fourthrow"><button class="bigctl blink" data-action="drill-cancel">TAP THE PLAYER — or tap here to cancel</button></div>`
      : s.trainedThisWeek
        ? `<div class="fourthrow"><div class="report">${esc(s.drillReport ?? 'Practice is done.')}</div><button class="bigctl again" data-action="drill-sheet">⬆ AGAIN</button></div>`
        : `<div class="fourthrow"><button class="bigctl" data-action="drill-sheet">⬆ CHOOSE THE DRILL</button></div>`;
  }
  return `${lensBar()}${gridHtml(s, lens === 0, lens)}${fourth}`;
}

function stageGalaxy(s: GameState): string {
  return `<h2>RECRUITING</h2>
    ${prospectGridHtml(s)}
    <div class="fourthrow">${s.groundedWeeks > 0 ? `<div class="report blink">SHIP GROUNDED ${s.groundedWeeks}w — home scans only</div>` : `<div class="report dim">tap a prospect · tap an empty slot to scan</div>`}</div>`;
}

function stageMatchup(s: GameState): string {
  const m = winMeter(s);
  const hint = oppPlanHint(s);
  let oppBit: string;
  if (isUtWeek(s)) {
    const c = utOpponent(s)!;
    oppBit = `<span class="oppkite">${kite(c.kite, { fuzz: 0 })}</span>
      ${chip(c.name, c.bg, c.fg, true)} <span class="dim">${esc(c.gimmick)}</span> · they live in <b>${planById(c.plan).name}</b>`;
  } else {
    const mu = myMatchup(s)!;
    oppBit = `${s.scoutedOpp ? `<span class="oppkite">${kite(teamKite(mu.opponent), { fuzz: 0 })}</span>` : ''}
      ${chip(mu.opponent.name, mu.opponent.bg, mu.opponent.fg, true)} <b>${mu.opponent.wins}–${mu.opponent.losses}</b> ${mu.home ? 'HOME' : 'AWAY'}
      ${s.scoutedOpp && hint
        ? `· they'll come out in <b>${planById(hint).name}</b> at <b>${teamRating(mu.opponent, hint)}</b>`
        : `<button class="hold scoutbtn" data-action="scout-opp" ${s.energy < 1 ? 'disabled' : ''}>SCOUT 1⚡</button>`}`;
  }
  const meter = m
    ? `<span class="bigval" style="color:${vc(m.exact ? m.lo : (m.lo + m.hi) / 2)}">${m.exact ? `${m.lo}%` : `${m.lo}–${m.hi}%`}</span>`
    : '';
  const plans = PLANS.map((pl) => {
    const known = s.knownPlans.includes(pl.id);
    if (!known) {
      return `<button class="planchip locked" disabled><b>▓▓▓</b><br/><span class="dim">unlearned</span></button>`;
    }
    const rating = teamRating(myTeam(s), pl.id);
    let vs = '';
    if (hint) {
      const w = wheel(pl.id, hint);
      vs = w === 'win' ? ' ▲' : w === 'lose' ? ' ▼' : '';
    }
    return `<button class="planchip ${s.plan === pl.id ? 'sel' : ''}" data-action="plan" data-id="${pl.id}">
      <b>${pl.name}</b>${vs}<br/><span style="color:${vc(rating * 1.6)}">${rating}</span></button>`;
  }).join('');
  return `<div class="mustrip"><span class="muq">MATCHUP</span> ${meter}<div class="oppbit">${oppBit}</div></div>
    ${gridHtml(s, true)}
    <div class="fourthrow planrow">${plans}</div>`;
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
      const q = pr.scoutLevel < 2 ? '?' : '';
      return `<tr>
        <td><button class="signbtn" data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑' : '☐'}</button></td>
        <td>${esc(pr.name)}</td>
        <td class="num"><b style="color:${vc(ovr(pr.seenAttrs) * 1.6)}">${ovr(pr.seenAttrs)}${q}</b><span class="dim">/${ovr(pr.seenPots)}${q}</span></td>
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

function nav(s: GameState): string {
  if (currentStory(s)) return `<span class="navnote dim">the galaxy is talking…</span>`;
  switch (s.phase) {
    case 'pickTeam':
      return `<span class="navnote dim">choose your program above</span>`;
    case 'teamSelect':
      return `<span></span><button class="primary hold" data-action="confirm-roster" ${poolSelected?.size === ROSTER_SIZE ? '' : 'disabled'}>
        ${poolSelected?.size === ROSTER_SIZE ? '▶ START' : `PICK ${ROSTER_SIZE}`}</button>`;
    case 'practice':
      return `<span></span><button class="primary" data-action="to-galaxy">CONTINUE ▶</button>`;
    case 'galaxy':
      return `<button data-action="to-practice">◀</button><button class="primary" data-action="to-matchup">CONTINUE ▶</button>`;
    case 'matchup':
      return `${isUtWeek(s) ? '<span></span>' : '<button data-action="to-galaxy">◀</button>'}
        <button class="primary hold" data-action="play-game">▶ PLAY</button>`;
    case 'gamenight': {
      if (!s.lastResult || gnStage === 'beat') return `<span class="navnote dim">…</span>`;
      if (gnStage === 'verdict') return `<span></span><button class="primary" data-action="gn-table">CONTINUE ▶</button>`;
      return `<span></span><button class="primary" data-action="continue-result">NEXT WEEK ▶</button>`;
    }
    case 'departures': {
      const unresolved = s.proDeparts.some((d) => !d.resolved);
      return `<span></span><button class="primary" data-action="to-signing" ${unresolved ? 'disabled' : ''}>
        ${unresolved ? 'YOUR STARS FIRST' : 'SIGNING DAY ▶'}</button>`;
    }
    case 'signing':
      return `<span></span><button class="primary hold" data-action="do-signing">▶ SEND THE LETTERS</button>`;
    case 'growth':
      return `<span></span><button class="primary hold" data-action="new-season">▶ SEASON ${s.season + 1}</button>`;
    case 'gameover':
      return `<span></span><button class="primary hold" data-action="new-game-direct">▶ NEW GAME</button>`;
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
    const cant = s.energy < d.cost;
    const gains = d.gain ? ATTRS.filter((a) => d.gain![a]).map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' ') : '';
    const what = gains
      ? `<span class="xpg gaintag">${gains}${d.target === 'one' ? ' · ONE PLAYER' : ''}</span>`
      : d.xp[1] > 0
        ? `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP${d.target === 'one' ? ' · ONE PLAYER' : ''}</span>`
        : '<span class="xpg">squad ⚡ up</span>';
    return `<button class="drill hold" data-action="drill" data-id="${d.id}" ${cant ? 'disabled' : ''}>
      <b>${d.name}</b> ${what}
      ${oddsLine(d.up, d.down, d.cost)}<br/><span class="ddesc">${esc(d.desc)}</span>
    </button>`;
  }).join('');
  return `<div class="modalback sheet" data-action="drill-sheet-close"><div class="modal sheetup">
    <span class="tag">THE DRILL — hold to run it</span>
    ${drills}
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

function prospectModalHtml(s: GameState): string {
  if (!prospectUi) return '';
  const pr = s.prospects.find((x) => x.id === prospectUi!.id);
  if (!pr) return '';
  if (prospectUi.text !== undefined) {
    return `<div class="modalback"><div class="modal" data-action="prospect-tap">
      <span class="tag">ON THE TRAIL</span>
      <div class="typebox" id="typebox"></div>
      <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap to continue</div></div>
    </div></div>`;
  }
  const actBtn = (a: (typeof PROSPECT_ACTS)[number]): string => {
    const banned = a.kind === 'recruit' && pr.bannedWeeks > 0;
    const known = a.kind === 'scout' && pr.scoutLevel >= 2;
    return `<button class="wide hold" data-action="prospect-act" data-id="${a.id}" ${s.energy < a.cost || banned || known ? 'disabled' : ''}>
      <b>${a.name}</b>${a.gain ? ` <span class="xpg">+${a.gain[0]}–${a.gain[1]}%</span>` : ''}${known ? ' — KNOWN' : ''}
      ${oddsLine(a.up, a.down, a.cost)}</button>`;
  };
  return `<div class="modalback"><div class="modal">
    <span class="tag">${esc(pr.name)} — ${pr.scoutLevel === 0 ? 'A RUMOR' : pr.scoutLevel === 1 ? 'ONE LOOK' : 'KNOWN'}</span>
    <div class="modalcard">${prospectCard(pr)}</div>
    <p class="dim">${esc(pr.blurb)}</p>
    <div class="acthead">SCOUT — know him</div>${PROSPECT_ACTS.filter((a) => a.kind === 'scout').map(actBtn).join('')}
    <div class="acthead">RECRUIT — want him</div>${PROSPECT_ACTS.filter((a) => a.kind === 'recruit').map(actBtn).join('')}
    <button class="wide hold" data-action="prospect-drop">✕ DROP HIM</button>
    <button class="wide" data-action="prospect-close">CLOSE</button>
  </div></div>`;
}

function scanModalHtml(s: GameState): string {
  if (!scanUi) return '';
  if (scanUi.text !== undefined) {
    return `<div class="modalback"><div class="modal" data-action="scan-tap">
      <span class="tag">SCAN RESULTS</span>
      <div class="typebox" id="typebox"></div>
      <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap to continue</div></div>
    </div></div>`;
  }
  const regions = SCAN_REGIONS.filter((r) => s.unlockedRegions.includes(r.id)).map((r) => {
    const grounded = s.groundedWeeks > 0 && !r.local;
    const disabled = grounded || s.energy < r.cost || s.prospects.length >= 9;
    return `<button class="wide hold" data-action="scan-region" data-id="${r.id}" ${disabled ? 'disabled' : ''}>
      <b>${r.name}</b> ${grounded ? '<span class="blink">GROUNDED</span>' : ''}
      ${oddsLine(r.up, r.down, r.cost)}<br/><span class="ddesc">${esc(r.desc)}</span></button>`;
  }).join('');
  return `<div class="modalback"><div class="modal">
    <span class="tag">SCAN THE GALAXY</span>
    ${regions}
    <button class="wide" data-action="scan-close">CLOSE</button>
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

function detailModalHtml(s: GameState): string {
  if (detailPlayerId === null) return '';
  const p = myTeam(s).players.find((x) => x.id === detailPlayerId) ?? s.selectPool.find((x) => x.id === detailPlayerId);
  if (!p) return '';
  const sp = speciesById(p.speciesId);
  const t = myTeam(s);
  const attrRows = ATTRS.map((a) => {
    const eff = Math.round(attrEff(p, a));
    return `<div class="arow">
      <span class="alab">${ATTR_LABEL[a]}</span>
      <b style="color:${vc(p.attrs[a] * 4)}">${p.attrs[a]}</b><span class="dim">/${p.pots[a]}${eff < p.attrs[a] ? ` · now ${eff}` : ''}</span>
    </div>`;
  }).join('');
  const season = p.stats;
  const career = { ...p.career };
  return `<div class="modalback" data-action="close-detail"><div class="modal">
    <span class="tag">#${p.jersey} ${esc(p.name)} · ${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>
    <div class="detailtop">
      <img class="sprite big" src="${spriteUrl(p, { bg: t.bg, fg: t.fg }, p.jersey)}" alt=""/>
      ${kite(p.attrs, { pot: p.pots, start: p.startAttrs, caps: sp.attrCaps, ovrText: String(ovr(p.attrs)), cls: 'full' })}
      <div class="arows">${attrRows}
        <div class="arow"><span class="alab">OVERALL</span><b style="color:${vc(ovr(p.attrs) * 1.6)}">${ovr(p.attrs)}</b><span class="dim">/${ovr(p.pots)}</span></div>
      </div>
    </div>
    <div class="dim">${SIZE_LABELS[sizeIndex(p)]} · ${p.heightCm}cm ${p.weightKg}kg — size is position: small runs the backcourt, big holds the frontcourt</div>
    <div class="dim">${esc(sp.name)} (tier ${sp.tier}) — ${esc(sp.desc)}</div>
    <div class="report">SEASON · GP ${season.gp} · ${perGame(season, 'pts')} pts · ${perGame(season, 'reb')} reb · ${perGame(season, 'stl')} stl · ${perGame(season, 'ast')} ast
      ${career.gp ? `<br/><span class="dim">CAREER · GP ${career.gp} · ${career.pts} pts · ${career.reb} reb · ${career.stl} stl · ${career.ast} ast</span>` : ''}</div>
    <div class="dim">⚡ ENERGY <b style="color:${vc(p.energy)}">${p.energy}</b> (mutes ATH+FRC) · MOOD <b style="color:${vc(p.mood)}">${p.mood}</b> (mutes SKL+BRN)</div>
    <div class="dim">Level ${p.level}/${LEVEL_CAP} · XP ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)}${p.outWeeks > 0 ? ` · <b>OUT ${p.outWeeks}w — ${esc(p.outReason)}</b>` : ''}</div>
    <button class="wide" data-action="close-detail">CLOSE</button>
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
  const overlays = drillSheetHtml(state) + prospectModalHtml(state) + scanModalHtml(state) + toastModalHtml() + itemModalHtml(state) + coachModalHtml(state) + detailModalHtml(state);
  const modalOpen = drillSheet || coachOpen || itemUi !== null || toast !== null || prospectUi !== null || scanUi !== null || detailPlayerId !== null;
  const navHtml = `<div class="navbar ${modalOpen ? 'dimmed' : ''}">${nav(state)}</div>`;
  const frame = state.phase === 'pickTeam' || state.phase === 'gameover'
    ? `<div class="midwrap"><div class="middle solo">${middle}</div>${overlays}</div>${navHtml}`
    : `${headerHtml(state)}<div class="midwrap"><div class="middle">${middle}</div>${overlays}</div>${bagBar(state)}${navHtml}`;

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
  const ev = currentStory(state);
  const box = document.getElementById('typebox');
  const overlayText = toast ?? prospectUi?.text ?? scanUi?.text;
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
    state.postGame.forEach((d, i) => {
      const msgs: { text: string; up?: boolean }[] = [];
      if (d.xpGain > 0) msgs.push({ text: `+${d.xpGain} XP` });
      if (d.energyP !== 0) msgs.push({ text: `${d.energyP > 0 ? '+' : ''}${d.energyP}⚡`, up: d.energyP > 0 });
      if (d.mood !== 0) msgs.push({ text: `${d.mood > 0 ? '+' : ''}${d.mood} MOOD`, up: d.mood > 0 });
      if (msgs.length) floatCard(d.playerId, msgs, 300 + i * 260);
    });
    lastLevelUps.forEach((lu, i) => {
      floatCard(lu.playerId, [{ text: `★ LEVEL ${lu.level}`, up: true }], 1400 + i * 400);
    });
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

// ---- the lens swipe: a horizontal fling on the training grid changes lenses ----

let swipe: { id: number; x: number; y: number } | null = null;

app.addEventListener('pointerdown', (e) => {
  const modalOpen = drillSheet || coachOpen || itemUi !== null || toast !== null || prospectUi !== null || scanUi !== null || detailPlayerId !== null;
  if (state.phase === 'practice' && !currentStory(state) && !modalOpen) {
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
});
document.addEventListener('pointerup', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  swipe = null;
  if (suppressClick) return; // that was a card drag, not a fling
  if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 2) {
    lens = ((lens + (dx < 0 ? 1 : 2)) % 3) as Lens;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    render();
  }
});
document.addEventListener('pointercancel', () => { swipe = null; });
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

    case 'drill': {
      const d = DRILLS.find((x) => x.id === id)!;
      drillSheet = false;
      if (d.target === 'one') {
        drillPickOne = id;
        break;
      }
      drillPickOne = null;
      const out = runDrill(state, id);
      if (out) {
        out.xpByPlayer.forEach((xp, pid) => floatCard(pid, [{ text: `+${xp} XP` }], 200));
        out.gainByPlayer.forEach((g, pid) => floatCard(pid, [{ text: g, up: true }], 600));
        out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL ${lu.level}`, up: true }], 900 + i * 300));
      }
      break;
    }

    case 'scan-region': {
      const text = actionScan(state, id);
      if (text !== null) scanUi = { open: true, text };
      break;
    }
    case 'prospect-act': {
      if (!prospectUi) break;
      const text = actionProspect(state, prospectUi.id, id);
      if (text !== null) prospectUi = { id: prospectUi.id, text };
      break;
    }
    case 'prospect-drop':
      if (prospectUi) actionDropProspect(state, prospectUi.id);
      prospectUi = null;
      break;

    case 'scout-opp': scoutOpponent(state); break;
    case 'play-game': gnStage = 'beat'; clearFloatTimers(); playGame(state); break;

    case 'convince-pro': convincePro(state, Number(id)); break;
    case 'letgo-pro': letGoPro(state, Number(id)); break;
    case 'retire': retire(state); break;
    case 'do-signing': poolSelected = null; resolveSigning(state); break;
    case 'confirm-roster':
      if (poolSelected && finalizeRoster(state, [...poolSelected])) {
        poolSelected = null;
        detailPlayerId = null;
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
        const text = useItem(state, itemId, prospectUi ? { prospectId: prospectUi.id } : {});
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
      prospectUi = null;
      scanUi = null;
      poolSelected = null;
      detailPlayerId = null;
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

    case 'to-practice': toPractice(state); break;
    case 'to-galaxy': drillPickOne = null; drillSheet = false; toGalaxy(state); break;
    case 'to-matchup': prospectUi = null; scanUi = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'gn-table': gnStage = 'table'; clearFloatTimers(); break;
    case 'continue-result': gnStage = 'beat'; clearFloatTimers(); continueFromResult(state); break;

    case 'card': {
      const pid = Number(id);
      if (currentStory(state)) break;
      if (state.phase === 'practice') {
        if (lens !== 0 && !drillPickOne) { detailPlayerId = detailPlayerId === pid ? null : pid; break; }
        if (drillPickOne) {
          const out = runDrill(state, drillPickOne, pid);
          drillPickOne = null;
          if (out) {
            out.xpByPlayer.forEach((xp, pid2) => floatCard(pid2, [{ text: `+${xp} XP` }], 200));
            out.gainByPlayer.forEach((g, pid2) => floatCard(pid2, [{ text: g, up: true }], 600));
            out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL ${lu.level}`, up: true }], 900 + i * 300));
          }
        } else {
          toggleSitout(state, pid);
        }
      } else if (state.phase === 'teamSelect') {
        if (poolSelected) {
          if (poolSelected.has(pid)) poolSelected.delete(pid);
          else if (poolSelected.size < ROSTER_SIZE) poolSelected.add(pid);
        }
      }
      break;
    }
    // only the underlined name opens the detail view — unless a one-player
    // drill is waiting for its target, then the whole card means "him"
    case 'detail': {
      const pid = Number(id);
      if (currentStory(state)) break;
      if (state.phase === 'practice' && drillPickOne) {
        const out = runDrill(state, drillPickOne, pid);
        drillPickOne = null;
        if (out) {
          out.xpByPlayer.forEach((xp, pid2) => floatCard(pid2, [{ text: `+${xp} XP` }], 200));
          out.gainByPlayer.forEach((g, pid2) => floatCard(pid2, [{ text: g, up: true }], 600));
          out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL ${lu.level}`, up: true }], 900 + i * 300));
        }
      } else {
        detailPlayerId = detailPlayerId === pid ? null : pid;
      }
      break;
    }
    case 'close-detail': detailPlayerId = null; break;

    case 'pcell': prospectUi = { id: Number(id) }; break;
    case 'scancell': scanUi = { open: true }; break;
    case 'prospect-close': prospectUi = null; break;
    case 'prospect-tap':
      if (finishTypeNow()) return;
      if (prospectUi) prospectUi = { id: prospectUi.id };
      break;
    case 'scan-close': scanUi = null; break;
    case 'scan-tap':
      if (finishTypeNow()) return;
      scanUi = null;
      break;
    case 'toast-tap':
      if (finishTypeNow()) return;
      toast = null;
      break;

    case 'plan': setPlan(state, id as PlanId); break;

    case 'lens-set': lens = (Number(id) % 3) as Lens; break;
    case 'lens-prev': lens = ((lens + 2) % 3) as Lens; break;
    case 'lens-next': lens = ((lens + 1) % 3) as Lens; break;

    case 'drill-sheet': drillSheet = true; break;
    case 'drill-sheet-close': if (e.target === el) drillSheet = false; break;
    case 'drill-cancel': drillPickOne = null; break;

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
