import { SCORING } from '../constants/theme';

/**
 * Get points for a single position in a single round.
 * roundIndex: 0=Thu, 1=Fri, 2=Sat, 3=Sun
 * position: numeric position (1-based)
 */
function getPointsForPosition(position, roundIndex) {
  for (const tier of SCORING.positionPoints) {
    if (typeof tier.pos === 'number') {
      if (position === tier.pos) return tier.pts[roundIndex];
    } else {
      const [lo, hi] = tier.pos;
      if (position >= lo && position <= hi) return tier.pts[roundIndex];
    }
  }
  // Below 50th
  return SCORING.belowFifty[roundIndex];
}

/**
 * Calculate points for a position considering ties.
 * If a player is T3 and 3 players share that position (3,4,5),
 * average the points for positions 3, 4, and 5.
 *
 * @param {number} tiedPosition - the position (e.g. 3 for T3)
 * @param {number} tiedCount - how many players share this position
 * @param {number} roundIndex - 0=Thu, 1=Fri, 2=Sat, 3=Sun
 */
export function getPointsWithTies(tiedPosition, tiedCount, roundIndex) {
  if (tiedCount <= 1) return getPointsForPosition(tiedPosition, roundIndex);

  let total = 0;
  for (let i = 0; i < tiedCount; i++) {
    total += getPointsForPosition(tiedPosition + i, roundIndex);
  }
  return Math.round(total / tiedCount); // whole numbers only
}

/**
 * Calculate total pool points for a golfer across all completed rounds.
 * Uses end-of-round position snapshots for completed rounds when available,
 * falls back to current live position for in-progress rounds or if no snapshot exists.
 *
 * @param {object} golfer - from ESPN leaderboard { position, positionDisplay, totalScoreNum, missedCut, rounds }
 * @param {Array} allPlayers - full leaderboard (to count ties)
 * @param {number} completedRounds - number of rounds with data (0-4)
 * @param {object} roundSnapshots - { round1: { playerName: { position, tiedCount, missedCut } }, ... }
 * @returns {{ total: number, perRound: number[], projected: number }}
 */
export function calculateGolferPoints(golfer, allPlayers, completedRounds, roundSnapshots = {}) {
  const perRound = [];

  if (golfer.missedCut) {
    // Missed cut: -15 applied once (counted as Friday points)
    perRound.push(SCORING.missedCut);
    for (let i = 1; i < completedRounds; i++) perRound.push(0);
    return { total: SCORING.missedCut, perRound, projected: SCORING.missedCut };
  }

  // Current live position & tie count (for in-progress round or fallback)
  const livePos = golfer.position;
  const liveTiedCount = allPlayers.filter(p => p.totalScoreNum === golfer.totalScoreNum && !p.missedCut).length;
  const golferKey = (golfer.name || '').toLowerCase();

  for (let r = 0; r < completedRounds; r++) {
    const roundKey = `round${r + 1}`;
    const snapshot = roundSnapshots[roundKey];
    const snapshotData = snapshot && snapshot[golferKey];

    if (snapshotData && !snapshotData.missedCut && !snapshotData.withdrawn) {
      // Use snapshotted position for this completed round
      const pts = getPointsWithTies(snapshotData.position, snapshotData.tiedCount, r);
      perRound.push(pts);
    } else if (snapshotData && (snapshotData.missedCut || snapshotData.withdrawn)) {
      // Player was cut or withdrew by this round's end — shouldn't happen if
      // we already handled missedCut above, but guard against it
      perRound.push(r === 1 ? SCORING.missedCut : 0);
    } else {
      // No snapshot for this round — fall back to current live position
      const pts = getPointsWithTies(livePos, liveTiedCount, r);
      perRound.push(pts);
    }
  }

  const total = perRound.reduce((s, p) => s + p, 0);

  // Project remaining rounds at current live position
  let projected = total;
  for (let r = completedRounds; r < 4; r++) {
    projected += getPointsWithTies(livePos, liveTiedCount, r);
  }

  return { total, perRound, projected };
}

/**
 * Calculate pool standings for all members.
 *
 * @param {Array} members - POOL_MEMBERS
 * @param {object} draftResults - { [memberId]: [{ player: 'Name', price: 42 }, ...] }
 * @param {Array} leaderboard - players from ESPN
 * @param {number} completedRounds - 0-4
 * @param {object} roundSnapshots - end-of-round position snapshots
 * @returns {Array} sorted standings
 */
export function calculatePoolStandings(members, draftResults, leaderboard, completedRounds, roundSnapshots = {}) {
  const standings = members.map(member => {
    const picks = draftResults[member.id] || [];
    const golfers = picks.map(pick => {
      const onBoard = leaderboard.find(p =>
        p.name && pick.player && p.name.toLowerCase() === pick.player.toLowerCase()
      );
      if (!onBoard) return { name: pick.player, headshot: null, position: '-', score: '-', points: 0, projected: 0 };

      const { total, perRound, projected } = calculateGolferPoints(onBoard, leaderboard, completedRounds, roundSnapshots);
      return {
        name: onBoard.name,
        headshot: onBoard.headshot,
        position: onBoard.positionDisplay,
        score: onBoard.totalScoreNum,
        missedCut: onBoard.missedCut,
        points: total,
        projected,
        perRound,
      };
    });

    const teamPoints = Math.round(golfers.reduce((s, g) => s + g.points, 0));
    const teamProjected = Math.round(golfers.reduce((s, g) => s + g.projected, 0));

    return {
      ...member,
      golfers,
      teamPoints,
      teamProjected,
    };
  }).sort((a, b) => b.teamPoints - a.teamPoints);

  // Calculate win probability using softmax on projected points
  const projections = standings.map(s => s.teamProjected);
  const maxProj = Math.max(...projections);
  const expScores = projections.map(p => Math.exp((p - maxProj) / 15)); // temperature=15 for spread
  const sumExp = expScores.reduce((s, e) => s + e, 0);
  standings.forEach((s, i) => {
    s.winPct = Math.round((expScores[i] / sumExp) * 100);
  });
  // Ensure they sum to 100
  const totalPct = standings.reduce((s, m) => s + m.winPct, 0);
  if (totalPct !== 100 && standings.length > 0) {
    standings[0].winPct += 100 - totalPct;
  }

  return standings;
}
