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
  Calendar,
  DollarSign,
  PieChart,
  TrendingUp,
} from "lucide-react-native";

type WeeklyEntry = { week: string; earnings: number };
type BudgetItem = {
  category: string;
  amount: number;
  color: string;
};

const weeklyData: WeeklyEntry[] = [];

const budgetAllocation: BudgetItem[] = [];

export default function EarningsScreen() {
  const totalMonthly = weeklyData.reduce((sum, w) => sum + w.earnings, 0);
  const maxWeekly = weeklyData.length
    ? Math.max(...weeklyData.map(w => w.earnings))
    : 0;
  const totalBudget = budgetAllocation.reduce((sum, b) => sum + b.amount, 0);
  const daysWorked = 0;
  const totalHours = 0;
  const overtimeHours = 0;

  const normalHours = Math.max(0, totalHours - overtimeHours);
  const normalRate = 0;
  const overtimeRate = 0;
  const deduction = 0;
  const breakdownTotal =
    normalHours * normalRate + overtimeHours * overtimeRate - deduction;
  const percentChange = 0;

  return (
    <LinearGradient colors={["#f8fafc", "#eef2f7"]} style={styles.screen}>
      <View style={styles.bgBlob} />
      <View style={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* ===== Monthly Summary ===== */}
          <LinearGradient
            colors={["#16a34a", "#22c55e"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryRow}>
            <View style={styles.summaryTag}>
              <DollarSign size={16} color="#ffffff" />
              <Text style={styles.summaryMonth}>No data</Text>
            </View>
            <View style={styles.verifiedChip}>
              <Text style={styles.verifiedText}>Pending</Text>
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
              <Text style={styles.statValue}>{totalHours}h</Text>
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
                <Text style={styles.breakdownHint}>1 day</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  container: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 120,
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
