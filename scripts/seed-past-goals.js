/* eslint-disable no-console */
const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/seed-past-goals.js <workerUid>");
  process.exit(1);
}

const pastGoals = [
  {
    name: "Emergency cushion",
    targetAmount: 300,
    savedAmount: 300,
    deadline: "2024-08-15",
    priority: "high",
    notes: "First safety net goal completed.",
  },
  {
    name: "Tablet for class",
    targetAmount: 1200,
    savedAmount: 1200,
    deadline: "2024-10-10",
    priority: "medium",
    notes: "Purchased after mid-semester savings.",
  },
  {
    name: "Travel fund",
    targetAmount: 800,
    savedAmount: 650,
    deadline: "2024-11-20",
    priority: "low",
    notes: "Paused for a bigger goal, still short.",
  },
];

const now = admin.firestore.Timestamp.now();

async function run() {
  const batch = db.batch();
  pastGoals.forEach(goal => {
    const ref = db.collection("users").doc(uid).collection("goals").doc();
    batch.set(ref, {
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      priority: goal.priority,
      notes: goal.notes,
      createdAt: now,
      updatedAt: now,
    });
  });
  await batch.commit();
  console.log(`Seeded ${pastGoals.length} past goals for ${uid}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
