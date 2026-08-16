# GALACTIC COACH — v1.0 SPEC (v2, after Thijs's review rounds)

*The complete buildable specification for the v1.0 rebuild. DESIGN.md stays the
design log and history; this document is what gets built, in one coherent
swing, after Thijs's final read.*

Status: **fully LOCKED** — agreed with Thijs across the v0.7 playtest
decisions and the spec review rounds of Aug 15, 2026. Ideas deliberately
parked for later live in §17.

Two things are **explicitly out of this spec**, each getting its own session:
- **Species design** (the roster of species, caps, sprites). This spec defines
  the interface (§2.2) and ships on provisional mappings.
- **Story writing** (the few dozen story sequences). This spec defines the
  architecture (§10) with two fully-worked examples.

All numeric values in this spec are **starting values, not law** — they get a
tuning pass against the headless sim before release (§16).

---

## 0. THE LAWS (apply to everything)

1. **One small number, one painful trade-off.** If a mechanic needs a
   spreadsheet, it's wrong.
2. **Consequence management.** The game throws wrenches; the coach gets
   extreme tools. Stakes and odds are always printed *before* the tap; the
   story never is. Multi-week wrenches offer course-correction beats.
   Outcomes name the choice that caused them. Dramatize the luck
   ("1 in 700 — and you WON it").
3. **THE TWO TAILS.** Every dice-roll moment in the game carries BOTH a
   catastrophe chance and a breakthrough chance — minimum 2% each way.
   Nothing is safe; nothing is hopeless. Choices are choices *between tail
   profiles*, and sometimes every option on the table is terrible.
4. **No dead time.** Every setback ships with a course of action — recover
   it, mitigate it, or gamble deeper. Punishments that only remove play
   ("grounded for the season") are banned.
5. **Mechanics never lie.** A printed number is true and final, with its
   modifiers already applied and their cause shown. *People* lie — in
   outcome text, never in odds.
6. **Each screen answers exactly one question.** Printed next to each screen
   in §6. A screen drifting to a second question loses a feature.
7. **Arcade, never idle-clicker, never spreadsheet.** Cards, big knobs, big
   type, hold-to-commit on anything irreversible.
8. **One hue, motion for urgency** — the full color & motion law is §7.
9. **No trademarked names, anywhere.** Same law that renamed the colleges.

---

## 1. THE ODDS LINE [LOCKED]

The single grammar for every choice in the game — drills, story buttons,
scout runs, recruiting moves, bag items, debt payments:

```
▲ 10% BREAKTHROUGH
▼ 25% INJURY
```

- **Chance + class, never the script.** The class names the *pool of
  storylines* the roll can launch; what actually happens comes from the pool,
  flavored by the cause (§10.1).
- **Five rungs, no bespoke odds**: every chance is exactly **2 / 5 / 10 /
  25 / 50**. Players learn the rungs like poker hands. Mythic flukes
  (1-in-700) never appear on a card face — they occur *inside* an outcome
  roll and are announced afterward.
- **Both tails always present** (law 3): even the free shootaround reads
  `▲2% · ▼2%`. Exactly one ▲ line and one ▼ line per choice.
- **The classes** — a fixed vocabulary of ten, five per direction:

| ▼ Dangers | ▲ Jackpots |
|---|---|
| INJURY — the body | BREAKTHROUGH — XP, a level, a potential star |
| DRAMA — mood, locker room | SPIRIT — mood, bonding |
| SCANDAL — the league, the school | WINDFALL — ⚡ energy |
| SHIP — travel, scouting assets | LOOT — an item drops |
| DRAIN — ⚡ energy | INTEL — scouting info |

- Modified odds show the cause: `▼ 25%→50% INJURY · Raijinn ⚡ low`.

---

## 2. THE PLAYER MODEL

### 2.1 Two axes, one skill, two meters [LOCKED]

