// GALACTIC COACH v1.1 — the app frame. No scrolling, ever (recent phones):
// stats always on top, THE BAG + navigation always at the bottom, and between
// them the 3×3 grid — which IS your lineup — with a fourth row for controls.
// Popups take over the middle; the bag stays reachable, items drag right in.

import {
  ATTR_LABEL,
  ATTR_SHORT,
  CLASS_ABBR,
  CONFERENCES,
  conferenceById,
  DRILLS,
  FACILITIES,
  GALAXY_ACTS,
  GYM_REQ,
  INSTRUCTIONS,
  PLANS,
  ROW_REQ,
  SHIP_REQ,
  STAT_WORD,
  TOURNEY,
  drillKind,
  facCost,
  facLevel,
  galaxyActById,
  instrById,
  itemById,
  planById,
  speciesById,
  storyById,
} from './engine/data';
import { BAG_SIZE, CACHE_MAX, LEVEL_CAP, REGULAR_WEEKS, stipendFor, xpNeed } from './engine/gen';
import { COL_LABELS, benchPlayers, bestCol, bookieLine, grade, gradeRating, matchAttrs, posArrows, reserves, slotPlayer, tacticsMult, winShare, type Grade } from './engine/sim';
import {
  actCooldown,
  actionGalaxy,
  addNote,
  applyConference,
  beginWeek,
  chooseTeam,
  confirmBoard,
  continueFromResult,
  convincePro,
  currentStory,
  deliverInstructions,
  deliverSpeech,
  dismissStory,
  effectiveChances,
  finalizeRoster,
  freshGame,
  grabMop,
  isUtWeek,
  itemAllowedNow,
  letGoPro,
  load,
  loadCodex,
  myMatchup,
  myTeam,
  playGame,
  queueStory,
  releaseHeldStories,
  releaseMidStories,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  save,
  setTactic,
  showTip,
  sortedStandings,
  speechCooldown,
  starters,
  statLeaders,
  swapBoardSlot,
  toPractice,
  toRecruiting,
  toMatchup,
  toScouting,
  toSigning,
  toggleProspect,
  upgradeFacility,
  useItem,
  utOpponent,
  weekLabel,
  wipeCodex,
  wipeSave,
} from './engine/state';
import { TUT_AT, tutGem, tutStandout, tutStar, tutorialAllows, tutorialArrive, tutorialBoot, tutorialHeader, tutorialHint, tutorialIntro, tutorialWalkDone, tutorialWalkStart, tutorialWalkSteps, type TutStep } from './engine/tutorial';
import type { Attr, AttrRec, BoxRow, FacId, GameState, PlanId, Player, Prospect, SpeechFx, Team } from './engine/types';
import type { Fx } from './engine/types';
import { ATTRS, clamp, copyAttrs, genderize, opTracks, ovr, perGame, potStars, rand, security } from './engine/util';
import { PRACTICE_KIT, STREET_KIT, energyBucket, figureHtml, iconOutlinedUrl, iconUrl, moodBucket, rigSpriteHtml, sceneHtml, titleHtml, type FigureId, type FigureMood, type Kit, type RigView, type SceneId } from './rig';

const VERSION = 'v5.1';

// ---- THE UPDATE CHECK -----------------------------------------------------------
// The home-screen app on iOS keeps stale HTML for a long time. On launch and
// on every return to the app, ask the server which build it has; if it's
// newer than this one, reload through a fresh URL (the save lives in
// localStorage and survives). Dev builds skip it.
// THE RETRY LAW: GitHub Pages caches the HTML for 10 minutes, so a reload
// straight after a deploy can land on the OLD page again. The old guard
// ("already reloaded for this build id") then refused to ever try again —
// which is how a phone got stuck on v4.7 through three deploys. Now every
// attempt uses a fresh cache-busting URL, and attempts for the same build
// are simply spaced out (one per two minutes) instead of forbidden.
const UPDATE_RETRY_MS = 2 * 60 * 1000;

async function checkForUpdate(): Promise<void> {
  const env = (import.meta as { env?: { PROD?: boolean } }).env;
  if (!env?.PROD || typeof __BUILD_ID__ === 'undefined' || typeof fetch !== 'function') return;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id?: string };
    if (!id || id === __BUILD_ID__) return;
    let last: { id?: string; at?: number } = {};
    try { last = JSON.parse(localStorage.getItem('gc-update') ?? '{}') as { id?: string; at?: number }; } catch { /* fresh */ }
    if (last.id === id && Date.now() - (last.at ?? 0) < UPDATE_RETRY_MS) return; // just tried — the cache needs a minute
    try { localStorage.setItem('gc-update', JSON.stringify({ id, at: Date.now() })); } catch { /* storage unavailable */ }
    const url = new URL(location.href);
    url.searchParams.set('b', id);
    url.searchParams.set('t', String(Date.now()));
    location.replace(url.toString());
  } catch {
    /* offline or blocked: play on */
  }
}
void checkForUpdate();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkForUpdate(); });

let state: GameState = load() ?? freshGame();

// THE TITLE SCREEN: everyone lands on MARCH MANIACS — press start (anywhere).
// A saved career opens the CAREER menu (continue, or wipe it and start over);
// a blank slate walks straight into the NEW CAREER wizard.
let titleOpen = true;
let titleMenu = false;

/** the picked program, waiting on the wizard's final LOCK IT IN (v5 M6) */
let pendingTeam: number | null = null;

// THE NEW CAREER WIZARD (v5 M6): codex question → conference pick → the six
// programs (names and colors editable, your pick highlighted) → lock it in.
// Everything here lives OUTSIDE the save: quitting mid-wizard restarts it.
interface SetupState {
  step: 'codex' | 'conf' | 'teams';
  /** season zero happens unless a codex veteran skips straight to tryouts */
  tutorial: boolean;
  /** the team being edited in the ✎ modal */
  editing: number | null;
}
let setup: SetupState | null = null;

function codexHasEntries(): boolean {
  const c = loadCodex();
  return c.plans.length + c.drills.length + c.instrs.length + c.regions.length > 0;
}

function ensureSetup(): SetupState {
  if (!setup) {
    const has = codexHasEntries();
    setup = { step: has ? 'codex' : 'conf', tutorial: !has, editing: null };
  }
  return setup;
}

function canResume(): boolean {
  return state.phase !== 'pickTeam' && state.myTeamId >= 0;
}

function titleScreenHtml(): string {
  const t = state.myTeamId >= 0 ? myTeam(state) : null;
  const kit: Kit = { bg: t ? t.bg : '#5fe07a', fg: t ? t.fg : '#0a0c14' };
  // 128×72 at ×3 is 384px wide — zoomed down to fit narrower phones
  const avail = Math.min(window.innerWidth || 480, 480) - 16;
  const zoom = Math.min(1, avail / 384);
  const resume = canResume();
  const saveLine = resume ? `${esc(t!.name).toUpperCase()} · SEASON ${Math.max(1, state.season)} · ${esc(weekLabel(state))}` : 'A NEW CAREER AWAITS';
  // THE CAREER MENU: continue is a tap; wiping the save is a hold
  const menu = titleMenu && resume
    ? `<div class="modalback"><div class="modal">
        <span class="tag">YOUR CAREER</span>
        <p class="askteam">${chipBig(teamLabel(t!), t!.bg, t!.fg)}<br/><span class="dim">SEASON ${Math.max(1, state.season)} · ${esc(weekLabel(state))}</span></p>
        <button class="wide askbtn" data-action="menu-continue"><b>▸ CONTINUE</b><span>Pick up exactly where you left off</span></button>
        <button class="wide askbtn hold danger" data-action="menu-new"><b>NEW GAME</b><span>Wipe this save and start a new career (the codex survives)</span></button>
      </div></div>`
    : '';
  return `<div class="titlescreen" data-action="press-start">
    <div class="titlewrap" style="zoom:${zoom.toFixed(3)}">${titleHtml(kit, 3, 'title')}</div>
    <div class="titlehint">▸ TAP ANYWHERE</div>
    <div class="titlesave">${saveLine}</div>
  </div>${menu}`;
}

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

// ---- THE INDICATOR COLORS: red → orange → yellow → green → mint ------------
// Value gauges (energy, mood), the slot grade (F red … S mint) and every
// direction cue (UP green, DOWN red) speak this one scale. WHITE left the
// scale on purpose: white is NEUTRAL now — free for names, chrome and
// information that carries no verdict.

const C_RED = '#ff4a3d';
const C_ORANGE = '#ff9a2e';
const C_YELLOW = '#ffd83d';
const C_GREEN = '#5fe07a';
const C_MINT = '#a8ffc2';
const UP_COLOR = C_GREEN;
const DOWN_COLOR = C_RED;

/** A 0–100 value on the five-step scale. */
function heatColor(v: number): string {
  if (v < 25) return C_RED;
  if (v < 45) return C_ORANGE;
  if (v < 65) return C_YELLOW;
  if (v < 85) return C_GREEN;
  return C_MINT;
}

const GRADE_COLOR: Record<Grade, string> = { F: C_RED, D: C_ORANGE, C: C_YELLOW, B: C_GREEN, A: C_MINT, S: C_MINT };

/** Darken a hex color toward black (f = 1 keeps it). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** The brighter of a kit's two colors — dark-navy letters vanish on a black
    card, so team-colored labels always pick the legible half. */
function brightKit(kit: { bg: string; fg: string }): string {
  const l = (hex: string): number => hexToHsl(hex)[2];
  return l(kit.fg) >= l(kit.bg) ? kit.fg : kit.bg;
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
/** ONE voice per dialog: the player's rewards/penalties (his sprite), then
    the squad's, then the coach's world (credits, JOB SECURITY — the dean or
    the booster standing over it). Separate screens, tapped through. */
interface ImpPage { kind: 'player' | 'squad' | 'coach'; pid: number | null; rows: ImpRow[] }
let impact: { pages: ImpPage[]; ix: number } | null = null;
let impactPlayed = false;
let impactTimers: number[] = [];
let coachOpen = false;
let itemUi: string | null = null;
let toast: string | null = null;
/** a toast reads in BEATS like a story: the words, then the verdict — split
    on the paragraph break; tap advances */
let toastShown: string | null = null;
let toastBeat = 0;
/** the names a search just FOUND: they keep the spotlight while the board
    swap is open, wherever they get dragged */
let gxFound = new Set<number>();
let drillSheet = false;
// pickers DEFAULT to the free option every week — spending ⚡ takes a
// deliberate trip into the menu
let selectedDrill = 'rest';
/** the campus move: the mop (free) or one upgrade order */
let selFac: string = 'mop';
let facSheet = false;
/** which board sheet is open: the SCOUTING menu or the RECRUITING menu */
let galaxySheet: false | 'scouting' | 'recruiting' = false;
let selScout = 'reccenter';
let selRecruit = 'groupchat';
/** the pregame move: a speech or a last-minute instruction */
let selPregame: { kind: 'speech'; id: PlanId } | { kind: 'instr'; id: string } | null = null;
let speechSheet = false;
/** picker defaults + sticker batches reset when the calendar turns */
let uiWeekKey = '';
/** what the chosen story choice meant to the player (acting at CHOICE time) */
let chosenWant: 'love' | 'hate' | null = null;
/** a story that rolls THE WHEEL before its verdict (signing day) has rolled */
let wheelDone = false;
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
/** the standings dialog's second face: THE LEADERS */
let standTab: 'table' | 'leaders' = 'table';
let notebookOpen = false;
let gxResult: { text: string; cost: number; played: boolean; art?: string } | null = null;
/** THE WEEK TURN: the calendar flip between the horn and Monday's envelope */
let weekTurn: { season: number; from: number; to: number; seasonOnly?: boolean } | null = null;
/** how the story's resolution moved the four opinions (drives the dean/booster verdict + the job-bar flash) */
let opShift: { school: number; fans: number; pub: number; sec: number } | null = null;
/** THE FOUR OPINIONS dialog (tap the job-security gauge) */
let jobOpen = false;
let jobAnimDone = false;
/** the selection grid: 12 slots (9 squad in lineup order + the CUT row) */
let selSlots: number[] | null = null;
/** the two are-you-sure dialogs before anyone is lost forever */
let cutConfirm = false;
let boardConfirm = false;
// game night: the live game → YOU WON / YOU LOST → the box score → the league
let gnStage: 'beat' | 'final' | 'recap' | 'verdict' | 'table' = 'beat';
/** the box score reads in PASSES — one player at a time, two sweeps: the
    lines, then what the night cost (⚡/mood). XP is Monday's news: the game
    is about who did what; WEEK START shows the long-term result. */
let boxPass = 0;
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
function chipBig(label: string, bg: string, fg: string): string {
  return `<span class="chip big" style="background:${bg};color:${fg}">${esc(label)}</span>`;
}

/** AROUND THE LEAGUE: all three games — yours on top — away chip on the
    left, home chip on the right, the score in the middle with the winning
    number lit. */
function leagueResultsHtml(s: GameState): string {
  const r = s.lastResult;
  if (!r) return '';
  const me = myTeam(s);
  const rows: { away: Team | null; home: Team | null; awayName?: string; as: number; hs: number; mine: boolean }[] = [];
  const m = myMatchup(s);
  if (isUtWeek(s)) {
    const champ = utOpponent(s);
    rows.push({ away: null, home: me, awayName: champ?.name ?? r.oppName, as: r.oppScore, hs: r.myScore, mine: true });
  } else if (m) {
    rows.push(r.home
      ? { away: m.opponent, home: me, as: r.oppScore, hs: r.myScore, mine: true }
      : { away: me, home: m.opponent, as: r.myScore, hs: r.oppScore, mine: true });
  }
  if (s.resultsWeek?.length) {
    for (const g of s.resultsWeek) rows.push({ away: s.teams[g.a], home: s.teams[g.h], as: g.as, hs: g.hs, mine: false });
  } else {
    // a week finalized before the structured results existed: read the
    // prose lines the notebook always kept («Winner 67 — 62 Loser»)
    for (const line of s.resultsLog) {
      const mm = line.match(/^(.*) (\d+) — (\d+) (.*)$/);
      if (!mm) continue;
      const w = s.teams.find((tm) => tm.name === mm[1]);
      const l = s.teams.find((tm) => tm.name === mm[4]);
      if (!w || !l) continue;
      const g = (s.schedule[s.week - 1] ?? []).find(([h, a]) => (h === w.id && a === l.id) || (h === l.id && a === w.id));
      const homeIsW = g ? g[0] === w.id : true;
      rows.push({ away: homeIsW ? l : w, home: homeIsW ? w : l, as: homeIsW ? Number(mm[3]) : Number(mm[2]), hs: homeIsW ? Number(mm[2]) : Number(mm[3]), mine: false });
    }
  }
  const side = (tm: Team | null, name: string | undefined, big: boolean): string => tm
    ? (big ? chipBig(tm.name, tm.bg, tm.fg) : chip(tm.name, tm.bg, tm.fg, true))
    : chip(name ?? '?', '#555', '#ddd', true);
  return `<div class="report others"><div class="othershead">AROUND THE LEAGUE</div>${rows.map((row) => `
    <div class="lgrow ${row.mine ? 'mine' : ''}">
      <span class="lgl">${side(row.away, row.awayName, row.mine && row.away?.id === me.id)}</span>
      <span class="lgs"><b class="${row.as > row.hs ? 'won' : 'lost'}">${row.as}</b><i>—</i><b class="${row.hs > row.as ? 'won' : 'lost'}">${row.hs}</b></span>
      <span class="lgr">${side(row.home, undefined, row.mine && row.home?.id === me.id)}</span>
    </div>`).join('')}</div>`;
}

// ---- floaters -------------------------------------------------------------------------

/** Gained credits arrive the same way, in reverse: «+1¢» per cell drops
    INTO the bar, and the freshly lit cells blink until the eye has caught up. */
let energyFresh: { from: number; until: number } | null = null;

function floatEnergyGain(n: number, from: number): void {
  if (n <= 0) return;
  energyFresh = { from, until: Date.now() + 2600 };
  for (let i = 0; i < n; i++) {
    floatTimers.push(
      window.setTimeout(() => {
        // the bar is looked up AT FIRE TIME: a re-render between the call and
        // the timeout must not strand the float on a detached node
        const bar = document.querySelector('.ebar');
        if (!bar) return;
        const el = document.createElement('div');
        el.className = 'efloat big gain';
        el.textContent = '+1¢';
        bar.appendChild(el);
        window.setTimeout(() => el.remove(), 900);
      }, 60 + i * 300)
    );
  }
}

/** EVERY spent ⚡ blasts away over the energy bar — huge, one per cell. */
function floatEnergyBig(n: number): void {
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    floatTimers.push(
      window.setTimeout(() => {
        const bar = document.querySelector('.ebar');
        if (!bar) return;
        const el = document.createElement('div');
        el.className = 'efloat big';
        el.textContent = '-1¢';
        bar.appendChild(el);
        window.setTimeout(() => el.remove(), 900);
      }, 60 + i * 300)
    );
  }
}

/** Results land ON the cards: a pre-action snapshot diffs into per-card
    deltas — gauge bands, the XP arc, number swaps, and the anchored
    STICKERS (+XP on the ring, ±⚡ on the energy icon, ±MOOD on the face,
    +1 ATH on the grade corner). One batch per action; once seen, seen. */
let cardDeltas: { key: string; map: Map<number, CardDelta> } | null = null;
/** Board results (facet reveals, commit swings) cycle in the main spot; a
    commit swing also carries its old value for the ring's change language. */
let gxStickers: Map<number, { text: string; up?: boolean; commitFrom?: number }[]> | null = null;

// ---- the impact reveal: snapshot → resolve → diff → animate -----------------------

interface PlayerSnap {
  attrs: AttrRec; pots: AttrRec; level: number; energy: number; mood: number; outWeeks: number;
}
interface Snap {
  energy: number; sec: number; ops: { school: number; fans: number; pub: number }; legacy: number;
  players: Map<number, PlayerSnap>;
}

function snapState(): Snap {
  const t = myTeam(state);
  const o = opTracks(state);
  return {
    energy: state.energy, sec: security(state), ops: { school: o.school, fans: o.fans, pub: o.pub }, legacy: state.legacy,
    players: new Map(t.players.map((p) => [p.id, {
      attrs: copyAttrs(p.attrs), pots: copyAttrs(p.pots),
      level: p.level, energy: p.energy, mood: p.mood, outWeeks: p.outWeeks,
    }])),
  };
}

/** Diff the world before/after a resolution into celebration pages — one
    per voice: the player, the squad, the coach's world. */
function buildImpact(snap: Snap, fxList: Fx[], pid: number | null): { pages: ImpPage[]; ix: number } {
  const t = myTeam(state);
  const rows: ImpRow[] = [];
  const was = pid !== null ? snap.players.get(pid) : undefined;
  const p = pid !== null ? t.players.find((x) => x.id === pid) : undefined;
  if (was && !p) rows.push({ label: '', text: 'GONE', up: false });
  if (was && p) {
    for (const a of ATTRS) {
      if (p.attrs[a] !== was.attrs[a]) {
        rows.push({ label: ATTR_LABEL[a], from: was.attrs[a], to: p.attrs[a], up: p.attrs[a] > was.attrs[a] });
      }
    }
    if (ovr(p.attrs) !== ovr(was.attrs)) rows.push({ label: 'OVERALL', from: ovr(was.attrs), to: ovr(p.attrs), up: ovr(p.attrs) > ovr(was.attrs) });
    if (p.level !== was.level) rows.push({ label: 'LEVEL', from: was.level, to: p.level, up: p.level > was.level });
    const xpGain = fxList.reduce((a, f) => a + ((f.playerId ?? pid) === pid ? f.xp ?? 0 : 0), 0);
    if (xpGain > 0 && p.level === was.level) rows.push({ label: 'XP', text: `+${xpGain}`, up: true });
    const potD = ovr(p.pots) - ovr(was.pots);
    if (potD !== 0) rows.push({ label: 'POTENTIAL', text: `${potD > 0 ? '+' : ''}${potD} CEILING`, up: potD > 0 });
    if (p.energy !== was.energy) rows.push({ label: 'ENERGY ⚡', from: was.energy, to: p.energy, up: p.energy > was.energy });
    if (p.mood !== was.mood) rows.push({ label: 'MOOD', from: was.mood, to: p.mood, up: p.mood > was.mood });
    if (p.outWeeks > 0 && p.outWeeks !== was.outWeeks) rows.push({ label: 'OUT', text: `${p.outWeeks} WEEK${p.outWeeks > 1 ? 'S' : ''}`, up: false });
    if (p.outWeeks === 0 && was.outWeeks > 0) rows.push({ label: 'BACK', text: 'READY TO PLAY', up: true });
  }
  // the rest of the squad, collapsed
  const squad: ImpRow[] = [];
  const others = t.players.filter((q) => q.id !== pid && snap.players.has(q.id));
  for (const key of ['mood', 'energy'] as const) {
    const changed = others.filter((q) => q[key] !== snap.players.get(q.id)![key]);
    if (!changed.length) continue;
    const d = changed[0][key] - snap.players.get(changed[0].id)![key];
    const label = changed.length > 1 ? 'THE SQUAD' : changed[0].name;
    squad.push({ label, text: `${key.toUpperCase()} ${d > 0 ? '+' : ''}${d}`, up: d > 0 });
  }
  // the coach's world: credits, then the ONE gauge. The four opinions never
  // get their own counters — those numbers live in the job-security menu
  // alone, and mood-driven drift doesn't earn a gauge fanfare either.
  const coach: ImpRow[] = [];
  if (state.energy !== snap.energy) coach.push({ label: '¢ CREDITS', from: snap.energy, to: state.energy, up: state.energy > snap.energy });
  const o1 = opTracks(state);
  const trackMoved = o1.school !== snap.ops.school || o1.fans !== snap.ops.fans || o1.pub !== snap.ops.pub;
  const sec1 = security(state);
  if (trackMoved && sec1 !== snap.sec) coach.push({ label: 'JOB SECURITY', from: snap.sec, to: sec1, up: sec1 > snap.sec });
  if (state.legacy !== snap.legacy) coach.push({ label: 'LEGACY', from: snap.legacy, to: state.legacy, up: state.legacy > snap.legacy });
  const pages: ImpPage[] = [];
  if (rows.length) pages.push({ kind: 'player', pid, rows: [...rows, ...(pid !== null ? squad : [])] });
  if (squad.length && (pid === null || !rows.length)) pages.push({ kind: 'squad', pid: null, rows: squad });
  if (coach.length) pages.push({ kind: 'coach', pid: null, rows: coach });
  return { pages, ix: 0 };
}

/** The impact page on screen (null when nothing changed). */
function impactPage(): ImpPage | null {
  return impact?.pages[impact.ix] ?? null;
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
  const preCommits = new Map(state.prospects.map((pr) => [pr.id, pr.commitPct]));
  const choice = ev.choices?.find((c) => c.key === key);
  const cost = choice?.cost ?? 0;
  const res = resolveStory(state, key);
  if (!res) return;
  // a story that moved a recruit leaves a sticker on the board — one that
  // STAYS after the dialogue closes (the ring blinks its change too)
  for (const pr of state.prospects) {
    const from = preCommits.get(pr.id);
    if (from === undefined || from === pr.commitPct) continue;
    const d = pr.commitPct - from;
    if (!gxStickers) gxStickers = new Map();
    const list = gxStickers.get(pr.id) ?? [];
    list.push({ text: `COMMITMENT ${d > 0 ? '+' : ''}${d}`, up: d > 0, commitFrom: from });
    gxStickers.set(pr.id, list.slice(-2));
  }
  chosenWant = choice?.want ?? null;
  if (cost > 0) floatEnergyBig(cost);
  if (state.energy > snap.energy) floatEnergyGain(state.energy - snap.energy, snap.energy);
  const oNow = opTracks(state);
  const trackMoved = oNow.school !== snap.ops.school || oNow.fans !== snap.ops.fans || oNow.pub !== snap.ops.pub;
  opShift = {
    school: oNow.school - snap.ops.school,
    fans: oNow.fans - snap.ops.fans,
    pub: oNow.pub - snap.ops.pub,
    // mood-driven drift never flashes the gauge — only real opinion moves do
    sec: trackMoved ? security(state) - snap.sec : 0,
  };
  jobAnimDone = false;
  impact = buildImpact(snap, res.fx, res.resolved.playerId ?? ev.playerId);
  impactPlayed = false;
  const rBeats = splitBeats(res.resolved.resolvedText ?? '');
  if (rBeats.length) {
    storyMode = rBeats.length > 1 ? 'r-antic' : 'r-reveal';
  } else if (impact.pages.length) {
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

/** One stat at a time: land on the OLD number, hold it a beat, THEN count,
    pop. The linger is the point — a 1 that becomes a 0 must be seen as a 1
    first. Tap skips to the end. */
const IMPACT_LINGER = 650;
const IMPACT_ROW_MS = 1400;

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
        val.textContent = String(from);
        impactTimers.push(window.setTimeout(() => {
          const steps = 12;
          let step = 0;
          const iv = window.setInterval(() => {
            step++;
            val!.textContent = String(Math.round(from + (to - from) * (step / steps)));
            if (step >= steps) { clearInterval(iv); land(); }
          }, 45);
          impactTimers.push(iv);
        }, IMPACT_LINGER));
      } else {
        land();
      }
    }, 400 + i * IMPACT_ROW_MS));
  });
  impactTimers.push(window.setTimeout(() => { impactPlayed = true; }, 400 + rowEls.length * IMPACT_ROW_MS + 400));
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

