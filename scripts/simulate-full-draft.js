// simulate-full-draft.js
//
// Runs 5 complete mock drafts end-to-end against Firestore, resetting between
// each. Each draft goes through all 5 rounds with randomized bids, then
// verifies final state. Exercises ties, budget pressure, auto-withdraw, and
// free agency.
//
// Usage: node scripts/simulate-full-draft.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc',
  authDomain: 'masters-pool-777e1.firebaseapp.com',
  projectId: 'masters-pool-777e1',
  storageBucket: 'masters-pool-777e1.firebasestorage.app',
  messagingSenderId: '594486724280',
  appId: '1:594486724280:web:bf466821ae3b098b3c964d',
});

const db = getFirestore(app);

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

const TOTAL_BUDGET = 100;
const ROSTER_SIZE = 5;
const MAX_BID = 70;
const ALL_MEMBERS = ['semmer', 'loeb', 'marquis', 'pearlman', 'forde'];
const MEMBER_NAMES = {
  semmer: 'Will', loeb: 'Chuck', marquis: 'Griffin',
  pearlman: 'Alex P', forde: 'Sam',
};

// Full 92-player Masters field, ordered roughly by pre-tournament ranking
const MASTERS_FIELD = [
  'Scottie Scheffler', 'Xander Schauffele', 'Rory McIlroy', 'Jon Rahm',
  'Collin Morikawa', 'Ludvig Åberg', 'Bryson DeChambeau', 'Hideki Matsuyama',
  'Patrick Cantlay', 'Viktor Hovland', 'Tommy Fleetwood', 'Wyndham Clark',
  'Sam Burns', 'Shane Lowry', 'Max Homa', 'Sungjae Im',
  'Justin Thomas', 'Matt Fitzpatrick', 'Jordan Spieth', 'Russell Henley',
  'Robert MacIntyre', 'Corey Conners', 'Keegan Bradley', 'Jason Day',
  'Brooks Koepka', 'Cameron Smith', 'Min Woo Lee', 'Tyrrell Hatton',
  'Adam Scott', 'Cameron Young', 'Akshay Bhatia', 'Nicolai Højgaard',
  'Sepp Straka', 'Dustin Johnson', 'Justin Rose', 'Aaron Rai',
  'Harris English', 'Davis Riley', 'Tom McKibbin', 'Ryan Fox',
  'Kurt Kitayama', 'Jake Knapp', 'Brian Harman', 'Nick Taylor',
  'Si Woo Kim', 'Alex Noren', 'Rasmus Højgaard', 'Chris Gotterup',
  'Max Greyserman', 'Ben Griffin', 'Harry Hall', 'Maverick McNealy',
  'Matt McCarty', 'Andrew Novak', 'Carlos Ortiz', 'Marco Penge',
  'Aldrich Potgieter', 'Patrick Reed', 'Kristoffer Reitan', 'Daniel Berger',
  'Michael Brennan', 'Jacob Bridgeman', 'Ángel Cabrera', 'Brian Campbell',
  'Nico Echavarria', 'Ryan Gerard', 'Charl Schwartzel', 'J.J. Spaun',
  'Sami Välimäki', 'Bubba Watson', 'Mike Weir', 'Danny Willett',
  'Gary Woodland', 'Fred Couples', 'Vijay Singh', 'José María Olazábal',
  'Zach Johnson', 'Haotong Li', 'Michael Kim', 'Casey Jarvis',
  'Naoyuki Kataoka', 'Rasmus Neergaard-Petersen', 'Fifa Laopakdee',
  'Ethan Fang', 'Mason Howell', 'Jackson Herrington', 'Brandon Holtz',
  'John Keefer', 'Mateo Pulcini', 'Samuel Stevens', 'Sergio García',
];

// ═══════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  for (const d of snap.docs) await deleteDoc(d.ref);
}

async function resetAll() {
  await clearCollection('bids');
  await clearCollection('proposals');
  await clearCollection('freeAgencyClaims');
  await setDoc(doc(db, 'pool', 'draft'), { picks: {} });
  await setDoc(doc(db, 'pool', 'config'), {
    phase: 'PRE_DRAFT',
    currentRound: 1,
    roundResolved: false,
    lastResolvedRound: 0,
  });
}

async function getDraftState() {
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

  return { picks, budgets, rosterCounts, draftedPlayers };
}

// ═══════════════════════════════════════
// RANDOM HELPERS
// ═══════════════════════════════════════

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════
// BID GENERATION
// ═══════════════════════════════════════

