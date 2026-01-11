import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildAdminReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";

type AttendanceLog = {
  date?: string;
  hours?: number;
  status?: string;
  workerId?: string;
};

type WorkerMap = Record<string, { name: string; hourlyRate: number }>;

const chartColors = {
  primary: "#4f46e5",
  secondary: "#0ea5e9",
  success: "#22c55e",
  danger: "#ef4444",
  muted: "#94a3b8",
};

export default function AdminReportsWeb() {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [breakLogs, setBreakLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<WorkerMap>({});
  const [config, setConfig] = useState({
    hourlyRate: 0,
    hoursPerDay: 0,
    overtimeRate: 0,
  });

  useEffect(() => {
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as AttendanceLog);
      setAttendanceLogs(list);
    });
    const unsubBreaks = onSnapshot(collectionGroup(db, "breaks"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setBreakLogs(list);
    });
    const unsubOvertime = onSnapshot(collectionGroup(db, "overtime"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setOvertimeLogs(list);
    });
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const map: WorkerMap = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] = {
          name: data.fullName || data.displayName || data.email || "Worker",
          hourlyRate: Number(data.hourlyRate ?? 0),
        };
      });
      setWorkers(map);
    });
    const configRef = doc(db, "config", "system");
    const unsubConfig = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setConfig({
        hourlyRate: Number(data.hourlyRate ?? 0),
        hoursPerDay: Number(data.hoursPerDay ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
      });
    });
    return () => {
      unsubAttendance();
      unsubBreaks();
      unsubOvertime();
      unsubWorkers();
      unsubConfig();
    };
  }, []);

  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const breakMinutesByKey = useMemo(() => buildBreakMinutesMap(breakLogs), [breakLogs]);
  const overtimeHoursByKey = useMemo(() => buildOvertimeHoursMap(overtimeLogs), [overtimeLogs]);

  const weeklyHoursData = useMemo(
    () =>
      buildWeeklyHours(
        approvedLogs,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [approvedLogs, breakMinutesByKey, overtimeHoursByKey]
  );

  const monthlySummary = useMemo(
    () =>
      aggregateAttendance(
        approvedLogs,
        attendanceLogs,
        workers,
        config.hourlyRate,
        config.overtimeRate,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [
      approvedLogs,
      attendanceLogs,
      workers,
      config.hourlyRate,
      config.overtimeRate,
      breakMinutesByKey,
      overtimeHoursByKey,
    ]
  );
  const currentPeriod = getPeriodKey(new Date());
  const currentSummary =
    monthlySummary.find(row => row.period === currentPeriod) ||
    buildSummaryFromAttendance(
      approvedLogs,
      attendanceLogs,
      currentPeriod,
      workers,
      config.hourlyRate,
      config.overtimeRate,
      breakMinutesByKey,
      overtimeHoursByKey
    );

  const monthlyEarningsData = useMemo(
    () =>
      buildMonthlyEarnings(
        approvedLogs,
        workers,
        config.hourlyRate,
        config.overtimeRate,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [approvedLogs, workers, config.hourlyRate, config.overtimeRate, breakMinutesByKey, overtimeHoursByKey]
  );
  const hoursVsEarningsData = useMemo(
    () =>
      buildMonthlyHoursVsEarnings(
        approvedLogs,
        workers,
        config.hourlyRate,
        config.overtimeRate,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [approvedLogs, workers, config.hourlyRate, config.overtimeRate, breakMinutesByKey, overtimeHoursByKey]
  );

  const breakdownData = useMemo(
    () =>
      buildEarningsBreakdown(
        approvedLogs,
        attendanceLogs,
        workers,
        config.hourlyRate,
        config.overtimeRate,
        config.hoursPerDay,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [
      approvedLogs,
      attendanceLogs,
      workers,
      config.hourlyRate,
      config.overtimeRate,
      config.hoursPerDay,
      breakMinutesByKey,
      overtimeHoursByKey,
    ]
  );
  const workerRows = useMemo(
    () =>
      buildReportWorkers(
        approvedLogs,
        attendanceLogs,
        currentPeriod,
        workers,
        config.hourlyRate,
        config.overtimeRate,
        breakMinutesByKey,
        overtimeHoursByKey
      ),
    [
      approvedLogs,
      attendanceLogs,
      currentPeriod,
      workers,
      config.hourlyRate,
      config.overtimeRate,
      breakMinutesByKey,
      overtimeHoursByKey,
    ]
  );

  const handleExportReport = async () => {
    const shouldDownload =
      typeof window === "undefined"
        ? true
        : window.confirm("Generate and download the PDF report for this period?");
    if (!shouldDownload) return;
    const html = buildAdminReportHtml({
      period: currentPeriod,
      summary: {
        totalHours: currentSummary.totalHours,
        overtimeHours: currentSummary.overtimeHours,
        absenceDeductions: currentSummary.absenceDeductions,
        totalEarnings: currentSummary.totalEarnings,
      },
      workers: workerRows,
    });
    await printReport(html);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Reports & Analytics</h2>
          <p style={styles.subtitle}>
            Weekly hours, monthly earnings, and payroll breakdown
          </p>
        </div>
        <button style={styles.generateButton} onClick={handleExportReport}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          Generate report
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>This Month</p>
          <p style={styles.summaryValue}>{currentSummary.totalHours.toFixed(0)} hours</p>
          <p style={styles.summaryHint}>Approved hours</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Payroll</p>
          <p style={styles.summaryValue}>RM {currentSummary.totalEarnings.toFixed(0)}</p>
          <p style={styles.summaryHint}>Net earnings</p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.summaryLabel}>Avg / Worker</p>
          <p style={styles.summaryValue}>
            RM {averagePerWorker(currentSummary).toFixed(0)}
          </p>
          <p style={styles.summaryHint}>Current period</p>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeaderRow}>
          <h3 style={styles.tableTitle}>Monthly Summary</h3>
          <p style={styles.tableSubtitle}>Approved hours and payroll by month</p>
        </div>
        {monthlySummary.length === 0 ? (
          <p style={styles.emptyText}>No payroll summaries yet.</p>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableRowHeader}>
              {["Month", "Total Hours", "Absences", "Total Payroll"].map(label => (
                <span key={label} style={styles.tableHeaderCell}>
                  {label}
                </span>
              ))}
            </div>
            {monthlySummary.map(row => (
              <div key={row.period} style={styles.tableRow}>
                <span style={styles.tableCell}>{row.period}</span>
                <span style={styles.tableCellMuted}>{row.totalHours.toFixed(0)}</span>
                <span style={styles.tableCellMuted}>{row.absenceDeductions.toFixed(0)}</span>
                <span style={styles.tableCellStrong}>RM {row.totalEarnings.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.grid}>
        <Card>
          <CardHeader
            title="Weekly Hours Trend"
            subtitle="Approved hours by day (Mon–Sun)"
          />
          <CardContent>
            <ChartContainer height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyHoursData}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="hours" fill={chartColors.primary} radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Monthly Earnings Trend"
            subtitle="Last 6 months"
          />
          <CardContent>
            <ChartContainer height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyEarningsData}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line
                    dataKey="earnings"
                    stroke={chartColors.secondary}
                    strokeWidth={3}
                    dot={{ fill: chartColors.secondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Earnings Breakdown"
            subtitle="Regular vs overtime vs deductions"
          />
          <CardContent>
            <ChartContainer height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={breakdownData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                  >
                    {breakdownData.map(item => (
                      <Cell key={item.label} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div style={styles.legend}>
              {breakdownData.map(item => (
                <div key={item.label} style={styles.legendRow}>
                  <span style={{ ...styles.legendDot, background: item.color }} />
                  <span style={styles.legendLabel}>{item.label}</span>
                  <span style={styles.legendValue}>
                    RM {item.value.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div style={styles.fullWidthSection}>
        <Card>
          <CardHeader
            title="Hours vs Earnings"
            subtitle="Total hours vs total earnings (last 6 months)"
          />
          <CardContent>
            <ChartContainer height={280}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hoursVsEarningsData}>
                  <defs>
                    <linearGradient id="fillHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={chartColors.success} stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke={chartColors.success}
                    fill="url(#fillHours)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke={chartColors.secondary}
                    fill="url(#fillEarnings)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function buildWeeklyHours(
  logs: AttendanceLog[],
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const start = startOfWeek(new Date());
  const end = endOfWeek(new Date());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(day => ({ day, hours: 0 }));
  logs.forEach(log => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return;
    const dayIndex = (date.getDay() + 6) % 7;
    totals[dayIndex].hours += getLogHours(log, breakMinutesByKey);
  });
  return totals;
}

function buildMonthlyEarnings(
  logs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const months = lastSixMonths();
  const totals: Record<string, number> = {};
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    totals[period] =
      (totals[period] || 0) +
      getLogEarnings(log, rate, overtimeRate, breakMinutesByKey);
  });
  return months.map(item => ({
    month: item.label,
    earnings: Math.round(totals[item.period] || 0),
  }));
}

function buildMonthlyHoursVsEarnings(
  logs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const months = lastSixMonths();
  const totals: Record<string, { hours: number; earnings: number }> = {};
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    const hours = getLogHours(log, breakMinutesByKey);
    totals[period] = totals[period] || { hours: 0, earnings: 0 };
    totals[period].hours += hours;
    totals[period].earnings += getLogEarnings(
      log,
      rate,
      overtimeRate,
      breakMinutesByKey
    );
  });

  Object.entries(overtimeHoursByKey).forEach(([key, hours]) => {
    const [workerId, date] = key.split(":");
    if (!date || date.length < 7) return;
    const period = date.slice(0, 7);
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    totals[period] = totals[period] || { hours: 0, earnings: 0 };
    totals[period].hours += hours;
    totals[period].earnings += hours * (overtimeRate || rate * 1.5);
  });

  return months.map(item => ({
    month: item.label,
    hours: Math.round(totals[item.period]?.hours || 0),
    earnings: Math.round(totals[item.period]?.earnings || 0),
  }));
}

function buildEarningsBreakdown(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  hoursPerDay: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const period = getPeriodKey(new Date());
  let regular = 0;
  let overtime = 0;
  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return;
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    const netHours = getLogHours(log, breakMinutesByKey);
    const overtimeHours = getLogOvertimeHours(log);
    const regularHours = Math.max(0, netHours - overtimeHours);
    regular += regularHours * rate;
    overtime += overtimeHours * overtimeRate;
  });

  let deductions = 0;
  allLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return;
    if (String(log.status ?? "") !== "absent") return;
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    deductions += (hoursPerDay || 0) * rate;
  });

  return [
    { label: "Regular", value: regular, color: chartColors.success },
    { label: "Overtime", value: overtime, color: chartColors.secondary },
    { label: "Deductions", value: deductions, color: chartColors.danger },
  ];
}

function buildReportWorkers(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  period: string,
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const map: Record<
    string,
    {
      workerId: string;
      name: string;
      totalHours: number;
      overtimeHours: number;
      totalEarnings: number;
      absenceDeductions: number;
      status: string;
    }
  > = {};

  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return;
    const workerId = String(log.workerId ?? "");
    if (!workerId) return;
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    map[workerId] = map[workerId] || {
      workerId,
      name: workers[workerId]?.name || workerId || "Worker",
      totalHours: 0,
      overtimeHours: 0,
      totalEarnings: 0,
      absenceDeductions: 0,
      status: "pending",
    };
    const hours = getLogHours(log, breakMinutesByKey);
    map[workerId].totalHours += hours;
    map[workerId].totalEarnings += getLogEarnings(
      log,
      rate,
      overtimeRate,
      breakMinutesByKey
    );
  });

  Object.entries(overtimeHoursByKey).forEach(([key, hours]) => {
    const [workerId, date] = key.split(":");
    if (!date?.startsWith(period)) return;
    map[workerId] = map[workerId] || {
      workerId,
      name: workers[workerId]?.name || workerId || "Worker",
      totalHours: 0,
      overtimeHours: 0,
      totalEarnings: 0,
      absenceDeductions: 0,
      status: "pending",
    };
    map[workerId].overtimeHours += hours;
    map[workerId].totalHours += hours;
    map[workerId].totalEarnings += hours * overtimeRate;
  });

  allLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return;
    if (String(log.status ?? "") !== "absent") return;
    const workerId = String(log.workerId ?? "");
    if (!workerId) return;
    map[workerId] = map[workerId] || {
      workerId,
      name: workers[workerId]?.name || workerId || "Worker",
      totalHours: 0,
      overtimeHours: 0,
      totalEarnings: 0,
      absenceDeductions: 0,
      status: "pending",
    };
    map[workerId].absenceDeductions += 1;
  });

  return Object.values(map);
}

function aggregateAttendance(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const map: Record<string, any> = {};
  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    map[period] = map[period] || {
      period,
      totalHours: 0,
      absenceDeductions: 0,
      totalEarnings: 0,
      workers: new Set<string>(),
    };
    const hours = getLogHours(log, breakMinutesByKey);
    map[period].totalHours += hours;
    map[period].totalEarnings += getLogEarnings(log, rate, overtimeRate, breakMinutesByKey);
    if (workerId) map[period].workers.add(workerId);
  });
  allLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    if (String(log.status ?? "") !== "absent") return;
    const period = date.slice(0, 7);
    map[period] = map[period] || {
      period,
      totalHours: 0,
      absenceDeductions: 0,
      totalEarnings: 0,
      workers: new Set<string>(),
    };
    map[period].absenceDeductions += 1;
  });
  return Object.values(map).sort((a: any, b: any) =>
    String(b.period).localeCompare(String(a.period))
  );
}

