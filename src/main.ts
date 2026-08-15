import {
  CLASS_ABBR,
  SCAN_REGIONS,
  SCHMOOZE_METHODS,
  TRAINING_TYPES,
  speciesById,
} from './engine/data';
import { REGULAR_WEEKS, ROSTER_SIZE, STAT_KEYS, statCap, xpNeed } from './engine/gen';
import { SLOT_ORDER, available, effStat, overall, ovrInSlot, posMult, reserves } from './engine/sim';
import {
  actionDropProspect,
  actionRest,
  actionScan,
  actionSchmooze,
  actionTrain,
  answerPress,
  assignStatPoints,
  chooseTeam,
  continueFromResult,
  convincePro,
  effectiveChances,
  finalizeRoster,
  freshGame,
  goNews,
  legacyScore,
  letGoPro,
  load,
  myMatchup,
  myTeam,
  newsBlocked,
  pendingLevelUps,
  playGame,
  rawOverall,
  resolveNews,
  resolveSigning,
  toLineup,
  toScouting,
  toTraining,
  toggleProspect,
  weekLabel,
  wipeSave,
  save,
} from './engine/state';
import type { GameState, Player, Prospect, Slot, StatKey, Team } from './engine/types';
import { PRACTICE_KIT, faceUrl, iconUrl, spriteUrl, type Kit } from './rig';

const VERSION = 'v0.7';

let state: GameState = load() ?? freshGame();

// ---- transient UI state (never saved) -------------------------------------

type StoryMode = 'typing' | 'choices' | 'result';
interface Story {
  kind: 'press' | 'news';
  idx: number;
  mode: StoryMode;
  fxFired?: boolean;
}
let story: Story | null = null;
const seenStories = new Set<number>();
let trainUi: { pid: number; mode: 'menu' | 'anim' | 'result'; xp?: number } | null = null;
let scoutUi:
  | { kind: 'prospect'; id: number; mode: 'menu' | 'result'; text?: string }
  | { kind: 'scan'; mode: 'menu' | 'result'; text?: string }
  | null = null;
let optionsOpen = false;
let detailPlayerId: number | null = null;
let poolSelected: Set<number> | null = null;
let swipeDir: 'fwd' | 'back' | null = null;
let progressTimer: number | null = null;
let resultShown = false;
let floatTimers: number[] = [];
let prevHdr = { integrity: -1, legacy: -1, energy: -1 };
const xpPrev = new Map<number, number>();

// typewriter
let typeTimer: number | null = null;
let typeState: { el: HTMLElement; text: string; done: () => void } | null = null;

const app = document.getElementById('app')!;

const STAT_LABELS: Record<StatKey, string> = { phy: 'PHY', men: 'MEN', off: 'OFF', def: 'DEF' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function teamLabel(t: Team): string {
  return `${t.planet} ${t.name}`;
}

function chip(t: Team, small = false): string {
  return `<span class="chip ${small ? 'small' : ''}" style="background:${t.bg};color:${t.fg}">${esc(teamLabel(t))}</span>`;
}

function statIcon(k: StatKey): string {
  return `<img class="staticon" src="${iconUrl(k === 'off' ? 'tec' : k)}" alt="${k}"/>`;
}
function boltIcon(): string {
  return `<img class="staticon" src="${iconUrl('bolt', '#ffd23f')}" alt="fitness"/>`;
}
function moodFaceImg(m: number): string {
  return `<img class="face" src="${faceUrl(m)}" alt=""/>`;
}

function ledBand(v: number): string {
  if (v >= 75) return 'white';
  if (v >= 50) return 'green';
  if (v >= 25) return 'orange';
  return 'red';
}

function ledCol(v: number, icon: string, title: string): string {
  const lit = Math.max(1, Math.round(v / 20));
  const band = ledBand(v);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="led ${4 - i < lit ? `on ${band}` : ''}"></span>`
  ).join('');
  return `<div class="ledcol" title="${title} ${v}"><span class="ledicon">${icon}</span>${cells}</div>`;
}

// ---- stickers & floaters --------------------------------------------------

type Anchor = 'mid' | StatKey;
const stickers = new Map<number, { text: string; cls: string; anchor: Anchor }[]>();

function addSticker(pid: number, text: string, cls: string, anchor: Anchor = 'mid'): void {
  const list = stickers.get(pid) ?? [];
  list.push({ text, cls, anchor });
  stickers.set(pid, list.slice(-6));
  const hosts =
    anchor === 'mid'
      ? document.querySelectorAll(`.pcard[data-pid="${pid}"] .stickers`)
      : document.querySelectorAll(`.pcard[data-pid="${pid}"] .statcol[data-anchor="${anchor}"] .statstick`);
  hosts.forEach((host) => {
    const el = document.createElement('span');
    el.className = `sticker ${cls}`;
    el.textContent = text;
    host.appendChild(el);
    while (host.children.length > (anchor === 'mid' ? 4 : 2)) host.removeChild(host.firstChild!);
  });
}

function stickersHtml(pid: number, anchor: Anchor): string {
  const list = (stickers.get(pid) ?? []).filter((st) => st.anchor === anchor);
  const inner = list.map((st) => `<span class="sticker ${st.cls}">${esc(st.text)}</span>`).join('');
  return anchor === 'mid'
    ? `<div class="stickers">${inner}</div>`
    : `<span class="statstick">${inner}</span>`;
}

function floatCard(pid: number, msgs: { text: string; cls?: string; anchor?: Anchor }[], startDelay = 0): void {
  msgs.forEach((m, i) => {
    floatTimers.push(
      window.setTimeout(() => {
        const cards = document.querySelectorAll(`.pcard[data-pid="${pid}"]`);
        if (!cards.length) return;
        cards.forEach((card) => {
          const el = document.createElement('div');
          el.className = `floater ${m.cls ?? ''}`;
          el.textContent = m.text;
          (el as HTMLElement).style.left = `${20 + (i % 3) * 40}px`;
          card.appendChild(el);
          card.classList.add('flash');
          window.setTimeout(() => el.remove(), 1500);
          window.setTimeout(() => card.classList.remove('flash'), 600);
        });
        addSticker(pid, m.text, m.cls ?? '', m.anchor ?? 'mid');
      }, startDelay + i * 420)
    );
  });
}

function clearFloatTimers(): void {
  for (const t of floatTimers) clearTimeout(t);
  floatTimers = [];
}

// ---- typewriter -----------------------------------------------------------

function typewrite(el: HTMLElement | null, text: string, done: () => void): void {
  stopType();
  if (!el) { done(); return; }
  typeState = { el, text, done };
  let i = 0;
  el.textContent = '';
  typeTimer = window.setInterval(() => {
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      stopType();
      done();
    }
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

// ---- cards ----------------------------------------------------------------

interface CardOpts {
  slot?: Slot;
  draggable?: boolean;
  footer?: string;
  tag?: string;
  kit?: Kit;
  /** rendered inside a popup: no click action of its own */
  inert?: boolean;
}

function statColHtml(p: Player, k: StatKey): string {
  const base = p.stats[k];
  const eff = effStat(p, k);
  const tempDown = eff < base - 0.6;
  const lit = Math.max(1, Math.round(eff / 20));
  const band = tempDown ? 'orange' : ledBand(eff);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="led ${4 - i < lit ? `on ${band}` : ''}"></span>`
  ).join('');
  return `<span class="statcol ${tempDown ? 'down' : ''}" data-anchor="${k}" title="${STAT_LABELS[k]} ${eff}">
    ${stickersHtml(p.id, k)}${cells}<span class="ledicon">${statIcon(k)}</span></span>`;
}

