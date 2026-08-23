// The Sprite Lab rig (fromDesign/260822 "Terran Guard Study") — six
// hand-authored 24px species maps that all obey the same contracts:
//   face rows belong to MOOD (5 buckets + side icon: anger cloud / elation star),
//   the ball belongs to ENERGY (bed & zzz → tuck & sweat → dribble → jump shot →
//   whirlwind), SIZE grows height-only in marked rows, ON FIRE is a flame ring
//   that fits any silhouette, and everyone laces up the league high-tops.
// Rendered as a 24-frame sprite sheet (one canvas → data URL, cached), animated
// with a CSS steps() loop — no timers, survives innerHTML re-renders.

import { sizeIndex } from './engine/util';

// ---- the pixel maps (verbatim from the study) -------------------------------

const MASC = [
  '........hhhhhhhh........',
  '.......hhhhhhhhhh.......',
  '.......hhhhhhhhhh.......',
  '.......hsssssssd........',
  '.......hsbbsbbsd........',
  '.......hsekseksd........',
  '.......hssssssdd........',
  '........sskkssd.........',
  '.........sssss..........',
  '..........ssss..........',
  '......jjjjjjjjjjjj......',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ss.jjjjjjjjjJ.ss....',
  '....ss.tttttttttt.ss....',
  '....ssjjjjjjjjjjjJss....',
  '......jjjjjjjjjjjJ......',
  '......jjjjjjjjjjjJ......',
  '......jjjj....jjjJ......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const FEMME = [
  '......hh..hhhh..hh......',
  '......hhhhhhhhhhhh......',
  '.......hhhhhhhhhh.......',
  '.......hssssssdh........',
  '.......hsbbsbbdh........',
  '.......hseksekdh........',
  '.......hssssssdh........',
  '.......hsskkssdh........',
  '.......h.sssss.h........',
  '.......h..ssss..h.......',
  '.......jjjjjjjjjj.......',
  '.....ssjjjjjjjjjJss.....',
  '.....ssjjjjjjjjjJss.....',
  '.....ssjjjjjjjjjJss.....',
  '.....ss.jjjjjjjJ.ss.....',
  '.....ss.jjjjjjjJ.ss.....',
  '.....ss.tttttttt.ss.....',
  '.....ssjjjjjjjjjjss.....',
  '......jjjjjjjjjjjJ......',
  '......jjjjjjjjjjjJ......',
  '......jjjj....jjjJ......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const QUADRAN = [
  '........................',
  '........................',
  '......ssssssssssss......',
  '......ssssssssssss......',
  '......sssbbsbbssss......',
  '......ssseksekssss......',
  '......ssssssssssss......',
  '......sesskksssses......',
  '......ssssssssssss......',
  '....ssssssssssssssss....',
  '......jjjjjjjjjjjj......',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '...ss..jjjjjjjjjJ..ss...',
  '...ss.tttttttttttt.ss...',
  '...ss.jjjjjjjjjjjJ.ss...',
  '...ss.jjjjjjjjjjjJ.ss...',
  '...ss.jjjj....jjjJ.ss...',
  '...ss..ss......ss..ss...',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '.......ss......ss.......',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const HEXID = [
  '........................',
  '........................',
  '........ssssssss........',
  '.......ssssssssss.......',
  '.......ssssssssss.......',
  '.......ssekseksss.......',
  '.......ssssssssss.......',
  '.......ssskksssss.......',
  '.......sdssssssds.......',
  '..........ssss..........',
  '......jjjjjjjjjjjj......',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '......tttttttttttt......',
  '......jjjjjjjjjjjJ......',
  '......jjjjjjjjjjjJ......',
  '......jjjjjjjjjjjJ......',
  '......ss...ss...ss......',
  '......ss...ss...ss......',
  '......ss...ss...ss......',
  '......ss...ss...ss......',
  '......ss...ss...ss......',
  '......ss...ss...ss......',
  '......tt...tt...tt......',
  '.....wwww.wwww.wwww.....',
  '.....waww.waww.waww.....',
  '.....kkkk.kkkk.kkkk.....'];

const PETRAN = [
  '........................',
  '........................',
  '.......ssssssssss.......',
  '.......ssssssssss.......',
  '.......sdbbsbbdss.......',
  '.......ssekseksss.......',
  '.......sdssssssss.......',
  '.......ssskksssss.......',
  '.......ssssssssds.......',
  '..........ssss..........',
  '.....jjjjjjjjjjjjjj.....',
  '...ssjjjjjjjjjjjjjjss...',
  '...ssjjjjjjjjjjjjjjss...',
  '...ssjjjjjjjjjjjjjjss...',
  '...ssjjjjjjjjjjjjjjss...',
  '...ssjjjjjjjjjjjjjJss...',
  '.....tttttttttttttt.....',
  '...ss..............ss...',
  '...ss.jjjjjjjjjjjJ.ss...',
  '......jjjjjjjjjjjJ......',
  '......jjjj....jjjJ......',
  '......sss.....sss.......',
  '......sss.....sss.......',
  '......sss.....sss.......',
  '......sss.....sss.......',
  '......ttt.....ttt.......',
  '.....wwwww...wwwww......',
  '.....wawww...wawww......',
  '.....kkkkk...kkkkk......'];

const NIMBUS = [
  '........................',
  '........................',
  '..........ssss..........',
  '........ssssssss........',
  '........sbbsbbss........',
  '........seksekss........',
  '........ssssssss........',
  '........sskkssss........',
  '........ssssssss........',
  '.......ssssssssss.......',
  '.......jjjjjjjjjj.......',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.......tttttttttt.......',
  '.......ssssssssss.......',
  '........ssssssss........',
  '.........ssssss.........',
  '........ss.ss.ss........',
  '........s...s...s.......',
  '.........s..s...........',
  '..........s.............',
  '........................',
  '........................',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const GELID = [
  '........................',
  '........................',
  '..........ssss..........',
  '........ssssssss........',
  '........sbbsbbss........',
  '........seksekss........',
  '........ssssssss........',
  '........sskkssss........',
  '........ssssssss........',
  '.......ssssssssss.......',
  '.......jjjjjjjjjj.......',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.......tttttttttt.......',
  '.......ssssssssss.......',
  '......ssssssssssss......',
  '......ssssssssssss......',
  '.....ssssssssssssss.....',
  '....ssssssssssssssss....',
  '...ssssssssssssssssss...',
  '..ssssssssssssssssssss..',
  '.ssssssssssssssssssssss.',
  '..ssssssssssssssssssss..',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const PADT = 7, PADR = 6, PADL = 6;
const BALL = ['.OOO.', 'OPOOO', 'QQQQQ', 'OOOOO', '.OOO.'];
const BRICK = ['rrrrrrr', 'RRRRRRR', 'RRRQRRR', 'QQQQQQQ'];
const Z3 = ['111', '010', '111'];
const Z5 = ['11111', '00010', '00100', '01000', '11111'];

interface RigCfg {
  map: string[];
  armL: [number, number];
  armR: [number, number];
  armTop: number;
  armBot: number;
  armGrow: number;
  torsoDup: number;
  legDup: number;
  legTop: number;
  hasLegs: number;
  numOy: number;
  sweatR: number;
  sweatL: number;
  dome?: [number, number][];
  ballPat?: string[];
  alpha?: number;
}

interface RigSpeciesDef {
  masc?: RigCfg;
  femme?: RigCfg;
  cfg?: RigCfg;
  femmeEdits?: [number, number, string][];
}

const RIG: Record<string, RigSpeciesDef> = {
  terran: {
    masc: { map: MASC, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 18, armGrow: 1, torsoDup: 17, legDup: 22, legTop: 22, hasLegs: 1, numOy: 12, sweatR: 17, sweatL: 6,
      dome: [[9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2]] },
    femme: { map: FEMME, armL: [5, 6], armR: [17, 18], armTop: 11, armBot: 17, armGrow: 1, torsoDup: 16, legDup: 21, legTop: 21, hasLegs: 1, numOy: 11, sweatR: 17, sweatL: 6,
      dome: [[9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 2], [14, 2]] },
  },
  quadran: {
    cfg: { map: QUADRAN, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 15, armGrow: 0, torsoDup: 17, legDup: 22, legTop: 21, hasLegs: 1, numOy: 11, sweatR: 18, sweatL: 5 },
    femmeEdits: [[7, 7, 's'], [16, 7, 's'], [8, 5, 'k'], [15, 5, 'k']],
  },
  hexid: {
    cfg: { map: HEXID, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 20, legTop: 19, hasLegs: 1, numOy: 10, sweatR: 17, sweatL: 6 },
    femmeEdits: [[8, 5, 'k'], [15, 5, 'k']],
  },
  petran: {
    cfg: { map: PETRAN, armL: [3, 4], armR: [19, 20], armTop: 11, armBot: 18, armGrow: 1, torsoDup: 16, legDup: 22, legTop: 21, hasLegs: 1, numOy: 11, sweatR: 17, sweatL: 6, ballPat: BRICK },
    femmeEdits: [[7, 2, '.'], [16, 2, '.'], [8, 5, 'k'], [15, 5, 'k']],
  },
  nimbus: {
    cfg: { map: NIMBUS, armL: [5, 6], armR: [17, 18], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 19, legTop: 99, hasLegs: 0, numOy: 10, sweatR: 16, sweatL: 7, alpha: 1 },
    femmeEdits: [[8, 5, 'k'], [14, 5, 'k']],
  },
  gelid: {
    cfg: { map: GELID, armL: [5, 6], armR: [17, 18], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 18, legTop: 99, hasLegs: 0, numOy: 10, sweatR: 16, sweatL: 7 },
    femmeEdits: [[8, 5, 'k'], [14, 5, 'k']],
  },
};

const SKINS_SP: Record<string, string[]> = {
  terran: ['#c08a5e', '#8a5636', '#eab98f', '#5d3a24'],
  quadran: ['#4f9c8b', '#3d7a6d', '#6db5a4', '#2f5f55'],
  hexid: ['#7a5aa8', '#5f4488', '#957ac2', '#493368'],
  petran: ['#8d8377', '#6f665c', '#a89d8f', '#565049'],
  nimbus: ['#93a9cf', '#7a8fb8', '#b0c4e4', '#647899'],
  gelid: ['#78b955', '#5f9a40', '#93d06e', '#487a30'],
};
const HAIRS = ['#3a2a1c', '#14100c', '#c9973f', '#8a3d24'];

function span(y: number, x0: number, x1: number): [number, number][] {
  const a: [number, number][] = [];
  for (let x = x0; x <= x1; x++) a.push([x, y]);
  return a;
}

interface StyleDef { name: string; px: [number, number][]; }

const STYLES: Record<string, StyleDef[]> = {
  masc: [
    { name: 'CROP', px: ([] as [number, number][]).concat(span(0, 8, 15), span(1, 7, 16), span(2, 7, 16), [[7, 3], [7, 4], [7, 5], [7, 6]]) },
    { name: 'BUZZ', px: ([] as [number, number][]).concat(span(1, 9, 14), span(2, 8, 15)) },
    { name: 'AFRO', px: ([] as [number, number][]).concat(span(0, 6, 17), span(1, 6, 17), span(2, 6, 17), [[6, 3], [7, 3], [16, 3], [17, 3], [6, 4], [17, 4]]) },
    { name: 'MOHAWK', px: ([] as [number, number][]).concat(span(0, 11, 12), span(1, 11, 12), span(2, 11, 12)) },
  ],
  femme: [
    { name: 'BUNS', px: ([] as [number, number][]).concat([[6, 0], [7, 0], [10, 0], [11, 0], [12, 0], [13, 0], [16, 0], [17, 0]], span(1, 6, 17), span(2, 7, 16), span(3, 7, 7).concat([[7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8], [15, 9]])) },
    { name: 'PONYTAIL', px: ([] as [number, number][]).concat(span(0, 9, 13), span(1, 8, 14), [[8, 2], [14, 2], [15, 2], [16, 3], [16, 4], [16, 5], [16, 6], [16, 7]]) },
    { name: 'LONG', px: ([] as [number, number][]).concat(span(0, 9, 13), span(1, 8, 14), span(2, 7, 15), [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [15, 3], [15, 4], [15, 5], [15, 6], [15, 7], [15, 8], [15, 9]]) },
    { name: 'PIXIE', px: ([] as [number, number][]).concat(span(0, 9, 13), span(1, 8, 14), [[8, 2], [14, 2], [8, 3]]) },
  ],
  quadran: [
    { name: 'NONE', px: [] },
    { name: 'RIDGE', px: [[8, 1], [10, 1], [12, 1], [14, 1]] },
    { name: 'HORNS', px: [[6, 1], [5, 0], [17, 1], [18, 0]] },
    { name: 'TUFT', px: [[11, 1], [12, 1], [11, 0]] },
  ],
  hexid: [
    { name: 'ANTENNAE', px: [[9, 1], [8, 0], [14, 1], [15, 0]] },
    { name: 'LONG FEELERS', px: [[9, 1], [9, 0], [8, 0], [14, 1], [14, 0], [15, 0]] },
    { name: 'HORN', px: [[11, 1], [12, 1], [11, 0], [12, 0]] },
    { name: 'NONE', px: [] },
  ],
  petran: [
    { name: 'SHARDS', px: [[8, 1], [11, 1], [11, 0], [14, 1]] },
    { name: 'MOSS', px: span(1, 8, 15) },
    { name: 'PEAK', px: [[11, 1], [12, 1], [12, 0]] },
    { name: 'NONE', px: [] },
  ],
  nimbus: [
    { name: 'WISP', px: [[11, 1], [12, 0]] },
    { name: 'TWIN WISP', px: [[9, 1], [10, 0], [13, 1], [14, 0]] },
    { name: 'HALO', px: span(0, 9, 14) },
    { name: 'NONE', px: [] },
  ],
  gelid: [
    { name: 'DROPLETS', px: [[9, 1], [12, 0], [14, 1]] },
    { name: 'SPIKE', px: [[11, 1], [12, 1], [12, 0]] },
    { name: 'TWIN DRIP', px: [[9, 1], [9, 0], [14, 1], [14, 0]] },
    { name: 'NONE', px: [] },
  ],
};

/** Height-only sizing: how many torso (t) and leg (l) rows get duplicated. */
const RIG_SIZES = [
  { t: 0, l: 0 }, // XS
  { t: 1, l: 1 }, // S
  { t: 2, l: 2 }, // M
  { t: 3, l: 4 }, // L
  { t: 5, l: 6 }, // XL
];

export type RigMood = 'angry' | 'upset' | 'neutral' | 'happy' | 'elated';
export type RigEnergy = 'exhausted' | 'tired' | 'normal' | 'fit' | 'pumped';

interface MoodDef { open: boolean; cloud?: boolean; star?: boolean; edits: [number, number, string][]; }
const MOODS: Record<RigMood, MoodDef> = {
  angry: { open: true, cloud: true, edits: [[9, 4, 's'], [9, 3, 'b'], [13, 4, 's'], [13, 3, 'b'], [10, 7, 'k'], [11, 7, 'k'], [9, 8, 'k'], [12, 8, 'k'], [10, 8, 'e'], [11, 8, 'e']] },
  upset: { open: false, edits: [[9, 4, 's'], [10, 4, 's'], [12, 4, 's'], [13, 4, 's'], [9, 5, 'k'], [10, 5, 'k'], [12, 5, 'k'], [13, 5, 'k'], [9, 7, 'k'], [12, 7, 'k']] },
  neutral: { open: true, edits: [] },
  happy: { open: true, edits: [[10, 7, 's'], [11, 7, 's'], [9, 7, 'k'], [12, 7, 'k'], [10, 8, 'k'], [11, 8, 'k']] },
  elated: { open: false, star: true, edits: [[9, 4, 's'], [10, 4, 's'], [12, 4, 's'], [13, 4, 's'], [9, 3, 'b'], [10, 3, 'b'], [12, 3, 'b'], [13, 3, 'b'], [9, 5, 'y'], [10, 5, 'y'], [12, 5, 'y'], [13, 5, 'y'], [9, 7, 'k'], [12, 7, 'k'], [10, 7, 'e'], [11, 7, 'e'], [10, 8, 'k'], [11, 8, 'k']] },
};

interface EnergyDef { bed?: boolean; tuck?: boolean; sweat: number; drop: number; }
const ENERGIES: Record<RigEnergy, EnergyDef> = {
  exhausted: { bed: true, sweat: 0, drop: 0 },
  tired: { tuck: true, sweat: 1, drop: 1 },
  normal: { sweat: 0, drop: 0 },
  fit: { sweat: 0, drop: 0 },
  pumped: { sweat: 0, drop: 0 },
};

/** The live meters map onto the five sprite buckets. */
export function moodBucket(mood: number): RigMood {
  if (mood < 20) return 'angry';
  if (mood < 40) return 'upset';
  if (mood < 65) return 'neutral';
  if (mood < 85) return 'happy';
  return 'elated';
}
export function energyBucket(energy: number): RigEnergy {
  if (energy < 15) return 'exhausted';
  if (energy < 40) return 'tired';
  if (energy < 70) return 'normal';
  if (energy < 90) return 'fit';
  return 'pumped';
}

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
};

function hx(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function hs(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function mul(hex: string, f: number): string {
  const [r, g, b] = hx(hex);
  return hs(r * f, g * f, b * f);
}
function ga(hex: string, a: number): string {
  const [r, g, b] = hx(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export interface Kit {
  bg: string;
  fg: string;
}

/** Unsigned prospects and walk-on tryouts wear the gray practice kit. */
export const PRACTICE_KIT: Kit = { bg: '#3a3f45', fg: '#e4e4e4' };

// seeded flavor (skin tint, hairstyle, socks, wristbands) — stable per player
function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RigView {
  id: number;
  speciesId: string;
  heightCm: number;
  weightKg: number;
  jersey: number | null;
  mood: RigMood;
  energy: RigEnergy;
  fire: boolean;
  form?: 'masc' | 'femme';
}

interface Look { tintIx: number; hairIx: number; styleIx: number; socks: 'none' | 'knee' | 'striped'; wrist: boolean; }

function lookFor(id: number, species: string, form: 'masc' | 'femme'): Look {
  const rng = mulberry((id * 2654435761) >>> 0);
  const styles = species === 'terran' ? STYLES[form] : STYLES[species] ?? STYLES.masc;
  return {
    tintIx: Math.floor(rng() * 4),
    hairIx: Math.floor(rng() * HAIRS.length),
    styleIx: Math.floor(rng() * styles.length),
    socks: rng() < 0.6 ? 'none' : rng() < 0.5 ? 'knee' : 'striped',
    wrist: rng() < 0.25,
  };
}

function pal(species: string, look: Look, kit: Kit): Record<string, string> {
  const skins = SKINS_SP[species] ?? SKINS_SP.terran;
  const skin = skins[look.tintIx];
  const hair = species === 'terran' ? HAIRS[look.hairIx] : mul(skin, 0.55);
  const P: Record<string, string> = {
    s: skin, d: mul(skin, 0.72), h: hair, b: mul(hair, 0.75),
    j: kit.bg, J: mul(kit.bg, 0.7), t: kit.fg, n: kit.fg,
    e: '#f4f6fa', k: '#1a1e2e', m: '#8a3d33', c: '#7fd8ec', y: '#ffd76a',
    O: '#c9752e', Q: '#7d4315', P: '#e08a3c', g: '#4a5268', F: '#fff0bd',
    R: '#a4503c', r: '#c16a52', w: '#ece9e2', a: kit.fg,
  };
  const def = RIG[species];
  if (def?.cfg?.alpha) {
    for (const ch of ['s', 'd', 'h', 'b', 'j', 'J', 't']) P[ch] = ga(P[ch], 0.62);
  }
  return P;
}

function getCfg(species: string, form: 'masc' | 'femme'): RigCfg {
  const def = RIG[species] ?? RIG.terran;
  return def.cfg ?? (form === 'femme' ? def.femme! : def.masc!);
}

// ---- the frame builder (the study's buildMap, ported) -------------------------

function buildMap(
  species: string,
  form: 'masc' | 'femme',
  sizeIx: number,
  mood: RigMood,
  energy: RigEnergy,
  look: Look,
  jersey: number | null,
  fire: boolean,
  f: number
): { map: string[][]; up: number } {
  const cfg = getCfg(species, form);
  const SZ = RIG_SIZES[Math.max(0, Math.min(4, sizeIx))];
  const E = ENERGIES[energy];
  const M = MOODS[mood];
  const def = RIG[species] ?? RIG.terran;
  let map = cfg.map.map((r) => r.split(''));
  if (species === 'terran') {
    for (let y = 0; y <= 9; y++) for (let x = 0; x < 24; x++) if (map[y][x] === 'h') map[y][x] = '.';
    cfg.dome!.forEach(([x, y]) => { map[y][x] = 's'; });
  } else if (form === 'femme' && def.femmeEdits) {
    def.femmeEdits.forEach(([x, y, ch]) => { map[y][x] = ch; });
  }
  const styles = species === 'terran' ? STYLES[form] : STYLES[species] ?? STYLES.masc;
  styles[look.styleIx % styles.length].px.forEach(([x, y]) => { if (map[y]) map[y][x] = 'h'; });
  M.edits.forEach(([x, y, ch]) => { map[y][x] = ch; });
  if (M.open && !E.bed && f >= 14 && f <= 16) {
    map[5][9] = 'k'; map[5][10] = 'e'; map[5][12] = 'k'; map[5][13] = 'e';
  }
  for (let i = 0; i < SZ.l; i++) map.splice(cfg.legDup, 0, map[cfg.legDup].slice());
  for (let i = 0; i < SZ.t; i++) map.splice(cfg.torsoDup, 0, map[cfg.torsoDup - 1].slice());
  const num = jersey === null ? '' : String(jersey).replace(/[^0-9]/g, '').slice(0, 2);
  if (num) {
    const wN = num.length * 4 - 1, ox = 12 - Math.floor(wN / 2), oy = cfg.numOy;
    num.split('').forEach((d, i) => {
      const gph = DIGITS[d];
      if (!gph) return;
      gph.forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '1' && map[oy + ry]) map[oy + ry][ox + i * 4 + rx] = 'N'; }));
    });
  }
  map.forEach((row) => { for (let i = 0; i < PADR; i++) row.push('.'); for (let i = 0; i < PADL; i++) row.unshift('.'); });
  const W = map[0].length;
  for (let i = 0; i < PADT; i++) map.unshift(new Array(W).fill('.') as string[]);
  const H = map.length;

  const t = SZ.t, cx = 12 + PADL;
  const RA = cfg.armR.map((c) => c + PADL), LA = cfg.armL.map((c) => c + PADL);
  const armTop = cfg.armTop + PADT, armEnd = cfg.armBot + (cfg.armGrow ? t : 0) + PADT;
  const legStart = cfg.legTop + t + PADT;
  const pat = cfg.ballPat ?? BALL, patW = pat[0].length, patH = pat.length;
  let up = 0, ball: [number, number] | null = null, raise = false, tornado = false;
  const handPx: [number, number][] = [];

  const dribble = (side: 'R' | 'L', phase: number): void => {
    const cols = side === 'R' ? RA : LA;
    const bx = side === 'R' ? RA[1] + 2 : LA[0] - 1 - patW;
    if (phase === 0) {
      cols.forEach((c) => { map[armEnd][c] = '.'; map[armEnd - 1][c] = '.'; });
      ball = [bx, armEnd - 1];
      handPx.push([bx + 1, armEnd - 2], [bx + 2, armEnd - 2], [bx + 3, armEnd - 2]);
    } else ball = [bx, H - patH];
  };

  if (E.tuck) ball = [RA[0] - 1, armEnd - 4];
  else if (energy === 'normal') { const p = Math.floor(f / 3) % 8; dribble(p < 4 ? 'R' : 'L', p % 2); }
  else if (energy === 'fit') {
    const p = f % 6;
    if (p < 4) { dribble('R', p % 2); up = p % 2 ? 0 : 1; }
    else { up = 2; raise = true; ball = [RA[0] - 2, 1]; }
  } else if (energy === 'pumped') {
    const p = f % 12;
    if (p < 4) { dribble('R', p % 2); up = p % 2 ? 0 : 1; }
    else if (p < 6) { up = 2; raise = true; ball = [RA[0] - 2, 1]; }
    else if (p < 10) tornado = true;
    else { dribble('R', p % 2); up = p % 2 ? 0 : 1; }
  }

  if (E.drop && !E.bed) [LA, RA].forEach((cols) => cols.forEach((c) => {
    for (let i = 0; i < E.drop; i++) {
      if (map[armTop + i]) map[armTop + i][c] = '.';
      const y2 = armEnd + 1 + i;
      if (map[y2] && map[y2][c] === '.') map[y2][c] = 's';
    }
  }));
  if (raise) {
    RA.forEach((c) => {
      for (let y2 = armTop + 1; y2 <= armEnd; y2++) map[y2][c] = '.';
      for (let y2 = PADT + 2; y2 <= PADT + 10; y2++) map[y2][c] = 's';
    });
    map[PADT + 2][RA[0] - 1] = 's'; map[PADT + 3][RA[0] - 1] = 's';
  }

  if (look.socks !== 'none' && cfg.hasLegs) {
    for (let y = legStart; y <= H - 5; y++) for (let x = PADL + 5; x <= PADL + 18; x++)
      if (map[y][x] === 's') map[y][x] = look.socks === 'striped' ? ((y - legStart) % 2 ? 'a' : 'w') : (y === legStart ? 'a' : 'w');
  }
  if (look.wrist) [LA, RA].forEach((cols) => cols.forEach((c) => {
    if (raise && cols === RA) { map[PADT + 4][c] = 'a'; return; }
    let low = -1;
    for (let y = armTop; y <= armEnd + 3; y++) if (map[y] && map[y][c] === 's') low = y;
    if (low > armTop) map[low - 1][c] = 'a';
  }));

  // gelid idle drips
  if (species === 'gelid' && !tornado && !E.bed) {
    const ph = Math.floor(f / 2) % 6;
    if (ph < 4) { const x = PADL + 18, y2 = PADT + 11 + ph * 2; if (map[y2] && map[y2][x] === '.') map[y2][x] = 's'; }
  }

  if (tornado) {
    for (let y = 0; y < H - 4; y++) map[y] = new Array(W).fill('.') as string[];
    const top = PADT + 1, bot = H - 5;
    for (let y = top; y <= bot; y++) {
      const tt = (y - top) / Math.max(1, bot - top);
      const halfw = Math.max(2, Math.round(7 - 5 * tt));
      const c2 = ['j', 'w', 'J'][(y + f) % 3];
      for (let x = cx - halfw; x <= cx + halfw; x++) map[y][x] = c2;
      if ((y * 3 + f) % 5 === 0) { const dx = ((y + f) % 2 ? 1 : -1) * (halfw + 2); if (map[y][cx + dx] === '.') map[y][cx + dx] = 'w'; }
    }
    ball = [f % 2 ? cx + 8 : cx - 12, PADT + 6];
  }

  if (E.bed) {
    for (let y = PADT + 10; y < H; y++) map[y] = new Array(W).fill('.') as string[];
    const bl = cx - 8, br = cx + 8;
    for (let y = PADT + 1; y < H; y++) { map[y][bl] = 'Q'; map[y][br] = 'Q'; }
    for (let x = bl; x <= br; x++) map[H - 1][x] = 'Q';
    for (let y = PADT + 1; y <= PADT + 9; y++) for (let x = bl + 1; x < br; x++) if (map[y][x] === '.') map[y][x] = 'e';
    for (let y = PADT + 10; y <= H - 2; y++) for (let x = bl + 1; x < br; x++) map[y][x] = y <= PADT + 11 ? 'w' : 'j';
    if (map[PADT + 15]) for (let x = bl + 1; x < br; x++) if (map[PADT + 15][x] === 'j') map[PADT + 15][x] = 'J';
    [9, 10, 12, 13].forEach((x) => { map[PADT + 5][x + PADL] = 'k'; });
    const big = Math.floor(f / 3) % 2, Z = big ? Z5 : Z3, zx = br + 2, zy = big ? 0 : 2;
    Z.forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '1' && map[zy + ry] && zx + rx < W) map[zy + ry][zx + rx] = 'c'; }));
    ball = null;
  }

  if (!tornado) {
    if (M.star) {
      const big = Math.floor(f / 3) % 2, sx = PADL + 18, sy = PADT + 1;
      if (big) { map[sy][sx + 1] = 'y'; map[sy + 1][sx] = 'y'; map[sy + 1][sx + 1] = 'e'; map[sy + 1][sx + 2] = 'y'; map[sy + 2][sx + 1] = 'y'; }
      else map[sy + 1][sx + 1] = 'y';
    }
    if (M.cloud) {
      const big = Math.floor(f / 3) % 2, cy = PADT + 1;
      if (big) { for (let x = PADL + 2; x <= PADL + 6; x++) { map[cy][x] = 'g'; map[cy + 1][x] = 'g'; } map[cy][PADL + 2] = '.'; map[cy + 2][PADL + 3] = 'g'; map[cy + 2][PADL + 5] = 'g'; }
      else { for (let x = PADL + 3; x <= PADL + 5; x++) map[cy + 1][x] = 'g'; }
    }
  }

  if (E.sweat) {
    const ph = Math.floor(f / 2) % 6;
    if (ph < 4) { const x = cfg.sweatR + PADL, y2 = PADT + 3 + ph * 2; if (map[y2] && map[y2][x] === '.') map[y2][x] = 'c'; }
  }

  // ON FIRE: a flame ring hugging whatever silhouette this body has
  if (fire) {
    const solid = (y: number, x: number): boolean => !!(map[y] && map[y][x] && map[y][x] !== '.');
    const ring: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (map[y][x] === '.' && (solid(y + 1, x) || solid(y - 1, x) || solid(y, x + 1) || solid(y, x - 1))) ring.push([x, y]);
    const tips: [number, number][] = [];
    ring.forEach(([x, y]) => {
      const h2 = (x * 7 + y * 11 + f * 3) % 5;
      if (h2 < 2) map[y][x] = 'e'; else if (h2 < 4) map[y][x] = 'F';
      if (map[y - 1] && map[y - 1][x] === '.' && (x * 5 + y * 3 + f) % 4 === 0) tips.push([x, y - 1]);
    });
    tips.forEach(([x, y]) => { map[y][x] = (x + f) % 2 ? 'F' : 'y'; });
  }

  if (ball) {
    const b: [number, number] = ball;
    pat.forEach((row, ry) => row.split('').forEach((ch, rx) => {
      const yy = b[1] + ry, xx = b[0] + rx;
      if (ch !== '.' && map[yy] && xx >= 0 && xx < W) map[yy][xx] = ch;
    }));
  }
  if (E.tuck && ball) RA.forEach((c) => { for (let y2 = armTop + E.drop; y2 <= armEnd; y2++) if (map[y2]) map[y2][c] = 's'; });
  handPx.forEach(([x, y2]) => { if (map[y2]) map[y2][x] = 's'; });
  return { map, up };
}

