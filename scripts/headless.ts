// Headless auto-coach: plays full careers to the tombstone.
// Run: npx tsx scripts/headless.ts [careers]
// Definition of done (SPEC §16): survives full careers without error and
// reports skill curves, UT reach, ending causes, and energy starvation.

import { GYM_REQ, PLANS, facLevel } from '../src/engine/data';
import { LEVEL_CAP, ROSTER_SIZE, newGameState } from '../src/engine/gen';
import { arrangeRow, floorAvg, meterMult, normalizeLineup } from '../src/engine/sim';
import { ATTRS, bestAttr, opTracks, ovr, security } from '../src/engine/util';
import {
  actionGalaxy,
  beginWeek,
  chooseTeam,
  confirmBoard,
  continueFromResult,
  currentStory,
  deliverSpeech,
  dismissStory,
  finalizeRoster,
  grabMop,
  isUtWeek,
  letGoPro,
  myTeam,
  playGame,
  releaseHeldStories,
  releaseMidStories,
  resolveSigning,
  resolveStory,
  retire,
  runDrill,
  speechCooldown,
  toPractice,
  toRecruiting,
  toMatchup,
  toScouting,
  toSigning,
  toggleProspect,
  upgradeFacility,
  wipeCodex,
} from '../src/engine/state';
import type { FacId, GameState, PlanId } from '../src/engine/types';

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
  const o = opTracks(s);
  for (const [k, v] of Object.entries(o)) if (v < 0 || v > 100) throw new Error(`opinion ${k} broken: ${v}`);
  const sec = security(s);
  if (sec < 0 || sec > 100) throw new Error(`security broken: ${sec}`);
  if (s.bag.length > 9) throw new Error(`bag overflow: ${s.bag.length}`);
  for (const p of t.players) {
    // species caps are DEAD — the 0–25 scale and level 10 are the only walls
    for (const a of ATTRS) {
      if (p.attrs[a] < 0 || p.attrs[a] > 25) throw new Error(`attr ${a} broken for ${p.name}: ${p.attrs[a]}`);
      if (p.pots[a] < p.attrs[a] || p.pots[a] > 25) throw new Error(`pot ${a} broken for ${p.name}: ${p.attrs[a]}/${p.pots[a]}`);
    }
    if (ovr(p.attrs) > 100) throw new Error(`overall broken for ${p.name}: ${ovr(p.attrs)}`);
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
  /** JOB SECURITY telemetry: the career's lowest gauge reading, and how many
      weeks it spent in the ultimatum zone (< 30) */
  minSec: number;
  hotWeeks: number;
}

