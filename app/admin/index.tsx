import { useEffect, useMemo, useState } from "react";
import { Platform, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import {
  collection, collectionGroup, limit, onSnapshot,
  query, orderBy, where, updateDoc, doc,
} from "firebase/firestore";
import {
  AlertCircle, Calendar, CheckCircle, Clock,
  DollarSign, Users, XCircle,
} from "lucide-react-native";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { AdminErrorBanner } from "@/lib/admin/error-banner";
import { makeSnapshotErrorHandler } from "@/lib/firebase/errors";
import { adminCardShadow } from "@/lib/admin/shadows";
import { getPeriodKey } from "@/lib/reports/report";

export default function AdminDashboard() {
  const { colors: p } = useAdminTheme();
  const router = useRouter();

  const [workerCount,    setWorkerCount]    = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [breakLogs,      setBreakLogs]      = useState<any[]>([]);
  const [shifts,         setShifts]         = useState<any[]>([]);
  const [workers,        setWorkers]        = useState<Record<string, any>>({});
  const [config,         setConfig]         = useState({ hourlyRate: 0, overtimeRate: 0 });
  const [latestAudit,    setLatestAudit]    = useState<any | null>(null);
  const [error,          setError]          = useState("");

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/dashboard");
    const workersQuery = query(collection(db, "users"), where("role", "==", "worker"));
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const map: Record<string, any> = {};
      snapshot.forEach(d => { map[d.id] = d.data(); });
      setWorkerCount(snapshot.size);
      setWorkers(map);
    }, onSnapError);
    const unsubAtt = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      setAttendanceLogs(snapshot.docs.map(d => ({ id: d.id, refPath: d.ref.path, ...d.data() })));
    }, onSnapError);
    const unsubBreaks = onSnapshot(collectionGroup(db, "breaks"), snapshot => {
      setBreakLogs(snapshot.docs.map(d => ({ workerId: getOwnerId(d), ...d.data() })));
    }, onSnapError);
    const unsubShifts = onSnapshot(collection(db, "shifts"), snapshot => {
      setShifts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onSnapError);
    const unsubCfg = onSnapshot(doc(db, "config", "system"), snap => {
      const data = snap.data() as any;
      if (!data) return;
      setConfig({ hourlyRate: Number(data.hourlyRate ?? 0), overtimeRate: Number(data.overtimeRate ?? 0) });
    }, onSnapError);
    const unsubAudit = onSnapshot(
      query(collection(db, "adminAudits"), orderBy("updatedAt", "desc"), limit(1)),
      snapshot => {
        const d = snapshot.docs[0];
        setLatestAudit(d ? { id: d.id, ...d.data() } : null);
      },
      onSnapError
    );
    return () => { unsubWorkers(); unsubAtt(); unsubBreaks(); unsubShifts(); unsubCfg(); unsubAudit(); };
  }, []);

  const workingDays = useMemo(() => {
    const s = new Set(shifts.filter(s => isThisMonth(s.date)).map((s: any) => String(s.date ?? "")));
    return s.size;
  }, [shifts]);

  const currentPeriod = getPeriodKey(new Date());
  const attendancePeriods = useMemo(() => extractAttendancePeriods(attendanceLogs), [attendanceLogs]);
  const activePeriod = useMemo(() => {
    if (Platform.OS === "web") return currentPeriod;
    return attendancePeriods.includes(currentPeriod) ? currentPeriod : (attendancePeriods[0] || currentPeriod);
  }, [attendancePeriods, currentPeriod]);

  const approvedLogs    = useMemo(() => attendanceLogs.filter(l => l.status === "approved"), [attendanceLogs]);
  const breakMinutesMap = useMemo(() => buildBreakMinutesMap(breakLogs), [breakLogs]);

  const { totalHours, totalEarnings } = useMemo(() => {
    return approvedLogs.reduce((acc, log) => {
      const date = String(log.date ?? "");
      if (!date.startsWith(activePeriod)) return acc;
      const wId   = String(log.workerId ?? "");
      const rate  = Number(workers[wId]?.hourlyRate ?? config.hourlyRate ?? 0);
      acc.totalHours    += getLogHours(log, breakMinutesMap);
      acc.totalEarnings += getLogEarnings(log, rate, config.overtimeRate, breakMinutesMap);
      return acc;
    }, { totalHours: 0, totalEarnings: 0 });
  }, [approvedLogs, activePeriod, workers, config, breakMinutesMap]);

  const weeklyData     = useMemo(() => buildWeeklyHours(approvedLogs, breakMinutesMap), [approvedLogs, breakMinutesMap]);
  const mismatchItems  = useMemo(() => {
    if (!latestAudit?.issues) return [];
    return latestAudit.issues.slice(0, 5).map((issue: any, i: number) => ({
      id: `${latestAudit.id}-${i}`,
      name: issue.name || issue.workerId || "Worker",
      detail: `Shifts ${issue.shiftCount ?? 0} · Att. ${issue.attendanceCount ?? 0}`,
    }));
  }, [latestAudit]);

  const upcomingShifts  = useMemo(() => buildUpcomingShifts(shifts, workers), [shifts, workers]);
  const pendingActions  = useMemo(() => attendanceLogs.filter(l => l.status === "pending").slice(0, 5), [attendanceLogs]);
  const performanceStats = useMemo(() => {
    const map: Record<string, { hours: number; earnings: number }> = {};
    approvedLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
      const wId = String(log.workerId ?? "");
      if (!wId) return;
      const rate = Number(workers[wId]?.hourlyRate ?? config.hourlyRate ?? 0);
      map[wId] = map[wId] || { hours: 0, earnings: 0 };
      map[wId].hours    += getLogHours(log, breakMinutesMap);
      map[wId].earnings += getLogEarnings(log, rate, config.overtimeRate, breakMinutesMap);
    });
    return Object.entries(map)
      .map(([wId, totals]) => ({
        workerId: wId,
        name: workers[wId]?.fullName || workers[wId]?.email || "Worker",
        hours: totals.hours, earnings: totals.earnings,
      }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 3);
  }, [approvedLogs, currentPeriod, workers, config, breakMinutesMap]);

  const maxEarn = performanceStats.reduce((m, s) => Math.max(m, s.earnings), 1);

  // ── Styles ──
  const card = {
    backgroundColor: p.surface, borderRadius: 12,
    borderWidth: 1 as const, borderColor: p.border,
    ...adminCardShadow,
  };
  const sectionHeader = (title: string, action?: string, onAction?: () => void) => (
    <View style={{
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: p.border,
    }}>
      <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" as const }}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: p.accent, fontSize: 12 }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AdminErrorBanner message={error} />

        {/* Page header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
            Dashboard
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
            {activePeriod} · Real-time overview
          </Text>
        </View>

        {/* ── Stat cards ── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Workers",      value: String(workerCount),                          icon: Users,      },
            { label: "Hours (Month)", value: `${totalHours.toFixed(0)}h`,                  icon: Clock,      },
            { label: "Payroll (RM)", value: `${totalEarnings.toFixed(0)}`,                icon: DollarSign, },
            { label: "Working Days", value: String(workingDays),                          icon: Calendar,   },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <View key={stat.label} style={[card, { flex: 1, minWidth: 140, padding: 14 }]}>
                <View style={{
                  width: 30, height: 30, borderRadius: 8,
                  backgroundColor: p.surfaceAlt,
                  alignItems: "center", justifyContent: "center", marginBottom: 10,
                }}>
                  <Icon size={15} color={p.textMuted} strokeWidth={1.8} />
                </View>
                <Text style={{ color: p.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 }}>
                  {stat.value}
                </Text>
                <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Weekly chart ── */}
        <View style={[card, { marginBottom: 16 }]}>
          {sectionHeader("Weekly Hours")}
          <View style={{ padding: 16 }}>
            {weeklyData.every(d => d.hours === 0) ? (
              <Text style={{ color: p.textMuted, fontSize: 12 }}>No hours logged this week</Text>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", height: 80 }}>
                {weeklyData.map(item => (
                  <View key={item.day} style={{ flex: 1, alignItems: "center" }}>
                    <View style={{
                      height: Math.max(4, Math.min(64, item.hours * 6)),
                      width: "100%", borderRadius: 4,
                      backgroundColor: item.hours > 0 ? p.accent : p.border,
                      opacity: item.hours > 0 ? 0.85 : 0.4,
                    }} />
                    <Text style={{ color: p.textMuted, fontSize: 10, marginTop: 5 }}>{item.day}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Two-col: Mismatches + Upcoming shifts ── */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {/* Mismatch alerts */}
          <View style={[card, { flex: 1 }]}>
            {sectionHeader("Mismatch Alerts", "Report", () => router.push("/admin/reports"))}
            <View style={{ padding: 12 }}>
              {!latestAudit?.issueCount ? (
                <Text style={{ color: p.textMuted, fontSize: 12 }}>
                  {latestAudit ? "No mismatches found" : "No audit data yet"}
                </Text>
              ) : (
                mismatchItems.map((item: any, idx: number) => (
                  <View key={item.id} style={{
                    flexDirection: "row", alignItems: "center", gap: 8,
                    paddingVertical: 8,
                    borderBottomWidth: idx < mismatchItems.length - 1 ? 1 : 0,
                    borderBottomColor: p.border,
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.danger }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" as const }}>{item.name}</Text>
                      <Text style={{ color: p.textMuted, fontSize: 11 }}>{item.detail}</Text>
                    </View>
                    <Text style={{ color: p.textMuted, fontSize: 10 }}>{latestAudit.period || "—"}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Upcoming shifts */}
          <View style={[card, { flex: 1 }]}>
            {sectionHeader("Upcoming Shifts", "Manage", () => router.push("/admin/setup"))}
            <View style={{ padding: 12 }}>
              {upcomingShifts.length === 0 ? (
                <Text style={{ color: p.textMuted, fontSize: 12 }}>No upcoming shifts</Text>
              ) : (
                upcomingShifts.map((shift, idx) => (
                  <View key={shift.id} style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 8,
                    borderBottomWidth: idx < upcomingShifts.length - 1 ? 1 : 0,
                    borderBottomColor: p.border,
                  }}>
                    <View>
                      <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" as const }}>{shift.worker}</Text>
                      <Text style={{ color: p.textMuted, fontSize: 11 }}>{shift.time}</Text>
                    </View>
                    <View style={{
                      backgroundColor: p.surfaceAlt, borderRadius: 99,
                      paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ color: p.textMuted, fontSize: 10 }}>{shift.dateLabel}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {/* ── Pending actions ── */}
        <View style={[card, { marginBottom: 16 }]}>
          {sectionHeader(`Pending Actions (${pendingActions.length})`)}
          {pendingActions.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: p.textMuted, fontSize: 12 }}>No pending actions</Text>
            </View>
          ) : (
            pendingActions.map((action, idx) => (
              <View key={action.refPath} style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingHorizontal: 16, paddingVertical: 11,
                borderBottomWidth: idx < pendingActions.length - 1 ? 1 : 0,
                borderBottomColor: p.border,
              }}>
                <AlertCircle size={14} color={p.warning} strokeWidth={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" as const }}>
                    {workers[action.workerId]?.fullName || workers[action.workerId]?.email || action.workerId}
                  </Text>
                  <Text style={{ color: p.textMuted, fontSize: 11 }}>{action.date || "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => updateDoc(doc(db, action.refPath), { status: "approved" })}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      paddingVertical: 5, paddingHorizontal: 9, borderRadius: 7,
                      backgroundColor: p.successSoft,
                    }}
                  >
                    <CheckCircle size={12} color={p.success} strokeWidth={2} />
                    <Text style={{ color: p.success, fontSize: 11, fontWeight: "600" as const }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateDoc(doc(db, action.refPath), { status: "rejected" })}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      paddingVertical: 5, paddingHorizontal: 9, borderRadius: 7,
                      backgroundColor: p.dangerSoft,
                    }}
                  >
                    <XCircle size={12} color={p.danger} strokeWidth={2} />
                    <Text style={{ color: p.danger, fontSize: 11, fontWeight: "600" as const }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Top performers ── */}
        <View style={card}>
          {sectionHeader("Top Performers This Month")}
          {performanceStats.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: p.textMuted, fontSize: 12 }}>No performance data yet</Text>
            </View>
          ) : (
            performanceStats.map((worker, idx) => (
              <View key={worker.workerId} style={{
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: idx < performanceStats.length - 1 ? 1 : 0,
                borderBottomColor: p.border,
                gap: 8,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: p.surfaceAlt,
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{ color: p.textMuted, fontSize: 10, fontWeight: "700" as const }}>{idx + 1}</Text>
                    </View>
                    <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" as const }}>{worker.name}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: p.textMuted, fontSize: 10 }}>Hours</Text>
                      <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" as const }}>{worker.hours.toFixed(0)}h</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: p.textMuted, fontSize: 10 }}>Earnings</Text>
                      <Text style={{ color: p.success, fontSize: 12, fontWeight: "600" as const }}>RM {worker.earnings.toFixed(0)}</Text>
                    </View>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={{ height: 3, backgroundColor: p.border, borderRadius: 99 }}>
                  <View style={{
                    height: 3, borderRadius: 99,
                    backgroundColor: p.accent,
                    width: `${Math.min(100, (worker.earnings / maxEarn) * 100)}%` as any,
                  }} />
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildWeeklyHours = (logs: any[], breakMinutesByKey: Record<string, number>) => {
  const start = startOfWeek(new Date());
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(day => ({ day, hours: 0 }));
  logs.forEach(log => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return;
    const dayIndex = (date.getDay() + 6) % 7;
    totals[dayIndex].hours += getLogHours(log, breakMinutesByKey);
  });
  return totals;
};

const extractAttendancePeriods = (logs: any[]) => {
  const set = new Set<string>();
  logs.forEach(log => { const d = String(log.date ?? ""); if (d.length >= 7) set.add(d.slice(0, 7)); });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
};

const buildBreakMinutesMap = (entries: any[]) => {
  const map: Record<string, number> = {};
  entries.forEach(e => {
    const wId = String(e.workerId ?? ""), date = String(e.date ?? "");
    if (!wId || !date || !e.startTime || !e.endTime) return;
    map[`${wId}:${date}`] = (map[`${wId}:${date}`] ?? 0) + calcMinutesDiff(e.startTime, e.endTime);
  });
  return map;
};

const buildUpcomingShifts = (shifts: any[], workers: Record<string, any>) => {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  return shifts
    .filter(shift => {
      const dateKey = String(shift.date ?? "");
      if (!dateKey || ["completed", "absent", "off", "leave"].includes(String(shift.status ?? ""))) return false;
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      if (dateKey > todayKey) return true;
      if (dateKey < todayKey) return false;
      const shiftEnd = parseTimeToMinutes(shift.end);
      return shiftEnd === null || shiftEnd > nowMinutes;
    })
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .slice(0, 4)
    .map(shift => ({
      id: shift.id,
      worker: workers[shift.workerId]?.fullName || workers[shift.workerId]?.email || "Worker",
      time: `${shift.start || "--:--"} – ${shift.end || "--:--"}`,
      dateLabel: shift.date || "—",
    }));
};

const getOwnerId = (docSnap: any) =>
  docSnap.ref?.parent?.parent?.id || docSnap.data()?.workerId || "";

const parseTimeToMinutes = (time?: string) => {
  if (!time) return null;
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const getLogHours = (log: any, breakMinutesByKey: Record<string, number>) => {
  const storedNet = Number(log.netHours ?? log.net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log, breakMinutesByKey);
  if (log.clockInTs && log.clockOutTs) {
    return Math.max(0, Math.round((log.clockOutTs - log.clockInTs) / 60000) - breakMinutes) / 60;
  }
  if (log.clockIn && log.clockOut) return calcHoursFromTimes(log.clockIn, log.clockOut, breakMinutes);
  return 0;
};

const getLogOvertimeHours = (log: any) => Number(log.overtimeHours ?? log.overtime_hours ?? 0);

const getLogEarnings = (log: any, hourlyRate: number, overtimeRate: number, breakMinutesByKey: Record<string, number>) => {
  const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log, breakMinutesByKey);
  const otHours  = getLogOvertimeHours(log);
  const regHours = Math.max(0, netHours - otHours);
  const otRate   = Number(overtimeRate ?? 0) || hourlyRate * 1.5;
  return regHours * hourlyRate + otHours * otRate;
};

const getBreakMinutesForLog = (log: any, breakMinutesByKey: Record<string, number>) => {
  const stored = Number(log.breakMinutes ?? 0);
  if (stored > 0) return stored;
  if (log.breakStart && log.breakEnd) return Math.max(0, calcMinutesDiff(log.breakStart, log.breakEnd));
  return breakMinutesByKey[`${String(log.workerId ?? "")}:${String(log.date ?? "")}`] ?? 0;
};

const startOfWeek = (date: Date) => {
  const diff = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const isThisMonth = (dateValue: string) => {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const calcHoursFromTimes = (start: string, end: string, breakMinutes = 0) => {
  const s = parseTimeToMinutes(start), e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s - breakMinutes) / 60;
};

const calcMinutesDiff = (start: string, end: string) => {
  const s = parseTimeToMinutes(start), e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  return Math.max(0, e - s);
};