function xpBarHtml(p: Player): string {
  const pct = Math.min(100, Math.round((p.xp / xpNeed(p)) * 100));
  return `<div class="xpbar" data-pid="${p.id}" data-pct="${pct}" title="XP ${p.xp}/${xpNeed(p)}"><div class="xpfill" style="width:${pct}%"></div></div>`;
}

function playerCard(p: Player, opts: CardOpts = {}): string {
  const out = p.outWeeks > 0;
  const ovr = opts.slot ? ovrInSlot(p, opts.slot) : overall(p);
  const oop = opts.slot && p.pos !== opts.slot && !out;
  const mult = opts.slot ? posMult(p.pos, opts.slot) : 1;
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const img = spriteUrl(p, kit, p.jersey);
  return `<div class="pcard ${out ? 'pout' : ''} ${opts.draggable && !out ? 'grabbable' : ''}"
      ${opts.inert ? '' : 'data-action="card"'} data-id="${p.id}" data-pid="${p.id}">
    <div class="pcard-top">
      <span class="ovr ${oop ? 'bad' : ''}">${ovr}<span class="potslash ${p.potential - overall(p) >= 15 ? 'gold' : ''}">/${p.potential}</span></span>
      <span class="yr">${CLASS_ABBR[Math.min(p.classYear, 3)]}</span>
      <span class="posbadge">${p.pos}</span>
    </div>
    <div class="pcard-mid">
      ${ledCol(p.mood, moodFaceImg(p.mood), 'mood')}
      <img class="sprite" src="${img}" alt="" draggable="false"/>
      ${ledCol(p.fitness, boltIcon(), 'fitness')}
      ${stickersHtml(p.id, 'mid')}
    </div>
    <div class="pcard-name">${esc(p.name)}</div>
    <div class="statrow">${STAT_KEYS.map((k) => statColHtml(p, k)).join('')}</div>
    ${xpBarHtml(p)}
    ${p.pendingPoints.length ? '<div class="marktag">★ LEVEL UP READY</div>' : ''}
    ${oop ? `<div class="ooptag">OUT OF POSITION −${Math.round((1 - mult) * 100)}%</div>` : ''}
    ${out ? `<div class="ooptag">OUT ${p.outWeeks}w — ${esc(p.outReason)}</div>` : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
    ${opts.footer ?? ''}
  </div>`;
}

function prospectCard(pr: Prospect): string {
  const img = spriteUrl(pr, PRACTICE_KIT, null);
  return `<div class="pcard prospect" data-action="pcell" data-id="${pr.id}">
    <div class="pcard-top">
      <span class="ovr">${rawOverall(pr.stats)}<span class="potslash ${pr.potential - rawOverall(pr.stats) >= 15 ? 'gold' : ''}">/${pr.potential}</span></span>
      <span class="yr">HS</span>
      <span class="posbadge">${pr.pos}</span>
    </div>
    <div class="pcard-mid center"><img class="sprite" src="${img}" alt="" draggable="false"/></div>
    <div class="pcard-name">${esc(pr.name)}</div>
    <div class="pcard-meters"><b class="${pr.commitPct >= 60 ? 'gold' : ''}">${pr.bannedWeeks > 0 ? `<span class="bad">NO CONTACT ${pr.bannedWeeks}w</span>` : `${pr.commitPct}% committed`}</b></div>
  </div>`;
}

/** A full player card inside a popup — every stat visible and animatable. */
function modalCard(p: Player): string {
  return `<div class="modalcard">${playerCard(p, { inert: true })}</div>`;
}

// ---- header ---------------------------------------------------------------

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const maxE = Math.max(6, s.energy);
  const bolts = Array.from({ length: maxE }, (_, i) =>
    `<span class="bolt ${i < s.energy ? 'on' : ''}">⚡</span>`
  ).join('');
  return `<div class="topbar">
    <button class="gear" data-action="options">⚙</button>
    <div class="hrow hrow1">
      ${chip(t)}
      <span class="rec"><b>${t.wins}–${t.losses}</b></span>
      <span class="seasoninfo">SEASON <b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b></span>
    </div>
    <div class="hrow hrow2">
      <span class="energywrap" id="hdr-energy">${bolts}</span>
      <span id="hdr-int">INTEGRITY <b>${s.integrity}</b></span>
      <span>🏆 <b>${s.trophies}</b></span>
      <span id="hdr-leg">LEGACY <b>${legacyScore(s)}</b></span>
      ${s.shipDamaged ? '<span class="bad">⚠ SHIP</span>' : ''}
    </div>
  </div>`;
}

// ---- grid -----------------------------------------------------------------

function gridHtml(s: GameState): string {
  if (s.phase === 'scouting') return prospectGridHtml(s);
  const t = myTeam(s);
  const isLineup = s.phase === 'lineup';
  const rowHtml = (row: 'starters' | 'bench', label: string): string => {
    const cells = SLOT_ORDER.map((sl) => {
      const id = t.lineup[row][sl];
      const p = id !== null ? t.players.find((x) => x.id === id) : undefined;
      return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? `data-zone="${row}:${sl}"` : ''}>
        <div class="slottag">${sl}</div>
        ${p ? playerCard(p, { slot: sl, draggable: isLineup }) : '<div class="pod empty">EMPTY</div>'}
      </div>`;
    }).join('');
    return `<div class="gridrow"><div class="rowlabel">${label}</div>${cells}</div>`;
  };
  const resList = reserves(t).sort((a, b) => overall(b) - overall(a));
  const resRows: string[] = [];
  for (let i = 0; i < Math.max(3, resList.length); i += 3) {
    const cells = [0, 1, 2]
      .map((j) => {
        const p = resList[i + j];
        return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? 'data-zone="reserves"' : ''}>
          ${p ? playerCard(p, { draggable: isLineup }) : '<div class="pod empty">—</div>'}
        </div>`;
      })
      .join('');
    resRows.push(`<div class="gridrow"><div class="rowlabel">${i === 0 ? 'RESERVES' : ''}</div>${cells}</div>`);
  }
  return `<div class="grid">
    ${rowHtml('starters', 'STARTERS')}
    ${rowHtml('bench', 'BENCH')}
    ${resRows.join('')}
  </div>`;
}

