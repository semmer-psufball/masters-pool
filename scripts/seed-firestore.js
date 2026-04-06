// Run with: node scripts/seed-firestore.js
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc",
  authDomain: "masters-pool-777e1.firebaseapp.com",
  projectId: "masters-pool-777e1",
  storageBucket: "masters-pool-777e1.firebasestorage.app",
  messagingSenderId: "594486724280",
  appId: "1:594486724280:web:bf466821ae3b098b3c964d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  // 1. Set pool phase
  await setDoc(doc(db, 'pool', 'config'), {
    phase: 'TOURNAMENT',
  });
  console.log('✓ pool/config created (phase: TOURNAMENT)');

  // 2. Seed draft picks (sample data — replace with real picks later)
  await setDoc(doc(db, 'pool', 'draft'), {
    picks: {
      semmer: [
        { player: 'Scottie Scheffler', price: 42 },
        { player: 'Jon Rahm', price: 35 },
      ],
      loeb: [
        { player: 'Rory McIlroy', price: 38 },
        { player: 'Xander Schauffele', price: 28 },
      ],
      marquis: [
        { player: 'Collin Morikawa', price: 22 },
        { player: 'Ludvig Åberg', price: 20 },
      ],
      pearlman: [
        { player: 'Hideki Matsuyama', price: 22 },
        { player: 'Tommy Fleetwood', price: 16 },
      ],
      forde: [
        { player: 'Viktor Hovland', price: 14 },
        { player: 'Max Homa', price: 6 },
      ],
    },
  });
  console.log('✓ pool/draft created with sample picks');

  console.log('\nDone! Your app should now show tournament standings with live scoring.');
  process.exit(0);
}

seed().catch(e => { console.error('Error:', e.message); process.exit(1); });
