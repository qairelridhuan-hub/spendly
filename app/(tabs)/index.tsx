import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import {
  Bell,
  Clock,
  DollarSign,
  Target,
  Calendar,
  User,
  Gamepad2,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
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
import { auth, db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useCalendar, useTheme } from "@/lib/context";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const [displayName, setDisplayName] = useState("User");
  const [userId, setUserId] = useState<string | null>(null);
  const [showGameSplash, setShowGameSplash] = useState(false);
  const gameGlow = useRef(new Animated.Value(0)).current;
  const gameSpin = useRef(new Animated.Value(0)).current;
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
  });
  /* =====================
     STATE
  ===================== */
  const { getTodayShift, shifts } = useCalendar();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState(
    getCurrentPeriodKey(new Date())
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showPastSalary, setShowPastSalary] = useState(false);
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
    schedule?.hourlyRate ?? userHourlyRate ?? workConfig.hourlyRate;
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );
  const weeklyRegularHours = getWeeklyHoursFromLogs(approvedLogs);
  const weeklyOvertimeHours = getWeeklyOvertimeHours(overtimeLogs);
  const weeklyCurrent = weeklyRegularHours + weeklyOvertimeHours;
  const weeklyEarnings =
    weeklyRegularHours * hourlyRate +
    weeklyOvertimeHours * workConfig.overtimeRate;
  const todayShift = getTodayShift();
  const nextShift = getNextShift(shifts);
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
  const rightLabel =
    selectedPeriod === currentPeriod ? "Projected End-of-Month" : "Finalized Total";
  const rightValue =
    selectedPeriod === currentPeriod ? projectedEarnings : collectedEarnings;

  const selectablePeriods = useMemo(
    () => buildSelectablePeriods(shifts, attendanceLogs, payrollRecords),
    [shifts, attendanceLogs, payrollRecords]
  );

  const pastSalaryOptions = useMemo(() => {
    const periods = payrollRecords
      .map(record => String(record.period ?? ""))
      .filter(Boolean);
    return Array.from(new Set(periods)).sort((a, b) => b.localeCompare(a));
  }, [payrollRecords]);

  const selectedPastPeriod = pastSalaryPeriod || pastSalaryOptions[0] || currentPeriod;
  const selectedPastPayroll =
    payrollRecords.find(record => record.period === selectedPastPeriod) || null;
  const pastShiftCount = approvedLogs.filter(log =>
    String(log.date ?? "").startsWith(selectedPastPeriod)
  ).length;
  const pastHours = approvedLogs.reduce((sum, log) => {
    const date = String(log.date ?? "");
    if (!date.startsWith(selectedPastPeriod)) return sum;
    return sum + getLogHours(log);
  }, 0);

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
    const clockInTime = todayAttendance?.clockIn;
    const clockOutTime = formatTime(now);
    const breakMinutes = calcBreakMinutes(
      todayAttendance?.breakStart,
      todayAttendance?.breakEnd,
      todayAttendance?.breakStartTs,
      todayAttendance?.breakEndTs
    );
    const hours =
      clockInTime
        ? calcHours(
            clockInTime,
            clockOutTime,
            breakMinutes,
            todayAttendance?.clockInTs,
            nowTs
          )
        : 0;
    await setDoc(
      attendanceRef,
      {
        clockOut: clockOutTime,
        clockOutTs: nowTs,
        hours,
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

    const scheduledEnd = todayShift?.end ?? schedule?.endTime;
    if (scheduledEnd) {
      const overtimeHours = calcHours(scheduledEnd, clockOutTime, 0);
      await setDoc(
        overtimeRef,
        {
          date: todayKey,
          workerId: userId,
          startTime: overtimeHours > 0 ? scheduledEnd : null,
          endTime: overtimeHours > 0 ? clockOutTime : null,
          hours: overtimeHours,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
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
    const jamAiChatUrl = process.env.EXPO_PUBLIC_JAMAI_CHAT_URL ?? "";
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
      const response = await fetch(jamAiChatUrl, {
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
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={styles.screen}
    >
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* 🔝 HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push("/(tabs)/profile")}
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
                setShowGameSplash(true);
                setTimeout(() => {
                  setShowGameSplash(false);
                  router.push("/game");
                }, 700);
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
                <Gamepad2 size={22} color="#0f172a" />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/notifications")}>
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
            {/* 💰 Earnings Summary */}
            <LinearGradient
              colors={["#0ea5e9", "#22c55e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.salarySummary}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.salaryTitle}>{titleText}</Text>
                <TouchableOpacity
                  style={styles.salaryPill}
                  onPress={() => setShowMonthPicker(true)}
                >
                  <Text style={styles.salaryPillText}>
                    {formatPeriodLabel(selectedPeriod)}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.salaryAmount}>
                RM {collectedEarnings.toFixed(2)}
              </Text>
              <Text style={styles.salarySubtitle}>{amountLabel}</Text>
              <Text style={styles.salaryHint}>{amountHint}</Text>

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

              <View style={styles.salaryDivider} />

              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.salaryLabel}>{rightLabel}</Text>
                  <Text style={styles.salaryValue}>
                    RM {rightValue.toFixed(2)}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <TouchableOpacity
                    style={styles.salaryActionButton}
                    onPress={() => setShowPastSalary(true)}
                  >
                    <Text style={styles.salaryActionText}>Past Salary</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.salaryActionButton, styles.salaryActionSecondary]}
                    onPress={() => setShowEarningsBreakdown(true)}
                  >
                    <Text style={styles.salaryActionText}>View details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>

            {/* ⏰ Today Shift */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Today shift</Text>
                <Clock size={20} color="#0ea5e9" />
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
                  <View style={styles.progressBarBg} />
                  <TouchableOpacity
                    style={styles.detailButton}
                    onPress={() => {
                      setActiveShift(todayShift);
                      setShowShiftDetails(true);
                    }}
                  >
                    <Text style={styles.detailButtonText}>View details</Text>
                    <ChevronRight size={16} color="#0f172a" />
                  </TouchableOpacity>
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
                      <Text style={styles.clockButtonText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.smallText}>No shift scheduled today</Text>
                  <View style={styles.progressBarBg} />
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
                      <Text style={styles.clockButtonText}>Reset</Text>
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
                        setActiveShift(nextShift);
                        setShowShiftDetails(true);
                      }}
                    >
                      <Text style={styles.detailButtonText}>View details</Text>
                      <ChevronRight size={16} color="#0f172a" />
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

            {/* ⚡ Quick Stats */}
            <View style={styles.grid}>
              <StatBox
                icon={<Clock size={16} color="#0ea5e9" />}
                label="hours"
                value={`${Math.round(weeklyCurrent)}`}
                tone="#e0f2fe"
              />
              <StatBox
                icon={<DollarSign size={16} color="#22c55e" />}
                label="earnings"
                value={`RM ${Math.round(weeklyEarnings)}`}
                tone="#dcfce7"
              />
              <StatBox
                icon={<Target size={16} color="#f97316" />}
                label="goals"
                value={`${goalsCount}`}
                tone="#ffedd5"
              />
            </View>

            {/* 🚀 Quick Actions */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Quick actions</Text>
                <Text style={styles.cardHint}>Shortcuts</Text>
              </View>

              <View style={styles.actionGrid}>
                <ActionBox
                  icon={<Calendar size={18} color="#0f172a" />}
                  label="Calendar"
                  subtitle="View shifts"
                  onPress={() => router.push("/(tabs)/calendar")}
                />
                <ActionBox
                  icon={<DollarSign size={18} color="#0f172a" />}
                  label="Earnings"
                  subtitle="Monthly summary"
                  onPress={() => router.push("/(tabs)/earnings")}
                />
                <ActionBox
                  icon={<Target size={18} color="#0f172a" />}
                  label="Goals"
                  subtitle="Track progress"
                  onPress={() => router.push("/(tabs)/goals")}
                />
                <ActionBox
                  icon={<User size={18} color="#0f172a" />}
                  label="Profile"
                  subtitle="Your details"
                  onPress={() => router.push("/(tabs)/profile")}
                />
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
                <X size={18} color="#64748b" />
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
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.monthList}>
              {selectablePeriods.map(period => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.monthButton,
                    period === selectedPeriod && styles.monthButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedPeriod(period);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.monthButtonText,
                      period === selectedPeriod && styles.monthButtonTextActive,
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
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Past Salary</Text>
              <TouchableOpacity onPress={() => setShowPastSalary(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            {pastSalaryOptions.length === 0 ? (
              <Text style={styles.emptyText}>No finalized salaries yet.</Text>
            ) : (
              <>
                <View style={styles.monthList}>
                  {pastSalaryOptions.map(period => (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.monthButton,
                        period === selectedPastPeriod && styles.monthButtonActive,
                      ]}
                      onPress={() => setPastSalaryPeriod(period)}
                    >
                      <Text
                        style={[
                          styles.monthButtonText,
                          period === selectedPastPeriod && styles.monthButtonTextActive,
                        ]}
                      >
                        {formatPeriodLabel(period)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {selectedPastPayroll ? (
                  <View style={styles.pastSalaryCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Salary Paid</Text>
                      <Text style={styles.detailValue}>
                        RM {Number(selectedPastPayroll.totalEarnings ?? 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Payment Date</Text>
                      <Text style={styles.detailValue}>
                        {selectedPastPayroll.updatedAt
                          ? new Date(selectedPastPayroll.updatedAt).toLocaleDateString("en-GB")
                          : "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Shifts</Text>
                      <Text style={styles.detailValue}>{pastShiftCount}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Total Hours</Text>
                      <Text style={styles.detailValue}>
                        {pastHours.toFixed(1)}h
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
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
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
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
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

/* =====================
   SMALL COMPONENTS
===================== */

function StatBox({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: tone }]}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

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
  shifts: { date: string; start: string; end: string }[]
) => {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const future = shifts
    .filter(shift => {
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

function ActionBox({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{label}</Text>
        {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      </View>
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
    backgroundColor: "#22c55e",
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
  },
  salaryTitle: { color: "#e2e8f0", fontSize: 14 },
  salaryAmount: { color: "#ffffff", fontSize: 30, fontWeight: "700" },
  salarySubtitle: { color: "#e2e8f0", fontSize: 12, marginTop: 4 },
  salaryHint: { color: "#cbd5f5", fontSize: 11, marginTop: 2 },
  salaryPill: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  salaryPillText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
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
  salaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 12,
  },
  salaryLabel: { color: "#e2e8f0", fontSize: 12 },
  salaryValue: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  salaryActionButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  salaryActionSecondary: { marginTop: 8 },
  salaryActionText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },

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
  emptyText: { fontSize: 12, color: "#64748b", textAlign: "center" },
  shiftTitle: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  shiftMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },

  progressBarBg: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    marginVertical: 8,
  },
  detailButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  detailButtonText: { color: "#0f172a", fontWeight: "600", fontSize: 12 },
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
    backgroundColor: "#f1f5f9",
    marginRight: 8,
  },
  clockLabel: { color: "#64748b", fontSize: 10 },
  clockValue: { color: "#0f172a", fontWeight: "700", marginTop: 4, fontSize: 12 },
  clockActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  clockButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  clockPrimary: { backgroundColor: "#0ea5e9" },
  clockGhost: { backgroundColor: "#e2e8f0" },
  clockReset: { backgroundColor: "#fee2e2" },
  clockButtonText: { color: "#0f172a", fontWeight: "700", fontSize: 12 },
  clockButtonTextLight: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  upcomingRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upcomingLabel: { color: "#64748b", fontSize: 12, marginBottom: 4 },
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { color: "#0f172a", fontWeight: "700" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { color: "#64748b", fontSize: 12 },
  detailValue: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  monthList: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  monthButtonActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  monthButtonText: { color: "#64748b", fontSize: 12 },
  monthButtonTextActive: { color: "#ffffff", fontWeight: "700" },
  pastSalaryCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  breakdownBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  breakdownDate: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  breakdownSub: { color: "#64748b", fontSize: 11, marginTop: 2 },
  breakdownAmount: { color: "#0f172a", fontSize: 12, fontWeight: "700" },


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

  cardHint: { fontSize: 12, color: "#94a3b8" },
  chatBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chatBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
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
    backgroundColor: "#0ea5e9",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
  },
  chatBubbleUserText: { color: "#ffffff", fontSize: 12 },
  chatBubbleAssistantText: { color: "#0f172a", fontSize: 12 },
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
    borderColor: "#e2e8f0",
    borderRadius: 12,
    fontSize: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  chatSendButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#0f172a",
  },
  chatSendDisabled: { opacity: 0.6 },
  chatSendText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  chatError: { marginTop: 6, color: "#ef4444", fontSize: 11 },
  chatDisclaimer: { marginTop: 8, fontSize: 10, color: "#94a3b8" },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  actionCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  actionSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
});
