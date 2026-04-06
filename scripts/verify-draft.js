// Verify draft resolution results
// Usage: node scripts/verify-draft.js
//
// Run after resolving a round to check:
// - Winners are correct
// - Budgets are properly deducted
// - Losing bids are refunded (bids collection cleared)
// - Draft picks are recorded

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc',
  authDomain: 'masters-pool-777e1.firebaseapp.com',
  projectId: 'masters-pool-777e1',
  storageBucket: 'masters-pool-777e1.firebasestorage.app',
  messagingSenderId: '594486724280',
  appId: '1:594486724280:web:bf466821ae3b098b3c964d'
});

const db = getFirestore(app);
const TOTAL_BUDGET = 100;

async function verify() {
  console.log('Masters Pool — Verify Draft Results');
  console.log('====================================\n');

  // Check pool config
  const configDoc = await getDoc(doc(db, 'pool', 'config'));
  const config = configDoc.exists() ? configDoc.data() : {};
  console.log('Pool Config:');
  console.log(`  Phase: ${config.phase}`);
  console.log(`  Current Round: ${config.currentRound}`);
  console.log(`  Last Resolved: ${config.lastResolvedRound}`);
  console.log(`  Resolved: ${config.roundResolved}`);
  console.log();

  // Check draft picks
  const draftDoc = await getDoc(doc(db, 'pool', 'draft'));
  const picks = draftDoc.exists() ? (draftDoc.data().picks || {}) : {};
  console.log('Draft Picks:');
  const members = ['semmer', 'loeb', 'marquis', 'pearlman', 'forde'];
  for (const id of members) {
    const memberPicks = picks[id] || [];
    const spent = memberPicks.reduce((s, p) => s + (p.price || 0), 0);
    const remaining = TOTAL_BUDGET - spent;
    console.log(`  ${id}: ${memberPicks.length} picks, $${spent} spent, $${remaining} remaining`);
    for (const p of memberPicks) {
      console.log(`    - ${p.player}: $${p.price} (Round ${p.round})`);
    }
  }
  console.log();

  // Check remaining bids (should be empty after resolution)
  const bidsSnap = await getDocs(collection(db, 'bids'));
  console.log(`Remaining Bids: ${bidsSnap.size} (should be 0 after resolution)`);
  bidsSnap.forEach(d => {
    const b = d.data();
    console.log(`  ${b.poolMemberId} -> ${b.playerName}: $${b.amount} (Round ${b.round})`);
  });
  console.log();

  // Check remaining proposals
  const proposalsSnap = await getDocs(collection(db, 'proposals'));
  console.log(`Remaining Proposals: ${proposalsSnap.size} (should be 0 after resolution)`);
  console.log();

  // Validation checks
  console.log('Validation:');
  let allPass = true;

  // No member should have spent more than $100
  for (const id of members) {
    const memberPicks = picks[id] || [];
    const spent = memberPicks.reduce((s, p) => s + (p.price || 0), 0);
    if (spent > TOTAL_BUDGET) {
      console.log(`  FAIL: ${id} spent $${spent} (over $${TOTAL_BUDGET} budget)`);
      allPass = false;
    }
  }

  // No player should be drafted by more than one member
  const playerOwners = {};
  for (const [id, memberPicks] of Object.entries(picks)) {
    for (const p of memberPicks) {
      const key = p.player.toLowerCase();
      if (playerOwners[key]) {
        console.log(`  FAIL: ${p.player} drafted by both ${playerOwners[key]} and ${id}`);
        allPass = false;
      }
      playerOwners[key] = id;
    }
  }

  // No member should have more than 5 picks
  for (const id of members) {
    if ((picks[id] || []).length > 5) {
      console.log(`  FAIL: ${id} has ${picks[id].length} picks (max 5)`);
      allPass = false;
    }
  }

  if (allPass) {
    console.log('  All checks passed!');
  }

  process.exit(0);
}

verify().catch(e => { console.error('Error:', e.message); process.exit(1); });
