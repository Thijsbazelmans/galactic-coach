// The sim (SPEC §4) on the column grid: 9 slots, row-major.
// Rows: 0 = starters, 1 = bench, 2 = reserves.
// Columns: 0 = BACKCOURT, 1 = WING, 2 = FRONTCOURT — position is BODY SIZE,
// not a stat: small bodies run the backcourt, big bodies hold the frontcourt.
// The penalty is printed on the card (MISCAST).

import { ATTR_STAT, planById } from './data';
import type { AttrRec, BoxRow, ChampTeam, GameState, MyGameResult, PlanId, Player, SpeechFx, Team } from './types';
import { ATTRS, attrEff, clamp, ovr, rand, sizeIndex, zeroAttrs } from './util';

export const COL_LABELS = ['BACKCOURT', 'WING', 'FRONTCOURT'];

export function available(p: Player): boolean {
  return p.outWeeks === 0;
}

function byId(t: Team, id: number | null): Player | null {
  return id === null ? null : t.players.find((p) => p.id === id) ?? null;
}

// ---- column fit: pure body size ---------------------------------------------
// Size 0=XS … 4=XL. A wall in the backcourt or a waterbug in the frontcourt
// pays up to −25%. The wing forgives almost everything.

const MISCAST: number[][] = [
  // sizeIdx:      XS    S     M     L     XL
  /* backcourt */ [0, 0, 8, 16, 25],
  /* wing      */ [0, 0, 0, 0, 0], // the wing forgives everything
  /* frontcourt*/ [25, 16, 8, 0, 0],
];

export function slotMult(p: Player, col: number): number {
  return 1 - MISCAST[col][sizeIndex(p)] / 100;
}

/** Column preference score for auto-placement (higher = better fit). */
function colScore(p: Player, col: number): number {
  return 100 - MISCAST[col][sizeIndex(p)] * 4;
}

// ---- lineup ------------------------------------------------------------------------

export function slotPlayer(t: Team, idx: number): Player | null {
  return byId(t, t.lineup.slots[idx] ?? null);
}

function rowPlayers(t: Team, row: number): Player[] {
  return [0, 1, 2].map((c) => slotPlayer(t, row * 3 + c)).filter((p): p is Player => !!p);
}

export function starters(t: Team): Player[] {
  return rowPlayers(t, 0);
}
export function benchPlayers(t: Team): Player[] {
  return rowPlayers(t, 1);
}
export function reserves(t: Team): Player[] {
  return rowPlayers(t, 2);
}

/**
 * Keep the grid legal: every rostered player in exactly one slot, empties
 * filled by column fit, and the unavailable SINK to the reserve row of their
 * own column while everyone behind them moves up.
 */
export function normalizeLineup(t: Team): void {
  const slots: (number | null)[] = Array.from({ length: 9 }, (_, i) => t.lineup.slots[i] ?? null);
  const seen = new Set<number>();
  for (let i = 0; i < 9; i++) {
    const p = byId(t, slots[i]);
    if (!p || seen.has(p.id)) slots[i] = null;
    else seen.add(p.id);
  }
  // place the unplaced: best empty slot by (row, column fit)
  const pool = t.players.filter((p) => !seen.has(p.id)).sort((a, b) => ovr(b.attrs) - ovr(a.attrs));
  for (const p of pool) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (slots[i] !== null) continue;
      const row = Math.floor(i / 3);
      const score = colScore(p, i % 3) - row * 500; // higher rows first
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) slots[best] = p.id;
  }
  // column sink: available keep their order, the hurt drop to the bottom
  for (let c = 0; c < 3; c++) {
    const col = [0, 1, 2].map((r) => byId(t, slots[r * 3 + c]));
    const up = col.filter((p): p is Player => !!p && available(p));
    const down = col.filter((p): p is Player => !!p && !available(p));
    const ordered = [...up, ...down];
    for (let r = 0; r < 3; r++) slots[r * 3 + c] = ordered[r]?.id ?? null;
  }
  t.lineup.slots = slots;
}

