const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, periodArg] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/audit-attendance-shifts.js /absolute/path/to/serviceAccount.json [YYYY-MM]"
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

const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const period = periodArg || getCurrentPeriod();
const inPeriod = date => String(date || "").startsWith(period);

async function run() {
  const workersSnap = await db.collection("users").where("role", "==", "worker").get();
  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }

  const issues = [];

  for (const docSnap of workersSnap.docs) {
    const workerId = docSnap.id;
    const workerData = docSnap.data() || {};
    const name =
      workerData.fullName ||
      workerData.displayName ||
      workerData.email ||
      workerId;

    const shiftsSnap = await db.collection("shifts").where("workerId", "==", workerId).get();
    const shifts = shiftsSnap.docs.map(doc => doc.data()).filter(s => inPeriod(s.date));
    const attendanceSnap = await db
      .collection("users")
      .doc(workerId)
      .collection("attendance")
      .get();
    const attendance = attendanceSnap.docs
      .map(doc => doc.data())
      .filter(a => inPeriod(a.date));
    const approved = attendance.filter(
      log => String(log.status || "") === "approved"
    );

    const shiftDates = shifts.map(s => String(s.date || "")).sort();
    const attendanceDates = approved.map(a => String(a.date || "")).sort();
    const shiftSet = new Set(shiftDates);
    const attendanceSet = new Set(attendanceDates);
    const missingAttendance = shiftDates.filter(d => !attendanceSet.has(d));
    const missingShift = attendanceDates.filter(d => !shiftSet.has(d));
    const shiftHours = shifts.reduce((sum, s) => sum + Number(s.hours || 0), 0);
    const attendanceHours = approved.reduce(
      (sum, a) => sum + Number(a.netHours || a.hours || 0),
      0
    );

    if (
      missingAttendance.length ||
      missingShift.length ||
      Math.abs(shiftHours - attendanceHours) > 0.01
    ) {
      issues.push({
        workerId,
        name,
        shiftCount: shifts.length,
        attendanceCount: approved.length,
        shiftHours: Number(shiftHours.toFixed(2)),
        attendanceHours: Number(attendanceHours.toFixed(2)),
        missingAttendance,
        missingShift,
      });
    }
  }

  if (issues.length === 0) {
    console.log(`Audit OK for ${period}. No mismatches found.`);
    return;
  }

  const summary = issues
    .map(item => `${item.name}: shifts ${item.shiftCount}, attendance ${item.attendanceCount}`)
    .join(" | ");

  await db.collection("adminAudits").doc(period).set(
    {
      period,
      status: "mismatch",
      issueCount: issues.length,
      issues,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("notifications").add({
    type: "system",
    title: "Attendance vs Shifts Audit",
    message: `Found ${issues.length} mismatch(es) for ${period}. ${summary}`,
    status: "info",
    targetRole: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Audit completed. Mismatches found: ${issues.length}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Audit failed:", err);
    process.exit(1);
  });
