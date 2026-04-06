const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const TOTAL_BUDGET = 100;
const ROSTER_SIZE = 5;
const ALL_MEMBERS = ["semmer", "loeb", "marquis", "pearlman", "forde"];

const DRAFT_SCHEDULE = [
  { round: 1, open: "2026-04-06T09:00:00-04:00", close: "2026-04-06T21:00:00-04:00" },
  { round: 2, open: "2026-04-06T21:30:00-04:00", close: "2026-04-07T09:00:00-04:00" },
  { round: 3, open: "2026-04-07T09:30:00-04:00", close: "2026-04-07T21:00:00-04:00" },
  { round: 4, open: "2026-04-07T21:30:00-04:00", close: "2026-04-08T09:00:00-04:00" },
  { round: 5, open: "2026-04-08T09:30:00-04:00", close: "2026-04-08T21:00:00-04:00" },
];

const MASTERS_FIELD_NAMES = [
  "Scottie Scheffler", "Xander Schauffele", "Rory McIlroy", "Jon Rahm",
  "Collin Morikawa", "Ludvig Åberg", "Bryson DeChambeau", "Hideki Matsuyama",
  "Patrick Cantlay", "Viktor Hovland", "Tommy Fleetwood", "Wyndham Clark",
  "Sam Burns", "Shane Lowry", "Max Homa", "Sungjae Im",
  "Justin Thomas", "Matt Fitzpatrick", "Jordan Spieth", "Russell Henley",
  "Robert MacIntyre", "Corey Conners", "Keegan Bradley", "Jason Day",
  "Brooks Koepka", "Cameron Smith", "Min Woo Lee", "Tyrrell Hatton",
  "Adam Scott", "Cameron Young", "Akshay Bhatia", "Nicolai Højgaard",
  "Sepp Straka", "Dustin Johnson", "Justin Rose", "Aaron Rai",
  "Harris English", "Davis Riley", "Tom McKibbin", "Ryan Fox",
  "Kurt Kitayama", "Jake Knapp", "Brian Harman", "Nick Taylor",
  "Si Woo Kim", "Alex Noren", "Rasmus Højgaard", "Chris Gotterup",
];

const MEMBER_NAMES = {
  semmer: "Will", loeb: "Chuck", marquis: "Griffin",
  pearlman: "Alex P", forde: "Sam",
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

async function getDraftState() {
  const draftDoc = await db.doc("pool/draft").get();
  const picks = draftDoc.exists ? (draftDoc.data().picks || {}) : {};
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

async function getAllPushTokens() {
  const usersSnap = await db.collection("users").get();
  const tokens = [];
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.pushToken) tokens.push({ token: data.pushToken, memberId: data.poolMemberId, uid: doc.id });
  });
  return tokens;
}

async function sendExpoPush(tokens, title, body) {
  const messages = tokens
    .filter(t => t)
    .map(token => ({ to: token, sound: "default", title, body, data: { type: "draft_update" } }));
  if (messages.length === 0) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
}

async function getDraftedGolfers() {
  const draftDoc = await db.doc("pool/draft").get();
  const picks = draftDoc.exists ? (draftDoc.data().picks || {}) : {};
  const map = {};
  Object.entries(picks).forEach(([memberId, golfers]) => {
    (golfers || []).forEach(g => { map[g.player.toLowerCase()] = memberId; });
  });
  return map;
}

// ═══════════════════════════════════════
// ROUND RESOLUTION
// ═══════════════════════════════════════

/**
 * Resolve a draft round using the proposal/bid system.
 *
 * Resolution order: resolve bids one at a time, ordered by highest bid amount
 * across ALL proposed players in the round.
 *
 * After each win, if winner's roster is full (5 golfers), auto-withdraw all
 * their remaining bids before continuing.
 *
 * Ties: random coin flip, NOT timestamp.
 */
