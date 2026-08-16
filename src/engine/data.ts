// All game content: species, teams, names, drills, regions, recruiting acts,
// THE BAG, the Universal Tournament pools, and the story registry.
// Content is data + pure decision functions; the engine (state.ts) applies Fx.

import type {
  Fx,
  GameState,
  OddsTail,
  PlanId,
  Player,
  Pole,
  SpeciesDef,
  StoryChoiceView,
  StoryEvent,
} from './types';
import { clamp, lean, pick, rand } from './util';

export const CLASS_ABBR = ['Fr', 'So', 'Jr', 'Sr'];

// ---- species (PROVISIONAL — the real species session comes later) ----------

export const SPECIES: SpeciesDef[] = [
  {
    id: 'terran',
    name: 'Terran',
    tier: 1,
    poleCaps: { strong: 55, quick: 55, fierce: 55, savvy: 55 },
    heightRange: [180, 205],
    weightRange: [78, 112],
    desc: 'Baseline bipeds. Can lean any way, never far. The galaxy simply outbuilds them.',
    rarity: 0,
  },
  {
    id: 'lithoid',
    name: 'Lithoid',
    tier: 2,
    poleCaps: { strong: 95, quick: 15, fierce: 60, savvy: 65 },
    heightRange: [182, 208],
    weightRange: [140, 200],
    desc: 'Sentient rock. Stronger than everyone, forever. Has never once hurried.',
    rarity: 1,
  },
  {
    id: 'dodecapede',
    name: 'Dodecapede',
    tier: 2,
    poleCaps: { strong: 15, quick: 95, fierce: 60, savvy: 60 },
    heightRange: [168, 192],
    weightRange: [55, 85],
    desc: 'Twelve legs, zero patience. Nothing in the league moves faster.',
    rarity: 1,
  },
  {
    id: 'hexabrach',
    name: 'Hexabrach',
    tier: 2,
    poleCaps: { strong: 60, quick: 45, fierce: 95, savvy: 60 },
    heightRange: [195, 222],
    weightRange: [100, 140],
    desc: 'Six arms and a temper. A full-court press with a pulse.',
    rarity: 1,
  },
  {
    id: 'luminar',
    name: 'Luminar',
    tier: 3,
    poleCaps: { strong: 10, quick: 90, fierce: 20, savvy: 90 },
    heightRange: [188, 218],
    weightRange: [40, 62],
    desc: 'Coherent light with a jumper. Brilliant, blinding, and made of glass.',
    rarity: 2,
  },
];

export function speciesById(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0];
}

/** Tier-3 consequences, provisional: glass bodies get hurt and gas out faster. */
export function fragility(speciesId: string): number {
  return speciesById(speciesId).tier === 3 ? 2 : 1;
}

// ---- the league: 6 programs, hue-spread for clean ramps ---------------------

export const TEAM_TEMPLATES = [
  { name: 'Aurum Orsos', planet: 'Montalvo', region: 'Western Rim', bg: '#2D68C4', fg: '#F2A900' },
  { name: 'Voidfiends', planet: 'Duqat', region: 'Core Worlds', bg: '#5B21B6', fg: '#E6D5FF' },
  { name: 'Skyhawks', planet: 'Kanzar', region: 'Central Plains Belt', bg: '#C8102E', fg: '#FFE9E9' },
  { name: 'Voidcats', planet: 'Kentaurus', region: 'Bluegrass Nebula', bg: '#177245', fg: '#C9F2E4' },
  { name: 'Star Heels', planet: 'Novacarina', region: 'Eastern Drift', bg: '#4A9ED4', fg: '#0B2537' },
  { name: 'Voidhounds', planet: 'Zagnar Prime', region: 'Northwest Expanse', bg: '#C25E10', fg: '#FFE1C9' },
];

export const DEITY_NAMES = [
  'Zeuxx', 'Apollyx', 'Arex', 'Hermezz', 'Poseidrox', 'Hadez-9', 'Dionyzos',
  'Heliox', 'Kronoz', 'Atlazz', 'Jupiteron', 'Marz', 'Neptun-8', 'Vulkann', 'Mercurix',
  'Odynn', 'Thorr', 'Lokee', 'Baldyr', 'Heimdall-7', 'Tyrr', 'Freyr-X',
  'Ra-9', 'Anubix', 'Ozirix', 'Horuz', 'Thoth-3', 'Amunn', 'Sobekk',
  'Shangox', 'Ogunn', 'Olorunn', 'Eshuu', 'Obatala-2', 'Anansi-6',
  'Kalungaa', 'Mukurux', 'Huvee', 'Unkuluu', 'Modimoo', 'Nyambe-3',
  'Quetzal-4', 'Tezcatt', 'Kukulkan-6', 'Chaak', 'Huitzill',
  'Perunn', 'Velezz', 'Svarogg', 'Morozz', 'Perkunazz',
  'Lughh', 'Dagdaa', 'Brann', 'Morrigann',
  'Raijinn', 'Fujinn', 'Susanoo-9', 'Inarix', 'Wukongg', 'Nezha-X',
  'Mauii', 'Tangaroa-3', 'Lono-2', 'Ku-Prime', 'Pele-7',
  'Mardux', 'Enkii', 'Enlyl', 'Ishtarr', 'Gilgamezz',
  'Indrax', 'Varunox', 'Agnix', 'Suryon', 'Hanumann-8',
  'Ignatiux', 'Xavyer', 'Benedix', 'Augustyn', 'Gabryel', 'Mikha-El',
  'Raffael-9', 'Uriyel', 'Domynic', 'Seraphym', 'Pyus-X', 'Aquinax',
  'Ukko-3', 'Vaino-7', 'Sednaa',
];

// ---- the plan wheel ----------------------------------------------------------

export interface PlanDef {
  id: PlanId;
  name: string;
  pole: Pole;
  beats: PlanId;
  fantasy: string;
  beatLine: string; // "your X broke their Y" flavor
}

export const PLANS: PlanDef[] = [
  { id: 'pound', name: 'POUND', pole: 'strong', beats: 'clockwork', fantasy: 'Bully ball. Post them up, wear them down.', beatLine: 'Muscle smashed the system.' },
  { id: 'blitz', name: 'BLITZ', pole: 'quick', beats: 'pound', fantasy: 'Run and gun. Seven seconds or less.', beatLine: 'You ran their big men ragged.' },
  { id: 'swarm', name: 'SWARM', pole: 'fierce', beats: 'blitz', fantasy: 'Full-court terror. Make them hate the ball.', beatLine: 'The press ate their speedsters alive.' },
  { id: 'clockwork', name: 'CLOCKWORK', pole: 'savvy', beats: 'swarm', fantasy: 'The system. Every cut scripted.', beatLine: 'Poise dismantled their press.' },
];

export function planById(id: PlanId): PlanDef {
  return PLANS.find((p) => p.id === id)!;
}

export const POLE_LABEL: Record<Pole, string> = {
  strong: 'STRONG', quick: 'QUICK', fierce: 'FIERCE', savvy: 'SAVVY',
};

// ---- the drill board -----------------------------------------------------------

export interface DrillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  xp: [number, number];
  /** 'squad' trains everyone not sitting; 'one' trains a single pick; 'rest' recovers */
  target: 'squad' | 'one' | 'rest';
  up: OddsTail;
  down: OddsTail;
  energyCost: number; // player energy drained by participating
  injuryBias: number; // 0 mild … 2 severe
  cause: (name: string) => string;
}

export const DRILLS: DrillDef[] = [
  {
    id: 'shootaround',
    name: 'SHOOTAROUND',
    desc: 'Racks of shots under the practice dome. Nothing in space is safe, but this is close.',
    cost: 0,
    xp: [1, 3],
    target: 'squad',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'INJURY' },
    energyCost: 4,
    injuryBias: 0,
    cause: (n) => `${n} rolled an ankle stepping on a loose ball during shootaround. A loose ball. In shootaround.`,
  },
  {
    id: 'asteroid',
    name: 'ASTEROID PUSHES',
    desc: 'Push the practice asteroid up the gravity ramp until something in you changes.',
    cost: 1,
    xp: [3, 5],
    target: 'squad',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'INJURY' },
    energyCost: 10,
    injuryBias: 1,
    cause: (n) => `${n} got his arm stuck between two practice asteroids and saw no way out but to have a teammate rip him free.`,
  },
  {
    id: 'blaster',
    name: 'BLASTER DODGE',
    desc: 'The training blasters are set to "consequences". Lessons arrive at light speed.',
    cost: 2,
    xp: [5, 8],
    target: 'squad',
    up: { pct: 10, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    energyCost: 14,
    injuryBias: 2,
    cause: (n) => `${n} attempted to dodge a blaster bolt with a backflip. The backflip was beautiful. The bolt did not care.`,
  },
  {
    id: 'personal',
    name: 'PERSONAL SESSION',
    desc: 'One player, one coach, one closed gym. Word gets around.',
    cost: 1,
    xp: [8, 12],
    target: 'one',
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 5, cls: 'DRAMA' },
    energyCost: 8,
    injuryBias: 0,
    cause: (n) => `${n} tweaked something reaching for one more rep in his personal session.`,
  },
  {
    id: 'rest',
    name: 'TEAM REST',
    desc: 'Cancel everything. Recovery tanks, naps, and the sound of nothing happening.',
    cost: 0,
    xp: [0, 0],
    target: 'rest',
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    energyCost: 0,
    injuryBias: 0,
    cause: (n) => `${n}, unsupervised, found a crater to lollygag in on a borrowed grav-board.`,
  },
];

export function drillById(id: string): DrillDef {
  return DRILLS.find((d) => d.id === id) ?? DRILLS[0];
}

// ---- the galaxy: scan regions ---------------------------------------------------

export interface ScanDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  count: number;
  pool: string[];
  skillBonus: number;
  potBonus: number;
  down: OddsTail;
  up: OddsTail;
  local?: boolean;
}

export const SCAN_REGIONS: ScanDef[] = [
  {
    id: 'home',
    name: 'HOME PLANET',
    desc: 'Terrans wall to wall. Cheap, safe, capped — a Terran never becomes a monster.',
    cost: 1, count: 2, pool: ['terran'], skillBonus: 0, potBonus: 0,
    down: { pct: 2, cls: 'SHIP' }, up: { pct: 2, cls: 'INTEL' },
    local: true,
  },
  {
    id: 'nebula',
    name: 'LOCAL NEBULA',
    desc: 'Lithoid walls, Dodecapede blurs, Hexabrach storms. Real specialists, mild turbulence.',
    cost: 2, count: 2, pool: ['lithoid', 'dodecapede', 'hexabrach'], skillBonus: 4, potBonus: 5,
    down: { pct: 10, cls: 'SHIP' }, up: { pct: 5, cls: 'INTEL' },
  },
  {
    id: 'outerrim',
    name: 'OUTER RIM',
    desc: 'Luminars and the strangest talent in known space. The micrometeorites are not a rumor.',
    cost: 3, count: 2, pool: ['luminar', 'lithoid', 'dodecapede', 'hexabrach'], skillBonus: 8, potBonus: 10,
    down: { pct: 25, cls: 'SHIP' }, up: { pct: 5, cls: 'LOOT' },
  },
  {
    id: 'deepcore',
    name: 'DEEP CORE',
    desc: 'The old charts were real. Every species, generational ceilings, gravity that eats ships.',
    cost: 3, count: 2, pool: ['terran', 'lithoid', 'dodecapede', 'hexabrach', 'luminar'], skillBonus: 10, potBonus: 16,
    down: { pct: 25, cls: 'SHIP' }, up: { pct: 10, cls: 'LOOT' },
  },
];

export function scanById(id: string): ScanDef {
  return SCAN_REGIONS.find((r) => r.id === id) ?? SCAN_REGIONS[0];
}

// ---- the galaxy: SCOUT and RECRUIT acts -----------------------------------------

export interface ProspectActDef {
  id: string;
  kind: 'scout' | 'recruit';
  name: string;
  desc: string;
  cost: number;
  gain?: [number, number]; // commit % for recruit acts
  up: OddsTail;
  down: OddsTail;
}

