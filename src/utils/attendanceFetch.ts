import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateDistanceInMeters } from "./locationHelpers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkplaceSettings = {
  workplaceId: string;
  workplaceLatitude: number;
  workplaceLongitude: number;
  allowedRadiusMeters: number;
};

export type TodayAttendanceState = {
  clockedIn: boolean;
  clockedOut: boolean;
  onBreak: boolean;
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  breakStartTs?: number;
};

// Config flag — set to false to skip selfie requirement for break actions
export const ATTENDANCE_CONFIG = {
  requireSelfieForBreak: true,
} as const;

export type AttendanceLoadResult =
  | { ok: true; workplace: WorkplaceSettings; today: TodayAttendanceState }
  | { ok: false; error: "no-workplace" | "fetch-failed" | "offline" };

// ─── Step 1: Fetch Workplace Settings ────────────────────────────────────────
// Reads adminId + workplaceId from the worker's user doc, then fetches:
// users/{adminId}/workplaces/{workplaceId}
// Worker doc must have: { adminId: string, workplaceId: string }

export async function fetchWorkplaceSettings(
  userId: string
): Promise<WorkplaceSettings | null> {
  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) return null;

  const { adminId, workplaceId } = userSnap.data() as {
    adminId?: string;
    workplaceId?: string;
  };
  if (!adminId || !workplaceId) return null;

  const wpSnap = await getDoc(doc(db, "users", adminId, "workplaces", workplaceId));
  if (!wpSnap.exists()) return null;

  const { latitude, longitude, allowedRadiusMeters } = wpSnap.data() as {
    latitude?: number;
    longitude?: number;
    allowedRadiusMeters?: number;
  };
  if (latitude == null || longitude == null || allowedRadiusMeters == null) return null;

  return { workplaceId, workplaceLatitude: latitude, workplaceLongitude: longitude, allowedRadiusMeters };
}

// ─── Step 2: Fetch Today's Attendance ────────────────────────────────────────
// Fetches the single daily doc: users/{userId}/attendance/{todayKey}
// Derives clockedIn / clockedOut / onBreak from its fields

export async function fetchTodayAttendance(
  userId: string
): Promise<TodayAttendanceState> {
  const snap = await getDoc(doc(db, "users", userId, "attendance", todayKey()));
  if (!snap.exists()) {
    return { clockedIn: false, clockedOut: false, onBreak: false };
  }

  const data = snap.data() as {
    clockIn?: string;
    clockOut?: string;
    breakStart?: string;
    breakEnd?: string;
  };

  return {
    clockedIn:    !!data.clockIn,
    clockedOut:   !!data.clockOut,
    onBreak:      !!data.breakStart && !data.breakEnd,
    clockIn:      data.clockIn,
    clockOut:     data.clockOut,
    breakStart:   data.breakStart,
    breakEnd:     data.breakEnd,
    breakStartTs: (data as any).breakStartTs,
  };
}

// ─── Step 4: Full Load Sequence ───────────────────────────────────────────────

export async function loadAttendanceData(
  userId: string
): Promise<AttendanceLoadResult> {
  try {
    const [workplace, today] = await Promise.all([
      fetchWorkplaceSettings(userId),
      fetchTodayAttendance(userId),
    ]);

    if (!workplace) return { ok: false, error: "no-workplace" };
    return { ok: true, workplace, today };
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    const offline =
      err?.code === "unavailable" ||
      msg.includes("offline") ||
      msg.includes("network") ||
      msg.includes("unavailable");
    return { ok: false, error: offline ? "offline" : "fetch-failed" };
  }
}

// ─── Attendance Record (standardised, auto-ID) ────────────────────────────────

type AttendanceType = "clock_in" | "clock_out" | "break_start" | "break_end";

