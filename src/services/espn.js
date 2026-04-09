const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga';

// 2026 Masters: April 9-12 at Augusta National
const MASTERS_DATE_RANGE = '20260409-20260413';

function parseCompetitors(competitors, tournamentStatus) {
  const players = (competitors || []).map(c => {
    const score = typeof c.score === 'string' ? c.score : c.score?.displayValue || 'E';
    const scoreNum = parseInt(score) || 0;

    const rounds = (c.linescores || [])
      .filter(r => r.value != null && (!r.period || r.period <= 4))  // skip empty stubs + playoff (period 5+)
      .map(r => ({
        strokes: String(Math.round(r.value)),
        toPar: r.displayValue || '-',
        holes: (r.linescores || []).map(h => ({
          hole: h.period,
          strokes: h.value,
          display: h.displayValue,
          toPar: h.scoreType?.displayValue || 'E',
        })),
      }));

    // Derive "thru" from hole-by-hole data in the latest active round.
    // ESPN doesn't provide status.thru on the competitor object — we calculate
    // it from the number of hole linescores in the current round.
    let thru = '';
    if (rounds.length > 0) {
      const latestRound = rounds[rounds.length - 1];
      const holesPlayed = latestRound.holes.length;
      if (holesPlayed >= 18) {
        thru = 'F';
      } else if (holesPlayed > 0) {
        thru = String(holesPlayed);
      }
      // holesPlayed === 0 means round hasn't started, leave thru as ''
    }

    return {
      id: c.athlete?.id || c.id,
      name: c.athlete?.displayName || c.athlete?.fullName || 'Unknown',
      shortName: c.athlete?.shortName || null,
      headshot: `https://a.espncdn.com/i/headshots/golf/players/full/${c.id}.png`,
      country: c.athlete?.flag?.alt || '',
      flagUrl: c.athlete?.flag?.href || null,
      position: c.order || 999,
      espnOrder: c.order || 999,
      totalScore: score,
      totalScoreNum: scoreNum,
      thru,
      rounds,
      status: c.status?.type?.description || '',
    };
  }).sort((a, b) => a.totalScoreNum - b.totalScoreNum);

  // Detect cut, withdrawal, DNS using ESPN status field first
  const maxRounds = Math.max(...players.map(p => p.rounds.length), 0);
  players.forEach(p => {
    const status = (p.status || '').toLowerCase();
    if (status === 'cut') {
      p.missedCut = true;
    } else if (status === 'withdrawn' || status === 'wd' || status === 'did not start' || status === 'dns' || status === 'disqualified' || status === 'dq') {
      p.missedCut = true;
      p.withdrawn = true;
    }
  });

  // Fallback: position-50 cut logic only after R2 (before R3 data exists)
  if (maxRounds === 2) {
    const playersWithTwoRounds = players.filter(p => p.rounds.length >= 2 && !p.missedCut);
    if (playersWithTwoRounds.length > 50) {
      const cutScore = playersWithTwoRounds[49].totalScoreNum;
      players.forEach(p => {
        if (!p.missedCut && p.totalScoreNum > cutScore) {
          p.missedCut = true;
        }
      });
    }
  }

  // Mark anyone with fewer rounds than the leaders who wasn't already flagged (WD/DNS)
  if (maxRounds > 2) {
    players.forEach(p => {
      if (p.rounds.length < maxRounds && !p.missedCut) {
        p.missedCut = true;
      }
    });
  }

  // Calculate tie-aware positions: T3, T7, etc.
  // When tournament is final, ESPN's order reflects playoff results —
  // use it so the playoff winner gets 1st (not T1).
  const isFinal = (tournamentStatus || '').toLowerCase() === 'final' ||
                  (tournamentStatus || '').toLowerCase() === 'completed';

  if (isFinal) {
    // Use ESPN's order directly — playoff breaks ties at the top
    for (const p of players) {
      if (p.missedCut) { p.positionDisplay = 'MC'; continue; }
      const sameOrder = players.filter(q => q.espnOrder === p.espnOrder && !q.missedCut).length;
      p.position = p.espnOrder;
      p.positionDisplay = sameOrder > 1 ? `T${p.espnOrder}` : String(p.espnOrder);
    }
  } else {
    let pos = 1;
    for (let i = 0; i < players.length; i++) {
      if (i > 0 && players[i].totalScoreNum !== players[i - 1].totalScoreNum) {
        pos = i + 1;
      }
      const count = players.filter(p => p.totalScoreNum === players[i].totalScoreNum && !p.missedCut).length;
      players[i].position = pos;
      players[i].positionDisplay = (players[i].missedCut ? 'MC' : (count > 1 ? `T${pos}` : String(pos)));
    }
  }

  return players;
}

