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

## NEXT SESSION: redesign the main screen (v1.2)

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
