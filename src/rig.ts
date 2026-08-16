// Modular Baller Rig — 48×48 procedural pixel players, front-facing.
// Reimplements the "Baller Rig" design spec: one rig, species chassis as data
// rows, size classes from body measurements, jersey + 3×5 number at the chest.
// UI-side module (uses canvas); the engine stays DOM-free.

const G = 48;
const GROUND = 46;
const CX = 22;

interface SizeDef {
  total: number; head: number; torsoH: number; legLen: number; torsoW: number; th: number; armLen: number;
}

// Sizing rules — pixels from the y=46 baseline (straight from the spec).
const SIZES: Record<string, SizeDef> = {
  xs: { total: 30, head: 8, torsoH: 9, legLen: 11, torsoW: 7, th: 2, armLen: 11 },
  s: { total: 34, head: 8, torsoH: 11, legLen: 13, torsoW: 8, th: 2, armLen: 13 },
  m: { total: 38, head: 9, torsoH: 12, legLen: 15, torsoW: 9, th: 3, armLen: 15 },
  l: { total: 40, head: 10, torsoH: 14, legLen: 14, torsoW: 13, th: 3, armLen: 15 },
  xl: { total: 45, head: 11, torsoH: 16, legLen: 17, torsoW: 12, th: 4, armLen: 18 },
};

export interface RigBody {
  id: number;
  speciesId: string;
  heightCm: number;
  weightKg: number;
}

function sizeClass(b: RigBody): keyof typeof SIZES {
  if (b.weightKg >= 135 && b.heightCm < 212) return 'l'; // the bruiser build
  if (b.heightCm < 180) return 'xs';
  if (b.heightCm < 192) return 's';
  if (b.heightCm < 205) return 'm';
  return 'xl';
}

interface Chassis {
  ramp: [string, string, string, string]; // 4 skin tints
  arms: 2 | 4;
  legs: 0 | 2 | 6;
  torso: 'human' | 'chitin' | 'rock' | 'float';
  headShape: 'round' | 'wide' | 'crystal' | 'orb';
  eyes: 1 | 2 | 3;
  feet: 'shoe' | 'claw' | 'none';
  crest: 'hair' | 'antennae' | 'glow' | 'none';
  tail: boolean;
}

// A new race is a data row, not a drawing job.
const CHASSIS: Record<string, Chassis> = {
  terran: {
    ramp: ['#f1c27d', '#c08a5e', '#8d5524', '#5a3825'],
    arms: 2, legs: 2, torso: 'human', headShape: 'round', eyes: 2, feet: 'shoe', crest: 'hair', tail: false,
  },
  hexabrach: {
    ramp: ['#8fd4b8', '#57a98a', '#337a61', '#1c4d3c'],
    arms: 4, legs: 2, torso: 'chitin', headShape: 'wide', eyes: 3, feet: 'claw', crest: 'none', tail: false,
  },
  dodecapede: {
    ramp: ['#ffb37f', '#e0854f', '#b3582e', '#7d371a'],
    arms: 2, legs: 6, torso: 'human', headShape: 'round', eyes: 2, feet: 'claw', crest: 'antennae', tail: true,
  },
  lithoid: {
    ramp: ['#c2c2cc', '#93939f', '#686874', '#42424c'],
    arms: 2, legs: 2, torso: 'rock', headShape: 'crystal', eyes: 2, feet: 'none', crest: 'none', tail: false,
  },
  luminar: {
    ramp: ['#eaffff', '#b0f0ff', '#79d3f0', '#3fa6c9'],
    arms: 2, legs: 0, torso: 'float', headShape: 'orb', eyes: 1, feet: 'none', crest: 'glow', tail: false,
  },
};

// 3×5 bitmap digits for the chest number.
const DIGITS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001011001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001010010',
  '8': '111101111101111',
  '9': '111101111001111',
};

const HAIR_COLORS = ['#241a12', '#0e0e10', '#5a3825', '#7a2d2d'];

