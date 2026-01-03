import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  BarChart3,
  Bell,
  Calendar,
  DollarSign,
  LogOut,
  PieChart,
  TrendingUp,
} from "lucide-react-native";
import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

type WeeklyEntry = { week: string; earnings: number };
type BudgetItem = {
  category: string;
  amount: number;
  color: string;
};

export default function EarningsScreen() {
  const [displayName, setDisplayName] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [userHourlyRate, setUserHourlyRate] = useState(0);
  const [schedule, setSchedule] = useState<{
    id: string;
    name: string;
    days: string[];
    startTime: string;
    endTime: string;
    hourlyRate: number;
  } | null>(null);
  const [workConfig, setWorkConfig] = useState({
    hourlyRate: 0,
    overtimeRate: 0,
  });
  const [budgetAllocation, setBudgetAllocation] = useState<BudgetItem[]>([]);
  const [payroll, setPayroll] = useState<{
    totalHours: number;
    overtimeHours: number;
    totalEarnings: number;
    absenceDeductions: number;
    status?: string;
    period?: string;
  } | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

  const hourlyRate =
    schedule?.hourlyRate ?? userHourlyRate ?? workConfig.hourlyRate;
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const currentPeriod = getPeriodKey(new Date());
  const weeklyData = useMemo(
    () => buildWeeklyData(approvedLogs, hourlyRate),
    [approvedLogs, hourlyRate]
  );
  const totalMonthly = useMemo(
    () => getTotalEarningsForPeriod(approvedLogs, hourlyRate, currentPeriod),
    [approvedLogs, hourlyRate, currentPeriod]
  );
  const maxWeekly = weeklyData.length
    ? Math.max(...weeklyData.map(w => w.earnings))
    : 0;
  const totalBudget = budgetAllocation.reduce((sum, b) => sum + b.amount, 0);
  const daysWorked = getDaysWorkedForPeriod(approvedLogs, currentPeriod);
  const totalHours = getTotalHoursForPeriod(approvedLogs, currentPeriod);
  const overtimeHours = 0;
  const scheduleHoursPerDay = schedule
    ? diffHours(schedule.startTime, schedule.endTime)
    : workConfig.hoursPerDay;
  const absenceDays = getAbsenceDaysForPeriod(attendanceLogs, currentPeriod);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
      if (!user) {
        setDisplayName("User");
        return;
      }
      if (user.displayName) setDisplayName(user.displayName);
      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as {
          fullName?: string;
          scheduleId?: string;
          hourlyRate?: number;
        } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
        setScheduleId(data?.scheduleId ?? null);
        if (data?.hourlyRate != null) {
          setUserHourlyRate(Number(data.hourlyRate));
        }
      });
      return () => unsubProfile();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!scheduleId) {
      setSchedule(null);
      return;
    }
    const scheduleRef = doc(db, "workSchedules", scheduleId);
    const unsub = onSnapshot(scheduleRef, snap => {
      if (!snap.exists()) {
        setSchedule(null);
        return;
      }
      const data = snap.data() as any;
      setSchedule({
        id: snap.id,
        name: data.name || "Schedule",
        days: Array.isArray(data.days) ? data.days : [],
        startTime: data.startTime || "09:00",
        endTime: data.endTime || "17:00",
        hourlyRate: Number(data.hourlyRate ?? 0),
      });
    });
    return unsub;
  }, [scheduleId]);

  useEffect(() => {
    const configRef = doc(db, "config", "system");
    const unsub = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setWorkConfig({
        hourlyRate: Number(data.hourlyRate ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
      });
      if (Array.isArray(data.budgetAllocation)) {
        setBudgetAllocation(
          data.budgetAllocation
            .filter((item: any) => item && item.category && item.amount != null)
            .map((item: any) => ({
              category: String(item.category),
              amount: Number(item.amount ?? 0),
              color: String(item.color ?? "#0ea5e9"),
            }))
        );
      } else {
        setBudgetAllocation([]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setPayroll(null);
      return;
    }
    const payrollRef = collection(db, "users", userId, "payroll");
    const unsub = onSnapshot(payrollRef, snapshot => {
      const records = snapshot.docs.map(docSnap => docSnap.data() as any);
      const latest = pickLatestPayroll(records);
      if (!latest) {
        setPayroll(null);
        return;
      }
      setPayroll({
        totalHours: Number(latest.totalHours ?? 0),
        overtimeHours: Number(latest.overtimeHours ?? 0),
        totalEarnings: Number(latest.totalEarnings ?? 0),
        absenceDeductions: Number(latest.absenceDeductions ?? 0),
        status: String(latest.status ?? "pending"),
        period: String(latest.period ?? ""),
      });
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAttendanceLogs([]);
      return;
    }
    const attendanceRef = collection(db, "users", userId, "attendance");
    const unsub = onSnapshot(attendanceRef, snapshot => {
      const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
      setAttendanceLogs(logs);
    });
    return unsub;
  }, [userId]);

  const normalHours = Math.max(0, totalHours - overtimeHours);
  const normalRate = hourlyRate;
  const overtimeRate = workConfig.overtimeRate;
  const deduction = absenceDays * scheduleHoursPerDay * hourlyRate;
  const breakdownTotal =
    normalHours * normalRate + overtimeHours * overtimeRate - deduction;
  const percentChange = 0;

  return (
    <LinearGradient colors={["#f8fafc", "#eef2f7"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* ===== HEADER ===== */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.logo}
                onPress={() => router.push("/(tabs)/profile")}
              >
                <Text style={styles.logoText}>💰</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.appName}>Spendly</Text>
                <Text style={styles.subText}>Hey, {displayName}!</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")}>
                <Bell size={22} color="#0f172a" />
                <View style={styles.notifDot} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await signOut(auth);
                  } finally {
                    // keep tab layout consistent with other screens
                  }
                }}
              >
                <LogOut size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Monthly Summary ===== */}
          <LinearGradient
            colors={["#16a34a", "#22c55e"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryTag}>
                <DollarSign size={16} color="#ffffff" />
                <Text style={styles.summaryMonth}>
                  {payroll?.period ? formatPeriodLabel(payroll.period) : "No data"}
                </Text>
              </View>
              <View style={styles.verifiedChip}>
                <Text style={styles.verifiedText}>
                  {payroll?.status === "paid" ? "Paid" : "Pending"}
                </Text>
              </View>
            </View>

            <Text style={styles.summaryAmount}>
              RM {totalMonthly.toFixed(2)}
            </Text>
            <Text style={styles.summarySub}>Total Monthly Earnings</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryDelta}>+{percentChange}%</Text>
              <Text style={styles.summaryHint}>from last month</Text>
            </View>
          </LinearGradient>

          {/* ===== Quick Stats ===== */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Days Worked</Text>
              <Text style={styles.statValue}>{daysWorked}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Hours</Text>
              <Text style={styles.statValue}>{Math.round(totalHours)}h</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Overtime</Text>
              <Text style={styles.statHighlight}>{overtimeHours}h</Text>
            </View>
          </View>

          {/* ===== Weekly Earnings ===== */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <TrendingUp size={18} color="#0ea5e9" />
              <Text style={styles.cardTitle}>Weekly Earnings</Text>
            </View>

            {weeklyData.length === 0 ? (
              <Text style={styles.emptyText}>No weekly earnings yet</Text>
            ) : (
              <View style={styles.chartRow}>
                {weeklyData.map(entry => {
                  const height = Math.max(
                    16,
                    Math.round((entry.earnings / maxWeekly) * 120)
                  );
                  return (
                    <View key={entry.week} style={styles.chartColumn}>
                      <View style={[styles.chartBar, { height }]} />
                      <Text style={styles.chartValue}>
                        RM {entry.earnings}
                      </Text>
                      <Text style={styles.chartLabel}>{entry.week}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ===== Budget Allocation ===== */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <PieChart size={18} color="#0ea5e9" />
              <Text style={styles.cardTitle}>Budget Allocation</Text>
            </View>

            {budgetAllocation.length === 0 ? (
              <Text style={styles.emptyText}>No budget allocation yet</Text>
            ) : (
              budgetAllocation.map(item => {
                const percentage =
                  totalBudget === 0 ? 0 : (item.amount / totalBudget) * 100;
                return (
                  <View key={item.category} style={styles.budgetItem}>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>{item.category}</Text>
                      <Text style={styles.budgetValue}>RM {item.amount}</Text>
                    </View>
                    <View style={styles.budgetBar}>
                      <View
                        style={[
                          styles.budgetFill,
                          {
                            width: `${percentage}%`,
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ===== Salary Breakdown ===== */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BarChart3 size={18} color="#0ea5e9" />
              <Text style={styles.cardTitle}>Salary Breakdown</Text>
            </View>

            <View style={styles.breakdownRow}>
              <View>
                <Text style={styles.breakdownTitle}>
                  Normal Hours ({normalHours}h)
                </Text>
                <Text style={styles.breakdownHint}>RM {normalRate}/hour</Text>
              </View>
              <Text style={styles.breakdownPositive}>
                RM {(normalHours * normalRate).toFixed(0)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View>
                <Text style={styles.breakdownTitle}>
                  Overtime ({overtimeHours}h)
                </Text>
                <Text style={styles.breakdownHint}>RM {overtimeRate}/hour</Text>
              </View>
              <Text style={styles.breakdownPositive}>
                RM {(overtimeHours * overtimeRate).toFixed(0)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View>
                <Text style={styles.breakdownTitle}>Deduction (Absent)</Text>
                <Text style={styles.breakdownHint}>
                  {absenceDays} day{absenceDays === 1 ? "" : "s"}
                </Text>
              </View>
              <Text style={styles.breakdownNegative}>-RM {deduction}</Text>
            </View>
            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotal}>Total</Text>
              <Text style={styles.breakdownPositive}>
                RM {breakdownTotal.toFixed(0)}
              </Text>
            </View>
          </View>

          {/* ===== Smart Suggestion ===== */}
          <LinearGradient
            colors={["#e0f2fe", "#e0e7ff"]}
            style={styles.tipCard}
          >
            <Text style={styles.tipTitle}>💡 Smart Suggestion</Text>
            <Text style={styles.tipText}>
              Add earnings data to unlock personalized suggestions.
            </Text>
            <View style={styles.tipRow}>
              <Calendar size={14} color="#0f172a" />
              <Text style={styles.tipHint}>
                Tips will appear once earnings are tracked
              </Text>
            </View>
            <TouchableOpacity style={[styles.tipButton, styles.disabledButton]} disabled>
              <Text style={styles.tipButtonText}>Apply suggestion</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const formatPeriodLabel = (period: string) => {
  if (!period) return "—";
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex)) return period;
  return new Date(Number(year), monthIndex, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const pad = (value: number) => String(value).padStart(2, "0");
const getPeriodKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const pickLatestPayroll = (records: any[]) => {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) =>
    String(b.period ?? "").localeCompare(String(a.period ?? ""))
  );
  return sorted[0];
};

const buildWeeklyData = (
  logs: { date?: string; hours?: number }[],
  hourlyRate: number
): WeeklyEntry[] => {
  const weeks: { label: string; start: Date; end: Date }[] = [];
  const today = new Date();
  const currentWeekStart = startOfWeek(today);

  for (let i = 3; i >= 0; i -= 1) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    weeks.push({
      label: `Week ${4 - i}`,
      start,
      end,
    });
  }

  return weeks.map(week => {
    const hours = logs.reduce((sum, log) => {
      const date = new Date(`${log.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return sum;
      if (date < week.start || date > week.end) return sum;
      return sum + Number(log.hours ?? 0);
    }, 0);
    return {
      week: week.label,
      earnings: Math.round(hours * hourlyRate),
    };
  });
};

const getDaysWorkedForPeriod = (
  logs: { date?: string }[],
  period: string
) => {
  const uniqueDates = new Set(
    logs
      .map(log => log.date)
      .filter(date => typeof date === "string" && date.startsWith(period))
  );
  return uniqueDates.size;
};

const getTotalHoursForPeriod = (
  logs: { date?: string; hours?: number }[],
  period: string
) =>
  logs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + Number(log.hours ?? 0);
  }, 0);

const getTotalEarningsForPeriod = (
  logs: { date?: string; hours?: number }[],
  hourlyRate: number,
  period: string
) => getTotalHoursForPeriod(logs, period) * hourlyRate;

const getAbsenceDaysForPeriod = (
  logs: { date?: string; status?: string }[],
  period: string
) =>
  logs.filter(
    log => String(log.status ?? "") === "absent" && String(log.date ?? "").startsWith(period)
  ).length;

const diffHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  container: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  subText: { fontSize: 13, color: "#64748b" },
  headerRight: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  bgBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.12)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.12)",
    bottom: -120,
    left: -80,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryMonth: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  verifiedChip: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
  summaryAmount: { color: "#ffffff", fontSize: 28, fontWeight: "700" },
  summarySub: { color: "rgba(255,255,255,0.9)", marginTop: 2 },
  summaryDelta: { color: "#ffffff", fontWeight: "700" },
  summaryHint: { color: "rgba(255,255,255,0.85)" },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statLabel: { fontSize: 11, color: "#64748b", marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  statHighlight: { fontSize: 16, fontWeight: "700", color: "#f97316" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  emptyText: { color: "#64748b", fontSize: 12 },
  chartRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  chartColumn: { flex: 1, alignItems: "center" },
  chartBar: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#0ea5e9",
  },
  chartValue: { fontSize: 11, color: "#0f172a", marginTop: 6 },
  chartLabel: { fontSize: 10, color: "#64748b", marginTop: 2 },
  budgetItem: { marginBottom: 12 },
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  budgetLabel: { color: "#334155", fontWeight: "600" },
  budgetValue: { color: "#0f172a", fontWeight: "600" },
  budgetBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  budgetFill: { height: 8, borderRadius: 999 },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 10,
  },
  breakdownTitle: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  breakdownHint: { fontSize: 11, color: "#64748b", marginTop: 2 },
  breakdownPositive: { color: "#16a34a", fontWeight: "700" },
  breakdownNegative: { color: "#ef4444", fontWeight: "700" },
  breakdownTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  breakdownTotal: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  tipCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 20,
  },
  tipTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  tipText: { color: "#334155", marginTop: 8, lineHeight: 18 },
  tipRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  tipHint: { color: "#334155", fontSize: 12 },
  tipButton: {
    marginTop: 12,
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tipButtonText: { color: "#ffffff", fontWeight: "600" },
  disabledButton: { opacity: 0.6 },
});
