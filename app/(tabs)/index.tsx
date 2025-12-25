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
} from "lucide-react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type Activity = {
  message: string;
  time: string;
};

export default function WorkerHomeScreen() {
  /* =====================
     STATE
  ===================== */
  const [notifications] = useState<any[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [weeklyGoal] = useState({
    current: 0,
    target: 40,
  });

  const goalPercentage =
    weeklyGoal.target === 0
      ? 0
      : Math.round((weeklyGoal.current / weeklyGoal.target) * 100);

  /* =====================
     ACTIONS
  ===================== */
  const handleClockInOut = () => {
    const now = new Date().toLocaleTimeString();

    setActivities(prev => [
      {
        message: isClockedIn ? "clocked out" : "clocked in",
        time: now,
      },
      ...prev,
    ]);

    setIsClockedIn(prev => !prev);
  };

  const handleBreak = () => {
    const now = new Date().toLocaleTimeString();

    setActivities(prev => [
      { message: "break started", time: now },
      ...prev,
    ]);
  };

  /* =====================
     UI
  ===================== */
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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

          {notifications.length === 0 ? (
            <Text style={styles.emptyText}>no notifications yet</Text>
          ) : (
            notifications.slice(0, 2).map((n, i) => (
              <Text key={i} style={styles.notificationText}>
                • {n.message}
              </Text>
            ))
          )}
        </View>

        {/* 💰 Monthly Salary */}
        <View style={styles.salaryCard}>
          <Text style={styles.label}>monthly salary</Text>
          <Text style={styles.bigValue}>rm —</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.smallText}>status pending</Text>
            <Text style={styles.badge}>—</Text>
          </View>
        </View>

        {/* ⏰ Today Shift */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>today shift</Text>
            <Clock size={20} color="#4f46e5" />
          </View>

          <Text style={styles.smallText}>shift loaded</Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: "0%" }]} />
          </View>

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

          {activities.length === 0 ? (
            <Text style={styles.smallText}>no activity yet</Text>
          ) : (
            activities.slice(0, 4).map((a, i) => (
              <Text key={i} style={styles.activityText}>
                • {a.message} at {a.time}
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

        {/* 🏆 Gamification */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Award size={24} color="#ca8a04" />
            <View>
              <Text style={styles.cardTitle}>level —</Text>
              <Text style={styles.smallText}>xp — / —</Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: "0%" }]} />
          </View>
        </View>

        {/* 🚀 Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>quick actions</Text>

          <View style={styles.grid}>
            <ActionBox
              icon={<Calendar size={20} />}
              label="schedule"
              onPress={() => router.push("/(tabs)/calendar")}
            />
            <ActionBox
              icon={<DollarSign size={20} />}
              label="earnings"
              onPress={() => router.push("/(tabs)/earnings")}
            />
            <ActionBox
              icon={<Target size={20} />}
              label="goals"
              onPress={() => router.push("/(tabs)/goals")}
            />
            <ActionBox
              icon={<User size={20} />}
              label="profile"
              onPress={() => router.push("/(tabs)/profile")}
            />
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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationCard: {
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  notificationTitle: { color: "#fff", fontSize: 14 },
  notificationText: { color: "#fff", fontSize: 12, marginTop: 4 },
  emptyText: { color: "#e5e7eb", fontSize: 12, marginTop: 8 },
  salaryCard: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  label: { color: "#e0e7ff", fontSize: 12 },
  bigValue: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    color: "#fff",
    fontSize: 10,
  },
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
  progressBarFill: { height: 6, backgroundColor: "#4f46e5", borderRadius: 6 },
  goalProgress: { height: 6, backgroundColor: "#fb923c", borderRadius: 6 },
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