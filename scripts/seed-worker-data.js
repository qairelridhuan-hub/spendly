const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const [serviceAccountPath, workerId] = process.argv.slice(2);

if (!serviceAccountPath || !workerId) {
  console.error(
    "Usage: node scripts/seed-worker-data.js /absolute/path/to/serviceAccount.json WORKER_UID"
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

const buildShift = (date, index, status) => {
  const start = index % 2 === 0 ? "09:00" : "10:00";
  const end = index % 2 === 0 ? "17:00" : "18:00";
  return {
    workerId,
    date,
    start,
    end,
    hours: 8,
    type: "normal",
    role: "Barista",
    location: "Store A",
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const buildAttendance = (date, index, status) => {
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

async function seed() {
  const pastDates = getPastWeekdays(10);
  const upcomingDates = getUpcomingWeekdays(3);

  const shiftWrites = [];
  const attendanceWrites = [];
  const goalWrites = [];

  pastDates.forEach((dateObj, index) => {
    const date = formatDate(dateObj);
    const status = index === 2 ? "absent" : index === 6 ? "pending" : "approved";
    const shiftStatus =
      status === "approved" ? "completed" : status === "absent" ? "absent" : "scheduled";

    shiftWrites.push(
      db.collection("shifts").add(buildShift(date, index, shiftStatus))
    );
    attendanceWrites.push(
      db
        .collection("users")
        .doc(workerId)
        .collection("attendance")
        .doc(date)
        .set(buildAttendance(date, index, status), { merge: true })
    );
  });

  upcomingDates.forEach((dateObj, index) => {
    const date = formatDate(dateObj);
    shiftWrites.push(
      db.collection("shifts").add(buildShift(date, index + 20, "scheduled"))
    );
  });

  const goals = [
    {
      name: "New Phone",
      targetAmount: 2500,
      savedAmount: 600,
      weeklyTarget: 200,
      priority: "high",
      dueDate: formatDate(getUpcomingWeekdays(1)[0]),
      notes: "Upgrade my phone for work.",
    },
    {
      name: "Laptop Fund",
      targetAmount: 4000,
      savedAmount: 1200,
      weeklyTarget: 250,
      priority: "medium",
      dueDate: formatDate(getUpcomingWeekdays(3)[2]),
      notes: "Save for a new laptop.",
    },
    {
      name: "Emergency Savings",
      targetAmount: 1500,
      savedAmount: 300,
      weeklyTarget: 150,
      priority: "high",
      dueDate: formatDate(getUpcomingWeekdays(4)[3]),
      notes: "Build a safety buffer.",
    },
    {
      name: "Travel Trip",
      targetAmount: 1800,
      savedAmount: 450,
      weeklyTarget: 180,
      priority: "low",
      dueDate: formatDate(getUpcomingWeekdays(5)[4]),
      notes: "Weekend getaway.",
    },
    {
      name: "Course Fee",
      targetAmount: 900,
      savedAmount: 200,
      weeklyTarget: 100,
      priority: "medium",
      dueDate: formatDate(getUpcomingWeekdays(2)[1]),
      notes: "Online skill course.",
    },
  ];

  goals.forEach(goal => {
    goalWrites.push(
      db
        .collection("users")
        .doc(workerId)
        .collection("goals")
        .add({
          ...goal,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );
  });

  await Promise.all([...shiftWrites, ...attendanceWrites, ...goalWrites]);
  console.log("Seeded shifts and attendance for worker:", workerId);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
