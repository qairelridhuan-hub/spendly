export type WorkConfig = {
  workingDaysPerWeek: number;
  hoursPerDay: number;
  durationMonths: number;
  preferredStart: string;
  preferredEnd: string;
  hourlyRate: number;
  overtimeRate: number;
};

export type ShiftType = "normal" | "half-day" | "remote";
export type ShiftStatus = "work" | "off" | "leave";

export type Shift = {
  workerId: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  hours: number;
  type: ShiftType;
  status: ShiftStatus;
  createdAt: string;
};

export type AttendanceStatus = "pending" | "approved" | "rejected";

export type AttendanceLog = {
  workerId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  status: AttendanceStatus;
  createdAt: string;
};

export type PayrollStatus = "pending" | "verified" | "paid";

export type PayrollRecord = {
  workerId: string;
  period: string; // YYYY-MM
  totalHours: number;
  overtimeHours: number;
  totalEarnings: number;
  absenceDeductions: number;
  status: PayrollStatus;
  updatedAt: string;
};
