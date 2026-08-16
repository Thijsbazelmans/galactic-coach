// GALACTIC COACH v1.0 — the UI. One hue per save (your team color), brightness
// says how much, motion says pay attention. Every screen answers one question.

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
import {
  BAG_SIZE,
  CACHE_MAX,
  LEVEL_CAP,
  ROSTER_SIZE,
  stipendFor,
  xpNeed,
} from './engine/gen';
import { planFit } from './engine/sim';
import {
  actionDropProspect,
  actionProspect,
  actionScan,
  benchPlayers,
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
  reserves,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  save,
  scoutOpponent,
  setPlan,
  sortedStandings,
  startNewSeason,
  starters,
  toGalaxy,
  toMatchup,
  toPractice,
  toSigning,
  toggleProspect,
  toggleSitout,
  useItem,
  utOpponent,
  weekLabel,
  winMeter,
  wipeSave,
} from './engine/state';
import type { Fx, GameState, PlanId, Player, Prospect, Team } from './engine/types';
import { clamp, effLean, lean, star, starStr } from './engine/util';
import { PRACTICE_KIT, faceUrl, spriteUrl, type Kit } from './rig';

const VERSION = 'v1.0';

let state: GameState = load() ?? freshGame();

// ---- THE RAMP: one hue per save -----------------------------------------------

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

