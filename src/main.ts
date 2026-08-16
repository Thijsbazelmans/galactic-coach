// GALACTIC COACH v1.1 — the app frame. No scrolling, ever (recent phones):
// stats always on top, THE BAG + navigation always at the bottom, and between
// them the 3×3 grid — which IS your lineup — with a fourth row for controls.
// Popups take over the middle; the bag stays reachable, items drag right in.

import {
  CLASS_ABBR,
  DRILLS,
  PLANS,
  POLE_LABEL,
  PROSPECT_ACTS,
  SCAN_REGIONS,
  itemById,
  planById,
  speciesById,
} from './engine/data';
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, ROSTER_SIZE, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, planFit, slotMult, slotPlayer } from './engine/sim';
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
import type { Fx, GameState, PlanId, Player, Pole, Prospect, Team } from './engine/types';
import { clamp, effLean, lean, star, starStr } from './engine/util';
import { PRACTICE_KIT, faceUrl, iconUrl, spriteUrl, type Kit } from './rig';

const VERSION = 'v1.1';

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

type StoryMode = 'typing' | 'choices' | 'result-typing' | 'result';
let storyMode: StoryMode = 'typing';
let storyUid = -1;
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

function floatFx(fxList: Fx[], defaultPid: number | null, delay = 300): void {
  const byPid = new Map<number, { text: string; up?: boolean }[]>();
  for (const fx of fxList) {
    const pid = fx.playerId ?? defaultPid;
    if (pid === null) continue;
    const list = byPid.get(pid) ?? [];
    if (fx.skill) list.push({ text: `${fx.skill > 0 ? '+' : ''}${fx.skill} SKILL`, up: fx.skill > 0 });
    if (fx.levelDelta) list.push({ text: `${fx.levelDelta > 0 ? '+' : ''}${fx.levelDelta} LEVEL`, up: fx.levelDelta > 0 });
    if (fx.potential) list.push({ text: `CEILING ${fx.potential > 0 ? '↑' : '↓'}`, up: fx.potential > 0 });
    if (fx.energyP) list.push({ text: `${fx.energyP > 0 ? '+' : ''}${fx.energyP}⚡`, up: fx.energyP > 0 });
    if (fx.mood) list.push({ text: `${fx.mood > 0 ? '+' : ''}${fx.mood} MOOD`, up: fx.mood > 0 });
    if (fx.build) list.push({ text: fx.build < 0 ? '◀ STRONGER' : 'QUICKER ▶' });
    if (fx.head) list.push({ text: fx.head < 0 ? '▲ FIERCER' : 'SAVVIER ▼' });
    if (fx.outWeeks) list.push({ text: `OUT ${fx.outWeeks}w`, up: false });
    if (fx.xp) list.push({ text: `+${fx.xp} XP` });
    if (list.length) byPid.set(pid, list);
  }
  let i = 0;
  for (const [pid, msgs] of byPid) floatCard(pid, msgs, delay + i++ * 250);
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

// ---- the compass card ---------------------------------------------------------------------------

// Every compass reads the same: fangs N, brain S, dumbbell W, runner E —
// faint icons instead of labels. The light box is the species' hard limit.
function compassIcons(): string {
  const c = ramp(0.33);
  return `<img class="cicon n" src="${iconUrl('fang', c)}" alt=""/>
    <img class="cicon s" src="${iconUrl('men', c)}" alt=""/>
    <img class="cicon w" src="${iconUrl('phy', c)}" alt=""/>
    <img class="cicon e" src="${iconUrl('run', c)}" alt=""/>`;
}

function speciesBox(caps: Record<Pole, number>): string {
  const l = 50 - caps.strong / 2;
  const t = 50 - caps.fierce / 2;
  const w = (caps.strong + caps.quick) / 2;
  const h = (caps.fierce + caps.savvy) / 2;
  return `<span class="cbox" style="left:${l}%;top:${t}%;width:${w}%;height:${h}%"></span>`;
}

function compass(
  p: { build: number; head: number },
  eff: { build: number; head: number } | null,
  size: 'mini' | 'full',
  caps?: Record<Pole, number>,
  fuzz = ''
): string {
  const dotX = eff ? eff.build : p.build;
  const dotY = eff ? eff.head : p.head;
  const muted = eff && (Math.abs(eff.build - p.build) >= 4 || Math.abs(eff.head - p.head) >= 4);
  return `<div class="compass ${size} ${fuzz}">
    ${compassIcons()}
    ${caps ? speciesBox(caps) : ''}
    <span class="axis h"></span><span class="axis v"></span>
    ${muted ? `<span class="ghost" style="left:${p.build}%;top:${p.head}%"></span>` : ''}
    <span class="dot ${muted ? 'muted' : ''}" style="left:${dotX}%;top:${dotY}%"></span>
  </div>`;
}

function effDot(p: Player): { build: number; head: number } {
  const be = Math.max(0.3, p.energy / 100);
  const hm = Math.max(0.3, p.mood / 100);
  return { build: 50 + (p.build - 50) * be, head: 50 + (p.head - 50) * hm };
}

/** Vertical LED strip, 5 cells, lit bottom-up. The card's meter language. */
function vled(v: number): string {
  const lit = Math.ceil(clamp(v, 0, 100) / 20);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="lseg" style="${4 - i < lit ? `background:${vc(v)}` : ''}"></span>`
  ).join('');
  return `<span class="vled ${v <= 20 ? 'blink' : ''}">${cells}</span>`;
}

/** Vertical star column (5 cells, filled bottom-up, same read as the LEDs). */
function vstars(n: number): string {
  return `<span class="vstars">${Array.from({ length: 5 }, (_, i) =>
    `<span class="${4 - i < n ? 'on' : ''}">${4 - i < n ? '★' : '☆'}</span>`
  ).join('')}</span>`;
}

const POLE_SHORT: Record<Pole, string> = { strong: 'STR', quick: 'QCK', fierce: 'FRC', savvy: 'SVY' };

interface CardOpts {
  full?: boolean;
  kit?: Kit;
  tag?: string;
  inert?: boolean;
  draggable?: boolean;
  sitout?: boolean;
  miscast?: number; // % penalty to print
  pick?: boolean; // selection screens
}

// The card, phone-first. Importance top-down: RATING · NAME · YEAR head,
// meters flanking the sprite (⚡ left, mood right), then the 2×2 pole box
// between the XP/LVL twin bars and the compass (species limit drawn in).
function playerCard(p: Player, opts: CardOpts = {}): string {
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const out = p.outWeeks > 0;
  const img = spriteUrl(p, kit, p.jersey);
  const xpPct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  const lvlSegs = Array.from({ length: LEVEL_CAP }, (_, i) =>
    `<span class="lvlseg ${LEVEL_CAP - 1 - i < p.level ? 'on' : ''}"></span>`).join('');
  const statCell = (pole: Pole): string => {
    const v = Math.round(lean(p, pole));
    return `<span class="pc-stat"><i>${POLE_SHORT[pole]}</i><b style="color:${vc(v)}">${v}</b></span>`;
  };
  return `<div class="pcard ${opts.full ? 'big' : ''} ${out ? 'pout' : ''} ${opts.draggable && !out ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    <div class="pc-head">
      <span class="pc-rating" style="color:${vc(p.skill)}">${p.skill}</span>
      <span class="pc-name">${esc(p.name)}</span>
      <span class="pc-year">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>
    </div>
    <div class="pc-body">
      <span class="pc-meter" title="energy ${p.energy}">${vled(p.energy)}<img class="micon" src="${iconUrl('bolt', vc(p.energy))}" alt=""/></span>
      <img class="sprite" src="${img}" alt="" draggable="false"/>
      <span class="pc-meter" title="mood ${p.mood}">${vled(p.mood)}<img class="micon" src="${faceUrl(p.mood, vc(p.mood))}" alt=""/></span>
    </div>
    <div class="pc-foot">
      <span class="pc-side" title="level ${p.level}/${LEVEL_CAP}">
        <span class="pc-bars"><span class="vbar"><span class="vfill" style="height:${xpPct}%"></span></span><span class="vseglvl">${lvlSegs}</span></span>
        <i class="pc-lab">XP</i></span>
      <span class="pc-stats">${statCell('strong')}${statCell('quick')}${statCell('fierce')}${statCell('savvy')}</span>
      ${compass(p, out ? null : effDot(p), 'mini', speciesById(p.speciesId).poleCaps)}
    </div>
    ${out ? `<div class="ptag blink">OUT ${p.outWeeks}w</div>` : ''}
    ${opts.sitout ? '<div class="ptag dimtag">SITS OUT</div>' : ''}
    ${opts.miscast && opts.miscast >= 8 && !out ? `<div class="ptag">MISCAST −${opts.miscast}%</div>` : ''}
    ${opts.pick !== undefined ? `<div class="picktag ${opts.pick ? 'on' : ''}">${opts.pick ? '☑ ON THE SQUAD' : '☐ TAP TO PICK'}</div>` : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
  </div>`;
}

// Prospects wear the same frame: commit% where the rating sits, then
// SKL stars | compass (species limit drawn in) | POT stars. A ? marks
// star ratings that are still a scout's guess.
function prospectCard(pr: Prospect): string {
  const img = spriteUrl(pr, PRACTICE_KIT, null);
  const known = pr.scoutLevel;
  const sp = speciesById(pr.speciesId);
  const q = known < 2 ? '?' : '';
  return `<div class="pcard prospect" data-action="pcell" data-id="${pr.id}" data-pid="p${pr.id}">
    <div class="pc-head">
      <span class="pc-rating" style="color:${vc(pr.commitPct)}">${pr.commitPct}%</span>
      <span class="pc-name">${esc(pr.name)}</span>
      <span class="pc-year"></span>
    </div>
    <div class="pc-body">
      <img class="sprite" src="${img}" alt="" draggable="false"/>
      <span class="pc-side">${vstars(pr.seenSkillStar)}<i class="pc-lab">SKL${q}</i></span>
      ${compass({ build: pr.seenBuild, head: pr.seenHead }, null, 'mini', sp.poleCaps, known === 0 ? 'fuzzy2' : known === 1 ? 'fuzzy1' : '')}
      <span class="pc-side">${vstars(pr.seenPotStar)}<i class="pc-lab">POT${q}</i></span>
    </div>
    ${pr.bannedWeeks > 0 ? `<div class="ptag blink">BANNED ${pr.bannedWeeks}w</div>` : ''}
  </div>`;
}

// ---- header (always there) ---------------------------------------------------------------------

// JOB SECURITY: a bright bar the darkness eats from both ends —
// scholar cap = the school's heat (left), $ = the boosters' (right).
function jobBar(s: GameState): string {
  const danger = s.heatS + s.heatB >= 75;
  return `<div class="jobbar ${danger ? 'blink' : ''}" title="job security — school heat ${s.heatS} · booster heat ${s.heatB}">
    <img class="jicon" src="${iconUrl('cap', ramp(0.75))}" alt=""/>
    <div class="jtrack">
      <div class="jdark l" style="width:${s.heatS}%"></div>
      <div class="jdark r" style="width:${s.heatB}%"></div>
      <span class="jlabel">JOB SECURITY</span>
    </div>
    <span class="jicon dollar">$</span>
  </div>`;
}

function meterText(s: GameState): string {
  const m = winMeter(s);
  if (!m) return '';
  const label = isUtWeek(s) ? 'UT' : myMatchup(s) ? myMatchup(s)!.opponent.name : '';
  const val = m.exact ? `<b>${m.lo}%</b>` : `<b>${m.lo}–${m.hi}%</b>`;
  return `<span class="miniwin">vs ${esc(label)} · WIN ${val}</span>`;
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
      ${meterText(s)}
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

function gridHtml(s: GameState, draggable: boolean): string {
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
          ? playerCard(p, { draggable, sitout: isPractice && s.sitouts.includes(p.id), miscast: Math.round((1 - mult) * 100) })
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

function storyPanel(s: GameState): string {
  const ev = currentStory(s)!;
  const p = ev.playerId !== null ? myTeam(s).players.find((x) => x.id === ev.playerId) : undefined;
  let actions = '';
  if (storyMode === 'choices' && ev.choices && !ev.resolvedText) {
    actions = ev.choices
      .filter((c) => !c.itemId) // items live in THE BAG below — tap or drag them in
      .map((c) => {
        const cant = c.cost !== undefined && s.energy < c.cost;
        return `<button class="wide hold" data-action="story-choice" data-id="${esc(c.key)}" ${cant || c.disabled ? 'disabled' : ''}>
          ${esc(c.label)}${cant ? ' — NOT ENOUGH ⚡' : ''}<br/>${oddsLine(c.up, c.down, c.cost)}</button>`;
      }).join('');
    if (ev.choices.some((c) => c.itemId)) {
      actions += `<div class="itemhint blink">◆ something in THE BAG could help — tap it below</div>`;
    }
  } else if (storyMode === 'result' || (!ev.choices && storyMode !== 'typing')) {
    actions = '<div class="taphint">▸ tap to continue</div>';
  }
  return `<div class="storypanel" data-action="story-tap" id="storypanel">
    <span class="tag">${esc(ev.tag)}</span>
    ${p ? `<div class="modalcard">${playerCard(p, { inert: true })}</div>` : ''}
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions ${actions ? '' : 'hide'}" id="modal-actions">${actions}</div>
  </div>`;
}

// ---- stages (middle content per phase) -----------------------------------------------------------------

function stagePractice(s: GameState): string {
  const fourth = drillPickOne
    ? `<div class="fourthrow"><button class="bigctl blink" data-action="drill-cancel">TAP THE PLAYER — or tap here to cancel</button></div>`
    : s.trainedThisWeek
      ? `<div class="fourthrow"><div class="report">${esc(s.drillReport ?? 'Practice is done.')}</div><button class="bigctl again" data-action="drill-sheet">⬆ AGAIN</button></div>`
      : `<div class="fourthrow"><button class="bigctl" data-action="drill-sheet">⬆ CHOOSE THE DRILL</button></div>`;
  return `<h2>WHO GETS BETTER THIS WEEK?</h2>${gridHtml(s, true)}${fourth}`;
}

function stageGalaxy(s: GameState): string {
  return `<h2>WHO JOINS NEXT SEASON?</h2>
    ${prospectGridHtml(s)}
    <div class="fourthrow">${s.groundedWeeks > 0 ? `<div class="report blink">SHIP GROUNDED ${s.groundedWeeks}w — home scans only</div>` : `<div class="report dim">tap a prospect · tap an empty slot to scan</div>`}</div>`;
}

function stageMatchup(s: GameState): string {
  const m = winMeter(s);
  const hint = oppPlanHint(s);
  let oppBit: string;
  if (isUtWeek(s)) {
    const c = utOpponent(s)!;
    oppBit = `${chip(c.name, c.bg, c.fg, true)} <span class="dim">${esc(c.gimmick)}</span> · they live in <b>${planById(c.plan).name}</b>`;
  } else {
    const mu = myMatchup(s)!;
    oppBit = `${chip(mu.opponent.name, mu.opponent.bg, mu.opponent.fg, true)} <b>${mu.opponent.wins}–${mu.opponent.losses}</b> ${mu.home ? 'HOME' : 'AWAY'}
      ${s.scoutedOpp
        ? `· they'll come out in <b>${hint ? planById(hint).name : '?'}</b>`
        : `<button class="hold scoutbtn" data-action="scout-opp" ${s.energy < 1 ? 'disabled' : ''}>SCOUT 1⚡</button>`}`;
  }
  const meter = m
    ? `<span class="bigval" style="color:${vc(m.exact ? m.lo : (m.lo + m.hi) / 2)}">${m.exact ? `${m.lo}%` : `${m.lo}–${m.hi}%`}</span>`
    : '';
  const plans = PLANS.map((pl) => {
    const fit = planFit(myTeam(s), pl.id);
    let vs = '';
    if (hint) {
      if (pl.beats === hint) vs = ' ▲';
      else if (planById(hint).beats === pl.id) vs = ' ▼';
    }
    return `<button class="planchip ${s.plan === pl.id ? 'sel' : ''}" data-action="plan" data-id="${pl.id}">
      <b>${pl.name}</b>${vs}<br/><span style="color:${vc(fit)}">${fit}</span></button>`;
  }).join('');
  return `<div class="mustrip"><span class="muq">HOW DO WE BEAT THEM?</span> ${meter}<div class="oppbit">${oppBit}</div></div>
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
  return `<h2>WHERE DO WE STAND?</h2>${table}${others}`;
}

// ---- full views in the same frame ----------------------------------------------------------------------

function stageTeamSelect(s: GameState): string {
  if (poolSelected === null) {
    poolSelected = new Set(
      [...s.selectPool].filter((p) => !p.walkOn).sort((a, b) => b.skill - a.skill).slice(0, ROSTER_SIZE).map((p) => p.id)
    );
  }
  const returning = new Set(myTeam(s).players.map((p) => p.id));
  const commits = new Set(s.commits.map((p) => p.id));
  const sorted = [...s.selectPool].sort((a, b) => b.skill - a.skill);
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
  return `<h2>${s.season === 0 ? 'TRYOUTS' : 'PICK YOUR SQUAD'} — ${n}/${ROSTER_SIZE}</h2>${results}<div class="grid scroll">${rows.join('')}</div>`;
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
  return `<h2>SEASON ${s.season} — THE RECKONING</h2>
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
      return `<tr>
        <td><button class="signbtn" data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑' : '☐'}</button></td>
        <td>${esc(pr.name)}</td>
        <td class="starcell">${starStr(pr.seenSkillStar)}<br/><span class="dim">${starStr(pr.seenPotStar)}</span></td>
        <td class="num" style="color:${vc(pr.commitPct)}">${pr.commitPct}%</td>
        <td class="num">${pr.selected && eff ? `<b style="color:${vc(eff.pct)}">→${eff.pct}%</b>` : ''}</td>
      </tr>`;
    })
    .join('');
  return `<h2>WHO GETS A LETTER?</h2>
    <table>${rows || '<tr><td class="dim">You scouted nobody. Enjoy the walk-ons.</td></tr>'}</table>`;
}

function stageGrowth(s: GameState): string {
  return `<h2>THE OFFSEASON DOES ITS WORK</h2>
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
    const avg = Math.round(t.players.reduce((a, p) => a + p.skill, 0) / t.players.length);
    return `<button class="teampickbtn" data-action="pick-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
      <b>${esc(teamLabel(t))}</b><br/><span>${esc(t.region)} · avg skill ${avg}</span></button>`;
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
    return `<button class="drill hold" data-action="drill" data-id="${d.id}" ${cant ? 'disabled' : ''}>
      <b>${d.name}</b> ${d.xp[1] > 0 ? `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP${d.target === 'one' ? ' · ONE PLAYER' : ''}</span>` : '<span class="xpg">squad ⚡ up</span>'}
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
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE COACH</span>
    <div class="report">LEGACY <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b>
      · ${s.trophies}🏆 · ${s.utTitles} UT · ${s.totalWins}W · season ${s.season}${s.season >= 20 ? ' <span class="blink">— you feel the years</span>' : ''}</div>
    <div class="report"><b>KNOWLEDGE</b>${drills}${regions}</div>
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
  return `<div class="modalback" data-action="close-detail"><div class="modal">
    <span class="tag">#${p.jersey} ${esc(p.name)}</span>
    <div class="modalcard">${playerCard(p, { full: true, inert: true })}</div>
    <div class="detailcompass">${compass(p, p.outWeeks > 0 ? null : effDot(p), 'full', sp.poleCaps)}</div>
    <div>POTENTIAL <span class="potline">${starStr(star(p.potential))}</span></div>
    <div class="dim">${esc(sp.name)} (tier ${sp.tier}) — ${esc(sp.desc)}</div>
    <div>${(['strong', 'quick', 'fierce', 'savvy'] as const)
      .filter((pl) => lean(p, pl) > 5)
      .map((pl) => `${POLE_LABEL[pl]} <b style="color:${vc(lean(p, pl))}">${Math.round(lean(p, pl))}</b>${effLean(p, pl) < lean(p, pl) - 4 ? ` <span class="dim">(now ${Math.round(effLean(p, pl))})</span>` : ''}`)
      .join(' · ') || 'dead center — a blank slate'}</div>
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
    storyMode = 'typing';
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

function postRender(): void {
  const ev = currentStory(state);
  const box = document.getElementById('typebox');
  const overlayText = toast ?? prospectUi?.text ?? scanUi?.text;
  if (box && overlayText !== undefined && overlayText !== null) {
    typewrite(box, overlayText, revealActions);
  } else if (box && ev) {
    if (storyMode === 'typing') {
      typewrite(box, ev.text, () => {
        storyMode = ev.choices && !ev.resolvedText ? 'choices' : 'result';
        revealActions();
        render();
      });
    } else if (storyMode === 'choices') {
      box.textContent = ev.text;
      revealActions();
    } else if (storyMode === 'result-typing') {
      typewrite(box, ev.resolvedText ?? '', () => {
        storyMode = 'result';
        revealActions();
      });
    } else {
      box.textContent = ev.resolvedText || ev.text;
      revealActions();
    }
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
      floatCard(lu.playerId, [{ text: `★ LEVEL UP +${lu.skillGain}`, up: true }, ...(lu.bonus ? [{ text: lu.bonus.toUpperCase(), up: true }] : [])], 1400 + i * 400);
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
  const res = resolveStory(state, key);
  if (res) {
    storyMode = 'result-typing';
    floatFx(res.fx, res.resolved.playerId, 500);
  }
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

    case 'story-choice': {
      const res = resolveStory(state, id);
      if (res) {
        storyMode = 'result-typing';
        if (state.phase !== 'gameover') floatFx(res.fx, res.resolved.playerId, 500);
      }
      break;
    }

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
        out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL UP +${lu.skillGain}`, up: true }], 900 + i * 300));
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
        const res = resolveStory(state, storyKey);
        if (res) {
          storyMode = 'result-typing';
          floatFx(res.fx, res.resolved.playerId, 500);
        }
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
      if (finishTypeNow()) return;
      const ev = currentStory(state);
      if (!ev) break;
      if (storyMode === 'result') {
        clearFloatTimers();
        dismissStory(state);
        storyUid = -1;
        break;
      }
      if (!ev.choices && storyMode !== 'typing') {
        const res = resolveStory(state, 'ok');
        if (res && res.resolved.resolvedText) {
          storyMode = 'result-typing';
          floatFx(res.fx, res.resolved.playerId, 400);
        } else {
          dismissStory(state);
          storyUid = -1;
        }
        break;
      }
      return;
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
        if (drillPickOne) {
          const out = runDrill(state, drillPickOne, pid);
          drillPickOne = null;
          if (out) {
            out.xpByPlayer.forEach((xp, pid2) => floatCard(pid2, [{ text: `+${xp} XP` }], 200));
            out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL UP +${lu.skillGain}`, up: true }], 900 + i * 300));
          }
        } else {
          toggleSitout(state, pid);
        }
      } else if (state.phase === 'teamSelect') {
        if (poolSelected) {
          if (poolSelected.has(pid)) poolSelected.delete(pid);
          else if (poolSelected.size < ROSTER_SIZE) poolSelected.add(pid);
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

// dev handle
(window as unknown as { gc: unknown }).gc = { state: () => state, starters };

render();