export async function saveAttendanceRecord(params: {
  userId: string;
  workplace: WorkplaceSettings;
  attendanceType: AttendanceType;
  coords: { latitude: number; longitude: number };
  selfieUrl?: string;
}): Promise<void> {
  const { userId, workplace, attendanceType, coords, selfieUrl } = params;

  const distance = calculateDistanceInMeters(
    coords.latitude,
    coords.longitude,
    workplace.workplaceLatitude,
    workplace.workplaceLongitude
  );
  const locationStatus = distance <= workplace.allowedRadiusMeters ? "inside" : "outside";

  await addDoc(collection(db, "users", userId, "attendance"), {
    workerId:              userId,
    workplaceId:           workplace.workplaceId,
    attendanceType,
    timestamp:             serverTimestamp(),
    latitude:              coords.latitude,
    longitude:             coords.longitude,
    distanceFromWorkplace: Math.round(distance),
    locationStatus,
    selfieUri:             selfieUrl ?? null,
    verificationStatus:    "pending",
  });
}

// ─── Clock In ────────────────────────────────────────────────────────────────

export async function clockIn(
  userId: string,
  coords: { latitude: number; longitude: number },
  selfieUrl: string,
  workplace: WorkplaceSettings
): Promise<void> {
  const now = new Date();
  await Promise.all([
    setDoc(
      doc(db, "users", userId, "attendance", todayKey()),
      {
        date: todayKey(),
        workerId: userId,
        clockIn: formatTime(now),
        clockInTs: now.getTime(),
        clockInLatitude: coords.latitude,
        clockInLongitude: coords.longitude,
        clockInSelfie: selfieUrl,
        status: "pending",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ),
    saveAttendanceRecord({ userId, workplace, attendanceType: "clock_in", coords, selfieUrl }),
  ]);
}

// ─── Break Start ──────────────────────────────────────────────────────────────

export async function startBreak(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings,
  selfieUrl?: string
): Promise<void> {
  const now = new Date();
  const key = todayKey();
  await Promise.all([
    setDoc(
      doc(db, "users", userId, "attendance", key),
      {
        breakStart: formatTime(now),
        breakStartTs: now.getTime(),
        breakStartLatitude: coords.latitude,
        breakStartLongitude: coords.longitude,
        ...(selfieUrl ? { breakStartSelfie: selfieUrl } : {}),
        breakEnd: null,
        breakEndTs: null,
        status: "pending",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "users", userId, "breaks", key),
      {
        date: key,
        workerId: userId,
        startTime: formatTime(now),
        endTime: null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ),
    saveAttendanceRecord({ userId, workplace, attendanceType: "break_start", coords, selfieUrl }),
  ]);
}

// ─── Break End ────────────────────────────────────────────────────────────────

export async function endBreak(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings,
  breakStartTs: number | undefined,
  selfieUrl?: string
): Promise<void> {
  const now = new Date();
  const key = todayKey();
  const breakEndTime = formatTime(now);

  const breakMinutes = breakStartTs
    ? Math.round((now.getTime() - breakStartTs) / 60000)
    : 0;

  await Promise.all([
    setDoc(
      doc(db, "users", userId, "attendance", key),
      {
        breakEnd: breakEndTime,
        breakEndTs: now.getTime(),
        breakEndLatitude: coords.latitude,
        breakEndLongitude: coords.longitude,
        breakMinutes,
        ...(selfieUrl ? { breakEndSelfie: selfieUrl } : {}),
        status: "pending",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "users", userId, "breaks", key),
      {
        endTime: breakEndTime,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    saveAttendanceRecord({ userId, workplace, attendanceType: "break_end", coords, selfieUrl }),
  ]);
}

// ─── Clock Out ───────────────────────────────────────────────────────────────

export async function clockOut(
  userId: string,
  coords: { latitude: number; longitude: number },
  selfieUrl: string,
  workplace: WorkplaceSettings
): Promise<void> {
  const now = new Date();
  await Promise.all([
    setDoc(
      doc(db, "users", userId, "attendance", todayKey()),
      {
        clockOut: formatTime(now),
        clockOutTs: now.getTime(),
        clockOutLatitude: coords.latitude,
        clockOutLongitude: coords.longitude,
        clockOutSelfie: selfieUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    saveAttendanceRecord({ userId, workplace, attendanceType: "clock_out", coords, selfieUrl }),
  ]);
}
