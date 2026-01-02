const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/seed-all-workers-overwrite.js /absolute/path/to/serviceAccount.json"
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

const hashString = value =>
  Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);

const createSeededRandom = seed => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const toMinutes = time => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = minutes => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${pad(hours)}:${pad(mins)}`;
};

const setTime = (date, time) => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const startOfWeek = date => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
};

const shuffle = (arr, rand) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const deleteByQuery = async (queryRef, batchSize = 300) => {
  let snapshot = await queryRef.limit(batchSize).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    snapshot = await queryRef.limit(batchSize).get();
  }
};

const deleteSubcollection = async (collectionRef, batchSize = 300) => {
  const docs = await collectionRef.listDocuments();
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    docs.slice(i, i + batchSize).forEach(docRef => batch.delete(docRef));
    await batch.commit();
  }
};

const buildShift = (workerId, date, start, end, hours, status) => ({
  workerId,
  date,
  start,
  end,
  hours,
  type: "normal",
  role: "Shift",
  location: "Main Branch",
  status,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const buildAttendance = (workerId, date, start, end, breakStart, breakEnd, breakMinutes, hours, status) => {
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

  const clockIn = start;
  const clockOut = end;
  const clockInDate = setTime(new Date(`${date}T00:00:00`), clockIn);
  const clockOutDate = setTime(new Date(`${date}T00:00:00`), clockOut);
  const breakStartDate = breakMinutes
    ? setTime(new Date(`${date}T00:00:00`), breakStart)
    : null;
  const breakEndDate = breakMinutes
    ? setTime(new Date(`${date}T00:00:00`), breakEnd)
    : null;

  return {
    date,
    workerId,
    clockIn,
    clockOut,
    clockInTs: clockInDate.getTime(),
    clockOutTs: clockOutDate.getTime(),
    breakStart: breakMinutes ? breakStart : null,
    breakEnd: breakMinutes ? breakEnd : null,
    breakStartTs: breakMinutes ? breakStartDate.getTime() : null,
    breakEndTs: breakMinutes ? breakEndDate.getTime() : null,
    breakMinutes,
    hours,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const buildGoals = (rand, upcomingDates) => {
  const baseTargets = [600, 800, 1200, 500, 900, 1500];
  const names = [
    "Emergency Fund",
    "New Phone",
    "Laptop Fund",
    "Travel Trip",
    "Course Fee",
    "Home Upgrade",
  ];
  return Array.from({ length: 5 }).map((_, index) => {
    const target = baseTargets[index] + Math.round(rand() * 300);
    const saved = Math.round(target * (0.1 + rand() * 0.3));
    const weekly = Math.max(60, Math.round(target / (10 + rand() * 6)));
    return {
      name: names[index],
      targetAmount: target,
      savedAmount: saved,
      weeklyTarget: weekly,
      priority: index === 0 ? "high" : index === 3 ? "low" : "medium",
      dueDate: formatDate(upcomingDates[index % upcomingDates.length]),
      notes: "Auto-generated goal from admin data.",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  });
};

const getPeriodKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const buildPayrollDoc = (workerId, period, totalHours, hourlyRate, absences) => ({
  workerId,
  period,
  totalHours: Number(totalHours.toFixed(1)),
  overtimeHours: 0,
  totalEarnings: Number((totalHours * hourlyRate).toFixed(2)),
  absenceDeductions: absences,
  status: "pending",
  updatedAt: new Date().toISOString(),
});

const pickWeekdays = (rand, weekStart, count, maxDate) => {
  const weekdayOffsets = [0, 1, 2, 3, 4];
  const shuffled = shuffle(weekdayOffsets, rand).slice(0, count);
  return shuffled
    .map(offset => addDays(weekStart, offset))
    .filter(date => date <= maxDate);
};

async function seedWorker(workerDoc, index) {
  const workerId = workerDoc.id;
  const seed = hashString(workerId) + index * 101;
  const rand = createSeededRandom(seed);

  const baseRate = 8 + (index % 5) * 1.2;
  const hourlyRate = Number((baseRate + rand() * 2.5).toFixed(2));

  await workerDoc.ref.set(
    {
      hourlyRate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await deleteByQuery(db.collection("shifts").where("workerId", "==", workerId));
  await deleteSubcollection(db.collection("users").doc(workerId).collection("attendance"));
  await deleteSubcollection(db.collection("users").doc(workerId).collection("goals"));
  await deleteSubcollection(db.collection("users").doc(workerId).collection("payroll"));

  const today = new Date();
  const yesterday = addDays(today, -1);
  const weekStart = startOfWeek(today);

  const pastDates = [];
  for (let w = 0; w < 4; w += 1) {
    const start = addDays(weekStart, -7 * w);
    const count = rand() > 0.6 ? 4 : 3;
    const dates = pickWeekdays(rand, start, count, w === 0 ? yesterday : yesterday);
    pastDates.push(...dates);
  }

  const upcomingDates = [];
  for (let w = 1; w <= 2; w += 1) {
    const start = addDays(weekStart, 7 * w);
    const count = rand() > 0.6 ? 3 : 2;
    const dates = pickWeekdays(rand, start, count, addDays(start, 6));
    upcomingDates.push(...dates);
  }

  const uniquePastDates = Array.from(
    new Set(pastDates.map(date => formatDate(date)))
  ).map(dateStr => new Date(`${dateStr}T00:00:00`));

  const statusMap = {};
  if (uniquePastDates.length) {
    const absentIndex = Math.floor(rand() * uniquePastDates.length);
    statusMap[formatDate(uniquePastDates[absentIndex])] = "absent";
    if (uniquePastDates.length > 2) {
      const pendingIndex = (absentIndex + 2) % uniquePastDates.length;
      statusMap[formatDate(uniquePastDates[pendingIndex])] = "pending";
    }
  }

  const writes = [];
  const attendanceLogs = [];

  uniquePastDates.forEach(dateObj => {
    const date = formatDate(dateObj);
    const startHour = 8 + Math.floor(rand() * 4);
    const startMinute = rand() > 0.5 ? 0 : 30;
    const start = `${pad(startHour)}:${pad(startMinute)}`;
    const hours = 4 + rand() * 2.5;
    const totalMinutes = Math.round(hours * 60);
    const end = minutesToTime(toMinutes(start) + totalMinutes);
    const breakMinutes = hours >= 5 ? 15 : 0;
    const breakStart = breakMinutes ? minutesToTime(toMinutes(start) + Math.round(totalMinutes / 2)) : null;
    const breakEnd = breakMinutes ? minutesToTime(toMinutes(breakStart) + breakMinutes) : null;
    const netHours = Math.max(0, hours - breakMinutes / 60);

    const status = statusMap[date] || "approved";
    const shiftStatus =
      status === "approved" ? "completed" : status === "absent" ? "absent" : "scheduled";

    writes.push(db.collection("shifts").add(buildShift(workerId, date, start, end, Number(hours.toFixed(1)), shiftStatus)));

    const attendance = buildAttendance(
      workerId,
      date,
      start,
      end,
      breakStart,
      breakEnd,
      breakMinutes,
      Number(netHours.toFixed(1)),
      status
    );
    attendanceLogs.push(attendance);
    writes.push(
      db
        .collection("users")
        .doc(workerId)
        .collection("attendance")
        .doc(date)
        .set(attendance)
    );
  });

  upcomingDates.forEach(dateObj => {
    const date = formatDate(dateObj);
    const startHour = 8 + Math.floor(rand() * 4);
    const startMinute = rand() > 0.5 ? 0 : 30;
    const start = `${pad(startHour)}:${pad(startMinute)}`;
    const hours = 4 + rand() * 2.5;
    const totalMinutes = Math.round(hours * 60);
    const end = minutesToTime(toMinutes(start) + totalMinutes);
    writes.push(db.collection("shifts").add(buildShift(workerId, date, start, end, Number(hours.toFixed(1)), "scheduled")));
  });

  const goals = buildGoals(rand, upcomingDates.length ? upcomingDates : [addDays(today, 14)]);
  goals.forEach(goal => {
    writes.push(
      db
        .collection("users")
        .doc(workerId)
        .collection("goals")
        .add(goal)
    );
  });

  await Promise.all(writes);

  const payrollMap = {};
  attendanceLogs.forEach(log => {
    const period = getPeriodKey(new Date(`${log.date}T00:00:00`));
    payrollMap[period] = payrollMap[period] || { hours: 0, absences: 0 };
    payrollMap[period].hours += Number(log.hours ?? 0);
    if (log.status === "absent") payrollMap[period].absences += 1;
  });

  const payrollWrites = Object.entries(payrollMap).map(([period, data]) =>
    db
      .collection("users")
      .doc(workerId)
      .collection("payroll")
      .doc(period)
      .set(buildPayrollDoc(workerId, period, data.hours, hourlyRate, data.absences))
  );

  await Promise.all(payrollWrites);

  console.log(`Seeded ${workerId} with rate RM ${hourlyRate}/hr`);
}

async function seedAll() {
  const workersSnap = await db
    .collection("users")
    .where("role", "==", "worker")
    .get();

  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }

  let index = 0;
  for (const docSnap of workersSnap.docs) {
    await seedWorker(docSnap, index);
    index += 1;
  }

  console.log("Overwrite seed completed for all workers.");
}

seedAll()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
