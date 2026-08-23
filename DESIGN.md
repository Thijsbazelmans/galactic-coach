# GALACTIC COACH (working title)

*A text-based, low-fi intergalactic college basketball management game.*

Working title only — rename freely. Directory can be renamed to match.

## Vision

You are the head coach of a college basketball program... in space. You make **all**
the decisions: tactical, recruiting, business, management, disciplinary, moral. The
game is, deep down, a light critique of college sports — while showing genuine love
for the game.

**Design north star (from bethecoachbasketball.com):** very simple mechanics that
represent complex decisions. The canonical example: pursue 1 recruit and you have a
75% chance of landing them; pursue 2 and it halves to 37.5% each. Every system in
this game should aspire to that shape — one small number, one painful trade-off.
If a mechanic needs a spreadsheet to understand, it's wrong.

**The repetition problem:** Be The Coach gets repetitive because you sim seasons
waiting for the next recruiting moment. Our answer: make *every week* a decision
moment via the energy system, and make in-season choices (galaxy scouting,
booster schmoozing) pay off at the recruiting moment.

## Why intergalactic

The college structure (recruiting classes, graduation, amateurism, boosters) is the
fun part — but the NCAA is strict and litigious about its brands. So: all real D1
colleges exist, renamed and relocated to fictional planets. UCLA Bruins → blue &
gold **Montalvo Aurum Orsos**, on a planet on the west side of the planetary map.
Every team and planet name is player-editable (also insulates the game legally).

Space also buys us a second mechanic for free: **alien species**.

- Species have real gameplay identity: six-armed Hexabrachs block and rebound,
  twelve-legged Dodecapedes are fastest in the galaxy, rock-bodied Lithoids are
  brutal defenders who shoot actual bricks, luminous Luminars are pure shooters
  made of glass (figuratively and nearly literally).
- Scouting far regions of the galaxy surfaces rarer species — exploration is a
  recruiting investment.

## Core loop (Football Manager-style, turn-based)

Every week ends with a game. Between games you have a limited supply of **energy**
(the coach's attention). Spend it on: training players, coaching new tactics,
scouting the galaxy for talent, recruiting scouted talent, training staff,
schmoozing boosters, scouting the next opponent, facility/stadium projects.
Never enough energy for everything — that's the game.

**3-on-3 league, 9-player max roster.** Keeps rosters legible, games fast, and
every player a person you know.

## The cheek

Players have personal problems that are specifically *college* problems: a
cheerleader gets pregnant, someone's caught cheating on a test, someone's picked
for an exchange program. And specifically *space-college* problems: a violent
species' freshman puts his study group in the hospital; a blaster goes off during
cleaning and takes your point guard's arm clean off (6 weeks in a bio-lab growing
a new one). **No death, but yes violence.** Tone: cheeky, not grimdark.

Events force the central tension: **immediate impact vs. raising responsible
"people."** You're scored on trophies won AND on integrity — a coach's actual job.
Both a prison-camp program and a hippie-commune program can succeed (god-game DNA:
your program has an identity, and the game reacts to it).

## Presentation roadmap

1. **v0 (now):** all text. Terminal/lo-fi aesthetic. Playable in a browser.
2. **Later:** 8-bit pixel art. Space Invaders meets NBA Jam meets Game Boy —
   the look of old pixelated soccer management games.
3. Graphics should eventually *represent* the species/teams, not just decorate.

## Platform strategy

Deliberately undecided (Steam? mobile? web?). Build web-first with the simulation
engine (`src/engine/`) fully separated from presentation, so the same core can be
wrapped for Steam (Tauri/Electron), mobile, or published to itch.io for early
playtesting. Discover the platform by playing it, don't pick it up front.

## THE NORTH STAR, v2 (from playtesting v0.7) — consequence management

The grind is the enemy. A sports sim where you play 38 near-identical games
and only lose when your star is injured is a job. This game is different
because it's COLLEGE: these aren't professionals, and college life matters
as much as winning. Heighten those stressors, then hand the coach EXTREME
tools to deal with them. The fun is: the game throws wrenches, you learn to
handle them. **Consequence management, with galactic madness thrown in.**

**The two clocks.** Every decision serves one of two goals, and usually
trades against the other:
1. SHORT TERM — win this week's game.
2. LONG TERM — have a star two seasons from now (patient training of the
   freshman prodigy, or scouting/recruiting).
Both offer shortcuts and cheats. All shortcuts have consequences — short
term AND long term.

**Extreme tools, honest odds, loud outcomes.** The archetype: your starter
partied too hard, energy floored — play him and risk serious injury, sit him
and eat the loss, send him to the shady Beelzebub doctor on stAroid-5 for an
instant fix (team doctor fury / OD / 6 weeks hospital / rehab), or start the
freshman prodigy — and maybe send HIM to Coach Xarter, the mind-controlling
trainer who boosts quickness 50% for two weeks but takes one pupil a year,
and whose mind-control might spike aggression until the kid bites an
opponent's leg off (flagrant foul, 3-week suspension). The design rules:
- Warn continuously: pros AND cons visible before every risky choice.
- Course-correction moments: multiple chances to steer before impact.
- Make consequences unmistakably traceable to choices.
- Dramatize the luck itself: "1 in 700 — and you WON it."
- Randomness spices decisions; it never replaces them. If the player is just
  clicking through stories for the literary value, we've failed.

