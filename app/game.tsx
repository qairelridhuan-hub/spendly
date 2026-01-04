import { useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  Coins,
  Flame,
  Gamepad2,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { AnimatedBlobs } from "../components/AnimatedBlobs";
import { useTheme } from "../lib/context";
import { auth, db } from "../lib/firebase";

type Challenge = {
  id: string;
  title: string;
  description: string;
  unit: "RM" | "shifts" | "days";
  target: number;
  progress: number;
  rewardXp: number;
  rewardCoins: number;
  startDate: string;
  endDate: string;
  completed: boolean;
  meta?: Record<string, any>;
};

type Badge = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  createdAt: string;
  deadline: string;
};

export default function GameScreen() {
  const { colors } = useTheme();
  const neon = {
    bgStart: "#1a0033",
    bgEnd: "#080014",
    surface: "#0b1020",
    surfaceSoft: "#121b2f",
    text: "#e2e8f0",
    muted: "#94a3b8",
    accent: "#22d3ee",
    accentAlt: "#f472b6",
    lime: "#a3e635",
    border: "rgba(56, 189, 248, 0.4)",
  };
  const [userId, setUserId] = useState<string | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgetAllocation, setBudgetAllocation] = useState<
    { category: string; amount: number }[]
  >([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userHourlyRate, setUserHourlyRate] = useState(0);
  const [workConfig, setWorkConfig] = useState({
    hourlyRate: 0,
    overtimeRate: 0,
  });
  const [showDebug, setShowDebug] = useState(false);
  const [showChallengesDetails, setShowChallengesDetails] = useState(false);
  const [showBadgesDetails, setShowBadgesDetails] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setAttendanceLogs([]);
      return;
    }
    const attendanceRef = collection(db, "users", userId, "attendance");
    const unsub = onSnapshot(attendanceRef, snap => {
      const logs = snap.docs.map(docSnap => docSnap.data() as any);
      setAttendanceLogs(logs);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      return;
    }
    const goalsRef = collection(db, "users", userId, "goals");
    const unsub = onSnapshot(goalsRef, snap => {
      const list = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      setGoals(list as Goal[]);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBudgetAllocation([]);
      setUserHourlyRate(0);
      return;
    }
    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(userRef, snap => {
      const data = snap.data() as any;
      if (Array.isArray(data?.budgetAllocation)) {
        setBudgetAllocation(
          data.budgetAllocation
            .filter((item: any) => item && item.category && item.amount != null)
            .map((item: any) => ({
              category: String(item.category),
              amount: Number(item.amount ?? 0),
            }))
        );
      } else {
        setBudgetAllocation([]);
      }
      if (data?.hourlyRate != null) {
        setUserHourlyRate(Number(data.hourlyRate));
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    const configRef = doc(db, "config", "system");
    const unsub = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setWorkConfig({
        hourlyRate: Number(data.hourlyRate ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setChallenges([]);
      return;
    }
    const challengeRef = collection(db, "users", userId, "challenges");
    const unsub = onSnapshot(challengeRef, snap => {
      const list = snap.docs.map(docSnap => docSnap.data() as Challenge);
      setChallenges(list);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: true,
      })
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmer]);

  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const activeGoals = useMemo(
    () => goals.filter(goal => goal.targetAmount > goal.savedAmount),
    [goals]
  );
  const completedGoals = useMemo(
    () => goals.filter(goal => goal.savedAmount >= goal.targetAmount),
    [goals]
  );
  const hourlyRate = userHourlyRate || workConfig.hourlyRate;

  const streakDays = useMemo(
    () => getConsecutiveStreakDays(attendanceLogs),
    [attendanceLogs]
  );
  const weeklyShiftCount = useMemo(
    () => getWeeklyShiftCount(attendanceLogs),
    [attendanceLogs]
  );
  const monthlyEarnings = useMemo(
    () => getMonthlyEarnings(approvedLogs, hourlyRate),
    [approvedLogs, hourlyRate]
  );

  const generatedChallenges = useMemo(
    () =>
      buildChallenges({
        goals,
        activeGoals,
        streakDays,
        weeklyShiftCount,
      }),
    [goals, activeGoals, streakDays, weeklyShiftCount]
  );

  const displayChallenges =
    challenges.length > 0 ? mergeProgress(challenges, generatedChallenges) : generatedChallenges;

  useEffect(() => {
    if (!userId) return;
    displayChallenges.forEach(({ meta, ...challenge }) => {
      const payload = meta ? { ...challenge, meta } : challenge;
      const ref = doc(db, "users", userId, "challenges", challenge.id);
      setDoc(ref, payload, { merge: true });
    });
  }, [userId, displayChallenges]);

  const badges: Badge[] = useMemo(() => {
    const allocationTotal = budgetAllocation.reduce((sum, item) => sum + item.amount, 0);
    const hasBudget = allocationTotal > 0;
    const underBudget = allocationTotal > 0 && monthlyEarnings >= allocationTotal;
    const hasChallengeWin = displayChallenges.some(ch => ch.completed);

    return [
      {
        id: "budget-first",
        title: "First Budget",
        description: "Created your first budget",
        unlocked: hasBudget,
      },
      {
        id: "goal-first",
        title: "Goal Achieved",
        description: "Completed your first savings goal",
        unlocked: completedGoals.length > 0,
      },
      {
        id: "streak-30",
        title: "30-Day Streak",
        description: "Logged shifts for 30 days",
        unlocked: streakDays >= 30,
      },
      {
        id: "under-budget",
        title: "Under Budget",
        description: "Stayed within your monthly budget",
        unlocked: underBudget,
      },
      {
        id: "challenge-winner",
        title: "Challenge Winner",
        description: "Completed a challenge",
        unlocked: hasChallengeWin,
      },
    ];
  }, [budgetAllocation, completedGoals.length, displayChallenges, monthlyEarnings, streakDays]);

  const xp = useMemo(() => {
    const base =
      approvedLogs.length * 10 +
      goals.length * 20 +
      completedGoals.length * 50 +
      displayChallenges.filter(ch => ch.completed).length * 30;
    return Math.max(0, base);
  }, [approvedLogs.length, completedGoals.length, displayChallenges, goals.length]);

  const { level, nextXp, progress } = useMemo(() => getLevelProgress(xp), [xp]);
  const coins = Math.floor(xp / 5);

  return (
    <LinearGradient
      colors={[neon.bgStart, neon.bgEnd]}
      style={styles.screen}
    >
      <ArcadeFloaters />
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={neon.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: neon.text }]}>Arcade</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={["#22d3ee", "#a855f7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <Star size={18} color="#ffffff" />
                <Text style={styles.heroTitle}>Level {level}</Text>
              </View>
              <View style={styles.heroPill}>
                <Coins size={14} color="#0f172a" />
                <Text style={styles.heroPillText}>{coins} coins</Text>
              </View>
            </View>
            <Text style={styles.heroSub}>
              {xp} XP · {nextXp - xp} XP to level up
            </Text>
            <View
              style={styles.heroTrack}
              onLayout={event => setProgressWidth(event.nativeEvent.layout.width)}
            >
              <View style={[styles.heroFill, { width: `${progress}%` }]} />
              {progressWidth > 0 ? (
                <Animated.View
                  style={[
                    styles.heroShimmer,
                    {
                      transform: [
                        {
                          translateX: shimmer.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-60, progressWidth],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.heroHintRow}>
              <Sparkles size={14} color="#ecfeff" />
              <Text style={styles.heroHint}>Next unlock: Advanced insights</Text>
            </View>
          </LinearGradient>

          <View style={styles.debugToggleRow}>
            <Text style={styles.debugLabel}>Debug data</Text>
            <TouchableOpacity
              style={[
                styles.debugToggle,
                showDebug && styles.debugToggleActive,
              ]}
              onPress={() => setShowDebug(prev => !prev)}
            >
              <Text style={styles.debugToggleText}>
                {showDebug ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>

          {showDebug ? (
            <View style={[styles.card, { backgroundColor: "#0b1020", borderColor: "rgba(56, 189, 248, 0.35)" }]}>
              <Text style={[styles.cardTitle, { color: "#e2e8f0" }]}>Debug snapshot</Text>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>User ID</Text>
                <Text style={styles.debugValue}>{userId ?? "-"}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Attendance logs</Text>
                <Text style={styles.debugValue}>{attendanceLogs.length}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Approved logs</Text>
                <Text style={styles.debugValue}>{approvedLogs.length}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Goals</Text>
                <Text style={styles.debugValue}>{goals.length}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Active goals</Text>
                <Text style={styles.debugValue}>{activeGoals.length}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Budget items</Text>
                <Text style={styles.debugValue}>{budgetAllocation.length}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Hourly rate</Text>
                <Text style={styles.debugValue}>RM {hourlyRate.toFixed(2)}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Monthly earnings</Text>
                <Text style={styles.debugValue}>RM {monthlyEarnings.toFixed(2)}</Text>
              </View>
              <View style={styles.debugRow}>
                <Text style={styles.debugKey}>Challenges</Text>
                <Text style={styles.debugValue}>{displayChallenges.length}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionRow}>
            <View style={[styles.miniCard, { backgroundColor: neon.surface, borderColor: neon.border }]}>
              <View style={styles.row}>
                <Flame size={18} color={neon.accentAlt} />
                <Text style={[styles.cardTitle, { color: neon.text }]}>
                  {streakDays} day streak
                </Text>
              </View>
              <Text style={[styles.cardHint, { color: neon.muted }]}>
                Keep logging shifts daily
              </Text>
            </View>
            <View style={[styles.miniCard, { backgroundColor: neon.surface, borderColor: neon.border }]}>
              <View style={styles.row}>
                <Gamepad2 size={18} color={neon.accent} />
                <Text style={[styles.cardTitle, { color: neon.text }]}>
                  {weeklyShiftCount} shifts this week
                </Text>
              </View>
              <Text style={[styles.cardHint, { color: neon.muted }]}>
                Stay consistent
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: neon.surface, borderColor: neon.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.row}>
                <Target size={18} color={neon.lime} />
                <Text style={[styles.cardTitle, { color: neon.text }]}>Challenges</Text>
              </View>
              <TouchableOpacity
                style={styles.sectionPill}
                onPress={() => setShowChallengesDetails(true)}
              >
                <Text style={styles.sectionPillText}>View details</Text>
              </TouchableOpacity>
            </View>
            {displayChallenges.map(challenge => {
              const percent = challenge.target === 0
                ? 0
                : Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
              return (
                <View key={challenge.id} style={styles.challengeRow}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.challengeTitle, { color: neon.text }]}>
                      {challenge.title}
                    </Text>
                    <Text style={[styles.cardHint, { color: neon.muted }]}>
                      {challenge.description}
                    </Text>
                  </View>
                  <View style={styles.rewardRow}>
                    {challenge.completed ? (
                      <Animated.View style={[styles.completedPill, { transform: [{ scale: pulse }] }]}>
                        <Sparkles size={12} color="#16a34a" />
                        <Text style={styles.completedText}>Completed</Text>
                      </Animated.View>
                    ) : null}
                    <View style={styles.rewardPill}>
                      <Trophy size={14} color="#f59e0b" />
                      <Text style={styles.rewardText}>+{challenge.rewardXp} XP</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percent}%`, backgroundColor: challenge.completed ? "#22c55e" : neon.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: neon.muted }]}>
                  {challenge.progress} / {challenge.target} {challenge.unit}
                </Text>
              </View>
            );
          })}
        </View>

          <View style={[styles.card, { backgroundColor: neon.surface, borderColor: neon.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.row}>
                <Medal size={18} color={neon.accentAlt} />
                <Text style={[styles.cardTitle, { color: neon.text }]}>Badges</Text>
              </View>
              <TouchableOpacity
                style={styles.sectionPill}
                onPress={() => setShowBadgesDetails(true)}
              >
                <Text style={styles.sectionPillText}>
                  View details
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.badgeGrid}>
              {badges.map(badge => (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: badge.unlocked
                        ? "rgba(34, 197, 94, 0.18)"
                        : neon.surfaceSoft,
                      borderColor: badge.unlocked
                        ? "rgba(34, 197, 94, 0.6)"
                        : neon.border,
                    },
                  ]}
                >
                  <View style={styles.badgeIcon}>
                    <Medal size={14} color={badge.unlocked ? neon.lime : neon.muted} />
                  </View>
                  <Text style={[styles.badgeTitle, { color: neon.text }]}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.badgeDesc, { color: neon.muted }]}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: neon.surface, borderColor: neon.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.row}>
                <Sparkles size={18} color={neon.accentAlt} />
                <Text style={[styles.cardTitle, { color: neon.text }]}>Unlocks</Text>
              </View>
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>Perks</Text>
              </View>
            </View>
            <View style={styles.unlockList}>
              {getUnlocks(level).map(item => (
                <View key={item.title} style={styles.unlockItem}>
                  <Text style={[styles.unlockTitle, { color: neon.text }]}>{item.title}</Text>
                  <Text style={[styles.cardHint, { color: neon.muted }]}>{item.note}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {showChallengesDetails ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Challenge Details</Text>
                <TouchableOpacity onPress={() => setShowChallengesDetails(false)}>
                  <Text style={styles.modalClose}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSectionTitle}>Current challenges</Text>
                {displayChallenges.map(challenge => (
                  <View key={`${challenge.id}-detail`} style={styles.modalItem}>
                    <Text style={styles.modalItemTitle}>{challenge.title}</Text>
                    <Text style={styles.modalItemSub}>{challenge.description}</Text>
                    <Text style={styles.modalItemSub}>
                      Target: {challenge.target} {challenge.unit}
                    </Text>
                    <Text style={styles.modalItemSub}>
                      Reward: +{challenge.rewardXp} XP · {challenge.rewardCoins} coins
                    </Text>
                    <Text style={styles.modalItemSub}>
                      Status: {challenge.completed ? "Completed" : "In progress"}
                    </Text>
                  </View>
                ))}
                <Text style={styles.modalSectionTitle}>More challenges to unlock</Text>
                {challengeCatalog
                  .filter(item => !displayChallenges.find(ch => ch.id === item.id))
                  .map(item => (
                    <View key={`${item.id}-locked`} style={styles.modalItem}>
                      <Text style={styles.modalItemTitle}>{item.title}</Text>
                      <Text style={styles.modalItemSub}>{item.description}</Text>
                      <Text style={styles.modalItemSub}>Requirement: {item.requirement}</Text>
                    </View>
                  ))}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {showBadgesDetails ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Badge Details</Text>
                <TouchableOpacity onPress={() => setShowBadgesDetails(false)}>
                  <Text style={styles.modalClose}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
                {badges.map(badge => (
                  <View key={`${badge.id}-detail`} style={styles.modalItem}>
                    <Text style={styles.modalItemTitle}>{badge.title}</Text>
                    <Text style={styles.modalItemSub}>{badge.description}</Text>
                    <Text style={styles.modalItemSub}>
                      Status: {badge.unlocked ? "Unlocked" : "Locked"}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 24, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 36 },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: "#ffffff" },
  heroSub: { fontSize: 12, color: "#ecfeff" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  heroPillText: { fontSize: 11, fontWeight: "700", color: "#0f172a" },
  heroTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  heroFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  heroShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  heroHintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroHint: { fontSize: 12, color: "#ecfeff" },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  miniCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardHint: { fontSize: 12 },
  statValue: { fontSize: 14, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34, 211, 238, 0.2)",
  },
  sectionPillText: { fontSize: 11, fontWeight: "700", color: "#e2e8f0" },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.25)",
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 999 },
  sectionRow: { flexDirection: "row", gap: 12 },
  challengeRow: { gap: 6 },
  challengeTitle: { fontSize: 14, fontWeight: "700" },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(244, 114, 182, 0.2)",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rewardText: { fontSize: 11, fontWeight: "700", color: "#fdf2f8" },
  completedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(163, 230, 53, 0.22)",
  },
  completedText: { fontSize: 11, fontWeight: "700", color: "#ecfccb" },
  progressLabel: { fontSize: 11 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "48%",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  badgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    marginBottom: 6,
  },
  badgeTitle: { fontSize: 13, fontWeight: "700" },
  badgeDesc: { fontSize: 11, marginTop: 4 },
  unlockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  unlockText: { fontSize: 12 },
  unlockList: { gap: 10 },
  unlockItem: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  unlockTitle: { fontSize: 13, fontWeight: "700" },
  bgBlob: { opacity: 0.22 },
  bgBlobAlt: { opacity: 0.18 },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#0b1020",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#e2e8f0" },
  modalClose: { fontSize: 12, fontWeight: "700", color: "#22d3ee" },
  modalList: { gap: 12, paddingBottom: 12 },
  modalItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
  },
  modalItemTitle: { fontSize: 13, fontWeight: "700", color: "#e2e8f0" },
  modalItemSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  modalSectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#a5b4fc",
  },
  debugToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  debugLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "700" },
  debugToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  debugToggleActive: {
    backgroundColor: "rgba(34, 211, 238, 0.3)",
  },
  debugToggleText: { fontSize: 12, fontWeight: "700", color: "#e2e8f0" },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  debugKey: { fontSize: 12, color: "#94a3b8" },
  debugValue: { fontSize: 12, color: "#e2e8f0", fontWeight: "700" },
  floaters: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floater: { position: "absolute" },
  floaterCircle: {
    borderRadius: 999,
    borderWidth: 1,
  },
  floaterSquare: {
    borderRadius: 4,
    borderWidth: 1,
  },
  floaterRounded: {
    borderRadius: 12,
    borderWidth: 1,
  },
  floaterPill: {
    borderRadius: 999,
    borderWidth: 1,
  },
  floaterTriangle: {
    width: 0,
    height: 0,
    borderStyle: "solid",
    backgroundColor: "transparent",
  },
  floaterLShape: {
    borderRadius: 8,
    borderWidth: 1,
    position: "relative",
  },
  floaterLArm: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: 1,
  },
  floaterController: {
    borderRadius: 8,
    borderWidth: 1,
  },
  floaterDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#38bdf8",
  },
});

const ArcadeFloaters = () => {
  const { width, height } = Dimensions.get("window");
  const items = useRef(
    Array.from({ length: 18 }).map((_, index) => {
      const size = 12 + (index % 5) * 7;
      const type =
        index % 5 === 0
          ? "circle"
          : index % 5 === 1
          ? "rounded"
          : index % 5 === 2
          ? "pill"
          : index % 5 === 3
          ? "lshape"
          : "square";
      return {
        id: `floater-${index}`,
        size,
        type,
        color:
          index % 4 === 0
            ? "#38bdf8"
            : index % 4 === 1
            ? "#f472b6"
            : index % 4 === 2
            ? "#facc15"
            : "#22d3ee",
        opacity: 0.18 + (index % 4) * 0.07,
        translate: new Animated.ValueXY({
          x: Math.random() * (width - size),
          y: Math.random() * (height - size),
        }),
        rotation: new Animated.Value(Math.random() * 360),
      };
    })
  ).current;

  const iconItems = useRef(
    Array.from({ length: 6 }).map((_, index) => {
      const size = 18 + (index % 3) * 7;
      const type = index % 2 === 0 ? "coin" : "controller";
      return {
        id: `icon-${index}`,
        size,
        type,
        color: index % 2 === 0 ? "#22d3ee" : "#38bdf8",
        opacity: 0.2,
        translate: new Animated.ValueXY({
          x: Math.random() * (width - size),
          y: Math.random() * (height - size),
        }),
        rotation: new Animated.Value(Math.random() * 360),
      };
    })
  ).current;

  useEffect(() => {
    const animate = (item: { translate: Animated.ValueXY; rotation: Animated.Value; size: number }) => {
      const margin = 16;
      const nextX = Math.max(
        margin,
        Math.min(width - item.size - margin, Math.random() * (width - item.size))
      );
      const nextY = Math.max(
        margin,
        Math.min(height - item.size - margin, Math.random() * (height - item.size))
      );
      const nextRotation = Math.random() * 360;
      Animated.timing(item.translate, {
        toValue: { x: nextX, y: nextY },
        duration: 8000 + Math.random() * 6000,
        useNativeDriver: true,
      }).start(() => animate(item));
      Animated.timing(item.rotation, {
        toValue: nextRotation,
        duration: 9000 + Math.random() * 6000,
        useNativeDriver: true,
      }).start();
    };

    items.forEach(item => animate(item));
    iconItems.forEach(item => animate(item));
  }, [height, iconItems, items, width]);

  return (
    <View pointerEvents="none" style={styles.floaters}>
      {items.map(item => {
        const rotation = item.rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ["0deg", "360deg"],
        });
        const commonStyle = [
          styles.floater,
          {
            opacity: item.opacity,
            transform: [...item.translate.getTranslateTransform(), { rotate: rotation }],
          },
        ];

        if (item.type === "triangle") {
          return (
            <Animated.View key={item.id} style={commonStyle}>
              <View
                style={[
                  styles.floaterTriangle,
                  {
                    borderLeftWidth: item.size / 2,
                    borderRightWidth: item.size / 2,
                    borderBottomWidth: item.size,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderBottomColor: item.color,
                  },
                ]}
              />
            </Animated.View>
          );
        }

        if (item.type === "lshape") {
          return (
            <Animated.View key={item.id} style={commonStyle}>
              <View
                style={[
                  styles.floaterLShape,
                  {
                    width: item.size,
                    height: item.size,
                    borderColor: item.color,
                  },
                ]}
              >
                <View
                  style={[
                    styles.floaterLArm,
                    {
                      width: item.size * 0.5,
                      height: item.size * 0.15,
                      left: 4,
                      top: 4,
                      borderColor: item.color,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.floaterLArm,
                    {
                      width: item.size * 0.15,
                      height: item.size * 0.5,
                      left: 4,
                      top: 4,
                      borderColor: item.color,
                    },
                  ]}
                />
              </View>
            </Animated.View>
          );
        }

        const shapeStyle =
          item.type === "circle"
            ? styles.floaterCircle
            : item.type === "rounded"
            ? styles.floaterRounded
            : item.type === "pill"
            ? styles.floaterPill
            : styles.floaterSquare;

        return (
          <Animated.View key={item.id} style={commonStyle}>
            <View
              style={[
                shapeStyle,
                {
                  width: item.type === "pill" ? item.size * 1.6 : item.size,
                  height: item.size,
                  borderColor: item.color,
                },
              ]}
            />
          </Animated.View>
        );
      })}

      {iconItems.map(item => {
        const rotation = item.rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.floater,
              {
                opacity: item.opacity,
                transform: [...item.translate.getTranslateTransform(), { rotate: rotation }],
              },
            ]}
          >
            {item.type === "coin" ? (
              <View
                style={[
                  styles.floaterCircle,
                  {
                    width: item.size,
                    height: item.size,
                    borderColor: item.color,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.floaterController,
                  {
                    width: item.size,
                    height: item.size * 0.6,
                    borderColor: item.color,
                  },
                ]}
              >
                <View style={[styles.floaterDot, { left: 6, top: 6 }]} />
                <View style={[styles.floaterDot, { right: 6, top: 6 }]} />
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

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
    if (!dates.has(getDateKey(d))) break;
    streak += 1;
  }
  return streak;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeeklyShiftCount = (logs: any[]) => {
  if (!logs.length) return 0;
  const start = getStartOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return logs.filter(log => {
    const date = log?.date ? new Date(`${log.date}T00:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return false;
    return date >= start && date <= end && log.status !== "rejected";
  }).length;
};

const getLogHours = (log: any) => {
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const [startH, startM] = String(log.clockIn ?? "").split(":").map(Number);
  const [endH, endM] = String(log.clockOut ?? "").split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const rawMinutes = Math.max(0, endMinutes - startMinutes);
  const breakMinutes = Number(log.breakMinutes ?? 0);
  return Math.max(0, rawMinutes - breakMinutes) / 60;
};

const getMonthlyEarnings = (logs: any[], hourlyRate: number) => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return logs.reduce((sum, log) => {
    const date = log?.date ? new Date(`${log.date}T00:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return sum;
    if (date.getMonth() !== month || date.getFullYear() !== year) return sum;
    return sum + getLogHours(log) * hourlyRate;
  }, 0);
};

const buildChallenges = ({
  goals,
  activeGoals,
  streakDays,
  weeklyShiftCount,
}: {
  goals: Goal[];
  activeGoals: Goal[];
  streakDays: number;
  weeklyShiftCount: number;
}): Challenge[] => {
  const weekStart = getStartOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startDate = getDateKey(weekStart);
  const endDate = getDateKey(weekEnd);

  const primaryGoal = [...activeGoals]
    .filter(goal => goal.deadline)
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))[0];
  const saveTarget = primaryGoal
    ? Math.max(20, Math.round(getWeeklyPace(primaryGoal) / 10) * 10)
    : 20;
  const saveProgress = primaryGoal ? Math.max(0, primaryGoal.savedAmount) : 0;

  return [
    {
      id: "weekly-save",
      title: primaryGoal ? `Save RM ${saveTarget} this week` : "Start saving RM 20",
      description: primaryGoal
        ? `Boost your goal: ${primaryGoal.name}`
        : "Kickstart your savings habit",
      unit: "RM",
      target: saveTarget,
      progress: primaryGoal ? Math.min(saveProgress, saveTarget) : 0,
      rewardXp: 40,
      rewardCoins: 10,
      startDate,
      endDate,
      completed: primaryGoal ? saveProgress >= saveTarget : false,
      meta: primaryGoal ? { goalId: primaryGoal.id } : undefined,
    },
    {
      id: "weekly-shifts",
      title: "Log 4 shifts this week",
      description: "Stay consistent with work logs",
      unit: "shifts",
      target: 4,
      progress: weeklyShiftCount,
      rewardXp: 30,
      rewardCoins: 8,
      startDate,
      endDate,
      completed: weeklyShiftCount >= 4,
    },
    {
      id: "streak-mini",
      title: "Keep a 3-day streak",
      description: "Log shifts 3 days in a row",
      unit: "days",
      target: 3,
      progress: streakDays,
      rewardXp: 25,
      rewardCoins: 6,
      startDate,
      endDate,
      completed: streakDays >= 3,
    },
  ];
};

const getWeeklyPace = (goal: Goal) => {
  const today = new Date();
  const deadline = new Date(goal.deadline);
  const diffMs = Math.max(0, deadline.getTime() - today.getTime());
  const weeks = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  return remaining / weeks;
};

const mergeProgress = (stored: Challenge[], generated: Challenge[]) => {
  const map = new Map(stored.map(ch => [ch.id, ch]));
  return generated.map(ch => {
    const saved = map.get(ch.id);
    if (!saved) return ch;
    return {
      ...ch,
      startDate: saved.startDate || ch.startDate,
      endDate: saved.endDate || ch.endDate,
      progress: ch.progress,
      completed: ch.completed,
      rewardXp: saved.rewardXp ?? ch.rewardXp,
      rewardCoins: saved.rewardCoins ?? ch.rewardCoins,
      meta: saved.meta ?? ch.meta,
    };
  });
};

const getLevelProgress = (xp: number) => {
  const levels = [0, 100, 250, 450, 700, 1000, 1400, 1900];
  let level = 1;
  for (let i = 0; i < levels.length; i += 1) {
    if (xp >= levels[i]) level = i + 1;
  }
  const currentFloor = levels[level - 1] ?? 0;
  const nextXp = levels[level] ?? (currentFloor + 600);
  const progress = Math.min(100, Math.round(((xp - currentFloor) / (nextXp - currentFloor)) * 100));
  return { level, nextXp, progress };
};

const challengeCatalog = [
  {
    id: "monthly-consistency",
    title: "Log 12 shifts this month",
    description: "Build consistency across the month.",
    requirement: "Complete 12 approved shifts",
  },
  {
    id: "saving-burst",
    title: "Save RM 150 this month",
    description: "Push savings with a focused month.",
    requirement: "Increase goal savings by RM 150",
  },
  {
    id: "budget-review",
    title: "Review budget weekly",
    description: "Check your budget 4 times this month.",
    requirement: "Open the budget screen weekly",
  },
];

const getUnlocks = (level: number) => {
  const unlocks = [
    { level: 2, title: "Fresh theme", note: "Unlock a new color set" },
    { level: 3, title: "Insights", note: "Weekly trend summary" },
    { level: 4, title: "Badge boost", note: "Special badge frame" },
    { level: 5, title: "Goal accelerator", note: "Extra savings tips" },
  ];
  return unlocks.map(item => ({
    ...item,
    note: level >= item.level ? "Unlocked" : `Unlock at level ${item.level}`,
  }));
};
