const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, outputPathArg] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/backup-firestore.js /absolute/path/to/serviceAccount.json [output.json]"
  );
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found: ${resolvedPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(resolvedPath)),
});

const db = admin.firestore();
const outputPath =
  outputPathArg ||
  path.resolve(
    process.cwd(),
    `scripts/firestore-backup-${new Date().toISOString().slice(0, 10)}.json`
  );

const getDocs = async (queryRef) => {
  const snapshot = await queryRef.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const backup = async () => {
  const data = {
    config: {},
    workSchedules: [],
    shifts: [],
    notifications: [],
    auditLogs: [],
    users: [],
    exportedAt: new Date().toISOString(),
  };

  const configSnap = await db.collection("config").doc("system").get();
  data.config.system = configSnap.exists ? configSnap.data() : null;

  data.workSchedules = await getDocs(db.collection("workSchedules"));
  data.shifts = await getDocs(db.collection("shifts"));
  data.notifications = await getDocs(db.collection("notifications"));
  data.auditLogs = await getDocs(db.collection("auditLogs"));

  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const attendance = await getDocs(
      db.collection("users").doc(userId).collection("attendance")
    );
    const breaks = await getDocs(
      db.collection("users").doc(userId).collection("breaks")
    );
    const overtime = await getDocs(
      db.collection("users").doc(userId).collection("overtime")
    );
    const notifications = await getDocs(
      db.collection("users").doc(userId).collection("notifications")
    );
    const payroll = await getDocs(
      db.collection("users").doc(userId).collection("payroll")
    );
    const audit = await getDocs(
      db.collection("users").doc(userId).collection("audit")
    );

    data.users.push({
      id: userId,
      ...userData,
      attendance,
      breaks,
      overtime,
      notifications,
      payroll,
      audit,
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Backup written to ${outputPath}`);
};

backup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
