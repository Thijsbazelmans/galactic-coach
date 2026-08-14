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
