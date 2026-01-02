import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { adminPalette } from "@/lib/admin/palette";

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [workers, setWorkers] = useState<Record<string, { name?: string }>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "shifts"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setShifts(list);
    });
    const unsubAttendance = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const map: Record<string, string> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        const key = `${String(data.workerId ?? "")}_${String(data.date ?? "")}`;
        if (key !== "_") {
          map[key] = String(data.status ?? "pending");
        }
      });
      setAttendanceMap(map);
    });
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const map: Record<string, { name?: string }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] = {
          name: data.fullName || data.displayName || data.email,
        };
      });
      setWorkers(map);
    });
    return () => {
      unsub();
      unsubAttendance();
      unsubWorkers();
    };
  }, []);

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const monthName = currentDate.toLocaleString("en-US", { month: "long" });
  const year = currentDate.getFullYear();
  const today = new Date();

  const scheduleByDay = shifts.reduce((acc, shift) => {
    const date = String(shift.date ?? "");
    if (!date) return acc;
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return acc;
    if (
      parsed.getMonth() !== currentDate.getMonth() ||
      parsed.getFullYear() !== currentDate.getFullYear()
    ) {
      return acc;
    }
    const day = parsed.getDate();
    acc[day] = acc[day] || [];
    acc[day].push(shift);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={card}>
          <View style={calendarHeader}>
            <Text style={calendarTitle}>
              {monthName} {year}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  setCurrentDate(
                    new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
                  )
                }
                style={navButton}
              >
                <ChevronLeft size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setCurrentDate(
                    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                  )
                }
                style={navButton}
              >
                <ChevronRight size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={addButton}>
                <Plus size={18} color="#fff" />
                <Text style={addButtonText}>Add Shift</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={calendarGrid}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <Text key={day} style={calendarDayLabel}>
                {day}
              </Text>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <View key={`empty-${idx}`} style={emptyCell} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isToday =
                day === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear();
              const dayShifts = scheduleByDay[day] || [];

              return (
                <View
                  key={day}
                  style={[
                    calendarCell,
                    isToday ? todayCell : null,
                  ]}
                >
                  <Text style={[cellDayText, isToday ? todayText : null]}>
                    {day}
                  </Text>
                  <View style={{ gap: 4 }}>
                    {dayShifts.slice(0, 2).map((shift: any, index: number) => {
                      const key = `${String(shift.workerId ?? "")}_${String(shift.date ?? "")}`;
                      const effective = resolveStatus(shift.status, attendanceMap[key]);
                      const workerName =
                        workers[shift.workerId]?.name || shift.workerId || "Worker";
                      return (
                        <View
                          key={`${day}-${index}`}
                          style={[
                            shiftCard,
                            effective === "completed"
                              ? shiftCompleted
                              : effective === "absent"
                                ? shiftAbsent
                                : shiftScheduled,
                          ]}
                        >
                          <View style={shiftCardHeader}>
                            <Text style={shiftTimeText}>
                              {shift.start || "--:--"}-{shift.end || "--:--"}
                            </Text>
                            <View
                              style={[
                                statusPill,
                                effective === "completed"
                                  ? statusPillCompleted
                                  : effective === "absent"
                                    ? statusPillAbsent
                                    : statusPillScheduled,
                              ]}
                            >
                              <Text style={statusPillText}>
                                {statusLabel(effective)}
                              </Text>
                            </View>
                          </View>
                          <Text style={shiftWorkerText}>{workerName}</Text>
                          {shift.role ? (
                            <Text style={shiftMetaText}>{shift.role}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                    {dayShifts.length > 2 ? (
                      <Text style={moreText}>+{dayShifts.length - 2} more</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={legendCard}>
          <Text style={legendTitle}>Status Legend</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <View style={legendItem}>
              <View style={[legendDot, { backgroundColor: adminPalette.infoSoft }]} />
              <Text style={legendText}>Scheduled</Text>
            </View>
            <View style={legendItem}>
              <View style={[legendDot, { backgroundColor: adminPalette.successSoft }]} />
              <Text style={legendText}>Completed</Text>
            </View>
            <View style={legendItem}>
              <View style={[legendDot, { backgroundColor: adminPalette.dangerSoft }]} />
              <Text style={legendText}>Absent</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const card = {
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const calendarHeader = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  marginBottom: 16,
};

const calendarTitle = {
  color: adminPalette.text,
  fontWeight: "700",
  fontSize: 18,
};

const navButton = {
  width: 36,
  height: 36,
  borderRadius: 10,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: adminPalette.surfaceAlt,
};

const addButton = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  paddingHorizontal: 12,
  height: 36,
  borderRadius: 10,
  backgroundColor: adminPalette.brand,
};

const addButtonText = { color: "#fff", fontWeight: "600", fontSize: 12 };

const calendarGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
};

const calendarDayLabel = {
  width: "13.5%",
  textAlign: "center" as const,
  color: adminPalette.textMuted,
  fontSize: 12,
  paddingVertical: 6,
};

const emptyCell = { width: "13.5%", minHeight: 96 };

const calendarCell = {
  width: "13.5%",
  borderWidth: 1,
  borderColor: adminPalette.border,
  borderRadius: 12,
  padding: 8,
  minHeight: 96,
};

const todayCell = {
  borderColor: adminPalette.accent,
  backgroundColor: adminPalette.infoSoft,
};
const cellDayText = {
  color: adminPalette.text,
  fontSize: 12,
  marginBottom: 4,
};
const todayText = { color: adminPalette.accent, fontWeight: "600" };

const shiftCard = {
  paddingVertical: 4,
  paddingHorizontal: 6,
  borderRadius: 8,
};

const shiftScheduled = { backgroundColor: adminPalette.infoSoft };
const shiftCompleted = { backgroundColor: adminPalette.successSoft };
const shiftAbsent = { backgroundColor: adminPalette.dangerSoft };
const shiftCardHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};
const shiftTimeText = { color: adminPalette.text, fontSize: 10, fontWeight: "600" as const };
const shiftWorkerText = { color: adminPalette.text, fontSize: 10, marginTop: 2 };
const shiftMetaText = { color: adminPalette.textMuted, fontSize: 9, marginTop: 2 };
const statusPill = {
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 999,
  backgroundColor: adminPalette.surface,
};
const statusPillScheduled = { backgroundColor: adminPalette.infoSoft };
const statusPillCompleted = { backgroundColor: adminPalette.successSoft };
const statusPillAbsent = { backgroundColor: adminPalette.dangerSoft };
const statusPillText = { color: adminPalette.text, fontSize: 9, fontWeight: "600" as const };
const moreText = { color: adminPalette.textMuted, fontSize: 10 };

const resolveStatus = (shiftStatus?: string, attendanceStatus?: string) => {
  if (attendanceStatus === "absent" || attendanceStatus === "rejected") return "absent";
  if (attendanceStatus === "approved") return "completed";
  if (attendanceStatus === "pending") return "scheduled";
  if (shiftStatus === "completed") return "completed";
  if (shiftStatus === "absent" || shiftStatus === "off" || shiftStatus === "leave") {
    return "absent";
  }
  return "scheduled";
};

const statusLabel = (status: string) => {
  if (status === "completed") return "Completed";
  if (status === "absent") return "Absent";
  return "Scheduled";
};

const legendCard = {
  marginTop: 20,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const legendTitle = {
  color: adminPalette.text,
  fontWeight: "600",
  marginBottom: 12,
};
const legendItem = { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 };
const legendDot = { width: 14, height: 14, borderRadius: 4 };
const legendText = { color: adminPalette.textMuted, fontSize: 12 };
