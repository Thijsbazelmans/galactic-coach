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
  '.ss...sesssssssses...ss.',
  '..s...sesskksssses...s..',
  '...s..ssssssssssss..s...',
  '....ssssssssssssssss....',
  '......jjjjjjjjjjjj......',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '.......jjjjjjjjjJ.......',
  '......tttttttttttt......',
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

const HEXID = [
  '........................',
  '........................',
  '........ssssssss........',
  '.......ssssssssss.......',
  '.......ssssssssss.......',
  '.......ssekseksss.......',
  '.......ssssssssss.......',
  '.......ssskksssss.......',
  '.......ddssssssdd.......',
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
  '.......ssssssdsss.......',
  '.......sdbbsbbdss.......',
  '.......ssekseksss.......',
  '.......sddsssssss.......',
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
  '......sds.....sds.......',
  '......sss.....sss.......',
  '......sss.....sss.......',
  '......ttt.....ttt.......',
  '.....wwwww...wwwww......',
  '.....wawww...wawww......',
  '.....kkkkk...kkkkk......'];

const NIMBUS = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.........ee.ee..........',
  '.........ek.ek..........',
  '..........s..s..........',
  '........sskkssss........',
  '........ssssssss........',
  '.......ssssssssss.......',
  '.......jjjjjjjjjj.......',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.....ssjjjjjjjjjjss.....',
  '.......tttttttttt.......',
  '.......ssssesssss.......',
  '........ssesssss........',
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
  '.......ssssssssss.......',
  '.....ssssssssssssss.....',
  '.....ssssssssssssss.....',
  '......ssssssssssss......',
  '....ssssssssssssssss....',
  '....ssssssssssssssss....',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const ROBOTA = [
  '........................',
  '........................',
  '.......ssssssssss.......',
  '.......sdssssssds.......',
  '.......ssssssssss.......',
  '.......sdeksekdss.......',
  '.......ssssssssss.......',
  '.......sdskksdsss.......',
  '.......ssssssssss.......',
  '..........dddd..........',
  '......jjjjjjjjjjjj......',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '....ssjjjjjjjjjjjJss....',
  '......tttttttttttt......',
  '......jjjjjjjjjjjJ......',
  '......jjjjjjjjjjjJ......',
  '......jjjj....jjjJ......',
  '.......ss......ss.......',
  '.......sd......sd.......',
  '.......ss......ss.......',
  '.......sd......sd.......',
  '.......ss......ss.......',
  '......tttt....tttt......',
  '......wwww....wwww......',
  '......waww....waww......',
  '......kkkk....kkkk......'];

const OCULID = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.........ee.ee..........',
  '.........ek.ek..........',
  '..........s..s..........',
  '.........skksss.........',
  '.........ssssss.........',
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
  '.....ss..ss..ss..ss.....',
  '.....ss..ss..ss..ss.....',
  '.....ss..ss..ss..ss.....',
  '.....ss..ss..ss..ss.....',
  '.....ss..ss..ss..ss.....',
  '.....ss..ss..ss..ss.....',
  '.....tt..tt..tt..tt.....',
  '....www.www.www.www.....',
  '....waw.waw.waw.waw.....',
  '....kkk.kkk.kkk.kkk.....'];

const PADT = 7, PADR = 6, PADL = 6;
const BALL = ['.OOO.', 'OQPQO', 'QQQQQ', 'OQOQO', '.OOO.'];
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
    femmeEdits: [[7, 6, 's'], [16, 6, 's'], [7, 7, 's'], [16, 7, 's'], [8, 5, 'k'], [15, 5, 'k'], [6, 2, '.'], [17, 2, '.'], [6, 14, '.'], [17, 14, '.'], [16, 14, 'J'], [6, 15, '.'], [17, 15, '.'], [16, 15, 'J'], [11, 1, 'h'], [12, 1, 'h']],
  },
  hexid: {
    cfg: { map: HEXID, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 20, legTop: 19, hasLegs: 1, numOy: 10, sweatR: 17, sweatL: 6 },
    femmeEdits: [[8, 5, 'k'], [15, 5, 'k'], [6, 13, '.'], [17, 13, '.'], [16, 13, 'J'], [6, 14, '.'], [17, 14, '.'], [16, 14, 'J'], [5, 18, 'j'], [18, 18, 'j'], [8, 1, 'h'], [15, 1, 'h']],
  },
  petran: {
    cfg: { map: PETRAN, armL: [3, 4], armR: [19, 20], armTop: 11, armBot: 18, armGrow: 1, torsoDup: 16, legDup: 22, legTop: 21, hasLegs: 1, numOy: 11, sweatR: 17, sweatL: 6 },
    femmeEdits: [[7, 2, '.'], [16, 2, '.'], [7, 8, '.'], [16, 8, '.'], [8, 5, 'k'], [15, 5, 'k'], [5, 14, '.'], [18, 14, '.'], [5, 15, '.'], [18, 15, '.'], [17, 15, 'J'], [10, 1, 'h'], [13, 1, 'h']],
  },
  nimbus: {
    cfg: { map: NIMBUS, armL: [5, 6], armR: [17, 18], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 19, legTop: 99, hasLegs: 0, numOy: 10, sweatR: 16, sweatL: 7, alpha: 1 },
    femmeEdits: [[8, 4, 'k'], [14, 4, 'k'], [7, 13, '.'], [16, 13, '.'], [7, 14, '.'], [16, 14, '.'], [10, 23, 's'], [14, 23, 's'], [10, 1, 'h'], [13, 1, 'h']],
  },
  gelid: {
    cfg: { map: GELID, armL: [5, 6], armR: [17, 18], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 18, legTop: 99, hasLegs: 0, numOy: 10, sweatR: 16, sweatL: 7 },
    femmeEdits: [[8, 5, 'k'], [14, 5, 'k'], [5, 19, '.'], [18, 19, '.'], [4, 20, '.'], [19, 20, '.'], [10, 1, 'h'], [13, 1, 'h']],
  },
  robota: {
    cfg: { map: ROBOTA, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 15, armGrow: 1, torsoDup: 16, legDup: 22, legTop: 20, hasLegs: 1, numOy: 11, sweatR: 17, sweatL: 6 },
    femmeEdits: [[8, 5, 'k'], [15, 5, 'k'], [7, 2, '.'], [16, 2, '.'], [7, 8, '.'], [16, 8, '.'], [6, 14, '.'], [17, 14, '.'], [16, 14, 'J'], [6, 15, '.'], [17, 15, '.'], [16, 15, 'J'], [9, 1, 'h'], [14, 1, 'h']],
  },
  oculid: {
    cfg: { map: OCULID, armL: [4, 5], armR: [18, 19], armTop: 11, armBot: 14, armGrow: 1, torsoDup: 15, legDup: 20, legTop: 19, hasLegs: 1, numOy: 11, sweatR: 15, sweatL: 7 },
    femmeEdits: [[8, 4, 'k'], [14, 4, 'k'], [6, 13, '.'], [17, 13, '.'], [16, 13, 'J'], [6, 14, '.'], [17, 14, '.'], [16, 14, 'J'], [11, 3, 'h'], [12, 3, 'h']],
  },
};