function prospectGridHtml(s: GameState): string {
  const cells: string[] = [];
  for (let i = 0; i < 9; i++) {
    const pr = s.prospects[i];
    cells.push(
      `<div class="gcell">${
        pr
          ? prospectCard(pr)
          : `<button class="pod empty scanpod" data-action="scancell">+ SCOUT</button>`
      }</div>`
    );
  }
  const rows: string[] = [];
  for (let i = 0; i < 9; i += 3) {
    rows.push(`<div class="gridrow"><div class="rowlabel">${i === 0 ? 'PROSPECTS' : ''}</div>${cells.slice(i, i + 3).join('')}</div>`);
  }
  return `<div class="grid">${rows.join('')}</div>`;
}

// ---- stages (minimal headers; the popups do the talking) ------------------

function stageNews(): string {
  return `<h2>THIS WEEK'S NEWS</h2><p class="dim">The stories find you. Answer them.</p>`;
}

function stageTraining(s: GameState): string {
  const restRisk = Math.max(0, s.restCount) * 25;
  const restNote = s.restCount === 0 ? 'safe... probably' : `⚠ ${restRisk}% mishap odds`;
  const restReport = s.restReport
    ? `<div class="event calm"><span class="tag">WEEK OFF</span><br/>${esc(s.restReport)}</div>`
    : '';
  return `<h2>PRACTICE</h2><p class="dim">Select a player to train. Each session costs 1⚡ and earns XP toward level-ups.</p>
    <button class="big" data-action="rest" ${s.energy <= 0 ? 'disabled' : ''}>
      🛌 GIVE THE TEAM A WEEK OFF (1⚡, ${restNote})</button>
    ${restReport}`;
}

function stageScouting(s: GameState): string {
  return `<h2>RECRUITING</h2><p class="dim">Tap a prospect to woo him — tap an empty slot to scout for new talent.
    Ignored prospects drift −2%/week. Board ${s.prospects.length}/9.</p>`;
}

function stageLineup(s: GameState): string {
  const m = myMatchup(s);
  if (!m) {
    return `<h2>${weekLabel(s)}</h2>
      <div class="event calm">Your season is over — knocked out of the tournament. The galaxy plays on without you, which feels rude.</div>`;
  }
  const oppAvg = Math.round(m.opponent.players.reduce((a, p) => a + overall(p), 0) / m.opponent.players.length);
  const playoffTag = s.week > REGULAR_WEEKS ? `<span class="gold">${weekLabel(s)} — win or go home.</span><br/>` : '';
  return `<h2>LINEUP</h2>
    ${playoffTag}
    <div class="matchbanner">${m.home ? 'HOME vs' : 'AWAY at'} ${chip(m.opponent)} <span class="dim">(${m.opponent.wins}–${m.opponent.losses}, avg ${oppAvg})</span></div>
    <p class="dim">Hold &amp; drag cards to set your lineup. Starters grow fastest; reserves sulk.</p>`;
}

function bracketHtml(s: GameState): string {
  if (!s.playoff) return '';
  const round = ['QUARTERFINALS', 'SEMIFINALS', 'THE GALACTIC FINAL'][s.playoff.round];
  const games = s.playoff.games
    .map(([h, a]) => {
      const r = s.lastResults.find((x) => x.homeId === h && x.awayId === a);
      return `<div>${chip(s.teams[h], true)} ${r ? `<b>${r.homeScore}</b>` : ''} — ${r ? `<b>${r.awayScore}</b>` : ''} ${chip(s.teams[a], true)}</div>`;
    })
    .join('');
  return `<h2>${round}</h2><div class="panel">${games}</div>`;
}

function stageResult(s: GameState): string {
  const mine = s.lastResults.find((r) => r.homeId === s.myTeamId || r.awayId === s.myTeamId);
  const others = s.lastResults
    .filter((r) => r !== mine)
    .map((r) => `<div class="dim">${esc(s.teams[r.homeId].name)} ${r.homeScore} — ${r.awayScore} ${esc(s.teams[r.awayId].name)}</div>`)
    .join('');
  const standings =
    s.week <= REGULAR_WEEKS
      ? `<h2>STANDINGS</h2><table>${sortedStandingsRows(s)}</table>`
      : bracketHtml(s);

  let myBlock = '';
  if (mine) {
    const home = s.teams[mine.homeId];
    const away = s.teams[mine.awayId];
    const won = (mine.homeScore > mine.awayScore ? home.id : away.id) === s.myTeamId;
    const myBox = mine.box.filter((b) => b.teamId === s.myTeamId).slice(0, 3);
    myBlock = `<h2 class="${won ? 'good' : 'bad'}" style="margin-top:0">${won ? 'VICTORY' : 'DEFEAT'} —
        ${esc(home.name)} ${mine.homeScore}, ${esc(away.name)} ${mine.awayScore}</h2>
      <div class="dim">${esc(mine.starLine)}</div>
      <div>${myBox.map((b) => `${esc(b.name)} ${b.pts}pts`).join(' · ')}</div>
      <p class="dim">XP is settling onto the cards below — assign any level-ups before moving on.</p>`;
  } else {
    myBlock = `<h2 style="margin-top:0">AROUND THE GALAXY</h2><p class="dim">You watched from the stands. It stung.</p>`;
  }

  if (!resultShown) {
    return `<div id="progress-wrap">
        <div id="progress-label">Shuttle in transit...</div>
        <div class="bar"><div class="fill" id="progress-fill"></div></div>
        <button data-action="skip-progress">SKIP</button>
      </div>
      <div id="result-wrap" style="display:none">${myBlock}${others ? `<div class="panel">${others}</div>` : ''}${standings}</div>`;
  }
  return `${myBlock}${others ? `<div class="panel">${others}</div>` : ''}${standings}`;
}

function sortedStandingsRows(s: GameState): string {
  return [...s.teams]
    .sort((a, b) => b.wins - a.wins || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst))
    .map(
      (t, i) => `<tr class="${t.id === s.myTeamId ? 'me' : ''}">
      <td>${i + 1}. ${chip(t, true)}</td><td class="num">${t.wins}–${t.losses}</td></tr>`
    )
    .join('');
}

// ---- popups ---------------------------------------------------------------

function nextStory(s: GameState): Story | null {
  if (s.phase !== 'news') return null;
  if (s.press && !s.press.answered) return { kind: 'press', idx: -1, mode: 'typing' };
  for (let i = 0; i < s.news.length; i++) {
    const n = s.news[i];
    if (n.choices && !n.resolvedText) return { kind: 'news', idx: i, mode: 'typing' };
  }
  for (let i = 0; i < s.news.length; i++) {
    if (!seenStories.has(i)) return { kind: 'news', idx: i, mode: 'result' };
  }
  return null;
}