/**
 * Generate proposals and bids for one round.
 *
 * Strategy profiles (rotated across drafts to vary behaviour):
 *   0 = "big spender"  — early rounds get heavy bids, risks running dry
 *   1 = "sniper"       — moderate opening bids, aggressive cross-bids on 1-2 targets
 *   2 = "penny pincher" — low bids, saves budget for later rounds
 *   3 = "balanced"     — even spread
 *   4 = "chaos"        — fully random
 */
function generateRoundBids(roundNum, budgets, rosterCounts, draftedPlayers, draftIndex) {
  const available = MASTERS_FIELD.filter(n => !draftedPlayers.has(n.toLowerCase()));
  const activeMembers = ALL_MEMBERS.filter(id => rosterCounts[id] < ROSTER_SIZE);

  // Each active member proposes a unique player
  const proposals = []; // { memberId, playerName, bidAmount }
  const bids = [];      // { memberId, playerName, amount }
  const usedPlayers = new Set();

  // Assign strategy per member: rotate by draftIndex so each draft is different
  const strategies = shuffle([0, 1, 2, 3, 4, 4]);

  for (let mi = 0; mi < activeMembers.length; mi++) {
    const memberId = activeMembers[mi];
    const budget = budgets[memberId];
    const roundsLeft = 5 - roundNum + 1;
    const picksNeeded = ROSTER_SIZE - rosterCounts[memberId];
    // Reserve $1 per future pick so we can always bid the minimum
    const reserveForFuture = Math.max(0, picksNeeded - 1);
    const maxSpendable = Math.min(budget - reserveForFuture, MAX_BID);

    if (maxSpendable < 1) continue; // can't bid anything meaningful

    const strategy = strategies[(mi + draftIndex) % strategies.length];

    // Pick a player to propose — top-ranked available player with some noise
    const pool = available.filter(n => !usedPlayers.has(n.toLowerCase()));
    if (pool.length === 0) continue;

    let proposalTarget;
    if (strategy <= 1) {
      // Big spender / sniper: pick from top 10 available
      const topN = pool.slice(0, Math.min(10, pool.length));
      proposalTarget = pick(topN);
    } else if (strategy === 2) {
      // Penny pincher: pick from ranks 10-30 (value picks)
      const midRange = pool.slice(Math.min(8, pool.length - 1), Math.min(30, pool.length));
      proposalTarget = midRange.length > 0 ? pick(midRange) : pick(pool);
    } else {
      // Balanced / chaos: anywhere in top 20
      const topN = pool.slice(0, Math.min(20, pool.length));
      proposalTarget = pick(topN);
    }

    usedPlayers.add(proposalTarget.toLowerCase());

    // Decide opening bid amount
    let bidAmount;
    switch (strategy) {
      case 0: // big spender
        bidAmount = randInt(Math.ceil(maxSpendable * 0.4), maxSpendable);
        break;
      case 1: // sniper
        bidAmount = randInt(Math.ceil(maxSpendable * 0.15), Math.ceil(maxSpendable * 0.5));
        break;
      case 2: // penny pincher
        bidAmount = randInt(1, Math.max(1, Math.ceil(maxSpendable * 0.2)));
        break;
      case 3: // balanced
        bidAmount = randInt(Math.ceil(maxSpendable * 0.1), Math.ceil(maxSpendable * 0.4));
        break;
      default: // chaos
        bidAmount = randInt(1, maxSpendable);
    }
    bidAmount = Math.max(1, Math.min(bidAmount, maxSpendable));

    proposals.push({ memberId, playerName: proposalTarget, bidAmount });
    bids.push({ memberId, playerName: proposalTarget, amount: bidAmount });
  }

  // Cross-bids: some members bid on other members' proposed players
  const proposedPlayers = proposals.map(p => p.playerName);
  for (const memberId of activeMembers) {
    const budget = budgets[memberId];
    const myProposal = proposals.find(p => p.memberId === memberId);
    const myProposalBid = bids.find(b => b.memberId === memberId && b.playerName === myProposal?.playerName);
    const alreadyCommitted = myProposalBid ? myProposalBid.amount : 0;
    const spendable = budget - alreadyCommitted;
    if (spendable < 1) continue;

    // Each member has a chance to cross-bid on 0-3 other proposed players
    const numCrossBids = randInt(0, Math.min(3, proposedPlayers.length - 1));
    const otherProposed = shuffle(proposedPlayers.filter(n =>
      n !== myProposal?.playerName
    ));

    let crossSpent = 0;
    for (let c = 0; c < numCrossBids && c < otherProposed.length; c++) {
      const target = otherProposed[c];
      const remaining = spendable - crossSpent;
      if (remaining < 1) break;

      const crossAmount = randInt(1, Math.min(remaining, MAX_BID));
      bids.push({ memberId, playerName: target, amount: crossAmount });
      crossSpent += crossAmount;
    }
  }

  return { proposals, bids };
}

