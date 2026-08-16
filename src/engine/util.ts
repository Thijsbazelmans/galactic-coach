// Tiny shared helpers — no imports, no state.

import type { Player, Pole } from './types';

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

// ---- stars ------------------------------------------------------------------
// 1★ 0–30 · 2★ 20–50 · 3★ 40–70 · 4★ 60–90 · 5★ 80+ (10-pt overlaps).
// Canonical star uses the 20-step midpoints; the overlap fuzz is expressed by
// scouting error (±1 star on a first look).

export function star(v: number): number {
  if (v < 20) return 1;
  if (v < 40) return 2;
  if (v < 60) return 3;
  if (v < 80) return 4;
  return 5;
}

export function starStr(n: number): string {
  return '★'.repeat(clamp(n, 1, 5)) + '☆'.repeat(5 - clamp(n, 1, 5));
}

// ---- pole leans ---------------------------------------------------------------
// An axis is one integer 0–100 (50 = center). Lean = distance toward a pole.

export function lean(p: { build: number; head: number }, pole: Pole): number {
  switch (pole) {
    case 'strong': return Math.max(0, (50 - p.build) * 2);
    case 'quick': return Math.max(0, (p.build - 50) * 2);
    case 'fierce': return Math.max(0, (50 - p.head) * 2);
    case 'savvy': return Math.max(0, (p.head - 50) * 2);
  }
}

/** Meters MUTE the dot: energy suppresses BUILD leans, mood suppresses HEAD leans. */
export function effLean(p: Player, pole: Pole): number {
  const raw = lean(p, pole);
  const meter = pole === 'strong' || pole === 'quick' ? p.energy : p.mood;
  return raw * Math.max(0.3, meter / 100);
}

/** The pole a player leans toward most (for flavor + AI plans). */
export function mainPole(p: { build: number; head: number }): Pole {
  const poles: Pole[] = ['strong', 'quick', 'fierce', 'savvy'];
  return poles.reduce((best, pl) => (lean(p, pl) > lean(p, best) ? pl : best), 'strong');
}
