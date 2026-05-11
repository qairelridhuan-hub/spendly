import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { CheckCircle, Wallet } from "lucide-react-native";
import {
  addDoc, collection, collectionGroup, doc,
  onSnapshot, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminPayroll() {
  const { colors: p } = useAdminTheme();
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "payroll"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id, refPath: docSnap.ref.path, ...docSnap.data(),
      }));
      setRecords(list);
    });
    return unsub;
  }, []);

  const updateStatus = async (record: any, status: string) => {
    await updateDoc(doc(db, record.refPath), { status });
    if (record.workerId && record.period) {
      const userPayrollRef = doc(db, "users", record.workerId, "payroll", record.period);
      await setDoc(userPayrollRef, {
        workerId: record.workerId,
        period: record.period,
        totalHours: Number(record.totalHours ?? 0),
        overtimeHours: Number(record.overtimeHours ?? 0),
        totalEarnings: Number(record.totalEarnings ?? 0),
        absenceDeductions: Number(record.absenceDeductions ?? 0),
        status,
        updatedAt: serverTimestamp(),
      }, { merge: true });
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

  const stats = useMemo(() => {
    const paid = records.filter(r => r.status === "paid").length;
    const pending = records.filter(r => !r.status || r.status === "pending").length;
    const total = records.reduce((sum, r) => sum + Number(r.totalEarnings ?? 0), 0);
    return { paid, pending, total };
  }, [records]);

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
            Payroll
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
            Verify and finalize worker payments
          </Text>
        </View>

        {/* Stat row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Records", value: String(records.length) },
            { label: "Paid", value: String(stats.paid) },
            { label: "Pending", value: String(stats.pending) },
            { label: "Total (RM)", value: stats.total.toFixed(0) },
          ].map(stat => (
            <View key={stat.label} style={{
              flex: 1, backgroundColor: p.surface, borderRadius: 10,
              borderWidth: 1, borderColor: p.border, padding: 12,
            }}>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: "700" }}>{stat.value}</Text>
              <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Queue card */}
        <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border }}>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: p.border,
          }}>
            <Wallet size={14} color={p.textMuted} strokeWidth={1.8} />
            <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Payroll Queue</Text>
          </View>

          {records.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>No payroll records to verify</Text>
            </View>
          ) : (
            records.map((record, idx) => (
              <View
                key={record.refPath}
                style={{
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: idx < records.length - 1 ? 1 : 0,
                  borderBottomColor: p.border,
                  flexDirection: "row", alignItems: "center", gap: 12,
                }}
              >
                {/* Icon */}
                <View style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: p.surfaceAlt,
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Wallet size={14} color={p.textMuted} strokeWidth={1.8} />
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>
                    {record.workerId || "Worker"}
                  </Text>
                  <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 1 }}>
                    {record.period || "—"} · {record.totalHours || 0}h · RM {Number(record.totalEarnings ?? 0).toFixed(2)}
                  </Text>
                </View>

                {/* Status badge */}
                <StatusBadge status={record.status} p={p} />

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(!record.status || record.status === "pending") && (
                    <TouchableOpacity
                      onPress={() => updateStatus(record, "verified")}
                      style={{
                        paddingVertical: 5, paddingHorizontal: 10,
                        borderRadius: 7, borderWidth: 1,
                        borderColor: p.border, backgroundColor: p.surfaceAlt,
                      }}
                    >
                      <Text style={{ color: p.text, fontSize: 11, fontWeight: "600" }}>Verify</Text>
                    </TouchableOpacity>
                  )}
                  {record.status !== "paid" && (
                    <TouchableOpacity
                      onPress={() => updateStatus(record, "paid")}
                      style={{
                        paddingVertical: 5, paddingHorizontal: 10,
                        borderRadius: 7, backgroundColor: p.success,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Paid</Text>
                    </TouchableOpacity>
                  )}
                  {record.status === "paid" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={13} color={p.success} strokeWidth={2} />
                      <Text style={{ color: p.success, fontSize: 11, fontWeight: "600" }}>Paid</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatusBadge({ status, p }: { status: string; p: any }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    paid:     { label: "Paid",     color: p.success, bg: p.successSoft },
    verified: { label: "Verified", color: p.accent,  bg: p.infoSoft    },
    pending:  { label: "Pending",  color: p.warning, bg: p.warningSoft },
  };
  const s = map[status] ?? map["pending"];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: s.color, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}