// ═══════════════════════════════════════
// RESOLUTION LOGIC (from resolve-round.js)
// ═══════════════════════════════════════

async function resolveRound(roundNumber, quiet) {
  const { picks, budgets, rosterCounts, draftedPlayers } = await getDraftState();

  // Read bids
  const bidsSnap = await getDocs(collection(db, 'bids'));
  const roundBidDocs = [];
  bidsSnap.forEach(d => {
    const data = d.data();
    if (data.round === roundNumber) roundBidDocs.push({ id: d.id, ...data });
  });

  if (roundBidDocs.length === 0) {
    if (!quiet) console.log(`    No bids for round ${roundNumber}`);
    return { results: [], picks, budgets: { ...budgets }, rosterCounts: { ...rosterCounts } };
  }

  // Flat list
  const allBids = roundBidDocs.map(b => ({
    docId: b.id,
    memberId: b.poolMemberId,
    amount: b.amount,
    playerName: b.playerName,
  }));

  const sortedBids = [...allBids]
    .filter(b => !draftedPlayers.has(b.playerName.toLowerCase()))
    .filter(b => b.amount >= 1 && b.amount <= budgets[b.memberId])
    .sort((a, b) => b.amount - a.amount);

  const filtered = allBids.length - sortedBids.length;

  const results = [];
  const resolvedPlayers = new Set();
  const resolvedMembers = new Set();
  const localBudgets = { ...budgets };
  const localRosterCounts = { ...rosterCounts };

  while (sortedBids.length > 0) {
    const topBid = sortedBids[0];
    const playerName = topBid.playerName;

    if (resolvedPlayers.has(playerName.toLowerCase())) {
      sortedBids.shift();
      continue;
    }

    const playerBids = sortedBids.filter(b =>
      b.playerName === playerName &&
      !resolvedMembers.has(b.memberId) &&
      b.amount <= localBudgets[b.memberId]
    );

    if (playerBids.length === 0) {
      sortedBids.shift();
      continue;
    }

    const highestAmount = Math.max(...playerBids.map(b => b.amount));
    const topBids = playerBids.filter(b => b.amount === highestAmount);

    const winner = topBids.length === 1
      ? topBids[0]
      : topBids[Math.floor(Math.random() * topBids.length)];

    if (!picks[winner.memberId]) picks[winner.memberId] = [];
    picks[winner.memberId].push({ player: playerName, price: winner.amount, round: roundNumber });

    localBudgets[winner.memberId] -= winner.amount;
    localRosterCounts[winner.memberId]++;
    resolvedPlayers.add(playerName.toLowerCase());

    results.push({
      player: playerName,
      winner: winner.memberId,
      amount: winner.amount,
      tied: topBids.length > 1,
      tiedCount: topBids.length,
    });

    if (localRosterCounts[winner.memberId] >= ROSTER_SIZE) {
      resolvedMembers.add(winner.memberId);
      for (let i = sortedBids.length - 1; i >= 0; i--) {
        if (sortedBids[i].memberId === winner.memberId) sortedBids.splice(i, 1);
      }
    }

    for (let i = sortedBids.length - 1; i >= 0; i--) {
      if (sortedBids[i].playerName === playerName) sortedBids.splice(i, 1);
    }
  }

  // Write picks
  await setDoc(doc(db, 'pool', 'draft'), { picks }, { merge: true });

  // Delete bids + proposals for this round
  for (const b of roundBidDocs) await deleteDoc(doc(db, 'bids', b.id));
  const proposalsSnap = await getDocs(collection(db, 'proposals'));
  for (const d of proposalsSnap.docs) {
    if (d.data().round === roundNumber) await deleteDoc(d.ref);
  }

  return {
    results,
    picks,
    budgets: localBudgets,
    rosterCounts: localRosterCounts,
    filtered,
  };
}

// ═══════════════════════════════════════
// FREE AGENCY
// ═══════════════════════════════════════

