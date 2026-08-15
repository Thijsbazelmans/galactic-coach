// Headless smoke test: plays 3 full seasons with a simple auto-coach.
// Run with: npx tsx scripts/headless.ts

import { ROSTER_SIZE, STAT_KEYS, newGameState } from '../src/engine/gen';
import { overall } from '../src/engine/sim';
import {
  actionScan,
  actionSchmooze,
  actionTrain,
  answerPress,
  assignStatPoints,
  chooseTeam,
  continueFromResult,
  finalizeRoster,
  myTeam,
  pendingLevelUps,
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

function assignAll(): void {
  for (const p of pendingLevelUps(s)) {
    while (p.pendingPoints.length) {
      assignStatPoints(s, p.id, STAT_KEYS[Math.floor(Math.random() * 4)]);
    }
  }
}

let trained = 0;
for (let guard = 0; guard < 3000 && s.season <= 3; guard++) {
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
      // spend a few energy training random available players
      for (let i = 0; i < 3; i++) {
        const avail = myTeam(s).players.filter((p) => p.outWeeks === 0);
        if (!avail.length) break;
        const p = avail[Math.floor(Math.random() * avail.length)];
        if (actionTrain(s, Math.random() < 0.5 ? 'asteroid' : 'horizon', p.id) !== null) trained++;
      }
      assignAll();
      toScouting(s);
      break;
    }
    case 'scouting': {
      if (s.prospects.length < 3) {
        actionScan(s, s.shipDamaged ? 'home' : Math.random() < 0.5 ? 'nebula' : 'home');
      } else if (s.prospects.length) {
        const target = [...s.prospects].sort((a, b) => b.commitPct - a.commitPct)[0];
        actionSchmooze(s, target.id, 'tour');
      }
      toLineup(s);
      break;
    }
    case 'lineup':
      playGame(s);
      break;
    case 'result':
      assignAll();
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

const t = myTeam(s);
if (t.players.length !== ROSTER_SIZE) throw new Error(`bad roster size ${t.players.length}`);
if (t.players.some((p) => p.classYear > 3)) throw new Error('player failed to graduate');
if (s.integrity < 0 || s.integrity > 100) throw new Error(`integrity out of range: ${s.integrity}`);
for (const p of t.players) {
  if (p.fitness < 0 || p.fitness > 100 || p.mood < 0 || p.mood > 100) {
    throw new Error(`fitness/mood out of range for ${p.name}`);
  }
  for (const k of STAT_KEYS) if (p.stats[k] > 99) throw new Error(`stat overflow for ${p.name}`);
}
for (const team of s.teams) {
  if (team.players.length < 3) throw new Error(`team ${team.name} under-rostered`);
}

console.log(`OK: reached season ${s.season}, week ${s.week}, phase ${s.phase}; sessions=${trained}`);
console.log(`  wins=${s.totalWins} integrity=${s.integrity} trophies=${s.trophies}`);
console.log(
  `  roster: ${t.players
    .map((p) => `${p.name} [${p.speciesId} ${['Fr','So','Jr','Sr'][Math.min(p.classYear,3)]} ${p.pos} ${overall(p)}/${p.potential}${p.gem ? ' GEM' : p.walkOn ? ' walk-on' : ''}]`)
    .join('; ')}`
);