async function resolveCurrentRound(roundNumber) {
  const { picks, budgets, rosterCounts, draftedPlayers } = await getDraftState();

  // Get all bids for this round
  const bidsSnapshot = await db.collection("bids")
    .where("round", "==", roundNumber)
    .get();

  if (bidsSnapshot.empty) {
    console.log(`No bids found for round ${roundNumber}`);
    return { resolved: 0, results: [] };
  }

  // Collect all bids into a flat list
  const allBids = [];
  bidsSnapshot.forEach(doc => {
    const bid = doc.data();
    allBids.push({
      docId: doc.id,
      memberId: bid.poolMemberId,
      amount: bid.amount,
      playerName: bid.playerName,
    });
  });

  // Group bids by player
  const bidsByPlayer = {};
  allBids.forEach(bid => {
    if (!bidsByPlayer[bid.playerName]) bidsByPlayer[bid.playerName] = [];
    bidsByPlayer[bid.playerName].push(bid);
  });

  // Create a priority queue: all bids sorted by amount desc
  // We process highest bid first across all players
  const sortedBids = [...allBids]
    .filter(b => !draftedPlayers.has(b.playerName.toLowerCase()))
    .filter(b => b.amount >= 1 && b.amount <= budgets[b.memberId])
    .sort((a, b) => b.amount - a.amount);

  const results = [];
  const resolvedPlayers = new Set(); // players already won this round
  const resolvedMembers = new Set(); // track members whose roster filled mid-resolution
  const localBudgets = { ...budgets };
  const localRosterCounts = { ...rosterCounts };

  // Process bids in order of highest amount
  while (sortedBids.length > 0) {
    // Find the highest remaining bid
    const topBid = sortedBids[0];
    const playerName = topBid.playerName;

    if (resolvedPlayers.has(playerName.toLowerCase())) {
      // Already resolved this player, skip
      sortedBids.shift();
      continue;
    }

    // Get all bids for this player that are still valid
    const playerBids = sortedBids.filter(b =>
      b.playerName === playerName &&
      !resolvedMembers.has(b.memberId) &&
      b.amount <= localBudgets[b.memberId]
    );

    if (playerBids.length === 0) {
      sortedBids.shift();
      continue;
    }

    // Find highest bid(s) for this player
    const highestAmount = Math.max(...playerBids.map(b => b.amount));
    const topBids = playerBids.filter(b => b.amount === highestAmount);

    // Coin flip for ties
    const winner = topBids.length === 1
      ? topBids[0]
      : topBids[Math.floor(Math.random() * topBids.length)];

    console.log(`${playerName}: ${winner.memberId} wins with $${winner.amount}` +
      (topBids.length > 1 ? ` (coin flip from ${topBids.length} tied bids)` : ""));

    // Award the player
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

    // Check if winner's roster is now full — auto-withdraw their remaining bids
    if (localRosterCounts[winner.memberId] >= ROSTER_SIZE) {
      resolvedMembers.add(winner.memberId);
      // Remove all remaining bids by this member from the queue
      for (let i = sortedBids.length - 1; i >= 0; i--) {
        if (sortedBids[i].memberId === winner.memberId) {
          sortedBids.splice(i, 1);
        }
      }
    }

    // Remove all bids for this resolved player from queue
    for (let i = sortedBids.length - 1; i >= 0; i--) {
      if (sortedBids[i].playerName === playerName) {
        sortedBids.splice(i, 1);
      }
    }
  }

  // Write updated picks
  await db.doc("pool/draft").set({ picks }, { merge: true });

  // Delete all bids and proposals for this round
  const batch = db.batch();
  bidsSnapshot.forEach(doc => batch.delete(doc.ref));
  const proposalsSnap = await db.collection("proposals")
    .where("round", "==", roundNumber)
    .get();
  proposalsSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // Update config
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
  }
  // After round 5, draftTick handles free agency + draft complete

  await db.doc("pool/config").set(configUpdate, { merge: true });

  // Send notification with results
  const allTokens = await getAllPushTokens();
  const tokens = allTokens.map(t => t.token);
  const resultLines = results.map(r => `${MEMBER_NAMES[r.winner] || r.winner} won ${r.player} for $${r.amount}`);
  await sendExpoPush(tokens,
    `Round ${roundNumber} Results`,
    resultLines.join("\n") || "No players awarded this round"
  );

  console.log(`Round ${roundNumber} resolved: ${results.length} players awarded`);
  return { resolved: results.length, results };
}

// Callable — trigger from CLI or Firebase console
exports.resolveRound = onCall(async (request) => {
  const roundNumber = request.data?.round;
  if (!roundNumber) throw new Error("round number required");
  return resolveCurrentRound(roundNumber);
});

