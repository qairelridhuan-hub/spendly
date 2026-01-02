import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";
import { generateShiftsForWorkers, getSystemConfig } from "@/lib/admin/firestore";

type WorkConfig = {
  workingDaysPerWeek: string;
  hoursPerDay: string;
  durationMonths: string;
  preferredStart: string;
  preferredEnd: string;
};

type PaymentConfig = {
  hourlyRate: string;
  overtimeRate: string;
};

type Worker = { id: string; name: string; email: string };

export default function AdminSettings() {
  const { colors } = useTheme();
  const [workConfig, setWorkConfig] = useState<WorkConfig>({
    workingDaysPerWeek: "",
    hoursPerDay: "",
    durationMonths: "",
    preferredStart: "",
    preferredEnd: "",
  });
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    hourlyRate: "",
    overtimeRate: "",
  });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [scheduleTemplate, setScheduleTemplate] = useState("");
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const configRef = doc(db, "config", "system");
    const unsubConfig = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setWorkConfig({
        workingDaysPerWeek: String(data.workingDaysPerWeek ?? ""),
        hoursPerDay: String(data.hoursPerDay ?? ""),
        durationMonths: String(data.durationMonths ?? ""),
        preferredStart: String(data.preferredStart ?? ""),
        preferredEnd: String(data.preferredEnd ?? ""),
      });
      setPaymentConfig({
        hourlyRate: String(data.hourlyRate ?? ""),
        overtimeRate: String(data.overtimeRate ?? ""),
      });
    });

    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.fullName || data.displayName || "Worker",
          email: data.email || "",
        };
      });
      setWorkers(list);
    });

    return () => {
      unsubConfig();
      unsubWorkers();
    };
  }, []);

  const handleSaveConfig = async () => {
    setStatus("");
    try {
      await setDoc(
        doc(db, "config", "system"),
        {
        workingDaysPerWeek: Number(workConfig.workingDaysPerWeek || 0),
        hoursPerDay: Number(workConfig.hoursPerDay || 0),
        durationMonths: Number(workConfig.durationMonths || 0),
        preferredStart: workConfig.preferredStart,
        preferredEnd: workConfig.preferredEnd,
        hourlyRate: Number(paymentConfig.hourlyRate || 0),
        overtimeRate: Number(paymentConfig.overtimeRate || 0),
        updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setStatus("Configuration saved.");
    } catch {
      setStatus("Failed to save configuration.");
    }
  };

  const handleGenerateSchedule = async () => {
    setStatus("");
    setGenerating(true);
    try {
      const config = await getSystemConfig();
      if (!config) {
        setStatus("Save config before generating shifts.");
        setGenerating(false);
        return;
      }
      await generateShiftsForWorkers(config);
      setStatus("Shifts generated.");
    } catch {
      setStatus("Failed to generate shifts.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignWorker = async () => {
    setStatus("");
    if (!selectedWorkerId || !scheduleTemplate.trim()) {
      setStatus("Select a worker and template.");
      return;
    }
    try {
      await updateDoc(doc(db, "users", selectedWorkerId), {
        scheduleTemplate: scheduleTemplate.trim(),
        updatedAt: new Date().toISOString(),
      });
      setStatus("Worker assigned.");
    } catch {
      setStatus("Failed to assign worker.");
    }
  };

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      color: colors.text,
      backgroundColor: colors.surfaceAlt,
    }),
    [colors]
  );

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          System Settings
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Configure global scheduling and payroll rules.
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
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Work Configuration
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Working days per week"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={workConfig.workingDaysPerWeek}
              onChangeText={value =>
                setWorkConfig(prev => ({ ...prev, workingDaysPerWeek: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Working hours per day"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={workConfig.hoursPerDay}
              onChangeText={value =>
                setWorkConfig(prev => ({ ...prev, hoursPerDay: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Total duration (months)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={workConfig.durationMonths}
              onChangeText={value =>
                setWorkConfig(prev => ({ ...prev, durationMonths: value }))
              }
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                placeholder="Preferred start"
                placeholderTextColor={colors.textMuted}
                value={workConfig.preferredStart}
                onChangeText={value =>
                  setWorkConfig(prev => ({ ...prev, preferredStart: value }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                placeholder="Preferred end"
                placeholderTextColor={colors.textMuted}
                value={workConfig.preferredEnd}
                onChangeText={value =>
                  setWorkConfig(prev => ({ ...prev, preferredEnd: value }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
            </View>
          </View>
        </View>

        <View
          style={{
            marginTop: 16,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Payment Configuration
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Hourly rate (RM)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={paymentConfig.hourlyRate}
              onChangeText={value =>
                setPaymentConfig(prev => ({ ...prev, hourlyRate: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Overtime rate (RM)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={paymentConfig.overtimeRate}
              onChangeText={value =>
                setPaymentConfig(prev => ({ ...prev, overtimeRate: value }))
              }
              style={inputStyle}
            />
          </View>
        </View>

        <View
          style={{
            marginTop: 16,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 12 }}>
            Worker Assignment
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            Assign workers to a schedule template.
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Worker ID (select below)"
              placeholderTextColor={colors.textMuted}
              value={selectedWorkerId}
              onChangeText={setSelectedWorkerId}
              style={inputStyle}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {workers.map(worker => (
                  <TouchableOpacity
                    key={worker.id}
                    onPress={() => setSelectedWorkerId(worker.id)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor:
                        selectedWorkerId === worker.id
                          ? colors.accent
                          : colors.border,
                      backgroundColor:
                        selectedWorkerId === worker.id
                          ? colors.surfaceAlt
                          : "transparent",
                    }}
                  >
                    <Text style={{ color: colors.text }}>
                      {worker.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              placeholder="Schedule template name"
              placeholderTextColor={colors.textMuted}
              value={scheduleTemplate}
              onChangeText={setScheduleTemplate}
              style={inputStyle}
            />
            <TouchableOpacity
              onPress={handleAssignWorker}
              style={{
                backgroundColor: colors.accentStrong,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Assign Worker
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSaveConfig}
          style={{
            marginTop: 20,
            backgroundColor: colors.accent,
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Save Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGenerateSchedule}
          disabled={generating}
          style={{
            marginTop: 12,
            backgroundColor: colors.accentStrong,
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
            opacity: generating ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {generating ? "Generating..." : "Auto-generate Shifts"}
          </Text>
        </TouchableOpacity>

        {status ? (
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>{status}</Text>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}