// ─── TEST MODE: remove this block to restore live ESPN data ───
const TEST_MODE = false;
function getMockLeaderboard() {
  // Mid-R2 (Friday) simulation: R1 complete, R2 in progress for some
  const field = [
    { name: 'Scottie Scheffler', id: '9478', score: -9, thru: '13', r1: { s: 66, tp: '-6' }, r2: { s: 69, tp: '-3', h: 13,
      holes: [
        { hole: 1, strokes: 4, par: 4, tp: 'E' },    // par
        { hole: 2, strokes: 4, par: 5, tp: '-1' },   // birdie
        { hole: 3, strokes: 4, par: 4, tp: 'E' },    // par
        { hole: 4, strokes: 3, par: 3, tp: 'E' },    // par
        { hole: 5, strokes: 4, par: 4, tp: 'E' },    // par
        { hole: 6, strokes: 3, par: 3, tp: 'E' },    // par
        { hole: 7, strokes: 4, par: 4, tp: 'E' },    // par
        { hole: 8, strokes: 3, par: 5, tp: '-2' },   // eagle
        { hole: 9, strokes: 5, par: 4, tp: '+1' },   // bogey
        { hole: 10, strokes: 3, par: 4, tp: '-1' },  // birdie
        { hole: 11, strokes: 4, par: 4, tp: 'E' },   // par
        { hole: 12, strokes: 3, par: 3, tp: 'E' },   // par
        { hole: 13, strokes: 4, par: 5, tp: '-1' },  // birdie
      ],
    } },
    { name: 'Rory McIlroy', id: '3470', score: -7, thru: '14', r1: { s: 68, tp: '-4' }, r2: { s: 69, tp: '-3', h: 14 } },
    { name: 'Ludvig Åberg', id: '4375972', score: -6, thru: '12', r1: { s: 67, tp: '-5' }, r2: { s: 71, tp: '-1', h: 12 } },
    { name: 'Xander Schauffele', id: '10140', score: -6, thru: 'F', r1: { s: 69, tp: '-3' }, r2: { s: 69, tp: '-3', h: 18 } },
    { name: 'Collin Morikawa', id: '10592', score: -5, thru: '11', r1: { s: 68, tp: '-4' }, r2: { s: 71, tp: '-1', h: 11 } },
    { name: 'Tommy Fleetwood', id: '5539', score: -4, thru: 'F', r1: { s: 69, tp: '-3' }, r2: { s: 71, tp: '-1', h: 18 } },
    { name: 'Bryson DeChambeau', id: '10046', score: -4, thru: '10', r1: { s: 70, tp: '-2' }, r2: { s: 70, tp: '-2', h: 10 } },
    { name: 'Hideki Matsuyama', id: '5860', score: -3, thru: '15', r1: { s: 70, tp: '-2' }, r2: { s: 71, tp: '-1', h: 15 } },
    { name: 'Jon Rahm', id: '9780', score: -3, thru: '9', r1: { s: 71, tp: '-1' }, r2: { s: 70, tp: '-2', h: 9 } },
    { name: 'Robert MacIntyre', id: '11378', score: -2, thru: 'F', r1: { s: 71, tp: '-1' }, r2: { s: 71, tp: '-1', h: 18 } },
    { name: 'Shane Lowry', id: '4587', score: -2, thru: '13', r1: { s: 71, tp: '-1' }, r2: { s: 71, tp: '-1', h: 13 } },
    { name: 'Patrick Cantlay', id: '6007', score: -1, thru: 'F', r1: { s: 72, tp: 'E' }, r2: { s: 71, tp: '-1', h: 18 } },
    { name: 'Justin Thomas', id: '4848', score: -1, thru: '11', r1: { s: 70, tp: '-2' }, r2: { s: 73, tp: '+1', h: 11 } },
    { name: 'Akshay Bhatia', id: '4419142', score: -1, thru: '10', r1: { s: 71, tp: '-1' }, r2: { s: 72, tp: 'E', h: 10 } },
    { name: 'Viktor Hovland', id: '4364873', score: 0, thru: '14', r1: { s: 72, tp: 'E' }, r2: { s: 72, tp: 'E', h: 14 } },
    { name: 'Ben Griffin', id: '4404992', score: 0, thru: 'F', r1: { s: 73, tp: '+1' }, r2: { s: 71, tp: '-1', h: 18 } },
    { name: 'Jake Knapp', id: '9843', score: 0, thru: '8', r1: { s: 72, tp: 'E' }, r2: { s: 72, tp: 'E', h: 8 } },
    { name: 'Cameron Young', id: '4425906', score: 1, thru: '12', r1: { s: 72, tp: 'E' }, r2: { s: 73, tp: '+1', h: 12 } },
    { name: 'Jason Day', id: '1680', score: 1, thru: 'F', r1: { s: 73, tp: '+1' }, r2: { s: 72, tp: 'E', h: 18 } },
    { name: 'Jordan Spieth', id: '5467', score: 1, thru: '9', r1: { s: 73, tp: '+1' }, r2: { s: 72, tp: 'E', h: 9 } },
    { name: 'Maverick McNealy', id: '9530', score: 2, thru: 'F', r1: { s: 74, tp: '+2' }, r2: { s: 72, tp: 'E', h: 18 } },
    { name: 'Justin Rose', id: '569', score: 2, thru: '11', r1: { s: 73, tp: '+1' }, r2: { s: 73, tp: '+1', h: 11 } },
    { name: 'Matt Fitzpatrick', id: '9037', score: 2, thru: 'F', r1: { s: 74, tp: '+2' }, r2: { s: 72, tp: 'E', h: 18 } },
    { name: 'Patrick Reed', id: '5579', score: 3, thru: '13', r1: { s: 74, tp: '+2' }, r2: { s: 73, tp: '+1', h: 13 } },
    { name: 'Jacob Bridgeman', id: '5054388', score: 3, thru: 'F', r1: { s: 75, tp: '+3' }, r2: { s: 72, tp: 'E', h: 18 } },
    { name: 'Dustin Johnson', id: '3448', score: 4, thru: 'F', r1: { s: 75, tp: '+3' }, r2: { s: 73, tp: '+1', h: 18 } },
    { name: 'Brooks Koepka', id: '6798', score: 4, thru: '10', r1: { s: 74, tp: '+2' }, r2: { s: 74, tp: '+2', h: 10 } },
    { name: 'Adam Scott', id: '388', score: 5, thru: 'F', r1: { s: 76, tp: '+4' }, r2: { s: 73, tp: '+1', h: 18 } },
    { name: 'Max Homa', id: '8973', score: 5, thru: '9', r1: { s: 75, tp: '+3' }, r2: { s: 74, tp: '+2', h: 9 } },
    { name: 'Sam Burns', id: '9938', score: 6, thru: 'F', r1: { s: 76, tp: '+4' }, r2: { s: 74, tp: '+2', h: 18 } },
    { name: 'Cameron Smith', id: '9131', score: 7, thru: 'F', r1: { s: 77, tp: '+5' }, r2: { s: 74, tp: '+2', h: 18 } },
  ];

  const competitors = field.map((p, i) => ({
    id: p.id,
    order: i + 1,
    score: p.score === 0 ? 'E' : String(p.score),
    athlete: { id: p.id, displayName: p.name, shortName: p.name },
    status: { thru: { displayValue: p.thru === 'F' ? '' : p.thru }, type: { description: 'In Progress' } },
    linescores: [
      { value: p.r1.s, displayValue: p.r1.tp, period: 1, linescores: [] },
      { value: p.r2.s, displayValue: p.r2.tp, period: 2,
        linescores: p.r2.holes
          ? p.r2.holes.map(h => ({ period: h.hole, value: h.strokes, displayValue: String(h.strokes), scoreType: { displayValue: h.tp } }))
          : Array.from({ length: p.r2.h }, (_, h) => ({ period: h + 1, value: 4, displayValue: '4', scoreType: { displayValue: 'E' } })),
      },
    ],
  }));

  const players = parseCompetitors(competitors);
  return {
    tournament: { name: 'Masters Tournament', id: '401811941', status: 'In Progress', round: 2, location: 'Augusta National Golf Club' },
    players,
  };
}
// ─── END TEST MODE ───

export async function getLeaderboard() {
  // ─── TEST MODE: return mock data instead of ESPN ───
  if (TEST_MODE) return getMockLeaderboard();
  // ─── END TEST MODE ───

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

    return { tournament, players: parseCompetitors(competition?.competitors, tournament.status) };
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

    return { tournament, players: parseCompetitors(competition?.competitors, tournament.status) };
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