function storyModalHtml(s: GameState): string {
  if (!story) return '';
  if (story.kind === 'press') {
    const answered = s.press?.answered;
    const opts = !answered
      ? (s.press?.options ?? [])
          .map((o, i) => `<button class="wide" data-action="press" data-id="${i}">${esc(o)}</button>`)
          .join('')
      : '';
    return `<div class="modalback"><div class="modal" data-action="story-tap">
      <span class="tag">PRESS CONFERENCE — +1 ⚡ if you get it right</span>
      <div class="typebox" id="typebox"></div>
      <div class="modal-actions hide" id="modal-actions">${opts}${answered ? '<div class="taphint">▸ tap to continue</div>' : ''}</div>
    </div></div>`;
  }
  const n = s.news[story.idx];
  if (!n) return '';
  const p = n.playerId !== null ? myTeam(s).players.find((x) => x.id === n.playerId) : undefined;
  const isChoice = story.mode !== 'result' && n.choices && !n.resolvedText;
  const btns = isChoice
    ? n.choices!
        .map((c, ci) => {
          const cantAfford = c.energyDelta !== undefined && s.energy + c.energyDelta < 0;
          return `<button class="wide" data-action="story-choice" data-id="${ci}" ${cantAfford ? 'disabled' : ''}>${esc(c.label)}${cantAfford ? ' — NOT ENOUGH ⚡' : ''}</button>`;
        })
        .join('')
    : '<div class="taphint">▸ tap to continue</div>';
  return `<div class="modalback"><div class="modal" data-action="story-tap">
    <span class="tag">${n.playerId === null ? "COACH'S DESK" : 'CAMPUS STORY'}</span>
    ${p ? modalCard(p) : ''}
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions">${btns}</div>
  </div></div>`;
}

function levelUpModalHtml(s: GameState): string {
  if (s.phase !== 'training' && s.phase !== 'result' && s.phase !== 'lineup' && s.phase !== 'scouting') return '';
  if (trainUi || story) return '';
  const p = pendingLevelUps(s)[0];
  if (!p) return '';
  const packet = p.pendingPoints[0];
  const btns = STAT_KEYS.map((k) => {
    const cap = statCap(p, k);
    const capped = p.stats[k] >= cap;
    return `<button class="wide" data-action="assign" data-id="${p.id}:${k}" ${capped ? 'disabled' : ''}>
      ${statIcon(k)} ${STAT_LABELS[k]} <b>${p.stats[k]}</b> → <b class="gold">${Math.min(cap, p.stats[k] + packet)}</b>
      <span class="dim">· potential ${cap}</span>${capped ? ' <span class="bad">(MAXED)</span>' : ''}</button>`;
  }).join('');
  return `<div class="modalback"><div class="modal levelup">
    <span class="tag gold">${packet >= 5 ? '★ BREAKTHROUGH! ★' : 'LEVEL UP!'}</span>
    ${modalCard(p)}
    <p>${esc(p.name)} leveled up — assign <b class="gold">+${packet}</b> points to one stat:</p>
    ${btns}
  </div></div>`;
}

function trainModalHtml(s: GameState): string {
  if (!trainUi || s.phase !== 'training') return '';
  const p = myTeam(s).players.find((x) => x.id === trainUi!.pid);
  if (!p) return '';
  if (trainUi.mode === 'menu') {
    const methods = TRAINING_TYPES.map((d) =>
      s.unlockedTraining.includes(d.id)
        ? `<button class="wide" data-action="train-method" data-id="${d.id}" ${s.energy <= 0 || p.outWeeks > 0 ? 'disabled' : ''}>
            <b>${d.name}</b> <span class="gold">+${d.xp[0]}–${d.xp[1]} XP</span> <span class="dim">· 1⚡</span><br/>
            <span class="region">${esc(d.desc)}</span></button>`
        : `<div class="traintype locked">▓▓▓▓ <span class="dim">undiscovered method</span></div>`
    ).join('');
    return `<div class="modalback"><div class="modal">
      <span class="tag">PRACTICE</span>
      ${modalCard(p)}
      ${p.outWeeks > 0 ? `<p class="bad">OUT ${p.outWeeks}w — ${esc(p.outReason)}. He can watch.</p>` : ''}
      ${methods}
      <button class="wide" data-action="train-close">CLOSE</button>
    </div></div>`;
  }
  if (trainUi.mode === 'anim') {
    return `<div class="modalback"><div class="modal">
      <span class="tag">PRACTICE</span>
      ${modalCard(p)}
      <div class="bar"><div class="fill" id="trainbar"></div></div>
      <p class="dim" id="trainlabel">Working...</p>
    </div></div>`;
  }
  return `<div class="modalback"><div class="modal">
    <span class="tag">PRACTICE COMPLETE</span>
    ${modalCard(p)}
    <p class="gold" style="font-size:20px">+${trainUi.xp} XP</p>
    ${p.pendingPoints.length ? '<p class="gold">★ LEVEL UP READY!</p>' : ''}
    <button class="wide primary" data-action="train-close">DONE</button>
  </div></div>`;
}

