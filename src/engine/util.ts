// Tiny shared helpers — no imports beyond types, no state.

import type { Attr, AttrRec, GameState, StatLine } from './types';

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

/** Sprinkle n potential points onto random attributes below the 25 scale max.
    (Species caps are dead — the scale and level 10 are the only hard walls.) */
export function bumpAnyPot(p: { pots: AttrRec }, n: number): number {
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const room = ATTRS.filter((a) => p.pots[a] < 25);
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

// ---- pronouns -----------------------------------------------------------------
// One central pass: every story/UI text is written masc and rewritten on the
// fly for femme (she/her) and x (they/them) players. Word-boundary safe,
// handles ALL-CAPS button labels. The x pass also fixes verb agreement:
// auxiliaries pair-mapped, then a "they <verb>s" de-conjugation sweep.

const FEM: Record<string, string> = {
  he: 'she', He: 'She', HE: 'SHE',
  him: 'her', Him: 'Her', HIM: 'HER',
  his: 'her', His: 'Her', HIS: 'HER',
  himself: 'herself', Himself: 'Herself', HIMSELF: 'HERSELF',
};

const XFORM: Record<string, string> = {
  him: 'them', Him: 'Them', HIM: 'THEM',
  his: 'their', His: 'Their', HIS: 'THEIR',
  himself: 'themself', Himself: 'Themself', HIMSELF: 'THEMSELF',
};

/** "he's" is ambiguous (is/has): followed by one of these it means HAS. */
const X_HAS = /^(heard|been|seen|got|gotten|done|earned|stopped|found|taken|learned|made|played|had|left|lost|come|gone|grown|never|already|just)\b/;

const X_AUX: [RegExp, string][] = [
  [/\bhe is\b/g, 'they are'], [/\bHe is\b/g, 'They are'],
  [/\bhe was\b/g, 'they were'], [/\bHe was\b/g, 'They were'],
  [/\bhe has\b/g, 'they have'], [/\bHe has\b/g, 'They have'],
  [/\bhe does\b/g, 'they do'], [/\bHe does\b/g, 'They do'],
  [/\bhe doesn't\b/g, "they don't"], [/\bHe doesn't\b/g, "They don't"],
  [/\bhe isn't\b/g, "they aren't"], [/\bHe isn't\b/g, "They aren't"],
  [/\bhe wasn't\b/g, "they weren't"], [/\bHe wasn't\b/g, "They weren't"],
  [/\bhe hasn't\b/g, "they haven't"], [/\bHe hasn't\b/g, "They haven't"],
  [/\bHE IS\b/g, 'THEY ARE'], [/\bHE PLAYS\b/g, 'THEY PLAY'],
];

/** Not verbs: s-final words that must survive the de-conjugation sweep. */
const X_NOT_VERBS = new Set([
  'always', 'sometimes', 'perhaps', 'across', 'was', 'is', 'has', 'does',
  'less', 'yes', 'its', 'this', 'thus', 'nervous', 'serious', 'curious',
  'famous', 'jealous', 'various', 'previous', 'obvious', 'anxious',
]);

/** they <verb>s → they <verb> (goes→go, watches→watch, carries→carry). */
function deconjugate(v: string): string {
  if (X_NOT_VERBS.has(v)) return v;
  if (/(ch|sh|ss|x|z|o)es$/.test(v)) return v.slice(0, -2);
  if (/[^aeiou]ies$/.test(v)) return `${v.slice(0, -3)}y`;
  if (/[^s]s$/.test(v)) return v.slice(0, -1);
  return v;
}

export function genderize(text: string, form?: 'masc' | 'femme' | 'x'): string {
  if (form === 'femme') {
    return text.replace(/\b(?:he|He|HE|him|Him|HIM|his|His|HIS|himself|Himself|HIMSELF)\b/g, (w) => FEM[w] ?? w);
  }
  if (form !== 'x') return text;
  let t = text;
  // "he's <participle>" → "they've", otherwise "they're"
  t = t.replace(/\b(he|He|HE)'s\s+(\w+)/g, (_m, h: string, next: string) => {
    const they = h === 'he' ? 'they' : h === 'He' ? 'They' : 'THEY';
    const ap = X_HAS.test(next.toLowerCase()) ? "'ve" : "'re";
    return `${they}${ap} ${next}`;
  });
  for (const [re, sub] of X_AUX) t = t.replace(re, sub);
  t = t.replace(/\b(?:him|Him|HIM|his|His|HIS|himself|Himself|HIMSELF)\b/g, (w) => XFORM[w] ?? w);
  t = t.replace(/\bhe\b/g, 'they').replace(/\bHe\b/g, 'They').replace(/\bHE\b/g, 'THEY');
  // verb agreement: the word right after a fresh "they" sheds its 3rd-person
  // s — looking through one adverb ("they always playS" → "they always play")
  t = t.replace(/\b(they|They|THEY)\s+([a-z]+s)\b/g, (m, they: string, verb: string) => {
    const fixed = deconjugate(verb);
    return fixed === verb ? m : `${they} ${fixed}`;
  });
  t = t.replace(/\b(they|They|THEY)\s+(always|sometimes|never|still|just|barely|quietly|only|even)\s+([a-z]+s)\b/g,
    (m, they: string, adv: string, verb: string) => {
      const fixed = deconjugate(verb);
      return fixed === verb ? m : `${they} ${adv} ${fixed}`;
    });
  return t;
}

// ---- box-score lines ----------------------------------------------------------

export function zeroStats(): StatLine {
  return { gp: 0, pts: 0, reb: 0, stl: 0, ast: 0, mvp: 0 };
}

export function addStats(into: StatLine, from: StatLine): void {
  into.gp += from.gp;
  into.pts += from.pts;
  into.reb += from.reb;
  into.stl += from.stl;
  into.ast += from.ast;
  into.mvp = (into.mvp ?? 0) + (from.mvp ?? 0);
}

/** Per-game average, whole numbers, '—' when he hasn't played. */
export function perGame(line: StatLine, key: 'pts' | 'reb' | 'stl' | 'ast'): string {
  if (line.gp === 0) return '—';
  return String(Math.round(line[key] / line.gp));
}

/** A ceiling as a scout sees it: 1–5 stars, one per potential band
    (0–19 / 20–39 / 40–59 / 60–79 / 80–99). */
export function potStars(potOvr: number): number {
  return Math.max(1, Math.min(5, 1 + Math.floor(potOvr / 20)));
}

// ---- JOB SECURITY (v5): four opinions, one gauge ------------------------------
// Deliberately NOT a straight line: the locker room's real mood band (35–100)
// is stretched over the whole PLAYERS track, and the gauge is a weighted
// average DRAGGED by the angriest voice — one furious constituency endangers
// the job even when the others shrug.

export const SEC_PIVOT = 35; // squad mood at or below this = a PLAYERS track of zero
export const SEC_STRETCH = 1.6; // maps the real mood band onto the full track
export const SEC_MIN_BLEND = 0.4; // how hard the angriest voice drags the gauge
export const SEC_NEUTRAL = 60; // where the ledgers drift home
export const SEC_W = { school: 0.3, fans: 0.3, players: 0.25, pub: 0.15 };

export interface OpTracks {
  school: number; // the dean: students, fairness, clean paperwork
  fans: number; // the booster: wins, measured against THE SUCCESS CYCLE
  players: number; // the locker room: squad mood, derived live
  pub: number; // Scoop: fairness, cheating, attention
}

export function opTracks(s: GameState): OpTracks {
  const t = s.teams[s.myTeamId];
  const pool = t?.players ?? [];
  const avgMood = pool.length ? pool.reduce((a, p) => a + p.mood, 0) / pool.length : 60;
  return {
    school: clamp(Math.round(s.opSchool ?? SEC_NEUTRAL), 0, 100),
    fans: clamp(Math.round(s.opFans ?? SEC_NEUTRAL), 0, 100),
    players: clamp(Math.round((avgMood - SEC_PIVOT) * SEC_STRETCH), 0, 100),
    pub: clamp(Math.round(s.opPublic ?? SEC_NEUTRAL), 0, 100),
  };
}

/** JOB SECURITY 0–100. Seasons 1–2 floor at 25 — the school is patient with
    a new coach, for a while. */
export function security(s: GameState): number {
  const o = opTracks(s);
  const avg = o.school * SEC_W.school + o.fans * SEC_W.fans + o.players * SEC_W.players + o.pub * SEC_W.pub;
  const mn = Math.min(o.school, o.fans, o.players, o.pub);
  const sec = Math.round((1 - SEC_MIN_BLEND) * avg + SEC_MIN_BLEND * mn);
  return s.season <= 2 ? clamp(sec, 25, 100) : clamp(sec, 0, 100);
}
