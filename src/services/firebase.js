import { initializeApp } from 'firebase/app';
import { initializeAuth, signInAnonymously, signOut, onAuthStateChanged, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAQdNeW5j2SkcVLc9W87Q_xcS5REeUI2kc",
  authDomain: "masters-pool-777e1.firebaseapp.com",
  projectId: "masters-pool-777e1",
  storageBucket: "masters-pool-777e1.firebasestorage.app",
  messagingSenderId: "594486724280",
  appId: "1:594486724280:web:bf466821ae3b098b3c964d"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
export async function signInAnon() {
  return signInAnonymously(auth);
}

export async function setupProfile(uid, { firstName, lastName, email, poolMemberId }) {
  await setDoc(doc(db, 'users', uid), {
    firstName,
    lastName,
    displayName: firstName,
    email,
    poolMemberId,
    favorites: [],
    createdAt: new Date().toISOString(),
  }, { merge: true });
}

export async function logOut() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ═══════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export function onUserProfile(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ═══════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════
export async function addFavorite(uid, playerName) {
  return updateDoc(doc(db, 'users', uid), {
    favorites: arrayUnion(playerName),
  });
}

export async function removeFavorite(uid, playerName) {
  return updateDoc(doc(db, 'users', uid), {
    favorites: arrayRemove(playerName),
  });
}

// ═══════════════════════════════════════
// POOL CONFIG (phase, draft timing, etc.)
// ═══════════════════════════════════════
export function onPoolConfig(callback) {
  return onSnapshot(doc(db, 'pool', 'config'), (snap) => {
    callback(snap.exists() ? snap.data() : { phase: 'PRE_DRAFT' });
  });
}

// ═══════════════════════════════════════
// ROUND SNAPSHOTS (end-of-round positions)
// ═══════════════════════════════════════
export function onRoundSnapshots(callback) {
  return onSnapshot(doc(db, 'pool', 'roundSnapshots'), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

// ═══════════════════════════════════════
// DRAFT
// ═══════════════════════════════════════
export function onDraftPicks(callback) {
  return onSnapshot(doc(db, 'pool', 'draft'), (snap) => {
    callback(snap.exists() ? snap.data() : { picks: {} });
  });
}

export async function submitBid(uid, poolMemberId, playerName, amount, round) {
  // Write bid — one doc per member+player+round combo (supports multiple bids per round)
  await setDoc(doc(db, 'bids', `${round}_${poolMemberId}_${playerName.replace(/[^a-zA-Z0-9]/g, '_')}`), {
    uid,
    poolMemberId,
    playerName,
    amount,
    round,
    timestamp: new Date().toISOString(),
  });
}

export async function withdrawBid(poolMemberId, playerName, round) {
  const docId = `${round}_${poolMemberId}_${playerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  await deleteDoc(doc(db, 'bids', docId));
}

// ═══════════════════════════════════════
// PROPOSALS
// ═══════════════════════════════════════
export async function submitProposal(uid, poolMemberId, playerName, bidAmount, round) {
  // Check if another member already proposed this player this round
  const proposalsSnap = await getDocs(query(collection(db, 'proposals'), where('round', '==', round)));
  for (const d of proposalsSnap.docs) {
    const data = d.data();
    if (data.playerName.toLowerCase() === playerName.toLowerCase() && data.poolMemberId !== poolMemberId) {
      throw new Error(`${playerName} was already proposed by another member this round`);
    }
  }

  // A proposal is a doc in the proposals collection: one per member per round
  await setDoc(doc(db, 'proposals', `${round}_${poolMemberId}`), {
    uid,
    poolMemberId,
    playerName,
    bidAmount,
    round,
    autoProposed: false,
    timestamp: new Date().toISOString(),
  });
  // Also create the corresponding bid automatically
  await submitBid(uid, poolMemberId, playerName, bidAmount, round);
}

export async function updateProposalBid(poolMemberId, playerName, newAmount, round) {
  // Update the proposal's bid amount
  await updateDoc(doc(db, 'proposals', `${round}_${poolMemberId}`), {
    bidAmount: newAmount,
    timestamp: new Date().toISOString(),
  });
  // Update the corresponding bid doc
  await setDoc(doc(db, 'bids', `${round}_${poolMemberId}_${playerName.replace(/[^a-zA-Z0-9]/g, '_')}`), {
    poolMemberId,
    playerName,
    amount: newAmount,
    round,
    timestamp: new Date().toISOString(),
  }, { merge: true });
}

export function onRoundProposals(round, callback) {
  // Listen to all proposals for a given round
  return onSnapshot(collection(db, 'proposals'), (snap) => {
    const proposals = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.round === round) proposals.push({ id: d.id, ...data });
    });
    callback(proposals);
  });
}

export function onRoundBids(round, callback) {
  // Listen to all bids for a given round
  return onSnapshot(collection(db, 'bids'), (snap) => {
    const bids = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.round === round) bids.push({ id: d.id, ...data });
    });
    callback(bids);
  });
}

// ═══════════════════════════════════════
// FREE AGENCY
// ═══════════════════════════════════════
export async function claimFreeAgent(uid, poolMemberId, playerName) {
  const claimDocId = playerName.replace(/[^a-zA-Z0-9]/g, '_');
  const claimRef = doc(db, 'freeAgencyClaims', claimDocId);

  // Check if already claimed — whoever wrote the claim doc first wins
  const existing = await getDoc(claimRef);
  if (existing.exists()) {
    throw new Error(`${playerName} was already claimed by ${existing.data().poolMemberId}`);
  }

  // Write claim doc first as the lock
  await setDoc(claimRef, {
    poolMemberId,
    playerName,
    uid,
    timestamp: new Date().toISOString(),
  });

  // Re-check after write in case of simultaneous claims
  const verify = await getDoc(claimRef);
  if (verify.data().poolMemberId !== poolMemberId) {
    throw new Error(`${playerName} was claimed by someone else`);
  }

  // Claim is ours — add to draft picks
  const draftDoc = await getDoc(doc(db, 'pool', 'draft'));
  const currentPicks = draftDoc.exists() ? (draftDoc.data().picks || {}) : {};
  if (!currentPicks[poolMemberId]) currentPicks[poolMemberId] = [];
  currentPicks[poolMemberId].push({ player: playerName, price: 0, round: 'FA' });
  await setDoc(doc(db, 'pool', 'draft'), { picks: currentPicks }, { merge: true });
}

export function onFreeAgencyClaims(callback) {
  return onSnapshot(collection(db, 'freeAgencyClaims'), (snap) => {
    const claims = {};
    snap.forEach(d => {
      const data = d.data();
      claims[data.playerName.toLowerCase()] = data.poolMemberId;
    });
    callback(claims);
  });
}