// ═══════════════════════════════════════
// AUTO-PROPOSE HELPER
// ═══════════════════════════════════════

async function autoProposeMissing(roundNumber) {
  const { rosterCounts, draftedPlayers } = await getDraftState();
  const membersNeedingPicks = ALL_MEMBERS.filter(id => rosterCounts[id] < ROSTER_SIZE);

  const proposalsSnap = await db.collection("proposals")
    .where("round", "==", roundNumber)
    .get();
  const proposedMembers = new Set();
  proposalsSnap.forEach(doc => proposedMembers.add(doc.data().poolMemberId));

  let autoProposed = false;
  for (const memberId of membersNeedingPicks) {
    if (proposedMembers.has(memberId)) continue;

    const availablePlayer = MASTERS_FIELD_NAMES.find(name =>
      !draftedPlayers.has(name.toLowerCase())
    );
    if (!availablePlayer) continue;

    await db.collection("proposals").doc(`${roundNumber}_${memberId}`).set({
      poolMemberId: memberId,
      playerName: availablePlayer,
      bidAmount: 1,
      round: roundNumber,
      autoProposed: true,
      timestamp: new Date().toISOString(),
    });

    const bidDocId = `${roundNumber}_${memberId}_${availablePlayer.replace(/[^a-zA-Z0-9]/g, "_")}`;
    await db.collection("bids").doc(bidDocId).set({
      poolMemberId: memberId,
      playerName: availablePlayer,
      amount: 1,
      round: roundNumber,
      timestamp: new Date().toISOString(),
    });

    console.log(`Auto-proposed ${availablePlayer} for ${memberId} (round ${roundNumber})`);
    autoProposed = true;
  }

  if (autoProposed) {
    await db.doc("pool/config").set({ autoProposedRound: roundNumber }, { merge: true });
    const allTokens = await getAllPushTokens();
    const tokens = allTokens.map(t => t.token);
    await sendExpoPush(tokens,
      "Auto-proposals made",
      "Some members didn't propose in time. Players have been auto-proposed at $1."
    );
  }

  return autoProposed;
}

// ═══════════════════════════════════════
// AUTO-FILL ROSTERS HELPER
// ═══════════════════════════════════════

async function autoFillRostersHelper() {
  const { rosterCounts, draftedPlayers, picks } = await getDraftState();

  const needsFill = ALL_MEMBERS
    .filter(id => rosterCounts[id] < ROSTER_SIZE)
    .sort((a, b) => rosterCounts[a] - rosterCounts[b]);

  if (needsFill.length === 0) return [];

  const results = [];
  for (const memberId of needsFill) {
    while ((picks[memberId] || []).length < ROSTER_SIZE) {
      const available = MASTERS_FIELD_NAMES.find(name =>
        !draftedPlayers.has(name.toLowerCase())
      );
      if (!available) break;

      if (!picks[memberId]) picks[memberId] = [];
      picks[memberId].push({ player: available, price: 0, round: "FA" });
      draftedPlayers.add(available.toLowerCase());
      rosterCounts[memberId]++;
      results.push({ member: memberId, player: available });
    }
  }

  if (results.length > 0) {
    await db.doc("pool/draft").set({ picks }, { merge: true });
  }
  return results;
}

// ═══════════════════════════════════════
// DRAFT COMPLETE SUMMARY
// ═══════════════════════════════════════

async function sendDraftCompleteSummary() {
  const { picks, budgets } = await getDraftState();

  let summary = "The draft is complete! Final rosters:\n\n";
  const lines = [];
  for (const memberId of ALL_MEMBERS) {
    const memberPicks = picks[memberId] || [];
    const spent = TOTAL_BUDGET - budgets[memberId];
    const golferList = memberPicks.map(p => `${p.player} ($${p.price})`).join(", ");
    const line = `${MEMBER_NAMES[memberId]}: ${golferList} — $${spent} spent, $${budgets[memberId]} remaining`;
    lines.push(line);
    summary += `${line}\n`;
  }

  await db.doc("pool/draftSummary").set({
    summary,
    rosters: picks,
    budgets,
    timestamp: new Date().toISOString(),
  });

  await db.doc("pool/config").set({ phase: "DRAFT_COMPLETE" }, { merge: true });

  const allTokens = await getAllPushTokens();
  const tokens = allTokens.map(t => t.token);
  await sendExpoPush(tokens,
    "Draft complete! Final rosters are in",
    lines.join("\n")
  );

  console.log("Draft complete summary sent");
}