/** ramp(t): t=0 → 18% brightness, t=1 → near white. Same hue the whole way. */
function ramp(t: number): string {
  const tt = clamp(t, 0, 1);
  const l = 18 + tt * 79;
  const s = rampS * (1 - tt * 0.7);
  return `hsl(${Math.round(rampH)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

/** A value 0–100 rendered at its own brightness (the law). */
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

// ---- transient UI state ----------------------------------------------------------

type StoryMode = 'typing' | 'choices' | 'result-typing' | 'result';
let storyMode: StoryMode = 'typing';
let storyUid = -1;
let bagOpen = false;
let coachOpen = false;
let toast: string | null = null; // tap-through result panel (item use etc.)
let prospectUi: { id: number; text?: string } | null = null;
let scanUi: { open: boolean; text?: string } | null = null;
let drillPickOne: string | null = null; // 'personal' waiting for a player tap
let detailPlayerId: number | null = null;
let poolSelected: Set<number> | null = null;
let gnShown = false; // gamenight verdict revealed
let meterPrev = -1;
let progressTimer: number | null = null;
let floatTimers: number[] = [];

// typewriter
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

// ---- floaters (change = a floater on a black tag) -----------------------------------

function floatCard(pid: number, msgs: { text: string; up?: boolean }[], startDelay = 0): void {
  msgs.forEach((m, i) => {
    floatTimers.push(
      window.setTimeout(() => {
        document.querySelectorAll(`[data-pid="${pid}"]`).forEach((card) => {
          const el = document.createElement('div');
          el.className = `floater ${m.up === false ? 'down' : m.up ? 'up' : ''}`;
          el.textContent = m.text;
          (el as HTMLElement).style.left = `${14 + (i % 3) * 34}px`;
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

// ---- typewriter ------------------------------------------------------------------------

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

// ---- the odds line ------------------------------------------------------------------------

function oddsLine(up?: { pct: number; cls: string; note?: string }, down?: { pct: number; cls: string; note?: string }, cost?: number): string {
  const parts: string[] = [];
  if (cost) parts.push(`<span class="cost">${cost}⚡</span>`);
  if (up) parts.push(`<span class="tail up">▲ ${up.pct}% ${up.cls}${up.note ? ` <i>(${esc(up.note)})</i>` : ''}</span>`);
  if (down) parts.push(`<span class="tail down">▼ ${down.pct}% ${down.cls}${down.note ? ` <i>(${esc(down.note)})</i>` : ''}</span>`);
  return parts.length ? `<span class="odds">${parts.join(' ')}</span>` : '';
}

// ---- the compass card ------------------------------------------------------------------------

function compass(p: { build: number; head: number }, eff: { build: number; head: number } | null, size: 'mini' | 'full'): string {
  const dotX = eff ? eff.build : p.build;
  const dotY = eff ? eff.head : p.head;
  const muted = eff && (Math.abs(eff.build - p.build) >= 4 || Math.abs(eff.head - p.head) >= 4);
  const labels = size === 'full'
    ? `<span class="pole n">FIERCE</span><span class="pole s">SAVVY</span><span class="pole w">S<br/>T<br/>R</span><span class="pole e">Q<br/>C<br/>K</span>`
    : '';
  return `<div class="compass ${size}">
    ${labels}
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

function energyBar(v: number): string {
  const lit = Math.ceil(clamp(v, 0, 100) / 20);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="seg ${i < lit ? 'on' : ''}" style="${i < lit ? `background:${vc(v)}` : ''}"></span>`
  ).join('');
  return `<span class="segbar ${v <= 20 ? 'blink' : ''}" title="energy ${v}">⚡${cells}</span>`;
}

function moodFace(v: number): string {
  return `<img class="face ${v <= 20 ? 'blink' : ''}" src="${faceUrl(v, vc(v))}" alt="" title="mood ${v}"/>`;
}

function levelPips(p: Player): string {
  const pips = Array.from({ length: LEVEL_CAP }, (_, i) =>
    `<span class="pip ${i < p.level ? 'on' : ''}"></span>`
  ).join('');
  const pct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  return `<div class="pips" title="level ${p.level}/${LEVEL_CAP}">${pips}</div>
    <div class="xpbar" data-pid-xp="${p.id}"><div class="xpfill" style="width:${pct}%"></div></div>`;
}

interface CardOpts {
  size?: 'tile' | 'full';
  kit?: Kit;
  footer?: string;
  tag?: string;
  inert?: boolean;
  draggable?: boolean;
  sitout?: boolean;
}

function playerCard(p: Player, opts: CardOpts = {}): string {
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const out = p.outWeeks > 0;
  const full = opts.size === 'full';
  const img = spriteUrl(p, kit, p.jersey);
  const potStars = star(p.potential);
  return `<div class="pcard ${full ? 'big' : ''} ${out ? 'pout' : ''} ${opts.draggable && !out ? 'grabbable' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    <div class="pcard-top"><span class="pname">${esc(p.name)}</span>
      <span class="pmeta">${CLASS_ABBR[Math.min(p.classYear, 3)]}${full ? ` · ${esc(speciesById(p.speciesId).name)}` : ''}</span></div>
    <div class="pcard-mid">
      <img class="sprite" src="${img}" alt="" draggable="false"/>
      ${compass(p, out ? null : effDot(p), full ? 'full' : 'mini')}
    </div>
    <div class="pcard-skill">
      <span class="skill" style="color:${vc(p.skill)}">${p.skill}</span>${full ? `<span class="potnotch" title="potential">${starStr(potStars)}</span>` : ''}
      ${energyBar(p.energy)}${moodFace(p.mood)}
    </div>
    ${levelPips(p)}
    ${out ? `<div class="outtag blink">OUT ${p.outWeeks}w — ${esc(p.outReason)}</div>` : ''}
    ${opts.sitout ? '<div class="sittag">SITS OUT</div>' : ''}
    ${p.special === 'droid' ? '<div class="cardtag">UNDECLARED SPECIES</div>' : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
    ${opts.footer ?? ''}
  </div>`;
}

function prospectCard(pr: Prospect, inert = false): string {
  const img = spriteUrl(pr, PRACTICE_KIT, null);
  const known = pr.scoutLevel;
  const sp = speciesById(pr.speciesId);
  return `<div class="pcard prospect" ${inert ? '' : `data-action="pcell" data-id="${pr.id}"`} data-pid="p${pr.id}">
    <div class="pcard-top"><span class="pname">${esc(pr.name)}</span><span class="pmeta">T${'I'.repeat(sp.tier)}</span></div>
    <div class="pcard-mid">
      <img class="sprite" src="${img}" alt="" draggable="false"/>
      <div class="compass mini ${known === 0 ? 'fuzzy2' : known === 1 ? 'fuzzy1' : ''}">
        <span class="axis h"></span><span class="axis v"></span>
        <span class="dot" style="left:${pr.seenBuild}%;top:${pr.seenHead}%"></span>
      </div>
    </div>
    <div class="prstars">
      <span title="skill now">${starStr(pr.seenSkillStar)}</span>
      <span class="dim">pot</span> <span title="ceiling">${starStr(pr.seenPotStar)}</span>
      ${known < 2 ? '<span class="dim">?</span>' : ''}
    </div>
    <div class="prcommit" style="color:${vc(pr.commitPct)}">${pr.bannedWeeks > 0 ? `<span class="blink">NO CONTACT ${pr.bannedWeeks}w</span>` : `${pr.commitPct}% committed`}</div>
  </div>`;
}

// ---- header --------------------------------------------------------------------------------

function hotSeatBar(s: GameState): string {
  const danger = s.heatS + s.heatB >= 75;
  return `<div class="hotseat ${danger ? 'blink' : ''}" title="THE HOT SEAT — school ${s.heatS} · boosters ${s.heatB}">
    <span class="hslabel">SCH</span>
    <div class="hstrack">
      <div class="hsfill l" style="width:${s.heatS}%"></div>
      <div class="hsfill r" style="width:${s.heatB}%"></div>
    </div>
    <span class="hslabel">BST</span>
  </div>`;
}

function meterText(s: GameState): string {
  const m = winMeter(s);
  if (!m) return '';
  const label = isUtWeek(s) ? utOpponent(s)?.name ?? '' : myMatchup(s) ? myMatchup(s)!.opponent.name : '';
  const val = m.exact ? `<b data-meter="${m.lo}">${m.lo}%</b>` : `<b data-meter="${Math.round((m.lo + m.hi) / 2)}">${m.lo}–${m.hi}%</b>`;
  return `<span class="miniwin">vs ${esc(label)} · ${val}</span>`;
}

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const cells = Array.from({ length: CACHE_MAX }, (_, i) =>
    `<span class="ecell ${i < s.energy ? 'on' : ''}" style="${i < s.energy ? `background:${ramp(0.35 + 0.55 * (i / CACHE_MAX))}` : ''}"></span>`
  ).join('');
  return `<div class="topbar">
    <button class="gear" data-action="coach-open">⚙</button>
    <button class="bagbtn" data-action="bag-open">◆<span class="bagn">${s.bag.length}</span></button>
    <div class="hrow hrow1">
      ${chip(teamLabel(t), t.bg, t.fg)}
      <span class="rec"><b>${t.wins}–${t.losses}</b></span>
      <span class="seasoninfo">S<b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b></span>
    </div>
    <div class="hrow hrow2">
      <span class="ecache ${s.energy === 0 ? 'blink' : ''}" id="hdr-energy" title="power cells ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">⚡${cells}</span>
      ${hotSeatBar(s)}
      ${meterText(s)}
    </div>
  </div>`;
}

// ---- the grid -------------------------------------------------------------------------------

function gridHtml(s: GameState): string {
  const t = myTeam(s);
  const isLineup = s.phase === 'matchup';
  const isPractice = s.phase === 'practice';
  const row = (ids: (number | null)[], label: string, zone: string): string => {
    const cells = ids.map((id, i) => {
      const p = id !== null ? t.players.find((x) => x.id === id) : undefined;
      return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? `data-zone="${zone}:${i}"` : ''}>
        ${p ? playerCard(p, { draggable: isLineup, sitout: isPractice && s.sitouts.includes(p.id) }) : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    return `<div class="gridrow"><div class="rowlabel">${label}</div>${cells}</div>`;
  };
  const resList = reserves(t).sort((a, b) => b.skill - a.skill);
  const resRows: string[] = [];
  for (let i = 0; i < Math.max(3, resList.length); i += 3) {
    const cells = [0, 1, 2].map((j) => {
      const p = resList[i + j];
      return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? 'data-zone="reserves"' : ''}>
        ${p ? playerCard(p, { draggable: isLineup, sitout: isPractice && s.sitouts.includes(p.id) }) : '<div class="pod empty">—</div>'}
      </div>`;
    }).join('');
    resRows.push(`<div class="gridrow"><div class="rowlabel">${i === 0 ? 'RESERVES' : ''}</div>${cells}</div>`);
  }
  return `<div class="grid">
    ${row(t.lineup.starters, 'STARTERS', 'starters')}
    ${row(t.lineup.bench, 'BENCH', 'bench')}
    ${resRows.join('')}
  </div>`;
}

