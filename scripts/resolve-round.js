// Resolve a draft round locally against Firestore.
// Mirrors the resolveCurrentRound logic in functions/index.js exactly,
// but runs on your machine using the client SDK.
//
// Usage: node scripts/resolve-round.js <round_number>
// Example: node scripts/resolve-round.js 1

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, writeBatch, deleteDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc',
  authDomain: 'masters-pool-777e1.firebaseapp.com',
  projectId: 'masters-pool-777e1',
  storageBucket: 'masters-pool-777e1.firebasestorage.app',
  messagingSenderId: '594486724280',
  appId: '1:594486724280:web:bf466821ae3b098b3c964d',
});

const db = getFirestore(app);

const TOTAL_BUDGET = 100;
const ROSTER_SIZE = 5;
const ALL_MEMBERS = ['semmer', 'loeb', 'marquis', 'pearlman', 'forde'];
const MEMBER_NAMES = {
  semmer: 'Will', loeb: 'Chuck', marquis: 'Griffin',
  pearlman: 'Alex P', forde: 'Sam',
};

const DRAFT_SCHEDULE = [
  { round: 1, open: '2026-04-06T09:00:00-04:00', close: '2026-04-06T21:00:00-04:00' },
  { round: 2, open: '2026-04-06T21:30:00-04:00', close: '2026-04-07T09:00:00-04:00' },
  { round: 3, open: '2026-04-07T09:30:00-04:00', close: '2026-04-07T21:00:00-04:00' },
  { round: 4, open: '2026-04-07T21:30:00-04:00', close: '2026-04-08T09:00:00-04:00' },
  { round: 5, open: '2026-04-08T09:30:00-04:00', close: '2026-04-08T21:00:00-04:00' },
];

const roundNumber = parseInt(process.argv[2]);
if (!roundNumber || roundNumber < 1 || roundNumber > 5) {
  console.log('Usage: node scripts/resolve-round.js <round_number>');
  console.log('  round_number: 1-5');
  process.exit(1);
}

