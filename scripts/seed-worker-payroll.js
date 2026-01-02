const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, workerId] = process.argv.slice(2);

if (!serviceAccountPath || !workerId) {
  console.error(
    "Usage: node scripts/seed-worker-payroll.js /absolute/path/to/serviceAccount.json WORKER_UID"
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

async function seed() {
  const period = getPeriodKey(new Date());
  const payrollRef = db
    .collection("users")
    .doc(workerId)
    .collection("payroll")
    .doc(period);

  await payrollRef.set(
    {
      workerId,
      period,
      totalHours: 120,
      overtimeHours: 8,
      totalEarnings: 1280,
      absenceDeductions: 1,
      status: "pending",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log("Seeded payroll for worker:", workerId, period);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
