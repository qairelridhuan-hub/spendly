const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/seed-payroll-history.js /absolute/path/to/serviceAccount.json"
  );
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found: ${resolvedPath}`);
  process.exit(1);
}

const serviceAccount = require(resolvedPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const pad = value => String(value).padStart(2, "0");
const getPeriodKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const getLastPeriods = count => {
  const periods = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 0; i < count; i += 1) {
    periods.push(getPeriodKey(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return periods;
};

async function seed() {
  const workersSnap = await db
    .collection("users")
    .where("role", "==", "worker")
    .get();
  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }

  const periods = getLastPeriods(4);
  const writes = [];

  workersSnap.forEach(docSnap => {
    const workerId = docSnap.id;
    periods.forEach((period, index) => {
      const payrollRef = db
        .collection("users")
        .doc(workerId)
        .collection("payroll")
        .doc(period);
      const baseHours = 120 - index * 6;
      const overtime = Math.max(0, 8 - index * 2);
      const totalHours = baseHours + overtime;
      const totalEarnings = totalHours * 10 + overtime * 5;
      writes.push(
        payrollRef.set(
          {
            workerId,
            period,
            totalHours,
            overtimeHours: overtime,
            totalEarnings,
            absenceDeductions: index === 1 ? 1 : 0,
            status: "pending",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      );
    });
  });

  await Promise.all(writes);
  console.log("Seeded payroll history for all workers.");
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
