// Headless auto-coach: plays full careers to the tombstone.
// Run: npx tsx scripts/headless.ts [careers]
// Definition of done (SPEC §16): survives full careers without error and
// reports skill curves, UT reach, ending causes, and energy starvation.

import { PLANS, speciesById } from '../src/engine/data';
import { LEVEL_CAP, ROSTER_SIZE, newGameState } from '../src/engine/gen';
import { ATTRS, bestAttr, ovr, sizeIndex } from '../src/engine/util';
import {
  actionGalaxy,
  chooseTeam,
  confirmBoard,
  continueFromResult,
  currentStory,
  deliverHalftimeSpeech,
  deliverSpeech,
  dismissStory,
  finalizeRoster,
  isUtWeek,
  letGoPro,
  myTeam,
  playGame,
  playSecondHalf,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  toGalaxy,
  toMatchup,
  toSigning,
  toggleProspect,
} from '../src/engine/state';
import type { GameState, PlanId } from '../src/engine/types';

const CAREERS = Number(process.argv[2] ?? 3);
const MAX_SEASONS = Number(process.env.MAX_SEASONS ?? 26); // retire here if still alive (aging bites from 21)

function drainQueue(s: GameState): void {
  let guard = 0;
  while (currentStory(s) && guard++ < 300) {
    const ev = currentStory(s)!;
    if (ev.choices?.length) {
      const affordable = ev.choices.filter((c) => !c.disabled && !c.itemId && (!c.cost || c.cost <= s.energy));
      const c = affordable.length ? affordable[Math.floor(Math.random() * affordable.length)] : ev.choices[0];
      resolveStory(s, c.key);
    } else {
      resolveStory(s, 'ok');
    }
    if (currentStory(s) === ev) dismissStory(s);
  }
  if (guard >= 300) throw new Error('queue never drained');
}

function checkInvariants(s: GameState): void {
  const t = myTeam(s);
  if (t.players.length > ROSTER_SIZE) throw new Error(`roster too big: ${t.players.length}`);
  if (s.energy < 0 || s.energy > 12) throw new Error(`cache out of range: ${s.energy}`);
  if (s.heatS < 0 || s.heatB < 0 || s.heatS + s.heatB > 100) throw new Error(`hot seat broken: ${s.heatS}/${s.heatB}`);
  if (s.bag.length > 5) throw new Error(`bag overflow: ${s.bag.length}`);
  for (const p of t.players) {
    const caps = speciesById(p.speciesId).attrCaps;
    for (const a of ATTRS) {
      if (p.attrs[a] < 0 || p.attrs[a] > 25 || p.attrs[a] > caps[a]) throw new Error(`attr ${a} broken for ${p.name}: ${p.attrs[a]} (cap ${caps[a]})`);
      if (p.pots[a] < p.attrs[a] || p.pots[a] > caps[a]) throw new Error(`pot ${a} broken for ${p.name}: ${p.attrs[a]}/${p.pots[a]} (cap ${caps[a]})`);
    }
    if (ovr(p.attrs) > 99) throw new Error(`overall broken for ${p.name}: ${ovr(p.attrs)}`);
    if (p.stats.gp < 0 || p.stats.pts < 0) throw new Error(`stats broken for ${p.name}`);
    if (p.level > LEVEL_CAP) throw new Error(`level overflow ${p.name}`);
    if (p.energy < 0 || p.energy > 100 || p.mood < 0 || p.mood > 100) throw new Error(`meters broken for ${p.name}`);
  }
}

interface CareerStats {
  seasons: number;
  wins: number;
  utReached: number;
  utTitles: number;
  legacy: number;
  ending: string;
  starvedWeeks: number;
}