// NO PERCENTAGES: a choice shows its two tails as WORDS — what can go
// wonderful, what can go wrong — and the weight of the tail (dim → bright →
// blinking) says how live it is. You read the language; the odds you learn.
function rung(pct: number): string {
  if (pct <= 5) return 'r5';
  if (pct <= 12) return 'r10';
  if (pct <= 35) return 'r25';
  return 'r50';
}

function oddsLine(up?: { pct: number; cls: string; note?: string }, down?: { pct: number; cls: string; note?: string }, cost?: number): string {
  const parts: string[] = [];
  if (cost) parts.push(`<span class="cost">${cost}¢</span>`);
  if (up) parts.push(`<span class="tail up ${rung(up.pct)}">▲ ${up.cls}${up.note ? ` <i>(${esc(up.note)})</i>` : ''}</span>`);
  if (down) parts.push(`<span class="tail down ${rung(down.pct)}">▼ ${down.cls}${down.note ? ` <i>(${esc(down.note)})</i>` : ''}</span>`);
  return parts.length ? `<span class="odds">${parts.join(' ')}</span>` : '';
}

// ---- THE PICKER ROW: one shape for every sheet ---------------------------------
// Line 1: the NAME and the two tails (what can go right, what can go wrong).
// Line 2: the bright facts — what it does, whom it touches, what it costs —
// and the RISK sticker: grey SAFE (≤5%), yellow RISKY (≤15%), red blinking
// DANGER (25%+), read straight off the down tail.
// Line 3: the flavor, dim.

type RiskLevel = 'safe' | 'risky' | 'danger';

function riskLevel(downPct: number): RiskLevel {
  return downPct <= 5 ? 'safe' : downPct <= 15 ? 'risky' : 'danger';
}

function riskTag(level: RiskLevel | 'trade'): string {
  const word = level === 'trade' ? 'TRADE' : level.toUpperCase();
  return `<span class="risk ${level}">${word}</span>`;
}

/** A fact on line 2 carries its VALUE as a color: grey → light green →
    green → bright green (0–3). ALL 9 beats PICK 3, FREE beats 3¢, a bigger
    effect glows brighter. Never red in these categories. */
interface Fact { text: string; tier: 0 | 1 | 2 | 3 }
const fact = (text: string, tier: 0 | 1 | 2 | 3): Fact => ({ text, tier });
const costFact = (cost: number): Fact => fact(cost ? `${cost}¢` : 'FREE', cost <= 0 ? 3 : cost === 1 ? 2 : cost === 2 ? 1 : 0);
const scopeFact = (word: string): Fact => fact(word, word === 'ALL 9' || word === 'SQUAD' ? 3 : word === 'PICK UP TO 6' || word === 'THE BOARD' ? 2 : 1);

function pickerRow(o: {
  tag: 'button' | 'div';
  cls?: string;
  attrs?: string;
  name: string;
  up?: { pct: number; cls: string; note?: string };
  down?: { pct: number; cls: string; note?: string };
  facts: Fact[];
  risk: RiskLevel | 'trade' | null;
  desc?: string;
}): string {
  // the tails' printed clauses (the deniability lines, "they read you")
  // get their own line under the title — the tails stay next to the name
  const notes = [o.up?.note, o.down?.note].filter((n): n is string => !!n);
  const up = o.up ? { pct: o.up.pct, cls: o.up.cls } : undefined;
  const down = o.down ? { pct: o.down.pct, cls: o.down.cls } : undefined;
  const facts = o.facts.map((f) => `<span class="pf f${f.tier}">${f.text}</span>`).join('<span class="dim"> · </span>');
  return `<${o.tag} class="drill ${o.cls ?? ''}" ${o.attrs ?? ''}>
      <div class="prow1"><b>${o.name}</b> ${oddsLine(up, down)}</div>
      ${notes.length ? `<div class="pnote">${notes.map((n) => `<i>(${esc(n)})</i>`).join(' ')}</div>` : ''}
      <div class="prow2">${facts}${o.risk ? ` ${riskTag(o.risk)}` : ''}</div>
      ${o.desc ? `<span class="ddesc">${esc(o.desc)}</span>` : ''}
    </${o.tag}>`;
}

// ---- the kite compass ----------------------------------------------------------
// One shape says everything: SKL up, FRC right, ATH down, BRN left — the
// opposites share an axis (SKILL ↔ ATHLETICISM, BRAINS ↔ FIERCENESS), the way
// the speeches trade them. The solid kite is who he is, the outline is his
// potential, the faint dashes are where the season started. Prospects render
// as a cloud that scouting sharpens.

function kitePoints(v: AttrRec): string {
  const R = (x: number): number => 6 + (clamp(x, 0, 25) / 25) * 40;
  return `50,${(50 - R(v.skl)).toFixed(1)} ${(50 + R(v.frc)).toFixed(1)},50 50,${(50 + R(v.ath)).toFixed(1)} ${(50 - R(v.brn)).toFixed(1)},50`;
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
    ? numSwap(opts.lvlFrom, val, 'auto', 'krnum')
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
    ${lab('skl', 'n')}${lab('frc', 'e')}${lab('ath', 's')}${lab('brn', 'w')}
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
function numSwap(from: number | string, to: number | string, colorTo: string, cls = '', downHint?: boolean): string {
  const down = downHint ?? (typeof from === 'number' && typeof to === 'number' && to < from);
  const d = `animation-delay:-${wallPhase(SWAP_MS)}ms`;
  const oldStyle = `color:var(--r55);${d}`;
  const newStyle = `color:${down ? DOWN_COLOR : colorTo === 'auto' ? UP_COLOR : colorTo};${d}`;
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
    return `<div class="sticker ${l.up === false ? 'down' : l.up === true ? 'up' : ''} ${l.blink ? 'blink' : ''} ${n > 1 ? 'cyc' : pop ? '' : 'landed'}" style="${anim}">${esc(l.text)}</div>`;
  }).join('')}</div>`;
}

/** What an action changed on one card — rendered as in-place blinks. */
interface CardDelta {
  e?: number; // energy delta (gauge band + sticker on the bolt)
  m?: number; // mood delta (gauge band + sticker on the face)
  xp?: number; // XP gained (sticker on the ring)
  gain?: string; // direct ability points ("+1 ATH", sticker on the grade corner)
  xpFromPct?: number; // XP ring: the added/removed arc blinks
  xpProjPct?: number; // WEEK START: the ring shows the incoming payout
  lvlFrom?: number; // LVL number swap
  ovrFrom?: number; // OVERALL number swap
}

/** The anchored stickers: each change blinks ON the thing it changed. */
function anchoredStickers(d: CardDelta | undefined): string {
  if (!d) return '';
  const bits: string[] = [];
  if (d.xp) bits.push(`<div class="astick a-ring up">+${d.xp} XP</div>`);
  // the bolt and the face already blink beside these — the number is enough
  if (d.e) bits.push(`<div class="astick a-gl ${d.e > 0 ? 'up' : 'down'}">${d.e > 0 ? '+' : ''}${d.e}</div>`);
  if (d.m) bits.push(`<div class="astick a-gr ${d.m > 0 ? 'up' : 'down'}">${d.m > 0 ? '+' : ''}${d.m}</div>`);
  if (d.gain) bits.push(`<div class="astick a-ovr up">${esc(d.gain)}</div>`);
  return bits.join('');
}

// ---- the edge gauges: rectangular LEDs hugging the ROSTER card ------------------
// LEFT = ENERGY (bolt), RIGHT = MOOD (face) — seven crisp rectangular LEDs,
// widest at the top, narrowing toward the bottom, each clearly its own light.
// No softness: flat fills with a color gradient across the stack (bottom
// darker, top brighter). A changed LED blinks added-bright / removed-dark.

const GAUGE_LEDS = 7;

function edgeGauge(side: 'l' | 'r', value: number, kind: 'boltx' | 'facex', _pid: number, delta = 0, off = false): string {
  // a player OUT has both gauges dark: nothing to read until he's back
  const v = off ? 0 : clamp(Math.round(value), 0, 100);
  const old = off ? 0 : clamp(Math.round(value - delta), 0, 100);
  const lit = Math.round((v / 100) * GAUGE_LEDS);
  const litOld = Math.round((old / 100) * GAUGE_LEDS);
  const rects: string[] = [];
  for (let b = 0; b < GAUGE_LEDS; b++) {
    // b = 0 is the BOTTOM light; the stack fills upward
    const h = 100 / GAUGE_LEDS - 3.5;
    const y = (GAUGE_LEDS - 1 - b) * (100 / GAUGE_LEDS) + 1.75;
    const w = 42 + (58 * b) / (GAUGE_LEDS - 1); // wider at the top
    const x = side === 'l' ? 0 : 100 - w;
    const on = b < lit;
    // the value's color (red → white) across the stack, darker at the bottom
    const color = shade(heatColor(v), 0.55 + 0.45 * (b / (GAUGE_LEDS - 1)));
    rects.push(`<rect class="gled ${on ? 'on' : 'off'}" x="${x}" y="${y}" width="${w}" height="${h}" ${on ? `fill="${color}"` : ''}/>`);
    // the change language: a light that switched state blinks its verdict
    if (on !== (b < litOld)) {
      rects.push(`<rect class="gband ${on ? 'up' : 'down'}" x="${x}" y="${y}" width="${w}" height="${h}" style="animation-delay:-${wallPhase(SWAP_MS)}ms"/>`);
    }
  }
  return `<span class="gauge g${side} ${off ? 'goff' : ''}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rects.join('')}</svg>
    <img class="gicon ${v < 25 && !off ? 'blink' : ''} ${delta > 0 ? 'dup' : delta < 0 ? 'ddown' : ''}" src="${iconOutlinedUrl(kind, off ? '#556' : heatColor(v))}" alt=""/>
  </span>`;
}

/** The sprite tells the truth: mood, energy, size and fire, straight from the
    rig — and a delayed-outcome story holds him NERVOUS until the result. */
function rigView(p: Player, story?: 'good' | 'bad' | 'worried' | 'neutral', pose?: 'bench' | 'shrug'): RigView {
  const held = story ?? (p.tense ? 'worried' : undefined);
  if (held) {
    // in a story the STATE is the story's: neutral → the emotion, no ball
    return {
      id: p.id, speciesId: p.speciesId, heightCm: p.heightCm, weightKg: p.weightKg,
      jersey: p.jersey, form: p.form, mood: 'neutral', energy: 'normal',
      fire: !!p.onFire && p.outWeeks === 0, story: held,
    };
  }
  // THE CHAMBER WINS: the injured/away stand in their pod and the exhausted
  // sleep in it — no bench, no shrug, for anyone in cryo
  const calm = pose && p.outWeeks === 0 && energyBucket(p.energy) !== 'exhausted' ? pose : undefined;
  return {
    id: p.id,
    speciesId: p.speciesId,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    jersey: calm === 'shrug' ? null : p.jersey,
    form: p.form,
    mood: moodBucket(p.mood),
    energy: p.outWeeks > 0 ? 'pod' : calm ? 'normal' : energyBucket(p.energy),
    fire: !!p.onFire && p.outWeeks === 0,
    pose: calm,
  };
}

interface CardOpts {
  lens?: Lens;
  kit?: Kit;
  /** story acting: sprite state comes from the news, not the meters */
  story?: 'good' | 'bad' | 'worried' | 'neutral';
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
  /** the column he stands in: the ROSTER card grades him THERE (F–S) */
  col?: number;
  /** the RESERVE row: no letter (his plain number instead), always a touch
      dimmed — he's not in tonight's math */
  reserve?: boolean;
  /** tryouts / the selection grid: no gauges, the grade at full tanks —
      compare who they ARE, not how they slept */
  pure?: boolean;
  /** the box score's first pass: just the face and the line — no gauges,
      no ring, no grade, no compass; the meters come back on the next pass */
  bare?: boolean;
  /** the calm screens (lineup, box score): the bench SITS, the reserves
      stand in street clothes and shrug */
  pose?: 'bench' | 'shrug';
  pick?: boolean; // selection screens
  /** THE SCOPE PREVIEW: this card is inside / outside a pending scoped action */
  scope?: 'in' | 'out';
}

/** The OVR corner: a small label above the number (mirrors the LVL ring).
    A changed number blinks in place. */
function ovrBlock(p: Player, opts: { from?: number } = {}): string {
  const o = ovr(p.attrs);
  const color = heatColor(o);
  let num: string;
  if (opts.from !== undefined && opts.from !== o) num = numSwap(opts.from, o, color, 'kovr');
  else num = `<b class="kovr" style="color:${color}">${o}</b>`;
  return `<span class="ovrwrap"><i class="klab">OVR</i>${num}</span>`;
}

/** THE GRADE: what he's worth in the slot he stands in — F red … A/S mint.
    Every player's numbers are fixed; the column reads them (BRAINS run the
    backcourt, ATHLETICISM the frontcourt, the wing weighs nothing), size
    fits or doesn't, and standing outside his POSITION costs — unless his
    numbers there are as good as at home. The label is his assigned letter
    (G/F/C); the down-arrows behind it are the mismatch penalty in THIS
    slot: one per column off, none when his stats carry him there. */
function gradeBlock(p: Player, col: number, opts: { fromOvr?: number; pure?: boolean } = {}): string {
  // the letter reads position AND tonight's tanks (pure = full tanks: the
  // tryout / selection read, who he IS rather than how he slept)
  const r = gradeRating(p, col, opts.pure);
  const g = grade(r);
  const color = GRADE_COLOR[g];
  let letter: string;
  if (opts.fromOvr !== undefined && opts.fromOvr !== ovr(p.attrs)) {
    // the summer / a drill moved the number: show the old grade blinking into
    // the new one when the letter itself changed
    const scale = ovr(p.attrs) > 0 ? opts.fromOvr / ovr(p.attrs) : 1;
    const gFrom = grade(r * scale);
    letter = gFrom !== g
      ? numSwap(gFrom, g, color, 'kovr kgrade', ovr(p.attrs) < opts.fromOvr)
      : `<b class="kovr kgrade ${g === 'S' ? 'sgrade' : ''}" style="color:${color}">${g}</b>`;
  } else {
    letter = `<b class="kovr kgrade ${g === 'S' ? 'sgrade' : ''}" style="color:${color}">${g}</b>`;
  }
  // the position itself stays INVISIBLE (the math runs underneath): only a
  // mismatch speaks — arrows left of the grade, hanging from its top edge.
  // One yellow arrow = a column off; two red, stacked = badly miscast.
  const arrows = posArrows(p, col);
  const arrowHtml = arrows > 0
    ? `<span class="posarr ${arrows >= 2 ? 'far' : 'near'}">${arrows >= 2 ? '<i>▼</i><i>▼</i>' : '<i>▼</i>'}</span>`
    : '';
  return `<span class="gradewrap">${arrowHtml}${letter}</span>`;
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
  const streetwear = opts.pose === 'shrug' && !out;
  const sprite = (scale: number, cls: string): string => rigSpriteHtml(rigView(p, opts.story, opts.pose), streetwear ? STREET_KIT : kit, scale, cls);
  const l = opts.lens ?? 0;
  const xpPct = p.level >= LEVEL_CAP ? 100 : Math.min(100, Math.round((p.xp / xpNeed(p.level)) * 100));
  const nameHtml = `<span class="kname">${p.onFire ? '🔥 ' : ''}${esc(p.name)}</span>
      <span class="kyear">${CLASS_ABBR[Math.min(p.classYear, 3)].toUpperCase()}</span>`;
  const d = opts.delta;
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
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${heatColor(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
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
      <div class="stcol sl" style="color:${brightKit(kit)}">${rows.map((r) => `<span>${r[0]}</span>`).join('')}</div>
      <div class="stcol sr">${rows.map((r) => `<b>${r[1]}</b>`).join('')}</div>
    </div>`;
  } else if (l === 2 && !opts.story) {
    body = squareKite(p.attrs, {
      pot: p.pots,
      start: p.startAttrs,
      nameHtml,
      blHtml: ovrBlock(p),
      brHtml: `<span class="kpot"><i>POT</i><b style="color:${heatColor(ovr(p.pots))}">${ovr(p.pots)}</b></span>`,
    });
  } else {
    // ROSTER — the default view, the compass gone: the sprite between two
    // curved edge gauges (⚡ left, mood right); on the matchup, the bare
    // current-ability diamond glows behind him
    body = opts.bare
      ? `<div class="ksq roster">
      ${sprite(1.75, 'ksprite')}
      <div class="ktop">${nameHtml}</div>
      ${anchoredStickers(d)}
    </div>`
      : `<div class="ksq roster">
      ${opts.diamond ? `<svg class="ksvg bare" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon class="k-cur" points="${kitePoints(p.attrs)}"/></svg>` : ''}
      ${sprite(1.75, 'ksprite')}
      <div class="ktop">${nameHtml}</div>
      ${opts.pure ? '' : edgeGauge('l', p.energy, 'boltx', p.id, d?.e ?? 0, out)}
      ${opts.pure ? '' : edgeGauge('r', p.mood, 'facex', p.id, d?.m ?? 0, out)}
      <span class="kbl">${opts.col !== undefined && !opts.reserve ? gradeBlock(p, opts.col, { fromOvr: d?.ovrFrom, pure: opts.pure }) : ovrBlock(p, { from: d?.ovrFrom })}</span>
      <span class="kbr">${ring}</span>
      ${anchoredStickers(d)}
    </div>`;
  }
  const mains: SpotLabel[] = [...(opts.mainLabels ?? [])];
  const his: SpotLabel[] = [...(opts.hiLabels ?? [])];
  if (opts.sitout && l === 0 && !opts.story) his.push({ text: 'SITS OUT', up: false });
  return `<div class="pcard lens${l} sq ${out ? 'pout' : opts.reserve ? 'resv' : ''} ${opts.bare ? 'barecard' : ''} ${opts.locked ? 'hlock' : ''} ${opts.draggable && !out && !opts.locked ? 'grabbable' : ''} ${opts.pick ? 'picked' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}"
      ${opts.inert ? '' : `data-action="card" data-id="${p.id}"`} data-pid="${p.id}">
    ${body}
    ${spotHtml('main', mains, opts.labelPop !== false, opts.popDelay ?? 0)}
    ${spotHtml('hi', his, opts.labelPop !== false, (opts.popDelay ?? 0) + 200)}
    ${out ? `<div class="ptag">${p.outKind === 'injury' ? 'INJURED' : 'AWAY'} ${p.outWeeks}w</div>` : ''}
    ${opts.tag ? `<div class="cardtag ${opts.tagCls ?? ''}">${opts.tag}</div>` : ''}
  </div>`;
}

/** A prospect as a player card would see him — the TRUTH, no fuzz (signing day). */
function prospectAsPlayer(pr: Prospect): Player {
  return {
    id: pr.id, name: pr.name, speciesId: pr.speciesId, form: pr.form, classYear: 0, jersey: 0,
    heightCm: pr.heightCm, weightKg: pr.weightKg,
    attrs: copyAttrs(pr.attrs), pots: copyAttrs(pr.pots), startAttrs: copyAttrs(pr.attrs),
    stats: { gp: 0, pts: 0, reb: 0, stl: 0, ast: 0, mvp: 0 }, career: { gp: 0, pts: 0, reb: 0, stl: 0, ast: 0, mvp: 0 },
    level: 0, xp: 0, energy: 75, mood: 75, outWeeks: 0, outReason: '', dnp: 0,
  };
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
  /** story acting on the big-board card (a recruit story): the sprite's
      state comes from the news */
  story?: 'good' | 'bad' | 'worried' | 'neutral';
  draggable?: boolean;
  dim?: boolean;
  scope?: 'in' | 'out';
  labelPop?: boolean;
  /** a scoped action wants targets: this card toggles on tap */
  selectable?: boolean;
  /** SIGNING DAY on the board: tap to pursue; the effective % labels the card */
  signing?: { selected: boolean; effPct?: number };
}

function prospectCard(pr: Prospect, l: Lens, opts: ProspectCardOpts = {}): string {
  const img = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false, story: opts.story },
    PRACTICE_KIT, 1.75, 'ksprite');
  const sp = speciesById(pr.speciesId);
  const spCls = sp.rarity >= 3 ? 'sprare blink' : sp.rarity === 2 ? 'sprare' : '';
  const nameHtml = `<span class="kname">${esc(pr.name)}</span>`;
  // the COM ring speaks the change language: the swing blinks on the arc
  const commitFrom = gxStickers?.get(pr.id)?.find((st) => st.commitFrom !== undefined)?.commitFrom;
  const ring = pr.signed
    ? `<span class="kpot signedink"><i>INK</i><b>✓</b></span>`
    : ringCounter(pr.commitPct, 'COM', `${pr.commitPct}`, `commitment ${pr.commitPct}%`, { deltaFromPct: commitFrom });
  const imgDim = rigSpriteHtml(
    { id: pr.id, speciesId: pr.speciesId, heightCm: pr.heightCm, weightKg: pr.weightKg, jersey: null, form: pr.form, mood: 'neutral', energy: 'normal', fire: false },
    PRACTICE_KIT, 1.75, 'ksprite dimspr');
  // the rating unmasks digit by digit — ?? → 4? / ?7 → 47
  const mask = prospectMask(pr);
  const maskNum = pr.digits >= 2
    ? `<b class="kovr" style="color:${heatColor(ovr(pr.seenAttrs))}">${mask}</b>`
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
      <div class="prspecies ${spCls}">${sp.name.toUpperCase()}</div>
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
      fuzz: 0,
      nameHtml,
      blHtml: maskHtml,
      brHtml: ring,
      centerHtml: stars,
    });
  } else {
    // BIG BOARD: the stranger himself, the masked rating, the commitment
    // ring — and once the full NUMBER is known, the ability cloud glows
    // behind him (sharp only when the whole picture is), so fierceness can
    // be compared across the board at a glance
    const cloud = pr.digits >= 2
      ? `<svg class="ksvg bare" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${
          pr.seenSkill
            ? `<polygon class="k-cur" points="${kitePoints(pr.seenAttrs)}"/>`
            : `<g class="k-cloud" filter="url(#prblur${pr.id})"><defs><filter id="prblur${pr.id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>
              <polygon points="${kitePoints(pr.seenAttrs)}" transform="rotate(-9 50 50) translate(-3 2)"/>
              <polygon points="${kitePoints(pr.seenAttrs)}" transform="rotate(8 50 50) translate(3 -2)"/>
              <polygon points="${kitePoints(pr.seenAttrs)}"/></g>`
        }</svg>`
      : '';
    body = `<div class="ksq roster">
      ${cloud}
      ${img}
      <div class="ktop">${nameHtml}</div>
      <span class="kbl">${maskHtml}</span>
      <span class="kbr">${ring}</span>
    </div>`;
  }
  const mains: SpotLabel[] = (gxStickers?.get(pr.id) ?? []).map((st) => ({ text: st.text, up: st.up }));
  if (opts.signing?.selected) mains.push({ text: opts.signing.effPct !== undefined ? `LETTER →${opts.signing.effPct}%` : 'LETTER', up: true });
  const act = opts.signing && !pr.signed
    ? `data-action="pursue" data-id="${pr.id}"`
    : opts.selectable && !pr.signed
      ? `data-action="gx-target" data-id="${pr.id}"`
      : '';
  return `<div class="pcard prospect sq ${opts.draggable && !pr.signed ? 'grabbable' : ''} ${opts.dim ? 'cutcard' : ''} ${pr.signed ? 'signedpr' : ''} ${opts.signing?.selected || (opts.signing && pr.signed) ? 'picked' : ''} ${opts.scope === 'in' ? 'scopehl' : opts.scope === 'out' ? 'scopedim' : ''}" data-kind="pr" data-pid="${pr.id}" ${act}>
    ${body}
    ${spotHtml('main', mains, opts.labelPop !== false)}
    ${pr.signed ? `<div class="ptag">✓ SIGNED</div>` : ''}
    ${pr.bannedWeeks > 0 && !pr.signed ? `<div class="ptag blink">BANNED ${pr.bannedWeeks}w</div>` : ''}
  </div>`;
}

// ---- header (always there) ---------------------------------------------------------------------

// JOB SECURITY (v5): ONE gauge, filled from the left, the darkness eating
// from the right — fed by four opinions (school/fans/players/public). Tap it
// for the breakdown. The icon blinks below 30: somebody is setting terms.
function jobBar(s: GameState, blink = false): string {
  const sec = security(s);
  return `<div class="jobbar ${blink || sec < 30 ? 'blink' : ''}" data-action="job-open" title="job security ${sec}/100 — tap for the four opinions">
    <div class="jtrack">
      <div class="jdark r" style="width:${100 - sec}%"></div>
      <span class="jlabel">JOB SECURITY</span>
    </div>
  </div>`;
}

/** What the fans think they're owed, spoken the way the booster says it. */
const EXPECT_WORDS = ['nothing at all', 'a respectable effort', 'a winning season', 'a tournament run', 'NOTHING LESS THAN THE TITLE'];