// ═══════════════════════════════════════
// UNIFIED DRAFT TICK — runs every 1 minute
// Handles: auto-open, auto-propose, reminder, auto-resolve, post-draft
// ═══════════════════════════════════════

exports.draftTick = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "America/New_York",
}, async () => {
  const configDoc = await db.doc("pool/config").get();
  const config = configDoc.exists ? configDoc.data() : {};
  const now = new Date();
  const phase = config.phase || "PRE_DRAFT";

  // ── 1. AUTO-OPEN: check if a round should open ──
  if (phase === "PRE_DRAFT" || (phase === "DURING_DRAFT" && config.roundResolved)) {
    const lastResolved = config.lastResolvedRound || 0;
    const nextRoundNum = lastResolved + 1;
    const schedule = DRAFT_SCHEDULE.find(s => s.round === nextRoundNum);

    if (schedule && now >= new Date(schedule.open)) {
      console.log(`Auto-opening round ${nextRoundNum}`);
      await db.doc("pool/config").set({
        phase: "DURING_DRAFT",
        currentRound: nextRoundNum,
        roundOpenTime: schedule.open,
        roundCloseTime: schedule.close,
        roundResolved: false,
        autoProposedRound: null,
        reminderSentRound: null,
      }, { merge: true });

      const allTokens = await getAllPushTokens();
      const tokens = allTokens.map(t => t.token);
      const closeFormatted = new Date(schedule.close).toLocaleString("en-US", {
        timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true, weekday: "short",
      });
      await sendExpoPush(tokens,
        `Round ${nextRoundNum} is now open!`,
        `Propose your player and place your bids. Closes ${closeFormatted}`
      );
      return; // Let the next tick handle midpoint/resolve
    }
  }

  // Everything below requires DURING_DRAFT with an active (unresolved) round
  if (phase !== "DURING_DRAFT" || config.roundResolved) return;

  const roundNumber = config.currentRound;
  if (!roundNumber) return;

  const openTime = config.roundOpenTime ? new Date(config.roundOpenTime) : null;
  const closeTime = config.roundCloseTime ? new Date(config.roundCloseTime) : null;
  if (!openTime || !closeTime) return;

  // ── 2. AUTO-PROPOSE at midpoint (6 hours in) ──
  const hoursSinceOpen = (now - openTime) / (1000 * 60 * 60);
  if (hoursSinceOpen >= 6 && config.autoProposedRound !== roundNumber) {
    console.log(`Midpoint reached for round ${roundNumber}, auto-proposing...`);
    await autoProposeMissing(roundNumber);
  }

  // ── 3. MIDPOINT REMINDER (~6 hours left) ──
  const minutesUntilClose = (closeTime - now) / (1000 * 60);
  const totalMinutes = (closeTime - openTime) / (1000 * 60);
  const midpointMinutesLeft = totalMinutes / 2;
  // Fire reminder within a 2-minute window around the midpoint
  if (config.reminderSentRound !== roundNumber &&
      minutesUntilClose <= midpointMinutesLeft + 1 &&
      minutesUntilClose >= midpointMinutesLeft - 1) {
    const hoursLeft = Math.round(minutesUntilClose / 60);
    const allTokens = await getAllPushTokens();
    const tokens = allTokens.map(t => t.token);
    await sendExpoPush(tokens,
      `${hoursLeft} hours left in Round ${roundNumber}`,
      "Don't forget to propose your player and place your bids!"
    );
    await db.doc("pool/config").set({ reminderSentRound: roundNumber }, { merge: true });
    console.log(`Midpoint reminder sent for round ${roundNumber}`);
  }

  // ── 4. AUTO-RESOLVE when close time reached ──
  if (now >= closeTime) {
    // Auto-propose for anyone who still hasn't proposed before resolving
    await autoProposeMissing(roundNumber);

    console.log(`Round ${roundNumber} close time reached, resolving...`);
    await resolveCurrentRound(roundNumber);

    // ── 5. POST-DRAFT: after round 5, handle free agency + summary ──
    if (roundNumber >= 5) {
      const { rosterCounts } = await getDraftState();
      const needsFreeAgency = ALL_MEMBERS.some(id => rosterCounts[id] < ROSTER_SIZE);

      if (needsFreeAgency) {
        console.log("Round 5 resolved — auto-filling incomplete rosters via free agency...");
        const filled = await autoFillRostersHelper();
        if (filled.length > 0) {
          const allTokens = await getAllPushTokens();
          const tokens = allTokens.map(t => t.token);
          const fillLines = filled.map(f => `${MEMBER_NAMES[f.member]}: ${f.player} (FA)`);
          await sendExpoPush(tokens,
            "Free agency auto-fill complete",
            fillLines.join("\n")
          );
        }
      }

      await sendDraftCompleteSummary();
    }
  }
});