async function resolveRound(roundNumber) {
  console.log(`\nResolving Round ${roundNumber}...`);
  console.log('='.repeat(50));

  // ── Get current draft state ──
  const draftDoc = await getDoc(doc(db, 'pool', 'draft'));
  const picks = draftDoc.exists() ? (draftDoc.data().picks || {}) : {};
  const budgets = {};
  const rosterCounts = {};
  const draftedPlayers = new Set();

  ALL_MEMBERS.forEach(id => {
    const memberPicks = picks[id] || [];
    const spent = memberPicks.reduce((s, p) => s + (p.price || 0), 0);
    budgets[id] = TOTAL_BUDGET - spent;
    rosterCounts[id] = memberPicks.length;
    memberPicks.forEach(p => draftedPlayers.add(p.player.toLowerCase()));
  });

  console.log('\nPre-resolution state:');
  ALL_MEMBERS.forEach(id => {
    console.log(`  ${MEMBER_NAMES[id] || id}: $${budgets[id]} remaining, ${rosterCounts[id]} picks`);
  });

  // ── Get all bids for this round ──
  const bidsSnap = await getDocs(collection(db, 'bids'));
  const roundBidDocs = [];
  bidsSnap.forEach(d => {
    const data = d.data();
    if (data.round === roundNumber) roundBidDocs.push({ id: d.id, ref: d.ref, ...data });
  });

  if (roundBidDocs.length === 0) {
    console.log(`\nNo bids found for round ${roundNumber}. Nothing to resolve.`);
    process.exit(0);
  }

  console.log(`\nBids for round ${roundNumber}: ${roundBidDocs.length}`);
  roundBidDocs.forEach(b => {
    console.log(`  ${MEMBER_NAMES[b.poolMemberId] || b.poolMemberId} → ${b.playerName}: $${b.amount}`);
  });

  // ── Build flat bid list, filter invalid ──
  const allBids = roundBidDocs.map(b => ({
    docId: b.id,
    docRef: b.ref,
    memberId: b.poolMemberId,
    amount: b.amount,
    playerName: b.playerName,
  }));

  const sortedBids = [...allBids]
    .filter(b => !draftedPlayers.has(b.playerName.toLowerCase()))
    .filter(b => b.amount >= 1 && b.amount <= budgets[b.memberId])
    .sort((a, b) => b.amount - a.amount);

  const filtered = allBids.length - sortedBids.length;
  if (filtered > 0) {
    console.log(`\n  Filtered out ${filtered} invalid bid(s) (over budget, under $1, or already-drafted player)`);
  }

  // ── Resolve: process highest bid first across all players ──
  const results = [];
  const resolvedPlayers = new Set();
  const resolvedMembers = new Set();
  const localBudgets = { ...budgets };
  const localRosterCounts = { ...rosterCounts };

  console.log('\nResolution order:');

  while (sortedBids.length > 0) {
    const topBid = sortedBids[0];
    const playerName = topBid.playerName;

    if (resolvedPlayers.has(playerName.toLowerCase())) {
      sortedBids.shift();
      continue;
    }

    // All valid bids for this player
    const playerBids = sortedBids.filter(b =>
      b.playerName === playerName &&
      !resolvedMembers.has(b.memberId) &&
      b.amount <= localBudgets[b.memberId]
    );

    if (playerBids.length === 0) {
      sortedBids.shift();
      continue;
    }

    // Highest bid(s)
    const highestAmount = Math.max(...playerBids.map(b => b.amount));
    const topBids = playerBids.filter(b => b.amount === highestAmount);

    // Coin flip for ties
    const winner = topBids.length === 1
      ? topBids[0]
      : topBids[Math.floor(Math.random() * topBids.length)];

    const tieNote = topBids.length > 1
      ? ` (COIN FLIP from ${topBids.length} tied at $${highestAmount}: ${topBids.map(b => MEMBER_NAMES[b.memberId] || b.memberId).join(', ')})`
      : '';

    console.log(`  ${playerName} → ${MEMBER_NAMES[winner.memberId] || winner.memberId} wins at $${winner.amount}${tieNote}`);

    // Award
    if (!picks[winner.memberId]) picks[winner.memberId] = [];
    picks[winner.memberId].push({
      player: playerName,
      price: winner.amount,
      round: roundNumber,
    });

    localBudgets[winner.memberId] -= winner.amount;
    localRosterCounts[winner.memberId]++;
    resolvedPlayers.add(playerName.toLowerCase());

    results.push({
      player: playerName,
      winner: winner.memberId,
      amount: winner.amount,
      tiedBids: topBids.length > 1 ? topBids.length : 0,
    });

    // Roster full → auto-withdraw remaining bids
    if (localRosterCounts[winner.memberId] >= ROSTER_SIZE) {
      resolvedMembers.add(winner.memberId);
      const withdrawn = sortedBids.filter(b => b.memberId === winner.memberId && b.playerName !== playerName);
      if (withdrawn.length > 0) {
        console.log(`    ↳ ${MEMBER_NAMES[winner.memberId]}'s roster is full (${ROSTER_SIZE}/${ROSTER_SIZE}) — auto-withdrawing ${withdrawn.length} remaining bid(s)`);
      }
      for (let i = sortedBids.length - 1; i >= 0; i--) {
        if (sortedBids[i].memberId === winner.memberId) {
          sortedBids.splice(i, 1);
        }
      }
    }

    // Remove all bids for this resolved player
    for (let i = sortedBids.length - 1; i >= 0; i--) {
      if (sortedBids[i].playerName === playerName) {
        sortedBids.splice(i, 1);
      }
    }
  }

  if (results.length === 0) {
    console.log('  (no valid bids to resolve)');
  }

  // ── Write updated picks ──
  console.log('\nWriting results to Firestore...');
  await setDoc(doc(db, 'pool', 'draft'), { picks }, { merge: true });

  // ── Delete processed bids for this round ──
  for (const b of roundBidDocs) {
    await deleteDoc(doc(db, 'bids', b.id));
  }
  console.log(`  Deleted ${roundBidDocs.length} bid doc(s)`);

  // ── Delete proposals for this round ──
  const proposalsSnap = await getDocs(collection(db, 'proposals'));
  let proposalCount = 0;
  for (const d of proposalsSnap.docs) {
    if (d.data().round === roundNumber) {
      await deleteDoc(d.ref);
      proposalCount++;
    }
  }
  console.log(`  Deleted ${proposalCount} proposal doc(s)`);

  // ── Update config ──
  const nextRound = roundNumber < 5 ? roundNumber + 1 : null;
  const nextSchedule = nextRound ? DRAFT_SCHEDULE.find(s => s.round === nextRound) : null;

  const configUpdate = {
    lastResolvedRound: roundNumber,
    roundResolved: true,
    resolvedAt: new Date().toISOString(),
  };

  if (nextSchedule) {
    configUpdate.currentRound = nextRound;
    configUpdate.roundOpenTime = nextSchedule.open;
    configUpdate.roundCloseTime = nextSchedule.close;
    configUpdate.roundResolved = false;
  } else {
    const needsFreeAgency = ALL_MEMBERS.some(id => localRosterCounts[id] < ROSTER_SIZE);
    if (needsFreeAgency) {
      configUpdate.phase = 'FREE_AGENCY';
      configUpdate.freeAgencyOpen = '2026-04-08T07:30:00-04:00';
      configUpdate.freeAgencyClose = '2026-04-08T19:30:00-04:00';
    } else {
      configUpdate.phase = 'DRAFT_COMPLETE';
    }
  }

  await setDoc(doc(db, 'pool', 'config'), configUpdate, { merge: true });

  // ── Summary ──
  console.log('\n' + '='.repeat(50));
  console.log(`Round ${roundNumber} resolved: ${results.length} player(s) awarded\n`);

  if (results.length > 0) {
    console.log('Results:');
    results.forEach(r => {
      const tie = r.tiedBids > 1 ? ` (won coin flip vs ${r.tiedBids - 1} other(s))` : '';
      console.log(`  ${r.player} → ${MEMBER_NAMES[r.winner] || r.winner} for $${r.amount}${tie}`);
    });
  }

  console.log('\nPost-resolution state:');
  ALL_MEMBERS.forEach(id => {
    const count = (picks[id] || []).length;
    console.log(`  ${MEMBER_NAMES[id] || id}: $${localBudgets[id]} remaining, ${count}/${ROSTER_SIZE} picks`);
  });

  if (nextSchedule) {
    console.log(`\nNext: Round ${nextRound} (${new Date(nextSchedule.open).toLocaleString()} – ${new Date(nextSchedule.close).toLocaleString()})`);
    console.log(`  Open it with: node scripts/open-round.js ${nextRound}`);
  } else if (configUpdate.phase === 'FREE_AGENCY') {
    console.log('\nDraft rounds complete. Free agency window is now open.');
  } else {
    console.log('\nDraft complete! All rosters are full.');
  }

  process.exit(0);
}

resolveRound(roundNumber).catch(e => {
  console.error('\nError:', e.message);
  process.exit(1);
});
