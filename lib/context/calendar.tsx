import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ShiftStatus = "scheduled" | "completed" | "absent";

export type Shift = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
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

const defaultShifts: Shift[] = [
  {
    id: "shift-1",
    date: formatDateKey(new Date()),
    start: "09:00",
    end: "13:00",
    role: "Barista",
    location: "Sunrise Cafe",
    status: "scheduled",
  },
  {
    id: "shift-2",
    date: formatDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    start: "16:00",
    end: "20:00",
    role: "Cashier",
    location: "Kiosk 24",
    status: "scheduled",
  },
];

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));

  const shifts = useMemo(() => defaultShifts, []);

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

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}
