// Headless smoke test: plays 3 full seasons with a simple auto-coach.
// Run with: npx tsx scripts/headless.ts

import { ROSTER_SIZE, newGameState } from '../src/engine/gen';
import { overall } from '../src/engine/sim';
import {
  actionScan,
  actionSchmooze,
  actionTrainSession,
  answerPress,
  chooseTeam,
  continueFromResult,
  finalizeRoster,
  myTeam,
  playGame,
  resolveNews,
  resolveSigning,
  toLineup,
  toScouting,
  toTraining,
  toggleProspect,
} from '../src/engine/state';

const s = newGameState();
chooseTeam(s, 0);

let scanCount = 0;
let schmoozeCount = 0;

for (let guard = 0; guard < 2000 && s.season <= 3; guard++) {
  switch (s.phase) {
    case 'news': {
      if (s.press && !s.press.answered) answerPress(s, Math.floor(Math.random() * s.press.options.length));
      s.news.forEach((n, i) => {
        if (n.choices && !n.resolvedText) resolveNews(s, i, Math.floor(Math.random() * n.choices.length));
      });
      toTraining(s);
      break;
    }
    case 'training': {
      const squad = myTeam(s).players.filter((p) => p.outWeeks === 0).slice(0, 3).map((p) => p.id);
      const types = ['asteroid', 'laser', 'horizon', 'holofilm', 'mascot'];
      actionTrainSession(s, types[Math.floor(Math.random() * types.length)], squad);
      toScouting(s);
      break;
    }
    case 'scouting': {
      if (s.prospects.length < 3) {
        if (actionScan(s, s.shipDamaged ? 'home' : Math.random() < 0.5 ? 'nebula' : 'outerrim')) scanCount++;
      } else if (s.prospects.length) {
        const target = [...s.prospects].sort((a, b) => b.commitPct - a.commitPct)[0];
        const methods = ['dinner', 'sorority', 'tour'];
        if (actionSchmooze(s, target.id, methods[Math.floor(Math.random() * methods.length)])) schmoozeCount++;
      }
      toLineup(s);
      break;
    }
    case 'lineup':
      playGame(s);
      break;
    case 'result':
      continueFromResult(s);
      break;
    case 'recruiting': {
      for (const pr of [...s.prospects].sort((a, b) => b.commitPct - a.commitPct).slice(0, 2)) {
        toggleProspect(s, pr.id);
      }
      resolveSigning(s);
      console.log(`  season ${s.season}: ${s.signingResults.join(' | ')}`);
      break;
    }
    case 'teamSelect': {
      const ids = [...s.selectPool]
        .sort((a, b) => overall(b) - overall(a))
        .slice(0, ROSTER_SIZE)
        .map((p) => p.id);
      if (!finalizeRoster(s, ids)) throw new Error('finalizeRoster failed');
      break;
    }
    default:
      throw new Error(`unexpected phase ${s.phase}`);
  }
}

// invariants
const t = myTeam(s);
if (t.players.length !== ROSTER_SIZE) throw new Error(`bad roster size ${t.players.length}`);
if (t.players.some((p) => p.classYear > 3)) throw new Error('player failed to graduate');
if (s.integrity < 0 || s.integrity > 100) throw new Error(`integrity out of range: ${s.integrity}`);
for (const p of t.players) {
  if (p.fitness < 0 || p.fitness > 100 || p.mood < 0 || p.mood > 100) {
    throw new Error(`fitness/mood out of range for ${p.name}: fit=${p.fitness} mood=${p.mood}`);
  }
  if (p.attrs.agi > 99 || p.attrs.str > 99) throw new Error(`attr overflow for ${p.name}`);
}
for (const team of s.teams) {
  if (team.players.length < 3) throw new Error(`team ${team.name} under-rostered`);
}
const posCounts = { G: 0, F: 0, C: 0 };
for (const team of s.teams) for (const p of team.players) posCounts[p.pos]++;

console.log(`OK: reached season ${s.season}, week ${s.week}, phase ${s.phase}`);
console.log(`  wins=${s.totalWins} integrity=${s.integrity} trophies=${s.trophies} scans=${scanCount} schmoozes=${schmoozeCount} shipDamaged=${s.shipDamaged}`);
console.log(`  league position mix: G=${posCounts.G} F=${posCounts.F} C=${posCounts.C}`);
console.log(
  `  roster: ${t.players
    .map((p) => `${p.name} [${p.speciesId} yr${p.classYear} ${p.pos} ${overall(p)} fit${p.fitness} mood${p.mood}${p.gem ? ' GEM' : p.walkOn ? ' walk-on' : ''}]`)
    .join('; ')}`
);