/** AI teams: best six on the floor — CONDITION counts, tired stars sit —
    sorted into columns by body size. (The other coaches rotate too.) */
export function autoLineup(t: Team): void {
  const cond = (p: Player): number => ovr(p.attrs) * meterMult(p.energy) * meterMult(p.mood);
  const ranked = [...t.players].filter(available).sort((a, b) => cond(b) - cond(a));
  const rows = [ranked.slice(0, 3), ranked.slice(3, 6), ranked.slice(6, 9)];
  const slots: (number | null)[] = Array.from({ length: 9 }, () => null);
  rows.forEach((trio, r) => {
    const bySize = [...trio].sort((a, b) => sizeIndex(b) - sizeIndex(a)); // biggest first
    // biggest → frontcourt, smallest → backcourt, middle → wing
    if (bySize[0]) slots[r * 3 + 2] = bySize[0].id;
    if (bySize[1]) slots[r * 3 + 1] = bySize[1].id;
    if (bySize[2]) slots[r * 3 + 0] = bySize[2].id;
  });
  t.lineup.slots = slots;
  normalizeLineup(t);
}

// ---- the match value: what the ropes (and the needle) run on ------------------
// Starters count 75%, bench 25%, reserves nothing. Every player's contribution
// is multiplied by ENERGY and MOOD on the same curve — 0%→×0.40, 25%→×0.60,
// 50%→×0.80, 75%→×1.00, 100%→×1.20 — plus miscast tax and fire. A LANDED
// speech (the room ignited) adds +amt to its attribute for every player.
// Identical math for both sides of the rope.

export function meterMult(v: number): number {
  return 0.4 + 0.8 * (clamp(v, 0, 100) / 100);
}

function playerCond(p: Player, col: number): number {
  return meterMult(p.energy) * meterMult(p.mood) * slotMult(p, col) * (p.onFire ? 1.2 : 1);
}

/** Per-attribute weighted team values (the four rope rows). fx = a landed speech. */
export function matchAttrs(t: Team, fx: SpeechFx | null = null): AttrRec {
  const out = zeroAttrs();
  for (let c = 0; c < 3; c++) {
    for (const [row, w] of [[0, 0.75], [1, 0.25]] as [number, number][]) {
      const p = slotPlayer(t, row * 3 + c);
      if (!p || !available(p)) continue;
      const cond = playerCond(p, c) * w;
      for (const a of ATTRS) out[a] += (p.attrs[a] + (fx && a === fx.attr ? fx.amt : 0)) * cond;
    }
  }
  for (const a of ATTRS) out[a] = Math.round(out[a] * 10) / 10;
  return out;
}

/** The whole rope: the four rows added up. */
export function teamPower(t: Team, fx: SpeechFx | null = null): number {
  return ovr(matchAttrs(t, fx));
}

/** The rope split IS the win chance: a sharpened ratio of the two totals. */
const SHARP = 6;
export function winShare(mine: number, theirs: number): number {
  const a = Math.pow(Math.max(1, mine), SHARP);
  const b = Math.pow(Math.max(1, theirs), SHARP);
  return a / (a + b);
}

/** The average kite of a team's starters — the scouting-report shape. */
export function teamKite(t: Team): AttrRec {
  const st = starters(t);
  const k = zeroAttrs();
  if (!st.length) return k;
  for (const a of ATTRS) k[a] = Math.round(st.reduce((s, p) => s + p.attrs[a], 0) / st.length);
  return k;
}

export function logistic(diff: number): number {
  return 1 / (1 + Math.exp(-diff / 18));
}

// ---- the game itself --------------------------------------------------------------------
// THE NEEDLE, twice: each half's rope split is that half's win chance; a needle
// lands uniformly on it. Half scores are roughly half-scale; the final is the
// sum, so the two needles' margins can cancel into a squeaker either way.

