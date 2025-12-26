import { View, Text, StyleSheet } from "react-native";
import { useCalendar } from "../context/calendar";

export default function CalendarScreen() {
  const { shifts, getUpcomingShifts } = useCalendar();

  const upcoming = getUpcomingShifts();

  const getDotColor = (status: string) => {
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
        return "#d1d5db";
    }
  };

  return (
    <View style={styles.container}>
      {/* UPCOMING SHIFTS */}
      <Text style={styles.sectionTitle}>Upcoming Shifts</Text>

      {upcoming.map((s, i) => (
        <View key={i} style={styles.shiftCard}>
          <View>
            <Text style={styles.shiftDate}>
              {s.date}
            </Text>
            <Text style={styles.shiftTime}>
              {s.startTime} - {s.endTime}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              { backgroundColor: getDotColor(s.status) },
            ]}
          >
            <Text style={styles.badgeText}>
              {s.status.replace("_", " ")}
            </Text>
          </View>
        </View>
      ))}

      {/* STATUS LEGEND */}
      <Text style={styles.sectionTitle}>Status</Text>

      <View style={styles.legendRow}>
        <Legend color="#3b82f6" label="Scheduled" />
        <Legend color="#22c55e" label="Completed" />
        <Legend color="#ef4444" label="Absent" />
      </View>
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
      <Text>{label}</Text>
    </View>
  );
}

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 12,
  },
  shiftCard: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  shiftDate: { fontWeight: "600" },
  shiftTime: { color: "#64748b" },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: "#fff", fontSize: 12 },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
});