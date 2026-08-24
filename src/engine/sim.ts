// The sim (SPEC §4) on the column grid: 9 slots, row-major.
// Rows: 0 = starters, 1 = bench, 2 = reserves.
// Columns: 0 = BACKCOURT, 1 = WING, 2 = FRONTCOURT — position is BODY SIZE,
// not a stat: small bodies run the backcourt, big bodies hold the frontcourt.
// The penalty is printed on the card (MISCAST).

import { ATTR_STAT, planById } from './data';
import type { AttrRec, BoxRow, ChampTeam, GameState, MyGameResult, PlanId, Player, SpeechFx, Team } from './types';
import { ATTRS, attrEff, clamp, ovr, pick, rand, roll, sizeIndex, zeroAttrs } from './util';

/** THE FORM ROLL: hot/cold nights per player, rolled at tip-off. */
export type Forms = Record<number, 1 | -1>;
const FORM_MULT = { [1]: 1.15, [-1]: 0.85 } as const;

function formMult(forms: Forms | undefined, pid: number): number {
  const f = forms?.[pid];
  return f ? FORM_MULT[f] : 1;
}

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

/** Per-attribute weighted team values (the four rope rows). fx = the landed
    speeches (the pregame one carries the whole game; halftime stacks a
    second); forms = tonight's hot/cold rolls (game night only). */
export function matchAttrs(t: Team, fx: SpeechFx | SpeechFx[] | null = null, forms?: Forms): AttrRec {
  const fxs: SpeechFx[] = fx ? (Array.isArray(fx) ? fx : [fx]) : [];
  const out = zeroAttrs();
  for (let c = 0; c < 3; c++) {
    for (const [row, w] of [[0, 0.75], [1, 0.25]] as [number, number][]) {
      const p = slotPlayer(t, row * 3 + c);
      if (!p || !available(p)) continue;
      const cond = playerCond(p, c) * w * formMult(forms, p.id);
      for (const a of ATTRS) {
        let v = p.attrs[a];
        for (const f of fxs) if (f.attr === a) v += f.amt;
        out[a] += v * cond;
      }
    }
  }
  for (const a of ATTRS) out[a] = Math.round(out[a] * 10) / 10;
  return out;
}

/** The whole rope: the four rows added up. */
export function teamPower(t: Team, fx: SpeechFx | SpeechFx[] | null = null, forms?: Forms): number {
  return ovr(matchAttrs(t, fx, forms));
}

/** Meter-neutral strength: the same rope with everyone standing at the
    baseline — for sizing opponents (the UT bracket) without catching the
    roster on a gassed night. */
export function restedPower(t: Team): number {
  let sum = 0;
  for (let c = 0; c < 3; c++) {
    for (const [row, w] of [[0, 0.75], [1, 0.25]] as [number, number][]) {
      const p = slotPlayer(t, row * 3 + c);
      if (!p || !available(p)) continue;
      sum += ovr(p.attrs) * slotMult(p, c) * w;
    }
  }
  return Math.round(sum * 10) / 10;
}

/** The rope split IS the win chance: a sharpened ratio of the two totals —
    clamped to 5–95%: the galaxy never hands out a certainty. */
