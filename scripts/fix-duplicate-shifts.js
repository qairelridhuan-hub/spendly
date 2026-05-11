const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, startDateArg, endDateArg] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/fix-duplicate-shifts.js /absolute/path/to/serviceAccount.json [YYYY-MM-DD] [YYYY-MM-DD]"
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

const parseDateArg = value => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
};

const startDate = parseDateArg(startDateArg);
const endDate = parseDateArg(endDateArg);
if ((startDateArg && !startDate) || (endDateArg && !endDate)) {
  console.error("Invalid date format. Use YYYY-MM-DD for start and end.");
  process.exit(1);
}
if ((startDate && !endDate) || (!startDate && endDate)) {
  console.error("Provide both start and end dates, or neither.");
  process.exit(1);
}

const inRange = (date, start, end) => {
  if (!start || !end) return true;
  return date >= start && date <= end;
};

const parseStartMinutes = time => {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getShiftStatusFromAttendance = status => {
  if (status === "approved") return "completed";
  if (status === "absent") return "absent";
  if (status === "pending") return "scheduled";
  if (status === "rejected") return "scheduled";
  return null;
};

async function fixWorker(workerId) {
  const shiftsSnap = await db.collection("shifts").where("workerId", "==", workerId).get();
  const attendanceSnap = await db
    .collection("users")
    .doc(workerId)
    .collection("attendance")
    .get();

  const attendanceByDate = new Map();
  attendanceSnap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const date = String(data.date ?? docSnap.id);
    if (!date || !inRange(date, startDate, endDate)) return;
    attendanceByDate.set(date, data);
  });

  const shiftsByDate = new Map();
  shiftsSnap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const date = String(data.date ?? "");
    if (!date || !inRange(date, startDate, endDate)) return;
    if (!shiftsByDate.has(date)) shiftsByDate.set(date, []);
    shiftsByDate.get(date).push({ id: docSnap.id, ref: docSnap.ref, data });
  });

  const deletes = [];
  const updates = [];

  shiftsByDate.forEach((items, date) => {
    if (items.length === 0) return;
    items.sort((a, b) => parseStartMinutes(a.data.start) - parseStartMinutes(b.data.start));
    const keep = items[0];
    const duplicates = items.slice(1);
    duplicates.forEach(item => deletes.push(item.ref));

    const attendance = attendanceByDate.get(date);
    if (attendance) {
      const nextStatus = getShiftStatusFromAttendance(String(attendance.status ?? ""));
      const attendanceHours = Number(attendance.hours ?? 0);
      const updateData = {};
      if (nextStatus && keep.data.status !== nextStatus) {
        updateData.status = nextStatus;
      }
      if (attendanceHours > 0 && Number(keep.data.hours ?? 0) !== attendanceHours) {
        updateData.hours = attendanceHours;
      }
      if (Object.keys(updateData).length) {
        updates.push({ ref: keep.ref, data: updateData });
      }
    } else {
      deletes.push(keep.ref);
    }
  });

  attendanceByDate.forEach((attendance, date) => {
    if (shiftsByDate.has(date)) return;
    const attendanceStatus = String(attendance.status ?? "");
    if (attendanceStatus !== "approved") return;
    const start = String(attendance.clockIn ?? "09:00");
    const end = String(attendance.clockOut ?? "17:00");
    const hours = Number(attendance.hours ?? 0) || Number(attendance.netHours ?? 0) || 0;
    const shift = {
      workerId,
      date,
      start,
      end,
      hours,
      type: "normal",
      role: "Shift",
      location: "Main Branch",
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = db.collection("shifts").doc();
    updates.push({ ref, data: shift, create: true });
  });

  let batch = db.batch();
  let ops = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const ref of deletes) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) await commitBatch();
  }
  for (const update of updates) {
    if (update.create) {
      batch.set(update.ref, update.data);
    } else {
      batch.update(update.ref, update.data);
    }
    ops += 1;
    if (ops >= 450) await commitBatch();
  }
  await commitBatch();

  return { deleted: deletes.length, updated: updates.length };
}

async function run() {
  const workersSnap = await db.collection("users").where("role", "==", "worker").get();
  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }
  let totalDeleted = 0;
  let totalUpdated = 0;
  for (const docSnap of workersSnap.docs) {
    const workerId = docSnap.id;
    const result = await fixWorker(workerId);
    totalDeleted += result.deleted;
    totalUpdated += result.updated;
  }
  console.log(`Removed duplicate shifts: ${totalDeleted}`);
  console.log(`Updated shift statuses: ${totalUpdated}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Fix failed:", err);
    process.exit(1);
  });
