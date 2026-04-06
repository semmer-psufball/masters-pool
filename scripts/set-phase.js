// Set the pool phase
// Usage: node scripts/set-phase.js <phase>
// Phases: PRE_DRAFT, DURING_DRAFT, FREE_AGENCY, DRAFT_COMPLETE, TOURNAMENT

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
const phase = process.argv[2];

const VALID_PHASES = ['PRE_DRAFT', 'DURING_DRAFT', 'FREE_AGENCY', 'DRAFT_COMPLETE', 'TOURNAMENT'];

if (!VALID_PHASES.includes(phase)) {
  console.log(`Usage: node scripts/set-phase.js <${VALID_PHASES.join('|')}>`);
  process.exit(1);
}

async function run() {
  await setDoc(doc(db, 'pool', 'config'), { phase }, { merge: true });
  console.log(`Phase set to ${phase}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
