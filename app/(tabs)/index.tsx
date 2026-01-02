import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
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
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { useCalendar, useTheme } from "@/lib/context";

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
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState("User");
  /* =====================
     STATE
  ===================== */
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const { getTodayShift } = useCalendar();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

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
  const todayShift = getTodayShift();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setDisplayName("User");
        return;
      }
      if (user.displayName) setDisplayName(user.displayName);
      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as { fullName?: string } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
      });
      return () => unsubProfile();
    });

    return unsubscribe;
  }, []);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      router.replace("/(auth)/login");
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  /* =====================
     UI
  ===================== */
  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={styles.screen}
    >
      <View style={styles.bgBlob} />
      <View style={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* 🔝 HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>💰</Text>
            </View>

            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.greeting}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity>
              <Bell size={22} color="#0f172a" />
              <View style={styles.dot} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout}>
              <LogOut size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* 🔔 Notifications */}
            <LinearGradient
              colors={["#0f172a", "#1f2937"]}
              style={styles.notificationCard}
            >
              <View style={styles.row}>
                <Bell size={18} color="#e2e8f0" />
                <Text style={styles.notificationTitle}>Latest updates</Text>
              </View>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </LinearGradient>

            {/* 💰 Monthly Salary Summary */}
            <LinearGradient
              colors={["#0ea5e9", "#22c55e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.salarySummary}
            >
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
            </LinearGradient>

            {/* ⏰ Today Shift */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Today shift</Text>
                <Clock size={20} color="#0ea5e9" />
              </View>

              {todayShift ? (
                <>
                  <Text style={styles.shiftTitle}>{todayShift.role}</Text>
                  <Text style={styles.shiftMeta}>
                    {todayShift.start} - {todayShift.end} • {todayShift.location}
                  </Text>
                  <View style={styles.progressBarBg} />
                </>
              ) : (
                <>
                  <Text style={styles.smallText}>No shift scheduled today</Text>
                  <View style={styles.progressBarBg} />
                </>
              )}

              <View style={styles.row}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: isClockedIn ? "#ef4444" : "#22c55e" },
                    !todayShift && styles.disabledButton,
                  ]}
                  onPress={handleClockInOut}
                  disabled={!todayShift}
                >
                  <Text style={styles.buttonText}>
                    {isClockedIn ? "clock out" : "clock in"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, !todayShift && styles.disabledSecondary]}
                  onPress={handleBreak}
                  disabled={!todayShift}
                >
                  <Text style={styles.secondaryText}>break</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 🕒 Recent Activity */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent activity</Text>

              {events.length === 0 ? (
                <Text style={styles.smallText}>No activity yet</Text>
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
                  <Target size={20} color="#f97316" />
                  <Text style={styles.cardTitle}>Weekly goal</Text>
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
              <StatBox
                icon={<Clock size={16} color="#0ea5e9" />}
                label="hours"
                tone="#e0f2fe"
              />
              <StatBox
                icon={<DollarSign size={16} color="#22c55e" />}
                label="earnings"
                tone="#dcfce7"
              />
              <StatBox
                icon={<Target size={16} color="#f97316" />}
                label="goals"
                tone="#ffedd5"
              />
              <StatBox
                icon={<Zap size={16} color="#f59e0b" />}
                label="streak"
                tone="#fef3c7"
              />
            </View>

            {/* 🏆 Level */}
            <View style={styles.card}>
              <View style={styles.row}>
                <Award size={24} color="#eab308" />
                <View>
                  <Text style={styles.cardTitle}>Level —</Text>
                  <Text style={styles.smallText}>XP — / —</Text>
                </View>
              </View>
              <View style={styles.progressBarBg} />
            </View>

            {/* 🚀 Quick Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick actions</Text>

              <View style={styles.grid}>
                <ActionBox
                  icon={<Calendar size={20} color="#0f172a" />}
                  label="Calendar"
                  tone="#e2e8f0"
                  onPress={() => router.push("/(tabs)/calendar")}
                />
                <ActionBox
                  icon={<DollarSign size={20} color="#0f172a" />}
                  label="Earnings"
                  tone="#e2e8f0"
                  onPress={() => router.push("/(tabs)/earnings")}
                />
                <ActionBox
                  icon={<Target size={20} color="#0f172a" />}
                  label="Goals"
                  tone="#e2e8f0"
                  onPress={() => router.push("/(tabs)/goals")}
                />
                <ActionBox
                  icon={<User size={20} color="#0f172a" />}
                  label="Profile"
                  tone="#e2e8f0"
                  onPress={() => router.push("/(tabs)/profile")}
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* =====================
   SMALL COMPONENTS
===================== */

function StatBox({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: tone }]}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>—</Text>
    </View>
  );
}

function ActionBox({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBox, { backgroundColor: tone }]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: {
    padding: 16,
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

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 8,
    backgroundColor: "transparent",
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
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  greeting: { fontSize: 13, color: "#475569" },
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  notificationTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  emptyText: { color: "#94a3b8", fontSize: 12, marginTop: 8 },

  salarySummary: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  salaryTitle: { color: "#e2e8f0", fontSize: 14 },
  salaryAmount: { color: "#ffffff", fontSize: 30, fontWeight: "700" },
  salaryPill: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  salaryPillText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  salaryStatusIcon: { fontSize: 16, marginRight: 6 },
  salaryStatusText: { color: "#e2e8f0", fontSize: 13 },
  salaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 12,
  },
  salaryLabel: { color: "#e2e8f0", fontSize: 12 },
  salaryValue: { color: "#ffffff", fontSize: 16, fontWeight: "600" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  smallText: { fontSize: 12, color: "#64748b" },
  activityText: { fontSize: 12, color: "#334155", marginTop: 4 },
  shiftTitle: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  shiftMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },

  progressBarBg: {
    height: 6,
    backgroundColor: "#e2e8f0",
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
  buttonText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    marginLeft: 8,
    backgroundColor: "#f8fafc",
  },
  secondaryText: { color: "#0f172a", fontWeight: "600" },
  disabledButton: { opacity: 0.5 },
  disabledSecondary: { opacity: 0.5 },

  goalCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  goalBadge: {
    backgroundColor: "#fed7aa",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    width: "47%",
    borderRadius: 14,
    padding: 12,
  },
  statLabel: { fontSize: 12, color: "#475569", marginTop: 6 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#0f172a" },

  actionBox: {
    width: "47%",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  actionText: {
    marginTop: 6,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
});