function buildSummaryFromAttendance(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  period: string,
  workers: WorkerMap,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) {
  const totalHours = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + getLogHours(log, breakMinutesByKey);
  }, 0);
  const overtimeHours = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + getLogOvertimeHours(log);
  }, 0);
  const absences = allLogs.filter(
    log => String(log.status ?? "") === "absent" && String(log.date ?? "").startsWith(period)
  ).length;
  const totalEarnings = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    return sum + getLogEarnings(log, rate, overtimeRate, breakMinutesByKey);
  }, 0);
  const workersSet = new Set(
    approvedLogs
      .filter(log => String(log.date ?? "").startsWith(period))
      .map(log => String(log.workerId ?? ""))
      .filter(Boolean)
  );
  return {
    period,
    totalHours,
    absenceDeductions: absences,
    totalEarnings,
    workers: workersSet,
  };
}

function getOwnerId(docSnap: any) {
  return docSnap.ref?.parent?.parent?.id || docSnap.data()?.workerId || "";
}

function buildBreakMinutesMap(entries: any[]) {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const workerId = String(entry.workerId ?? "");
    const date = String(entry.date ?? "");
    if (!workerId || !date) return;
    if (!entry.startTime || !entry.endTime) return;
    const minutes = calcMinutesDiff(entry.startTime, entry.endTime);
    map[`${workerId}:${date}`] = (map[`${workerId}:${date}`] ?? 0) + minutes;
  });
  return map;
}

