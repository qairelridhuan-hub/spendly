# Spendly Firestore Schema

This document defines the shared Firebase schema used by the Admin (web) and Worker (mobile) apps.

## Top-level collections

### users/{uid}
- role: "admin" | "worker"
- fullName: string
- displayName: string
- email: string
- phone: string
- position: string
- photoUrl: string
- status: "active" | "inactive"
- hourlyRate: number
- joinDate: "YYYY-MM-DD"
- scheduleId: string
- scheduleName: string
- createdAt: string (ISO)
- updatedAt: string (ISO)

#### users/{uid}/attendance/{YYYY-MM-DD}
- date: "YYYY-MM-DD"
- workerId: string
- clockIn: "HH:MM"
- clockOut: "HH:MM"
- clockInTs: number (ms since epoch)
- clockOutTs: number (ms since epoch)
- breakStart: "HH:MM"
- breakEnd: "HH:MM"
- breakStartTs: number (ms since epoch)
- breakEndTs: number (ms since epoch)
- breakMinutes: number
- hours: number
- status: "pending" | "approved" | "rejected" | "absent"
- createdAt: serverTimestamp
- updatedAt: serverTimestamp

#### users/{uid}/payroll/{period}
- workerId: string
- period: "YYYY-MM"
- totalHours: number
- overtimeHours: number
- totalEarnings: number
- absenceDeductions: number
- status: "pending" | "verified" | "paid"
- updatedAt: string (ISO)

#### users/{uid}/goals/{goalId}
- name: string
- targetAmount: number
- savedAmount: number
- weeklyTarget: number
- priority: "high" | "medium" | "low"
- dueDate: "YYYY-MM-DD"
- notes: string
- createdAt: serverTimestamp
- updatedAt: serverTimestamp

### workSchedules/{scheduleId}
- name: string
- days: string[] (e.g., ["Monday","Wednesday"])
- startTime: "HH:MM"
- endTime: "HH:MM"
- hourlyRate: number
- description: string
- createdAt: serverTimestamp
- updatedAt: serverTimestamp

### shifts/{shiftId}
- workerId: string
- date: "YYYY-MM-DD"
- start: "HH:MM"
- end: "HH:MM"
- hours: number
- type: "normal" | "half-day" | "remote"
- role: string
- location: string
- status: "scheduled" | "completed" | "absent" | "work" | "off" | "leave"
- createdAt: serverTimestamp
- updatedAt: serverTimestamp

### config/system
- workingDaysPerWeek: number
- hoursPerDay: number
- durationMonths: number
- preferredStart: "HH:MM"
- preferredEnd: "HH:MM"
- hourlyRate: number
- overtimeRate: number
- budgetAllocation: [{ category: string, amount: number, color: string }]
- updatedAt: string (ISO)

### notifications/{notificationId}
- type: "attendance" | "payroll" | "system"
- title: string
- message: string
- status: string
- workerId: string (optional)
- targetRole: "worker" | "admin" | "all"
- createdAt: serverTimestamp
- readAt: serverTimestamp (optional)

## Data flow notes
- Admin changes in `workSchedules`, `config/system`, `shifts`, and `users/{uid}` are consumed by worker dashboards.
- Worker attendance writes go to `users/{uid}/attendance/{YYYY-MM-DD}` and surface in Admin Attendance.
- Admin approval/rejection writes update the same attendance docs and create `notifications`.
- Payroll status updates create notifications and sync to `users/{uid}/payroll/{period}`.