function scoutModalHtml(s: GameState): string {
  if (!scoutUi || s.phase !== 'scouting') return '';
  if (scoutUi.kind === 'prospect') {
    const prospect = s.prospects.find((x) => x.id === (scoutUi as { id: number }).id);
    if (!prospect) return '';
    if (scoutUi.mode === 'menu') {
      const banned = prospect.bannedWeeks > 0;
      const methods = SCHMOOZE_METHODS.map(
        (m) => `<button class="wide" data-action="woo" data-id="${m.id}" ${banned || s.energy <= 0 ? 'disabled' : ''}>
          <b>${esc(m.name)}</b> <span class="gold">+${m.gain[0]}–${m.gain[1]}%</span>
          ${m.riskPct ? `<span class="bad">· ${m.riskPct}% risk</span>` : '<span class="dim">· safe</span>'} <span class="dim">· 1⚡</span><br/>
          <span class="region">${esc(m.desc)}</span></button>`
      ).join('');
      return `<div class="modalback"><div class="modal">
        <span class="tag">RECRUITING — ${prospect.commitPct}% committed</span>
        ${prospectCard(prospect)}
        <p class="dim">${esc(prospect.blurb)} <i>(${speciesById(prospect.speciesId).posNote})</i></p>
        ${banned ? `<p class="bad">NO CONTACT ORDER — ${prospect.bannedWeeks} more week${prospect.bannedWeeks === 1 ? '' : 's'}.</p>` : ''}
        ${methods}
        <button class="wide" data-action="scout-drop">✕ DROP HIM FROM THE BOARD</button>
        <button class="wide" data-action="scout-close">CLOSE</button>
      </div></div>`;
    }
    return `<div class="modalback"><div class="modal" data-action="scout-tap">
      <span class="tag">ON THE TRAIL</span>
      <div class="typebox" id="typebox"></div>
      <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap to continue</div></div>
    </div></div>`;
  }
  if (scoutUi.mode === 'menu') {
    const boardFull = s.prospects.length >= 9;
    const regions = SCAN_REGIONS.filter((r) => s.unlockedRegions.includes(r.id)).map((r) => {
      const grounded = s.shipDamaged && !r.local;
      const disabled = grounded || s.energy < r.cost || boardFull;
      return `<button class="wide" data-action="scan-region" data-id="${r.id}" ${disabled ? 'disabled' : ''}>
        <b>${esc(r.name)}</b> <span class="gold">${r.cost}⚡</span>
        ${r.riskPct ? `<span class="bad">· ${r.riskPct}% ship risk</span>` : '<span class="dim">· safe</span>'}
        ${grounded ? '<span class="bad">· GROUNDED</span>' : ''}<br/>
        <span class="region">${esc(r.desc)}</span></button>`;
    }).join('');
    return `<div class="modalback"><div class="modal">
      <span class="tag">SCOUTING RUN</span>
      ${regions}
      <button class="wide" data-action="scout-close">CLOSE</button>
    </div></div>`;
  }
  return `<div class="modalback"><div class="modal" data-action="scout-tap">
    <span class="tag">SCAN RESULTS</span>
    <div class="typebox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap to continue</div></div>
  </div></div>`;
}

function optionsModalHtml(): string {
  if (!optionsOpen) return '';
  return `<div class="modalback"><div class="modal">
    <span class="tag">OPTIONS</span>
    <p class="dim">GALACTIC COACH ${VERSION} — all text now, 8-bit later.</p>
    <button class="wide danger" data-action="new-game">NEW GAME (wipes this save)</button>
    <button class="wide" data-action="options-close">CLOSE</button>
  </div></div>`;
}

// ---- shell ----------------------------------------------------------------

function nav(s: GameState): string {
  switch (s.phase) {
    case 'news': {
      const blocked = newsBlocked(s);
      return `<span></span><button class="primary" data-action="to-training" ${blocked ? 'disabled' : ''}>CONTINUE ▶</button>`;
    }
    case 'training':
      return `<button data-action="go-news">◀ BACK</button>
        <button class="primary" data-action="to-scouting">CONTINUE ▶</button>`;
    case 'scouting':
      return `<button data-action="back-training">◀ BACK</button>
        <button class="primary" data-action="to-lineup">CONTINUE ▶</button>`;
    case 'lineup':
      return `<button data-action="back-scouting">◀ BACK</button>
        <button class="primary" data-action="play-game">${myMatchup(s) ? '▶ PLAY THE GAME' : '▶ SIM THE WEEK'}</button>`;
    case 'result': {
      const blocked = pendingLevelUps(s).length > 0 || !resultShown;
      return `<span></span><button class="primary" data-action="continue-result" ${blocked ? 'disabled' : ''}>
        ${pendingLevelUps(s).length ? 'ASSIGN LEVEL-UPS FIRST' : 'CONTINUE ▶'}</button>`;
    }
    default:
      return '';
  }
}

function detailPanel(s: GameState): string {
  if (detailPlayerId === null) return '';
  const p =
    myTeam(s).players.find((x) => x.id === detailPlayerId) ??
    s.selectPool.find((x) => x.id === detailPlayerId);
  if (!p) return '';
  const sp = speciesById(p.speciesId);
  const rows = STAT_KEYS.map((k) => {
    const base = p.stats[k];
    const eff = effStat(p, k);
    const cap = statCap(p, k);
    const effTxt = eff !== base ? ` <span class="${eff < base ? 'bad' : 'good'}">(${eff})</span>` : '';
    return `<td>${statIcon(k)} ${STAT_LABELS[k]} <b>${base}</b>${effTxt} <span class="dim">/${cap}</span></td>`;
  }).join('');
  const others = SLOT_ORDER.filter((sl) => sl !== p.pos)
    .map((sl) => `${sl} −${Math.round((1 - posMult(p.pos, sl)) * 100)}%`)
    .join(' · ');
  return `<div class="panel detail">
    <b>#${p.jersey} ${esc(p.name)}</b> — ${sp.name}, ${CLASS_ABBR[Math.min(p.classYear, 3)]}
    · ${p.heightCm}cm / ${p.weightKg}kg
    <button data-action="close-detail" style="float:right">CLOSE</button>
    <div>OVR <b>${overall(p)}</b> / POT <b>${p.potential}</b> as a ${p.pos} <span class="dim">(out of position: ${others})</span></div>
    <div>FITNESS ${p.fitness} · MOOD ${p.mood} · XP ${p.xp}/${xpNeed(p)}
      ${p.outWeeks > 0 ? `· <span class="bad">OUT ${p.outWeeks}w — ${esc(p.outReason)}</span>` : ''}</div>
    <table class="attrs"><tr>${rows}</tr></table>
    <div class="dim">${esc(sp.desc)} <i>(${sp.posNote})</i></div>
  </div>`;
}

function shell(s: GameState, stage: string, navHtml: string): string {
  const swipe = swipeDir === 'fwd' ? 'swipe-fwd' : swipeDir === 'back' ? 'swipe-back' : '';
  return `${headerHtml(s)}
    <div class="screen ${swipe}" id="screen">
      <div class="stage">${stage}</div>
      ${detailPanel(s)}
      ${gridHtml(s)}
    </div>
    <div class="navbar">${navHtml}</div>
    ${storyModalHtml(s)}
    ${trainModalHtml(s)}
    ${scoutModalHtml(s)}
    ${levelUpModalHtml(s)}
    ${optionsModalHtml()}`;
}

// ---- offseason full screens -----------------------------------------------

function viewPickTeam(s: GameState): string {
  const cards = s.teams
    .map((t) => {
      const avg = Math.round(t.players.reduce((a, p) => a + overall(p), 0) / t.players.length);
      return `<button class="teampickbtn" data-action="pick-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
        <b>${esc(teamLabel(t))}</b><br/><span>${esc(t.region)} · avg ${avg}</span>
      </button>`;
    })
    .join('');
  return `<h1>GALACTIC COACH</h1>
    <p class="sub">Intergalactic college basketball. 3-on-3. You make ALL the decisions.</p>
    <h2>CHOOSE YOUR PROGRAM</h2>
    <div class="teampick">${cards}</div>`;
}