// ═══════════════════════════════════════
// OPEN DRAFT ROUND
// ═══════════════════════════════════════

exports.openDraftRound = onCall(async (request) => {
  const { round } = request.data || {};
  if (!round) throw new Error("round required");

  const schedule = DRAFT_SCHEDULE.find(s => s.round === round);
  if (!schedule) throw new Error(`No schedule for round ${round}`);

  await db.doc("pool/config").set({
    phase: "DURING_DRAFT",
    currentRound: round,
    roundOpenTime: schedule.open,
    roundCloseTime: schedule.close,
    roundResolved: false,
    autoProposedRound: null,
  }, { merge: true });

  // Send notification
  const allTokens = await getAllPushTokens();
  const tokens = allTokens.map(t => t.token);
  await sendExpoPush(tokens,
    `Round ${round} is now open!`,
    `Propose your player and place your bids. Closes ${new Date(schedule.close).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true, weekday: "short" })}`
  );

  return { success: true, message: `Round ${round} open, closes at ${schedule.close}` };
});

// ═══════════════════════════════════════
// AUTO-FILL FREE AGENCY (manual override)
// ═══════════════════════════════════════

exports.autoFillRosters = onCall(async (request) => {
  const results = await autoFillRostersHelper();
  await db.doc("pool/config").set({ phase: "DRAFT_COMPLETE" }, { merge: true });
  console.log(`Auto-filled ${results.length} roster spots`);
  return { filled: results.length, results };
});

// ═══════════════════════════════════════
// PUSH NOTIFICATIONS — Score monitoring
// ═══════════════════════════════════════
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

// Check scores every 5 minutes during tournament — birdie/eagle alerts for your golfers
exports.monitorScores = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "America/New_York",
}, async () => {
  const configDoc = await db.doc("pool/config").get();
  const config = configDoc.exists ? configDoc.data() : {};
  if (config.phase !== "TOURNAMENT") return;

  try {
    const res = await fetch(ESPN_URL);
    const data = await res.json();
    if (!data.events || data.events.length === 0) return;

    const event = data.events[0];
    if (!event.name.toLowerCase().includes("masters")) return;

    const competition = event.competitions[0];
    const competitors = competition.competitors || [];

    // Get last known hole-by-hole state
    const stateDoc = await db.doc("pool/scoreState").get();
    const lastState = stateDoc.exists ? (stateDoc.data() || {}) : {};
    const lastHoles = lastState.holes || {};

    const draftedGolfers = await getDraftedGolfers();
    const allTokens = await getAllPushTokens();

    const newHoles = {};
    const notifications = [];

    for (const c of competitors) {
      const name = c.athlete?.displayName;
      if (!name) continue;

      const ownerId = draftedGolfers[name.toLowerCase()];
      if (!ownerId) continue;

      const score = typeof c.score === "string" ? c.score : String(c.score);
      const rounds = c.linescores || [];
      const currentRound = rounds[rounds.length - 1];
      if (!currentRound || !currentRound.linescores) continue;

      const holeScores = currentRound.linescores;
      const lastPlayerHoles = lastHoles[name] || {};
      const lastHoleCount = lastPlayerHoles.holesPlayed || 0;
      const currentHoleCount = holeScores.length;

      newHoles[name] = { holesPlayed: currentHoleCount, roundIndex: rounds.length };

      if (currentHoleCount > lastHoleCount && lastPlayerHoles.roundIndex === rounds.length) {
        for (let i = lastHoleCount; i < currentHoleCount; i++) {
          const hole = holeScores[i];
          const toPar = hole.scoreType?.displayValue || "E";
          const holeNum = hole.period;

          const ownerTokens = allTokens.filter(t => t.memberId === ownerId).map(t => t.token);

          if (toPar === "-2" || parseInt(toPar) <= -2) {
            const label = parseInt(toPar) <= -3 ? "ALBATROSS" : "EAGLE";
            notifications.push({
              tokens: ownerTokens,
              title: `${name} — ${label} on ${holeNum}!`,
              body: `${hole.displayValue} on hole ${holeNum} (${score} overall)`,
            });
          } else if (toPar === "-1") {
            notifications.push({
              tokens: ownerTokens,
              title: `${name} — Birdie on ${holeNum}`,
              body: `${hole.displayValue} on hole ${holeNum} (${score} overall)`,
            });
          }
          if (hole.value === 1) {
            const allT = allTokens.map(t => t.token);
            notifications.push({
              tokens: allT,
              title: `HOLE IN ONE! ${name} on ${holeNum}!`,
              body: `Ace on hole ${holeNum}!`,
            });
          }
        }
      }
    }

    await db.doc("pool/scoreState").set({
      holes: newHoles,
      lastChecked: new Date().toISOString(),
    });

    for (const notif of notifications) {
      await sendExpoPush(notif.tokens, notif.title, notif.body);
    }

    if (notifications.length > 0) {
      console.log(`Sent ${notifications.length} birdie/eagle notifications`);
    }
  } catch (e) {
    console.error("Score monitor error:", e);
  }
});

