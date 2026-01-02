import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Download, TrendingUp } from "lucide-react-native";
import { Svg, Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { collection, collectionGroup, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";
import { buildAdminReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";

export default function AdminReports() {
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Record<string, string>>({});
  const [config, setConfig] = useState({ hourlyRate: 0, overtimeRate: 0 });
  const [activeSeries, setActiveSeries] = useState<"hours" | "earnings">("hours");

  useEffect(() => {
    const unsubPayroll = onSnapshot(collectionGroup(db, "payroll"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setPayrollRecords(list);
    });
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setAttendanceLogs(list);
    });
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const map: Record<string, string> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] =
          data.fullName || data.displayName || data.email || "Worker";
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
      unsubPayroll();
      unsubAttendance();
      unsubWorkers();
      unsubConfig();
    };
  }, []);

  const monthlySummary = useMemo(() => aggregatePayroll(payrollRecords), [payrollRecords]);
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
    buildSummaryFromAttendance(attendanceLogs, activePeriod, config.hourlyRate);
  const radarAxes = useMemo(() => {
    const workerCount = Object.keys(workers).length;
    const maxHours = Math.max(40, currentSummary.totalHours || 0);
    const maxEarnings = Math.max(1000, currentSummary.totalEarnings || 0);
    const maxOvertime = Math.max(10, currentSummary.overtimeHours || 0);
    const maxAbsence = Math.max(5, currentSummary.absenceDeductions || 0);
    return [
      { label: "Workers", value: workerCount, max: Math.max(5, workerCount || 1) },
      { label: "Hours", value: currentSummary.totalHours, max: maxHours },
      { label: "Earnings", value: currentSummary.totalEarnings, max: maxEarnings },
      { label: "Overtime", value: currentSummary.overtimeHours, max: maxOvertime },
      { label: "Absences", value: currentSummary.absenceDeductions, max: maxAbsence },
    ];
  }, [workers, currentSummary]);
  const dailySeries = useMemo(
    () => buildDailySeries(attendanceLogs, config.hourlyRate),
    [attendanceLogs, config.hourlyRate]
  );
  const dailyTotals = useMemo(() => {
    return dailySeries.reduce(
      (acc, item) => {
        acc.hours += item.hours;
        acc.earnings += item.earnings;
        return acc;
      },
      { hours: 0, earnings: 0 }
    );
  }, [dailySeries]);
  const workerRows = useMemo(() => {
    return payrollRecords
      .filter(record => String(record.period ?? "") === currentPeriod)
      .map(record => ({
        workerId: record.workerId || "",
        name: workers[record.workerId] || record.workerId || "Worker",
        totalHours: Number(record.totalHours ?? 0),
        overtimeHours: Number(record.overtimeHours ?? 0),
        totalEarnings: Number(record.totalEarnings ?? 0),
        absenceDeductions: Number(record.absenceDeductions ?? 0),
        status: record.status,
      }));
  }, [payrollRecords, currentPeriod, workers]);

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

        <View style={[chartCard, { marginTop: 16 }]}>
          <View style={barHeader}>
            <View>
              <Text style={sectionTitle}>Daily Activity (Bar)</Text>
              <Text style={subtitle}>Last 30 days</Text>
            </View>
            <View style={barToggle}>
              {(["hours", "earnings"] as const).map(key => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActiveSeries(key)}
                  style={[
                    barToggleButton,
                    activeSeries === key && barToggleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      barToggleText,
                      activeSeries === key && barToggleTextActive,
                    ]}
                  >
                    {key === "hours" ? "Hours" : "Earnings"}
                  </Text>
                  <Text
                    style={[
                      barToggleValue,
                      activeSeries === key && barToggleTextActive,
                    ]}
                  >
                    {key === "hours"
                      ? `${dailyTotals.hours.toFixed(0)}h`
                      : `RM ${dailyTotals.earnings.toFixed(0)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {dailySeries.length === 0 ? (
            <Text style={emptyText}>No daily data yet.</Text>
          ) : (
            <View style={barChartRow}>
              {dailySeries.map(item => {
                const heightPercent =
                  activeSeries === "hours"
                    ? item.hoursPercent
                    : item.earningsPercent;
                return (
                  <View key={item.date} style={barItem}>
                    <View
                      style={[
                        barItemFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor:
                            activeSeries === "hours"
                              ? adminPalette.accent
                              : adminPalette.success,
                        },
                      ]}
                    />
                    <Text style={barItemLabel}>{item.shortLabel}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={[chartCard, { marginTop: 16 }]}>
          <Text style={sectionTitle}>Performance Radar</Text>
          <Text style={subtitle}>Overall workload and payroll balance</Text>
          <RadarChart axes={radarAxes} />
          <View style={radarLegend}>
            {radarAxes.map(axis => (
              <View key={axis.label} style={radarLegendRow}>
                <View style={radarLegendDot} />
                <Text style={radarLegendText}>{axis.label}</Text>
                <Text style={radarLegendValue}>{axis.value.toFixed(1)}</Text>
              </View>
            ))}
          </View>
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
const radarLegend = { marginTop: 12, gap: 6 };
const radarLegendRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};
const radarLegendDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  backgroundColor: adminPalette.accent,
};
const radarLegendText = { flex: 1, color: adminPalette.textMuted, fontSize: 12 };
const radarLegendValue = { color: adminPalette.text, fontWeight: "600" as const, fontSize: 12 };
const barHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 12,
};
const barToggle = { flexDirection: "row" as const, gap: 8 };
const barToggleButton = {
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: adminPalette.border,
  backgroundColor: adminPalette.surfaceAlt,
};
const barToggleButtonActive = {
  borderColor: adminPalette.accent,
  backgroundColor: adminPalette.infoSoft,
};
const barToggleText = { color: adminPalette.textMuted, fontSize: 11 };
const barToggleTextActive = { color: adminPalette.accent, fontWeight: "600" as const };
const barToggleValue = { color: adminPalette.text, fontSize: 12, fontWeight: "700" as const };
const barChartRow = {
  marginTop: 12,
  flexDirection: "row" as const,
  alignItems: "flex-end" as const,
  gap: 8,
  height: 140,
};
const barItem = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const };
const barItemFill = { width: "80%", borderRadius: 6, minHeight: 8 };
const barItemLabel = { color: adminPalette.textMuted, fontSize: 9, marginTop: 6 };

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


const buildSummaryFromAttendance = (
  logs: any[],
  period: string,
  hourlyRate: number
) => {
  const totalHours = logs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(period)) return sum;
    return sum + Number(log.hours ?? 0);
  }, 0);
  const absences = logs.filter(
    log => String(log.status ?? "") === "absent" && String(log.date ?? "").startsWith(period)
  ).length;
  return {
    period,
    totalHours,
    overtimeHours: 0,
    absenceDeductions: absences,
    totalEarnings: totalHours * hourlyRate,
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

const buildDailySeries = (logs: any[], hourlyRate: number) => {
  const days = 30;
  const data: {
    date: string;
    shortLabel: string;
    hours: number;
    earnings: number;
    hoursPercent: number;
    earningsPercent: number;
  }[] = [];
  const byDate: Record<string, number> = {};
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (!date) return;
    byDate[date] = (byDate[date] || 0) + Number(log.hours ?? 0);
  });
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    const hours = Number(byDate[key] || 0);
    data.push({
      date: key,
      shortLabel: `${date.getDate()}/${date.getMonth() + 1}`,
      hours,
      earnings: hours * hourlyRate,
      hoursPercent: 0,
      earningsPercent: 0,
    });
  }
  const maxHours = Math.max(1, ...data.map(item => item.hours));
  const maxEarnings = Math.max(1, ...data.map(item => item.earnings));
  return data.map(item => ({
    ...item,
    hoursPercent: Math.max(4, (item.hours / maxHours) * 100),
    earningsPercent: Math.max(4, (item.earnings / maxEarnings) * 100),
  }));
};

function RadarChart({
  axes,
}: {
  axes: { label: string; value: number; max: number }[];
}) {
  const size = 220;
  const center = size / 2;
  const radius = 80;
  const levels = 4;
  const angleStep = (Math.PI * 2) / axes.length;

  const points = axes.map((axis, index) => {
    const value = axis.max === 0 ? 0 : Math.min(1, axis.value / axis.max);
    const angle = -Math.PI / 2 + angleStep * index;
    const r = radius * value;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  });

  const polygonPoints = points.map(point => `${point.x},${point.y}`).join(" ");

  const gridPolygons = Array.from({ length: levels }, (_, level) => {
    const levelRadius = radius * ((level + 1) / levels);
    const gridPoints = axes
      .map((_, index) => {
        const angle = -Math.PI / 2 + angleStep * index;
        return `${center + levelRadius * Math.cos(angle)},${center + levelRadius * Math.sin(angle)}`;
      })
      .join(" ");
    return (
      <Polygon
        key={`grid-${level}`}
        points={gridPoints}
        fill="none"
        stroke={adminPalette.border}
        strokeWidth="1"
      />
    );
  });

  return (
    <View style={{ alignItems: "center", marginTop: 12 }}>
      <Svg width={size} height={size}>
        {gridPolygons}
        {axes.map((_, index) => {
          const angle = -Math.PI / 2 + angleStep * index;
          return (
            <Line
              key={`axis-${index}`}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke={adminPalette.border}
              strokeWidth="1"
            />
          );
        })}
        <Polygon
          points={polygonPoints}
          fill="rgba(14,165,233,0.15)"
          stroke={adminPalette.accent}
          strokeWidth="2"
        />
        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={adminPalette.accent}
          />
        ))}
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + angleStep * index;
          const labelRadius = radius + 18;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          return (
            <SvgText
              key={`label-${axis.label}`}
              x={x}
              y={y}
              fill={adminPalette.textMuted}
              fontSize="10"
              textAnchor="middle"
            >
              {axis.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
