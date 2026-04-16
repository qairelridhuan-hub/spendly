import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  BarChart3,
  Bell,
  Calendar,
  DollarSign,
  Gamepad2,
  LogOut,
  Moon,
  PieChart,
  Sun,
  TrendingUp,
} from "lucide-react-native";
import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useCalendar, useTheme } from "@/lib/context";
import { useFocusEffect } from "@react-navigation/native";
import { cardShadow } from "@/lib/shadows";

type WeeklyEntry = { week: string; earnings: number };
type BudgetItem = {
  category: string;
  amount: number;
  color: string;
};
type Suggestion = {
  title: string;
  subtitle: string;
  action?: () => void;
};
type BreakEntry = {
  date?: string;
  startTime?: string;
  endTime?: string;
};
type OvertimeEntry = {
  date?: string;
  hours?: number;
  startTime?: string;
  endTime?: string;
};

export default function EarningsScreen() {
  const [displayName, setDisplayName] = useState("User");
  const scrollRef = useRef<ScrollView>(null);
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
    hoursPerDay: 0,
  });
  const [budgetAllocation, setBudgetAllocation] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [breakLogs, setBreakLogs] = useState<BreakEntry[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<OvertimeEntry[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [showApprovedDetails, setShowApprovedDetails] = useState(false);
  const { shifts } = useCalendar();
  const { colors: c, mode, toggleTheme } = useTheme();
  const styles = makeStyles(c);

  const hourlyRate =
    userHourlyRate || workConfig.hourlyRate || schedule?.hourlyRate || 0;
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const breakMinutesByDate = useMemo(
    () => buildBreakMinutesMap(breakLogs),
    [breakLogs]
  );

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );
  const overtimeHoursByDate = useMemo(
    () => buildOvertimeHoursMap(overtimeLogs),
    [overtimeLogs]
  );
  const currentPeriod = getPeriodKey(new Date());
  const overtimeHours = getOvertimeHoursForPeriod(overtimeHoursByDate, currentPeriod);
  const cutoffDate = new Date();
  const assignedHoursSoFar = useMemo(
    () =>
      shifts
        .filter(shift => {
          if (!shift.date?.startsWith(currentPeriod)) return false;
          if (["absent", "off", "leave"].includes(shift.status)) return false;
          const shiftDate = new Date(`${shift.date}T00:00:00`);
          if (Number.isNaN(shiftDate.getTime())) return false;
          return shiftDate <= cutoffDate;
        })
        .reduce((sum, shift) => sum + getShiftHours(shift), 0),
    [shifts, currentPeriod]
  );
  const projectedHours = useMemo(
    () =>
      shifts
        .filter(shift => {
          if (!shift.date?.startsWith(currentPeriod)) return false;
          return !["absent", "off", "leave"].includes(shift.status);
        })
        .reduce((sum, shift) => sum + getShiftHours(shift), 0),
    [shifts, currentPeriod]
  );
  const projectedEarnings = projectedHours * hourlyRate;
  const weeklyData = useMemo(
    () =>
      buildWeeklyData(
        approvedLogs,
        hourlyRate,
        workConfig.overtimeRate,
        breakMinutesByDate,
        overtimeHoursByDate
      ),
    [approvedLogs, hourlyRate, workConfig.overtimeRate, breakMinutesByDate, overtimeHoursByDate]
  );
  const prevPeriod = getPreviousPeriodKey(currentPeriod);
  const prevOvertimeHours = getOvertimeHoursForPeriod(overtimeHoursByDate, prevPeriod);
  const totalMonthly = useMemo(
    () => assignedHoursSoFar * hourlyRate + overtimeHours * workConfig.overtimeRate,
    [assignedHoursSoFar, hourlyRate, overtimeHours, workConfig.overtimeRate]
  );
  const approvedMonthly = useMemo(
    () =>
      getTotalEarningsForPeriod(
        approvedLogs,
        hourlyRate,
        workConfig.overtimeRate,
        currentPeriod,
        breakMinutesByDate
      ),
    [approvedLogs, hourlyRate, currentPeriod, breakMinutesByDate, workConfig.overtimeRate]
  );
  const approvedBreakdownRows = useMemo(
    () =>
      approvedLogs
        .filter(log => String(log.date ?? "").startsWith(currentPeriod))
        .map(log => ({
          date: String(log.date ?? ""),
          hours: getLogHours(log, breakMinutesByDate),
          amount: getLogHours(log, breakMinutesByDate) * hourlyRate,
        })),
    [approvedLogs, currentPeriod, breakMinutesByDate, hourlyRate]
  );
  const prevMonthly = useMemo(
    () =>
      getTotalEarningsForPeriod(
        approvedLogs,
        hourlyRate,
        workConfig.overtimeRate,
        prevPeriod,
        breakMinutesByDate
      ) + prevOvertimeHours * workConfig.overtimeRate,
    [approvedLogs, hourlyRate, prevPeriod, breakMinutesByDate, prevOvertimeHours, workConfig.overtimeRate]
  );
  const maxWeekly = weeklyData.length
    ? Math.max(...weeklyData.map(w => w.earnings))
    : 0;
  const totalBudget = budgetAllocation.reduce((sum, b) => sum + b.amount, 0);
  const daysWorked = getDaysWorkedForPeriod(approvedLogs, currentPeriod);
  const totalHours = assignedHoursSoFar;
  const totalHoursWithOvertime = assignedHoursSoFar + overtimeHours;
  const scheduleHoursPerDay = schedule
    ? diffHours(schedule.startTime, schedule.endTime)
    : workConfig.hoursPerDay;
  const absenceDays = getAbsenceDaysForPeriod(attendanceLogs, currentPeriod);
  const pendingCount = attendanceLogs.filter(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(currentPeriod)) return false;
    return String(log.status ?? "") === "pending";
  }).length;
  const percentChange =
    prevMonthly > 0 ? Math.round(((totalMonthly - prevMonthly) / prevMonthly) * 100) : 0;
  const usesAssigned = assignedHoursSoFar > 0;

  const confirmLogout = () => {
    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } finally {
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

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
    if (!userId) return;
    const configRef = doc(db, "config", "system");
    const unsub = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setWorkConfig({
        hourlyRate: Number(data.hourlyRate ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
        hoursPerDay: Number(data.hoursPerDay ?? 0),
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

  useEffect(() => {
    if (!userId) {
      setBreakLogs([]);
      return;
    }
    const breaksRef = collection(db, "users", userId, "breaks");
    const unsub = onSnapshot(breaksRef, snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as BreakEntry);
      setBreakLogs(list);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setOvertimeLogs([]);
      return;
    }
    const overtimeRef = collection(db, "users", userId, "overtime");
    const unsub = onSnapshot(overtimeRef, snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as OvertimeEntry);
      setOvertimeLogs(list);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBudgetAllocation([]);
      return;
    }
    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(userRef, snap => {
      const data = snap.data() as any;
      if (Array.isArray(data?.budgetAllocation)) {
        setBudgetAllocation(
          data.budgetAllocation
            .filter((item: any) => item && item.category && item.amount != null)
            .map((item: any) => ({
              category: String(item.category),
              amount: Number(item.amount ?? 0),
              color: String(item.color ?? "#b7f34d"),
            }))
        );
      } else {
        setBudgetAllocation([]);
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      return;
    }
    const goalsRef = collection(db, "users", userId, "goals");
    const unsub = onSnapshot(goalsRef, snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as any);
      setGoals(list);
    });
    return unsub;
  }, [userId]);

  const normalHours = Math.max(0, totalHours);
  const normalRate = hourlyRate;
  const overtimeRate = workConfig.overtimeRate;
  const deduction = absenceDays * scheduleHoursPerDay * hourlyRate;
  const breakdownTotal =
    normalHours * normalRate + overtimeHours * overtimeRate - deduction;
  const suggestion = buildSuggestion({
    goals,
    totalMonthly,
    percentChange,
    onViewGoals: () => router.push("/(tabs)/goals"),
  });

  return (
    <View style={[styles.screen, { backgroundColor: c.backgroundStart }]}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
          {/* ===== HEADER ===== */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.logo}
                onPress={() => router.push("/(tabs)/profile")}
              >
                <Image
                  source={require("../../assets/images/spendly-logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <View>
                <Text style={styles.appName}>Spendly</Text>
                <Text style={styles.subText}>Hey, {displayName}!</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.iconPill}>
                <TouchableOpacity style={styles.iconPillBtn} onPress={toggleTheme}>
                  {mode === "dark" ? <Moon size={20} color={c.text} /> : <Sun size={20} color={c.text} />}
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/")}>
                  <Gamepad2 size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/notifications")}>
                  <Bell size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={confirmLogout}>
                  <LogOut size={20} color={c.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ===== HERO CARD ===== */}
          <View style={[styles.heroCard, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Total Earnings</Text>
                <Text style={styles.heroAmount}>
                  RM {totalMonthly.toFixed(2)}
                </Text>
                <Text style={styles.heroSub}>
                  {formatPeriodLabel(currentPeriod)}
                </Text>
              </View>
              <View style={styles.heroIconWrap}>
                <DollarSign size={20} color={c.text} />
              </View>
            </View>

            <Text style={styles.heroHint}>
              Based on assigned shifts so far
            </Text>
            <Text style={styles.heroHint}>
              {pendingCount > 0
                ? `Awaiting approval for ${pendingCount} shift${pendingCount === 1 ? "" : "s"}`
                : usesAssigned
                  ? "Includes scheduled shifts up to today"
                  : "All shifts approved so far"}
            </Text>

            <View style={styles.heroBottomRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillLabel}>Approved</Text>
                <Text style={styles.heroPillValue}>
                  RM {approvedMonthly.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.heroPill, styles.heroPillAlt]}>
                <Text style={styles.heroPillLabel}>Projected</Text>
                <Text style={styles.heroPillValue}>
                  RM {projectedEarnings.toFixed(2)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.heroDetailButton}
              onPress={() => setShowApprovedDetails(true)}
            >
              <Text style={styles.heroDetailText}>View approved details</Text>
            </TouchableOpacity>
          </View>

          {/* ===== QUICK STATS GRID ===== */}
          <View style={styles.quickGrid}>
            <View style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <Calendar size={16} color={c.backgroundStart} />
              </View>
              <Text style={styles.quickLabel}>Days Worked</Text>
              <Text style={styles.quickValue}>{daysWorked}</Text>
            </View>
            <View style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <BarChart3 size={16} color={c.backgroundStart} />
              </View>
              <Text style={styles.quickLabel}>Total Hours</Text>
              <Text style={styles.quickValue}>
                {Math.round(totalHoursWithOvertime)}h
              </Text>
            </View>
            <View style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <TrendingUp size={16} color={c.backgroundStart} />
              </View>
              <Text style={styles.quickLabel}>Overtime</Text>
              <Text style={styles.quickValue}>{overtimeHours}h</Text>
            </View>
            <View style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <Bell size={16} color={c.backgroundStart} />
              </View>
              <Text style={styles.quickLabel}>Pending</Text>
              <Text style={styles.quickValue}>{pendingCount}</Text>
            </View>
          </View>

          {/* ===== Weekly Earnings ===== */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <TrendingUp size={18} color={c.text} />
              <Text style={styles.cardTitle}>Approved Earnings (Weekly)</Text>
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
              <PieChart size={18} color={c.text} />
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
              <BarChart3 size={18} color={c.text} />
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
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Smart Suggestion</Text>
            <Text style={styles.tipText}>{suggestion.title}</Text>
            <View style={styles.tipRow}>
              <Calendar size={14} color="#b45309" />
              <Text style={styles.tipHint}>{suggestion.subtitle}</Text>
            </View>
            {suggestion.action ? (
              <TouchableOpacity style={styles.tipButton} onPress={suggestion.action}>
                <Text style={styles.tipButtonText}>View goals</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {showApprovedDetails ? (
        <View style={styles.overlay}>
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Approved Earnings Details</Text>
              <TouchableOpacity onPress={() => setShowApprovedDetails(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Month</Text>
              <Text style={styles.detailValue}>
                {formatPeriodLabel(currentPeriod)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Approved total</Text>
              <Text style={styles.detailValue}>
                RM {approvedMonthly.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Calculation</Text>
              <Text style={styles.detailValue}>
                {approvedMonthly.toFixed(2)} = Σ(hours × rate)
              </Text>
            </View>
            <View style={styles.breakdownBlock}>
              <Text style={styles.detailBreakdownTitle}>Approved shift breakdown</Text>
              {approvedBreakdownRows.length === 0 ? (
                <Text style={styles.emptyText}>No approved shifts yet.</Text>
              ) : (
                approvedBreakdownRows.map((row, index) => (
                  <View
                    key={`${row.date}-${index}`}
                    style={styles.detailBreakdownRow}
                  >
                    <View>
                      <Text style={styles.detailBreakdownDate}>{row.date}</Text>
                      <Text style={styles.detailBreakdownSub}>
                        {row.hours.toFixed(1)}h × RM {hourlyRate.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.detailBreakdownAmount}>
                      RM {row.amount.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      ) : null}
    </View>
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
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const getPeriodKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const getPreviousPeriodKey = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  const date = new Date(year, month - 2, 1);
  return getPeriodKey(date);
};

const formatDelta = (value: number) => {
  if (value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value}%`;
};

const buildSuggestion = ({
  goals,
  totalMonthly,
  percentChange,
  onViewGoals,
}: {
  goals: any[];
  totalMonthly: number;
  percentChange: number;
  onViewGoals?: () => void;
}): Suggestion => {
  const todayKey = formatDateKey(new Date());
  const activeGoals = goals.filter(goal => {
    const target = Number(goal.targetAmount ?? 0);
    const saved = Number(goal.savedAmount ?? 0);
    const deadline = String(goal.deadline ?? "");
    return target > saved && (!deadline || deadline >= todayKey);
  });

  if (activeGoals.length === 0) {
    return {
      title: "Create a savings goal to unlock personalized tips.",
      subtitle:
        totalMonthly > 0
          ? "We’ll recommend a weekly pace based on your earnings."
          : "Add attendance to see earnings-based advice.",
      action: onViewGoals,
    };
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedGoals = [...activeGoals].sort((a, b) => {
    const aDeadline = new Date(`${a.deadline}T00:00:00`);
    const bDeadline = new Date(`${b.deadline}T00:00:00`);
    const aTime = Number.isNaN(aDeadline.getTime()) ? Infinity : aDeadline.getTime();
    const bTime = Number.isNaN(bDeadline.getTime()) ? Infinity : bDeadline.getTime();
    if (aTime !== bTime) return aTime - bTime;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  const goal = sortedGoals[0];
  const target = Number(goal.targetAmount ?? 0);
  const saved = Number(goal.savedAmount ?? 0);
  const remaining = Math.max(0, target - saved);
  const deadlineDate = new Date(`${goal.deadline}T00:00:00`);
  const daysLeft = Number.isNaN(deadlineDate.getTime())
    ? 28
    : Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000));
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const weeklyTarget = remaining / weeksLeft;

  const trendLabel =
    percentChange === 0
      ? "Earnings are steady"
      : percentChange > 0
        ? `Earnings up ${percentChange}%`
        : `Earnings down ${Math.abs(percentChange)}%`;

  return {
    title: `Focus on ${goal.name}`,
    subtitle: `${trendLabel}. Save RM ${weeklyTarget.toFixed(0)}/week to reach it.`,
    action: onViewGoals,
  };
};

const buildWeeklyData = (
  logs: { date?: string; hours?: number; clockIn?: string; clockOut?: string; clockInTs?: number; clockOutTs?: number; breakMinutes?: number; breakStart?: string; breakEnd?: string }[],
  hourlyRate: number,
  overtimeRate: number,
  breakMinutesByDate: Record<string, number>,
  overtimeHoursByDate: Record<string, number>
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
    const regularHours = logs.reduce((sum, log) => {
      const date = new Date(`${log.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return sum;
      if (date < week.start || date > week.end) return sum;
      return sum + getLogHours(log, breakMinutesByDate);
    }, 0);
    const overtimeHours = Object.entries(overtimeHoursByDate).reduce(
      (sum, [dateKey, hours]) => {
        const date = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(date.getTime())) return sum;
        if (date < week.start || date > week.end) return sum;
        return sum + hours;
      },
      0
    );
    return {
      week: week.label,
      earnings: Math.round(regularHours * hourlyRate + overtimeHours * overtimeRate),
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
  logs: {
    date?: string;
    hours?: number;
    clockIn?: string;
    clockOut?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
  }[],
  period: string,
  breakMinutesByDate: Record<string, number>
) =>
  logs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + getLogHours(log, breakMinutesByDate);
  }, 0);

const getTotalEarningsForPeriod = (
  logs: {
    date?: string;
    hours?: number;
    netHours?: number;
    overtimeHours?: number;
    finalPay?: number;
    clockIn?: string;
    clockOut?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
  }[],
  hourlyRate: number,
  overtimeRate: number,
  period: string,
  breakMinutesByDate: Record<string, number>
) =>
  logs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + getLogEarnings(log, hourlyRate, overtimeRate, breakMinutesByDate);
  }, 0);

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

const getShiftHours = (shift: { hours?: number; start?: string; end?: string }) =>
  shift.hours ?? diffHours(shift.start ?? "", shift.end ?? "");

const getLogHours = (
  log: {
    date?: string;
    hours?: number;
    netHours?: number;
    overtimeHours?: number;
    finalPay?: number;
    clockIn?: string;
    clockOut?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
  },
  breakMinutesByDate: Record<string, number>
) => {
  const storedNet = Number((log as any).netHours ?? (log as any).net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log, breakMinutesByDate);
  if (log.clockInTs && log.clockOutTs) {
    const minutes = Math.max(
      0,
      Math.round((log.clockOutTs - log.clockInTs) / 60000) - breakMinutes
    );
    return minutes / 60;
  }
  if (log.clockIn && log.clockOut) {
    return calcHoursFromTimes(log.clockIn, log.clockOut, breakMinutes);
  }
  return 0;
};

const getLogOvertimeHours = (log: {
  overtimeHours?: number;
}) => {
  const stored = Number((log as any).overtimeHours ?? (log as any).overtime_hours ?? 0);
  if (stored > 0) return stored;
  return 0;
};

const getLogEarnings = (
  log: {
    finalPay?: number;
    overtimeHours?: number;
    hours?: number;
    netHours?: number;
    clockIn?: string;
    clockOut?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
  },
  hourlyRate: number,
  overtimeRate: number,
  breakMinutesByDate: Record<string, number>
) => {
  const finalPay = Number((log as any).finalPay ?? (log as any).final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log, breakMinutesByDate);
  const overtimeHours = getLogOvertimeHours(log);
  const regularHours = Math.max(0, netHours - overtimeHours);
  const resolvedOvertimeRate = overtimeRate || hourlyRate * 1.5;
  return regularHours * hourlyRate + overtimeHours * resolvedOvertimeRate;
};

const getBreakMinutesForLog = (
  log: {
    date?: string;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
  },
  breakMinutesByDate: Record<string, number>
) => {
  const stored = Number(log.breakMinutes ?? 0);
  if (stored > 0) return stored;
  if (log.breakStart && log.breakEnd) {
    return Math.max(0, calcMinutesDiff(log.breakStart, log.breakEnd));
  }
  const dateKey = String(log.date ?? "");
  return breakMinutesByDate[dateKey] ?? 0;
};

const calcMinutesDiff = (start: string, end: string) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
};

const calcHoursFromTimes = (start: string, end: string, breakMinutes = 0) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  const totalMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
  return totalMinutes / 60;
};

const parseTimeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const buildBreakMinutesMap = (entries: BreakEntry[]) => {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const date = String(entry.date ?? "");
    if (!date) return;
    if (!entry.startTime || !entry.endTime) return;
    const minutes = calcMinutesDiff(entry.startTime, entry.endTime);
    map[date] = (map[date] ?? 0) + minutes;
  });
  return map;
};

const buildOvertimeHoursMap = (entries: OvertimeEntry[]) => {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const date = String(entry.date ?? "");
    if (!date) return;
    let hours = Number(entry.hours ?? 0);
    if (!hours && entry.startTime && entry.endTime) {
      hours = calcHoursFromTimes(entry.startTime, entry.endTime, 0);
    }
    if (!hours) return;
    map[date] = (map[date] ?? 0) + hours;
  });
  return map;
};

const getOvertimeHoursForPeriod = (
  overtimeHoursByDate: Record<string, number>,
  period: string
) =>
  Object.entries(overtimeHoursByDate).reduce((sum, [date, hours]) => {
    if (!date.startsWith(period)) return sum;
    return sum + hours;
  }, 0);

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

function makeStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
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
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    logoImage: { width: 24, height: 24 },
    appName: { fontSize: 16, fontWeight: "700", color: c.text },
    subText: { fontSize: 13, color: c.textMuted },
    headerRight: { flexDirection: "row", alignItems: "center" },
    iconPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 4,
      paddingVertical: 4,
      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    iconPillBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
    iconPillDivider: { width: 1, height: 16, backgroundColor: c.border },
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
      backgroundColor: "rgba(0,0,0,0)",
      top: -80,
      right: -60,
    },
    bgBlobAlt: {
      position: "absolute",
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0)",
      bottom: -120,
      left: -80,
    },
    heroCard: {
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      overflow: "hidden",
      ...cardShadow,
    },
    heroAccent: {
      display: "none",
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },
    heroLabel: { color: c.textMuted, fontSize: 12, letterSpacing: 0.6 },
    heroAmount: { color: c.text, fontSize: 28, fontWeight: "700" },
    heroSub: { color: c.textMuted, marginTop: 2, fontSize: 12 },
    heroIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    heroHint: { color: c.textMuted, fontSize: 12 },
    heroBottomRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    heroPill: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    heroPillAlt: {
      backgroundColor: c.surfaceAlt,
    },
    heroPillLabel: { color: c.textMuted, fontSize: 11 },
    heroPillValue: { color: c.text, fontWeight: "700", marginTop: 4 },
    heroDetailButton: {
      alignSelf: "flex-start",
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.text,
      borderRadius: 999,
    },
    heroDetailText: { color: c.backgroundStart, fontWeight: "600", fontSize: 12 },
    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 16,
    },
    quickTile: {
      width: "48%",
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: "#000000",
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    quickIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: c.text,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    quickLabel: { fontSize: 11, color: c.textMuted },
    quickValue: { fontSize: 16, fontWeight: "700", color: c.text },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
      ...cardShadow,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    chartRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-end",
    },
    chartColumn: { flex: 1, alignItems: "center" },
    chartBar: {
      width: "100%",
      borderRadius: 10,
      backgroundColor: "#f59e0b",
    },
    chartValue: { fontSize: 11, color: c.text, marginTop: 6 },
    chartLabel: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    budgetItem: { marginBottom: 12 },
    budgetRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    budgetLabel: { color: c.text, fontWeight: "600" },
    budgetValue: { color: c.text, fontWeight: "600" },
    budgetBar: {
      height: 8,
      backgroundColor: c.border,
      borderRadius: 999,
      overflow: "hidden",
    },
    budgetFill: { height: 8, borderRadius: 999 },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginBottom: 10,
    },
    breakdownTitle: { fontSize: 13, fontWeight: "600", color: c.text },
    breakdownHint: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    breakdownPositive: { color: "#16a34a", fontWeight: "700" },
    breakdownNegative: { color: "#dc2626", fontWeight: "700" },
    breakdownTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    breakdownTotal: { fontSize: 14, fontWeight: "700", color: c.text },
    tipCard: {
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: "#fde68a",
      marginBottom: 20,
      backgroundColor: "#fffbeb",
      ...cardShadow,
    },
    tipTitle: { fontSize: 14, fontWeight: "700", color: "#7c2d12" },
    tipText: { color: "#9a3412", marginTop: 8, lineHeight: 18 },
    tipRow: { flexDirection: "row", gap: 6, marginTop: 10 },
    tipHint: { color: "#92400e", fontSize: 12 },
    tipButton: {
      marginTop: 12,
      backgroundColor: "#fb923c",
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: "center",
    },
    tipButtonText: { color: "#1f1300", fontWeight: "600" },
    disabledButton: { opacity: 0.6 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    detailModal: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalTitle: { color: c.text, fontWeight: "700" },
    modalClose: { color: "#f97316", fontWeight: "600", fontSize: 12 },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    detailLabel: { color: c.textMuted, fontSize: 12 },
    detailValue: { color: c.text, fontSize: 12, fontWeight: "600" },
    breakdownBlock: {
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 12,
    },
    detailBreakdownTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: c.text,
      marginBottom: 6,
    },
    detailBreakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    detailBreakdownDate: { color: c.text, fontSize: 12, fontWeight: "600" },
    detailBreakdownSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    detailBreakdownAmount: { color: c.text, fontSize: 12, fontWeight: "700" },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: "center" },
  });
}