// ---- the sprite sheet: 24 frames → one data URL → a CSS steps() loop ----------

const FRAMES = 24;
const FRAME_MS = 190;

const sheetCache = new Map<string, { url: string; w: number; h: number }>();

function buildSheet(v: RigView, kit: Kit): { url: string; w: number; h: number } {
  const form = v.form ?? 'masc';
  const look = lookFor(v.id, v.speciesId, form);
  const P = pal(v.speciesId, look, kit);
  const sizeIx = sizeIndex(v);
  const first = buildMap(v.speciesId, form, sizeIx, v.mood, v.energy, look, v.jersey, v.fire, 0);
  const W = first.map[0].length;
  const H = first.map.length + 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (let f = 0; f < FRAMES; f++) {
    const { map, up } = f === 0 ? first : buildMap(v.speciesId, form, sizeIx, v.mood, v.energy, look, v.jersey, v.fire, f);
    const ox = f * W;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < W; x++) {
      const ch = map[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'N' ? P.n : P[ch] ?? '#ff00ff';
      ctx.fillRect(ox + x, y + 2 - up, 1, 1);
    }
  }
  return { url: canvas.toDataURL(), w: W, h: H };
}

/** The animated sprite as an HTML element (background sprite sheet + CSS loop). */
export function rigSpriteHtml(v: RigView, kit: Kit, scale: number, cls = ''): string {
  const key = `${v.id}|${v.speciesId}|${v.form ?? 'masc'}|${sizeIndex(v)}|${v.mood}|${v.energy}|${v.fire ? 1 : 0}|${kit.bg}|${kit.fg}|${v.jersey ?? 'x'}`;
  let sheet = sheetCache.get(key);
  if (!sheet) {
    sheet = buildSheet(v, kit);
    sheetCache.set(key, sheet);
  }
  const w = sheet.w * scale;
  const h = sheet.h * scale;
  return `<span class="rig ${cls}" style="width:${w}px;height:${h}px;--rigshift:-${w * FRAMES}px;--rigdur:${FRAMES * FRAME_MS}ms;background-image:url(${sheet.url});background-size:${w * FRAMES}px ${h}px"></span>`;
}