function halfScores(share: number, u: number): { won: boolean; my: number; opp: number } {
  const won = u < share;
  const margin = 1 + Math.min(17, Math.round(Math.abs(u - share) * 17)) + rand(2);
  const base = 26 + rand(8);
  return won ? { won, my: base + margin, opp: base } : { won, my: base, opp: base + margin };
}

export interface SimOutcome {
  result: MyGameResult;
  won: boolean;
}

// ---- the box score: 4 stats, one per attribute, dealt from the team totals ----

function dealStat(pool: { p: Player; w: number }[], total: number, weigh: (p: Player) => number): Map<number, number> {
  const out = new Map<number, number>();
  const ws = pool.map((x) => x.w * (1 + weigh(x.p)));
  const tw = ws.reduce((a, x) => a + x, 0) || 1;
  let dealt = 0;
  pool.forEach((x, i) => {
    const n = Math.round((ws[i] / tw) * total);
    out.set(x.p.id, n);
    dealt += n;
  });
  // rounding drift lands on the heaviest hand
  if (pool.length) {
    const top = pool.reduce((b, x, i) => (ws[i] > ws[b.i] ? { i, x } : b), { i: 0, x: pool[0] });
    out.set(top.x.p.id, Math.max(0, (out.get(top.x.p.id) ?? 0) + (total - dealt)));
  }
  return out;
}

/** Deal ONE HALF of my box score (reb/stl/ast pools halved). Season stats are
    NOT written here — they commit once, on the merged full-game rows. */
export function dealHalfBox(me: Team, myScore: number, plan: PlanId): BoxRow[] {
  const pool = [
    ...starters(me).filter(available).map((p) => ({ p, w: 3 })),
    ...benchPlayers(me).filter(available).map((p) => ({ p, w: 1 })),
  ];
  if (!pool.length) return [];
  const speechAttr = planById(plan).attr;
  const pts = dealStat(pool, myScore, (p) => attrEff(p, 'skl') + attrEff(p, 'ath') * 0.3);
  const reb = dealStat(pool, 8 + rand(6), (p) => attrEff(p, 'ath') + sizeIndex(p) * 2);
  const stl = dealStat(pool, 1 + rand(4) + (speechAttr === 'frc' ? 2 : 0), (p) => attrEff(p, 'frc'));
  const ast = dealStat(pool, 3 + rand(4) + (speechAttr === 'brn' ? 2 : 0), (p) => attrEff(p, 'brn'));
  return pool.map(({ p }) => ({
    playerId: p.id,
    name: p.name,
    pts: pts.get(p.id) ?? 0,
    reb: reb.get(p.id) ?? 0,
    stl: stl.get(p.id) ?? 0,
    ast: ast.get(p.id) ?? 0,
  }));
}

/** Merge two half box scores by player (halftime swaps change the pool). */
function mergeBox(h1: BoxRow[], h2: BoxRow[]): BoxRow[] {
  const byId = new Map<number, BoxRow>();
  for (const r of [...h1, ...h2]) {
    const m = byId.get(r.playerId);
    if (m) { m.pts += r.pts; m.reb += r.reb; m.stl += r.stl; m.ast += r.ast; }
    else byId.set(r.playerId, { ...r });
  }
  return [...byId.values()].sort((a, b) => b.pts - a.pts);
}

/** Write season stats + the in-game MVP once, from the full-game rows.
    Returns the MVP's player id — the verdict marks his card. */
function commitBox(me: Team, rows: BoxRow[]): number | null {
  for (const row of rows) {
    const p = me.players.find((x) => x.id === row.playerId);
    if (!p) continue;
    p.stats.gp++;
    p.stats.pts += row.pts;
    p.stats.reb += row.reb;
    p.stats.stl += row.stl;
    p.stats.ast += row.ast;
  }
  if (!rows.length) return null;
  const line = (r: BoxRow): number => r.pts + r.reb + r.stl + r.ast;
  const star = rows.reduce((b, r) => (line(r) > line(b) ? r : b), rows[0]);
  const mp = me.players.find((p) => p.id === star.playerId);
  if (mp) mp.stats.mvp = (mp.stats.mvp ?? 0) + 1;
  return mp?.id ?? null;
}

