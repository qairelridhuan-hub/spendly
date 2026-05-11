import {
  doc,
  getDoc,
  setDoc,
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

export type AttendanceLoadResult =
  | { ok: true; workplace: WorkplaceSettings; today: TodayAttendanceState }
  | { ok: false; error: "no-workplace" | "fetch-failed" | "offline" };

// ─── Fetch Workplace Settings ─────────────────────────────────────────────────

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

// ─── Fetch Today's Attendance ─────────────────────────────────────────────────

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
    breakStartTs?: number;
  };

  return {
    clockedIn:    !!data.clockIn,
    clockedOut:   !!data.clockOut,
    onBreak:      !!data.breakStart && !data.breakEnd,
    clockIn:      data.clockIn,
    clockOut:     data.clockOut,
    breakStart:   data.breakStart,
    breakEnd:     data.breakEnd,
    breakStartTs: data.breakStartTs,
  };
}

// ─── Full Load Sequence ───────────────────────────────────────────────────────

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

// ─── Location metadata helper ─────────────────────────────────────────────────

function locationMeta(coords: { latitude: number; longitude: number }, workplace: WorkplaceSettings) {
  const distance = calculateDistanceInMeters(
    coords.latitude, coords.longitude,
    workplace.workplaceLatitude, workplace.workplaceLongitude
  );
  return {
    distanceFromWorkplace: Math.round(distance),
    locationStatus:        distance <= workplace.allowedRadiusMeters ? "inside" : "outside",
    workplaceId:           workplace.workplaceId,
  };
}

// ─── Clock In ────────────────────────────────────────────────────────────────

export async function clockIn(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings
): Promise<void> {
  const now = new Date();
  await setDoc(
    doc(db, "users", userId, "attendance", todayKey()),
    {
      date:             todayKey(),
      workerId:         userId,
      clockIn:          formatTime(now),
      clockInTs:        now.getTime(),
      clockInLatitude:  coords.latitude,
      clockInLongitude: coords.longitude,
      status:           "pending",
      updatedAt:        serverTimestamp(),
      createdAt:        serverTimestamp(),
      ...locationMeta(coords, workplace),
    },
    { merge: true }
  );
}

// ─── Clock Out ───────────────────────────────────────────────────────────────

export async function clockOut(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings
): Promise<void> {
  const now = new Date();
  await setDoc(
    doc(db, "users", userId, "attendance", todayKey()),
    {
      clockOut:          formatTime(now),
      clockOutTs:        now.getTime(),
      clockOutLatitude:  coords.latitude,
      clockOutLongitude: coords.longitude,
      updatedAt:         serverTimestamp(),
      ...locationMeta(coords, workplace),
    },
    { merge: true }
  );
}

// ─── Break Start ──────────────────────────────────────────────────────────────

export async function startBreak(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings
): Promise<void> {
  const now = new Date();
  const key = todayKey();
  await Promise.all([
    setDoc(
      doc(db, "users", userId, "attendance", key),
      {
        breakStart:          formatTime(now),
        breakStartTs:        now.getTime(),
        breakStartLatitude:  coords.latitude,
        breakStartLongitude: coords.longitude,
        breakEnd:            null,
        breakEndTs:          null,
        status:              "pending",
        updatedAt:           serverTimestamp(),
        ...locationMeta(coords, workplace),
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "users", userId, "breaks", key),
      {
        date:      key,
        workerId:  userId,
        startTime: formatTime(now),
        endTime:   null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

// ─── Break End ────────────────────────────────────────────────────────────────

export async function endBreak(
  userId: string,
  coords: { latitude: number; longitude: number },
  workplace: WorkplaceSettings,
  breakStartTs: number | undefined
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
        breakEnd:          breakEndTime,
        breakEndTs:        now.getTime(),
        breakEndLatitude:  coords.latitude,
        breakEndLongitude: coords.longitude,
        breakMinutes,
        status:            "pending",
        updatedAt:         serverTimestamp(),
        ...locationMeta(coords, workplace),
      },
      { merge: true }
    ),
    setDoc(
      doc(db, "users", userId, "breaks", key),
      {
        endTime:   breakEndTime,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}
