import { SCORING } from '../constants/theme';

// ═══════════════════════════════════════
// POSITION-BASED POINT LOOKUP
// ═══════════════════════════════════════

function getPointsForPosition(position, roundIndex) {
  for (const tier of SCORING.positionPoints) {
    if (typeof tier.pos === 'number') {
      if (position === tier.pos) return tier.pts[roundIndex];
    } else {
      const [lo, hi] = tier.pos;
      if (position >= lo && position <= hi) return tier.pts[roundIndex];
    }
  }
  return SCORING.belowFifty[roundIndex];
}

function getPointsWithTies(position, tiedCount, roundIndex) {
  if (tiedCount <= 1) return getPointsForPosition(position, roundIndex);
  let total = 0;
  for (let i = 0; i < tiedCount; i++) {
    total += getPointsForPosition(position + i, roundIndex);
  }
  return Math.round(total / tiedCount);
}

// ═══════════════════════════════════════
// RANDOM SAMPLING UTILITIES
// ═══════════════════════════════════════

// Box-Muller transform: two uniform randoms → one standard normal
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Log-normal-ish sample centered on current position.
// We work in log-space so the distribution:
//   - Can't go below 1
//   - Skews toward regression to the middle of the field
//   - A leader is more likely to fall than to stay; a trailer is more likely to rise
function samplePosition(currentPos, stdev, fieldSize) {
  if (stdev <= 0) return currentPos;

  // Map position to log-space: log(pos) has a natural floor at log(1)=0
  const logPos = Math.log(currentPos);
  // Scale stdev in log-space — positions near 1 have less downside room
  const logStdev = stdev / currentPos * 0.8;
  const logSample = logPos + randn() * logStdev;
  // Convert back and clamp
  const sampled = Math.round(Math.exp(logSample));
  return Math.max(1, Math.min(fieldSize, sampled));
}

// ═══════════════════════════════════════
// VOLATILITY MODEL
// ═══════════════════════════════════════

/**
 * Calculate position standard deviation based on holes remaining.
 * stdev = 25 * sqrt(holesRemaining / 72)
 *
 * At 72 holes (pre-tournament): ~25 positions
 * At 54 holes (after R1):       ~21.7
 * At 36 holes (after R2):       ~17.7
 * At 18 holes (after R3):       ~12.5
 * At 9 holes (mid-R4):          ~8.8
 * At 0 holes (done):            0
 */
function getPositionStdev(holesRemaining) {
  if (holesRemaining <= 0) return 0;
  return 25 * Math.sqrt(holesRemaining / 72);
}

// ═══════════════════════════════════════
// MONTE CARLO ENGINE
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// FINGERPRINT & CACHE
// ═══════════════════════════════════════

let _cachedResult = null;
let _cachedFingerprint = null;

/**
 * Build a fingerprint string from leaderboard state.
 * Only changes when positions or scores actually move.
 */
function buildFingerprint(leaderboard, completedRounds) {
  // Use top-level position + score + thru for each player — cheap to compute
  const parts = leaderboard.slice(0, 60).map(p =>
    `${p.name}:${p.position}:${p.totalScoreNum}:${p.thru}`
  );
  return `${completedRounds}|${parts.join(',')}`;
}

/**
 * Run Monte Carlo asynchronously. Returns cached result if leaderboard hasn't changed.
 * Uses InteractionManager to avoid blocking the UI thread.
 */
export function runMonteCarloAsync(members, draftResults, leaderboard, completedRounds, roundSnapshots = {}) {
  const fp = buildFingerprint(leaderboard, completedRounds);
  if (_cachedFingerprint === fp && _cachedResult) {
    return Promise.resolve(_cachedResult);
  }

  return new Promise(resolve => {
    const { InteractionManager } = require('react-native');
    InteractionManager.runAfterInteractions(() => {
      const result = runMonteCarlo(members, draftResults, leaderboard, completedRounds, roundSnapshots);
      _cachedFingerprint = fp;
      _cachedResult = result;
      resolve(result);
    });
  });
}

/**
 * Run Monte Carlo simulation for pool win probabilities and expected points.
 *
 * @param {Array} members - POOL_MEMBERS
 * @param {object} draftResults - { memberId: [{ player }, ...] }
 * @param {Array} leaderboard - parsed ESPN players
 * @param {number} completedRounds - rounds with data (0-4)
 * @param {object} roundSnapshots - locked end-of-round snapshots
 * @param {number} numSims - simulation count (default 1000)
 * @returns {object} { standings: [...], simTime }
 */