const SKINS_SP: Record<string, string[]> = {
  terran: ['#c08a5e', '#8a5636', '#eab98f', '#5d3a24'],
  quadran: ['#4f9c8b', '#3d7a6d', '#6db5a4', '#2f5f55'],
  hexid: ['#7a5aa8', '#5f4488', '#957ac2', '#493368'],
  petran: ['#8d8377', '#6f665c', '#a89d8f', '#565049'],
  nimbus: ['#93a9cf', '#7a8fb8', '#b0c4e4', '#647899'],
  gelid: ['#78b955', '#5f9a40', '#93d06e', '#487a30'],
  robota: ['#9aa3b5', '#7c8598', '#b8c1d1', '#5f6878'],
  oculid: ['#c9a53f', '#a37f2c', '#e0c05e', '#7c5f1f'],
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
    { name: 'RIDGE', px: [[8, 1], [8, 0], [10, 1], [12, 1], [12, 0], [14, 1]] },
    { name: 'HORNS', px: [[6, 1], [6, 0], [5, 0], [17, 1], [17, 0], [18, 0]] },
    { name: 'TUFT', px: [[10, 1], [11, 1], [12, 1], [13, 1], [11, 0], [12, 0]] },
  ],
  hexid: [
    { name: 'ANTENNAE', px: [[9, 1], [9, 0], [8, 0], [14, 1], [14, 0], [15, 0]] },
    { name: 'LONG FEELERS', px: [[9, 1], [9, 0], [8, 0], [7, 0], [14, 1], [14, 0], [15, 0], [16, 0]] },
    { name: 'HORN', px: [[11, 1], [12, 1], [11, 0], [12, 0]] },
    { name: 'NONE', px: [] },
  ],
  petran: [
    { name: 'SHARDS', px: [[8, 1], [8, 0], [11, 1], [11, 0], [12, 1], [14, 1], [14, 0]] },
    { name: 'MOSS', px: span(1, 8, 15).concat([[9, 0], [13, 0]]) },
    { name: 'PEAK', px: [[11, 1], [12, 1], [11, 0], [12, 0]] },
    { name: 'NONE', px: [] },
  ],
  nimbus: [
    { name: 'WISP', px: [[11, 1], [11, 0], [12, 1], [12, 0]] },
    { name: 'TWIN WISP', px: [[9, 1], [9, 0], [10, 0], [13, 1], [14, 0], [14, 1]] },
    { name: 'HALO', px: span(0, 9, 14) },
    { name: 'NONE', px: [] },
  ],
  gelid: [
    { name: 'DROPLETS', px: [[9, 1], [9, 0], [12, 0], [12, 1], [14, 1], [14, 0]] },
    { name: 'SPIKE', px: [[11, 1], [12, 1], [11, 0], [12, 0]] },
    { name: 'TWIN DRIP', px: [[9, 1], [9, 0], [14, 1], [14, 0]] },
    { name: 'NONE', px: [] },
  ],
  robota: [
    { name: 'ANTENNA', px: [[11, 1], [11, 0], [12, 0]] },
    { name: 'DISH', px: span(1, 9, 14).concat([[11, 0], [12, 0]]) },
    { name: 'SPIKES', px: [[8, 1], [8, 0], [11, 1], [11, 0], [14, 1], [14, 0]] },
    { name: 'NONE', px: [] },
  ],
  oculid: [
    { name: 'NONE', px: [] },
    { name: 'FUZZ', px: [[8, 3], [9, 3], [13, 3], [14, 3]] },
    { name: 'THIRD STALK', px: [[11, 3], [11, 2], [11, 1]] },
    { name: 'HORNS', px: [[8, 3], [8, 2], [15, 3], [15, 2]] },
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
export type RigEnergy = 'exhausted' | 'tired' | 'normal' | 'fit' | 'pumped' | 'pod';

interface MoodDef { open: boolean; cloud?: boolean; star?: boolean; edits: [number, number, string][]; }
const MOODS: Record<RigMood, MoodDef> = {
  angry: { open: true, cloud: true, edits: [[9, 4, 's'], [9, 3, 'b'], [13, 4, 's'], [13, 3, 'b'], [10, 7, 'k'], [11, 7, 'k'], [9, 8, 'k'], [12, 8, 'k'], [10, 8, 'e'], [11, 8, 'e']] },
  upset: { open: false, edits: [[9, 4, 's'], [10, 4, 's'], [12, 4, 's'], [13, 4, 's'], [9, 5, 'k'], [10, 5, 'k'], [12, 5, 'k'], [13, 5, 'k'], [9, 7, 'k'], [12, 7, 'k']] },
  neutral: { open: true, edits: [] },
  happy: { open: true, edits: [[10, 7, 's'], [11, 7, 's'], [9, 7, 'k'], [12, 7, 'k'], [10, 8, 'k'], [11, 8, 'k']] },
  elated: { open: false, star: true, edits: [[9, 4, 's'], [10, 4, 's'], [12, 4, 's'], [13, 4, 's'], [9, 3, 'b'], [10, 3, 'b'], [12, 3, 'b'], [13, 3, 'b'], [9, 5, 'y'], [10, 5, 'y'], [12, 5, 'y'], [13, 5, 'y'], [9, 7, 'k'], [12, 7, 'k'], [10, 7, 'e'], [11, 7, 'e'], [10, 8, 'k'], [11, 8, 'k']] },
};

/** pod = the cryo chamber (exhausted sleeps in it with zzz; a player OUT —
    injured or away — stands in it, no zzz) */
interface EnergyDef { bed?: boolean; zzz?: boolean; tuck?: boolean; sweat: number; drop: number; }
const ENERGIES: Record<RigEnergy, EnergyDef> = {
  exhausted: { bed: true, zzz: true, sweat: 0, drop: 0 },
  pod: { bed: true, sweat: 0, drop: 0 },
  tired: { tuck: true, sweat: 1, drop: 1 },
  normal: { sweat: 0, drop: 0 },
  fit: { sweat: 0, drop: 0 },
  pumped: { sweat: 0, drop: 0 },
};

/** The live meters map onto the five sprite buckets. The baseline (75) reads
    NEUTRAL/NORMAL — the outer buckets belong to stories, streaks and items. */
export function moodBucket(mood: number): RigMood {
  if (mood < 25) return 'angry';
  if (mood < 50) return 'upset';
  if (mood < 85) return 'neutral';
  if (mood < 95) return 'happy';
  return 'elated';
}
export function energyBucket(energy: number): RigEnergy {
  if (energy < 15) return 'exhausted';
  if (energy < 40) return 'tired';
  if (energy < 85) return 'normal';
  if (energy < 95) return 'fit';
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
  /** x (they/them) renders the base chassis — the x species share one body */
  form?: 'masc' | 'femme' | 'x';
  /** story acting: the STATE comes from the news, not the meters — worried
      (sweating) while the question hangs, then the verdict. The player
      walks in neutral and breaks into the emotion (bad = angry + sweat,
      good = elated). No ball in a story. 'neutral' is the anticipation beat:
      the player just stands there — the mood lands with the reveal. */
  story?: 'good' | 'bad' | 'worried' | 'neutral';
  /** the calm poses of the lineup and box-score screens: BENCH sits on a
      little bench (no ball), SHRUG stands still in street clothes and
      shrugs now and then (the reserves' "we'll see") */
  pose?: 'bench' | 'shrug';
}

/** Street clothes for the reserves: a grey hoodie, no number. */
export const STREET_KIT: Kit = { bg: '#4a4f57', fg: '#b9bec9' };

interface Look { tintIx: number; hairIx: number; styleIx: number; socks: 'none' | 'knee' | 'striped'; wrist: boolean; }

/** The player's actual skin tone (for UI accents like the species line). */
export function skinTone(speciesId: string, id: number): string {
  const skins = SKINS_SP[speciesId] ?? SKINS_SP.terran;
  const rng = mulberry((id * 2654435761) >>> 0);
  return skins[Math.floor(rng() * 4)];
}

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
    B: 'rgba(190,225,255,0.75)', V: 'rgba(130,190,255,0.45)', U: 'rgba(160,215,255,0.25)',
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
  f: number,
  story?: 'good' | 'bad' | 'worried' | 'neutral',
  pose?: 'bench' | 'shrug'
): { map: string[][]; up: number } {
  const cfg = getCfg(species, form);
  const SZ = RIG_SIZES[Math.max(0, Math.min(4, sizeIx))];
  const E = story ? ENERGIES.normal : ENERGIES[energy];
  // story acting: neutral for a beat, then the emotion takes over —
  // WORRIED holds the whole loop (he came to you sweating)
  const moodKey: RigMood = story
    ? story === 'neutral' ? 'neutral' : story === 'worried' ? 'upset' : f < 8 ? 'neutral' : story === 'bad' ? 'angry' : 'elated'
    : mood;
  const M = MOODS[moodKey];
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
  if (moodKey === 'angry' && (species === 'hexid' || species === 'robota')) {
    // no baked brows + low-contrast crest color: draw full dark angry brows
    map[3][9] = 'k'; map[3][13] = 'k'; map[4][10] = 'k'; map[4][12] = 'k';
  }
  if (species === 'nimbus' || species === 'oculid') {
    // stalk eyes: moods must never eat the eyeball tops
    [9, 10, 12, 13].forEach((x) => { if (map[4][x] === 's') map[4][x] = 'e'; });
    if (moodKey === 'angry') { // floating angled brows above the stalks
      map[3][9] = '.'; map[3][13] = '.';
      map[2][9] = 'k'; map[3][10] = 'k'; map[3][12] = 'k'; map[2][13] = 'k';
    }
  }
  // ON THE BENCH everybody's legs are the same length (the shortest) — one
  // bench height, the shorts always landing on the same plank; the torso
  // keeps the player's real height above it
  const legDupN = pose === 'bench' ? 0 : SZ.l;
  for (let i = 0; i < legDupN; i++) map.splice(cfg.legDup, 0, map[cfg.legDup].slice());
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

  if (story || pose) { /* stands and feels — no ball in a story, none on the bench, none in street clothes */ }
  else if (E.tuck) ball = [RA[0] - 1, armEnd - 4];
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

  if (pose === 'shrug' && f % 16 >= 9 && f % 16 <= 13) {
    // THE SHRUG: the arms ride up two rows and the palms turn out
    [LA, RA].forEach((cols) => cols.forEach((c) => {
      for (let y2 = armTop; y2 <= armEnd; y2++) if (map[y2 - 2] && map[y2]) map[y2 - 2][c] = map[y2][c];
      if (map[armEnd]) map[armEnd][c] = '.';
      if (map[armEnd - 1]) map[armEnd - 1][c] = '.';
    }));
    if (map[armEnd - 3]) { map[armEnd - 3][LA[0] - 1] = 's'; map[armEnd - 3][RA[1] + 1] = 's'; }
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

  // nimbus: tentacle wisps sway
  if (species === 'nimbus' && !tornado && !E.bed) {
    const rs = PADT + 19 + t, re = H - 7;
    for (let y = rs; y <= re; y++) {
      const ph = (y + Math.floor(f / 2)) % 4;
      if (ph === 0 && map[y]) { map[y].pop(); map[y].unshift('.'); }
      else if (ph === 2 && map[y]) { map[y].shift(); map[y].push('.'); }
    }
  }
  // gelid: rings ripple vertically like water + idle side drips
  if (species === 'gelid' && !tornado && !E.bed) {
    const rs = PADT + 16 + t, re = H - 6;
    for (let y = rs; y <= re; y++) {
      const ph = (y + Math.floor(f / 2)) % 4;
      if (ph === 0 && map[y]) { map[y].pop(); map[y].unshift('.'); }
      else if (ph === 2 && map[y]) { map[y].shift(); map[y].push('.'); }
    }
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
    // THE CRYO POD: a capsule around the whole body — rounded lid, straight
    // glass sides, a base plate — cold tint inside, frost drifting up. The
    // exhausted sleep in it (zzz); the injured and the away just stand in it.
    const bl = Math.max(0, cx - 9), br = Math.min(W - 1, cx + 9);
    for (let y = 3; y < H; y++) { map[y][bl] = 'g'; map[y][br] = 'g'; }
    for (let x = bl + 2; x <= br - 2; x++) map[2][x] = 'g';
    map[3][bl + 1] = 'g'; map[3][br - 1] = 'g';
    for (let x = bl; x <= br; x++) map[H - 1][x] = 'g';
    for (let x = bl + 1; x < br; x++) if (map[H - 2][x] === '.') map[H - 2][x] = 'k';
    for (let y = 3; y < H - 2; y++) for (let x = bl + 1; x < br; x++) {
      if (map[y][x] !== '.') continue;
      map[y][x] = (x * 7 + y * 3 + Math.floor(f / 4)) % 11 === 0 ? 'c' : 'U';
    }
    if (E.zzz) {
      const big = Math.floor(f / 3) % 2, Z = big ? Z5 : Z3, zx = br - 5, zy = 0;
      Z.forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '1' && map[zy + ry] && zx + rx < W && map[zy + ry][zx + rx] === '.') map[zy + ry][zx + rx] = 'c'; }));
    }
    ball = null;
  }

  // ON FIRE first — the ring must never eat mood icons, sweat or zzz
  if (fire) {
    const solid = (y: number, x: number): boolean => !!(map[y] && map[y][x] && map[y][x] !== '.' && map[y][x] !== 'c');
    const ring: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (map[y][x] === '.' && (solid(y + 1, x) || solid(y - 1, x) || solid(y, x + 1) || solid(y, x - 1))) ring.push([x, y]);
    const tips: [number, number][] = [];
    ring.forEach(([x, y]) => {
      const h2 = (x * 7 + y * 11 + f * 3) % 5;
      if (h2 < 2) map[y][x] = 'B'; else if (h2 < 4) map[y][x] = 'V';
      if (map[y - 1] && map[y - 1][x] === '.' && (x * 5 + y * 3 + f) % 4 === 0) tips.push([x, y - 1]);
    });
    tips.forEach(([x, y]) => { map[y][x] = (x + f) % 2 ? 'V' : 'U'; });
  }

  if (!tornado) {
    if (M.star) {
      const big = Math.floor(f / 3) % 2, sx = PADL + 18, sy = PADT + 1;
      if (big) { map[sy][sx + 1] = 'y'; map[sy + 1][sx] = 'y'; map[sy + 1][sx + 1] = 'e'; map[sy + 1][sx + 2] = 'y'; map[sy + 2][sx + 1] = 'y'; }
      else map[sy + 1][sx + 1] = 'y';
    }
    if (M.cloud) { // a little skull, pulsing like the star
      const big = Math.floor(f / 3) % 2, cy = PADT, cx0 = PADL + 1;
      const SK_BIG = ['.eeeee.', 'ekeeeke', 'eeekeee', '.eeeee.', '.e.e.e.'];
      const SK_SM = ['..eee..', '.ekeke.', '..eee..'];
      (big ? SK_BIG : SK_SM).forEach((row, ry) => row.split('').forEach((v, rx) => {
        if (v !== '.' && map[cy + ry]) map[cy + ry][cx0 + rx] = v;
      }));
    }
  }

  if (E.sweat || story === 'worried' || (story === 'bad' && f >= 8)) {
    const ph = Math.floor(f / 2) % 6;
    if (ph < 4) { const x = cfg.sweatR + PADL, y2 = PADT + 3 + ph * 2; if (map[y2] && map[y2][x] === '.') map[y2][x] = 'c'; }
  }

  if (pose === 'bench' && cfg.hasLegs) {
    // THE BENCH sits BEHIND him, his seat ON it: the plank runs through the
    // shorts (the belt a couple of pixels above it, shorts above and below),
    // its ends showing either side, its legs dropping behind his — his own
    // legs and shoes stick out under it. Drawn only into empty pixels, and
    // after the fire ring, so the flames stay on the player.
    const py = legStart - 1; // two pixels lower than the first cut — a lower bench
    const bl = Math.max(0, cx - 11), br = Math.min(W - 1, cx + 11);
    for (const y2 of [py, py + 1]) for (let x = bl; x <= br; x++) if (map[y2] && map[y2][x] === '.') map[y2][x] = y2 === py ? 'P' : 'Q';
    for (let y2 = py + 2; y2 < H; y2++) for (const x of [bl + 1, br - 1]) if (map[y2] && map[y2][x] === '.') map[y2][x] = 'Q';
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

/** dev handle: the frame builder, for ASCII checks of new poses */
export const __rigDebug = { buildMap, lookFor };

// ---- the sprite sheet: 24 frames → one data URL → a CSS steps() loop ----------

const FRAMES = 24;
const FRAME_MS = 190;

const sheetCache = new Map<string, { url: string; w: number; h: number }>();

function buildSheet(v: RigView, kit: Kit): { url: string; w: number; h: number } {
  const form = v.form === 'femme' ? 'femme' : 'masc';
  const look = lookFor(v.id, v.speciesId, form);
  const P = pal(v.speciesId, look, kit);
  const sizeIx = sizeIndex(v);
  const first = buildMap(v.speciesId, form, sizeIx, v.mood, v.energy, look, v.jersey, v.fire, 0, v.story, v.pose);
  const W = first.map[0].length;
  const H = first.map.length + 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (let f = 0; f < FRAMES; f++) {
    const { map, up } = f === 0 ? first : buildMap(v.speciesId, form, sizeIx, v.mood, v.energy, look, v.jersey, v.fire, f, v.story, v.pose);
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
  const key = `${v.id}|${v.speciesId}|${v.form ?? 'masc'}|${sizeIndex(v)}|${v.mood}|${v.energy}|${v.fire ? 1 : 0}|${v.story ?? '-'}|${v.pose ?? '-'}|${kit.bg}|${kit.fg}|${v.jersey ?? 'x'}`;
  let sheet = sheetCache.get(key);
  if (!sheet) {
    sheet = buildSheet(v, kit);
    sheetCache.set(key, sheet);
  }
  const w = sheet.w * scale;
  const h = sheet.h * scale;
  // the loop is synced to the WALL CLOCK (negative delay), so a re-render
  // resumes at the same frame — cards never jump or "dance" when the screen
  // repaints (selection, stickers, swaps)
  const dur = FRAMES * FRAME_MS;
  const phase = Math.round(performance.now()) % dur;
  return `<span class="rig ${cls}" style="width:${w}px;height:${h}px;--rigshift:-${w * FRAMES}px;--rigdur:${dur}ms;animation-delay:-${phase}ms;background-image:url(${sheet.url});background-size:${w * FRAMES}px ${h}px"></span>`;
}

// ---- the team bus: a spaceship with a jersey-stripe soul ----------------------
// Shown on travel beats. Body in kit color, trim stripe in the accent, flame out
// the back, cockpit up front. One hand-placed map, cached per kit.

const BUS_MAP = [
  '............................',
  '.......bbbbbbbbbbbbbbbbb....',
  '.....bbbbbbbbbbbbbbbbbbbb...',
  '....btttttttttttttttttbbbb..',
  '....bwwbbwwbbwwbbwwbbbccbb..',
  '....bwwbbwwbbwwbbwwbbbccbb..',
  '....bbbbbbbbbbbbbbbbbbbbbb..',
  'Ffff.bBBBBBBBBBBBBBBBBBBb...',
  '.fF...bbb....bbb....bbb.....',
  '.......kk.....kk.....kk.....',
];

const busCache = new Map<string, string>();

export function busUrl(kit: Kit): string {
  const key = `${kit.bg}|${kit.fg}`;
  const hit = busCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = BUS_MAP[0].length;
  c.height = BUS_MAP.length;
  const ctx = c.getContext('2d')!;
  const colors: Record<string, string> = {
    b: kit.bg, B: mul(kit.bg, 0.6), t: kit.fg, w: '#cfeaf5', c: '#f4f6fa',
    f: '#e08a3c', F: '#ffd76a', k: '#1a1e2e',
  };
  BUS_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = colors[ch] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const url = c.toDataURL();
  busCache.set(key, url);
  return url;
}

// ---- single-color pixel stat icons (unchanged) --------------------------------

type IconKind = 'bolt' | 'aplus' | 'dollar' | 'alert' | 'face' | 'boltx' | 'facex' | 'credit';

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
  // the mood face (the card's right-edge gauge)
  face: [
    '..XXXXX..',
    '.X.....X.',
    'X..X.X..X',
    'X..X.X..X',
    'X.......X',
    'X.X...X.X',
    '.X.XXX.X.',
    '..X...X..',
    '...XXX...',
  ],
  // the elegant pair: a sleek bolt and floating features (no clunky ring)
  boltx: [
    '....XXXX',
    '...XXXX.',
    '..XXXX..',
    '.XXXXXXX',
    '....XXX.',
    '...XXX..',
    '..XXX...',
    '.XXX....',
    '.XX.....',
    'XX......',
  ],
  // a 1px circle, two 2px eyes, a 3px mouth — nothing more
  facex: [
    '..XXXXX..',
    '.X.....X.',
    'X.......X',
    'X.X...X.X',
    'X.X...X.X',
    'X.......X',
    'X..XXX..X',
    '.X.....X.',
    '..XXXXX..',
  ],
  // CREDITS — a proper cent sign: the C with clear ticks through top and bottom
  credit: [
    '....X....',
    '..XXXXX..',
    '.XX.X.XX.',
    'XX..X....',
    'XX.......',
    'XX..X....',
    '.XX.X.XX.',
    '..XXXXX..',
    '....X....',
  ],
};

const iconCache = new Map<string, string>();

export function iconUrl(kind: IconKind, color = '#7dfc9a'): string {
  const key = `${kind}|${color}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const px = ICON_PIXELS[kind];
  const c = document.createElement('canvas');
  c.width = px[0].length;
  c.height = px.length;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  px.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') ctx.fillRect(x, y, 1, 1);
  });
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

/** The same glyph with a 1px BLACK OUTLINE around it — the bolt/face that
    overlay the card-edge gauges. */
export function iconOutlinedUrl(kind: IconKind, color = '#7dfc9a'): string {
  const key = `o|${kind}|${color}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const px = ICON_PIXELS[kind];
  const W = px[0].length;
  const H = px.length;
  const c = document.createElement('canvas');
  c.width = W + 2;
  c.height = H + 2;
  const ctx = c.getContext('2d')!;
  const on = (x: number, y: number): boolean => !!px[y] && px[y][x] === 'X';
  ctx.fillStyle = '#000';
  for (let y = -1; y < H + 1; y++) for (let x = -1; x < W + 1; x++) {
    if (on(x, y)) continue;
    if (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
  }
  ctx.fillStyle = color;
  px.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') ctx.fillRect(x + 1, y + 1, 1, 1);
  });
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

// ---- STORY ILLUSTRATIONS (ported from "Illustration Options", 260823-p2) -----
// Thijs's picks: 1a THE FLAT-NOSE bus · 1d SAUCER scout ship · 1g THE DEAN
// (bun + skirt suit) · 1i THE BOOSTER (chrome robota, dark suit, cigar).
// Each scene/figure renders as a 24-frame sheet on the same CSS steps() loop
// as the player rigs. The team's color is the accent (stripe, fin, tie).

export type SceneId = 'bus-move' | 'bus-stranded' | 'bus-hoop' | 'saucer-move' | 'saucer-stranded' | 'saucer-hoop';
export type FigureId = 'dean' | 'booster' | 'scoop' | 'janitor' | 'assistant' | 'attendant';
export type FigureMood = 'neutral' | 'worried' | 'mad' | 'elated';

const IL_BODY = '#2e3d74', IL_DARK = '#232c4e', IL_WIN = '#7fd8ec', IL_WHITE = '#e8ecf8',
  IL_CHROME = '#9aa3b5', IL_CHROME_D = '#5f6878', IL_FL1 = '#ffd76a', IL_FL2 = '#e08a3c',
  IL_RED = '#f36a6a', IL_SPACE = '#0a0c14', IL_DIM = '#39406b';

type RFn = (x: number, y: number, w: number, h: number, c: string) => void;

function ilStars(R: RFn, W: number, H: number, f: number): void {
  R(0, 0, W, H, IL_SPACE);
  for (let i = 0; i < 26; i++) {
    const x = (i * 13 + 5) % W, y = (i * 7 + 3) % H;
    if ((i + f) % 9 < 7) R(x, y, 1, 1, i % 3 ? IL_DIM : IL_WHITE);
  }
}
function ilSpeedlines(R: RFn, f: number): void {
  for (let i = 0; i < 3; i++) R(1 + ((f * 5 + i * 9) % 14), 8 + i * 8, 4, 1, IL_DIM);
}
function ilPlanetSky(R: RFn, W: number, H: number): void {
  R(0, 0, W, H, '#1a1226');
  for (let i = 0; i < 12; i++) R((i * 17 + 3) % W, (i * 5 + 1) % 12, 1, 1, IL_DIM);
  const mx = W - 18;
  R(mx + 2, 3, 6, 1, '#3c3152'); R(mx, 4, 10, 2, '#3c3152'); R(mx - 1, 6, 12, 3, '#3c3152');
  R(mx, 9, 10, 2, '#3c3152'); R(mx + 2, 11, 6, 1, '#3c3152');
  R(mx + 3, 5, 2, 2, '#2a2340'); R(mx + 6, 8, 2, 1, '#2a2340');
}
function ilBarren(R: RFn, W: number, H: number, gy: number): void {
  R(0, gy, W, H - gy, '#6e5638'); R(0, gy, W, 1, '#8a6d47');
  R(5, gy - 2, 4, 2, '#5a4630'); R(W - 14, gy - 3, 5, 3, '#5a4630');
  R(16, gy + 3, 2, 1, '#5a4630'); R(W - 24, gy + 5, 3, 1, '#5a4630');
}
function ilSmoke(R: RFn, f: number, sx: number, sy: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const rise = (f * 2 + i * 5) % 14;
    if (rise > 1) R(sx + ((f + i) % 3) - 1, sy - rise, rise > 8 ? 3 : rise > 4 ? 2 : 1, 1, i % 2 ? '#8a8f9e' : '#6d7699');
  }
}
function ilCourtNight(R: RFn, W: number, H: number, f: number, gy: number, px: number): void {
  ilStars(R, W, H, f);
  R(0, gy, W, H - gy, '#3c4150'); R(0, gy, W, 1, '#6d7699');
  R(px, gy - 14, 2, 14, IL_CHROME_D);
  R(px - 4, gy - 18, 2, 10, IL_WHITE); R(px - 4, gy - 18, 2, 1, IL_CHROME_D);
  R(px - 8, gy - 14, 4, 1, IL_FL2);
  R(px - 8, gy - 13, 1, 1, IL_WHITE); R(px - 5, gy - 13, 1, 1, IL_WHITE);
  R(px - 7, gy - 12, 1, 1, IL_WHITE); R(px - 6, gy - 11, 1, 1, IL_WHITE);
  R(px - 2, gy - 15, 2, 1, IL_CHROME_D);
}
function ilHoopBall(R: RFn, f: number, px: number, gy: number): void {
  const b = [0, 3, 5, 3][f % 4];
  R(px - 7, gy - 2 - b, 2, 2, '#c9752e');
}
function ilBusBody(R: RFn, acc: string, f: number, ox: number, y: number, o: { flame?: boolean; lights?: boolean; beacon?: boolean; glow?: boolean; door?: boolean }): void {
  if (o.flame) { const len = 3 + (f % 3); R(ox + 6 - len, y + 4, len, 2, IL_FL2); R(ox + 7 - len, y + 4, len - 1, 1, IL_FL1); }
  R(ox + 6, y + 3, 4, 4, IL_CHROME_D);
  R(ox + 10, y, 42, 10, IL_BODY); R(ox + 10, y, 42, 2, IL_DARK);
  R(ox + 52, y + 1, 2, 9, IL_BODY); R(ox + 54, y + 3, 1, 6, IL_BODY);
  R(ox + 48, y + 2, 4, 4, IL_WIN);
  for (let i = 0; i < 4; i++) R(ox + 13 + i * 8, y + 3, 5, 3, IL_WIN);
  R(ox + 10, y + 7, 45, 2, acc);
  R(ox + 8, y - 3, 4, 3, acc);
  if (o.lights) R(ox + 53, y + 8, 2, 1, IL_FL1);
  if (o.beacon) R(ox + 30, y - 2, 2, 2, IL_RED);
  if (o.glow && f % 2) { R(ox + 18, y + 11, 4, 1, IL_WIN); R(ox + 32, y + 11, 4, 1, IL_WIN); R(ox + 44, y + 11, 4, 1, IL_WIN); }
  if (o.door) { R(ox + 42, y + 2, 5, 8, '#141828'); R(ox + 42, y + 2, 1, 8, acc); }
}
function ilSaucerBody(R: RFn, ox: number, y: number, lightFn: (i: number) => string): void {
  R(ox + 20, y, 8, 2, IL_WIN); R(ox + 18, y + 2, 12, 2, IL_WIN);
  R(ox + 10, y + 4, 28, 3, IL_CHROME); R(ox + 8, y + 5, 32, 2, IL_CHROME);
  R(ox + 14, y + 7, 20, 2, IL_CHROME_D);
  for (let i = 0; i < 7; i++) R(ox + 11 + i * 4, y + 5, 2, 1, lightFn(i));
}

