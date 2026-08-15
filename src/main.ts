import {
  CLASS_ABBR,
  CLASS_NAMES,
  SCAN_REGIONS,
  SCHMOOZE_METHODS,
  TRAINING_TYPES,
  speciesById,
  trainingById,
} from './engine/data';
import { ATTR_KEYS, REGULAR_WEEKS, ROSTER_SIZE, attrCap } from './engine/gen';
import {
  GROUP_ATTRS,
  SLOT_ORDER,
  aiTactics,
  available,
  effAttr,
  groupVal,
  normalizeLineup,
  overall,
  ovrInSlot,
  posMult,
  reserves,
  teamGroupAvg,
  type Group,
} from './engine/sim';
import {
  TRAINING_SQUAD_SIZE,
  actionRest,
  actionScan,
  actionSchmooze,
  actionScoutOpp,
  actionTrainSession,
  actionDropProspect,
  answerPress,
  convincePro,
  letGoPro,
  setTactic,
  chooseTeam,
  continueFromResult,
  effectiveChances,
  finalizeRoster,
  freshGame,
  goNews,
  legacyScore,
  load,
  myMatchup,
  myTeam,
  newsBlocked,
  playGame,
  resolveNews,
  resolveSigning,
  save,
  sortedStandings,
  toLineup,
  toScouting,
  toTraining,
  toggleProspect,
  weekLabel,
  wipeSave,
} from './engine/state';
import type { AttrKey, Attrs, GameState, Player, Prospect, Slot, Team } from './engine/types';
import { PRACTICE_KIT, faceUrl, iconUrl, spriteUrl, type Kit } from './rig';

let state: GameState = load() ?? freshGame();

// transient UI state (never saved)
let detailPlayerId: number | null = null;
let poolSelected: Set<number> | null = null;
let progressTimer: number | null = null;
let trainType: string | null = null;
let trainSquad: number[] = [];
let selProspect: number | null = null;
let swipeDir: 'fwd' | 'back' | null = null;
let floatTimers: number[] = [];

const app = document.getElementById('app')!;

