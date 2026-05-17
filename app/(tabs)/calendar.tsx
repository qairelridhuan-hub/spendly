import { router } from "expo-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LogOut,
  Moon,
  Sun,
  X,
  Menu,
  CalendarX2,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc } from "firebase/firestore";
import { safeSnapshot } from "@/lib/firebase/safeSnapshot";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { useFocusEffect } from "@react-navigation/native";
import { auth, db } from "@/lib/firebase";
import { useCalendar, useTheme } from "@/lib/context";
import { cardShadow } from "@/lib/shadows";
import { ScreenTransition } from "@/components/ScreenTransition";

/* =====================
   LAYOUT CONSTANTS
===================== */

const SCREEN_WIDTH = Dimensions.get("window").width;
const CONTAINER_PAD = 16; // ScrollView container horizontal padding
const CARD_BORDER = 1;
const CARD_H_PAD = 12;
const CAL_GAP = 3;
const CAL_CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PAD * 2 - CARD_BORDER * 2 - CARD_H_PAD * 2;
const CELL_WIDTH = (CAL_CONTENT_WIDTH - CAL_GAP * 6) / 7;

/* =====================
   SCREEN
===================== */

export default function CalendarScreen() {
  const { colors: c, mode, toggleTheme, pillExpanded, togglePill } = useTheme();
  useEffect(() => {
    Animated.timing(pillAnim, { toValue: pillExpanded ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [pillExpanded]);
  const styles = makeStyles(c);

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

  const pillAnim = useRef(new Animated.Value(1)).current;

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
      unsubscribeProfile = safeSnapshot(userRef, snap => {
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
    const unsub = safeSnapshot(scheduleRef, snap => {
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
    const unsub = safeSnapshot(attendanceRef, snapshot => {
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
    <ScreenTransition>
    <View style={[styles.screen, { backgroundColor: c.backgroundStart }]}>
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
            <View style={[styles.iconPill, !pillExpanded && { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0, elevation: 0 }]}>
              <Animated.View style={{ overflow: "hidden", width: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }), opacity: pillAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] }) }}>
                <TouchableOpacity style={{ backgroundColor: "#000000", borderRadius: 999, width: 32, height: 32, alignItems: "center", justifyContent: "center" }} onPress={togglePill}>
                  <Menu size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ flexDirection: "row", alignItems: "center", overflow: "hidden", width: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 188] }), opacity: pillAnim }}>
                <TouchableOpacity style={styles.iconPillBtn} onPress={toggleTheme}>
                  {mode === "dark" ? <Moon size={20} color={c.text} /> : <Sun size={20} color={c.text} />}
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/")}>
                  <Gamepad2 size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={() => router.push("/notifications")}>
                  <Bell size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={confirmLogout}>
                  <LogOut size={20} color={c.text} />
                </TouchableOpacity>
                <View style={styles.iconPillDivider} />
                <TouchableOpacity style={styles.iconPillBtn} onPress={togglePill}>
                  <ChevronRight size={20} color={c.text} />
                </TouchableOpacity>
              </Animated.View>
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
                <ChevronLeft size={16} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth}>
                <ChevronRight size={16} color={c.text} />
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

          {/* WEEK HEADER */}
          <View style={styles.weekRow}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <Text key={i} style={styles.weekText}>{d}</Text>
            ))}
          </View>

          {/* CALENDAR GRID — explicit week rows */}
          {Array.from({ length: Math.ceil(totalCells / 7) }).map((_, rowIdx) => (
            <View key={rowIdx} style={styles.calRow}>
              {Array.from({ length: 7 }).map((_, colIdx) => {
                const index = rowIdx * 7 + colIdx;
                const day   = index - startDay + 1;
                const valid = day > 0 && day <= daysInMonth;

                if (!valid) {
                  return <View key={`sp-${index}`} style={styles.cellSpacer} />;
                }

                const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
                const status  = getDateStatus(dateKey, attendanceMap, getShiftsForDate);
                const isToday = dateKey === todayKey;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
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
                          status === "absent"    && styles.dotAbsent,
                          status === "none"      && styles.dotNone,
                        ]}
                        disabled={status === "none"}
                      />
                    </View>
                    {activeTooltipDate === dateKey ? (
                      <View style={styles.tooltip}>
                        {(() => {
                          const shiftsForDay = getShiftsForDate(dateKey);
                          if (!shiftsForDay.length) {
                            return <Text style={styles.tooltipText}>No shift</Text>;
                          }
                          const first = shiftsForDay[0];
                          const extra = shiftsForDay.length - 1;
                          return (
                            <>
                              <Text style={styles.tooltipTitle}>{first.role || "Shift"}</Text>
                              <Text style={styles.tooltipText}>{first.start} - {first.end}</Text>
                              {extra > 0 && <Text style={styles.tooltipText}>+{extra} more</Text>}
                            </>
                          );
                        })()}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* =====================
            UPCOMING SHIFTS CARD
        ===================== */}
        <View style={styles.card}>
          {/* Header row */}
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{selectedDateLabel}</Text>
              <Text style={styles.selectedDateText}>
                {formatDateLabel(selectedDate)} · {shiftsForSelectedDate.length} shift{shiftsForSelectedDate.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>

          {/* Shift rows or empty state */}
          {shiftsForSelectedDate.length === 0 ? (
            <View style={styles.emptyBox}>
              <CalendarX2 size={28} color={c.textMuted} strokeWidth={1.5} />
              <Text style={[styles.emptyText, { marginTop: 8 }]}>No shifts on this day</Text>
            </View>
          ) : (
            shiftsForSelectedDate.map((shift, index) => {
              const label = getShiftStatusLabel(shift, attendanceMap[shift.date]);
              const pillBg =
                label === "Completed"   ? "#dcfce7" :
                label === "Absent"      ? "#fee2e2" :
                label === "In progress" ? "#dbeafe" : c.surfaceAlt;
              const pillText =
                label === "Completed"   ? "#16a34a" :
                label === "Absent"      ? "#dc2626" :
                label === "In progress" ? "#2563eb" : c.textMuted;
              return (
                <View
                  key={shift.id}
                  style={[
                    styles.shiftRow,
                    index === shiftsForSelectedDate.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.shiftLeft}>
                    <Text style={styles.shiftTitle}>{shift.role}</Text>
                    <Text style={styles.shiftMeta}>{shift.start} – {shift.end}</Text>
                  </View>
                  <View style={styles.shiftRight}>
                    <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
                      <Text style={[styles.statusPillText, { color: pillText }]}>{label}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* View shift details — full-width button */}
          {shiftsForSelectedDate.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                const shift = shiftsForSelectedDate[0];
                setActiveShift({ ...shift, status: resolveStatus(shift.status, attendanceMap[shift.date]) });
                setShowShiftDetails(true);
              }}
              style={{ marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: c.text, alignItems: "center" }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: c.backgroundStart }}>View shift details</Text>
            </TouchableOpacity>
          )}

          {/* Legend — merged from Status card */}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
            {[
              { color: c.text,      label: "Scheduled" },
              { color: "#16a34a",   label: "Completed" },
              { color: "#dc2626",   label: "Absent"    },
            ].map(({ color, label }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color }} />
                <Text style={{ fontSize: 11, color: c.textMuted }}>{label}</Text>
              </View>
            ))}
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
                <X size={18} color={c.textMuted} />
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
    </ScreenTransition>
  );
}

/* =====================
   SMALL COMPONENT
===================== */

function Legend({
  color,
  label,
  legendText,
  dot,
  legendItem,
}: {
  color: string;
  label: string;
  legendText: any;
  dot: any;
  legendItem: any;
}) {
  return (
    <View style={legendItem}>
      <View style={[dot, { backgroundColor: color }]} />
      <Text style={legendText}>{label}</Text>
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

function makeStyles(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
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
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    logoImage: { width: 24, height: 24 },
    appName: { fontWeight: "700", fontSize: 16, color: c.text },
    subText: { fontSize: 13, color: c.textMuted },
    headerRight: { flexDirection: "row", alignItems: "center" },
    iconPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 4,
      paddingVertical: 4,
      shadowColor: "#000000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    iconPillBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
    iconPillDivider: { width: 1, height: 16, backgroundColor: c.border },

    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      ...cardShadow,
    },
    calendarCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
    },

    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      color: c.text,
    },
    calendarCardTitle: {
      color: c.text,
    },

    monthHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    captionGroup: { flexDirection: "row", gap: 6, alignItems: "center" },
    captionButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    captionText: { fontSize: 12, fontWeight: "700", color: c.text },
    calendarCaptionButton: {
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    calendarCaptionText: { color: c.text },
    navIcons: { flexDirection: "row", gap: 4 },
    dropdown: {
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
    },
    calendarDropdown: {
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    dropdownRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dropdownRowActive: {
      backgroundColor: c.text,
    },
    dropdownText: { color: c.text, fontWeight: "600", fontSize: 12 },
    dropdownTextActive: { color: c.backgroundStart },

    weekRow: { flexDirection: "row", gap: CAL_GAP, marginBottom: 4 },
    weekText: {
      width: CELL_WIDTH,
      textAlign: "center",
      fontWeight: "600",
      color: c.textMuted,
      fontSize: 10,
    },
    calendarWeekText: { color: c.textMuted },

    calRow:     { flexDirection: "row", gap: CAL_GAP, marginBottom: CAL_GAP },
    cellSpacer: { width: CELL_WIDTH, height: 44 },

    dayCell: {
      width: CELL_WIDTH,
      height: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      paddingTop: 5,
      paddingHorizontal: 4,
      paddingBottom: 4,
      justifyContent: "space-between",
      backgroundColor: c.surfaceAlt,
      position: "relative",
      alignItems: "center",
    },

    selectedDay: {
      borderColor: c.text,
      borderWidth: 1.5,
      backgroundColor: c.border,
    },
    todayCell: {
      borderColor: c.text,
      borderWidth: 1.5,
    },

    dayText: { color: c.text, fontWeight: "600", fontSize: 11 },
    calendarDayText: { color: c.text },
    todayText: { color: c.text, fontWeight: "700" },
    selectedDayText: {
      color: c.text,
      fontWeight: "700",
    },

    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    dotPlaceholder: {
      width: 6,
      height: 6,
      borderRadius: 999,
    },
    dotNone: { backgroundColor: "transparent" },
    dotScheduled: { backgroundColor: c.text },
    dotCompleted: { backgroundColor: "#34d399" },
    dotAbsent: { backgroundColor: "#f87171" },
    tooltip: {
      position: "absolute",
      top: -2,
      left: -2,
      right: -2,
      backgroundColor: c.text,
      borderRadius: 8,
      padding: 5,
      zIndex: 10,
    },
    tooltipTitle: { color: c.backgroundStart, fontSize: 9, fontWeight: "700" },
    tooltipText: { color: c.border, fontSize: 8, marginTop: 1 },

    emptyBox: {
      paddingVertical: 24,
      alignItems: "center",
      gap: 0,
    },

    emptyText: { color: c.textMuted, fontSize: 13 },

    shiftRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    shiftLeft: { flex: 1, gap: 3 },
    shiftRight: { alignItems: "flex-end", gap: 6 },
    shiftTitle: { fontWeight: "700", fontSize: 14, color: c.text },
    shiftMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    shiftMeta: { color: c.textMuted, fontSize: 12 },
    shiftLocation: { color: c.text, fontWeight: "600" },
    detailButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: c.surfaceAlt,
    },
    detailButtonText: { color: c.text, fontWeight: "600", fontSize: 11 },
    statusPill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusPillText: { fontSize: 10, fontWeight: "700" },
    statusPillActive: {},
    statusPillScheduled: {},
    statusPillCompleted: {},
    statusPillAbsent: {},

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
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
      marginBottom: 12,
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendText: { color: c.text },

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
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalTitle: { color: c.text, fontWeight: "700" },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    detailLabel: { color: c.textMuted, fontSize: 12 },
    detailValue: { color: c.text, fontSize: 12, fontWeight: "600" },
  });
}
