import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Download, TrendingUp } from "lucide-react-native";
import { collectionGroup, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";

export default function AdminReports() {
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

  useEffect(() => {
    const unsubPayroll = onSnapshot(collectionGroup(db, "payroll"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setPayrollRecords(list);
    });
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setAttendanceLogs(list);
    });
    return () => {
      unsubPayroll();
      unsubAttendance();
    };
  }, []);

  const monthlySummary = useMemo(() => aggregatePayroll(payrollRecords), [payrollRecords]);
  const weeklyHours = useMemo(() => aggregateWeeklyHours(attendanceLogs), [attendanceLogs]);
  const monthlyEarnings = useMemo(() => monthlySummary.map(row => ({
    label: row.period,
    value: row.totalEarnings,
  })), [monthlySummary]);

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
          <TouchableOpacity style={exportButton}>
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
              {monthlySummary[0]?.totalHours?.toFixed(0) || 0} hours
            </Text>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Calendar size={18} color={adminPalette.accent} />
              <Text style={statTitle}>Payroll</Text>
            </View>
            <Text style={statLabel}>Total Payment</Text>
            <Text style={[statValue, { color: adminPalette.success }]}>
              RM {monthlySummary[0]?.totalEarnings?.toFixed(0) || 0}
            </Text>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} color={adminPalette.accent} />
              <Text style={statTitle}>Avg Rate</Text>
            </View>
            <Text style={statLabel}>Per Worker</Text>
            <Text style={statValue}>
              RM {averagePerWorker(monthlySummary)?.toFixed(0) || 0}/month
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
          <View style={[chartCard, { flex: 1, minWidth: 260 }]}>
            <Text style={sectionTitle}>Weekly Hours Trend</Text>
            {weeklyHours.length === 0 ? (
              <Text style={emptyText}>No weekly data yet.</Text>
            ) : (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
                {weeklyHours.map(item => (
                  <View key={item.label} style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        height: Math.max(8, item.value * 5),
                        width: "80%",
                        borderRadius: 8,
                        backgroundColor: adminPalette.accent,
                      }}
                    />
                    <Text style={chartLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={[chartCard, { flex: 1, minWidth: 260 }]}>
            <Text style={sectionTitle}>Monthly Earnings Trend</Text>
            {monthlyEarnings.length === 0 ? (
              <Text style={emptyText}>No monthly data yet.</Text>
            ) : (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
                {monthlyEarnings.map(item => (
                  <View key={item.label} style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        height: Math.max(8, item.value / 50),
                        width: "80%",
                        borderRadius: 8,
                        backgroundColor: adminPalette.success,
                      }}
                    />
                    <Text style={chartLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}
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
const chartLabel = { color: adminPalette.textMuted, fontSize: 10, marginTop: 6 };

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

const aggregatePayroll = (records: any[]) => {
  const map: Record<string, any> = {};
  records.forEach(record => {
    const period = String(record.period ?? "");
    if (!period) return;
    map[period] = map[period] || {
      period,
      totalHours: 0,
      overtimeHours: 0,
      absenceDeductions: 0,
      totalEarnings: 0,
      workers: new Set<string>(),
    };
    map[period].totalHours += Number(record.totalHours ?? 0);
    map[period].overtimeHours += Number(record.overtimeHours ?? 0);
    map[period].absenceDeductions += Number(record.absenceDeductions ?? 0);
    map[period].totalEarnings += Number(record.totalEarnings ?? 0);
    if (record.workerId) map[period].workers.add(String(record.workerId));
  });
  return Object.values(map).sort((a: any, b: any) =>
    String(b.period).localeCompare(String(a.period))
  );
};

const aggregateWeeklyHours = (logs: any[]) => {
  const start = startOfWeek(new Date());
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = dayLabels.map(label => ({ label, value: 0 }));
  logs.forEach(log => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start) return;
    const dayIndex = (date.getDay() + 6) % 7;
    totals[dayIndex].value += Number(log.hours ?? 0);
  });
  return totals;
};

const averagePerWorker = (summary: any[]) => {
  if (summary.length === 0) return 0;
  const latest = summary[0];
  const workers = latest.workers?.size || 0;
  if (!workers) return 0;
  return latest.totalEarnings / workers;
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};
