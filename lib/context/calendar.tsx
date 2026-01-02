import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type ShiftStatus = "scheduled" | "completed" | "absent" | "work" | "off" | "leave";
export type ShiftType = "normal" | "half-day" | "remote";

export type Shift = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  hours: number;
  type: ShiftType;
  role: string;
  location: string;
  status: ShiftStatus;
};

type CalendarContextValue = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  shifts: Shift[];
  getShiftsForDate: (date: string) => Shift[];
  getTodayShift: () => Shift | null;
  hasShift: (date: string) => boolean;
};

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

const pad = (value: number) => String(value).padStart(2, "0");

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [userId, setUserId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setShifts([]);
      return;
    }

    const shiftsQuery = query(
      collection(db, "shifts"),
      where("workerId", "==", userId)
    );
    const unsub = onSnapshot(shiftsQuery, snapshot => {
      const nextShifts = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          date: String(data.date ?? ""),
          start: String(data.start ?? ""),
          end: String(data.end ?? ""),
          hours: Number(data.hours ?? 0),
          type: (data.type as ShiftType) ?? "normal",
          role: String(data.role ?? data.type ?? "Shift"),
          location: String(data.location ?? "Assigned"),
          status: (data.status as ShiftStatus) ?? "work",
        } as Shift;
      });
      setShifts(nextShifts);
    });

    return unsub;
  }, [userId]);

  const getShiftsForDate = useCallback(
    (date: string) => shifts.filter(shift => shift.date === date),
    [shifts]
  );

  const getTodayShift = useCallback(() => {
    const today = formatDateKey(new Date());
    return shifts.find(shift => shift.date === today) || null;
  }, [shifts]);

  const hasShift = useCallback(
    (date: string) => shifts.some(shift => shift.date === date),
    [shifts]
  );

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      shifts,
      getShiftsForDate,
      getTodayShift,
      hasShift,
    }),
    [selectedDate, shifts, getShiftsForDate, getTodayShift, hasShift]
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}
