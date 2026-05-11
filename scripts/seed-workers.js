const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/seed-workers.js /absolute/path/to/serviceAccount.json"
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

const defaults = [
  {
    fullName: "Alya Rahman",
    email: "alya.rahman@spendly.local",
    phone: "+60 12-345 7781",
    position: "Cashier",
    hourlyRate: 10,
  },
  {
    fullName: "Faris Hakim",
    email: "faris.hakim@spendly.local",
    phone: "+60 12-345 7782",
    position: "Server",
    hourlyRate: 11,
  },
  {
    fullName: "Nadia Azmi",
    email: "nadia.azmi@spendly.local",
    phone: "+60 12-345 7783",
    position: "Kitchen",
    hourlyRate: 12,
  },
];

async function seed() {
  const existing = await db.collection("users").get();
  const emailSet = new Set(
    existing.docs.map(docSnap => String(docSnap.data().email || "").toLowerCase())
  );

  const writes = defaults.map(worker => {
    if (emailSet.has(worker.email.toLowerCase())) {
      return Promise.resolve();
    }
    return db.collection("users").add({
      role: "worker",
      status: "active",
      joinDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...worker,
    });
  });

  await Promise.all(writes);
  console.log("Seeded default workers (if missing).");
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
