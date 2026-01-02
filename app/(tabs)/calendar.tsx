import { router } from "expo-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "@/lib/firebase";
import { useCalendar, useTheme } from "@/lib/context";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

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
  const { selectedDate, setSelectedDate, getShiftsForDate, shifts } =
    useCalendar();

  /* =====================
     DATE HELPERS
  ===================== */

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const shiftsForSelectedDate = getShiftsForDate(selectedDate);
  const nextShift = getNextShift(shifts);
  const pad = (value: number) => String(value).padStart(2, "0");
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

  /* =====================
     UI
  ===================== */

  return (
    <LinearGradient colors={["#f8fafc", "#eef2f7"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.container}>

        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.logo}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text>💰</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.subText}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")}>
              <Bell size={22} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await signOut(auth);
                } finally {
                  router.replace("/(auth)/login");
                }
              }}
            >
              <LogOut size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* =====================
           CALENDAR CARD
        ===================== */}
        <View style={styles.card}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>
              {monthNames[month]} {year}
            </Text>

            <View style={styles.navIcons}>
              <TouchableOpacity onPress={prevMonth}>
                <ChevronLeft size={22} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth}>
                <ChevronRight size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          {/* WEEK ROW */}
          <View style={styles.weekRow}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <Text
                key={i}
                style={[styles.weekText, { width: CELL_WIDTH }]}
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
                  <View key={`empty-${index}`} style={styles.dayCell} />
                );
              }

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    selectedDay === day && styles.selectedDay,
                  ]}
                  onPress={() => {
                    setSelectedDay(day);
                    setSelectedDate(`${year}-${pad(month + 1)}-${pad(day)}`);
                  }}
                >
                  {(() => {
                    const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const status = getDateStatus(dateKey, attendanceMap, getShiftsForDate);
                    return (
                      <>
                  <Text
                    style={[
                      styles.dayText,
                      selectedDay === day && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>

                  <View
                    style={[
                      styles.dotPlaceholder,
                      status === "scheduled" && styles.dotScheduled,
                      status === "completed" && styles.dotCompleted,
                      status === "absent" && styles.dotAbsent,
                      status === "none" && styles.dotNone,
                    ]}
                  />
                  {status !== "none" ? (
                    <Text
                      style={[
                        styles.statusLabel,
                        status === "scheduled" && styles.statusLabelScheduled,
                        status === "completed" && styles.statusLabelCompleted,
                        status === "absent" && styles.statusLabelAbsent,
                      ]}
                    >
                      {statusLabel(status)}
                    </Text>
                  ) : null}
                      </>
                    );
                  })()}
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
            <Text style={styles.cardTitle}>Upcoming Shifts</Text>
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
          {schedule ? (
            <Text style={styles.subText}>
              {schedule.name} • {schedule.startTime} - {schedule.endTime}
            </Text>
          ) : null}

          {shiftsForSelectedDate.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No shifts on this day</Text>
            </View>
          ) : (
            shiftsForSelectedDate.map(shift => (
              <View key={shift.id} style={styles.shiftRow}>
                <View>
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
                <View style={styles.shiftActions}>
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text> 

          <View style={styles.legendRow}>
            <Legend color="#3b82f6" label="Scheduled" />
            <Legend color="#22c55e" label="Completed" />
            <Legend color="#ef4444" label="Absent" />
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
              </>
            )}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

/* =====================
   SMALL COMPONENT
===================== */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text>{label}</Text>
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

function getNextShift(allShifts: any[]) {
  if (!allShifts.length) return null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const future = allShifts
    .filter(shift => shift.date > todayKey)
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  return future[0] || null;
}

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
  container: { padding: 16, paddingBottom: 120 },
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

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { fontWeight: "700", fontSize: 16, color: "#0f172a" },
  subText: { color: "#64748b" },
  headerRight: { flexDirection: "row", gap: 16 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#0f172a",
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  navIcons: { flexDirection: "row", gap: 12 },

  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#64748b",
  },

  grid: { flexDirection: "row", flexWrap: "wrap" },

  dayCell: {
    width: CELL_WIDTH,
    height: 64,
    marginRight: GAP,
    marginBottom: GAP,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedDay: {
    borderColor: "#0ea5e9",
    backgroundColor: "#e0f2fe",
  },

  dayText: { color: "#334155" },
  selectedDayText: {
    color: "#0ea5e9",
    fontWeight: "700",
  },

  dotPlaceholder: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  dotNone: { backgroundColor: "transparent" },
  dotScheduled: { backgroundColor: "#3b82f6" },
  dotCompleted: { backgroundColor: "#22c55e" },
  dotAbsent: { backgroundColor: "#ef4444" },
  statusLabel: { fontSize: 9, marginTop: 2, fontWeight: "600", color: "#0f172a" },
  statusLabelScheduled: { color: "#3b82f6" },
  statusLabelCompleted: { color: "#22c55e" },
  statusLabelAbsent: { color: "#ef4444" },

  emptyBox: {
    backgroundColor: "#f1f5f9",
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
    borderBottomColor: "#e2e8f0",
  },
  shiftTitle: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  shiftMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shiftMeta: { color: "#64748b", marginTop: 2 },
  shiftLocation: { color: "#0f172a", fontWeight: "600" },
  shiftActions: { alignItems: "flex-end", gap: 6 },
  detailButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  detailButtonText: { color: "#0f172a", fontWeight: "600", fontSize: 11 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  statusPillText: { fontSize: 10, fontWeight: "700", color: "#0f172a" },
  statusPillActive: { backgroundColor: "#dbeafe" },
  statusPillScheduled: { backgroundColor: "#dbeafe" },
  statusPillCompleted: { backgroundColor: "#dcfce7" },
  statusPillAbsent: { backgroundColor: "#fee2e2" },

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

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

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
  modalTitle: { color: "#0f172a", fontWeight: "700" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { color: "#64748b", fontSize: 12 },
  detailValue: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
});