function playCareer(idx: number): CareerStats {
  // Node ships a localStorage now, so THE CODEX would snowball across the
  // careers of one run — benchmark FRESH coaches unless CODEX=1 says
  // otherwise (the veteran-run curve is its own experiment)
  if (!process.env.CODEX) wipeCodex();
  const s = newGameState();
  chooseTeam(s, idx % s.teams.length);
  let starved = 0;
  let utReached = 0;
  let lastWeekKey = '';
  let minSec = 100;
  let hotWeeks = 0;

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
          // each row stood where it grades best (the column reads the numbers)
          const trio = arrangeRow(nine.slice(r * 3, r * 3 + 3));
          ids.push(...trio.map((p) => p!.id));
        }
        if (!finalizeRoster(s, ids)) throw new Error('finalizeRoster failed');
        break;
      }
      case 'weekstart': {
        drainQueue(s); // the ride home, if any
        if (s.phase === 'weekstart') beginWeek(s);
        if (s.phase === 'weekstart') throw new Error('stuck at week start');
        break;
      }
      case 'stories':
        drainQueue(s);
        break;
      case 'facilities': {
        drainQueue(s);
        if ((s.phase as string) !== 'facilities') break;
        // ONE campus move a week now: try an upgrade when rich and lucky,
        // otherwise the mop is the free floor
        if (s.energy >= 6 && Math.random() < 0.35) {
          const ids: FacId[] = ['ship', 'gym', 'cryo', 'library', 'stadium', 'greekrow'];
          for (let i = 0; i < 6 && !s.facActWk; i++) upgradeFacility(s, ids[Math.floor(Math.random() * ids.length)]);
        }
        if (!s.facActWk) grabMop(s);
        drainQueue(s);
        toScouting(s);
        if ((s.phase as string) === 'facilities' && !s.queue.length) throw new Error('stuck at facilities');
        break;
      }
      case 'scouting': {
        drainQueue(s);
        if (s.phase !== 'scouting') break;
        const key = `${s.season}:${s.week}`;
        if (key !== lastWeekKey) {
          lastWeekKey = key;
          if (s.energy === 0) starved++;
          const sec = security(s);
          minSec = Math.min(minSec, sec);
          if (sec < 30) hotWeeks++;
        }
        if (!s.scoutActWk) {
          // the intel move — the ship's range, cooldowns and the purse all
          // gate options now, so walk a preference list to the first that fires
          const prefs = s.prospects.length < 6 ? ['nebula', 'home', 'reccenter'] : ['roadtrip', 'filmnight', 'reccenter'];
          let done = false;
          for (const actId of prefs) {
            if ((s.actCooldowns?.[actId] ?? 0) > 0) continue;
            if (actionGalaxy(s, actId)) { done = true; break; }
          }
          if (!done && !actionGalaxy(s, 'reccenter')) throw new Error(`scouting action refused (¢${s.energy})`);
          if (s.pendingRecruits.length) confirmBoard(s);
          drainQueue(s);
        }
        if (s.phase === 'scouting') toPractice(s);
        if (s.phase === 'scouting' && !s.queue.length) throw new Error('stuck at scouting');
        break;
      }
      case 'practice': {
        drainQueue(s);
        if (s.phase !== 'practice') break;
        if (!s.trainedThisWeek) {
          // practice is mandatory: rest tired or broke squads, otherwise train
          const t = myTeam(s);
          const tired = t.players.filter((p) => p.energy < 40).length;
          const adv = ['meteor', 'asteroid', 'sparring', 'filmroom', 'dreamlab']
            .filter((d) => s.unlockedDrills.includes(d) && (s.actCooldowns?.[d] ?? 0) === 0 && facLevel(s, 'gym') >= (GYM_REQ[d] ?? 2));
          if (tired >= 4 || s.energy < 1) runDrill(s, 'rest');
          else if (adv.length && s.energy >= 4 && Math.random() < 0.5) runDrill(s, adv[Math.floor(Math.random() * adv.length)]);
          else runDrill(s, 'shootaround');
          if (!s.trainedThisWeek) runDrill(s, 'shootaround'); // gym-gated pick fell through
          if (!s.trainedThisWeek) runDrill(s, 'rest');
          if (!s.trainedThisWeek) throw new Error('mandatory practice failed');
          drainQueue(s);
        }
        if (s.phase === 'practice') toRecruiting(s);
        if (s.phase === 'practice' && !s.queue.length) throw new Error('stuck at practice');
        break;
      }
      case 'recruiting': {
        drainQueue(s);
        if (s.phase !== 'recruiting') break;
        if (!s.recruitActWk) {
          // the charm move — Greek Row gates the fancy stuff, so walk the list
          const prefs = s.energy >= 3 && Math.random() < 0.3
            ? ['skybox', 'openhouse', 'letters', 'groupchat']
            : ['openhouse', 'letters', 'groupchat'];
          let done = false;
          for (const actId of prefs) {
            if ((s.actCooldowns?.[actId] ?? 0) > 0) continue;
            if (actionGalaxy(s, actId)) { done = true; break; }
          }
          if (!done && !actionGalaxy(s, 'groupchat')) throw new Error(`recruiting action refused (¢${s.energy})`);
          drainQueue(s);
        }
        if (s.phase === 'recruiting') toMatchup(s);
        if (s.phase === 'recruiting' && !s.queue.length) throw new Error('stuck at recruiting');
        break;
      }
      case 'matchup': {
        drainQueue(s);
        if (s.phase !== 'matchup') break;
        const t = myTeam(s);
        // ROTATE: rows by condition-weighted rating (tired/angry stars sit),
        // columns by size — the baseline-75 economy punishes a static lineup
        const cond = (p: import('../src/engine/types').Player): number =>
          ovr(p.attrs) * meterMult(p.energy) * meterMult(p.mood);
        const fit = t.players.filter((p) => p.outWeeks === 0).sort((a, b) => cond(b) - cond(a));
        // the frozen one was promised the floor: he takes a bench seat
        const promised = s.promise ? fit.find((p) => p.id === s.promise!.playerId) : undefined;
        if (promised && fit.indexOf(promised) >= 6) {
          fit.splice(fit.indexOf(promised), 1);
          fit.splice(5, 0, promised);
        }
        const slots: (number | null)[] = Array.from({ length: 9 }, () => null);
        [fit.slice(0, 3), fit.slice(3, 6), fit.slice(6, 9)].forEach((trio, r) => {
          arrangeRow(trio).forEach((p, c) => { slots[r * 3 + c] = p?.id ?? null; });
        });
        t.lineup.slots = slots;
        normalizeLineup(t);
        if (!s.pregameWk) {
          const known = PLANS.filter((pl) => s.knownPlans.includes(pl.id) && speechCooldown(s, pl.id) === 0);
          // speak to the squad's strongest attribute: the shift takes from its weak side
          const sums = { skl: 0, ath: 0, frc: 0, brn: 0 };
          for (const p of t.players) for (const a of ATTRS) sums[a] += p.attrs[a];
          const targetAttr = bestAttr(sums);
          const best: PlanId = (known.find((pl) => pl.attr === targetAttr) ?? known[0]).id;
          if (deliverSpeech(s, best) === null) throw new Error('speech refused');
        }
        if (isUtWeek(s)) utReached = Math.max(utReached, 1);
        playGame(s); // false = the frozen one knocked; the loop drains him and comes back
        break;
      }
      case 'gamenight': {
        drainQueue(s); // the instruction's verdict, if any
        if ((s.phase as string) === 'gameover') break;
        if (!s.lastResult) break; // sim fires when the queue clears
        // the half: the night's interruptions get the floor, then the horn
        if (s.midStories?.length) { releaseMidStories(s); drainQueue(s); }
        if (s.gamePending) throw new Error('the game never finalized');
        if (s.lastResult.myScore === s.lastResult.oppScore) throw new Error('the game ended tied');
        if (!s.lastResult.box.length) throw new Error('box score missing');
        if (s.queue.length) throw new Error('a story butted into the live game');
        if (process.env.LADDER && s.week === 10) {
          // THE SLIDE, season by season: my six on the floor vs the conference
          const t = myTeam(s);
          const ladder = s.teams.map((tm) => `${tm.id === s.myTeamId ? '*' : ''}${Math.round(floorAvg(tm))}`).join(' ');
          const o2 = opTracks(s);
          console.log(`  S${s.season} ${t.wins}–${t.losses} floor ${ladder} · sec ${security(s)} (S${o2.school}/F${o2.fans}/P${o2.players}/X${o2.pub})`);
        }
        releaseHeldStories(s); // the box score press
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
    minSec,
    hotWeeks,
  };
}