export function runMonteCarlo(members, draftResults, leaderboard, completedRounds, roundSnapshots = {}, numSims = 1000) {
  const startTime = Date.now();

  if (completedRounds === 0 || leaderboard.length === 0) {
    // Pre-tournament: everyone equal
    const standings = members.map(m => ({
      ...m,
      expectedPts: 0,
      winPct: (100 / members.length),
      pctTop2: (200 / members.length),
      pctLast: (100 / members.length),
      rangeLo: 0,
      rangeHi: 0,
    }));
    return { standings, simTime: 0 };
  }

  const fieldSize = leaderboard.filter(p => !p.missedCut).length || leaderboard.length;

  // ─── Pre-compute locked points for each golfer from snapshots ───
  // For completed & snapshotted rounds, points are final.
  // For the current in-progress round, we use live position.
  const golferInfo = {};

  for (const player of leaderboard) {
    const key = player.name.toLowerCase();
    const thruHoles = parseThru(player.thru);
    // How many rounds are fully snapshotted?
    let lockedPts = 0;
    let lastSnapshotRound = 0;

    for (let r = 1; r <= 4; r++) {
      const snapKey = `round${r}`;
      const snap = roundSnapshots[snapKey];
      const snapData = snap && snap[key];
      if (snapData && !snapData.missedCut && !snapData.withdrawn) {
        lockedPts += getPointsWithTies(snapData.position, snapData.tiedCount, r - 1);
        lastSnapshotRound = r;
      } else if (snapData && (snapData.missedCut || snapData.withdrawn)) {
        lockedPts += (r - 1 === 1) ? SCORING.missedCut : 0;
        lastSnapshotRound = r;
      }
    }

    // Current in-progress round (not yet snapshotted)
    const currentRoundIndex = completedRounds - 1; // 0-based
    let liveRoundPts = 0;
    if (completedRounds > lastSnapshotRound && !player.missedCut) {
      // Use live position for un-snapshotted rounds
      const liveTiedCount = leaderboard.filter(p =>
        p.totalScoreNum === player.totalScoreNum && !p.missedCut
      ).length;
      for (let r = lastSnapshotRound; r < completedRounds; r++) {
        liveRoundPts += getPointsWithTies(player.position, liveTiedCount, r);
      }
    }

    // Holes remaining in tournament for this golfer
    const roundsWithData = player.rounds?.length || 0;
    const roundsLeft = 4 - completedRounds;
    // If player is mid-round, account for remaining holes in current round
    const holesInCurrentRound = (thruHoles >= 0 && thruHoles < 18) ? (18 - thruHoles) : 0;
    const totalHolesRemaining = roundsLeft * 18 + holesInCurrentRound;

    golferInfo[key] = {
      name: player.name,
      position: player.position,
      lockedPts,
      liveRoundPts,
      totalActualPts: lockedPts + liveRoundPts,
      missedCut: !!player.missedCut,
      withdrawn: !!player.withdrawn,
      holesRemaining: totalHolesRemaining,
      stdev: getPositionStdev(totalHolesRemaining),
      currentRoundIndex,
    };
  }

  // ─── Build roster lookups ───
  const teamGolferKeys = {};
  for (const member of members) {
    const picks = draftResults[member.id] || [];
    teamGolferKeys[member.id] = picks.map(p => p.player.toLowerCase());
  }

  // ─── Determine which future rounds need simulation ───
  // completedRounds = number of rounds with linescore data
  // We simulate from completedRounds to round 4 (index 0-3)
  const futureRoundIndices = [];
  for (let r = completedRounds; r < 4; r++) {
    futureRoundIndices.push(r);
  }

  // ─── Run simulations ───
  const memberIds = members.map(m => m.id);
  const wins = {};
  const top2s = {};
  const lasts = {};
  const totalPtsAccum = {};
  const allTotals = {};
  memberIds.forEach(id => {
    wins[id] = 0;
    top2s[id] = 0;
    lasts[id] = 0;
    totalPtsAccum[id] = 0;
    allTotals[id] = [];
  });

  // Pre-collect active golfer keys for sampling
  const activeGolferKeys = leaderboard
    .filter(p => !p.missedCut)
    .map(p => p.name.toLowerCase());

  for (let sim = 0; sim < numSims; sim++) {
    // 1. Sample finishing positions for all active golfers
    const sampledPositions = {};
    const sampledScores = [];

    for (const key of activeGolferKeys) {
      const info = golferInfo[key];
      if (!info) continue;
      const sampled = samplePosition(info.position, info.stdev, fieldSize);
      sampledPositions[key] = sampled;
      sampledScores.push({ key, sampled });
    }

    // 2. Enforce ranking consistency: sort and assign actual positions with ties
    sampledScores.sort((a, b) => a.sampled - b.sampled);
    const finalPositions = {};
    const tiedCounts = {};

    // Group by sampled value to handle ties
    let pos = 1;
    let i = 0;
    while (i < sampledScores.length) {
      let j = i;
      while (j < sampledScores.length && sampledScores[j].sampled === sampledScores[i].sampled) {
        j++;
      }
      const count = j - i;
      for (let k = i; k < j; k++) {
        finalPositions[sampledScores[k].key] = pos;
        tiedCounts[sampledScores[k].key] = count;
      }
      pos += count;
      i = j;
    }

    // 3. Calculate simulated points for future rounds
    const teamTotals = {};

    for (const memberId of memberIds) {
      let teamPts = 0;

      for (const golferKey of teamGolferKeys[memberId]) {
        const info = golferInfo[golferKey];
        if (!info) continue;

        if (info.missedCut) {
          teamPts += info.totalActualPts; // Already includes -15
          continue;
        }

        // Locked + live actual points
        let golferPts = info.totalActualPts;

        // Add simulated points for future rounds
        const simPos = finalPositions[golferKey] || info.position;
        const simTied = tiedCounts[golferKey] || 1;

        for (const ri of futureRoundIndices) {
          golferPts += getPointsWithTies(simPos, simTied, ri);
        }

        teamPts += golferPts;
      }

      teamTotals[memberId] = Math.round(teamPts);
    }

    // 4. Record results
    let maxPts = -Infinity;
    let minPts = Infinity;
    let winners = [];
    let losers = [];

    for (const id of memberIds) {
      const pts = teamTotals[id];
      totalPtsAccum[id] += pts;
      allTotals[id].push(pts);

      if (pts > maxPts) { maxPts = pts; winners = [id]; }
      else if (pts === maxPts) { winners.push(id); }

      if (pts < minPts) { minPts = pts; losers = [id]; }
      else if (pts === minPts) { losers.push(id); }
    }

    // Split credit for ties
    const winShare = 1 / winners.length;
    for (const id of winners) wins[id] += winShare;
    const loseShare = 1 / losers.length;
    for (const id of losers) lasts[id] += loseShare;

    // Top 2
    const sorted = memberIds.map(id => ({ id, pts: teamTotals[id] })).sort((a, b) => b.pts - a.pts);
    const top2Threshold = sorted[1]?.pts ?? sorted[0].pts;
    for (const id of memberIds) {
      if (teamTotals[id] >= top2Threshold) top2s[id] += 1;
    }
  }

  // ─── Compile results ───
  const standings = members.map(member => {
    const id = member.id;
    const totals = allTotals[id].sort((a, b) => a - b);
    const p10 = totals[Math.floor(numSims * 0.1)];
    const p90 = totals[Math.floor(numSims * 0.9)];

    // Actual points (non-simulated)
    let actualPts = 0;
    for (const golferKey of teamGolferKeys[id]) {
      const info = golferInfo[golferKey];
      if (info) actualPts += info.totalActualPts;
    }

    return {
      ...member,
      teamPoints: Math.round(actualPts),
      expectedPts: Math.round(totalPtsAccum[id] / numSims),
      winPct: Math.round((wins[id] / numSims) * 1000) / 10, // one decimal
      pctTop2: Math.round((top2s[id] / numSims) * 1000) / 10,
      pctLast: Math.round((lasts[id] / numSims) * 1000) / 10,
      rangeLo: p10,
      rangeHi: p90,
    };
  }).sort((a, b) => b.teamPoints - a.teamPoints);

  return {
    standings,
    simTime: Date.now() - startTime,
  };
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function parseThru(thru) {
  if (!thru || thru === '-' || thru === '' || thru === 'F') return 18;
  const n = parseInt(thru);
  return isNaN(n) ? 18 : n;
}