function viewRecruitingDay(s: GameState): string {
  const isChamp = s.seasonChampion === teamLabel(myTeam(s));
  const champLine = isChamp
    ? `<span class="gold">★ THE ${esc(s.seasonChampion!.toUpperCase())} ARE GALACTIC CHAMPIONS — THAT'S YOU! ★</span>`
    : `Galactic Champions: <b>${esc(s.seasonChampion ?? '')}</b>. Not you. The boosters noticed.`;
  const unresolved = s.proDeparts.filter((d) => !d.resolved);
  const proPanel = s.proDeparts.length
    ? `<div class="event"><span class="tag">GOING PRO</span><br/>
      ${s.proDeparts
        .map((d) =>
          d.resolved
            ? `<div class="propane">${esc(d.name)}: <i>${esc(d.note)}</i> ${d.staying ? '<b class="good">STAYS</b>' : '<b class="bad">GONE</b>'}</div>`
            : `<div class="propane">${esc(d.name)} has pro scouts in his dorm lobby. One conversation — make it count.
              <button data-action="convince-pro" data-id="${d.playerId}">TALK HIM INTO STAYING</button>
              <button data-action="letgo-pro" data-id="${d.playerId}">SHAKE HIS HAND</button></div>`
        )
        .join('')}</div>`
    : '';
  const chances = effectiveChances(s);
  const rows = [...s.prospects]
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((pr) => {
      const eff = chances.find((c) => c.prospect.id === pr.id);
      return `<tr>
        <td><button data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑ SIGNING' : '☐ sign him'}</button></td>
        <td>${esc(pr.name)}</td><td>${pr.pos}</td><td class="num">${rawOverall(pr.stats)}/${pr.potential}</td>
        <td class="num">${pr.commitPct}%</td>
        <td class="num">${pr.selected && eff ? `<b class="gold">→ ${eff.pct}%</b>` : ''}</td>
      </tr>`;
    })
    .join('');
  return `${headerHtml(s)}
    <div class="screen">
    <div class="panel">
      <h2 style="margin-top:0">SEASON ${s.season} COMPLETE</h2>
      <p>${champLine}</p>
    </div>
    ${proPanel}
    <h2>SIGNING DAY</h2>
    <p class="dim">Sign one, keep the full number. Each extra letter costs: −10 on your 2nd, −25 on your 3rd, −45 on your 4th...</p>
    <table>
      <tr><th></th><th>Prospect</th><th>POS</th><th class="num">OVR/POT</th><th class="num">COMMIT</th><th class="num">ODDS</th></tr>
      ${rows || '<tr><td colspan="6" class="dim">You scouted nobody this season. Enjoy the walk-ons.</td></tr>'}
    </table>
    </div>
    <div class="navbar"><span></span><button data-action="do-signing" class="primary" ${unresolved.length ? 'disabled' : ''}>
      ${unresolved.length ? 'DEAL WITH YOUR STARS FIRST' : '▶ SEND THE LETTERS'}</button></div>
    ${optionsModalHtml()}`;
}

function viewTeamSelect(s: GameState): string {
  if (poolSelected === null) {
    poolSelected = new Set(
      [...s.selectPool]
        .filter((p) => !p.walkOn)
        .sort((a, b) => overall(b) - overall(a))
        .slice(0, ROSTER_SIZE)
        .map((p) => p.id)
    );
  }
  const results = s.signingResults.map((r) => `<div>${esc(r)}</div>`).join('');
  const returning = new Set(myTeam(s).players.map((p) => p.id));
  const commits = new Set(s.commits.map((p) => p.id));
  const cards = [...s.selectPool]
    .sort((a, b) => overall(b) - overall(a))
    .map((p) => {
      const tag = returning.has(p.id) ? 'RETURNER' : commits.has(p.id) ? '<span class="gold">RECRUIT</span>' : 'WALK-ON';
      const on = poolSelected!.has(p.id);
      return playerCard(p, {
        tag,
        kit: returning.has(p.id) || commits.has(p.id) ? undefined : PRACTICE_KIT,
        footer: `<button class="pickbtn ${on ? 'on' : ''}" data-action="pool" data-id="${p.id}">${on ? '☑ ON THE SQUAD' : '☐ PICK'}</button>`,
      });
    })
    .join('');
  const n = poolSelected.size;
  return `${headerHtml(s)}
    <div class="screen">
    ${detailPanel(s)}
    ${results ? `<div class="event calm"><span class="tag">${s.season === 0 ? 'TRYOUTS' : 'SIGNING DAY RESULTS'}</span><br/>${results}</div>` : ''}
    <h2>${s.season === 0 ? 'TRYOUTS' : 'PICK YOUR SQUAD'} — season ${s.season + 1}, choose ${ROSTER_SIZE} (${n}/${ROSTER_SIZE})</h2>
    <div class="cardshelf rows4">${cards}</div>
    </div>
    <div class="navbar"><span></span><button data-action="confirm-roster" class="primary" ${n === ROSTER_SIZE ? '' : 'disabled'}>
      ${n === ROSTER_SIZE ? '▶ START THE SEASON' : `SELECT EXACTLY ${ROSTER_SIZE}`}</button></div>
    ${optionsModalHtml()}`;
}

// ---- animations -----------------------------------------------------------

function animateProgress(): void {
  const stages = [
    'Shuttle in transit...',
    'Warm-ups. Someone dunks in layup lines.',
    'Tip-off!',
    'First half...',
    'Halftime speech. You point at the whiteboard a lot.',
    'Second half...',
    'Crunch time...',
    'Final horn.',
  ];
  const TICKS = 36;
  const TICK_MS = 70;
  let tick = 0;
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  // xp & toll floaters spread across the game
  state.postGame.forEach((d, i) => {
    const msgs: { text: string; cls?: string; anchor?: Anchor }[] = [];
    if (d.xpGain > 0) msgs.push({ text: `+${d.xpGain} XP`, cls: 'gold' });
    if (d.fit !== 0) msgs.push({ text: `${d.fit > 0 ? '+' : ''}${d.fit} ⚡`, cls: d.fit < 0 ? 'bad' : 'good' });
    if (d.mood !== 0) msgs.push({ text: `${d.mood > 0 ? '+' : ''}${d.mood} MOOD`, cls: d.mood < 0 ? 'bad' : 'good' });
    if (msgs.length) floatCard(d.playerId, msgs, 400 + i * 300);
  });

  const finish = (): void => {
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    resultShown = true;
    render();
  };
  progressTimer = window.setInterval(() => {
    tick++;
    if (tick > TICKS) { finish(); return; }
    if (fill) fill.style.width = `${Math.round((tick / TICKS) * 100)}%`;
    const stage = Math.min(stages.length - 1, Math.floor((tick / TICKS) * stages.length));
    if (label) label.textContent = stages[stage];
  }, TICK_MS);
  document.getElementById('progress-wrap')?.addEventListener('click', finish);
}

// ---- drag (pointer-based, touch friendly) ---------------------------------

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