async function runFreeAgency() {
  const { picks, rosterCounts, draftedPlayers } = await getDraftState();
  const available = MASTERS_FIELD.filter(n => !draftedPlayers.has(n.toLowerCase()));

  // Sort members by fewest picks (priority), then random tie-break
  const needsFill = shuffle(ALL_MEMBERS)
    .filter(id => rosterCounts[id] < ROSTER_SIZE)
    .sort((a, b) => rosterCounts[a] - rosterCounts[b]);

  const faResults = [];
  let avIdx = 0;

  for (const memberId of needsFill) {
    while ((picks[memberId] || []).length < ROSTER_SIZE && avIdx < available.length) {
      const playerName = available[avIdx++];
      if (!picks[memberId]) picks[memberId] = [];
      picks[memberId].push({ player: playerName, price: 0, round: 'FA' });
      faResults.push({ memberId, player: playerName });
    }
  }

  await setDoc(doc(db, 'pool', 'draft'), { picks }, { merge: true });
  return faResults;
}

// ═══════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════

async function verifyFinalState() {
  const { picks, budgets, rosterCounts, draftedPlayers } = await getDraftState();
  const errors = [];

  // Every member has exactly 5 golfers
  for (const id of ALL_MEMBERS) {
    const count = (picks[id] || []).length;
    if (count !== ROSTER_SIZE) {
      errors.push(`${MEMBER_NAMES[id]} has ${count} golfers (expected ${ROSTER_SIZE})`);
    }
  }

  // All 30 golfers unique
  const allPicked = [];
  for (const id of ALL_MEMBERS) {
    for (const p of (picks[id] || [])) allPicked.push(p.player.toLowerCase());
  }
  if (allPicked.length !== 30) {
    errors.push(`Total golfers drafted: ${allPicked.length} (expected 30)`);
  }
  const unique = new Set(allPicked);
  if (unique.size !== allPicked.length) {
    const dupes = allPicked.filter((n, i) => allPicked.indexOf(n) !== i);
    errors.push(`Duplicate golfers: ${[...new Set(dupes)].join(', ')}`);
  }

  // Budgets >= 0 and spent + remaining = 100
  for (const id of ALL_MEMBERS) {
    const memberPicks = picks[id] || [];
    const spent = memberPicks.reduce((s, p) => s + (p.price || 0), 0);
    const remaining = TOTAL_BUDGET - spent;
    if (remaining < 0) {
      errors.push(`${MEMBER_NAMES[id]} has negative budget: $${remaining}`);
    }
    if (spent + remaining !== TOTAL_BUDGET) {
      errors.push(`${MEMBER_NAMES[id]}: spent ($${spent}) + remaining ($${remaining}) != $${TOTAL_BUDGET}`);
    }
  }

  // No bid over $70
  for (const id of ALL_MEMBERS) {
    for (const p of (picks[id] || [])) {
      if (p.price > MAX_BID) {
        errors.push(`${MEMBER_NAMES[id]} paid $${p.price} for ${p.player} (max is $${MAX_BID})`);
      }
    }
  }

  return errors;
}

// ═══════════════════════════════════════
// SINGLE DRAFT SIMULATION
// ═══════════════════════════════════════