function jobModalHtml(s: GameState): string {
  if (!jobOpen) return '';
  const o = opTracks(s);
  const sec = security(s);
  const rows: { label: string; who: string; v: number }[] = [
    { label: 'THE SCHOOL', who: 'the dean — students, fairness, clean paperwork', v: o.school },
    { label: 'THE FANS', who: `the booster — wins. They expect ${EXPECT_WORDS[clamp(s.expectation ?? 1, 0, 4)]}`, v: o.fans },
    { label: 'THE PLAYERS', who: "the locker room — the squad's mood, live", v: o.players },
    { label: 'THE PUBLIC', who: 'Scoop — fairness, cheating, attention', v: o.pub },
  ];
  const mn = Math.min(...rows.map((r) => r.v));
  const bars = rows.map((r) => `<div class="jobrow">
    <div class="jr1"><b>${r.label}</b>${r.v === mn && r.v < 50 ? '<span class="jangry blink">▼ THE ANGRIEST</span>' : ''}<b class="jrv" style="color:${heatColor(r.v)}">${r.v}</b></div>
    <div class="jrtrack"><span style="width:${r.v}%;background:${heatColor(r.v)}"></span></div>
    <div class="jr2 dim">${r.who}</div>
  </div>`).join('');
  return `<div class="modalback" data-action="job-close"><div class="modal">
    <span class="tag">JOB SECURITY — ${sec}/100</span>
    ${bars}
    <p class="dim jobnote">Under 50 the questions get harder · under 30 the angriest voice sets terms · under 20 every week has a price.</p>
    <button class="wide" data-action="job-close">CLOSE</button>
  </div></div>`;
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

/** The second row's tail: S# · W# · the OPPONENT in THEIR colors. */
function nextOppRow(s: GameState): string {
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  if (champ) {
    return `W<b>${REGULAR_WEEKS}</b>+${s.week - REGULAR_WEEKS} · vs ${chip(champ.name, champ.bg, champ.fg, true)}`;
  }
  const m = myMatchup(s);
  if (m) {
    return `W<b>${s.week}</b> · ${m.home ? 'vs' : '@'} ${chip(m.opponent.name, m.opponent.bg, m.opponent.fg, true)}`;
  }
  return `<span class="dim">OFFSEASON</span>`;
}

// Two clickable rows: MY TEAM (in team colors) · W–L · standing → the
// standings; S# · W# · vs NEXT OPPONENT (in their colors) → the schedule.
function headerHtml(s: GameState): string {
  const t = myTeam(s);
  const fresh = energyFresh && Date.now() < energyFresh.until ? energyFresh.from : Infinity;
  const cells = Array.from({ length: CACHE_MAX }, (_, i) =>
    `<span class="ecell ${i < s.energy ? 'on' : ''} ${i < s.energy && i >= fresh ? 'fresh' : ''}" style="${i < s.energy ? `background:${ramp(0.35 + 0.55 * (i / CACHE_MAX))}` : ''}"></span>`
  ).join('');
  const jobFlash = storyMode === 'impact' && impactPage()?.kind === 'coach' && opShift !== null && opShift.sec !== 0 && currentStory(s);
  // while the game PLAYS the header still shows the record as it stood at
  // tip-off — the result is news at the horn, not before
  const frozen = liveGameOn(s) && s.preGame ? s.preGame : null;
  const rank = ordinal(frozen ? frozen.rank : 1 + sortedStandings(s).findIndex((x) => x.id === s.myTeamId));
  const wins = frozen ? frozen.wins : t.wins;
  const losses = frozen ? frozen.losses : t.losses;
  // SEASON ZERO reveals the header one piece at a time: the gauge from the
  // start (blinking while the dean introduces it), credits once the first
  // one lands, the schedule row when there is finally a game to point at
  const th = s.tutorial !== undefined ? tutorialHeader(s) : null;
  const jobBlink = currentStory(s)?.defId === 'tut_dean';
  const schedRow = th && !th.sched
    ? '<div></div>'
    : `<button class="hrow hopp" data-action="sched-open">S<b>${Math.max(1, s.season)}</b> · ${nextOppRow(s)}</button>`;
  const ebarHtml = th && !th.credits
    ? '<div class="ebar ghost"></div>'
    : `<div class="ebar" title="credits ${s.energy}/${CACHE_MAX} (+${stipendFor(s.season)}/wk)">
        <img class="jicon ${s.energy < 2 ? 'blink' : 'ghost'}" src="${iconUrl('alert', ramp(0.9))}" alt=""/>
        <div class="etrack ${s.energy === 0 ? 'blink' : ''}">${cells}</div>
        <img class="jicon" src="${iconUrl('credit', ramp(0.75))}" alt=""/>
      </div>`;
  return `<div class="topbar ${gxResult ? 'spotlight' : ''} ${jobFlash ? 'jobflash' : ''}">
    <div class="hgrid">
      <button class="hrow hopp" data-action="stand-open">${chip(t.name, t.bg, t.fg, true)} <b>${wins}–${losses}</b> · <b>${rank}</b></button>
      ${jobBar(s, jobBlink)}
      ${schedRow}
      ${ebarHtml}
    </div>
    <div class="hbtns-col">
      ${s.tutorial !== undefined && s.tutorial < TUT_AT.WRAP ? '' : '<button class="hbtn" data-action="help">?</button>'}
      <button class="hbtn" data-action="coach-open">⚙</button>
    </div>
  </div>`;
}

/** The live game is on: the score is still a secret. */
function liveGameOn(s: GameState): boolean {
  return s.phase === 'gamenight' && gnStage === 'beat' && !!s.lastResult;
}

// the schedule + standings dialogs (tap the header rows) — BLOCKED while a
// story is up (Scoop's questions must be answered from memory or the
// notebook) and while the game plays (no peeking at the result). One
// replaces the other: tapping the second row closes the first.
function schedModalHtml(s: GameState): string {
  if (!schedOpen) return '';
  const t = myTeam(s);
  const rows: string[] = [];
  for (let w = 1; w <= REGULAR_WEEKS; w++) {
    const g = (s.schedule[w - 1] ?? []).find(([h, a]) => h === s.myTeamId || a === s.myTeamId);
    if (!g) continue;
    const home = g[0] === s.myTeamId;
    const opp = s.teams[home ? g[1] : g[0]];
    const res = liveGameOn(s) && w === s.week ? undefined : s.myResults?.find((r) => r.week === w);
    const now = w === s.week && !isUtWeek(s);
    rows.push(`<tr class="${now ? 'me' : ''}">
      <td class="wk">W${w}</td>
      <td class="va">${home ? 'vs' : '@'}</td>
      <td>${chip(opp.name, opp.bg, opp.fg, true)}</td>
      <td class="num">${res ? esc(res.text.split(' ').slice(0, 2).join(' ')) : now ? '◂ NOW' : ''}</td>
    </tr>`);
  }
  const utRows = (s.ut?.log ?? []).map((l) => `<tr><td colspan="4" class="dim">${esc(l)}</td></tr>`).join('');
  return `<div class="modalback" data-action="sched-close"><div class="modal">
    <span class="tag">THE SEASON — ${esc(t.name).toUpperCase()}</span>
    <table class="schedtable">${rows.join('')}${utRows}</table>
    <button class="wide" data-action="sched-close">CLOSE</button>
  </div></div>`;
}

/** THE LEADERS: conference top lists, one per stat — your names stand out.
    Shared by the standings dialog and the post-game standings screen. */
function leadersListHtml(s: GameState): string {
  // SEASON ZERO: the league has no season of stats behind it — the board
  // reads a pre-written conference, and none of the names are yours
  if (s.tutorial !== undefined) {
    const others = s.teams.filter((t) => t.id !== s.myTeamId);
    const pool = others.flatMap((t) => t.players.map((p) => ({ p, t })))
      .sort((a, b) => ovr(b.p.attrs) - ovr(a.p.attrs)).slice(0, 12);
    const SEC0: [string, number][] = [['POINTS', 14], ['REBOUNDS', 8], ['STEALS', 3], ['ASSISTS', 5]];
    return SEC0.map(([label, base], si) => `<div class="acthead">${label}</div><table class="standings leaders">${
      pool.slice(0, 8).map((e, i) => {
        const v = Math.max(1, Math.round((base + 4 - i * 0.9 + ((e.p.id * 7 + si * 13) % 5) * 0.4) * 9));
        return `<tr><td>${i + 1}. ${esc(e.p.name)} ${chip(e.t.name, e.t.bg, e.t.fg, true)}</td><td class="num">${v}</td></tr>`;
      }).join('')}</table>`).join('');
  }
  const L = statLeaders(s);
  const SEC: ['pts' | 'reb' | 'stl' | 'ast', string][] = [['pts', 'POINTS'], ['reb', 'REBOUNDS'], ['stl', 'STEALS'], ['ast', 'ASSISTS']];
  return SEC.map(([k, label]) => `<div class="acthead">${label}</div><table class="standings leaders">${
    L[k].slice(0, 8).map((e, i) => {
      const tm = s.teams[e.teamId];
      return `<tr class="${e.teamId === s.myTeamId ? 'me' : ''}"><td>${i + 1}. ${esc(e.name)} ${chip(tm.name, tm.bg, tm.fg, true)}</td><td class="num">${e.v}</td></tr>`;
    }).join('')}</table>`).join('');
}

function standModalHtml(s: GameState): string {
  if (!standOpen) return '';
  const tabs = `<div class="lensbar standtabs">
    <button class="lenstab ${standTab === 'table' ? 'sel' : ''}" data-action="stand-tab" data-id="table">STANDINGS</button>
    <button class="lenstab ${standTab === 'leaders' ? 'sel' : ''}" data-action="stand-tab" data-id="leaders">THE LEADERS</button>
  </div>`;
  let body: string;
  if (standTab === 'leaders') {
    body = leadersListHtml(s);
  } else {
    body = `<table class="standings">${sortedStandings(s)
      .map((tm, i) => `<tr class="${tm.id === s.myTeamId ? 'me' : ''}">
        <td>${i + 1}. ${chip(teamLabel(tm), tm.bg, tm.fg, true)}</td><td class="num">${tm.wins}–${tm.losses}</td></tr>
        ${i === 1 ? `<tr class="utline"><td colspan="2">▲ ${TOURNEY.name} ▲</td></tr>` : ''}`)
      .join('')}</table>`;
  }
  return `<div class="modalback" data-action="stand-close"><div class="modal scrolly">
    <span class="tag">${standTab === 'leaders' ? 'THE LEADERS' : 'THE STANDINGS'}</span>
    ${tabs}
    ${body}
    <button class="wide" data-action="stand-close">CLOSE</button>
  </div></div>`;
}

// ---- THE BAG bar (always there) -------------------------------------------------------------------

function bagBar(s: GameState): string {
  // NOTHING down here blinks anymore — blinking is for the tutorial (later).
  // One exception, by law: THE NOTEBOOK pulses when the ANSWER to a live
  // Scoop question is already on its pages — never to tell you to write.
  const ev = currentStory(s);
  const canAnswer = (ev?.defId === 'scoop_question' || ev?.defId === 'tut_scoop2') && !ev.resolvedText
    && s.notebook.some((n) => n.key === ev.data?.noteKey);
  // season zero: the notebook enters the story at the box score — until the
  // walk teaches it, the pocket is just another empty pocket
  const tutHideNote = s.tutorial !== undefined && !(s.tutSeen ?? []).includes('cheernote') && s.tutWalk?.key !== 'cheernote';
  const noteSlot = tutHideNote
    ? '<div class="bslot empty tall">·</div>'
    : `<button class="bslot filled notebook tall ${canAnswer ? 'pulse' : ''} ${notebookDead(s) ? 'ndead' : ''}" data-action="notebook">▤<span class="bshort">NOTES</span></button>`;
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const id = s.bag[i];
    if (!id) return '<div class="bslot empty">·</div>';
    const item = itemById(id);
    const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
    // WHO it's for, always visible: one player · one recruit · the whole squad
    const tgt = item.target === 'player' ? '● ONE' : item.target === 'prospect' ? '● RECRUIT' : '●●● TEAM';
    return `<button class="bslot filled ${item.rarity} t-${item.target} ${spent ? 'spent' : ''}"
      data-action="bag-item" data-id="${item.id}" data-bagitem="${item.id}">◆<span class="bshort">${item.short}</span><span class="btgt">${tgt}</span></button>`;
  }).join('');
  return `<div class="bagbar tworow">${noteSlot}${slots}</div>`;
}

// ---- THE NOTEBOOK: tap it and something noteworthy goes in --------------------

/** Moments when the notebook must NOT answer a tap: a decision pending, an
    outcome page, the live ticker — a note there is noise on top of noise.
    Scoop's questions are the exception: the notebook IS the answer. */
function notebookDead(s: GameState): boolean {
  if (liveGameOn(s)) return true;
  const ev = currentStory(s);
  if (!ev) return false;
  if ((ev.defId === 'scoop_question' || ev.defId === 'tut_scoop2') && !ev.resolvedText) return false;
  return storyMode === 'impact' || storyMode === 'choices';
}

function takeNote(): boolean {
  const s = state;
  const ev = currentStory(s);
  if (ev) {
    const src = ev.resolvedText ?? ev.text;
    const snippet = src.replace(/\s+/g, ' ').trim().slice(0, 110);
    return addNote(s, 'story', `story:${ev.uid}`, `«${snippet}${src.length > 110 ? '…' : ''}»${ev.tag ? ` — ${ev.tag}` : ''}`);
  }
  if (s.phase === 'gamenight' && s.lastResult && (gnStage === 'verdict' || gnStage === 'table' || gnStage === 'recap')) {
    // the box score screen: the whole night goes in at once — the score, the
    // MVP, the top scorer, the league's lines AND where my names sit on the
    // conference leaderboards
    const r = s.lastResult;
    const mvp = r.box.find((x) => x.playerId === r.mvpId)?.name ?? '—';
    const top = r.box[0];
    const a = addNote(s, 'mvp', `mvp:${s.season}:${s.week}`,
      `${r.win ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${r.oppName} · MVP ${mvp} · top scorer ${top ? `${top.name} (${top.pts})` : '—'}`);
    const lines = [`my game: ${r.win ? 'W' : 'L'} ${r.myScore}–${r.oppScore} vs ${r.oppName}`, ...s.resultsLog];
    const b = addNote(s, 'results', `res:${s.season}:${s.week}`, lines.join(' · '));
    const L = statLeaders(s);
    const keys = ['pts', 'reb', 'stl', 'ast'] as const;
    const bits = keys.map((k) => `${STAT_WORD[k]}: ${L[k][0]?.name ?? '—'} (${L[k][0]?.v ?? 0})`);
    const myRk: string[] = [];
    for (const k of keys) L[k].forEach((e, i) => { if (e.teamId === s.myTeamId && e.v > 0) myRk.push(`${STAT_WORD[k]} #${i + 1} ${e.name} (${e.v})`); });
    const c = addNote(s, 'lead', `lead:${s.season}:${s.week}`,
      `conference leaders — ${bits.join(' · ')}${myRk.length ? ` · my board: ${myRk.join(' · ')}` : ''}`);
    return a || b || c;
  }
  if (standOpen && standTab === 'leaders') {
    // the leaders page goes in whole — Scoop asks about the scoring race
    const L = statLeaders(s);
    const bits = (['pts', 'reb', 'stl', 'ast'] as const).map((k) => `${STAT_WORD[k]}: ${L[k][0]?.name ?? '—'} (${L[k][0]?.v ?? 0})`);
    return addNote(s, 'lead', `lead:${s.season}:${s.week}`, `conference leaders — ${bits.join(' · ')}`);
  }
  if (s.phase === 'matchup' || s.phase === 'gamenight') {
    return addNote(s, 'opp', `opp:${s.season}:${s.week}`, `week ${s.week}: ${nextOppLabel(s)}`);
  }
  return false;
}

