import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Award,
  Mail,
  Settings,
  Target,
  User,
  Zap,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";

type Stats = {
  totalDays: number;
  totalHours: number;
  totalEarnings: number;
  goalsCompleted: number;
  goalsCount: number;
  overtimeHours: number;
};

export default function ProfileScreen() {
  const { mode, toggleTheme, colors } = useTheme();
  const [displayName, setDisplayName] = useState("User");
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    totalHours: 0,
    totalEarnings: 0,
    goalsCompleted: 0,
    goalsCount: 0,
    overtimeHours: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setDisplayName("User");
        setEmail("");
        return;
      }

      setEmail(user.email ?? "");
      if (user.displayName) setDisplayName(user.displayName);

      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as { fullName?: string } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
      });

      const goalsRef = collection(db, "users", user.uid, "goals");
      const unsubGoals = onSnapshot(goalsRef, snapshot => {
        const goals = snapshot.docs.map(docSnap => docSnap.data() as any);
        const completed = goals.filter(
          goal => Number(goal.savedAmount ?? 0) >= Number(goal.targetAmount ?? 0)
        ).length;
        setStats(prev => ({
          ...prev,
          goalsCount: goals.length,
          goalsCompleted: completed,
        }));
      });

      const earningsRef = collection(db, "users", user.uid, "earnings");
      const unsubEarnings = onSnapshot(earningsRef, snapshot => {
        const earnings = snapshot.docs.map(docSnap => docSnap.data() as any);
        const totalEarnings = earnings.reduce(
          (sum, item) => sum + Number(item.amount ?? 0),
          0
        );
        const totalHours = earnings.reduce(
          (sum, item) => sum + Number(item.hours ?? 0),
          0
        );
        const totalDays = earnings.reduce(
          (sum, item) => sum + Number(item.days ?? 0),
          0
        );
        const overtimeHours = earnings.reduce(
          (sum, item) => sum + Number(item.overtimeHours ?? 0),
          0
        );

        setStats(prev => ({
          ...prev,
          totalEarnings,
          totalHours,
          totalDays,
          overtimeHours,
        }));
      });

      return () => {
        unsubProfile();
        unsubGoals();
        unsubEarnings();
      };
    });

    return unsubscribe;
  }, []);

  const badges = useMemo(() => {
    const list: { name: string; icon: string; description: string }[] = [];
    if (stats.goalsCount > 0) {
      list.push({
        name: "Goal Starter",
        icon: "🎯",
        description: "Created first goal",
      });
    }
    if (stats.overtimeHours >= 5) {
      list.push({
        name: "Overtime Hero",
        icon: "⚡",
        description: "Completed overtime shifts",
      });
    }
    if (stats.totalDays >= 10) {
      list.push({
        name: "Streak Master",
        icon: "🔥",
        description: "10-day work streak",
      });
    }
    if (stats.totalHours >= 40) {
      list.push({
        name: "Early Bird",
        icon: "🌅",
        description: "Clocked in early 5 times",
      });
    }
    return list;
  }, [stats]);

  const statsList = [
    { label: "Total Days Worked", value: String(stats.totalDays) },
    { label: "Total Hours", value: `${stats.totalHours}h` },
    { label: "Total Earnings", value: `RM ${stats.totalEarnings.toFixed(2)}` },
    { label: "Goals Completed", value: String(stats.goalsCompleted) },
  ];

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Profile Header */}
        <LinearGradient
          colors={[colors.accent, colors.accentStrong]}
          style={{
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 32 }}>👤</Text>
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
                {displayName}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                {email || "No email"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Award size={18} color="#fde68a" />
              <Text style={{ color: "#fff", fontSize: 12 }}>Level 1</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Zap size={18} color="#fdba74" />
              <Text style={{ color: "#fff", fontSize: 12 }}>0 XP</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Target size={18} color="#86efac" />
              <Text style={{ color: "#fff", fontSize: 12 }}>
                {stats.goalsCount} Goals
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Statistics
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {statsList.map(stat => (
              <View
                key={stat.label}
                style={{
                  width: "47%",
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {stat.value}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Badges */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Badges Earned
          </Text>
          {badges.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No badges yet</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {badges.map(badge => (
                <View
                  key={badge.name}
                  style={{
                    width: "47%",
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: 14,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{badge.icon}</Text>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      marginTop: 6,
                    }}
                  >
                    {badge.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Settings */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Settings
          </Text>

          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <User size={18} color={colors.textMuted} />
                <Text style={{ color: colors.text }}>Edit Profile</Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Mail size={18} color={colors.textMuted} />
                <Text style={{ color: colors.text }}>Notifications</Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Settings size={18} color={colors.textMuted} />
                <Text style={{ color: colors.text }}>Preferences</Text>
              </View>
              <Switch
                value={mode === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          onPress={async () => {
            try {
              await signOut(auth);
            } finally {
              router.replace("/(auth)/login");
            }
          }}
        >
          <Text style={{ color: colors.danger, textAlign: "center", fontWeight: "600" }}>
            Logout
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}