function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mul(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export interface Kit {
  bg: string;
  fg: string;
}

/** Unsigned prospects and walk-on tryouts wear the gray practice kit. */
export const PRACTICE_KIT: Kit = { bg: '#3a3f45', fg: '#e4e4e4' };

const cache = new Map<string, string>();

export function spriteUrl(body: RigBody, kit: Kit, jersey: number | null): string {
  const sz = sizeClass(body);
  const key = `${body.id}|${body.speciesId}|${sz}|${kit.bg}|${kit.fg}|${jersey ?? 'x'}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = G;
  canvas.height = G;
  const ctx = canvas.getContext('2d')!;
  drawRig(ctx, body, kit, jersey, sz);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

function drawRig(
  ctx: CanvasRenderingContext2D,
  body: RigBody,
  kit: Kit,
  jersey: number | null,
  sz: keyof typeof SIZES
): void {
  const S = SIZES[sz];
  const C = CHASSIS[body.speciesId] ?? CHASSIS.terran;
  const rng = mulberry((body.id * 2654435761) >>> 0);

  const skin = C.ramp[Math.floor(rng() * 4)];
  const skinDark = mul(skin, 0.72);
  const skinLite = mul(skin, 1.2);
  const bg = kit.bg;
  const bgDark = mul(bg, 0.75);
  const fg = kit.fg;

  const px = (x: number, y: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const floaty = C.torso === 'float';
  const hover = floaty ? 5 : 0;
  const hipY = floaty ? GROUND - hover - 3 : GROUND - S.legLen;
  const torsoTop = hipY - S.torsoH;
  const halfW = Math.floor(S.torsoW / 2);
  const shoulderY = torsoTop + 1;
  const headR = Math.floor(S.head / 2);
  const headCy = torsoTop - headR - 1;

  // ground shadow
  rect(CX - halfW - 2, GROUND, S.torsoW + 4, 1, 'rgba(0,0,0,0.45)');

  // tail (drawn first, behind everything)
  if (C.tail) {
    const dir = rng() < 0.5 ? 1 : -1;
    let tx = CX + dir * (halfW + 1);
    let ty = hipY + 1;
    for (let i = 0; i < 4; i++) {
      px(tx, ty, skinDark);
      tx += dir;
      if (i >= 1) ty -= 1;
    }
    px(tx, ty, skinLite);
  }

  // legs + shorts + feet
  const legW = Math.max(1, S.th - 1);
  const shortsLen = Math.max(2, Math.floor(S.legLen * 0.35));
  const drawLeg = (lx: number, top: number, len: number, withShorts: boolean): void => {
    const bottom = Math.min(GROUND - 1, top + len);
    if (withShorts) {
      rect(lx, top, legW, Math.min(shortsLen, bottom - top), bg);
      rect(lx, top + shortsLen, legW, Math.max(0, bottom - top - shortsLen + 1), skin);
    } else {
      rect(lx, top, legW, bottom - top + 1, skin);
    }
    // feet
    if (C.feet === 'shoe') {
      rect(lx - 1, GROUND - 1, legW + 2, 1, fg);
      rect(lx - 1, GROUND, legW + 2, 1, '#1a1a1e');
    } else if (C.feet === 'claw') {
      px(lx - 1, GROUND - 1, skinDark);
      px(lx + legW, GROUND - 1, skinDark);
    }
  };
  if (C.legs === 2) {
    drawLeg(CX - halfW + 1, hipY, S.legLen, true);
    drawLeg(CX + halfW - legW - 1, hipY, S.legLen, true);
  } else if (C.legs === 6) {
    // three splayed pairs — twelve in the lore, six on the sprite, it reads
    drawLeg(CX - halfW + 1, hipY, S.legLen, true);
    drawLeg(CX + halfW - legW - 1, hipY, S.legLen, true);
    drawLeg(CX - halfW - 1, hipY + 2, S.legLen - 2, false);
    drawLeg(CX + halfW + 1 - legW, hipY + 2, S.legLen - 2, false);
    drawLeg(CX - halfW - 3, hipY + 4, S.legLen - 4, false);
    drawLeg(CX + halfW + 3 - legW, hipY + 4, S.legLen - 4, false);
  }

  // torso
  if (C.torso === 'float') {
    // tapering wisp: jersey on top, glow tail below, hovering above the ground
    const rows = S.torsoH + 3;
    for (let i = 0; i < rows; i++) {
      const w = Math.max(2, S.torsoW - Math.floor((i / rows) * S.torsoW));
      const c = i < Math.floor(rows * 0.55) ? bg : i % 2 === 0 ? skin : skinLite;
      rect(CX - Math.floor(w / 2), torsoTop + i, w, 1, c);
    }
  } else {
    rect(CX - halfW, torsoTop, S.torsoW, S.torsoH, bg);
    // rounded shoulders
    ctx.clearRect(CX - halfW, torsoTop, 1, 1);
    ctx.clearRect(CX + halfW - 1 + (S.torsoW % 2), torsoTop, 1, 1);
    // trim + neckline
    rect(CX - halfW, hipY - 1, S.torsoW, 1, fg);
    px(CX, torsoTop, skin);
    if (C.torso === 'chitin') {
      for (let y = torsoTop + 2; y < hipY - 1; y += 3) rect(CX - halfW + 1, y, S.torsoW - 2, 1, bgDark);
    }
    if (C.torso === 'rock') {
      // craggy silhouette + a proper number plate at the chest
      ctx.clearRect(CX - halfW, hipY - 2, 1, 1);
      ctx.clearRect(CX + halfW - 1 + (S.torsoW % 2), torsoTop + 3, 1, 1);
      for (let i = 0; i < 4; i++) {
        px(CX - halfW + 1 + Math.floor(rng() * (S.torsoW - 2)), torsoTop + 1 + Math.floor(rng() * (S.torsoH - 2)), bgDark);
      }
      rect(CX - halfW + 1, torsoTop + 2, S.torsoW - 2, 7, bg);
    }
  }

  // arms (sleeve on top, skin below, hand at the end)
  const armX = (side: -1 | 1, off: number): number =>
    side < 0 ? CX - halfW - S.th + 1 - off : CX + halfW - 1 + (S.torsoW % 2) + off;
  const drawArm = (side: -1 | 1, topY: number, len: number, off: number): void => {
    const ax = armX(side, off);
    const w = Math.max(1, S.th - 1);
    rect(ax, topY, w, 2, bg); // sleeve
    rect(ax, topY + 2, w, Math.max(1, len - 3), skin);
    rect(ax, topY + len - 1, w, 1, skinLite); // hand
    if (rng() < 0.25) rect(ax, topY + len - 3, w, 1, fg); // wristband
  };
  drawArm(-1, shoulderY, S.armLen, 0);
  drawArm(1, shoulderY, S.armLen, 0);
  if (C.arms === 4) {
    drawArm(-1, shoulderY + 4, S.armLen - 4, 1);
    drawArm(1, shoulderY + 4, S.armLen - 4, 1);
  }

  // the rock (seeded — some players pose with it)
  if (rng() < 0.55) {
    const bx = armX(1, C.arms === 4 ? 1 : 0) + S.th - 1;
    const by = shoulderY + S.armLen - 2;
    rect(bx, by - 1, 3, 3, '#e0703a');
    px(bx + 1, by, mul('#e0703a', 0.6));
    px(bx, by - 1, mul('#e0703a', 1.25));
  }

  // head
  const drawRound = (rx: number, ry: number): void => {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.4) + (y * y) / (ry * ry + 0.4) <= 1) {
          px(CX + x, headCy + y, skin);
        }
      }
    }
    // simple shading
    for (let y = -ry + 1; y <= ry - 1; y++) px(CX - rx + 1, headCy + y, skinDark);
    px(CX + rx - 1, headCy - ry + 1, skinLite);
  };
  if (C.headShape === 'crystal') {
    rect(CX - headR + 1, headCy - headR + 1, S.head - 2, S.head - 2, skin);
    ctx.clearRect(CX - headR + 1, headCy - headR + 1, 1, 1);
    ctx.clearRect(CX + headR - 2 + (S.head % 2), headCy + headR - 2, 1, 1);
    px(CX - headR + 2, headCy, skinDark);
    px(CX + 1, headCy - headR + 2, skinLite);
  } else if (C.headShape === 'wide') {
    drawRound(headR + 1, Math.max(2, headR - 1));
  } else {
    drawRound(headR, headR);
  }
  if (C.headShape === 'orb') {
    px(CX, headCy - headR - 1, skinLite);
    px(CX - headR - 1, headCy, skinLite);
    px(CX + headR + 1, headCy, skinLite);
  }

  // eyes (+ occasional goggles)
  const eyeY = headCy;
  const goggles = rng() < 0.15;
  if (goggles) rect(CX - headR + 1, eyeY, S.head - 2, 1, mul(fg, 0.9));
  const eye = (x: number): void => {
    px(x, eyeY, '#101014');
    px(x, eyeY - 1, '#ffffff');
  };
  if (C.eyes === 1) {
    rect(CX - 1, eyeY - 1, 3, 2, '#ffffff');
    px(CX, eyeY, '#12455c');
  } else if (C.eyes === 2) {
    eye(CX - 2);
    eye(CX + 2);
  } else {
    eye(CX - 3);
    eye(CX);
    eye(CX + 3);
  }

  // crest
  const crownY = headCy - headR;
  if (C.crest === 'hair') {
    const hair = HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)];
    const style = Math.floor(rng() * 3);
    if (style === 0) rect(CX - headR + 1, crownY - 1, S.head - 2, 1, hair);
    else if (style === 1) {
      for (let x = -headR + 1; x < headR; x += 2) px(CX + x, crownY - 1, hair);
    } else {
      rect(CX - headR + 1, crownY - 1, S.head - 2, 2, hair);
      rect(CX - headR, crownY, 1, 2, hair);
      rect(CX + headR - 1 + (S.head % 2), crownY, 1, 2, hair);
    }
  } else if (C.crest === 'antennae') {
    px(CX - 2, crownY - 1, skinDark);
    px(CX - 2, crownY - 2, skinLite);
    px(CX + 2, crownY - 1, skinDark);
    px(CX + 2, crownY - 2, skinLite);
  } else if (C.crest === 'glow') {
    px(CX, crownY - 1, skin);
    px(CX, crownY - 2, '#ffffff');
  }
  if (!goggles && rng() < 0.18 && C.crest === 'hair') {
    rect(CX - headR + 1, crownY, S.head - 2, 1, fg); // headband
  }

  // chest number, 3×5 bitmap in letter color
  if (jersey !== null) {
    const digits = String(jersey);
    const totalW = digits.length * 3 + (digits.length - 1);
    let dx = CX - Math.floor(totalW / 2);
    const dy = C.torso === 'rock' ? torsoTop + 3 : torsoTop + 3;
    for (const d of digits) {
      const bits = DIGITS[d];
      for (let i = 0; i < 15; i++) {
        if (bits[i] === '1') px(dx + (i % 3), dy + Math.floor(i / 3), fg);
      }
      dx += 4;
    }
  }
}

/** Small helper for UI copy: the rig's size class label. */
export function sizeLabel(body: RigBody): string {
  const labels: Record<string, string> = {
    xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL',
  };
  return labels[sizeClass(body)];
}

// ---- pixel mood faces -----------------------------------------------------
// 9×9 outline smiley. COLOR LAW: one hue per save — the caller passes the ramp
// color at the mood's brightness; the expression carries the meaning.

const faceCache = new Map<string, string>();

export function faceUrl(mood: number, color: string): string {
  const variant = mood >= 75 ? 'happy' : mood >= 50 ? 'neutral' : mood >= 25 ? 'sad' : 'angry';
  const key = `${color}|${variant}`;
  const hit = faceCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = 9;
  c.height = 9;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  const px = (x: number, y: number): void => ctx.fillRect(x, y, 1, 1);

  // outline ring
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const d = Math.sqrt((x - 4) ** 2 + (y - 4) ** 2);
      if (d >= 3.2 && d <= 4.2) px(x, y);
    }
  }
  // eyes
  px(3, 3);
  px(5, 3);
  // mouth
  if (variant === 'happy') {
    px(2, 5); px(3, 6); px(4, 6); px(5, 6); px(6, 5);
  } else if (variant === 'neutral') {
    px(3, 6); px(4, 6); px(5, 6);
  } else if (variant === 'sad') {
    px(3, 6); px(4, 5); px(5, 6);
  } else {
    // angry: slanted brows + frown
    px(2, 2); px(3, 2); px(5, 2); px(6, 2);
    px(3, 6); px(4, 5); px(5, 6);
  }

  const url = c.toDataURL();
  faceCache.set(key, url);
  return url;
}

// ---- single-color pixel stat icons ---------------------------------------

type IconKind = 'phy' | 'men' | 'tec' | 'def' | 'bolt';

const ICON_PIXELS: Record<IconKind, string[]> = {
  // dumbbell
  phy: [
    '.........',
    '.X.....X.',
    '.X.....X.',
    'XX.....XX',
    'XXXXXXXXX',
    'XX.....XX',
    '.X.....X.',
    '.X.....X.',
    '.........',
  ],
  // brain
  men: [
    '..XXXXX..',
    '.XXXXXXX.',
    'XXX.XX.XX',
    'XXXXXXXXX',
    'XX.XXX.XX',
    'XXXXXXXXX',
    '.XXX.XXX.',
    '..XXXXX..',
    '....X....',
  ],
  // sword
  tec: [
    '......XX.',
    '.....XXX.',
    '....XXX..',
    '...XXX...',
    'X.XXX....',
    '.XXX.....',
    'XXX......',
    'XX.X.....',
    '....X....',
  ],
  // shield
  def: [
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XX.....XX',
    'XX.....XX',
    'XXXXXXXXX',
    '.XX...XX.',
    '.XXXXXXX.',
    '..XXXXX..',
    '....X....',
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
