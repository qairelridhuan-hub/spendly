import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCalendar } from "../context/calendar";
import { useState } from "react";
import { router } from "expo-router";
import {
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";

/* =====================
   LAYOUT CONSTANTS
===================== */

const SCREEN_WIDTH = Dimensions.get("window").width;
const CONTAINER_PADDING = 32; // 16 left + 16 right
const GAP = 8;
const CELL_WIDTH =
  (SCREEN_WIDTH - CONTAINER_PADDING - GAP * 6) / 7;

/* =====================
   SCREEN
===================== */

export default function CalendarScreen() {
  const { shifts, getUpcomingShifts } = useCalendar();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(11); // Dec
  const [currentYear, setCurrentYear] = useState(2025);

  const upcoming = getUpcomingShifts();

  /* =====================
     DATE HELPERS
  ===================== */

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const daysInMonth = new Date(
    currentYear,
    currentMonth + 1,
    0
  ).getDate();

  const startDay = new Date(
    currentYear,
    currentMonth,
    1
  ).getDay();

  const daysArray = Array.from(
    { length: daysInMonth },
    (_, i) => i + 1
  );

  const formatDate = (day: number) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getShiftForDate = (date: string) =>
    shifts.find(s => s.date === date);

  const getDotColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "#22c55e";
      case "absent":
        return "#ef4444";
      case "scheduled":
        return "#3b82f6";
      case "in_progress":
        return "#60a5fa";
      default:
        return "transparent";
    }
  };

  /* =====================
     MONTH NAVIGATION
  ===================== */

  const goPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const goNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  /* =====================
     UI
  ===================== */

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logo}>
              <Text>💰</Text>
            </View>
            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.subText}>Hey, John!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Bell size={22} />
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login")}
            >
              <LogOut size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== CALENDAR CARD ===== */}
        <View style={styles.card}>
          {/* Month Header */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={goPrevMonth}>
              <ChevronLeft size={24} />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {monthNames[currentMonth]} {currentYear}
            </Text>

            <TouchableOpacity onPress={goNextMonth}>
              <ChevronRight size={24} />
            </TouchableOpacity>
          </View>

          {/* Week Row */}
          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text
                key={`${d}-${i}`}
                style={[styles.weekText, { width: CELL_WIDTH }]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.grid}>
            {Array.from({ length: startDay }).map((_, i) => (
              <View
                key={`empty-${i}`}
                style={[styles.emptyBox, { width: CELL_WIDTH }]}
              />
            ))}

            {daysArray.map(day => {
              const date = formatDate(day);
              const shift = getShiftForDate(date);

              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.dayBox,
                    { width: CELL_WIDTH },
                    selectedDate === date && styles.selectedDay,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text>{day}</Text>
                  {shift && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: getDotColor(shift.status) },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ===== UPCOMING SHIFTS ===== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming Shifts</Text>

          {upcoming.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming shifts</Text>
          ) : (
            upcoming.map(s => (
              <View key={s.date} style={styles.shiftRow}>
                <View>
                  <Text style={styles.shiftDate}>{s.date}</Text>
                  <Text style={styles.shiftTime}>
                    {s.startTime} - {s.endTime}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getDotColor(s.status) },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {s.status.replace("_", " ")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ===== STATUS ===== */}
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

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  container: { padding: 16 },

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
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: { fontWeight: "700", fontSize: 16 },
  subText: { color: "#6b7280" },
  headerRight: { flexDirection: "row", gap: 16 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: { fontSize: 18, fontWeight: "700" },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  weekText: { textAlign: "center", fontWeight: "600" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  emptyBox: { height: 48 },

  dayBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedDay: {
    backgroundColor: "#eef2ff",
    borderColor: "#4f46e5",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 4,
  },

  shiftRow: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  shiftDate: { fontWeight: "600" },
  shiftTime: { color: "#64748b" },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: "#fff", fontSize: 12 },

  legendRow: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },

  emptyText: { color: "#6b7280" },
});