type LuLoc = { row: 'starters' | 'bench'; slot: Slot } | 'reserve';

function locate(t: Team, playerId: number): LuLoc {
  for (const row of ['starters', 'bench'] as const) {
    for (const sl of SLOT_ORDER) if (t.lineup[row][sl] === playerId) return { row, slot: sl };
  }
  return 'reserve';
}

function handleDrop(zone: string, playerId: number): void {
  if (state.phase !== 'lineup') return;
  const t = myTeam(state);
  const p = t.players.find((x) => x.id === playerId);
  if (!p) return;
  const from = locate(t, playerId);
  if (zone === 'reserves') {
    if (from !== 'reserve') t.lineup[from.row][from.slot] = null;
    save(state);
    return;
  }
  const [row, slot] = zone.split(':') as ['starters' | 'bench', Slot];
  if (!available(p)) return;
  const occupantId = t.lineup[row][slot];
  if (occupantId === playerId) return;
  t.lineup[row][slot] = playerId;
  if (from !== 'reserve') t.lineup[from.row][from.slot] = occupantId;
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
  if (state.phase !== 'lineup') return;
  const card = (e.target as HTMLElement).closest('.pcard.grabbable') as HTMLElement | null;
  if (!card) return;
  const pid = Number(card.getAttribute('data-pid'));
  ptr = {
    pointerId: e.pointerId,
    pid,
    card,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    active: false,
    holdTimer: 0,
    ghost: null,
  };
  if (e.pointerType === 'touch') {
    ptr.holdTimer = window.setTimeout(() => activateDrag(), 250);
  }
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
document.addEventListener(
  'touchmove',
  (e) => {
    if (ptr?.active) e.preventDefault();
  },
  { passive: false }
);

// ---- render ---------------------------------------------------------------

function render(): void {
  if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
  stopType();

  if (state.phase === 'news' && !story) story = nextStory(state);

  switch (state.phase) {
    case 'pickTeam': app.innerHTML = viewPickTeam(state); break;
    case 'recruiting': app.innerHTML = viewRecruitingDay(state); break;
    case 'teamSelect': app.innerHTML = viewTeamSelect(state); break;
    case 'news': app.innerHTML = shell(state, stageNews(), nav(state)); break;
    case 'training': app.innerHTML = shell(state, stageTraining(state), nav(state)); break;
    case 'scouting': app.innerHTML = shell(state, stageScouting(state), nav(state)); break;
    case 'lineup': app.innerHTML = shell(state, stageLineup(state), nav(state)); break;
    case 'result':
      app.innerHTML = shell(state, stageResult(state), nav(state));
      if (!resultShown) animateProgress();
      break;
  }
  swipeDir = null;
  postRender();
}

function revealActions(): void {
  document.getElementById('modal-actions')?.classList.remove('hide');
}

function postRender(): void {
  // typewriters
  const box = document.getElementById('typebox');
  if (box && story) {
    if (story.kind === 'press' && state.press) {
      const answered = state.press.answered;
      const text = answered
        ? state.press.wasCorrect
          ? 'Nailed it. The beat reporters nod approvingly. +1 ⚡ this week.'
          : `Wrong. The room goes quiet. It was: ${state.press.options[state.press.correctIdx]}.`
        : state.press.text;
      typewrite(box, text, revealActions);
    } else if (story.kind === 'news') {
      const n = state.news[story.idx];
      if (n) {
        const text =
          story.mode === 'result'
            ? n.choices && n.resolvedText
              ? n.resolvedText
              : `${n.text}${n.resolvedText ? `\n\n${n.resolvedText}` : ''}`
            : n.text;
        typewrite(box, text, revealActions);
        if (story.mode === 'result' && !story.fxFired) {
          story.fxFired = true;
        }
      }
    }
  } else if (box && scoutUi && scoutUi.mode === 'result') {
    typewrite(box, scoutUi.text ?? '', revealActions);
  }

  // training bar animation
  if (trainUi?.mode === 'anim') {
    const bar = document.getElementById('trainbar');
    let t = 0;
    const iv = window.setInterval(() => {
      t += 8;
      if (bar) bar.style.width = `${Math.min(100, t)}%`;
      if (t >= 100) {
        clearInterval(iv);
        if (trainUi) trainUi.mode = 'result';
        render();
      }
    }, 80);
  }

  // XP bars animate toward their new fill (wrapping through 100% on level-up)
  const seenPids = new Set<number>();
  document.querySelectorAll<HTMLElement>('.xpbar[data-pid]').forEach((bar) => {
    const pid = Number(bar.dataset.pid);
    const newPct = Number(bar.dataset.pct);
    const fill = bar.firstElementChild as HTMLElement | null;
    seenPids.add(pid);
    if (!fill) return;
    const prev = xpPrev.get(pid);
    if (prev === undefined || prev === newPct) return;
    fill.style.transition = 'none';
    fill.style.width = `${prev}%`;
    void fill.offsetWidth;
    fill.style.transition = '';
    if (newPct >= prev) {
      fill.style.width = `${newPct}%`;
    } else {
      // leveled up: fill to the brim, snap to zero, rise again
      fill.style.width = '100%';
      setTimeout(() => {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void fill.offsetWidth;
        fill.style.transition = '';
        fill.style.width = `${newPct}%`;
      }, 500);
    }
  });
  document.querySelectorAll<HTMLElement>('.xpbar[data-pid]').forEach((bar) => {
    xpPrev.set(Number(bar.dataset.pid), Number(bar.dataset.pct));
  });

  // header pulses when integrity / legacy / energy move
  const pulse = (id: string, delta: number): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('pulse');
    const d = document.createElement('span');
    d.className = `hdrdelta ${delta > 0 ? 'good' : 'bad'}`;
    d.textContent = `${delta > 0 ? '+' : ''}${delta}`;
    el.appendChild(d);
    setTimeout(() => { el.classList.remove('pulse'); d.remove(); }, 1400);
  };
  const leg = legacyScore(state);
  if (prevHdr.integrity >= 0 && state.integrity !== prevHdr.integrity) pulse('hdr-int', state.integrity - prevHdr.integrity);
  if (prevHdr.legacy >= 0 && leg !== prevHdr.legacy) pulse('hdr-leg', leg - prevHdr.legacy);
  if (prevHdr.energy >= 0 && state.energy !== prevHdr.energy) {
    const el = document.getElementById('hdr-energy');
    el?.classList.add('pulse');
    setTimeout(() => el?.classList.remove('pulse'), 900);
  }
  prevHdr = { integrity: state.integrity, legacy: leg, energy: state.energy };
}

function advanceStory(): void {
  if (!story) return;
  if (story.kind === 'news') seenStories.add(story.idx);
  story = null;
  const next = nextStory(state);
  if (next) {
    story = next;
    render();
  } else {
    // straight into practice — no recap screen
    seenStories.clear();
    swipeDir = 'fwd';
    stickers.clear();
    toTraining(state);
    render();
  }
}

