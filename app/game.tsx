import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  Crown,
  Gem,
  Flame,
  Gift,
  Lock,
  Medal,
  Menu,
  ShoppingBag,
  AlertCircle,
  ChevronRight,
  Home,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { AnimatedBlobs } from "../components/AnimatedBlobs";
import { auth, db } from "../lib/firebase";
import {
  getBaseXp,
  getConsecutiveStreakDays,
  getLevelProgress,
  getTotalXp,
} from "../lib/game/stats";

type Challenge = {
  id: string;
  title: string;
  description: string;
  unit: string;
  target: number;
  progress: number;
  rewardXp: number;
  rewardCoins: number;
  startDate: string;
  endDate: string;
  completed: boolean;
  claimed?: boolean;
  meta?: Record<string, any>;
  pending?: boolean;
};

type Badge = {
  id: string;
  name: string;
  rarity: "Legendary" | "Epic" | "Rare" | "Common" | "Mythic";
  icon: typeof Trophy;
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

type ArcadeState = {
  coins: number;
  gems: number;
  bonusXp: number;
  totalXp?: number;
  level?: number;
  displayName?: string;
  photoUrl?: string;
  role?: string;
  spinsLeft: number;
  lastSpinDate?: string;
  lastSpinReward?: { type: "xp" | "coins" | "gems"; amount: number };
  lastLevel?: number;
  powerUps?: {
    xpBoost: number;
    shield: number;
    multiplier: number;
    luckyCharm: number;
  };
  daily?: {
    date: string;
    activeSeconds?: number;
    questClaims?: Record<string, boolean>;
    bonusClaimed?: boolean;
  };
  milestonesClaimed?: Record<string, boolean>;
  lastGoalsReviewAt?: any;
  weekly?: {
    weekKey: string;
    challengeClaims: Record<string, boolean>;
  };
  shopBadges?: Record<string, boolean>;
};

type PowerUpType = keyof NonNullable<ArcadeState["powerUps"]>;

type PowerUpItem = {
  id: PowerUpType;
  name: string;
  description: string;
  icon: typeof Zap;
  cost: number;
  currency: "coins" | "gems";
  owned: number;
  gradient: [string, string];
  border: string;
};

type DashboardPanel =
  | "main"
  | "profile"
  | "achievements"
  | "lucky-spin"
  | "badges"
  | "challenges"
  | "shop";

export default function GameScreen() {
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
  const [activePanel, setActivePanel] = useState<DashboardPanel>("main");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const spinRotation = useRef(new Animated.Value(0)).current;
  const spinTurns = useRef(0);
  const lastAwardedLevelRef = useRef<number | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgetAllocation, setBudgetAllocation] = useState<
    { category: string; amount: number }[]
  >([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userHourlyRate, setUserHourlyRate] = useState(0);
  const [userProfile, setUserProfile] = useState<{
    displayName: string;
    photoUrl?: string;
    role?: string;
  }>({ displayName: "Worker" });
  const [workerProfiles, setWorkerProfiles] = useState<
    { id: string; name: string }[]
  >([]);
  const [workConfig, setWorkConfig] = useState({
    hourlyRate: 0,
    overtimeRate: 0,
  });
  const [arcadeState, setArcadeState] = useState<ArcadeState | null>(null);
  const [arcadeReady, setArcadeReady] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    { rank: number; name: string; level: number; xp: number; isYou: boolean }[]
  >([]);
  const [lastSpinReward, setLastSpinReward] = useState<
    ArcadeState["lastSpinReward"] | null
  >(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const selfEntryRef = useRef({ name: "Worker", level: 1, xp: 0 });
  const xpProgressAnim = useRef(new Animated.Value(0)).current;

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
      const list = snap.docs.map(docSnap => {
        const data = docSnap.data() as any;
        const createdAtValue =
          typeof data.createdAt?.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === "string"
              ? data.createdAt
              : new Date().toISOString();
        return {
          id: docSnap.id,
          name: data.name ?? "",
          targetAmount: Number(data.targetAmount ?? 0),
          savedAmount: Number(data.savedAmount ?? 0),
          createdAt: createdAtValue,
          deadline: data.deadline ?? "",
        };
      });
      setGoals(list as Goal[]);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setExpenses([]);
      return;
    }
    const expensesRef = collection(db, "users", userId, "expenses");
    const unsub = onSnapshot(expensesRef, snap => {
      const list = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      setExpenses(list);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBudgetAllocation([]);
      setUserHourlyRate(0);
      setUserProfile({ displayName: "Worker" });
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
      const displayName =
        data?.fullName ||
        data?.displayName ||
        auth.currentUser?.displayName ||
        "Worker";
      setUserProfile({
        displayName,
        photoUrl: data?.photoUrl ?? auth.currentUser?.photoURL ?? undefined,
        role: data?.role ?? "worker",
      });
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
      setWorkerProfiles([]);
      return;
    }
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(
      usersRef,
      snap => {
        const workers = snap.docs
          .map(docSnap => {
            const data = docSnap.data() as any;
            if (data?.role && data.role !== "worker") return null;
            const name =
              data?.fullName ||
              data?.displayName ||
              data?.email ||
              "Worker";
            return { id: docSnap.id, name };
          })
          .filter(Boolean) as { id: string; name: string }[];
        setWorkerProfiles(workers);
      },
      () => setWorkerProfiles([])
    );
    return unsub;
  }, [userId]);

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
    if (!userId) {
      setArcadeState(null);
      setArcadeReady(false);
      lastAwardedLevelRef.current = null;
      return;
    }
    const arcadeRef = doc(db, "users", userId, "arcade", "state");
    const unsub = onSnapshot(arcadeRef, snap => {
      if (!snap.exists()) {
        setArcadeState(null);
        setArcadeReady(true);
        return;
      }
      setArcadeState(snap.data() as ArcadeState);
      setArcadeReady(true);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (arcadeState?.lastLevel != null) {
      lastAwardedLevelRef.current = arcadeState.lastLevel;
    }
  }, [arcadeState?.lastLevel]);

  useEffect(() => {
    if (!userId || arcadeState || !arcadeReady) return;
    const todayKey = getDateKey(new Date());
    const weekKey = getWeekKey(new Date());
    const arcadeRef = doc(db, "users", userId, "arcade", "state");
    setDoc(
      arcadeRef,
      {
        coins: 0,
        gems: 0,
        bonusXp: 0,
        totalXp: 0,
        level: 1,
        displayName: userProfile.displayName,
        photoUrl: userProfile.photoUrl ?? null,
        role: userProfile.role ?? "worker",
        spinsLeft: 1,
        lastSpinDate: todayKey,
        lastLevel: 1,
        powerUps: {
          xpBoost: 0,
          shield: 0,
          multiplier: 0,
          luckyCharm: 0,
        },
        daily: {
          date: todayKey,
          activeSeconds: 0,
          questClaims: {},
          bonusClaimed: false,
        },
        milestonesClaimed: {},
        weekly: {
          weekKey,
          challengeClaims: {},
        },
        shopBadges: {},
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, [arcadeReady, arcadeState, userId, userProfile]);

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
  const todayKey = getDateKey(new Date());
  const arcadeRef = useMemo(
    () => (userId ? doc(db, "users", userId, "arcade", "state") : null),
    [userId]
  );

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
  const weeklyEarnings = useMemo(
    () => getWeeklyEarnings(approvedLogs, hourlyRate, 0),
    [approvedLogs, hourlyRate]
  );
  const lastWeekEarnings = useMemo(
    () => getWeeklyEarnings(approvedLogs, hourlyRate, 1),
    [approvedLogs, hourlyRate]
  );
  const weeklyChangeLabel = useMemo(() => {
    if (lastWeekEarnings <= 0) return "No data last week";
    const diff = ((weeklyEarnings - lastWeekEarnings) / lastWeekEarnings) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(0)}% vs last week`;
  }, [lastWeekEarnings, weeklyEarnings]);
  const budgetTotal = useMemo(
    () => budgetAllocation.reduce((sum, item) => sum + item.amount, 0),
    [budgetAllocation]
  );
  const dailyBudget = budgetTotal > 0 ? budgetTotal / getDaysInMonth(new Date()) : 0;
  const todayExpenses = useMemo(
    () =>
      expenses.filter(expense => getDateKeyFromValue(expense.date ?? expense.createdAt) === todayKey),
    [expenses, todayKey]
  );
  const todayExpenseTotal = useMemo(
    () =>
      todayExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? expense.total ?? 0),
        0
      ),
    [todayExpenses]
  );
  const todayExpenseCount = todayExpenses.length;
  const trackedExpenseCount =
    todayExpenseCount > 0 ? todayExpenseCount : budgetAllocation.length;
  const goalsThisMonth = useMemo(() => {
    const monthKey = getMonthKey(new Date());
    return goals.filter(goal => getMonthKey(new Date(goal.createdAt)) === monthKey);
  }, [goals]);
  const goalsHitCount = goalsThisMonth.filter(
    goal => goal.savedAmount >= goal.targetAmount
  ).length;

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
  const currentWeekKey = useMemo(() => getWeekKey(new Date()), [todayKey]);
  const currentWeekChallenges = useMemo(
    () =>
      displayChallenges.filter(
        challenge => challenge.startDate === currentWeekKey
      ),
    [currentWeekKey, displayChallenges]
  );
  const nextWeekChallenges = useMemo(() => {
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    return buildChallenges(
      {
        goals,
        activeGoals,
        streakDays: 0,
        weeklyShiftCount: 0,
      },
      nextWeekDate
    ).map(challenge => ({
      ...challenge,
      progress: 0,
      completed: false,
      claimed: false,
      pending: true,
    }));
  }, [activeGoals, goals, todayKey]);
  const activeChallenges = useMemo(
    () => currentWeekChallenges.filter(challenge => !challenge.claimed),
    [currentWeekChallenges]
  );
  const claimedChallenges = useMemo(
    () => currentWeekChallenges.filter(challenge => challenge.claimed),
    [currentWeekChallenges]
  );
  const claimedHistory = useMemo(
    () =>
      challenges.filter(
        challenge =>
          challenge.startDate &&
          challenge.startDate <= currentWeekKey &&
          challenge.claimed
      ),
    [challenges, currentWeekKey]
  );
  const upcomingChallenges = useMemo(
    () => activeChallenges.filter(challenge => !challenge.completed),
    [activeChallenges]
  );
  const completedChallenges = useMemo(
    () => activeChallenges.filter(challenge => challenge.completed),
    [activeChallenges]
  );

  useEffect(() => {
    if (!userId) return;
    displayChallenges.forEach(({ meta, ...challenge }) => {
      const payload = meta ? { ...challenge, meta } : challenge;
      const { claimed, pending, ...rest } = payload;
      const safePayload =
        claimed === true ? { ...rest, claimed: true } : rest;
      const ref = doc(db, "users", userId, "challenges", challenge.id);
      setDoc(ref, safePayload, { merge: true });
    });
  }, [userId, displayChallenges]);

  const baseXp = useMemo(
    () =>
      getBaseXp({
        approvedLogsCount: approvedLogs.length,
        goalsCount: goals.length,
        completedGoalsCount: completedGoals.length,
        completedChallengesCount: displayChallenges.filter(ch => ch.completed).length,
      }),
    [approvedLogs.length, completedGoals.length, displayChallenges, goals.length]
  );

  const bonusXp = arcadeState?.bonusXp ?? 0;
  const totalXp = useMemo(
    () => getTotalXp({ baseXp, bonusXp }),
    [baseXp, bonusXp]
  );
  const { level, nextXp, progress } = useMemo(
    () => getLevelProgress(totalXp),
    [totalXp]
  );
  useEffect(() => {
    selfEntryRef.current = {
      name: userProfile.displayName,
      level,
      xp: totalXp,
    };
  }, [level, totalXp, userProfile.displayName]);

  useEffect(() => {
    Animated.timing(xpProgressAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress, xpProgressAnim]);
  const coins = arcadeState?.coins ?? 0;
  const gems = arcadeState?.gems ?? 0;
  const xpWallet = Math.max(0, arcadeState?.bonusXp ?? 0);
  const spinsLeft = arcadeState?.spinsLeft ?? 0;
  const powerUps = arcadeState?.powerUps ?? {
    xpBoost: 0,
    shield: 0,
    multiplier: 0,
    luckyCharm: 0,
  };
  const dailyQuestClaims =
    arcadeState?.daily?.date === todayKey ? arcadeState.daily?.questClaims ?? {} : {};
  const dailyActiveSeconds =
    arcadeState?.daily?.date === todayKey ? arcadeState.daily?.activeSeconds ?? 0 : 0;
  const goalsReviewedToday =
    getDateKeyFromValue(arcadeState?.lastGoalsReviewAt) === todayKey;
  const milestoneClaims = arcadeState?.milestonesClaimed ?? {};
  const dailyQuests = useMemo(() => {
    const underBudget =
      dailyBudget > 0 && todayExpenseTotal > 0 && todayExpenseTotal <= dailyBudget;
    const minutes = Math.min(5, Math.floor(dailyActiveSeconds / 60));
    return [
      {
        id: "track-expenses",
        title: "Track 3 expenses",
        progress: Math.min(trackedExpenseCount, 3),
        total: 3,
        reward: 20,
      },
      {
        id: "stay-under-budget",
        title: "Stay under daily budget",
        progress: underBudget ? 1 : 0,
        total: 1,
        reward: 30,
      },
      {
        id: "review-goals",
        title: "Review your goals",
        progress: goalsReviewedToday ? 1 : 0,
        total: 1,
        reward: 15,
      },
      {
        id: "login-minutes",
        title: "Log in for 5 minutes",
        progress: minutes,
        total: 5,
        reward: 10,
      },
    ].map(quest => ({
      ...quest,
      completed: quest.progress >= quest.total,
      claimed: Boolean(dailyQuestClaims[quest.id]),
    }));
  }, [
    dailyActiveSeconds,
    dailyBudget,
    dailyQuestClaims,
    goalsReviewedToday,
    todayExpenseCount,
    todayExpenseTotal,
    trackedExpenseCount,
  ]);
  const dailyCompletedCount = dailyQuests.filter(quest => quest.completed).length;
  const allDailyCompleted = dailyCompletedCount === dailyQuests.length;
  const dailyBonusClaimed =
    arcadeState?.daily?.date === todayKey && arcadeState?.daily?.bonusClaimed;
  const xpToLevel = Math.max(0, nextXp - totalXp);
  const comboBonus = Math.max(1, Math.min(5, Math.floor(streakDays / 3)));
  const milestones = [
    {
      id: "first-week",
      title: "First Week",
      xpRequired: 100,
      reward: 25,
      icon: Target,
    },
    {
      id: "budget-master",
      title: "Budget Master",
      xpRequired: 500,
      reward: 50,
      icon: Coins,
    },
    {
      id: "savings-hero",
      title: "Savings Hero",
      xpRequired: 1000,
      reward: 100,
      icon: Shield,
    },
    {
      id: "finance-legend",
      title: "Finance Legend",
      xpRequired: 2500,
      reward: 250,
      icon: Crown,
    },
  ];
  const badges: Badge[] = useMemo(() => {
    const underBudget = budgetTotal > 0 && monthlyEarnings >= budgetTotal;
    return [
      {
        id: "diamond-saver",
        icon: Gem,
        name: "Diamond Saver",
        rarity: "Legendary",
        unlocked: gems >= 20 || totalXp >= 700,
      },
      {
        id: "goal-crusher",
        icon: Target,
        name: "Goal Crusher",
        rarity: "Epic",
        unlocked: completedGoals.length > 0,
      },
      {
        id: "streak-master",
        icon: Flame,
        name: "Streak Master",
        rarity: "Rare",
        unlocked: streakDays >= 7,
      },
      {
        id: "speed-tracker",
        icon: Zap,
        name: "Speed Tracker",
        rarity: "Common",
        unlocked: approvedLogs.length >= 5,
      },
      {
        id: "budget-legend",
        icon: Trophy,
        name: "Budget Legend",
        rarity: "Legendary",
        unlocked: underBudget,
      },
      {
        id: "finance-king",
        icon: Crown,
        name: "Finance King",
        rarity: "Mythic",
        unlocked: totalXp >= 2500,
      },
    ];
  }, [approvedLogs.length, budgetTotal, completedGoals.length, gems, monthlyEarnings, streakDays, totalXp]);
  const achievedMilestones = milestones.filter(
    milestone => totalXp >= milestone.xpRequired
  );
  const unlockedBadges = badges.filter(badge => badge.unlocked);
  const unlockedBadgeCount = badges.filter(badge => badge.unlocked).length;
  const powerUpItems: PowerUpItem[] = [
    {
      id: "xpBoost",
      name: "2x XP Boost",
      description: "Double XP for 24 hours",
      icon: Zap,
      cost: 50,
      currency: "coins",
      owned: powerUps.xpBoost,
      gradient: ["#f59e0b", "#f97316"],
      border: "rgba(251, 146, 60, 0.4)",
    },
    {
      id: "shield",
      name: "Budget Shield",
      description: "Protect your streak",
      icon: Shield,
      cost: 10,
      currency: "gems",
      owned: powerUps.shield,
      gradient: ["#38bdf8", "#60a5fa"],
      border: "rgba(59, 130, 246, 0.4)",
    },
    {
      id: "multiplier",
      name: "Savings Multiplier",
      description: "Earn 50% more on goals",
      icon: TrendingUp,
      cost: 75,
      currency: "coins",
      owned: powerUps.multiplier,
      gradient: ["#22c55e", "#10b981"],
      border: "rgba(34, 197, 94, 0.4)",
    },
    {
      id: "luckyCharm",
      name: "Lucky Charm",
      description: "Better rewards for 12h",
      icon: Sparkles,
      cost: 15,
      currency: "gems",
      owned: powerUps.luckyCharm,
      gradient: ["#a855f7", "#ec4899"],
      border: "rgba(236, 72, 153, 0.45)",
    },
  ];

  useEffect(() => {
    if (!arcadeRef || !arcadeState) return;
    const updates: Record<string, any> = {};
    if (arcadeState.totalXp !== totalXp) updates.totalXp = totalXp;
    if (arcadeState.level !== level) updates.level = level;
    if (
      userProfile.displayName &&
      arcadeState.displayName !== userProfile.displayName
    ) {
      updates.displayName = userProfile.displayName;
    }
    if (userProfile.photoUrl && arcadeState.photoUrl !== userProfile.photoUrl) {
      updates.photoUrl = userProfile.photoUrl;
    }
    if (userProfile.role && arcadeState.role !== userProfile.role) {
      updates.role = userProfile.role;
    }
    if (Object.keys(updates).length > 0) {
      updateDoc(arcadeRef, updates);
    }
  }, [arcadeRef, arcadeState, level, totalXp, userProfile]);

  useEffect(() => {
    setLastSpinReward(arcadeState?.lastSpinReward ?? null);
  }, [arcadeState?.lastSpinReward]);

  useEffect(() => {
    if (!userId) {
      setLeaderboardEntries([]);
      return;
    }
    const arcadeGroup = collectionGroup(db, "arcade");
    const unsubscribe = onSnapshot(
      arcadeGroup,
      snap => {
        const arcadeRows = snap.docs
          .filter(docSnap => docSnap.id === "state")
          .map(docSnap => {
            const data = docSnap.data() as ArcadeState;
            const parentId = docSnap.ref.parent.parent?.id ?? docSnap.id;
            const xpValue = Number(data.totalXp ?? data.bonusXp ?? 0);
            const levelValue = Number(
              data.level ?? getLevelProgress(xpValue).level
            );
            const roleValue = data.role ?? "worker";
            if (roleValue !== "worker") return null;
            return {
              id: parentId,
              name: String(data.displayName ?? "Worker"),
              level: levelValue,
              xp: xpValue,
            };
          })
          .filter(Boolean) as {
          id: string;
          name: string;
          level: number;
          xp: number;
        }[];
        const arcadeMap = new Map(arcadeRows.map(row => [row.id, row]));
        const rows =
          workerProfiles.length > 0
            ? workerProfiles.map(worker => {
                const arcade = arcadeMap.get(worker.id);
                return {
                  id: worker.id,
                  name: worker.name,
                  level: arcade?.level ?? 1,
                  xp: arcade?.xp ?? 0,
                };
              })
            : arcadeRows;
        const sorted = rows.sort((a, b) => b.xp - a.xp);
        const ranked = sorted.map((row, index) => ({
          rank: index + 1,
          name: row.name,
          level: row.level,
          xp: row.xp,
          isYou: row.id === userId,
        }));
        setLeaderboardEntries(ranked.slice(0, 10));
      },
      () => {
        const fallback = selfEntryRef.current;
        setLeaderboardEntries([
          {
            rank: 1,
            name: fallback.name,
            level: fallback.level,
            xp: fallback.xp,
            isYou: true,
          },
        ]);
      }
    );
    return unsubscribe;
  }, [userId, workerProfiles]);

  useEffect(() => {
    if (!arcadeRef || !arcadeState) return;
    if (arcadeState.daily?.date === todayKey) return;
    updateDoc(arcadeRef, {
      daily: {
        date: todayKey,
        activeSeconds: 0,
        questClaims: {},
        bonusClaimed: false,
      },
    });
  }, [arcadeRef, arcadeState, todayKey]);

  useEffect(() => {
    if (!arcadeRef || !arcadeState) return;
    if (arcadeState.lastSpinDate === todayKey) return;
    updateDoc(arcadeRef, { spinsLeft: 1, lastSpinDate: todayKey });
  }, [arcadeRef, arcadeState, todayKey]);

  useEffect(() => {
    if (!arcadeRef || !arcadeState) return;
    const lastLevel = lastAwardedLevelRef.current ?? arcadeState.lastLevel ?? 1;
    if (level <= lastLevel) return;
    const diff = level - lastLevel;
    lastAwardedLevelRef.current = level;
    updateDoc(arcadeRef, {
      coins: increment(50 * diff),
      gems: increment(5 * diff),
      lastLevel: level,
    }).catch(() => {
      // Ignore transient errors; state will resync from Firestore.
    });
  }, [arcadeRef, arcadeState, level]);

  useEffect(() => {
    if (!arcadeRef || !arcadeState) return;
    if (arcadeState.daily?.date !== todayKey) return;
    const pending = dailyQuests.filter(
      quest => quest.completed && !dailyQuestClaims[quest.id]
    );
    if (!pending.length) return;
    const totalReward = pending.reduce((sum, quest) => sum + quest.reward, 0);
    const updates: Record<string, any> = {
      bonusXp: increment(totalReward),
    };
    pending.forEach(quest => {
      updates[`daily.questClaims.${quest.id}`] = true;
    });
    updateDoc(arcadeRef, updates);
  }, [arcadeRef, arcadeState, dailyQuestClaims, dailyQuests, todayKey]);

  useFocusEffect(
    useCallback(() => {
      if (!arcadeRef || !arcadeState) return;
      activeTimer.current = setInterval(() => {
        updateDoc(arcadeRef, {
          "daily.activeSeconds": increment(30),
          "daily.date": todayKey,
        });
      }, 30000);
      return () => {
        if (activeTimer.current) {
          clearInterval(activeTimer.current);
          activeTimer.current = null;
        }
      };
    }, [arcadeRef, arcadeState, todayKey])
  );

  useEffect(() => {
    return () => {
      if (spinTimer.current) {
        clearTimeout(spinTimer.current);
        spinTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activePanel]);

  const handleConvertCoins = async () => {
    if (!arcadeRef) return;
    if (coins < 10) {
      Alert.alert("Not enough coins", "You need at least 10 coins to convert.");
      return;
    }
    try {
      await runTransaction(db, async transaction => {
        const snap = await transaction.get(arcadeRef);
        if (!snap.exists()) return;
        const data = snap.data() as ArcadeState;
        if ((data.coins ?? 0) < 10) return;
        transaction.update(arcadeRef, {
          coins: increment(-10),
          bonusXp: increment(10),
        });
      });
    } catch {
      // ignore transaction errors
    }
  };

  const handleClaimDailyBonus = async () => {
    if (!arcadeRef || !arcadeState || !allDailyCompleted || dailyBonusClaimed) return;
    await updateDoc(arcadeRef, {
      "daily.bonusClaimed": true,
      bonusXp: increment(50),
    });
  };

  const handleBuyPowerUp = async (
    type: PowerUpType,
    cost: number,
    currency: "coins" | "gems"
  ) => {
    if (!arcadeRef) return;
    const wallet = currency === "coins" ? coins : gems;
    if (wallet < cost) {
      const shortage = Math.max(0, cost - wallet);
      setShopError(
        `Not enough ${currency}. You need ${shortage} more to buy this power-up.`
      );
      return;
    }
    setShopError(null);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(arcadeRef);
      if (!snap.exists()) return;
      const data = snap.data() as ArcadeState;
      const wallet = currency === "coins" ? data.coins ?? 0 : data.gems ?? 0;
      if (wallet < cost) return;
      transaction.update(arcadeRef, {
        [currency]: increment(-cost),
        [`powerUps.${type}`]: increment(1),
      });
    });
  };

  const handleSpin = () => {
    if (!arcadeRef || isSpinning || spinsLeft <= 0) return;
    setIsSpinning(true);
    setLastSpinReward(null);
    const extraTurns = 3 + Math.random() * 2;
    spinTurns.current += extraTurns;
    Animated.timing(spinRotation, {
      toValue: spinTurns.current,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const rewards = [
      { type: "coins" as const, min: 100, max: 500 },
      { type: "gems" as const, min: 5, max: 25 },
      { type: "xp" as const, min: 50, max: 200 },
      { type: "coins" as const, min: 50, max: 150 },
    ];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const amount =
      Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;

    spinTimer.current = setTimeout(async () => {
      try {
        await runTransaction(db, async transaction => {
          const snap = await transaction.get(arcadeRef);
          if (!snap.exists()) return;
          const data = snap.data() as ArcadeState;
          if ((data.spinsLeft ?? 0) <= 0) return;
          const updates: Record<string, any> = {
            spinsLeft: increment(-1),
            lastSpinReward: { type: reward.type, amount },
          };
          if (reward.type === "xp") {
            updates.bonusXp = increment(amount);
          } else if (reward.type === "coins") {
            updates.coins = increment(amount);
          } else if (reward.type === "gems") {
            updates.gems = increment(amount);
          }
          transaction.update(arcadeRef, updates);
        });
        setLastSpinReward({
          type: reward.type,
          amount,
        });
      } finally {
        setIsSpinning(false);
      }
    }, 1600);
  };

  const handleClaimChallenge = async (challenge: Challenge) => {
    if (!userId || !arcadeRef || challenge.claimed || !challenge.completed) return;
    const challengeRef = doc(db, "users", userId, "challenges", challenge.id);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(challengeRef);
      if (!snap.exists()) return;
      const data = snap.data() as Challenge;
      if (data.claimed) return;
      transaction.update(challengeRef, { claimed: true });
      transaction.update(arcadeRef, {
        bonusXp: increment(challenge.rewardXp),
        coins: increment(challenge.rewardCoins),
      });
    });
  };

  const handleClaimMilestone = async (milestone: typeof milestones[number]) => {
    if (!arcadeRef || !arcadeState) return;
    if (milestoneClaims[milestone.id]) return;
    if (totalXp < milestone.xpRequired) return;
    await updateDoc(arcadeRef, {
      [`milestonesClaimed.${milestone.id}`]: true,
      bonusXp: increment(milestone.reward),
    });
  };

  const handleChallengeAction = (challengeId: string) => {
    if (challengeId === "weekly-save") {
      router.push("/(tabs)/goals");
      return;
    }
    if (challengeId === "weekly-shifts" || challengeId === "streak-mini") {
      router.push("/(tabs)/calendar");
    }
  };

  const handleMenuSelect = (panel: DashboardPanel) => {
    setActivePanel(panel);
    setMenuOpen(false);
  };

  const isMainPanel = activePanel === "main";
  const xpFillWidth = xpProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  const panelTitle =
    activePanel === "profile"
      ? "Profile Achievements"
      : activePanel === "achievements"
        ? "Achievement Path"
        : activePanel === "lucky-spin"
          ? "Lucky Spin"
          : activePanel === "badges"
            ? "Badge Collection"
            : activePanel === "challenges"
              ? "Weekly Challenges"
              : activePanel === "shop"
                ? "XP Exchange Shop"
                : "";

  const shopCatalog = [
    {
      id: "coins-pack",
      title: "Coin Pack",
      description: "Trade XP or gems for coins",
      reward: { type: "coins" as const, amount: 200 },
      offers: [
        { currency: "xp" as const, cost: 80 },
        { currency: "gems" as const, cost: 5 },
      ],
    },
    {
      id: "gems-pack",
      title: "Gem Pack",
      description: "Trade coins or XP for gems",
      reward: { type: "gems" as const, amount: 5 },
      offers: [
        { currency: "coins" as const, cost: 250 },
        { currency: "xp" as const, cost: 120 },
      ],
    },
    {
      id: "xp-pack",
      title: "XP Booster",
      description: "Trade coins or gems for XP",
      reward: { type: "xp" as const, amount: 150 },
      offers: [
        { currency: "coins" as const, cost: 100 },
        { currency: "gems" as const, cost: 4 },
      ],
    },
    {
      id: "badge-goal",
      title: "Goal Keeper Badge",
      description: "A rare badge for goal chasers",
      reward: { type: "badge" as const, badgeId: "badge-goal" },
      offers: [
        { currency: "xp" as const, cost: 180 },
        { currency: "coins" as const, cost: 300 },
        { currency: "gems" as const, cost: 8 },
      ],
    },
    {
      id: "badge-streak",
      title: "Streak Legend Badge",
      description: "Celebrate your consistency",
      reward: { type: "badge" as const, badgeId: "badge-streak" },
      offers: [
        { currency: "xp" as const, cost: 220 },
        { currency: "coins" as const, cost: 360 },
        { currency: "gems" as const, cost: 10 },
      ],
    },
  ];

  const renderChallengeCard = (
    challenge: Challenge,
    options?: { isUpcoming?: boolean; isPast?: boolean }
  ) => {
    const isUpcoming = options?.isUpcoming;
    const isPast = options?.isPast;
    const percent =
      challenge.target === 0
        ? 0
        : Math.min(100, (challenge.progress / challenge.target) * 100);
    const difficulty = getDifficultyLabel(challenge.rewardXp);
    return (
      <View
        key={challenge.id}
        style={[
          styles.challengeCard,
          challenge.completed && styles.challengeCardCompleted,
        ]}
      >
        <View style={styles.challengeTopRow}>
          <View style={styles.challengeTitleWrap}>
            <View style={styles.challengeTitleRow}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View
                style={[
                  styles.difficultyBadge,
                  difficulty === "Easy"
                    ? styles.difficultyEasy
                    : difficulty === "Medium"
                      ? styles.difficultyMedium
                      : styles.difficultyHard,
                ]}
              >
                <Text style={styles.difficultyText}>{difficulty}</Text>
              </View>
            </View>
            <Text style={styles.challengeDesc}>{challenge.description}</Text>
          </View>
        </View>

        <View style={styles.challengeMetaRow}>
          <View style={styles.challengeMetaItem}>
            <Clock size={12} color="#9ca3af" />
            <Text style={styles.challengeMetaText}>
              {isUpcoming
                ? "Starts next week"
                : isPast
                  ? "Finished"
                  : challenge.completed
                    ? "Completed"
                    : getTimeLeftLabel(challenge.endDate)}
            </Text>
          </View>
          <View style={styles.challengeRewardPill}>
            <Trophy size={12} color="#fdba74" />
            <Text style={styles.challengeRewardText}>
              +{challenge.rewardXp} XP
            </Text>
          </View>
        </View>

        <View style={styles.challengeProgressTrack}>
          <View
            style={[styles.challengeProgressFill, { width: `${percent}%` }]}
          />
        </View>

        <View style={styles.challengeFooter}>
          <Text style={styles.challengeProgressText}>
            {challenge.progress} / {challenge.target} {challenge.unit}
          </Text>
          {isUpcoming ? (
            <Text style={styles.pendingText}>Pending</Text>
          ) : isPast ? (
            <Text style={styles.claimedText}>
              {challenge.claimed ? "Claimed" : "Missed"}
            </Text>
          ) : challenge.completed ? (
            challenge.claimed ? (
              <Text style={styles.claimedText}>Claimed</Text>
            ) : (
              <TouchableOpacity
                style={styles.claimButton}
                onPress={() => handleClaimChallenge(challenge)}
              >
                <Text style={styles.claimButtonText}>Claim Reward</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={styles.progressButton}
              onPress={() => handleChallengeAction(challenge.id)}
            >
              <Text style={styles.progressButtonText}>Make Progress</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleQuestPress = useCallback(
    (questId: string) => {
      if (questId === "track-expenses" || questId === "stay-under-budget") {
        router.push("/(tabs)");
        return;
      }
      if (questId === "review-goals") {
        router.push("/(tabs)/goals");
        return;
      }
      if (questId === "login-minutes") {
        Alert.alert(
          "Stay active",
          "Keep this screen open for 5 minutes to complete the quest."
        );
      }
    },
    []
  );

  const handleShopPurchase = async (
    item: (typeof shopCatalog)[number],
    offer: { currency: "coins" | "gems" | "xp"; cost: number }
  ) => {
    if (!arcadeRef) return;
    if (
      item.reward.type === "badge" &&
      item.reward.badgeId &&
      arcadeState?.shopBadges?.[item.reward.badgeId]
    ) {
      setShopError("You already own this badge.");
      return;
    }
    const wallet =
      offer.currency === "coins"
        ? coins
        : offer.currency === "gems"
          ? gems
          : xpWallet;
    if (wallet < offer.cost) {
      const shortage = Math.max(0, offer.cost - wallet);
      setShopError(
        `Not enough ${offer.currency}. You need ${shortage} more to trade.`
      );
      return;
    }
    setShopError(null);
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(arcadeRef);
      if (!snap.exists()) return;
      const data = snap.data() as ArcadeState;
      const wallet =
        offer.currency === "coins"
          ? data.coins ?? 0
          : offer.currency === "gems"
            ? data.gems ?? 0
            : Math.max(0, data.bonusXp ?? 0);
      if (wallet < offer.cost) return;

      const updates: Record<string, any> = {};
      if (offer.currency === "xp") {
        updates.bonusXp = increment(-offer.cost);
      } else {
        updates[offer.currency] = increment(-offer.cost);
      }

      if (item.reward.type === "xp" && item.reward.amount) {
        updates.bonusXp = increment(item.reward.amount);
      } else if (item.reward.type === "coins" && item.reward.amount) {
        updates.coins = increment(item.reward.amount);
      } else if (item.reward.type === "gems" && item.reward.amount) {
        updates.gems = increment(item.reward.amount);
      } else if (item.reward.type === "badge" && item.reward.badgeId) {
        updates[`shopBadges.${item.reward.badgeId}`] = true;
      }

      transaction.update(arcadeRef, updates);
    });
  };

  const handleResetWeeklyClaims = () => {
    if (!userId) return;
    Alert.alert(
      "Reset weekly claims?",
      "This will allow you to claim current week rewards again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const resetTargets = currentWeekChallenges.filter(
              challenge => challenge.claimed
            );
            await Promise.all(
              resetTargets.map(challenge =>
                updateDoc(
                  doc(db, "users", userId, "challenges", challenge.id),
                  { claimed: false }
                )
              )
            );
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={[neon.bgStart, neon.bgEnd]} style={styles.screen}>
      <ArcadeFloaters />
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <Modal
        transparent
        visible={menuOpen}
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuTitle}>Arcade Menu</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("main")}
            >
              <Home size={18} color="#e2e8f0" />
              <Text style={styles.menuItemText}>Main Dashboard</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("profile")}
            >
              <User size={18} color="#e2e8f0" />
              <Text style={styles.menuItemText}>Profile Achievements</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("achievements")}
            >
              <Star size={18} color="#facc15" />
              <Text style={styles.menuItemText}>Achievement Path</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("lucky-spin")}
            >
              <Sparkles size={18} color="#f472b6" />
              <Text style={styles.menuItemText}>Lucky Spin</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("badges")}
            >
              <Award size={18} color="#f472b6" />
              <Text style={styles.menuItemText}>Badge Collection</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuSelect("challenges")}
            >
              <Target size={18} color="#34d399" />
              <Text style={styles.menuItemText}>Weekly Challenges</Text>
              <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              activePanel === "main" ? router.back() : setActivePanel("main")
            }
          >
            <ArrowLeft size={20} color="#e5e7eb" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Budget Arcade</Text>
            <Text style={styles.headerSubtitle}>Your Financial Game</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setActivePanel("shop")}
            accessibilityLabel="Open shop"
          >
            <ShoppingBag size={20} color="#e5e7eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMenuOpen(true)}
          >
            <Menu size={20} color="#e5e7eb" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {!isMainPanel ? (
            <View style={styles.panelHeader}>
              <View style={styles.panelSpacer} />
              <Text style={styles.panelTitle}>{panelTitle}</Text>
              <View style={styles.panelSpacer} />
            </View>
          ) : null}

          {isMainPanel ? (
            <>
              <LinearGradient
                colors={["#667eea", "#764ba2", "#f093fb"]}
                style={styles.levelCard}
              >
                <View style={styles.levelTopRow}>
                  <View style={styles.levelLeft}>
                    <View style={styles.levelBadge}>
                      <Crown size={18} color="#ffffff" />
                    </View>
                    <View>
                      <Text style={styles.levelLabel}>Level</Text>
                      <Text style={styles.levelValue}>{level}</Text>
                    </View>
                  </View>
                  <View style={styles.currencyRow}>
                    <View style={styles.currencyPill}>
                      <Coins size={16} color="#0f172a" />
                      <Text style={styles.currencyValue}>{coins}</Text>
                    </View>
                    <View style={[styles.currencyPill, styles.currencyPillAlt]}>
                      <Gem size={16} color="#ffffff" />
                      <Text
                        style={[styles.currencyValue, styles.currencyValueAlt]}
                      >
                        {gems}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.xpRow}>
                  <Text style={styles.xpText}>
                    {totalXp} / {nextXp} XP
                  </Text>
                  <View style={styles.xpToLevelPill}>
                    <Zap size={14} color="#fdba74" />
                    <Text style={styles.xpToLevelText}>
                      {xpToLevel} to level up
                    </Text>
                  </View>
                </View>

                <View style={styles.xpTrack}>
                  <Animated.View
                    style={[styles.xpFill, { width: xpFillWidth }]}
                  />
                </View>

                <View style={styles.levelFooter}>
                  <View style={styles.nextUnlockRow}>
                    <View style={styles.nextUnlockIcon}>
                      <Star size={14} color="#e9d5ff" />
                    </View>
                    <View>
                      <Text style={styles.nextUnlockLabel}>Next unlock</Text>
                      <Text style={styles.nextUnlockTitle}>
                        Advanced Insights
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.convertButton,
                      coins < 10 && styles.convertButtonDisabled,
                    ]}
                    onPress={handleConvertCoins}
                    disabled={coins < 10}
                  >
                    <Text style={styles.convertButtonText}>
                      Convert 10 coins to +10 XP
                    </Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleRow}>
                    <Target size={18} color="#34d399" />
                    <Text style={styles.sectionTitle}>Weekly Challenges</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionLink}
                    onPress={() => setActivePanel("challenges")}
                  >
                    <Text style={styles.sectionLinkText}>All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.challengeList}>
                  {(activeChallenges.length > 0
                    ? activeChallenges.slice(0, 2)
                    : nextWeekChallenges.slice(0, 2)
                  ).map(challenge =>
                    renderChallengeCard(challenge, {
                      isUpcoming: activeChallenges.length === 0,
                    })
                  )}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <View style={styles.sectionTitleRow}>
                      <Gift size={18} color="#facc15" />
                      <Text style={styles.sectionTitle}>Daily Quests</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>
                      Complete all for bonus:{" "}
                      <Text style={styles.sectionHighlight}>+50 XP</Text>
                    </Text>
                  </View>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>
                      {dailyCompletedCount}/{dailyQuests.length}
                    </Text>
                  </View>
                </View>

                <View style={styles.questList}>
                  {dailyQuests.map(quest => (
                    <TouchableOpacity
                      key={quest.id}
                      style={[
                        styles.questRow,
                        quest.completed && styles.questRowDone,
                      ]}
                      onPress={() => handleQuestPress(quest.id)}
                      disabled={quest.completed}
                      activeOpacity={0.8}
                    >
                      {quest.completed ? (
                        <CheckCircle2 size={20} color="#22c55e" />
                      ) : (
                        <Circle size={20} color="#6b7280" />
                      )}
                      <View style={styles.questContent}>
                        <Text style={styles.questTitle}>{quest.title}</Text>
                        <View style={styles.questProgressRow}>
                          <View style={styles.questProgressTrack}>
                            <View
                              style={[
                                styles.questProgressFill,
                                {
                                  width: `${Math.min(
                                    100,
                                    (quest.progress / quest.total) * 100
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.questProgressText}>
                            {quest.progress}/{quest.total}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.questRewardPill}>
                        <Zap size={12} color="#fdba74" />
                        <Text style={styles.questRewardText}>
                          +{quest.reward}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {allDailyCompleted ? (
                  <View style={styles.bonusRow}>
                    <Text style={styles.bonusText}>All quests completed!</Text>
                    <TouchableOpacity
                      style={[
                        styles.bonusButton,
                        dailyBonusClaimed && styles.bonusButtonDisabled,
                      ]}
                      onPress={handleClaimDailyBonus}
                      disabled={dailyBonusClaimed}
                    >
                      <Text style={styles.bonusButtonText}>
                        {dailyBonusClaimed ? "Claimed" : "Claim +50 XP"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View style={styles.streakGrid}>
                <View style={[styles.streakCard, styles.streakCardOrange]}>
                  <View style={styles.streakIconRow}>
                    <Flame size={20} color="#fb7185" />
                    <Text style={styles.streakValue}>{streakDays}</Text>
                  </View>
                  <Text style={styles.streakLabel}>Day Streak</Text>
                  <Text style={styles.streakSub}>Keep it going!</Text>
                </View>
                <View style={[styles.streakCard, styles.streakCardCyan]}>
                  <View style={styles.streakIconRow}>
                    <Target size={20} color="#38bdf8" />
                    <Text style={styles.streakValue}>{comboBonus}x</Text>
                  </View>
                  <Text style={styles.streakLabel}>Combo Bonus</Text>
                  <Text style={styles.streakSub}>
                    {streakDays >= 3 ? "Under budget!" : "Build a streak"}
                  </Text>
                </View>
                <View style={[styles.streakCard, styles.streakCardGreen]}>
                  <View style={styles.streakIconRow}>
                    <Coins size={20} color="#34d399" />
                    <Text style={styles.streakValue}>
                      RM {weeklyEarnings.toFixed(0)}
                    </Text>
                  </View>
                  <Text style={styles.streakLabel}>Weekly Saved</Text>
                  <Text style={styles.streakSub}>{weeklyChangeLabel}</Text>
                </View>
                <View style={[styles.streakCard, styles.streakCardPurple]}>
                  <View style={styles.streakIconRow}>
                    <Calendar size={20} color="#c084fc" />
                    <Text style={styles.streakValue}>
                      {goalsHitCount}/{goalsThisMonth.length}
                    </Text>
                  </View>
                  <Text style={styles.streakLabel}>Goals Hit</Text>
                  <Text style={styles.streakSub}>This month</Text>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleRow}>
                    <Zap size={18} color="#f472b6" />
                    <Text style={styles.sectionTitle}>Power-Ups</Text>
                  </View>
                  <View style={styles.currencySummary}>
                    <View style={styles.currencySummaryItem}>
                      <Coins size={14} color="#94a3b8" />
                      <Text style={styles.currencySummaryText}>{coins}</Text>
                    </View>
                    <View style={styles.currencySummaryItem}>
                      <Gem size={14} color="#94a3b8" />
                      <Text style={styles.currencySummaryText}>{gems}</Text>
                    </View>
                  </View>
                </View>
                {shopError ? (
                  <View style={styles.validationBanner}>
                    <AlertCircle size={14} color="#f87171" />
                    <Text style={styles.validationText}>{shopError}</Text>
                  </View>
                ) : null}
                <View style={styles.powerGrid}>
                  {powerUpItems.map(item => {
                    const Icon = item.icon;
                    const canAfford =
                      item.currency === "coins"
                        ? coins >= item.cost
                        : gems >= item.cost;
                    return (
                      <View
                        key={item.id}
                        style={[styles.powerCard, { borderColor: item.border }]}
                      >
                        <View style={styles.powerCardHeader}>
                          <LinearGradient
                            colors={item.gradient}
                            style={styles.powerIcon}
                          >
                            <Icon size={18} color="#ffffff" />
                          </LinearGradient>
                          {item.owned > 0 ? (
                            <View style={styles.powerOwned}>
                              <Text style={styles.powerOwnedText}>
                                x{item.owned}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.powerTitle}>{item.name}</Text>
                        <Text style={styles.powerDesc}>{item.description}</Text>
                        <View style={styles.powerFooter}>
                          <View style={styles.powerCost}>
                            {item.currency === "coins" ? (
                              <Coins size={12} color="#e5e7eb" />
                            ) : (
                              <Gem size={12} color="#e5e7eb" />
                            )}
                            <Text style={styles.powerCostText}>{item.cost}</Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.powerBuyButton,
                              !canAfford && styles.powerBuyButtonDisabled,
                            ]}
                            onPress={() =>
                              handleBuyPowerUp(item.id, item.cost, item.currency)
                            }
                          >
                            <Text style={styles.powerBuyText}>
                              {canAfford ? "Buy" : "Not enough"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleRow}>
                    <Trophy size={18} color="#f59e0b" />
                    <Text style={styles.sectionTitle}>Leaderboard</Text>
                  </View>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeSub}>This Week</Text>
                  </View>
                </View>
                <View style={styles.leaderboardList}>
                  {leaderboardEntries.length === 0 ? (
                    <Text style={styles.emptyStateText}>
                      No leaderboard data yet.
                    </Text>
                  ) : (
                    leaderboardEntries.map(player => {
                      const rankIcon =
                        player.rank === 1 ? (
                          <Trophy size={16} color="#facc15" />
                        ) : player.rank === 2 ? (
                          <Medal size={16} color="#cbd5f5" />
                        ) : player.rank === 3 ? (
                          <Award size={16} color="#fb923c" />
                        ) : (
                          <Text style={styles.leaderboardRankText}>
                            #{player.rank}
                          </Text>
                        );
                      return (
                        <View
                          key={`${player.rank}-${player.name}`}
                          style={[
                            styles.leaderboardRow,
                            player.isYou && styles.leaderboardRowYou,
                          ]}
                        >
                          <View style={styles.leaderboardRank}>{rankIcon}</View>
                          <View style={styles.leaderboardUser}>
                            <View style={styles.leaderboardAvatar}>
                              <User
                                size={18}
                                color={player.isYou ? "#38bdf8" : "#cbd5f5"}
                              />
                            </View>
                            <View style={styles.leaderboardMeta}>
                              <View style={styles.leaderboardNameRow}>
                                <Text
                                  style={[
                                    styles.leaderboardName,
                                    player.isYou && styles.leaderboardNameYou,
                                  ]}
                                >
                                  {player.name}
                                </Text>
                                {player.isYou ? (
                                  <View style={styles.youBadge}>
                                    <Text style={styles.youBadgeText}>YOU</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.leaderboardLevel}>
                                Level {player.level}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.leaderboardScore}>
                            <Text style={styles.leaderboardXp}>
                              {player.xp.toLocaleString()}
                            </Text>
                            <Text style={styles.leaderboardXpLabel}>XP</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

            </>
          ) : activePanel === "profile" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <User size={18} color="#38bdf8" />
                  <Text style={styles.sectionTitle}>Achievements Earned</Text>
                </View>
              </View>
              <Text style={styles.subsectionTitle}>Achievement Path</Text>
              <View style={styles.achievementList}>
                {achievedMilestones.length > 0 ? (
                  achievedMilestones.map(milestone => {
                    const Icon = milestone.icon;
                    const isClaimed = Boolean(milestoneClaims[milestone.id]);
                    return (
                      <View key={milestone.id} style={styles.achievementRow}>
                        <View style={styles.achievementIcon}>
                          <Icon size={18} color="#e2e8f0" />
                        </View>
                        <View style={styles.achievementInfo}>
                          <Text style={styles.achievementTitle}>
                            {milestone.title}
                          </Text>
                          <Text style={styles.achievementMeta}>
                            {milestone.xpRequired} XP target
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.achievementStatus,
                            isClaimed
                              ? styles.achievementStatusClaimed
                              : styles.achievementStatusReady,
                          ]}
                        >
                          <Text style={styles.achievementStatusText}>
                            {isClaimed ? "Claimed" : "Ready"}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyStateText}>
                    No achievements earned yet.
                  </Text>
                )}
              </View>
              <Text style={styles.subsectionTitle}>Badges Unlocked</Text>
              {unlockedBadges.length > 0 ? (
                <View style={styles.badgeGrid}>
                  {unlockedBadges.map(badge => {
                    const Icon = badge.icon;
                    return (
                      <View
                        key={badge.id}
                        style={[
                          styles.badgeItem,
                          styles.badgeItemUnlocked,
                          { backgroundColor: getRarityColor(badge.rarity) },
                        ]}
                      >
                        <View style={styles.badgeIcon}>
                          <Icon size={22} color="#ffffff" />
                        </View>
                        <Text style={styles.badgeName}>{badge.name}</Text>
                        <View style={styles.badgeRarityPill}>
                          <Text style={styles.badgeRarityText}>
                            {badge.rarity}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyStateText}>
                  No badges unlocked yet.
                </Text>
              )}
            </View>
          ) : activePanel === "achievements" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Star size={18} color="#facc15" />
                  <Text style={styles.sectionTitle}>Achievement Path</Text>
                </View>
              </View>
              <View style={styles.milestoneTrack}>
                <View style={styles.milestoneLine} />
                {milestones.map(milestone => {
                  const progressPercent = Math.min(
                    100,
                    (totalXp / milestone.xpRequired) * 100
                  );
                  const canClaim =
                    totalXp >= milestone.xpRequired &&
                    !milestoneClaims[milestone.id];
                  const Icon = milestone.icon;
                  const iconColor = milestoneClaims[milestone.id]
                    ? "#4ade80"
                    : canClaim
                      ? "#facc15"
                      : "#e2e8f0";
                  return (
                    <View key={milestone.id} style={styles.milestoneRow}>
                      <View
                        style={[
                          styles.milestoneNode,
                          milestoneClaims[milestone.id] &&
                            styles.milestoneNodeClaimed,
                          canClaim && styles.milestoneNodeReady,
                        ]}
                      >
                        <Icon size={18} color={iconColor} />
                      </View>
                      <View style={styles.milestoneCard}>
                        <View style={styles.milestoneHeader}>
                          <View>
                            <Text style={styles.milestoneTitle}>
                              {milestone.title}
                            </Text>
                            <Text style={styles.milestoneSub}>
                              Reach {milestone.xpRequired} XP total
                            </Text>
                          </View>
                          {milestoneClaims[milestone.id] ? (
                            <View style={styles.milestoneClaimed}>
                              <Text style={styles.milestoneClaimedText}>
                                Claimed
                              </Text>
                            </View>
                          ) : canClaim ? (
                            <TouchableOpacity
                              style={styles.milestoneClaimButton}
                              onPress={() => handleClaimMilestone(milestone)}
                            >
                              <Text style={styles.milestoneClaimButtonText}>
                                Claim +{milestone.reward} XP
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.milestoneRewardPill}>
                              <Text style={styles.milestoneRewardText}>
                                +{milestone.reward} XP
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.milestoneProgressTrack}>
                          <View
                            style={[
                              styles.milestoneProgressFill,
                              { width: `${progressPercent}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.milestoneProgressText}>
                          {totalXp} / {milestone.xpRequired} XP
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : activePanel === "lucky-spin" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Sparkles size={18} color="#f472b6" />
                  <Text style={styles.sectionTitle}>Lucky Spin</Text>
                </View>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>
                    {spinsLeft} spin{spinsLeft !== 1 ? "s" : ""} left
                  </Text>
                </View>
              </View>
              <View style={styles.spinRow}>
                <Animated.View
                  style={[
                    styles.spinWheel,
                    {
                      transform: [
                        {
                          rotate: spinRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "360deg"],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.spinWheelRing} />
                  <View style={styles.spinWheelInner}>
                    <View style={[styles.spinWheelIcon, styles.spinWheelIconTop]}>
                      <Coins size={14} color="#facc15" />
                    </View>
                    <View style={[styles.spinWheelIcon, styles.spinWheelIconRight]}>
                      <Gem size={14} color="#38bdf8" />
                    </View>
                    <View style={[styles.spinWheelIcon, styles.spinWheelIconBottom]}>
                      <Zap size={14} color="#fb923c" />
                    </View>
                    <View style={[styles.spinWheelIcon, styles.spinWheelIconLeft]}>
                      <Gift size={14} color="#f472b6" />
                    </View>
                    <View style={styles.spinWheelCenter}>
                      <Sparkles size={14} color="#e2e8f0" />
                    </View>
                  </View>
                  <View style={styles.spinPointer} />
                </Animated.View>
                <View style={styles.spinInfo}>
                  {lastSpinReward ? (
                    <View style={styles.spinRewardCard}>
                      <Text style={styles.spinRewardTitle}>You won!</Text>
                      <Text style={styles.spinRewardValue}>
                        {lastSpinReward.amount}{" "}
                        {lastSpinReward.type === "xp"
                          ? "XP"
                          : lastSpinReward.type === "coins"
                            ? "Coins"
                            : "Gems"}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.spinInfoTitle}>Daily Free Spin!</Text>
                      <Text style={styles.spinInfoSub}>
                        Win coins, gems, or XP boosts
                      </Text>
                    </>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.spinButton,
                      (isSpinning || spinsLeft <= 0) &&
                        styles.spinButtonDisabled,
                    ]}
                    onPress={handleSpin}
                    disabled={isSpinning || spinsLeft <= 0}
                  >
                    <Text style={styles.spinButtonText}>
                      {isSpinning
                        ? "Spinning..."
                        : spinsLeft > 0
                          ? "Spin Now"
                          : "No spins left"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.spinRewardsRow}>
                <View style={styles.spinRewardTile}>
                  <Coins size={16} color="#facc15" />
                  <Text style={styles.spinTileLabel}>100-500</Text>
                </View>
                <View style={styles.spinRewardTile}>
                  <Gem size={16} color="#38bdf8" />
                  <Text style={styles.spinTileLabel}>5-25</Text>
                </View>
                <View style={styles.spinRewardTile}>
                  <Zap size={16} color="#fb923c" />
                  <Text style={styles.spinTileLabel}>50-200 XP</Text>
                </View>
                <View style={styles.spinRewardTile}>
                  <Gift size={16} color="#f472b6" />
                  <Text style={styles.spinTileLabel}>Mystery</Text>
                </View>
              </View>
            </View>
          ) : activePanel === "badges" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Award size={18} color="#f472b6" />
                  <View>
                    <Text style={styles.sectionTitle}>Badge Collection</Text>
                    <Text style={styles.sectionSubtitle}>
                      {unlockedBadgeCount} of {badges.length} unlocked
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sectionLink}
                  onPress={() => handleMenuSelect("badges")}
                >
                  <Text style={styles.sectionLinkText}>{"View All ->"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.badgeProgressTrack}>
                <View
                  style={[
                    styles.badgeProgressFill,
                    {
                      width: `${(unlockedBadgeCount / badges.length) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.badgeGrid}>
                {badges.map(badge => {
                  const Icon = badge.icon;
                  return (
                    <View
                      key={badge.id}
                      style={[
                        styles.badgeItem,
                        badge.unlocked
                          ? styles.badgeItemUnlocked
                          : styles.badgeItemLocked,
                        badge.unlocked && {
                          backgroundColor: getRarityColor(badge.rarity),
                        },
                      ]}
                    >
                      {!badge.unlocked ? (
                        <View style={styles.badgeLockOverlay}>
                          <Lock size={18} color="#6b7280" />
                        </View>
                      ) : null}
                      <View style={styles.badgeIcon}>
                        <Icon
                          size={22}
                          color={badge.unlocked ? "#ffffff" : "#64748b"}
                        />
                      </View>
                      <Text style={styles.badgeName}>{badge.name}</Text>
                      {badge.unlocked ? (
                        <View style={styles.badgeRarityPill}>
                          <Text style={styles.badgeRarityText}>
                            {badge.rarity}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : activePanel === "shop" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <ShoppingBag size={18} color="#38bdf8" />
                  <Text style={styles.sectionTitle}>XP Exchange</Text>
                </View>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>
                    {Math.max(0, nextXp - totalXp)} XP to level up
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Trade coins, gems, or XP for rewards. XP trades use bonus XP only.
              </Text>
              <View style={styles.shopWalletRow}>
                <View style={styles.shopWalletPill}>
                  <Coins size={14} color="#facc15" />
                  <Text style={styles.shopWalletText}>{coins}</Text>
                </View>
                <View style={styles.shopWalletPill}>
                  <Gem size={14} color="#38bdf8" />
                  <Text style={styles.shopWalletText}>{gems}</Text>
                </View>
                <View style={styles.shopWalletPill}>
                  <Zap size={14} color="#fb923c" />
                  <Text style={styles.shopWalletText}>{xpWallet} XP</Text>
                </View>
              </View>
              {shopError ? (
                <View style={styles.validationBanner}>
                  <AlertCircle size={14} color="#f87171" />
                  <Text style={styles.validationText}>{shopError}</Text>
                </View>
              ) : null}
              <View style={styles.shopGrid}>
                {shopCatalog.map(item => {
                  const badgeOwned =
                    item.reward.type === "badge" && item.reward.badgeId
                      ? Boolean(arcadeState?.shopBadges?.[item.reward.badgeId])
                      : false;
                  return (
                    <View key={item.id} style={styles.shopCard}>
                      <View style={styles.shopCardHeader}>
                        <Text style={styles.shopCardTitle}>{item.title}</Text>
                        <View style={styles.shopPill}>
                          {item.reward.type === "coins" ? (
                            <Coins size={12} color="#facc15" />
                          ) : item.reward.type === "gems" ? (
                            <Gem size={12} color="#38bdf8" />
                          ) : item.reward.type === "xp" ? (
                            <Zap size={12} color="#fb923c" />
                          ) : (
                            <Award size={12} color="#f472b6" />
                          )}
                          <Text style={styles.shopPillText}>
                            {item.reward.type === "badge"
                              ? "Badge"
                              : `+${item.reward.amount}`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.shopCardDesc}>{item.description}</Text>
                      {badgeOwned ? (
                        <Text style={styles.shopOwnedText}>Owned</Text>
                      ) : null}
                      <View style={styles.shopFooter}>
                        <View style={styles.shopOfferList}>
                          {item.offers.map(offer => {
                            const canAfford =
                              offer.currency === "coins"
                                ? coins >= offer.cost
                                : offer.currency === "gems"
                                  ? gems >= offer.cost
                                  : xpWallet >= offer.cost;
                            const disabled = badgeOwned || !canAfford;
                            return (
                              <TouchableOpacity
                                key={`${item.id}-${offer.currency}-${offer.cost}`}
                                style={[
                                  styles.shopBuyButton,
                                  disabled && styles.shopBuyButtonDisabled,
                                ]}
                                onPress={() => handleShopPurchase(item, offer)}
                                disabled={disabled}
                              >
                                <Text style={styles.shopBuyText}>
                                  {offer.cost}{" "}
                                  {offer.currency === "xp"
                                    ? "XP"
                                    : offer.currency === "coins"
                                      ? "Coins"
                                      : "Gems"}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Target size={18} color="#34d399" />
                  <Text style={styles.sectionTitle}>Weekly Challenges</Text>
                </View>
              </View>
              <Text style={styles.subsectionTitle}>Current Week</Text>
              <View style={styles.challengeList}>
                {currentWeekChallenges.length > 0 ? (
                  currentWeekChallenges.map(challenge =>
                    renderChallengeCard(challenge)
                  )
                ) : (
                  <Text style={styles.emptyStateText}>
                    No active challenges this week.
                  </Text>
                )}
              </View>
              {currentWeekChallenges.some(challenge => challenge.claimed) ? (
                <TouchableOpacity
                  style={styles.resetClaimsButton}
                  onPress={handleResetWeeklyClaims}
                >
                  <Text style={styles.resetClaimsText}>
                    Reset this week claims
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.subsectionTitle}>Upcoming Next Week</Text>
              <View style={styles.challengeList}>
                {nextWeekChallenges.length > 0 ? (
                  nextWeekChallenges.map(challenge =>
                    renderChallengeCard(challenge, { isUpcoming: true })
                  )
                ) : (
                  <Text style={styles.emptyStateText}>
                    No upcoming challenges yet.
                  </Text>
                )}
              </View>
              <Text style={styles.subsectionTitle}>Past Weeks</Text>
              <View style={styles.challengeList}>
                {claimedHistory.length > 0 ? (
                  claimedHistory.map(challenge =>
                    renderChallengeCard(challenge, { isPast: true })
                  )
                ) : (
                  <Text style={styles.emptyStateText}>
                    No past challenges yet.
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#e5e7eb" },
  headerSubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  panelBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  panelTitle: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  panelSpacer: { width: 32 },
  levelCard: {
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  levelTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  levelLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250, 204, 21, 0.9)",
  },
  levelLabel: { fontSize: 12, color: "rgba(255, 255, 255, 0.7)" },
  levelValue: { fontSize: 28, fontWeight: "800", color: "#ffffff" },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  currencyPillAlt: { backgroundColor: "rgba(59, 130, 246, 0.85)" },
  currencyValue: { fontSize: 14, fontWeight: "700", color: "#111827" },
  currencyValueAlt: { color: "#ffffff" },
  shopButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  xpText: { fontSize: 12, color: "rgba(255, 255, 255, 0.85)" },
  xpToLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 146, 60, 0.35)",
  },
  xpToLevelText: { fontSize: 12, fontWeight: "700", color: "#fed7aa" },
  xpTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    overflow: "hidden",
    marginTop: 10,
  },
  xpFill: { height: 10, borderRadius: 999, backgroundColor: "#facc15" },
  levelFooter: { marginTop: 12, gap: 10 },
  nextUnlockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 14,
    padding: 10,
  },
  nextUnlockIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(126, 34, 206, 0.3)",
  },
  nextUnlockLabel: { fontSize: 10, color: "rgba(255, 255, 255, 0.7)" },
  nextUnlockTitle: { fontSize: 12, fontWeight: "700", color: "#ffffff" },
  convertButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  convertButtonDisabled: { opacity: 0.5 },
  convertButtonText: { fontSize: 12, fontWeight: "700", color: "#e2e8f0" },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#1e1038",
    borderWidth: 1,
    borderColor: "#3d2b5f",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  sectionSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  sectionHighlight: { color: "#facc15", fontWeight: "700" },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3d2b5f",
    backgroundColor: "#0f0820",
  },
  sectionBadgeText: { fontSize: 12, color: "#38bdf8", fontWeight: "700" },
  sectionBadgeSub: { fontSize: 12, color: "#94a3b8" },
  questList: { gap: 10 },
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#0f0820",
    borderWidth: 1,
    borderColor: "#2d1b4e",
  },
  questRowDone: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  questContent: { flex: 1 },
  questTitle: { fontSize: 14, fontWeight: "600", color: "#e5e7eb" },
  questProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  questProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#0a0118",
    overflow: "hidden",
  },
  questProgressFill: { height: 6, borderRadius: 999, backgroundColor: "#38bdf8" },
  questProgressText: { fontSize: 11, color: "#9ca3af" },
  questRewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  questRewardText: { fontSize: 12, fontWeight: "700", color: "#fdba74" },
  bonusRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  bonusText: { fontSize: 13, fontWeight: "700", color: "#facc15" },
  bonusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.9)",
  },
  bonusButtonDisabled: { backgroundColor: "rgba(148, 163, 184, 0.4)" },
  bonusButtonText: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  streakGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  streakCard: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  streakCardOrange: { backgroundColor: "rgba(251, 146, 60, 0.15)" },
  streakCardCyan: { backgroundColor: "rgba(56, 189, 248, 0.15)" },
  streakCardGreen: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  streakCardPurple: { backgroundColor: "rgba(168, 85, 247, 0.15)" },
  streakIconRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  streakValue: { fontSize: 18, fontWeight: "800", color: "#ffffff" },
  streakLabel: { fontSize: 12, fontWeight: "700", color: "#e5e7eb" },
  streakSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  currencySummary: { flexDirection: "row", gap: 12, alignItems: "center" },
  currencySummaryItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  currencySummaryText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  validationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  validationText: { fontSize: 11, color: "#fecaca", flex: 1 },
  shopGrid: {
    marginTop: 12,
    gap: 12,
  },
  shopWalletRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  shopWalletPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  shopWalletText: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },
  shopCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  shopCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shopCardTitle: { color: "#e5e7eb", fontSize: 14, fontWeight: "700" },
  shopCardDesc: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  shopOwnedText: { color: "#4ade80", fontSize: 11, marginTop: 8, fontWeight: "700" },
  shopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  shopPillText: { color: "#fdba74", fontSize: 12, fontWeight: "700" },
  shopFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  shopOfferList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  shopCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shopCostText: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },
  shopBuyButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#38bdf8",
  },
  shopBuyButtonDisabled: { backgroundColor: "rgba(148, 163, 184, 0.35)" },
  shopBuyText: { color: "#0b1220", fontSize: 12, fontWeight: "700" },
  powerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  powerCard: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    backgroundColor: "#0f0820",
  },
  powerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  powerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  powerOwned: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  powerOwnedText: { fontSize: 11, fontWeight: "700", color: "#111827" },
  powerTitle: { fontSize: 13, fontWeight: "700", color: "#e5e7eb" },
  powerDesc: { fontSize: 11, color: "#94a3b8", marginTop: 4, marginBottom: 10 },
  powerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  powerCost: { flexDirection: "row", alignItems: "center", gap: 4 },
  powerCostText: { fontSize: 12, fontWeight: "700", color: "#e5e7eb" },
  powerBuyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(168, 85, 247, 0.9)",
  },
  powerBuyButtonDisabled: { backgroundColor: "rgba(148, 163, 184, 0.35)" },
  powerBuyText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  spinRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  spinWheel: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0820",
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.3)",
  },
  spinWheelRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#ec4899",
  },
  spinWheelInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1020",
  },
  spinWheelIcon: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  spinWheelIconTop: {
    top: -8,
    left: "50%",
    transform: [{ translateX: -13 }],
  },
  spinWheelIconRight: {
    right: -8,
    top: "50%",
    transform: [{ translateY: -13 }],
  },
  spinWheelIconBottom: {
    bottom: -8,
    left: "50%",
    transform: [{ translateX: -13 }],
  },
  spinWheelIconLeft: {
    left: -8,
    top: "50%",
    transform: [{ translateY: -13 }],
  },
  spinWheelCenter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0820",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
  },
  spinPointer: {
    position: "absolute",
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#facc15",
  },
  spinInfo: { flex: 1 },
  spinRewardCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    marginBottom: 10,
  },
  spinRewardTitle: { fontSize: 12, fontWeight: "700", color: "#4ade80" },
  spinRewardValue: { fontSize: 16, fontWeight: "800", color: "#ffffff", marginTop: 4 },
  spinInfoTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  spinInfoSub: { fontSize: 12, color: "#94a3b8", marginTop: 4, marginBottom: 10 },
  spinButton: {
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(236, 72, 153, 0.9)",
    alignItems: "center",
  },
  spinButtonDisabled: { backgroundColor: "rgba(148, 163, 184, 0.35)" },
  spinButtonText: { fontSize: 13, fontWeight: "700", color: "#ffffff" },
  spinRewardsRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  spinRewardTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    backgroundColor: "#0f0820",
    alignItems: "center",
    gap: 6,
  },
  spinTileLabel: { fontSize: 10, color: "#94a3b8", marginTop: 4 },
  leaderboardList: { gap: 10 },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2d1b4e",
    backgroundColor: "#0f0820",
    gap: 10,
  },
  leaderboardRowYou: {
    borderColor: "rgba(34, 211, 238, 0.6)",
    backgroundColor: "rgba(14, 116, 144, 0.25)",
  },
  leaderboardRank: { width: 24, alignItems: "center" },
  leaderboardRankText: { color: "#64748b", fontWeight: "700" },
  leaderboardUser: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  leaderboardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  leaderboardMeta: { flex: 1 },
  leaderboardNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leaderboardName: { fontSize: 12, fontWeight: "700", color: "#e5e7eb" },
  leaderboardNameYou: { color: "#38bdf8" },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#0ea5e9",
  },
  youBadgeText: { fontSize: 10, fontWeight: "700", color: "#ffffff" },
  leaderboardLevel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  leaderboardScore: { alignItems: "flex-end" },
  leaderboardXp: { fontSize: 13, fontWeight: "700", color: "#e5e7eb" },
  leaderboardXpLabel: { fontSize: 10, color: "#94a3b8" },
  leaderboardButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(147, 51, 234, 0.9)",
    alignItems: "center",
  },
  leaderboardButtonText: { fontSize: 13, fontWeight: "700", color: "#ffffff" },
  sectionLink: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  sectionLinkText: { fontSize: 12, color: "#38bdf8", fontWeight: "700" },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5f5",
    marginTop: 4,
    marginBottom: 8,
  },
  emptyStateText: { fontSize: 12, color: "#94a3b8", paddingVertical: 6 },
  achievementList: { gap: 10, marginBottom: 12 },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#0f0820",
    borderWidth: 1,
    borderColor: "#2d1b4e",
  },
  achievementIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  achievementInfo: { flex: 1 },
  achievementTitle: { fontSize: 13, fontWeight: "700", color: "#e5e7eb" },
  achievementMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  achievementStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  achievementStatusClaimed: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  achievementStatusReady: {
    borderColor: "rgba(250, 204, 21, 0.4)",
    backgroundColor: "rgba(250, 204, 21, 0.2)",
  },
  achievementStatusText: { fontSize: 10, fontWeight: "700", color: "#e5e7eb" },
  challengeList: { gap: 12 },
  challengeCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2d1b4e",
    backgroundColor: "#0f0820",
    gap: 8,
  },
  challengeCardCompleted: { borderColor: "rgba(34, 197, 94, 0.35)" },
  challengeTopRow: { flexDirection: "row", justifyContent: "space-between" },
  challengeTitleWrap: { flex: 1 },
  challengeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  challengeTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  challengeDesc: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  difficultyEasy: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  difficultyMedium: {
    borderColor: "rgba(234, 179, 8, 0.4)",
    backgroundColor: "rgba(234, 179, 8, 0.2)",
  },
  difficultyHard: {
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  difficultyText: { fontSize: 10, fontWeight: "700", color: "#e5e7eb" },
  challengeMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  challengeMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  challengeMetaText: { fontSize: 10, color: "#94a3b8" },
  challengeRewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  challengeRewardText: { fontSize: 11, fontWeight: "700", color: "#fdba74" },
  challengeProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0a0118",
    overflow: "hidden",
  },
  challengeProgressFill: { height: 8, borderRadius: 999, backgroundColor: "#38bdf8" },
  challengeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  challengeProgressText: { fontSize: 10, color: "#94a3b8" },
  progressButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#0ea5e9",
  },
  progressButtonText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  claimButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.9)",
  },
  claimButtonText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  claimedText: { fontSize: 11, fontWeight: "700", color: "#4ade80" },
  pendingText: { fontSize: 11, fontWeight: "700", color: "#60a5fa" },
  resetClaimsButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    backgroundColor: "rgba(248, 113, 113, 0.12)",
  },
  resetClaimsText: { fontSize: 11, fontWeight: "700", color: "#fca5a5" },
  milestoneTrack: { gap: 12, position: "relative" },
  milestoneLine: {
    position: "absolute",
    left: 18,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: "rgba(56, 189, 248, 0.3)",
  },
  milestoneRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  milestoneNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3d2b5f",
    backgroundColor: "#0f0820",
  },
  milestoneNodeClaimed: {
    borderColor: "#4ade80",
    backgroundColor: "rgba(34, 197, 94, 0.25)",
  },
  milestoneNodeReady: {
    borderColor: "#facc15",
    backgroundColor: "rgba(234, 179, 8, 0.25)",
  },
  milestoneEmoji: { fontSize: 18 },
  milestoneCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2d1b4e",
    backgroundColor: "#0f0820",
    padding: 12,
  },
  milestoneHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  milestoneTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  milestoneSub: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  milestoneClaimed: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  milestoneClaimedText: { fontSize: 10, fontWeight: "700", color: "#4ade80" },
  milestoneClaimButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.95)",
  },
  milestoneClaimButtonText: { fontSize: 10, fontWeight: "700", color: "#0f172a" },
  milestoneRewardPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(251, 146, 60, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.4)",
  },
  milestoneRewardText: { fontSize: 10, fontWeight: "700", color: "#fdba74" },
  milestoneProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#0a0118",
    overflow: "hidden",
    marginTop: 8,
  },
  milestoneProgressFill: { height: 6, borderRadius: 999, backgroundColor: "#38bdf8" },
  milestoneProgressText: { fontSize: 10, color: "#94a3b8", marginTop: 4 },
  badgeProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#0f0820",
    overflow: "hidden",
    marginBottom: 12,
  },
  badgeProgressFill: { height: 8, borderRadius: 999, backgroundColor: "#38bdf8" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeItem: {
    width: "30%",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
    position: "relative",
  },
  badgeItemUnlocked: { backgroundColor: "#2d1b4e" },
  badgeItemLocked: { backgroundColor: "#0f0820", borderWidth: 1, borderColor: "#2d1b4e" },
  badgeLockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.6)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIcon: { marginBottom: 6 },
  badgeName: { fontSize: 10, fontWeight: "700", color: "#ffffff", textAlign: "center" },
  badgeRarityPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  badgeRarityText: { fontSize: 9, fontWeight: "700", color: "#ffffff" },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuSheet: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: "#0f0820",
    borderWidth: 1,
    borderColor: "#2d1b4e",
    padding: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(30, 16, 56, 0.8)",
    marginTop: 10,
  },
  menuItemText: { flex: 1, fontSize: 13, color: "#e2e8f0", fontWeight: "600" },
  bgBlob: { opacity: 0.22 },
  bgBlobAlt: { opacity: 0.18 },
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

