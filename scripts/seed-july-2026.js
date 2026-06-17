/**
 * Seed script: June 1–16, 2026 data for all workers
 *
 * Writes to:
 *   shifts/{shiftId}                          — completed shifts for working days
 *   users/{uid}/attendance/{YYYY-MM-DD}       — approved attendance for working days
 *   users/{uid}/payroll/2026-06               — monthly payroll summary
 *   users/{uid}/moods/{YYYY-MM-DD}            — daily mood for all 16 days
 *
 * Usage:
 *   node scripts/seed-july-2026.js /absolute/path/to/serviceAccount.json
 */

const fs   = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);
if (!serviceAccountPath) {
  console.error("Usage: node scripts/seed-july-2026.js /path/to/serviceAccount.json");
  process.exit(1);
}
const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found: ${resolvedPath}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(resolvedPath)) });
const db = admin.firestore();

// ─── helpers ────────────────────────────────────────────────────────────────

const pad = v => String(v).padStart(2, "0");

const seededRand = seed => {
  let s = ((seed % 2147483647) + 2147483647) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

const hashStr = str =>
  Array.from(str).reduce((a, c) => a + c.charCodeAt(0), 0);

const minutesToTime = mins =>
  `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

const timeToTs = (dateStr, time) => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

// ─── date range ─────────────────────────────────────────────────────────────

const ALL_DATES = Array.from({ length: 16 }, (_, i) => `2026-06-${pad(1 + i)}`);

const isWeekend = dateStr => {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
};

const WORK_DATES = ALL_DATES.filter(d => !isWeekend(d));
// Jun 1,2,3,4,5,8,9,10,11,12,15,16  (12 days)

// ─── mood helpers ────────────────────────────────────────────────────────────

const MOODS      = ["awful", "sad", "okay", "good", "great"];
const MOOD_NOTES = {
  awful: ["Really tough day today.", "Feeling really drained.", "Hope tomorrow is better."],
  sad:   ["Not in the best mood.", "Things felt heavy today.", "Just a rough one."],
  okay:  ["Pretty average day.", "Nothing special, just work.", "Got through it."],
  good:  ["Had a productive day!", "Things went well today.", "Feeling alright!"],
  great: ["Amazing day at work!", "Feeling on top of things!", "Super motivated today!"],
};

const pickMood = (rand, dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = d.getDay(); // 0=Sun 1=Mon … 6=Sat
  // Weight by day-of-week: Mon=more tired, Wed/Thu=better, Fri/wknd=happy
  const weights = dow === 1
    ? [5, 15, 30, 35, 15]   // Mon
    : dow === 5 || dow === 6 || dow === 0
    ? [2, 5, 20, 40, 33]    // Fri/wknd
    : [3, 8, 25, 40, 24];   // Tue–Thu
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < MOODS.length; i++) {
    r -= weights[i];
    if (r <= 0) return MOODS[i];
  }
  return "okay";
};

// ─── per-worker seed ─────────────────────────────────────────────────────────

async function seedWorker(doc, workerIndex) {
  const uid  = doc.id;
  const data = doc.data();
  const hourlyRate = Number(data.hourlyRate) || 12;
  const rand = seededRand(hashStr(uid) + workerIndex * 997);

  const writes  = [];
  let totalHours    = 0;
  let totalOT       = 0;
  let absences      = 0;

  // ── attendance + shifts (weekdays only) ────────────────────────────────────
  for (const [i, date] of WORK_DATES.entries()) {
    // randomise clock-in between 08:45 and 09:15
    const inOffset  = Math.floor(rand() * 30) - 15;         // -15 … +15 relative to 09:00
    const clockInM  = 9 * 60 + inOffset;                    // 08:45 – 09:15
    const clockIn   = minutesToTime(clockInM);

    const breakStartM = 12 * 60;                            // 12:00
    const breakEndM   = 13 * 60;                            // 13:00
    const breakMins   = 60;

    // clock-out: 17:50 – 18:30
    const outOffset = Math.floor(rand() * 40) + 50;         // +50…+90 mins past 17:00
    const clockOutM = 17 * 60 + outOffset;
    const clockOut  = minutesToTime(clockOutM);

    const grossHours = (clockOutM - clockInM) / 60;
    const netHours   = Math.max(0, grossHours - breakMins / 60);
    const regularH   = Math.min(netHours, 8);
    const otHours    = Math.max(0, netHours - 8);

    totalHours += netHours;
    totalOT    += otHours;

    const att = {
      date,
      workerId: uid,
      clockIn,
      clockOut,
      clockInTs:    timeToTs(date, clockIn),
      clockOutTs:   timeToTs(date, clockOut),
      breakStart:   minutesToTime(breakStartM),
      breakEnd:     minutesToTime(breakEndM),
      breakStartTs: timeToTs(date, minutesToTime(breakStartM)),
      breakEndTs:   timeToTs(date, minutesToTime(breakEndM)),
      breakMinutes: breakMins,
      hours:        Number(netHours.toFixed(2)),
      status:       "approved",
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
    };

    writes.push(
      db.collection("users").doc(uid)
        .collection("attendance").doc(date)
        .set(att, { merge: true })
    );

    const shift = {
      workerId: uid,
      date,
      start:   minutesToTime(9 * 60),
      end:     minutesToTime(18 * 60),
      hours:   8,
      type:    "normal",
      role:    "Shift",
      location: "Main Branch",
      status:  "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    writes.push(db.collection("shifts").add(shift));
  }

  // ── payroll 2026-06 ────────────────────────────────────────────────────────
  const baseEarnings = totalHours * hourlyRate;
  const otPay        = totalOT   * hourlyRate * 1.5;
  const payroll = {
    workerId:          uid,
    period:            "2026-06",
    totalHours:        Number(totalHours.toFixed(2)),
    overtimeHours:     Number(totalOT.toFixed(2)),
    totalEarnings:     Number((baseEarnings + otPay).toFixed(2)),
    absenceDeductions: absences,
    status:            "verified",
    updatedAt:         new Date().toISOString(),
  };
  writes.push(
    db.collection("users").doc(uid)
      .collection("payroll").doc("2026-06")
      .set(payroll, { merge: true })
  );

  // ── moods (all 16 days) ────────────────────────────────────────────────────
  for (const date of ALL_DATES) {
    const moodKey = pickMood(rand, date);
    const notes   = MOOD_NOTES[moodKey];
    const note    = notes[Math.floor(rand() * notes.length)];
    const moodDoc = {
      mood:      moodKey,
      note,
      timestamp: admin.firestore.Timestamp.fromDate(new Date(`${date}T12:00:00`)),
    };
    writes.push(
      db.collection("users").doc(uid)
        .collection("moods").doc(date)
        .set(moodDoc, { merge: true })
    );
  }

  await Promise.all(writes);
  console.log(
    `✓ ${data.fullName || uid} — ${WORK_DATES.length} days, ` +
    `${totalHours.toFixed(1)}h, RM${(baseEarnings + otPay).toFixed(2)}`
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  const snap = await db.collection("users").where("role", "==", "worker").get();
  if (snap.empty) { console.log("No workers found."); return; }

  console.log(`Seeding ${snap.size} workers for June 1–16, 2026…\n`);
  for (const [i, doc] of snap.docs.entries()) {
    await seedWorker(doc, i);
  }
  console.log("\nDone! All data saved to Firebase.");
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error("Error:", err); process.exit(1); });
