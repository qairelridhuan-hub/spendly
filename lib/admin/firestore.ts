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
    holidays: Array.isArray(data.holidays) ? data.holidays : [],
    allowedStart: String(data.allowedStart ?? ""),
    allowedEnd: String(data.allowedEnd ?? ""),
    maxHoursPerDay: Number(data.maxHoursPerDay ?? 0),
    maxHoursPerWeek: Number(data.maxHoursPerWeek ?? 0),
    minRestHours: Number(data.minRestHours ?? 0),
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
  const allowedStart = config.allowedStart || "00:00";
  const allowedEnd = config.allowedEnd || "23:59";
  const allowedStartMinutes = parseTime(allowedStart).h * 60 + parseTime(allowedStart).m;
  const allowedEndMinutes = parseTime(allowedEnd).h * 60 + parseTime(allowedEnd).m;
  const maxHoursPerDay = config.maxHoursPerDay || 0;
  const maxHoursPerWeek = config.maxHoursPerWeek || 0;
  const minRestHours = config.minRestHours || 0;

  for (const worker of workers) {
    const existingShiftsSnap = await getDocs(
      query(collection(db, "shifts"), where("workerId", "==", worker.id))
    );
    const existingShifts = existingShiftsSnap.docs.map(docSnap => docSnap.data() as any);
    const existingByDate = new Map<
      string,
      { startMinutes: number; endMinutes: number; hours: number }[]
    >();
    existingShifts.forEach(shift => {
      const dateKey = String(shift.date || "");
      if (!dateKey) return;
      const startMinutes = parseTime(String(shift.start || "00:00"));
      const endMinutes = parseTime(String(shift.end || "00:00"));
      const startValue = startMinutes.h * 60 + startMinutes.m;
      const endValue = endMinutes.h * 60 + endMinutes.m;
      if (!existingByDate.has(dateKey)) existingByDate.set(dateKey, []);
      existingByDate.get(dateKey)?.push({
        startMinutes: startValue,
        endMinutes: endValue,
        hours: Number(shift.hours || 0),
      });
    });

    const weeklyHours = new Map<string, number>();
    existingShifts.forEach(shift => {
      const dateKey = String(shift.date || "");
      if (!dateKey) return;
      const dateValue = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(dateValue.getTime())) return;
      const weekKey = getWeekKey(dateValue);
      const current = weeklyHours.get(weekKey) || 0;
      weeklyHours.set(weekKey, current + Number(shift.hours || 0));
    });

    let workDaysCount = 0;
    let lastGeneratedEnd: number | null = null;
    for (let i = 0; i < totalDays; i += 1) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const day = date.getDay(); // 0-6
      const isWeekend = day === 0 || day === 6;
      const shouldWork =
        !isWeekend &&
        workDaysCount % 7 < Math.min(5, config.workingDaysPerWeek || 5);

      if (shouldWork) {
        const dateKey = formatDate(date);
        const startMinutes = parseTime(config.preferredStart || "09:00");
        const endMinutes = parseTime(config.preferredEnd || "17:00");
        const startValue = startMinutes.h * 60 + startMinutes.m;
        const endValue = endMinutes.h * 60 + endMinutes.m;
        if (endValue <= startValue || hours <= 0) {
          continue;
        }
        const dateExisting = existingByDate.get(dateKey) || [];
        const overlaps = dateExisting.some(
          existing =>
            startValue < existing.endMinutes && endValue > existing.startMinutes
        );
        if (overlaps) {
          continue;
        }
        if (startValue < allowedStartMinutes || endValue > allowedEndMinutes) {
          continue;
        }
        if (maxHoursPerDay && hours > maxHoursPerDay) {
          continue;
        }

        if (minRestHours) {
          const prevDate = new Date(date);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevKey = formatDate(prevDate);
          const prevShifts = existingByDate.get(prevKey) || [];
          const latestPrevEnd = prevShifts.reduce(
            (max, item) => Math.max(max, item.endMinutes),
            -1
          );
          const restFromExisting =
            latestPrevEnd >= 0
              ? startValue + 24 * 60 - latestPrevEnd
              : null;
          const restFromGenerated =
            lastGeneratedEnd !== null
              ? startValue + 24 * 60 - lastGeneratedEnd
              : null;
          const minRestMinutes = minRestHours * 60;
          if (
            (restFromExisting !== null && restFromExisting < minRestMinutes) ||
            (restFromGenerated !== null && restFromGenerated < minRestMinutes)
          ) {
            continue;
          }
        }

        const weekKey = getWeekKey(date);
        const weekHours = weeklyHours.get(weekKey) || 0;
        if (maxHoursPerWeek && weekHours + hours > maxHoursPerWeek) {
          continue;
        }

        const shift: Shift = {
          workerId: worker.id,
          date: dateKey,
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
        weeklyHours.set(weekKey, weekHours + hours);
        lastGeneratedEnd = endValue;
      }
    }
  }

  await batch.commit();
}

const getWeekKey = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return formatDate(copy);
};
