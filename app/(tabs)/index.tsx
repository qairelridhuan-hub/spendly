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

/* =====================
   TYPES
===================== */

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
  const [userId, setUserId] = useState<string | null>(null);
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

  // 🔹 Salary summary (akan sync dari Earnings module)
  const [salarySummary, setSalarySummary] = useState<SalarySummary>({
    month: "—",
    totalEarnings: 0,
    status: "pending",
    nextPaymentDate: "-",
    estimatedNextAmount: 0,
  });

  const scheduleHoursPerDay = schedule
    ? diffHours(schedule.startTime, schedule.endTime)
    : workConfig.hoursPerDay;
  const hourlyRate =
    schedule?.hourlyRate ?? userHourlyRate ?? workConfig.hourlyRate;
  const weeklyTarget = schedule
    ? schedule.days.length * scheduleHoursPerDay
    : workConfig.hoursPerDay * workConfig.workingDaysPerWeek;
  const weeklyCurrent = getWeeklyHours(attendanceLogs);
  const weeklyEarnings = weeklyCurrent * hourlyRate;
  const weeklyStreak = getWeeklyStreak(attendanceLogs);
  const goalPercentage =
    weeklyTarget === 0 ? 0 : Math.round((weeklyCurrent / weeklyTarget) * 100);
  const todayShift = getTodayShift();
  const nextShift = getNextShift(shifts);

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
    try {
      await signOut(auth);
    } finally {
      router.replace("/(auth)/login");
    }
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
  };

  const handleBreakToggle = async () => {
    if (!userId) return;
    if (!todayAttendance?.clockIn) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
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
  };

  const handleResetAttendance = async () => {
    if (!userId) return;
    const todayKey = formatDateKey(new Date());
    const attendanceRef = doc(db, "users", userId, "attendance", todayKey);
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
    if (salarySummary.status === "pending") {
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
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => {
      spinLoop.current?.stop();
    };
  }, [salarySummary.status, spinAnim]);

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
      setSalarySummary({
        month: "—",
        totalEarnings: 0,
        status: "pending",
        nextPaymentDate: "-",
        estimatedNextAmount: 0,
      });
      return;
    }

    const currentPeriod = getCurrentPeriodKey(new Date());
    const totalHours = attendanceLogs.reduce((sum, log) => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return sum;
      return sum + Number(log.hours ?? 0);
    }, 0);
    const totalEarnings = totalHours * hourlyRate;
    setSalarySummary({
      month: formatPeriodLabel(currentPeriod),
      totalEarnings,
      status: "pending",
      nextPaymentDate: getPeriodEndDate(currentPeriod),
      estimatedNextAmount: totalEarnings,
    });
  }, [userId, attendanceLogs, hourlyRate]);

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
            <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")}>
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
                {salarySummary.status === "paid" ? (
                  <View style={styles.statusDotPaid} />
                ) : (
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
                )}
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
                {weeklyCurrent}h / {weeklyTarget}h
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
              <StatBox
                icon={<Zap size={16} color="#f59e0b" />}
                label="streak"
                value={`${weeklyStreak}w`}
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
  if (startTs && endTs) {
    return Math.max(0, Math.round((endTs - startTs) / 60000));
  }
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

const getPeriodEndDate = (period: string) => {
  const [year, month] = period.split("-");
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return "-";
  const end = new Date(y, m, 0);
  return `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
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
  const todayKey = new Date().toISOString().slice(0, 10);
  const future = shifts
    .filter(shift => shift.date > todayKey)
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

const getWeeklyStreak = (logs: { date?: string }[]) => {
  if (logs.length === 0) return 0;
  const weekKeys = new Set(
    logs.map(log => {
      const date = new Date(`${log.date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const weekStart = startOfWeek(date);
      return `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(
        weekStart.getDate()
      )}`;
    })
  );

  const currentWeek = startOfWeek(new Date());
  let streak = 0;
  for (let i = 0; i < 52; i += 1) {
    const week = new Date(currentWeek);
    week.setDate(currentWeek.getDate() - i * 7);
    const key = `${week.getFullYear()}-${pad(week.getMonth() + 1)}-${pad(
      week.getDate()
    )}`;
    if (!weekKeys.has(key)) break;
    streak += 1;
  }
  return streak;
};

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
  shiftTitle: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  shiftMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },

  progressBarBg: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    marginVertical: 8,
  },
  goalProgress: { height: 6, backgroundColor: "#fb923c" },
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
