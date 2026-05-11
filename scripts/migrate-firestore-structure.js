const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/migrate-firestore-structure.js /absolute/path/to/serviceAccount.json"
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

const toDocId = (value) => String(value || "").trim();
const safeArray = (value) => (Array.isArray(value) ? value : []);

const migrateConfig = async () => {
  const systemRef = db.collection("config").doc("system");
  const snap = await systemRef.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  const rulesRef = systemRef.collection("rules").doc("default");
  const limitsRef = systemRef.collection("limits").doc("default");

  await rulesRef.set(
    {
      payType: data.payType ?? "hourly",
      dailyRate: Number(data.dailyRate ?? 0),
      dailyMinHours: Number(data.dailyMinHours ?? 0),
      dailyProrate: Boolean(data.dailyProrate ?? false),
      otAfterHours: Number(data.otAfterHours ?? 0),
      otMultiplier: Number(data.otMultiplier ?? 0),
      breakPaid: Boolean(data.breakPaid ?? false),
      breakFixedMinutes: Number(data.breakFixedMinutes ?? 0),
      autoBreak: Boolean(data.autoBreak ?? true),
      roundingMinutes: Number(data.roundingMinutes ?? 0),
      roundingMode: data.roundingMode ?? "nearest",
      roundingScope: data.roundingScope ?? "net",
      lateGraceMinutes: Number(data.lateGraceMinutes ?? 0),
      earlyGraceMinutes: Number(data.earlyGraceMinutes ?? 0),
      weekendMultiplier: Number(data.weekendMultiplier ?? 0),
      holidayMultiplier: Number(data.holidayMultiplier ?? 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await limitsRef.set(
    {
      allowedStart: data.allowedStart ?? "",
      allowedEnd: data.allowedEnd ?? "",
      maxHoursPerDay: Number(data.maxHoursPerDay ?? 0),
      maxHoursPerWeek: Number(data.maxHoursPerWeek ?? 0),
      minRestHours: Number(data.minRestHours ?? 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const holidays = safeArray(data.holidays);
  if (holidays.length) {
    const batch = db.batch();
    holidays.forEach((date) => {
      const docId = toDocId(date);
      if (!docId) return;
      batch.set(systemRef.collection("holidays").doc(docId), {
        date: docId,
        active: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
};

const migrateScheduleAssignments = async () => {
  const usersSnap = await db.collection("users").get();
  const batch = db.batch();
  usersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const scheduleId = toDocId(data.scheduleId);
    if (!scheduleId) return;
    const assignRef = db
      .collection("workSchedules")
      .doc(scheduleId)
      .collection("assignments")
      .doc(docSnap.id);
    batch.set(
      assignRef,
      {
        workerId: docSnap.id,
        scheduleId,
        scheduleName: data.scheduleName ?? "",
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
};

const migrateUserShifts = async () => {
  const shiftsSnap = await db.collection("shifts").get();
  const batch = db.batch();
  shiftsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const workerId = toDocId(data.workerId);
    if (!workerId) return;
    const targetRef = db
      .collection("users")
      .doc(workerId)
      .collection("shifts")
      .doc(docSnap.id);
    batch.set(
      targetRef,
      {
        ...data,
        shiftId: docSnap.id,
        source: "shifts",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
};

const migrateUserNotifications = async () => {
  const notificationsSnap = await db.collection("notifications").get();
  const batch = db.batch();
  notificationsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const workerId = toDocId(data.workerId);
    if (!workerId) return;
    const targetRef = db
      .collection("users")
      .doc(workerId)
      .collection("notifications")
      .doc(docSnap.id);
    batch.set(
      targetRef,
      {
        ...data,
        notificationId: docSnap.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
};

const migrateAuditLogs = async () => {
  const auditSnap = await db.collection("auditLogs").get();
  const batch = db.batch();
  auditSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const workerId = toDocId(data.workerId);
    if (!workerId) return;
    const targetRef = db
      .collection("users")
      .doc(workerId)
      .collection("audit")
      .doc(docSnap.id);
    batch.set(
      targetRef,
      {
        ...data,
        auditId: docSnap.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
};

const run = async () => {
  await migrateConfig();
  await migrateScheduleAssignments();
  await migrateUserShifts();
  await migrateUserNotifications();
  await migrateAuditLogs();
  console.log("Migration complete.");
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