const SCENE_SIZE: Record<SceneId, [number, number]> = {
  'bus-move': [64, 32], 'bus-stranded': [64, 32], 'bus-hoop': [64, 32],
  'saucer-move': [48, 28], 'saucer-stranded': [48, 28], 'saucer-hoop': [48, 28],
};

function drawScene(R: RFn, scene: SceneId, acc: string, f: number): void {
  switch (scene) {
    case 'bus-move': {
      const y = 11 + (f % 4 < 2 ? 0 : 1);
      ilStars(R, 64, 32, f); ilSpeedlines(R, f);
      ilBusBody(R, acc, f, 0, y, { flame: true, glow: true, lights: true, beacon: f % 4 < 2 });
      break;
    }
    case 'bus-stranded': {
      ilPlanetSky(R, 64, 32); ilBarren(R, 64, 32, 24);
      ilBusBody(R, acc, f, 0, 14, { beacon: f % 2 === 0 });
      ilSmoke(R, f, 8, 16, 3);
      if (f % 5 === 0) R(5, 20, 1, 1, IL_FL1);
      break;
    }
    case 'bus-hoop': {
      ilCourtNight(R, 64, 32, f, 24, 56);
      ilBusBody(R, acc, f, -8, 14, { lights: f % 8 < 4, door: true });
      ilHoopBall(R, f, 56, 24);
      break;
    }
    case 'saucer-move': {
      const y = 8 + (f % 4 < 2 ? 0 : 1);
      ilStars(R, 48, 28, f); ilSpeedlines(R, f);
      ilSaucerBody(R, 0, y, (i) => (i + f) % 4 === 0 ? acc : IL_DARK);
      if (f % 2) R(22, y + 9, 4, 1, IL_WIN);
      break;
    }
    case 'saucer-stranded': {
      ilPlanetSky(R, 48, 28); ilBarren(R, 48, 28, 21);
      ilSaucerBody(R, 0, 12, (i) => (i * 3 + f) % 7 < 1 ? IL_FL1 : IL_DARK);
      ilSmoke(R, f, 23, 11, 3);
      R(21, 17, 1, 2, '#1a1e2e'); R(22, 18, 1, 1, '#1a1e2e');
      break;
    }
    case 'saucer-hoop': {
      ilCourtNight(R, 48, 28, f, 21, 40);
      ilSaucerBody(R, -8, 12, (i) => (i + Math.floor(f / 3)) % 7 === 0 ? acc : IL_DARK);
      ilHoopBall(R, f, 40, 21);
      break;
    }
  }
}