export const PROSPECT_ACTS: ProspectActDef[] = [
  {
    id: 'attend',
    kind: 'scout',
    name: 'ATTEND HIS GAME',
    desc: 'A seat in the stands, a clipboard, the truth.',
    cost: 1,
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 2, cls: 'SHIP' },
  },
  {
    id: 'database',
    kind: 'scout',
    name: 'BUY THE COMBINE DATABASE',
    desc: 'Every measurement the league has, from a man in a chrome trench coat.',
    cost: 1,
    up: { pct: 10, cls: 'INTEL' },
    down: { pct: 25, cls: 'SCANDAL' },
  },
  {
    id: 'tour',
    kind: 'recruit',
    name: 'CAMPUS TOUR',
    desc: 'Safe. Modest. The gravy-fries do most of the talking.',
    cost: 1,
    gain: [6, 12],
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
  },
  {
    id: 'frat',
    kind: 'recruit',
    name: 'KAPPA NEBULA NIGHT',
    desc: 'The rowdiest house on campus shows him the time of his life. Usually.',
    cost: 1,
    gain: [12, 22],
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 25, cls: 'DRAMA' },
  },
  {
    id: 'dinner',
    kind: 'recruit',
    name: 'RESTAURANT AT THE END OF THE GALAXY',
    desc: 'Twelve courses, a window seat for the apocalypse, zero discretion.',
    cost: 1,
    gain: [20, 30],
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 25, cls: 'SCANDAL' },
  },
];

export function prospectActById(id: string): ProspectActDef {
  return PROSPECT_ACTS.find((a) => a.id === id) ?? PROSPECT_ACTS[0];
}

// ---- THE BAG ----------------------------------------------------------------------

export interface StoryResolution {
  text: string;
  fx?: Fx[];
  follow?: { weeks: number; beat: string; defId?: string; playerId?: number | null; data?: Record<string, unknown> }[];
  next?: { defId: string; beat: string; playerId?: number | null; data?: Record<string, unknown> };
}

export interface StoryCtx {
  s: GameState;
  player: Player | null;
  data: Record<string, unknown>;
  /** engine-provided helpers, so data stays pure */
  team: () => Player[];
  bestPlayer: () => Player | null;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  flavor: string;
  effectText: string;
  context: string[];
  up?: OddsTail;
  down?: OddsTail;
  use: (ctx: StoryCtx) => StoryResolution;
}

function tails(up: number, down: number): 'up' | 'down' | 'mid' {
  const r = Math.random() * 100;
  if (r < down) return 'down';
  if (r < down + up) return 'up';
  return 'mid';
}

export const ITEMS: ItemDef[] = [
  {
    id: 'vial',
    name: "BEELZEBUB'S VIAL",
    rarity: 'rare',
    flavor: '"One sip. Ask nothing." — the doctor on stAroid-5',
    effectText: '100% back on his feet tonight, full energy',
    context: ['injury', 'pregame'],
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    use: (ctx) => {
      const p = ctx.player ?? ctx.bestPlayer();
      if (!p) return { text: 'The vial glints. Nobody needs it. You put it away slowly.' };
      const t = tails(2, 25);
      if (t === 'down') {
        return {
          text: `${p.name} downs the vial and feels INCREDIBLE — for six hours. Then his legs stop answering. The team doctor won't even look at you. 3 weeks in the medbay.`,
          fx: [{ playerId: p.id, outWeeks: 3, outReason: 'Beelzebub aftermath', levelDelta: -1, mood: -10 }],
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} downs the vial. Whatever was wrong with him is gone — and something extra came with it. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, outWeeks: 0, energyP: 100, skill: 2, mood: 10 }],
        };
      }
      return {
        text: `${p.name} downs the vial, shudders once, and stands up like nothing ever happened. You ask nothing.`,
        fx: [{ playerId: p.id, outWeeks: 0, energyP: 100 }],
      };
    },
  },
  {
    id: 'xarter',
    name: "XARTER'S INVITATION",
    rarity: 'legendary',
    flavor: 'The mind-controlling trainer takes one pupil a year.',
    effectText: 'a level, instantly, and a body rebuilt for speed',
    context: ['practice'],
    up: { pct: 5, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'SCANDAL' },
    use: (ctx) => {
      const squad = ctx.team().filter((p) => p.outWeeks === 0);
      const p = squad.sort((a, b) => lean(b, 'quick') - lean(a, 'quick'))[0] ?? null;
      if (!p) return { text: 'Nobody is fit to travel to Xarter. The invitation dissolves.' };
      const t = tails(5, 10);
      const base: Fx = { playerId: p.id, levelDelta: 1, build: 8 };
      if (t === 'down') {
        return {
          text: `${p.name} returns from Coach Xarter faster than physics — and wrong behind the eyes. Mid-scrimmage he bites a teammate's leg. The league opens a file with your name on it.`,
          fx: [base, { playerId: p.id, outWeeks: 3, outReason: 'suspension (the biting)', head: -10 }, { heatS: 15 }],
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} returns from Coach Xarter transformed. His first step now happens slightly before he decides to take it.`,
          fx: [base, { playerId: p.id, skill: 3, mood: 10 }],
        };
      }
      return { text: `${p.name} returns from Coach Xarter a week later, faster, quieter, and unwilling to discuss it.`, fx: [base] };
    },
  },
  {
    id: 'chrono',
    name: 'CHRONO SIP',
    rarity: 'legendary',
    flavor: 'Time is a liquid if you know the right bartender.',
    effectText: 'three levels of growth, instantly',
    context: ['practice'],
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'DRAMA' },
    use: (ctx) => {
      const squad = ctx.team().filter((p) => p.outWeeks === 0 && p.level < 10);
      const p = squad.sort((a, b) => b.potential - a.potential)[0] ?? null;
      if (!p) return { text: 'Everyone is already who they will be. The sip goes flat.' };
      const t = tails(2, 10);
      if (t === 'down') {
        return {
          text: `${p.name} takes the sip and trains three subjective years in one afternoon. He also AGES three subjective years. Registrar says that's a class year. He's suddenly asking about graduation.`,
          fx: [{ playerId: p.id, levelDelta: 3 }, { playerId: p.id, mood: -5 }],
          next: { defId: 'chrono_age', beat: 'start', playerId: p.id },
        };
      }
      if (t === 'up') {
        return {
          text: `${p.name} takes the sip and comes back with three years of work in his hands — and a ceiling you can no longer see. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, levelDelta: 3, potential: 8 }],
        };
      }
      return { text: `${p.name} takes the sip. Three subjective years of empty-gym reps land in his body at once. He sits down for a while.`, fx: [{ playerId: p.id, levelDelta: 3 }] };
    },
  },
  {
    id: 'icepack',
    name: 'METEOR ICE PACK',
    rarity: 'common',
    flavor: 'Cold from before the solar system. The honest one.',
    effectText: 'recovery time halved',
    context: ['injury'],
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAIN' },
    use: (ctx) => {
      const p = ctx.player;
      if (!p || p.outWeeks === 0) return { text: 'Nobody is hurt. The ice pack sweats patiently.' };
      const newWeeks = Math.max(1, Math.ceil(p.outWeeks / 2));
      return {
        text: `The meteor ice does its ancient work. ${p.name}'s recovery: ${p.outWeeks} weeks → ${newWeeks}.`,
        fx: [{ playerId: p.id, outWeeks: newWeeks, outReason: p.outReason }],
      };
    },
  },
  {
    id: 'espresso',
    name: 'NEBULA ESPRESSO',
    rarity: 'common',
    flavor: 'Brewed under pressure. Like everyone here.',
    effectText: 'squad +20 energy tonight, −30 crash next week',
    context: ['pregame'],
    up: { pct: 2, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: () => ({
      text: 'The squad downs the espresso. Pupils the size of moons. Tonight they are LIMITLESS. Next week is next week.',
      fx: [{ teamEnergyP: 20 }],
      follow: [{ weeks: 1, beat: 'start', defId: 'espresso_crash', playerId: null }],
    }),
  },
  {
    id: 'karaoke',
    name: 'MOOD KARAOKE CHIP',
    rarity: 'common',
    flavor: 'Contains every power ballad ever written, in every language, at once.',
    effectText: 'squad mood +15',
    context: ['mood', 'practice'],
    up: { pct: 5, cls: 'SPIRIT' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      const t = tails(5, 2);
      if (t === 'down') {
        const p = pick(ctx.team());
        return { text: `Karaoke night. ${p.name} hogs the mic for two straight hours and the room turns on him.`, fx: [{ teamMood: 8 }, { playerId: p.id, mood: -10 }] };
      }
      if (t === 'up') return { text: 'Karaoke night ascends. Three-part harmony. Someone cries. The team leaves as brothers.', fx: [{ teamMood: 25 }] };
      return { text: 'Karaoke night. Off-key, off the rails, exactly right.', fx: [{ teamMood: 15 }] };
    },
  },
  {
    id: 'hologram',
    name: 'STUDY-BUDDY HOLOGRAM',
    rarity: 'common',
    flavor: 'A tutor of light. Extremely thorough. Slightly too thorough.',
    effectText: 'he passes',
    context: ['academic'],
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 10, cls: 'SCANDAL' },
    use: (ctx) => {
      const p = ctx.player;
      if (!p) return { text: 'No exams loom. The hologram recites poetry to itself.' };
      const t = tails(2, 10);
      if (t === 'down') {
        return {
          text: `The hologram, being thorough, SAT THE EXAM ITSELF wearing ${p.name}'s face. It scored a perfect 100, which was the giveaway. Identity-fraud paperwork is en route.`,
          fx: [{ heatS: 15 }, { playerId: p.id, outWeeks: 1, outReason: 'hologram hearing' }],
        };
      }
      if (t === 'up') return { text: `${p.name} studies with the hologram and something CLICKS. He aces it — and his game IQ came along.`, fx: [{ playerId: p.id, outWeeks: 0, head: 6, mood: 8 }] };
      return { text: `${p.name} passes. The hologram bows and folds itself into a point of light.`, fx: [{ playerId: p.id, outWeeks: 0, mood: 5 }] };
    },
  },
  {
    id: 'vip',
    name: 'KAPPA NEBULA VIP PASS',
    rarity: 'rare',
    flavor: 'Laminated. Glowing. Slightly sticky.',
    effectText: 'a recruit falls in love with campus: commitment +25%',
    context: ['recruiting'],
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 25, cls: 'DRAMA' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId) : ctx.s.prospects[0];
      if (!pr) return { text: 'Nobody to impress. The pass glows anyway.' };
      const t = tails(5, 25);
      if (t === 'down') {
        pr.commitPct = clamp(pr.commitPct - 20, 0, 95);
        return { text: `The VIP night ends in a brawl over somebody's cheerleader girlfriend. ${pr.name} leaves with a black eye and second thoughts. Commitment −20%.` };
      }
      pr.commitPct = clamp(pr.commitPct + 25, 0, 95);
      if (t === 'up') {
        pr.scoutLevel = 2; pr.seenSkillStar = 0; // engine re-derives on next view
        return { text: `${pr.name} has the night of his life — and plays pickup at 3am while your assistant takes notes. Commitment +25%, and now you KNOW him.` };
      }
      return { text: `${pr.name} has the time of his life. He leaves wearing one of your team caps. Commitment +25%.` };
    },
  },
  {
    id: 'boots',
    name: 'GRAVITY BOOTS',
    rarity: 'rare',
    flavor: 'Every step is leg day.',
    effectText: 'a body permanently rebuilt toward STRONG',
    context: ['practice'],
    up: { pct: 2, cls: 'BREAKTHROUGH' },
    down: { pct: 25, cls: 'INJURY' },
    use: (ctx) => {
      const squad = ctx.team().filter((p) => p.outWeeks === 0);
      const p = squad.sort((a, b) => lean(b, 'strong') - lean(a, 'strong'))[0] ?? null;
      if (!p) return { text: 'No legs available for leg day.' };
      const t = tails(2, 25);
      if (t === 'down') {
        return { text: `${p.name} wears the gravity boots for a week and his ankle files a formal complaint. 2 weeks.`, fx: [{ playerId: p.id, build: -5, outWeeks: 2, outReason: 'gravity ankle' }] };
      }
      if (t === 'up') return { text: `${p.name} wears the gravity boots and becomes LOAD-BEARING. The floor creaks respectfully.`, fx: [{ playerId: p.id, build: -8, skill: 2 }] };
      return { text: `${p.name} trains a week in the gravity boots. His footsteps now have bass.`, fx: [{ playerId: p.id, build: -5 }] };
    },
  },
  {
    id: 'wallet',
    name: 'THE REFEREE\'S "LOST" WALLET',
    rarity: 'rare',
    flavor: 'You found it. You could return it. You could return it COURTSIDE.',
    effectText: 'tonight, the whistle leans your way',
    context: ['pregame'],
    up: { pct: 2, cls: 'WINDFALL' },
    down: { pct: 50, cls: 'SCANDAL' },
    use: (ctx) => {
      const t = tails(2, 50);
      if (t === 'down') {
        return { text: 'The referee accepts the wallet, photographs you accepting his acceptance, and forwards everything to the league. The school board would like a word.', fx: [{ heatS: 25 }] };
      }
      ctx.s.pregameFlags.wallet = true;
      if (t === 'up') return { text: 'The referee pockets the wallet AND comps you his food-court vouchers. Tonight, the whistle sings your song.', fx: [{ coachEnergy: 1 }] };
      return { text: 'The referee pockets the wallet without breaking eye contact. Tonight, ties go to you.' };
    },
  },
  {
    id: 'cloak',
    name: 'CLOAKING DOUBT',
    rarity: 'rare',
    flavor: 'A device that makes your game plan look like every game plan.',
    effectText: "opponent's plan is random tonight",
    context: ['pregame'],
    up: { pct: 5, cls: 'INTEL' },
    down: { pct: 2, cls: 'DRAMA' },
    use: (ctx) => {
      ctx.s.pregameFlags.cloak = true;
      const t = tails(5, 2);
      if (t === 'up') return { text: 'The cloak hums. Their coach prepares for four different teams and, in the film room, briefly weeps. You can HEAR which plan they panicked into.', fx: [{ coachEnergy: 0 }] };
      if (t === 'down') return { text: 'The cloak hums so loudly your own huddle gets confused for a minute. It still works.', fx: [{ teamMood: -3 }] };
      return { text: 'The cloak hums. Tonight, their scouting report is a coin flip.' };
    },
  },
  {
    id: 'check',
    name: "BOOSTER'S BLANK CHECK",
    rarity: 'rare',
    flavor: 'The amount is blank. The strings are not.',
    effectText: 'a prospect signs. Today.',
    context: ['recruiting'],
    up: { pct: 2, cls: 'LOOT' },
    down: { pct: 25, cls: 'SCANDAL' },
    use: (ctx) => {
      const pr = ctx.data.prospectId !== undefined ? ctx.s.prospects.find((x) => x.id === ctx.data.prospectId) : [...ctx.s.prospects].sort((a, b) => b.potential - a.potential)[0];
      if (!pr) return { text: 'Nobody to buy. The check flutters, unspent.' };
      pr.commitPct = 100;
      pr.selected = true;
      const t = tails(2, 25);
      if (t === 'down') {
        return {
          text: `${pr.name} signs on the spot. So does the check — into a league evidence folder, eventually. You can feel the investigation coming like weather.`,
          follow: [{ weeks: 4, beat: 'start', defId: 'check_probe', playerId: null }],
        };
      }
      return { text: `${pr.name} signs on the spot. The booster winks at you across the parking lot for an uncomfortably long time.` };
    },
  },
];

