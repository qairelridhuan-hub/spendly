const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, startDateArg, endDateArg] = process.argv.slice(2);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/seed-all-workers-data.js /absolute/path/to/serviceAccount.json [YYYY-MM-DD] [YYYY-MM-DD]"
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

const parseDateArg = value => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const listDatesInRange = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

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

const buildShift = (workerId, date, index, status) => {
  const start = index % 2 === 0 ? "09:00" : "10:00";
  const end = index % 2 === 0 ? "17:00" : "18:00";
  return {
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
  };
};

const buildAttendance = (workerId, date, index, status) => {
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

  const start = index % 2 === 0 ? "09:00" : "10:00";
  const end = index % 2 === 0 ? "17:00" : "18:00";
  const clockIn = addMinutes(start, 5);
  const clockOut = end;
  const breakStart = index % 2 === 0 ? "13:00" : "14:00";
  const breakEnd = addMinutes(breakStart, 30);
  const clockInDate = setTime(new Date(`${date}T00:00:00`), clockIn);
  const clockOutDate = setTime(new Date(`${date}T00:00:00`), clockOut);
  const breakStartDate = setTime(new Date(`${date}T00:00:00`), breakStart);
  const breakEndDate = setTime(new Date(`${date}T00:00:00`), breakEnd);
  const breakMinutes = 30;
  const hours = 8 - breakMinutes / 60;

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
    breakMinutes,
    hours,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const defaultGoals = () => {
  const upcoming = getUpcomingWeekdays(5);
  return [
    {
      name: "Emergency Fund",
      targetAmount: 1500,
      savedAmount: 300,
      weeklyTarget: 150,
      priority: "high",
      dueDate: formatDate(upcoming[0]),
      notes: "Build a safety buffer.",
    },
    {
      name: "New Phone",
      targetAmount: 2500,
      savedAmount: 600,
      weeklyTarget: 200,
      priority: "medium",
      dueDate: formatDate(upcoming[1]),
      notes: "Upgrade my phone.",
    },
    {
      name: "Laptop Fund",
      targetAmount: 4000,
      savedAmount: 1200,
      weeklyTarget: 250,
      priority: "medium",
      dueDate: formatDate(upcoming[2]),
      notes: "Save for a new laptop.",
    },
    {
      name: "Travel Trip",
      targetAmount: 1800,
      savedAmount: 450,
      weeklyTarget: 180,
      priority: "low",
      dueDate: formatDate(upcoming[3]),
      notes: "Weekend getaway.",
    },
    {
      name: "Course Fee",
      targetAmount: 900,
      savedAmount: 200,
      weeklyTarget: 100,
      priority: "medium",
      dueDate: formatDate(upcoming[4]),
      notes: "Online skill course.",
    },
  ];
};

async function seedWorker(workerId, dateList) {
  const writes = [];
  const datesToSeed = dateList.length > 0 ? dateList : getPastWeekdays(10);

  for (const [index, dateObj] of datesToSeed.entries()) {
    const date = formatDate(dateObj);
    const shiftQuery = await db
      .collection("shifts")
      .where("workerId", "==", workerId)
      .where("date", "==", date)
      .limit(1)
      .get();
    if (shiftQuery.empty) {
      writes.push(db.collection("shifts").add(buildShift(workerId, date, index, "completed")));
    }

    const attendanceRef = db
      .collection("users")
      .doc(workerId)
      .collection("attendance")
      .doc(date);
    const attendanceSnap = await attendanceRef.get();
    if (!attendanceSnap.exists) {
      writes.push(
        attendanceRef.set(buildAttendance(workerId, date, index, "approved"), {
          merge: true,
        })
      );
    }
  }

  if (dateList.length === 0) {
    const upcomingDates = getUpcomingWeekdays(3);
    upcomingDates.forEach((dateObj, index) => {
      const date = formatDate(dateObj);
      writes.push(
        db.collection("shifts").add(buildShift(workerId, date, index + 20, "scheduled"))
      );
    });
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }

  const goalsSnap = await db
    .collection("users")
    .doc(workerId)
    .collection("goals")
    .limit(1)
    .get();
  if (goalsSnap.empty) {
    const goals = defaultGoals();
    await Promise.all(
      goals.map(goal =>
        db
          .collection("users")
          .doc(workerId)
          .collection("goals")
          .add({
            ...goal,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
      )
    );
  }
}

async function seedAll() {
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
  let dateList = [];
  if (startDate && endDate) {
    if (startDate > endDate) {
      console.error("Start date must be before or equal to end date.");
      process.exit(1);
    }
    dateList = listDatesInRange(startDate, endDate);
  }

  const workersSnap = await db
    .collection("users")
    .where("role", "==", "worker")
    .get();
  if (workersSnap.empty) {
    console.log("No workers found.");
    return;
  }
  for (const docSnap of workersSnap.docs) {
    await seedWorker(docSnap.id, dateList);
  }
  console.log("Seeded shifts, attendance, and goals for all workers (if missing).");
}

seedAll()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
