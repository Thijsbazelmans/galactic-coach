// Headless auto-coach: plays full careers to the tombstone.
// Run: npx tsx scripts/headless.ts [careers]
// Definition of done (SPEC §16): survives full careers without error and
// reports skill curves, UT reach, ending causes, and energy starvation.

import { PLANS, speciesById } from '../src/engine/data';
import { LEVEL_CAP, ROSTER_SIZE, newGameState } from '../src/engine/gen';
import { teamPower } from '../src/engine/sim';
import { ATTRS, ovr } from '../src/engine/util';
import {
  actionProspect,
  actionScan,
  chooseTeam,
  continueFromResult,
  currentStory,
  dismissStory,
  finalizeRoster,
  isUtWeek,
  letGoPro,
  myTeam,
  playGame,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  setPlan,
  startNewSeason,
  toGalaxy,
  toMatchup,
  toSigning,
  toggleProspect,
} from '../src/engine/state';
import type { GameState } from '../src/engine/types';

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
        const ids = [...s.selectPool].sort((a, b) => ovr(b.attrs) + ovr(b.pots) - (ovr(a.attrs) + ovr(a.pots))).slice(0, ROSTER_SIZE).map((p) => p.id);
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
          // rest tired squads, otherwise train by budget
          const t = myTeam(s);
          const tired = t.players.filter((p) => p.energy < 40).length;
          const adv = ['meteor', 'asteroid', 'sparring', 'filmroom'].filter((d) => s.unlockedDrills.includes(d));
          if (tired >= 4) runDrill(s, 'rest');
          else if (adv.length && s.energy >= 4 && Math.random() < 0.5) runDrill(s, adv[Math.floor(Math.random() * adv.length)]);
          else runDrill(s, 'shootaround');
          drainQueue(s);
        }
        if (s.phase === 'practice') toGalaxy(s);
        break;
      }
      case 'galaxy': {
        drainQueue(s);
        if (s.phase !== 'galaxy') break;
        if (s.prospects.length < 4 && s.energy >= 2) {
          actionScan(s, s.groundedWeeks > 0 ? 'home' : Math.random() < 0.5 ? 'nebula' : 'home');
          drainQueue(s);
        } else if (s.prospects.length && s.energy >= 1) {
          const target = [...s.prospects].sort((a, b) => ovr(b.seenPots) - ovr(a.seenPots))[0];
          actionProspect(s, target.id, target.scoutLevel < 1 ? 'attend' : 'tour');
          drainQueue(s);
        }
        if (s.phase === 'galaxy') toMatchup(s);
        break;
      }
      case 'matchup': {
        drainQueue(s);
        if (s.phase !== 'matchup') break;
        const t = myTeam(s);
        const known = PLANS.filter((pl) => s.knownPlans.includes(pl.id));
        const best = known.reduce((b, pl) => (teamPower(t, pl.id) > teamPower(t, b) ? pl.id : b), known[0].id);
        setPlan(s, best);
        if (isUtWeek(s)) utReached = Math.max(utReached, 1);
        playGame(s);
        break;
      }
      case 'gamenight': {
        drainQueue(s);
        if ((s.phase as string) === 'gameover') break;
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
        for (const pr of [...s.prospects].sort((a, b) => b.commitPct - a.commitPct).slice(0, 2)) toggleProspect(s, pr.id);
        resolveSigning(s);
        break;
      }
      case 'growth':
        startNewSeason(s);
        break;
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
