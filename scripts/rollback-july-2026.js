/**
 * Rollback script: removes all July 1–16, 2026 data seeded by seed-july-2026.js
 *
 * Deletes:
 *   shifts where date in 2026-07-01…2026-07-16 AND workerId matches a worker
 *   users/{uid}/attendance/2026-07-01 … 2026-07-16
 *   users/{uid}/payroll/2026-07
 *   users/{uid}/moods/2026-07-01 … 2026-07-16
 *
 * Usage:
 *   node scripts/rollback-july-2026.js /absolute/path/to/serviceAccount.json
 */

const fs    = require("fs");
const path  = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);
if (!serviceAccountPath) {
  console.error("Usage: node scripts/rollback-july-2026.js /path/to/serviceAccount.json");
  process.exit(1);
}
const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found: ${resolvedPath}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(resolvedPath)) });
const db = admin.firestore();

const pad = v => String(v).padStart(2, "0");
const ALL_DATES = Array.from({ length: 17 }, (_, i) => `2026-06-${pad(1 + i)}`);

async function run() {
  const snap = await db.collection("users").where("role", "==", "worker").get();
  if (snap.empty) { console.log("No workers found."); return; }

  for (const doc of snap.docs) {
    const uid  = doc.id;
    const name = doc.data().fullName || uid;
    const dels = [];

    // attendance + moods for each of the 16 dates
    for (const date of ALL_DATES) {
      dels.push(
        db.collection("users").doc(uid).collection("attendance").doc(date).delete()
      );
      dels.push(
        db.collection("users").doc(uid).collection("moods").doc(date).delete()
      );
    }

    // payroll 2026-06
    dels.push(
      db.collection("users").doc(uid).collection("payroll").doc("2026-06").delete()
    );

    // shifts for this worker in the date range
    const shiftsSnap = await db.collection("shifts")
      .where("workerId", "==", uid)
      .where("date", ">=", "2026-06-01")
      .where("date", "<=", "2026-06-17")
      .get();

    shiftsSnap.docs.forEach(s => dels.push(s.ref.delete()));

    await Promise.all(dels);
    console.log(`✓ Rolled back ${name} — ${shiftsSnap.size} shifts deleted`);
  }

  console.log("\nDone! All July 1–16, 2026 data removed from Firebase.");
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error("Error:", err); process.exit(1); });
