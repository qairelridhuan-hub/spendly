import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shift, WorkConfig } from "./types";

const pad = (value: number) => String(value).padStart(2, "0");

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
};

const diffHours = (start: string, end: string) => {
  const s = parseTime(start);
  const e = parseTime(end);
  const startMinutes = s.h * 60 + s.m;
  const endMinutes = e.h * 60 + e.m;
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

export async function getSystemConfig(): Promise<WorkConfig | null> {
  const snap = await getDoc(doc(db, "config", "system"));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    workingDaysPerWeek: Number(data.workingDaysPerWeek ?? 0),
    hoursPerDay: Number(data.hoursPerDay ?? 0),
    durationMonths: Number(data.durationMonths ?? 0),
    preferredStart: String(data.preferredStart ?? ""),
    preferredEnd: String(data.preferredEnd ?? ""),
    hourlyRate: Number(data.hourlyRate ?? 0),
    overtimeRate: Number(data.overtimeRate ?? 0),
  };
}

export async function fetchWorkers() {
  const workersQuery = query(
    collection(db, "users"),
    where("role", "==", "worker")
  );
  const snapshot = await getDocs(workersQuery);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    name: docSnap.data().fullName || docSnap.data().displayName || "Worker",
    email: docSnap.data().email || "",
  }));
}

export async function generateShiftsForWorkers(config: WorkConfig) {
  const workers = await fetchWorkers();
  const batch = writeBatch(db);
  const shiftsRef = collection(db, "shifts");

  const startDate = new Date();
  const totalDays = Math.max(1, config.durationMonths * 30);
  const hours = config.hoursPerDay || diffHours(config.preferredStart, config.preferredEnd);

  workers.forEach(worker => {
    let workDaysCount = 0;
    for (let i = 0; i < totalDays; i += 1) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const day = date.getDay(); // 0-6
      const isWeekend = day === 0 || day === 6;
      const shouldWork =
        !isWeekend &&
        workDaysCount % 7 < Math.min(5, config.workingDaysPerWeek || 5);

      if (shouldWork) {
        const shift: Shift = {
          workerId: worker.id,
          date: formatDate(date),
          start: config.preferredStart || "09:00",
          end: config.preferredEnd || "17:00",
          hours,
          type: "normal",
          status: "work",
          createdAt: new Date().toISOString(),
        };
        const docRef = doc(shiftsRef);
        batch.set(docRef, shift);
        workDaysCount += 1;
      }
    }
  });

  await batch.commit();
}
