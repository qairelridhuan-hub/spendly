import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  Gem,
  Flame,
  Lock,
  Menu,
  ShoppingBag,
  AlertCircle,
  ChevronRight,
  Home,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
  Search,
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
  TextInput,
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
import { auth, db } from "../lib/firebase";
import { useTheme } from "../lib/context";
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
  lastLevel?: number;
  powerUps?: {
    xpBoost: number;
    shield: number;
    multiplier: number;
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
  | "badges"
  | "challenges"
  | "quests"
  | "powerups"
  | "leaderboard"
  | "shop";

export default function GameScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DashboardPanel>("main");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopQuery, setShopQuery] = useState("");
  const [shopSearchOpen, setShopSearchOpen] = useState(false);
  const shopSearchAnim = useRef(new Animated.Value(0)).current;
  const shopSearchInputRef = useRef<TextInput>(null);

  const toggleShopSearch = () => {
    if (shopSearchOpen) {
      setShopQuery("");
      Animated.timing(shopSearchAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setShopSearchOpen(false));
    } else {
      setShopSearchOpen(true);
      Animated.timing(shopSearchAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => shopSearchInputRef.current?.focus());
    }
  };
  const [showAllShop, setShowAllShop] = useState(false);
  const xpGlowAnim = useRef(new Animated.Value(0.2)).current;
  const titleGlowAnim = useRef(new Animated.Value(0.6)).current;
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
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    { rank: number; name: string; level: number; xp: number; isYou: boolean }[]
  >([]);
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
        lastLevel: 1,
        powerUps: {
          xpBoost: 0,
          shield: 0,
          multiplier: 0,
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
  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(xpGlowAnim, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(xpGlowAnim, {
          toValue: 0.2,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [xpGlowAnim]);
  useEffect(() => {
    const titleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(titleGlowAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: false,
        }),
        Animated.timing(titleGlowAnim, {
          toValue: 0.6,
          duration: 1100,
          useNativeDriver: false,
        }),
      ])
    );
    titleLoop.start();
    return () => titleLoop.stop();
  }, [titleGlowAnim]);
  const coins = arcadeState?.coins ?? 0;
  const gems = arcadeState?.gems ?? 0;
  const xpWallet = Math.max(0, arcadeState?.bonusXp ?? 0);
  const powerUps = arcadeState?.powerUps ?? {
    xpBoost: 0,
    shield: 0,
    multiplier: 0,
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
  const xpGlowOpacity = xpGlowAnim;
  const panelTitle =
    activePanel === "profile"
      ? "Profile Achievements"
      : activePanel === "achievements"
        ? "Achievement Path"
        : activePanel === "badges"
          ? "Badge Collection"
          : activePanel === "challenges"
            ? "Weekly Challenges"
            : activePanel === "quests"
            ? "Daily Quests"
            : activePanel === "powerups"
            ? "Power-Ups"
            : activePanel === "leaderboard"
            ? "Leaderboard"
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
    const percent = challenge.target === 0 ? 0 : Math.min(100, (challenge.progress / challenge.target) * 100);
    const difficulty = getDifficultyLabel(challenge.rewardXp);
    return (
      <View key={challenge.id} style={[styles.challengeCard, challenge.completed && styles.challengeCardDone]}>
        <View style={styles.challengeTopRow}>
          <View style={styles.challengeTitleWrap}>
            <View style={styles.challengeTitleRow}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View style={[styles.difficultyBadge, difficulty === "Easy" ? styles.difficultyEasy : difficulty === "Medium" ? styles.difficultyMedium : styles.difficultyHard]}>
                <Text style={styles.difficultyText}>{difficulty}</Text>
              </View>
            </View>
            <Text style={styles.challengeDesc}>{challenge.description}</Text>
          </View>
        </View>
        <View style={styles.challengeMetaRow}>
          <View style={styles.challengeMetaItem}>
            <Clock size={11} color={colors.textMuted} />
            <Text style={styles.challengeMetaText}>
              {isUpcoming ? "Next week" : isPast ? "Finished" : challenge.completed ? "Completed" : getTimeLeftLabel(challenge.endDate)}
            </Text>
          </View>
          <View style={styles.challengeRewardPill}>
            <Text style={styles.challengeRewardText}>+{challenge.rewardXp} XP</Text>
          </View>
        </View>
        <View style={styles.challengeTrack}>
          <View style={[styles.challengeFill, { width: `${percent}%` as any }]} />
        </View>
        <View style={styles.challengeFooter}>
          <Text style={styles.challengeProgressText}>{challenge.progress} / {challenge.target} {challenge.unit}</Text>
          {isUpcoming ? (
            <Text style={styles.pendingText}>Pending</Text>
          ) : isPast ? (
            <Text style={styles.claimedText}>{challenge.claimed ? "Claimed" : "Missed"}</Text>
          ) : challenge.completed ? (
            challenge.claimed ? (
              <Text style={styles.claimedText}>Claimed</Text>
            ) : (
              <TouchableOpacity style={styles.challengeClaimBtn} onPress={() => handleClaimChallenge(challenge)}>
                <Text style={styles.challengeClaimBtnText}>Claim</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity style={styles.challengeBtn} onPress={() => handleChallengeAction(challenge.id)}>
              <Text style={styles.challengeBtnText}>Go</Text>
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

  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale   = useRef(new Animated.Value(0.88)).current;
  const splashTextOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!arcadeReady) {
      splashOpacity.setValue(0);
      splashScale.setValue(0.88);
      splashTextOp.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(splashOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.spring(splashScale,   { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        ]),
        Animated.timing(splashTextOp, { toValue: 1, duration: 400, delay: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [arcadeReady]);

  if (!arcadeReady) {
    return (
      <View style={[styles.screen, styles.splashScreen]}>
        <SafeAreaView style={styles.splashSafe}>
          <View style={styles.splashCenter}>
            <Animated.View style={[styles.splashIconWrap, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
              <Trophy size={32} color={colors.text} />
            </Animated.View>
            <Animated.View style={[styles.splashText, { opacity: splashTextOp }]}>
              <Text style={styles.splashTitle}>Arcade</Text>
              <Text style={styles.splashSub}>Loading your progress…</Text>
            </Animated.View>
          </View>
          <Animated.View style={[styles.splashFooter, { opacity: splashTextOp }]}>
            <View style={styles.splashDots}>
              {[0, 1, 2].map(i => <View key={i} style={[styles.splashDot, i === 1 && styles.splashDotActive]} />)}
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Navigation menu modal ───────────────────────── */}
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuTitle}>Menu</Text>
            {([
              { panel: "main",         label: "Dashboard",          icon: Home },
              { panel: "profile",      label: "Profile",            icon: User },
              { panel: "achievements", label: "Achievements",       icon: Trophy },
              { panel: "badges",       label: "Badges",             icon: Award },
              { panel: "challenges",   label: "Challenges",         icon: Target },
              { panel: "shop",         label: "Market",             icon: ShoppingBag },
            ] as { panel: DashboardPanel; label: string; icon: any }[]).map(({ panel, label, icon: Icon }) => (
              <TouchableOpacity key={panel} style={styles.menuItem} onPress={() => handleMenuSelect(panel)}>
                <Icon size={16} color={activePanel === panel ? colors.text : colors.textMuted} />
                <Text style={[styles.menuItemText, activePanel === panel && styles.menuItemActive]}>{label}</Text>
                <ChevronRight size={14} color={colors.border} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => activePanel === "main" ? router.back() : setActivePanel("main")}>
            <ArrowLeft size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {activePanel === "main" ? "Arcade" : activePanel === "shop" ? "Market" : panelTitle}
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setActivePanel("shop")}>
              <ShoppingBag size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
              <Menu size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ══ MAIN ══════════════════════════════════════════ */}
          {isMainPanel ? (
            <>
              {/* Level card */}
              <View style={styles.levelCard}>
                <View style={styles.levelCardTop}>
                  <View>
                    <Text style={styles.levelLabel}>Level</Text>
                    <Text style={styles.levelValue}>{level}</Text>
                  </View>
                  <View style={styles.levelRight}>
                    <View style={styles.currencyRow}>
                      <Coins size={14} color={colors.textMuted} />
                      <Text style={styles.currencyText}>{coins}</Text>
                    </View>
                    <View style={styles.currencyRow}>
                      <Gem size={14} color={colors.textMuted} />
                      <Text style={styles.currencyText}>{gems}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.xpRow}>
                  <Text style={styles.xpLabel}>{totalXp} / {nextXp} XP</Text>
                  <Text style={styles.xpHint}>{xpToLevel} to level up</Text>
                </View>
                <View style={styles.xpTrack}>
                  <Animated.View style={[styles.xpFill, { width: xpFillWidth }]} />
                </View>
                <TouchableOpacity
                  style={[styles.convertBtn, coins < 10 && styles.convertBtnDisabled]}
                  onPress={handleConvertCoins}
                  disabled={coins < 10}
                >
                  <Text style={[styles.convertBtnText, coins < 10 && styles.convertBtnTextDisabled]}>
                    Convert 10 coins → +10 XP
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                {[
                  { icon: Flame,    value: String(streakDays),                   label: "Day Streak" },
                  { icon: Zap,      value: `${comboBonus}x`,                     label: "Combo" },
                  { icon: TrendingUp, value: `RM ${weeklyEarnings.toFixed(0)}`,  label: "Weekly" },
                  { icon: Target,   value: `${goalsHitCount}/${goalsThisMonth.length}`, label: "Goals Hit" },
                ].map(({ icon: Icon, value, label }) => (
                  <View key={label} style={styles.statCard}>
                    <Icon size={16} color={colors.textMuted} />
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Nav rows */}
              <View style={styles.card}>
                {([
                  { panel: "challenges" as DashboardPanel, label: "CHALLENGES",   icon: Target,       sub: `${activeChallenges.length} active` },
                  { panel: "quests"     as DashboardPanel, label: "DAILY QUESTS", icon: CheckCircle2, sub: `${dailyCompletedCount}/${dailyQuests.length} done` },
                  { panel: "powerups"   as DashboardPanel, label: "POWER-UPS",    icon: Zap,          sub: `${coins} coins · ${gems} gems` },
                  { panel: "leaderboard"as DashboardPanel, label: "LEADERBOARD",  icon: Trophy,       sub: "This week" },
                ]).map(({ panel, label, icon: Icon, sub }, index, arr) => (
                  <View key={panel}>
                    <TouchableOpacity style={styles.navRow} onPress={() => setActivePanel(panel)}>
                      <View style={styles.accordionLeft}>
                        <View style={styles.accordionIconWrap}><Icon size={16} color={colors.backgroundStart} /></View>
                        <View>
                          <Text style={styles.accordionLabel}>{label}</Text>
                          <Text style={styles.cardSub}>{sub}</Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    {index < arr.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </>

          ) : activePanel === "profile" ? (
            /* ══ PROFILE ════════════════════════════════════ */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Achievements</Text>
              <View style={styles.divider} />
              {achievedMilestones.length === 0
                ? <Text style={styles.empty}>No achievements yet.</Text>
                : achievedMilestones.map(milestone => {
                    const Icon = milestone.icon;
                    const isClaimed = Boolean(milestoneClaims[milestone.id]);
                    return (
                      <View key={milestone.id} style={styles.achieveRow}>
                        <View style={styles.achieveIcon}><Icon size={16} color={colors.text} /></View>
                        <View style={styles.achieveInfo}>
                          <Text style={styles.achieveTitle}>{milestone.title}</Text>
                          <Text style={styles.achieveMeta}>{milestone.xpRequired} XP</Text>
                        </View>
                        <View style={[styles.statusPill, isClaimed ? styles.statusClaimed : styles.statusReady]}>
                          <Text style={[styles.statusText, isClaimed ? styles.statusTextClaimed : styles.statusTextReady]}>
                            {isClaimed ? "Claimed" : "Ready"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              <Text style={[styles.cardTitle, { marginTop: 20 }]}>Badges</Text>
              <View style={styles.divider} />
              {unlockedBadges.length === 0
                ? <Text style={styles.empty}>No badges yet.</Text>
                : <View style={styles.badgeGrid}>
                    {unlockedBadges.map(badge => {
                      const Icon = badge.icon;
                      return (
                        <View key={badge.id} style={styles.badgeCell}>
                          <View style={styles.badgeIconWrap}><Icon size={20} color={colors.text} /></View>
                          <Text style={styles.badgeName}>{badge.name}</Text>
                          <Text style={styles.badgeRarity}>{badge.rarity}</Text>
                        </View>
                      );
                    })}
                  </View>}
            </View>

          ) : activePanel === "achievements" ? (
            /* ══ ACHIEVEMENT PATH ════════════════════════════ */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Achievement Path</Text>
              <View style={styles.divider} />
              {milestones.map(milestone => {
                const pct = Math.min(100, (totalXp / milestone.xpRequired) * 100);
                const canClaim = totalXp >= milestone.xpRequired && !milestoneClaims[milestone.id];
                const claimed  = Boolean(milestoneClaims[milestone.id]);
                const Icon = milestone.icon;
                return (
                  <View key={milestone.id} style={styles.milestoneRow}>
                    <View style={[styles.milestoneNode, claimed && styles.milestoneNodeDone, canClaim && styles.milestoneNodeReady]}>
                      <Icon size={14} color={claimed ? colors.surface : canClaim ? colors.surface : colors.textMuted} />
                    </View>
                    <View style={styles.milestoneInfo}>
                      <View style={styles.milestoneHeader}>
                        <View>
                          <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                          <Text style={styles.milestoneSub}>Reach {milestone.xpRequired} XP</Text>
                        </View>
                        {claimed
                          ? <Text style={styles.claimedTag}>Claimed</Text>
                          : canClaim
                          ? <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaimMilestone(milestone)}>
                              <Text style={styles.claimBtnText}>Claim +{milestone.reward}</Text>
                            </TouchableOpacity>
                          : <Text style={styles.rewardHint}>+{milestone.reward} XP</Text>}
                      </View>
                      <View style={styles.milestoneTrack}>
                        <View style={[styles.milestoneFill, { width: `${pct}%` as any }]} />
                      </View>
                      <Text style={styles.milestonePct}>{totalXp} / {milestone.xpRequired} XP</Text>
                    </View>
                  </View>
                );
              })}
            </View>

          ) : activePanel === "badges" ? (
            /* ══ BADGES ═════════════════════════════════════ */
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Badge Collection</Text>
                <Text style={styles.cardSub}>{unlockedBadgeCount}/{badges.length} unlocked</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(unlockedBadgeCount/badges.length)*100}%` as any }]} />
              </View>
              <View style={styles.badgeGrid}>
                {badges.map(badge => {
                  const Icon = badge.icon;
                  return (
                    <View key={badge.id} style={[styles.badgeCell, !badge.unlocked && styles.badgeCellLocked]}>
                      {!badge.unlocked && <View style={styles.lockOverlay}><Lock size={14} color={colors.textMuted} /></View>}
                      <View style={[styles.badgeIconWrap, badge.unlocked && styles.badgeIconUnlocked]}>
                        <Icon size={20} color={badge.unlocked ? colors.surface : colors.border} />
                      </View>
                      <Text style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}>{badge.name}</Text>
                      <Text style={styles.badgeRarity}>{badge.rarity}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

          ) : activePanel === "shop" ? (
            /* ══ MARKET ═════════════════════════════════════ */
            <View style={styles.card}>
              {/* Wallet summary */}
              <View style={styles.walletRow}>
                {[
                  { icon: Coins, label: "Coins",    value: coins },
                  { icon: Gem,   label: "Gems",     value: gems },
                  { icon: Zap,   label: "Bonus XP", value: xpWallet },
                ].map(({ icon: Icon, label, value }) => (
                  <View key={label} style={styles.walletCard}>
                    <Icon size={14} color={colors.textMuted} />
                    <Text style={styles.walletValue}>{value}</Text>
                    <Text style={styles.walletLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {/* XP progress */}
              <View style={styles.xpMiniRow}>
                <Text style={styles.xpMiniLabel}>XP Progress</Text>
                <Text style={styles.xpMiniHint}>{Math.max(0, nextXp - totalXp)} to level up</Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: xpFillWidth }]} />
              </View>
              {/* Search — collapsible */}
              <View style={{ marginVertical: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    onPress={toggleShopSearch}
                    style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: shopSearchOpen ? colors.text : colors.surfaceAlt,
                      borderWidth: 1, borderColor: colors.border,
                      alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Search size={16} color={shopSearchOpen ? colors.backgroundStart : colors.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                  <Animated.View style={{
                    flex: 1,
                    overflow: "hidden",
                    maxWidth: shopSearchAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    opacity: shopSearchAnim,
                  }}>
                    <View style={styles.searchRow}>
                      <TextInput
                        ref={shopSearchInputRef}
                        value={shopQuery}
                        onChangeText={setShopQuery}
                        placeholder="Search items…"
                        placeholderTextColor={colors.textMuted}
                        style={styles.searchInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </Animated.View>
                </View>
              </View>
              {shopError ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={13} color={colors.danger} />
                  <Text style={styles.errorText}>{shopError}</Text>
                </View>
              ) : null}
              <View style={styles.divider} />
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{showAllShop ? "All Items" : "Recommended"}</Text>
                <TouchableOpacity onPress={() => setShowAllShop(p => !p)}>
                  <Text style={styles.cardLink}>{showAllShop ? "Show less" : "See all"}</Text>
                </TouchableOpacity>
              </View>
              {shopCatalog
                .filter(item => {
                  if (!shopQuery.trim()) return true;
                  const t = shopQuery.toLowerCase();
                  return item.title.toLowerCase().includes(t) || item.description.toLowerCase().includes(t);
                })
                .slice(0, showAllShop || shopQuery.trim() ? undefined : 3)
                .map(item => {
                  const badgeOwned = item.reward.type === "badge" && item.reward.badgeId
                    ? Boolean(arcadeState?.shopBadges?.[item.reward.badgeId]) : false;
                  const RewardIcon = item.reward.type === "coins" ? Coins
                    : item.reward.type === "gems" ? Gem
                    : item.reward.type === "xp"   ? Zap
                    : Award;
                  return (
                    <View key={item.id} style={styles.shopCard}>
                      <View style={styles.shopCardTop}>
                        <View style={styles.shopIconWrap}><RewardIcon size={16} color={colors.text} /></View>
                        <View style={styles.shopCardInfo}>
                          <View style={styles.shopCardTitleRow}>
                            <Text style={styles.shopItemTitle}>{item.title}</Text>
                            {badgeOwned && <Text style={styles.ownedTag}>Owned</Text>}
                          </View>
                          <Text style={styles.shopItemDesc}>{item.description}</Text>
                          <Text style={styles.shopReward}>
                            {item.reward.type === "badge" ? "Earns badge" : `+${item.reward.amount} ${item.reward.type}`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shopOffers}>
                        {item.offers.map(offer => {
                          const canAfford = offer.currency === "coins" ? coins >= offer.cost
                            : offer.currency === "gems" ? gems >= offer.cost : xpWallet >= offer.cost;
                          const off = badgeOwned || !canAfford;
                          return (
                            <TouchableOpacity
                              key={`${item.id}-${offer.currency}`}
                              style={[styles.offerBtn, off && styles.offerBtnOff]}
                              onPress={() => handleShopPurchase(item, offer)}
                              disabled={off}
                            >
                              <Text style={[styles.offerBtnText, off && styles.offerBtnTextOff]}>
                                {offer.cost} {offer.currency.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
            </View>

          ) : activePanel === "challenges" ? (
            /* ══ CHALLENGES ══════════════════════════════════ */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>This Week</Text>
              <View style={styles.divider} />
              {currentWeekChallenges.length === 0
                ? <Text style={styles.empty}>No challenges this week.</Text>
                : currentWeekChallenges.map(ch => renderChallengeCard(ch))}
              {currentWeekChallenges.some(ch => ch.claimed) && (
                <TouchableOpacity style={styles.resetBtn} onPress={handleResetWeeklyClaims}>
                  <Text style={styles.resetBtnText}>Reset claims</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.cardTitle, { marginTop: 20 }]}>Coming Next Week</Text>
              <View style={styles.divider} />
              {nextWeekChallenges.map(ch => renderChallengeCard(ch, { isUpcoming: true }))}
              <Text style={[styles.cardTitle, { marginTop: 20 }]}>Past Weeks</Text>
              <View style={styles.divider} />
              {claimedHistory.length === 0
                ? <Text style={styles.empty}>No history yet.</Text>
                : claimedHistory.map(ch => renderChallengeCard(ch, { isPast: true }))}
            </View>

          ) : activePanel === "quests" ? (
            /* ══ DAILY QUESTS ════════════════════════════════ */
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Daily Quests</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{dailyCompletedCount}/{dailyQuests.length}</Text>
                </View>
              </View>
              <Text style={[styles.cardSub, { marginBottom: 12 }]}>Complete all for +50 XP bonus</Text>
              <View style={styles.divider} />
              {dailyQuests.map(quest => (
                <TouchableOpacity
                  key={quest.id}
                  style={[styles.questRow, quest.completed && styles.questRowDone]}
                  onPress={() => handleQuestPress(quest.id)}
                  disabled={quest.completed}
                  activeOpacity={0.7}
                >
                  {quest.completed
                    ? <CheckCircle2 size={18} color={colors.text} />
                    : <View style={styles.questCircle} />}
                  <View style={styles.questBody}>
                    <Text style={[styles.questTitle, quest.completed && styles.questTitleDone]}>{quest.title}</Text>
                    <View style={styles.questTrack}>
                      <View style={[styles.questFill, { width: `${Math.min(100,(quest.progress/quest.total)*100)}%` as any }]} />
                    </View>
                  </View>
                  <Text style={styles.questReward}>+{quest.reward}</Text>
                </TouchableOpacity>
              ))}
              {allDailyCompleted && (
                <View style={styles.bonusRow}>
                  <Text style={styles.bonusLabel}>All done!</Text>
                  <TouchableOpacity
                    style={[styles.bonusBtn, dailyBonusClaimed && styles.bonusBtnClaimed]}
                    onPress={handleClaimDailyBonus}
                    disabled={dailyBonusClaimed}
                  >
                    <Text style={[styles.bonusBtnText, dailyBonusClaimed && styles.bonusBtnTextClaimed]}>
                      {dailyBonusClaimed ? "Claimed" : "Claim +50 XP"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          ) : activePanel === "powerups" ? (
            /* ══ POWER-UPS ═══════════════════════════════════ */
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Power-Ups</Text>
                <View style={styles.walletPill}>
                  <Coins size={12} color={colors.textMuted} /><Text style={styles.walletText}>{coins}</Text>
                  <Gem size={12} color={colors.textMuted} /><Text style={styles.walletText}>{gems}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              {shopError ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={13} color={colors.danger} />
                  <Text style={styles.errorText}>{shopError}</Text>
                </View>
              ) : null}
              <View style={styles.powerGrid}>
                {powerUpItems.map(item => {
                  const Icon = item.icon;
                  const canAfford = item.currency === "coins" ? coins >= item.cost : gems >= item.cost;
                  return (
                    <View key={item.id} style={styles.powerCard}>
                      <View style={styles.powerIconWrap}><Icon size={16} color={colors.text} /></View>
                      <Text style={styles.powerName}>{item.name}</Text>
                      <Text style={styles.powerDesc}>{item.description}</Text>
                      <View style={styles.powerFooter}>
                        <Text style={styles.powerCost}>{item.cost} {item.currency}</Text>
                        <TouchableOpacity
                          style={[styles.powerBtn, !canAfford && styles.powerBtnOff]}
                          onPress={() => handleBuyPowerUp(item.id, item.cost, item.currency)}
                          disabled={!canAfford}
                        >
                          <Text style={[styles.powerBtnText, !canAfford && styles.powerBtnTextOff]}>
                            {item.owned > 0 ? `Buy (×${item.owned})` : "Buy"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

          ) : activePanel === "leaderboard" ? (
            /* ══ LEADERBOARD ═════════════════════════════════ */
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Leaderboard</Text>
                <Text style={styles.cardSub}>This week</Text>
              </View>
              <View style={styles.divider} />
              {leaderboardEntries.length === 0
                ? <Text style={styles.empty}>No data yet.</Text>
                : leaderboardEntries.map(player => (
                  <View key={`${player.rank}-${player.name}`} style={[styles.lbRow, player.isYou && styles.lbRowYou]}>
                    <Text style={styles.lbRank}>
                      {player.rank === 1 ? "1st" : player.rank === 2 ? "2nd" : player.rank === 3 ? "3rd" : `#${player.rank}`}
                    </Text>
                    <View style={styles.lbUser}>
                      <User size={14} color={colors.textMuted} />
                      <Text style={[styles.lbName, player.isYou && styles.lbNameYou]}>{player.name}</Text>
                      {player.isYou && <Text style={styles.youTag}>YOU</Text>}
                    </View>
                    <Text style={styles.lbXp}>{player.xp.toLocaleString()} XP</Text>
                  </View>
                ))}
            </View>

          ) : null}

        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
  /* layout */
  screen:       { flex: 1, backgroundColor: c.backgroundStart },
  safe:         { flex: 1, paddingHorizontal: 16 },
  content:      { paddingBottom: 48, gap: 12 },
  /* header */
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  headerTitle:  { fontSize: 16, fontWeight: "700", color: c.text, letterSpacing: -0.3 },
  headerRight:  { flexDirection: "row", gap: 8 },
  iconBtn:      { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
  /* menu */
  menuOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  menuSheet:    { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: c.border },
  menuTitle:    { fontSize: 11, fontWeight: "700", color: c.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  menuItem:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border },
  menuItemText: { flex: 1, fontSize: 14, color: c.textMuted, fontWeight: "500" },
  menuItemActive:{ color: c.text, fontWeight: "700" },
  /* level card */
  levelCard:    { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border },
  levelCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  levelLabel:   { fontSize: 11, color: c.textMuted, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  levelValue:   { fontSize: 40, fontWeight: "800", color: c.text, lineHeight: 44 },
  levelRight:   { gap: 6, alignItems: "flex-end" },
  currencyRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  currencyText: { fontSize: 13, fontWeight: "600", color: c.textMuted },
  xpRow:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  xpLabel:      { fontSize: 12, color: c.textMuted },
  xpHint:       { fontSize: 12, color: c.textMuted },
  xpTrack:      { height: 4, borderRadius: 999, backgroundColor: c.border, overflow: "hidden", marginBottom: 14 },
  xpFill:       { height: 4, borderRadius: 999, backgroundColor: c.text },
  convertBtn:   { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  convertBtnDisabled: { opacity: 0.4 },
  convertBtnText: { fontSize: 12, fontWeight: "600", color: c.text },
  convertBtnTextDisabled: { color: c.textMuted },
  /* stats grid */
  statsGrid:    { flexDirection: "row", gap: 8 },
  statCard:     { flex: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: "center", gap: 4 },
  statValue:    { fontSize: 15, fontWeight: "800", color: c.text },
  statLabel:    { fontSize: 10, color: c.textMuted, fontWeight: "500" },
  /* generic card */
  card:         { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16 },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: c.text, letterSpacing: -0.2 },
  cardSub:      { fontSize: 11, color: c.textMuted },
  cardLink:     { fontSize: 12, fontWeight: "600", color: c.textMuted },
  divider:      { height: 1, backgroundColor: c.border, marginVertical: 10 },
  empty:        { fontSize: 12, color: c.textMuted, paddingVertical: 8 },
  countBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: c.border },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: c.text },
  /* quests */
  questRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  questRowDone: { opacity: 0.5 },
  questBody:    { flex: 1 },
  questTitle:   { fontSize: 13, fontWeight: "500", color: c.text, marginBottom: 5 },
  questTitleDone: { textDecorationLine: "line-through" },
  questTrack:   { height: 3, borderRadius: 999, backgroundColor: c.border, overflow: "hidden" },
  questFill:    { height: 3, backgroundColor: c.text, borderRadius: 999 },
  questReward:  { fontSize: 12, fontWeight: "600", color: c.textMuted, width: 32, textAlign: "right" },
  bonusRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  bonusLabel:   { fontSize: 13, fontWeight: "600", color: c.text },
  bonusBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: c.text },
  bonusBtnClaimed: { backgroundColor: c.border },
  bonusBtnText: { fontSize: 12, fontWeight: "700", color: c.surface },
  bonusBtnTextClaimed: { color: c.textMuted },
  /* wallet */
  walletPill:   { flexDirection: "row", alignItems: "center", gap: 8 },
  walletText:   { fontSize: 12, fontWeight: "600", color: c.textMuted },
  /* power-ups */
  powerGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  powerCard:    { width: "48%", borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 },
  powerIconWrap:{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  powerName:    { fontSize: 12, fontWeight: "700", color: c.text, marginBottom: 2 },
  powerDesc:    { fontSize: 11, color: c.textMuted, marginBottom: 10 },
  powerFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  powerCost:    { fontSize: 11, color: c.textMuted, fontWeight: "600" },
  powerBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: c.text },
  powerBtnOff:  { backgroundColor: c.border },
  powerBtnText: { fontSize: 11, fontWeight: "700", color: c.surface },
  powerBtnTextOff: { color: c.textMuted },
  /* leaderboard */
  lbRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  lbRowYou:     { backgroundColor: c.surfaceAlt, marginHorizontal: -16, paddingHorizontal: 16 },
  lbRank:       { width: 30, fontSize: 11, fontWeight: "700", color: c.textMuted },
  lbUser:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  lbName:       { fontSize: 13, fontWeight: "500", color: c.textMuted },
  lbNameYou:    { fontWeight: "700", color: c.text },
  youTag:       { fontSize: 9, fontWeight: "700", color: c.textMuted, borderWidth: 1, borderColor: c.border, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  lbXp:         { fontSize: 12, fontWeight: "700", color: c.text },
  /* achievements / profile */
  achieveRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  achieveIcon:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  achieveInfo:  { flex: 1 },
  achieveTitle: { fontSize: 13, fontWeight: "600", color: c.text },
  achieveMeta:  { fontSize: 11, color: c.textMuted, marginTop: 1 },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusClaimed:{ borderColor: c.border, backgroundColor: c.surfaceAlt },
  statusReady:  { borderColor: c.text, backgroundColor: c.text },
  statusText:   { fontSize: 11, fontWeight: "700" },
  statusTextClaimed: { color: c.textMuted },
  statusTextReady:   { color: c.surface },
  /* badges */
  badgeGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  badgeCell:    { width: "30%", borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: "center", gap: 4, aspectRatio: 1, position: "relative", overflow: "hidden" },
  badgeCellLocked: { opacity: 0.45 },
  lockOverlay:  { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceAlt },
  badgeIconWrap:{ width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  badgeIconUnlocked: { backgroundColor: c.text, borderColor: c.text },
  badgeName:    { fontSize: 9, fontWeight: "700", color: c.text, textAlign: "center" },
  badgeNameLocked: { color: c.textMuted },
  badgeRarity:  { fontSize: 8, color: c.textMuted, textAlign: "center" },
  /* milestones */
  milestoneRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  milestoneNode:{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
  milestoneNodeDone:  { backgroundColor: c.text, borderColor: c.text },
  milestoneNodeReady: { backgroundColor: c.text, borderColor: c.text },
  milestoneInfo:{ flex: 1 },
  milestoneHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  milestoneTitle: { fontSize: 13, fontWeight: "700", color: c.text },
  milestoneSub:   { fontSize: 11, color: c.textMuted, marginTop: 2 },
  claimedTag:     { fontSize: 11, fontWeight: "600", color: c.textMuted },
  claimBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7, backgroundColor: c.text },
  claimBtnText:   { fontSize: 11, fontWeight: "700", color: c.surface },
  rewardHint:     { fontSize: 11, color: c.textMuted },
  milestoneTrack: { height: 3, borderRadius: 999, backgroundColor: c.border, overflow: "hidden", marginBottom: 4 },
  milestoneFill:  { height: 3, backgroundColor: c.text, borderRadius: 999 },
  milestonePct:   { fontSize: 10, color: c.textMuted },
  /* progress track (generic) */
  progressTrack:  { height: 4, borderRadius: 999, backgroundColor: c.border, overflow: "hidden", marginBottom: 12 },
  progressFill:   { height: 4, backgroundColor: c.text, borderRadius: 999 },
  /* market/shop */
  walletRow:      { flexDirection: "row", gap: 8, marginBottom: 14 },
  walletCard:     { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: "center", gap: 3 },
  walletValue:    { fontSize: 16, fontWeight: "800", color: c.text },
  walletLabel:    { fontSize: 10, color: c.textMuted },
  xpMiniRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  xpMiniLabel:    { fontSize: 12, fontWeight: "600", color: c.text },
  xpMiniHint:     { fontSize: 12, color: c.textMuted },
  searchRow:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: 13, color: c.text },
  shopCard:       { borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, marginBottom: 10 },
  shopCardTop:    { flexDirection: "row", gap: 12, marginBottom: 10 },
  shopIconWrap:   { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  shopCardInfo:   { flex: 1 },
  shopCardTitleRow:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  shopItemTitle:  { fontSize: 13, fontWeight: "700", color: c.text },
  shopItemDesc:   { fontSize: 12, color: c.textMuted, marginBottom: 3 },
  shopReward:     { fontSize: 11, fontWeight: "600", color: c.text },
  ownedTag:       { fontSize: 10, fontWeight: "700", color: c.textMuted, borderWidth: 1, borderColor: c.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  shopOffers:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  offerBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7, backgroundColor: c.text },
  offerBtnOff:    { backgroundColor: c.border },
  offerBtnText:   { fontSize: 11, fontWeight: "700", color: c.surface },
  offerBtnTextOff:{ color: c.textMuted },
  /* challenge card */
  challengeCard:  { borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 },
  challengeCardDone: { backgroundColor: c.surfaceAlt },
  challengeTopRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  challengeTitleWrap: { flex: 1 },
  challengeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  challengeTitle: { fontSize: 13, fontWeight: "700", color: c.text, flex: 1 },
  difficultyBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  difficultyEasy: { borderColor: c.border },
  difficultyMedium:{ borderColor: c.border },
  difficultyHard: { borderColor: c.text },
  difficultyText: { fontSize: 10, fontWeight: "600", color: c.textMuted },
  challengeDesc:  { fontSize: 11, color: c.textMuted, marginTop: 2 },
  challengeMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  challengeMetaItem:{ flexDirection: "row", alignItems: "center", gap: 4 },
  challengeMetaText:{ fontSize: 10, color: c.textMuted },
  challengeRewardPill:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: c.border },
  challengeRewardText:{ fontSize: 11, fontWeight: "600", color: c.textMuted },
  challengeTrack: { height: 3, borderRadius: 999, backgroundColor: c.border, overflow: "hidden" },
  challengeFill:  { height: 3, backgroundColor: c.text, borderRadius: 999 },
  challengeFooter:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  challengeProgressText:{ fontSize: 10, color: c.textMuted },
  challengeBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: c.text },
  challengeBtnText:{ fontSize: 11, fontWeight: "700", color: c.surface },
  challengeClaimBtn:{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: c.text },
  challengeClaimBtnText:{ fontSize: 11, fontWeight: "700", color: c.text },
  claimedText:    { fontSize: 11, fontWeight: "600", color: c.textMuted },
  pendingText:    { fontSize: 11, fontWeight: "600", color: c.textMuted },
  resetBtn:       { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: c.border },
  resetBtnText:   { fontSize: 11, fontWeight: "600", color: c.textMuted },
  /* splash */
  splashScreen:     { alignItems: "center", justifyContent: "center" },
  splashSafe:       { flex: 1, width: "100%" },
  splashCenter:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  splashIconWrap:   { width: 80, height: 80, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  splashText:       { alignItems: "center", gap: 6 },
  splashTitle:      { fontSize: 26, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
  splashSub:        { fontSize: 13, color: c.textMuted, letterSpacing: 0.1 },
  splashFooter:     { paddingBottom: 48, alignItems: "center" },
  splashDots:       { flexDirection: "row", gap: 6 },
  splashDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  splashDotActive:  { width: 18, backgroundColor: c.text },
  /* nav row */
  navRow:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  questCircle:      { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: c.border },
  /* accordion */
  accordionRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accordionLeft:    { flexDirection: "row", alignItems: "center", gap: 12 },
  accordionRight:   { flexDirection: "row", alignItems: "center", gap: 10 },
  accordionIconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.text, alignItems: "center", justifyContent: "center" },
  accordionLabel:   { fontSize: 13, fontWeight: "700", color: c.text, letterSpacing: 0.4 },
  accordionBody:    { marginTop: 14, gap: 10 },
  /* error */
  errorRow:       { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: c.danger, marginBottom: 8 },
  errorText:      { fontSize: 11, color: c.danger, flex: 1 },
  /* floater (unused but keep to avoid ref errors in ArcadeFloaters) */
  floaters:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  floater:        { position: "absolute" },
  floaterCircle:  { borderRadius: 999, borderWidth: 1 },
  floaterSquare:  { borderRadius: 4, borderWidth: 1 },
  floaterRounded: { borderRadius: 12, borderWidth: 1 },
  floaterPill:    { borderRadius: 999, borderWidth: 1 },
  floaterTriangle:{ width: 0, height: 0, borderStyle: "solid", backgroundColor: "transparent" },
  floaterLShape:  { borderRadius: 8, borderWidth: 1, position: "relative" },
  floaterLArm:    { position: "absolute", borderRadius: 6, borderWidth: 1 },
  floaterController:{ borderRadius: 8, borderWidth: 1 },
  floaterDot:     { position: "absolute", width: 4, height: 4, borderRadius: 2, backgroundColor: c.border },
  bgBlob:         { opacity: 0 },
  bgBlobAlt:      { opacity: 0 },
});

const ArcadeFloaters = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
