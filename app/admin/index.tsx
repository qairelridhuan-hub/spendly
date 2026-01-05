import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react-native";
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";
import { getPeriodKey } from "@/lib/reports/report";

export default function AdminDashboard() {
  const router = useRouter();
  const [workerCount, setWorkerCount] = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Record<string, any>>({});
  const [config, setConfig] = useState({ hourlyRate: 0, overtimeRate: 0 });

  useEffect(() => {
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const map: Record<string, any> = {};
      snapshot.forEach(docSnap => {
        map[docSnap.id] = docSnap.data();
      });
      setWorkerCount(snapshot.size);
      setWorkers(map);
    });

    const attendanceQuery = collectionGroup(db, "attendance");
    const unsubAttendance = onSnapshot(attendanceQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        ...docSnap.data(),
      }));
      setAttendanceLogs(list);
    });

    const overtimeQuery = collectionGroup(db, "overtime");
    const unsubOvertime = onSnapshot(overtimeQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        ...docSnap.data(),
      }));
      setOvertimeLogs(list);
    });

    const shiftsQuery = collection(db, "shifts");
    const unsubShifts = onSnapshot(shiftsQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setShifts(list);
    });

    const configRef = doc(db, "config", "system");
    const unsubConfig = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setConfig({
        hourlyRate: Number(data.hourlyRate ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
      });
    });

    return () => {
      unsubWorkers();
      unsubAttendance();
      unsubOvertime();
      unsubShifts();
      unsubConfig();
    };
  }, []);

  const workingDays = useMemo(() => {
    const monthDays = new Set(
      shifts
        .filter(shift => isThisMonth(shift.date))
        .map((shift: any) => String(shift.date ?? ""))
    );
    return monthDays.size;
  }, [shifts]);

  const currentPeriod = getPeriodKey(new Date());
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const { totalHours, totalEarnings } = useMemo(() => {
    return approvedLogs.reduce(
      (acc, log) => {
        const date = String(log.date ?? "");
        if (!date.startsWith(currentPeriod)) return acc;
        const workerId = String(log.workerId ?? "");
        const rate = Number(workers[workerId]?.hourlyRate ?? config.hourlyRate ?? 0);
        const hours = getLogHours(log);
        acc.totalHours += hours;
        acc.totalEarnings += getLogEarnings(log, rate, config);
        return acc;
      },
      { totalHours: 0, totalEarnings: 0 }
    );
  }, [approvedLogs, currentPeriod, workers, config.hourlyRate]);
  const adjustedTotals = useMemo(
    () => ({
      totalHours,
      totalEarnings,
    }),
    [totalHours, totalEarnings]
  );

  const cards = useMemo(() => [
      {
        label: "Active Workers",
        value: String(workerCount),
        icon: Users,
        color: adminPalette.accent,
        bg: adminPalette.infoSoft,
        trend: "up",
        change: "",
      },
      {
        label: "Total Hours (Month)",
        value: `${Math.round(adjustedTotals.totalHours)}h`,
        icon: Clock,
        color: adminPalette.success,
        bg: adminPalette.successSoft,
        trend: "up",
        change: "",
      },
      {
        label: "Total Payroll",
        value: `RM ${adjustedTotals.totalEarnings.toFixed(2)}`,
        icon: DollarSign,
        color: adminPalette.accent,
        bg: adminPalette.infoSoft,
        trend: "up",
        change: "",
      },
      {
        label: "Working Days",
        value: `${workingDays}`,
        icon: Calendar,
        color: adminPalette.warning,
        bg: adminPalette.warningSoft,
        trend: "neutral",
        change: "",
      },
    ],
  [
    workerCount,
    adjustedTotals.totalHours,
    adjustedTotals.totalEarnings,
    workingDays,
  ]);

  const weeklyData = useMemo(() => buildWeeklyHours(approvedLogs), [approvedLogs]);
  const recentActivity = useMemo(() => buildRecentActivity(attendanceLogs, workers), [attendanceLogs, workers]);
  const upcomingShifts = useMemo(() => buildUpcomingShifts(shifts, workers), [shifts, workers]);
  const pendingActions = useMemo(() => attendanceLogs.filter(log => log.status === "pending").slice(0, 3), [attendanceLogs]);
  const performanceStats = useMemo(() => {
    const map: Record<string, { hours: number; earnings: number }> = {};
    approvedLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
      const workerId = String(log.workerId ?? "");
      if (!workerId) return;
      const rate = Number(workers[workerId]?.hourlyRate ?? config.hourlyRate ?? 0);
      const hours = getLogHours(log);
      map[workerId] = map[workerId] || { hours: 0, earnings: 0 };
      map[workerId].hours += hours;
      map[workerId].earnings += getLogEarnings(log, rate, config);
    });
    return Object.entries(map)
      .map(([workerId, totals]) => ({
        workerId,
        name:
          workers[workerId]?.fullName ||
          workers[workerId]?.displayName ||
          workers[workerId]?.email ||
          "Worker",
        hours: totals.hours,
        earnings: totals.earnings,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 3);
  }, [
    approvedLogs,
    currentPeriod,
    workers,
    config.hourlyRate,
    config.overtimeRate,
  ]);

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <View
                key={card.label}
                style={{
                  width: "48%",
                  minWidth: 220,
                  backgroundColor: adminPalette.surface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: adminPalette.border,
                  shadowColor: "#0f172a",
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: card.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={20} color={card.color} />
                  </View>
                  {card.trend === "up" ? (
                    <TrendingUp size={18} color={adminPalette.success} />
                  ) : card.trend === "down" ? (
                    <TrendingDown size={18} color={adminPalette.danger} />
                  ) : (
                    <Activity size={18} color={adminPalette.textMuted} />
                  )}
                </View>
                <Text
                  style={{
                    color: adminPalette.text,
                    fontWeight: "700",
                    fontSize: 20,
                    marginTop: 12,
                  }}
                >
                  {card.value}
                </Text>
                <Text
                  style={{
                    color: adminPalette.textMuted,
                    marginTop: 6,
                    fontSize: 12,
                  }}
                >
                  {card.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={sectionCard}>
          <View style={{ marginBottom: 16 }}>
            <Text style={sectionTitle}>Weekly Overview</Text>
            <Text style={sectionSub}>Hours logged this week</Text>
          </View>
          {weeklyData.length === 0 ? (
            <Text style={emptyText}>No hours logged yet.</Text>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
              {weeklyData.map(item => (
                <View key={item.day} style={{ flex: 1, alignItems: "center" }}>
                  <View
                    style={{
                      height: Math.max(8, item.hours * 6),
                      width: "80%",
                      borderRadius: 8,
                      backgroundColor: adminPalette.accent,
                    }}
                  />
                  <Text style={chartLabel}>{item.day}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <View style={[sectionCard, { flex: 1, minWidth: 260 }]}>
            <View style={sectionHeaderRow}>
              <Text style={sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push("/admin/attendance")}>
                <Text style={sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentActivity.length === 0 ? (
              <Text style={emptyText}>No recent activity yet.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {recentActivity.map(activity => (
                  <View key={activity.id} style={listRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[statusDot, { backgroundColor: activity.color }]} />
                      <View>
                        <Text style={listTitle}>{activity.worker}</Text>
                        <Text style={listSub}>{activity.action}</Text>
                      </View>
                    </View>
                    <Text style={listTime}>{activity.time}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[sectionCard, { flex: 1, minWidth: 260 }]}>
            <View style={sectionHeaderRow}>
              <Text style={sectionTitle}>Upcoming Shifts</Text>
              <TouchableOpacity onPress={() => router.push("/admin/setup")}>
                <Text style={sectionLink}>Manage</Text>
              </TouchableOpacity>
            </View>
            {upcomingShifts.length === 0 ? (
              <Text style={emptyText}>No upcoming shifts.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {upcomingShifts.map(shift => (
                  <View key={shift.id} style={shiftRow}>
                    <View>
                      <Text style={listTitle}>{shift.worker}</Text>
                      <Text style={listSub}>{shift.time}</Text>
                    </View>
                    <View style={chip}>
                      <Text style={chipText}>{shift.dateLabel}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={sectionCard}>
          <View style={sectionHeaderRow}>
            <View>
              <Text style={sectionTitle}>Pending Actions</Text>
              <Text style={sectionSub}>
                {pendingActions.length} items require your attention
              </Text>
            </View>
          </View>
          {pendingActions.length === 0 ? (
            <Text style={emptyText}>No pending actions.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {pendingActions.map(action => (
                <View key={action.refPath} style={pendingRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={[
                        iconBadge,
                        { backgroundColor: adminPalette.infoSoft },
                      ]}
                    >
                      <AlertCircle size={18} color={adminPalette.accent} />
                    </View>
                    <View>
                      <Text style={listTitle}>Attendance Review</Text>
                      <Text style={listSub}>
                        {workers[action.workerId]?.fullName ||
                          workers[action.workerId]?.email ||
                          action.workerId}{" "}
                        • {action.date || "-"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() =>
                        updateDoc(doc(db, action.refPath), { status: "approved" })
                      }
                      style={[
                        actionButton,
                        { backgroundColor: adminPalette.successSoft },
                      ]}
                    >
                      <CheckCircle size={18} color={adminPalette.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        updateDoc(doc(db, action.refPath), { status: "rejected" })
                      }
                      style={[
                        actionButton,
                        { backgroundColor: adminPalette.dangerSoft },
                      ]}
                    >
                      <XCircle size={18} color={adminPalette.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={sectionCard}>
          <Text style={sectionTitle}>Top Performers This Month</Text>
          {performanceStats.length === 0 ? (
            <Text style={[emptyText, { marginTop: 10 }]}>
              No performance data yet.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 16 }}>
              {performanceStats.map((worker, index) => (
                <View key={worker.workerId} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={rankBadge}>
                        <Text style={rankText}>{index + 1}</Text>
                      </View>
                      <Text style={listTitle}>{worker.name}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={listSub}>Hours</Text>
                        <Text style={listTitle}>{worker.hours.toFixed(0)}h</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={listSub}>Earnings</Text>
                        <Text style={[listTitle, { color: adminPalette.success }]}>
                          RM {worker.earnings.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={progressTrack}>
                    <View
                      style={[
                        progressFill,
                        {
                          width: `${Math.min(100, (worker.hours / maxHours(performanceStats)) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: 12 }}>
          {pendingActions.length > 0 ? (
            <View style={alertCardWarning}>
              <AlertCircle size={18} color={adminPalette.warning} />
              <View>
                <Text style={alertTitle}>Pending attendance reviews</Text>
                <Text style={alertSub}>Approve or reject attendance logs.</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const sectionCard = {
  marginTop: 24,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: adminPalette.border,
  shadowColor: "#0f172a",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const sectionTitle = { color: adminPalette.text, fontWeight: "700", fontSize: 15 };
const sectionSub = { color: adminPalette.textMuted, fontSize: 12, marginTop: 4 };
const sectionLink = { color: adminPalette.accent, fontSize: 12 };
const sectionHeaderRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  marginBottom: 14,
};

const emptyText = { color: adminPalette.textMuted, fontSize: 12 };
const chartLabel = { color: adminPalette.textMuted, fontSize: 11, marginTop: 6 };

const listRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
};
const listTitle = { color: adminPalette.text, fontSize: 13, fontWeight: "600" as const };
const listSub = { color: adminPalette.textMuted, fontSize: 11, marginTop: 2 };
const listTime = { color: adminPalette.textMuted, fontSize: 10 };
const statusDot = { width: 8, height: 8, borderRadius: 4 };

const shiftRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  padding: 12,
  backgroundColor: adminPalette.surfaceAlt,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: adminPalette.border,
};
const chip = {
  backgroundColor: adminPalette.infoSoft,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 4,
};
const chipText = { color: adminPalette.accent, fontSize: 11 };

const pendingRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: adminPalette.border,
  backgroundColor: adminPalette.surfaceAlt,
};
const iconBadge = { width: 40, height: 40, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const };
const actionButton = { padding: 8, borderRadius: 10 };

const rankBadge = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: adminPalette.infoSoft,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const rankText = { color: adminPalette.accent, fontSize: 12, fontWeight: "700" as const };
const progressTrack = { height: 6, backgroundColor: adminPalette.border, borderRadius: 999 };
const progressFill = { height: 6, borderRadius: 999, backgroundColor: adminPalette.accent };

const alertCardWarning = {
  flexDirection: "row" as const,
  gap: 10,
  backgroundColor: adminPalette.warningSoft,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: adminPalette.warningSoft,
  padding: 12,
  alignItems: "flex-start" as const,
};
const alertTitle = { color: adminPalette.warning, fontWeight: "600" as const };
const alertSub = { color: adminPalette.warning, fontSize: 12, marginTop: 2 };

const buildWeeklyHours = (logs: any[]) => {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(day => ({ day, hours: 0 }));
  logs.forEach(log => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return;
    const dayIndex = (date.getDay() + 6) % 7;
    totals[dayIndex].hours += getLogHours(log);
  });
  return totals;
};

const buildRecentActivity = (logs: any[], workers: Record<string, any>) =>
  logs
    .slice()
    .sort((a, b) => getTimeValue(b.updatedAt ?? b.createdAt ?? b.date) - getTimeValue(a.updatedAt ?? a.createdAt ?? a.date))
    .slice(0, 5)
    .map(log => ({
      id: log.refPath,
      worker:
        workers[log.workerId]?.fullName ||
        workers[log.workerId]?.email ||
        log.workerId ||
        "Worker",
      action: statusLabel(log.status),
      time: log.date || "-",
      color: statusColor(log.status),
    }));

const buildUpcomingShifts = (shifts: any[], workers: Record<string, any>) => {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  return shifts
    .filter(shift => {
      const dateKey = String(shift.date ?? "");
      if (!dateKey) return false;
      const status = String(shift.status ?? "");
      if (["completed", "absent", "off", "leave"].includes(status)) return false;
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      if (dateKey > todayKey) return true;
      if (dateKey < todayKey) return false;
      const shiftEnd = parseTimeToMinutes(shift.end);
      if (shiftEnd !== null && shiftEnd <= nowMinutes) return false;
      return true;
    })
    .sort((a, b) =>
      `${a.date || ""} ${a.start || ""}`.localeCompare(`${b.date || ""} ${b.start || ""}`)
    )
    .slice(0, 4)
    .map(shift => ({
      id: shift.id,
      worker:
        workers[shift.workerId]?.fullName ||
        workers[shift.workerId]?.email ||
        shift.workerId ||
        "Worker",
      time: `${shift.start || "--:--"} - ${shift.end || "--:--"}`,
      dateLabel: shift.date || "-",
    }));
};

const statusLabel = (status: string) => {
  if (status === "approved") return "Completed shift";
  if (status === "rejected") return "Rejected entry";
  if (status === "absent") return "Marked absent";
  return "Attendance pending";
};

const statusColor = (status: string) => {
  if (status === "approved") return adminPalette.accent;
  if (status === "absent") return adminPalette.danger;
  if (status === "pending") return adminPalette.warning;
  return adminPalette.success;
};

const getTimeValue = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseTimeToMinutes = (time?: string) => {
  if (!time) return null;
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const getOvertimeHours = (entry: any) => {
  const stored = Number(entry.hours ?? 0);
  if (stored > 0) return stored;
  if (entry.startTime && entry.endTime) {
    return calcHoursFromTimes(entry.startTime, entry.endTime);
  }
  return 0;
};

const getLogHours = (log: any) => {
  const storedNet = Number(log.netHours ?? log.net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log);
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

const getLogOvertimeHours = (log: any) => {
  const stored = Number(log.overtimeHours ?? log.overtime_hours ?? 0);
  if (stored > 0) return stored;
  return 0;
};

const getLogEarnings = (log: any, hourlyRate: number, config: { overtimeRate: number }) => {
  const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log);
  const overtimeHours = getLogOvertimeHours(log);
  const regularHours = Math.max(0, netHours - overtimeHours);
  const overtimeRate = Number(config.overtimeRate ?? 0) || hourlyRate * 1.5;
  return regularHours * hourlyRate + overtimeHours * overtimeRate;
};

const getBreakMinutesForLog = (log: any) => {
  const stored = Number(log.breakMinutes ?? 0);
  if (stored > 0) return stored;
  if (log.breakStart && log.breakEnd) {
    return Math.max(0, calcMinutesDiff(log.breakStart, log.breakEnd));
  }
  return 0;
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const startOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const isThisMonth = (dateValue: string) => {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

const maxHours = (stats: { hours: number }[]) =>
  stats.reduce((max, item) => Math.max(max, item.hours), 1);

const calcHoursFromTimes = (start: string, end: string, breakMinutes = 0) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes - breakMinutes) / 60;
};

const calcMinutesDiff = (start: string, end: string) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
};