| Piece | Range | Moves how |
|---|---|---|
| **BUILD** | Strong ◀▶ Quick | Rarely: stories, items, offseason drift. Never by grinding. |
| **HEAD** | Fierce ◀▶ Savvy | Same. |
| **SKILL** | 0–99 | Levels (§2.4). Can also FALL: long injuries, dark stories. |
| **ENERGY** | 0–100 | Live. Games/drills drain; rest restores. |
| **MOOD** | 0–100 | Live. Stories, wins, playtime, your choices. |

Each axis is one integer 0–100, 50 = center. **Pole lean** (sim-only, never
shown as a number) = distance from center toward a pole.

### 2.2 Species interface [LOCKED shape; species content deferred]

```
Species { id, name, tier: 1|2|3,
          poleCaps: { strong, quick, fierce, savvy },  // max lean per pole
          sizeRange: [min, max], spriteChassis: ... }
```

Tier 1 humanesque: low caps everywhere (~55). Tier 2 same-galaxy: one pole
90+. Tier 3 exotic: 90+ in two directions (one per axis) with consequences.
**v1.0 provisional mapping**: Terran t1; Lithoid (Strong), Dodecapede
(Quick), Hexabrach (Savvy) t2; Luminar t3 (Quick+Savvy; glass — injury-prone,
fast energy drain). All redesigned in the species session; saves store an id.

### 2.3 The meters MUTE the dot [LOCKED]

- Low ENERGY mutes BUILD lean (× ENERGY/100, floor 0.3).
- Low MOOD mutes HEAD lean (same).
- SKILL is learned and never muted — a tired shooter still shoots.
- The compass dot fades and slides toward center; a ghost dot marks his true
  position. One glance = "he's not himself this week."
- ENERGY ≤ 30: playing or drilling him doubles his ▼INJURY weighting, and the
  modifier is printed (law 5).
- MOOD ≤ 30: his next story roll skews dark.

### 2.4 Stars, potential, XP, levels [LOCKED]

- **Stars are the scouting language** for SKILL and POTENTIAL: 1★ 0–30 ·
  2★ 20–50 · 3★ 40–70 · 4★ 60–90 · 5★ 80+ (20-pt steps, 10-pt overlap, so a
  45 genuinely reads as a 2★ or a 3★). A prospect is "2★ recruit / 4★
  potential." First scout look can be off by one star; second look locks
  truth. SKILL becomes a real number only on your roster.
- **POTENTIAL** = a personal cap on SKILL, shown ONLY ever as stars (a
  starred notch on the skill dial), movable up AND down through stories.
- **XP → LEVELS → SKILL.** Everything grants XP (drills, minutes, stories).
  Level-up = **+2–4 SKILL** (clamped at potential); rare breakthroughs grant
  an axis nudge or a potential star instead. XP-per-level grows steeply.
- **Hard level cap: 10.** A freshman arrives at level 0–2 (whole runway); a
  polished junior transfer at 8–9 (nearly finished). Proven-but-done vs
  raw-but-moldable is a real recruiting fork.
- **Injuries of 4+ weeks: −1 level and −2–4 SKILL.** Traceable, painful —
  exactly what the shady-doctor bargains exist to tempt you around.
- Level shows as up to 10 small pips under the XP sliver — SKILL stays the
  only big number on the card.
- Design space reserved: a legendary item that "adds a level."

---

## 3. THE PLAYER CARD [LOCKED]

```
┌──────────────────────────────────┐
│ ZEUXX                So · Lithoid│
│ ┌────────┐        FIERCE        │
│ │        │     ┌───────────┐    │
│ │ sprite │   S │           │ Q  │
│ │ 48×48  │   T │     ●     │ U  │
│ │        │   R │           │ I  │
│ └────────┘     └───────────┘    │
│                 SAVVY           │
│  SKILL ⟨ 62 ⟩★     ⚡▮▮▮▮▯  ☺  │
│  ●●●●○○○○○○  ▁▁XP▁▁             │
└──────────────────────────────────┘
```

