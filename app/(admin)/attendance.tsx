import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ClipboardCheck } from "lucide-react-native";
import { useTheme } from "@/lib/context";
import { collectionGroup, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function AdminAttendance() {
  const { colors } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        ...docSnap.data(),
      }));
      setLogs(list);
    });
    return unsub;
  }, []);

  const updateStatus = async (path: string, status: string) => {
    await updateDoc(doc(db, path), { status });
  };

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Attendance
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Review and approve clock-in/out logs.
        </Text>

        <View
          style={{
            marginTop: 20,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ClipboardCheck size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Attendance Log
            </Text>
          </View>
          {logs.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>
              No attendance entries yet.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {logs.map(log => (
                <View
                  key={log.refPath}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {log.workerId || "Worker"} • {log.date || "Date"}
                  </Text>
                  <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                    {log.clockIn || "--:--"} - {log.clockOut || "--:--"} • {log.hours || 0}h
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => updateStatus(log.refPath, "approved")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.success,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12 }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateStatus(log.refPath, "rejected")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.danger,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12 }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
