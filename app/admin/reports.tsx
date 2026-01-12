import { Alert, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Download, FileText, TrendingUp } from "lucide-react-native";
import { collection, collectionGroup, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { buildAdminReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";

export default function AdminReports() {
  const { colors: adminPalette } = useAdminTheme();
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [breakLogs, setBreakLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Record<string, { name: string; hourlyRate: number }>>({});
  const [config, setConfig] = useState({ hourlyRate: 0, overtimeRate: 0 });
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const {
    headerRow,
    title,
    subtitle,
    exportButton,
    exportText,
    statCard,
    statTitle,
    statLabel,
    statValue,
    chartCard,
    sectionTitle,
    emptyText,
    generateCard,
    generateButton,
    generateButtonText,
    tableHeader,
    tableHeaderText,
    tableRow,
    tableCell,
    tableCellMuted,
  } = useMemo(
    () => ({
      headerRow: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
        marginBottom: 16,
      },
      title: {
        color: adminPalette.text,
        fontSize: 20,
        fontWeight: "700" as const,
      },
      subtitle: { color: adminPalette.textMuted, fontSize: 12, marginTop: 4 },
      exportButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: adminPalette.brand,
        borderRadius: 10,
      },
      exportText: { color: "#fff", fontWeight: "600" as const, fontSize: 12 },
      statCard: {
        flex: 1,
        minWidth: 220,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
      },
      statTitle: { color: adminPalette.text, fontWeight: "600" as const },
      statLabel: { color: adminPalette.textMuted, fontSize: 12, marginTop: 10 },
      statValue: {
        color: adminPalette.text,
        fontSize: 16,
        fontWeight: "600" as const,
        marginTop: 4,
      },
      chartCard: {
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: adminPalette.border,
      },
      sectionTitle: { color: adminPalette.text, fontWeight: "600" as const },
      emptyText: { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 },
      generateCard: {
        marginTop: 16,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 12,
      },
      generateButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: adminPalette.accentStrong,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
      },
      generateButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 12 },
      tableHeader: {
        flexDirection: "row" as const,
        backgroundColor: adminPalette.surfaceAlt,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
      },
      tableHeaderText: {
        flex: 1,
        color: adminPalette.textMuted,
        fontSize: 11,
        fontWeight: "600" as const,
      },
      tableRow: {
        flexDirection: "row" as const,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
      },
      tableCell: { flex: 1, color: adminPalette.text, fontSize: 12 },
      tableCellMuted: { flex: 1, color: adminPalette.textMuted, fontSize: 12 },
    }),
    [adminPalette]
  );

  useEffect(() => {
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
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
      const map: Record<string, { name: string; hourlyRate: number }> = {};
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

  const breakMinutesByKey = useMemo(() => buildBreakMinutesMap(breakLogs), [breakLogs]);
  const overtimeHoursByKey = useMemo(() => buildOvertimeHoursMap(overtimeLogs), [overtimeLogs]);

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
  const attendancePeriods = useMemo(
    () => extractAttendancePeriods(attendanceLogs),
    [attendanceLogs]
  );
  const activePeriod =
    monthlySummary.find(row => row.period === currentPeriod)?.period ||
    attendancePeriods[0] ||
    currentPeriod;
  const currentSummary =
    monthlySummary.find(row => row.period === activePeriod) ||
    buildSummaryFromAttendance(
      approvedLogs,
      attendanceLogs,
      activePeriod,
      workers,
      config.hourlyRate,
      config.overtimeRate,
      breakMinutesByKey,
      overtimeHoursByKey
    );
  const workerRows = useMemo(() => {
    const map: Record<string, any> = {};
    approvedLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
      const workerId = String(log.workerId ?? "");
      if (!workerId) return;
      const hours = getLogHours(log, breakMinutesByKey);
      const rate = Number(workers[workerId]?.hourlyRate ?? config.hourlyRate);
      map[workerId] = map[workerId] || {
        workerId,
        name: workers[workerId]?.name || workerId || "Worker",
        totalHours: 0,
        overtimeHours: 0,
        totalEarnings: 0,
        absenceDeductions: 0,
        status: "pending",
      };
      map[workerId].totalHours += hours;
      map[workerId].totalEarnings += hours * rate;
    });
    Object.entries(overtimeHoursByKey).forEach(([key, hours]) => {
      const [workerId, date] = key.split(":");
      if (!date?.startsWith(currentPeriod)) return;
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
      map[workerId].totalEarnings += hours * config.overtimeRate;
    });
    attendanceLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
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
  }, [
    approvedLogs,
    attendanceLogs,
    currentPeriod,
    workers,
    config.hourlyRate,
    config.overtimeRate,
    breakMinutesByKey,
    overtimeHoursByKey,
  ]);

  const handleExportReport = async () => {
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
    Alert.alert(
      "Download report?",
      "Generate and download the PDF report for this period?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            await printReport(html);
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={headerRow}>
          <View>
            <Text style={title}>Reports & Analytics</Text>
            <Text style={subtitle}>
              Overview of attendance and payroll data
            </Text>
          </View>
          <TouchableOpacity style={exportButton} onPress={handleExportReport}>
            <Download size={18} color="#fff" />
            <Text style={exportText}>Export PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={generateCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Download size={18} color={adminPalette.accent} />
            <View>
              <Text style={sectionTitle}>Generate report</Text>
              <Text style={sectionSub}>
                Create a PDF summary for the selected period
              </Text>
            </View>
          </View>
          <TouchableOpacity style={generateButton} onPress={handleExportReport}>
            <FileText size={16} color="#fff" />
            <Text style={generateButtonText}>Generate</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} color={adminPalette.success} />
              <Text style={statTitle}>This Month</Text>
            </View>
            <Text style={statLabel}>Total Hours</Text>
            <Text style={statValue}>
              {currentSummary.totalHours.toFixed(0)} hours
            </Text>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Calendar size={18} color={adminPalette.accent} />
              <Text style={statTitle}>Payroll</Text>
            </View>
            <Text style={statLabel}>Total Payment</Text>
            <Text style={[statValue, { color: adminPalette.success }]}>
              RM {currentSummary.totalEarnings.toFixed(0)}
            </Text>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} color={adminPalette.accent} />
              <Text style={statTitle}>Avg Rate</Text>
            </View>
            <Text style={statLabel}>Per Worker</Text>
            <Text style={statValue}>
              RM {averagePerWorker(currentSummary)?.toFixed(0) || 0}/month
            </Text>
          </View>
        </View>

        <View style={[chartCard, { marginTop: 16 }]}>
          <Text style={sectionTitle}>Monthly Summary</Text>
          {monthlySummary.length === 0 ? (
            <Text style={emptyText}>No payroll summaries yet.</Text>
          ) : (
            <View style={{ marginTop: 12 }}>
              <View style={tableHeader}>
                {["Month", "Total Hours", "Overtime", "Absences", "Total Payroll"].map(label => (
                  <Text key={label} style={tableHeaderText}>
                    {label}
                  </Text>
                ))}
              </View>
              {monthlySummary.map(row => (
                <View key={row.period} style={tableRow}>
                  <Text style={tableCell}>{row.period}</Text>
                  <Text style={tableCellMuted}>{row.totalHours.toFixed(0)}</Text>
                  <Text style={tableCellMuted}>{row.overtimeHours.toFixed(0)}</Text>
                  <Text style={tableCellMuted}>{row.absenceDeductions.toFixed(0)}</Text>
                  <Text style={[tableCell, { color: adminPalette.success }]}>
                    RM {row.totalEarnings.toFixed(0)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const aggregateAttendance = (
  approvedLogs: any[],
  allLogs: any[],
  workers: Record<string, { name: string; hourlyRate: number }>,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) => {
  const map: Record<string, any> = {};
  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const hours = getLogHours(log, breakMinutesByKey);
    const rate = Number(workers[workerId]?.hourlyRate ?? defaultRate);
    map[period] = map[period] || {
      period,
      totalHours: 0,
      overtimeHours: 0,
      absenceDeductions: 0,
      totalEarnings: 0,
      workers: new Set<string>(),
    };
    map[period].totalHours += hours;
    map[period].totalEarnings += getLogEarnings(log, rate, overtimeRate, breakMinutesByKey);
    map[period].overtimeHours += getLogOvertimeHours(log);
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
      overtimeHours: 0,
      absenceDeductions: 0,
      totalEarnings: 0,
      workers: new Set<string>(),
    };
    map[period].absenceDeductions += 1;
  });
  return Object.values(map).sort((a: any, b: any) =>
    String(b.period).localeCompare(String(a.period))
  );
};


const buildSummaryFromAttendance = (
  approvedLogs: any[],
  allLogs: any[],
  period: string,
  workers: Record<string, { name: string; hourlyRate: number }>,
  defaultRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>,
  overtimeHoursByKey: Record<string, number>
) => {
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
  return {
    period,
    totalHours,
    overtimeHours,
    absenceDeductions: absences,
    totalEarnings,
  };
};

const extractAttendancePeriods = (logs: any[]) => {
  const set = new Set<string>();
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length >= 7) set.add(date.slice(0, 7));
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
};

const getOwnerId = (docSnap: any) => {
  return docSnap.ref?.parent?.parent?.id || docSnap.data()?.workerId || "";
};

const buildBreakMinutesMap = (entries: any[]) => {
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
};

const buildOvertimeHoursMap = (entries: any[]) => {
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
};

const getLogHours = (log: any, breakMinutesByKey: Record<string, number>) => {
  const storedNet = Number(log.netHours ?? log.net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log, breakMinutesByKey);
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

const getLogEarnings = (
  log: any,
  hourlyRate: number,
  overtimeRate: number,
  breakMinutesByKey: Record<string, number>
) => {
  const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log, breakMinutesByKey);
  const overtimeHours = getLogOvertimeHours(log);
  const regularHours = Math.max(0, netHours - overtimeHours);
  const resolvedOvertimeRate = overtimeRate || hourlyRate * 1.5;
  return regularHours * hourlyRate + overtimeHours * resolvedOvertimeRate;
};

const getBreakMinutesForLog = (log: any, breakMinutesByKey: Record<string, number>) => {
  const stored = Number(log.breakMinutes ?? 0);
  if (stored > 0) return stored;
  if (log.breakStart && log.breakEnd) {
    return Math.max(0, calcMinutesDiff(log.breakStart, log.breakEnd));
  }
  const dateKey = `${String(log.workerId ?? "")}:${String(log.date ?? "")}`;
  return breakMinutesByKey[dateKey] ?? 0;
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


const averagePerWorker = (summary: any) => {
  if (!summary) return 0;
  const workers = summary.workers?.size || 0;
  if (!workers) return 0;
  return summary.totalEarnings / workers;
};