function boxLineFrom(rows: BoxRow[]): string {
  if (!rows.length) return '';
  const top = rows[0];
  const extras: string[] = [];
  const bestReb = [...rows].sort((a, b) => b.reb - a.reb)[0];
  const bestAst = [...rows].sort((a, b) => b.ast - a.ast)[0];
  if (bestReb.playerId !== top.playerId && bestReb.reb >= 6) extras.push(`${bestReb.name} owned the glass (${bestReb.reb} reb)`);
  else if (bestAst.playerId !== top.playerId && bestAst.ast >= 5) extras.push(`${bestAst.name} ran the show (${bestAst.ast} ast)`);
  return `${top.name} led the way with ${top.pts} points.${extras.length ? ` ${extras[0]}.` : ''}`;
}

function verdictLines(
  me: Team,
  myPlan: PlanId,
  won: boolean,
  h1my: number,
  h1opp: number
): { wheelLine: string; heroLine: string } {
  const mine = planById(myPlan);
  // the night's story is the two halves now — was the locker room the turn?
  const d = h1my - h1opp;
  let wheelLine: string;
  if (d > 0) {
    wheelLine = won
      ? `Up ${d} at the half — and you never gave it back.`
      : `Up ${d} at the half... and the second half took all of it away.`;
  } else if (d < 0) {
    wheelLine = won
      ? `Down ${-d} at the half. Whatever happened in that locker room WORKED.`
      : `Down ${-d} at the half, and the hole was too deep.`;
  } else {
    wheelLine = won
      ? `Dead even at the half — the second half was yours.`
      : `Dead even at the half — they took the second.`;
  }
  const st = [0, 1, 2].map((c) => ({ p: slotPlayer(me, c), c })).filter((x): x is { p: Player; c: number } => !!x.p);
  if (!st.length) return { wheelLine, heroLine: 'You fielded nobody. The scoreboard noticed.' };
  const miscast = st.filter((x) => slotMult(x.p, x.c) < 0.88);
  const fit = (p: Player): number => attrEff(p, mine.attr);
  const hero = [...st].sort((a, b) => fit(b.p) - fit(a.p))[0].p;
  const goatX = [...st].sort((a, b) => fit(a.p) - fit(b.p))[0];
  const goat = goatX.p;
  const goatMuted = (mine.attr === 'ath' || mine.attr === 'frc' ? goat.energy : goat.mood) <= 40;
  let heroLine: string;
  if (won) heroLine = `${hero.name} was built for this.`;
  else if (miscast.length) heroLine = `${miscast[0].p.name} was miscast in the ${COL_LABELS[miscast[0].c].toLowerCase()} all night.`;
  else if (goatMuted) heroLine = `${goat.name} played half a step slow — ${mine.attr === 'ath' || mine.attr === 'frc' ? '⚡ was low' : goat.form === 'femme' ? "her head wasn't here" : "his head wasn't here"}.`;
  else heroLine = `${goat.name} never fit the plan tonight — his ${ATTR_STAT[mine.attr]} column says it all.`;
  return { wheelLine, heroLine };
}

/** One half's rope: my weighted power vs theirs — venue, a landed speech, and
    any pregame skulduggery folded in. The champ has no roster — their scouted
    power number holds for both halves. */
function halfRope(
  s: GameState,
  me: Team,
  opp: Team | null,
  champ: ChampTeam | null,
  home: boolean,
  fx: SpeechFx | null
): { mine: number; theirs: number } {
  const [vm, vt] = champ ? [1, 1] : home ? [1.03, 1] : [1, 1.03];
  let mine = teamPower(me, fx) * vm;
  let theirs = (champ ? champ.power : teamPower(opp!)) * vt;
  if (s.pregameFlags.wallet) mine *= 1.03; // the whistle leans your way
  if (s.pregameFlags.cloak) theirs *= 0.95; // they prepared for the wrong team
  if (s.pregameFlags.alarm) theirs *= 0.92; // the 3am fire alarm
  return { mine, theirs };
}