function playCareer(idx: number): CareerStats {
  const s = newGameState();
  chooseTeam(s, idx % s.teams.length);
  let starved = 0;
  let utReached = 0;
  let lastWeekKey = '';

  for (let guard = 0; guard < 30000; guard++) {
    if (s.phase === 'gameover') break;
    checkInvariants(s);
    switch (s.phase) {
      case 'teamSelect': {
        // best nine — arranged like a coach: rows by rating, columns by size
        // (the selection grid IS the opening lineup now)
        const nine = [...s.selectPool].sort((a, b) => ovr(b.attrs) + ovr(b.pots) - (ovr(a.attrs) + ovr(a.pots))).slice(0, ROSTER_SIZE);
        const ids: number[] = [];
        for (let r = 0; r < 3; r++) {
          const trio = nine.slice(r * 3, r * 3 + 3).sort((a, b) => sizeIndex(a) - sizeIndex(b)); // small→backcourt … big→frontcourt
          ids.push(...trio.map((p) => p.id));
        }
        if (!finalizeRoster(s, ids)) throw new Error('finalizeRoster failed');
        break;
      }
      case 'stories':
        drainQueue(s);
        break;
      case 'practice': {
        drainQueue(s);
        if (s.phase !== 'practice') break;
        const key = `${s.season}:${s.week}`;
        if (key !== lastWeekKey) {
          lastWeekKey = key;
          if (s.energy === 0) starved++;
        }
        if (!s.trainedThisWeek) {
          // practice is mandatory: rest tired or broke squads, otherwise train
          const t = myTeam(s);
          const tired = t.players.filter((p) => p.energy < 40).length;
          const adv = ['meteor', 'asteroid', 'sparring', 'filmroom', 'dreamlab'].filter((d) => s.unlockedDrills.includes(d));
          if (tired >= 4 || s.energy < 1) runDrill(s, 'rest');
          else if (adv.length && s.energy >= 4 && Math.random() < 0.5) runDrill(s, adv[Math.floor(Math.random() * adv.length)]);
          else runDrill(s, 'shootaround');
          if (!s.trainedThisWeek) throw new Error('mandatory practice failed');
          drainQueue(s);
        }
        if (s.phase === 'practice') toGalaxy(s);
        if (s.phase === 'practice' && !s.queue.length) throw new Error('stuck at practice');
        break;
      }
      case 'galaxy': {
        drainQueue(s);
        if (s.phase !== 'galaxy') break;
        if (!s.galaxyActWk) {
          // one mandatory board-wide move: scout the first weeks, then work
          // the board every week; rec center when broke
          const actId = s.energy < 1
            ? 'reccenter'
            : s.week <= 2
              ? s.energy >= 2 ? 'roadtrip' : 'filmnight'
              : s.energy >= 2 ? 'openhouse' : 'letters';
          if (!actionGalaxy(s, actId)) throw new Error(`galaxy action refused: ${actId} (⚡${s.energy})`);
          if (s.pendingRecruits.length) confirmBoard(s);
          drainQueue(s);
        }
        if (s.phase === 'galaxy') toMatchup(s);
        if (s.phase === 'galaxy' && !s.queue.length) throw new Error('stuck at galaxy');
        break;
      }
      case 'matchup': {
        drainQueue(s);
        if (s.phase !== 'matchup') break;
        const t = myTeam(s);
        const known = PLANS.filter((pl) => s.knownPlans.includes(pl.id));
        // speak to the squad's strongest attribute (best odds of a useful ignition)
        const sums = { skl: 0, ath: 0, frc: 0, brn: 0 };
        for (const p of t.players) for (const a of ATTRS) sums[a] += p.attrs[a];
        const targetAttr = bestAttr(sums);
        const best: PlanId = (known.find((pl) => pl.attr === targetAttr) ?? known[0]).id;
        if (deliverSpeech(s, best) === null) throw new Error('speech refused');
        if (isUtWeek(s)) utReached = Math.max(utReached, 1);
        playGame(s);
        break;
      }
      case 'gamenight': {
        drainQueue(s);
        if ((s.phase as string) === 'gameover') break;
        // HALFTIME: swap nothing, speech again, play on
        if (s.halftime && !s.lastResult) {
          const known = PLANS.filter((pl) => s.knownPlans.includes(pl.id));
          const best = known[Math.floor(Math.random() * known.length)].id;
          if (deliverHalftimeSpeech(s, best) === null) throw new Error('halftime speech refused');
          playSecondHalf(s);
          const r = s.lastResult as import('../src/engine/types').MyGameResult | null;
          if (!r || !r.h1 || !r.h2) throw new Error('halves missing from result');
          // the tie-break possession can add 1 to one side
          if (Math.abs(r.h1.my + r.h2.my - r.myScore) > 1 || Math.abs(r.h1.opp + r.h2.opp - r.oppScore) > 1) {
            throw new Error(`halves don't sum: ${r.h1.my}+${r.h2.my}≠${r.myScore}`);
          }
          if (r.myScore === r.oppScore) throw new Error('the game ended tied');
          break;
        }
        if (!s.lastResult) break; // sim fires when the queue clears
        drainQueue(s);
        if ((s.phase as string) !== 'gamenight') break;
        continueFromResult(s);
        break;
      }
      case 'departures': {
        drainQueue(s);
        if ((s.phase as string) !== 'departures') break;
        for (const d of s.proDeparts.filter((x) => !x.resolved)) letGoPro(s, d.playerId);
        if (s.season >= MAX_SEASONS) { retire(s); break; }
        toSigning(s);
        break;
      }
      case 'signing': {
        for (const pr of [...s.prospects].sort((a, b) => b.commitPct - a.commitPct).slice(0, 4)) toggleProspect(s, pr.id);
        resolveSigning(s);
        drainQueue(s);
        break;
      }
      default:
        throw new Error(`unexpected phase ${s.phase}`);
    }
    if (guard === 29999) throw new Error(`career never ended (phase ${s.phase}, season ${s.season})`);
  }

  return {
    seasons: s.season,
    wins: s.totalWins,
    utReached: s.utTitles > 0 ? 1 : utReached,
    utTitles: s.utTitles,
    legacy: s.legacy,
    ending: s.end?.cause ?? '???',
    starvedWeeks: starved,
  };
}

const all: CareerStats[] = [];
for (let i = 0; i < CAREERS; i++) {
  const st = playCareer(i);
  all.push(st);
  console.log(
    `career ${i + 1}: ${st.ending} after ${st.seasons} seasons · ${st.wins} wins · UT titles ${st.utTitles} · legacy ${st.legacy} · starved weeks ${st.starvedWeeks}`
  );
}

const endings = all.reduce<Record<string, number>>((a, c) => ({ ...a, [c.ending]: (a[c.ending] ?? 0) + 1 }), {});
console.log('---');
console.log(`OK: ${CAREERS} careers complete.`);
console.log(`endings: ${JSON.stringify(endings)}`);
console.log(`avg seasons ${(all.reduce((a, c) => a + c.seasons, 0) / CAREERS).toFixed(1)} · avg wins ${(all.reduce((a, c) => a + c.wins, 0) / CAREERS).toFixed(1)} · UT reach ${all.filter((c) => c.utReached).length}/${CAREERS} · titles ${all.reduce((a, c) => a + c.utTitles, 0)}`);
