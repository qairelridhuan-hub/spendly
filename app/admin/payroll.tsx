import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Wallet } from "lucide-react-native";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminPayroll() {
  const { colors: adminPalette } = useAdminTheme();
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

  const updateStatus = async (record: any, status: string) => {
    await updateDoc(doc(db, record.refPath), { status });
    if (record.workerId && record.period) {
      const userPayrollRef = doc(
        db,
        "users",
        record.workerId,
        "payroll",
        record.period
      );
      await setDoc(
        userPayrollRef,
        {
          workerId: record.workerId,
          period: record.period,
          totalHours: Number(record.totalHours ?? 0),
          overtimeHours: Number(record.overtimeHours ?? 0),
          totalEarnings: Number(record.totalEarnings ?? 0),
          absenceDeductions: Number(record.absenceDeductions ?? 0),
          status,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await addDoc(collection(db, "notifications"), {
        type: "payroll",
        title: status === "paid" ? "Payroll paid" : "Payroll verified",
        message: `Your payroll for ${record.period} is ${status}.`,
        status,
        workerId: record.workerId,
        targetRole: "worker",
        createdAt: serverTimestamp(),
      });
    }
  };


  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: 260,
          backgroundColor: adminPalette.surfaceAlt,
          opacity: 0.18,
          top: -220,
          right: -160,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: 340,
          backgroundColor: adminPalette.surfaceAlt,
          opacity: 0.12,
          bottom: -320,
          left: -260,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: adminPalette.text, fontSize: 24, fontWeight: "700" }}>
          Payroll
        </Text>
        <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
          Verify and finalize worker payments.
        </Text>

        <View
          style={{
            marginTop: 20,
            backgroundColor: adminPalette.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: adminPalette.border,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Wallet size={18} color={adminPalette.text} />
            <Text style={{ color: adminPalette.text, fontWeight: "700" }}>
              Payroll Queue
            </Text>
          </View>
          {records.length === 0 ? (
            <Text style={{ color: adminPalette.textMuted, marginTop: 10 }}>
              No payroll records to verify.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {records.map((record, index) => (
                <View
                  key={record.refPath}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: adminPalette.border,
                    backgroundColor:
                      index % 2 === 1 ? adminPalette.surfaceAlt : adminPalette.surface,
                  }}
                >
                  <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
                    {record.workerId || "Worker"} • {record.period || "Period"}
                  </Text>
                  <Text style={{ color: adminPalette.textMuted, marginTop: 4 }}>
                    RM{" "}
                    <Text style={{ color: adminPalette.accentStrong, fontWeight: "600" }}>
                      {Number(record.totalEarnings ?? 0).toFixed(2)}
                    </Text>{" "}
                    • {record.totalHours || 0}h
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => updateStatus(record, "verified")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: adminPalette.accentStrong,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12 }}>Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateStatus(record, "paid")}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: adminPalette.success,
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
