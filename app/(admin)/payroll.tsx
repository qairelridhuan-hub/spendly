import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wallet } from "lucide-react-native";
import { useTheme } from "@/lib/context";
import { collectionGroup, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";

export default function AdminPayroll() {
  const { colors } = useTheme();
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "payroll"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        ...docSnap.data(),
      }));
      setRecords(list);
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
          Payroll
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Verify and finalize worker payments.
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
            <Wallet size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Payroll Queue
            </Text>
          </View>
          {records.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>
              No payroll records to verify.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {records.map(record => (
                <View
                  key={record.refPath}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {record.workerId || "Worker"} • {record.period || "Period"}
                  </Text>
                  <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                    RM {Number(record.totalEarnings ?? 0).toFixed(2)} • {record.totalHours || 0}h
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => updateStatus(record.refPath, "verified")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.accent,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12 }}>Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateStatus(record.refPath, "paid")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: colors.success,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12 }}>Mark Paid</Text>
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