function prospectGridHtml(s: GameState): string {
  const cells: string[] = [];
  for (let i = 0; i < 9; i++) {
    const pr = s.prospects[i];
    cells.push(`<div class="gcell">${pr ? prospectCard(pr) : '<button class="pod empty scanpod" data-action="scancell">+ SCAN</button>'}</div>`);
  }
  const rows: string[] = [];
  for (let i = 0; i < 9; i += 3) {
    rows.push(`<div class="gridrow"><div class="rowlabel">${i === 0 ? 'PROSPECTS' : ''}</div>${cells.slice(i, i + 3).join('')}</div>`);
  }
  return `<div class="grid">${rows.join('')}</div>`;
}

// ---- stages ----------------------------------------------------------------------------------

function stageStories(): string {
  return `<h2>THIS WEEK</h2>`;
}

function stagePractice(s: GameState): string {
  const drills = DRILLS.map((d) => {
    const unlocked = s.unlockedDrills.includes(d.id);
    if (!unlocked) return `<div class="drill locked">▓▓▓▓ <span class="dim">undiscovered method</span></div>`;
    const cant = s.energy < d.cost || s.trainedThisWeek;
    const picking = drillPickOne === d.id;
    return `<button class="drill hold ${picking ? 'picking' : ''}" data-action="drill" data-id="${d.id}" ${cant ? 'disabled' : ''}>
      <b>${d.name}</b> ${d.xp[1] > 0 ? `<span class="xpg">+${d.xp[0]}–${d.xp[1]} XP${d.target === 'one' ? ' · ONE PLAYER' : d.target === 'rest' ? '' : ' each'}</span>` : '<span class="xpg">squad ⚡ up</span>'}
      ${oddsLine(d.up, d.down, d.cost)}
      <span class="ddesc">${esc(d.desc)}</span>
    </button>`;
  }).join('');
  return `<h2>WHO GETS BETTER THIS WEEK?</h2>
    ${s.trainedThisWeek
      ? `<div class="panel report">${esc(s.drillReport ?? 'Practice is done for the week.')}</div>`
      : drillPickOne
        ? `<p class="dim blink">TAP THE PLAYER — or tap the drill again to cancel.</p>${drills}`
        : drills}`;
}

function stageGalaxy(s: GameState): string {
  return `<h2>WHO JOINS NEXT SEASON?</h2>
    ${s.groundedWeeks > 0 ? `<p class="blink">SHIP GROUNDED ${s.groundedWeeks}w — home scans only.</p>` : ''}`;
}

function planWheel(s: GameState): string {
  const hint = oppPlanHint(s);
  const t = myTeam(s);
  return `<div class="wheel">${PLANS.map((pl) => {
    const fit = planFit(t, pl.id);
    const sel = s.plan === pl.id;
    let vs = '';
    if (hint) {
      if (pl.beats === hint) vs = '<span class="tail up">▲ beats theirs</span>';
      else if (planById(hint).beats === pl.id) vs = '<span class="tail down">▼ loses to theirs</span>';
      else vs = '<span class="dim">· even</span>';
    }
    return `<button class="planbtn ${sel ? 'sel' : ''}" data-action="plan" data-id="${pl.id}">
      <b>${pl.name}</b> <span class="dim">${POLE_LABEL[pl.pole]}</span><br/>
      <span class="fitbar"><span class="fitfill" style="width:${fit}%;background:${vc(fit)}"></span></span> <span style="color:${vc(fit)}">${fit}</span>
      ${vs}<br/><span class="ddesc">${esc(pl.fantasy)}</span>
    </button>`;
  }).join('')}</div>`;
}

function oppBlob(s: GameState): string {
  if (isUtWeek(s)) {
    const c = utOpponent(s);
    if (!c) return '';
    return `<div class="opppanel">
      ${chip(c.name, c.bg, c.fg)} <span class="dim">${esc(c.gimmick)}</span>
      <div class="blobrow"><div class="compass full">
        <span class="pole n">FIERCE</span><span class="pole s">SAVVY</span><span class="pole w">S<br/>T<br/>R</span><span class="pole e">Q<br/>C<br/>K</span>
        <span class="axis h"></span><span class="axis v"></span>
        ${c.dots.map((d) => `<span class="dot" style="left:${d.build}%;top:${d.head}%"></span>`).join('')}
      </div>
      <div class="dim">Scout's read: they live in <b>${planById(c.plan).name}</b>.</div></div>
    </div>`;
  }
  const m = myMatchup(s);
  if (!m) return '';
  const opp = m.opponent;
  const st = starters(opp);
  const hint = oppPlanHint(s);
  return `<div class="opppanel">
    ${chip(teamLabel(opp), opp.bg, opp.fg)} <b>${opp.wins}–${opp.losses}</b> <span class="dim">${m.home ? 'they come to YOUR planet' : 'AWAY — a voyage'}</span>
    <div class="blobrow">
      <div class="compass full ${s.scoutedOpp ? '' : 'fuzzy1'}">
        <span class="pole n">FIERCE</span><span class="pole s">SAVVY</span><span class="pole w">S<br/>T<br/>R</span><span class="pole e">Q<br/>C<br/>K</span>
        <span class="axis h"></span><span class="axis v"></span>
        ${st.map((p) => `<span class="dot" style="left:${p.build}%;top:${p.head}%"></span>`).join('')}
      </div>
      <div>${s.scoutedOpp
        ? `<div>Their likely plan: <b>${hint ? planById(hint).name : '?'}</b></div>`
        : `<button class="hold" data-action="scout-opp" ${s.energy < 1 ? 'disabled' : ''}>SCOUT THEM (1⚡) ${oddsLine({ pct: 50, cls: 'INTEL' }, { pct: 2, cls: 'DRAIN' })}</button>`}
      </div>
    </div>
  </div>`;
}