function buildOvertimeHoursMap(entries: any[]) {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const workerId = String(entry.workerId ?? "");
    const date = String(entry.date ?? "");
    if (!workerId || !date) return;
    let hours = Number(entry.hours ?? 0);
    if (!hours && entry.startTime && entry.endTime) {
      hours = calcHoursFromTimes(entry.startTime, entry.endTime, 0);
    }
    if (!hours) return;
    map[`${workerId}:${date}`] = (map[`${workerId}:${date}`] ?? 0) + hours;
  });
  return map;
}

function getLogHours(log: AttendanceLog, breakMinutesByKey: Record<string, number>) {
  const storedNet = Number((log as any).netHours ?? (log as any).net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log, breakMinutesByKey);
  return calcHoursFromTimes(
    String((log as any).clockIn ?? ""),
    String((log as any).clockOut ?? ""),
    breakMinutes
  );
}

function getLogOvertimeHours(log: AttendanceLog) {
  const stored = Number((log as any).overtimeHours ?? (log as any).overtime_hours ?? 0);
  if (stored > 0) return stored;
  return 0;
}

function getLogEarnings(
  log: AttendanceLog,
  hourlyRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>
) {
  const finalPay = Number((log as any).finalPay ?? (log as any).final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log, breakMinutesByKey);
  const overtimeHours = getLogOvertimeHours(log);
  const regularHours = Math.max(0, netHours - overtimeHours);
  const resolvedOvertimeRate = overtimeRate || hourlyRate * 1.5;
  return regularHours * hourlyRate + overtimeHours * resolvedOvertimeRate;
}