const SHARP = 6;
export function winShare(mine: number, theirs: number): number {
  const a = Math.pow(Math.max(1, mine), SHARP);
  const b = Math.pow(Math.max(1, theirs), SHARP);
  return clamp(a / (a + b), 0.05, 0.95);
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
// ONE rope, ONE night: the rope split is the win chance, the night lands
// uniformly on it, and the distance from the split is the margin. The lineup
// screen and the speech are the whole plan — then the game runs to the horn.

function fullScores(share: number, u: number): { won: boolean; my: number; opp: number } {
  const won = u < share;
  const margin = 1 + Math.min(32, Math.round(Math.abs(u - share) * 32)) + rand(4);
  const base = 52 + rand(14);
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

/** Deal my full-game box score by attribute-weighted shares. */
export function dealBox(me: Team, myScore: number, plan: PlanId, forms?: Forms): BoxRow[] {
  const pool = [
    ...starters(me).filter(available).map((p) => ({ p, w: 3 * formMult(forms, p.id) })),
    ...benchPlayers(me).filter(available).map((p) => ({ p, w: 1 * formMult(forms, p.id) })),
  ];
  if (!pool.length) return [];
  const speechAttr = planById(plan).attr;
  const pts = dealStat(pool, myScore, (p) => attrEff(p, 'skl') + attrEff(p, 'ath') * 0.3);
  const reb = dealStat(pool, 16 + rand(11), (p) => attrEff(p, 'ath') + sizeIndex(p) * 2);
  const stl = dealStat(pool, 3 + rand(7) + (speechAttr === 'frc' ? 3 : 0), (p) => attrEff(p, 'frc'));
  const ast = dealStat(pool, 6 + rand(7) + (speechAttr === 'brn' ? 3 : 0), (p) => attrEff(p, 'brn'));
  return pool
    .map(({ p }) => ({
      playerId: p.id,
      name: p.name,
      pts: pts.get(p.id) ?? 0,
      reb: reb.get(p.id) ?? 0,
      stl: stl.get(p.id) ?? 0,
      ast: ast.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.pts - a.pts);
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
  share: number,
  margin: number
): { wheelLine: string; heroLine: string } {
  const mine = planById(myPlan);
  // the night's story: what the rope promised vs what the horn said
  let wheelLine: string;
  if (won) {
    if (share >= 0.62) wheelLine = margin >= 12 ? 'The better team showed up and made sure everybody knew it.' : 'The better team showed up. Barely acted like it, but showed up.';
    else if (share <= 0.42) wheelLine = 'The rope said no. The locker room never read the rope.';
    else wheelLine = margin <= 4 ? 'A coin-flip night, decided by fingertips. Yours.' : 'A coin-flip night — and it came up yours.';
  } else {
    if (share >= 0.58) wheelLine = 'You were the better team. The scoreboard disagrees, loudly, in public.';
    else if (share <= 0.42) wheelLine = margin >= 12 ? 'Outgunned from the tip. The rope tried to warn you.' : 'Outgunned from the tip — and still within reach at the horn. Take that home.';
    else wheelLine = margin <= 4 ? 'A coin-flip night, decided by fingertips. Not yours.' : 'A coin-flip night. It came up theirs.';
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

/** The night's rope: my weighted power vs theirs — venue, a landed speech, and
    any pregame skulduggery folded in. The champ has no roster — their scouted
    power number stands. */
function gameRope(
  s: GameState,
  me: Team,
  opp: Team | null,
  champ: ChampTeam | null,
  home: boolean,
  fx: SpeechFx | SpeechFx[] | null,
  forms?: Forms
): { mine: number; theirs: number } {
  const [vm, vt] = champ ? [1, 1] : home ? [1.03, 1] : [1, 1.03];
  let mine = teamPower(me, fx, forms) * vm;
  // their locker room hears a speech too — the mirror sits just under the
  // happy medium (one speech per night now; the coach's edge is earned)
  const oppAmt = roll(25) ? 1 + rand(2) : 0;
  let theirs = (champ
    ? champ.power + oppAmt
    : teamPower(opp!, { attr: planById(opp!.plan).attr, amt: oppAmt })) * vt;
  if (s.pregameFlags.wallet) mine *= 1.03; // the whistle leans your way
  if (s.pregameFlags.cloak) theirs *= 0.95; // they prepared for the wrong team
  if (s.pregameFlags.alarm) theirs *= 0.92; // the 3am fire alarm
  return { mine, theirs };
}

/** THE GAME: the form roll → the rope → the night lands → the full box score.
    One speech, one lineup, one honest rope — then the horn. */
export function simMyGame(s: GameState, me: Team, opp: Team | null, champ: ChampTeam | null, home: boolean): SimOutcome {
  // THE FORM ROLL: each floor player can catch a hot night (STANDOUT!, +15%,
  // and the hot hand teaches him something) or a cold one (OFF DAY, −15%).
  // A real hidden roll — the box-score grid reveals it after the horn.
  const forms: Forms = {};
  const formGain: Record<number, string> = {};
  for (const p of [...starters(me), ...benchPlayers(me)]) {
    if (!available(p)) continue;
    if (roll(10)) {
      forms[p.id] = 1;
      const room = ATTRS.filter((a) => p.attrs[a] < p.pots[a]);
      if (room.length) {
        const a = pick(room);
        p.attrs[a]++;
        formGain[p.id] = `+1 ${a.toUpperCase()}`;
      }
    } else if (roll(10)) {
      forms[p.id] = -1;
    }
  }
  const { mine, theirs } = gameRope(s, me, opp, champ, home, s.speechFx ?? null, forms);
  const share = winShare(mine, theirs);
  const u = Math.random();
  const sc = fullScores(share, u);
  const box = dealBox(me, sc.my, s.plan, forms);
  const mvpId = commitBox(me, box);
  const { wheelLine, heroLine } = verdictLines(me, s.plan, sc.won, share, Math.abs(sc.my - sc.opp));
  return {
    won: sc.won,
    result: {
      win: sc.won,
      myScore: sc.my,
      oppScore: sc.opp,
      oppName: champ ? champ.name : `${opp!.planet} ${opp!.name}`,
      planMine: s.plan,
      wheelLine,
      heroLine,
      boxLine: boxLineFrom(box),
      box,
      share,
      needle: u,
      home,
      mvpId: mvpId ?? undefined,
      forms,
      formGain,
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