function stageMatchup(s: GameState): string {
  const m = winMeter(s);
  const meter = m
    ? `<div class="bigmeter"><span class="dim">UPCOMING:</span>
        <span class="meterval" data-meter="${m.exact ? m.lo : Math.round((m.lo + m.hi) / 2)}" style="color:${vc(m.exact ? m.lo : (m.lo + m.hi) / 2)}">${m.exact ? `${m.lo}%` : `${m.lo}–${m.hi}%`}</span>
        <span class="dim">chance of winning</span></div>`
    : '';
  return `<h2>HOW DO WE BEAT THIS TEAM?</h2>
    ${meter}
    ${oppBlob(s)}
    ${planWheel(s)}`;
}

function stageGamenight(s: GameState): string {
  if (!s.lastResult) {
    return `<h2>GAME NIGHT</h2><p class="dim">The shuttle hums. The story continues...</p>`;
  }
  const r = s.lastResult;
  if (!gnShown) {
    return `<div id="progress-wrap">
      <div id="progress-label">Tip-off...</div>
      <div class="bar"><div class="fill" id="progress-fill"></div></div>
      <button data-action="skip-progress">SKIP</button>
    </div>`;
  }
  const table = !isUtWeek(s)
    ? `<h2>WHERE DO WE STAND?</h2><table class="standings">${sortedStandings(s)
        .map((t, i) => `<tr class="${t.id === s.myTeamId ? 'me' : ''}">
          <td>${i + 1}. ${chip(teamLabel(t), t.bg, t.fg, true)}</td><td class="num">${t.wins}–${t.losses}</td></tr>
          ${i === 0 ? '<tr class="utline"><td colspan="2">▲ THE UNIVERSAL TOURNAMENT ▲</td></tr>' : ''}`)
        .join('')}</table>`
    : `<div class="panel">${(s.ut?.log ?? []).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
  const others = s.resultsLog.length
    ? `<div class="panel dim">${s.resultsLog.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
    : '';
  return `<h2 class="${r.win ? 'won' : 'lost'}">${r.win ? 'VICTORY' : 'DEFEAT'} — ${r.myScore}–${r.oppScore} <span class="dim">vs ${esc(r.oppName)}</span></h2>
    <div class="verdict">
      <div class="vline">${esc(r.wheelLine)}</div>
      <div class="vline">${esc(r.heroLine)}</div>
      <div class="vline dim">${esc(r.boxLine)}</div>
    </div>
    ${others}
    ${table}`;
}

// ---- full-screen views -----------------------------------------------------------------------

function viewPickTeam(s: GameState): string {
  const cards = s.teams.map((t) => {
    const avg = Math.round(t.players.reduce((a, p) => a + p.skill, 0) / t.players.length);
    return `<button class="teampickbtn" data-action="pick-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
      <b>${esc(teamLabel(t))}</b><br/><span>${esc(t.region)} · avg skill ${avg}</span></button>`;
  }).join('');
  return `<h1>GALACTIC COACH</h1>
    <p class="sub">Intergalactic college basketball. 3-on-3. Every choice has two tails.</p>
    <h2>CHOOSE YOUR PROGRAM</h2>
    <div class="teampick">${cards}</div>`;
}

function viewTeamSelect(s: GameState): string {
  if (poolSelected === null) {
    poolSelected = new Set(
      [...s.selectPool].filter((p) => !p.walkOn).sort((a, b) => b.skill - a.skill).slice(0, ROSTER_SIZE).map((p) => p.id)
    );
  }
  const results = s.signingResults.map((r) => `<div>${esc(r)}</div>`).join('');
  const returning = new Set(myTeam(s).players.map((p) => p.id));
  const commits = new Set(s.commits.map((p) => p.id));
  const cards = [...s.selectPool]
    .sort((a, b) => b.skill - a.skill)
    .map((p) => {
      const tag = returning.has(p.id) ? 'RETURNER' : commits.has(p.id) ? 'RECRUIT ✓' : 'WALK-ON';
      const on = poolSelected!.has(p.id);
      return playerCard(p, {
        tag,
        kit: returning.has(p.id) || commits.has(p.id) ? undefined : PRACTICE_KIT,
        footer: `<button class="pickbtn ${on ? 'on' : ''}" data-action="pool" data-id="${p.id}">${on ? '☑ ON THE SQUAD' : '☐ PICK'}</button>`,
      });
    })
    .join('');
  const n = poolSelected.size;
  return `${headerHtml(s)}<div class="screen">
    ${results ? `<div class="panel report">${results}</div>` : ''}
    <h2>${s.season === 0 ? 'TRYOUTS' : 'PICK YOUR SQUAD'} — choose ${ROSTER_SIZE} (${n}/${ROSTER_SIZE})</h2>
    <div class="cardshelf">${cards}</div></div>
    <div class="navbar"><span></span><button class="primary hold" data-action="confirm-roster" ${n === ROSTER_SIZE ? '' : 'disabled'}>
      ${n === ROSTER_SIZE ? '▶ START THE SEASON' : `SELECT EXACTLY ${ROSTER_SIZE}`}</button></div>`;
}

function viewDepartures(s: GameState): string {
  const notes = s.seasonNotes.map((x) => `<div>${esc(x)}</div>`).join('');
  const unresolved = s.proDeparts.filter((d) => !d.resolved);
  const pros = s.proDeparts.length
    ? `<div class="panel"><b>GOING PRO</b><br/>${s.proDeparts.map((d) => {
        if (d.resolved) return `<div class="propane">${esc(d.note)}</div>`;
        const p = myTeam(s).players.find((x) => x.id === d.playerId);
        const chance = p ? clamp(15 + (p.mood - 40), 10, 80) : 15;
        return `<div class="propane">${esc(d.name)} has pro scouts in his dorm lobby. One conversation.
          <button class="hold" data-action="convince-pro" data-id="${d.playerId}">TALK HIM INTO STAYING ${oddsLine({ pct: chance as 2, cls: 'SPIRIT' }, { pct: (100 - chance) as 2, cls: 'DRAMA' })}</button>
          <button class="hold" data-action="letgo-pro" data-id="${d.playerId}">SHAKE HIS HAND</button></div>`;
      }).join('')}</div>`
    : '';
  return `${headerHtml(s)}<div class="screen">
    <h2>SEASON ${s.season} — THE RECKONING</h2>
    <div class="panel report">${notes}</div>
    ${pros}
    <div class="panel"><b>LEGACY: <span style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</span></b>
      <span class="dim">· ${s.trophies}🏆 · ${s.utTitles} Universal title${s.utTitles === 1 ? '' : 's'} · ${s.totalWins} career wins</span><br/>
      <span class="dim">Walk away now and the high-score table remembers you kindly. Or keep coaching.</span><br/>
      <button class="hold danger" data-action="retire">🏁 RETIRE — LOCK IN YOUR LEGACY</button></div>
    </div>
    <div class="navbar"><span></span><button class="primary" data-action="to-signing" ${unresolved.length || s.queue.length ? 'disabled' : ''}>
      ${unresolved.length ? 'DEAL WITH YOUR STARS FIRST' : 'ON TO SIGNING DAY ▶'}</button></div>`;
}

function viewSigning(s: GameState): string {
  const chances = effectiveChances(s);
  const rows = [...s.prospects]
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((pr) => {
      const eff = chances.find((c) => c.prospect.id === pr.id);
      return `<tr>
        <td><button data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑ SIGNING' : '☐ sign him'}</button></td>
        <td>${esc(pr.name)}</td>
        <td>${starStr(pr.seenSkillStar)} <span class="dim">pot</span> ${starStr(pr.seenPotStar)}</td>
        <td class="num" style="color:${vc(pr.commitPct)}">${pr.commitPct}%</td>
        <td class="num">${pr.selected && eff ? `<b style="color:${vc(eff.pct)}">→ ${eff.pct}%</b>` : ''}</td>
      </tr>`;
    })
    .join('');
  return `${headerHtml(s)}<div class="screen">
    <h2>SIGNING DAY — WHO GETS A LETTER?</h2>
    <table><tr><th></th><th>Prospect</th><th>Stars</th><th class="num">Commit</th><th class="num">Odds</th></tr>
    ${rows || '<tr><td colspan="5" class="dim">You scouted nobody this season. Enjoy the walk-ons.</td></tr>'}</table></div>
    <div class="navbar"><span></span><button class="primary hold" data-action="do-signing">▶ SEND THE LETTERS</button></div>`;
}

function viewGrowth(s: GameState): string {
  return `${headerHtml(s)}<div class="screen">
    <h2>THE OFFSEASON DOES ITS WORK</h2>
    <div class="panel report">${s.seasonNotes.map((x) => `<div>${esc(x)}</div>`).join('')}</div></div>
    <div class="navbar"><span></span><button class="primary hold" data-action="new-season">▶ SEASON ${s.season + 1}</button></div>`;
}

function viewGameover(s: GameState): string {
  const e = s.end!;
  return `<div class="screen tombstone">
    <h1 class="blink">${esc(e.cause)}</h1>
    <p class="sub">${esc(e.text)}</p>
    <div class="panel">
      <div>SEASONS COACHED: <b>${s.season}</b></div>
      <div>LEGACY: <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b></div>
      <div>TROPHIES: <b>${s.trophies}</b> · UNIVERSAL TITLES: <b>${s.utTitles}</b> · WINS: <b>${s.totalWins}</b></div>
    </div>
    ${s.careerLog.length ? `<div class="panel dim">${s.careerLog.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
    <button class="primary hold" data-action="new-game-direct">▶ NEW GAME</button>
  </div>`;
}

// ---- modals ------------------------------------------------------------------------------------

function storyModalHtml(s: GameState): string {
  const ev = currentStory(s);
  if (!ev) return '';
  const p = ev.playerId !== null ? myTeam(s).players.find((x) => x.id === ev.playerId) : undefined;
  let actions = '';
  if (storyMode === 'choices' && ev.choices && !ev.resolvedText) {
    actions = ev.choices.map((c) => {
      const cant = c.cost !== undefined && s.energy < c.cost;
      return `<button class="wide hold ${c.itemId ? 'itembtn' : ''}" data-action="story-choice" data-id="${esc(c.key)}" ${cant || c.disabled ? 'disabled' : ''}>
        ${esc(c.label)}${cant ? ' — NOT ENOUGH ⚡' : ''}<br/>${oddsLine(c.up, c.down, c.cost)}</button>`;
    }).join('');
  } else if (storyMode === 'result' || (!ev.choices && storyMode !== 'typing')) {
    actions = '<div class="taphint">▸ tap to continue</div>';
  }
  return `<div class="modalback"><div class="modal" data-action="story-tap">
    <span class="tag">${esc(ev.tag)}</span>
    ${p ? `<div class="modalcard">${playerCard(p, { size: 'full', inert: true })}</div>` : ''}
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions ${actions ? '' : 'hide'}" id="modal-actions">${actions}</div>
  </div></div>`;
}

function bagModalHtml(s: GameState): string {
  if (!bagOpen) return '';
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const id = s.bag[i];
    if (!id) return '<div class="itemcard empty">— empty slot —</div>';
    const item = itemById(id);
    const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
    const ctxOk = ['practice', 'matchup', 'galaxy', 'stories'].includes(s.phase);
    return `<div class="itemcard ${item.rarity}">
      <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
      <i class="dim">${esc(item.flavor)}</i><br/>
      ${esc(item.effectText)}<br/>${oddsLine(item.up, item.down)}
      <span class="dim">plays: ${item.context.join(', ')}</span><br/>
      <button class="hold" data-action="use-item" data-id="${item.id}" ${spent || !ctxOk ? 'disabled' : ''}>
        ${spent ? 'USED THIS SEASON' : 'USE NOW'}</button>
    </div>`;
  }).join('');
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE BAG — ${s.bag.length}/${BAG_SIZE}</span>
    ${slots}
    <button class="wide" data-action="bag-close">CLOSE</button>
  </div></div>`;
}

function coachModalHtml(s: GameState): string {
  if (!coachOpen) return '';
  const drills = DRILLS.map((d) =>
    s.unlockedDrills.includes(d.id)
      ? `<div>✓ ${d.name}</div>`
      : `<div class="dim">▓▓▓ undiscovered</div>`
  ).join('');
  const regions = SCAN_REGIONS.map((r) =>
    s.unlockedRegions.includes(r.id) ? `<div>✓ ${r.name}</div>` : `<div class="dim">▓▓▓ uncharted</div>`
  ).join('');
  return `<div class="modalback"><div class="modal">
    <span class="tag">THE COACH</span>
    <div class="panel"><b>LEGACY <span style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</span></b>
      · ${s.trophies}🏆 · ${s.utTitles} Universal · ${s.totalWins} wins · season ${s.season}${s.season >= 20 ? ' <span class="blink">— you feel the years</span>' : ''}</div>
    <div class="panel"><b>THE HOT SEAT</b><br/>${hotSeatBar(s)}
      <span class="dim">School heat ${s.heatS} · booster heat ${s.heatB}. A side at 50 interferes. Combined 75+: the SUMMONS.</span></div>
    <div class="panel"><b>KNOWLEDGE — drills</b>${drills}</div>
    <div class="panel"><b>KNOWLEDGE — scan regions</b>${regions}</div>
    ${s.careerLog.length ? `<div class="panel dim">${s.careerLog.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
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
  const scoutActs = PROSPECT_ACTS.filter((a) => a.kind === 'scout');
  const recruitActs = PROSPECT_ACTS.filter((a) => a.kind === 'recruit');
  const actBtn = (a: (typeof PROSPECT_ACTS)[number]): string => {
    const banned = a.kind === 'recruit' && pr.bannedWeeks > 0;
    const known = a.kind === 'scout' && pr.scoutLevel >= 2;
    return `<button class="wide hold" data-action="prospect-act" data-id="${a.id}" ${s.energy < a.cost || banned || known ? 'disabled' : ''}>
      <b>${a.name}</b>${a.gain ? ` <span class="xpg">+${a.gain[0]}–${a.gain[1]}%</span>` : ''}${known ? ' — YOU KNOW HIM' : ''}
      ${oddsLine(a.up, a.down, a.cost)}<br/><span class="ddesc">${esc(a.desc)}</span></button>`;
  };
  return `<div class="modalback"><div class="modal">
    <span class="tag">${esc(pr.name)} — ${pr.scoutLevel === 0 ? 'A RUMOR' : pr.scoutLevel === 1 ? 'ONE LOOK TAKEN' : 'KNOWN'}</span>
    <div class="modalcard">${prospectCard(pr, true)}</div>
    <p class="dim">${esc(pr.blurb)} <i>(${esc(speciesById(pr.speciesId).desc)})</i></p>
    ${pr.bannedWeeks > 0 ? `<p class="blink">NO CONTACT ORDER — ${pr.bannedWeeks} more week${pr.bannedWeeks === 1 ? '' : 's'}.</p>` : ''}
    <div class="acthead">SCOUT — know him</div>${scoutActs.map(actBtn).join('')}
    <div class="acthead">RECRUIT — want him</div>${recruitActs.map(actBtn).join('')}
    <button class="wide hold" data-action="prospect-drop">✕ DROP HIM FROM THE BOARD</button>
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
    <div class="modalcard">${playerCard(p, { size: 'full', inert: true })}</div>
    <div class="dim">${esc(sp.name)} (tier ${sp.tier}) — ${esc(sp.desc)}</div>
    <div>Leans: ${(['strong', 'quick', 'fierce', 'savvy'] as const)
      .filter((pl) => lean(p, pl) > 5)
      .map((pl) => `${POLE_LABEL[pl]} <b style="color:${vc(lean(p, pl))}">${Math.round(lean(p, pl))}</b>${effLean(p, pl) < lean(p, pl) - 4 ? ` <span class="dim">(now ${Math.round(effLean(p, pl))})</span>` : ''}`)
      .join(' · ') || 'dead center — a blank slate'}</div>
    <div class="dim">Level ${p.level}/${LEVEL_CAP} · XP ${p.xp}/${p.level >= LEVEL_CAP ? '—' : xpNeed(p.level)} · potential ${starStr(star(p.potential))}</div>
    <button class="wide" data-action="close-detail">CLOSE</button>
  </div></div>`;
}

// ---- nav ---------------------------------------------------------------------------------------

function nav(s: GameState): string {
  switch (s.phase) {
    case 'stories':
      return `<span class="dim">answer the week...</span><span></span>`;
    case 'practice':
      return `<span></span><button class="primary" data-action="to-galaxy">CONTINUE ▶</button>`;
    case 'galaxy':
      return `<button data-action="to-practice">◀ BACK</button><button class="primary" data-action="to-matchup">CONTINUE ▶</button>`;
    case 'matchup':
      return `${isUtWeek(s) ? '<span></span>' : '<button data-action="to-galaxy">◀ BACK</button>'}
        <button class="primary hold" data-action="play-game">▶ PLAY THE GAME</button>`;
    case 'gamenight': {
      const blocked = !gnShown || s.queue.length > 0;
      return `<span></span><button class="primary" data-action="continue-result" ${blocked ? 'disabled' : ''}>CONTINUE ▶</button>`;
    }
    default:
      return '';
  }
}

// ---- shell & render -------------------------------------------------------------------------------

function shell(s: GameState, stage: string): string {
  const grid = s.phase === 'galaxy' ? prospectGridHtml(s) : gridHtml(s);
  return `${headerHtml(s)}
    <div class="screen" id="screen">
      <div class="stage">${stage}</div>
      ${grid}
    </div>
    <div class="navbar">${nav(s)}</div>`;
}

function render(): void {
  if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
  stopType();
  setRamp();

  const ev = currentStory(state);
  if (ev && ev.uid !== storyUid) {
    storyUid = ev.uid;
    storyMode = 'typing';
  }

  let html = '';
  switch (state.phase) {
    case 'pickTeam': html = viewPickTeam(state); break;
    case 'teamSelect': html = viewTeamSelect(state); break;
    case 'departures': html = viewDepartures(state); break;
    case 'signing': html = viewSigning(state); break;
    case 'growth': html = viewGrowth(state); break;
    case 'gameover': html = viewGameover(state); break;
    case 'stories': html = shell(state, stageStories()); break;
    case 'practice': html = shell(state, stagePractice(state)); break;
    case 'galaxy': html = shell(state, stageGalaxy(state)); break;
    case 'matchup': html = shell(state, stageMatchup(state)); break;
    case 'gamenight': html = shell(state, stageGamenight(state)); break;
  }
  html += storyModalHtml(state) + prospectModalHtml(state) + scanModalHtml(state) + toastModalHtml() + bagModalHtml(state) + coachModalHtml(state) + detailModalHtml(state);
  app.innerHTML = html;
  postRender();
}

function revealActions(): void {
  document.getElementById('modal-actions')?.classList.remove('hide');
}

function postRender(): void {
  const ev = currentStory(state);
  const box = document.getElementById('typebox');
  if (box && ev && !toast && !prospectUi?.text && !scanUi?.text) {
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
  } else if (box && (prospectUi?.text !== undefined || scanUi?.text !== undefined || toast)) {
    typewrite(box, toast ?? prospectUi?.text ?? scanUi?.text ?? '', revealActions);
  }

  // gamenight progress beat
  if (state.phase === 'gamenight' && state.lastResult && !gnShown && !state.queue.length) {
    animateProgress();
  }

  // win meter tween
  document.querySelectorAll<HTMLElement>('[data-meter]').forEach((el) => {
    const target = Number(el.dataset.meter);
    if (meterPrev >= 0 && meterPrev !== target && el.classList.contains('meterval')) {
      let cur = meterPrev;
      const step = (): void => {
        cur += Math.sign(target - cur) * Math.max(1, Math.abs(target - cur) / 6);
        if ((target - cur) * Math.sign(target - cur) <= 0.6) cur = target;
        el.textContent = `${Math.round(cur)}%`;
        el.style.color = vc(cur);
        if (cur !== target) requestAnimationFrame(step);
      };
      const m = winMeter(state);
      if (m?.exact) requestAnimationFrame(step);
    }
    if (el.classList.contains('meterval')) meterPrev = target;
  });
}

function animateProgress(): void {
  const stages = ['Tip-off!', 'First half...', 'Halftime. You point at the whiteboard.', 'Second half...', 'Crunch time...', 'Final horn.'];
  const TICKS = 24;
  let tick = 0;
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const finish = (): void => {
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    gnShown = true;
    render();
    // locker room: consequences card by card
    state.postGame.forEach((d, i) => {
      const msgs: { text: string; up?: boolean }[] = [];
      if (d.xpGain > 0) msgs.push({ text: `+${d.xpGain} XP` });
      if (d.energyP !== 0) msgs.push({ text: `${d.energyP > 0 ? '+' : ''}${d.energyP}⚡`, up: d.energyP > 0 });
      if (d.mood !== 0) msgs.push({ text: `${d.mood > 0 ? '+' : ''}${d.mood} MOOD`, up: d.mood > 0 });
      if (msgs.length) floatCard(d.playerId, msgs, 300 + i * 260);
    });
    lastLevelUps.forEach((lu, i) => {
      floatCard(lu.playerId, [{ text: `★ LEVEL UP +${lu.skillGain} SKILL`, up: true }, ...(lu.bonus ? [{ text: lu.bonus.toUpperCase(), up: true }] : [])], 1200 + i * 400);
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

// ---- hold-to-commit ----------------------------------------------------------------------------

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
    executeAction(a, id, el);
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

// ---- drag (matchup lineup) ------------------------------------------------------------------------

interface PtrDrag {
  pointerId: number;
  pid: number;
  card: HTMLElement;
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

function locate(t: Team, playerId: number): { row: 'starters' | 'bench'; idx: number } | 'reserve' {
  for (const row of ['starters', 'bench'] as const) {
    const i = t.lineup[row].indexOf(playerId);
    if (i >= 0) return { row, idx: i };
  }
  return 'reserve';
}

function handleDrop(zone: string, playerId: number): void {
  if (state.phase !== 'matchup') return;
  const t = myTeam(state);
  const p = t.players.find((x) => x.id === playerId);
  if (!p || p.outWeeks > 0) return;
  const from = locate(t, playerId);
  if (zone === 'reserves') {
    if (from !== 'reserve') t.lineup[from.row][from.idx] = null;
    save(state);
    return;
  }
  const [row, idxS] = zone.split(':') as ['starters' | 'bench', string];
  const idx = Number(idxS);
  const occupant = t.lineup[row][idx];
  if (occupant === playerId) return;
  t.lineup[row][idx] = playerId;
  if (from !== 'reserve') t.lineup[from.row][from.idx] = occupant;
  save(state);
}

function activateDrag(): void {
  if (!ptr || ptr.active) return;
  ptr.active = true;
  const rect = ptr.card.getBoundingClientRect();
  const ghost = ptr.card.cloneNode(true) as HTMLElement;
  ghost.classList.add('dragghost');
  ghost.style.width = `${rect.width}px`;
  document.body.appendChild(ghost);
  ptr.ghost = ghost;
  ptr.card.classList.add('draglift');
  moveGhost();
}

function moveGhost(): void {
  if (!ptr?.ghost) return;
  ptr.ghost.style.left = `${ptr.lastX - ptr.ghost.offsetWidth / 2}px`;
  ptr.ghost.style.top = `${ptr.lastY - 40}px`;
  document.querySelectorAll('.dropzone.dragover').forEach((z) => z.classList.remove('dragover'));
  zoneAtPoint()?.classList.add('dragover');
}

function zoneAtPoint(): Element | null {
  if (!ptr) return null;
  return document.elementFromPoint(ptr.lastX, ptr.lastY)?.closest('.dropzone') ?? null;
}

function endDrag(drop: boolean): void {
  if (!ptr) return;
  clearTimeout(ptr.holdTimer);
  if (ptr.active) {
    const zone = drop ? zoneAtPoint() : null;
    ptr.ghost?.remove();
    ptr.card.classList.remove('draglift');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    if (zone) {
      handleDrop(zone.getAttribute('data-zone')!, ptr.pid);
      ptr = null;
      render();
      return;
    }
    document.querySelectorAll('.dropzone.dragover').forEach((z) => z.classList.remove('dragover'));
  }
  ptr = null;
}

app.addEventListener('pointerdown', (e) => {
  if (state.phase !== 'matchup') return;
  const card = (e.target as HTMLElement).closest('.pcard.grabbable') as HTMLElement | null;
  if (!card) return;
  const pid = Number(card.getAttribute('data-pid'));
  ptr = {
    pointerId: e.pointerId, pid, card,
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
    if (e.pointerType === 'mouse' && dist > 6) activateDrag();
    else if (e.pointerType !== 'mouse' && dist > 12) endDrag(false);
    return;
  }
  moveGhost();
});
document.addEventListener('pointerup', (e) => {
  if (ptr && e.pointerId === ptr.pointerId) endDrag(true);
});
document.addEventListener('pointercancel', () => endDrag(false));
document.addEventListener('touchmove', (e) => { if (ptr?.active) e.preventDefault(); }, { passive: false });

// ---- actions ---------------------------------------------------------------------------------------

function executeAction(action: string, id: string, _el?: HTMLElement): void {
  switch (action) {
    case 'pick-team': chooseTeam(state, Number(id)); break;

    // stories
    case 'story-choice': {
      const res = resolveStory(state, id);
      if (res) {
        storyMode = 'result-typing';
        if (state.phase !== 'gameover') floatFx(res.fx, res.resolved.playerId, 500);
      }
      break;
    }

    // practice
    case 'drill': {
      const d = DRILLS.find((x) => x.id === id)!;
      if (d.target === 'one') {
        drillPickOne = drillPickOne === id ? null : id;
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

    // galaxy
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

    // matchup / game
    case 'scout-opp': scoutOpponent(state); break;
    case 'play-game': gnShown = false; clearFloatTimers(); playGame(state); break;

    // offseason
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

    // meta
    case 'use-item': {
      const text = useItem(state, id, prospectUi ? { prospectId: prospectUi.id } : {});
      if (text) { toast = text; bagOpen = false; }
      break;
    }
    case 'new-game':
    case 'new-game-direct':
      wipeSave();
      state = freshGame();
      coachOpen = false;
      bagOpen = false;
      toast = null;
      prospectUi = null;
      scanUi = null;
      poolSelected = null;
      detailPlayerId = null;
      break;
  }
}

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action')!;
  const id = el.getAttribute('data-id') ?? '';
  if (el.classList.contains('hold')) return; // hold buttons commit via the hold, never a tap

  switch (action) {
    // story modal taps
    case 'story-tap': {
      if (finishTypeNow()) return;
      const ev = currentStory(state);
      if (!ev) break;
      if (storyMode === 'result' || (!ev.choices && storyMode !== 'typing') || ev.resolvedText) {
        if (storyMode === 'result') {
          clearFloatTimers();
          dismissStory(state);
          storyUid = -1;
          break;
        }
        if (!ev.choices) {
          // tap-through story: resolve with 'ok', then show any outcome text
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
      }
      return;
    }

    // navigation
    case 'to-practice': toPractice(state); break;
    case 'to-galaxy': drillPickOne = null; toGalaxy(state); break;
    case 'to-matchup': prospectUi = null; scanUi = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'continue-result': gnShown = false; clearFloatTimers(); continueFromResult(state); break;
    case 'skip-progress': return; // progress-wrap handles its own click

    // cards
    case 'card': {
      const pid = Number(id);
      if (state.phase === 'practice') {
        if (drillPickOne) {
          const out = runDrill(state, drillPickOne, pid);
          drillPickOne = null;
          if (out) {
            out.xpByPlayer.forEach((xp, pid2) => floatCard(pid2, [{ text: `+${xp} XP` }], 200));
            out.levelUps.forEach((lu, i) => floatCard(lu.playerId, [{ text: `★ LEVEL UP +${lu.skillGain}`, up: true }], 900 + i * 300));
          }
        } else if (!state.trainedThisWeek) {
          toggleSitout(state, pid);
        } else {
          detailPlayerId = detailPlayerId === pid ? null : pid;
        }
      } else if (state.phase === 'matchup') {
        // drag handles lineup; tap shows detail
        detailPlayerId = detailPlayerId === pid ? null : pid;
      } else {
        detailPlayerId = detailPlayerId === pid ? null : pid;
      }
      break;
    }
    case 'close-detail': detailPlayerId = null; break;

    // galaxy modals
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

    // plan wheel
    case 'plan': setPlan(state, id as PlanId); break;

    // drawers
    case 'bag-open': bagOpen = true; break;
    case 'bag-close': bagOpen = false; break;
    case 'coach-open': coachOpen = true; break;
    case 'coach-close': coachOpen = false; break;

    // signing & selection
    case 'pursue': toggleProspect(state, Number(id)); break;
    case 'pool': {
      const pid = Number(id);
      if (poolSelected) {
        if (poolSelected.has(pid)) poolSelected.delete(pid);
        else if (poolSelected.size < ROSTER_SIZE) poolSelected.add(pid);
      }
      break;
    }

    default:
      executeAction(action, id);
      break;
  }
  render();
});

// dev handle for the console
(window as unknown as { gc: unknown }).gc = { state: () => state, benchPlayers };

render();
