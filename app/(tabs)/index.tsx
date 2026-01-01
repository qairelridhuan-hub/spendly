import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  Bell,
  Clock,
  DollarSign,
  Target,
  Zap,
  Award,
  Calendar,
  User,
  LogOut,
} from "lucide-react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

/* =====================
   TYPES
===================== */

type WorkEventType = "clock_in" | "clock_out" | "break_start";

type WorkEvent = {
  type: WorkEventType;
  time: string;
};

type SalarySummary = {
  month: string;
  totalEarnings: number;
  status: "pending" | "paid";
  nextPaymentDate: string;
  estimatedNextAmount: number;
};

/* =====================
   SCREEN
===================== */

export default function WorkerHomeScreen() {
  /* =====================
     STATE
  ===================== */
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [events, setEvents] = useState<WorkEvent[]>([]);

  // 🔹 Salary summary (akan sync dari Earnings module)
  const [salarySummary] = useState<SalarySummary>({
    month: "Dec 2025",
    totalEarnings: 0,
    status: "pending",
    nextPaymentDate: "-",
    estimatedNextAmount: 0,
  });

  // 🔹 Weekly goal (akan datang dari Calendar)
  const weeklyGoal = {
    current: 0,
    target: 40,
  };

  const goalPercentage =
    weeklyGoal.target === 0
      ? 0
      : Math.round((weeklyGoal.current / weeklyGoal.target) * 100);

  /* =====================
     HELPERS
  ===================== */
  const logEvent = (type: WorkEventType) => {
    const time = new Date().toLocaleTimeString();
    setEvents(prev => [{ type, time }, ...prev]);
  };

  const getEventLabel = (type: WorkEventType) => {
    switch (type) {
      case "clock_in":
        return "clocked in";
      case "clock_out":
        return "clocked out";
      case "break_start":
        return "break started";
    }
  };

  /* =====================
     ACTIONS
  ===================== */
  const handleClockInOut = () => {
    logEvent(isClockedIn ? "clock_out" : "clock_in");
    setIsClockedIn(prev => !prev);
  };

  const handleBreak = () => {
    logEvent("break_start");
  };

  const handleLogout = () => {
    // nanti: clear auth / async storage
    router.replace("/login");
  };

  /* =====================
     UI
  ===================== */
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      {/* 🔝 HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>💰</Text>
          </View>

          <View>
            <Text style={styles.appName}>Spendly</Text>
            <Text style={styles.greeting}>Hey, John!</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity>
            <Bell size={22} color="#6b7280" />
            <View style={styles.dot} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout}>
            <LogOut size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 🔔 Notifications */}
        <View style={styles.notificationCard}>
          <View style={styles.row}>
            <Bell size={18} color="#fff" />
            <Text style={styles.notificationTitle}>latest updates</Text>
          </View>
          <Text style={styles.emptyText}>no notifications yet</Text>
        </View>

        {/* 💰 Monthly Salary Summary */}
        <View style={styles.salarySummary}>
          <View style={styles.rowBetween}>
            <Text style={styles.salaryTitle}>Monthly Salary</Text>
            <View style={styles.salaryPill}>
              <Text style={styles.salaryPillText}>
                {salarySummary.month}
              </Text>
            </View>
          </View>

          <Text style={styles.salaryAmount}>
            RM {salarySummary.totalEarnings.toFixed(2)}
          </Text>

          <View style={styles.row}>
            <Text style={styles.salaryStatusIcon}>
              {salarySummary.status === "paid" ? "✅" : "⏳"}
            </Text>
            <Text style={styles.salaryStatusText}>
              {salarySummary.status === "paid"
                ? "Verified & Paid"
                : "Pending Verification"}
            </Text>
          </View>

          <View style={styles.salaryDivider} />

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.salaryLabel}>Next Payment</Text>
              <Text style={styles.salaryValue}>
                {salarySummary.nextPaymentDate}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.salaryLabel}>Estimated</Text>
              <Text style={styles.salaryValue}>
                RM {salarySummary.estimatedNextAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* ⏰ Today Shift */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>today shift</Text>
            <Clock size={20} color="#4f46e5" />
          </View>

          <Text style={styles.smallText}>shift loaded</Text>
          <View style={styles.progressBarBg} />

          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isClockedIn ? "#dc2626" : "#16a34a" },
              ]}
              onPress={handleClockInOut}
            >
              <Text style={styles.buttonText}>
                {isClockedIn ? "clock out" : "clock in"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBreak}
            >
              <Text style={styles.secondaryText}>break</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🕒 Recent Activity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>recent activity</Text>

          {events.length === 0 ? (
            <Text style={styles.smallText}>no activity yet</Text>
          ) : (
            events.slice(0, 4).map((e, i) => (
              <Text key={i} style={styles.activityText}>
                • {getEventLabel(e.type)} at {e.time}
              </Text>
            ))
          )}
        </View>

        {/* 🎯 Weekly Goal */}
        <View style={styles.goalCard}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <Target size={20} color="#ea580c" />
              <Text style={styles.cardTitle}>weekly goal</Text>
            </View>
            <Text style={styles.goalBadge}>{goalPercentage}%</Text>
          </View>

          <Text style={styles.smallText}>
            {weeklyGoal.current}h / {weeklyGoal.target}h
          </Text>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.goalProgress,
                { width: `${goalPercentage}%` },
              ]}
            />
          </View>
        </View>

        {/* ⚡ Quick Stats */}
        <View style={styles.grid}>
          <StatBox icon={<Clock size={16} color="#2563eb" />} label="hours" />
          <StatBox icon={<DollarSign size={16} color="#16a34a" />} label="earnings" />
          <StatBox icon={<Target size={16} color="#9333ea" />} label="goals" />
          <StatBox icon={<Zap size={16} color="#ea580c" />} label="streak" />
        </View>

        {/* 🏆 Level */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Award size={24} color="#ca8a04" />
            <View>
              <Text style={styles.cardTitle}>level —</Text>
              <Text style={styles.smallText}>xp — / —</Text>
            </View>
          </View>
          <View style={styles.progressBarBg} />
        </View>

        {/* 🚀 Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>quick actions</Text>

          <View style={styles.grid}>
            <ActionBox icon={<Calendar size={20} />} label="schedule" onPress={() => router.push("/(tabs)/calendar")} />
            <ActionBox icon={<DollarSign size={20} />} label="earnings" onPress={() => router.push("/(tabs)/earnings")} />
            <ActionBox icon={<Target size={20} />} label="goals" onPress={() => router.push("/(tabs)/goals")} />
            <ActionBox icon={<User size={20} />} label="profile" onPress={() => router.push("/(tabs)/profile")} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =====================
   SMALL COMPONENTS
===================== */

function StatBox({ icon, label }: any) {
  return (
    <View style={styles.statBox}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>—</Text>
    </View>
  );
}

function ActionBox({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionBox} onPress={onPress}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    backgroundColor: "#f9fafb",
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  greeting: { fontSize: 13, color: "#6b7280" },
  headerRight: { flexDirection: "row", gap: 16 },
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },

  notificationCard: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  notificationTitle: { color: "#fff", fontSize: 14 },
  emptyText: { color: "#e5e7eb", fontSize: 12, marginTop: 8 },

  salarySummary: {
    backgroundColor: "#7c5cff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  salaryTitle: { color: "#e5e7eb", fontSize: 14 },
  salaryAmount: { color: "#fff", fontSize: 28, fontWeight: "700" },
  salaryPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  salaryPillText: { color: "#fff", fontSize: 12 },
  salaryStatusIcon: { fontSize: 16, marginRight: 6 },
  salaryStatusText: { color: "#e5e7eb", fontSize: 13 },
  salaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 12,
  },
  salaryLabel: { color: "#e5e7eb", fontSize: 12 },
  salaryValue: { color: "#fff", fontSize: 16, fontWeight: "600" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  smallText: { fontSize: 12, color: "#6b7280" },
  activityText: { fontSize: 12, color: "#374151", marginTop: 4 },

  progressBarBg: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    marginVertical: 8,
  },
  goalProgress: { height: 6, backgroundColor: "#fb923c" },

  primaryButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginLeft: 8,
  },
  secondaryText: { color: "#374151" },

  goalCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  goalBadge: {
    backgroundColor: "#fed7aa",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
  },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { fontSize: 16, fontWeight: "600" },

  actionBox: {
    width: "47%",
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  actionText: { marginTop: 6, fontSize: 14, color: "#111827" },
});