/**
 * One-time migration: rename `uid` → `userId` on existing bid documents.
 *
 * Run from the functions/ directory:
 *   node migrate-bids.js
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase default credentials.
 */
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ credential: applicationDefault(), projectId: "masters-pool-777e1" });
const db = getFirestore();

async function migrate() {
  const snap = await db.collection("bids").get();
  if (snap.empty) {
    console.log("No bids found.");
    return;
  }

  const batch = db.batch();
  let count = 0;

  snap.forEach((doc) => {
    const data = doc.data();
    if (data.uid && !data.userId) {
      batch.update(doc.ref, { userId: data.uid });
      count++;
      console.log(`  Will update ${doc.id}: uid="${data.uid}" → userId="${data.uid}"`);
    }
  });

  if (count === 0) {
    console.log("All bids already have userId. Nothing to migrate.");
    return;
  }

  await batch.commit();
  console.log(`\nDone — updated ${count} bid(s).`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