Sprite (the centerpiece) · compass with ONE dot (muting per §2.3) · SKILL big
with the starred potential notch · energy segments · mood face · level pips ·
XP sliver · name, class year, species. Nothing else. Grid tiles (3×3 boards):
sprite + mini-dot + SKILL; tap → full card.

---

## 4. THE SIM

### 4.1 Team shape & the plan wheel [LOCKED]

A team's shape = its three starters' dots drawn on one compass. Before each
game the coach picks ONE plan:

| Plan | Pole | Beats | Why |
|---|---|---|---|
| **POUND** | Strong | CLOCKWORK | muscle smashes the system |
| **CLOCKWORK** | Savvy | SWARM | poise dismantles the press |
| **SWARM** | Fierce | BLITZ | the press eats speedsters alive |
| **BLITZ** | Quick | POUND | run the big men ragged |

Plan power = starters' average *effective* lean toward that pole. AI coaches
pick their roster's lean (scouting tells you which; occasional surprises).

### 4.2 The math (all of it) [LOCKED]

```
playerPower = effectiveSKILL + planLean × 0.5
teamPower   = Σ starters + Σ bench × 0.3
total       = teamPower × wheel(±12%) × home(+3%)
winProb     = logistic(yourTotal − theirTotal)
```

### 4.3 THE WIN METER [LOCKED]

`winProb` is not hidden — it IS the interface:

- **Big on MATCHUP**: "UPCOMING: vs CRIMSON MOONS — 59%". Every lineup drag,
  every plan pick, visibly animates the number.
- **Mini in the header all week**: your star gets hurt Tuesday and slides to
  the reserves — the number moves right then, on whatever screen you're on.
  Consequences are felt the moment they land.
- Unscouted opponents show a **band** ("45–75%") that scouting sharpens to
  a point number — INTEL's payoff on the biggest number in the game.

### 4.4 Feedback, loud [LOCKED]