// ---- THE DEAN (bun + skirt suit) and THE BOOSTER (chrome suit, cigar) --------

const DEAN_MAP = [
  '........hhh.............',
  '........hhh.............',
  '.......hhhhhhhhh........',
  '.......hhhhhhhhhh.......',
  '.......hssssssssh.......',
  '.......hkeksskekh.......',
  '.......hsssssssdh.......',
  '.......hsskksssdh.......',
  '........ssssssss........',
  '..........ssss..........',
  '.........wwwwww.........',
  '......uuuuuuuuuuuu......',
  '....uuuuuUUwwUUuuuuu....',
  '....uuuuuUUwwUUuuuuu....',
  '....uuuuuuUwwUuuuuuu....',
  '....uu.uuuukuuuuu.uu....',
  '....ss.uuuuuuuuuu.ss....',
  '.......uuuuuuuuuu.......',
  '.......UUUUUUUUUU.......',
  '.......UUUUUUUUUU.......',
  '......UUUUUUUUUUUU......',
  '......UUUUUUUUUUUU......',
  '.........ss..ss.........',
  '.........ss..ss.........',
  '.........ss..ss.........',
  '........ooo..ooo........'];

const BOOSTER_MAP = [
  '.............cc.............',
  '.............cc.............',
  '.........cccccccccc.........',
  '.........cCccccccCc.........',
  '.........cekccccekc.........',
  '.........cccccccccc.........',
  '.........cckkkkkkcc.........',
  '.........cccccccccc.........',
  '............ccc.............',
  '....uuuuuuuuuuuuuuuuuuuu....',
  '....uuuuuuuUUttUUuuuuuuu....',
  '....uuuuuuuUUttUUuuuuuuu....',
  '....uuuuuggggggggguuuuuu....',
  '....uu.uuuuuuuuuuuuuu.uu....',
  '....uu.uuuuuuuuuuuuuu.uu....',
  '....uu.uuuuuuttuuuuuu.uu....',
  '....uu.uuuuuuttuuuuuu.uu....',
  '....uu.uuuuuuuuuuuuuu.uu....',
  '....uu.uuuuuuuuuuuuuu.uu....',
  '....cc.uuuuuuuuuuuuuu.cc....',
  '.......uuuuuuuuuuuuuu.......',
  '.......uuuuuuuuuuuuuu.......',
  '........ccc......ccc........',
  '........ccc......ccc........',
  '........cCc......cCc........',
  '........ccc......ccc........',
  '........ccc......ccc........',
  '........cCc......cCc........',
  '........ccc......ccc........',
  '........ccc......ccc........',
  '........ccc......ccc........',
  '........ccc......ccc........',
  '......ooooo....ooooo........',
  '......ooooo....ooooo........'];