// ═══════════════════════════════════════
// END-OF-DAY SUMMARY
// ═══════════════════════════════════════

exports.endOfDaySummary = onSchedule({
  schedule: "0 20 * * *",
  timeZone: "America/New_York",
}, async () => {
  const configDoc = await db.doc("pool/config").get();
  const config = configDoc.exists ? configDoc.data() : {};
  if (config.phase !== "TOURNAMENT") return;

  try {
    const res = await fetch(ESPN_URL);
    const data = await res.json();
    if (!data.events || data.events.length === 0) return;

    const event = data.events[0];
    if (!event.name.toLowerCase().includes("masters")) return;

    const competition = event.competitions[0];
    const competitors = competition.competitors || [];

    const draftDoc = await db.doc("pool/draft").get();
    const picks = draftDoc.exists ? (draftDoc.data().picks || {}) : {};

    const teams = [];
    for (const [memberId, golfers] of Object.entries(picks)) {
      let teamSummary = [];
      for (const g of golfers) {
        const onBoard = competitors.find(c =>
          c.athlete?.displayName?.toLowerCase() === g.player.toLowerCase()
        );
        const score = onBoard ? (typeof onBoard.score === "string" ? onBoard.score : String(onBoard.score)) : "?";
        const pos = onBoard ? onBoard.order : "?";
        teamSummary.push(`${g.player}: ${score} (${pos})`);
      }
      teams.push({ memberId, name: MEMBER_NAMES[memberId] || memberId, golfers: teamSummary });
    }

    const roundNum = competition.status?.period || "?";
    let summary = `Masters Day ${roundNum} Recap\n\n`;

    const sorted = [...competitors].sort((a, b) => (a.order || 999) - (b.order || 999));
    summary += "Leaderboard:\n";
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const c = sorted[i];
      const score = typeof c.score === "string" ? c.score : String(c.score);
      summary += `  ${i + 1}. ${c.athlete?.displayName} (${score})\n`;
    }

    summary += "\nPool Teams:\n";
    for (const team of teams) {
      summary += `\n${team.name}:\n`;
      for (const g of team.golfers) {
        summary += `  ${g}\n`;
      }
    }

    const allTokens = await getAllPushTokens();
    const tokens = allTokens.map(t => t.token);

    await sendExpoPush(tokens,
      `Masters Day ${roundNum} Recap`,
      `Tap to see the full day ${roundNum} summary`
    );

    await db.doc("pool/daySummary").set({
      round: roundNum,
      summary,
      timestamp: new Date().toISOString(),
    });

    console.log("End-of-day summary sent");
  } catch (e) {
    console.error("End-of-day summary error:", e);
  }
});
