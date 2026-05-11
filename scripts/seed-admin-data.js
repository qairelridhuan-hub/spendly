const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/seed-admin-data.js /absolute/path/to/serviceAccount.json"
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
const formatDate = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const getPeriodKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const setTime = (date, time) => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const addMinutes = (time, minutes) => {
  const [h, m] = time.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + minutes;
  const nextH = Math.floor(total / 60) % 24;
  const nextM = total % 60;
  return `${pad(nextH)}:${pad(nextM)}`;
};

const getPastWeekdays = count => {
  const dates = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
};

const getUpcomingWeekdays = count => {
  const dates = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const buildShift = (workerId, date, start, end, status) => ({
  workerId,
  date,
  start,
  end,
  hours: 8,
  type: "normal",
  role: "Shift",
  location: "Main Branch",
  status,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const buildAttendance = (workerId, date, start, end, status) => {
  if (status === "absent") {
    return {
      date,
      workerId,
      status: "absent",
      hours: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  }
  const clockIn = addMinutes(start, 5);
  const clockOut = end;
  const breakStart = addMinutes(start, 240);
  const breakEnd = addMinutes(breakStart, 30);
  const clockInDate = setTime(new Date(`${date}T00:00:00`), clockIn);
  const clockOutDate = setTime(new Date(`${date}T00:00:00`), clockOut);
  const breakStartDate = setTime(new Date(`${date}T00:00:00`), breakStart);
  const breakEndDate = setTime(new Date(`${date}T00:00:00`), breakEnd);
  return {
    date,
    workerId,
    clockIn,
    clockOut,
    clockInTs: clockInDate.getTime(),
    clockOutTs: clockOutDate.getTime(),
    breakStart,
    breakEnd,
    breakStartTs: breakStartDate.getTime(),
    breakEndTs: breakEndDate.getTime(),
    breakMinutes: 30,
    hours: 7.5,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

async function ensureConfig() {
  const configRef = db.collection("config").doc("system");
  const snap = await configRef.get();
  if (snap.exists) return;
  await configRef.set({
    workingDaysPerWeek: 5,
    hoursPerDay: 8,
    durationMonths: 6,
    preferredStart: "09:00",
    preferredEnd: "17:00",
    hourlyRate: 10,
    overtimeRate: 15,
    budgetAllocation: [
      { category: "Savings", amount: 300, color: "#22c55e" },
      { category: "Goals", amount: 200, color: "#0ea5e9" },
      { category: "Expenses", amount: 150, color: "#f97316" },
    ],
    updatedAt: new Date().toISOString(),
  });
}

async function ensureSchedules() {
  const schedulesSnap = await db.collection("workSchedules").get();
  if (!schedulesSnap.empty) return schedulesSnap.docs;
  const scheduleDocs = [];
  scheduleDocs.push(
    await db.collection("workSchedules").add({
      name: "Morning Shift",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startTime: "09:00",
      endTime: "17:00",
      hourlyRate: 10,
      description: "Standard morning shift",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  );
  scheduleDocs.push(
    await db.collection("workSchedules").add({
      name: "Evening Shift",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startTime: "12:00",
      endTime: "20:00",
      hourlyRate: 12,
      description: "Standard evening shift",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  );
  return scheduleDocs.map(ref => ({ id: ref.id }));
}

async function seedWorkers() {
  const workersSnap = await db
    .collection("users")
    .where("role", "==", "worker")
    .get();
  if (workersSnap.empty) {
    console.log("No workers found. Seed workers first.");
    return;
  }

  const schedules = await ensureSchedules();
  const scheduleIds = schedules.map(doc => doc.id);
  const period = getPeriodKey(new Date());

  for (const docSnap of workersSnap.docs) {
    const workerId = docSnap.id;
    const data = docSnap.data();
    if (!data.scheduleId && scheduleIds.length > 0) {
      await db.collection("users").doc(workerId).set(
        {
          scheduleId: scheduleIds[0],
          scheduleName: "Morning Shift",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const shiftsSnap = await db
      .collection("shifts")
      .where("workerId", "==", workerId)
      .limit(1)
      .get();
    if (shiftsSnap.empty) {
      const pastDates = getPastWeekdays(3);
      const upcomingDates = getUpcomingWeekdays(2);
      const shiftWrites = [];
      const attendanceWrites = [];

      pastDates.forEach((dateObj, index) => {
        const date = formatDate(dateObj);
        const status = index === 1 ? "absent" : "completed";
        shiftWrites.push(
          db.collection("shifts").add(buildShift(workerId, date, "09:00", "17:00", status))
        );
        attendanceWrites.push(
          db
            .collection("users")
            .doc(workerId)
            .collection("attendance")
            .doc(date)
            .set(buildAttendance(workerId, date, "09:00", "17:00", status), {
              merge: true,
            })
        );
      });

      upcomingDates.forEach(dateObj => {
        const date = formatDate(dateObj);
        shiftWrites.push(
          db.collection("shifts").add(buildShift(workerId, date, "09:00", "17:00", "scheduled"))
        );
      });

      await Promise.all([...shiftWrites, ...attendanceWrites]);
    }

    const payrollRef = db
      .collection("users")
      .doc(workerId)
      .collection("payroll")
      .doc(period);
    const payrollSnap = await payrollRef.get();
    if (!payrollSnap.exists) {
      await payrollRef.set(
        {
          workerId,
          period,
          totalHours: 40,
          overtimeHours: 4,
          totalEarnings: 440,
          absenceDeductions: 1,
          status: "pending",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  }
}

async function ensureNotifications() {
  const notificationsSnap = await db.collection("notifications").limit(1).get();
  if (!notificationsSnap.empty) return;
  await db.collection("notifications").add({
    type: "system",
    title: "Payroll reminder",
    message: "Payroll verification due this week.",
    targetRole: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection("notifications").add({
    type: "system",
    title: "Shift updates",
    message: "New shifts have been generated.",
    targetRole: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function seed() {
  await ensureConfig();
  await ensureSchedules();
  await seedWorkers();
  await ensureNotifications();
  console.log("Admin data seeded.");
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
