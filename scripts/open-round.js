// Open a draft round using the hardcoded schedule
// Usage: node scripts/open-round.js <round_number>
// Example: node scripts/open-round.js 1

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: 'AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc',
  authDomain: 'masters-pool-777e1.firebaseapp.com',
  projectId: 'masters-pool-777e1',
  storageBucket: 'masters-pool-777e1.firebasestorage.app',
  messagingSenderId: '594486724280',
  appId: '1:594486724280:web:bf466821ae3b098b3c964d'
});

const db = getFirestore(app);

const DRAFT_SCHEDULE = [
  { round: 1, open: '2026-04-06T09:00:00-04:00', close: '2026-04-06T21:00:00-04:00' },
  { round: 2, open: '2026-04-06T21:30:00-04:00', close: '2026-04-07T09:00:00-04:00' },
  { round: 3, open: '2026-04-07T09:30:00-04:00', close: '2026-04-07T21:00:00-04:00' },
  { round: 4, open: '2026-04-07T21:30:00-04:00', close: '2026-04-08T09:00:00-04:00' },
  { round: 5, open: '2026-04-08T09:30:00-04:00', close: '2026-04-08T21:00:00-04:00' },
];

const round = parseInt(process.argv[2]);

if (!round || round < 1 || round > 5) {
  console.log('Usage: node scripts/open-round.js <round_number>');
  console.log('Round must be 1-5');
  process.exit(1);
}

const schedule = DRAFT_SCHEDULE.find(s => s.round === round);

async function run() {
  await setDoc(doc(db, 'pool', 'config'), {
    phase: 'DURING_DRAFT',
    currentRound: round,
    roundOpenTime: schedule.open,
    roundCloseTime: schedule.close,
    roundResolved: false,
    autoProposedRound: null,
  }, { merge: true });

  console.log(`Round ${round} is now OPEN`);
  console.log(`  Opens:  ${new Date(schedule.open).toLocaleString()}`);
  console.log(`  Closes: ${new Date(schedule.close).toLocaleString()}`);
  console.log(`  Cloud Function will auto-resolve when close time is reached.`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
