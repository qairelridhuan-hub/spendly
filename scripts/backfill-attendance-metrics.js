const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/backfill-attendance-metrics.js /absolute/path/to/serviceAccount.json"
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

const DEFAULT_POLICY = {
  payType: "hourly",
  dailyRate: 0,
  dailyMinHours: 6,
  dailyProrate: false,
  otAfterHours: 8,
  otMultiplier: 1.5,
  overtimeRate: 0,
  breakPaid: false,
  breakFixedMinutes: 0,
  autoBreak: true,
  roundingMinutes: 15,
  roundingMode: "nearest",
  roundingScope: "net",
  lateGraceMinutes: 5,
  earlyGraceMinutes: 5,
  weekendMultiplier: 1.25,
  holidayMultiplier: 2,
  holidays: [],
};

const parseTimeToMinutes = time => {
  if (!time) return null;
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const calcMinutesDiff = (start, end) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
};

const calcHoursFromTimes = (start, end, breakMinutes = 0) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes - breakMinutes) / 60;
};

const roundMinutes = (minutes, interval, mode) => {
  if (!interval || interval <= 1) return minutes;
  const factor = minutes / interval;
  if (mode === "floor") return Math.floor(factor) * interval;
  if (mode === "ceil") return Math.ceil(factor) * interval;
  return Math.round(factor) * interval;
};

const resolveBreakMinutes = (rawMinutes, manualBreakMinutes, policy) => {
  if (policy.breakPaid) return 0;
  if (manualBreakMinutes > 0) return manualBreakMinutes;
  if (policy.breakFixedMinutes > 0) return policy.breakFixedMinutes;
  if (!policy.autoBreak) return 0;
  if (rawMinutes >= 540) return 60;
  if (rawMinutes >= 360) return 30;
  return 0;
};

const resolveDayMultiplier = (dateKey, policy) => {
  if (policy.holidays.includes(dateKey)) return policy.holidayMultiplier;
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  if (day === 0 || day === 6) return policy.weekendMultiplier;
  return 1;
};

const getMinutesOfDay = ts => {
  if (!ts) return null;
  const date = new Date(ts);
  return date.getHours() * 60 + date.getMinutes();
};

const getLateMinutes = (clockInTs, plannedStart, policy) => {
  if (!clockInTs || !plannedStart) return 0;
  const plan = parseTimeToMinutes(plannedStart);
  const actual = getMinutesOfDay(clockInTs);
  if (plan === null || actual === null) return 0;
  const allowed = plan + policy.lateGraceMinutes;
  return actual > allowed ? actual - allowed : 0;
};

const getEarlyLeaveMinutes = (clockOutTs, plannedEnd, policy) => {
  if (!clockOutTs || !plannedEnd) return 0;
  const plan = parseTimeToMinutes(plannedEnd);
  const actual = getMinutesOfDay(clockOutTs);
  if (plan === null || actual === null) return 0;
  const allowed = plan - policy.earlyGraceMinutes;
  return actual < allowed ? allowed - actual : 0;
};

const computeAttendanceMetrics = ({
  clockInTs,
  clockOutTs,
  manualBreakMinutes,
  plannedStart,
  plannedEnd,
  dateKey,
  policy,
  hourlyRate,
}) => {
  const rawMinutes =
    clockInTs && clockOutTs
      ? Math.max(0, Math.round((clockOutTs - clockInTs) / 60000))
      : 0;
  const breakMinutes = resolveBreakMinutes(rawMinutes, manualBreakMinutes, policy);
  const netMinutes = Math.max(0, rawMinutes - breakMinutes);
  const roundedMinutes = roundMinutes(
    netMinutes,
    policy.roundingMinutes,
    policy.roundingMode
  );
  const netHours = roundedMinutes / 60;
  const regularHours = Math.min(netHours, policy.otAfterHours);
  const overtimeHours = Math.max(netHours - policy.otAfterHours, 0);
  const overtimeRate =
    policy.overtimeRate > 0 ? policy.overtimeRate : hourlyRate * policy.otMultiplier;
  let basePay = regularHours * hourlyRate;
  let overtimePay = overtimeHours * overtimeRate;
  let dailyPay = basePay + overtimePay;
  if (policy.payType === "daily" && policy.dailyRate > 0) {
    if (netHours >= policy.dailyMinHours) {
      dailyPay = policy.dailyRate + overtimePay;
    } else if (policy.dailyProrate) {
      dailyPay = (policy.dailyRate * netHours) / policy.dailyMinHours + overtimePay;
    }
  }
  const dayMultiplier = resolveDayMultiplier(dateKey, policy);
  const finalPay = dailyPay * dayMultiplier;
  const lateMinutes = getLateMinutes(clockInTs, plannedStart, policy);
  const earlyLeaveMinutes = getEarlyLeaveMinutes(clockOutTs, plannedEnd, policy);

  return {
    rawMinutes,
    breakMinutes,
    netMinutes,
    roundedMinutes,
    netHours,
    regularHours,
    overtimeHours,
    basePay,
    overtimePay,
    dailyPay,
    dayMultiplier,
    finalPay,
    isLate: lateMinutes > 0,
    lateMinutes,
    isEarlyLeave: earlyLeaveMinutes > 0,
    earlyLeaveMinutes,
  };
};