**Tactics = solving puzzles, with feedback.** Identify the opponent's shape
(they're huge), counter with lineup + tactics (go small, play outside) +
targeted prep (send both guards to Xarter for a week-long shooting boost) —
then get explicit feedback in/after the game on whether the plan worked.
Coaching a fake game is fun when plans visibly succeed or fail.

**A rating system of inherent contradictions.** You can't be big AND agile,
strong AND small, aggressive AND smart. Stats should be opposed axes, not
independent bars — so team-building means leaning into strengths and playing
around weaknesses, and no amount of grinding maxes everything. This gives
strategic depth WITHOUT data bloat.

**Presentation law:** cards, big knobs, big sliders. One consistent color
language everywhere. Bigger, bolder, clearer; each screen answers exactly
one question. Arcade — never idle-clicker, never spreadsheet.

## v1.0 DECISIONS (locked with Thijs)

- **Axes**: BUILD = Strong ◀▶ Quick. HEAD = Fierce ◀▶ Savvy. Plus SKILL
  (0-99, the only trainable number) and the live meters (energy, mood).
- **Species define caps on all four axis poles**, and the SPRITE must show
  it: per-species size ranges (some species all bigger than humans, some all
  smaller), and temperament readable in the art (a massive friendly rock
  giant: high Strong cap, low Quick, high Savvy, low Fierce; a clawed
  predator: high Strong AND high Fierce).
- **Three species tiers**:
  1. Humans + humanesque — low caps everywhere (floor material).
  2. Same-galaxy species — high cap in ONE direction.
  3. Exotics — high caps in TWO directions, with consequences to match.
     (Flame beings, translucents, full robots... species design is its own
     future discussion — do not design them yet.)
- **League: 6 teams, 10-game season** (double round robin). Finish FIRST and
  you enter the **Universal Tournament** — max 3 rounds against champions
  from across the galaxy. Winning it is winning March Madness.
- **Tools as inventory — THE BAG** (agreed): the coach carries consumable
  item cards, played at the right moment like RPG spells.
  - Design law: most items are BARGAINS, not buffs — odds printed on the
    card face, bad outcomes included ("70% instant fix · 20% doc feud ·
    10% hospital"). A few honest weak ones for texture.
  - Scarcity: small bag (~5 slots; full = use or discard). Items come only
    from play — storylines, wins, shady vendors charging integrity — never
    from waiting. Legendary items are once-per-season (Xarter takes one
    pupil a year).
  - Killer integration: when a story popup fires and you hold a relevant
    item, it appears as an EXTRA choice button in that popup.
  - The arsenal splits: KNOWLEDGE (permanent unlocks: training methods,
    scan regions — the existing skill tree) vs THE BAG (consumables).
- **Universal Tournament implication**: its 8 entrants are champions of
  other conferences that exist but are never played during the season —
  generate them; an unknown-champion scouting report is a fun pre-tournament
  beat. Finishing 2nd in your league = season over, straight to recruiting.
  Intended and confirmed: first place matters enormously.
- **XP under the axis model (working instinct, unconfirmed)**: XP levels
  SKILL only. Axis positions (Strong↔Quick, Fierce↔Savvy) move rarely —
  through events, items, and offseason growth, never by grinding.

## NEXT STEP (start of next session)

**DONE — the spec is drafted and revised: see `SPEC.md` (v2).** Thijs's
review rounds (Aug 15) added: the odds line (2/5/10/25/50 rungs, ten
classes, two tails everywhere), team-hue ramp + motion-for-urgency color
law, the whole-squad drill board, star-scouted skill/potential + level cap
10, the 6/12 energy cache with the debt ladder (smugglers take a player),
the hot seat (replaces integrity scoring), voyages, alumni verdicts,
aging/retirement/high scores, and hold-to-commit buttons. The final round
locked the last pieces: the two-ended hot-seat bar (the gap in the middle
is your job; one side at 50 = interference, combined 75 = SUMMONS zone),
the win-meter band for unscouted opponents, aging at season 21, random
alumni encounter stories (no disposition stat, no auto-scoring), and THE
EMPTY LOCKER (rare void-taken player → fill the 9th spot: training-squad
walk-on / the dean's daughter / a booster-built droid). **The rebuild
SHIPPED as v1.0 (Aug 15, 2026)**, then two phone-driven UI passes landed
the same night: **v1.0.1** (device-width viewport, 2x type, one-time
ASSISTANT COACH tips) and **v1.1 THE FRAME** (commit adb3e9a): fixed
no-scroll app layout — stats bar always top (with ? help + ⚙), THE BAG's
5 slots + nav always bottom, the 3×3 grid in between with a 4th row for
controls. The grid IS the lineup everywhere (drag anytime); columns are
BACKCOURT/WING/FRONTCOURT with MISCAST penalties (up to −25% for
wrong-column leans); injured players sink to their column's reserve slot.
Story popups take over the middle; matching bag items pulse and drag in.

## v1.2–v1.5 — the redesign day (Aug 16, 2026)

Four releases in one session, all live on Pages. The v1.2 mandate below was
executed and then iterated three more times with Thijs directing from his
phone:

- **v1.2 (b16e1da) — the card anatomy.** RATING top-left · NAME center ·
  YEAR top-right; vertical 5-LED strips flanking the sprite (⚡ bolt left,
  mood face right, bottom-up fill, blink ≤20); foot row below. Status tags
  (OUT / SITS OUT / MISCAST / BANNED) became centered overlays so every
  card has identical height. Grid rows split space evenly but never shrink
  below card content (`min-height: max-content`) — tight screens scroll
  instead of clipping. Tryouts pool uses `grid scroll` (natural height).
- **v1.3 (690b60a) — feel + frame.** The drag bug: on touch, moving >12px
  before a 250ms hold timer CANCELLED the drag. Now any >6px movement
  starts the drag (no hold), with `touch-action: none` on grabbables.
  Popups render INSIDE `.midwrap` (absolute, not fixed) so the stats bar,
  THE BAG and nav stay visible — ⚡ readable while a story asks you to
  spend it; nav dims (`.navbar.dimmed`) while any popup is open. Header
  became: team chip · S# · JOB SECURITY bar (bright middle, heat darkness
  eats in from both ends; scholar cap = school, right icon = boosters) /
  week · record · energy far right. Drills became repeatable (energy is
  the only limiter; "⬆ AGAIN" next to the report).
- **v1.4 (a39ebf1) — subtraction.** Card foot is XP twin bars (fill +
  10-seg LVL) | compass | POT star column — the 2×2 pole box died. Compass
  poles are text (FRC/SVY horizontal, STR/QCK vertical) on every compass;
  dot + species-cap box plot in an inset area (`CT: 15 + v*0.7`) so even a
  95-cap species stops short of the letters. The species box is the light
  rectangle showing pole caps — terrans small and centered. Underlined
  NAME is the only door to the detail view; the rest of the card drags
  (or toggles sitout / squad pick). Titles went one-word: TRAINING,
  RECRUITING, MATCHUP, STANDINGS, ROSTER, OFFSEASON, SIGNING DAY, GROWTH.
  Win% left the header (it lives on MATCHUP, labeled WIN). Prospect card:
  commit% in the rating corner, SKL?/POT? star columns flanking the fuzzy
  compass, tier gone.
- **v1.5 (4381ecb) — celebrate the moment.** Every story is now a staged
  cycle: **anticipation** (one line alone, center stage — "the gym goes
  quiet") → tap → **verdict** → tap → **impact** (full-focus panel: sprite
  + name + each changed stat landing one at a time, number counting old→new,
  ▲ pop on gains / ▼ shake on losses; tap skips to final values) → the
  mitigating **choice** (card + odds buttons) → the outcome repeats the
  cycle. Impacts come from diffing a full world snapshot across
  `resolveStory` (so clamps, level-up side effects, squad-wide and coach
  fx all show true numbers, incl. ⚡ CELLS / JOB SECURITY / LEGACY rows).
  Beats split on the author's `\n\n` (most story texts already have one),
  else first sentence. Old floaters remain only for drills + post-game.
  Dev handles for testing: `gc.story(defId, beat, playerId, data)`,
  `gc.ui()`, `gc.state()`.

## v2.0 — THE FOUR ATTRIBUTES (Aug 22, 2026)

The big rework, designed with Thijs from his v1.5 playtest notes (scouting
was pointless, tactics unreadable, compass hard to read, no season stats,
cards too dense) and shipped in one session. **Old saves die (SAVE_VERSION
13); fresh season 1.**

- **Four attributes, everything in fours.** SKILL / ATHLETICISM /
  FIERCENESS / BRAINS, each 0–25. OVERALL = the sum (theoretical 100;
  species caps keep every real player below it — humans sum to ~60, and a
  lopsided human can still spike ONE attribute). The old opposed axes die;
  the contradiction law now lives in the BUDGET + per-attribute species
  caps. Each attribute maps 1:1 to a tactic, a box-score stat, and a drill:
  SKL→SHOWTIME→points, ATH→RUN & GUN→rebounds, FRC→LOCKDOWN→steals,
  BRN→CLOCKWORK→assists. Counter loop: SHOWTIME > LOCKDOWN > CLOCKWORK >
  RUN & GUN > SHOWTIME. Meters mute: energy suppresses ATH+FRC, mood
  suppresses SKL+BRN (floor 60%).
- **Position is body size, not a stat.** sizeIndex (XS–XL) from
  height/weight (mirrors the rig's sprite classes). Miscast is a size
  lookup table (wall in the backcourt / waterbug in the frontcourt, −25%
  max). Species have size identities (Dodecapedes small, Lithoids bruiser-L).
- **The kite compass.** SKL up / ATH right / FRC down / BRN left; solid
  kite = current, outline = per-attribute potential (stars are DEAD),
  dashes = season start (growth lens), dotted = species caps (detail view).
  OVERALL sits in the kite's center. Prospects render the kite as a CLOUD
  (blur 3.5px → 1.5px → truth) that scouting sharpens.
- **Scouting matters now.** The matchup has two sides: each tactic chip
  shows YOUR live team rating under that tactic (starters 75% / bench 25%,
  moves when you swap players), but their side is hidden until you SCOUT
  (1⚡): their tactic, their rating, their team kite, and the counter
  arrows. Unscouted keeps the ±15 win band. Sometimes your second-best
  shape is right because it counters theirs.
- **Real box scores + season/career stats.** dealBox() deals my team's
  final score into pts/reb/stl/ast by attribute-weighted shares (starters
  ×3, bench ×1); accumulates into p.stats (season) and folds into p.career
  each offseason. Alumni carry their full career line (graduation note
  prints career points). Verdict boxLine is now true numbers.
- **The three-lens main screen.** TRAINING grid swipes (or tabs) through
  SKILLS (meters + kite + size), STATS (per-game 2×2 with ♛ crowns for
  team leaders, GP/career), GROWTH (layered kite + POT sum + XP). Same
  nine faces in the same nine places. Swipe = horizontal fling >56px
  (card drag wins on the SKILLS lens; other lenses aren't draggable so
  swipe works anywhere). New 'lenses' tip.
- **Two-track training.** Basic drills (SHOOTAROUND squad XP, PERSONAL
  SESSION one-player XP, TEAM REST) are known from day one. XP → level
  (cap 10) → a blocking LEVEL UP story: the coach places +2 points (10%
  breakthrough: +3) into any attribute under its pot. Discovered methods
  hammer DIRECT points into fixed attributes, one player at a time:
  ASTEROID PUSHES +1 ATH, METEOR DODGING +1 SKL +1 ATH, GRAVITY CAGE
  +1 FRC, THE FILM CRYPT +1 BRN — with real injury odds. At his ceiling,
  the reps bank as XP instead.
- **Tactics are knowledge.** You start knowing SHOWTIME + RUN & GUN;
  LOCKDOWN and CLOCKWORK come from the seminar/oracle knowledge pool
  (which now teaches drills OR tactics). Unlearned chips render locked.
- **Fx rework**: skill/build/head/potential → attr / potAttr / anyAttr /
  anyPot / unlockPlan; every story swept. PRO_OVR = 52 replaces skill≥85.
- **Testing**: `npx tsx scripts/headless.ts N` (engine careers, ~59% win
  rate, invariants on attrs/pots/caps) and NEW `npx tsx scripts/uismoke.ts`
  (boots the real UI in happy-dom, clicks pick-team → tryouts → lenses →
  drill → galaxy → matchup → game night; uses the `gcAction` dev handle
  because hold-buttons ignore clicks).
- Also in this session: **v1.5.1** — text selection + iOS long-press
  callout disabled app-wide (`user-select: none` on `*`).

## v2.1 — the full-bleed square card (same session)

Thijs's immediate read on v2.0: the kite is cool but too small, and the
OVR number overlapped it. His redesign, implemented: **the card IS the
compass** — a full-width square kite with the SPRITE centered inside it,
name+year on a black strip up top, OVERALL big in the bottom-left, and a
circular XP ring (LVL number inside) in the bottom-right. Energy/mood/size
left the card entirely: **Thijs is doing a sprite pass where mood, energy
and size read from the sprite itself** (meters live in the detail view
meanwhile). Prospects wear the same square (cloud kite + COM commit ring);
the GROWTH lens is the same square layered (start dashes + pot outline)
with a POT chip instead of the ring; STATS lens unchanged.

## v2.2 — THE SPRITE LAB + ON FIRE (same day, Aug 22, 2026)

Thijs authored the sprite rework himself in Claude Designer ("Terran Guard
Study", checked into `fromDesign/260822/`) and it landed whole. **Old saves
die again (SAVE_VERSION 14); fresh season 1.**

- **The new rig (rig.ts, ported verbatim from the study):** six hand-placed
  24px pixel maps — TERRAN, HEXID (six-legged insectoid), QUADRAN
  (four-armed heavy-worlder), PETRAN (stone golem that shoots BRICKS),
  NIMBUS (gas-form floating over empty high-tops), GELID (liquid melting
  into its own puddle). Shared contracts: face rows = MOOD (5 buckets:
  angry+cloud / upset / neutral / happy / elated+star), the ball = ENERGY
  (exhausted = in bed with zzz / tired = tucked ball + sweat / normal =
  slow dribble / fit = dribble + jump shot / pumped = whirlwind), SIZE is
  height-only row duplication, ON FIRE is a flame ring that fits any
  silhouette. Seeded per-player flavor: skin tint, hair/crest style,
  socks, wristbands. Rendered as a 24-frame sprite sheet data-URL
  (cached), animated by a CSS steps(24) loop — no JS timers, survives
  re-renders. FEMME forms are fully implemented in the renderer but every
  player currently renders MASC (story texts all say "he" — a pronoun
  pass is needed before rolling femme players).
- **The six species replace the five** in the engine, caps tuned to the
  bodies: terran 15×4 · hexid ATH 24 (small) · quadran FRC 24 (huge) ·
  petran FRC 21/SKL 6 (bruiser-L, bricks) · nimbus SKL 24 + BRN 21 (tier
  3 glass) · gelid BRN 23 + ATH 21 (tier 3 liquid). Scan pools remapped.
- **ON FIRE (Thijs's pitch, printed rule):** drop 20+ points → ignite:
  every attribute plays ×1.2 (attrEff), which also feeds the box-score
  dealer, so streaks feed themselves. Stays lit at 15+ points; goes out
  under 15, on a night without minutes, on injury, or over the summer.
  Ignition is a story beat; cooling is a floater. The rule is printed in
  the gamenight tip.
- **The detail view is DEAD** (Thijs's call): the three lenses carry it.
  Rehomed: exact cur/pot per attribute → GROWTH lens corner labels;
  career totals → STATS lens footer; energy/mood/size/species → the
  sprite itself. Names are no longer underlined doors.

**v2.2.1 polish (Thijs's ramble, same day):** header regrouped — energy
cells left / job-security bar right on one row, `S1 · WEEK 1/10 · 0–0` on
the second, ? and ⚙ stacked vertically far right; job-bar icons are now
A+ (school) and $ (boosters); tryouts lost the TAP-TO-PICK bar (the lit
card edge + the PICK 9 button carry it); compass corner labels grew to
9px bold with the side pair (ATH/BRN) turned vertical.

**v2.2.5 (Thijs's second polish list, same day):** STATS lens is now the
same square card — sprite in its usual center spot, the four per-game
stats in the corners (♛ on leaders), GP bottom-center. GROWTH renamed
POTENTIAL: labels spelled out as BRAIN · SKILL · BODY · FIRE with white
numbers inline (side pairs run vertical with their labels), and one
center chip shows total/potential (e.g. 31/55). Story popups: the card
stays normal card size with the compass/numbers muted — attention on the
sprite, which now ACTS THE STORY instead of showing its meters: neutral
→ angry + sweat on bad news, neutral → elated on good (tag-based), and
no ball in stories; the impact panel sprite plays the verdict. The WING
column has no size penalty at all now. Header: more air before the ?/⚙
column. Text purge: assistant auto-tips OFF by default (the ? button
remains), lens info rows / galaxy hint / bag item-hint removed — a
proper succinct tutorial is future work.

**v2.2.6:** STATS card rebuilt as a flanking scoreboard — ten aligned
rows, labels down the left in team color (GmPl · Pts · PPG · Reb · RPG ·
Stl · SPG · Ast · APG · MVP), numbers down the right in white, sprite in
its usual center spot. NEW STAT: in-game MVP (best combined line on the
team each game; StatLine.mvp, dealt in dealBox, careers fold it in).
POTENTIAL card orientation fixed per spec: SKILL horizontal top, BODY
down the right edge baseline-in, FIRE horizontal bottom, BRAIN up the
left edge baseline-in; OVR returns bottom-left and the POT box bottom-
right (center chip gone). SKILLS lens renamed ABILITIES. Lens arrows
removed AND the swipe gesture removed (it fought the card drag) — the
three tabs are the only lens control.

**v2.3 — RUN & the recruiting rework (Aug 22, evening):**
- PRACTICE: back to ONE practice per week (TEAM REST is no longer a free
  well). New flow: a big hold-to-commit **RUN** button with the selected
  practice + a one-line recap (default SHOOTAROUND), ▾ opens the picker
  sheet (tap to select). On run: the spent ⚡ pops away over the energy
  bar, then results sweep the grid top-left → starters → bench → reserves
  — the standard pattern for every team-wide change (post-game too).
- RECRUITING: the prospect modal is DEAD. Tap a card to highlight it;
  under the grid sit three two-part buttons — DISCOVER / SCOUT / RECRUIT
  — each with a selected variant (▾ picker: region / scout act / woo act)
  and each usable ONCE PER WEEK (energy still applies). Discover finds
  ONE prospect per week. Outcomes are floaters on the card, not text
  modals. Prospect cards use the same three lenses: ABILITY (cloud kite
  sharpening ?? → two-row range → exact number at scout 2), STATS (the
  scout's one-line blurb), POTENTIAL (pots as a cloud + a 2-over-3
  star stack, bottom-left; NEVER exact until he signs — observe() keeps
  ±1/attr fuzz on pots even at full scout). Commit ring on ability +
  potential views. ✕ in the top strip = forget forever (confirm dialog).
  S/M/L chip and the name-tag modal trimmings are gone.
- Cards: POTENTIAL labels back to short BRN/SKL/ATH/FRC; label and
  number sizes match everywhere; STATS numbers same size as labels with
  zebra brightness (every other row brighter); no decimals anywhere;
  PRACTICE header added and both grid headers align with the leftmost
  card; prospect grid got a blank col-header row so cards never shift
  between screens; CONTINUE is lens-tab width.

**v2.3.1:** BOARD label dropped. Recruiting buttons are context-driven and
full width: an empty slot highlighted (the default) shows DISCOVER alone;
a highlighted prospect shows SCOUT over RECRUIT, greyed when known cold /
banned / already used this week. Every action ends in THE RESULT: the
screen goes near-black except the energy bar, the spent ⚡ blasts away in
huge pops one cell at a time, then the typewriter reports what happened
("New potential discovered: …"). Prospect clouds are REAL clouds now —
three jittered ghost kites under an SVG gaussian blur (the CSS filter
path didn't render on Safari). Ability readout moved to the bottom-left
of the card; the STATS-view sprite is dimmed hard behind the blurb.

**v2.3.2:** The energy BLAST is now the one animation for every ⚡ spend —
practice runs, story choices with a printed cost, opponent scouting, and
the recruiting actions. Post-game deltas are STICKERS that land one by
one (slot-order sweep) and STAY on the cards through the verdict. The
nav is one language: a small plain BACK on the left when there's a back,
and a single fixed-size hold-to-commit button that names the destination
(TO RECRUITING · TO MATCHUP · PLAY · STANDINGS · NEXT WEEK · SIGNING DAY
· SEND LETTERS · SEASON N). OUT tags stopped blinking. PRACTICE is
squad-only: PERSONAL SESSION deleted, the discovered methods train the
whole team (costs bumped: asteroid 2⚡ · meteor 3⚡ · cage 2⚡ · crypt 2⚡),
and anyone under 40 energy sits out automatically — manual sit-outs are
gone. Recruiting buttons now share the RUN anatomy («▶ VERB — VARIANT»
with details beneath). POTENTIAL corner labels are label+number on one
line (SKL 12/16), sides vertical baseline-in, numbers letter-sized.

**v2.3.3 — the tiers and the tug-of-war:**
- Spend states everywhere: RUN shows «✓ THIS WEEK» when spent, and every
  ▾ variant arrow locks once that week's action is used.
- The always-available options come in 1/2/3⚡ rungs so a full cache can
  actually be spent: practice = SHOOTAROUND 1⚡ / FULL SCRIMMAGE 2⚡ /
  TWO-A-DAYS 3⚡ (+ TEAM REST 0⚡); scouting = ATTEND 1⚡ / PRIVATE WORKOUT
  2⚡ / COMBINE DATABASE 3⚡; recruiting = TOUR 1⚡ / KAPPA NIGHT 2⚡ /
  RESTAURANT 3⚡; discovery was already 1/2/3⚡ by region. Discovered
  methods stay the premium tier. Save migration unions the new basics in.
- THE TEAM BARS: under the practice grid, five horizontal bars — SKILL /
  ATHLETICISM / FIERCENESS / BRAINS / OVERALL — raw unweighted sums of
  all available players (max 225 per attr, 900 overall), each with its
  division rank (1st–6th). On MATCHUP the same five bars become a
  TUG-OF-WAR once the opponent is scouted: your tactic-weighted total
  (plan attr ×2.5) pushes from the left in your color, theirs from the
  right in theirs, numbers on the rail — switching tactics visibly moves
  the rope. Unscouted shows only your side.
- Headless win rate settled back to ~56% with the pricier basics.

**v2.4 — THE SPEECH (Aug 23, 2026):** The matchup screen was stripped to
the bone: header MATCHUP, the grid in its usual pixels, then «AWAY @
HOME», the five team bars, and the coach's SPEECH. The win-meter strip,
opp chip/gimmick/kite are all gone — the bars ARE the read. Bars sit in
venue order: away's numbers on the left, home's on the right, each side
filling from its own end in team colors; unscouted, the far side reads ??
and your bars sit uncontested (the SCOUT 1⚡ hold-button rides to their
right). The OVERALL row out-shouts the four singles on both screens.
Tactics became SPEECHES with the standard action anatomy: «▶ SPEECH —
USE YOUR BRAINS» (+BRAINS · FREE) with a ▾ picker (SHOOTERS SHOOT /
RUN THEM RAGGED / MAKE THEM HATE THE BALL / USE YOUR BRAINS — undiscovered
speeches render locked). One speech per week, committed — the arrow locks,
and PLAY is disabled («SPEECH FIRST») until it's given. The bars are
unweighted until the speech lands, then your rope visibly shifts (plan
attr ×2.5); premium energy-costing dual-attribute speeches (+BRN & +FRC)
are design space for the story/knowledge pool.

**v2.4.1:** Bar rows are single lines — PRACTICE: label · number · bar ·
rank; MATCHUP: label · away number · tug · home number (ropes no longer
span the screen). Stickers are now universal AND a regression got fixed:
the post-game sticker rendering had silently never landed (an aborted
edit two rounds back), so games showed no card feedback — restored, plus
practice results and recruiting results (NEW / THE CLOUD THINS / ±% 
COMMIT) all stick to their cards until you leave the screen. BACK buttons
removed — the week is strictly forward again. And away weeks open with
THE ROAD: on the way to the matchup a pixel TEAM BUS (kit-colored, flame
out the back) headlines either an uninspiring-travel beat (5 flavors) or
one of the existing voyage/alumni/debt stories — travel no longer fires
on PLAY.

**v2.4.2 (from phone screenshots):** Root cause of the "stats fall off"
found — `.grid` was flex-squeezed and its content painted over whatever
came after it (first bar row, the AWAY @ HOME line). Grid is natural
height now. Lens selector (ABILITIES/STATS/POTENTIAL) shows on TRYOUTS.
Scout sticker says SCOUTED; ability certainty is ?? → XX? → XX (the
two-row range died). Matchup names: planet dropped, both teams render as
kit-colored chips like the header chip, and if the two hues sit within
40° the away chip inverts (bg↔fg). Proper home/away kits (the sprite lab
already defines an away kit) noted as the real future fix.

## NEXT SESSION (pick up here)

0. **HALFTIME (agreed direction):** split the sim into two halves — after
   H1 show the score and who's hot/gassed, allow ONE halftime speech +
   free lineup swaps, then H2. Box score dealt per half. This is the next
   engine swing; today's speech system was shaped so it slots in.

1. **Femme players:** the renderer supports masc/femme (terran has its own
   map + hairstyles; other species have femme edits) but all players
   render masc because every story says "he". Decide: add a form field +
   pronoun pass over the story registry, or keep masc-only.
2. **Thijs playtests v2.2 on phone.** Feel questions: (a) do the animated
   sprites read at card size / does the fire ring pop? (b) mood/energy
   bucket thresholds (20/40/65/85 mood, 15/40/70/90 energy) feel right?
   (c) ON FIRE tuning: 20 to light, 15 to keep, ×1.2 — too strong?
   (d) lens swipe vs card drag on SKILLS; drills-vs-XP balance;
   OVERALL scale (20–40 real range).
2. Balance watch: counter bonus is ±12% power (≈70/30 at equal strength);
   level cap 10 × 2pts + drills + offseason growth vs pot ceilings.
3. Parked as before: species design session (caps are provisional),
   story-writing session, SPEC §17 ideas. SPEC.md still describes the
   v1.0 axis model — rewrite when the v2.0 design settles in playtest.

Workflow reminders: pushing needs `gh auth switch -u Thijsbazelmans`
(default active account is thijs-miketeevee and lacks repo access) — switch
back after. Pages deploys via Actions on every push (~40s); the HTML is
cached 10 min and the phone home-screen shortcut needs a full close/reopen
to pick up a deploy.

## NEXT SESSION: redesign the main screen (v1.2) — DONE, see v1.2–v1.5 above

Thijs's iPhone screenshot of v1.1 tryouts (Aug 16, ~1:06) showed THE FRAME
is right but the CARD is not — it overflows its cell in every direction:

1. **Right overflow**: the energy segbar + mood face spill past the card
   border (faces render ON TOP of the next column's cards). The
   `.pcard-skill` row (skill + stars + ⚡segs + face) is wider than a
   3-per-row card on a real iPhone.
2. **Bottom overflow**: picktag ("TAP TO PICK") + cardtag ("WALK-ON")
   stack below the card bottom and get covered by the next row.
3. **Horizontal page overflow**: the h2 was cut off at the LEFT edge and
   the header win meter at the RIGHT — something forces the page wider
   than the viewport (likely the overflowing cards / intrinsic min-widths).
4. **It still scrolls**: cards have intrinsic min-height ~150pt, so 4 rows
   + tags blow past the middle; the overflow-y safety net kicks in.

The mandate: **a compact player card with a HARD fixed height that can
never overflow its grid cell**, so 3 grid rows + 4th row truly fit a
recent iPhone with zero scroll (design target ~390×660 CSS px, verify
document.scrollWidth === viewport too). Directions to explore WITH Thijs
before coding: what the tile's minimum truthful content is (spec §2.2 says
sprite + dot + SKILL is enough); tags as absolute overlays inside the card
instead of flow elements; stars/meters demoted to the detail card;
`overflow:hidden` on .pcard as a backstop, never as the fix. Sizes must be
budgeted top-down from the frame (header + middle/4 rows + bag + nav =
100dvh), not bottom-up from content.

Everything else carries: engine is solid (headless plays full careers,
~58% win rate, all three endings), deploy pipeline auto-pushes to Pages,
SAVE_VERSION 12. After the main screen: species design + story-writing
sessions remain parked, plus SPEC §17 ideas.

The spec was required to cover:
- the player card in its minimal form (axis dot + SKILL + energy/mood),
- all screens, each answering exactly one question,
- the single color law,
- the bag & item catalog structure,
- 6-team / 10-game season + Universal Tournament flow,
- what carries over from v0.7 (story popups, rig sprites, deploy pipeline)
  and what dies (4-stat columns, LED clutter, most numbers on cards).
Thijs reviews the spec, then the rebuild happens in one coherent swing.
Species redesign (3 tiers, sprite-coded axes) is a SEPARATE future session.

## v0.7 — the Kairosoft turn (phone-first)

- **Stories unfold**: every event is a popup with typewriter text (tap to
  skip), the player's mini-card (OVR/POT · year · POS · mood · energy · XP),
  choices, and the outcome typing out in the SAME popup while the impact
  animates on the card. Last story dismissed → slide straight into Practice.
  No news recap screen.
- **Four stats**: Physical / Mental / Offense / Defense. PHY rides fitness,
  MEN rides mood. Species caps and position math rebuilt on the 4-stat model.
- **XP everywhere**: training (1 player per session, popup flow with progress
  bar) and games grant XP; the bar on each card fills; level-up = the coach
  assigns 1–3 points (breakthrough: 5) to ONE stat via a blocking popup.
  XP needs grow with quality and spike near potential. Base energy 6.
- **Recruiting is the grid**: 9 prospect slots, 3×3. Tap a prospect → woo
  sequence; tap an empty slot → scouting run sequence.
- **Tactics sliders shelved** until the design is figured out.
- **New header**: row 1 team + record + season (big), row 2 coach info in
  gold (⚡ energy, integrity, trophies, legacy) — integrity/legacy/energy
  pulse and float deltas when they change. ⚙ options menu holds NEW GAME +
  version. Whole-screen slide transitions on continue/back.

## v0.6 — the coach's journey

- **Events are blocking popups**: every decision — news events, press
  conference, coach storylines — is a modal over the dimmed roster. You choose
  before the game moves on.
- **Coach skill tree**: you start knowing two training methods (Asteroid
  Pushes, Event-Horizon Shootaround). The other three — and the hidden Deep
  Core scouting region — are unlocked through storyline events: the Blorgon 6
  coaching seminar (2⚡ to attend), the oracle on the uncharted moon, the
  retired scout's star charts. Each is 1–2 questions with good / nothing /
  bad outcomes.
- **Layered scouting**: Home Planet 1⚡ (Terrans, safe, no ship needed —
  it's all a grounded ship can reach) · Local Nebula 2⚡ (Hexabrach F,
  Dodecapede G, Lithoid C; 10% risk) · Outer Rim 3⚡ (Luminars & exotics,
  25% risk) · Deep Core (discoverable; every species, generational talent).
- **Species niches**: hard per-attribute caps. Terrans max ~80 everywhere;
  Lithoids reach 99 STR/TOU but 48 SHO; Dodecapedes 99 AGI; Hexabrachs 99
  HAN; Luminars 99 SHO. Species push positions (obvious when scouting).
- **Position flavors the stat groups**: a guard's Physical is 75% agility, a
  center's 75% strength; forwards split — same lead/power split for
  Technical (HAN/SHO), Defense (FOC/AGG), Mental (IQ/TOU).
- **Prospect board caps at 9** with a DROP button to clear room.
- Fr/So/Jr/Sr labels; tryout pool shows as 3 rows of 4; all stat icons are
  single-color pixel glyphs (dumbbell, brain, sword, shield, bolt) matching
  the pixel smileys.

## v0.5 — game plans, week off, going pro

- **Tactics sliders** on the lineup screen: Pace (slow ⚔️+ ↔ fast 💪+),
  Playbook (freelance 💪+ ↔ run plays 🧠+), Defense (press 💪+ ↔ zone 🛡️+).
  Sliders multiply how much each stat group matters in the sim (±30%); AI
  coaches auto-lean toward their roster's strengths. **Scout the opponent
  (1⚡)** to see the four group bars, yours vs theirs, plus their likely lean.
- **Stat groups on the card**: 💪 Physical (AGI+STR) · 🧠 Mental (IQ+TOU) ·
  ⚔️ Technical (HAN+SHO) · 🛡️ Defense (FOC+AGG), each an LED column with the
  icon at the bottom, lit low-to-high, turning orange when temporarily dragged
  down. Attribute stickers land on their own column. Mood is a pixel-drawn
  outline face (green/yellow/orange/red), not an emoji.
- **Week off** (1⚡): the whole squad recovers; every repeat that season adds
  +25% odds someone finds a crater to lollygag in (2 weeks out).
- **Restaurant busts now hurt recruiting**: a league no-contact order bans
  schmoozing that prospect for 2–3 weeks.
- **Going pro**: at season's end anyone rated 85+ declares, any class year.
  One conversation each — convince odds ride on his mood — before signing day.
- **News shows the player**: every story carries the player's sprite; event
  text and recruiting flavor rotate through variant pools; two new events
  (the viral streamer, the void-pup).

## v0.4.2 — tryouts, gambles, and the LED card

- **Season 1 opens with TRYOUTS**: 6 returning squad members + 6 walk-ons in
  practice grays; pick your 9 before the opener.
- **The week is strictly linear**: News → Training → Recruiting → Lineup.
  Recruiting can't be skipped past — you can spend nothing, but you walk through.
- **News always happens, and it's usually the coach's call.** New gamble
  events roll hidden dice and pay off in a LATER week's news: let a player fly
  home for the High Festival and he might return on crutches, married with
  triplets, reinvigorated, six abs stronger, or — time dilation — with three
  subjective years of shooting practice. (Also: the all-mineral diet of the
  Lithoid monks.)
- **Card v2**: OVR/POT as `56/93` (gold slash = big ceiling), class year
  center-top, race dropped (the sprite says it), mood as an emoji + LED
  column left of the sprite, fitness as ⚡ + LED column right — LEDs light
  low-to-high in red/orange/green/white.
- **Stat stickers**: every floater also leaves a sticker on the card that
  stays until you move to the next screen — miss the animation, keep the news.
- **Names**: single spacified deity names from every tradition — Zeuxx,
  Thorr, Shangox, Kalungaa, Quetzal-4, Raijinn, Ignatiux, Ishtarr, Mauii...

## v0.4.1 — the Modular Baller Rig

Players are now drawn, not described. `src/rig.ts` implements the "Baller Rig"
system from the design doc: one procedural 48×48 front-facing pixel rig; every
sprite is composed from anatomy parameters plus a species chassis — a new race
is a data row, not a drawing job.

- **Size classes** (XS Guard → XL Center) come straight from height/weight, so
  the card shows the body instead of printing cm/kg.
- **Species chassis**: Terrans (2 arms, hair, sneakers), Hexabrachs (4 arms,
  wide 3-eyed head, chitin), Dodecapedes (6 splayed legs, antennae, tail),
  Lithoids (crystal head, craggy rock torso, no shoes — no feet), Luminars
  (no legs; they hover, with a glow-tipped crest).
- **Jerseys render in the team's real colors** — background + letter color —
  with the player's number as a 3×5 pixel bitmap at the chest. Every player
  has a fixed jersey number, unique within his team, shown on card and sprite.
- Seeded per-player variety: 4 skin tints per species, hair styles, goggles,
  headbands, wristbands, and whether he's posing with the ball.
- Unsigned prospects and walk-on tryouts wear a gray practice kit until they
  put on your colors.

The sprite is the centerpiece of the card; the full numbers live one click
deeper in the detail panel.

## v0.4 — a story, not a dashboard

**The persistent shell.** Every weekly screen is the same stage: the header
(team chip in team colors, record, week, integrity/trophies/legacy, and a big
⚡ energy row) stays put; the 3×3 player grid (STARTERS / BENCH / RESERVES —
it IS the lineup board) stays put; Back/Continue live in a fixed nav bar.
Only the stage panel between them changes — swiping in from the right going
forward, from the left going back.

**Team identity**: every program has a Letters color and a Background color,
deliberately varied (only two programs are blue). Chips wear these colors
everywhere: header, standings, matchup banners, brackets.

**The season**: double round robin (14 weeks), then ALL 8 teams enter the
seeded galactic tournament — quarterfinals, semifinals, the Galactic Final.
The tournament decides the champion; the regular season decides the seeds.

**Energy returns**: 3⚡ per week. A training session (one type, mark 3 players
on the grid) costs 1⚡; a schmooze or a scan costs 1⚡. Spend all three on
either side or mix. The **press conference** in the news phase awards +1⚡ for
correctly answering a question about last week's games.

**Games change players** (idle-clicker DNA): starters earn XP (+2 attribute
points/game), bench +1, unused reserves risk RUST (−1). After the final horn,
the grid animates the consequences card by card — fitness cost, mood swings,
XP gains — as rising floaters. Training gains (now +2–4 per attribute,
breakthroughs bigger) and news-event fallout animate the same way.

## v0.3 — cards, positions, one decision per screen

**The card is the unit of the game.** Every player is a repeatable card: big
OVR number, preferred-position badge, species/year/body, mood face
(`:)` green 75+, `:|` yellow 50–75, `:(` orange 25–50, `>:(` red <25) and a
fitness gas gauge. Click any card for the full attribute sheet. Player images
come with the pixel-art pass; the layout is built to receive them.

**Preferred position, not per-slot weighting.** Every player IS a G, F, or C
(derived from build + skills at creation). Play him next door and he performs
at −20%; play a guard at center (or vice versa) and it's −50%. The lineup
screen shows the penalty on the card in red. Lineup = drag cards between
starter slots, bench slots, and the reserve shelf.

**No energy — one action per screen per week:**

- **Training:** pick ONE session type, drag up to 3 players into the pods,
  watch the little scene play, collect randomized gains (with rare
  breakthroughs). Asteroid Pushes (STR+TOU), Laser Dodging (AGI+FOC),
  Event-Horizon Shootaround (SHO+HAN), Holo-Film Study (IQ+FOC), Mascot
  Sparring (AGG+TOU). Training costs fitness.
- **Recruiting:** EITHER schmooze one known prospect — Dinner at the
  Restaurant at the End of the Galaxy (+20–30%, 25% risk the league snoops
  catch you: integrity hit), a night at the Kappa Kappa Nebula house
  (+12–22%, 20% risk of a brawl over someone's cheerleader girlfriend:
  −20% commitment), or the safe campus tour (+6–12%) — OR scan for new
  prospects: Earth (safe, average Terrans) or the Outskirts (exotic species,
  25% risk your ship is grounded for the rest of the season).

Signing day and the pick-9-of-12 team selection carry over from v0.2.

## v0.2 — the player model and the sequential week

Game presentation: no play-by-play (watching was skippable filler — in-game
interaction is a later-stage feature). A game is a short progress-bar beat,
then a result with box score.

**Players.** 4 stats, each of 2 parts (8 attributes total):

- Physical: Agility / Strength
- Technical: Handling / Shooting
- Defense: Focus / Aggression
- Mental: IQ / Toughness

Plus **height & weight**, which cap the physical pair (very tall → lower
agility ceiling; very light → lower strength ceiling), and two constantly
moving meters: **Fitness** (drags/boosts strength & agility) and **Mood**
(drags/boosts focus & IQ). Events move all of it — injuries cost strength,
worried players lose weight, miserable ones binge-eat their agility away.
Click any player for the full card; everywhere else you see a star rating.

**Positions.** G / F / C slots. Anyone can play anywhere, but the star rating
is position-weighted: G leans agility/handling/shooting/focus/IQ, F weighs
everything evenly, C leans strength/aggression/toughness and ignores the
technical pair. Lineup = 3 starters + 3 bench + 3 reserves. Starters burn the
most fitness, bench less, reserves none — rotation is forced.

**The week is sequential**, one decision screen at a time:

1. **News** — this week's events, some demanding a moral choice
2. **Training** — spend energy; each attribute trainable once per player per
   week; training costs fitness
3. **Scouting** — spend energy to find new prospects OR woo known ones,
   building a per-prospect commitment % week by week (it decays if ignored)
4. **Lineup** — set the G/F/C starters and bench
5. **Game** — progress bar → result

**Offseason.** Signing day: your built-up percentages are what you harvest;
signing letters beyond the first cost −10 (2nd), −25 (3rd), −45 (4th)...
Then **team selection**: pick your 9 from returners + signees + walk-ons
(walk-ons are usually what they look like — every now and then, a GEM).

### Not in v0 (parked, on purpose)

In-game interaction during matches, tactics system, staff, budget/business
layer, stadium building, editable names, full 60+ team D1 galaxy map with
regions, program-identity system (prison camp ↔ commune), pixel art, sound.