// ---- single-color pixel stat icons (unchanged) --------------------------------

type IconKind = 'bolt' | 'aplus' | 'dollar' | 'alert';

const ICON_PIXELS: Record<IconKind, string[]> = {
  // low-cells warning
  alert: [
    '...XXX...',
    '...XXX...',
    '...XXX...',
    '...XXX...',
    '....X....',
    '.........',
    '...XXX...',
    '...XXX...',
    '.........',
  ],
  // thunderbolt
  bolt: [
    '....XXXX.',
    '...XXXX..',
    '..XXXX...',
    '.XXXXXXX.',
    '...XXXX..',
    '..XXXX...',
    '.XXXX....',
    '.XXX.....',
    '.XX......',
  ],
  // A+ (the school side of job security)
  aplus: [
    '.........',
    '.XX....X.',
    'X..X..XXX',
    'X..X...X.',
    'XXXX.....',
    'X..X.....',
    'X..X.....',
    '.........',
    '.........',
  ],
  // $ (the money side of job security)
  dollar: [
    '....X....',
    '..XXXXX..',
    '.X..X..X.',
    '.X..X....',
    '..XXXXX..',
    '....X..X.',
    '.X..X..X.',
    '..XXXXX..',
    '....X....',
  ],
};

const iconCache = new Map<string, string>();

export function iconUrl(kind: IconKind, color = '#7dfc9a'): string {
  const key = `${kind}|${color}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 9;
  c.height = 9;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ICON_PIXELS[kind].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') ctx.fillRect(x, y, 1, 1);
  });
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
