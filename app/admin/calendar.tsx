import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminCalendar() {
  const { colors: p } = useAdminTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [workers, setWorkers] = useState<Record<string, { name?: string }>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "shifts"), snapshot => {
      setShifts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAtt = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const map: Record<string, string> = {};
      snapshot.forEach(d => {
        const data = d.data() as any;
        const key = `${String(data.workerId ?? "")}_${String(data.date ?? "")}`;
        if (key !== "_") map[key] = String(data.status ?? "pending");
      });
      setAttendanceMap(map);
    });
    const unsubWorkers = onSnapshot(
      query(collection(db, "users"), where("role", "==", "worker")),
      snapshot => {
        const map: Record<string, { name?: string }> = {};
        snapshot.forEach(d => {
          const data = d.data() as any;
          map[d.id] = { name: data.fullName || data.displayName || data.email };
        });
        setWorkers(map);
      }
    );
    return () => { unsub(); unsubAtt(); unsubWorkers(); };
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = currentDate.toLocaleString("en-US", { month: "long" });
  const year = currentDate.getFullYear();
  const today = new Date();

  const scheduleByDay = useMemo(() => {
    return shifts.reduce((acc, shift) => {
      const date = String(shift.date ?? "");
      if (!date) return acc;
      const parsed = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return acc;
      if (parsed.getMonth() !== currentDate.getMonth() || parsed.getFullYear() !== currentDate.getFullYear()) return acc;
      const day = parsed.getDate();
      acc[day] = acc[day] || [];
      acc[day].push(shift);
      return acc;
    }, {} as Record<number, any[]>);
  }, [shifts, currentDate]);

  const statusColors: Record<string, string> = {
    completed: p.successSoft,
    absent: p.dangerSoft,
    scheduled: p.infoSoft,
  };
  const statusTextColors: Record<string, string> = {
    completed: p.success,
    absent: p.danger,
    scheduled: p.accent,
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
            Calendar
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
            Shift schedule overview
          </Text>
        </View>

        {/* Calendar card */}
        <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border }}>

          {/* Month nav */}
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: p.border,
          }}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>
              {monthName} {year}
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                style={{
                  width: 30, height: 30, borderRadius: 7, borderWidth: 1,
                  borderColor: p.border, alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronLeft size={14} color={p.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                style={{
                  width: 30, height: 30, borderRadius: 7, borderWidth: 1,
                  borderColor: p.border, alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronRight size={14} color={p.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ padding: 12 }}>
            {/* Day labels */}
            <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <Text key={d} style={{
                  flex: 1, textAlign: "center",
                  color: p.textMuted, fontSize: 11, fontWeight: "600",
                  paddingVertical: 4,
                }}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <View key={`e-${i}`} style={{ width: "13.5%", minHeight: 80 }} />
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
                    style={{
                      width: "13.5%", minHeight: 80,
                      borderWidth: 1,
                      borderColor: isToday ? p.accent : p.border,
                      borderRadius: 8, padding: 5,
                      backgroundColor: isToday ? p.infoSoft : "transparent",
                    }}
                  >
                    <Text style={{
                      fontSize: 11, fontWeight: isToday ? ("700" as const) : ("500" as const),
                      color: isToday ? p.accent : p.text,
                      marginBottom: 3,
                    }}>
                      {day}
                    </Text>
                    <View style={{ gap: 2 }}>
                      {dayShifts.slice(0, 2).map((shift: any, i: number) => {
                        const key = `${String(shift.workerId ?? "")}_${String(shift.date ?? "")}`;
                        const eff = resolveStatus(shift.status, attendanceMap[key]);
                        const wName = workers[shift.workerId]?.name || "Worker";
                        return (
                          <View
                            key={i}
                            style={{
                              backgroundColor: statusColors[eff] || p.surfaceAlt,
                              borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2,
                            }}
                          >
                            <Text style={{
                              fontSize: 9, fontWeight: "600",
                              color: statusTextColors[eff] || p.text,
                            }} numberOfLines={1}>
                              {shift.start || "--"} {wName}
                            </Text>
                          </View>
                        );
                      })}
                      {dayShifts.length > 2 && (
                        <Text style={{ color: p.textMuted, fontSize: 9 }}>
                          +{dayShifts.length - 2}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Legend */}
        <View style={{
          marginTop: 12, backgroundColor: p.surface,
          borderRadius: 10, borderWidth: 1, borderColor: p.border,
          padding: 14, flexDirection: "row", gap: 20,
        }}>
          {[
            { label: "Scheduled", color: p.infoSoft, text: p.accent },
            { label: "Completed", color: p.successSoft, text: p.success },
            { label: "Absent",    color: p.dangerSoft,  text: p.danger  },
          ].map(leg => (
            <View key={leg.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: leg.color }} />
              <Text style={{ color: p.textMuted, fontSize: 12 }}>{leg.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const resolveStatus = (shiftStatus?: string, attendanceStatus?: string) => {
  if (attendanceStatus === "absent" || attendanceStatus === "rejected") return "absent";
  if (attendanceStatus === "approved") return "completed";
  if (attendanceStatus === "pending") return "scheduled";
  if (shiftStatus === "completed") return "completed";
  if (shiftStatus === "absent" || shiftStatus === "off" || shiftStatus === "leave") return "absent";
  return "scheduled";
};