const ATTR_LABELS: Record<AttrKey, string> = {
  agi: 'AGI', str: 'STR', han: 'HAN', sho: 'SHO', foc: 'FOC', agg: 'AGG', iq: 'IQ', tou: 'TOU',
};
const ATTR_GROUPS: { name: string; keys: [AttrKey, AttrKey] }[] = [
  { name: 'PHYSICAL', keys: ['agi', 'str'] },
  { name: 'TECHNICAL', keys: ['han', 'sho'] },
  { name: 'DEFENSE', keys: ['foc', 'agg'] },
  { name: 'MENTAL', keys: ['iq', 'tou'] },
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function teamLabel(t: Team): string {
  return `${t.planet} ${t.name}`;
}

function chip(t: Team, small = false): string {
  return `<span class="chip ${small ? 'small' : ''}" style="background:${t.bg};color:${t.fg}">${esc(teamLabel(t))}</span>`;
}

// ---- card bits ------------------------------------------------------------

function moodFaceImg(m: number): string {
  return `<img class="face" src="${faceUrl(m)}" alt=""/>`;
}

type Anchor = 'mid' | Group;

const ATTR_ANCHOR: Record<AttrKey, Group> = {
  agi: 'phy', str: 'phy', han: 'tec', sho: 'tec', foc: 'def', agg: 'def', iq: 'men', tou: 'men',
};

function groupIcon(g: Group): string {
  return `<img class="staticon" src="${iconUrl(g)}" alt="${g}"/>`;
}
function boltIcon(): string {
  return `<img class="staticon" src="${iconUrl('bolt', '#ffd23f')}" alt="fitness"/>`;
}

function ledBand(v: number): string {
  if (v >= 75) return 'white';
  if (v >= 50) return 'green';
  if (v >= 25) return 'orange';
  return 'red';
}

/** Vertical LED meter: icon on top, 5 cells lighting up bottom-to-high. */
function ledCol(v: number, icon: string, title: string): string {
  const lit = Math.max(1, Math.round(v / 20));
  const band = ledBand(v);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="led ${4 - i < lit ? `on ${band}` : ''}"></span>`
  ).join('');
  return `<div class="ledcol" title="${title} ${v}"><span class="ledicon">${icon}</span>${cells}</div>`;
}

// stat-change stickers: persist on the card until the next screen
const stickers = new Map<number, { text: string; cls: string; anchor: Anchor }[]>();

function addSticker(pid: number, text: string, cls: string, anchor: Anchor = 'mid'): void {
  const list = stickers.get(pid) ?? [];
  list.push({ text, cls, anchor });
  stickers.set(pid, list.slice(-6));
  const host =
    anchor === 'mid'
      ? document.querySelector(`.pcard[data-pid="${pid}"] .stickers`)
      : document.querySelector(`.pcard[data-pid="${pid}"] .statcol[data-anchor="${anchor}"] .statstick`);
  if (host) {
    const el = document.createElement('span');
    el.className = `sticker ${cls}`;
    el.textContent = text;
    host.appendChild(el);
    while (host.children.length > (anchor === 'mid' ? 4 : 2)) host.removeChild(host.firstChild!);
  }
}

function stickersHtml(pid: number, anchor: Anchor): string {
  const list = (stickers.get(pid) ?? []).filter((st) => st.anchor === anchor);
  const inner = list.map((st) => `<span class="sticker ${st.cls}">${esc(st.text)}</span>`).join('');
  return anchor === 'mid'
    ? `<div class="stickers">${inner}</div>`
    : `<span class="statstick">${inner}</span>`;
}

/** Bottom-of-card stat column: LEDs stacked above an icon, lit bottom-up.
 *  Turns orange when the group is temporarily dragged below its base value. */
function statCol(p: Player, g: Group): string {
  const [a, b] = GROUP_ATTRS[g];
  const wLead = p.pos === 'G' ? 0.75 : p.pos === 'C' ? 0.25 : 0.5;
  const base = p.attrs[a] * wLead + p.attrs[b] * (1 - wLead);
  const eff = groupVal(p, g);
  const tempDown = eff < base - 0.6;
  const lit = Math.max(1, Math.round(eff / 20));
  const band = tempDown ? 'orange' : ledBand(eff);
  const cells = Array.from({ length: 5 }, (_, i) =>
    `<span class="led ${4 - i < lit ? `on ${band}` : ''}"></span>`
  ).join('');
  return `<span class="statcol ${tempDown ? 'down' : ''}" data-anchor="${g}" title="${g} ${Math.round(eff)}">
    ${stickersHtml(p.id, g)}${cells}<span class="ledicon">${groupIcon(g)}</span></span>`;
}

interface CardOpts {
  slot?: Slot;
  draggable?: boolean;
  marked?: boolean;
  footer?: string;
  tag?: string;
  /** jersey colors; defaults to my team's kit */
  kit?: Kit;
}

function playerCard(p: Player, opts: CardOpts = {}): string {
  const out = p.outWeeks > 0;
  const ovr = opts.slot ? ovrInSlot(p, opts.slot) : overall(p);
  const oop = opts.slot && p.pos !== opts.slot && !out;
  const mult = opts.slot ? posMult(p.pos, opts.slot) : 1;
  const t = myTeam(state);
  const kit = opts.kit ?? { bg: t.bg, fg: t.fg };
  const img = spriteUrl(p, kit, p.jersey);
  return `<div class="pcard ${out ? 'pout' : ''} ${opts.marked ? 'marked' : ''} ${opts.draggable && !out ? 'grabbable' : ''}"
      data-action="card" data-id="${p.id}" data-pid="${p.id}">
    <div class="pcard-top">
      <span class="ovr ${oop ? 'bad' : ''}">${ovr}<span class="potslash ${p.potential - overall(p) >= 15 ? 'gold' : ''}" title="potential">/${p.potential}</span></span>
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
    <div class="statrow">${(['phy', 'men', 'tec', 'def'] as Group[]).map((g) => statCol(p, g)).join('')}</div>
    ${oop ? `<div class="ooptag">OUT OF POSITION −${Math.round((1 - mult) * 100)}%</div>` : ''}
    ${out ? `<div class="ooptag">OUT ${p.outWeeks}w — ${esc(p.outReason)}</div>` : ''}
    ${opts.marked ? '<div class="marktag">⚡ IN THE POD</div>' : ''}
    ${opts.tag ? `<div class="cardtag">${opts.tag}</div>` : ''}
    ${opts.footer ?? ''}
  </div>`;
}

function rawOverall(attrs: Attrs): number {
  return Math.round(ATTR_KEYS.reduce((a, k) => a + attrs[k], 0) / ATTR_KEYS.length);
}

function prospectCard(pr: Prospect, selected: boolean, withDrop = false): string {
  const img = spriteUrl(pr, PRACTICE_KIT, null);
  return `<div class="pcard prospect ${selected ? 'sel' : ''}" data-action="sel-prospect" data-id="${pr.id}">
    <div class="pcard-top">
      <span class="ovr">${rawOverall(pr.attrs)}<span class="potslash ${pr.potential - rawOverall(pr.attrs) >= 15 ? 'gold' : ''}" title="potential">/${pr.potential}</span></span>
      <span class="yr">HS</span>
      <span class="posbadge">${pr.pos}</span>
    </div>
    <div class="pcard-mid center"><img class="sprite" src="${img}" alt="" draggable="false"/></div>
    <div class="pcard-name">${esc(pr.name)}</div>
    <div class="pcard-meters"><b class="${pr.commitPct >= 60 ? 'gold' : ''}">${pr.bannedWeeks > 0 ? `<span class="bad">NO CONTACT ${pr.bannedWeeks}w</span>` : `${pr.commitPct}% committed`}</b></div>
    ${withDrop ? `<button class="pickbtn" data-action="drop-prospect" data-id="${pr.id}">✕ DROP</button>` : ''}
  </div>`;
}

// ---- floaters (numbers rising off cards) ----------------------------------

function floatCard(pid: number, msgs: { text: string; cls?: string; anchor?: Anchor }[], startDelay = 0): void {
  msgs.forEach((m, i) => {
    floatTimers.push(
      window.setTimeout(() => {
        const card = document.querySelector(`.pcard[data-pid="${pid}"]`);
        if (!card) return;
        const el = document.createElement('div');
        el.className = `floater ${m.cls ?? ''}`;
        el.textContent = m.text;
        (el as HTMLElement).style.left = `${20 + (i % 3) * 40}px`;
        card.appendChild(el);
        card.classList.add('flash');
        addSticker(pid, m.text, m.cls ?? '', m.anchor ?? 'mid');
        window.setTimeout(() => el.remove(), 1500);
        window.setTimeout(() => card.classList.remove('flash'), 600);
      }, startDelay + i * 420)
    );
  });
}

function clearFloatTimers(): void {
  for (const t of floatTimers) clearTimeout(t);
  floatTimers = [];
}

// ---- persistent shell -----------------------------------------------------

function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const maxE = Math.max(3, s.energy);
  const bolts = Array.from({ length: maxE }, (_, i) =>
    `<span class="bolt ${i < s.energy ? 'on' : ''}">⚡</span>`
  ).join('');
  const crumbs: [string, string][] = [
    ['news', 'NEWS'], ['training', 'TRAINING'], ['scouting', 'RECRUITING'], ['lineup', 'LINEUP'], ['result', 'GAME'],
  ];
  const crumbHtml = crumbs
    .map(([ph, label]) => `<span class="${s.phase === ph ? 'crumb on' : 'crumb'}">${label}</span>`)
    .join(' ▸ ');
  return `<div class="topbar">
    <div class="hdr">
      ${chip(t)}
      <span><b>${t.wins}–${t.losses}</b></span>
      <span>SEASON <b>${Math.max(1, s.season)}</b> · <b>${weekLabel(s)}</b></span>
      <span>INTEGRITY <b>${s.integrity}</b></span>
      <span>TROPHIES <b>${s.trophies}</b></span>
      <span>LEGACY <b>${legacyScore(s)}</b></span>
      ${s.shipDamaged ? '<span class="bad">⚠ SHIP GROUNDED</span>' : ''}
    </div>
    <div class="energyrow"><span class="dim">ENERGY</span> ${bolts} <span class="crumbs">${crumbHtml}</span></div>
  </div>`;
}

function gridHtml(s: GameState): string {
  const t = myTeam(s);
  const isLineup = s.phase === 'lineup';
  const rowHtml = (row: 'starters' | 'bench', label: string): string => {
    const cells = SLOT_ORDER.map((sl) => {
      const id = t.lineup[row][sl];
      const p = id !== null ? t.players.find((x) => x.id === id) : undefined;
      return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? `data-zone="${row}:${sl}"` : ''}>
        <div class="slottag">${sl}</div>
        ${p ? playerCard(p, { slot: sl, draggable: isLineup, marked: trainSquad.includes(p.id) && s.phase === 'training' }) : '<div class="pod empty">EMPTY</div>'}
      </div>`;
    }).join('');
    return `<div class="gridrow"><div class="rowlabel">${label}</div>${cells}</div>`;
  };
  // reserves use the same three columns as the rows above them
  const resList = reserves(t).sort((a, b) => overall(b) - overall(a));
  const resRows: string[] = [];
  for (let i = 0; i < Math.max(3, resList.length); i += 3) {
    const cells = [0, 1, 2]
      .map((j) => {
        const p = resList[i + j];
        return `<div class="gcell ${isLineup ? 'dropzone' : ''}" ${isLineup ? 'data-zone="reserves"' : ''}>
          ${p ? playerCard(p, { draggable: isLineup, marked: trainSquad.includes(p.id) && s.phase === 'training' }) : '<div class="pod empty">—</div>'}
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

function detailPanel(s: GameState): string {
  if (detailPlayerId === null) return '';
  const p =
    myTeam(s).players.find((x) => x.id === detailPlayerId) ??
    s.selectPool.find((x) => x.id === detailPlayerId);
  if (!p) return '';
  const sp = speciesById(p.speciesId);
  const groups = ATTR_GROUPS.map(({ name, keys }) => {
    const cells = keys
      .map((k) => {
        const base = p.attrs[k];
        const eff = effAttr(p, k);
        const cap = Math.min(attrCap(p, k), p.potential);
        const effTxt = eff !== base ? ` <span class="${eff < base ? 'bad' : 'good'}">(${eff})</span>` : '';
        const capTxt = base >= cap ? ' <span class="dim">MAX</span>' : '';
        return `<td>${ATTR_LABELS[k]} <b>${base}</b>${effTxt}${capTxt}</td>`;
      })
      .join('');
    return `<td class="dim">${name}</td>${cells}`;
  });
  const others = SLOT_ORDER.filter((sl) => sl !== p.pos)
    .map((sl) => `${sl} at −${Math.round((1 - posMult(p.pos, sl)) * 100)}% (${ovrInSlot(p, sl)})`)
    .join(' · ');
  return `<div class="panel detail">
    <b>#${p.jersey} ${esc(p.name)}</b> — ${sp.name}, ${CLASS_NAMES[Math.min(p.classYear, 3)]}
    · ${p.heightCm}cm / ${p.weightKg}kg · potential ${p.potential}
    ${p.walkOn ? ' · <span class="dim">walk-on</span>' : ''}
    <button data-action="close-detail" style="float:right">CLOSE</button>
    <div>OVERALL <b>${overall(p)}</b> as a ${p.pos} · out of position: ${others}</div>
    <div>FITNESS ${p.fitness} · MOOD ${p.mood} ${
      p.outWeeks > 0 ? `· <span class="bad">OUT ${p.outWeeks}w — ${esc(p.outReason)}</span>` : ''
    }</div>
    <table class="attrs"><tr>${groups[0]}</tr><tr>${groups[1]}</tr><tr>${groups[2]}</tr><tr>${groups[3]}</tr></table>
    <div class="dim">${esc(sp.desc)}</div>
  </div>`;
}

function modalHtml(s: GameState): string {
  if (s.phase !== 'news') return '';
  const t = myTeam(s);
  if (s.press && !s.press.answered) {
    const opts = s.press.options
      .map((o, i) => `<button class="wide" data-action="press" data-id="${i}">${esc(o)}</button>`)
      .join('');
    return `<div class="modalback"><div class="modal">
      <span class="tag">PRESS CONFERENCE — get it right for +1 ⚡</span>
      <p>${esc(s.press.text)}</p>${opts}</div></div>`;
  }
  const idx = s.news.findIndex((n) => n.choices && !n.resolvedText);
  if (idx < 0) return '';
  const n = s.news[idx];
  const p = n.playerId !== null ? t.players.find((x) => x.id === n.playerId) : undefined;
  const mug = p ? `<img class="newsmug" src="${spriteUrl(p, { bg: t.bg, fg: t.fg }, p.jersey)}" alt=""/>` : '';
  const btns = n.choices!
    .map((c, ci) => {
      const cantAfford = c.energyDelta !== undefined && s.energy + c.energyDelta < 0;
      return `<button class="wide" data-action="news-choice" data-id="${idx}:${ci}" ${cantAfford ? 'disabled' : ''}>${esc(c.label)}${cantAfford ? ' — NOT ENOUGH ⚡' : ''}</button>`;
    })
    .join('');
  return `<div class="modalback"><div class="modal">
    <span class="tag">DECISION REQUIRED</span>
    <div class="modalbody">${mug}<p>${esc(n.text)}</p></div>${btns}</div></div>`;
}

function shell(s: GameState, stage: string, nav: string): string {
  const swipe = swipeDir === 'fwd' ? 'swipe-fwd' : swipeDir === 'back' ? 'swipe-back' : '';
  return `${headerHtml(s)}
    <div class="stage ${swipe}" id="stage">${stage}</div>
    <div class="navbar">${nav}</div>
    ${detailPanel(s)}
    ${gridHtml(s)}
    ${modalHtml(s)}
    <div class="footer">GALACTIC COACH v0.5 — all text now, 8-bit later.
      <button data-action="new-game" class="danger">NEW GAME</button></div>`;
}

// ---- stages ---------------------------------------------------------------

function stageNews(s: GameState): string {
  const t = myTeam(s);
  const mug = (pid: number | null): string => {
    const p = pid !== null ? t.players.find((x) => x.id === pid) : undefined;
    return p ? `<img class="newsmug" src="${spriteUrl(p, { bg: t.bg, fg: t.fg }, p.jersey)}" alt=""/>` : '';
  };
  const visible = s.news.filter((n) => !n.choices || n.resolvedText);
  const pendingCount = s.news.filter((n) => n.choices && !n.resolvedText).length;
  const items = visible.length
    ? visible
        .map(
          (n) => `<div class="event calm withmug">${mug(n.playerId)}<div>${esc(n.text)}${n.resolvedText ? `<br/><i>${esc(n.resolvedText)}</i>` : ''}</div></div>`
        )
        .join('')
    : pendingCount
      ? ''
      : `<div class="event calm dim">A quiet week on campus. Suspiciously quiet.</div>`;

  let press = '';
  if (s.press) {
    if (!s.press.answered) {
      press = '';
    } else {
      press = `<div class="event press"><span class="tag">PRESS CONFERENCE</span><br/>
        ${s.press.wasCorrect
          ? '<span class="good">Nailed it. The beat reporters nod approvingly. +1 ⚡ this week.</span>'
          : `<span class="bad">Wrong. The room goes quiet. It was: ${esc(s.press.options[s.press.correctIdx])}.</span>`}</div>`;
    }
  }
  return `<h2>THIS WEEK'S NEWS</h2>${press}${items}`;
}

function stageTraining(s: GameState): string {
  const t = myTeam(s);
  const availableCount = t.players.filter((p) => available(p)).length;
  const required = Math.min(TRAINING_SQUAD_SIZE, availableCount);
  const typeCards = TRAINING_TYPES.map((d) =>
    s.unlockedTraining.includes(d.id)
      ? `<button class="traintype ${trainType === d.id ? 'sel' : ''}" data-action="train-type" data-id="${d.id}" ${s.energy <= 0 ? 'disabled' : ''}>
        <b>${d.name}</b> <span class="gold">${ATTR_LABELS[d.attrs[0]]}+${ATTR_LABELS[d.attrs[1]]}</span></button>`
      : `<div class="traintype locked">▓▓▓▓▓ <span class="dim">undiscovered method — seminars, oracles, who knows</span></div>`
  ).join('');
  const def = trainType ? TRAINING_TYPES.find((d) => d.id === trainType) : null;

  let startLabel: string;
  let ready = false;
  if (s.energy <= 0) startLabel = 'NO ENERGY LEFT THIS WEEK';
  else if (!trainType) startLabel = '▲ PICK A TRAINING TYPE';
  else if (trainSquad.length < required) {
    const missing = required - trainSquad.length;
    startLabel = `▼ MARK ${missing} MORE PLAYER${missing === 1 ? '' : 'S'} BELOW`;
  } else {
    startLabel = `▶ START ${def?.name ?? ''} (1⚡)`;
    ready = true;
  }

  const results = s.lastTraining
    ? `<div class="event calm"><span class="tag">${trainingById(s.lastTraining.typeId).name} — RESULTS</span><br/>
      ${s.lastTraining.lines
        .map((l) => {
          const gains = Object.entries(l.gains)
            .map(([k, v]) => `+${v} ${ATTR_LABELS[k as AttrKey]}`)
            .join(', ');
          return `${esc(l.name)}: <b class="good">${gains}</b>${l.breakthrough ? ' <span class="gold">— BREAKTHROUGH!</span>' : ''}`;
        })
        .join('<br/>')}</div>`
    : '';

  const restRisk = Math.max(0, s.restCount) * 25;
  const restNote = s.restCount === 0 ? 'safe... probably' : `⚠ ${restRisk}% mishap odds`;
  const restReport = s.restReport
    ? `<div class="event calm"><span class="tag">WEEK OFF</span><br/>${esc(s.restReport)}</div>`
    : '';
  return `<h2>TRAINING <span class="dim">— 1⚡ per session, mark ${required} players below</span></h2>
    <div class="traintypes">${typeCards}</div>
    ${def ? `<p class="dim">${esc(def.desc)}</p>` : ''}
    <button class="primary big" data-action="train-start" ${ready ? '' : 'disabled'}>${startLabel}</button>
    <button class="big" data-action="rest" ${s.energy <= 0 ? 'disabled' : ''}>
      🛌 GIVE THE TEAM A WEEK OFF — everyone recovers (1⚡, ${restNote})</button>
    ${results}
    ${restReport}`;
}

function stageScouting(s: GameState): string {
  const prospectCards = s.prospects
    .map((pr) => prospectCard(pr, selProspect === pr.id, true))
    .join('');
  const selBanned = s.prospects.find((p) => p.id === selProspect)?.bannedWeeks ?? 0;
  const methods = SCHMOOZE_METHODS.map(
    (m) => `<button class="wide" data-action="schmooze" data-id="${m.id}" ${selProspect === null || selBanned > 0 || s.energy <= 0 ? 'disabled' : ''}>
      <b>${esc(m.name)}</b> <span class="gold">+${m.gain[0]}–${m.gain[1]}%</span>
      ${m.riskPct ? `<span class="bad">· ${m.riskPct}% risk</span>` : '<span class="dim">· safe</span>'} <span class="dim">· 1⚡</span></button>`
  ).join('');
  const boardFull = s.prospects.length >= 9;
  const scans = SCAN_REGIONS.filter((r) => s.unlockedRegions.includes(r.id)).map((r) => {
    const grounded = s.shipDamaged && !r.local;
    const disabled = grounded || s.energy < r.cost || boardFull;
    return `<button class="wide" data-action="scan" data-id="${r.id}" ${disabled ? 'disabled' : ''}>
      <b>${esc(r.name)}</b> <span class="gold">${r.cost}⚡</span>
      ${r.riskPct ? `<span class="bad">· ${r.riskPct}% ship risk</span>` : '<span class="dim">· safe</span>'}
      ${grounded ? '<span class="bad">· SHIP GROUNDED</span>' : ''}<br/>
      <span class="region">${esc(r.desc)}</span></button>`;
  }).join('');
  const log = s.recruitLog.length
    ? `<div class="event calm"><span class="tag">THIS WEEK ON THE TRAIL</span><br/>${s.recruitLog.map(esc).join('<br/>')}</div>`
    : '';
  return `<h2>RECRUITING <span class="dim">— board ${s.prospects.length}/9${s.prospects.length >= 9 ? ' FULL: drop someone to scan' : ''} · prospects drift −2%/week if ignored</span></h2>
    <div class="cardshelf prospects">${prospectCards || '<span class="dim">Nobody on the board. Scan for talent.</span>'}</div>
    ${selProspect === null && s.prospects.length ? '<p class="dim">Click a prospect card to choose who to woo.</p>' : ''}
    ${methods}
    <div class="scanrow">${scans}</div>
    ${log}`;
}

const TACTIC_ROWS: { key: 'pace' | 'plays' | 'scheme'; label: string; opts: [string, string, string] }[] = [
  { key: 'pace', label: 'PACE', opts: ['SLOW (TEC+)', 'BALANCED', 'FAST (PHY+)'] },
  { key: 'plays', label: 'PLAYBOOK', opts: ['FREELANCE (PHY+)', 'MIXED', 'RUN PLAYS (MEN+)'] },
  { key: 'scheme', label: 'DEFENSE', opts: ['PRESS (PHY+)', 'MIXED', 'ZONE (DEF+)'] },
];

function tacticsHtml(s: GameState): string {
  return TACTIC_ROWS.map(
    (row) => `<div class="tacrow"><span class="taclabel">${row.label}</span>
      ${[-1, 0, 1]
        .map(
          (v, i) => `<button class="tacbtn ${s.tactics[row.key] === v ? 'sel' : ''}"
            data-action="tactic" data-id="${row.key}:${v}">${row.opts[i]}</button>`
        )
        .join('')}</div>`
  ).join('');
}

function scoutHtml(s: GameState): string {
  const m = myMatchup(s);
  if (!m) return '';
  if (!s.oppScouted) {
    return `<button data-action="scout-opp" ${s.energy <= 0 ? 'disabled' : ''}>
      🔭 SCOUT ${esc(m.opponent.name.toUpperCase())} — see how you stack up (1⚡)</button>`;
  }
  normalizeLineup(m.opponent);
  const theirTac = aiTactics(m.opponent);
  const tacWords = [
    theirTac.pace === 1 ? 'fast pace' : theirTac.pace === -1 ? 'slow pace' : '',
    theirTac.plays === 1 ? 'set plays' : theirTac.plays === -1 ? 'freelance' : '',
    theirTac.scheme === 1 ? 'zone D' : theirTac.scheme === -1 ? 'press D' : '',
  ].filter(Boolean).join(', ') || 'nothing fancy';
  const rows = (['phy', 'men', 'tec', 'def'] as Group[])
    .map((g) => {
      const mine = teamGroupAvg(myTeam(s), g);
      const theirs = teamGroupAvg(m.opponent, g);
      const lead = mine >= theirs;
      return `<div class="scoutrow">${groupIcon(g)}
        <span class="${lead ? 'good' : 'dim'}">YOU ${mine}</span>
        <span class="scoutbar"><span class="mineb" style="width:${mine}%"></span><span class="theirb" style="width:${theirs}%"></span></span>
        <span class="${lead ? 'dim' : 'bad'}">${theirs} THEM</span></div>`;
    })
    .join('');
  return `<div class="panel"><span class="tag dim">SCOUTING REPORT</span> <span class="dim">— they'll lean: ${tacWords}</span>${rows}</div>`;
}

function stageLineup(s: GameState): string {
  const m = myMatchup(s);
  if (!m) {
    return `<h2>${weekLabel(s)}</h2>
      <div class="event calm">Your season is over — knocked out of the tournament. The galaxy plays on without you, which feels rude.
      Watch the bracket, plan the offseason.</div>`;
  }
  const oppAvg = Math.round(m.opponent.players.reduce((a, p) => a + overall(p), 0) / m.opponent.players.length);
  const playoffTag = s.week > REGULAR_WEEKS ? `<span class="gold">${weekLabel(s)} — win or go home.</span><br/>` : '';
  return `<h2>LINEUP &amp; GAME PLAN</h2>
    ${playoffTag}
    <div class="matchbanner">${m.home ? 'HOME vs' : 'AWAY at'} ${chip(m.opponent)} <span class="dim">(${m.opponent.wins}–${m.opponent.losses}, avg OVR ${oppAvg})</span></div>
    ${tacticsHtml(s)}
    ${scoutHtml(s)}
    <p class="dim">Drag cards below to set the lineup. Sliders bend the game toward a stat — point them at your strengths (or their weaknesses).</p>`;
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
      ? `<h2>STANDINGS</h2><table>${sortedStandings(s)
          .map(
            (t, i) => `<tr class="${t.id === s.myTeamId ? 'me' : ''}">
          <td>${i + 1}. ${chip(t, true)}</td><td class="num">${t.wins}–${t.losses}</td></tr>`
          )
          .join('')}</table>`
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
      <p class="dim">The week takes its toll — watch the cards below.</p>`;
  } else {
    myBlock = `<h2 style="margin-top:0">AROUND THE GALAXY</h2><p class="dim">You watched from the stands. It stung.</p>`;
  }

  return `<div id="progress-wrap">
      <div id="progress-label">Shuttle in transit...</div>
      <div class="bar"><div class="fill" id="progress-fill"></div></div>
      <button data-action="skip-progress">SKIP</button>
    </div>
    <div id="result-wrap" style="display:none">
      ${myBlock}
      ${others ? `<div class="panel">${others}</div>` : ''}
      ${standings}
    </div>`;
}

// ---- navbars --------------------------------------------------------------

function nav(s: GameState): string {
  switch (s.phase) {
    case 'news': {
      const blocked = newsBlocked(s);
      return `<span></span><button class="primary" data-action="to-training" ${blocked ? 'disabled' : ''}>
        ${blocked ? 'ANSWER THE PRESS & RESOLVE DECISIONS' : 'CONTINUE ▶'}</button>`;
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
    case 'result':
      return `<span></span><button class="primary" data-action="continue-result">CONTINUE ▶</button>`;
    default:
      return '';
  }
}

// ---- full-screen offseason views (no grid) --------------------------------

function viewPickTeam(s: GameState): string {
  const cards = s.teams
    .map((t) => {
      const avg = Math.round(t.players.reduce((a, p) => a + overall(p), 0) / t.players.length);
      return `<button class="teampickbtn" data-action="pick-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
        <b>${esc(teamLabel(t))}</b><br/><span>${esc(t.region)} · avg OVR ${avg}</span>
      </button>`;
    })
    .join('');
  return `<h1>GALACTIC COACH</h1>
    <p class="sub">Intergalactic college basketball. 3-on-3. You make ALL the decisions.</p>
    <h2>CHOOSE YOUR PROGRAM</h2>
    <div class="teampick">${cards}</div>
    <div class="footer"><button data-action="new-game" class="danger">NEW GAME</button></div>`;
}

function viewRecruitingDay(s: GameState): string {
  const isChamp = s.seasonChampion === teamLabel(myTeam(s));
  const champLine = isChamp
    ? `<span class="gold">★ THE ${esc(s.seasonChampion!.toUpperCase())} ARE GALACTIC CHAMPIONS — THAT'S YOU! ★</span>`
    : `Galactic Champions: <b>${esc(s.seasonChampion ?? '')}</b>. Not you. The boosters noticed.`;
  const chances = effectiveChances(s);
  const rows = [...s.prospects]
    .sort((a, b) => b.commitPct - a.commitPct)
    .map((pr) => {
      const eff = chances.find((c) => c.prospect.id === pr.id);
      return `<tr>
        <td><button data-action="pursue" data-id="${pr.id}">${pr.selected ? '☑ SIGNING' : '☐ sign him'}</button></td>
        <td>${esc(pr.name)}</td><td>${speciesById(pr.speciesId).name}</td>
        <td>${pr.pos}</td><td class="num">${rawOverall(pr.attrs)}</td><td class="num">${pr.potential}</td>
        <td class="num">${pr.commitPct}%</td>
        <td class="num">${pr.selected && eff ? `<b class="gold">→ ${eff.pct}%</b>` : ''}</td>
      </tr>`;
    })
    .join('');
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
  return `${headerHtml(s)}
    <div class="panel">
      <h2 style="margin-top:0">SEASON ${s.season} COMPLETE</h2>
      <p>${champLine}</p>
      <p class="dim">Seniors have graduated. Legacy so far: ${legacyScore(s)}.</p>
    </div>
    ${proPanel}
    <h2>SIGNING DAY</h2>
    <p class="dim">Your season of schmoozing built the COMMIT column. Sign one, keep the full number.
    Chase several and each extra letter costs: −10 on your 2nd, −25 on your 3rd, −45 on your 4th...</p>
    <table>
      <tr><th></th><th>Prospect</th><th>Species</th><th>POS</th><th class="num">OVR</th><th class="num">POT</th><th class="num">COMMIT</th><th class="num">FINAL ODDS</th></tr>
      ${rows || '<tr><td colspan="8" class="dim">You scouted nobody this season. Enjoy the walk-ons.</td></tr>'}
    </table>
    <div class="navbar"><span></span><button data-action="do-signing" class="primary" ${unresolved.length ? 'disabled' : ''}>
      ${unresolved.length ? 'DEAL WITH YOUR STARS FIRST' : '▶ SEND THE LETTERS'}</button></div>`;
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
    ${detailPanel(s)}
    ${results ? `<div class="event calm"><span class="tag">SIGNING DAY RESULTS</span><br/>${results}</div>` : ''}
    <h2>${s.season === 0 ? 'TRYOUTS' : 'PICK YOUR SQUAD'} — season ${s.season + 1}, choose ${ROSTER_SIZE} (${n}/${ROSTER_SIZE})</h2>
    <div class="cardshelf rows4">${cards}</div>
    <div class="navbar"><span></span><button data-action="confirm-roster" class="primary" ${n === ROSTER_SIZE ? '' : 'disabled'}>
      ${n === ROSTER_SIZE ? '▶ START THE SEASON' : `SELECT EXACTLY ${ROSTER_SIZE}`}</button></div>`;
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
  let tick = 0;
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const finish = (): void => {
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    const pw = document.getElementById('progress-wrap');
    const rw = document.getElementById('result-wrap');
    if (pw) pw.style.display = 'none';
    if (rw) rw.style.display = '';
    animatePostGame();
  };
  progressTimer = window.setInterval(() => {
    tick++;
    if (tick > TICKS) { finish(); return; }
    if (fill) fill.style.width = `${Math.round((tick / TICKS) * 100)}%`;
    const stage = Math.min(stages.length - 1, Math.floor((tick / TICKS) * stages.length));
    if (label) label.textContent = stages[stage];
  }, 70);
  document.getElementById('progress-wrap')?.addEventListener('click', finish);
}

/** One by one, show each player what the game did to him. */
function animatePostGame(): void {
  clearFloatTimers();
  state.postGame.forEach((d, i) => {
    const msgs: { text: string; cls?: string; anchor?: Anchor }[] = [];
    if (d.fit !== 0) msgs.push({ text: `${d.fit > 0 ? '+' : ''}${d.fit} ⚡`, cls: d.fit < 0 ? 'bad' : 'good' });
    if (d.mood !== 0) msgs.push({ text: `${d.mood > 0 ? '+' : ''}${d.mood} MOOD`, cls: d.mood < 0 ? 'bad' : 'good' });
    for (const x of d.xp) {
      msgs.push(
        x.amt > 0
          ? { text: `+${x.amt} ${ATTR_LABELS[x.attr]}`, cls: 'gold', anchor: ATTR_ANCHOR[x.attr] }
          : { text: `−1 ${ATTR_LABELS[x.attr]}`, cls: 'bad', anchor: ATTR_ANCHOR[x.attr] }
      );
    }
    if (msgs.length) floatCard(d.playerId, msgs, i * 700);
  });
}

// ---- lineup drag logic ----------------------------------------------------

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

// ---- render + input -------------------------------------------------------

function render(): void {
  if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
  switch (state.phase) {
    case 'pickTeam': app.innerHTML = viewPickTeam(state); break;
    case 'recruiting': app.innerHTML = viewRecruitingDay(state); break;
    case 'teamSelect': app.innerHTML = viewTeamSelect(state); break;
    case 'news': app.innerHTML = shell(state, stageNews(state), nav(state)); break;
    case 'training': app.innerHTML = shell(state, stageTraining(state), nav(state)); break;
    case 'scouting': app.innerHTML = shell(state, stageScouting(state), nav(state)); break;
    case 'lineup': app.innerHTML = shell(state, stageLineup(state), nav(state)); break;
    case 'result':
      app.innerHTML = shell(state, stageResult(state), nav(state));
      animateProgress();
      break;
  }
  swipeDir = null;
}

// ---- pointer-based drag: works with fingers (iOS included) and mouse ------
// touch: press-and-hold ~250ms to pick a card up (a quick swipe scrolls);
// mouse: just drag. A plain tap still opens the player card.

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
    else if (e.pointerType !== 'mouse' && dist > 12) endDrag(false); // that's a scroll, not a hold
    return;
  }
  moveGhost();
});

document.addEventListener('pointerup', (e) => {
  if (ptr && e.pointerId === ptr.pointerId) endDrag(true);
});
document.addEventListener('pointercancel', () => endDrag(false));

// while a card is lifted, the page must not scroll under the finger
document.addEventListener(
  'touchmove',
  (e) => {
    if (ptr?.active) e.preventDefault();
  },
  { passive: false }
);

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action')!;
  const id = el.getAttribute('data-id') ?? '';

  switch (action) {
    case 'pick-team': chooseTeam(state, Number(id)); break;
    case 'press': answerPress(state, Number(id)); break;
    case 'news-choice': {
      const [ni, ci] = id.split(':').map(Number);
      const fx = resolveNews(state, ni, ci);
      if (fx && fx.playerId !== null) {
        const msgs: { text: string; cls?: string }[] = [];
        if (fx.moodDelta) msgs.push({ text: `${fx.moodDelta > 0 ? '+' : ''}${fx.moodDelta} MOOD`, cls: fx.moodDelta < 0 ? 'bad' : 'good' });
        if (fx.weightDelta) msgs.push({ text: `${fx.weightDelta > 0 ? '+' : ''}${fx.weightDelta}kg`, cls: 'warn' });
        if (fx.outWeeks) msgs.push({ text: `OUT ${fx.outWeeks}w`, cls: 'bad' });
        const pid = fx.playerId;
        setTimeout(() => floatCard(pid, msgs, 120), 0);
      }
      break;
    }
    case 'go-news': stickers.clear(); swipeDir = 'back'; goNews(state); break;
    case 'to-training': stickers.clear(); swipeDir = 'fwd'; trainSquad = []; toTraining(state); break;
    case 'back-training': stickers.clear(); swipeDir = 'back'; trainSquad = []; toTraining(state); break;
    case 'back-scouting': stickers.clear(); swipeDir = 'back'; toScouting(state); break;
    case 'to-scouting': stickers.clear(); swipeDir = 'fwd'; toScouting(state); break;
    case 'to-lineup': stickers.clear(); swipeDir = 'fwd'; selProspect = null; toLineup(state); break;
    case 'train-type': trainType = trainType === id ? null : id; break;
    case 'train-start':
      if (trainType && actionTrainSession(state, trainType, trainSquad)) {
        const lines = state.lastTraining?.lines ?? [];
        lines.forEach((l, i) => {
          const msgs: { text: string; cls?: string; anchor?: Anchor }[] = Object.entries(l.gains)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => ({ text: `+${v} ${ATTR_LABELS[k as AttrKey]}`, cls: 'gold', anchor: ATTR_ANCHOR[k as AttrKey] }));
          if (l.breakthrough) msgs.push({ text: 'BREAKTHROUGH!', cls: 'gold' });
          msgs.push({ text: '−8 ⚡', cls: 'bad' });
          const pid = l.playerId;
          setTimeout(() => floatCard(pid, msgs, i * 500), 0);
        });
        trainSquad = [];
        trainType = null;
      }
      break;
    case 'sel-prospect': selProspect = selProspect === Number(id) ? null : Number(id); break;
    case 'schmooze':
      if (selProspect !== null) actionSchmooze(state, selProspect, id);
      break;
    case 'scan': actionScan(state, id); break;
    case 'drop-prospect': actionDropProspect(state, Number(id)); if (selProspect === Number(id)) selProspect = null; break;
    case 'rest':
      if (actionRest(state)) {
        myTeam(state).players.forEach((p, i) => {
          setTimeout(() => floatCard(p.id, [{ text: '+15 ⚡', cls: 'good' }]), i * 120);
        });
      }
      break;
    case 'scout-opp': actionScoutOpp(state); break;
    case 'tactic': {
      const [k, v] = id.split(':');
      setTactic(state, k as 'pace' | 'plays' | 'scheme', Number(v));
      break;
    }
    case 'convince-pro': convincePro(state, Number(id)); break;
    case 'letgo-pro': letGoPro(state, Number(id)); break;
    case 'card': {
      const pid = Number(id);
      if (state.phase === 'training') {
        const t = myTeam(state);
        const p = t.players.find((x) => x.id === pid);
        const availableCount = t.players.filter((x) => available(x)).length;
        const required = Math.min(TRAINING_SQUAD_SIZE, availableCount);
        if (p && available(p)) {
          if (trainSquad.includes(pid)) trainSquad = trainSquad.filter((x) => x !== pid);
          else if (trainSquad.length < required) trainSquad.push(pid);
        }
      } else {
        detailPlayerId = detailPlayerId === pid ? null : pid;
      }
      break;
    }
    case 'close-detail': detailPlayerId = null; break;
    case 'play-game': stickers.clear(); swipeDir = 'fwd'; playGame(state); break;
    case 'skip-progress': return; // handled inside animateProgress
    case 'continue-result': stickers.clear(); swipeDir = 'fwd'; clearFloatTimers(); continueFromResult(state); break;
    case 'pursue': toggleProspect(state, Number(id)); break;
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
      }
      break;
    case 'new-game':
      if (confirm('Wipe the save and start over?')) {
        wipeSave();
        state = freshGame();
        detailPlayerId = null;
        poolSelected = null;
        trainType = null;
        trainSquad = [];
        selProspect = null;
      }
      break;
  }
  render();
});

render();
