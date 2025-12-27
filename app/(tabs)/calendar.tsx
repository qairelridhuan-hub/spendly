import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
const GAP = 8;
const CELL_WIDTH = (SCREEN_WIDTH - 32 - GAP * 6) / 7;

/* =====================
   SCREEN
===================== */

export default function CalendarScreen() {
  const [month, setMonth] = useState(11); // December
  const [year, setYear] = useState(2025);
  const [selectedDay, setSelectedDay] = useState<number | null>(28);

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
            <Bell size={22} color="#6b7280" />
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
              <LogOut size={22} color="#6b7280" />
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
                <ChevronLeft size={22} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth}>
                <ChevronRight size={22} />
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
                  onPress={() => setSelectedDay(day)}
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
                  <View style={styles.dotPlaceholder} />
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

          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No upcoming shifts
            </Text>
          </View>
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
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthTitle: { fontSize: 20, fontWeight: "700" },
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
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedDay: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },

  dayText: { color: "#334155" },
  selectedDayText: {
    color: "#4f46e5",
    fontWeight: "700",
  },

  dotPlaceholder: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 4,
    backgroundColor: "transparent",
  },

  emptyBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },

  emptyText: { color: "#6b7280" },

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