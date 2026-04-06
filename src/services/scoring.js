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
 *
 * @param {object} golfer - from ESPN leaderboard { position, positionDisplay, totalScoreNum, missedCut, rounds }
 * @param {Array} allPlayers - full leaderboard (to count ties)
 * @param {number} completedRounds - number of rounds finished (0-4)
 * @returns {{ total: number, perRound: number[], projected: number }}
 */
export function calculateGolferPoints(golfer, allPlayers, completedRounds) {
  const perRound = [];

  if (golfer.missedCut) {
    // Missed cut: -15 applied once (counted as Friday points)
    // Thu points based on position after R1 (but we may not have R1-end positions)
    // Simplified: -15 total for missed cut, 0 for remaining rounds
    perRound.push(SCORING.missedCut);
    for (let i = 1; i < completedRounds; i++) perRound.push(0);
    return { total: SCORING.missedCut, perRound, projected: SCORING.missedCut };
  }

  // For each completed round, calculate points based on current position
  // (We use current overall position since we don't have end-of-round snapshots)
  const pos = golfer.position;
  const tiedCount = allPlayers.filter(p => p.totalScoreNum === golfer.totalScoreNum && !p.missedCut).length;

  for (let r = 0; r < completedRounds; r++) {
    const pts = getPointsWithTies(pos, tiedCount, r);
    perRound.push(pts);
  }

  const total = perRound.reduce((s, p) => s + p, 0);

  // Project remaining rounds at current position
  let projected = total;
  for (let r = completedRounds; r < 4; r++) {
    projected += getPointsWithTies(pos, tiedCount, r);
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
 * @returns {Array} sorted standings
 */
export function calculatePoolStandings(members, draftResults, leaderboard, completedRounds) {
  const standings = members.map(member => {
    const picks = draftResults[member.id] || [];
    const golfers = picks.map(pick => {
      const onBoard = leaderboard.find(p =>
        p.name && pick.player && p.name.toLowerCase() === pick.player.toLowerCase()
      );
      if (!onBoard) return { name: pick.player, headshot: null, position: '-', score: '-', points: 0, projected: 0 };

      const { total, perRound, projected } = calculateGolferPoints(onBoard, leaderboard, completedRounds);
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
