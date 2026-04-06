// End-to-end draft test script
// Usage:
//   node scripts/test-draft.js       — run all tests (each uses a different round number)
//   node scripts/test-draft.js 1     — seed only test 1
//   node scripts/test-draft.js 5     — run client-side validation (local, no Firestore)
//
// After seeding, resolve with:
//   node scripts/resolve-round.js <round>
// Then verify with:
//   node scripts/verify-draft.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc',
  authDomain: 'masters-pool-777e1.firebaseapp.com',
  projectId: 'masters-pool-777e1',
  storageBucket: 'masters-pool-777e1.firebasestorage.app',
  messagingSenderId: '594486724280',
  appId: '1:594486724280:web:bf466821ae3b098b3c964d'
});

const db = getFirestore(app);

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

function log(msg) {
  console.log(`  ${msg}`);
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`  PASS: ${msg}`);
  }
}

// ═══════════════════════════════════════
// TEST 1: Basic round with clear winners (round 1)
// ═══════════════════════════════════════
async function testBasicRound() {
  console.log('\n=== TEST 1: Basic round — clear winners (uses round 1) ===');

  await clearCollection('bids');
  await clearCollection('proposals');
  await setDoc(doc(db, 'pool', 'draft'), { picks: {} });

  await setDoc(doc(db, 'pool', 'config'), {
    phase: 'DURING_DRAFT',
    currentRound: 1,
    roundOpenTime: new Date().toISOString(),
    roundCloseTime: new Date(Date.now() + 12 * 3600000).toISOString(),
    roundResolved: false,
  });

  // Each member proposes a different player with their own bid
  const proposals = [
    { memberId: 'semmer', player: 'Scottie Scheffler', bid: 42 },
    { memberId: 'loeb', player: 'Rory McIlroy', bid: 38 },
    { memberId: 'marquis', player: 'Collin Morikawa', bid: 22 },
    { memberId: 'pearlman', player: 'Hideki Matsuyama', bid: 20 },
    { memberId: 'forde', player: 'Viktor Hovland', bid: 14 },
  ];

  for (const p of proposals) {
    await setDoc(doc(db, 'proposals', `1_${p.memberId}`), {
      poolMemberId: p.memberId,
      playerName: p.player,
      bidAmount: p.bid,
      round: 1,
      autoProposed: false,
      timestamp: new Date().toISOString(),
    });

    const bidDocId = `1_${p.memberId}_${p.player.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await setDoc(doc(db, 'bids', bidDocId), {
      poolMemberId: p.memberId,
      playerName: p.player,
      amount: p.bid,
      round: 1,
      timestamp: new Date().toISOString(),
    });
  }

  // Cross-bid: semmer also bids on Rory (lower than loeb's 38)
  await setDoc(doc(db, 'bids', '1_semmer_Rory_McIlroy'), {
    poolMemberId: 'semmer',
    playerName: 'Rory McIlroy',
    amount: 30,
    round: 1,
    timestamp: new Date().toISOString(),
  });

  log('Seeded 5 proposals + 6 bids for round 1');
  log('Expected: each member wins their own proposed player (no one outbid)');
  log('  semmer → Scottie Scheffler ($42)');
  log('  loeb → Rory McIlroy ($38, beats semmer\'s $30)');
  log('  marquis → Collin Morikawa ($22)');
  log('  pearlman → Hideki Matsuyama ($20)');
  log('  forde → Viktor Hovland ($14)');
  log('');
  log('Resolve with: node scripts/resolve-round.js 1');
}

// ═══════════════════════════════════════
// TEST 2: Tie scenario — coin flip (round 2)
// ═══════════════════════════════════════
async function testTieRound() {
  console.log('\n=== TEST 2: Tie scenario — coin flip (uses round 2) ===');

  // Don't clear — we keep round 1 data from test 1.
  // Just add round 2 bids.

  const player = 'Xander Schauffele';
  await setDoc(doc(db, 'proposals', '2_semmer'), {
    poolMemberId: 'semmer', playerName: player, bidAmount: 35, round: 2,
    autoProposed: false, timestamp: new Date().toISOString(),
  });
  await setDoc(doc(db, 'bids', `2_semmer_${player.replace(/[^a-zA-Z0-9]/g, '_')}`), {
    poolMemberId: 'semmer', playerName: player, amount: 35, round: 2, timestamp: new Date().toISOString(),
  });
  await setDoc(doc(db, 'bids', `2_loeb_${player.replace(/[^a-zA-Z0-9]/g, '_')}`), {
    poolMemberId: 'loeb', playerName: player, amount: 35, round: 2, timestamp: new Date().toISOString(),
  });

  log(`Seeded 1 proposal + 2 bids for round 2`);
  log(`Both semmer and loeb bid $35 on ${player} — coin flip decides`);
  log('');
  log('Resolve with: node scripts/resolve-round.js 2');
}

// ═══════════════════════════════════════
// TEST 3: Over-budget bid gets filtered (round 3)
// ═══════════════════════════════════════
async function testBudgetValidation() {
  console.log('\n=== TEST 3: Over-budget bid filtered (uses round 3) ===');

  // Set semmer to have spent $90 already
  await setDoc(doc(db, 'pool', 'draft'), {
    picks: {
      semmer: [
        { player: 'Scottie Scheffler', price: 42, round: 1 },
        { player: 'Rory McIlroy', price: 30, round: 1 },
        { player: 'Collin Morikawa', price: 10, round: 2 },
        { player: 'Jon Rahm', price: 8, round: 2 },
      ],
    },
  });

  // semmer has $10 left, bids $15 — should be filtered as invalid
  await setDoc(doc(db, 'bids', '3_semmer_Bryson_DeChambeau'), {
    poolMemberId: 'semmer', playerName: 'Bryson DeChambeau', amount: 15, round: 3, timestamp: new Date().toISOString(),
  });
  await setDoc(doc(db, 'proposals', '3_semmer'), {
    poolMemberId: 'semmer', playerName: 'Bryson DeChambeau', bidAmount: 15, round: 3,
    autoProposed: false, timestamp: new Date().toISOString(),
  });

  // loeb has $100 (no picks), bids $8 — valid, should win
  await setDoc(doc(db, 'bids', '3_loeb_Bryson_DeChambeau'), {
    poolMemberId: 'loeb', playerName: 'Bryson DeChambeau', amount: 8, round: 3, timestamp: new Date().toISOString(),
  });

  log('Seeded 1 proposal + 2 bids for round 3');
  log('semmer has $10 left but bid $15 → invalid, filtered');
  log('loeb bid $8 → should win');
  log('');
  log('Resolve with: node scripts/resolve-round.js 3');
}

// ═══════════════════════════════════════
// TEST 4: Roster-full auto-withdraw (round 5)
// ═══════════════════════════════════════
async function testRosterFullAutoWithdraw() {
  console.log('\n=== TEST 4: Roster-full auto-withdraw (uses round 5) ===');

  // semmer has 4 picks, needs exactly 1 more
  await setDoc(doc(db, 'pool', 'draft'), {
    picks: {
      semmer: [
        { player: 'Scottie Scheffler', price: 20, round: 1 },
        { player: 'Rory McIlroy', price: 20, round: 2 },
        { player: 'Jon Rahm', price: 20, round: 3 },
        { player: 'Collin Morikawa', price: 20, round: 4 },
      ],
    },
  });

  // Clear only round-5 bids (keep other round data for inspection)
  const bidsSnap = await getDocs(collection(db, 'bids'));
  for (const d of bidsSnap.docs) {
    if (d.data().round === 5) await deleteDoc(d.ref);
  }

  // semmer bids $10 on Cantlay and $8 on Hovland
  await setDoc(doc(db, 'bids', '5_semmer_Patrick_Cantlay'), {
    poolMemberId: 'semmer', playerName: 'Patrick Cantlay', amount: 10, round: 5, timestamp: new Date().toISOString(),
  });
  await setDoc(doc(db, 'proposals', '5_semmer'), {
    poolMemberId: 'semmer', playerName: 'Patrick Cantlay', bidAmount: 10, round: 5,
    autoProposed: false, timestamp: new Date().toISOString(),
  });

  await setDoc(doc(db, 'bids', '5_semmer_Viktor_Hovland'), {
    poolMemberId: 'semmer', playerName: 'Viktor Hovland', amount: 8, round: 5, timestamp: new Date().toISOString(),
  });

  // loeb bids $5 on Hovland
  await setDoc(doc(db, 'bids', '5_loeb_Viktor_Hovland'), {
    poolMemberId: 'loeb', playerName: 'Viktor Hovland', amount: 5, round: 5, timestamp: new Date().toISOString(),
  });
  await setDoc(doc(db, 'proposals', '5_loeb'), {
    poolMemberId: 'loeb', playerName: 'Viktor Hovland', bidAmount: 5, round: 5,
    autoProposed: false, timestamp: new Date().toISOString(),
  });

  log('Seeded 2 proposals + 3 bids for round 5');
  log('semmer ($20 left, 4/5 roster): bids $10 Cantlay + $8 Hovland');
  log('loeb ($100 left, 0/5 roster): bids $5 Hovland');
  log('');
  log('Expected resolution:');
  log('  1. Cantlay → semmer ($10, highest bid)');
  log('  2. semmer now has 5/5 roster → auto-withdraw $8 Hovland bid');
  log('  3. Hovland → loeb ($5, only remaining bid)');
  log('');
  log('Resolve with: node scripts/resolve-round.js 5');
}

// ═══════════════════════════════════════
// TEST 5: Client-side validation (local, no Firestore)
// ═══════════════════════════════════════
function testClientValidation() {
  console.log('\n=== TEST 5: Client-Side Validation (local, no Firestore) ===');

  function validateBid(amount, playerName, memberId, myBids, draftPicks) {
    const amtNum = parseInt(amount);
    if (isNaN(amtNum) || amtNum < 1) return 'Minimum bid is $1';
    if (amtNum > 70) return 'Maximum bid per player is $70';

    const myPicks = draftPicks[memberId] || [];
    const spent = myPicks.reduce((s, p) => s + (p.price || 0), 0);
    const budgetRemaining = 100 - spent;

    const otherBidsTotal = myBids
      .filter(b => b.playerName.toLowerCase() !== playerName.toLowerCase())
      .reduce((s, b) => s + (b.amount || 0), 0);

    if (amtNum + otherBidsTotal > budgetRemaining) return 'Over budget';

    const allDrafted = new Set();
    Object.values(draftPicks).forEach(picks => (picks || []).forEach(p => allDrafted.add(p.player.toLowerCase())));
    if (allDrafted.has(playerName.toLowerCase())) return 'Already won';

    return null;
  }

  const draftPicks = {
    semmer: [{ player: 'Scottie Scheffler', price: 42 }],
    loeb: [{ player: 'Rory McIlroy', price: 38 }],
  };

  assert(validateBid(0, 'Jon Rahm', 'semmer', [], draftPicks) === 'Minimum bid is $1', 'Rejects $0 bid');
  assert(validateBid(71, 'Jon Rahm', 'semmer', [], draftPicks) === 'Maximum bid per player is $70', 'Rejects $71 bid');
  assert(validateBid(60, 'Jon Rahm', 'semmer', [], draftPicks) === 'Over budget', 'Rejects over-budget bid (has $58 left)');
  assert(validateBid(50, 'Jon Rahm', 'semmer', [], draftPicks) === null, 'Accepts valid $50 bid');
  assert(validateBid(10, 'Scottie Scheffler', 'loeb', [], draftPicks) === 'Already won', 'Rejects bid on already-won player');
  const myBids = [{ playerName: 'Viktor Hovland', amount: 50 }];
  assert(validateBid(10, 'Jon Rahm', 'semmer', myBids, draftPicks) === 'Over budget', 'Rejects when other bids + new > budget');
}

// ═══════════════════════════════════════
// RUN
// ═══════════════════════════════════════
async function main() {
  const testArg = process.argv[2];
  console.log('Masters Pool — Draft System Tests');
  console.log('==================================');

  if (testArg) {
    // Run a single test
    switch (testArg) {
      case '1': await testBasicRound(); break;
      case '2': await testTieRound(); break;
      case '3': await testBudgetValidation(); break;
      case '4': await testRosterFullAutoWithdraw(); break;
      case '5': testClientValidation(); break;
      default:
        console.log('Unknown test. Use 1-5.');
        process.exit(1);
    }
  } else {
    // Run all — but warn that each test sets up its own round
    console.log('Running all tests. Each seeds a different round.\n');
    await testBasicRound();
    await testTieRound();
    // Tests 3 and 4 overwrite pool/draft picks, so they are standalone.
    // Run them only if requested individually.
    console.log('\n  (Tests 3 & 4 overwrite draft picks — run them individually:');
    console.log('    node scripts/test-draft.js 3');
    console.log('    node scripts/test-draft.js 4)');
    testClientValidation();
  }

  console.log('\n==================================');
  console.log('Done. Resolve with: node scripts/resolve-round.js <round>');
  console.log('Verify with:       node scripts/verify-draft.js');

  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
