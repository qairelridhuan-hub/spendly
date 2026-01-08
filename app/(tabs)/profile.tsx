import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Award, FileText, Mail, Sparkles, Target, User } from "lucide-react-native";
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
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
  StyleSheet,
  Alert,
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

function calcHours(start: string, end: string, breakMinutes = 0) {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const totalMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
  return totalMinutes / 60;
}

function calcBreakMinutes(start?: string, end?: string) {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, endMinutes - startMinutes);
}

function getLogHours(log: any) {
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes =
    Number(log.breakMinutes ?? 0) || calcBreakMinutes(log.breakStart, log.breakEnd);
  return calcHours(log.clockIn ?? "", log.clockOut ?? "", breakMinutes);
}

 

export default function ProfileScreen() {
  const { colors } = useTheme();
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
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [challengeCount, setChallengeCount] = useState(0);
  const [completedChallengeCount, setCompletedChallengeCount] = useState(0);
  const [config, setConfig] = useState({ overtimeRate: 0 });
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    totalHours: 0,
    totalEarnings: 0,
    goalsCompleted: 0,
    goalsCount: 0,
    overtimeHours: 0,
  });

  const confirmLogout = () => {
    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } finally {
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

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
      const challengeRef = collection(db, "users", user.uid, "challenges");
      const unsubChallenges = onSnapshot(challengeRef, snapshot => {
        const list = snapshot.docs.map(docSnap => docSnap.data() as any);
        const completed = list.filter(item => item?.completed).length;
        setChallengeCount(list.length);
        setCompletedChallengeCount(completed);
      });
      const overtimeRef = collection(db, "users", user.uid, "overtime");
      const unsubOvertime = onSnapshot(overtimeRef, snapshot => {
        const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
        setOvertimeLogs(logs);
      });
      const configRef = doc(db, "config", "system");
      const unsubConfig = onSnapshot(configRef, snap => {
        const data = snap.data() as any;
        if (data?.overtimeRate != null) {
          setConfig({ overtimeRate: Number(data.overtimeRate ?? 0) });
        }
      });

      return () => {
        unsubProfile();
        unsubGoals();
        unsubAttendance();
        unsubChallenges();
        unsubOvertime();
        unsubConfig();
      };
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const approvedLogs = attendanceLogs.filter(log => log.status === "approved");
    const totalHours = approvedLogs.reduce(
      (sum, item) => sum + getLogHours(item),
      0
    );
    const totalDays = new Set(
      approvedLogs
        .filter(item => getLogHours(item) > 0)
        .map(item => String(item.date ?? ""))
    ).size;
    const overtimeHours = overtimeLogs.reduce((sum, entry) => {
      const hours =
        Number(entry.hours ?? 0) ||
        calcHours(entry.startTime ?? "", entry.endTime ?? "", 0);
      return sum + hours;
    }, 0);
    setStats(prev => ({
      ...prev,
      totalHours: Number(totalHours.toFixed(1)),
      totalDays,
      totalEarnings: totalHours * userHourlyRate + overtimeHours * config.overtimeRate,
      overtimeHours: Number(overtimeHours.toFixed(1)),
    }));
  }, [attendanceLogs, overtimeLogs, userHourlyRate, config.overtimeRate]);

  const openEdit = () => {
    setNameInput(displayName);
    setEmailInput(email);
    setPhotoInput(photoUrl);
    setEditError("");
    setEditOpen(true);
  };

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
      if (!isValidEmail(trimmedEmail)) {
        setEditError("Enter a valid email address");
        setSaving(false);
        return;
      }
      if (trimmedPhoto && !/^https?:\/\//i.test(trimmedPhoto)) {
        setEditError("Photo URL must start with http:// or https://");
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

  const statsList = [
    { label: "Total Days Worked", value: String(stats.totalDays) },
    { label: "Total Hours", value: `${stats.totalHours}h` },
    { label: "Total Earnings", value: `RM ${stats.totalEarnings.toFixed(2)}` },
    { label: "Goals Completed", value: String(stats.goalsCompleted) },
    { label: "Challenges Completed", value: String(completedChallengeCount) },
  ];
  const xp = useMemo(() => {
    const approvedLogs = attendanceLogs.filter(log => log.status === "approved");
    const base =
      approvedLogs.length * 10 +
      stats.goalsCount * 20 +
      stats.goalsCompleted * 50 +
      completedChallengeCount * 30;
    return Math.max(0, base);
  }, [attendanceLogs, completedChallengeCount, stats.goalsCompleted, stats.goalsCount]);
  const { level, nextXp, progress } = useMemo(() => getLevelProgress(xp), [xp]);

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

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.badgeHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                Level Progress
              </Text>
            </View>
            <Text style={[styles.levelMeta, { color: colors.textMuted }]}>
              Level {level}
            </Text>
          </View>
          <Text style={[styles.levelHint, { color: colors.textMuted }]}>
            {xp} XP · {Math.max(0, nextXp - xp)} XP to level up
          </Text>
          <View style={[styles.levelTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.levelFill,
                { width: `${progress}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.badgeHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Awards & Badges
            </Text>
            <View style={[styles.badgeCount, { borderColor: colors.border }]}>
              <Text style={[styles.badgeCountText, { color: colors.textMuted }]}>
                {completedChallengeCount}/{challengeCount} earned
              </Text>
            </View>
          </View>
          <View style={styles.badgeGrid}>
            {buildBadgeList({
              goalsCompleted: stats.goalsCompleted,
              goalsCount: stats.goalsCount,
              completedChallenges: completedChallengeCount,
              streakDays: getConsecutiveStreakDays(attendanceLogs),
            }).map(badge => (
              <View
                key={badge.id}
                style={[
                  styles.badgeCard,
                  {
                    backgroundColor: badge.unlocked
                      ? colors.surfaceAlt
                      : colors.surface,
                    borderColor: badge.unlocked ? colors.accent : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: badge.unlocked
                        ? colors.accent
                        : colors.surfaceAlt,
                    },
                  ]}
                >
                  <Award size={14} color={badge.unlocked ? "#fff" : colors.textMuted} />
                </View>
                <Text style={[styles.badgeTitle, { color: colors.text }]}>
                  {badge.title}
                </Text>
                <Text style={[styles.badgeDesc, { color: colors.textMuted }]}>
                  {badge.description}
                </Text>
              </View>
            ))}
          </View>
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
          onPress={confirmLogout}
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
    backgroundColor: "rgba(183,243,77,0.14)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.6)",
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
  badgeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badgeCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeCountText: { fontSize: 11, fontWeight: "600" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: {
    width: "47%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  badgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badgeTitle: { fontSize: 13, fontWeight: "700" },
  badgeDesc: { fontSize: 11, marginTop: 4 },
  levelMeta: { fontSize: 12, fontWeight: "600" },
  levelHint: { fontSize: 12, marginBottom: 10 },
  levelTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  levelFill: {
    height: 8,
    borderRadius: 999,
  },
});

const getConsecutiveStreakDays = (logs: any[]) => {
  if (!logs.length) return 0;
  const dates = new Set(
    logs
      .filter(log => log?.date)
      .map(log => String(log.date).slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (!dates.has(d.toISOString().slice(0, 10))) break;
    streak += 1;
  }
  return streak;
};

const getLevelProgress = (xp: number) => {
  const levels = [0, 100, 250, 450, 700, 1000, 1400, 1900];
  let level = 1;
  for (let i = 0; i < levels.length; i += 1) {
    if (xp >= levels[i]) level = i + 1;
  }
  const currentFloor = levels[level - 1] ?? 0;
  const nextXp = levels[level] ?? (currentFloor + 600);
  const progress = Math.min(
    100,
    Math.round(((xp - currentFloor) / (nextXp - currentFloor)) * 100)
  );
  return { level, nextXp, progress };
};

const buildBadgeList = ({
  goalsCompleted,
  goalsCount,
  completedChallenges,
  streakDays,
}: {
  goalsCompleted: number;
  goalsCount: number;
  completedChallenges: number;
  streakDays: number;
}) => [
  {
    id: "first-goal",
    title: "Goal Starter",
    description: "Created your first goal",
    unlocked: goalsCount > 0,
  },
  {
    id: "goal-finished",
    title: "Goal Achieved",
    description: "Completed a savings goal",
    unlocked: goalsCompleted > 0,
  },
  {
    id: "streak-30",
    title: "30-Day Streak",
    description: "Logged shifts for 30 days",
    unlocked: streakDays >= 30,
  },
  {
    id: "challenge-winner",
    title: "Challenge Winner",
    description: "Completed a challenge",
    unlocked: completedChallenges > 0,
  },
];