type PixEdit = [number, number, string];

function ilEdited(base: string[], edits: PixEdit[]): string[] {
  const m = base.map((r) => r.split(''));
  edits.forEach(([y, x, ch]) => { if (m[y]) m[y][x] = ch; });
  return m.map((r) => r.join(''));
}

// «SCOOP» QUAZAR — six-legged beat reporter for the Galactic Hoops Gazette:
// fedora with a team-color band, loud orange suit (fromDesign/260823 - pt3)
const REPORTER_MAP = [
  '..........ffff............',
  '..........ffff............',
  '.........tttttt...........',
  '.......ffffffffff.........',
  '........ssssssss..........',
  '........sekseksd..........',
  '........ssssssss..........',
  '........sskkssss..........',
  '.........ssssss...........',
  '...........ss.............',
  '..........wwww............',
  '......uuuuuuuuuuuu........',
  '....uuuuuUUwwUUuuuuu......',
  '....uuuuuUUwwUUuuuuu......',
  '....uu.uuuuuuuuuu.uu......',
  '....uu.uuuukuuuuu.uu......',
  '....ss.uuuuuuuuuu.ss......',
  '.......uuuuuuuuuu.........',
  '.......uuuuuuuuuu.........',
  '.......uu..uu..uu.........',
  '.......uu..uu..uu.........',
  '.......uu..uu..uu.........',
  '.......uu..uu..uu.........',
  '.......ss..ss..ss.........',
  '......ooo.ooo.ooo.........',
  '......ooo.ooo.ooo.........'];

// THE JANITOR (fromDesign/260829): flat cap, grey coveralls, chest patch in
// team color — the item-giver of THE SUPPLY CLOSET. Face shares the dean's
// pixel coordinates, so the mood edits are shared too.
const JANITOR_MAP = [
  '........cccccccc........',
  '.......cccccccccc.......',
  '......cccccccccccc......',
  '.......cssssssssc.......',
  '.......cssssssssc.......',
  '.......ckeksskekc.......',
  '.......cssssssssc.......',
  '.......csskksssdc.......',
  '........ssssssss........',
  '..........ssss..........',
  '.........uuuuuu.........',
  '......uuuuuuuuuuuu......',
  '....uuuuuuUttUuuuuuu....',
  '....uu.uuuUttUuuu.uu....',
  '....uu.uuuuuuuuuu.uu....',
  '....uu.uuuuUUuuuu.uu....',
  '....ss.uuuuuuuuuu.ss....',
  '.......uuuuuuuuuu.......',
  '.......uuu....uuu.......',
  '.......uuu....uuu.......',
  '.......UUu....uUU.......',
  '......ooo......ooo......',
  '......ooo......ooo......'];

// THE ASSISTANT COACH (fromDesign/260829): team-color cap and jacket stripe,
// a whistle on a cord, a clipboard always in hand — the future tutorial voice.
const ASSISTANT_MAP = [
  '........tttttttt........',
  '.......tttttttttt.......',
  '......tttttttttttt......',
  '.......tsssssssst.......',
  '.......tsssssssst.......',
  '.......tkeksskekt.......',
  '.......tsssssssst.......',
  '.......tsskksssdt.......',
  '........ssssssss........',
  '..........ssss..........',
  '.........uuyuuu.........',
  '......uuuuuyuuuuuu......',
  '....uuuuutttttuuuuuu....',
  '....uu.uuutttuuuu.uu....',
  '....uu.uuuuuuuuuu.uu....',
  '....uu.uuuuuuuuuu.uu....',
  '....ss.uuuuuuuuuu.bb....',
  '.......uuuuuuuuuu.bb....',
  '.......UUu....uUU.......',
  '.......UUu....uUU.......',
  '.......UUu....uUU.......',
  '......ooo......ooo......',
  '......ooo......ooo......'];

