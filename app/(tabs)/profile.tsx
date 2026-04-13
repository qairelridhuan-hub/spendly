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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";
import { buildWorkerReportHtml, getPeriodKey } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import {
  getBaseXp,
  getConsecutiveStreakDays,
  getLevelProgress,
  getTotalXp,
} from "@/lib/game/stats";
import { cardShadow } from "@/lib/shadows";

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
  const scrollRef = useRef<ScrollView>(null);
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
  const [arcadeState, setArcadeState] = useState<{ totalXp?: number; bonusXp?: number } | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

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
        setArcadeState(null);
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
      const arcadeRef = doc(db, "users", user.uid, "arcade", "state");
      const unsubArcade = onSnapshot(arcadeRef, snap => {
        if (!snap.exists()) {
          setArcadeState(null);
          return;
        }
        const data = snap.data() as any;
        setArcadeState({
          totalXp: Number(data.totalXp ?? 0),
          bonusXp: Number(data.bonusXp ?? 0),
        });
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
        unsubArcade();
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
      // Subtract overtime from total so it isn't double-charged at the regular rate
      totalEarnings: (totalHours - overtimeHours) * userHourlyRate + overtimeHours * config.overtimeRate,
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
  const approvedLogsCount = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved").length,
    [attendanceLogs]
  );
  const baseXp = useMemo(
    () =>
      getBaseXp({
        approvedLogsCount,
        goalsCount: stats.goalsCount,
        completedGoalsCount: stats.goalsCompleted,
        completedChallengesCount: completedChallengeCount,
      }),
    [approvedLogsCount, completedChallengeCount, stats.goalsCompleted, stats.goalsCount]
  );
  const xp = useMemo(
    () =>
      getTotalXp({
        baseXp,
        bonusXp: arcadeState?.bonusXp ?? 0,
        storedTotalXp: arcadeState?.totalXp,
      }),
    [arcadeState?.bonusXp, arcadeState?.totalXp, baseXp]
  );
  const { level, nextXp, progress } = useMemo(() => getLevelProgress(xp), [xp]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* ── HEADER ── */}
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Profile</Text>
          </View>

          {/* ── PROFILE CARD ── */}
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatarWrap}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{email || "No email"}</Text>
                <View style={styles.profileMetaRow}>
                  <View style={styles.metaChip}>
                    <Target size={12} color="#6b7280" />
                    <Text style={styles.metaText}>{stats.goalsCount} Goals</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Sparkles size={12} color="#6b7280" />
                    <Text style={styles.metaText}>Lv {level}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.editAvatarBtn} onPress={openEdit}>
                <User size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── STATS ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>STATISTICS</Text>
            <View style={styles.statGrid}>
              {statsList.map(stat => (
                <View key={stat.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── LEVEL PROGRESS ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={15} color="#111827" />
                <Text style={styles.sectionLabel}>LEVEL PROGRESS</Text>
              </View>
              <Text style={styles.levelBadge}>Level {level}</Text>
            </View>
            <Text style={styles.levelHint}>{xp} XP · {Math.max(0, nextXp - xp)} XP to next level</Text>
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${progress}%` }]} />
            </View>
          </View>

          {/* ── BADGES ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>AWARDS & BADGES</Text>
              <View style={styles.badgeCountChip}>
                <Text style={styles.badgeCountText}>{completedChallengeCount}/{challengeCount} earned</Text>
              </View>
            </View>
            <View style={styles.badgeGrid}>
              {buildBadgeList({
                goalsCompleted: stats.goalsCompleted,
                goalsCount: stats.goalsCount,
                completedChallenges: completedChallengeCount,
                streakDays: getConsecutiveStreakDays(attendanceLogs),
              }).map(badge => (
                <View key={badge.id} style={[styles.badgeCard, badge.unlocked && styles.badgeCardUnlocked]}>
                  <View style={[styles.badgeIcon, badge.unlocked && styles.badgeIconUnlocked]}>
                    <Award size={14} color={badge.unlocked ? "#ffffff" : "#9ca3af"} />
                  </View>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── SETTINGS ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>SETTINGS</Text>
            <View style={styles.settingList}>
              <TouchableOpacity style={styles.settingRow} onPress={openEdit}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconWrap}><User size={16} color="#111827" /></View>
                  <Text style={styles.settingText}>Edit Profile</Text>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconWrap}><Mail size={16} color="#111827" /></View>
                  <Text style={styles.settingText}>Notifications</Text>
                </View>
              </View>
              <View style={styles.settingDivider} />
              <TouchableOpacity style={styles.settingRow} onPress={handleGenerateReport}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIconWrap}><FileText size={16} color="#111827" /></View>
                  <Text style={styles.settingText}>Generate Report (PDF)</Text>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── EDIT PROFILE FORM ── */}
          {editOpen && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>EDIT PROFILE</Text>
              <View style={styles.formStack}>
                <View>
                  <Text style={styles.fieldLabel}>Username</Text>
                  <TextInput value={nameInput} onChangeText={setNameInput} placeholder="Full name" placeholderTextColor="#9ca3af" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput value={emailInput} onChangeText={setEmailInput} placeholder="Email address" placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Profile Picture URL</Text>
                  <TextInput value={photoInput} onChangeText={setPhotoInput} placeholder="https://..." placeholderTextColor="#9ca3af" autoCapitalize="none" style={styles.input} />
                </View>
                {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditOpen(false)} disabled={saving}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]} onPress={handleSaveProfile} disabled={saving}>
                    <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── LOGOUT ── */}
          <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  safe: { flex: 1 },
  container: { padding: 16, paddingTop: 8, paddingBottom: 120 },

  pageHeader: { marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#111827" },

  /* Profile Card */
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...cardShadow,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: "hidden" },
  avatarImage: { width: 64, height: 64 },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#f0f0f0",
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontSize: 26, fontWeight: "700", color: "#111827" },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  profileEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  profileMetaRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f5f5f5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  metaText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  editAvatarBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e5e7eb",
  },

  /* Section Card */
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...cardShadow,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, marginBottom: 14,
  },
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },

  /* Stats */
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47%", backgroundColor: "#f9f9f9",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#f0f0f0",
    alignItems: "center",
    ...cardShadow,
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "center" },

  /* Level */
  levelBadge: {
    backgroundColor: "#111827", color: "#ffffff",
    fontSize: 11, fontWeight: "700",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  levelHint: { fontSize: 12, color: "#6b7280", marginBottom: 10 },
  levelTrack: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden" },
  levelFill: { height: 6, backgroundColor: "#111827", borderRadius: 999 },

  /* Badges */
  badgeCountChip: {
    backgroundColor: "#f5f5f5", paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 999,
  },
  badgeCountText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "47%", backgroundColor: "#f9f9f9",
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#f0f0f0",
    ...cardShadow,
  },
  badgeCardUnlocked: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  badgeIcon: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  badgeIconUnlocked: { backgroundColor: "#111827" },
  badgeTitle: { fontSize: 12, fontWeight: "700", color: "#111827" },
  badgeDesc: { fontSize: 11, color: "#6b7280", marginTop: 3 },

  /* Settings */
  settingList: {},
  settingRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 12,
  },
  settingDivider: { height: 1, backgroundColor: "#f0f0f0" },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center",
  },
  settingText: { fontSize: 14, color: "#111827", fontWeight: "500" },
  settingArrow: { fontSize: 20, color: "#9ca3af", lineHeight: 22 },

  /* Edit Form */
  formStack: { gap: 12 },
  fieldLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 12, padding: 12,
    color: "#111827", backgroundColor: "#f9f9f9", fontSize: 14,
  },
  errorText: { color: "#ef4444", fontSize: 12 },
  cancelBtn: {
    flex: 1, padding: 13, borderRadius: 12,
    backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center",
  },
  cancelBtnText: { color: "#6b7280", fontWeight: "600" },
  saveBtn: {
    flex: 1, padding: 13, borderRadius: 12,
    backgroundColor: "#111827", alignItems: "center",
  },
  saveBtnText: { color: "#ffffff", fontWeight: "700" },

  /* Logout */
  logoutBtn: {
    padding: 14, borderRadius: 14,
    backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fecdd3",
    alignItems: "center", marginBottom: 16,
  },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 14 },
});

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
