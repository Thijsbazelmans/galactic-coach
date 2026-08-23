// Tiny shared helpers — no imports beyond types, no state.

import type { Attr, AttrRec, StatLine } from './types';

export const ATTRS: Attr[] = ['skl', 'ath', 'frc', 'brn'];

export function rand(n: number): number {
  return Math.floor(Math.random() * n);
}
export function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)];
}
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
/** Roll a printed percentage. All printed odds are true and final (law 5). */
export function roll(pct: number): boolean {
  return Math.random() * 100 < pct;
}

// ---- the four attributes ------------------------------------------------------

export function zeroAttrs(): AttrRec {
  return { skl: 0, ath: 0, frc: 0, brn: 0 };
}

export function copyAttrs(a: AttrRec): AttrRec {
  return { skl: a.skl, ath: a.ath, frc: a.frc, brn: a.brn };
}

/** OVERALL = the four added up (0–100 in theory; species caps keep it lower). */
export function ovr(a: AttrRec): number {
  return a.skl + a.ath + a.frc + a.brn;
}

/** Meters MUTE the game: energy suppresses the body (ATH, FRC),
    mood suppresses the head (SKL, BRN). Floor 60% — nobody becomes nothing. */
export function attrEff(p: { attrs: AttrRec; energy: number; mood: number; onFire?: boolean }, a: Attr): number {
  const meter = a === 'ath' || a === 'frc' ? p.energy : p.mood;
  return p.attrs[a] * (0.6 + 0.4 * (meter / 100)) * (p.onFire ? 1.2 : 1);
}

export function effOvr(p: { attrs: AttrRec; energy: number; mood: number; onFire?: boolean }): number {
  return ATTRS.reduce((s, a) => s + attrEff(p, a), 0);
}

/** The attribute a set of attrs leans hardest into (flavor, AI, drift). */
export function bestAttr(a: AttrRec): Attr {
  return ATTRS.reduce((best, x) => (a[x] > a[best] ? x : best), 'skl' as Attr);
}

/** Sprinkle n points onto random attributes below their pots (n<0 removes). */
export function bumpAny(p: { attrs: AttrRec; pots: AttrRec }, n: number): number {
  let moved = 0;
  for (let i = 0; i < Math.abs(n); i++) {
    const room = ATTRS.filter((a) => (n > 0 ? p.attrs[a] < p.pots[a] : p.attrs[a] > 0));
    if (!room.length) break;
    p.attrs[pick(room)] += n > 0 ? 1 : -1;
    moved++;
  }
  return moved;
}

/** Sprinkle n potential points onto random attributes below the species caps. */
export function bumpAnyPot(p: { pots: AttrRec }, caps: AttrRec, n: number): number {
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const room = ATTRS.filter((a) => p.pots[a] < caps[a]);
    if (!room.length) break;
    p.pots[pick(room)] += 1;
    moved++;
  }
  return moved;
}

// ---- body size (position is the sprite, not a stat) ---------------------------
// Mirrors the rig's size classes: 0=XS 1=S 2=M 3=L 4=XL.

export function sizeIndex(b: { heightCm: number; weightKg: number }): number {
  if (b.weightKg >= 135 && b.heightCm < 212) return 3; // the bruiser build
  if (b.heightCm < 180) return 0;
  if (b.heightCm < 192) return 1;
  if (b.heightCm < 205) return 2;
  return 4;
}

export const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];

// ---- box-score lines ----------------------------------------------------------

export function zeroStats(): StatLine {
  return { gp: 0, pts: 0, reb: 0, stl: 0, ast: 0 };
}

export function addStats(into: StatLine, from: StatLine): void {
  into.gp += from.gp;
  into.pts += from.pts;
  into.reb += from.reb;
  into.stl += from.stl;
  into.ast += from.ast;
}

/** Per-game average, one decimal, '—' when he hasn't played. */
export function perGame(line: StatLine, key: 'pts' | 'reb' | 'stl' | 'ast'): string {
  if (line.gp === 0) return '—';
  return (line[key] / line.gp).toFixed(1);
}