// ---- input ----------------------------------------------------------------

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action')!;
  const id = el.getAttribute('data-id') ?? '';

  switch (action) {
    case 'pick-team': chooseTeam(state, Number(id)); break;

    // story popups
    case 'story-tap':
      if (finishTypeNow()) return;
      if (!story) break;
      if (story.kind === 'press' && state.press?.answered) { advanceStory(); return; }
      if (story.kind === 'news') {
        const n = state.news[story.idx];
        if (story.mode === 'result' || !n?.choices || n.resolvedText === undefined && !n.choices) { /* handled below */ }
        if (story.mode === 'result') { advanceStory(); return; }
        if (n && (!n.choices || n.resolvedText)) { advanceStory(); return; }
      }
      return;
    case 'story-choice': {
      if (!story || story.kind !== 'news') break;
      const fx = resolveNews(state, story.idx, Number(id));
      story.mode = 'result';
      render();
      if (fx && fx.playerId !== null) {
        const msgs: { text: string; cls?: string; anchor?: Anchor }[] = [];
        if (fx.moodDelta) msgs.push({ text: `${fx.moodDelta > 0 ? '+' : ''}${fx.moodDelta} MOOD`, cls: fx.moodDelta < 0 ? 'bad' : 'good' });
        if (fx.fitnessDelta) msgs.push({ text: `${fx.fitnessDelta > 0 ? '+' : ''}${fx.fitnessDelta} ⚡`, cls: fx.fitnessDelta < 0 ? 'bad' : 'good' });
        for (const [k, v] of Object.entries(fx.statDeltas)) {
          if (v) msgs.push({ text: `${v > 0 ? '+' : ''}${v} ${STAT_LABELS[k as StatKey]}`, cls: v < 0 ? 'bad' : 'gold', anchor: k as StatKey });
        }
        if (fx.outWeeks) msgs.push({ text: `OUT ${fx.outWeeks}w`, cls: 'bad' });
        if (fx.weightDelta) msgs.push({ text: `${fx.weightDelta > 0 ? '+' : ''}${fx.weightDelta}kg`, cls: 'warn' });
        floatCard(fx.playerId, msgs, 300);
      }
      return;
    }
    case 'press':
      answerPress(state, Number(id));
      render();
      return;

    // navigation
    case 'go-news': swipeDir = 'back'; stickers.clear(); story = null; seenStories.clear(); goNews(state); break;
    case 'to-training': swipeDir = 'fwd'; stickers.clear(); toTraining(state); break;
    case 'back-training': swipeDir = 'back'; stickers.clear(); trainUi = null; toTraining(state); break;
    case 'to-scouting': swipeDir = 'fwd'; stickers.clear(); trainUi = null; toScouting(state); break;
    case 'back-scouting': swipeDir = 'back'; stickers.clear(); scoutUi = null; toScouting(state); break;
    case 'to-lineup': swipeDir = 'fwd'; stickers.clear(); scoutUi = null; toLineup(state); break;
    case 'play-game': swipeDir = 'fwd'; stickers.clear(); resultShown = false; playGame(state); break;
    case 'skip-progress': return; // handled by progress-wrap click
    case 'continue-result': swipeDir = 'fwd'; stickers.clear(); clearFloatTimers(); story = null; seenStories.clear(); continueFromResult(state); break;

    // training
    case 'card':
      if (state.phase === 'training') trainUi = { pid: Number(id), mode: 'menu' };
      else detailPlayerId = detailPlayerId === Number(id) ? null : Number(id);
      break;
    case 'train-method': {
      if (!trainUi) break;
      const xp = actionTrain(state, id, trainUi.pid);
      if (xp !== null) trainUi = { pid: trainUi.pid, mode: 'anim', xp };
      break;
    }
    case 'train-close': trainUi = null; break;
    case 'rest':
      if (actionRest(state)) {
        myTeam(state).players.forEach((p, i) => {
          setTimeout(() => floatCard(p.id, [{ text: '+15 ⚡', cls: 'good' }]), i * 120);
        });
      }
      break;

    // level-ups
    case 'assign': {
      const [pid, k] = id.split(':');
      const pts = assignStatPoints(state, Number(pid), k as StatKey);
      if (pts !== null) {
        setTimeout(() => floatCard(Number(pid), [{ text: `+${pts} ${STAT_LABELS[k as StatKey]}`, cls: 'gold', anchor: k as StatKey }]), 0);
      }
      break;
    }

    // scouting
    case 'pcell': scoutUi = { kind: 'prospect', id: Number(id), mode: 'menu' }; break;
    case 'scancell': scoutUi = { kind: 'scan', mode: 'menu' }; break;
    case 'woo': {
      if (!scoutUi || scoutUi.kind !== 'prospect') break;
      const text = actionSchmooze(state, scoutUi.id, id);
      if (text !== null) scoutUi = { kind: 'prospect', id: scoutUi.id, mode: 'result', text };
      break;
    }
    case 'scan-region': {
      const text = actionScan(state, id);
      if (text !== null) scoutUi = { kind: 'scan', mode: 'result', text };
      break;
    }
    case 'scout-drop':
      if (scoutUi?.kind === 'prospect') actionDropProspect(state, scoutUi.id);
      scoutUi = null;
      break;
    case 'scout-tap':
      if (finishTypeNow()) return;
      scoutUi = null;
      break;
    case 'scout-close': scoutUi = null; break;

    // misc
    case 'close-detail': detailPlayerId = null; break;
    case 'pursue': toggleProspect(state, Number(id)); break;
    case 'convince-pro': convincePro(state, Number(id)); break;
    case 'letgo-pro': letGoPro(state, Number(id)); break;
    case 'do-signing': poolSelected = null; resolveSigning(state); break;
    case 'pool': {
      const pid = Number(id);
      if (poolSelected) {
        if (poolSelected.has(pid)) poolSelected.delete(pid);
        else if (poolSelected.size < ROSTER_SIZE) poolSelected.add(pid);
      }
      break;
    }
    case 'confirm-roster':
      if (poolSelected && finalizeRoster(state, [...poolSelected])) {
        poolSelected = null;
        detailPlayerId = null;
        story = null;
        seenStories.clear();
      }
      break;
    case 'options': optionsOpen = true; break;
    case 'options-close': optionsOpen = false; break;
    case 'new-game':
      if (confirm('Wipe the save and start over?')) {
        wipeSave();
        state = freshGame();
        optionsOpen = false;
        story = null;
        seenStories.clear();
        trainUi = null;
        scoutUi = null;
        detailPlayerId = null;
        poolSelected = null;
      }
      break;
  }
  render();
});

render();