// THE GAS STATION ATTENDANT (fromDesign/260829, option 3g): a gelid in a
// service cap and coveralls, the ring stack rippling below — reads engine
// exhaust the way others read palms. Face on the reporter's coordinates.
const ATTENDANT_MAP = [
  '..........................',
  '.........uuuuuu...........',
  '.........uuuuuuuu.........',
  '..........................',
  '........ssssssss..........',
  '........sekseksd..........',
  '........ssssssss..........',
  '........sskkssss..........',
  '.........ssssss...........',
  '...........ss.............',
  '.......uuuuuuuuuu.........',
  '.....ss.uuutttuuuu.ss.....',
  '.....ss.uuutttuuuu.ss.....',
  '.....ss.uuuuuuuuuu.ss.....',
  '.......ssssssssss.........',
  '........ssssssss..........',
  '.......ssssssssss.........',
  '........ssssssss..........',
  '.......ssssssssss.........',
  '......oooo....oooo........'];

const DEAN_STATES: Record<FigureMood, PixEdit[]> = {
  neutral: [],
  worried: [[7, 9, 'k'], [7, 12, 'k']],
  mad: [[4, 10, 'k'], [4, 13, 'k'], [6, 10, 'k'], [6, 11, 'k'], [7, 9, 'k'], [7, 12, 'k'], [7, 10, 'e'], [7, 11, 'e']],
  elated: [[5, 8, 'y'], [5, 9, 'y'], [5, 10, 'y'], [5, 13, 'y'], [5, 14, 'y'], [5, 15, 'y'], [6, 9, 'k'], [6, 12, 'k'], [7, 9, 'k'], [7, 12, 'k'], [7, 10, 'e'], [7, 11, 'e'], [8, 10, 'k'], [8, 11, 'k']],
};
const DEAN_CHEER: PixEdit[] = [[15, 4, '.'], [15, 5, '.'], [16, 4, '.'], [16, 5, '.'], [15, 18, '.'], [15, 19, '.'], [16, 18, '.'], [16, 19, '.'],
  [11, 4, 'u'], [11, 5, 'u'], [10, 4, 'u'], [10, 5, 'u'], [9, 4, 's'], [9, 5, 's'],
  [11, 18, 'u'], [11, 19, 'u'], [10, 18, 'u'], [10, 19, 'u'], [9, 18, 's'], [9, 19, 's']];

const BOOSTER_STATES: Record<FigureMood, PixEdit[]> = {
  neutral: [],
  worried: [[6, 11, 'c'], [6, 16, 'c']],
  mad: [[3, 10, 'k'], [3, 11, 'k'], [3, 15, 'k'], [3, 16, 'k'], [5, 12, 'k'], [5, 13, 'k'], [5, 14, 'k'], [5, 15, 'k'], [6, 12, 'e'], [6, 15, 'e']],
  elated: [[4, 10, 'y'], [4, 11, 'y'], [4, 16, 'y'], [4, 17, 'y'], [6, 12, 'e'], [6, 13, 'e'], [6, 14, 'e'], [6, 15, 'e']],
};
const BOOSTER_CHEER: PixEdit[] = (() => {
  const out: PixEdit[] = [];
  for (let y = 13; y <= 19; y++) [4, 5, 22, 23].forEach((x) => out.push([y, x, '.']));
  ([[8, 'u'], [7, 'u']] as [number, string][]).forEach(([y, ch]) => [4, 5, 22, 23].forEach((x) => out.push([y, x, ch])));
  [4, 5, 22, 23].forEach((x) => out.push([6, x, 'c']));
  return out;
})();

const REPORTER_STATES: Record<FigureMood, PixEdit[]> = {
  neutral: [],
  worried: [[7, 9, 'k'], [7, 12, 'k']],
  mad: [[4, 9, 'k'], [4, 10, 'k'], [4, 12, 'k'], [4, 13, 'k'], [6, 10, 'k'], [6, 11, 'k'], [7, 9, 'k'], [7, 12, 'k'], [7, 10, 'e'], [7, 11, 'e']],
  elated: [[5, 9, 'y'], [5, 10, 'y'], [5, 12, 'y'], [5, 13, 'y'], [6, 9, 'k'], [6, 12, 'k'], [7, 9, 'k'], [7, 12, 'k'], [7, 10, 'e'], [7, 11, 'e'], [8, 10, 'k'], [8, 11, 'k']],
};
const ATTENDANT_CHEER: PixEdit[] = (() => {
  const out: PixEdit[] = [];
  for (let y = 11; y <= 13; y++) [5, 6, 19, 20].forEach((x) => out.push([y, x, '.']));
  for (let y = 8; y <= 10; y++) [5, 6, 19, 20].forEach((x) => out.push([y, x, 's']));
  return out;
})();

const REPORTER_CHEER: PixEdit[] = (() => {
  const out: PixEdit[] = [];
  for (let y = 14; y <= 16; y++) [4, 5, 18, 19].forEach((x) => out.push([y, x, '.']));
  ([[11, 'u'], [10, 'u']] as [number, string][]).forEach(([y, ch]) => [4, 5, 18, 19].forEach((x) => out.push([y, x, ch])));
  [4, 5, 18, 19].forEach((x) => out.push([9, x, 's']));
  return out;
})();

const WORKER_CHEER: PixEdit[] = (() => {
  // arms up: the sleeves leave the sides and rise past the shoulders
  const out: PixEdit[] = [];
  for (let y = 13; y <= 16; y++) [4, 5, 18, 19].forEach((x) => out.push([y, x, '.']));
  ([[11, 'u'], [10, 'u']] as [number, string][]).forEach(([y, ch]) => [4, 5, 18, 19].forEach((x) => out.push([y, x, ch])));
  [4, 5, 18, 19].forEach((x) => out.push([9, x, 's']));
  return out;
})();

function deanPal(acc: string): Record<string, string> {
  return { h: '#b9bec9', s: '#c08a5e', d: '#a06f45', k: '#1a1e2e', e: '#f4f6fa',
    w: '#e8ecf8', u: '#6b4a2f', U: '#4e3520', o: '#3a2a1c', t: acc, y: '#ffd76a' };
}
function boosterPal(acc: string): Record<string, string> {
  return { c: IL_CHROME, C: IL_CHROME_D, k: '#1a1e2e', e: '#f4f6fa',
    u: '#2a2135', U: '#1a1626', t: acc, g: '#ffd76a', o: '#1a1e2e', w: '#e8ecf8', y: '#ffd76a' };
}
function reporterPal(acc: string): Record<string, string> {
  return { f: '#6b4a2f', s: '#5bc8af', d: '#3fa389', k: '#1a1e2e', e: '#f4f6fa',
    w: '#e8ecf8', u: '#f3903f', U: '#c96f26', o: '#3a2a1c', t: acc, y: '#ffd76a' };
}
function attendantPal(acc: string): Record<string, string> {
  return { s: '#78b955', d: '#5f9a40', k: '#1a1e2e', e: '#f4f6fa', u: '#4a5a7a', o: '#1a1e2e', t: acc, w: '#e8ecf8', y: '#ffd76a' };
}
function janitorPal(acc: string): Record<string, string> {
  return { c: '#3d5a63', s: '#c08a5e', d: '#a06f45', k: '#1a1e2e', e: '#f4f6fa',
    u: '#5a6472', U: '#3e4650', t: acc, o: '#26262e', w: '#e8ecf8', y: '#ffd76a' };
}
function assistantPal(acc: string): Record<string, string> {
  return { s: '#8a5a36', d: '#6d4527', k: '#1a1e2e', e: '#f4f6fa',
    u: '#2e3d74', U: '#232c4e', t: acc, o: '#e8ecf8', b: '#b9bec9',
    w: '#e8ecf8', y: '#ffd76a' };
}

function ilDrawMap(R: RFn, map: string[], pal: Record<string, string>, ox: number, oy: number): void {
  map.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (ch !== '.') R(ox + x, oy + y, 1, 1, pal[ch] ?? '#ff00ff');
  }));
}
function ilDrawIcon(R: RFn, x: number, y: number, pat: string[]): void {
  const IC: Record<string, string> = { e: '#f4f6fa', k: '#1a1e2e', y: '#ffd76a', c: '#7fd8ec' };
  pat.forEach((row, ry) => row.split('').forEach((ch, rx) => { if (ch !== '.') R(x + rx, y + ry, 1, 1, IC[ch]); }));
}

// every character now lives in their SCENE (fromDesign/260823 - pt3):
// the dean before the sepia college pediment, the booster on the landing pad
// with his pink cadillac-ship idling, Scoop in the empty press room under
// the blinking ON AIR sign.
const FIGURE_SIZE: Record<FigureId, [number, number]> = { dean: [64, 44], booster: [64, 44], scoop: [64, 44], janitor: [64, 44], assistant: [64, 44], attendant: [64, 44] };

interface FigState { rows: string[]; shrug: boolean; he: number }