async function runDraft(draftIndex) {
  const label = `Draft ${draftIndex + 1}/5`;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}`);

  await resetAll();

  const roundResults = [];
  let autoWithdrawCount = 0;
  let tieCount = 0;
  let filteredTotal = 0;

  for (let round = 1; round <= 5; round++) {
    const { budgets, rosterCounts, draftedPlayers } = await getDraftState();

    // Generate bids
    const { proposals, bids } = generateRoundBids(round, budgets, rosterCounts, draftedPlayers, draftIndex);

    if (proposals.length === 0) {
      console.log(`  Round ${round}: no active members (all rosters full)`);
      roundResults.push([]);
      continue;
    }

    // Write proposals to Firestore
    for (const p of proposals) {
      await setDoc(doc(db, 'proposals', `${round}_${p.memberId}`), {
        poolMemberId: p.memberId,
        playerName: p.playerName,
        bidAmount: p.bidAmount,
        round,
        autoProposed: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Write bids to Firestore (de-dup: one doc per member+player+round)
    const bidMap = new Map(); // key -> highest bid for that member+player
    for (const b of bids) {
      const key = `${round}_${b.memberId}_${b.playerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const existing = bidMap.get(key);
      if (!existing || b.amount > existing.amount) {
        bidMap.set(key, b);
      }
    }
    for (const [key, b] of bidMap) {
      await setDoc(doc(db, 'bids', key), {
        poolMemberId: b.memberId,
        playerName: b.playerName,
        amount: b.amount,
        round,
        timestamp: new Date().toISOString(),
      });
    }

    // Resolve
    const res = await resolveRound(round, true);
    roundResults.push(res.results);

    const ties = res.results.filter(r => r.tied).length;
    const aw = res.results.filter(r => {
      return res.rosterCounts[r.winner] >= ROSTER_SIZE;
    }).length;
    tieCount += ties;
    filteredTotal += res.filtered || 0;

    // Print round summary
    const parts = [`${res.results.length} won`];
    if (ties > 0) parts.push(`${ties} ties`);
    if (res.filtered > 0) parts.push(`${res.filtered} filtered`);
    console.log(`  Round ${round}: ${proposals.length} proposed, ${bidMap.size} bids → ${parts.join(', ')}`);

    for (const r of res.results) {
      const tie = r.tied ? ` (flip vs ${r.tiedCount - 1})` : '';
      console.log(`    ${r.player} → ${MEMBER_NAMES[r.winner]} $${r.amount}${tie}`);
    }
  }

  // Check if free agency is needed
  const preFA = await getDraftState();
  const needsFA = ALL_MEMBERS.some(id => preFA.rosterCounts[id] < ROSTER_SIZE);
  let faResults = [];
  if (needsFA) {
    faResults = await runFreeAgency();
    console.log(`  Free agency: ${faResults.length} pick(s)`);
    for (const fa of faResults) {
      console.log(`    ${fa.player} → ${MEMBER_NAMES[fa.memberId]} ($0)`);
    }
  }

  // Verify
  const errors = await verifyFinalState();
  const passed = errors.length === 0;

  // Print summary
  console.log(`\n  ── ${label} Summary ──`);
  const finalState = await getDraftState();
  for (const id of ALL_MEMBERS) {
    const memberPicks = finalState.picks[id] || [];
    const spent = memberPicks.reduce((s, p) => s + (p.price || 0), 0);
    const names = memberPicks.map(p => {
      const price = p.price > 0 ? `$${p.price}` : 'FA';
      return `${p.player} (${price})`;
    });
    console.log(`  ${MEMBER_NAMES[id].padEnd(7)} $${String(spent).padStart(3)} spent | $${String(TOTAL_BUDGET - spent).padStart(3)} left | ${names.join(', ')}`);
  }

  if (needsFA) console.log(`  Free agency picks: ${faResults.length}`);
  console.log(`  Ties resolved by coin flip: ${tieCount}`);
  if (filteredTotal > 0) console.log(`  Invalid bids filtered: ${filteredTotal}`);

  if (passed) {
    console.log(`\n  ✓ ${label}: PASS`);
  } else {
    console.log(`\n  ✗ ${label}: FAIL`);
    for (const e of errors) console.log(`    ERROR: ${e}`);
    // Dump full state for debugging
    console.log('\n  Full final state:');
    console.log(JSON.stringify(finalState.picks, null, 2));
  }

  return { passed, errors, tieCount, filteredTotal, freeAgency: faResults.length };
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════

async function main() {
  console.log('Masters Pool — Full Draft Simulation (5 drafts)');
  console.log('================================================');

  const summaries = [];

  for (let i = 0; i < 5; i++) {
    const result = await runDraft(i);
    summaries.push(result);
    if (!result.passed) {
      console.log('\n⚠ Stopping early due to failure. Fix the bug above before continuing.');
      break;
    }
  }

  // Overall results
  console.log('\n' + '═'.repeat(60));
  console.log('  OVERALL RESULTS');
  console.log('═'.repeat(60));

  const passed = summaries.filter(s => s.passed).length;
  const failed = summaries.filter(s => !s.passed).length;
  const totalTies = summaries.reduce((s, r) => s + r.tieCount, 0);
  const totalFiltered = summaries.reduce((s, r) => s + r.filteredTotal, 0);
  const totalFA = summaries.reduce((s, r) => s + r.freeAgency, 0);

  console.log(`  Drafts:     ${passed} passed, ${failed} failed (of ${summaries.length})`);
  console.log(`  Ties:       ${totalTies} resolved by coin flip`);
  console.log(`  Filtered:   ${totalFiltered} invalid bids caught`);
  console.log(`  Free agency: ${totalFA} picks across all drafts`);
  console.log(`  Result:     ${failed === 0 ? 'ALL PASS' : 'FAILURE'}`);

  // Reset to clean state after simulation
  await resetAll();
  console.log('\n  (Firestore reset to clean state)');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
