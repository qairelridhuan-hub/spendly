import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Alert,
  PanResponder,
} from "react-native";
import {
  Bell,
  Clock,
  DollarSign,
  Target,
  Gamepad2,
  Sparkles,
  LogOut,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, firebaseProjectId } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useCalendar, useTheme } from "@/lib/context";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AttendancePolicy = {
  payType: string;
  dailyRate: number;
  dailyMinHours: number;
  dailyProrate: boolean;
  otAfterHours: number;
  otMultiplier: number;
  overtimeRate: number;
  breakPaid: boolean;
  breakFixedMinutes: number;
  autoBreak: boolean;
  roundingMinutes: number;
  roundingMode: string;
  roundingScope: string;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  holidays: string[];
};

const FINANCE_SYSTEM_PROMPT =
  "You are a helpful finance assistant for budgeting, savings, debt payoff, and income planning. " +
  "Answer clearly and ask for missing context. Do not provide financial, legal, or tax advice.";
const CHAT_HISTORY_LIMIT = 6;

/* =====================
   SCREEN
===================== */

export default function WorkerHomeScreen() {
  const { colors } = useTheme();
  const [pixelFontLoaded] = useFonts({
    PressStart2P: require("../../assets/fonts/PressStart2P-Regular.ttf"),
  });
  const [displayName, setDisplayName] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  const [showGameSplash, setShowGameSplash] = useState(false);
  const [showGameGate, setShowGameGate] = useState(false);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const gameGlow = useRef(new Animated.Value(0)).current;
  const gameSpin = useRef(new Animated.Value(0)).current;
  const gameFloat = useRef(new Animated.Value(0)).current;
  const gameChase = useRef(new Animated.Value(0)).current;
  const gameChomp = useRef(new Animated.Value(0)).current;
  const ghostEyeAnim = useRef(new Animated.Value(0)).current;
  const sliderX = useRef(new Animated.Value(0)).current;
  const sliderStart = useRef(0);
  const sliderValue = useRef(0);
  const gameSplashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameTitleGlow = useRef(new Animated.Value(0.4)).current;
  const scrollRef = useRef<ScrollView>(null);
  const lastLogoTap = useRef(0);
  const logoTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [goalsCount, setGoalsCount] = useState(0);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [userHourlyRate, setUserHourlyRate] = useState(0);
  const [schedule, setSchedule] = useState<{
    id: string;
    name: string;
    days: string[];
    startTime: string;
    endTime: string;
    hourlyRate: number;
  } | null>(null);
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<{
    clockIn?: string;
    clockOut?: string;
    breakStart?: string;
    breakEnd?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakStartTs?: number;
    breakEndTs?: number;
    breakMinutes?: number;
    status?: string;
    hours?: number;
  } | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [breakLogs, setBreakLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [workConfig, setWorkConfig] = useState({
    workingDaysPerWeek: 0,
    hoursPerDay: 0,
    hourlyRate: 0,
    overtimeRate: 0,
    payType: "hourly",
    dailyRate: 0,
    dailyMinHours: 6,
    dailyProrate: false,
    otAfterHours: 8,
    otMultiplier: 1.5,
    breakPaid: false,
    breakFixedMinutes: 0,
    autoBreak: true,
    roundingMinutes: 15,
    roundingMode: "nearest",
    roundingScope: "net",
    lateGraceMinutes: 5,
    earlyGraceMinutes: 5,
    weekendMultiplier: 1.25,
    holidayMultiplier: 2,
    holidays: [] as string[],
  });

  const sliderKnobSize = 36;
  const sliderPadding = 5;
  const sliderMax = Math.max(
    0,
    sliderTrackWidth - sliderKnobSize - sliderPadding * 2
  );
  const sliderFillWidth = Animated.add(sliderX, sliderKnobSize);
  const chasePackWidth = 92;
  const chasePadding = 10;
  const chaseMax = Math.max(0, sliderTrackWidth - chasePackWidth - chasePadding * 2);
  const floatY = gameFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 6],
  });
  /* =====================
     STATE
  ===================== */
  const { getTodayShift, shifts } = useCalendar();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);
  const tickAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const handleLogoPress = () => {
    const now = Date.now();
    const isDoubleTap = now - lastLogoTap.current < 300;

    if (isDoubleTap) {
      if (logoTapTimeout.current) {
        clearTimeout(logoTapTimeout.current);
        logoTapTimeout.current = null;
      }
      lastLogoTap.current = 0;
      router.push("/about");
      return;
    }

    lastLogoTap.current = now;
    logoTapTimeout.current = setTimeout(() => {
      router.push("/(tabs)/profile");
      lastLogoTap.current = 0;
      logoTapTimeout.current = null;
    }, 300);
  };

  const [selectedPeriod, setSelectedPeriod] = useState(
    getCurrentPeriodKey(new Date())
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showPastSalary, setShowPastSalary] = useState(false);
  const [showSalaryMenu, setShowSalaryMenu] = useState(false);
  const [salaryView, setSalaryView] = useState<"past" | "ongoing">("past");
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [pastSalaryPeriod, setPastSalaryPeriod] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Ask me about budgeting, savings goals, debt payoff, or salary planning.",
    },
  ]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);

  const scheduleHoursPerDay = schedule
    ? diffHours(schedule.startTime, schedule.endTime)
    : workConfig.hoursPerDay;
  const hourlyRate =
    userHourlyRate || workConfig.hourlyRate || schedule?.hourlyRate || 0;
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const attendanceStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    attendanceLogs.forEach(log => {
      const date = String(log.date ?? "");
      if (!date) return;
      const existing = map[date];
      const nextStatus = String(log.status ?? "pending");
      map[date] = mergeAttendanceStatus(existing, nextStatus);
    });
    return map;
  }, [attendanceLogs]);
  const weeklyRegularHours = getWeeklyHoursFromLogs(approvedLogs);
  const weeklyOvertimeHours = getWeeklyOvertimeHours(overtimeLogs);
  const weeklyCurrent = weeklyRegularHours + weeklyOvertimeHours;
  const weeklyEarnings =
    weeklyRegularHours * hourlyRate +
    weeklyOvertimeHours * workConfig.overtimeRate;
  const todayShift = getTodayShift();
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayStatus = todayShift
    ? resolveStatus(todayShift.status, attendanceStatusMap[todayKey])
    : "scheduled";
  const todayProgress = todayShift
    ? getShiftProgress(todayShift, todayStatus)
    : 0;
  const nextShift = getNextShift(shifts, attendanceStatusMap);
  const currentPeriod = getCurrentPeriodKey(new Date());
  const periodBounds = getPeriodBounds(selectedPeriod);
  const cutoffDate =
    selectedPeriod === currentPeriod ? new Date() : periodBounds.end;

  const approvedHoursSoFar = useMemo(
    () =>
      approvedLogs.reduce((sum, log) => {
        const date = String(log.date ?? "");
        if (!date.startsWith(selectedPeriod)) return sum;
        const logDate = new Date(`${date}T00:00:00`);
        if (Number.isNaN(logDate.getTime()) || logDate > cutoffDate) return sum;
        return sum + getLogHours(log);
      }, 0),
    [approvedLogs, selectedPeriod, cutoffDate]
  );

  const assignedShiftsSoFar = useMemo(
    () =>
      shifts.filter(shift => {
        if (!shift.date.startsWith(selectedPeriod)) return false;
        if (["absent", "off", "leave"].includes(shift.status)) return false;
        const shiftDate = new Date(`${shift.date}T00:00:00`);
        if (Number.isNaN(shiftDate.getTime())) return false;
        return shiftDate <= cutoffDate;
      }),
    [shifts, selectedPeriod, cutoffDate]
  );

  const allMonthShifts = useMemo(
    () =>
      shifts.filter(shift => {
        if (!shift.date.startsWith(selectedPeriod)) return false;
        return !["absent", "off", "leave"].includes(shift.status);
      }),
    [shifts, selectedPeriod]
  );

  const assignedHours = assignedShiftsSoFar.reduce(
    (sum, shift) => sum + getShiftHours(shift),
    0
  );
  const isPastPeriod = selectedPeriod < currentPeriod;
  const baseHours =
    !isPastPeriod && assignedHours > 0 ? assignedHours : approvedHoursSoFar;
  const breakMinutesSoFar = useMemo(() => {
    const sourceDateLimit = cutoffDate.getTime();
    if (breakLogs.length) {
      return breakLogs.reduce((sum, entry) => {
        const date = String(entry.date ?? "");
        if (!date.startsWith(selectedPeriod)) return sum;
        const entryDate = new Date(`${date}T00:00:00`);
        if (Number.isNaN(entryDate.getTime()) || entryDate.getTime() > sourceDateLimit) {
          return sum;
        }
        return sum + calcMinutesDiff(entry.startTime, entry.endTime);
      }, 0);
    }
    return attendanceLogs.reduce((sum, log) => {
      const date = String(log.date ?? "");
      if (!date.startsWith(selectedPeriod)) return sum;
      const logDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(logDate.getTime()) || logDate.getTime() > sourceDateLimit) {
        return sum;
      }
      const minutes =
        Number(log.breakMinutes ?? 0) ||
        calcBreakMinutes(log.breakStart, log.breakEnd, log.breakStartTs, log.breakEndTs);
      return sum + minutes;
    }, 0);
  }, [breakLogs, attendanceLogs, selectedPeriod, cutoffDate]);
  const overtimeHoursSoFar = useMemo(() => {
    const sourceDateLimit = cutoffDate.getTime();
    return overtimeLogs.reduce((sum, entry) => {
      const date = String(entry.date ?? "");
      if (!date.startsWith(selectedPeriod)) return sum;
      const entryDate = new Date(`${date}T00:00:00`);
      if (Number.isNaN(entryDate.getTime()) || entryDate.getTime() > sourceDateLimit) {
        return sum;
      }
      const hours =
        Number(entry.hours ?? 0) ||
        calcHours(entry.startTime ?? "", entry.endTime ?? "", 0);
      return sum + hours;
    }, 0);
  }, [overtimeLogs, selectedPeriod, cutoffDate]);
  const chatMessagesToShow = useMemo(
    () => chatMessages.slice(-CHAT_HISTORY_LIMIT),
    [chatMessages]
  );
  const projectedHours = allMonthShifts.reduce(
    (sum, shift) => sum + getShiftHours(shift),
    0
  );
  const collectedEarnings =
    baseHours * hourlyRate + overtimeHoursSoFar * workConfig.overtimeRate;
  const projectedEarnings = projectedHours * hourlyRate;
  const pendingCount = attendanceLogs.filter(log => {
    const date = String(log.date ?? "");
    if (!date.startsWith(selectedPeriod)) return false;
    const logDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(logDate.getTime()) || logDate > cutoffDate) return false;
    return String(log.status ?? "") === "pending";
  }).length;
  const hasPending = pendingCount > 0;
  const approvedShiftCount = approvedLogs.filter(log =>
    String(log.date ?? "").startsWith(selectedPeriod)
  ).length;
  const assignedShiftCount = assignedShiftsSoFar.length;
  const earningsBreakdownRows = useMemo(() => {
    if (!isPastPeriod && assignedShiftsSoFar.length) {
      return assignedShiftsSoFar.map(shift => ({
        date: shift.date,
        hours: getShiftHours(shift),
        amount: getShiftHours(shift) * hourlyRate,
        source: "Assigned",
      }));
    }
    return approvedLogs
      .filter(log => {
        const date = String(log.date ?? "");
        if (!date.startsWith(selectedPeriod)) return false;
        const logDate = new Date(`${date}T00:00:00`);
        if (Number.isNaN(logDate.getTime()) || logDate > cutoffDate) return false;
        return true;
      })
      .map(log => ({
        date: String(log.date ?? ""),
        hours: getLogHours(log),
        amount: getLogHours(log) * hourlyRate,
        source: "Completed",
      }));
  }, [
    assignedShiftsSoFar,
    approvedLogs,
    selectedPeriod,
    cutoffDate,
    hourlyRate,
    isPastPeriod,
  ]);
  const amountLabel =
    assignedHours > 0 ? "Estimated So Far" : "Collected (Completed Shifts)";
  const amountHint =
    assignedHours > 0
      ? "Based on assigned shifts so far"
      : "Based on completed shifts so far";
  const titleText =
    selectedPeriod === currentPeriod
      ? "Earnings So Far (This Month)"
      : "Collected So Far";
  const paidPayrollForSelected = useMemo(
    () =>
      payrollRecords.find(
        record =>
          record.period === selectedPeriod && String(record.status ?? "") === "paid"
      ) || null,
    [payrollRecords, selectedPeriod]
  );
  const finalizedPayrollAmount =
    paidPayrollForSelected && paidPayrollForSelected.totalEarnings != null
      ? Number(paidPayrollForSelected.totalEarnings)
      : null;
  const displayCollectedEarnings =
    isPastPeriod && finalizedPayrollAmount != null
      ? finalizedPayrollAmount
      : collectedEarnings;
  const displayAmountLabel =
    isPastPeriod && finalizedPayrollAmount != null
      ? "Finalized Payroll"
      : amountLabel;
  const displayAmountHint =
    isPastPeriod && finalizedPayrollAmount != null
      ? "Based on paid payroll record"
      : amountHint;
  const displayAmountSummary = `${displayAmountLabel} • ${displayAmountHint}`;
  const displayRightLabel =
    selectedPeriod === currentPeriod ? "Projected End-of-Month" : "Finalized Payroll";
  const displayRightValue =
    selectedPeriod === currentPeriod ? projectedEarnings : displayCollectedEarnings;
  const approvedEarnings =
    approvedHoursSoFar * hourlyRate + overtimeHoursSoFar * workConfig.overtimeRate;
  const approvedDisplayValue =
    isPastPeriod && finalizedPayrollAmount != null ? displayCollectedEarnings : approvedEarnings;

  const selectablePeriods = useMemo(
    () => buildSelectablePeriods(shifts, attendanceLogs, payrollRecords),
    [shifts, attendanceLogs, payrollRecords]
  );

  const pastSalaryOptions = useMemo(() => {
    if (salaryView === "ongoing") return [currentPeriod];
    const periods = payrollRecords
      .filter(record => String(record.status ?? "") === "paid")
      .map(record => String(record.period ?? ""))
      .filter(Boolean);
    return Array.from(new Set(periods)).sort((a, b) => b.localeCompare(a));
  }, [payrollRecords, currentPeriod, salaryView]);

  const selectedPastPeriod =
    salaryView === "ongoing"
      ? currentPeriod
      : pastSalaryPeriod || pastSalaryOptions[0] || currentPeriod;
  const selectedPastPayroll =
    salaryView === "past"
      ? payrollRecords.find(
          record =>
            record.period === selectedPastPeriod && String(record.status ?? "") === "paid"
        ) || null
      : null;
  const isCurrentPastPeriod = salaryView === "ongoing";
  const pastShiftCount = approvedLogs.filter(log =>
    String(log.date ?? "").startsWith(selectedPastPeriod)
  ).length;
  const pastHours = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(selectedPastPeriod)) return sum;
    return sum + getLogHours(log);
  }, 0);
  const currentPeriodShiftCount =
    assignedHours > 0 ? assignedShiftCount : approvedShiftCount;
  const currentPeriodHours = assignedHours > 0 ? assignedHours : approvedHoursSoFar;

  useEffect(() => {
    if (!selectablePeriods.length) return;
    if (!selectablePeriods.includes(selectedPeriod)) {
      setSelectedPeriod(selectablePeriods[0]);
    }
  }, [selectablePeriods, selectedPeriod]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
      if (!user) {
        setDisplayName("User");
        return;
      }
      if (user.displayName) setDisplayName(user.displayName);
      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as {
          fullName?: string;
          scheduleId?: string;
          hourlyRate?: number;
        } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
        setScheduleId(data?.scheduleId ?? null);
        if (data?.hourlyRate != null) {
          setUserHourlyRate(Number(data.hourlyRate));
        }
      });
      return () => unsubProfile();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(gameGlow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(gameGlow, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [gameGlow]);

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(gameSpin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    if (showGameSplash) {
      spinAnimation.start();
    }
    return () => spinAnimation.stop();
  }, [gameSpin, showGameSplash]);

  useEffect(() => {
    if (!showGameGate) return;
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(gameFloat, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(gameFloat, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );
    floatAnimation.start();
    return () => floatAnimation.stop();
  }, [gameFloat, showGameGate]);
  useEffect(() => {
    if (!showGameGate) return;
    const chaseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gameChase, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: true,
        }),
        Animated.timing(gameChase, {
          toValue: 0,
          duration: 3200,
          useNativeDriver: true,
        }),
      ])
    );
    chaseLoop.start();
    return () => chaseLoop.stop();
  }, [gameChase, showGameGate]);
  useEffect(() => {
    if (!showGameGate) return;
    const chompLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gameChomp, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(gameChomp, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ])
    );
    chompLoop.start();
    return () => chompLoop.stop();
  }, [gameChomp, showGameGate]);
  useEffect(() => {
    if (!showGameGate) return;
    const eyeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ghostEyeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(ghostEyeAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    eyeLoop.start();
    return () => eyeLoop.stop();
  }, [ghostEyeAnim, showGameGate]);
  useEffect(() => {
    if (!showGameGate) return;
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gameTitleGlow, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: false,
        }),
        Animated.timing(gameTitleGlow, {
          toValue: 0.4,
          duration: 1100,
          useNativeDriver: false,
        }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [gameTitleGlow, showGameGate]);

  useEffect(() => {
    if (!showGameGate) return;
    sliderX.setValue(0);
    sliderStart.current = 0;
    sliderValue.current = 0;
  }, [showGameGate, sliderX]);

  useEffect(() => {
    return () => {
      if (gameSplashTimer.current) {
        clearTimeout(gameSplashTimer.current);
        gameSplashTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(tickAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();
    return () => spinAnimation.stop();
  }, [tickAnim]);

  useEffect(() => {
    if (!scheduleId) {
      setSchedule(null);
      return;
    }
    const scheduleRef = doc(db, "workSchedules", scheduleId);
    const unsub = onSnapshot(scheduleRef, snap => {
      if (!snap.exists()) {
        setSchedule(null);
        return;
      }
      const data = snap.data() as any;
      setSchedule({
        id: snap.id,
        name: data.name || "Schedule",
        days: Array.isArray(data.days) ? data.days : [],
        startTime: data.startTime || "09:00",
        endTime: data.endTime || "17:00",
        hourlyRate: Number(data.hourlyRate ?? 0),
      });
    });
    return unsub;
  }, [scheduleId]);

  const handleEnterGame = useCallback(() => {
    setShowGameGate(false);
    setShowGameSplash(true);
    if (gameSplashTimer.current) {
      clearTimeout(gameSplashTimer.current);
    }
    gameSplashTimer.current = setTimeout(() => {
      setShowGameSplash(false);
      router.push("/game");
    }, 700);
  }, [router]);

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          sliderStart.current = sliderValue.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (sliderMax <= 0) return;
          const nextValue = Math.max(
            0,
            Math.min(sliderStart.current + gesture.dx, sliderMax)
          );
          sliderValue.current = nextValue;
          sliderX.setValue(nextValue);
        },
        onPanResponderRelease: () => {
          if (sliderMax <= 0) return;
          const shouldEnter = sliderValue.current >= sliderMax * 0.85;
          const targetValue = shouldEnter ? sliderMax : 0;
          Animated.timing(sliderX, {
            toValue: targetValue,
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            sliderValue.current = targetValue;
            sliderStart.current = targetValue;
            if (shouldEnter) {
              handleEnterGame();
            }
          });
        },
      }),
    [handleEnterGame, sliderMax, sliderX]
  );

  /* =====================
     HELPERS
  ===================== */
  /* =====================
     ACTIONS
  ===================== */
  const handleLogout = async () => {
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

  const handleClockIn = async () => {
    if (!userId) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
    const now = new Date();
    const nowTs = now.getTime();
    await setDoc(
      attendanceRef,
      {
        date: todayKey,
        workerId: userId,
        clockIn: formatTime(now),
        clockInTs: nowTs,
        status: "pending",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleClockOut = async () => {
    if (!userId) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
    const breakRef = doc(db, "users", userId, "breaks", todayKey);
    const overtimeRef = doc(db, "users", userId, "overtime", todayKey);
    const now = new Date();
    const nowTs = now.getTime();
    const clockOutTime = formatTime(now);
    const manualBreakMinutes =
      Number(todayAttendance?.breakMinutes ?? 0) ||
      calcBreakMinutes(
        todayAttendance?.breakStart,
        todayAttendance?.breakEnd,
        todayAttendance?.breakStartTs,
        todayAttendance?.breakEndTs
      );
    const plannedStart = todayShift?.start ?? schedule?.startTime ?? null;
    const plannedEnd = todayShift?.end ?? schedule?.endTime ?? null;
    const metrics = computeAttendanceMetrics({
      clockInTs: todayAttendance?.clockInTs,
      clockOutTs: nowTs,
      manualBreakMinutes,
      plannedStart,
      plannedEnd,
      dateKey: todayKey,
      policy: workConfig,
      hourlyRate,
    });
    const breakMinutes = metrics.breakMinutes;
    const hours = metrics.netHours;
    await setDoc(
      attendanceRef,
      {
        clockOut: clockOutTime,
        clockOutTs: nowTs,
        hours,
        rawMinutes: metrics.rawMinutes,
        breakMinutes: metrics.breakMinutes,
        netMinutes: metrics.netMinutes,
        roundedMinutes: metrics.roundedMinutes,
        netHours: metrics.netHours,
        regularHours: metrics.regularHours,
        overtimeHours: metrics.overtimeHours,
        basePay: metrics.basePay,
        overtimePay: metrics.overtimePay,
        dailyPay: metrics.dailyPay,
        dayMultiplier: metrics.dayMultiplier,
        finalPay: metrics.finalPay,
        plannedStart,
        plannedEnd,
        isLate: metrics.isLate,
        lateMinutes: metrics.lateMinutes,
        isEarlyLeave: metrics.isEarlyLeave,
        earlyLeaveMinutes: metrics.earlyLeaveMinutes,
        status: "pending",
        ...(todayAttendance?.breakStart && !todayAttendance?.breakEnd
          ? {
              breakEnd: clockOutTime,
              breakEndTs: nowTs,
            }
          : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (todayAttendance?.breakStart && !todayAttendance?.breakEnd) {
      await setDoc(
        breakRef,
        {
          date: todayKey,
          workerId: userId,
          endTime: clockOutTime,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (metrics.overtimeHours > 0) {
      await setDoc(
        overtimeRef,
        {
          date: todayKey,
          workerId: userId,
          startTime: plannedEnd ?? null,
          endTime: clockOutTime,
          hours: metrics.overtimeHours,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(
        overtimeRef,
        {
          date: todayKey,
          workerId: userId,
          startTime: null,
          endTime: null,
          hours: 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  };

  const handleBreakToggle = async () => {
    if (!userId) return;
    if (!todayAttendance?.clockIn) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
    const breakRef = doc(db, "users", userId, "breaks", todayKey);
    const now = new Date();
    const nowTs = now.getTime();
    if (!todayAttendance?.breakStart || todayAttendance?.breakEnd) {
      await setDoc(
        attendanceRef,
        {
          date: todayKey,
          workerId: userId,
          breakStart: formatTime(now),
          breakStartTs: nowTs,
          breakEnd: null,
          breakEndTs: null,
          status: "pending",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        breakRef,
        {
          date: todayKey,
          workerId: userId,
          startTime: formatTime(now),
          endTime: null,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }
    const breakStart = todayAttendance.breakStart;
    const breakEnd = formatTime(now);
    const breakMinutes = calcBreakMinutes(
      breakStart,
      breakEnd,
      todayAttendance?.breakStartTs,
      nowTs
    );
    await setDoc(
      attendanceRef,
      {
        date: todayKey,
        workerId: userId,
        breakEnd,
        breakEndTs: nowTs,
        breakMinutes,
        status: "pending",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      breakRef,
      {
        date: todayKey,
        workerId: userId,
        endTime: breakEnd,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleResetAttendance = async () => {
    if (!userId) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
    const breakRef = doc(db, "users", userId, "breaks", todayKey);
    const overtimeRef = doc(db, "users", userId, "overtime", todayKey);
    await setDoc(
      attendanceRef,
      {
        clockIn: null,
        clockOut: null,
        breakStart: null,
        breakEnd: null,
        clockInTs: null,
        clockOutTs: null,
        breakStartTs: null,
        breakEndTs: null,
        breakMinutes: 0,
        hours: 0,
        rawMinutes: 0,
        netMinutes: 0,
        roundedMinutes: 0,
        netHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        basePay: 0,
        overtimePay: 0,
        dailyPay: 0,
        dayMultiplier: 1,
        finalPay: 0,
        plannedStart: null,
        plannedEnd: null,
        isLate: false,
        lateMinutes: 0,
        isEarlyLeave: false,
        earlyLeaveMinutes: 0,
        status: "pending",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      breakRef,
      {
        date: todayKey,
        workerId: userId,
        startTime: null,
        endTime: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      overtimeRef,
      {
        date: todayKey,
        workerId: userId,
        startTime: null,
        endTime: null,
        hours: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatSending) return;
    const envChatUrl = process.env.EXPO_PUBLIC_JAMAI_CHAT_URL ?? "";
    const defaultChatUrl = firebaseProjectId
      ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/jamAiChat`
      : "";
    const jamAiChatUrl = envChatUrl || defaultChatUrl;
    if (!jamAiChatUrl) {
      setChatError("Missing EXPO_PUBLIC_JAMAI_CHAT_URL.");
      return;
    }

    const historyPayload = chatMessagesToShow.map(({ role, content }) => ({
      role,
      content,
    }));
    const outgoing: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setChatMessages(prev => [...prev, outgoing]);
    setChatInput("");
    setChatSending(true);
    setChatError(null);

    try {
      const sendChatRequest = async (url: string) => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            context: {
              system: FINANCE_SYSTEM_PROMPT,
            },
          }),
        });
        const rawText = await response.text();
        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = null;
        }
        return { response, data };
      };

      let { response, data } = await sendChatRequest(jamAiChatUrl);
      if (
        !response.ok &&
        response.status === 404 &&
        envChatUrl &&
        defaultChatUrl &&
        envChatUrl !== defaultChatUrl
      ) {
        ({ response, data } = await sendChatRequest(defaultChatUrl));
      }
      if (!response.ok) {
        const fallback =
          typeof data?.error === "string" && data.error
            ? data.error
            : `Assistant error (${response.status}).`;
        throw new Error(fallback);
      }
      if (!data) {
        throw new Error("Assistant returned an invalid response.");
      }
      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : "Sorry, I couldn't find an answer for that.";
      setChatMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reach JamAI.";
      setChatError(message);
      setChatMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I couldn't reach the assistant. Please try again.",
        },
      ]);
    } finally {
      setChatSending(false);
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

  useEffect(() => {
    if (!hasPending) {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
      return () => undefined;
    }
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    spinLoop.current = loop;
    loop.start();
    return () => {
      spinLoop.current?.stop();
    };
  }, [hasPending, spinAnim]);

  useEffect(() => {
    const configRef = doc(db, "config", "system");
    const unsub = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setWorkConfig({
        workingDaysPerWeek: Number(data.workingDaysPerWeek ?? 0),
        hoursPerDay: Number(data.hoursPerDay ?? 0),
        hourlyRate: Number(data.hourlyRate ?? 0),
        overtimeRate: Number(data.overtimeRate ?? 0),
        payType: String(data.payType ?? "hourly"),
        dailyRate: Number(data.dailyRate ?? 0),
        dailyMinHours: Number(data.dailyMinHours ?? 6),
        dailyProrate: Boolean(data.dailyProrate ?? false),
        otAfterHours: Number(data.otAfterHours ?? 8),
        otMultiplier: Number(data.otMultiplier ?? 1.5),
        breakPaid: Boolean(data.breakPaid ?? false),
        breakFixedMinutes: Number(data.breakFixedMinutes ?? 0),
        autoBreak: Boolean(data.autoBreak ?? true),
        roundingMinutes: Number(data.roundingMinutes ?? 15),
        roundingMode: String(data.roundingMode ?? "nearest"),
        roundingScope: String(data.roundingScope ?? "net"),
        lateGraceMinutes: Number(data.lateGraceMinutes ?? 5),
        earlyGraceMinutes: Number(data.earlyGraceMinutes ?? 5),
        weekendMultiplier: Number(data.weekendMultiplier ?? 1.25),
        holidayMultiplier: Number(data.holidayMultiplier ?? 2),
        holidays: Array.isArray(data.holidays)
          ? data.holidays.map((value: any) => String(value))
          : [],
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) {
      setAttendanceLogs([]);
      return;
    }
    const attendanceRef = collection(db, "users", userId, "attendance");
    const unsub = onSnapshot(attendanceRef, snapshot => {
      const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
      setAttendanceLogs(logs);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBreakLogs([]);
      return;
    }
    const breaksRef = collection(db, "users", userId, "breaks");
    const unsub = onSnapshot(breaksRef, snapshot => {
      const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
      setBreakLogs(logs);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setOvertimeLogs([]);
      return;
    }
    const overtimeRef = collection(db, "users", userId, "overtime");
    const unsub = onSnapshot(overtimeRef, snapshot => {
      const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
      setOvertimeLogs(logs);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSelectedPeriod(getCurrentPeriodKey(new Date()));
      setPastSalaryPeriod(null);
      setPayrollRecords([]);
      return;
    }
    const payrollRef = collection(db, "users", userId, "payroll");
    const unsub = onSnapshot(payrollRef, snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as any);
      setPayrollRecords(list);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGoalsCount(0);
      return;
    }
    const goalsRef = collection(db, "users", userId, "goals");
    const unsub = onSnapshot(goalsRef, snapshot => {
      setGoalsCount(snapshot.size);
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setTodayAttendance(null);
      return;
    }
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
    const unsub = onSnapshot(attendanceRef, snap => {
      if (!snap.exists()) {
        setTodayAttendance(null);
        return;
      }
      const data = snap.data() as any;
      setTodayAttendance({
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        breakStart: data.breakStart,
        breakEnd: data.breakEnd,
        clockInTs: data.clockInTs,
        clockOutTs: data.clockOutTs,
        breakStartTs: data.breakStartTs,
        breakEndTs: data.breakEndTs,
        status: data.status,
        hours: Number(data.hours ?? 0),
      });
    });
    return unsub;
  }, [userId]);

  /* =====================
     UI
  ===================== */
  return (
    <LinearGradient colors={["#0b1220", "#111827"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* 🔝 HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={handleLogoPress}
            >
              <Text style={styles.avatarText}>💰</Text>
            </TouchableOpacity>

            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.greeting}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => {
                setShowGameSplash(false);
                setShowGameGate(true);
              }}
            >
              <Animated.View style={styles.gameIconWrap}>
                <Animated.View
                  style={[
                    styles.gameIconGlow,
                    {
                      opacity: gameGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.15, 0.45],
                      }),
                      transform: [
                        {
                          scale: gameGlow.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1.15],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Gamepad2 size={22} color="#e5e7eb" />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/ai")}>
              <View style={styles.gameIconWrap}>
                <Sparkles size={20} color="#b7f34d" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/notifications")}>
              <Bell size={22} color="#e5e7eb" />
              <View style={styles.dot} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout}>
              <LogOut size={22} color="#e5e7eb" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* 💰 Earnings Summary */}
            <LinearGradient
              colors={["#0f172a", "#1b2636"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.salarySummary}
            >
              <View style={styles.salaryAccent} />
              <View style={styles.salaryTopRow}>
                <View>
                  <Text style={styles.salaryTitle}>{titleText}</Text>
                  <Text style={styles.salaryAmount}>
                    RM {displayCollectedEarnings.toFixed(2)}
                  </Text>
                  <Text style={styles.salarySub}>
                    {formatPeriodLabel(selectedPeriod)}
                  </Text>
                </View>
                <View style={styles.salaryTopRight}>
                  <View style={styles.salaryMenuAnchor}>
                    <TouchableOpacity
                      style={styles.salaryMenuButton}
                      onPress={() => setShowSalaryMenu(prev => !prev)}
                    >
                      <Text style={styles.salaryMenuButtonText}>Menu</Text>
                      <ChevronDown size={14} color="#0f172a" />
                    </TouchableOpacity>
                    {showSalaryMenu ? (
                      <View style={styles.salaryMenuTop}>
                        <TouchableOpacity
                          style={styles.salaryMenuItem}
                          onPress={() => {
                            setSalaryView("past");
                            setPastSalaryPeriod(null);
                            setShowSalaryMenu(false);
                            setShowPastSalary(true);
                          }}
                        >
                          <Text style={styles.salaryMenuText}>Past Salary</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.salaryMenuItem}
                          onPress={() => {
                            setShowSalaryMenu(false);
                            setShowMonthPicker(true);
                          }}
                        >
                          <Text style={styles.salaryMenuText}>
                            {formatPeriodLabel(selectedPeriod)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.salaryIconWrap}>
                    <DollarSign size={20} color="#0f172a" />
                  </View>
                </View>
              </View>

              <Text style={styles.salaryHint}>{displayAmountSummary}</Text>
              <View style={styles.row}>
                {hasPending ? (
                  <View style={styles.loaderTrack}>
                    <Animated.View
                      style={[
                        styles.loaderIndicator,
                        {
                          transform: [
                            {
                              translateX: spinAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 8],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View style={styles.statusDotPaid} />
                )}
                <Text style={styles.salaryStatusText}>
                  {hasPending
                    ? `Awaiting approval for ${pendingCount} shift${pendingCount === 1 ? "" : "s"}`
                    : "All shifts approved so far"}
                </Text>
              </View>

              <View style={styles.salaryPillRow}>
                <View style={styles.salaryMetricCard}>
                  <Text style={styles.salaryMetricLabel}>Approved</Text>
                  <Text style={styles.salaryMetricValue}>
                    RM {approvedDisplayValue.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.salaryMetricCard, styles.salaryMetricCardAlt]}>
                  <Text style={styles.salaryMetricLabel}>{displayRightLabel}</Text>
                  <Text style={styles.salaryMetricValue}>
                    RM {displayRightValue.toFixed(2)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.salaryDetailsButton}
                onPress={() => setShowEarningsBreakdown(true)}
              >
                <Text style={styles.salaryDetailsText}>View details</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* ⏰ Today Shift */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Today shift</Text>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: tickAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <Clock size={20} color="#b7f34d" />
                </Animated.View>
              </View>

              {schedule ? (
                <Text style={styles.shiftMeta}>
                  {schedule.name} • {schedule.startTime} - {schedule.endTime}
                </Text>
              ) : null}

              {todayShift ? (
                <>
                  <Text style={styles.shiftTitle}>{todayShift.role}</Text>
                  <Text style={styles.shiftMeta}>
                    {todayShift.start} - {todayShift.end} • {todayShift.location}
                  </Text>
                  <View style={styles.statusRow}>
                    <Text
                      style={[
                        styles.statusText,
                        todayStatus === "completed" && styles.statusCompleted,
                        todayStatus === "absent" && styles.statusAbsent,
                      ]}
                    >
                      {todayStatus}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => {
                        setActiveShift({
                          ...todayShift,
                          status: todayStatus,
                        });
                        setShowShiftDetails(true);
                      }}
                    >
                      <Text style={styles.viewButtonText}>View details</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round(todayProgress * 100)}%` },
                        todayStatus === "completed" && styles.progressBarFillComplete,
                      ]}
                    />
                  </View>
                  <View style={styles.clockRow}>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Clock in</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.clockIn || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Clock out</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.clockOut || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Break</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.breakStart
                          ? todayAttendance.breakEnd
                            ? `${todayAttendance.breakStart}-${todayAttendance.breakEnd}`
                            : `${todayAttendance.breakStart}-...`
                          : "--:--"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.clockActions}>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockPrimary]}
                      onPress={handleClockIn}
                      disabled={!!todayAttendance?.clockIn}
                    >
                      <Text style={styles.clockButtonTextLight}>Clock in</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockPrimary]}
                      onPress={handleClockOut}
                      disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                    >
                      <Text style={styles.clockButtonTextLight}>Clock out</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockGhost]}
                      onPress={handleBreakToggle}
                      disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                    >
                      <Text style={styles.clockButtonText}>
                        {todayAttendance?.breakStart && !todayAttendance?.breakEnd
                          ? "End break"
                          : "Break"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockReset]}
                      onPress={handleResetAttendance}
                    >
                      <Text style={styles.clockResetText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.smallText}>No shift scheduled today</Text>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: "0%" }]} />
                  </View>
                  <View style={styles.clockRow}>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Clock in</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.clockIn || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Clock out</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.clockOut || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.clockItem}>
                      <Text style={styles.clockLabel}>Break</Text>
                      <Text style={styles.clockValue}>
                        {todayAttendance?.breakStart
                          ? todayAttendance.breakEnd
                            ? `${todayAttendance.breakStart}-${todayAttendance.breakEnd}`
                            : `${todayAttendance.breakStart}-...`
                          : "--:--"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.clockActions}>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockPrimary]}
                      onPress={handleClockIn}
                      disabled={!!todayAttendance?.clockIn}
                    >
                      <Text style={styles.clockButtonTextLight}>Clock in</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockPrimary]}
                      onPress={handleClockOut}
                      disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                    >
                      <Text style={styles.clockButtonTextLight}>Clock out</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockGhost]}
                      onPress={handleBreakToggle}
                      disabled={!todayAttendance?.clockIn || !!todayAttendance?.clockOut}
                    >
                      <Text style={styles.clockButtonText}>
                        {todayAttendance?.breakStart && !todayAttendance?.breakEnd
                          ? "End break"
                          : "Break"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.clockButton, styles.clockReset]}
                      onPress={handleResetAttendance}
                    >
                      <Text style={styles.clockResetText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.upcomingRow}>
                {nextShift ? (
                  <>
                    <View>
                      <Text style={styles.upcomingLabel}>Upcoming shift</Text>
                      <Text style={styles.shiftMeta}>
                        {formatDateLabel(nextShift.date)} • {nextShift.start} - {nextShift.end}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.detailButton}
                      onPress={() => {
                        setActiveShift({
                          ...nextShift,
                          status: resolveStatus(
                            nextShift.status,
                            attendanceStatusMap[nextShift.date]
                          ),
                        });
                        setShowShiftDetails(true);
                      }}
                    >
                      <Text style={styles.detailButtonText}>View details</Text>
                      <ChevronRight size={16} color="#e5e7eb" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View>
                      <Text style={styles.upcomingLabel}>Upcoming shift</Text>
                      <Text style={styles.smallText}>No upcoming shift</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* 🤖 Finance Chat */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>Finance chat</Text>
                  <Text style={styles.cardHint}>
                    Ask about budgets, savings, debt, or income.
                  </Text>
                </View>
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>AI</Text>
                </View>
              </View>

              <View style={styles.chatThread}>
                {chatMessagesToShow.map(message => (
                  <View
                    key={message.id}
                    style={[
                      styles.chatBubble,
                      message.role === "user"
                        ? styles.chatBubbleUser
                        : styles.chatBubbleAssistant,
                    ]}
                  >
                    <Text
                      style={
                        message.role === "user"
                          ? styles.chatBubbleUserText
                          : styles.chatBubbleAssistantText
                      }
                    >
                      {message.content}
                    </Text>
                  </View>
                ))}
                {chatSending ? (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                    <Text style={styles.chatBubbleAssistantText}>Thinking...</Text>
                  </View>
                ) : null}
              </View>

              {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}

              <View style={styles.chatInputRow}>
                <TextInput
                  placeholder="Ask a financial question"
                  placeholderTextColor="#94a3b8"
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.chatSendButton,
                    chatSending ? styles.chatSendDisabled : null,
                  ]}
                  onPress={handleSendChat}
                  disabled={chatSending}
                >
                  <Text style={styles.chatSendText}>
                    {chatSending ? "..." : "Send"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.chatDisclaimer}>
                For info only. Not financial, legal, or tax advice.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {showGameGate ? (
          <View style={styles.gameGateOverlay}>
            <View style={styles.gameGateCard}>
              <TouchableOpacity
                style={styles.gameGateCloseButton}
                onPress={() => setShowGameGate(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.gameGateCloseGlow} />
                <X size={16} color="#ffffff" />
              </TouchableOpacity>
              <Animated.View
                style={[
                  styles.gameGateTitleRow,
                  { transform: [{ translateY: floatY }] },
                ]}
              >
                <View style={styles.gameGateTitleStack}>
                  <Animated.Text
                    style={[
                      styles.gameGateTitle,
                      styles.gameGateTitleGlow,
                      { opacity: gameTitleGlow },
                      {
                        fontFamily: pixelFontLoaded
                          ? "PressStart2P"
                          : undefined,
                      },
                    ]}
                  >
                    GAME
                  </Animated.Text>
                  <Text
                    style={[
                      styles.gameGateTitle,
                      { fontFamily: pixelFontLoaded ? "PressStart2P" : undefined },
                    ]}
                  >
                    GAME
                  </Text>
                </View>
                <View style={styles.gameGateTitleStack}>
                  <Animated.Text
                    style={[
                      styles.gameGateTitle,
                      styles.gameGateTitleTight,
                      styles.gameGateTitleGlow,
                      { opacity: gameTitleGlow },
                      {
                        fontFamily: pixelFontLoaded
                          ? "PressStart2P"
                          : undefined,
                      },
                    ]}
                  >
                    ON
                  </Animated.Text>
                  <Text
                    style={[
                      styles.gameGateTitle,
                      styles.gameGateTitleTight,
                      { fontFamily: pixelFontLoaded ? "PressStart2P" : undefined },
                    ]}
                  >
                    ON
                  </Text>
                </View>
              </Animated.View>
              <View
                style={styles.gameGateSlider}
                onLayout={event =>
                  setSliderTrackWidth(event.nativeEvent.layout.width)
                }
              >
                <Animated.View
                  style={[
                    styles.gameGateSliderFill,
                    { width: sliderTrackWidth > 0 ? sliderFillWidth : 0 },
                  ]}
                />
                <Text style={styles.gameGateSliderText}>Slide to enter</Text>
                <Animated.View
                  style={[
                    styles.gameGateSliderKnob,
                    { transform: [{ translateX: sliderX }] },
                  ]}
                  {...sliderPanResponder.panHandlers}
                >
                  <Gamepad2 size={18} color="#0f172a" />
                </Animated.View>
              </View>
              <View style={styles.gameGateChaseTrack}>
                <Animated.View
                  style={[
                    styles.gameGateChaseRow,
                    {
                      transform: [
                        {
                          translateX: gameChase.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, chaseMax],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.pacman}>
                    <Animated.View
                      style={[
                        styles.pacmanMouth,
                        {
                          transform: [
                            {
                              scaleX: gameChomp.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.35, 1],
                              }),
                            },
                            {
                              scaleY: gameChomp.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.35, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                  <View style={[styles.ghost, styles.ghostRed]}>
                    <View style={styles.ghostEyes}>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.ghostFeet}>
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                    </View>
                  </View>
                  <View style={[styles.ghost, styles.ghostBlue]}>
                    <View style={styles.ghostEyes}>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.ghostFeet}>
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                    </View>
                  </View>
                  <View style={[styles.ghost, styles.ghostGreen]}>
                    <View style={styles.ghostEyes}>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.ghostEyeSocket}>
                        <Animated.View
                          style={[
                            styles.ghostEyePupil,
                            {
                              transform: [
                                {
                                  translateX: ghostEyeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-1, 1],
                                  }),
                                },
                              ],
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.ghostFeet}>
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                      <View style={styles.ghostFoot} />
                    </View>
                  </View>
                </Animated.View>
              </View>
            </View>
          </View>
        ) : null}

        {showGameSplash ? (
          <View style={styles.gameSplashOverlay}>
            <View style={styles.gameSplashCard}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: gameSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                }}
              >
                <Gamepad2 size={36} color="#22c55e" />
              </Animated.View>
              <Text style={styles.gameSplashText}>Loading Arcade...</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      {showShiftDetails && activeShift ? (
        <View style={styles.overlay}>
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shift details</Text>
              <TouchableOpacity onPress={() => setShowShiftDetails(false)}>
                <X size={18} color="#e5e7eb" />
              </TouchableOpacity>
            </View>
            {activeShift.type === "schedule" ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Schedule</Text>
                  <Text style={styles.detailValue}>{activeShift.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Days</Text>
                  <Text style={styles.detailValue}>
                    {Array.isArray(activeShift.days) ? activeShift.days.join(", ") : "-"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {activeShift.start} - {activeShift.end}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hourly rate</Text>
                  <Text style={styles.detailValue}>
                    RM {Number(activeShift.hourlyRate ?? 0).toFixed(2)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {formatDateLabel(activeShift.date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>{activeShift.role}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {activeShift.start} - {activeShift.end}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{activeShift.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>
                    {activeShift.status || "scheduled"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hours</Text>
                  <Text style={styles.detailValue}>
                    {activeShift.hours || diffHours(activeShift.start, activeShift.end)}h
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      {showMonthPicker ? (
        <View style={styles.overlay}>
          <View style={styles.monthPickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.monthPickerTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <X size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <View style={styles.monthList}>
              {selectablePeriods.map(period => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.monthButtonLight,
                    period === selectedPeriod && styles.monthButtonActiveLight,
                  ]}
                  onPress={() => {
                    setSelectedPeriod(period);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.monthButtonTextLight,
                      period === selectedPeriod && styles.monthButtonTextActiveLight,
                    ]}
                  >
                    {formatPeriodLabel(period)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {showPastSalary ? (
        <View style={styles.overlay}>
          <View style={styles.pastSalaryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.pastSalaryTitle}>
                {salaryView === "ongoing" ? "Ongoing Pay" : "Past Salary"}
              </Text>
              <TouchableOpacity onPress={() => setShowPastSalary(false)}>
                <X size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>
            {salaryView === "past" && pastSalaryOptions.length === 0 ? (
              <Text style={styles.pastSalaryEmpty}>No finalized salaries yet.</Text>
            ) : (
              <>
                {salaryView === "past" ? (
                  <View style={styles.monthList}>
                    {pastSalaryOptions.map(period => (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.monthButtonLight,
                          period === selectedPastPeriod && styles.monthButtonActiveLight,
                        ]}
                        onPress={() => setPastSalaryPeriod(period)}
                      >
                        <Text
                          style={[
                            styles.monthButtonTextLight,
                            period === selectedPastPeriod && styles.monthButtonTextActiveLight,
                          ]}
                        >
                          {formatPeriodLabel(period)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {isCurrentPastPeriod ? (
                  <View style={styles.pastSalaryCardLight}>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Salary Paid</Text>
                      <Text style={styles.pastSalaryValue}>
                        RM {projectedEarnings.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Payment Date</Text>
                      <Text style={styles.pastSalaryValue}>
                        {new Date().toLocaleDateString("en-GB")}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Shifts</Text>
                      <Text style={styles.pastSalaryValue}>{currentPeriodShiftCount}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Hours</Text>
                      <Text style={styles.pastSalaryValue}>
                        {currentPeriodHours.toFixed(1)}h
                      </Text>
                    </View>
                  </View>
                ) : selectedPastPayroll ? (
                  <View style={styles.pastSalaryCardLight}>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Salary Paid</Text>
                      <Text style={styles.pastSalaryValue}>
                        RM {Number(selectedPastPayroll.totalEarnings ?? 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Payment Date</Text>
                      <Text style={styles.pastSalaryValue}>
                        {selectedPastPayroll.updatedAt
                          ? new Date(selectedPastPayroll.updatedAt).toLocaleDateString("en-GB")
                          : "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Shifts</Text>
                      <Text style={styles.pastSalaryValue}>{pastShiftCount}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.pastSalaryLabel}>Total Hours</Text>
                      <Text style={styles.pastSalaryValue}>
                        {pastHours.toFixed(1)}h
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pastSalaryEmpty}>
                    No payroll data for this month.
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      ) : null}

      {showEarningsBreakdown ? (
        <View style={styles.overlay}>
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Earnings Details</Text>
              <TouchableOpacity onPress={() => setShowEarningsBreakdown(false)}>
                <X size={18} color="#e5e7eb" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailScrollContent}
            >
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Month</Text>
                <Text style={styles.detailValue}>
                  {formatPeriodLabel(selectedPeriod)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Collected so far</Text>
                <Text style={styles.detailValue}>
                  RM {collectedEarnings.toFixed(2)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved hours</Text>
                <Text style={styles.detailValue}>{approvedHoursSoFar.toFixed(1)}h</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned hours</Text>
                <Text style={styles.detailValue}>{assignedHours.toFixed(1)}h</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Overtime hours</Text>
                <Text style={styles.detailValue}>{overtimeHoursSoFar.toFixed(1)}h</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Break minutes</Text>
                <Text style={styles.detailValue}>{Math.round(breakMinutesSoFar)} min</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hourly rate</Text>
                <Text style={styles.detailValue}>RM {hourlyRate.toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Calculation</Text>
                <Text style={styles.detailValue}>
                  {baseHours.toFixed(1)}h × RM {hourlyRate.toFixed(2)}
                  {overtimeHoursSoFar > 0
                    ? ` + ${overtimeHoursSoFar.toFixed(1)}h × RM ${workConfig.overtimeRate.toFixed(2)}`
                    : ""}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Collected total</Text>
                <Text style={styles.detailValue}>
                  RM {collectedEarnings.toFixed(2)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Projected end-of-month</Text>
                <Text style={styles.detailValue}>
                  RM {projectedEarnings.toFixed(2)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shifts approved</Text>
                <Text style={styles.detailValue}>{approvedShiftCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shifts assigned</Text>
                <Text style={styles.detailValue}>{assignedShiftCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pending approval</Text>
                <Text style={styles.detailValue}>{pendingCount}</Text>
              </View>
              <View style={styles.breakdownBlock}>
                <Text style={styles.breakdownTitle}>Shift breakdown</Text>
                {earningsBreakdownRows.length === 0 ? (
                  <Text style={styles.emptyText}>No shifts in this month.</Text>
                ) : (
                  earningsBreakdownRows.map((row, index) => (
                    <View
                      key={`${row.date}-${row.source}-${index}`}
                      style={styles.breakdownRow}
                    >
                      <View>
                        <Text style={styles.breakdownDate}>{row.date}</Text>
                        <Text style={styles.breakdownSub}>
                          {row.source} • {row.hours.toFixed(1)}h
                        </Text>
                      </View>
                      <Text style={styles.breakdownAmount}>
                        RM {row.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

/* =====================
   SMALL COMPONENTS
===================== */

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function calcBreakMinutes(
  start?: string,
  end?: string,
  startTs?: number | null,
  endTs?: number | null
) {
  if (!start || !end) return 0;
  if (startTs && endTs) {
    return Math.max(0, Math.round((endTs - startTs) / 60000));
  }
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, endMinutes - startMinutes);
}

function calcMinutesDiff(start?: string, end?: string) {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, endMinutes - startMinutes);
}

function calcHours(
  start: string,
  end: string,
  breakMinutes = 0,
  startTs?: number | null,
  endTs?: number | null
) {
  if (startTs && endTs) {
    const totalMinutes = Math.max(
      0,
      Math.round((endTs - startTs) / 60000) - breakMinutes
    );
    return totalMinutes / 60;
  }
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const totalMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
  return totalMinutes / 60;
}

function resolveStatus(shiftStatus?: string, attendanceStatus?: string) {
  if (attendanceStatus === "absent" || attendanceStatus === "rejected") {
    return "absent";
  }
  if (attendanceStatus === "approved") return "completed";
  if (attendanceStatus === "pending") return "scheduled";
  if (shiftStatus === "completed") return "completed";
  if (shiftStatus === "absent" || shiftStatus === "off" || shiftStatus === "leave") {
    return "absent";
  }
  if (shiftStatus === "work") return "scheduled";
  return shiftStatus || "scheduled";
}

function mergeAttendanceStatus(existing?: string, next?: string) {
  if (existing === "absent" || existing === "rejected") return existing;
  if (next === "absent" || next === "rejected") return next;
  if (existing === "approved") return existing;
  if (next === "approved") return next;
  return next || existing || "pending";
}

function getShiftProgress(
  shift: { date: string; start: string; end: string },
  status: string
) {
  if (status === "completed") return 1;
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (shift.date !== todayKey) return 0;
  const startMinutes = parseTimeToMinutes(shift.start);
  const endMinutes = parseTimeToMinutes(shift.end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 0;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes <= startMinutes) return 0;
  if (nowMinutes >= endMinutes) return 1;
  return (nowMinutes - startMinutes) / (endMinutes - startMinutes);
}

function computeAttendanceMetrics({
  clockInTs,
  clockOutTs,
  manualBreakMinutes,
  plannedStart,
  plannedEnd,
  dateKey,
  policy,
  hourlyRate,
}: {
  clockInTs?: number | null;
  clockOutTs?: number | null;
  manualBreakMinutes: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  dateKey: string;
  policy: AttendancePolicy;
  hourlyRate: number;
}) {
  const rawMinutes =
    clockInTs && clockOutTs
      ? Math.max(0, Math.round((clockOutTs - clockInTs) / 60000))
      : 0;
  const breakMinutes = resolveBreakMinutes(rawMinutes, manualBreakMinutes, policy);
  const netMinutes = Math.max(0, rawMinutes - breakMinutes);
  const roundedMinutes = roundMinutes(
    netMinutes,
    policy.roundingMinutes,
    policy.roundingMode
  );
  const netHours = roundedMinutes / 60;
  const regularHours = Math.min(netHours, policy.otAfterHours);
  const overtimeHours = Math.max(netHours - policy.otAfterHours, 0);
  const overtimeRate =
    policy.overtimeRate > 0 ? policy.overtimeRate : hourlyRate * policy.otMultiplier;
  let basePay = regularHours * hourlyRate;
  let overtimePay = overtimeHours * overtimeRate;
  let dailyPay = basePay + overtimePay;
  if (policy.payType === "daily" && policy.dailyRate > 0) {
    if (netHours >= policy.dailyMinHours) {
      dailyPay = policy.dailyRate + overtimePay;
    } else if (policy.dailyProrate) {
      dailyPay = (policy.dailyRate * netHours) / policy.dailyMinHours + overtimePay;
    }
  }
  const dayMultiplier = resolveDayMultiplier(dateKey, policy);
  const finalPay = dailyPay * dayMultiplier;

  const lateMinutes = getLateMinutes(clockInTs, dateKey, plannedStart, policy);
  const earlyLeaveMinutes = getEarlyLeaveMinutes(
    clockOutTs,
    dateKey,
    plannedEnd,
    policy
  );

  return {
    rawMinutes,
    breakMinutes,
    netMinutes,
    roundedMinutes,
    netHours,
    regularHours,
    overtimeHours,
    basePay,
    overtimePay,
    dailyPay,
    dayMultiplier,
    finalPay,
    isLate: lateMinutes > 0,
    lateMinutes,
    isEarlyLeave: earlyLeaveMinutes > 0,
    earlyLeaveMinutes,
  };
}

function resolveBreakMinutes(
  rawMinutes: number,
  manualBreakMinutes: number,
  policy: AttendancePolicy
) {
  if (policy.breakPaid) return 0;
  if (manualBreakMinutes > 0) return manualBreakMinutes;
  if (policy.breakFixedMinutes > 0) return policy.breakFixedMinutes;
  if (!policy.autoBreak) return 0;
  if (rawMinutes >= 540) return 60;
  if (rawMinutes >= 360) return 30;
  return 0;
}

function roundMinutes(minutes: number, interval: number, mode: string) {
  if (!interval || interval <= 1) return minutes;
  const factor = minutes / interval;
  if (mode === "floor") return Math.floor(factor) * interval;
  if (mode === "ceil") return Math.ceil(factor) * interval;
  return Math.round(factor) * interval;
}

function resolveDayMultiplier(dateKey: string, policy: AttendancePolicy) {
  if (policy.holidays.includes(dateKey)) return policy.holidayMultiplier;
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay();
  if (day === 0 || day === 6) return policy.weekendMultiplier;
  return 1;
}

function getMinutesOfDay(ts?: number | null) {
  if (!ts) return null;
  const date = new Date(ts);
  return date.getHours() * 60 + date.getMinutes();
}

function getLateMinutes(
  clockInTs: number | null | undefined,
  dateKey: string,
  plannedStart: string | null,
  policy: AttendancePolicy
) {
  if (!clockInTs || !plannedStart) return 0;
  const plan = parseTimeToMinutes(plannedStart);
  const actual = getMinutesOfDay(clockInTs);
  if (plan === null || actual === null) return 0;
  const allowed = plan + policy.lateGraceMinutes;
  return actual > allowed ? actual - allowed : 0;
}

function getEarlyLeaveMinutes(
  clockOutTs: number | null | undefined,
  dateKey: string,
  plannedEnd: string | null,
  policy: AttendancePolicy
) {
  if (!clockOutTs || !plannedEnd) return 0;
  const plan = parseTimeToMinutes(plannedEnd);
  const actual = getMinutesOfDay(clockOutTs);
  if (plan === null || actual === null) return 0;
  const allowed = plan - policy.earlyGraceMinutes;
  return actual < allowed ? allowed - actual : 0;
}

function parseTimeToMinutes(time?: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function getCurrentPeriodKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

const formatPeriodLabel = (period: string) => {
  if (!period) return "—";
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex)) return period;
  return new Date(Number(year), monthIndex, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const getPeriodBounds = (period: string) => {
  const [year, month] = period.split("-");
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) {
    const today = new Date();
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  return {
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  };
};

const getShiftHours = (shift: { hours?: number; start?: string; end?: string }) =>
  shift.hours ?? diffHours(shift.start ?? "", shift.end ?? "");

const getLogHours = (log: {
  hours?: number;
  netHours?: number;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  breakStart?: string;
  breakEnd?: string;
  clockInTs?: number;
  clockOutTs?: number;
  breakStartTs?: number;
  breakEndTs?: number;
}) => {
  const storedNet = Number((log as any).netHours ?? (log as any).net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes =
    Number(log.breakMinutes ?? 0) ||
    calcBreakMinutes(log.breakStart, log.breakEnd, log.breakStartTs, log.breakEndTs);
  if (log.clockIn && log.clockOut) {
    return calcHours(log.clockIn, log.clockOut, breakMinutes, log.clockInTs, log.clockOutTs);
  }
  return 0;
};

const buildSelectablePeriods = (
  shifts: { date: string }[],
  logs: { date?: string }[],
  payroll: { period?: string }[]
) => {
  const periods = new Set<string>();
  const current = getCurrentPeriodKey(new Date());
  periods.add(current);
  shifts.forEach(shift => {
    if (shift.date?.length >= 7) periods.add(shift.date.slice(0, 7));
  });
  logs.forEach(log => {
    const date = String(log.date ?? "");
    if (date.length >= 7) periods.add(date.slice(0, 7));
  });
  payroll.forEach(record => {
    const period = String(record.period ?? "");
    if (period) periods.add(period);
  });
  const recent = lastNPeriods(6);
  recent.forEach(period => periods.add(period));
  return Array.from(periods).sort((a, b) => b.localeCompare(a));
};

const lastNPeriods = (count: number) => {
  const list: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    list.push(getCurrentPeriodKey(d));
  }
  return list;
};

const getWeeklyHours = (
  shifts: { date: string; hours?: number; start?: string; end?: string }[]
) => {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return shifts.reduce((sum, shift) => {
    const date = new Date(`${shift.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return sum;
    if (date < start || date > end) return sum;
    const hours = shift.hours ?? diffHours(shift.start ?? "", shift.end ?? "");
    return sum + hours;
  }, 0);
};

const getWeeklyHoursFromLogs = (
  logs: {
    date?: string;
    hours?: number;
    clockIn?: string;
    clockOut?: string;
    breakMinutes?: number;
    breakStart?: string;
    breakEnd?: string;
    clockInTs?: number;
    clockOutTs?: number;
    breakStartTs?: number;
    breakEndTs?: number;
  }[]
) => {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return logs.reduce((sum, log) => {
    const date = new Date(`${log.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return sum;
    if (date < start || date > end) return sum;
    return sum + getLogHours(log);
  }, 0);
};

const getWeeklyOvertimeHours = (entries: any[]) => {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return entries.reduce((sum, entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return sum;
    if (date < start || date > end) return sum;
    const hours =
      Number(entry.hours ?? 0) ||
      calcHours(entry.startTime ?? "", entry.endTime ?? "", 0);
    return sum + hours;
  }, 0);
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const diffHours = (start: string, end: string) => {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

const getNextShift = (
  shifts: { date: string; start: string; end: string; status?: string }[],
  attendanceMap: Record<string, string>
) => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const future = shifts
    .filter(shift => {
      const effectiveStatus = resolveStatus(
        shift.status,
        attendanceMap[shift.date]
      );
      if (effectiveStatus === "completed" || effectiveStatus === "absent") {
        return false;
      }
      if (shift.date > todayKey) return true;
      if (shift.date < todayKey) return false;
      const [startH, startM] = shift.start.split(":").map(Number);
      const shiftMinutes = (startH || 0) * 60 + (startM || 0);
      return shiftMinutes > currentMinutes;
    })
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  return future[0] || null;
};

const formatDateLabel = (value: string) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

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

  /* HEADER */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
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
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatarText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  greeting: { fontSize: 13, color: "#9ca3af" },
  headerRight: { flexDirection: "row", gap: 16, alignItems: "center" },
  gameIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  gameIconGlow: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(183,243,77,0.35)",
  },
  gameGateOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  gameGateCard: {
    width: "100%",
    maxWidth: 360,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
    alignItems: "center",
  },
  gameGateCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  gameGateCloseGlow: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(239, 68, 68, 0.4)",
  },
  gameGateTitle: {
    fontSize: 26,
    color: "#facc15",
    letterSpacing: 0,
    textShadowColor: "#8b3f00",
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  gameGateTitleStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  gameGateTitleGlow: {
    position: "absolute",
    textShadowColor: "rgba(255, 225, 120, 1)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  gameGateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gameGateTitleTight: { marginLeft: 6 },
  gameGateSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 18,
  },
  gameGateSlider: {
    width: "88%",
    height: 46,
    borderRadius: 999,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    justifyContent: "center",
    overflow: "hidden",
    padding: 5,
    marginTop: 12,
  },
  gameGateSliderFill: {
    position: "absolute",
    left: 5,
    top: 5,
    bottom: 5,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.6)",
  },
  gameGateSliderText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  gameGateSliderKnob: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  gameGateChaseTrack: {
    width: "88%",
    height: 22,
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    overflow: "hidden",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  gameGateChaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pacman: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#facc15",
    position: "relative",
  },
  pacmanMouth: {
    position: "absolute",
    right: -1,
    top: 3,
    width: 8,
    height: 8,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    transform: [{ rotate: "45deg" }],
  },
  ghost: {
    width: 14,
    height: 14,
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  ghostRed: { backgroundColor: "#ef4444" },
  ghostBlue: { backgroundColor: "#38bdf8" },
  ghostGreen: { backgroundColor: "#22c55e" },
  ghostEyes: {
    flexDirection: "row",
    gap: 3,
    position: "absolute",
    top: 3,
    left: 3,
  },
  ghostEyeSocket: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ghostEyePupil: {
    width: 2,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#0f172a",
  },
  ghostFeet: {
    position: "absolute",
    bottom: -2,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 1,
  },
  ghostFoot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#0f172a",
  },
  gameSplashOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  gameSplashCard: {
    width: 180,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  gameSplashText: { color: "#e2e8f0", fontWeight: "700", fontSize: 12 },
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

  salarySummary: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    overflow: "hidden",
  },
  salaryAccent: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#f59e0b",
    right: -90,
    top: -70,
    transform: [{ rotate: "-15deg" }],
  },
  salaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  salaryTopRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  salaryTitle: { color: "#e2e8f0", fontSize: 14 },
  salaryAmount: { color: "#ffffff", fontSize: 30, fontWeight: "700" },
  salarySub: { color: "rgba(226,232,240,0.8)", fontSize: 12, marginTop: 4 },
  salaryHint: { color: "rgba(226,232,240,0.9)", fontSize: 12 },
  salaryMenuButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  salaryMenuButtonText: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  salaryMenuAnchor: { alignItems: "flex-end" },
  salaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
  },
  salaryStatusText: { color: "#e2e8f0", fontSize: 13 },
  statusDotPaid: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  loaderTrack: {
    width: 28,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
    marginRight: 6,
  },
  loaderIndicator: {
    width: 12,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  salaryPillRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  salaryMetricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  salaryMetricCardAlt: {
    backgroundColor: "rgba(253, 186, 116, 0.25)",
  },
  salaryMetricLabel: { color: "#e2e8f0", fontSize: 11 },
  salaryMetricValue: { color: "#ffffff", fontWeight: "700", marginTop: 4 },
  salaryDetailsButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  salaryDetailsText: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  salaryMenu: {
    marginTop: 6,
    backgroundColor: "#141c2a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    overflow: "hidden",
    minWidth: 160,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  salaryMenuTop: {
    marginTop: 8,
    backgroundColor: "#141c2a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    overflow: "hidden",
    minWidth: 180,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  salaryMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  salaryMenuText: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },

  card: {
    backgroundColor: "#141c2a",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#273244",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  cardHint: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  smallText: { fontSize: 12, color: "#9ca3af" },
  emptyText: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  shiftTitle: { fontSize: 15, fontWeight: "700", marginTop: 6, color: "#e5e7eb" },
  shiftMeta: { fontSize: 12, color: "#9ca3af", marginTop: 4 },

  progressBarBg: {
    height: 6,
    backgroundColor: "#273244",
    borderRadius: 6,
    marginVertical: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#b7f34d",
    borderRadius: 6,
  },
  progressBarFillComplete: { backgroundColor: "#b7f34d" },
  statusRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusText: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  statusCompleted: { color: "#b7f34d" },
  statusAbsent: { color: "#ef4444" },
  viewButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#1b2636",
  },
  viewButtonText: { color: "#e5e7eb", fontSize: 11, fontWeight: "600" },
  detailButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#1b2636",
  },
  detailButtonText: { color: "#e5e7eb", fontWeight: "600", fontSize: 12 },
  disabledButton: { opacity: 0.5 },
  clockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  clockItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#1b2636",
    marginRight: 8,
  },
  clockLabel: { color: "#9ca3af", fontSize: 10 },
  clockValue: { color: "#e5e7eb", fontWeight: "700", marginTop: 4, fontSize: 12 },
  clockActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  clockButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  clockPrimary: { backgroundColor: "#b7f34d" },
  clockGhost: { backgroundColor: "#1b2636" },
  clockReset: { backgroundColor: "#ef4444" },
  clockButtonText: { color: "#e5e7eb", fontWeight: "700", fontSize: 12 },
  clockButtonTextLight: { color: "#0b1220", fontWeight: "700", fontSize: 12 },
  clockResetText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  upcomingRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#273244",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  detailModal: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "85%",
    backgroundColor: "#141c2a",
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { color: "#e5e7eb", fontWeight: "700" },
  detailScrollContent: {
    paddingBottom: 8,
  },
  monthPickerModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  monthPickerTitle: { color: "#0f172a", fontWeight: "700" },
  pastSalaryModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pastSalaryTitle: { color: "#0f172a", fontWeight: "700" },
  pastSalaryEmpty: { color: "#64748b", fontSize: 12 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { color: "#9ca3af", fontSize: 12 },
  detailValue: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  monthList: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthButtonLight: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  monthButtonActiveLight: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  monthButtonTextLight: { color: "#334155", fontSize: 12 },
  monthButtonTextActiveLight: { color: "#0b1220", fontWeight: "700" },
  monthButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273244",
  },
  monthButtonActive: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  monthButtonText: { color: "#9ca3af", fontSize: 12 },
  monthButtonTextActive: { color: "#0b1220", fontWeight: "700" },
  pastSalaryCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
  },
  pastSalaryCardLight: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  pastSalaryLabel: { color: "#64748b", fontSize: 12 },
  pastSalaryValue: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  breakdownBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#273244",
    paddingTop: 12,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  breakdownDate: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  breakdownSub: { color: "#9ca3af", fontSize: 11, marginTop: 2 },
  breakdownAmount: { color: "#e5e7eb", fontSize: 12, fontWeight: "700" },


  chatBadge: {
    backgroundColor: "#b7f34d",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chatBadgeText: { color: "#0b1220", fontSize: 11, fontWeight: "700" },
  chatThread: {
    marginTop: 12,
    gap: 8,
  },
  chatBubble: {
    maxWidth: "85%",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#b7f34d",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#1b2636",
  },
  chatBubbleUserText: { color: "#0b1220", fontSize: 12, fontWeight: "700" },
  chatBubbleAssistantText: { color: "#e5e7eb", fontSize: 12 },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#273244",
    borderRadius: 12,
    fontSize: 12,
    color: "#e5e7eb",
    backgroundColor: "#101826",
  },
  chatSendButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#b7f34d",
  },
  chatSendDisabled: { opacity: 0.6 },
  chatSendText: { color: "#0b1220", fontSize: 12, fontWeight: "700" },
  chatError: { marginTop: 6, color: "#ef4444", fontSize: 11 },
  chatDisclaimer: { marginTop: 8, fontSize: 10, color: "#94a3b8" },
});
