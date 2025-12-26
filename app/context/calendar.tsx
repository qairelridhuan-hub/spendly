import React, { createContext, useContext, useState } from "react";

/* =====================
   TYPES
===================== */

export type ShiftStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "absent";

export type WorkShift = {
  date: string;        // "2025-12-19"
  startTime: string;  // "09:00"
  endTime: string;    // "17:00"
  status: ShiftStatus;
};

/* =====================
   CONTEXT
===================== */

type CalendarContextType = {
  shifts: WorkShift[];
  clockIn: (date: string) => void;
  clockOut: (date: string) => void;
  getUpcomingShifts: () => WorkShift[];
};

const CalendarContext = createContext<CalendarContextType | null>(null);

/* =====================
   PROVIDER
===================== */

export function CalendarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shifts, setShifts] = useState<WorkShift[]>([
    {
      date: "2025-12-19",
      startTime: "09:00",
      endTime: "17:00",
      status: "in_progress",
    },
    {
      date: "2025-12-20",
      startTime: "09:00",
      endTime: "17:00",
      status: "scheduled",
    },
  ]);

  const today = new Date().toISOString().split("T")[0];

  /* =====================
     ACTIONS
  ===================== */

  const clockIn = (date: string) => {
    setShifts(prev =>
      prev.map(s =>
        s.date === date
          ? { ...s, status: "in_progress" }
          : s
      )
    );
  };

  const clockOut = (date: string) => {
    setShifts(prev =>
      prev.map(s =>
        s.date === date
          ? { ...s, status: "completed" }
          : s
      )
    );
  };

  const getUpcomingShifts = () => {
    return shifts.filter(
      s => s.date >= today && s.status !== "completed"
    );
  };

  return (
    <CalendarContext.Provider
      value={{ shifts, clockIn, clockOut, getUpcomingShifts }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

/* =====================
   HOOK
===================== */

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error("useCalendar must be used inside CalendarProvider");
  }
  return ctx;
}