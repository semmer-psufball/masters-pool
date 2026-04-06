const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga';

// 2026 Masters: April 9-12 at Augusta National
const MASTERS_DATE_RANGE = '20260409-20260413';

function parseCompetitors(competitors) {
  const players = (competitors || []).map(c => {
    const score = typeof c.score === 'string' ? c.score : c.score?.displayValue || 'E';
    const scoreNum = parseInt(score) || 0;

    const rounds = (c.linescores || []).map(r => ({
      strokes: r.value != null ? String(Math.round(r.value)) : '-',
      toPar: r.displayValue || '-',
      holes: (r.linescores || []).map(h => ({
        hole: h.period,
        strokes: h.value,
        display: h.displayValue,
        toPar: h.scoreType?.displayValue || 'E',
      })),
    }));

    return {
      id: c.athlete?.id || c.id,
      name: c.athlete?.displayName || c.athlete?.fullName || 'Unknown',
      shortName: c.athlete?.shortName || null,
      headshot: `https://a.espncdn.com/i/headshots/golf/players/full/${c.id}.png`,
      country: c.athlete?.flag?.alt || '',
      flagUrl: c.athlete?.flag?.href || null,
      position: c.order || 999,
      totalScore: score,
      totalScoreNum: scoreNum,
      thru: c.status?.thru?.displayValue || '',
      rounds,
      status: c.status?.type?.description || '',
    };
  }).sort((a, b) => a.totalScoreNum - b.totalScoreNum);

  // Detect cut after round 2: top 50 plus ties make the cut (Masters rule)
  const maxRounds = Math.max(...players.map(p => p.rounds.length), 0);
  if (maxRounds >= 2) {
    // Find the score at position 50 (0-indexed: 49)
    const playersWithTwoRounds = players.filter(p => p.rounds.length >= 2);
    if (playersWithTwoRounds.length > 50) {
      const cutScore = playersWithTwoRounds[49].totalScoreNum;
      players.forEach(p => {
        // Missed cut if score is worse (higher) than the T50 score
        p.missedCut = p.totalScoreNum > cutScore;
      });
    }
    // Also mark anyone with fewer rounds than the leaders (WD, DNS)
    if (maxRounds > 2) {
      players.forEach(p => {
        if (p.rounds.length < maxRounds && !p.missedCut) {
          p.missedCut = true;
        }
      });
    }
  }

  // Calculate tie-aware positions: T3, T7, etc.
  let pos = 1;
  for (let i = 0; i < players.length; i++) {
    if (i > 0 && players[i].totalScoreNum !== players[i - 1].totalScoreNum) {
      pos = i + 1;
    }
    const count = players.filter(p => p.totalScoreNum === players[i].totalScoreNum).length;
    players[i].position = pos;
    players[i].positionDisplay = (players[i].missedCut ? 'MC' : (count > 1 ? `T${pos}` : String(pos)));
  }

  return players;
}

export async function getLeaderboard() {
  try {
    // Target the 2026 Masters specifically, not whatever PGA event is current
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${MASTERS_DATE_RANGE}`);
    const data = await res.json();

    if (!data.events || data.events.length === 0) {
      return { tournament: null, players: [] };
    }

    // Find the Masters event (should be the only one in this date range)
    const event = data.events.find(e => (e.name || '').toLowerCase().includes('masters')) || data.events[0];
    const competition = event.competitions?.[0];

    const tournament = {
      name: event.name,
      id: event.id,
      status: event.status?.type?.description,
      round: competition?.status?.period,
      location: competition?.venue?.fullName,
    };

    return { tournament, players: parseCompetitors(competition?.competitors) };
  } catch (err) {
    console.error('ESPN leaderboard error:', err);
    return { tournament: null, players: [] };
  }
}

export async function getMastersField() {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${MASTERS_DATE_RANGE}`);
    const data = await res.json();

    if (!data.events || data.events.length === 0) {
      return { tournament: null, players: [] };
    }

    const event = data.events.find(e => (e.name || '').toLowerCase().includes('masters')) || data.events[0];
    const competition = event.competitions?.[0];

    const tournament = {
      name: event.name,
      id: event.id,
      isMasters: true,
      status: event.status?.type?.description,
      round: competition?.status?.period,
      location: competition?.venue?.fullName,
      startDate: event.date,
    };

    return { tournament, players: parseCompetitors(competition?.competitors) };
  } catch (err) {
    console.error('ESPN field error:', err);
    return { tournament: null, players: [] };
  }
}

export async function getSchedule(year = 2026) {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${year}`);
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    console.error('ESPN schedule error:', err);
    return [];
  }
}

export async function getPlayerProfile(playerId) {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${playerId}/overview`
    );
    return await res.json();
  } catch (err) {
    console.error('ESPN player error:', err);
    return null;
  }
}