const getDateKeyFromValue = (value: any) => {
  if (!value) return "";
  if (value instanceof Date) return getDateKey(value);
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value?.toDate === "function") return getDateKey(value.toDate());
  if (typeof value?.seconds === "number") return getDateKey(new Date(value.seconds * 1000));
  return "";
};

const getDaysInMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;


const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekKey = (date: Date) => getDateKey(getStartOfWeek(date));

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
  const storedNet = Number(log.netHours ?? log.net_hours ?? 0);
  if (storedNet > 0) return storedNet;
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

const getWeeklyEarnings = (logs: any[], hourlyRate: number, offsetWeeks: number) => {
  const start = getStartOfWeek(new Date());
  start.setDate(start.getDate() - offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return logs.reduce((sum, log) => {
    const date = log?.date ? new Date(`${log.date}T00:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return sum;
    if (date < start || date > end) return sum;
    const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
    if (finalPay > 0) return sum + finalPay;
    return sum + getLogHours(log) * hourlyRate;
  }, 0);
};

const getMonthlyEarnings = (logs: any[], hourlyRate: number) => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return logs.reduce((sum, log) => {
    const date = log?.date ? new Date(`${log.date}T00:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return sum;
    if (date.getMonth() !== month || date.getFullYear() !== year) return sum;
    const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
    if (finalPay > 0) return sum + finalPay;
    return sum + getLogHours(log) * hourlyRate;
  }, 0);
};

const buildChallenges = (
  {
    goals,
    activeGoals,
    streakDays,
    weeklyShiftCount,
  }: {
    goals: Goal[];
    activeGoals: Goal[];
    streakDays: number;
    weeklyShiftCount: number;
  },
  weekStartDate?: Date
): Challenge[] => {
  const weekStart = getStartOfWeek(weekStartDate ?? new Date());
  const weekSeed = Math.floor(
    weekStart.getTime() / (1000 * 60 * 60 * 24 * 7)
  );
  const variant = Math.abs(weekSeed) % 3;
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

  const saveBonus = variant === 0 ? 0 : variant === 1 ? 10 : 20;
  const shiftTarget = variant === 0 ? 4 : variant === 1 ? 5 : 3;
  const streakTarget = variant === 0 ? 3 : variant === 1 ? 4 : 2;
  const saveTitle =
    variant === 2
      ? `Boost RM ${saveTarget + saveBonus} this week`
      : primaryGoal
        ? `Save RM ${saveTarget + saveBonus} this week`
        : `Start saving RM ${20 + saveBonus}`;

  return [
    {
      id: "weekly-save",
      title: saveTitle,
      description: primaryGoal
        ? `Boost your goal: ${primaryGoal.name}`
        : "Kickstart your savings habit",
      unit: "RM",
      target: saveTarget + saveBonus,
      progress: primaryGoal ? Math.min(saveProgress, saveTarget + saveBonus) : 0,
      rewardXp: variant === 1 ? 70 : variant === 2 ? 80 : 60,
      rewardCoins: variant === 1 ? 14 : variant === 2 ? 16 : 12,
      startDate,
      endDate,
      completed: primaryGoal ? saveProgress >= saveTarget + saveBonus : false,
      meta: primaryGoal ? { goalId: primaryGoal.id } : undefined,
    },
    {
      id: "weekly-shifts",
      title: `Log ${shiftTarget} shifts this week`,
      description:
        variant === 2 ? "Push for a flexible week" : "Stay consistent with work logs",
      unit: "shifts",
      target: shiftTarget,
      progress: weeklyShiftCount,
      rewardXp: shiftTarget === 5 ? 50 : shiftTarget === 3 ? 30 : 40,
      rewardCoins: shiftTarget === 5 ? 12 : shiftTarget === 3 ? 6 : 10,
      startDate,
      endDate,
      completed: weeklyShiftCount >= shiftTarget,
    },
    {
      id: "streak-mini",
      title: `Keep a ${streakTarget}-day streak`,
      description: `Log shifts ${streakTarget} days in a row`,
      unit: "days",
      target: streakTarget,
      progress: streakDays,
      rewardXp: streakTarget === 4 ? 45 : streakTarget === 2 ? 20 : 30,
      rewardCoins: streakTarget === 4 ? 12 : streakTarget === 2 ? 6 : 8,
      startDate,
      endDate,
      completed: streakDays >= streakTarget,
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
    const sameWindow = saved.startDate === ch.startDate && saved.endDate === ch.endDate;
    return {
      ...ch,
      startDate: saved.startDate || ch.startDate,
      endDate: saved.endDate || ch.endDate,
      rewardXp: saved.rewardXp ?? ch.rewardXp,
      rewardCoins: saved.rewardCoins ?? ch.rewardCoins,
      meta: saved.meta ?? ch.meta,
      claimed: sameWindow ? saved.claimed ?? false : false,
    };
  });
};


const getTimeLeftLabel = (endDate: string) => {
  if (!endDate) return "";
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(end.getTime())) return "";
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Completed";
  return `${diff}d left`;
};

const getDifficultyLabel = (rewardXp: number) => {
  if (rewardXp >= 50) return "Hard";
  if (rewardXp >= 35) return "Medium";
  return "Easy";
};

const getRarityColor = (rarity: Badge["rarity"]) => {
  switch (rarity) {
    case "Mythic":
      return "#a855f7";
    case "Legendary":
      return "#f59e0b";
    case "Epic":
      return "#8b5cf6";
    case "Rare":
      return "#38bdf8";
    case "Common":
    default:
      return "#475569";
  }
};