/** THE FIRST HALF: rope → needle → half score + half box, then the locker room
    — starters shed half the game drain (both benches too) so the halftime rope
    is honest. */
export function simMyGameH1(s: GameState, me: Team, opp: Team | null, champ: ChampTeam | null, home: boolean): void {
  const { mine, theirs } = halfRope(s, me, opp, champ, home, s.speechFx ?? null);
  const share = winShare(mine, theirs);
  const u = Math.random();
  const sc = halfScores(share, u);
  const box = dealHalfBox(me, sc.my, s.plan);
  // the half: on-floor players catch their breath having spent half the night
  const drains: Record<number, number> = {};
  for (const p of starters(me)) {
    if (!available(p)) continue;
    const d = 8 + rand(3);
    p.energy = clamp(p.energy - d, 0, 100);
    drains[p.id] = -d;
  }
  for (const p of benchPlayers(me)) {
    if (!available(p)) continue;
    const d = 4 + rand(2);
    p.energy = clamp(p.energy - d, 0, 100);
    drains[p.id] = -d;
  }
  // their locker room spends the same half ours does — by lineup row
  if (opp) {
    for (const p of starters(opp)) if (available(p)) p.energy = clamp(p.energy - (8 + rand(3)), 0, 100);
    for (const p of benchPlayers(opp)) if (available(p)) p.energy = clamp(p.energy - (4 + rand(2)), 0, 100);
  }
  s.halftime = {
    myH1: sc.my,
    oppH1: sc.opp,
    share,
    needle: u,
    planMine: s.plan,
    box,
    home,
    oppName: champ ? champ.name : `${opp!.planet} ${opp!.name}`,
    drains,
  };
}

/** THE SECOND HALF: the rope recomputes from the NEW lineup, the halftime
    speech and the meters; a second needle lands; the final is the sum. */
export function simMyGameH2(s: GameState, me: Team, opp: Team | null, champ: ChampTeam | null): SimOutcome {
  const ht = s.halftime!;
  const myPlan = s.planH2 ?? s.plan;
  const { mine, theirs } = halfRope(s, me, opp, champ, ht.home, s.speechFxH2 ?? null);
  const share = winShare(mine, theirs);
  const u = Math.random();
  const sc = halfScores(share, u);
  let myTot = ht.myH1 + sc.my;
  let oppTot = ht.oppH1 + sc.opp;
  // the halves can cancel exactly — the last possession goes to the H2 winner
  if (myTot === oppTot) { if (sc.won) myTot += 1; else oppTot += 1; }
  const won = myTot > oppTot;
  const box = mergeBox(ht.box, dealHalfBox(me, sc.my, myPlan));
  const mvpId = commitBox(me, box);
  const { wheelLine, heroLine } = verdictLines(me, myPlan, won, ht.myH1, ht.oppH1);
  return {
    won,
    result: {
      win: won,
      myScore: myTot,
      oppScore: oppTot,
      oppName: ht.oppName,
      planMine: myPlan,
      wheelLine,
      heroLine,
      boxLine: boxLineFrom(box),
      box,
      share,
      needle: u,
      home: ht.home,
      h1: { my: ht.myH1, opp: ht.oppH1, share: ht.share, needle: ht.needle },
      h2: { my: sc.my, opp: sc.opp, share, needle: u },
      mvpId: mvpId ?? undefined,
    },
  };
}

/** AI vs AI league game: same needle math, no speeches in empty gyms. */
export function simAiGame(a: Team, b: Team): { winner: Team; loser: Team; scoreW: number; scoreL: number } {
  const pa = teamPower(a) * 1.03;
  const pb = teamPower(b);
  const aWins = Math.random() < winShare(pa, pb);
  const margin = 1 + rand(9);
  const base = 52 + rand(16);
  return aWins
    ? { winner: a, loser: b, scoreW: base + margin, scoreL: base }
    : { winner: b, loser: a, scoreW: base + margin, scoreL: base };
}

export { clamp };