const all: CareerStats[] = [];
for (let i = 0; i < CAREERS; i++) {
  const st = playCareer(i);
  all.push(st);
  console.log(
    `career ${i + 1}: ${st.ending} after ${st.seasons} seasons · ${st.wins} wins · UT titles ${st.utTitles} · legacy ${st.legacy} · starved weeks ${st.starvedWeeks} · sec floor ${st.minSec} (${st.hotWeeks}w hot)`
  );
}

const endings = all.reduce<Record<string, number>>((a, c) => ({ ...a, [c.ending]: (a[c.ending] ?? 0) + 1 }), {});
console.log('---');
console.log(`OK: ${CAREERS} careers complete.`);
console.log(`endings: ${JSON.stringify(endings)}`);
console.log(`avg seasons ${(all.reduce((a, c) => a + c.seasons, 0) / CAREERS).toFixed(1)} · avg wins ${(all.reduce((a, c) => a + c.wins, 0) / CAREERS).toFixed(1)} · UT reach ${all.filter((c) => c.utReached).length}/${CAREERS} · titles ${all.reduce((a, c) => a + c.utTitles, 0)}`);
console.log(`security: avg floor ${(all.reduce((a, c) => a + c.minSec, 0) / CAREERS).toFixed(0)} · careers under 30 at some point ${all.filter((c) => c.minSec < 30).length}/${CAREERS} · total hot weeks ${all.reduce((a, c) => a + c.hotWeeks, 0)}`);