export function itemById(id: string): ItemDef {
  return ITEMS.find((i) => i.id === id)!;
}

// ---- Universal Tournament content -----------------------------------------------

export const CHAMP_NAMES = [
  ['Kro', 'Nebular Wraiths'], ['Vantor-3', 'Sun Eaters'], ['Ophee', 'Comet Queens'],
  ['Drexal', 'Iron Choir'], ['Bulwark-9', 'Gravity Saints'], ['Xyphos', 'Star Serpents'],
  ['Molt', 'Hatchling Kings'], ['Verdant-2', 'Moss Titans'], ['Kessel Minor', 'Void Larks'],
  ['Thrace-7', 'Plasma Prophets'], ['Ummber', 'Dust Devils'], ['Neon Roa', 'Lightbenders'],
];

export const CHAMP_GIMMICKS = [
  'undefeated in three galaxies',
  'all-Lithoid front line, all of it angry',
  'coached by a sentient cloud with a whistle',
  'won their conference by forfeit — nobody will play them',
  'their home arena orbits inside a star',
  'their fans are, legally speaking, a swarm',
  'every player is the same age, which is 9,000',
  'run one play. It has never been stopped.',
  'their point guard is wanted in two systems',
  'they practice in double gravity, for fun',
];

export const CHAMP_COLORS: [string, string][] = [
  ['#8E1600', '#FFD9CC'], ['#B78400', '#241A00'], ['#005F73', '#CFFAFE'],
  ['#3F3F46', '#FDE047'], ['#6D28D9', '#DDD6FE'], ['#0F766E', '#CCFBF1'],
  ['#9D174D', '#FCE7F3'], ['#3F6212', '#ECFCCB'],
];

// ---- flavor pools -----------------------------------------------------------------

export const PROSPECT_BLURBS = [
  'Plays angry. Studies angrier.',
  'Homeschooled on a mining barge. Unbothered by crowds.',
  'Three-time intramural MVP of an orbital prep academy.',
  'His coach says he\'s "a project." His transcript says the same.',
  'Genuinely came for the education. Weird kid. Great motor.',
  'Grew four inches on the shuttle ride to the tryout.',
  "Dean's list. Also wanted in two systems for unpaid parking drones.",
  'Warms up in silence. Referees find it upsetting.',
];

export const WALKON_BLURBS = [
  'Won the halftime shooting contest twice. Insists that counts.',
  'Showed up to tryouts in jeans. Made every layup.',
  'The rec-center legend your assistant keeps mentioning.',
  'Filed the walk-on paperwork in crayon. Enthusiasm: elite.',
];

export const SCAN_FLAVOR = [
  'Scan complete. New names on the board:',
  'The long-range array pings twice. Fresh dossiers:',
  'The scout-scoop comes back full. On the board:',
];

const FESTS = [
  'the High Festival', 'the Harvest Festival', 'the Moon-Hatching', 'Ancestor Week',
  'the Feast of the Second Sun', 'the Great Molting', 'Gravity Day', 'the Festival of a Thousand Cousins',
];

// ---- injuries: one shared pool, many causes (SPEC §10.1) ---------------------------

export interface InjuryRoll {
  weeks: number;
  label: string;
  levelLoss: boolean;
}

/** Severity is drama's job; the printed rung was only the chance. */
export function rollInjury(bias: number, fragile: number): InjuryRoll {
  const r = Math.random() * 100 * (fragile > 1 ? 1.4 : 1) + bias * 12;
  if (r < 45) return { weeks: 1, label: 'a bad tweak', levelLoss: false };
  if (r < 75) return { weeks: 2 + rand(2), label: 'a real injury', levelLoss: false };
  return { weeks: 4 + rand(3), label: 'a bio-lab stay', levelLoss: true };
}

// ---- THE STORY REGISTRY -------------------------------------------------------------
// Two layers: cause flavors (owned by the source) + class-owned storylines.
// Every def is (beat, resolve). Everything printed is true (law 5).

export interface StoryBeatContent {
  tag: string;
  text: string;
  choices?: StoryChoiceView[];
  data?: Record<string, unknown>;
}

export interface StoryDef {
  id: string;
  kind: 'player' | 'coach';
  weight?: number;
  context?: string;
  when?: (s: GameState) => boolean;
  beat: (beatKey: string, ctx: StoryCtx) => StoryBeatContent;
  resolve: (choiceKey: string, ctx: StoryCtx, ev: StoryEvent) => StoryResolution;
}

const C = (key: string, label: string, opts: Partial<StoryChoiceView> = {}): StoryChoiceView => ({ key, label, ...opts });

function pname(ctx: StoryCtx): string {
  return ctx.player?.name ?? 'the kid';
}

/** Printed odds shifted by the player's head — with the cause shown (law 5). */
function headMod(p: Player | null, base: number, pole: 'fierce' | 'savvy'): { pct: number; note?: string } {
  if (!p) return { pct: base };
  if (lean(p, pole) >= 50) return { pct: Math.min(90, base * 2), note: pole === 'fierce' ? "he's Fierce, careful" : "he's Savvy — or says he is" };
  return { pct: base };
}

