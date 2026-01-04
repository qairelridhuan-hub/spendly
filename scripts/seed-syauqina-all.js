/* eslint-disable no-console */
const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_PATH =
  "/Users/qairel/Downloads/spendly-68ea0-firebase-adminsdk-fbsvc-442cd67962.json";
const SYAUQINA_UID = "GBw2ptfjt5MnA0T4IAkMMVlvye12";

const app = admin.initializeApp({
  credential: admin.credential.cert(
    require(path.resolve(SERVICE_ACCOUNT_PATH))
  ),
});

const db = app.firestore();

const pad = value => String(value).padStart(2, "0");

const formatDateKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatPeriodKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffHours = (start, end) => {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

const seed = async () => {
  const now = new Date();
  const currentPeriod = formatPeriodKey(now);
  const previousPeriodDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousPeriod = formatPeriodKey(previousPeriodDate);

  const scheduleId = "syauqina-morning";
  const scheduleDoc = {
    name: "Morning Shift",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    startTime: "09:00",
    endTime: "17:00",
    hourlyRate: 10,
    description: "Main weekday shift",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const userDoc = {
    fullName: "Syauqina",
    role: "worker",
    scheduleId,
    hourlyRate: 10,
    budgetAllocation: [
      { category: "Savings", amount: 450, color: "#22c55e" },
      { category: "Goals", amount: 320, color: "#3b82f6" },
      { category: "Expenses", amount: 280, color: "#f59e0b" },
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const shifts = [];
  const attendance = [];
  const breaks = [];
  const overtime = [];

  const shiftStart = "09:00";
  const shiftEnd = "17:00";
  const shiftHours = diffHours(shiftStart, shiftEnd);

  // Past completed shifts (current month, last 10 working days).
  for (let i = 14; i >= 5; i -= 1) {
    const date = addDays(now, -i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const dateKey = formatDateKey(date);
    shifts.push({
      id: `syauqina-${dateKey}`,
      date: dateKey,
      start: shiftStart,
      end: shiftEnd,
      hours: shiftHours,
      status: "completed",
      type: "normal",
      role: "Barista",
      location: "Spendly Cafe",
      workerId: SYAUQINA_UID,
    });
    attendance.push({
      date: dateKey,
      workerId: SYAUQINA_UID,
      clockIn: "09:02",
      clockOut: "17:05",
      breakStart: "13:00",
      breakEnd: "13:30",
      breakMinutes: 30,
      hours: 7.5,
      status: "approved",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    breaks.push({
      date: dateKey,
      workerId: SYAUQINA_UID,
      startTime: "13:00",
      endTime: "13:30",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Recent shifts (pending approval).
  for (let i = 4; i >= 1; i -= 1) {
    const date = addDays(now, -i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const dateKey = formatDateKey(date);
    shifts.push({
      id: `syauqina-${dateKey}`,
      date: dateKey,
      start: shiftStart,
      end: shiftEnd,
      hours: shiftHours,
      status: "scheduled",
      type: "normal",
      role: "Barista",
      location: "Spendly Cafe",
      workerId: SYAUQINA_UID,
    });
    attendance.push({
      date: dateKey,
      workerId: SYAUQINA_UID,
      clockIn: "09:05",
      clockOut: "17:10",
      breakStart: "13:05",
      breakEnd: "13:30",
      breakMinutes: 25,
      hours: 7.6,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    breaks.push({
      date: dateKey,
      workerId: SYAUQINA_UID,
      startTime: "13:05",
      endTime: "13:30",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Upcoming shifts (next 7 working days).
  for (let i = 1; i <= 9; i += 1) {
    const date = addDays(now, i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const dateKey = formatDateKey(date);
    shifts.push({
      id: `syauqina-${dateKey}`,
      date: dateKey,
      start: shiftStart,
      end: shiftEnd,
      hours: shiftHours,
      status: "scheduled",
      type: "normal",
      role: "Barista",
      location: "Spendly Cafe",
      workerId: SYAUQINA_UID,
    });
  }

  // Overtime entries for two recent days.
  const overtimeDates = attendance.slice(0, 2).map(entry => entry.date);
  overtimeDates.forEach(dateKey => {
    overtime.push({
      date: dateKey,
      workerId: SYAUQINA_UID,
      startTime: "17:00",
      endTime: "19:00",
      hours: 2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const payrollRecords = [
    {
      period: previousPeriod,
      totalHours: 128,
      overtimeHours: 6,
      totalEarnings: 1340,
      absenceDeductions: 0,
      status: "paid",
      updatedAt: new Date(previousPeriodDate.getFullYear(), previousPeriodDate.getMonth() + 1, 2).toISOString(),
    },
    {
      period: currentPeriod,
      totalHours: 72,
      overtimeHours: 2,
      totalEarnings: 780,
      absenceDeductions: 0,
      status: "pending",
      updatedAt: new Date().toISOString(),
    },
  ];

  const batch = db.batch();

  batch.set(db.doc(`workSchedules/${scheduleId}`), scheduleDoc, { merge: true });
  batch.set(db.doc(`users/${SYAUQINA_UID}`), userDoc, { merge: true });

  shifts.forEach(shift => {
    batch.set(db.doc(`shifts/${shift.id}`), shift, { merge: true });
  });

  attendance.forEach(entry => {
    batch.set(
      db.doc(`users/${SYAUQINA_UID}/attendance/${entry.date}`),
      entry,
      { merge: true }
    );
  });

  breaks.forEach(entry => {
    batch.set(
      db.doc(`users/${SYAUQINA_UID}/breaks/${entry.date}`),
      entry,
      { merge: true }
    );
  });

  overtime.forEach(entry => {
    batch.set(
      db.doc(`users/${SYAUQINA_UID}/overtime/${entry.date}`),
      entry,
      { merge: true }
    );
  });

  payrollRecords.forEach(record => {
    batch.set(
      db.doc(`users/${SYAUQINA_UID}/payroll/${record.period}`),
      {
        workerId: SYAUQINA_UID,
        ...record,
      },
      { merge: true }
    );
  });

  await batch.commit();
  console.log("Seeded Syauqina data across shifts, attendance, breaks, overtime, payroll.");
};

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
