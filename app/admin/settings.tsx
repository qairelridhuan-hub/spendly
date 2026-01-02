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
import { generateShiftsForWorkers, getSystemConfig } from "@/lib/admin/firestore";
import { adminPalette } from "@/lib/admin/palette";

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
type ScheduleSummary = {
  id: string;
  name: string;
  days: string[];
  startTime: string;
  endTime: string;
  hourlyRate: number;
};

export default function AdminSettings() {
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
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
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

    const schedulesQuery = query(collection(db, "workSchedules"));
    const unsubSchedules = onSnapshot(schedulesQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.name || "Schedule",
          days: Array.isArray(data.days) ? data.days : [],
          startTime: data.startTime || "09:00",
          endTime: data.endTime || "17:00",
          hourlyRate: Number(data.hourlyRate ?? 0),
        } as ScheduleSummary;
      });
      setSchedules(list);
    });

    return () => {
      unsubConfig();
      unsubWorkers();
      unsubSchedules();
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
    if (!selectedWorkerId || !selectedScheduleId) {
      setStatus("Select a worker and schedule.");
      return;
    }
    try {
      const schedule = schedules.find(item => item.id === selectedScheduleId);
      await updateDoc(doc(db, "users", selectedWorkerId), {
        scheduleId: selectedScheduleId,
        scheduleName: schedule?.name || "",
        updatedAt: new Date().toISOString(),
      });
      setStatus("Worker assigned.");
    } catch {
      setStatus("Failed to assign worker.");
    }
  };

  const handleCopyWorkerId = async (workerId: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(workerId);
        setStatus("Copied worker UID to clipboard.");
      } else {
        setStatus("Copy not supported here. Select the UID manually.");
      }
    } catch {
      setStatus("Failed to copy UID. Please copy it manually.");
    }
  };

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: adminPalette.border,
      borderRadius: 12,
      padding: 12,
      color: adminPalette.text,
      backgroundColor: adminPalette.surfaceAlt,
    }),
    []
  );

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: adminPalette.text, fontSize: 20, fontWeight: "700" }}>
          Work Schedule Setup
        </Text>
        <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
          Define work schedules and assign them to workers.
        </Text>

        <View
          style={{
            marginTop: 20,
            backgroundColor: adminPalette.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: adminPalette.border,
          }}
        >
          <Text style={{ color: adminPalette.text, fontWeight: "600", marginBottom: 12 }}>
            Work Configuration
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Working days per week"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={workConfig.workingDaysPerWeek}
              onChangeText={value =>
                setWorkConfig(prev => ({ ...prev, workingDaysPerWeek: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Working hours per day"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={workConfig.hoursPerDay}
              onChangeText={value =>
                setWorkConfig(prev => ({ ...prev, hoursPerDay: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Total duration (months)"
              placeholderTextColor={adminPalette.textMuted}
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
                placeholderTextColor={adminPalette.textMuted}
                value={workConfig.preferredStart}
                onChangeText={value =>
                  setWorkConfig(prev => ({ ...prev, preferredStart: value }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                placeholder="Preferred end"
                placeholderTextColor={adminPalette.textMuted}
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
            backgroundColor: adminPalette.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: adminPalette.border,
          }}
        >
          <Text style={{ color: adminPalette.text, fontWeight: "600", marginBottom: 12 }}>
            Payment Configuration
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Hourly rate (RM)"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={paymentConfig.hourlyRate}
              onChangeText={value =>
                setPaymentConfig(prev => ({ ...prev, hourlyRate: value }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Overtime rate (RM)"
              placeholderTextColor={adminPalette.textMuted}
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
            backgroundColor: adminPalette.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: adminPalette.border,
          }}
        >
          <Text style={{ color: adminPalette.text, fontWeight: "600", marginBottom: 12 }}>
            Worker Assignment
          </Text>
          <Text style={{ color: adminPalette.textMuted, marginBottom: 12 }}>
            Assign workers to a schedule template.
          </Text>
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Worker ID (select below)"
              placeholderTextColor={adminPalette.textMuted}
              value={selectedWorkerId}
              onChangeText={setSelectedWorkerId}
              style={inputStyle}
            />
            <View style={{ gap: 10 }}>
              {workers.length === 0 ? (
                <Text style={{ color: adminPalette.textMuted }}>
                  No workers found yet.
                </Text>
              ) : (
                workers.map(worker => (
                  <View
                    key={worker.id}
                    style={{
                      borderWidth: 1,
                      borderColor: adminPalette.border,
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: adminPalette.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
                          {worker.name}
                        </Text>
                        <Text style={{ color: adminPalette.textMuted, marginTop: 2 }}>
                          {worker.email}
                        </Text>
                        <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
                          UID: {worker.id}
                        </Text>
                      </View>
                      <View style={{ gap: 8, alignItems: "flex-end" }}>
                        <TouchableOpacity
                          onPress={() => setSelectedWorkerId(worker.id)}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor:
                              selectedWorkerId === worker.id
                                ? adminPalette.accent
                                : adminPalette.border,
                            backgroundColor:
                              selectedWorkerId === worker.id
                                ? adminPalette.surface
                                : "transparent",
                          }}
                        >
                          <Text style={{ color: adminPalette.text, fontSize: 12 }}>
                            Select
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleCopyWorkerId(worker.id)}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: adminPalette.accentStrong,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 12 }}>
                            Copy UID
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
            <View style={{ gap: 10 }}>
              {schedules.length === 0 ? (
                <Text style={{ color: adminPalette.textMuted }}>
                  No schedules created yet.
                </Text>
              ) : (
                schedules.map(schedule => (
                  <TouchableOpacity
                    key={schedule.id}
                    onPress={() => setSelectedScheduleId(schedule.id)}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        selectedScheduleId === schedule.id
                          ? adminPalette.accent
                          : adminPalette.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor:
                        selectedScheduleId === schedule.id
                          ? adminPalette.infoSoft
                          : adminPalette.surfaceAlt,
                    }}
                  >
                    <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
                      {schedule.name}
                    </Text>
                    <Text style={{ color: adminPalette.textMuted, marginTop: 4 }}>
                      {schedule.days.length} days • {schedule.startTime} -{" "}
                      {schedule.endTime} • RM {schedule.hourlyRate.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
            <TouchableOpacity
              onPress={handleAssignWorker}
              style={{
                backgroundColor: adminPalette.accentStrong,
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
            backgroundColor: adminPalette.accent,
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
            backgroundColor: adminPalette.accentStrong,
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
          <Text style={{ color: adminPalette.textMuted, marginTop: 12 }}>
            {status}
          </Text>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}