function getBreakMinutesForLog(log: AttendanceLog, breakMinutesByKey: Record<string, number>) {
  const stored = Number((log as any).breakMinutes ?? 0);
  if (stored > 0) return stored;
  const dateKey = `${String(log.workerId ?? "")}:${String(log.date ?? "")}`;
  return breakMinutesByKey[dateKey] ?? 0;
}

function calcMinutesDiff(start: string, end: string) {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
}

function calcHoursFromTimes(start: string, end: string, breakMinutes = 0) {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  const totalMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
  return totalMinutes / 60;
}

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function averagePerWorker(summary: any) {
  if (!summary) return 0;
  const workersCount = summary.workers?.size || 0;
  if (!workersCount) return 0;
  return summary.totalEarnings / workersCount;
}

function lastSixMonths() {
  const items: { period: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", { month: "short" });
    items.push({ period, label });
  }
  return items;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={styles.card}>{children}</div>;
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={styles.cardHeader}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {subtitle ? <p style={styles.cardSubtitle}>{subtitle}</p> : null}
    </div>
  );
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div style={styles.cardContent}>{children}</div>;
}

function ChartContainer({
  children,
  height,
}: {
  children: React.ReactNode;
  height: number;
}) {
  return <div style={{ ...styles.chartContainer, height }}>{children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "32px 40px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  generateButton: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: "#1e40af",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
  },
  fullWidthSection: {
    marginTop: 20,
    width: "100%",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: "16px 18px",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
  },
  summaryLabel: { margin: 0, color: "#64748b", fontSize: 12, fontWeight: 600 },
  summaryValue: { margin: "8px 0 4px", fontSize: 20, fontWeight: 700 },
  summaryHint: { margin: 0, color: "#94a3b8", fontSize: 12 },
  tableCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    padding: "18px 20px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    marginBottom: 24,
  },
  tableHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 12,
  },
  tableTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  tableSubtitle: { fontSize: 12, color: "#64748b", margin: 0 },
  table: {
    display: "grid",
    gap: 6,
  },
  tableRowHeader: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
    gap: 8,
    padding: "8px 10px",
    background: "#f1f5f9",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
  },
  tableHeaderCell: { fontSize: 12 },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
    gap: 8,
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    color: "#0f172a",
  },
  tableCell: { fontWeight: 600 },
  tableCellMuted: { color: "#64748b" },
  tableCellStrong: { fontWeight: 600, color: "#16a34a" },
  emptyText: { margin: 0, color: "#94a3b8", fontSize: 12 },
  card: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
  },
  cardHeader: { padding: "18px 20px 0" },
  cardTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  cardSubtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 12 },
  cardContent: { padding: "16px 20px 20px" },
  chartContainer: {
    width: "100%",
  },
  legend: { marginTop: 12, display: "grid", gap: 8 },
  legendRow: {
    display: "grid",
    gridTemplateColumns: "16px 1fr auto",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#475569",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendLabel: { fontWeight: 500 },
  legendValue: { fontWeight: 600, color: "#0f172a" },
};