async function getSystemPolicy() {
  const snap = await db.collection("config").doc("system").get();
  const data = snap.data() || {};
  return {
    ...DEFAULT_POLICY,
    payType: String(data.payType ?? DEFAULT_POLICY.payType),
    dailyRate: Number(data.dailyRate ?? DEFAULT_POLICY.dailyRate),
    dailyMinHours: Number(data.dailyMinHours ?? DEFAULT_POLICY.dailyMinHours),
    dailyProrate: Boolean(data.dailyProrate ?? DEFAULT_POLICY.dailyProrate),
    otAfterHours: Number(data.otAfterHours ?? DEFAULT_POLICY.otAfterHours),
    otMultiplier: Number(data.otMultiplier ?? DEFAULT_POLICY.otMultiplier),
    overtimeRate: Number(data.overtimeRate ?? DEFAULT_POLICY.overtimeRate),
    breakPaid: Boolean(data.breakPaid ?? DEFAULT_POLICY.breakPaid),
    breakFixedMinutes: Number(data.breakFixedMinutes ?? DEFAULT_POLICY.breakFixedMinutes),
    autoBreak: Boolean(data.autoBreak ?? DEFAULT_POLICY.autoBreak),
    roundingMinutes: Number(data.roundingMinutes ?? DEFAULT_POLICY.roundingMinutes),
    roundingMode: String(data.roundingMode ?? DEFAULT_POLICY.roundingMode),
    roundingScope: String(data.roundingScope ?? DEFAULT_POLICY.roundingScope),
    lateGraceMinutes: Number(data.lateGraceMinutes ?? DEFAULT_POLICY.lateGraceMinutes),
    earlyGraceMinutes: Number(data.earlyGraceMinutes ?? DEFAULT_POLICY.earlyGraceMinutes),
    weekendMultiplier: Number(data.weekendMultiplier ?? DEFAULT_POLICY.weekendMultiplier),
    holidayMultiplier: Number(data.holidayMultiplier ?? DEFAULT_POLICY.holidayMultiplier),
    holidays: Array.isArray(data.holidays)
      ? data.holidays.map(value => String(value))
      : [],
    hourlyRate: Number(data.hourlyRate ?? 0),
  };
}

async function run() {
  const policy = await getSystemPolicy();
  const workersSnap = await db.collection("users").where("role", "==", "worker").get();
  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }

  let updatedAttendance = 0;
  let updatedShifts = 0;

  for (const workerDoc of workersSnap.docs) {
    const workerId = workerDoc.id;
    const workerData = workerDoc.data() || {};
    const workerRate = Number(workerData.hourlyRate ?? policy.hourlyRate ?? 0);
    const workerPolicy = {
      ...policy,
      payType: String(workerData.payType ?? policy.payType),
      dailyRate: Number(workerData.dailyRate ?? policy.dailyRate),
    };

    const shiftsSnap = await db.collection("shifts").where("workerId", "==", workerId).get();
    const shiftsByDate = new Map();
    shiftsSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const date = String(data.date ?? "");
      if (!date) return;
      if (!shiftsByDate.has(date)) shiftsByDate.set(date, []);
      shiftsByDate.get(date).push({ id: docSnap.id, ref: docSnap.ref, data });
    });
    shiftsByDate.forEach(list => {
      list.sort((a, b) => parseTimeToMinutes(a.data.start) - parseTimeToMinutes(b.data.start));
    });

    const attendanceSnap = await db
      .collection("users")
      .doc(workerId)
      .collection("attendance")
      .get();

    const batch = db.batch();
    let ops = 0;
    const commitIfNeeded = async () => {
      if (ops < 400) return;
      await batch.commit();
      ops = 0;
    };

    for (const docSnap of attendanceSnap.docs) {
      const log = docSnap.data();
      const dateKey = String(log.date ?? docSnap.id);
      if (!dateKey) continue;
      if (!log.clockInTs || !log.clockOutTs) continue;
      const manualBreakMinutes =
        Number(log.breakMinutes ?? 0) ||
        calcMinutesDiff(log.breakStart, log.breakEnd);

      const shiftList = shiftsByDate.get(dateKey) || [];
      const shift = shiftList[0] || null;
      const plannedStart = shift ? String(shift.data.start ?? "") : null;
      const plannedEnd = shift ? String(shift.data.end ?? "") : null;

      const metrics = computeAttendanceMetrics({
        clockInTs: log.clockInTs,
        clockOutTs: log.clockOutTs,
        manualBreakMinutes,
        plannedStart,
        plannedEnd,
        dateKey,
        policy: workerPolicy,
        hourlyRate: workerRate,
      });

      batch.update(docSnap.ref, {
        rawMinutes: metrics.rawMinutes,
        breakMinutes: metrics.breakMinutes,
        netMinutes: metrics.netMinutes,
        roundedMinutes: metrics.roundedMinutes,
        netHours: metrics.netHours,
        regularHours: metrics.regularHours,
        overtimeHours: metrics.overtimeHours,
        basePay: metrics.basePay,
        overtimePay: metrics.overtimePay,
        dailyPay: metrics.dailyPay,
        dayMultiplier: metrics.dayMultiplier,
        finalPay: metrics.finalPay,
        plannedStart,
        plannedEnd,
        isLate: metrics.isLate,
        lateMinutes: metrics.lateMinutes,
        isEarlyLeave: metrics.isEarlyLeave,
        earlyLeaveMinutes: metrics.earlyLeaveMinutes,
        hours: metrics.netHours,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ops += 1;
      updatedAttendance += 1;
      await commitIfNeeded();

      if (shift) {
        batch.update(shift.ref, {
          hours: metrics.netHours,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        ops += 1;
        updatedShifts += 1;
        await commitIfNeeded();
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
  }

  console.log(`Updated attendance logs: ${updatedAttendance}`);
  console.log(`Updated shift hours: ${updatedShifts}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
