import { router } from "expo-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { signOut } from "firebase/auth";
import { useState } from "react";
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
import { auth } from "@/lib/firebase";
import { useCalendar } from "@/lib/context";

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
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(
    today.getDate()
  );
  const { selectedDate, setSelectedDate, getShiftsForDate, hasShift } =
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
  const pad = (value: number) => String(value).padStart(2, "0");

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
      <View style={styles.bgBlob} />
      <View style={styles.bgBlobAlt} />
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
              
            </View>
          </View>

          <View style={styles.headerRight}>
            <Bell size={22} color="#0f172a" />
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
                  <Text
                    style={[
                      styles.dayText,
                      selectedDay === day && styles.selectedDayText,
                    ]}
                  >
                    {day}
                  </Text>

                  {/* STATUS DOT PLACEHOLDER */}
                  <View
                    style={[
                      styles.dotPlaceholder,
                      hasShift(`${year}-${pad(month + 1)}-${pad(day)}`) &&
                        styles.dotActive,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* =====================
            UPCOMING SHIFTS CARD
        ===================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming Shifts</Text>

          {shiftsForSelectedDate.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No shifts on this day</Text>
            </View>
          ) : (
            shiftsForSelectedDate.map(shift => (
              <View key={shift.id} style={styles.shiftRow}>
                <View>
                  <Text style={styles.shiftTitle}>{shift.role}</Text>
                  <Text style={styles.shiftMeta}>
                    {shift.start} - {shift.end}
                  </Text>
                </View>
                <Text style={styles.shiftLocation}>{shift.location}</Text>
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
    height: 52,
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
    backgroundColor: "transparent",
  },
  dotActive: { backgroundColor: "#0ea5e9" },

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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  shiftTitle: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  shiftMeta: { color: "#64748b", marginTop: 2 },
  shiftLocation: { color: "#0f172a", fontWeight: "600" },

  legendRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
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
});
