import { router } from "expo-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LogOut,
  X,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "@/lib/firebase";
import { useCalendar, useTheme } from "@/lib/context";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { cardShadow } from "@/lib/shadows";

/* =====================
   LAYOUT CONSTANTS
===================== */

const SCREEN_WIDTH = Dimensions.get("window").width;
const GAP = 8;
const CELL_WIDTH = (SCREEN_WIDTH - 32 - GAP * 6) / 7;

/* =====================
   SCREEN
===================== */

export default function CalendarScreen() {
  const [displayName, setDisplayName] = useState("User");
  const scrollRef = useRef<ScrollView>(null);
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<{
    id: string;
    name: string;
    days: string[];
    startTime: string;
    endTime: string;
    hourlyRate: number;
  } | null>(null);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate()
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);
  const { selectedDate, setSelectedDate, getShiftsForDate, shifts } =
    useCalendar();

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

  /* =====================
     DATE HELPERS
  ===================== */

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const yearOptions = Array.from({ length: 7 }, (_, i) => year - 3 + i);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const shiftsForSelectedDate = getShiftsForDate(selectedDate);
  const nextShift = getNextShift(shifts, attendanceMap);
  const pad = (value: number) => String(value).padStart(2, "0");
  const todayKey = `${today.getFullYear()}-${padValue(today.getMonth() + 1)}-${padValue(
    today.getDate()
  )}`;
  const selectedDateLabel = getSelectedDateLabel(selectedDate, todayKey);
  const primaryShift = nextShift ?? shiftsForSelectedDate[0] ?? null;
  const primaryDetailTarget = primaryShift
    ? {
        ...primaryShift,
        status: resolveStatus(
          primaryShift.status,
          attendanceMap[primaryShift.date]
        ),
      }
    : schedule
      ? {
          type: "schedule",
          name: schedule.name,
          days: schedule.days,
          start: schedule.startTime,
          end: schedule.endTime,
          hourlyRate: schedule.hourlyRate,
        }
      : null;

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        setDisplayName("User");
        setScheduleId(null);
        setUserId(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        return;
      }
      setUserId(user.uid);
      if (user.displayName) setDisplayName(user.displayName);
      const userRef = doc(db, "users", user.uid);
      unsubscribeProfile?.();
      unsubscribeProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as { fullName?: string; scheduleId?: string } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
        setScheduleId(data?.scheduleId ?? null);
      });
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
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

  useEffect(() => {
    if (!userId) {
      setAttendanceMap({});
      return;
    }
    const attendanceRef = collection(db, "users", userId, "attendance");
    const unsub = onSnapshot(attendanceRef, snapshot => {
      const map: Record<string, string> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        const date = String(data.date ?? "");
        if (!date) return;
        const existing = map[date];
        const nextStatus = String(data.status ?? "pending");
        map[date] = mergeAttendanceStatus(existing, nextStatus);
      });
      setAttendanceMap(map);
    });
    return unsub;
  }, [userId]);

  /* =====================
     MONTH NAVIGATION
  ===================== */

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };
  const selectMonth = (value: number) => {
    setMonth(value);
    setShowMonthPicker(false);
  };
  const selectYear = (value: number) => {
    setYear(value);
    setShowYearPicker(false);
  };

  /* =====================
     UI
  ===================== */

  return (
    <View style={[styles.screen, { backgroundColor: "#ffffff" }]}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>

        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.logo}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Image
                source={require("../../assets/images/spendly-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.subText}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.iconPill}>
              <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/")}>
                <Gamepad2 size={20} color="#111827" />
              </TouchableOpacity>
              <View style={styles.iconPillDivider} />
              <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/notifications")}>
                <Bell size={20} color="#111827" />
              </TouchableOpacity>
              <View style={styles.iconPillDivider} />
              <TouchableOpacity style={styles.iconPillBtn} onPress={confirmLogout}>
                <LogOut size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* =====================
           CALENDAR CARD
        ===================== */}
        <View style={[styles.card, styles.calendarCard]}>
          <View style={styles.monthHeader}>
            <View style={styles.captionGroup}>
              <TouchableOpacity
                style={[styles.captionButton, styles.calendarCaptionButton]}
                onPress={() => {
                  setShowMonthPicker(prev => !prev);
                  setShowYearPicker(false);
                }}
              >
                <Text style={[styles.captionText, styles.calendarCaptionText]}>
                  {monthNames[month]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captionButton, styles.calendarCaptionButton]}
                onPress={() => {
                  setShowYearPicker(prev => !prev);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={[styles.captionText, styles.calendarCaptionText]}>
                  {year}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navIcons}>
              <TouchableOpacity onPress={prevMonth}>
                <ChevronLeft size={20} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth}>
                <ChevronRight size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>
          {showMonthPicker ? (
            <View style={[styles.dropdown, styles.calendarDropdown]}>
              {monthNames.map((name, idx) => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.dropdownRow,
                    idx === month && styles.dropdownRowActive,
                  ]}
                  onPress={() => selectMonth(idx)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      idx === month && styles.dropdownTextActive,
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {showYearPicker ? (
            <View style={[styles.dropdown, styles.calendarDropdown]}>
              {yearOptions.map(value => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.dropdownRow,
                    value === year && styles.dropdownRowActive,
                  ]}
                  onPress={() => selectYear(value)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      value === year && styles.dropdownTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* WEEK ROW */}
          <View style={styles.weekRow}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <Text
                key={i}
                style={[styles.weekText, styles.calendarWeekText, { width: CELL_WIDTH }]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* CALENDAR GRID */}
          <View style={styles.grid}>
            {Array.from({ length: totalCells }).map((_, index) => {
              const day = index - startDay + 1;
              const valid = day > 0 && day <= daysInMonth;

              if (!valid) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={[styles.dayCell, styles.calendarDayCell]}
                  />
                );
              }

              const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
              const status = getDateStatus(dateKey, attendanceMap, getShiftsForDate);
              const isToday = dateKey === todayKey;
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    styles.calendarDayCell,
                    isToday && styles.todayCell,
                    selectedDay === day && styles.selectedDay,
                  ]}
                  onPress={() => {
                    setSelectedDay(day);
                    setSelectedDate(`${year}-${pad(month + 1)}-${pad(day)}`);
                    setActiveTooltipDate(null);
                  }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      styles.calendarDayText,
                      isToday && styles.todayText,
                      selectedDay === day && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>
                  <View style={styles.statusRow}>
                    <TouchableOpacity
                      onPress={() => {
                        if (status === "none") return;
                        setActiveTooltipDate(prev =>
                          prev === dateKey ? null : dateKey
                        );
                      }}
                      style={[
                        styles.dotPlaceholder,
                        status === "scheduled" && styles.dotScheduled,
                        status === "completed" && styles.dotCompleted,
                        status === "absent" && styles.dotAbsent,
                        status === "none" && styles.dotNone,
                      ]}
                      disabled={status === "none"}
                    />
                  </View>
                  {activeTooltipDate === dateKey ? (
                    <View style={styles.tooltip}>
                      {(() => {
                        const shiftsForDay = getShiftsForDate(dateKey);
                        if (!shiftsForDay.length) {
                          return (
                            <Text style={styles.tooltipText}>No shift</Text>
                          );
                        }
                        const first = shiftsForDay[0];
                        const extra = shiftsForDay.length - 1;
                        return (
                          <>
                            <Text style={styles.tooltipTitle}>
                              {first.role || "Shift"}
                            </Text>
                            <Text style={styles.tooltipText}>
                              {first.start} - {first.end}
                            </Text>
                            {extra > 0 ? (
                              <Text style={styles.tooltipText}>
                                +{extra} more
                              </Text>
                            ) : null}
                          </>
                        );
                      })()}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* =====================
            UPCOMING SHIFTS CARD
        ===================== */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{selectedDateLabel}</Text>
            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => {
                if (primaryDetailTarget) {
                  setActiveShift(primaryDetailTarget);
                  setShowShiftDetails(true);
                }
              }}
              disabled={!primaryDetailTarget}
            >
              <Text style={styles.detailButtonText}>View details</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedDateText}>
            {formatDateLabel(selectedDate)} • {shiftsForSelectedDate.length} shift
            {shiftsForSelectedDate.length === 1 ? "" : "s"}
          </Text>


          {shiftsForSelectedDate.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No shifts on this day</Text>
            </View>
          ) : (
            shiftsForSelectedDate.map(shift => (
              <View key={shift.id} style={styles.shiftRow}>
                <View style={styles.shiftLeft}>
                  <Text style={styles.shiftTitle}>{shift.role}</Text>
                  <View style={styles.shiftMetaRow}>
                    <Text style={styles.shiftMeta}>
                      {shift.start} - {shift.end}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        getShiftStatusLabel(shift, attendanceMap[shift.date]) ===
                          "In progress" && styles.statusPillActive,
                        getShiftStatusLabel(shift, attendanceMap[shift.date]) ===
                          "Scheduled" && styles.statusPillScheduled,
                        getShiftStatusLabel(shift, attendanceMap[shift.date]) ===
                          "Completed" && styles.statusPillCompleted,
                        getShiftStatusLabel(shift, attendanceMap[shift.date]) ===
                          "Absent" && styles.statusPillAbsent,
                      ]}
                    >
                      <Text style={styles.statusPillText}>
                        {getShiftStatusLabel(shift, attendanceMap[shift.date])}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.shiftRight}>
                  <Text style={styles.shiftLocation}>{shift.location}</Text>
                  <TouchableOpacity
                    style={styles.detailButton}
                    onPress={() => {
                      setActiveShift({
                        ...shift,
                        status: resolveStatus(
                          shift.status,
                          attendanceMap[shift.date]
                        ),
                      });
                      setShowShiftDetails(true);
                    }}
                  >
                    <Text style={styles.detailButtonText}>View details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* =====================
            STATUS CARD
        ===================== */}
        <View style={[styles.card, styles.calendarCard]}>
          <Text style={[styles.cardTitle, styles.calendarCardTitle]}>Status</Text> 

          <View style={styles.legendRow}>
            <Legend color="#111827" label="Scheduled" />
            <Legend color="#34d399" label="Completed" />
            <Legend color="#f87171" label="Absent" />
          </View>
        </View>

        </ScrollView>
      </SafeAreaView>

      {showShiftDetails && activeShift ? (
        <View style={styles.overlay}>
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shift details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowShiftDetails(false);
                  setActiveShift(null);
                }}
              >
                <X size={18} color="#6b7280" />
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
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* =====================
   SMALL COMPONENT
===================== */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

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

const padValue = (value: number) => String(value).padStart(2, "0");

const isShiftInProgress = (date: string, start?: string, end?: string) => {
  if (!date || !start || !end) return false;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${padValue(now.getMonth() + 1)}-${padValue(now.getDate())}`;
  if (date !== todayKey) return false;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
};

const resolveStatus = (shiftStatus?: string, attendanceStatus?: string) => {
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
};

const mergeAttendanceStatus = (existing?: string, next?: string) => {
  if (existing === "absent" || existing === "rejected") return existing;
  if (next === "absent" || next === "rejected") return next;
  if (existing === "approved") return existing;
  if (next === "approved") return next;
  return next || existing || "pending";
};

const getDateStatus = (
  date: string,
  attendanceMap: Record<string, string>,
  getShiftsForDate: (date: string) => any[]
) => {
  const attendanceStatus = attendanceMap[date];
  if (attendanceStatus) return resolveStatus(undefined, attendanceStatus);
  const shifts = getShiftsForDate(date);
  if (shifts.length === 0) return "none";
  let status: "scheduled" | "completed" | "absent" = "scheduled";
  shifts.forEach(shift => {
    const effective = resolveStatus(shift.status, undefined);
    if (effective === "absent") status = "absent";
    else if (effective === "completed" && status !== "absent") {
      status = "completed";
    }
  });
  return status;
};

function getNextShift(allShifts: any[], attendanceMap: Record<string, string>) {
  if (!allShifts.length) return null;
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const future = allShifts
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
}

const getSelectedDateLabel = (selectedDate: string, todayKey: string) => {
  if (selectedDate < todayKey) return "Past shifts";
  if (selectedDate === todayKey) return "Today's shifts";
  return "Upcoming shifts";
};

const statusLabel = (status: string) => {
  if (status === "completed") return "Completed";
  if (status === "absent") return "Absent";
  return "Scheduled";
};

const getShiftStatusLabel = (shift: any, attendanceStatus?: string) => {
  if (isShiftInProgress(shift.date, shift.start, shift.end)) {
    return "In progress";
  }
  return statusLabel(resolveStatus(shift.status, attendanceStatus));
};

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  container: { padding: 16, paddingTop: 20, paddingBottom: 120 },
  bgBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0)",
    bottom: -120,
    left: -80,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  logoImage: { width: 24, height: 24 },
  appName: { fontWeight: "700", fontSize: 16, color: "#111827" },
  subText: { color: "#6b7280" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  iconPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconPillBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  iconPillDivider: { width: 1, height: 16, backgroundColor: "#e5e7eb" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...cardShadow,
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },
  calendarCardTitle: {
    color: "#0f172a",
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  captionGroup: { flexDirection: "row", gap: 8, alignItems: "center" },
  captionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#101826",
  },
  captionText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  calendarCaptionButton: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  calendarCaptionText: { color: "#0f172a" },
  navIcons: { flexDirection: "row", gap: 8 },
  dropdown: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#101826",
    overflow: "hidden",
  },
  calendarDropdown: {
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  dropdownRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownRowActive: {
    backgroundColor: "#111827",
  },
  dropdownText: { color: "#0f172a", fontWeight: "600", fontSize: 12 },
  dropdownTextActive: { color: "#0b1220" },

  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#6b7280",
    fontSize: 12,
  },
  calendarWeekText: { color: "#64748b" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },

  dayCell: {
    width: CELL_WIDTH,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    position: "relative",
  },
  calendarDayCell: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },

  selectedDay: {
    borderColor: "#111827",
    backgroundColor: "#f1f5f9",
  },
  todayCell: {
    borderColor: "#111827",
  },

  dayText: { color: "#111827", fontWeight: "600" },
  calendarDayText: { color: "#0f172a" },
  todayText: { color: "#111827", fontWeight: "700" },
  selectedDayText: {
    color: "#111827",
    fontWeight: "700",
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dotPlaceholder: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  dotNone: { backgroundColor: "transparent" },
  dotScheduled: { backgroundColor: "#111827" },
  dotCompleted: { backgroundColor: "#34d399" },
  dotAbsent: { backgroundColor: "#f87171" },
  tooltip: {
    position: "absolute",
    top: -6,
    left: -4,
    right: -4,
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 6,
    zIndex: 10,
  },
  tooltipTitle: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  tooltipText: { color: "#e2e8f0", fontSize: 9, marginTop: 2 },

  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },

  emptyText: { color: "#6b7280" },

  shiftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#273244",
  },
  shiftLeft: { flex: 1 },
  shiftRight: { alignItems: "flex-end", gap: 6 },
  shiftTitle: { fontWeight: "700", fontSize: 15, color: "#111827" },
  shiftMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shiftMeta: { color: "#6b7280", marginTop: 2 },
  shiftLocation: { color: "#111827", fontWeight: "600" },
  detailButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
  },
  detailButtonText: { color: "#111827", fontWeight: "600", fontSize: 11 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f5f5f5",
  },
  statusPillText: { fontSize: 10, fontWeight: "700", color: "#111827" },
  statusPillActive: { backgroundColor: "#f5f5f5" },
  statusPillScheduled: { backgroundColor: "#f5f5f5" },
  statusPillCompleted: { backgroundColor: "#12251b" },
  statusPillAbsent: { backgroundColor: "#2a1114" },

  legendRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedDateText: {
    color: "#6b7280",
    marginBottom: 8,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendText: { color: "#0f172a" },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
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
  modalTitle: { color: "#111827", fontWeight: "700" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { color: "#6b7280", fontSize: 12 },
  detailValue: { color: "#111827", fontSize: 12, fontWeight: "600" },
});
