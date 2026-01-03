import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Award,
  FileText,
  Mail,
  Settings,
  Target,
  User,
  Zap,
} from "lucide-react-native";
import { onAuthStateChanged, signOut, updateEmail, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";
import { buildWorkerReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

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
  const [photoUrl, setPhotoUrl] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [photoInput, setPhotoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userHourlyRate, setUserHourlyRate] = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
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
        setPhotoUrl("");
        setUserId(null);
        return;
      }

      setUserId(user.uid);
      setEmail(user.email ?? "");
      if (user.displayName) setDisplayName(user.displayName);
      if (user.photoURL) setPhotoUrl(user.photoURL);

      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as { fullName?: string; photoUrl?: string; hourlyRate?: number } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
        if (data?.photoUrl) setPhotoUrl(data.photoUrl);
        if (data?.hourlyRate != null) setUserHourlyRate(Number(data.hourlyRate));
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

      const attendanceRef = collection(db, "users", user.uid, "attendance");
      const unsubAttendance = onSnapshot(attendanceRef, snapshot => {
        const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
        setAttendanceLogs(logs);
      });

      return () => {
        unsubProfile();
        unsubGoals();
        unsubAttendance();
      };
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const approvedLogs = attendanceLogs.filter(log => log.status === "approved");
    const totalHours = approvedLogs.reduce(
      (sum, item) => sum + Number(item.hours ?? 0),
      0
    );
    const totalDays = new Set(
      approvedLogs
        .filter(item => Number(item.hours ?? 0) > 0)
        .map(item => String(item.date ?? ""))
    ).size;
    setStats(prev => ({
      ...prev,
      totalHours,
      totalDays,
      totalEarnings: totalHours * userHourlyRate,
      overtimeHours: 0,
    }));
  }, [attendanceLogs, userHourlyRate]);

  const openEdit = () => {
    setNameInput(displayName);
    setEmailInput(email);
    setPhotoInput(photoUrl);
    setEditError("");
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!userId || !auth.currentUser) return;
    setSaving(true);
    setEditError("");

    try {
      const trimmedName = nameInput.trim();
      const trimmedEmail = emailInput.trim().toLowerCase();
      const trimmedPhoto = photoInput.trim();

      if (!trimmedName) {
        setEditError("Name is required");
        setSaving(false);
        return;
      }
      if (!trimmedEmail) {
        setEditError("Email is required");
        setSaving(false);
        return;
      }

      if (auth.currentUser.email !== trimmedEmail) {
        await updateEmail(auth.currentUser, trimmedEmail);
      }

      await updateProfile(auth.currentUser, {
        displayName: trimmedName,
        photoURL: trimmedPhoto || undefined,
      });

      await updateDoc(doc(db, "users", userId), {
        fullName: trimmedName,
        email: trimmedEmail,
        photoUrl: trimmedPhoto || "",
        updatedAt: new Date().toISOString(),
      });

      setDisplayName(trimmedName);
      setEmail(trimmedEmail);
      setPhotoUrl(trimmedPhoto);
      setEditOpen(false);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/requires-recent-login") {
        setEditError("Please log in again to change your email.");
      } else {
        setEditError("Failed to update profile. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!userId) return;
    const period = getPeriodKey(new Date());
    const userSnap = await getDoc(doc(db, "users", userId));
    const userData = userSnap.data() as any;
    const workerName =
      userData?.fullName || userData?.displayName || displayName || "Worker";
    const workerEmail = userData?.email || email || "-";

    const payrollSnap = await getDoc(
      doc(db, "users", userId, "payroll", period)
    );
    const payroll = payrollSnap.exists() ? (payrollSnap.data() as any) : null;

    const attendanceSnap = await getDocs(
      collection(db, "users", userId, "attendance")
    );
    const attendance = attendanceSnap.docs.map(docSnap => docSnap.data() as any);
    const approvedAttendance = attendance.filter(
      item => String(item.status ?? "") === "approved"
    );
    const totalHours = approvedAttendance.reduce(
      (sum, item) => sum + Number(item.hours ?? 0),
      0
    );
    const absenceDeductions = attendance.filter(
      item =>
        String(item.status ?? "") === "absent" &&
        String(item.date ?? "").startsWith(period)
    ).length;
    const derivedPayroll = {
      period,
      totalHours,
      overtimeHours: 0,
      totalEarnings: totalHours * userHourlyRate,
      absenceDeductions,
      status: "pending",
    };

    const html = buildWorkerReportHtml({
      worker: { name: workerName, email: workerEmail },
      period,
      payroll: payroll
        ? {
            period,
            totalHours: Number(payroll.totalHours ?? 0),
            overtimeHours: Number(payroll.overtimeHours ?? 0),
            totalEarnings: Number(payroll.totalEarnings ?? 0),
            absenceDeductions: Number(payroll.absenceDeductions ?? 0),
            status: payroll.status,
          }
        : derivedPayroll,
      attendance: approvedAttendance.map(item => ({
        date: String(item.date ?? ""),
        clockIn: item.clockIn,
        clockOut: item.clockOut,
        hours: Number(item.hours ?? 0),
        status: item.status,
      })),
    });
    await printReport(html);
  };

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
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Header */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.profileRow}>
            <View
              style={[
                styles.avatarWrap,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarFallback}>👤</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {displayName}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {email || "No email"}
              </Text>
            </View>
          </View>

          <View style={styles.profileMetaRow}>
            <View style={[styles.metaChip, { borderColor: colors.border }]}>
              <Award size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                Level 1
              </Text>
            </View>
            <View style={[styles.metaChip, { borderColor: colors.border }]}>
              <Zap size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                0 XP
              </Text>
            </View>
            <View style={[styles.metaChip, { borderColor: colors.border }]}>
              <Target size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {stats.goalsCount} Goals
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Statistics
          </Text>
          <View style={styles.statGrid}>
            {statsList.map(stat => (
              <View
                key={stat.label}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stat.value}
                </Text>
                <Text
                  style={[styles.statLabel, { color: colors.textMuted }]}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Badges */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Badges Earned
          </Text>
          {badges.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No badges yet</Text>
          ) : (
            <View style={styles.badgeGrid}>
              {badges.map(badge => (
                <View
                  key={badge.name}
                  style={[
                    styles.badgeCard,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={[styles.badgeName, { color: colors.text }]}>
                    {badge.name}
                  </Text>
                  <Text style={[styles.badgeDesc, { color: colors.textMuted }]}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Settings */}
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Settings
          </Text>

          <View style={styles.settingList}>
            <TouchableOpacity
              style={[
                styles.settingRow,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              onPress={openEdit}
            >
              <View style={styles.settingLeft}>
                <User size={18} color={colors.textMuted} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  Edit Profile
                </Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.settingRow,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <View style={styles.settingLeft}>
                <Mail size={18} color={colors.textMuted} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  Notifications
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.settingRow,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <View style={styles.settingLeft}>
                <Settings size={18} color={colors.textMuted} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  Preferences
                </Text>
              </View>
              <Switch
                value={mode === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.settingRow,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              onPress={handleGenerateReport}
            >
              <View style={styles.settingLeft}>
                <FileText size={18} color={colors.textMuted} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  Generate Report (PDF)
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Edit Profile */}
        {editOpen ? (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Edit Profile
            </Text>
            <View style={styles.formStack}>
              <View>
                <Text style={{ color: colors.textMuted, marginBottom: 6 }}>
                  Username
                </Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Full name"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              </View>
              <View>
                <Text style={{ color: colors.textMuted, marginBottom: 6 }}>
                  Email
                </Text>
                <TextInput
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              </View>
              <View>
                <Text style={{ color: colors.textMuted, marginBottom: 6 }}>
                  Profile Picture URL
                </Text>
                <TextInput
                  value={photoInput}
                  onChangeText={setPhotoInput}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              </View>
              {editError ? (
                <Text style={{ color: colors.danger }}>{editError}</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: "center",
                  }}
                  onPress={() => setEditOpen(false)}
                  disabled={saving}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: "600" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.accentStrong,
                    alignItems: "center",
                    opacity: saving ? 0.7 : 1,
                  }}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    {saving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={openEdit}
          >
            <Text style={{ color: colors.text, textAlign: "center", fontWeight: "600" }}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
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
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  safe: { flex: 1 },
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
  profileCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    alignItems: "center",
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  avatarImage: { width: 72, height: 72 },
  avatarFallback: { fontSize: 32 },
  profileName: { fontSize: 20, fontWeight: "700" },
  profileEmail: { marginTop: 4, fontSize: 12 },
  profileMetaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaText: { fontSize: 11, fontWeight: "600" },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: { fontWeight: "700", marginBottom: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: { fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: "center" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    width: "47%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  badgeIcon: { fontSize: 22 },
  badgeName: { fontWeight: "700", marginTop: 6 },
  badgeDesc: { fontSize: 11 },
  settingList: { gap: 12 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingText: { fontSize: 13 },
  formStack: { gap: 12 },
  actionButton: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
});