The result always says, one big sentence each: the wheel ("Your SWARM broke
their BLITZ") and the hero/goat ("Zeuxx was built for this" / "Raijinn played
half a step slow — ⚡ was low"). Every game grades your plan.

### 4.5 Player game effects

Starters: −ENERGY big, +XP big. Bench: small/small. Unused: +ENERGY, MOOD −
if chronic (3 straight DNPs). Win: squad MOOD up; loss: down. Floaters
animate on the grid.

### 4.6 Roster [LOCKED]

3-on-3. 9 players: 3 starters / 3 bench / 3 reserves on the persistent 3×3
grid. **No positions** — the dot replaced G/F/C; fit = does the trio's shape
match the plan, shown by the blob, never printed as a penalty.

---

## 5. SEASON, CAREER, ENDINGS

### 5.1 The league [LOCKED]

6 teams, double round robin = **10 games**, one per week. Finish **1st** →
the **UNIVERSAL TOURNAMENT**. Finish 2nd → straight to the offseason. First
place matters enormously. Intended.

### 5.2 The Universal Tournament [LOCKED]

8 entrants: you + 7 generated champions of conferences never played (shape,
skill total scaled to your season, name, colors, one loud gimmick line). 3
rounds: QF, SF, THE UNIVERSAL FINAL = March Madness. Each round opens with a
free scouting-report story beat revealing their blob and likely plan.
Tournament weeks are game-only (no practice/recruiting phases) — the energy
cache and THE BAG carry you. Prizes: legacy per round; the title adds a
legendary item and a recruiting halo (+woo odds next season).

### 5.3 The calendar

```
Season 1 only:  TRYOUTS (pick 9 of 12)
Weeks 1–10:     weekly loop (§6); away weeks include a VOYAGE (§10.4)
Weeks 11–13:    UNIVERSAL TOURNAMENT (1st place only)
Offseason:      DEPARTURES → SEASON SCORE (§5.5) → SIGNING DAY →
                SELECTION → GROWTH → RETIRE? (§5.6)
```

### 5.4 Offseason

- **DEPARTURES**: seniors graduate; SKILL 85+ may declare pro any year — one
  convince-him conversation each, odds riding on MOOD. All departures become
  **alumni** (§10.5).
- **SIGNING DAY**: harvest commitment percentages.
- **SELECTION**: pick 9 from returners + signees + walk-ons (usually what
  they look like — now and then, a GEM).
- **GROWTH**: one popup montage per returner — small SKILL bump, possible
  axis drift (the ONLY scheduled axis movement), class year ticks.

### 5.5 LEGACY — the career score [LOCKED shape]

You are **not scored continuously**. Points land at season end:

- League finish (title biggest), UT rounds, the UT title (huge).
- **+per player sent to the pros.**
- Alumni encounters (§10.5) can move LEGACY *as story outcomes* — the pro
  who thanks you at the podium, the homeless guard on Oblox-4 — but there
  is no automatic yearly verdict roll. Your past reaches you through
  stories, not bookkeeping.

LEGACY is the high-score. The career table records every ended run with its
cause: **RETIRED · FIRED · LOST TO THE VOID**.

### 5.6 Aging and the end [LOCKED]

- After each season: **RETIRE?** — walk away and lock in your LEGACY.
- From **season 21**: the weekly stipend shrinks by 1
  per season (6 → 5 → 4 …), no floor. You get old. The debt spiral (§8.2)
  gets organically closer every year until you retire — or the void takes
  you mid-season. No separate old-age mechanic needed: the energy system IS
  mortality.

---

## 6. THE WEEKLY LOOP AND EVERY SCREEN

Strictly linear week, slide transitions, persistent header + nav (carried
from v0.7). Header: team + record · **⚡ cache** (§8) · **hot-seat bar**
(§9) · **mini win meter** (§4.3).

| # | Screen | THE question | What's on it |
|---|---|---|---|
| 0 | **STORIES** (modal layer) | *What do you do about this?* | §10. Fires over any phase. |
| 1 | **PRACTICE** | *Who gets better this week?* | The drill board (§6.1): pick THE DRILL for the whole squad, mark sit-outs. |
| 2 | **GALAXY** | *Who joins next season?* | Prospect 3×3. Empty slot → SCAN (region knob, odds-line face). Prospect → **SCOUT** or **RECRUIT** (§12). |
| 3 | **MATCHUP** | *How do we beat THIS team?* | Their blob + the WIN METER big. Lineup drags on your 3×3. The plan wheel. Pregame bag items. |
| 4 | **GAME NIGHT** | *Did the plan work?* | Away weeks: the VOYAGE beat first (§10.4). Then: verdict + score → locker-room consequences card by card (level-ups fire here) → THE TABLE slides in. |
| — | **THE BAG** (drawer) | *What am I carrying?* | 5 slots (§11). |
| — | **COACH** (drawer) | *Who am I?* | KNOWLEDGE tree, LEGACY, trophies, career table, options, NEW GAME. |

GAME NIGHT's three beats (verdict / locker room / table) are one sequence in
the story-popup language — the post-game is a story, not a dashboard.

### 6.1 The drill board [LOCKED]

The whole squad trains; you pick the drill and who sits. Every drill is a
card with an odds-line face:

| Drill | ⚡ | XP each | Odds line |
|---|---|---|---|
| Shootaround | free | +1–3 | ▲2 SPIRIT · ▼2 INJURY |
| Asteroid Pushes | 1 | +3–5 | ▲5 BREAKTHROUGH · ▼10 INJURY |
| Blaster Dodge | 2 | +5–8 | ▲10 BREAKTHROUGH · ▼25 INJURY |
| Personal Session *(KNOWLEDGE)* | 1 | +8–12, ONE player | ▲5 BREAKTHROUGH · ▼5 DRAMA (favoritism) |
| Team Rest | free | — (squad ⚡ up) | ▲2 SPIRIT · ▼2 DRAMA (someone finds a crater to lollygag in) |

Sit-outs: no XP, energy recovers. The ▼ roll picks among *participants*,
weighted toward low-energy and Fierce-leaning players — weighting printed
("Raijinn ⚡ low: ▼×2"). Drills drain player energy by intensity.

---

## 7. THE COLOR & MOTION LAW [LOCKED]

**One hue per save: your team color. Brightness says how much. Motion says
pay attention. That's the palette.**

- **Values live on the ramp** from ~20% brightness to white: SKILL dial, XP
  sliver, energy segments, commitment %, plan power, win meter, standings
  emphasis, hold-to-commit fill. Built in a perceptual space (OKLCH: hold
  hue, step lightness); the six league palettes are curated from hues that
  ramp cleanly. The UI re-skins itself per program.
- **Categories get no colors.** Poles are positions on the compass; plans
  are icons + labels; danger/boon are the ▼/▲ glyphs.
- **Change = a floater on a black tag.** Animated numbers and deltas always
  sit on a black pill background, so they read on any team hue.
- **Urgency = motion, not color.** A meter renders at its value's
  brightness; at critical (≤20) it **blinks**. Mood at 40% is simply a face
  at 40% brightness; mood at 10% is a blinking face. Starting a blinking
  player is an informed act.
- **Red and gold are dead.** They collide with red and gold teams. Nothing
  in the UI carries meaning by hue except the one team hue.
- Opponent colors: identity only (their chips, jerseys, banners).

---

## 8. ENERGY — the cache and the void

### 8.1 The cache [LOCKED]

- **+6⚡ stipend at week start · cache capped at 12 · overflow wasted.**
  Hoard two weeks' worth for the tournament or a recruiting push; you can't
  turtle forever.
- Everything charges the same cells: drills, scans, scouts, woos, opponent
  intel, story bargains, repair bills. Flavor: energy is literally the
  program's **power cells** — the gravity gym, the ship, the favors.
- Stories pay and charge in ⚡ freely (WINDFALL / DRAIN classes).

### 8.2 THE DEBT LADDER [LOCKED]

Hitting 0⚡ triggers the loud warning: *"Empty cells. Space is unkind to the
stranded."* While at 0, every voyage rolls ▼10 SHIP disaster. The disaster
presents a bill; each rung is a refusal of the one above:

1. **Pay in ⚡** — you can't; that's why you're here.
2. **Pay in loot** — they take a bag item, your choice which.
3. **Pay in favors** — a booster covers it; heavy hot-seat heat toward the
   school, and the boosters now own a piece of you (story hook).
4. **Pay in people** — they name a player, and they have taste (weighted
   toward your best). One counter-beat: offer someone else at ▼50 they take
   offense and grab their original pick anyway. **Taken, not killed**
   (law: no death) — press-ganged onto their crew, gone in one week, squad
   mood craters. He stays out there as an alum of the void (§10.5): he may
   return to haunt you on a tournament roster — or, a year later, stronger
   than ever, with a once-per-career chance to bring him home. Disasters can
   become the best thing that ever happened to you (law 3).
   This rung is **rare by construction** — it takes an empty cache, a failed
   disaster roll, and two refused rungs — and when it lands, the hole in
   the roster becomes its own storyline: **THE EMPTY LOCKER** (§10.6).
5. **Nothing left, or refuse everything** → **GAME OVER: LOST TO THE VOID.**
   The tombstone: seasons, trophies, LEGACY. The galaxy forgets. New game.
   (Roster floor 3: if rung 4 would leave you unable to field a team, the
   smugglers skip straight to rung 5 — they're smugglers, not accountants.)

---

## 9. THE HOT SEAT [LOCKED]

Continuous integrity scoring is dead. In its place, one bar in the header —
100 units wide — **filling from BOTH ends at once**:

- **SCHOOL heat fills from the left**: scandals, shady acts, everything that
  previously "cost integrity" (shady vendors, the envelope, the referee's
  wallet).
- **BOOSTER heat fills from the right**: losses, embarrassments.
- Wins cool booster heat; clean weeks slowly cool school heat.
- **The unfilled gap in the middle is your job.**
- **One side reaching 50 → that faction interferes.** Pricey, not deadly:
  an ultimatum story (they meddle in your lineup, demand a favor, dock your
  stipend — pay in ⚡, loot, or obedience).
- **Combined fill ≥ 75 (gap under 25) → THE SUMMONS zone**: firing events
  can fire — same ladder shape as the smugglers: give up something big /
  pay heavily in ⚡ / **FIRED. Game over**, LEGACY recorded with cause.
- The dirty loser fills both ends simultaneously and watches the gap
  collapse fastest — fired by joint committee, as deserved.

---

## 10. STORIES

### 10.1 Two-layer architecture [LOCKED]

- **Cause flavors** — one or two intro lines owned by the source: *"Enlyl
  got his arm stuck between two asteroids and saw no other way out than to
  have Odynn rip it off"* (Asteroid Pushes) vs *"a backflip too far"*
  (Blaster Dodge).
- **Class-owned storylines** — the "arm ripped off" sequence itself: bio-lab
  weeks, the Beelzebub temptation, the course-correction beats. Authored
  once, reachable from every cause in its class. N causes × M storylines.
- Severity is rolled inside the pool (meaner for low-energy victims), and
  every storyline node obeys the TWO TAILS: somewhere in the arm-off
  sequence lives the 2% where his mom teaches him to regrow it overnight.
  It doesn't happen often. It happens.

### 10.2 Tiered trees [LOCKED]

The template is the Odynn shape: a cheap surface choice (*"Coach, I need the
week off." — SURE / WHY?*) that either closes politely or opens a 2–3 beat
storyline with a bargain inside (*"Can you make it one week instead of
two?"*). Every choice button carries its odds line; axis influence is
printed with cause (*"Ask why — ▲50 he opens up (Savvy lean) · ▼25 DRAMA
(he's Fierce, careful)"*). Printed odds never lie; **people do** — the
5★-Savvy kid's "sure, coach" is occasionally worth nothing, in outcome text
only.

Schema: story = a small tree of nodes; each node = typewriter text + choice
buttons (each with odds line, axis/mood modifiers, matching bag items
injected as extra buttons) + delayed payoffs weeks later. SPEC ships the
schema; **writing the few dozen sequences is its own session.**

### 10.3 Setbacks are doors [LOCKED]

Law 4 applied: "grounded for the season" is replaced by *"hull breached —
your scout intel blew out the hole"* (those stars blur back to ?) or
*"grounded 3 weeks — unless you trust the mech-goblin starbase"* (they fix
it for 3⚡ off next week's stipend, or they fail and now your ship is
grounded at THEIR base, space-bus home, weekly recovery roll).

### 10.4 VOYAGES [LOCKED]

Space travel is where an intergalactic college lives. Every **away game** (5
per season) and every **scan run** is a voyage; each voyage rolls an
encounter (~▼/▲25 something happens at all — most trips are quiet, because
randomness spices and never replaces). Encounter pools: prospects met on
space-buses, shady vendors, rival coaches, mech-goblins, omens of the
tournament. At 0⚡, voyages roll the debt disaster instead (§8.2).

### 10.5 ALUMNI [LOCKED]

Departed players don't disappear — they join the **alumni encounter pool**,
and the galaxy occasionally hands them back to you as stories (voyages,
offseasons, tournament crowds): *"On the streets of Oblox-4 a stranger
asks, 'Coach? Can you spare some money?' It's Enlyl — your starting guard
from four years ago."* Every alumni encounter is a storyline with glory and
catastrophe tails like any other; LEGACY moves only as a story *outcome*,
never as an automatic yearly verdict. **No disposition stat, no
bookkeeping** — which alum surfaces, and how life has treated him, is
random. Players taken by the void (§8.2) sit in the same pool: the haunting
and the homecoming both live here.

### 10.6 THE EMPTY LOCKER [LOCKED]

When you lose a player outright mid-season (the void's rung 4 — rare by
construction), the 9th spot must be filled, and the candidates ARE the
story:

- **A walk-on from the training squad** — what you see is what you get ·
  ▲2 BREAKTHROUGH (now and then, a GEM) · ▼2 DRAMA.
- **The dean's daughter** — she's genuinely good, and now the school owns a
  piece of your lineup · ▲5 SPIRIT · ▼10 SCANDAL (school-side hot-seat
  strings all season).
- **A droid built by a booster** — suspiciously excellent · ▲5
  BREAKTHROUGH · ▼25 SCANDAL (the league has questions; booster-side
  strings).

Whoever fills the locker writes stories for the rest of the season.

---

## 11. THE BAG & KNOWLEDGE [LOCKED]

**KNOWLEDGE** — permanent unlocks (drills, scan regions), through storyline
events, in the COACH drawer. **THE BAG** — 5 slots of consumables; full bag
→ use-or-discard on the spot; items come only from play (stories, wins,
tournament, shady vendors charging hot-seat heat); legendary = once per
season; when a story fires and you hold a context-matching item, it appears
as an extra choice button in the popup.

Item faces use the odds line — effect + ▲ + ▼, class not script:

| Item | Rarity | Play at | Face |
|---|---|---|---|
| Beelzebub's Vial | rare | injury/energy story | 100% full energy tonight · ▲2 BREAKTHROUGH · ▼25 INJURY |
| Xarter's Invitation | **legendary** | practice | +50 Quick lean, 2 wks · ▲5 BREAKTHROUGH · ▼10 SCANDAL |
| Chrono Sip | **legendary** | practice | +3 levels, instantly · ▲2 BREAKTHROUGH · ▼10 DRAMA |
| Meteor Ice Pack | common | injury story | recovery halved · ▲2 SPIRIT · ▼2 DRAIN |
| Nebula Espresso | common | pregame | +20 energy tonight, −30 tomorrow · ▲2 BREAKTHROUGH · ▼2 DRAMA |
| Mood Karaoke Chip | common | mood story | squad mood +15 · ▲5 SPIRIT · ▼2 DRAMA |
| Study-Buddy Hologram | common | academic story | he passes · ▲2 BREAKTHROUGH · ▼10 SCANDAL |
| Kappa Nebula VIP Pass | rare | recruiting | woo +25% · ▲5 INTEL · ▼25 DRAMA |
| Gravity Boots | rare | practice | permanent +5 toward Strong · ▲2 BREAKTHROUGH · ▼25 INJURY |
| Referee's "Lost" Wallet | rare | pregame | wheel tie → win · ▲2 WINDFALL · ▼50 SCANDAL |
| Cloaking Doubt | rare | pregame (UT) | opponent's plan is random · ▲5 INTEL · ▼2 DRAMA |
| Booster's Blank Check | rare | recruiting | prospect signs today · ▲2 LOOT · ▼25 SCANDAL |

---

## 12. RECRUITING [LOCKED]

- Prospect board: the 3×3 grid, DROP button. Tile = sprite + fuzzy dot +
  "2★ / pot 4★" + species tier badge (I/II/III).
- Tap a prospect → two buttons, 1⚡ each, each with ethical and unethical
  lanes, all odds-line faced:
  - **SCOUT** (know him): attend his game (sharpens dot + stars) · or buy
    the combine database (instant exact read · ▼25 SCANDAL).
  - **RECRUIT** (want him): campus tour (safe, small) · restaurant / frat
    house (bigger, ▼DRAMA) · the booster's envelope (▼50 SCANDAL).
- Every signing-day heartbreak is traceable: you signed a blur, or you
  scouted a razor edge while a rival closed.
- Scan regions (KNOWLEDGE-gated): Home Planet 1⚡ safe t1 → Local Nebula 2⚡
  t2 ▼10 SHIP → Outer Rim 3⚡ t3 ▼25 SHIP → Deep Core (discoverable,
  anything). Scans are voyages (§10.4); SHIP setbacks are doors (§10.3).
- Commitment decays if ignored; harvested on SIGNING DAY.

---

## 13. UI MECHANICS

- **THE COMMIT HOLD** [LOCKED]: any button with no way back — PLAY GAME,
  story choices, debt payments, discards, signings — must be **held ~1s**,
  filling with the ramp while held. A quick tap wiggles the button and hints
  "HOLD". Tap-to-skip typewriter and plain continues stay taps.
- Story popups: typewriter over the dimmed stage, player card in-popup,
  outcome types in the same popup while impacts animate (carried from v0.7).
- Slide transitions between phases; floaters on black tags (§7).

---

## 14. CARRIES OVER / DIES

| CARRIES | DIES |
|---|---|
| Story popup engine, typewriter, in-popup outcomes | 4 stats + 8 attributes + LED columns |
| Baller Rig sprites (`src/rig.ts`); axis-expressive bodies come with the species session | OVR/POT, stat stickers, level-up stat allocation |
| Persistent header + nav shell, slide transitions | Positions & penalties |
| 3×3 grids (roster, prospects) | Tactics sliders (→ plan wheel) |
| KNOWLEDGE tree + scan regions | 8-team/14-week season & all-8 tournament (→ 6/10 + UT) |
| Woo/commitment, signing day, walk-on GEMs | Press conference quiz |
| Pro departures at 85+, mood-based convincing | **Continuous integrity score** (→ THE HOT SEAT) |
| Deploy pipeline, localStorage + SAVE_VERSION, `scripts/headless.ts` | Red & gold as UI colors; enumerated odds tables on item faces |
| | One-player-per-session training (→ drill board) |
| | Use-it-or-lose-it weekly energy (→ the 6/12 cache) |

---

## 15. GAME OVERS & THE CAREER TABLE

Three ends, one table:

| End | How |
|---|---|
| **RETIRED** | Chosen after any season. The only clean end; locks LEGACY with honor. |
| **FIRED** | The hot seat's SUMMONS, refused or unpayable (§9). |
| **LOST TO THE VOID** | The debt ladder's last rung (§8.2), incl. old-age spirals (§5.6). |

Every run records: seasons, titles, UT record, pros sent, LEGACY, cause.

---

## 16. ENGINEERING NOTES

- Same stack (Vite + TS, `src/engine` separated from presentation). A
  rebuild of model and screens, not a new repo. Bump `SAVE_VERSION`.
- Story schema (§10.2) and species interface (§2.2) are data-driven so the
  two deferred sessions slot in without engine changes.
- All tuning values (drill XP, rung assignments, heat rates, stipend, aging
  onset, level curve) are starting values — **the headless sim gets a batch
  mode** to play hundreds of careers and report: avg SKILL by class year,
  UT reach rate, firing/void rates, energy starvation frequency.
- **Definition of done**: headless plays 3 full careers without error,
  including at least one UT title, one firing, and one void death; playable
  on iPhone over LAN; every screen passes the one-question test read aloud;
  no meaning carried by hue anywhere except the team ramp.

---

## 17. PARKED FOR AFTER v1.0

Everything above is **LOCKED** (final review round, Aug 15, 2026). Ideas
raised during review and deliberately parked:

- **Two-part mood**: personal mood × opinion-of-the-coach. Would give
  alumni encounters and locker-room stories a memory; too much bookkeeping
  for v1 — alumni stay random for now (§10.5).
- **A legendary item that adds a level** (§2.4).
- **The post-game speech** choice after losses.
- **Buying a void-taken player back** as a designed legendary arc —
  currently just a rare alumni story.
- And the two dedicated sessions: **species design** and **story writing**
  (the few dozen sequences on the §10.2 schema).
