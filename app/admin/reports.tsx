import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Download, TrendingUp } from "lucide-react-native";
import { collection, collectionGroup, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";
import { buildAdminReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";

export default function AdminReports() {
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Record<string, { name: string; hourlyRate: number }>>({});
  const [config, setConfig] = useState({ hourlyRate: 0, overtimeRate: 0 });
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );

  useEffect(() => {
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setAttendanceLogs(list);
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
      unsubWorkers();
      unsubConfig();
    };
  }, []);

  const monthlySummary = useMemo(
    () => aggregateAttendance(approvedLogs, attendanceLogs, workers, config.hourlyRate),
    [approvedLogs, attendanceLogs, workers, config.hourlyRate]
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
    buildSummaryFromAttendance(approvedLogs, attendanceLogs, activePeriod, workers, config.hourlyRate);
  const workerRows = useMemo(() => {
    const map: Record<string, any> = {};
    approvedLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
      const workerId = String(log.workerId ?? "");
      if (!workerId) return;
      const hours = Number(log.hours ?? 0);
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
  }, [approvedLogs, attendanceLogs, currentPeriod, workers, config.hourlyRate]);

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
    await printReport(html);
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

const headerRow = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 16,
};

const title = {
  color: adminPalette.text,
  fontSize: 20,
  fontWeight: "700" as const,
};
const subtitle = { color: adminPalette.textMuted, fontSize: 12, marginTop: 4 };

const exportButton = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingHorizontal: 14,
  paddingVertical: 10,
  backgroundColor: adminPalette.brand,
  borderRadius: 10,
};

const exportText = { color: "#fff", fontWeight: "600" as const, fontSize: 12 };

const statCard = {
  flex: 1,
  minWidth: 220,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const statTitle = { color: adminPalette.text, fontWeight: "600" as const };
const statLabel = { color: adminPalette.textMuted, fontSize: 12, marginTop: 10 };
const statValue = {
  color: adminPalette.text,
  fontSize: 16,
  fontWeight: "600" as const,
  marginTop: 4,
};

const chartCard = {
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const sectionTitle = { color: adminPalette.text, fontWeight: "600" as const };
const emptyText = { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 };

const tableHeader = {
  flexDirection: "row" as const,
  backgroundColor: adminPalette.surfaceAlt,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
};

const tableHeaderText = {
  flex: 1,
  color: adminPalette.textMuted,
  fontSize: 11,
  fontWeight: "600" as const,
};
const tableRow = {
  flexDirection: "row" as const,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
};
const tableCell = { flex: 1, color: adminPalette.text, fontSize: 12 };
const tableCellMuted = { flex: 1, color: adminPalette.textMuted, fontSize: 12 };

const aggregateAttendance = (
  approvedLogs: any[],
  allLogs: any[],
  workers: Record<string, { name: string; hourlyRate: number }>,
  defaultRate: number
) => {
  const map: Record<string, any> = {};
  approvedLogs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length < 7) return;
    const period = date.slice(0, 7);
    const workerId = String(log.workerId ?? "");
    const hours = Number(log.hours ?? 0);
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
    map[period].totalEarnings += hours * rate;
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
  defaultRate: number
) => {
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
  return {
    period,
    totalHours,
    overtimeHours: 0,
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


const averagePerWorker = (summary: any) => {
  if (!summary) return 0;
  const workers = summary.workers?.size || 0;
  if (!workers) return 0;
  return summary.totalEarnings / workers;
};