function figState(who: FigureId, state: FigureMood, f: number): FigState {
  const cfg = {
    dean: { base: DEAN_MAP, st: DEAN_STATES, ch: DEAN_CHEER, he: 9, blink: [[5, 9], [5, 14]] as [number, number][] },
    booster: { base: BOOSTER_MAP, st: BOOSTER_STATES, ch: BOOSTER_CHEER, he: 8, blink: null },
    scoop: { base: REPORTER_MAP, st: REPORTER_STATES, ch: REPORTER_CHEER, he: 9, blink: [[5, 9], [5, 12]] as [number, number][] },
    // the janitor and the assistant share the dean's face coordinates
    janitor: { base: JANITOR_MAP, st: DEAN_STATES, ch: WORKER_CHEER, he: 9, blink: [[5, 9], [5, 14]] as [number, number][] },
    assistant: { base: ASSISTANT_MAP, st: DEAN_STATES, ch: WORKER_CHEER, he: 9, blink: [[5, 9], [5, 14]] as [number, number][] },
    attendant: { base: ATTENDANT_MAP, st: REPORTER_STATES, ch: ATTENDANT_CHEER, he: 9, blink: [[5, 9], [5, 12]] as [number, number][], ripple: [14, 18] as [number, number] },
  }[who] as { base: string[]; st: Record<FigureMood, PixEdit[]>; ch: PixEdit[]; he: number; blink: [number, number][] | null; ripple?: [number, number] };
  const cheer = state === 'elated' && f % 8 < 4;
  const shrug = state === 'mad' && f % 8 < 3;
  const m = ilEdited(cfg.base, (cfg.st[state] ?? []).concat(cheer ? cfg.ch : [])).map((r) => r.split(''));
  if (cfg.blink && (state === 'neutral' || state === 'worried') && f % 14 < 2) {
    cfg.blink.forEach(([y, x]) => { m[y][x] = 's'; });
  }
  if (cfg.ripple) {
    // a liquid body: the ring stack sways like water
    for (let y = cfg.ripple[0]; y <= cfg.ripple[1]; y++) {
      const ph = (y + Math.floor(f / 2)) % 4;
      if (ph === 0) { m[y].pop(); m[y].unshift('.'); } else if (ph === 2) { m[y].shift(); m[y].push('.'); }
    }
  }
  return { rows: m.map((r) => r.join('')), shrug, he: cfg.he };
}

function drawChar(R: RFn, S: FigState, pal: Record<string, string>, ox: number, oy: number): void {
  if (S.shrug) { // the head sinks into the shoulders
    ilDrawMap(R, S.rows.slice(S.he + 1), pal, ox, oy + S.he + 1);
    ilDrawMap(R, S.rows.slice(0, S.he + 1), pal, ox, oy + 1);
  } else {
    ilDrawMap(R, S.rows, pal, ox, oy);
  }
}

function stateFx(R: RFn, f: number, state: FigureMood, ix: number, iy: number, sx: number, sy: number): void {
  const big = f % 6 < 3;
  const SK_BIG = ['.eeeee.', 'ekeeeke', 'eeekeee', '.eeeee.', '.e.e.e.'], SK_SM = ['..eee..', '.ekeke.', '..eee..'];
  const ST_BIG = ['..y..', '.yyy.', 'yyyyy', '.yyy.', '..y..'], ST_SM = ['.y.', 'yyy', '.y.'];
  const EX_BIG = ['cc', 'cc', 'cc', '..', 'cc'], EX_SM = ['c', 'c', '.', 'c'];
  if (state === 'mad') ilDrawIcon(R, ix, iy, big ? SK_BIG : SK_SM);
  if (state === 'elated') ilDrawIcon(R, ix, iy, big ? ST_BIG : ST_SM);
  if (state === 'worried') {
    ilDrawIcon(R, ix + (big ? 0 : 1), iy + (big ? 0 : 1), big ? EX_BIG : EX_SM);
    R(sx, sy + (f % 6), 1, f % 6 > 2 ? 2 : 1, '#7fd8ec'); // the sweat drop
  }
}

/** The Dean's sepia college: pediment, columns, steps — always monochrome. */
function ilCollege(R: RFn, W: number, H: number): void {
  R(0, 0, W, H, '#241f19');
  R(0, 10, W, 26, '#2a231b');
  for (let i = 0; i < 6; i++) R(32 - (i + 1) * 4, 2 + i, (i + 1) * 8, 1, '#3a3128'); // pediment
  R(4, 8, 56, 3, '#4e4234');
  [6, 14, 44, 52].forEach((x) => { R(x, 11, 5, 25, '#3a3128'); R(x, 11, 1, 25, '#4e4234'); R(x - 1, 11, 7, 2, '#4e4234'); });
  R(0, 36, W, 3, '#4e4234'); R(0, 39, W, 5, '#3a3128'); // steps
}

function drawFigure(R: RFn, who: FigureId, state: FigureMood, acc: string, f: number): void {
  const W = 64, H = 44;
  if (who === 'dean') {
    ilCollege(R, W, H);
    drawChar(R, figState('dean', state, f), deanPal(acc), 20, 13);
    stateFx(R, f, state, 39, 6, 37, 14);
    return;
  }
  if (who === 'scoop') {
    // the empty press room: step-and-repeat backdrop, podium mics, ON AIR
    R(0, 0, W, 40, '#1c2136');
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 8; gx++) {
      const x = 3 + gx * 8 + (gy % 2) * 4, y = 3 + gy * 7;
      if ((gx + gy) % 2) R(x, y, 2, 2, '#2e3d74'); else R(x, y + 1, 2, 1, '#39406b');
    }
    R(0, 40, W, 4, '#141828'); R(0, 40, W, 1, '#232a44'); // floor
    R(6, 26, 10, 14, '#2a3152'); R(5, 25, 12, 2, '#3c4668'); // podium
    R(8, 20, 1, 5, IL_CHROME_D); R(11, 21, 1, 4, IL_CHROME_D); // mic stalks
    R(7, 19, 2, 2, '#1a1e2e'); R(10, 20, 2, 2, '#1a1e2e');
    R(45, 4, 14, 7, '#141828'); R(45, 4, 14, 1, '#232a44'); // ON AIR sign
    R(47, 6, 10, 3, f % 6 < 3 ? IL_RED : '#5a2430');
    drawChar(R, figState('scoop', state, f), reporterPal(acc), 24, 14);
    stateFx(R, f, state, 17, 7, 41, 16);
    return;
  }
  if (who === 'janitor') {
    // THE SUPPLY CLOSET: shelf of boxes, a swinging bulb, the mop and bucket
    R(0, 0, W, H, '#1c1913');
    R(0, 40, W, 4, '#141210'); R(0, 40, W, 1, '#2e2a22'); // floor
    R(2, 8, 24, 2, '#4e4234'); R(2, 22, 24, 2, '#4e4234'); // shelf planks
    [[3, 3], [10, 2], [17, 4]].forEach(([x, off]) => { R(x, off, 6, 5, '#5a4630'); R(x, off, 6, 1, '#6e5638'); });
    [[4, 17], [12, 16], [19, 18]].forEach(([x, yy]) => { R(x, yy, 5, 5, '#3e3a4e'); R(x, yy, 5, 1, '#55506a'); });
    // the hanging bulb, swinging one pixel, flickering warm
    const bx = 44 + (f % 8 < 4 ? 0 : 1);
    R(bx, 0, 1, 5, IL_CHROME_D);
    R(bx - 1, 5, 3, 3, f % 11 === 0 ? '#8a6d47' : IL_FL1);
    if (f % 11 !== 0) R(bx - 3, 8, 7, 1, 'rgba(255,215,106,0.25)');
    // the mop leans on the wall; the bucket waits
    R(56, 12, 1, 26, '#8a5a32'); R(57, 12, 1, 26, '#6d4527');
    R(54, 36, 5, 4, '#d8dde8'); R(54, 36, 5, 1, '#9aa3b5');
    R(48, 34, 7, 6, '#4e5a66'); R(48, 34, 7, 1, '#7fd8ec');
    drawChar(R, figState('janitor', state, f), janitorPal(acc), 20, 15);
    stateFx(R, f, state, 34, 4, 32, 12);
    return;
  }
  if (who === 'attendant') {
    // THE FUEL STOP: the pump with its glowing screen, the hose, the sign
    // that buzzes — and the attendant reading your exhaust
    ilStars(R, W, H, f);
    R(0, 38, W, 6, '#2a231b'); R(0, 38, W, 1, '#3a3128');
    R(4, 16, 12, 22, '#3c4150'); R(5, 18, 10, 6, f % 8 < 4 ? acc : '#26301c'); R(6, 26, 8, 2, '#141828');
    R(16, 20, 2, 2, '#5f6878'); R(18, 21, 1, 14, '#5f6878');
    R(6, 5, 10, 6, '#8a3d33'); R(7, 6, 8, 4, f % 2 ? '#ffd76a' : '#e08a3c'); R(10, 11, 2, 5, '#5f6878');
    drawChar(R, figState('attendant', state, f), attendantPal(acc), 19, 20);
    stateFx(R, f, state, 37, 3, 35, 21);
    return;
  }
  if (who === 'assistant') {
    // the practice gym: wood floor, a whiteboard mid-diagram, a blinking play
    R(0, 0, W, 36, '#241f19');
    R(0, 36, W, 8, '#6e5638'); R(0, 36, W, 1, '#8a6d47'); // hardwood
    R(3, 4, 24, 18, '#e8ecf8'); R(2, 3, 26, 1, '#4e4234'); R(2, 22, 26, 1, '#4e4234'); // whiteboard
    // X's, O's and the arrow — the play under construction
    [[6, 8], [11, 15], [20, 9]].forEach(([x, yy]) => { R(x, yy, 2, 2, '#1a1e2e'); });
    [[9, 12], [17, 17], [22, 15]].forEach(([x, yy]) => { R(x, yy, 2, 2, '#f36a6a'); });
    R(8, 6, 10, 1, '#1a1e2e'); R(17, 5, 1, 3, '#1a1e2e');
    if (f % 6 < 3) R(13, 12, 2, 2, acc); // the option he keeps circling
    drawChar(R, figState('assistant', state, f), assistantPal(acc), 30, 13);
    stateFx(R, f, state, 50, 4, 48, 12);
    return;
  }
  // the booster: starfield, landing pad, the pink cadillac-ship idling behind
  ilStars(R, W, H, f);
  R(0, 38, W, 6, '#2a231b'); R(0, 38, W, 1, '#3a3128'); // landing pad
  const by = 20 + (f % 6 < 3 ? 0 : 1); // hover bob
  R(2, by - 6, 3, 6, '#d16a9e'); R(4, by - 4, 3, 4, '#d16a9e'); // tail fins
  R(3, by - 6, 1, 2, IL_RED);
  R(2, by, 60, 8, '#d16a9e'); R(2, by, 60, 2, '#a84a7c');
  R(2, by + 4, 60, 1, '#d8dde8'); // chrome trim
  R(34, by - 5, 14, 5, IL_WIN); R(34, by - 5, 14, 1, '#a84a7c'); // canopy
  R(58, by + 1, 4, 6, '#d8dde8'); // chrome grille
  if (f % 2) R(8, by + 8, 48, 1, acc); // hover glow
  const S = figState('booster', state, f);
  drawChar(R, S, boosterPal(acc), 18, 5);
  // cigar + ember + smoke (rides the shrug)
  const cy = 11 + (S.shrug ? 1 : 0);
  R(35, cy, 4, 1, '#8a5a32'); R(39, cy, 1, 1, f % 2 ? '#ff6a4a' : IL_FL1);
  for (let i = 0; i < 3; i++) {
    const rise = (f + i * 4) % 12;
    if (rise > 1) R(39 + (f + i) % 2, cy - 1 - rise, rise > 7 ? 2 : 1, 1, '#8a8f9e');
  }
  stateFx(R, f, state, 10, 2, 26, 6);
}