export const STORIES: StoryDef[] = [
  // ---- the injury storyline (class pool: INJURY) — reached from every cause ----
  {
    id: 'injury',
    kind: 'player',
    context: 'injury',
    beat: (_b, ctx) => {
      const weeks = ctx.data.weeks as number;
      const cause = ctx.data.cause as string;
      const label = ctx.data.label as string;
      const canPush = weeks <= 3;
      return {
        tag: 'INJURY REPORT',
        text: `${cause}\n\nThe med-scanner calls it ${label}: ${weeks} week${weeks === 1 ? '' : 's'} out.`,
        choices: [
          C('heal', `LET IT HEAL (${weeks}w out)`, { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'INJURY' } }),
          ...(canPush
            ? [C('push', 'TAPE IT UP — HE PLAYS', { up: { pct: 10, cls: 'BREAKTHROUGH' }, down: { pct: 50, cls: 'INJURY' } })]
            : []),
        ],
      };
    },
    resolve: (key, ctx) => {
      const p = ctx.player!;
      const weeks = ctx.data.weeks as number;
      const levelLoss = ctx.data.levelLoss as boolean;
      if (key === 'push') {
        const t = tails(10, 50);
        if (t === 'down') {
          return {
            text: `${p.name} plays through it and something GOES. What was ${weeks} weeks is now ${weeks * 2}. The med staff writes your name on a whiteboard with an unkind diagram.`,
            fx: [{ playerId: p.id, outWeeks: weeks * 2, outReason: 'made it worse', mood: -8, ...(weeks * 2 >= 4 ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
          };
        }
        if (t === 'up') {
          return { text: `${p.name} tapes it, plays, and finds a gear he didn't know he had. Pain is a teacher, apparently.`, fx: [{ playerId: p.id, head: -4, xp: 10, mood: 6 }] };
        }
        return { text: `${p.name} grits through the week. It holds. Barely.`, fx: [{ playerId: p.id, energyP: -20 }] };
      }
      // heal
      const t = tails(2, 2);
      if (t === 'up') {
        return {
          text: `${p.name} goes home to heal — and comes back the NEXT MORNING. His mother, it turns out, knows a way to regrow anything overnight. She sends you a casserole. 1 in 50, and you WON it.`,
          fx: [{ playerId: p.id, outWeeks: 0, mood: 15 }],
        };
      }
      if (t === 'down') {
        return {
          text: `${p.name} settles in to heal — then a complication. One extra week, and the med staff's tone got shorter.`,
          fx: [{ playerId: p.id, outWeeks: weeks + 1, outReason: 'complication', ...(weeks + 1 >= 4 && levelLoss ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
        };
      }
      return {
        text: `${p.name} settles into the bio-lab. The tank hums. ${weeks} week${weeks === 1 ? '' : 's'} of waiting starts now.`,
        fx: [{ playerId: p.id, outWeeks: weeks, ...(levelLoss ? { levelDelta: -1, skill: -(2 + rand(3)) } : {}) }],
      };
    },
  },

  // ---- generic drama & scandal pools -----------------------------------------
  {
    id: 'drama',
    kind: 'player',
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'LOCKER ROOM',
      text: `${ctx.data.cause ?? `${pname(ctx)} slammed a locker hard enough to dent it, and nobody will say why.`}\n\nThe room has gone quiet in the bad way.`,
      choices: [
        C('meeting', 'CALL A TEAM MEETING', { cost: 1, up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
        C('ignore', 'LET IT BLOW OVER', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player;
      if (key === 'meeting') {
        const t = tails(25, 5);
        if (t === 'up') return { text: 'The meeting runs long. Someone finally says the true thing out loud. The room exhales.', fx: [{ teamMood: 15 }] };
        if (t === 'down') return { text: 'The meeting turns into a tribunal. Old grievances get new lawyers.', fx: [{ teamMood: -8 }] };
        return { text: 'You talk. They listen, mostly. It helps, some.', fx: [{ teamMood: 6 }] };
      }
      const t = tails(5, 25);
      if (t === 'down') return { text: 'It does not blow over. It recruits.', fx: [{ teamMood: -10 }, ...(p ? [{ playerId: p.id, mood: -10 } as Fx] : [])] };
      if (t === 'up') return { text: 'By Thursday it has somehow become an inside joke. Teams are strange weather.', fx: [{ teamMood: 6 }] };
      return { text: 'It simmers, then settles. Mostly.', fx: [{ teamMood: -3 }] };
    },
  },
  {
    id: 'scandal',
    kind: 'coach',
    beat: (_b, ctx) => ({
      tag: 'THE LEAGUE CALLS',
      text: `${ctx.data.cause ?? 'A league investigator is in your lobby, holding a folder like it owes him money.'}\n\nHow do you play it?`,
      choices: [
        C('own', 'OWN IT, TAKE THE HIT', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'SCANDAL' } }),
        C('deny', 'DENY EVERYTHING', { up: { pct: 25, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'own') {
        const t = tails(10, 2);
        if (t === 'up') return { text: 'You own it so completely the press conference becomes a redemption arc. The school hates the headline and respects the spine.', fx: [{ heatS: 5, teamMood: 5 }] };
        return { text: 'You take the hit standing up. It costs, but it costs once.', fx: [{ heatS: 10 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: 'The denial HOLDS. The folder, it turns out, was mostly receipts from a noodle bar.', fx: [] };
      if (t === 'down') return { text: 'The denial collapses in four days. Now it\'s the thing AND the cover-up of the thing.', fx: [{ heatS: 20 }] };
      return { text: 'The league can\'t prove it. The school can\'t forget it.', fx: [{ heatS: 12 }] };
    },
  },

  // ---- breakthrough pool (class: BREAKTHROUGH) ---------------------------------
  {
    id: 'breakthrough',
    kind: 'player',
    beat: (_b, ctx) => ({
      tag: '★ BREAKTHROUGH ★',
      text: `${ctx.data.cause ?? 'Mid-drill, the gym goes quiet.'}\n\n${pname(ctx)} just did something nobody practiced. Everyone saw it. Nobody can explain it.`,
    }),
    resolve: (_key, ctx) => {
      const p = ctx.player!;
      if (Math.random() < 0.5 && p.potential < 95) {
        return { text: `${p.name}'s ceiling just moved. You felt it move.`, fx: [{ playerId: p.id, potential: 6, mood: 10 }] };
      }
      return { text: `${p.name} has leveled his whole game up overnight.`, fx: [{ playerId: p.id, levelDelta: 1, mood: 10 }] };
    },
  },

  // ---- weekly player stories (ported to the two-tier template) ------------------
  {
    id: 'festival',
    kind: 'player',
    weight: 4,
    context: 'mood',
    beat: (b, ctx) => {
      const p = pname(ctx);
      if (b === 'ask') {
        const fest = ctx.data.fest as string;
        return {
          tag: 'CAMPUS STORY',
          text: `It's ${fest} on ${p}'s home planet — the whole world shuts down for it. He wants two weeks. He's looking at you with all of his eyes.`,
          choices: [
            C('full', 'TWO WEEKS. SEE THE COUSINS.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 10, cls: 'INJURY' } }),
            C('bargain', '"ONE WEEK. BRING ME LEFTOVERS."', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
            C('no', 'PLAYOFFS ARE MADE IN WEEKS LIKE THIS.', { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'DRAMA' } }),
          ],
        };
      }
      return {
        tag: 'CAMPUS STORY',
        text: `${p} is at your door with a packed duffel bag. He's asking for time off. He hasn't said why.`,
        choices: [
          C('sure', '"SURE." (ask nothing)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
          (() => {
            const m = headMod(ctx.player, 25, 'fierce');
            return C('why', '"WHY?"', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: m.pct as 2 | 5 | 10 | 25 | 50, cls: 'DRAMA', note: m.note } as OddsTail });
          })(),
        ],
      };
    },
    resolve: (key, ctx, ev) => {
      const p = ctx.player!;
      if (ev.beat === 'ask') {
        if (key === 'no') {
          const t = tails(2, 25);
          if (t === 'down') return { text: `${p.name} nods and walks out without a word. His cousins send a group holo from the festival every night. He watches all of them.`, fx: [{ playerId: p.id, mood: -16 }] };
          if (t === 'up') return { text: `${p.name} channels it. Every drill this week is personal. You feel a little bad about how well this worked.`, fx: [{ playerId: p.id, mood: -6, xp: 12 }] };
          return { text: `${p.name} stays. He's professional about it. Professionally cold.`, fx: [{ playerId: p.id, mood: -10 }] };
        }
        const weeks = key === 'full' ? 2 : 1;
        const res: StoryResolution = {
          text: key === 'full'
            ? `${p.name} boards the long-haul shuttle with a smile you haven't seen since preseason.`
            : `${p.name} negotiates hard, settles for one week, and promises leftovers. There will be leftovers.`,
          fx: [{ playerId: p.id, outWeeks: weeks, outReason: 'home for the festival', mood: key === 'full' ? 10 : 4 }],
          follow: [{ weeks: weeks + 1, beat: 'start', defId: 'festival_return', playerId: p.id, data: { full: key === 'full' } }],
        };
        if (key === 'bargain' && tails(5, 25) === 'down') {
          res.text += ` His hatch-brother calls you personally to say the family "noticed the discount."`;
          res.fx!.push({ playerId: p.id, mood: -8 });
        }
        return res;
      }
      // beat 'start'
      if (key === 'sure') {
        const t = tails(5, 10);
        const base: StoryResolution = {
          text: `You sign the slip without a question. ${p.name} blinks.`,
          fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave, unexplained' }],
        };
        if (t === 'up') { base.text += ' Then he hugs you. You have never seen him hug anything.'; base.fx!.push({ playerId: p.id, mood: 18 }); }
        else if (t === 'down') { base.text += ` Later you overhear him: "he didn't even ask." It didn't land the way you meant it.`; base.fx!.push({ playerId: p.id, mood: -10 }); }
        else base.fx!.push({ playerId: p.id, mood: 5 });
        return base;
      }
      // why?
      const m = headMod(p, 25, 'fierce');
      const t = tails(50, m.pct);
      if (t === 'down') return { text: `${p.name}'s jaw sets. "Forget it." He leaves the slip on your desk and the door doesn't quite slam, which is worse.`, fx: [{ playerId: p.id, mood: -12 }] };
      if (t === 'up') {
        return {
          text: `He softens. It's ${pick(FESTS)} back home — every cousin, grandmother, and hatchmate. Now you're negotiating.`,
          next: { defId: 'festival', beat: 'ask', playerId: p.id, data: { fest: pick(FESTS) } },
        };
      }
      if (lean(p, 'savvy') >= 50 && tails(25, 0) === 'up') {
        return { text: `"Family thing," he says smoothly. You sign the slip. (Weeks later you learn there was no family thing. There was a music festival. He's Savvy. People lie.)`, fx: [{ playerId: p.id, outWeeks: 1, outReason: '"family thing"', mood: 8 }] };
      }
      return { text: `"Just... home stuff, coach." You sign the slip and don't push.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'home stuff', mood: 3 }] };
    },
  },
  {
    id: 'festival_return',
    kind: 'player',
    beat: (_b, ctx) => {
      const roll = Math.random() * 100;
      const p = pname(ctx);
      let text: string;
      let fx: Fx[];
      if (roll < 15) { text = `${p} is back from the festival — on crutches. Traditional cliff-diving, third cousin's dare. Two more weeks.`; fx = [{ outWeeks: 2, outReason: 'festival cliff-diving', energyP: -20 }]; }
      else if (roll < 30) { text = `${p} is back from the festival... married. There are also, somehow, triplets. He keeps drifting off mid-drill to look at holos of them.`; fx = [{ mood: -6, head: 4 }]; }
      else if (roll < 65) { text = `${p} is back from the festival glowing. Grandma's cooking, twelve naps, zero basketball. He looks five years younger.`; fx = [{ mood: 22, energyP: 20 }]; }
      else if (roll < 85) { text = `${p} is back from the festival with six new abs. The ceremonial gravity-crunches are not ceremonial.`; fx = [{ build: -6, mood: 8 }]; }
      else if (roll < 98) { text = `${p} is back and something's off — time dilation on the pilgrimage route. He's been shooting on his uncle's hoop for three subjective years. His release is silk.`; fx = [{ xp: 30, mood: 5 }]; }
      else { text = `${p} is back from the festival TRANSFORMED. The elders saw something in him and told him what it was. 1 in 50, and you WON it.`; fx = [{ potential: 8, mood: 15 }]; }
      ctx.data.text = text;
      ctx.data.fx = fx;
      return { tag: 'THE RETURN', text };
    },
    resolve: (_key, ctx) => ({ text: '', fx: (ctx.data.fx as Fx[] | undefined)?.map((f) => ({ ...f, playerId: ctx.player?.id })) ?? [] }),
  },
  {
    id: 'diet',
    kind: 'player',
    weight: 3,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} has discovered the all-mineral diet of the Lithoid monks and wants to try it for a week. His plate at the training table is, at this moment, gravel.`,
      choices: [
        C('allow', 'LET HIM CRUNCH', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'INJURY' } }),
        C('confiscate', 'CONFISCATE THE GRAVEL', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'confiscate') {
        const t = tails(2, 10);
        if (t === 'down') return { text: `${p.name} sulks through practice. The monks send you a strongly-worded stone tablet.`, fx: [{ playerId: p.id, mood: -8 }] };
        if (t === 'up') return { text: `${p.name} accepts defeat and eats a normal dinner with visible relief. He just wanted someone to stop him.`, fx: [{ playerId: p.id, mood: 5 }] };
        return { text: 'The gravel goes in a drawer. The drawer now rattles when the team bus passes.', fx: [{ playerId: p.id, mood: -4 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: `The monk diet WORKED?? ${p.name} is denser somehow. The training staff refuses to explain the scale readout.`, fx: [{ playerId: p.id, build: -6, weightKg: 6, mood: 5 }] };
      if (t === 'down') return { text: `${p.name} spent three days of mineral week in the medical bay. He is not, it turns out, a Lithoid monk.`, fx: [{ playerId: p.id, energyP: -30, mood: -6, outWeeks: 1, outReason: 'gravel recovery' }] };
      return { text: `${p.name} quit the mineral diet on day two and ate an entire celebration cake about it. He regrets nothing.`, fx: [{ playerId: p.id, mood: 10, weightKg: 3 }] };
    },
  },
  {
    id: 'cheating',
    kind: 'player',
    weight: 3,
    context: 'academic',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} got caught cheating on his Intro to Asteroid Ethics midterm. The professor is furious. The athletic department is asking what you want done.`,
      choices: [
        C('suspend', 'SUSPEND HIM 2 WEEKS, RETAKE IT HONESTLY', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('lean', 'LEAN ON THE PROFESSOR. HE PLAYS.', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'suspend') {
        const t = tails(10, 2);
        const base: Fx[] = [{ playerId: p.id, outWeeks: 2, outReason: 'academic suspension', mood: -5 }, { heatS: -8 }];
        if (t === 'up') return { text: `${p.name} sits two weeks, retakes it honestly, and passes with a C-. He is weirdly proud of the C-. The whole team studies harder for a month.`, fx: [...base, { teamMood: 5 }] };
        if (t === 'down') return { text: `${p.name} sits his two weeks and blames you for every minute of them.`, fx: [...base, { playerId: p.id, mood: -6 }] };
        return { text: `${p.name} sits two weeks and retakes the exam honestly. The professor nods at you in the corridor. The school notices.`, fx: base };
      }
      const t = tails(5, 25);
      if (t === 'down') {
        return {
          text: 'The grade quietly becomes a B. Two weeks later, the professor loudly becomes a whistleblower.',
          fx: [{ heatS: 10 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'The Asteroid Ethics grade-change has reached the league office, professor\'s testimony attached.' } },
        };
      }
      if (t === 'up') return { text: 'The grade quietly becomes a B. The professor gets a parking spot. Everyone is bought and nobody is happy, but he PLAYS.', fx: [{ heatS: 8 }] };
      return { text: 'The grade quietly becomes a B. The professor now leaves the arena early whenever your team is winning.', fx: [{ heatS: 8 }] };
    },
  },
  {
    id: 'cheerleader',
    kind: 'player',
    weight: 3,
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} comes to your office, pale. A cheerleader from Zeta Squadron is pregnant, and he's the father. He has no idea what to do and, for some reason, thinks you will.`,
      choices: [
        C('leave', 'A WEEK OFF. HANDLE IT LIKE AN ADULT.', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('season', '"SEASON FIRST. OFFSEASON PROBLEM."', { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 50, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'leave') {
        const t = tails(25, 2);
        if (t === 'up') return { text: `${p.name} misses a game, attends every appointment, and comes back more grown-up than he left. The team noticed. The team talks about it quietly and well.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 10, head: 5 }, { teamMood: 5 }, { heatS: -4 }] };
        if (t === 'down') return { text: `${p.name} takes the week — and comes back with MORE questions. You are apparently the godfather now? There was no form for this.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 3 }] };
        return { text: `${p.name} takes the week and handles his business. He comes back steadier.`, fx: [{ playerId: p.id, outWeeks: 1, outReason: 'personal leave', mood: 8, head: 3 }] };
      }
      const t = tails(2, 50);
      if (t === 'down') return { text: `${p.name} stays in the lineup with his head somewhere else entirely. He's stopped eating properly. Zeta Squadron now boos your bench, specifically.`, fx: [{ playerId: p.id, mood: -18, weightKg: -4 }, { heatS: 5 }] };
      if (t === 'up') return { text: `${p.name} somehow compartmentalizes. You have created a professional. You are not sure you're proud.`, fx: [{ playerId: p.id, mood: -5, head: 3 }] };
      return { text: `${p.name} plays on, hollow-eyed. The scoreboard doesn't know. Everyone else does.`, fx: [{ playerId: p.id, mood: -12 }] };
    },
  },
  {
    id: 'rampage',
    kind: 'player',
    weight: 2,
    context: 'discipline',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} lost his temper in a study group and put all five of his lab partners in the hospital. No fatalities — this is college, not the frontier — but the Dean wants blood. Metaphorically.`,
      choices: [
        C('pods', 'TWO WEEKS OUT, ANGER-MANAGEMENT PODS', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('plays', '"HIS SPECIES IS JUST LIKE THAT." HE PLAYS.', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'pods') {
        const t = tails(10, 2);
        const base: Fx[] = [{ playerId: p.id, outWeeks: 2, outReason: 'anger-management pods', head: 6 }, { heatS: -8 }];
        if (t === 'up') return { text: `${p.name} completes the pod program and hand-writes five apology letters. One lab partner frames theirs. He comes back with a stillness that frightens opponents more than the temper did.`, fx: [...base, { playerId: p.id, mood: 8 }] };
        return { text: `${p.name} does his pod time and writes his letters. The Dean's office stands down.`, fx: base };
      }
      const t = tails(5, 25);
      if (t === 'down') {
        return {
          text: `The Dean's office issues a statement calling your program "a disgrace with an excellent record." The league would like to discuss the second half of that sentence.`,
          fx: [{ heatS: 15 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'Five hospitalized lab partners and a coach who shrugged. The folder is thick.' } },
        };
      }
      if (t === 'up') return { text: 'He plays. He plays FURIOUS. The boosters send you a fruit basket shaped like a fist.', fx: [{ heatS: 8, heatB: -8 }, { playerId: p.id, mood: 5 }] };
      return { text: `He plays. The Dean starts attending your games just to glare.`, fx: [{ heatS: 10 }] };
    },
  },
  {
    id: 'exchange',
    kind: 'player',
    weight: 2,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} has been selected for a prestigious 3-week academic exchange on the Scholar-Ring of Alexandria-One. Huge for his future. Also huge for your rotation, in the bad way.`,
      choices: [
        C('go', "LET HIM GO. IT'S COLLEGE.", { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('deny', "DENY IT. HE'S HERE TO PLAY.", { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 25, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'go') {
        const t = tails(25, 2);
        const base: Fx[] = [{ playerId: p.id, outWeeks: 3, outReason: 'academic exchange', mood: 10 }, { heatS: -6 }];
        if (t === 'up') return { text: `${p.name} sends weekly holo-postcards and returns measurably smarter and insufferable about it. The Scholar-Ring rewired how he sees the floor.`, fx: [...base, { playerId: p.id, head: 8 }] };
        if (t === 'down') return { text: `${p.name} loves it there SO much. His postcards start mentioning "options". You sleep worse.`, fx: [...base, { playerId: p.id, mood: 5 }] };
        return { text: `${p.name} goes, learns, returns with a Scholar-Ring hoodie he never takes off.`, fx: [...base, { playerId: p.id, head: 5 }] };
      }
      const t = tails(2, 25);
      if (t === 'down') return { text: `He says he understands. He does not understand. His advisor files a complaint with the school.`, fx: [{ playerId: p.id, mood: -12 }, { heatS: 8 }] };
      if (t === 'up') return { text: `He shrugs it off faster than you feared. "Next cycle," he says, and buries himself in film.`, fx: [{ playerId: p.id, mood: -3, xp: 8 }] };
      return { text: `He nods, once. The word "no" sits between you for the rest of the season.`, fx: [{ playerId: p.id, mood: -8 }] };
    },
  },
  {
    id: 'streamer',
    kind: 'player',
    weight: 2,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} went viral on the galactic streams last night — 40 million views of him dunking over a parked shuttle. He now has a manager, a ring light, and opinions about "his brand".`,
      choices: [
        C('lean', 'LEAN INTO IT. FREE PUBLICITY.', { up: { pct: 10, cls: 'WINDFALL' }, down: { pct: 25, cls: 'DRAMA' } }),
        C('lockers', 'PHONES STAY IN LOCKERS. FOREVER.', { up: { pct: 10, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'lean') {
        const t = tails(10, 25);
        if (t === 'up') return { text: `${p.name}'s follower count triples and so does the season-ticket line. The boosters are DELIGHTED.`, fx: [{ playerId: p.id, mood: 12 }, { heatB: -10 }] };
        if (t === 'down') return { text: `${p.name} now signs autographs with a stage name and reviews his own highlights during film study. The locker room has opinions about "his brand" too.`, fx: [{ playerId: p.id, mood: 8, head: -5 }, { teamMood: -6 }] };
        return { text: `${p.name} rides the wave. Practice attendance: perfect. Practice focus: negotiable.`, fx: [{ playerId: p.id, mood: 10 }] };
      }
      const t = tails(10, 10);
      if (t === 'down') return { text: `${p.name} posts one final holo — his locker, captioned "the grind" — and sulks for a week. His manager quits via skywriting.`, fx: [{ playerId: p.id, mood: -10 }] };
      if (t === 'up') return { text: `${p.name} hands the phone over and, freed from the algorithm, has the best practice week of his life.`, fx: [{ playerId: p.id, mood: -3, xp: 12 }] };
      return { text: `Phones go in lockers. The ring light goes on a shelf, pointed at nothing, like a lighthouse for a sea that left.`, fx: [{ playerId: p.id, mood: -5, xp: 5 }] };
    },
  },
  {
    id: 'voidpup',
    kind: 'player',
    weight: 2,
    context: 'mood',
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `${pname(ctx)} found a void-pup abandoned behind the arena and smuggled it into the dorms. It has too many teeth and it loves him unconditionally. Pets are, strictly speaking, forbidden.`,
      choices: [
        C('mascot', 'THE TEAM HAS A MASCOT NOW', { up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('shelter', 'TAKE IT TO THE SHELTER', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'mascot') {
        const t = tails(25, 10);
        if (t === 'up') return { text: 'The void-pup attends every practice from a courtside crate and learns to fetch rebounds. Morale is illegal levels of high. It has eaten two whistles.', fx: [{ teamMood: 12 }, { teamEnergyP: 5 }] };
        if (t === 'down') return { text: `The void-pup phased through a wall into the Dean's office and unmade his desk. ${p.name} took the blame. There is paperwork.`, fx: [{ teamMood: 5 }, { heatS: 10 }] };
        return { text: 'The void-pup becomes furniture with teeth. The team is 30% happier and 100% more bitten.', fx: [{ teamMood: 10 }] };
      }
      const t = tails(5, 10);
      if (t === 'down') return { text: `${p.name} visits the shelter every day after practice. Every. Single. Day. He is not over it.`, fx: [{ playerId: p.id, mood: -8 }] };
      if (t === 'up') return { text: `The shelter names the void-pup after your program. Season-ticket holders adopt it within a week. Everyone wins, even the whistles.`, fx: [{ playerId: p.id, mood: 2 }, { heatS: -3 }] };
      return { text: `The shelter takes it in. ${p.name} keeps a photo in his locker. The photo blinks.`, fx: [{ playerId: p.id, mood: -5 }] };
    },
  },
  {
    id: 'booster_pod',
    kind: 'player',
    weight: 2,
    beat: (_b, ctx) => ({
      tag: 'CAMPUS STORY',
      text: `A booster in a chrome suit "happens to run into" ${pname(ctx)} and offers him a personal off-books training pod — the kind pros use. Strictly against amateurism rules, obviously.`,
      choices: [
        C('report', 'REPORT THE BOOSTER TO THE LEAGUE', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
        C('blind', 'LOOK THE OTHER WAY', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const p = ctx.player!;
      if (key === 'report') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'The league sends a commendation hologram. The boosters send a season of very cold silence. Their patience with you drops audibly.', fx: [{ heatS: -8, heatB: 12 }] };
        if (t === 'up') return { text: 'The league sends a commendation hologram AND fines the booster into another tax bracket. The school frames the hologram.', fx: [{ heatS: -12 }] };
        return { text: 'The league opens a file. The booster sends you a very cold holiday card.', fx: [{ heatS: -8, heatB: 6 }] };
      }
      const t = tails(25, 25);
      if (t === 'up') return { text: `${p.name} comes back from "visiting his aunt" noticeably sharper. You ask no questions, which is itself an answer.`, fx: [{ playerId: p.id, xp: 15 }, { heatB: -5 }] };
      if (t === 'down') {
        return {
          text: `${p.name} gets photographed entering the pod facility by a fan account with 4 followers and terrifying reach.`,
          fx: [{ playerId: p.id, xp: 10 }],
          next: { defId: 'scandal', beat: 'start', playerId: null, data: { cause: 'The off-books training pod is on the front page of every stream in the conference.' } },
        };
      }
      return { text: `${p.name} trains in the pod at 5am, twice. Nothing happens. Probably nothing happened.`, fx: [{ playerId: p.id, xp: 8 }] };
    },
  },

  // ---- KNOWLEDGE storylines ---------------------------------------------------
  {
    id: 'seminar',
    kind: 'coach',
    weight: 2,
    when: (s) => s.unlockedDrills.length < DRILLS.length,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'An embossed holo-invitation: the Galactic Coaching Seminar on Blorgon 6, this week. Two days of drills, film, and lukewarm banquet food with the best minds in the game.',
      choices: [
        C('attend', 'ATTEND', { cost: 2, up: { pct: 50, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('toss', 'TOSS THE INVITATION', { up: { pct: 2, cls: 'WINDFALL' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'toss') {
        return { text: 'You have games to win. The invitation folds itself into a paper shuttle and flies off, offended.', fx: [] };
      }
      const t = tails(50, 10);
      const locked = DRILLS.filter((d) => !ctx.s.unlockedDrills.includes(d.id));
      if (t === 'up' && locked.length) {
        const d = pick(locked);
        return { text: `Blorgon 6 pays off — a legendary assistant walks you through ${d.name}, step by step. It's yours now, forever.`, fx: [{ unlockDrill: d.id }] };
      }
      if (t === 'down') return { text: 'You catch Blorgon flu at the seminar buffet and sneeze through every session. The team spends the week worried about you.', fx: [{ teamMood: -5 }] };
      return { text: 'Six hours of trust falls and a pyramid scheme about "vertical culture". You learned nothing, and it cost you the trip.' };
    },
  },
  {
    id: 'oracle',
    kind: 'coach',
    weight: 2,
    when: (s) => s.unlockedDrills.length < DRILLS.length && s.week > 2,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'On the way back from a scouting run, your ship drops out of warp above an uncharted moon. On its surface: a single hut, a single light, and — your instruments insist — a single very old basketball hoop.',
      choices: [
        C('land', 'LAND AND KNOCK', { up: { pct: 50, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SHIP' } }),
        C('leave', 'STAY IN ORBIT. WARP HOME.', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'leave') return { text: 'Some doors are better left unknocked. The hoop watches you leave.', fx: [] };
      const t = tails(50, 25);
      const locked = DRILLS.filter((d) => !ctx.s.unlockedDrills.includes(d.id));
      if (t === 'up' && locked.length) {
        const d = pick(locked);
        return { text: `The door opens before you knock. "You are late," says the oracle, who has never met you. An hour later you know ${d.name} — a method your species has not invented yet.`, fx: [{ unlockDrill: d.id }] };
      }
      if (t === 'down') {
        return {
          text: "The oracle's moon has opinions about your landing gear.",
          next: { defId: 'grounded', beat: 'start', playerId: null, data: { cause: 'Your landing struts are lunar debris now.' } },
        };
      }
      return { text: 'The oracle speaks only in riddles about "the pick and the roll within". You leave with incense in your clothes and nothing else.', fx: [] };
    },
  },
  {
    id: 'starcharts',
    kind: 'coach',
    weight: 2,
    when: (s) => !s.unlockedRegions.includes('deepcore') && s.week > 3,
    beat: () => ({
      tag: "COACH'S DESK",
      text: 'A retired scout sells memorabilia outside the arena. Between the pennants: a cracked datapad labeled "CORE ROUTES — DO NOT FLY". She wants an endorsement of her dubious autobiography, not money.',
      choices: [
        C('endorse', 'ENDORSE THE BOOK, TAKE THE CHARTS', { up: { pct: 50, cls: 'INTEL' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('decline', 'DECLINE POLITELY', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'decline') return { text: "She shrugs and sells the datapad to the Voidfiends' coach instead. You will think about this forever.", fx: [] };
      const t = tails(50, 10);
      if (t === 'up') return { text: 'Your name now graces the back cover of "I Scouted The Void (And The Void Scouted Back)". The datapad hums to life: REAL Deep Core routes, annotated in three languages.', fx: [{ unlockRegion: 'deepcore' }] };
      if (t === 'down') return { text: 'The charts are real — and so is chapter 7, in which she describes your recruiting methods in avoidable detail. The school reads books, it turns out.', fx: [{ unlockRegion: 'deepcore' }, { heatS: 10 }] };
      return { text: 'The charts are a menu from a noodle bar on Kanzar. A very good noodle bar, to be fair.', fx: [{ teamMood: 3 }] };
    },
  },

  // ---- ship setbacks are DOORS (law 4) ------------------------------------------
  {
    id: 'grounded',
    kind: 'coach',
    beat: (b, ctx) => {
      if (b === 'goblin_hold') {
        return { tag: 'THE SHIP', text: 'Weekly transmission from the mech-goblin starbase: your ship is "almost done". There is laughing in the background of the recording.' };
      }
      return {
        tag: 'THE SHIP',
        text: `${ctx.data.cause ?? 'Turbulence cracks the hull on the way home.'}\n\nAs you limp back sub-warp, a starbase of mech-goblins radios in: they can fix it, cheap, "mostly honest".`,
        choices: [
          C('goblins', 'LET THE GOBLINS FIX IT', { up: { pct: 50, cls: 'WINDFALL' }, down: { pct: 50, cls: 'SHIP' } }),
          C('limp', 'LIMP HOME. 3 WEEKS GROUNDED.', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      if (ctx.data.hold) {
        if (Math.random() < 0.25) {
          ctx.s.groundedWeeks = 0;
          return { text: 'The goblins deliver. The ship gleams. Several parts are new, several are "new". You fly.' };
        }
        return { text: 'Not this week. The goblins have installed a hot tub you did not order and cannot afford.', follow: [{ weeks: 1, beat: 'goblin_hold', defId: 'grounded', playerId: null, data: { hold: true } }] };
      }
      if (key === 'limp') {
        ctx.s.groundedWeeks = 3;
        return { text: 'You limp home on maneuvering thrusters. The ship is grounded 3 weeks. Home-planet scouting only.', fx: [] };
      }
      if (tails(50, 50) === 'up') {
        return { text: 'The goblins swarm the hull, argue in sparks, and hand it back BETTER. The bill: 3⚡ off next week\'s stipend. Fair, honestly.', follow: [{ weeks: 1, beat: 'start', defId: 'goblin_bill', playerId: null }] };
      }
      ctx.s.groundedWeeks = 12;
      return {
        text: 'The goblins fail spectacularly. Your ship is now grounded at THEIR base, wearing half its engine. You take a space-bus home. Every week, a chance they finish.',
        follow: [{ weeks: 1, beat: 'goblin_hold', defId: 'grounded', playerId: null, data: { hold: true } }],
      };
    },
  },
  {
    id: 'hullbreach',
    kind: 'coach',
    beat: () => ({
      tag: 'THE SHIP',
      text: 'A micrometeorite shreds the cargo bay on the way home — and your scout reports flew out through the hole. Every dossier, spinning off into the void in a slow, expensive constellation.',
      choices: [
        C('accept', 'WATCH THEM GO', { up: { pct: 2, cls: 'INTEL' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('eva', 'SUIT UP AND CHASE THEM (1⚡)', { cost: 1, up: { pct: 50, cls: 'INTEL' }, down: { pct: 10, cls: 'INJURY' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const wipe = (): void => {
        for (const pr of ctx.s.prospects) { pr.scoutLevel = 0; }
      };
      if (key === 'eva') {
        const t = tails(50, 10);
        if (t === 'up') return { text: 'You spacewalk with a net like a lunatic and catch nearly all of it. The scouting intel survives.', };
        if (t === 'down') { wipe(); return { text: 'You catch three dossiers and a meteorite catches you. The intel is gone and your shoulder clicks now.', }; }
        wipe();
        return { text: 'You catch two folders and a lot of vacuum. The rest is a constellation now. Intel: gone.', };
      }
      wipe();
      return { text: 'You watch a season of scouting drift off sunward. Somewhere out there, a very informed comet. Every prospect on the board is a stranger again.', fx: [] };
    },
  },

  // ---- follow-up bill beats -------------------------------------------------------
  {
    id: 'goblin_bill',
    kind: 'coach',
    beat: () => ({ tag: 'THE BILL', text: 'The mech-goblin invoice arrives, engraved on a small meteor: 3⚡. They also left a mint.' }),
    resolve: () => ({ text: '', fx: [{ coachEnergy: -3 }] }),
  },
  {
    id: 'espresso_crash',
    kind: 'coach',
    beat: () => ({ tag: 'THE CRASH', text: 'The nebula espresso bill comes due. The squad moves like seaweed. Practice is held at a whisper.' }),
    resolve: () => ({ text: '', fx: [{ teamEnergyP: -30 }] }),
  },
  {
    id: 'check_probe',
    kind: 'coach',
    beat: () => ({ tag: 'THE LEAGUE CALLS', text: "The blank check cleared. So did the league's subpoena. The investigation you felt coming has arrived, with weather of its own." }),
    resolve: () => ({ text: '', fx: [{ heatS: 20 }] }),
  },
  {
    id: 'chrono_age',
    kind: 'player',
    beat: (_b, ctx) => ({ tag: 'REGISTRAR', text: `The registrar's office has reviewed ${pname(ctx)}'s "subjective years" and ruled: they count. He is now a class year older. There is a form. There is always a form.` }),
    resolve: (_k, ctx) => {
      const p = ctx.player;
      if (p) p.classYear = Math.min(3, p.classYear + 1);
      return { text: '', fx: [] };
    },
  },

  // ---- THE HOT SEAT ----------------------------------------------------------------
  {
    id: 'interfere_school',
    kind: 'coach',
    beat: () => ({
      tag: 'THE SCHOOL INTERFERES',
      text: 'The Provost is in your office, uninvited, rearranging your trophies by "moral weight". The school\'s patience with your methods has run out. She has a list of demands and a pen that costs more than your ship.',
      choices: [
        C('comply', 'SUSPEND YOUR BEST PLAYER 1 WEEK (a show of contrition)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('donate', 'FUND HER ETHICS WING (3⚡)', { cost: 3, up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('defy', 'SHOW HER THE DOOR', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'comply') {
        const p = ctx.bestPlayer();
        if (!p) return { text: 'There is nobody left to suspend. The Provost finds this, somehow, worse.', fx: [{ heatS: -10 }] };
        const t = tails(5, 10);
        const fx: Fx[] = [{ playerId: p.id, outWeeks: 1, outReason: 'contrition suspension', mood: -8 }, { heatS: -18 }];
        if (t === 'down') fx.push({ teamMood: -8 });
        return { text: `${p.name} sits a week "for the culture of the program." The Provost nods. ${t === 'down' ? 'The locker room does not.' : 'The locker room, surprisingly, gets it.'}`, fx };
      }
      if (key === 'donate') return { text: 'You fund the ethics wing. There will be a plaque. Your name on it is spelled almost correctly.', fx: [{ heatS: -15 }] };
      const t = tails(10, 25);
      if (t === 'up') return { text: 'You show her the door with such conviction that she momentarily respects you. The heat stays. The trophies go back in win order.', fx: [{ heatS: 5, teamMood: 5 }] };
      if (t === 'down') return { text: 'She leaves. By Friday there is a faculty senate resolution with your name in the title.', fx: [{ heatS: 15 }] };
      return { text: 'She leaves without a word, which costs you more sleep than shouting would have.', fx: [{ heatS: 8 }] };
    },
  },
  {
    id: 'interfere_boost',
    kind: 'coach',
    beat: () => ({
      tag: 'THE BOOSTERS INTERFERE',
      text: 'Three boosters in matching chrome suits occupy your office like weather. They\'ve seen the standings. They have "thoughts". The tallest one keeps touching your whiteboard.',
      choices: [
        C('gala', 'THROW THE APPEASEMENT GALA (3⚡)', { cost: 3, up: { pct: 10, cls: 'LOOT' }, down: { pct: 2, cls: 'DRAIN' } }),
        C('promise', 'PROMISE THEM THE TOURNAMENT', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 25, cls: 'DRAMA' } }),
        C('defy', 'THROW THEM OUT', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'gala') {
        const t = tails(10, 2);
        if (t === 'up') return { text: 'The gala is a triumph. Somebody auctions a moon. A chrome suit presses something into your hand "for the stretch run".', fx: [{ heatB: -20, giveItem: 'espresso' }] };
        return { text: 'Shrimp towers, a laser quartet, three speeches about "winning culture". The boosters leave soothed.', fx: [{ heatB: -18 }] };
      }
      if (key === 'promise') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'You promise them the tournament. They write it down. They have a guy whose whole job is writing down what you promise.', fx: [{ heatB: -10 }] };
        return { text: 'You promise them the tournament with enough conviction that you briefly believe it yourself.', fx: [{ heatB: -12 }] };
      }
      const t = tails(10, 25);
      if (t === 'up') return { text: 'You throw them out and the story becomes legend by dinnertime. Boosters respect exactly one thing and you just did it.', fx: [{ heatB: -8 }] };
      if (t === 'down') return { text: 'You throw them out. Their checkbooks leave with them, loudly.', fx: [{ heatB: 12 }] };
      return { text: 'They leave, straightening their chrome. "We\'ll be watching," says the tallest one, watching.', fx: [{ heatB: 5 }] };
    },
  },
  {
    id: 'summons',
    kind: 'coach',
    beat: (_b, ctx) => {
      const lean = (ctx.data.side as string) ?? 'joint';
      const who = lean === 'school' ? 'The Provost, flanked by lawyers,' : lean === 'boost' ? 'The booster council, in funeral chrome,' : 'The Provost AND the booster council, together, agreeing on exactly one thing,';
      return {
        tag: '⚠ THE SUMMONS',
        text: `${who} summons you to the long room with the long table. Your seat, notably, has been made hot. This is the conversation. Survive it or clean out your office.`,
        choices: [
          C('sacrifice', 'SACRIFICE THE BAG (lose every item)', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
          C('pay', 'BUY YOUR SEAT BACK (5⚡)', { cost: 5, up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAIN' } }),
          C('refuse', 'REFUSE. LET THEM SWING.', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SCANDAL' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      if (key === 'sacrifice') {
        const n = ctx.s.bag.length;
        ctx.s.bag = [];
        return { text: `You empty THE BAG onto the long table — ${n} item${n === 1 ? '' : 's'}, every favor and vial you were saving. The room inspects your ruin and is satisfied.`, fx: [{ heatS: -25, heatB: -25 }] };
      }
      if (key === 'pay') return { text: 'You spend everything you have on apologies, galas, review boards, and one enormous commemorative bench. Your seat cools.', fx: [{ heatS: -20, heatB: -20 }] };
      const t = tails(10, 50);
      if (t === 'up') return { text: 'You refuse — and the room BLINKS. Somewhere in the vote, you survive by one hand. You will never know whose.', fx: [{ heatS: -10, heatB: -10, teamMood: 8 }] };
      if (t === 'down') return { text: 'You refuse. The vote is short.', fx: [{ gameover: 'fired' }] };
      return { text: 'You refuse, barely survive the vote, and leave the long room older.', fx: [{ heatS: 5, heatB: 5 }] };
    },
  },

  // ---- THE DEBT LADDER + THE EMPTY LOCKER ---------------------------------------------
  {
    id: 'debt',
    kind: 'coach',
    beat: (b, ctx) => {
      if (b === 'people') {
        const best = ctx.bestPlayer();
        const name = best?.name ?? 'your best player';
        return {
          tag: '☠ THE DEBT LADDER',
          text: `The smuggler captain walks your bench with a jeweler's eye and points at ${name}. "Him. He works the engine room until the debt clears. Debts here don't clear."\n\nThey have taste. They also have a tractor beam.`,
          data: { targetId: best?.id ?? null },
          choices: [
            C('hand', `HAND OVER ${name.toUpperCase()}`, { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
            C('counter', 'OFFER SOMEONE ELSE', { up: { pct: 50, cls: 'SPIRIT' }, down: { pct: 50, cls: 'DRAMA' } }),
            C('refuse', 'REFUSE THEM EVERYTHING', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SHIP' } }),
          ],
        };
      }
      const hasItems = ctx.s.bag.length > 0;
      return {
        tag: '☠ EMPTY CELLS',
        text: `${ctx.data.cause ?? 'A meteor swarm shreds the team bus in dead space.'}\n\nA salvage rig answers the distress call, lights like teeth. The tow bill is more than you have — you have NOTHING. They open negotiations, if that's the word.`,
        choices: [
          ...(hasItems ? [C('loot', `PAY IN LOOT (give up an item)`, { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } })] : []),
          C('favor', 'CALL A BOOSTER, BEG', { up: { pct: 5, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
          C('nothing', 'YOU HAVE NOTHING TO GIVE', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 50, cls: 'SHIP' } }),
        ],
      };
    },
    resolve: (key, ctx, ev) => {
      const s = ctx.s;
      if (ev.beat === 'people') {
        const targetId = (ev.data?.targetId as number | null) ?? null;
        const target = s.teams[s.myTeamId].players.find((p) => p.id === targetId) ?? ctx.bestPlayer();
        if (key === 'refuse') {
          const t = tails(2, 50);
          if (t === 'up') return { text: 'You refuse everything — and a patrol cruiser drops out of warp at exactly the right moment. The smugglers scatter. You will never be this lucky again. 1 in 50, and you WON it.', fx: [{ teamMood: 10 }] };
          return { text: 'You refuse them everything. They shrug, cut the tow line, and leave you to the dark.', fx: [{ gameover: 'void' }] };
        }
        if (key === 'counter' && target) {
          const others = s.teams[s.myTeamId].players.filter((p) => p.id !== target.id);
          const alt = others.sort((a, b) => a.skill - b.skill)[0];
          const t = tails(50, 50);
          if (t === 'up' && alt) {
            return {
              text: `You offer ${alt.name} instead, talking fast about "untapped engine-room potential". The captain squints... and takes the deal. ${alt.name} is gone. The team watches the airlock close.`,
              fx: [{ playerId: alt.id, takePlayer: true }, { teamMood: -15 }],
              next: { defId: 'locker', beat: 'start', playerId: null },
            };
          }
          return {
            text: `You offer a substitute. The captain takes offense — and takes ${target.name} anyway, plus your dignity as a tip.`,
            fx: [{ playerId: target.id, takePlayer: true }, { teamMood: -20 }],
            next: { defId: 'locker', beat: 'start', playerId: null },
          };
        }
        if (target) {
          return {
            text: `You shake ${target.name}'s hand at the airlock and cannot find one single word. He nods like it's a road game. The doors close. The team will not look at you this week.`,
            fx: [{ playerId: target.id, takePlayer: true }, { teamMood: -18 }],
            next: { defId: 'locker', beat: 'start', playerId: null },
          };
        }
        return { text: 'There is nobody left to take. The smugglers, disgusted, leave you to the dark.', fx: [{ gameover: 'void' }] };
      }
      // beat 'start'
      if (key === 'loot' && s.bag.length) {
        const idx = rand(s.bag.length);
        const item = itemById(s.bag[idx]);
        return { text: `They take ${item.name} with the reverence of people who know exactly what it's worth. The tow line hums. You ride home in silence.`, fx: [{ loseItemIdx: idx }] };
      }
      if (key === 'favor') {
        const t = tails(5, 25);
        if (t === 'down') return { text: 'A booster wires the ransom before you finish the sentence — and the wire is VISIBLE. League forensic accountants love visible.', fx: [{ heatB: -5, heatS: 20 }] };
        if (t === 'up') return { text: 'A booster pays without questions and, horrifyingly, without conditions. "You owe me a story sometime, coach." That\'s all. Somehow that\'s worse.', fx: [{ heatS: 8 }] };
        return { text: 'A booster pays the rig. The favor goes in a ledger you will never be shown, next to your name.', fx: [{ heatS: 10, heatB: -8 }] };
      }
      // nothing left → they shop the roster
      const t = tails(2, 50);
      if (t === 'up') return { text: 'You turn out your pockets: lint, a whistle, a laminated play card. The captain finds the play card genuinely interesting and takes it as payment. 1 in 50, and you WON it.', fx: [] };
      if (t === 'mid') return { text: 'They sweep the bus for valuables, take the good seats — the SEATS — and leave you drifting toward home at a crawl. Everyone stands for a week.', fx: [{ teamMood: -10, teamEnergyP: -10 }] };
      return {
        text: 'The captain smiles like a hull breach.',
        next: { defId: 'debt', beat: 'people', playerId: null },
      };
    },
  },
  {
    id: 'locker',
    kind: 'coach',
    beat: () => ({
      tag: 'THE EMPTY LOCKER',
      text: 'One locker stands empty and the league does not care why: you need a ninth body by tip-off. The candidates, such as they are:',
      choices: [
        C('walkon', 'THE TRAINING-SQUAD WALK-ON', { up: { pct: 2, cls: 'BREAKTHROUGH' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('daughter', "THE DEAN'S DAUGHTER (she's good. that's the problem.)", { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('droid', 'THE DROID A BOOSTER BUILT (suspiciously excellent)', { up: { pct: 5, cls: 'BREAKTHROUGH' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'daughter') {
        return {
          text: 'Minervva signs the eligibility forms her father happens to have on hand. She IS good. The Dean now attends every practice "as family". The school owns a piece of your lineup and knows it.',
          fx: [{ addPlayer: 'daughter' }, { heatS: 5 }],
          follow: [{ weeks: 4, beat: 'start', defId: 'daughter_favor', playerId: null }],
        };
      }
      if (key === 'droid') {
        return {
          text: 'UNIT-7 unfolds from a crate with a jersey already on. Its jumper is perfect. Its blood is technically coolant. The paperwork lists its species as "undeclared".',
          fx: [{ addPlayer: 'droid' }],
          follow: [{ weeks: 3, beat: 'start', defId: 'droid_probe', playerId: null }],
        };
      }
      const t = tails(2, 2);
      if (t === 'up') {
        return { text: 'The training-squad kid gets the locker — and in his first scrimmage does something that makes your assistant drop the clipboard. A GEM. 1 in 50, and you WON it.', fx: [{ addPlayer: 'gem' }] };
      }
      return { text: 'The training-squad kid gets the locker. He cries a little. He earned the right.', fx: [{ addPlayer: 'walkon' }] };
    },
  },
  {
    id: 'daughter_favor',
    kind: 'coach',
    beat: () => ({
      tag: 'FAMILY SEATS',
      text: 'The Dean "wonders aloud", in your doorway, whether his daughter shouldn\'t be STARTING. He wonders it while holding the eligibility forms he could unsign.',
      choices: [
        C('start', 'START HER THIS WEEK', { up: { pct: 5, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
        C('merit', '"SHE PLAYS WHEN SHE EARNS IT."', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'start') {
        const t = tails(5, 10);
        if (t === 'down') return { text: 'She starts. The locker room does the math on WHY, out loud.', fx: [{ teamMood: -8, heatS: -8 }] };
        return { text: 'She starts, and plays well enough that the question answers itself. This time.', fx: [{ heatS: -8 }] };
      }
      const t = tails(10, 25);
      if (t === 'up') return { text: 'She backs you IN THE MEETING. "I play when I earn it." The Dean leaves defeated by his own bloodline.', fx: [{ teamMood: 8 }] };
      if (t === 'down') return { text: 'The Dean unsmiles. The eligibility forms develop "processing delays".', fx: [{ heatS: 12 }] };
      return { text: 'The Dean withdraws, wounded, to wonder aloud in other doorways.', fx: [{ heatS: 5 }] };
    },
  },
  {
    id: 'droid_probe',
    kind: 'coach',
    beat: () => ({
      tag: 'THE LEAGUE CALLS',
      text: 'A league eligibility officer would like to discuss UNIT-7\'s "birth certificate", which appears to be a warranty card.',
      choices: [
        C('defend', '"SHOW ME THE RULE AGAINST DROIDS."', { up: { pct: 25, cls: 'WINDFALL' }, down: { pct: 25, cls: 'SCANDAL' } }),
        C('bench', 'QUIETLY BENCH THE DROID', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      const droid = ctx.team().find((p) => p.special === 'droid');
      if (key === 'defend') {
        const t = tails(25, 25);
        if (t === 'up') return { text: 'There IS no rule against droids. The league writes one on the spot — effective NEXT season. UNIT-7 plays on, gleaming, grandfathered.', fx: [] };
        if (t === 'down') return { text: 'The league finds a rule, or invents one with a straight face. UNIT-7 is suspended and the school inherits the headline.', fx: [{ heatS: 15 }, ...(droid ? [{ playerId: droid.id, outWeeks: 3, outReason: 'eligibility review' } as Fx] : [])] };
        return { text: 'The hearing adjourns without a ruling. UNIT-7 waits in the hallway, doing perfect form shooting against the wall, which does not help the optics.', fx: [{ heatS: 5 }] };
      }
      return { text: 'UNIT-7 takes the bench without complaint, then quietly refiles the entire equipment room by win probability.', fx: [{ heatS: -5 }, ...(droid ? [{ playerId: droid.id, mood: -5 } as Fx] : [])] };
    },
  },

  // ---- ALUMNI (random encounters; LEGACY moves only as story outcomes) ----------------
  {
    id: 'alum_gold',
    kind: 'coach',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'An old player';
      return { tag: 'ALUMNI', text: `${name} — YOUR ${ctx.data.exit === 'pro' ? 'pro' : 'graduate'}, class of season ${ctx.data.season} — thanks you tonight on a galactic broadcast, by name, twice. The phone in your office starts ringing before he finishes.` };
    },
    resolve: (_k, ctx) => ({ text: '', fx: [{ legacy: 2, heatB: -5 }, ...(ctx.s.prospects.length ? [{ commit: 5 } as Fx] : [])] }),
  },
  {
    id: 'alum_dark',
    kind: 'coach',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'someone';
      return {
        tag: 'ALUMNI',
        text: `On the streets of Oblox-4, between the shuttle port and the arena, a voice: "Coach? ...Can you spare some money?"\n\nIt's ${name}. Your ${name} — class of season ${ctx.data.season}. The galaxy has not been kind since.`,
        choices: [
          C('help', 'BUY HIM DINNER. MAKE CALLS. (1⚡)', { cost: 1, up: { pct: 25, cls: 'SPIRIT' }, down: { pct: 10, cls: 'DRAMA' } }),
          C('walk', 'PRESS A COIN IN HIS HAND AND WALK', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 25, cls: 'SCANDAL' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      if (key === 'help') {
        const t = tails(25, 10);
        if (t === 'up') return { text: `Dinner, calls, a cot in the equipment room, a job title invented on the spot: "shooting consultant". Six weeks later ${name} is upright, employed, and telling every recruit's family what kind of program this really is.`, fx: [{ legacy: 3, teamMood: 5 }] };
        if (t === 'down') return { text: `You buy dinner and make calls. ${name} takes the help, then vanishes with the equipment-room petty cash. You make the second-hardest call and report it. It was still right to try.`, fx: [{ legacy: 1 }] };
        return { text: `Dinner, calls, a start. ${name} texts you a photo of his first paycheck. You keep it.`, fx: [{ legacy: 2 }] };
      }
      const t = tails(2, 25);
      if (t === 'down') return { text: `You walk. A stream account catches the whole thing at 4K. The caption writes itself, and the school reads captions.`, fx: [{ legacy: -3, heatS: 10 }] };
      if (t === 'up') return { text: `You walk — and hate yourself into action by the corner. You turn around. He's gone. You hire an investigator to find him. To be continued, you swear.`, fx: [{ legacy: -1 }] };
      return { text: `You press a coin in his hand and keep walking. The arena lights are very bright tonight and you deserve none of them.`, fx: [{ legacy: -2, teamMood: -3 }] };
    },
  },
  {
    id: 'alum_void',
    kind: 'coach',
    beat: (_b, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      const canReturn = !ctx.s.voidReturnUsed;
      return {
        tag: 'ALUMNI OF THE VOID',
        text: `A freight manifest, a blurry stream clip, a jersey number you'd know anywhere: ${name} — the one the smugglers took — is ALIVE, playing engine-room pickup in a belt colony, and by every account STRONGER THAN EVER. The debt, word is, has been "renegotiated".`,
        choices: [
          ...(canReturn ? [C('home', 'BRING HIM HOME (once, ever)', { up: { pct: 25, cls: 'BREAKTHROUGH' }, down: { pct: 10, cls: 'SHIP' } })] : []),
          C('watch', 'LET HIM WRITE HIS OWN STORY', { up: { pct: 10, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
        ],
      };
    },
    resolve: (key, ctx) => {
      const name = (ctx.data.alumName as string) ?? 'him';
      if (key === 'home') {
        ctx.s.voidReturnUsed = true;
        const t = tails(25, 10);
        if (t === 'down') return { text: `You fly out to the belt colony. The smugglers remember you fondly, which costs 2⚡ in "docking fees". ${name} meets you at the airlock — and chooses the belt. "I'm the best player in three systems out here, coach." You shake hands as equals. Somehow that's a win too.`, fx: [{ coachEnergy: -2, legacy: 2 }] };
        if (t === 'up') return { text: `You fly out with his old jersey. He's waiting at the dock, bag packed, twice the player who left. The disaster of that season is now the best thing that ever happened to this program. He hands you something from the engine room: "for the bag."`, fx: [{ legacy: 4, teamMood: 15, giveItem: 'vial' }] };
        return { text: `You bring ${name} home to a locker room that will not stop hugging him. He's not eligible to play — the years happened — but he takes a seat on your bench as an assistant, and the whole galaxy knows you came back for him.`, fx: [{ legacy: 3, teamMood: 12 }] };
      }
      const t = tails(10, 5);
      if (t === 'up') return { text: `You follow his colony league box scores like scripture. He's happy out there. You frame the blurry clip.`, fx: [{ legacy: 1 }] };
      if (t === 'down') return { text: `Next season's Universal Tournament scouting report will include a familiar name on an unfamiliar roster. He remembers everything, including whose fault it was.`, fx: [] };
      return { text: `He's out there, stronger than ever, writing his own story. Some debts pay themselves forward.`, fx: [] };
    },
  },

  // ---- VOYAGES ------------------------------------------------------------------------
  {
    id: 'vendor',
    kind: 'coach',
    beat: () => ({
      tag: 'VOYAGE',
      text: 'At a refueling station shaped like a grin, a vendor unrolls a coat lined with unlabeled miracles. "For the discerning coach," she says, discerning you instantly.',
      choices: [
        C('buy', 'BUY SOMETHING UNLABELED (2⚡)', { cost: 2, up: { pct: 10, cls: 'LOOT' }, down: { pct: 10, cls: 'SCANDAL' } }),
        C('pass', 'KEEP WALKING', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key) => {
      if (key === 'pass') return { text: 'You keep walking. The coat rustles with disappointment.', fx: [] };
      const commons = ITEMS.filter((i) => i.rarity !== 'legendary');
      const item = pick(commons);
      const t = tails(10, 10);
      if (t === 'down') return { text: `You buy ${item.name}. The league, it turns out, photographs this station. Of course it does.`, fx: [{ giveItem: item.id, heatS: 8 }] };
      if (t === 'up') { const extra = pick(commons); return { text: `You buy ${item.name} and she throws in ${extra.name} "for luck". The coat approves of you now.`, fx: [{ giveItem: item.id }, { giveItem: extra.id }] }; }
      return { text: `You buy ${item.name}, unlabeled, unquestioned, un-receipted.`, fx: [{ giveItem: item.id }] };
    },
  },
  {
    id: 'bus_prospect',
    kind: 'coach',
    beat: () => ({
      tag: 'VOYAGE',
      text: 'On the space-bus between systems, a kid is doing ball-handling drills in zero-G with his seatbelt ON, because the driver asked. Fundamentals AND manners.',
      choices: [
        C('card', 'SLIDE HIM YOUR CARD', { up: { pct: 10, cls: 'INTEL' }, down: { pct: 2, cls: 'DRAMA' } }),
        C('sleep', 'YOU NEED THE SLEEP', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 5, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'sleep') {
        const t = tails(2, 5);
        if (t === 'down') return { text: 'You sleep. Two seasons from now that kid drops 40 on you in the tournament and waves at your bench. You will remember the seatbelt.', fx: [] };
        return { text: 'You sleep the sleep of a coach who has seen a thousand kids dribble on a thousand buses. Probably fine.', fx: [] };
      }
      if (ctx.s.prospects.length >= 9) return { text: 'You slide him your card — and remember the board is FULL. He promises to call next season. Kids never call.', fx: [] };
      return { text: 'You slide him your card. He reads it twice and does another set, harder. A name for the board, met the honest way.', fx: [{ intel: true }] };
    },
  },
  {
    id: 'omen',
    kind: 'coach',
    beat: () => ({
      tag: 'VOYAGE',
      text: 'A hermit at the transfer station reads engine exhaust the way others read palms. She looks at your team bus for a long time. "The one you play next," she says, "I have seen their shape."',
      choices: [
        C('listen', 'LISTEN', { up: { pct: 50, cls: 'INTEL' }, down: { pct: 5, cls: 'DRAMA' } }),
        C('tip', 'TIP HER AND BOARD', { up: { pct: 2, cls: 'SPIRIT' }, down: { pct: 2, cls: 'DRAMA' } }),
      ],
    }),
    resolve: (key, ctx) => {
      if (key === 'tip') return { text: 'You tip her. She palms the coin and tells the BUS its future instead. The bus seems reassured.', fx: [] };
      const t = tails(50, 5);
      if (t === 'up') { ctx.s.scoutedOpp = true; return { text: 'She traces the opponent\'s whole shape in spilled coolant, accurate to the man. Free intel from beyond the veil — the win meter sharpens.', fx: [] }; }
      if (t === 'down') return { text: 'She describes, in perfect detail, YOUR team\'s weaknesses, loudly, to the whole terminal. The team pretends not to hear. The team heard.', fx: [{ teamMood: -5 }] };
      return { text: '"Tall," she says finally. "Some of them. Others, less so." You thank her for nothing in particular.', fx: [] };
    },
  },
];

// one-time explainers from the assistant coach (shown once, then never again)
export const TIPS: Record<string, string> = {
  tryouts:
    "First practice, coach. Six players from last year's squad, a gym full of hopefuls, and one clipboard: yours.\n\nPick your nine. The rest of the galaxy already picked theirs.",
  practice:
    "Practice runs itself — you just pick THE DRILL. Hold it down to commit; everything you can't take back works that way.\n\nThe whole squad trains. Tap a player first to SIT HIM OUT — he rests instead of risking whatever's printed on the card. Every card in this galaxy prints its odds. They never lie.",
  galaxy:
    "The board holds nine names. Tap an empty slot to SCAN a region — deeper space, stranger talent, worse trips home.\n\nTap a prospect and you have two moves: SCOUT him (know him — the stars sharpen) or RECRUIT him (want him — the commitment climbs). You never have energy for both. That's the job.\n\nOh — and ignored prospects drift. Kids notice silence.",
  matchup:
    "Read their shape on the compass, then pick the plan that eats it: POUND beats CLOCKWORK beats SWARM beats BLITZ beats POUND.\n\nThe big number is your chance of winning — it moves LIVE when you swap starters or change the plan. Scout them once to sharpen it from a guess to a fact.",
  signing:
    "Signing day math, coach: sign ONE letter and you keep his full commitment number. Every extra letter costs — minus 10 on the second, 25 on the third, 45 on the fourth. Greed is a strategy. A bad one.",
  bag:
    "That's THE BAG — five slots, no more. Everything in it is a bargain with the odds printed on its face. The right item shows up as an extra button exactly when a story makes you want it. That's not a coincidence. That's the galaxy.",
};

// a tap-through announcement: text in, nothing decided
STORIES.push({
  id: 'notice',
  kind: 'coach',
  beat: (_b, ctx) => ({ tag: (ctx.data.tag as string) ?? 'NEWS', text: (ctx.data.text as string) ?? '' }),
  resolve: () => ({ text: '' }),
});

// bag overflow: full = use or discard, on the spot (SPEC §9)
STORIES.push({
  id: 'bagfull',
  kind: 'coach',
  beat: (_b, ctx) => {
    const incoming = itemById(ctx.data.itemId as string);
    return {
      tag: 'THE BAG IS FULL',
      text: `${incoming.name} lands in your hands — and THE BAG has no room. Five slots. That's the rule the galaxy agreed on.`,
      choices: [
        C('take', `MAKE ROOM (drop your oldest item)`, {}),
        C('leave', `LEAVE ${incoming.name} BEHIND`, {}),
      ],
    };
  },
  resolve: (key, ctx) => {
    const incoming = itemById(ctx.data.itemId as string);
    if (key === 'take') {
      const dropped = itemById(ctx.s.bag[0]);
      ctx.s.bag = [...ctx.s.bag.slice(1), incoming.id];
      return { text: `${dropped.name} goes to a kid outside the arena, who will absolutely misuse it. ${incoming.name} takes the slot.` };
    }
    return { text: `You leave ${incoming.name} where it lies. Somewhere, a rival coach picks it up.` };
  },
});

export function storyById(id: string): StoryDef {
  const def = STORIES.find((st) => st.id === id);
  if (!def) throw new Error(`unknown story: ${id}`);
  return def;
}

/** The weekly random pool: player + coach stories with a weight. */
export function weeklyPool(s: GameState): StoryDef[] {
  return STORIES.filter((st) => st.weight && (!st.when || st.when(s)));
}

export const VOYAGE_POOL = ['vendor', 'bus_prospect', 'omen'];
