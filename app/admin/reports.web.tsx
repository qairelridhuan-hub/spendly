import { useEffect, useMemo, useState } from "react";
import {
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
import { getPeriodKey } from "@/lib/reports/report";

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
  const [workers, setWorkers] = useState<WorkerMap>({});
  const [config, setConfig] = useState({
    hourlyRate: 0,
    hoursPerDay: 0,
  });

  useEffect(() => {
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as AttendanceLog);
      setAttendanceLogs(list);
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
      });
    });
    return () => {
      unsubAttendance();
      unsubWorkers();
      unsubConfig();
    };
  }, []);

  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );

  const weeklyHoursData = useMemo(
    () => buildWeeklyHours(approvedLogs),
    [approvedLogs]
  );

  const monthlySummary = useMemo(
    () => aggregateAttendance(approvedLogs, attendanceLogs, workers, config.hourlyRate),
    [approvedLogs, attendanceLogs, workers, config.hourlyRate]
  );
  const currentPeriod = getPeriodKey(new Date());
  const currentSummary =
    monthlySummary.find(row => row.period === currentPeriod) ||
    buildSummaryFromAttendance(approvedLogs, attendanceLogs, currentPeriod, workers, config.hourlyRate);

  const monthlyEarningsData = useMemo(
    () => buildMonthlyEarnings(approvedLogs, workers, config.hourlyRate),
    [approvedLogs, workers, config.hourlyRate]
  );

  const breakdownData = useMemo(
    () =>
      buildEarningsBreakdown(
        approvedLogs,
        attendanceLogs,
        workers,
        config.hourlyRate,
        config.hoursPerDay
      ),
    [approvedLogs, attendanceLogs, workers, config.hourlyRate, config.hoursPerDay]
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Reports & Analytics</h2>
          <p style={styles.subtitle}>
            Weekly hours, monthly earnings, and payroll breakdown
          </p>
        </div>
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
    </div>
  );
}

function buildWeeklyHours(logs: AttendanceLog[]) {
  const start = startOfWeek(new Date());
  const end = endOfWeek(new Date());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(day => ({ day, hours: 0 }));
  logs.forEach(log => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return;
    const dayIndex = (date.getDay() + 6) % 7;
    totals[dayIndex].hours += Number(log.hours ?? 0);
  });
  return totals;
}

function buildMonthlyEarnings(
  logs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number
) {
  const months = lastSixMonths();
  const totals: Record<string, number> = {};
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    totals[period] = (totals[period] || 0) + Number(log.hours ?? 0) * rate;
  });
  return months.map(item => ({
    month: item.label,
    earnings: Math.round(totals[item.period] || 0),
  }));
}

function buildEarningsBreakdown(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number,
  hoursPerDay: number
) {
  const period = getPeriodKey(new Date());
  let regular = 0;
  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return;
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    regular += Number(log.hours ?? 0) * rate;
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
    { label: "Overtime", value: 0, color: chartColors.secondary },
    { label: "Deductions", value: deductions, color: chartColors.danger },
  ];
}

function aggregateAttendance(
  approvedLogs: AttendanceLog[],
  allLogs: AttendanceLog[],
  workers: WorkerMap,
  defaultRate: number
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
    map[period].totalHours += Number(log.hours ?? 0);
    map[period].totalEarnings += Number(log.hours ?? 0) * rate;
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
  defaultRate: number
) {
  const totalHours = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + Number(log.hours ?? 0);
  }, 0);
  const absences = allLogs.filter(
    log => String(log.status ?? "") === "absent" && String(log.date ?? "").startsWith(period)
  ).length;
  const totalEarnings = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    const workerId = String(log.workerId ?? "");
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    return sum + Number(log.hours ?? 0) * rate;
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
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 20,
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