// ---- illustration sheets: same cache + steps() loop as the rigs --------------

const illoCache = new Map<string, string>();

function illoSheet(key: string, W: number, H: number, draw: (R: RFn, f: number) => void): string {
  const hit = illoCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = W * FRAMES;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (let f = 0; f < FRAMES; f++) {
    const ox = f * W;
    const R: RFn = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
    draw(R, f);
  }
  const url = canvas.toDataURL();
  illoCache.set(key, url);
  return url;
}

function illoHtml(url: string, W: number, H: number, scale: number, cls: string): string {
  const w = W * scale, h = H * scale;
  const dur = FRAMES * FRAME_MS;
  const phase = Math.round(performance.now()) % dur;
  return `<span class="rig ${cls}" style="width:${w}px;height:${h}px;--rigshift:-${w * FRAMES}px;--rigdur:${dur}ms;animation-delay:-${phase}ms;background-image:url(${url});background-size:${w * FRAMES}px ${h}px"></span>`;
}

/** A story scene: the bus or the saucer — moving, stranded, or at the hoop.
    flip = heading home (screen-left). */
export function sceneHtml(scene: SceneId, kit: Kit, scale = 3, flip = false, cls = ''): string {
  const [W, H] = SCENE_SIZE[scene];
  const url = illoSheet(`sc|${scene}|${kit.bg}`, W, H, (R, f) => drawScene(R, scene, kit.bg, f));
  return illoHtml(url, W, H, scale, `${cls} ${flip ? 'rig-flip' : ''}`);
}

// ---- THE TITLE SCREEN: MARCH MANIACS (fromDesign/260829, option 5a) ----------
// 128×72: deep space, MARCH bouncing on the beat over MANIACS, a basketball
// orbiting the title, the hoop court-side, a ringed planet drifting low, the
// subtitle flashing one word at a time, PRESS START blinking in the team color.

const TITLE_FONT: Record<string, string[]> = {
  M: ['10001', '11011', '10101', '10001', '10001'], A: ['01110', '10001', '11111', '10001', '10001'],
  R: ['11110', '10001', '11110', '10100', '10011'], C: ['01111', '10000', '10000', '10000', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'], S: ['01111', '10000', '01110', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100'], E: ['11111', '10000', '11110', '10000', '11111'],
  G: ['01111', '10000', '10011', '10001', '01111'], L: ['10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '01110'], B: ['11110', '10001', '11110', '10001', '11110'],
  K: ['10001', '10010', '11100', '10010', '10001'], D: ['11110', '10001', '10001', '10001', '11110'],
  U: ['10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '11110', '10000', '10000'],
};

function drawTitle(R: RFn, acc: string, f: number): void {
  R(0, 0, 128, 72, IL_SPACE);
  for (let i = 0; i < 46; i++) {
    const x = (i * 17 + 5) % 128, y = (i * 11 + 3) % 72;
    if ((i + f) % 9 < 7) R(x, y, 1, 1, i % 3 ? IL_DIM : IL_WHITE);
  }
  // ringed planet drifting low-left
  R(8, 52, 12, 8, '#4a3f7a'); R(10, 50, 8, 2, '#4a3f7a'); R(10, 60, 8, 2, '#4a3f7a');
  R(11, 54, 3, 2, '#37305c'); R(16, 57, 2, 1, '#37305c');
  R(4, 56, 20, 1, '#7fd8ec'); R(2, 57, 24, 1, '#5a9ab0');
  const word = (str: string, x0: number, y0: number, sc: number, col: string, shad: string | null): void => {
    let x = x0;
    for (const ch of str) {
      if (ch === ' ') { x += 4 * sc; continue; }
      (TITLE_FONT[ch] ?? []).forEach((row, ry) => row.split('').forEach((v, rx) => {
        if (v !== '1') return;
        if (shad) R(x + rx * sc + 1, y0 + ry * sc + 1, sc, sc, shad);
        R(x + rx * sc, y0 + ry * sc, sc, sc, col);
      }));
      x += 6 * sc;
    }
  };
  // MARCH bounces on the beat, MANIACS holds
  const bounce = [0, -1, -2, -1][Math.floor(f / 2) % 4];
  word('MARCH', 34, 12 + bounce, 2, '#ffd76a', '#7d4315');
  word('MANIACS', 23, 26, 2, IL_WHITE, IL_DARK);
  // the ball orbits the title
  const TBALL = ['.OOO.', 'OQPQO', 'QQQQQ', 'OQOQO', '.OOO.'];
  const orb = f % 12;
  const ox = 64 + Math.round(Math.cos((orb / 12) * 6.283) * 46);
  const oy = 22 + Math.round(Math.sin((orb / 12) * 6.283) * 14);
  TBALL.forEach((row, ry) => row.split('').forEach((ch, rx) => {
    if (ch !== '.') R(ox + rx, oy + ry, 1, 1, ch === 'O' ? '#c9752e' : ch === 'Q' ? '#7d4315' : '#e08a3c');
  }));
  // the hoop, court-side right
  R(104, 40, 1, 14, '#3c4150'); R(101, 36, 1, 5, '#5a6070'); R(102, 40, 2, 1, '#3c4150');
  R(97, 41, 5, 1, '#8a6d47'); R(97, 42, 1, 3, '#5a6070'); R(101, 42, 1, 3, '#5a6070'); R(98, 45, 3, 1, '#5a6070');
  // the subtitle, one word after the next, centered
  const words = ['AN', 'INTERGALACTIC', 'COLLEGE', 'BASKETBALL', 'MADNESS', 'SIMULATOR'];
  const w = words[Math.floor(f / 2) % words.length];
  word(w, 64 - w.length * 3, 62, 1, '#818ab0', null);
  if (f % 8 < 5) word('PRESS START', 31, 48, 1, acc, null);
}

/** The launch screen: MARCH MANIACS, press start. 128×72 at `scale`. */
export function titleHtml(kit: Kit, scale = 3, cls = ''): string {
  const url = illoSheet(`title|${kit.bg}`, 128, 72, (R, f) => drawTitle(R, kit.bg, f));
  return illoHtml(url, 128, 72, scale, cls);
}

/** The dean or the booster, acting their read of you: worried → the verdict. */
export function figureHtml(who: FigureId, mood: FigureMood, kit: Kit, scale = 3, cls = ''): string {
  const [W, H] = FIGURE_SIZE[who];
  const url = illoSheet(`fg|${who}|${mood}|${kit.bg}`, W, H, (R, f) => drawFigure(R, who, mood, kit.bg, f));
  return illoHtml(url, W, H, scale, cls);
}
