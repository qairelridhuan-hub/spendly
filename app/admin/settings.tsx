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
import { useAdminTheme } from "@/lib/admin/theme";

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

type RulesConfig = {
  payType: "hourly" | "daily" | "mixed";
  dailyRate: string;
  dailyMinHours: string;
  dailyProrate: boolean;
  otAfterHours: string;
  otMultiplier: string;
  breakPaid: boolean;
  breakFixedMinutes: string;
  autoBreak: boolean;
  roundingMinutes: string;
  roundingMode: "nearest" | "floor" | "ceil";
  roundingScope: "net" | "punch";
  lateGraceMinutes: string;
  earlyGraceMinutes: string;
  weekendMultiplier: string;
  holidayMultiplier: string;
  holidays: string;
  allowedStart: string;
  allowedEnd: string;
  maxHoursPerDay: string;
  maxHoursPerWeek: string;
  minRestHours: string;
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
  const { colors: adminPalette } = useAdminTheme();
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
  const [rulesConfig, setRulesConfig] = useState<RulesConfig>({
    payType: "hourly",
    dailyRate: "",
    dailyMinHours: "6",
    dailyProrate: false,
    otAfterHours: "8",
    otMultiplier: "1.5",
    breakPaid: false,
    breakFixedMinutes: "",
    autoBreak: true,
    roundingMinutes: "15",
    roundingMode: "nearest",
    roundingScope: "net",
    lateGraceMinutes: "5",
    earlyGraceMinutes: "5",
    weekendMultiplier: "1.25",
    holidayMultiplier: "2",
    holidays: "",
    allowedStart: "",
    allowedEnd: "",
    maxHoursPerDay: "",
    maxHoursPerWeek: "",
    minRestHours: "",
  });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);

  const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const sanitizeNumberInput = (value: string) => value.replace(/[^0-9.]/g, "");
  const sanitizeIntInput = (value: string) => value.replace(/[^0-9]/g, "");
  const parseNumber = (value: string) =>
    value.trim() === "" ? null : Number(value);
  const parseOptionalTime = (value: string) => (value.trim() ? value.trim() : "");
  const parseHolidayList = (value: string) =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

  const getConfigError = () => {
    const days = Number(workConfig.workingDaysPerWeek);
    const hours = Number(workConfig.hoursPerDay);
    const months = Number(workConfig.durationMonths);
    const hourlyRate = Number(paymentConfig.hourlyRate);
    const overtimeRate = Number(paymentConfig.overtimeRate);
    const dailyRate = parseNumber(rulesConfig.dailyRate);
    const dailyMinHours = parseNumber(rulesConfig.dailyMinHours);
    const otAfterHours = parseNumber(rulesConfig.otAfterHours);
    const otMultiplier = parseNumber(rulesConfig.otMultiplier);
    const breakFixedMinutes = parseNumber(rulesConfig.breakFixedMinutes);
    const roundingMinutes = parseNumber(rulesConfig.roundingMinutes);
    const lateGraceMinutes = parseNumber(rulesConfig.lateGraceMinutes);
    const earlyGraceMinutes = parseNumber(rulesConfig.earlyGraceMinutes);
    const weekendMultiplier = parseNumber(rulesConfig.weekendMultiplier);
    const holidayMultiplier = parseNumber(rulesConfig.holidayMultiplier);
    const maxHoursPerDay = parseNumber(rulesConfig.maxHoursPerDay);
    const maxHoursPerWeek = parseNumber(rulesConfig.maxHoursPerWeek);
    const minRestHours = parseNumber(rulesConfig.minRestHours);

    if (!Number.isFinite(days) || days <= 0 || days > 7) {
      return "Working days per week must be between 1 and 7.";
    }
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return "Working hours per day must be between 1 and 24.";
    }
    if (!Number.isFinite(months) || months <= 0) {
      return "Total duration (months) must be greater than 0.";
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      return "Hourly rate must be greater than 0.";
    }
    if (!Number.isFinite(overtimeRate) || overtimeRate <= 0) {
      return "Overtime rate must be greater than 0.";
    }
    if (workConfig.preferredStart && !isValidTime(workConfig.preferredStart)) {
      return "Preferred start must be in HH:MM format.";
    }
    if (workConfig.preferredEnd && !isValidTime(workConfig.preferredEnd)) {
      return "Preferred end must be in HH:MM format.";
    }
    if (
      workConfig.preferredStart &&
      workConfig.preferredEnd &&
      toMinutes(workConfig.preferredStart) >= toMinutes(workConfig.preferredEnd)
    ) {
      return "Preferred end must be after preferred start.";
    }
    if (!["hourly", "daily", "mixed"].includes(rulesConfig.payType)) {
      return "Select a valid pay type.";
    }
    if (rulesConfig.payType !== "hourly") {
      if (!dailyRate || dailyRate <= 0) {
        return "Daily rate must be greater than 0.";
      }
      if (!dailyMinHours || dailyMinHours <= 0 || dailyMinHours > 24) {
        return "Daily minimum hours must be between 1 and 24.";
      }
    }
    if (!otAfterHours || otAfterHours <= 0 || otAfterHours > 24) {
      return "Overtime starts after must be between 1 and 24 hours.";
    }
    if (!otMultiplier || otMultiplier < 1) {
      return "Overtime multiplier must be 1.0 or higher.";
    }
    if (breakFixedMinutes !== null && breakFixedMinutes < 0) {
      return "Break minutes cannot be negative.";
    }
    if (!roundingMinutes || roundingMinutes < 1 || roundingMinutes > 60) {
      return "Rounding minutes must be between 1 and 60.";
    }
    if (!["nearest", "floor", "ceil"].includes(rulesConfig.roundingMode)) {
      return "Select a valid rounding mode.";
    }
    if (!["net", "punch"].includes(rulesConfig.roundingScope)) {
      return "Select a valid rounding scope.";
    }
    if (lateGraceMinutes !== null && lateGraceMinutes < 0) {
      return "Late grace minutes cannot be negative.";
    }
    if (earlyGraceMinutes !== null && earlyGraceMinutes < 0) {
      return "Early leave grace minutes cannot be negative.";
    }
    if (!weekendMultiplier || weekendMultiplier <= 0) {
      return "Weekend multiplier must be greater than 0.";
    }
    if (!holidayMultiplier || holidayMultiplier <= 0) {
      return "Holiday multiplier must be greater than 0.";
    }
    if (rulesConfig.allowedStart && !isValidTime(rulesConfig.allowedStart)) {
      return "Allowed start must be in HH:MM format.";
    }
    if (rulesConfig.allowedEnd && !isValidTime(rulesConfig.allowedEnd)) {
      return "Allowed end must be in HH:MM format.";
    }
    if (
      rulesConfig.allowedStart &&
      rulesConfig.allowedEnd &&
      toMinutes(rulesConfig.allowedStart) >= toMinutes(rulesConfig.allowedEnd)
    ) {
      return "Allowed end must be after allowed start.";
    }
    if (maxHoursPerDay !== null && (maxHoursPerDay <= 0 || maxHoursPerDay > 24)) {
      return "Max hours per day must be between 1 and 24.";
    }
    if (
      maxHoursPerWeek !== null &&
      (maxHoursPerWeek <= 0 || maxHoursPerWeek > 168)
    ) {
      return "Max hours per week must be between 1 and 168.";
    }
    if (minRestHours !== null && (minRestHours < 0 || minRestHours > 48)) {
      return "Minimum rest hours must be between 0 and 48.";
    }
    const holidays = parseHolidayList(rulesConfig.holidays);
    const holidayInvalid = holidays.find(
      value => !/^\d{4}-\d{2}-\d{2}$/.test(value)
    );
    if (holidayInvalid) {
      return `Holiday date must be YYYY-MM-DD (invalid: ${holidayInvalid}).`;
    }
    if (
      rulesConfig.allowedStart &&
      workConfig.preferredStart &&
      toMinutes(workConfig.preferredStart) < toMinutes(rulesConfig.allowedStart)
    ) {
      return "Preferred start must be within allowed time range.";
    }
    if (
      rulesConfig.allowedEnd &&
      workConfig.preferredEnd &&
      toMinutes(workConfig.preferredEnd) > toMinutes(rulesConfig.allowedEnd)
    ) {
      return "Preferred end must be within allowed time range.";
    }
    if (
      maxHoursPerDay !== null &&
      Number.isFinite(hours) &&
      hours > maxHoursPerDay
    ) {
      return "Working hours per day exceed max hours per day.";
    }
    return "";
  };

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
      setRulesConfig({
        payType: String(data.payType ?? "hourly") as RulesConfig["payType"],
        dailyRate: String(data.dailyRate ?? ""),
        dailyMinHours: String(data.dailyMinHours ?? 6),
        dailyProrate: Boolean(data.dailyProrate ?? false),
        otAfterHours: String(data.otAfterHours ?? 8),
        otMultiplier: String(data.otMultiplier ?? 1.5),
        breakPaid: Boolean(data.breakPaid ?? false),
        breakFixedMinutes: String(data.breakFixedMinutes ?? ""),
        autoBreak: Boolean(data.autoBreak ?? true),
        roundingMinutes: String(data.roundingMinutes ?? 15),
        roundingMode: String(data.roundingMode ?? "nearest") as RulesConfig["roundingMode"],
        roundingScope: String(data.roundingScope ?? "net") as RulesConfig["roundingScope"],
        lateGraceMinutes: String(data.lateGraceMinutes ?? 5),
        earlyGraceMinutes: String(data.earlyGraceMinutes ?? 5),
        weekendMultiplier: String(data.weekendMultiplier ?? 1.25),
        holidayMultiplier: String(data.holidayMultiplier ?? 2),
        holidays: Array.isArray(data.holidays) ? data.holidays.join(", ") : "",
        allowedStart: String(data.allowedStart ?? ""),
        allowedEnd: String(data.allowedEnd ?? ""),
        maxHoursPerDay: String(data.maxHoursPerDay ?? ""),
        maxHoursPerWeek: String(data.maxHoursPerWeek ?? ""),
        minRestHours: String(data.minRestHours ?? ""),
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
    const error = getConfigError();
    if (error) {
      setStatus(error);
      return;
    }
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
          payType: rulesConfig.payType,
          dailyRate: Number(rulesConfig.dailyRate || 0),
          dailyMinHours: Number(rulesConfig.dailyMinHours || 0),
          dailyProrate: rulesConfig.dailyProrate,
          otAfterHours: Number(rulesConfig.otAfterHours || 0),
          otMultiplier: Number(rulesConfig.otMultiplier || 0),
          breakPaid: rulesConfig.breakPaid,
          breakFixedMinutes: Number(rulesConfig.breakFixedMinutes || 0),
          autoBreak: rulesConfig.autoBreak,
          roundingMinutes: Number(rulesConfig.roundingMinutes || 0),
          roundingMode: rulesConfig.roundingMode,
          roundingScope: rulesConfig.roundingScope,
          lateGraceMinutes: Number(rulesConfig.lateGraceMinutes || 0),
          earlyGraceMinutes: Number(rulesConfig.earlyGraceMinutes || 0),
          weekendMultiplier: Number(rulesConfig.weekendMultiplier || 0),
          holidayMultiplier: Number(rulesConfig.holidayMultiplier || 0),
          holidays: parseHolidayList(rulesConfig.holidays),
          allowedStart: parseOptionalTime(rulesConfig.allowedStart),
          allowedEnd: parseOptionalTime(rulesConfig.allowedEnd),
          maxHoursPerDay: Number(rulesConfig.maxHoursPerDay || 0),
          maxHoursPerWeek: Number(rulesConfig.maxHoursPerWeek || 0),
          minRestHours: Number(rulesConfig.minRestHours || 0),
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

  const example = useMemo(() => {
    const hourlyRate = Number(paymentConfig.hourlyRate || 0);
    const overtimeRate = Number(paymentConfig.overtimeRate || 0);
    const otMultiplier = Number(rulesConfig.otMultiplier || 1.5);
    const otAfterHours = Number(rulesConfig.otAfterHours || 8);
    const roundingMinutes = Number(rulesConfig.roundingMinutes || 15);
    const roundingMode = rulesConfig.roundingMode;
    const breakPaid = rulesConfig.breakPaid;
    const breakFixed = Number(rulesConfig.breakFixedMinutes || 0);
    const autoBreak = rulesConfig.autoBreak;
    const rawMinutes = 535;
    const breakMinutes = breakPaid
      ? 0
      : breakFixed > 0
      ? breakFixed
      : autoBreak
      ? rawMinutes >= 540
        ? 60
        : rawMinutes >= 360
        ? 30
        : 0
      : 0;
    const netMinutes = Math.max(0, rawMinutes - breakMinutes);
    const roundedMinutes = roundMinutes(netMinutes, roundingMinutes, roundingMode);
    const netHours = roundedMinutes / 60;
    const regularHours = Math.min(netHours, otAfterHours);
    const overtimeHours = Math.max(netHours - otAfterHours, 0);
    const derivedOtRate = overtimeRate > 0 ? overtimeRate : hourlyRate * otMultiplier;
    const basePay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * derivedOtRate;
    const totalPay = basePay + overtimePay;
    return {
      rawMinutes,
      breakMinutes,
      roundedMinutes,
      netHours: Number(netHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      totalPay: Number(totalPay.toFixed(2)),
    };
  }, [paymentConfig, rulesConfig]);

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
                setWorkConfig(prev => ({
                  ...prev,
                  workingDaysPerWeek: sanitizeIntInput(value),
                }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Working hours per day"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={workConfig.hoursPerDay}
              onChangeText={value =>
                setWorkConfig(prev => ({
                  ...prev,
                  hoursPerDay: sanitizeNumberInput(value),
                }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Total duration (months)"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={workConfig.durationMonths}
              onChangeText={value =>
                setWorkConfig(prev => ({
                  ...prev,
                  durationMonths: sanitizeIntInput(value),
                }))
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
                setPaymentConfig(prev => ({
                  ...prev,
                  hourlyRate: sanitizeNumberInput(value),
                }))
              }
              style={inputStyle}
            />
            <TextInput
              placeholder="Overtime rate (RM)"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={paymentConfig.overtimeRate}
              onChangeText={value =>
                setPaymentConfig(prev => ({
                  ...prev,
                  overtimeRate: sanitizeNumberInput(value),
                }))
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
            Pay & Time Rules
          </Text>
          <Text style={{ color: adminPalette.textMuted, marginBottom: 12 }}>
            These rules decide how hours and pay are calculated.
          </Text>

          <Text style={{ color: adminPalette.text, fontWeight: "600", marginBottom: 6 }}>
            1) Pay type
          </Text>
          <Text style={{ color: adminPalette.textMuted, marginBottom: 8, fontSize: 12 }}>
            Choose how workers are paid.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["hourly", "daily", "mixed"] as const).map(type => {
              const active = rulesConfig.payType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setRulesConfig(prev => ({ ...prev, payType: type }))}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? adminPalette.accent : adminPalette.border,
                    backgroundColor: active ? adminPalette.infoSoft : adminPalette.surfaceAlt,
                  }}
                >
                  <Text style={{ color: active ? adminPalette.accent : adminPalette.textMuted }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              2) Daily pay (only for daily/mixed)
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Daily rate (RM)
                </Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.dailyRate}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      dailyRate: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Minimum hours to qualify
                </Text>
                <TextInput
                  placeholder="6"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.dailyMinHours}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      dailyMinHours: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
            </View>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              3) Overtime
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  OT starts after (hours)
                </Text>
                <TextInput
                  placeholder="8"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.otAfterHours}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      otAfterHours: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  OT multiplier
                </Text>
                <TextInput
                  placeholder="1.5"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.otMultiplier}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      otMultiplier: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
            </View>
            <Text style={{ color: adminPalette.textMuted, fontSize: 11 }}>
              If an overtime rate is set in Payment Configuration, it overrides the multiplier.
            </Text>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              4) Breaks & rounding
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Fixed break minutes
                </Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.breakFixedMinutes}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      breakFixedMinutes: sanitizeIntInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Rounding minutes
                </Text>
                <TextInput
                  placeholder="15"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.roundingMinutes}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      roundingMinutes: sanitizeIntInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                {
                  label: "Break paid",
                  value: rulesConfig.breakPaid,
                  onPress: () =>
                    setRulesConfig(prev => ({ ...prev, breakPaid: !prev.breakPaid })),
                },
                {
                  label: "Auto break",
                  value: rulesConfig.autoBreak,
                  onPress: () =>
                    setRulesConfig(prev => ({ ...prev, autoBreak: !prev.autoBreak })),
                },
                {
                  label: "Prorate daily",
                  value: rulesConfig.dailyProrate,
                  onPress: () =>
                    setRulesConfig(prev => ({
                      ...prev,
                      dailyProrate: !prev.dailyProrate,
                    })),
                },
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.onPress}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: item.value ? adminPalette.accent : adminPalette.border,
                    backgroundColor: item.value
                      ? adminPalette.infoSoft
                      : adminPalette.surfaceAlt,
                  }}
                >
                  <Text style={{ color: item.value ? adminPalette.accent : adminPalette.textMuted }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                Rounding mode
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["nearest", "floor", "ceil"] as const).map(mode => {
                  const active = rulesConfig.roundingMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() =>
                        setRulesConfig(prev => ({ ...prev, roundingMode: mode }))
                      }
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? adminPalette.accent : adminPalette.border,
                        backgroundColor: active
                          ? adminPalette.infoSoft
                          : adminPalette.surfaceAlt,
                      }}
                    >
                      <Text
                        style={{ color: active ? adminPalette.accent : adminPalette.textMuted }}
                      >
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                Rounding scope
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["net", "punch"] as const).map(scope => {
                  const active = rulesConfig.roundingScope === scope;
                  return (
                    <TouchableOpacity
                      key={scope}
                      onPress={() =>
                        setRulesConfig(prev => ({ ...prev, roundingScope: scope }))
                      }
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? adminPalette.accent : adminPalette.border,
                        backgroundColor: active
                          ? adminPalette.infoSoft
                          : adminPalette.surfaceAlt,
                      }}
                    >
                      <Text
                        style={{ color: active ? adminPalette.accent : adminPalette.textMuted }}
                      >
                        {scope}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              5) Grace minutes
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Late grace (min)
                </Text>
                <TextInput
                  placeholder="5"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.lateGraceMinutes}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      lateGraceMinutes: sanitizeIntInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Early leave grace (min)
                </Text>
                <TextInput
                  placeholder="5"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.earlyGraceMinutes}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      earlyGraceMinutes: sanitizeIntInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
            </View>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              6) Multipliers & holidays
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Weekend multiplier
                </Text>
                <TextInput
                  placeholder="1.25"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.weekendMultiplier}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      weekendMultiplier: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                  Holiday multiplier
                </Text>
                <TextInput
                  placeholder="2.0"
                  placeholderTextColor={adminPalette.textMuted}
                  keyboardType="numeric"
                  value={rulesConfig.holidayMultiplier}
                  onChangeText={value =>
                    setRulesConfig(prev => ({
                      ...prev,
                      holidayMultiplier: sanitizeNumberInput(value),
                    }))
                  }
                  style={inputStyle}
                />
              </View>
            </View>
            <View>
              <Text style={{ color: adminPalette.textMuted, fontSize: 11, marginBottom: 6 }}>
                Holiday dates (YYYY-MM-DD, separated by commas)
              </Text>
              <TextInput
                placeholder="2026-01-01, 2026-01-29"
                placeholderTextColor={adminPalette.textMuted}
                value={rulesConfig.holidays}
                onChangeText={value => setRulesConfig(prev => ({ ...prev, holidays: value }))}
                style={inputStyle}
              />
            </View>
          </View>

          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              backgroundColor: adminPalette.surfaceAlt,
              borderWidth: 1,
              borderColor: adminPalette.border,
            }}
          >
            <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
              Example calculation
            </Text>
            <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
              09:00–18:05, 60m break, rounding {rulesConfig.roundingMinutes || 15}m
            </Text>
            <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
              Net hours: {example.netHours}h • OT: {example.overtimeHours}h
            </Text>
            <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
              Estimated pay: RM {example.totalPay.toFixed(2)}
            </Text>
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
            Scheduling Limits
          </Text>
          <Text style={{ color: adminPalette.textMuted, marginBottom: 12 }}>
            Guardrails for auto-generated shifts.
          </Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                placeholder="Allowed start (HH:MM)"
                placeholderTextColor={adminPalette.textMuted}
                value={rulesConfig.allowedStart}
                onChangeText={value =>
                  setRulesConfig(prev => ({ ...prev, allowedStart: value }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                placeholder="Allowed end (HH:MM)"
                placeholderTextColor={adminPalette.textMuted}
                value={rulesConfig.allowedEnd}
                onChangeText={value =>
                  setRulesConfig(prev => ({ ...prev, allowedEnd: value }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                placeholder="Max hours per day"
                placeholderTextColor={adminPalette.textMuted}
                keyboardType="numeric"
                value={rulesConfig.maxHoursPerDay}
                onChangeText={value =>
                  setRulesConfig(prev => ({
                    ...prev,
                    maxHoursPerDay: sanitizeNumberInput(value),
                  }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                placeholder="Max hours per week"
                placeholderTextColor={adminPalette.textMuted}
                keyboardType="numeric"
                value={rulesConfig.maxHoursPerWeek}
                onChangeText={value =>
                  setRulesConfig(prev => ({
                    ...prev,
                    maxHoursPerWeek: sanitizeNumberInput(value),
                  }))
                }
                style={[inputStyle, { flex: 1 }]}
              />
            </View>
            <TextInput
              placeholder="Minimum rest hours between shifts"
              placeholderTextColor={adminPalette.textMuted}
              keyboardType="numeric"
              value={rulesConfig.minRestHours}
              onChangeText={value =>
                setRulesConfig(prev => ({
                  ...prev,
                  minRestHours: sanitizeNumberInput(value),
                }))
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

const roundMinutes = (minutes: number, interval: number, mode: string) => {
  if (!interval || interval <= 1) return minutes;
  const factor = minutes / interval;
  if (mode === "floor") return Math.floor(factor) * interval;
  if (mode === "ceil") return Math.ceil(factor) * interval;
  return Math.round(factor) * interval;
};