function notebookModalHtml(s: GameState): string {
  if (!notebookOpen) return '';
  // the pages: scores, stats and results are a scrawl only you can read
  // (Scoop's questions still find them); the notes that are STORIES stay
  // legible — the oracle's numbers will matter weeks later
  const legible = s.notebook.filter((n) => n.kind === 'story');
  const scrawl = s.notebook.length - legible.length;
  const rows = (scrawl > 0 ? `<div class="notebookrow scrawl">${esc('a seemingly endless list of scores, stats and other incomprehensible notes that only you can make sense of')}${'▒'.repeat(Math.min(24, scrawl * 3))}</div>` : '')
    + legible.map((n) => `<div class="notebookrow"><span class="dim">S${n.season} W${n.week}</span> ${esc(n.text)}</div>`).join('')
    + (!s.notebook.length ? '<div class="dim">Blank pages. Tap the notebook on a screen worth remembering.</div>' : '');
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
  const showGame = s.phase === 'gamenight' && !!s.lastResult && gnStage === 'verdict';
  const showDeltas = cardDeltas !== null && !showGame && s.phase !== 'weekstart';
  // the faint ability shape sits behind every player — a read on the whole
  // player under the letter (the matchup had it first)
  const diamond = true;
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
    // the calm screens: the bench sits, the reserves shrug in street clothes
    const calmScreen = s.phase === 'matchup' || showGame;
    const pose = calmScreen ? (r === 1 ? 'bench' as const : r === 2 ? 'shrug' as const : undefined) : undefined;
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const p = slotPlayer(t, idx);
      let delta: CardDelta | undefined;
      let mains: SpotLabel[] | undefined;
      let his: SpotLabel[] | undefined;
      let labelPop = true;
      let popDelay = 0;
      if (p && showGame) {
        // THE FINAL HORN reads in PASSES, one player at a time: PASS ONE the
        // box-score lines (with the MVP and the FORM ROLL smack across the
        // player), PASS TWO what the night cost — ⚡ and mood blinking on the
        // gauges. XP waits for WEEK START. (ON FIRE needs no label: he burns.)
        const d = s.postGame.find((x) => x.playerId === p.id);
        const row = s.lastResult?.box.find((x) => x.playerId === p.id);
        const form = s.lastResult?.forms?.[p.id];
        if (d || row || form) {
          const b = batchFor(`game:${wkKey}:${boxPass}`, true);
          if (b.render) {
            if (boxPass === 0) {
              mains = row ? [{ text: statLine(row), up: row.pts >= 20 ? true : undefined }] : [];
              his = [];
              if (s.lastResult?.mvpId === p.id) his.push({ text: '★ GAME MVP', up: true });
              if (form === 1) {
                const gain = s.lastResult?.formGain?.[p.id];
                his.push({ text: `STANDOUT!${gain ? ` ${gain}` : ''}`, up: true });
                if (gain) delta = { ovrFrom: ovr(p.attrs) - 1 };
              }
              if (form === -1) his.push({ text: 'OFF DAY', up: false });
            } else {
              delta = { e: d?.energyP ?? 0, m: d?.mood ?? 0 };
            }
            labelPop = b.animate;
            popDelay = 320 + sweep * 420;
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
              // the XP banked BEFORE the report: the arc that arrived blinks
              const need = p.level >= LEVEL_CAP ? 0 : xpNeed(p.level);
              if (need > 0) {
                delta.xpFromPct = Math.max(0, Math.min(100, Math.round(((p.xp - wk.xpGain) / need) * 100)));
                delta.xpProjPct = Math.min(100, Math.round((p.xp / need) * 100));
              }
              delta.xp = wk.xpGain;
            }
            labelPop = b.animate;
            popDelay = 280 + sweep * 220;
            sweep++;
          }
        }
      } else if (p && showDeltas) {
        const rec = cardDeltas!.map.get(p.id);
        if (rec) {
          const b = batchFor(`cd:${cardDeltas!.key}`, false);
          if (b.render) {
            delta = rec;
            labelPop = b.animate;
            popDelay = 350 + sweep * 260;
            sweep++;
          }
        }
      }
      const scope = scopeSet && p ? (scopeSet.has(p.id) ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell dropzone" data-zone="${idx}">
        ${p
          ? playerCard(p, { lens: gridLens, draggable, sitout: isPractice && p.outWeeks === 0 && p.energy < 40, col: s.phase === 'weekstart' ? undefined : c, reserve: r === 2, bare: showGame && boxPass === 0, pose, delta, mainLabels: mains, hiLabels: his, labelPop, popDelay, diamond, scope })
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

function prospectGridHtml(s: GameState, pickCount: number | null = null, signing = false): string {
  // a blank column-header row keeps the cards in exactly the same spot as
  // the practice grid — screens must not jump
  const colHead = `<div class="colhead"><span class="rowlabel"></span><span></span><span></span><span></span></div>`;
  const swapping = s.pendingRecruits.length > 0;
  const gxBatch = gxStickers ? stickerBatch(`gx:${s.season}:${s.week}`, true) : null;
  if (gxBatch && !gxBatch.render) gxStickers = null; // seen is seen
  const chances = signing ? effectiveChances(s) : [];
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    const cells = [0, 1, 2].map((c) => {
      const idx = r * 3 + c;
      const pr = s.prospects[idx];
      // a scoped action wants targets: picked names blink in, the rest dim;
      // during a board swap the FOUND name keeps the spotlight wherever it
      // was dragged, and the standing board steps back
      const found = swapping && !!pr && gxFound.has(pr.id);
      const scope = found ? 'in' as const : pickCount !== null && pr ? (gxSel.has(pr.id) ? 'in' as const : 'out' as const) : undefined;
      return `<div class="gcell ${signing ? '' : 'dropzone'}" data-zone="${idx}">${pr
        ? prospectCard(pr, lens, {
            draggable: !signing,
            scope,
            selectable: pickCount !== null,
            dim: swapping && !found,
            labelPop: gxBatch?.animate ?? true,
            signing: signing ? { selected: pr.selected, effPct: chances.find((x) => x.prospect.id === pr.id)?.pct } : undefined,
          })
        : `<div class="pod empty">·</div>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow"><div class="rowlabel">${BOARD_ROW_LABELS[r]}</div>${cells}</div>`);
  }
  // the 4th row exists only while new names wait — whoever sits there when
  // you confirm is gone forever. The FOUND ones are the bright ones: the
  // board dims, the new faces glow, the focus lands where the news is.
  if (swapping && !signing) {
    const cells = [0, 1, 2].map((c) => {
      const pr = s.pendingRecruits[c];
      const found = !!pr && gxFound.has(pr.id);
      return `<div class="gcell dropzone" data-zone="${9 + c}">${pr
        ? prospectCard(pr, lens, { draggable: true, scope: found ? 'in' : undefined, dim: !found })
        : `<div class="pod empty">·</div>`}</div>`;
    }).join('');
    rows.push(`<div class="gridrow cutrow foundrow"><div class="rowlabel">OUT</div>${cells}</div>`);
  }
  return `<div class="grid">${colHead}${rows.join('')}</div>`;
}

// ---- the story takeover (hides grid + fourth row; the bag stays) ------------------------------------

function impactHtml(s: GameState): string {
  const page = impactPage();
  if (!page) return '';
  const t = myTeam(s);
  const p = page.pid !== null ? t.players.find((x) => x.id === page.pid) : undefined;
  // the direction law in color: UP green, DOWN red — numbers and arrows alike
  const rows = page.rows.map((r) => `<div class="imp-row ${r.up ? 'up' : 'down'}">
    <span class="imp-lab">${esc(r.label)}</span>
    ${r.from !== undefined
      ? `<span class="imp-val" data-from="${r.from}" data-to="${r.to}">${r.from}</span>`
      : `<span class="imp-text">${esc(r.text ?? '')}</span>`}
    <span class="imp-arrow">${r.up ? '▲' : '▼'}</span>
  </div>`).join('');
  const more = impact && impact.ix < impact.pages.length - 1;
  return `<div class="impactpanel">
    ${p ? `<span class="imp-sprite">${rigSpriteHtml(rigView(p, page.rows.some((r) => !r.up) ? 'bad' : 'good'), { bg: t.bg, fg: t.fg }, 2)}</span><div class="imp-name">${esc(p.name)}</div>` : ''}
    ${page.kind === 'squad' ? '<div class="imp-name">THE SQUAD</div>' : ''}
    <div class="imp-rows">${rows}</div>
    ${more ? '<div class="imp-more dim">▸ and then…</div>' : ''}
  </div>`;
}

// One thing at a time: a typed beat, OR the decision, OR the impact.
/** Good news lights the sprite up; everything else makes it sweat. */
function storySentiment(tag: string): 'good' | 'bad' {
  return /BREAKTHROUGH|LEVEL UP|ON FIRE|CLEARED/.test(tag) ? 'good' : 'bad';
}

/** The dean's/booster's read of the resolution: their track UP = they love
    you (elated), DOWN = they don't (mad), unmoved = neutral. */
function figureVerdict(figure: FigureId): FigureMood {
  if (!opShift) return 'neutral';
  const d = figure === 'dean' ? opShift.school : figure === 'scoop' ? opShift.pub : figure === 'booster' ? opShift.fans : 0;
  return d > 0 ? 'elated' : d < 0 ? 'mad' : 'neutral';
}

/** THE REVEAL CARD's preview: the actual picker row / item card of what you
    just received — so «WAR CRY» is never a mystery word in the sand. */
function revealPreview(kind: string, id: string, opts: { noFlavor?: boolean } = {}): string {
  if (kind === 'speech') {
    const pl = PLANS.find((x) => x.id === id);
    if (!pl) return '';
    return speechRow(pl, 'div', 'sel revealrow', '');
  }
  if (kind === 'drill') {
    const d = DRILLS.find((x) => x.id === id);
    if (!d) return '';
    return drillRow(d, 'div', 'sel revealrow', '');
  }
  if (kind === 'region') {
    const a = GALAXY_ACTS.find((x) => x.id === id);
    if (!a) return '';
    return galaxyRow(a, 'div', 'sel revealrow', '', false);
  }
  if (kind === 'instr') {
    const it = INSTRUCTIONS.find((x) => x.id === id);
    if (!it) return '';
    return instrRow(it, 'div', 'sel revealrow', '');
  }
  const item = itemById(id);
  // the flavor line stays out when the dialogue already speaks it
  return `<div class="itemcard ${item.rarity} revealrow">
    <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
    ${opts.noFlavor ? '' : `<i class="dim">${esc(item.flavor)}</i><br/>`}
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
  // the reveal card previews the actual thing you received; an offered item
  // shows its card while you decide to take it or leave it
  if (ev.defId === 'reveal') {
    return `<div class="revealbox">${revealPreview((ev.data?.kind as string) ?? 'item', (ev.data?.id as string) ?? '')}</div>`;
  }
  if (ev.defId === 'item_offer' || ev.defId === 'bagfull') {
    // the dialogue says the name and the flavor; the card says what it DOES
    return `<div class="revealbox">${revealPreview('item', (ev.data?.itemId as string) ?? '', { noFlavor: true })}</div>`;
  }
  // SEASON MOMENTS (260830): the arena arrival, the trophy, the rained-out court
  if (ev.defId === 'bigbang_invite') return `<div class="scenebox">${sceneHtml('tourney', kit, 3)}</div>`;
  if (ev.defId === 'bigbang_champs') return `<div class="scenebox">${sceneHtml('champs', kit, 3)}</div>`;
  if (ev.defId === 'bigbang_out' || ev.defId === 'season_over') return `<div class="scenebox">${sceneHtml('seasonlost', kit, 3)}</div>`;
  // the assistant coach fronts every tip — the future tutorial voice
  if (ev.tag === 'ASSISTANT COACH') {
    return `<div class="scenebox">${figureHtml('assistant', 'neutral', kit, 3)}</div>`;
  }
  if (ev.defId === 'graduation' && ev.data?.player) {
    const gp = ev.data.player as Player;
    return `<div class="modalcard truth">${playerCard(gp, { inert: true, story: 'good', storyView: 'abilities', kit, labelPop: false })}</div>`;
  }
  // the kid at the gas station: street clothes, no jersey — he's nobody's yet
  if (ev.defId === 'tut_kid' && ev.data?.player) {
    const gp = ev.data.player as Player;
    return `<div class="modalcard truth">${playerCard(gp, { inert: true, pose: 'shrug', pure: true, labelPop: false })}</div>`;
  }
  if (ev.defId === 'signing_verdict') {
    // SIGNING DAY: the whole truth, for the first time — the ABILITIES card
    // of the kid on the line, in your colors if he's yours
    const pr = s.prospects.find((x) => x.id === (ev.data?.prospectId as number));
    if (!pr) return '';
    const commit = ev.data?.commit === true;
    const acting: 'good' | 'bad' | 'neutral' = storyMode === 'antic' ? 'neutral' : commit ? 'good' : 'bad';
    return `<div class="modalcard truth">${playerCard(prospectAsPlayer(pr), { inert: true, story: acting, storyView: 'abilities', kit: commit ? kit : PRACTICE_KIT, labelPop: false })}</div>`;
  }
  const p = ev.playerId !== null ? t0.players.find((x) => x.id === ev.playerId) : undefined;
  const resolved = !!ev.resolvedText;
  // a story about a RECRUIT (the cold shoulder, the trail's swings): the
  // kid stands on his big-board card — what you know of him, no spoilers —
  // and acts the news the same way a player would
  const prId = ev.data?.prospectId as number | null | undefined;
  const pr = prId !== undefined && prId !== null ? s.prospects.find((x) => x.id === prId) : undefined;
  if (pr && !p) {
    const verdict = ev.data?.verdict as 'good' | 'bad' | 'neutral' | undefined;
    const acting: 'good' | 'bad' | 'worried' | 'neutral' = resolved
      ? (verdict === 'bad' ? 'bad' : verdict === 'neutral' ? 'neutral' : 'good')
      : storyMode === 'antic' ? 'neutral'
      : ev.choices?.length ? 'worried' : (verdict === 'bad' ? 'bad' : 'good');
    return `<div class="modalcard">${prospectCard(pr, 0, { story: acting, labelPop: false })}</div>`;
  }
  if (p) {
    // THE ANTICIPATION LAW: the first beat is always NEUTRAL — the mood
    // lands as the story advances. The reaction lands at CHOICE time: what
    // the PLAYER wanted decides the acting the moment you pick; only
    // unauthored choices fall back to the outcome's read.
    const acting: 'good' | 'bad' | 'worried' | 'neutral' = resolved
      ? chosenWant
        ? (chosenWant === 'love' ? 'good' : 'bad')
        : (impact && impact.pages.some((pg) => pg.rows.some((r) => !r.up)) ? 'bad' : 'good')
      : storyMode === 'antic' ? 'neutral'
      : ev.choices?.length ? 'worried' : storySentiment(ev.tag);
    // the story picks its card backdrop: the ABILITIES compass for growth
    // stories, the energy/mood gauges for everything else
    return `<div class="modalcard">${playerCard(p, { inert: true, story: acting, storyView: def.card ?? 'meters' })}</div>`;
  }
  const side = ev.data?.side as string | undefined;
  // a beat can override the def's figure (the goblins take over the hold)
  const dataFig = ev.data?.figure as FigureId | undefined;
  const figure: FigureId | undefined = dataFig ?? (def.figure === 'side'
    ? (side === 'school' || side === 'dean' ? 'dean' : side === 'scoop' ? 'scoop' : 'booster')
    : def.figure);
  if (figure) {
    // the figure opens NEUTRAL too — the sweat starts once the ask is out
    const mood: FigureMood = resolved ? figureVerdict(figure) : storyMode === 'antic' ? 'neutral' : 'worried';
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

/** THE STARBURST: confetti falls, and falling is for planets. The moments
    that earn it get drifting zero-g star sparkles instead — they twinkle,
    they rise a little, they never land. */
function feteHtml(): string {
  const bits = Array.from({ length: 22 }, (_, i) => {
    const left = (i * 37 + 11) % 100;
    const top = (i * 29 + 7) % 100;
    const delay = ((i * 53) % 100) / 100 * 3.2;
    const dur = 3 + ((i * 31) % 100) / 100 * 2.4;
    const color = [C_YELLOW, C_GREEN, C_MINT, C_ORANGE][i % 4];
    const glyph = i % 3 === 0 ? '✦' : i % 3 === 1 ? '✧' : '·';
    return `<i style="left:${left}%;top:${top}%;animation-delay:-${delay.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;color:${color}">${glyph}</i>`;
  }).join('');
  return `<div class="starburst" aria-hidden="true">${bits}</div>`;
}

function storyPanel(s: GameState): string {
  const ev = currentStory(s)!;
  const p = ev.playerId !== null ? myTeam(s).players.find((x) => x.id === ev.playerId) : undefined;
  const art = storyArt(s, ev);
  const fete = ev.data?.fete === true ? feteHtml() : '';
  if (storyMode === 'impact') {
    // ONE VOICE PER SCREEN: the player's page carries his sprite; the coach's
    // page carries the dean/booster standing over the JOB SECURITY change (or
    // the story's own figure when only credits moved); the squad's page is
    // bare. Tap through them one by one.
    const page = impactPage();
    const heatMoved = opShift !== null && (opShift.school !== 0 || opShift.fans !== 0 || opShift.pub !== 0);
    const t = myTeam(s);
    let pageArt = '';
    if (page?.kind === 'coach') {
      if (heatMoved) {
        // the loudest-moved opinion's character stands over the change
        const moves: [FigureId, number][] = [['dean', Math.abs(opShift!.school)], ['booster', Math.abs(opShift!.fans)], ['scoop', Math.abs(opShift!.pub)]];
        moves.sort((a, b) => b[1] - a[1]);
        const fig: FigureId = moves[0][0];
        pageArt = `<div class="scenebox">${figureHtml(fig, figureVerdict(fig), { bg: t.bg, fg: t.fg }, 3)}</div>`;
      } else if (!p) {
        pageArt = art;
      }
    }
    return `<div class="storypanel ${fete ? 'fete' : ''}" data-action="story-tap" id="storypanel">
      ${fete}
      ${ev.tag ? `<span class="tag">${esc(ev.tag)}</span>` : ''}
      <div class="storyart">${pageArt}</div>
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
    return `<div class="storypanel ${fete ? 'fete' : ''}" data-action="story-tap" id="storypanel">
      ${fete}
      ${ev.tag ? `<span class="tag">${esc(ev.tag)}</span>` : ''}
      <div class="storyart">${art}</div>
      ${inChoices
        ? `<div class="typebox">${esc(beats[beats.length - 1])}</div>`
        : `<div class="typebox" id="typebox"></div>`}
      <div class="modal-actions ${inChoices ? '' : 'hide'}" id="modal-actions">${actions}</div>
    </div>`;
  }
  // a single typed beat — the SAME frame as every other beat: the art region
  // holds the top (even when empty), the words start in the same place every
  // message, nothing ever jumps between beats
  return `<div class="storypanel ${fete ? 'fete' : ''}" data-action="story-tap" id="storypanel">
    ${fete}
    ${ev.tag ? `<span class="tag">${esc(ev.tag)}</span>` : ''}
    <div class="storyart">${art}</div>
    <div class="typebox beatbox" id="typebox"></div>
    <div class="modal-actions hide" id="modal-actions"><div class="taphint">▸ tap</div></div>
  </div>`;
}

// ---- stages (middle content per phase) -----------------------------------------------------------------

function ordinal(n: number): string {
  return `${n}${['', 'st', 'nd', 'rd'][n] ?? 'th'}`;
}

// the four rows sit in their PAIRS: SKILL over ATHLETICISM, BRAINS over
// FIERCENESS — a speech pushes one up and its partner down
const BAR_ROWS: { a: Attr | 'all'; label: string }[] = [
  { a: 'skl', label: 'SKILL' },
  { a: 'ath', label: 'ATHLETICISM' },
  { a: 'brn', label: 'BRAINS' },
  { a: 'frc', label: 'FIERCENESS' },
  { a: 'all', label: 'OVERALL' },
];

/** THE TACTICS BOARD: two schemes between the grid and the bars — offense
    up top, defense below, one per row always lit. The middles are neutral;
    the outer four trade one attribute against its opposite, ±20% team-wide.
    Set once, kept until changed (W1 opens on TRIANGLE / MAN 2 MAN). */
const TAC_ROWS: { key: 'o' | 'd'; opts: { id: string; name: string; sub: string }[] }[] = [
  { key: 'o', opts: [
    { id: 'playcall', name: 'PLAY CALL', sub: '+SKL −ATH' },
    { id: 'triangle', name: 'TRIANGLE', sub: 'balanced' },
    { id: 'fastbreak', name: 'FAST BREAK', sub: '+ATH −SKL' },
  ] },
  { key: 'd', opts: [
    { id: 'zone', name: 'ZONE', sub: '+BRN −FRC' },
    { id: 'man', name: 'MAN 2 MAN', sub: 'balanced' },
    { id: 'press', name: 'PRESS', sub: '+FRC −BRN' },
  ] },
];

function tacticsBoard(s: GameState): string {
  const sel = { o: s.tacO ?? 'triangle', d: s.tacD ?? 'man' };
  return `<div class="tacboard">${TAC_ROWS.map((row) => `<div class="tacrow">${row.opts.map((o) =>
    `<button class="tacbtn ${sel[row.key] === o.id ? 'sel' : ''}" data-action="tac-set" data-id="${row.key}:${o.id}"><b>${o.name}</b><span class="${o.sub === 'balanced' ? 'dim' : 'gaintag'}">${o.sub}</span></button>`
  ).join('')}</div>`).join('')}</div>`;
}

/** PRACTICE: five progress bars + division rank per row — on the MATCH
    weighting (starters ×75% + bench ×25%, unavailable bodies add nothing),
    exactly the numbers the ropes will run on. */
function teamBarsPractice(s: GameState): string {
  const t = myTeam(s);
  const all = s.teams.map((tm) => ({ id: tm.id, sums: tm.id === s.myTeamId ? matchAttrs(tm, null, undefined, tacticsMult(s.tacO, s.tacD)) : matchAttrs(tm) }));
  const mine = all.find((x) => x.id === t.id)!.sums;
  // a bar's FULL length = a whole team of your current best player (the
  // floor weighs 3× one body) — the empty tail stays short and a 1–2 point
  // change actually moves pixels
  const bestAttrVal = (a: Attr): number => Math.max(1, ...t.players.map((p) => p.attrs[a]));
  const bestOvrVal = Math.max(1, ...t.players.map((p) => ovr(p.attrs)));
  const rows = BAR_ROWS.map(({ a, label }) => {
    const val = (x: AttrRec): number => (a === 'all' ? ovr(x) : x[a]);
    const max = a === 'all' ? bestOvrVal * 3 : bestAttrVal(a) * 3;
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
  const mine = matchAttrs(t, fx, opts.forms, tacticsMult(s.tacO, s.tacD));
  const mineTotal = ovr(mine);
  let theirs: AttrRec | null = null;
  let theirsTotal = 0;
  let oppBg = '#666';
  if (champ) {
    // distribute the champion's power along their scouted kite (a landed
    // instruction shaves their total)
    const power = Math.max(1, champ.power + (s.oppFx ? s.oppFx.amt * 3 : 0));
    const w = ATTRS.map((a) => champ.kite[a]);
    const tw = w.reduce((x, y) => x + y, 0) || 1;
    theirs = { skl: 0, ath: 0, frc: 0, brn: 0 };
    ATTRS.forEach((a, i) => { theirs![a] = (power * w[i]) / tw; });
    theirsTotal = power;
    oppBg = champ.bg;
  } else if (m) {
    theirs = matchAttrs(m.opponent, s.oppFx ?? null);
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
  const pot = d.potChance ? '+1 CEILING · coin flips' : '';
  return `${[gains, pot].filter(Boolean).join(' · ') || `+${d.xp[0]}–${d.xp[1]} XP`} · SQUAD · ${d.cost}¢`;
}

/** The speech's second nav row: the trade in abbreviations, one line. */
function speechSub(pl: (typeof PLANS)[number]): string {
  if (pl.kind === 'rally') return 'squad MORALE · a coin flip, a sliver either way';
  if (pl.kind === 'easy') return '−40% ⚡ burned · softer tonight';
  return `+${pl.gain[0]}–${pl.gain[1]} ${ATTR_SHORT[pl.attr]}  −${pl.loss[0]}–${pl.loss[1]} ${ATTR_SHORT[pl.off]}`;
}

/** A speech row: a TRADE when it takes — the facts line says what it gives
    and takes; the down tail is the night it doesn't. THE RALLY is the coin
    flip, TAKE IT EASY the one sure thing. */
function speechRow(pl: (typeof PLANS)[number], tag: 'button' | 'div', cls: string, attrs: string): string {
  const facts: Fact[] = pl.kind === 'rally'
    ? [fact('MORALE, a coin flip', 1), fact('the roof — on or off', 0)]
    : pl.kind === 'easy'
      ? [fact('−40% ⚡ burned', 2), fact('softer tonight · a loss stings', 0)]
      : [fact(`+${pl.gain[0]}–${pl.gain[1]} ${ATTR_SHORT[pl.attr]}`, pl.gain[1] >= 6 ? 3 : 1), fact(`−${pl.loss[0]}–${pl.loss[1]} ${ATTR_SHORT[pl.off]}`, pl.loss[1] <= 3 ? 2 : 0)];
  if (pl.cooldown) facts.push(fact(`${pl.cooldown}w recharge`, 0));
  // no tail on a speech: nothing is risked, and the sheet head already says
  // some nights it doesn't take — THE RALLY alone prints its coin flip;
  // the sticker stays TRADE
  const down = pl.kind === 'rally' ? { pct: 50, cls: 'DRAMA', note: 'a coin flip, the roof on or off' } : undefined;
  return pickerRow({ tag, cls, attrs, name: pl.speech, down, facts, risk: pl.kind === 'easy' ? 'safe' : pl.kind === 'rally' ? 'risky' : 'trade', desc: pl.fantasy });
}

/** An instruction row. Never "if it lands" — the tails say so. */
function instrRow(it: (typeof INSTRUCTIONS)[number], tag: 'button' | 'div', cls: string, attrs: string): string {
  const down = it.id === 'takeout'
    ? { pct: it.backfire, cls: 'SCANDAL', note: 'CAUGHT — the league reviews the tape' }
    : { pct: it.backfire, cls: 'DRAMA', note: `they read you: squad −${it.selfAmt}` };
  const facts: Fact[] = [fact(`they play −${it.oppAmt}`, it.oppAmt >= 5 ? 3 : it.oppAmt >= 4 ? 2 : 1), costFact(it.cost)];
  if (it.cooldown) facts.push(fact(`${it.cooldown}w recharge`, 0));
  return pickerRow({ tag, cls, attrs, name: it.name, up: { pct: it.hit, cls: 'INTEL', note: 'you called it' }, down, facts, risk: riskLevel(it.backfire), desc: it.desc });
}

/** A drill row: what it hammers, whom it touches, what it costs, how risky. */
function drillRow(d: (typeof DRILLS)[number], tag: 'button' | 'div', cls: string, attrs: string): string {
  const gainAttrs = d.gain ? ATTRS.filter((a) => d.gain![a]) : [];
  const what: Fact = gainAttrs.length
    ? fact(gainAttrs.map((a) => `+${d.gain![a]} ${ATTR_SHORT[a]}`).join(' '), gainAttrs.length >= 2 ? 3 : 2)
    : d.potChance
      ? fact('+1 CEILING, a coin flip each', 3)
      : d.xp[1] > 0
        ? fact(`+${d.xp[0]}–${d.xp[1]} XP`, d.xp[1] >= 8 ? 2 : d.xp[1] >= 5 ? 1 : 0)
        : (d.recover?.mood ?? 0) > (d.recover?.energy ?? 0) ? fact(`squad MOOD +${d.recover?.mood ?? 0}`, 2) : fact(`squad ⚡ +${d.recover?.energy ?? 0}`, 2);
  const who = scopeFact(d.target === 'one' ? 'ONE' : 'SQUAD');
  return pickerRow({ tag, cls, attrs, name: d.name, up: d.up, down: d.down, facts: [what, who, costFact(d.cost)], risk: riskLevel(d.down.pct), desc: d.desc });
}

/** A board-action row: the effect, the scope, the cost, the risk (a recruit
    act's per-name sour chance counts toward it). */
function galaxyRow(a: (typeof GALAXY_ACTS)[number], tag: 'button' | 'div', cls: string, attrs: string, grounded: boolean): string {
  const what: Fact = a.reveals
    ? fact(`${a.reveals[0]}–${a.reveals[1]} facets`, a.reveals[1] >= 3 ? 3 : a.reveals[1] >= 2 ? 2 : 0)
    : a.gain
      ? fact(`+${a.gain[0]}–${a.gain[1]}%`, a.gain[1] >= 20 ? 3 : a.gain[1] >= 13 ? 2 : a.gain[1] >= 8 ? 1 : 0)
      : fact(`1${a.twoChance ? '–2' : ''} new name${a.twoChance ? 's' : ''}`, a.twoChance ? 3 : a.cost >= 2 ? 2 : a.cost === 1 ? 1 : 0);
  const who = scopeFact(a.kind === 'search' ? 'THE BOARD' : gxScopeWord(a));
  const risk = riskLevel(Math.max(a.down.pct, (a.risk ?? 0) >= 6 ? 10 : 0));
  const name = `${a.name}${grounded ? ' <span class="blink">GROUNDED</span>' : ''}`;
  return pickerRow({ tag, cls, attrs, name, up: a.up, down: a.down, facts: [what, who, costFact(a.cost)], risk, desc: a.desc });
}

/** WEEK START: the Monday report — the weekend's recovery and banked XP per
    player, before the building (and the week's stories) opens. */
function stageWeekstart(s: GameState): string {
  return `<h2 class="gridhead">${weekLabel(s)} <span class="venuetag" style="background:var(--r35);color:var(--rbg)">WEEK START</span></h2>
    ${gridHtml(s, false, lens)}`;
}

/** THE SCOPE PREVIEW set for the pending practice pick (null = no preview). */
function practiceScope(s: GameState): Set<number> | null {
  const d = DRILLS.find((x) => x.id === selectedDrill)!;
  const scoped = !s.trainedThisWeek && d.target === 'squad' && selectedDrill !== 'rest';
  return scoped
    ? new Set(myTeam(s).players.filter((p) => p.outWeeks === 0 && p.energy >= 40).map((p) => p.id))
    : null;
}

function stagePractice(s: GameState): string {
  // the RUN button lives in the nav; the space between the grid and the
  // bars belongs to THE TACTICS BOARD — pick a scheme, watch the bars move
  // the slack between the grid (fixed, top) and the bars (fixed, bottom)
  // is split evenly around the tactics board — never a lump above it
  // drag on EVERY lens — STATS and ABILITIES are exactly where you decide
  // who moves (the scope preview stays a ROSTER-lens read)
  // SEASON ZERO reveals the bottom half piece by piece: the bars when the
  // walk points at them, the tactics board when it becomes the lesson
  const showBars = s.tutorial === undefined || (s.tutSeen ?? []).includes('m:bars');
  const showTac = s.tutorial === undefined || (s.tutSeen ?? []).includes('m:tac');
  return `<h2 class="gridhead">PRACTICE</h2>${gridHtml(s, true, lens, lens === 0 ? practiceScope(s) : null)}<div class="botstack fill">${showTac ? tacticsBoard(s) : ''}${showBars ? teamBarsPractice(s) : ''}</div>`;
}

/** FACILITIES: the campus stop — six buildings, one move a week. The tiles
    say what stands there NOW and what the next step costs; the upgrade picks
    live in the ▾ menu, like every other screen. */
function stageFacilities(s: GameState): string {
  const tiles = FACILITIES.map((fd) => {
    const lvl = facLevel(s, fd.id);
    const pending = s.futureBeats.some((fb) => fb.defId === 'facility_arrives' && fb.data?.facId === fd.id);
    const cost = Math.max(1, facCost(Math.min(3, lvl + 1)) - (s.mopDiscount ? 2 : 0));
    const pips = [1, 2, 3].map((i) => `<span class="fpip ${i <= lvl ? 'on' : ''}"></span>`).join('');
    const right = pending
      ? '<span class="facwait blink">ARRIVING NEXT WEEK</span>'
      : lvl >= 3
        ? '<span class="facmax">MAXED</span>'
        : `<span class="faccost">▲ ${cost}¢</span>`;
    const pickable = !pending && lvl < 3 && !s.facActWk && s.tutorial === undefined;
    const tag = pickable ? 'button' : 'div';
    return `<${tag} class="drill facrow factile ${selFac === fd.id ? 'sel' : ''}" ${pickable ? `data-action="fac-pick" data-id="${fd.id}"` : ''}>
      <div class="prow1"><b>${fd.name}</b><span class="fpips">${pips}</span>${right}</div>
      <div class="facstate">${esc(fd.blurbs[lvl])}</div>
    </${tag}>`;
  }).join('');
  const disc = s.mopDiscount
    ? '<div class="fourthrow slim"><div class="report">the janitor\'s guy came through: <b>2¢ OFF</b> any upgrade this week</div></div>'
    : s.mopDiscountNext
      ? '<div class="fourthrow slim"><div class="report">the janitor "knows a guy": <b>2¢ OFF</b> any upgrade NEXT week</div></div>'
      : '';
  const mopped = s.moppedWk ? '<div class="fourthrow slim"><div class="report dim">THE FLOORS SHINE. The janitor nods at you differently now.</div></div>' : '';
  return `<h2 class="gridhead">FACILITIES</h2><div class="facwrap">${tiles}</div><div class="botstack">${disc}${mopped}</div>`;
}

/** The campus-move sheet: the mop (free) and every orderable upgrade. */
function facSheetHtml(s: GameState): string {
  if (!facSheet) return '';
  const mopRow = `<button class="drill ${selFac === 'mop' ? 'sel' : ''}" data-action="fac-pick" data-id="mop">
    <div class="prow1"><b>🧹 GRAB A MOP</b></div>
    <div class="prow2"><span class="pf f3">FREE</span><span class="dim"> · </span><span class="pf f1">the janitor remembers who grabs it</span></div>
  </button>`;
  const ups = s.tutorial !== undefined ? '' : FACILITIES.map((fd) => {
    const lvl = facLevel(s, fd.id);
    const pending = s.futureBeats.some((fb) => fb.defId === 'facility_arrives' && fb.data?.facId === fd.id);
    if (lvl >= 3 || pending) return '';
    const cost = Math.max(1, facCost(lvl + 1) - (s.mopDiscount ? 2 : 0));
    const cant = s.energy < cost;
    return `<button class="drill ${selFac === fd.id ? 'sel' : ''}" data-action="fac-pick" data-id="${fd.id}" ${cant ? 'disabled' : ''}>
      <div class="prow1"><b>▲ ${fd.name}</b></div>
      <div class="prow2"><span class="pf f2">${esc(fd.blurbs[Math.min(3, lvl + 1)])}</span><span class="dim"> · </span><span class="pf ${cant ? 'f0' : 'f1'}">${cost}¢ · lands NEXT WEEK</span></div>
    </button>`;
  }).join('');
  return `<div class="modalback sheet" data-action="fac-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">THE CAMPUS MOVE</span>
    <div class="sheethead">ONE MOVE A WEEK — the mop is free; an upgrade costs now and lands next Monday</div>
    ${mopRow}${ups}
    <div class="scrollmore">▼</div>
  </div></div>`;
}

/** «ALL 9» / «PICK 6» / «PICK 3» — the scope, printed everywhere: a scoped
    action works the names YOU highlight first. */
function gxScopeWord(act: (typeof GALAXY_ACTS)[number]): string {
  return act.scope ? `PICK UP TO ${act.scope}` : 'ALL 9';
}

/** One-line recap of a galaxy act for the main button. */
function gxActSub(act: (typeof GALAXY_ACTS)[number]): string {
  if (act.kind === 'scout') return `reveal ${act.reveals![0]}–${act.reveals![1]} facets · ${gxScopeWord(act)} · ${act.cost}¢`;
  if (act.kind === 'recruit') return `+${act.gain![0]}–${act.gain![1]}% commit · ${gxScopeWord(act)}${(act.risk ?? 0) >= 6 ? ' · some may sour' : ''} · ${act.cost}¢`;
  return `new talent for the board · ${act.cost ? `${act.cost}¢` : 'FREE'}`;
}

const GX_VERB = { scout: 'SCOUT', recruit: 'RECRUIT', search: 'SEARCH' } as const;

/** The current board section's picked act + whether it already ran. */
function boardSel(s: GameState): { actId: string; done: boolean } {
  return s.phase === 'recruiting'
    ? { actId: selRecruit, done: !!s.recruitActWk }
    : { actId: selScout, done: !!s.scoutActWk };
}

/** target picks for a scoped board action — the coach highlights the names */
let gxSel = new Set<number>();

/** How many names the pending board act needs highlighted (null = none). */
function galaxyPickCount(s: GameState): number | null {
  const { actId, done } = boardSel(s);
  const act = galaxyActById(actId);
  const grounded = s.groundedWeeks > 0 && act.kind === 'search' && !act.local;
  const disabled = grounded || s.energy < act.cost || actCooldown(s, actId) > 0;
  if (done || s.pendingRecruits.length || disabled || act.kind === 'search' || !act.scope) return null;
  const avail = s.prospects.filter((pr) => act.kind !== 'recruit' || !pr.signed).length;
  if (!avail) return null;
  return Math.min(act.scope, avail);
}

/** Names still on the board only — picks go stale when the board changes. */
function pruneGxSel(s: GameState, need: number | null): void {
  for (const id of [...gxSel]) if (!s.prospects.some((pr) => pr.id === id)) gxSel.delete(id);
  if (need === null) gxSel.clear();
}

/** NEXT YEAR, at a glance: who returns when the seniors walk — and what the
    room runs short of. The scouting hint that makes the board a plan. */
function nextYearLine(s: GameState): string {
  const t = myTeam(s);
  const returning = t.players.filter((p) => p.classYear < 3);
  const leaving = t.players.length - returning.length;
  if (!returning.length) return `NEXT YEAR: everybody walks. Scout like it.`;
  // spoken in COLUMN terms (where each returner rates best) — positions
  // themselves stay under the hood
  const COL_SHORT = ['BACK', 'WING', 'FRONT'];
  const byCol = [0, 1, 2].map((c) => returning.filter((p) => bestCol(p) === c).length);
  const holes = [0, 1, 2].filter((c) => byCol[c] === 0).map((c) => COL_SHORT[c]);
  const sums = { skl: 0, ath: 0, frc: 0, brn: 0 };
  for (const p of returning) for (const a of ATTRS) sums[a] += p.attrs[a];
  const low = ATTRS.reduce((worst, a) => (sums[a] < sums[worst] ? a : worst), 'skl' as Attr);
  void leaving; // inferred from the returnees — the strip stays short
  const bits = [`${returning.length} return`, `${byCol.map((n, c) => `${COL_SHORT[c]}×${n}`).join(' ')}`];
  if (holes.length) bits.push(`no ${holes.join('/')} coming back`);
  else bits.push(`thin on ${ATTR_SHORT[low]}`);
  return `NEXT YEAR: ${bits.join(' · ')}`;
}

/** SCOUTING and RECRUITING: the same board, two different weeks' moves. */
function stageBoard(s: GameState): string {
  const swapping = s.pendingRecruits.length > 0;
  const scouting = s.phase === 'scouting';
  const title = scouting ? 'SCOUTING' : 'RECRUITING';
  const need = swapping ? null : galaxyPickCount(s);
  pruneGxSel(s, need);
  // how many board weeks are left this season — counting this one while its
  // move is still unspent
  const done = scouting ? s.scoutActWk : s.recruitActWk;
  const weeksLeft = Math.max(0, REGULAR_WEEKS - s.week) + (done ? 0 : 1);
  const infoRows = swapping ? '' : `
      ${need !== null ? `<div class="fourthrow slim"><div class="report">HIGHLIGHT UP TO ${need} NAME${need === 1 ? '' : 'S'} — tap the cards (${gxSel.size}/${need})</div></div>` : ''}
      <div class="fourthrow slim two"><div class="report dim"><span>${weeksLeft} ${title} WEEK${weeksLeft === 1 ? '' : 'S'} LEFT THIS SEASON</span><span>${esc(nextYearLine(s))}</span></div></div>
      ${scouting && s.groundedWeeks > 0 ? `<div class="fourthrow slim"><div class="report blink">SHIP GROUNDED ${s.groundedWeeks}w — local searches only</div></div>` : ''}`;
  return `<h2 class="gridhead">${title}</h2>
    ${prospectGridHtml(s, need)}
    <div class="botstack">${infoRows}</div>`;
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

/** The default speech when nothing is picked. */
function speechDefault(s: GameState): PlanId {
  const ok = (id: PlanId): boolean => s.knownPlans.includes(id) && speechCooldown(s, id) === 0;
  if (ok(s.plan)) return s.plan;
  return s.knownPlans.find(ok) ?? s.knownPlans[0];
}

/** The pregame move's current selection: a SPEECH or an INSTRUCTION. */
function pregameSel(s: GameState): { kind: 'speech'; id: PlanId } | { kind: 'instr'; id: string } {
  if (selPregame) {
    if (selPregame.kind === 'speech' && s.knownPlans.includes(selPregame.id) && speechCooldown(s, selPregame.id) === 0) return selPregame;
    if (selPregame.kind === 'instr' && (s.knownInstr ?? []).includes(selPregame.id) && speechCooldown(s, selPregame.id as PlanId) === 0) return selPregame;
  }
  return { kind: 'speech', id: speechDefault(s) };
}

function stageMatchup(s: GameState): string {
  // the pregame move (then PLAY) lives in the nav now — the stage is the
  // lineup and the honest ropes; the outcome shows as a strip over the bars
  let landedLine = '';
  if (s.pregameWk) {
    const fxs = s.speechFx ?? [];
    const gain = fxs.find((f) => f.amt > 0);
    const loss = fxs.find((f) => f.amt < 0);
    if (s.instrPending) landedLine = 'the call is made — you\'ll know at tip-off';
    else if (s.oppFx) landedLine = `✓ THE CALL LANDS — they play ${s.oppFx.amt} ${ATTR_SHORT[s.oppFx.attr]} tonight`;
    else if (!gain && loss) landedLine = `▼ THEY READ YOU — your squad plays ${loss.amt} ${ATTR_SHORT[loss.attr]} tonight`;
    else if (gain) landedLine = `✓ the words LAND — squad +${gain.amt} ${ATTR_SHORT[gain.attr]}${loss ? ` · ${loss.amt} ${ATTR_SHORT[loss.attr]}` : ''} tonight`;
    else if (s.speechTook === false) landedLine = "▼ the words didn't take — the squad plays as it is tonight";
    else landedLine = 'the move is made. the rest is on them';
  }
  const landed = landedLine ? `<div class="fourthrow slim"><div class="report">${landedLine}</div></div>` : '';
  const m0 = myMatchup(s);
  const homeGame = isUtWeek(s) ? true : m0?.home ?? true;
  const host = homeGame
    ? { bg: myTeam(s).bg, fg: myTeam(s).fg }
    : m0
      ? { bg: m0.opponent.bg, fg: m0.opponent.fg }
      : { bg: '#333', fg: '#ccc' };
  return `<h2 class="gridhead">MATCHUP <span class="venuetag" style="background:${host.bg};color:${host.fg}">${homeGame ? 'HOME GAME' : 'AWAY GAME'}</span></h2>
    ${gridHtml(s, true, lens)}
    <div class="botstack">${teamBarsMatchup(s)}${landed}</div>`;
}

// the speech picker: which gamble does the room hear tonight?
// the pregame picker: rouse the room, OR play the tape
function speechSheetHtml(s: GameState): string {
  if (!speechSheet) return '';
  const sel = pregameSel(s);
  let hidden = 0;
  const speeches = PLANS.map((pl) => {
    if (!s.knownPlans.includes(pl.id)) { hidden++; return ''; }
    // SEASON ZERO: before the cheerleader keeps her promise, only the four
    // standard trades are on the sheet — THE RALLY isn't yours yet; after,
    // hers are the only words tonight
    if (s.tutorial !== undefined) {
      if ((s.tutorial ?? 0) < TUT_AT.SPEECH) {
        if (pl.kind !== 'shift' || pl.premium) { hidden++; return ''; }
      } else if (pl.id !== 'rally') { hidden++; return ''; }
    }
    const cd = speechCooldown(s, pl.id);
    if (cd > 0) {
      return `<div class="drill locked"><b>${pl.speech}</b> <span class="dim">— recharging, ${cd} week${cd === 1 ? '' : 's'}</span></div>`;
    }
    return speechRow(pl, 'button', sel.kind === 'speech' && sel.id === pl.id ? 'sel' : '', `data-action="speech-pick" data-id="${pl.id}"`);
  }).join('');
  const instrs = INSTRUCTIONS.map((it) => {
    if (!(s.knownInstr ?? []).includes(it.id)) { hidden++; return ''; }
    if (s.tutorial !== undefined) { hidden++; return ''; }
    const cd = speechCooldown(s, it.id as PlanId);
    if (cd > 0) {
      return `<div class="drill locked"><b>${it.name}</b> <span class="dim">— recharging, ${cd} week${cd === 1 ? '' : 's'}</span></div>`;
    }
    return instrRow(it, 'button', sel.kind === 'instr' && sel.id === it.id ? 'sel' : '', `data-action="instr-pick" data-id="${it.id}"`);
  }).join('');
  return `<div class="modalback sheet" data-action="speech-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">THE PREGAME MOVE</span>
    <div class="sheethead">THE SPEECH — a trade: one thing up, its opposite down. Some nights it doesn't take.</div>
    ${speeches}
    <div class="sheethead">LAST-MINUTE INSTRUCTIONS — play the tape</div>
    ${instrs}
    ${hidden ? `<div class="sheethint dim">▓ ${hidden} move${hidden === 1 ? '' : 's'} unlearned</div>` : ''}
    <div class="scrollmore">▼</div>
  </div></div>`;
}

/** THE LIVE GAME dial (away on the left, always): team-colored labels flank
    the rope; the score tag rides the separator UNDERNEATH it, overlapping
    nothing. The score ticks up in 1–3 point bursts while each team's color
    FILLS from the rating separator toward its own edge — filling past your
    edge means you're beating the rating, and the separator gets PUSHED. */
/** where the live game paused for the night's interruptions (per week) */
let liveProg: { key: string; l: number; r: number } | null = null;

// ---- M5 COURT CARDS: the live floor ------------------------------------------
// Pure theater, zero effect on the result: the box score dealt at tip-off
// becomes a scoring script — every bump on my side flashes the card of the
// player the box says earned it. Three cards on the floor; the bench pair
// takes the two quietest spots for the middle stretch of the clock. The
// opponent's side stays cards-less — enemy territory.

/** Who stands on the floor at clock fraction t — deterministic, so the
    night resumes correctly after an interruption. Starters open and close;
    the two loudest bench lines replace the two quietest starters between
    40% and 75% of the clock. */
function courtFloor(t: Team, box: BoxRow[], frac: number): Player[] {
  const pts = (p: Player): number => box.find((b) => b.playerId === p.id)?.pts ?? 0;
  const ok = (p: Player): boolean => p.outWeeks === 0; // nobody plays from a pod
  const st = starters(t).filter(ok);
  const bench = benchPlayers(t).filter(ok).sort((a, b) => pts(b) - pts(a));
  const reserve = reserves(t).filter(ok).sort((a, b) => pts(b) - pts(a));
  // a mid-game injury empties a spot: the loudest healthy body fills it
  const fill = [...bench, ...reserve];
  const floor = [...st];
  while (floor.length < 3 && fill.length) { const nxt = fill.shift()!; if (!floor.some((p) => p.id === nxt.id)) floor.push(nxt); }
  if (frac < 0.4 || frac >= 0.75) return floor;
  const pair = fill.filter((p) => !floor.some((f) => f.id === p.id)).slice(0, 2);
  if (!pair.length) return floor;
  const sitting = new Set([...floor].sort((a, b) => pts(a) - pts(b)).slice(0, pair.length).map((p) => p.id));
  let bi = 0;
  return floor.map((p) => (sitting.has(p.id) && bi < pair.length ? pair[bi++] : p));
}

/** name + sprite, nothing else — a player on fire smokes (the rig itself
    already draws his flames) */
function courtCardHtml(p: Player, kit: Kit, fresh: boolean): string {
  return `<div class="ccard ${p.onFire ? 'onfire' : ''} ${fresh ? 'fresh' : ''}" data-cpid="${p.id}">
      ${rigSpriteHtml(rigView(p), kit, 1.1, 'cspr')}
      <span class="cname">${esc(p.name)}</span>
    </div>`;
}

/** The court's inner HTML at clock fraction t; `prev` marks which cards are
    NEW this rotation (they slide in). */
function courtHtml(s: GameState, frac: number, prev?: Set<number>): string {
  const r = s.lastResult;
  if (!r) return '';
  const t = myTeam(s);
  const floor = courtFloor(t, r.box, frac);
  return floor.map((p) => courtCardHtml(p, { bg: t.bg, fg: t.fg }, !!prev && !prev.has(p.id))).join('');
}

function needleStage(s: GameState, title: string, share: number, home: boolean, oppName: string, final?: { my: number; opp: number; win: boolean }): string {
  const t = myTeam(s);
  const m = myMatchup(s);
  const champ = isUtWeek(s) ? utOpponent(s) : null;
  const opp = champ
    ? { name: oppName, bg: champ.bg, fg: champ.fg }
    : m
      ? { name: oppName, bg: m.opponent.bg, fg: m.opponent.fg }
      : { name: oppName, bg: '#555', fg: '#ddd' };
  // both sides read planet + name on game night — the opponent always did
  const mineChip = { name: teamLabel(t), bg: t.bg, fg: t.fg };
  const away = home ? opp : mineChip;
  const homeT = home ? mineChip : opp;
  const clash = Math.min(Math.abs(hue(away.bg) - hue(homeT.bg)), 360 - Math.abs(hue(away.bg) - hue(homeT.bg))) < 40;
  // a finished game renders its final frame statically (the same math the
  // ticker runs) under the big verdict
  let l = 0, rr = 0;
  const wkKey = `${s.season}:${s.week}`;
  if (final) {
    l = home ? final.opp : final.my;
    rr = home ? final.my : final.opp;
  } else if (liveProg && liveProg.key === wkKey) {
    // resuming after the night's interruptions: pick up where it paused
    l = liveProg.l;
    rr = liveProg.r;
  }
  const r0 = s.lastResult;
  const total = r0 ? Math.max(1, r0.myScore + r0.oppScore) : 1;
  const f = liveFrame(l, rr, final ? 1 : (l + rr) / total);
  const titleGame = isUtWeek(s) && (s.ut?.round ?? 0) >= 2;
  // THE BOOKIE: the night's line, printed the way bookies print — a
  // moneyline (favorites minus, dogs plus), the raw % one tap away
  const m0 = myMatchup(s);
  // before the ball goes up: the line. After the horn: the line as it stood
  // at tip-off, and whether the bookie called it
  const pct = final ? (r0?.bookiePct ?? Math.round(share * 100)) : bookieLine(s, t, champ ? null : m0?.opponent ?? null, champ, home);
  const called = final ? (pct >= 50) === final.win : false;
  // the bookie is a person, not court decoration: he speaks in dialogs
  // pre-game — the in-game screen keeps only his printed line
  const bookie = final
    ? `<div class="bookie" title="win chance ${pct}%">THE BOOKIE HAD YOU AT <b>${moneyline(pct)}</b>.<br/><span class="bookieverdict">${called ? 'He knows what he\'s doing.' : 'Shows you what he knows!'}</span></div>`
    : `<div class="bookie" title="win chance ${pct}%">THE BOOKIE HAS YOU AT <b>${moneyline(pct)}</b></div>`;
  // centered, the whole screen used: AWAY on top, @, HOME — then open air
  // where the score tag lives, hovering above the bar. The bar LIGHTS from
  // the center outward as the clock runs; the line inside the lit part is
  // who leads, and by how much (away's share of the points, left).
  return `<div class="needle-stage lg-stage" id="needle-stage">
    <div class="ns-title">${title}</div>
    <div class="lg-vs">
      <span class="lg-team">${clash ? chip(away.name, away.fg, away.bg) : chip(away.name, away.bg, away.fg)}</span>
      <span class="lg-at">@</span>
      <span class="lg-team">${chip(homeT.name, homeT.bg, homeT.fg)}</span>
    </div>
    ${bookie}
    <div class="lg-air"></div>
    <div class="bigrope live" id="bigrope">
      <span class="lg-fill" id="lgl" style="left:${f.lo}%;width:${f.sep - f.lo}%;background:${away.bg}"></span>
      <span class="lg-fill" id="lgr" style="left:${f.sep}%;width:${f.hi - f.sep}%;background:${homeT.bg}"></span>
      <span class="brsplit ${final ? 'landed' : ''}" id="lgsep" style="left:${f.sep}%"></span>
      <div class="livescore" id="livescore" style="left:${f.sep}%"><b id="lsl">${l}</b><span class="lsdot">·</span><b id="lsr">${rr}</b></div>
    </div>
    ${final ? `<div class="gn-final ${final.win ? 'won' : 'lost'} ${final.win && titleGame ? 'title' : ''}">
      <b>${final.win ? (titleGame ? 'CHAMPIONS OF THE UNIVERSE' : 'YOU WON') : 'YOU LOST'}</b>
      <span class="gn-score">${final.my} – ${final.opp}</span>
    </div>` : `<div class="court" id="court">${courtHtml(s, (l + rr) / total)}</div><div class="lg-air"></div>`}
  </div>`;
}

/** The moneyline: how a bookie prints a win chance — favorites minus,
    underdogs plus, rounded to the nearest 5 like a chalkboard would. */
function moneyline(pct: number): string {
  const p = clamp(pct, 5, 95) / 100;
  const ml = p >= 0.5
    ? -Math.round((p / (1 - p)) * 100 / 5) * 5
    : Math.round(((1 - p) / p) * 100 / 5) * 5;
  return ml > 0 ? `+${ml}` : `${ml}`;
}

/** One frame of the live bar: t = how much of the game has run (0–1); the
    lit stretch is [50−50t, 50+50t]. The line inside it AMPLIFIES the lead
    (×2 around the middle) — a rope that only whispered the score felt like
    a muted version of the night, so now it swings like the night does. */
function liveFrame(l: number, r: number, t: number): { lo: number; hi: number; sep: number } {
  const tt = clamp(t, 0, 1);
  const lo = 50 - 50 * tt;
  const hi = 50 + 50 * tt;
  const shareL = l + r > 0 ? l / (l + r) : 0.5;
  const swung = clamp(0.5 + (shareL - 0.5) * 2, 0.04, 0.96);
  return { lo, hi, sep: lo + (hi - lo) * swung };
}

function stageGamenight(s: GameState): string {
  const r = s.lastResult;
  if (!r) return `<h2>GAME NIGHT</h2><div class="report dim">The shuttle hums...</div>`;
  if (gnStage === 'beat') {
    return needleStage(s, '« TIP OFF »', r.share, r.home, r.oppName);
  }
  if (gnStage === 'final') {
    // the game screen itself turns into the verdict: YOU WON / YOU LOST,
    // the final score big, the rope frozen where the night ended
    return needleStage(s, 'FINAL', r.share, r.home, r.oppName, { my: r.myScore, opp: r.oppScore, win: r.win });
  }
  if (gnStage === 'recap') {
    // THE RECAP: the night's faces — the MVP, then the off days (named in
    // the text), then any standout that wasn't the MVP — over the story
    const t = myTeam(s);
    const faces: { p: Player; tag: string; cls: string }[] = [];
    const mvp = r.mvpId !== undefined ? t.players.find((p) => p.id === r.mvpId) : undefined;
    if (mvp) faces.push({ p: mvp, tag: '★ GAME MVP', cls: 'up' });
    const offs = t.players.filter((p) => r.forms?.[p.id] === -1);
    for (const p of offs) if (faces.length < 3) faces.push({ p, tag: 'OFF DAY', cls: 'down' });
    for (const p of t.players.filter((q) => r.forms?.[q.id] === 1 && q.id !== r.mvpId)) if (faces.length < 3) faces.push({ p, tag: 'STANDOUT!', cls: 'up' });
    const offLine = offs.length
      ? `${offs.map((p) => p.name).join(' and ')} never got going — ${offs.length === 1 ? 'an off night' : 'off nights'} in a game that needed everybody.`
      : '';
    return `<h2 class="gridhead ${r.win ? 'won' : 'lost'}">${r.win ? 'VICTORY' : 'DEFEAT'} ${r.myScore}–${r.oppScore}</h2>
      <div class="recapfaces">${faces.map((f) => `<div class="recapface">
        ${rigSpriteHtml(rigView(f.p, f.cls === 'up' ? 'good' : 'bad'), { bg: t.bg, fg: t.fg }, 2)}
        <div class="recaptag ${f.cls}">${esc(f.tag)}</div>
        <div class="recapname">${esc(f.p.name)}</div>
      </div>`).join('')}</div>
      <div class="verdict">
        <div class="vline">${esc(r.wheelLine)}</div>
        <div class="vline">${esc(r.heroLine)}</div>
        ${offLine ? `<div class="vline">${esc(offLine)}</div>` : ''}
        <div class="vline dim">${esc(r.boxLine)}</div>
      </div>`;
  }
  if (gnStage === 'verdict') {
    // the box score reads in three passes — one player at a time: the
    // lines, the XP, the tanks. No rearranging here: the night is over.
    const passName = ['THE LINES', '⚡ & MOOD'][boxPass] ?? '';
    const others = leagueResultsHtml(s);
    return `<h2 class="gridhead ${r.win ? 'won' : 'lost'}">BOX SCORE ${r.myScore}–${r.oppScore} <span class="venuetag" style="background:var(--r35);color:var(--rbg)">${passName}</span></h2>
      ${gridHtml(s, false, lens)}
      <div class="botstack">${others}</div>`;
  }
  // THE STANDINGS — with the night's movement: who climbed, who slid
  // (against the table as it stood at tip-off); your sticker stands taller.
  // THE LEADERS ride along as a second tab, same as the header dialog.
  const table = !isUtWeek(s)
    ? `<table class="standings">${sortedStandings(s)
        .map((t, i) => {
          const was = s.prevRanks?.[t.id];
          const move = was === undefined || was === i + 1 ? '' : was > i + 1 ? '<span class="rankup">▲</span>' : '<span class="rankdown">▼</span>';
          const mine = t.id === s.myTeamId;
          return `<tr class="${mine ? 'me' : ''}">
          <td>${i + 1}. ${mine ? chipBig(teamLabel(t), t.bg, t.fg) : chip(teamLabel(t), t.bg, t.fg, true)} ${move}</td><td class="num">${t.wins}–${t.losses}</td></tr>
          ${i === 1 ? `<tr class="utline"><td colspan="2">▲ ${TOURNEY.name} ▲</td></tr>` : ''}`;
        })
        .join('')}</table>`
    : `<div class="report">${(s.ut?.log ?? []).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
  const tabs = !isUtWeek(s)
    ? `<div class="lensbar standtabs">
        <button class="lenstab ${standTab === 'table' ? 'sel' : ''}" data-action="stand-tab" data-id="table">STANDINGS</button>
        <button class="lenstab ${standTab === 'leaders' ? 'sel' : ''}" data-action="stand-tab" data-id="leaders">THE LEADERS</button>
      </div>`
    : '';
  const body = standTab === 'leaders' && !isUtWeek(s) ? `<div class="facwrap">${leadersListHtml(s)}</div>` : table;
  return `<h2>${standTab === 'leaders' && !isUtWeek(s) ? 'THE LEADERS' : 'THE STANDINGS'}</h2>${tabs}${body}`;
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
        col: c,
        // the pick compares who they ARE: no gauges, and EVERY row (the
        // CUT row too) grades at full tanks for the column he stands in —
        // there is no reserve row on a selection grid, only choices
        pure: true,
        draggable: true,
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
      <span class="dim">· ${s.trophies}🏆 · ${s.utTitles}× ${TOURNEY.short} · ${s.totalWins}W</span><br/>
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
      <div>${s.trophies}🏆 · ${s.utTitles}× ${TOURNEY.short} · ${s.totalWins} WINS</div>
    </div>
    ${s.careerLog.length ? `<div class="report dim">${s.careerLog.slice(-8).map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
  </div>`;
}

// ---- THE NEW CAREER WIZARD (v5 M6) -----------------------------------------------
// Step 1 (codex veterans only): keep the knowledge or burn it.
// Step 2: pick a conference — four leagues, six programs each.
// Step 3: the six programs, names and colors editable, pick yours, LOCK IT IN.

function stageSetupCodex(): string {
  const cdx = loadCodex();
  const n = cdx.plans.length + cdx.drills.length + cdx.instrs.length + cdx.regions.length;
  return `<h1>GALACTIC COACH</h1>
    <p class="sub">3-on-3. Every choice has two tails.</p>
    <div class="report"><b>THE CODEX</b> <span class="dim">· ${n} entr${n === 1 ? 'y' : 'ies'} carried across careers</span></div>
    <button class="wide askbtn" data-action="setup-codex-keep"><b>I KNOW THE DRILL</b><span>Keep everything you learned — skip the tutorial, straight to tryouts</span></button>
    <button class="wide askbtn hold danger" data-action="setup-codex-burn"><b>START FRESH</b><span>Delete the codex and coach the tutorial season (cannot be undone)</span></button>`;
}

function stageSetupConf(): string {
  const cards = CONFERENCES.map((c) => {
    const chips = c.teams.map((t) => chip(t.name, t.bg, t.fg, true)).join(' ');
    return `<button class="wide confcard" data-action="setup-conf" data-id="${c.id}">
      <b>${esc(c.name)}</b><span>${esc(c.sub)}</span>
      <div class="confchips">${chips}</div>
    </button>`;
  }).join('');
  return `<h1>PICK A CONFERENCE</h1>
    <p class="sub">Six programs. One of them is about to hire you.</p>
    <div class="teampick">${cards}</div>`;
}

function stageSetupTeams(s: GameState): string {
  const conf = conferenceById(s.conference);
  const rows = s.teams.map((t) => {
    const mine = pendingTeam === t.id;
    return `<div class="confteamrow ${mine ? 'mine' : ''}">
      <button class="teampickbtn" data-action="setup-team" data-id="${t.id}" style="background:${t.bg};color:${t.fg}">
        <b>${esc(teamLabel(t))}</b>${mine ? ' <i class="youtag">YOU</i>' : ''}<br/><span>${esc(t.region)} · ${esc(t.planet)}</span></button>
      <button class="editbtn" data-action="setup-edit" data-id="${t.id}" title="edit name & colors">✎</button>
    </div>`;
  }).join('');
  const edIx = setup !== null ? setup.editing : null;
  const ed = edIx !== null ? s.teams[edIx] ?? null : null;
  const editModal = ed
    ? `<div class="modalback"><div class="modal">
        <span class="tag">EDIT PROGRAM</span>
        <label class="edrow"><span>PLANET</span><input id="ed-planet" type="text" maxlength="18" value="${esc(ed.planet)}"/></label>
        <label class="edrow"><span>TEAM NAME</span><input id="ed-name" type="text" maxlength="18" value="${esc(ed.name)}"/></label>
        <label class="edrow"><span>MAIN COLOR</span><input id="ed-bg" type="color" value="${esc(ed.bg)}"/></label>
        <label class="edrow"><span>TEXT COLOR</span><input id="ed-fg" type="color" value="${esc(ed.fg)}"/></label>
        <button class="wide askbtn" data-action="setup-edit-save"><b>SAVE</b></button>
        <button class="wide askbtn" data-action="setup-edit-cancel"><b>CANCEL</b></button>
      </div></div>`
    : '';
  return `<h1>${esc(conf.name)}</h1>
    <p class="sub">Tap the program you'll coach. ✎ renames any of the six — names and colors lock when the season starts.</p>
    <div class="teampick">${rows}</div>
    <button class="wide askbtn" data-action="setup-back"><b>PICK A DIFFERENT CONFERENCE</b></button>${editModal}`;
}

function stagePickTeam(s: GameState): string {
  const st = ensureSetup();
  if (st.step === 'codex') return stageSetupCodex();
  if (st.step === 'conf') return stageSetupConf();
  return stageSetupTeams(s);
}

// ---- nav (always there) ------------------------------------------------------------------------------------

// One nav language everywhere: the continue button IS the action button.
// While a mandatory action waits, the button runs it («▶ RUN — SHOOTAROUND»)
// with a ▾ picker arrow on BOTH sides of the screen; once it lands, the same
// button names what's next (TO RECRUITING, PLAY, NEXT WEEK).
function navMain(label: string, action: string, disabled = false, hold = true): string {
  return `<button class="primary ${hold ? 'hold' : 'tap'} navmain" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

/** The way forward when nothing is left to do: a plain tap, arrows both sides. */
function navGo(dest: string, action: string): string {
  return navMain(`▸ CONTINUE TO ${dest} ◂`, action, false, false);
}

function navAction(label: string, sub: string, runAction: string, sheetAction: string, opts: { disabled?: boolean; scoped?: boolean } = {}): string {
  const arrow = `<button class="actarrow navarrow" data-action="${sheetAction}">▾</button>`;
  return `${arrow}<button class="primary hold navmain actnav ${opts.scoped ? 'scopehl' : ''}" data-action="${runAction}" ${opts.disabled ? 'disabled' : ''}>
      <b>${label}</b><span class="actsub">${sub}</span>
    </button>${arrow}`;
}

function nav(s: GameState): string {
  if (currentStory(s)) return navMain('THE GALAXY IS TALKING…', 'noop', true);
  switch (s.phase) {
    case 'pickTeam': {
      const st = ensureSetup();
      if (st.step === 'teams') {
        return pendingTeam !== null
          ? navMain('⭐ LOCK IT IN — START THE CAREER', 'setup-confirm')
          : navMain('TAP THE PROGRAM YOU WILL COACH', 'noop', true);
      }
      return navMain(st.step === 'conf' ? 'PICK A CONFERENCE' : 'A NEW CAREER AWAITS', 'noop', true);
    }
    case 'teamSelect':
      return navMain('CONFIRM SQUAD', 'cut-confirm-open', false, false);
    case 'weekstart':
      return navGo(isUtWeek(s) ? 'THE MATCHUP' : 'THE CAMPUS', 'begin-week');
    case 'facilities': {
      if (s.facActWk) return navGo('SCOUTING', 'to-scouting');
      if (selFac !== 'mop') {
        const fd = FACILITIES.find((x) => x.id === selFac);
        const lvl = fd ? facLevel(s, fd.id) : 3;
        const pending = fd ? s.futureBeats.some((fb) => fb.defId === 'facility_arrives' && fb.data?.facId === fd.id) : true;
        if (!fd || lvl >= 3 || pending) selFac = 'mop';
        else {
          const cost = Math.max(1, facCost(lvl + 1) - (s.mopDiscount ? 2 : 0));
          const cant = s.energy < cost;
          return navAction(`▶ UPGRADE — ${fd.name}`, cant ? `NEED ${cost}¢` : `${fd.blurbs[Math.min(3, lvl + 1)]} · ${cost}¢`, 'fac-run', 'fac-sheet', { disabled: cant });
        }
      }
      return navAction('▶ GRAB A MOP', 'help the janitor · FREE', 'fac-run', 'fac-sheet');
    }
    case 'scouting': {
      if (s.pendingRecruits.length) return navMain('CONFIRM THE BOARD', 'board-confirm-open', false, false);
      if (s.scoutActWk) return navGo('PRACTICE', 'to-practice');
      const act = galaxyActById(selScout);
      const grounded = s.groundedWeeks > 0 && act.kind === 'search' && !act.local;
      const cd = actCooldown(s, act.id);
      const need = galaxyPickCount(s);
      const short = need !== null && gxSel.size === 0;
      const disabled = grounded ? 'GROUNDED' : cd > 0 ? `RECHARGING — ${cd}w` : s.energy < act.cost ? `NEED ${act.cost}¢` : short ? 'HIGHLIGHT NAMES ON THE BOARD' : null;
      return navAction(`▶ ${GX_VERB[act.kind]} — ${act.name}`, disabled ?? gxActSub(act), 'gx-run', 'gx-sheet', { disabled: !!disabled, scoped: need !== null && !short });
    }
    case 'practice': {
      if (s.trainedThisWeek) return navGo('RECRUITING', 'to-recruiting');
      const d = DRILLS.find((x) => x.id === selectedDrill)!;
      const cd = actCooldown(s, d.id);
      const cant = s.energy < d.cost || cd > 0;
      return navAction(`▶ RUN — ${d.name}`, cd > 0 ? `RECHARGING — ${cd}w` : cant ? `NEED ${d.cost}¢` : drillRecap(d), 'drill-run', 'drill-sheet', { disabled: cant, scoped: lens === 0 && practiceScope(s) !== null });
    }
    case 'recruiting': {
      if (s.recruitActWk) return navGo('THE MATCHUP', 'to-matchup');
      const act = galaxyActById(selRecruit);
      const cd = actCooldown(s, act.id);
      const need = galaxyPickCount(s);
      const short = need !== null && gxSel.size === 0;
      const disabled = cd > 0 ? `RECHARGING — ${cd}w` : s.energy < act.cost ? `NEED ${act.cost}¢` : short ? 'HIGHLIGHT NAMES ON THE BOARD' : null;
      const verb = act.via === 'booster' ? 'THE BOOSTER' : 'RECRUIT';
      return navAction(`▶ ${verb} — ${act.name}`, disabled ?? gxActSub(act), 'gx-run', 'gx-sheet', { disabled: !!disabled, scoped: need !== null && !short });
    }
    case 'matchup': {
      if (s.pregameWk) return navMain('PLAY', 'play-game');
      const sel = pregameSel(s);
      if (sel.kind === 'instr') {
        const it = instrById(sel.id);
        const cant = s.energy < it.cost;
        return navAction(`▶ INSTRUCT — ${it.name}`, cant ? `NEED ${it.cost}¢` : `they play −${it.oppAmt} · read: ${it.id === 'takeout' ? 'CAUGHT' : `you play −${it.selfAmt}`}${it.cost ? ` · ${it.cost}¢` : ''}`, 'speech-run', 'speech-sheet', { disabled: cant });
      }
      const pl = planById(sel.id);
      return navAction(`▶ SPEECH — ${pl.speech}`, speechSub(pl), 'speech-run', 'speech-sheet');
    }
    case 'gamenight': {
      if (!s.lastResult || gnStage === 'beat') return navMain('…', 'noop', true);
      if (gnStage === 'final') return navGo('THE RECAP', 'gn-recap');
      if (gnStage === 'recap') return navGo('THE BOX SCORE', 'gn-verdict');
      if (gnStage === 'verdict') {
        if (boxPass === 0) return navGo('⚡ & MOOD', 'gn-pass');
        return navGo('THE STANDINGS', 'gn-table');
      }
      return navGo('NEXT WEEK', 'continue-result');
    }
    case 'departures': {
      const unresolved = s.proDeparts.some((d) => !d.resolved);
      return unresolved ? navMain('YOUR STARS FIRST', 'to-signing', true) : navGo('SIGNING DAY', 'to-signing');
    }
    case 'signing':
      return navMain('SEND LETTERS', 'do-signing');
    case 'gameover':
      return navMain('NEW GAME', 'new-game-direct', false, false);
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
      // season zero: TEAM REST is the whole menu — the bonfire waits for a real season
      if (s.tutorial !== undefined && d.id !== 'rest') { hidden++; return ''; }
      // a method the building can't hold yet stays UNDISCOVERED — finding
      // out what a level buys is the fun, not the menu's job
      if (facLevel(s, 'gym') < (GYM_REQ[d.id] ?? 2)) { hidden++; return ''; }
      const cd = actCooldown(s, d.id);
      if (cd > 0) return `<div class="drill locked"><b>${d.name}</b> <span class="dim">— recharging, ${cd} week${cd === 1 ? '' : 's'}</span></div>`;
      return drillRow(d, 'button', selectedDrill === d.id ? 'sel' : '', `data-action="drill-pick" data-id="${d.id}"`);
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

// the board pickers: SCOUTING (read the board / search) and RECRUITING
// (your own work / the booster's), each its own sheet
function galaxySheetHtml(s: GameState): string {
  if (!galaxySheet) return '';
  const recruiting = galaxySheet === 'recruiting';
  const selId = recruiting ? selRecruit : selScout;
  let hidden = 0;
  const actRow = (a: (typeof GALAXY_ACTS)[number]): string => {
    if (a.kind === 'search' && !s.unlockedRegions.includes(a.id)) { hidden++; return ''; }
    // out of the campus's reach = UNDISCOVERED: no spoilers about what a
    // future level buys — finding out is the fun
    if (a.kind === 'search' && facLevel(s, 'ship') < (SHIP_REQ[a.id] ?? 3)) { hidden++; return ''; }
    if (a.kind === 'recruit' && facLevel(s, 'greekrow') < (ROW_REQ[a.id] ?? 0)) { hidden++; return ''; }
    const cd = actCooldown(s, a.id);
    if (cd > 0) return `<div class="drill locked"><b>${a.name}</b> <span class="dim">— recharging, ${cd} week${cd === 1 ? '' : 's'}</span></div>`;
    const grounded = s.groundedWeeks > 0 && a.kind === 'search' && !a.local;
    return galaxyRow(a, 'button', selId === a.id ? 'sel' : '', `data-action="gx-pick" data-id="${a.id}" ${grounded ? 'disabled' : ''}`, grounded);
  };
  const group = (label: string, acts: (typeof GALAXY_ACTS)[number][]): string => {
    const rows = acts.map(actRow).join('');
    return rows ? `<div class="sheethead">${label}</div>${rows}` : '';
  };
  const groups = recruiting
    ? group('WORK THEM YOURSELF — safe and slow', GALAXY_ACTS.filter((a) => a.kind === 'recruit' && a.via !== 'booster'))
      + group("THE BOOSTER'S HELP — big, deniable, radioactive", GALAXY_ACTS.filter((a) => a.via === 'booster'))
    : group('SCOUT — reveal the board', GALAXY_ACTS.filter((a) => a.kind === 'scout'))
      + group('SEARCH — new talent', GALAXY_ACTS.filter((a) => a.kind === 'search'));
  return `<div class="modalback sheet" data-action="gx-sheet-close"><div class="modal sheetup scrolly">
    <span class="tag">${recruiting ? 'THE CHARM OFFENSIVE' : 'THE SCOUTING RUN'}</span>
    ${groups}
    ${hidden ? `<div class="sheethint dim">▓ ${hidden} move${hidden === 1 ? '' : 's'} undiscovered</div>` : ''}
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
  // a search is a trip: the ride heads out first — the saucer for deep
  // space, the BUS for local runs (the rec center is a drive, not a
  // launch); the verdict scene lands when the report finishes typing
  const scene = gxResult.art
    ? `<div class="scenebox" id="gxscene">${sceneHtml(gxResult.art.startsWith('bus') ? 'bus-move' : 'saucer-move', { bg: t.bg, fg: t.fg }, 3)}</div>`
    : '';
  // its OWN ids: a board action can spawn a story (a cold recruit, a
  // scandal, a hull breach) that renders underneath at the same moment —
  // shared ids sent the verdict into the wrong box and left this one blank
  return `<div class="modalback gxback" data-action="gx-result-tap"><div class="modal gxmodal">
    <span class="tag">THE TRAIL</span>
    ${scene}
    <div class="typebox" id="gxtypebox"></div>
    <div class="modal-actions hide" id="gx-actions"><div class="taphint">▸ tap</div></div>
  </div></div>`;
}

function itemModalHtml(s: GameState): string {
  if (!itemUi) return '';
  const item = itemById(itemUi);
  const spent = item.rarity === 'legendary' && s.legendariesUsed.includes(item.id);
  const ev = currentStory(s);
  const storyKey = ev?.choices?.find((c) => c.itemId === item.id && !ev.resolvedText)?.key ?? null;
  const phaseOk = !ev && itemAllowedNow(s, item.id);
  const needsDrag = item.target !== 'team' && storyKey === null && phaseOk;
  const usable = !spent && !needsDrag && (storyKey !== null || phaseOk);
  const who = item.target === 'player'
    ? '● ONE PLAYER — drag it onto their card'
    : item.target === 'prospect'
      ? '● ONE RECRUIT — drag it onto their card on the big board'
      : '●●● THE WHOLE SQUAD — drag it anywhere, or USE NOW';
  return `<div class="modalback" data-action="item-close"><div class="modal">
    <div class="itemcard ${item.rarity}">
      <b>◆ ${esc(item.name)}</b> <span class="dim">${item.rarity}${item.rarity === 'legendary' ? ' · once/season' : ''}</span><br/>
      <i class="dim">${esc(item.flavor)}</i><br/>
      ${esc(item.effectText)}<br/>${oddsLine(item.up, item.down)}<br/>
      <span class="itemwho t-${item.target}">${who}</span>
    </div>
    <button class="wide hold" data-action="use-item" data-id="${item.id}" ${usable ? '' : 'disabled'}>
      ${spent ? 'USED THIS SEASON' : storyKey ? '◆ USE IT ON THIS STORY' : needsDrag ? (item.target === 'prospect' ? '↷ DRAG IT ONTO A RECRUIT' : '↷ DRAG IT ONTO A PLAYER') : usable ? 'USE NOW' : 'NOT THE MOMENT'}</button>
    <button class="wide" data-action="item-close">CLOSE</button>
  </div></div>`;
}

function coachModalHtml(s: GameState): string {
  if (!coachOpen) return '';
  // THE CODEX: everything ever learned, across every career — categorized by
  // the leg of the week it belongs to. ✓ known this run · ◈ remembered (comes
  // back via story or facility) · ▓ never discovered.
  const cdx = loadCodex();
  const row = (known: boolean, remembered: boolean, label: string): string =>
    known
      ? `<div>✓ ${label}</div>`
      : remembered
        ? `<div class="dim">◈ ${label} — remembered</div>`
        : '<div class="dim">▓▓▓ undiscovered</div>';
  const matchup = PLANS.map((pl) =>
    row(s.knownPlans.includes(pl.id), cdx.plans.includes(pl.id), `${pl.name} <span class="dim">(${ATTR_LABEL[pl.attr]})</span>`)
  ).join('') + INSTRUCTIONS.map((it) =>
    row((s.knownInstr ?? []).includes(it.id), cdx.instrs.includes(it.id), `${it.name} <span class="dim">(instruction)</span>`)
  ).join('');
  const practice = DRILLS.map((d) => row(s.unlockedDrills.includes(d.id), cdx.drills.includes(d.id), d.name)).join('');
  const scouting = GALAXY_ACTS.filter((a) => a.kind === 'search').map((a) => row(s.unlockedRegions.includes(a.id), cdx.regions.includes(a.id), a.name)).join('');
  const codexCount = cdx.plans.length + cdx.drills.length + cdx.instrs.length + cdx.regions.length;
  return `<div class="modalback"><div class="modal scrolly">
    <span class="tag">THE COACH</span>
    <div class="report">LEGACY <b style="color:${vc(clamp(s.legacy, 0, 100))}">${s.legacy}</b>
      · ${s.trophies}🏆 · ${s.utTitles}× ${TOURNEY.short} · ${s.totalWins}W · season ${s.season}${s.season >= 20 ? ' <span class="blink">— you feel the years</span>' : ''}</div>
    <div class="report"><b>THE CODEX</b> <span class="dim">· ${codexCount} entr${codexCount === 1 ? 'y' : 'ies'} carried across careers</span>
      <div class="acthead">MATCHUP</div>${matchup}
      <div class="acthead">PRACTICE</div>${practice}
      <div class="acthead">SCOUTING</div>${scouting}
    </div>
    <p class="dim">GALACTIC COACH ${VERSION} · build ${typeof __BUILD_ID__ === 'undefined' ? 'dev' : __BUILD_ID__}</p>
    <button class="wide danger hold" data-action="new-game">NEW GAME (wipes this save — the codex survives)</button>
    <button class="wide" data-action="coach-close">CLOSE</button>
  </div></div>`;
}

/** The calendar page flips: WEEK n dims and drops, WEEK n+1 lands bright. */
function weekTurnHtml(): string {
  if (!weekTurn) return '';
  const wk = (n: number): string => (n <= REGULAR_WEEKS ? `WEEK ${n}` : `WEEK ${REGULAR_WEEKS}+${n - REGULAR_WEEKS}`);
  return `<div class="weekturn" data-action="week-turn-close">
    <div class="wtseason ${weekTurn.seasonOnly ? 'wtbig' : ''}">SEASON ${Math.max(1, weekTurn.season)}</div>
    ${weekTurn.seasonOnly ? '' : `<div class="wtrow"><span class="wtfrom">${wk(weekTurn.from)}</span><span class="wtarrow">▸</span><span class="wtto">${wk(weekTurn.to)}</span></div>`}
    <div class="wthint">▸ TAP</div>
  </div>`;
}

function toastModalHtml(): string {
  if (!toast) return '';
  return `<div class="modalback"><div class="modal" data-action="toast-tap">
    <span class="tag">OUTCOME</span>
    <div class="typebox" id="toastbox"></div>
    <div class="modal-actions hide" id="toast-actions"><div class="taphint">▸ tap to continue</div></div>
  </div></div>`;
}

// ---- THE WALK: the assistant's floating spotlight over the live screen ------
// One step at a time: a small box (never a full-screen dialog), one thing
// lit, everything else stepped back. Tap advances — or the step waits for
// the actual deed (a lens tap, a notebook note, an item landing).

function tutWalkStep(): TutStep | null {
  const w = state.tutWalk;
  if (!w) return null;
  const steps = (w.steps as TutStep[] | undefined) ?? tutorialWalkSteps(state, w.key);
  return steps[w.ix] ?? null;
}

function tutMaybeWalk(): void {
  if (state.tutorial === undefined || state.tutWalk) return;
  if (currentStory(state) || toast || gxResult) return;
  const key = tutorialWalkStart(state, gnStage);
  if (!key) return;
  // every screen opens on ONE full-screen assistant line — then the walk
  const introText = tutorialIntro(state, key);
  if (introText && !(state.tutSeen ?? []).includes(`intro:${key}`)) {
    (state.tutSeen ??= []).push(`intro:${key}`);
    queueStory(state, 'tut_intro', 'start', null, { key, text: introText });
    save(state);
    return;
  }
  const steps = tutorialWalkSteps(state, key);
  if (!steps.length) {
    (state.tutSeen ??= []).push(key);
    save(state);
    return;
  }
  // the steps freeze at walk start: names and spotlights stay stable even
  // as the state underneath changes mid-walk
  state.tutWalk = { key, ix: 0, steps };
  save(state);
}

function tutWalkFinish(key: string): void {
  // a skipped walk still reveals everything its steps would have (marks)
  for (const st of (state.tutWalk?.steps as TutStep[] | undefined) ?? []) {
    if (st.mark && !(state.tutSeen ?? []).includes(st.mark)) (state.tutSeen ??= []).push(st.mark);
  }
  delete state.tutWalk;
  (state.tutSeen ??= []).push(key);
  for (const r of tutorialWalkDone(state, key)) queueStory(state, r.defId, r.beat, r.playerId, r.data ?? {});
  save(state);
}

/** the walk box's typewriter state (a tap first finishes the line) */
let walkTypeKey = '';
let walkTypeDone = false;

/** What may be DRAGGED during season zero: exactly the scripted thing. */
function tutAllowsDrag(kind: 'card' | 'item' | 'pr', itemId: string): boolean {
  if (state.tutorial === undefined) return true;
  const step = state.tutWalk?.steps?.[state.tutWalk.ix];
  if (kind === 'item') return !!step && (step.advance ?? '') === `item:${itemId}`;
  if (kind === 'pr') return state.phase === 'scouting';
  if (state.phase === 'practice') return true;
  if (state.phase === 'matchup') return !state.pregameWk && !step;
  if (state.phase === 'teamSelect') return true;
  return false;
}

/** Advance on a matching signal ('tap', 'lens:1', 'note', 'item:patch'…). */
function tutWalkAdvance(sig: string): void {
  const w = state.tutWalk;
  if (!w || currentStory(state)) return;
  const steps = (w.steps as TutStep[] | undefined) ?? tutorialWalkSteps(state, w.key);
  const step = steps[w.ix];
  if (!step) { tutWalkFinish(w.key); return; }
  if ((step.advance ?? 'tap') !== sig) return;
  w.ix++;
  // the NEW step's mark lands the moment it takes the floor — the render
  // reads these to reveal hidden pieces (the team bars, the tactics board)
  const mk = steps[w.ix]?.mark;
  if (mk && !(state.tutSeen ?? []).includes(mk)) (state.tutSeen ??= []).push(mk);
  if (w.ix >= steps.length) tutWalkFinish(w.key);
  else save(state);
}

/** The spotlight: the step's target lights up STEADILY (blinking is for
    sub-elements — a gauge, an OVR, a lens tab), and everything the step is
    not about steps back: dimmed, and dead to the touch. */
function applyWalkSpotlight(): void {
  const wStep = tutWalkStep();
  if (!wStep?.hi || currentStory(state) || toast || gxResult) return;
  const hi = wStep.hi;
  const targets: Element[] = [];
  const collect = (sel: string): void => document.querySelectorAll(sel).forEach((el) => targets.push(el));
  const idsOf = (str: string): Set<number> => new Set(str.split(',').map(Number));
  const spotCards = (ids: Set<number>, sub?: 'ge' | 'gm' | 'ovr'): void => {
    document.querySelectorAll('.middle .pcard').forEach((el) => {
      const pid = Number(el.getAttribute('data-pid'));
      if (!ids.has(pid)) { el.classList.add('scopedim'); return; }
      targets.push(el);
      if (sub === 'ge') el.querySelectorAll('.gauge.gl').forEach((g) => g.classList.add('tutblink'));
      if (sub === 'gm') el.querySelectorAll('.gauge.gr').forEach((g) => g.classList.add('tutblink'));
      if (sub === 'ovr') el.querySelectorAll('.kbl').forEach((g) => g.classList.add('tutblink'));
    });
  };
  if (hi === 'grid' || hi === 'board') collect('.grid');
  else if (hi === 'rows') {
    // every row wears the frame: the rows ARE the lesson
    document.querySelectorAll('.grid .gridrow').forEach((el) => { el.classList.add('rowspot'); targets.push(el); });
  } else if (hi.startsWith('row:')) {
    const n = Number(hi.slice(4));
    document.querySelectorAll('.grid .gridrow').forEach((el, i) => {
      if (i === n) { el.classList.add('rowspot'); targets.push(el); }
      else el.classList.add('scopedim');
    });
  } else if (hi.startsWith('p:') || hi.startsWith('pr:')) spotCards(new Set([Number(hi.split(':')[1])]));
  else if (hi.startsWith('ids:')) spotCards(idsOf(hi.slice(4)));
  else if (hi.startsWith('ge:')) spotCards(idsOf(hi.slice(3)), 'ge');
  else if (hi.startsWith('gm:')) spotCards(idsOf(hi.slice(3)), 'gm');
  else if (hi.startsWith('ovr:')) spotCards(new Set([Number(hi.slice(4))]), 'ovr');
  else if (hi.startsWith('lens:')) {
    const n = Number(hi.slice(5));
    document.querySelectorAll('.lensbar .lenstab').forEach((el, i) => {
      if (i === n) { el.classList.add('tutblink'); targets.push(el); }
    });
  } else if (hi === 'nav') collect('.navbar .navmain');
  else if (hi === 'tac') collect('.tacboard');
  else if (hi === 'bars') { collect('.mu-bars'); collect('.middle .botstack .tbars'); }
  else if (hi === 'fac') collect('.facwrap');
  else if (hi === 'notebook') collect('.bslot.notebook');
  else if (hi === 'jobbar') collect('.jobbar');
  else if (hi === 'patch' || hi === 'check' || hi === 'timeloop') {
    collect(`.bslot[data-bagitem="${hi}"]`);
    const ids = new Set<number>();
    if (hi === 'patch') { const p = tutStandout(state); if (p) ids.add(p.id); }
    if (hi === 'check') { const g = tutGem(state); if (g) ids.add(g.pr.id); }
    if (hi === 'timeloop') { const st = tutStar(state); if (st) ids.add(st.id); }
    if (ids.size) spotCards(ids);
  }
  // big areas skip the outline (the fade around them IS the pointer);
  // small things wear a steady glow
  const bigArea = ['grid', 'board', 'fac', 'bars', 'tac'].includes(hi);
  if (!bigArea) for (const el of targets) if (!el.classList.contains('rowspot')) el.classList.add('tutspot');
  // everything else steps back — the middle's other children, and whichever
  // chrome bars hold no target (yes, even the header: nothing up there
  // matters while the assistant is pointing at something else)
  const holds = (root: Element | null): boolean => !!root && targets.some((el) => root.contains(el));
  document.querySelectorAll('.middle > *').forEach((el) => { if (!holds(el)) el.classList.add('tutfade'); });
  for (const sel of ['.topbar', '.lensbar', '.navbar', '.bagbar']) {
    const el = document.querySelector(sel);
    if (el && !holds(el)) el.classList.add('tutfade');
  }
}

/** THE LOCK's visual half: every off-script button dims (the click gate is
    the functional half — tutorialAllows). */
function applyTutLock(): void {
  if (state.tutorial === undefined || currentStory(state)) return;
  document.querySelectorAll('.topbar [data-action], .lensbar [data-action], .navbar [data-action], .middle [data-action], .bagbar [data-action]').forEach((el) => {
    const a = el.getAttribute('data-action') ?? '';
    if (!tutorialAllows(state, a, el.getAttribute('data-id') ?? '')) el.classList.add('tutoff');
  });
}

// ---- render ------------------------------------------------------------------------------------------------

function render(): void {
  if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
  stopType();
  setRamp();
  if (titleOpen) {
    app.className = '';
    app.innerHTML = titleScreenHtml();
    return;
  }

  // a fresh week: pickers fall back to the FREE option (spending ⚡ takes a
  // deliberate trip into the menu) and old sticker batches are forgotten
  const wk = `${state.season}:${state.week}`;
  if (wk !== uiWeekKey) {
    uiWeekKey = wk;
    selectedDrill = 'rest';
    selFac = 'mop';
    selScout = 'reccenter';
    selRecruit = 'groupchat';
    selPregame = null;
    gxSel.clear();
    gxFound.clear();
    boxPass = 0;
    stickerBatches.clear();
  }

  // THE WALK: when the stage is quiet, the assistant may take the floor
  tutMaybeWalk();

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
    opShift = null;
    jobAnimDone = false;
    chosenWant = null;
    wheelDone = false;
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
      case 'facilities': middle = stageFacilities(state); break;
      case 'practice': middle = stagePractice(state); break;
      case 'scouting': middle = stageBoard(state); break;
      case 'recruiting': middle = stageBoard(state); break;
      case 'matchup': middle = stageMatchup(state); break;
      case 'gamenight': middle = stageGamenight(state); break;
      case 'departures': middle = stageDepartures(state); break;
      case 'signing': middle = stageSigning(state); break;
      default: middle = `<h2>THIS WEEK</h2>`;
    }
  }

  // popups live INSIDE the middle: the stats bar, THE BAG and the nav stay
  // visible (⚡ readable while a story asks you to spend it) — the nav just dims.
  const overlays = drillSheetHtml(state) + facSheetHtml(state) + galaxySheetHtml(state) + speechSheetHtml(state) + gxResultHtml(state) + cutConfirmHtml(state) + boardConfirmHtml(state) + toastModalHtml() + itemModalHtml(state) + coachModalHtml(state) + schedModalHtml(state) + standModalHtml(state) + notebookModalHtml(state) + jobModalHtml(state);
  const modalOpen = drillSheet || facSheet || speechSheet || coachOpen || itemUi !== null || toast !== null || galaxySheet || gxResult !== null || cutConfirm || boardConfirm || schedOpen || standOpen || notebookOpen || jobOpen;
  const navHtml = `<div class="navbar ${modalOpen ? 'dimmed' : ''}">${nav(state)}</div>`;
  // the bottom stack, thumb-first: the ONE BIG BUTTON sits on top (the most
  // comfortable reach), the view tabs under it, THE BAG's two rows at the
  // very bottom of the screen
  const prospectScreen = state.phase === 'scouting' || state.phase === 'recruiting' || state.phase === 'signing';
  const gridScreen = ['weekstart', 'scouting', 'practice', 'recruiting', 'matchup', 'teamSelect', 'signing'].includes(state.phase)
    || (state.phase === 'gamenight' && gnStage === 'verdict');
  const lensHtml = gridScreen && !ev
    ? lensBar(prospectScreen ? PROSPECT_LENS_NAMES : LENS_NAMES)
    : '';
  // the bottom stack, rearranged (Aug 29): view tabs FIRST, then the one
  // big action/continue button, then THE BAG — the tabs change what you
  // see, the button moves you on, in that reading order
  // THE TUTORIAL's cue: the assistant's one line above the nav — where to
  // press next, never a lecture (it yields while a story holds the floor)
  const tutTxt = tutorialHint(state, gnStage);
  const hintHtml = tutTxt && !ev && !modalOpen ? `<div class="tuthint"><b>ASSISTANT</b>${esc(tutTxt)}</div>` : '';
  // THE WALK's box floats OVER the screen (never pushing the layout around)
  const wStep = !ev && !toast && !gxResult ? tutWalkStep() : null;
  const walkTap = wStep && (wStep.advance ?? 'tap') === 'tap';
  const walkHtml = wStep
    ? `<div class="tutwalk ${wStep.pos ?? 'bot'}" ${walkTap ? 'data-action="tut-walk-tap"' : ''}>
        <b>${esc(wStep.who ?? 'ASSISTANT COACH')}</b><span id="tutwalktext"></span>${walkTap ? '<i class="wtap">▸ tap</i>' : ''}
      </div>`
    : '';
  const frame = (state.phase === 'pickTeam' || state.phase === 'gameover'
    ? `<div class="midwrap"><div class="middle solo">${middle}</div>${overlays}</div>${navHtml}`
    : `${headerHtml(state)}<div class="midwrap"><div class="middle">${middle}</div>${walkHtml || hintHtml}${overlays}</div>${lensHtml}${navHtml}${bagBar(state)}`)
    + weekTurnHtml();

  // THE ANIMATION BUILD: a screen CHANGE builds in stages — title first (you
  // know where you are), content next, the action button last (you know where
  // to go). Re-renders of the same screen appear instantly, nothing dances.
  app.className = doBuild ? 'build' : '';

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

/** Re-apply the PRE snapshot to freshly rendered bars (no animation): while
    an overlay holds the floor the post-change numbers must never show early
    — the count-forward plays once the overlay closes. */
function applyPreBars(): void {
  const pre = barsPre;
  if (!pre) return;
  const rows = [...document.querySelectorAll('.tbars .tbar')] as HTMLElement[];
  rows.forEach((row, i) => {
    const p = pre[i];
    if (!p) return;
    const vEls = [...row.querySelectorAll('.tbv')] as HTMLElement[];
    const fEls = [...row.querySelectorAll('.tbfill, .tbopp')] as HTMLElement[];
    const preFills = p.fills[0] ?? [];
    if (vEls.length !== p.vals.length || fEls.length !== preFills.length) return;
    vEls.forEach((el, j) => { el.textContent = p.vals[j]; });
    fEls.forEach((el, j) => { el.style.transition = 'none'; el.style.width = preFills[j]; });
  });
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
  applyWalkSpotlight();
  applyTutLock();
  // the walk box TYPES its line — attention lands where the words appear
  const wsStep = tutWalkStep();
  if (wsStep && !currentStory(state) && !toast && !gxResult) {
    const wEl = document.getElementById('tutwalktext');
    if (wEl && state.tutWalk) {
      const k = `${state.tutWalk.key}:${state.tutWalk.ix}`;
      if (k !== walkTypeKey) { walkTypeKey = k; walkTypeDone = false; }
      if (walkTypeDone) wEl.textContent = wsStep.text;
      else typewrite(wEl, wsStep.text, () => { walkTypeDone = true; });
    }
  }
  if (gxResult && !gxResult.played) {
    gxResult.played = true;
    const r = gxResult;
    floatEnergyBig(r.cost);
    const box0 = document.getElementById('gxtypebox');
    floatTimers.push(window.setTimeout(() => {
      if (gxResult === r) typewrite(box0 as HTMLElement | null, r.text, () => {
        document.getElementById('gx-actions')?.classList.remove('hide');
        // the ride parks at the HOOP only on a find; trouble stays airborne —
        // the story that follows does the reveal
        if (r.art === 'saucer-hoop' || r.art === 'bus-hoop') {
          const el = document.getElementById('gxscene');
          const t = myTeam(state);
          if (el) el.innerHTML = sceneHtml(r.art as SceneId, { bg: t.bg, fg: t.fg }, 3);
        }
      });
    }, 220)); // the −1¢ blasts fly alongside — the card never sits empty
    return;
  }
  // a cascade is ARMED but an overlay still has the floor: hold the bars at
  // their PRE values so the change never flashes early behind the dialog —
  // no more numbers jumping backward when the toast closes
  if (cascArmed && barsPre && (toast !== null || currentStory(state) !== null)) applyPreBars();

  const ev = currentStory(state);
  const box = document.getElementById('typebox');
  // the toast types into its OWN box — with a story underneath, a shared id
  // would feed the outcome to the story's page and leave the toast empty
  const tbox = document.getElementById('toastbox');
  if (tbox && toast !== null) {
    if (toast !== toastShown) { toastShown = toast; toastBeat = 0; }
    const beats = splitBeats(toast);
    typewrite(tbox, beats[Math.min(toastBeat, beats.length - 1)] ?? toast, () => { document.getElementById('toast-actions')?.classList.remove('hide'); });
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
    if (storyMode === 'impact' && impactPage()?.kind === 'coach' && opShift && opShift.sec !== 0 && !jobAnimDone) {
      jobAnimDone = true;
      const rr = document.querySelector('.jobbar .jdark.r') as HTMLElement | null;
      if (rr) {
        const now = security(state);
        rr.style.transition = 'none';
        rr.style.width = `${clamp(100 - (now - opShift.sec), 0, 100)}%`;
        void rr.offsetWidth; // reflow so the transition sees the old width
        impactTimers.push(window.setTimeout(() => {
          rr.style.transition = 'width 1.1s ease';
          rr.style.width = `${100 - now}%`;
        }, 500));
      }
    }
  }

  if (state.phase === 'gamenight' && !state.queue.length) {
    const r = state.lastResult;
    if (gnStage === 'beat' && r) {
      // the OVERALL rope GROWS into the game dial, then the whole game runs
      // to the horn — the screen itself then turns into YOU WON / YOU LOST
      const flipped = flipRope();
      const go = (): void => {
        animateLiveGame(r.myScore, r.oppScore, r.share, r.home, () => { gnStage = 'final'; render(); });
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

function animateLiveGame(myPts: number, oppPts: number, _share: number, home: boolean, onDone: () => void): void {
  const lgl = document.getElementById('lgl');
  const lgr = document.getElementById('lgr');
  const lgsep = document.getElementById('lgsep');
  const score = document.getElementById('livescore');
  const lsl = document.getElementById('lsl');
  const lsr = document.getElementById('lsr');
  if (!lgl || !lgr || !lgsep || !score || !lsl || !lsr) { onDone(); return; }
  const leftFinal = home ? oppPts : myPts;
  const rightFinal = home ? myPts : oppPts;
  const total = Math.max(1, leftFinal + rightFinal);
  // the clock is the points: the light grows from the center as they fall,
  // and the line inside it is who leads and by how much
  const wkKey = `${state.season}:${state.week}`;
  let l = liveProg && liveProg.key === wkKey ? liveProg.l : 0;
  let r = liveProg && liveProg.key === wkKey ? liveProg.r : 0;
  let done = false;
  // M5 COURT CARDS — the scoring script: what's left of each box line at
  // this point of the clock; my side's bumps pop names out of this bag
  const bag = new Map<number, number>();
  for (const b of state.lastResult?.box ?? []) bag.set(b.playerId, Math.max(0, Math.round(b.pts * (1 - (l + r) / total))));
  const bandOf = (frac: number): number => (frac < 0.4 ? 0 : frac < 0.75 ? 1 : 2);
  let band = bandOf((l + r) / total);
  const courtSwap = (): void => {
    const frac = (l + r) / total;
    if (bandOf(frac) === band) return;
    band = bandOf(frac);
    const court = document.getElementById('court');
    if (!court) return;
    const prev = new Set([...court.querySelectorAll('.ccard')].map((el) => Number(el.getAttribute('data-cpid'))));
    const nextHtml = courtHtml(state, frac, prev);
    // whoever leaves the floor visibly walks off first, THEN the swap lands
    const staying = new Set(courtFloor(myTeam(state), state.lastResult?.box ?? [], frac).map((p) => p.id));
    let leaving = 0;
    court.querySelectorAll('.ccard').forEach((el) => {
      if (!staying.has(Number(el.getAttribute('data-cpid')))) { el.classList.add('leave'); leaving++; }
    });
    const myBand = band;
    if (leaving) window.setTimeout(() => { if (band === myBand && document.getElementById('court') === court) court.innerHTML = nextHtml; }, 260);
    else court.innerHTML = nextHtml;
  };
  const flashCourt = (amt: number): void => {
    const cards = [...document.querySelectorAll('#court .ccard')] as HTMLElement[];
    if (!cards.length) return;
    const ids = cards.map((el) => Number(el.getAttribute('data-cpid')));
    const pool = ids.filter((id) => (bag.get(id) ?? 0) > 0);
    let pick = ids[Math.floor(Math.random() * ids.length)];
    if (pool.length) {
      let roll = Math.random() * pool.reduce((a, id) => a + (bag.get(id) ?? 0), 0);
      for (const id of pool) { roll -= bag.get(id) ?? 0; if (roll <= 0) { pick = id; break; } }
    }
    bag.set(pick, Math.max(0, (bag.get(pick) ?? 0) - amt));
    const card = cards[ids.indexOf(pick)];
    card.classList.remove('pop');
    void card.offsetWidth; // restart the flash
    card.classList.add('pop');
    window.setTimeout(() => card.classList.remove('pop'), 640);
    // the points fly as a BALL: from the scorer's hands into the score gauge
    const stage = document.getElementById('needle-stage');
    const scoreEl = document.getElementById('livescore');
    if (stage && scoreEl) {
      const cr = card.getBoundingClientRect();
      const sr = scoreEl.getBoundingClientRect();
      const ball = document.createElement('span');
      ball.className = 'cball';
      ball.style.left = `${cr.left + cr.width / 2}px`;
      ball.style.top = `${cr.top + 8}px`;
      stage.appendChild(ball);
      requestAnimationFrame(() => {
        ball.style.left = `${sr.left + sr.width / 2}px`;
        ball.style.top = `${sr.top + sr.height / 2}px`;
        ball.classList.add('fly');
      });
      window.setTimeout(() => ball.remove(), 520);
    }
  };
  // THE INTERRUPTIONS: at the half the night's stories get the floor; the
  // game resumes from this exact frame once the coach has answered
  const pause = (): void => {
    if (done) return;
    done = true;
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    liveProg = { key: wkKey, l, r };
    releaseMidStories(state);
    render();
  };
  const apply = (): void => {
    const f = liveFrame(l, r, (l + r) / total);
    lgl.style.left = `${f.lo}%`;
    lgl.style.width = `${f.sep - f.lo}%`;
    lgr.style.left = `${f.sep}%`;
    lgr.style.width = `${f.hi - f.sep}%`;
    lgsep.style.left = `${f.sep}%`;
    score.style.left = `${f.sep}%`;
    lsl.textContent = String(l);
    lsr.textContent = String(r);
  };
  apply();
  const finish = (skip = false): void => {
    if (done) return;
    if (state.midStories?.length) {
      // skipping into the interruptions: jump to the half and let them speak
      const half = Math.round(total * 0.55);
      while (l + r < half) { if (Math.random() * (leftFinal + rightFinal - l - r) < leftFinal - l && l < leftFinal) l++; else if (r < rightFinal) r++; else l++; }
      apply();
      pause();
      return;
    }
    done = true;
    if (progressTimer !== null) { clearInterval(progressTimer); progressTimer = null; }
    liveProg = null;
    l = leftFinal;
    r = rightFinal;
    apply();
    courtSwap(); // the horn: starters close it out
    lgsep.classList.add('landed');
    if (skip) onDone();
    else window.setTimeout(onDone, 850);
  };
  progressTimer = window.setInterval(() => {
    const remL = leftFinal - l;
    const remR = rightFinal - r;
    if (state.midStories?.length && l + r >= total * 0.55) { pause(); return; }
    if (remL <= 0 && remR <= 0) { finish(); return; }
    // whoever has more scoring left is likelier to score next
    const left = Math.random() * (remL + remR) < remL;
    const amt = Math.min(1 + rand(3), left ? remL : remR);
    if (left) l += amt; else r += amt;
    apply();
    courtSwap();
    if (left === !home) flashCourt(amt); // my bump: the box score names him
  }, 170);
  document.getElementById('needle-stage')?.addEventListener('click', () => finish(true));
}

// ---- hold-to-commit -----------------------------------------------------------------------------------------

let holdEl: HTMLElement | null = null;
let holdTimer = 0;

function startHold(el: HTMLElement): void {
  // THE LOCK reaches the hold buttons too
  if (!currentStory(state) && !tutorialAllows(state, el.getAttribute('data-action') ?? '', el.getAttribute('data-id') ?? '')) return;
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
  }, 600);
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
  return ['practice', 'matchup', 'gamenight', 'teamSelect', 'scouting', 'recruiting'].includes(state.phase) && !currentStory(state);
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
  // season zero's lineup lesson: the freshman lands on the floor
  if (zoneIdx < 6) tutWalkAdvance(`floor:${playerId}`);
}

/** The recruiting board swap: prospect between the board and the 4th row. */
function handleProspectDrop(zoneIdx: number, prospectId: number): void {
  const boardIdx = state.prospects.findIndex((x) => x.id === prospectId);
  const pendIdx = state.pendingRecruits.findIndex((x) => x.id === prospectId);
  const from = boardIdx >= 0 ? boardIdx : pendIdx >= 0 ? 9 + pendIdx : -1;
  if (from < 0 || from === zoneIdx) return;
  swapBoardSlot(state, from, zoneIdx);
  // season zero's board lesson: the gem lands ON the board
  if (state.tutorial !== undefined && tutGem(state)?.where === 'board') tutWalkAdvance('swap:gem');
}

function dropItemOnStory(itemId: string): void {
  const ev = currentStory(state);
  const key = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
  if (!key) return;
  doResolve(key);
}

/** A player item dragged onto a card: the individual action lands there —
    and shows there (the anchored stickers). */
function dropItemOnPlayer(itemId: string, playerId: number): void {
  // season zero scripts the machine: it goes on the star — and it MISFIRES,
  // exactly the way the story needs it to
  if (state.tutorial !== undefined && itemId === 'timeloop') {
    const st = tutStar(state);
    if (!st || playerId !== st.id) {
      toast = `◆ TIME MACHINE: point it at the suspension, coach${st ? ` — ${st.name}` : ''}.`;
      return;
    }
    const ix = state.bag.indexOf('timeloop');
    if (ix >= 0) state.bag.splice(ix, 1);
    tutWalkAdvance('item:timeloop');
    queueStory(state, 'tut_haywire3', 'start', st.id);
    save(state);
    return;
  }
  // season zero teaches the drop: the patch goes on the hurt one, nobody else
  if (state.tutorial !== undefined && itemId === 'patch') {
    const hurtT = tutStandout(state);
    if (!hurtT || playerId !== hurtT.id) {
      toast = `◆ PATCH KIT: not there, coach${hurtT ? ` — ${hurtT.name} is the one who needs it` : ''}.`;
      return;
    }
  }
  const pre = snapCards();
  const text = useItem(state, itemId, { playerId });
  if (!text) return;
  if (itemId === 'patch') tutWalkAdvance('item:patch');
  const map = diffCards(pre);
  if (map.size) cardDeltas = { key: `item:${itemId}:${Date.now()}`, map };
  const said = describeDeltas(map);
  toast = said ? `${text}\n\n${said}` : text;
}

/** A recruit item dragged onto a big-board card. */
function dropItemOnProspect(itemId: string, prospectId: number): void {
  // season zero teaches the drop: the check goes on the rec-center kid
  if (state.tutorial !== undefined && itemId === 'check') {
    const g = tutGem(state);
    if (g && prospectId !== g.pr.id) {
      toast = `◆ BLANK CHECK: the fans want the rec-center kid — ${g.pr.name}.`;
      return;
    }
  }
  const text = useItem(state, itemId, { prospectId });
  if (text) toast = text;
  if (itemId === 'check') tutWalkAdvance('item:check');
  gxStickers = null;
}

/** A before-picture of every card, for the change language after an action. */
type CardSnap = Map<number, { e: number; m: number; xp: number; lvl: number; ovr: number; attrs: AttrRec; need: number }>;
function snapCards(): CardSnap {
  return new Map(myTeam(state).players.map((p) => [p.id, {
    e: p.energy, m: p.mood, xp: p.xp, lvl: p.level, ovr: ovr(p.attrs), attrs: copyAttrs(p.attrs),
    need: p.level >= LEVEL_CAP ? 0 : xpNeed(p.level),
  }]));
}

/** Diff the squad against a snapshot into per-card deltas (stickers). */
function diffCards(pre: CardSnap): Map<number, CardDelta> {
  const map = new Map<number, CardDelta>();
  for (const p of myTeam(state).players) {
    const b = pre.get(p.id);
    if (!b) continue;
    const rec: CardDelta = {};
    if (p.energy !== b.e) rec.e = p.energy - b.e;
    if (p.mood !== b.m) rec.m = p.mood - b.m;
    if (p.level !== b.lvl) { rec.lvlFrom = b.lvl; rec.xp = b.need; }
    else if (p.xp !== b.xp && b.need > 0) { rec.xpFromPct = Math.min(100, Math.round((b.xp / b.need) * 100)); rec.xp = p.xp - b.xp; }
    const gains = ATTRS.filter((a) => p.attrs[a] !== b.attrs[a]).map((a) => `${p.attrs[a] > b.attrs[a] ? '+' : ''}${p.attrs[a] - b.attrs[a]} ${ATTR_SHORT[a]}`);
    if (gains.length) rec.gain = gains.join(' ');
    if (ovr(p.attrs) !== b.ovr) rec.ovrFrom = b.ovr;
    if (Object.keys(rec).length) map.set(p.id, rec);
  }
  return map;
}

/** The deltas in words, for the dialogue's verdict beat: one line when the
    whole squad moved the same way, names when it didn't. */
function describeDeltas(map: Map<number, CardDelta>): string {
  if (!map.size) return '';
  const t = myTeam(state);
  const recs = [...map.values()];
  const same = (k: 'e' | 'm' | 'xp'): number | null => {
    const vals = recs.map((r) => r[k] ?? 0);
    return vals.length >= 3 && vals.every((v) => v === vals[0] && v !== 0) ? vals[0] : null;
  };
  const sign = (n: number): string => `${n > 0 ? '+' : ''}${n}`;
  const e = same('e'), m = same('m'), x = same('xp');
  if ((e !== null || m !== null || x !== null) && recs.every((r) => !r.gain && r.lvlFrom === undefined)) {
    const bits = [e !== null ? `⚡ ${sign(e)}` : '', m !== null ? `MOOD ${sign(m)}` : '', x !== null ? `${sign(x)} XP` : ''].filter(Boolean);
    return `THE SQUAD: ${bits.join(' · ')}.`;
  }
  const lines = [...map.entries()].slice(0, 5).map(([id, r]) => {
    const name = t.players.find((p) => p.id === id)?.name ?? 'someone';
    const bits = [r.e ? `⚡ ${sign(r.e)}` : '', r.m ? `MOOD ${sign(r.m)}` : '', r.xp ? `${sign(r.xp)} XP` : '', r.gain ?? '', r.lvlFrom !== undefined ? 'LEVEL UP' : ''].filter(Boolean);
    return `${name}: ${bits.join(' · ')}`;
  });
  return `${lines.join(' · ')}${map.size > 5 ? ' · …' : ''}.`;
}

/** A squad item dropped anywhere on the stage: it happens to everyone — and
    everyone's card SAYS so (stickers), as does the verdict beat (words). */
function dropItemOnTeam(itemId: string): void {
  const pre = snapCards();
  const text = useItem(state, itemId, {});
  if (!text) return;
  const map = diffCards(pre);
  if (map.size) cardDeltas = { key: `item:${itemId}:${Date.now()}`, map };
  const said = describeDeltas(map);
  toast = said ? `${text}\n\n${said}` : text;
}

/** SEASON ZERO's scripted item target (null = anyone may catch it). */
function tutItemTargetId(itemId: string): number | null {
  if (state.tutorial === undefined) return null;
  if (itemId === 'timeloop') return tutStar(state)?.id ?? null;
  if (itemId === 'patch') return tutStandout(state)?.id ?? null;
  if (itemId === 'check') return tutGem(state)?.pr.id ?? null;
  return null;
}

function clearDropGlow(): void {
  document.querySelectorAll('.droptarget').forEach((el) => el.classList.remove('droptarget'));
  document.querySelector('.middle.teamglow')?.classList.remove('teamglow');
}

function activateDrag(): void {
  if (!ptr || ptr.active) return;
  ptr.active = true;
  const rect = ptr.el.getBoundingClientRect();
  let ghost: HTMLElement;
  if (ptr.kind === 'item') {
    // the ghost IS the item — built fresh, never a cloned slot
    const it = itemById(ptr.itemId);
    ghost = document.createElement('div');
    ghost.className = 'dragghost itemghost';
    ghost.innerHTML = `◆<span class="gname">${esc(it.short)}</span>`;
    // whoever can catch it glows gently — the whole floor for a squad item
    const scripted = tutItemTargetId(ptr.itemId);
    if (currentStory(state)) document.getElementById('storypanel')?.classList.add('droptarget');
    else if (scripted !== null) document.querySelector(`.middle .pcard[data-pid="${scripted}"]`)?.classList.add('droptarget');
    else if (it.target === 'player') document.querySelectorAll('.middle .pcard[data-pid]:not([data-kind="pr"])').forEach((el) => el.classList.add('droptarget'));
    else if (it.target === 'prospect') document.querySelectorAll('.middle .pcard[data-kind="pr"]').forEach((el) => el.classList.add('droptarget'));
    else document.querySelector('.middle')?.classList.add('teamglow');
  } else {
    ghost = ptr.el.cloneNode(true) as HTMLElement;
    ghost.classList.add('dragghost');
    ghost.style.width = `${rect.width}px`;
  }
  document.body.appendChild(ghost);
  ptr.ghost = ghost;
  ptr.el.classList.add('draglift');
  // the assistant's box steps aside — nothing may cover the drop target
  document.querySelector('.tutwalk')?.classList.add('walkhide');
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
    const target = itemById(ptr.itemId).target;
    // a player item lands on a squad card, a recruit item on a board card,
    // a squad item anywhere on the stage
    const card = el.closest('.pcard[data-pid]');
    if (target === 'player') return card && card.getAttribute('data-kind') !== 'pr' ? card : null;
    if (target === 'prospect') return card && card.getAttribute('data-kind') === 'pr' ? card : null;
    return el.closest('.middle');
  }
  return el.closest('.dropzone');
}

function endDrag(drop: boolean): void {
  if (!ptr) return;
  clearTimeout(ptr.holdTimer);
  if (ptr.active) {
    const found = drop ? targetAtPoint() : null;
    // season zero: only the SCRIPTED player catches the item — anyone else
    // counts as a miss, and the item flies home
    const scripted = ptr.kind === 'item' && !currentStory(state) ? tutItemTargetId(ptr.itemId) : null;
    const target = found && scripted !== null && Number(found.getAttribute('data-pid')) !== scripted ? null : found;
    ptr.el.classList.remove('draglift');
    clearDropGlow();
    document.querySelector('.tutwalk.walkhide')?.classList.remove('walkhide');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    document.querySelectorAll('.dropzone.dragover, .storypanel.dragover, .pcard.dragover').forEach((z) => z.classList.remove('dragover'));
    if (target) {
      ptr.ghost?.remove();
      if (ptr.kind === 'card' || ptr.kind === 'pr') {
        if (ptr.kind === 'card') handleDrop(Number(target.getAttribute('data-zone')), ptr.pid);
        else handleProspectDrop(Number(target.getAttribute('data-zone')), ptr.pid);
        ptr = null;
        render();
        return;
      }
      if (currentStory(state)) dropItemOnStory(ptr.itemId);
      else {
        const target0 = itemById(ptr.itemId).target;
        if (target0 === 'player') dropItemOnPlayer(ptr.itemId, Number(target.getAttribute('data-pid')));
        else if (target0 === 'prospect') dropItemOnProspect(ptr.itemId, Number(target.getAttribute('data-pid')));
        else dropItemOnTeam(ptr.itemId);
      }
      ptr = null;
      render();
      return;
    }
    // a MISS: the item visibly flies back to its pocket
    if (ptr.kind === 'item' && ptr.ghost) {
      const g = ptr.ghost;
      const home = ptr.el.getBoundingClientRect();
      g.style.transition = 'left 0.28s ease, top 0.28s ease, opacity 0.28s ease';
      g.style.left = `${home.left + home.width / 2 - g.offsetWidth / 2}px`;
      g.style.top = `${home.top}px`;
      g.style.opacity = '0.35';
      window.setTimeout(() => g.remove(), 300);
    } else {
      ptr.ghost?.remove();
    }
  }
  ptr = null;
}

app.addEventListener('pointerdown', (e) => {
  const bag = (e.target as HTMLElement).closest('.bslot.filled') as HTMLElement | null;
  if (bag) {
    const itemId = bag.getAttribute('data-bagitem')!;
    // season zero: an item drags ONLY when its walk step is asking for it
    if (!currentStory(state) && !tutAllowsDrag('item', itemId)) return;
    // every item DRAGS whenever the moment allows it (a refusal bounces)
    const canDrag = itemAllowedNow(state, itemId) && !currentStory(state)
      && !(itemById(itemId).rarity === 'legendary' && state.legendariesUsed.includes(itemId));
    if (currentStory(state) || canDrag) {
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
  if (!tutAllowsDrag(card.getAttribute('data-kind') === 'pr' ? 'pr' : 'card', '')) return;
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
  facilities: 'facilities',
  practice: 'practice',
  scouting: 'scouting',
  recruiting: 'recruiting',
  matchup: 'matchup',
  gamenight: 'gamenight',
  departures: 'departures',
  signing: 'signing',
  growth: 'departures',
};

function executeAction(action: string, id: string): void {
  switch (action) {
    case 'press-start':
      // a saved career opens the menu; a blank slate walks into the wizard
      if (canResume()) titleMenu = true;
      else { titleOpen = false; builtKey = ''; }
      break;
    case 'menu-continue': titleMenu = false; titleOpen = false; builtKey = ''; break;
    case 'menu-back': titleMenu = false; break;
    case 'menu-new':
      titleMenu = false;
      titleOpen = false;
      builtKey = '';
      executeAction('new-game', '');
      break;
    case 'setup-codex-keep': {
      const st = ensureSetup();
      st.tutorial = false;
      st.step = 'conf';
      break;
    }
    case 'setup-codex-burn': {
      // START FRESH: the codex burns — including whatever freshGame() already
      // merged into this run — and the tutorial teaches from zero
      const st = ensureSetup();
      wipeCodex();
      state.codexPending = undefined;
      state.unlockedDrills = ['shootaround', 'scrimmage', 'twodays', 'rest', 'bonfire'];
      state.unlockedRegions = ['reccenter', 'home', 'nebula', 'stormlayers', 'outerrim'];
      state.knownInstr = ['counter'];
      st.tutorial = true;
      st.step = 'conf';
      break;
    }
    case 'setup-conf': {
      const st = ensureSetup();
      applyConference(state, id);
      st.step = 'teams';
      st.editing = null;
      pendingTeam = null;
      save(state);
      break;
    }
    case 'setup-team': pendingTeam = Number(id); break;
    case 'setup-edit': ensureSetup().editing = Number(id); break;
    case 'setup-edit-cancel': if (setup) setup.editing = null; break;
    case 'setup-edit-save': {
      const st = ensureSetup();
      if (st.editing === null) break;
      const t = state.teams[st.editing];
      const val = (elId: string): string => (document.getElementById(elId) as HTMLInputElement | null)?.value ?? '';
      const name = val('ed-name').trim();
      const planet = val('ed-planet').trim();
      const bg = val('ed-bg');
      const fg = val('ed-fg');
      if (t) {
        if (name) t.name = name.slice(0, 18);
        if (planet) t.planet = planet.slice(0, 18);
        if (/^#[0-9a-fA-F]{6}$/.test(bg)) t.bg = bg.toUpperCase();
        if (/^#[0-9a-fA-F]{6}$/.test(fg)) t.fg = fg.toUpperCase();
      }
      st.editing = null;
      save(state);
      break;
    }
    case 'setup-back': {
      const st = ensureSetup();
      st.editing = null;
      if (st.step === 'teams') {
        st.step = 'conf';
        pendingTeam = null;
      }
      break;
    }
    case 'setup-confirm': {
      // LOCK IT IN: from here the conference, names and colors are forever
      if (pendingTeam === null) break;
      const st = ensureSetup();
      setup = null;
      if (st.tutorial) {
        for (const r of tutorialBoot(state, pendingTeam)) queueStory(state, r.defId, r.beat, r.playerId, r.data ?? {});
        save(state);
      } else {
        chooseTeam(state, pendingTeam);
      }
      pendingTeam = null;
      break;
    }
    case 'tut-walk-tap':
      if (finishTypeNow()) break; // first tap lands the whole line
      tutWalkAdvance('tap');
      break;
    case 'tut-walk-skip': {
      const w = state.tutWalk;
      if (w) tutWalkFinish(w.key);
      break;
    }

    case 'story-choice':
      doResolve(id);
      break;

    case 'drill-run': {
      const d = DRILLS.find((x) => x.id === selectedDrill)!;
      lens = 0; // results land on the MAIN view, wherever you ran it from
      captureBars();
      // the change language needs before/after: snapshot, run, diff per card
      const pre = new Map(myTeam(state).players.map((p) => [p.id, {
        e: p.energy, m: p.mood, xp: p.xp, lvl: p.level, ovr: ovr(p.attrs),
        need: p.level >= LEVEL_CAP ? 0 : xpNeed(p.level),
      }]));
      const out = runDrill(state, selectedDrill);
      if (out) {
        floatEnergyBig(d.cost);
        const map = new Map<number, CardDelta>();
        for (const p of myTeam(state).players) {
          const b = pre.get(p.id);
          if (!b) continue;
          const rec: CardDelta = {};
          if (p.energy !== b.e) rec.e = p.energy - b.e;
          if (p.mood !== b.m) rec.m = p.mood - b.m;
          if (p.level !== b.lvl) rec.lvlFrom = b.lvl;
          else if (p.xp !== b.xp && b.need > 0) rec.xpFromPct = Math.min(100, Math.round((b.xp / b.need) * 100));
          if (ovr(p.attrs) !== b.ovr) rec.ovrFrom = b.ovr;
          const xp = out.xpByPlayer.get(p.id);
          if (xp) rec.xp = xp;
          const gain = out.gainByPlayer.get(p.id);
          if (gain) rec.gain = gain;
          if (Object.keys(rec).length) map.set(p.id, rec);
        }
        cardDeltas = { key: `drill:${state.season}:${state.week}:${Date.now()}`, map };
        cascArmed = 'bars';
      }
      break;
    }

    case 'begin-week': beginWeek(state); break;
    case 'to-scouting': facSheet = false; toScouting(state); break;
    case 'fac-pick': selFac = id; facSheet = false; break;
    case 'fac-run': {
      if (selFac === 'mop') {
        const txt = grabMop(state);
        if (txt) toast = txt;
      } else {
        const out = upgradeFacility(state, selFac as FacId);
        if (out) { floatEnergyBig(out.cost); toast = out.text; }
        selFac = 'mop';
      }
      break;
    }
    case 'to-practice': galaxySheet = false; gxStickers = null; cardDeltas = null; toPractice(state); break;
    case 'to-recruiting': drillSheet = false; cardDeltas = null; toRecruiting(state); break;
    case 'to-matchup': galaxySheet = false; gxStickers = null; cardDeltas = null; toMatchup(state); break;
    case 'to-signing': toSigning(state); break;
    case 'gn-recap':
      // the score has been seen: everything the horn caused may speak now
      // (the frozen one, the fire going out) — then the recap
      gnStage = 'recap'; clearFloatTimers(); releaseHeldStories(state); break;
    case 'gn-verdict': gnStage = 'verdict'; boxPass = 0; clearFloatTimers(); break;
    case 'gn-pass': boxPass = Math.min(1, boxPass + 1); break;
    case 'gn-table': gnStage = 'table'; standTab = 'table'; clearFloatTimers(); break;
    case 'continue-result': {
      const wkFrom = state.week;
      const seasonFrom = state.season;
      gnStage = 'beat';
      clearFloatTimers();
      cardDeltas = null;
      gxStickers = null;
      liveProg = null;
      continueFromResult(state);
      // THE WEEK TURN: the calendar page flips between the horn and Monday
      if (!state.end && state.tutorial === undefined && state.season === seasonFrom && state.week !== wkFrom) {
        weekTurn = { season: state.season, from: wkFrom, to: state.week };
      }
      break;
    }
    case 'week-turn-close': weekTurn = null; break;

    case 'gx-run': {
      const { actId } = boardSel(state);
      const act = galaxyActById(actId);
      lens = 0; // stickers land on the BIG BOARD, wherever you ran it from
      const need = galaxyPickCount(state);
      if (need !== null && gxSel.size === 0) break; // highlight at least one name first
      const out = actionGalaxy(state, actId, need !== null ? [...gxSel] : undefined);
      gxSel.clear();
      if (out) {
        if (out.perProspect.size) gxStickers = out.perProspect;
        gxResult = { text: out.text, cost: act.cost, played: false, art: out.art };
        // the found names: the ones stickered NEW plus the ones waiting in the 4th row
        gxFound = new Set([
          ...[...out.perProspect.entries()].filter(([, st]) => st.some((x) => x.text === 'NEW')).map(([id]) => id),
          ...state.pendingRecruits.map((pr) => pr.id),
        ]);
      }
      break;
    }
    case 'gx-target': {
      // a scoped action wants targets: tap toggles the highlight, capped
      const need = galaxyPickCount(state);
      if (need === null) break;
      const pid = Number(id);
      if (gxSel.has(pid)) gxSel.delete(pid);
      else if (gxSel.size < need) gxSel.add(pid);
      break;
    }

    case 'cut-confirm-open': cutConfirm = true; break;
    case 'board-confirm-open': boardConfirm = true; break;
    case 'gx-pick': {
      if (galaxyActById(id).kind === 'recruit') selRecruit = id;
      else selScout = id;
      gxSel.clear(); // a new action wants its own targets
      galaxySheet = false;
      break;
    }
    case 'drill-pick': selectedDrill = id; drillSheet = false; break;
    case 'tac-set': {
      // the scheme changes and the bars must SHOW it: snapshot, swap, cascade
      const [rowk, tid] = id.split(':');
      const cur = rowk === 'o' ? (state.tacO ?? 'triangle') : (state.tacD ?? 'man');
      if (cur === tid) break;
      captureBars();
      cascArmed = 'bars';
      setTactic(state, rowk as 'o' | 'd', tid);
      tutWalkAdvance('tac');
      break;
    }
    case 'speech-pick': selPregame = { kind: 'speech', id: id as PlanId }; speechSheet = false; break;
    case 'instr-pick': selPregame = { kind: 'instr', id }; speechSheet = false; break;
    case 'board-confirm-do': {
      const gone = confirmBoard(state);
      boardConfirm = false;
      gxFound.clear();
      if (gone.length) toast = `${gone.join(' and ')} walk${gone.length === 1 ? 's' : ''} out of the story. The galaxy is big; you will not find ${gone.length === 1 ? 'them' : 'them'} again.`;
      break;
    }
    case 'noop': break;

    case 'speech-run': {
      // SEASON ZERO: only THE RALLY — the page you wrote — leaves your mouth
      if (state.tutorial !== undefined) {
        const selT = pregameSel(state);
        if (!(selT.kind === 'speech' && selT.id === 'rally')) {
          selPregame = { kind: 'speech', id: 'rally' };
          toast = 'Tonight the words are the ones you wrote down: THE RALLY.';
          break;
        }
      }
      const sel = pregameSel(state);
      lens = 0;
      captureBars();
      const preCards = snapCards();
      if (sel.kind === 'instr') {
        const text = deliverInstructions(state, sel.id);
        if (text) {
          toast = text;
          // a landed call (or a read) moves the ropes once the toast closes
          if (state.oppFx || state.speechFx) cascArmed = 'bars';
          else barsPre = null;
        }
        break;
      }
      const text = deliverSpeech(state, sel.id);
      if (text) {
        toast = text;
        // SEASON ZERO: the room reacts once the toast has been read
        if (state.tutorial !== undefined) {
          for (const r of tutorialArrive(state, 'speech')) queueStory(state, r.defId, r.beat, r.playerId, r.data ?? {});
        }
        // a rally (or a flop) moves real MOODS: the cards blink their
        // gauges and the bars cascade — the boost must be SEEN
        const map = diffCards(preCards);
        if (map.size) cardDeltas = { key: `speech:${Date.now()}`, map };
        const fx = state.speechFx?.find((f) => f.amt > 0);
        if (fx) {
          // the shift cascades once the toast closes: cards → bars → OVERALL
          speechCasc = { attr: fx.attr, amt: fx.amt };
          cascArmed = 'speech';
        } else if (map.size) {
          cascArmed = 'bars';
        } else {
          barsPre = null;
        }
      }
      break;
    }
    case 'play-game': {
      gnStage = 'beat';
      clearFloatTimers();
      ropeFrom = (document.querySelector('.tbars.mu .tbar.big .tbtrack') as HTMLElement | null)?.getBoundingClientRect() ?? null;
      // the frozen one may stop you at the door — no tip-off, no flip
      if (!playGame(state)) ropeFrom = null;
      break;
    }

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
    case 'confirm-roster': {
      const wasTut = state.tutorial !== undefined;
      if (selSlots && finalizeRoster(state, selSlots.slice(0, 9))) {
        selSlots = null;
        cutConfirm = false;
        // the tutorial's cut opens SEASON ONE with a page flip of its own
        if (wasTut) weekTurn = { season: 1, from: 1, to: 1, seasonOnly: true };
      }
      break;
    }

    case 'use-item': {
      const itemId = id;
      const ev = currentStory(state);
      const storyKey = ev?.choices?.find((c) => c.itemId === itemId && !ev.resolvedText)?.key;
      itemUi = null;
      if (storyKey) {
        doResolve(storyKey);
      } else if (itemById(itemId).target === 'team') {
        dropItemOnTeam(itemId);
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
      pendingTeam = null;
      setup = null;
      titleMenu = false;
      coachOpen = false;
      itemUi = null;
      toast = null;
      galaxySheet = false;
      selScout = 'reccenter';
      selRecruit = 'groupchat';
      selPregame = null;
      selectedDrill = 'rest';
      selFac = 'mop';
      facSheet = false;
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
  // THE LOCK: season zero only accepts the scripted next move (stories run
  // their own show; everything else off-script is dead, not just dimmed)
  if (!currentStory(state) && !tutorialAllows(state, action, id)) return;
  if (el.classList.contains('hold')) return;

  switch (action) {
    case 'story-tap': {
      const ev = currentStory(state);
      if (!ev) break;
      if (storyMode === 'impact') {
        if (!impactPlayed) { finishImpactNow(); return; } // first tap: land everything
        clearImpactTimers();
        if (impact && impact.ix < impact.pages.length - 1) {
          // the next voice gets its own screen
          impact.ix++;
          impactPlayed = false;
          break;
        }
        clearFloatTimers();
        impact = null;
        dismissStory(state);
        storyUid = -1;
        break;
      }
      if (finishTypeNow()) return; // finish the current beat instantly
      if (!stageTyped || storyMode === 'choices') return;
      if (storyMode === 'antic') {
        // signing day: the wheel decides between the ring and the answer
        if (ev.data?.wheel && !wheelDone) {
          wheelDone = true;
          const pct = (ev.data.pct as number) ?? 0;
          const commit = ev.data.commit === true;
          showWheel(pct, commit, `SIGNING ${String(ev.data.name ?? '').toUpperCase()}?`, () => { storyMode = 'reveal'; stageTyped = false; render(); });
          return;
        }
        storyMode = 'reveal'; stageTyped = false; break;
      }
      if (storyMode === 'r-antic') { storyMode = 'r-reveal'; stageTyped = false; break; }
      if (storyMode === 'r-reveal') {
        if (impact && impact.pages.length) { storyMode = 'impact'; impactPlayed = false; break; }
        impact = null;
        dismissStory(state);
        storyUid = -1;
        break;
      }
      // 'reveal' with no pending choices: tap-through story resolves now —
      // except season zero's press question: THE NOTEBOOK answers that one
      if (ev.defId === 'tut_scoop2' && !ev.resolvedText && state.notebook.some((n) => n.key === ev.data?.noteKey)) {
        toast = '▤ Read it off THE NOTEBOOK, coach — bottom left.';
        break;
      }
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
    case 'gx-sheet': galaxySheet = state.phase === 'recruiting' ? 'recruiting' : 'scouting'; break;
    case 'gx-sheet-close': if (e.target === el) galaxySheet = false; break;
    case 'cut-confirm-close': cutConfirm = false; break;
    case 'board-confirm-close': boardConfirm = false; break;
    case 'speech-sheet': speechSheet = true; break;
    case 'speech-sheet-close': if (e.target === el) speechSheet = false; break;
    case 'toast-tap': {
      if (finishTypeNow()) return;
      // the next beat, or the way out
      const beats = toast ? splitBeats(toast) : [];
      if (toastBeat < beats.length - 1) { toastBeat++; break; }
      toast = null;
      toastShown = null;
      toastBeat = 0;
      break;
    }

    case 'lens-set': lens = (Number(id) % 3) as Lens; tutWalkAdvance(`lens:${lens}`); break;

    case 'drill-sheet': drillSheet = true; break;
    case 'drill-sheet-close': if (e.target === el) drillSheet = false; break;
    case 'fac-sheet': facSheet = true; break;
    case 'fac-sheet-close': if (e.target === el) facSheet = false; break;

    case 'bag-item': itemUi = id; break;
    case 'item-close': itemUi = null; break;
    case 'sched-open': if (!currentStory(state) && !liveGameOn(state)) { schedOpen = true; standOpen = false; jobOpen = false; } break;
    case 'sched-close': schedOpen = false; break;
    case 'job-open': if (!currentStory(state) && !liveGameOn(state)) { jobOpen = true; schedOpen = false; standOpen = false; } break;
    case 'job-close': jobOpen = false; break;
    case 'stand-open': if (!currentStory(state) && !liveGameOn(state)) { standOpen = true; schedOpen = false; jobOpen = false; } break;
    case 'stand-close': standOpen = false; break;
    case 'stand-tab': standTab = id as 'table' | 'leaders'; break;
    case 'notebook': {
      // dead moments (a decision pending, an outcome page, the live ticker)
      // swallow the tap — the slot already renders dead for them
      if (notebookDead(state)) break;
      // SEASON ZERO's scripted pages: the cheer gets WRITTEN at scouting;
      // at the matchup the written page becomes THE RALLY, ready to deliver
      const wNote = state.tutWalk?.steps?.[state.tutWalk.ix];
      if (state.tutorial !== undefined && (wNote?.advance ?? '') === 'note' && !currentStory(state)) {
        if (state.phase === 'scouting') {
          const nm = myTeam(state).name.toUpperCase();
          addNote(state, 'story', 'cheer:0', `«Go! Go! ${nm}! Go, go, go, ${nm}!» — the head cheerleader's cheer`);
          toast = '▤ NOTED: the cheer, word for word.\n\nWhatever lands in the notebook, you keep.';
          tutWalkAdvance('note');
          break;
        }
        if (state.phase === 'matchup') {
          selPregame = { kind: 'speech', id: 'rally' };
          toast = '★ THE RALLY ★\n\nYou read the cheer off the page, word for word — and the room starts sitting up. Hold ▶ SPEECH.';
          tutWalkAdvance('note');
          break;
        }
      }
      const ev = currentStory(state);
      // during Scoop's question the notebook ANSWERS (if it has the note)
      if (ev?.defId === 'scoop_question' && !ev.resolvedText) {
        if (state.notebook.some((n) => n.key === ev.data?.noteKey)) doResolve('notebook');
        else toast = '▤ THE NOTEBOOK: the pages are blank on this one, coach.';
        break;
      }
      // season zero's follow-up: Scoop asks, and the notebook IS the answer
      if (ev?.defId === 'tut_scoop2' && !ev.resolvedText) {
        doResolve(state.notebook.some((n) => n.key === ev.data?.noteKey) ? 'notebook' : 'ok');
        break;
      }
      // otherwise: note something noteworthy — or browse the pages
      if (takeNote()) {
        toast = state.phase === 'gamenight'
          ? `▤ You note box scores, winners, losers and standings. Everything you're bound to forget otherwise.`
          : `▤ NOTED: ${esc(state.notebook[0].text.slice(0, 90))}${state.notebook[0].text.length > 90 ? '…' : ''}`;
        tutWalkAdvance('note');
      } else notebookOpen = true;
      break;
    }
    case 'notebook-close': notebookOpen = false; break;
    case 'coach-open': coachOpen = true; break;
    case 'coach-close': coachOpen = false; break;
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
  drop: (itemId: string, kind: 'p' | 'pr', id: number) => {
    if (kind === 'pr') dropItemOnProspect(itemId, id);
    else dropItemOnPlayer(itemId, id);
    render();
  },
  ui: () => ({ storyMode, stageTyped, impact, impactPlayed }),
};

render();
