import { ScrollView, Text, TextInput, View, TouchableOpacity } from "react-native";
import { Calendar, Check, ChevronDown, Clock, Edit2, Info, X } from "lucide-react-native";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AdminErrorBanner } from "@/lib/admin/error-banner";
import { makeSnapshotErrorHandler } from "@/lib/firebase/errors";
import { adminCardShadow } from "@/lib/admin/shadows";
import { useEffect, useMemo, useState } from "react";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminAttendance() {
  const { colors: adminPalette } = useAdminTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<
    Record<string, { name?: string; hourlyRate?: number }>
  >({});
  const [breakLogs, setBreakLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [exceptionFilter, setExceptionFilter] = useState<
    "all" | "late" | "early" | "incomplete" | "no-show"
  >("all");
  const [exceptionWorkerId, setExceptionWorkerId] = useState("all");
  const [showWorkerMenu, setShowWorkerMenu] = useState(false);
  const [attendanceWorkerId, setAttendanceWorkerId] = useState("all");
  const [showAttendanceWorkerMenu, setShowAttendanceWorkerMenu] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    clockIn: "",
    clockOut: "",
    breakMinutes: "",
    reason: "",
  });
  const [adjustError, setAdjustError] = useState("");
  const [policy, setPolicy] = useState({
    hourlyRate: 0,
    payType: "hourly",
    dailyRate: 0,
    dailyMinHours: 6,
    dailyProrate: false,
    otAfterHours: 8,
    otMultiplier: 1.5,
    overtimeRate: 0,
    breakPaid: false,
    breakFixedMinutes: 0,
    autoBreak: true,
    roundingMinutes: 15,
    roundingMode: "nearest",
    roundingScope: "net",
    lateGraceMinutes: 5,
    earlyGraceMinutes: 5,
    weekendMultiplier: 1.25,
    holidayMultiplier: 2,
    holidays: [] as string[],
  });
  const [latestAudit, setLatestAudit] = useState<any | null>(null);
  const [error, setError] = useState("");
  const p = adminPalette;

  const inputField = {
    borderWidth: 1 as const, borderColor: p.border, borderRadius: 9,
    padding: 10, color: p.text, backgroundColor: p.surfaceAlt,
  };
  const workerMenuStyle = {
    position: "absolute" as const, top: 38, left: 0, minWidth: 180,
    backgroundColor: p.surface, borderRadius: 10, borderWidth: 1 as const,
    borderColor: p.border, paddingVertical: 4, zIndex: 20, elevation: 10,
  };
  const getStatusColor = (status: string) => {
    if (status === "approved") return { bg: p.successSoft, text: p.success };
    if (status === "rejected" || status === "absent") return { bg: p.dangerSoft, text: p.danger };
    return { bg: p.warningSoft, text: p.warning };
  };

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/attendance");
    const unsub = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setLogs(list);
    }, onSnapError);
    return unsub;
  }, []);

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/attendance");
    const unsubBreaks = onSnapshot(collectionGroup(db, "breaks"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setBreakLogs(list);
    }, onSnapError);
    const unsubOvertime = onSnapshot(collectionGroup(db, "overtime"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setOvertimeLogs(list);
    }, onSnapError);
    return () => {
      unsubBreaks();
      unsubOvertime();
    };
  }, []);

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/attendance");
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsub = onSnapshot(workersQuery, snapshot => {
      const map: Record<string, { name?: string; hourlyRate?: number }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] = {
          name: data.fullName || data.displayName || data.email,
          hourlyRate: Number(data.hourlyRate ?? 0),
        };
      });
      setWorkers(map);
    }, onSnapError);
    return unsub;
  }, []);

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/attendance");
    const auditQuery = query(
      collection(db, "adminAudits"),
      orderBy("updatedAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(auditQuery, snapshot => {
      const docSnap = snapshot.docs[0];
      setLatestAudit(docSnap ? { id: docSnap.id, ...docSnap.data() } : null);
    }, onSnapError);
    return unsub;
  }, []);

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/attendance");
    const configRef = doc(db, "config", "system");
    const unsub = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      if (!data) return;
      setPolicy(prev => ({
        ...prev,
        hourlyRate: Number(data.hourlyRate ?? prev.hourlyRate),
        payType: String(data.payType ?? prev.payType),
        dailyRate: Number(data.dailyRate ?? prev.dailyRate),
        dailyMinHours: Number(data.dailyMinHours ?? prev.dailyMinHours),
        dailyProrate: Boolean(data.dailyProrate ?? prev.dailyProrate),
        otAfterHours: Number(data.otAfterHours ?? prev.otAfterHours),
        otMultiplier: Number(data.otMultiplier ?? prev.otMultiplier),
        overtimeRate: Number(data.overtimeRate ?? prev.overtimeRate),
        breakPaid: Boolean(data.breakPaid ?? prev.breakPaid),
        breakFixedMinutes: Number(data.breakFixedMinutes ?? prev.breakFixedMinutes),
        autoBreak: Boolean(data.autoBreak ?? prev.autoBreak),
        roundingMinutes: Number(data.roundingMinutes ?? prev.roundingMinutes),
        roundingMode: String(data.roundingMode ?? prev.roundingMode),
        roundingScope: String(data.roundingScope ?? prev.roundingScope),
        lateGraceMinutes: Number(data.lateGraceMinutes ?? prev.lateGraceMinutes),
        earlyGraceMinutes: Number(data.earlyGraceMinutes ?? prev.earlyGraceMinutes),
        weekendMultiplier: Number(data.weekendMultiplier ?? prev.weekendMultiplier),
        holidayMultiplier: Number(data.holidayMultiplier ?? prev.holidayMultiplier),
        holidays: Array.isArray(data.holidays) ? data.holidays : prev.holidays,
      }));
    }, onSnapError);
    return unsub;
  }, []);

  const updateStatus = async (log: any, status: string) => {
    await updateDoc(doc(db, log.refPath), { status });
    await updateShiftStatusForAttendance(log, status);
    await addDoc(collection(db, "auditLogs"), {
      type: "attendance",
      action: "status-update",
      workerId: log.workerId || "",
      date: log.date || "",
      beforeStatus: log.status || "pending",
      afterStatus: status,
      updatedBy: "admin",
      createdAt: serverTimestamp(),
    });
    if (log.workerId && log.date) {
      await addDoc(collection(db, "notifications"), {
        type: "attendance",
        title: status === "approved" ? "Attendance approved" : "Attendance rejected",
        message: `Your attendance for ${log.date} was ${status}.`,
        status,
        workerId: log.workerId,
        targetRole: "worker",
        createdAt: serverTimestamp(),
      });
    }
  };

  const openDetails = (log: any) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const openAdjust = (log: any) => {
    setSelectedLog(log);
    setAdjustForm({
      clockIn: log.clockIn || "",
      clockOut: log.clockOut || "",
      breakMinutes: String(log.breakMinutes ?? ""),
      reason: "",
    });
    setAdjustError("");
    setShowAdjust(true);
  };

  const handleAdjustSave = async () => {
    if (!selectedLog) return;
    const { clockIn, clockOut, breakMinutes, reason } = adjustForm;
    if (!reason.trim()) {
      setAdjustError("Reason is required for manual adjustments.");
      return;
    }
    if (!isValidTime(clockIn) || !isValidTime(clockOut)) {
      setAdjustError("Clock in/out must be in HH:MM format.");
      return;
    }
    const dateKey = String(selectedLog.date ?? "");
    const clockInTs = buildTimestamp(dateKey, clockIn);
    const clockOutTs = buildTimestamp(dateKey, clockOut);
    if (!clockInTs || !clockOutTs) {
      setAdjustError("Invalid timestamp for clock in/out.");
      return;
    }
    if (clockOutTs <= clockInTs) {
      setAdjustError("Clock out must be after clock in.");
      return;
    }
    const hourlyRate =
      workers[selectedLog.workerId]?.hourlyRate || Number(policy.hourlyRate) || 0;
    const manualBreakMinutes = Number(breakMinutes || 0);
    const plannedStart =
      selectedLog.plannedStart || selectedLog.shiftStart || selectedLog.start || null;
    const plannedEnd =
      selectedLog.plannedEnd || selectedLog.shiftEnd || selectedLog.end || null;
    const metrics = computeAttendanceMetrics({
      clockInTs,
      clockOutTs,
      manualBreakMinutes,
      plannedStart,
      plannedEnd,
      dateKey,
      policy,
      hourlyRate,
    });
    const payload = {
      clockIn,
      clockOut,
      clockInTs,
      clockOutTs,
      hours: metrics.netHours,
      rawMinutes: metrics.rawMinutes,
      breakMinutes: metrics.breakMinutes,
      netMinutes: metrics.netMinutes,
      roundedMinutes: metrics.roundedMinutes,
      netHours: metrics.netHours,
      regularHours: metrics.regularHours,
      overtimeHours: metrics.overtimeHours,
      basePay: metrics.basePay,
      overtimePay: metrics.overtimePay,
      dailyPay: metrics.dailyPay,
      dayMultiplier: metrics.dayMultiplier,
      finalPay: metrics.finalPay,
      plannedStart,
      plannedEnd,
      isLate: metrics.isLate,
      lateMinutes: metrics.lateMinutes,
      isEarlyLeave: metrics.isEarlyLeave,
      earlyLeaveMinutes: metrics.earlyLeaveMinutes,
      status: "pending",
      manualAdjustReason: reason.trim(),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, selectedLog.refPath), payload);
    await updateShiftStatusForAttendance(selectedLog, "pending");
    await addDoc(collection(db, "auditLogs"), {
      type: "attendance",
      action: "manual-adjust",
      workerId: selectedLog.workerId || "",
      date: selectedLog.date || "",
      before: {
        clockIn: selectedLog.clockIn || "",
        clockOut: selectedLog.clockOut || "",
        breakMinutes: selectedLog.breakMinutes ?? 0,
      },
      after: {
        clockIn,
        clockOut,
        breakMinutes: metrics.breakMinutes,
      },
      reason: reason.trim(),
      updatedBy: "admin",
      createdAt: serverTimestamp(),
    });
    if (selectedLog.workerId) {
      const overtimeRef = doc(
        db,
        "users",
        selectedLog.workerId,
        "overtime",
        dateKey
      );
      if (metrics.overtimeHours > 0) {
        await setDoc(
          overtimeRef,
          {
            date: dateKey,
            workerId: selectedLog.workerId,
            startTime: plannedEnd ?? null,
            endTime: clockOut,
            hours: metrics.overtimeHours,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(
          overtimeRef,
          {
            date: dateKey,
            workerId: selectedLog.workerId,
            startTime: null,
            endTime: null,
            hours: 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
    setShowAdjust(false);
    setAdjustError("");
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const weeklyStart = startOfWeek(new Date());
  const weeklyEnd = endOfWeek(new Date());
  const weeklyStats = useMemo(() => {
    let weeklyHours = 0;
    let pendingCount = 0;
    let todayPresent = 0;
    logs.forEach(log => {
      const date = String(log.date ?? "");
      const logDate = new Date(`${date}T00:00:00`);
      if (
        !Number.isNaN(logDate.getTime()) &&
        logDate >= weeklyStart &&
        logDate <= weeklyEnd &&
        log.status === "approved"
      ) {
        weeklyHours += getLogHours(log);
      }
      if (log.status === "pending") pendingCount += 1;
      if (date === todayKey && log.status !== "absent" && log.clockIn) {
        todayPresent += 1;
      }
    });
    overtimeLogs.forEach(entry => {
      const date = String(entry.date ?? "");
      const logDate = new Date(`${date}T00:00:00`);
      if (
        !Number.isNaN(logDate.getTime()) &&
        logDate >= weeklyStart &&
        logDate <= weeklyEnd
      ) {
        weeklyHours += getOvertimeHours(entry);
      }
    });
    return { weeklyHours, pendingCount, todayPresent };
  }, [logs, todayKey, weeklyStart, weeklyEnd, overtimeLogs]);

  const totalWorkers = useMemo(() => Object.keys(workers).length, [workers]);
  const filteredLogs = useMemo(() => {
    if (attendanceWorkerId === "all") return logs;
    return logs.filter(log => log.workerId === attendanceWorkerId);
  }, [attendanceWorkerId, logs]);
  const sortedLogs = useMemo(
    () => sortLogsByDate(filteredLogs, sortOrder),
    [filteredLogs, sortOrder]
  );
  const breakMap = useMemo(() => buildBreakMap(breakLogs), [breakLogs]);
  const overtimeMap = useMemo(() => buildOvertimeMap(overtimeLogs), [overtimeLogs]);
  const workerOptions = useMemo(() => {
    const entries = Object.entries(workers).map(([id, info]) => ({
      id,
      name: info?.name || id,
    }));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: "all", name: "All workers" }, ...entries];
  }, [workers]);
  const exceptions = useMemo(() => {
    return logs
      .map(log => ({ log, type: getExceptionType(log) }))
      .filter(item => item.type !== null);
  }, [logs]);
  const filteredExceptions = useMemo(() => {
    let list = exceptions;
    if (exceptionFilter !== "all") {
      list = list.filter(item => item.type === exceptionFilter);
    }
    if (exceptionWorkerId !== "all") {
      list = list.filter(item => item.log.workerId === exceptionWorkerId);
    }
    return [...list].sort((a, b) => toLogTimestamp(a.log) - toLogTimestamp(b.log)).reverse();
  }, [exceptions, exceptionFilter, exceptionWorkerId]);

  const card = {
    backgroundColor: p.surface,
    borderRadius: 12,
    borderWidth: 1 as const,
    borderColor: p.border,
    ...adminCardShadow,
  };
  const pill = (active: boolean) => ({
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
    borderWidth: 1 as const,
    borderColor: active ? p.accent : p.border,
    backgroundColor: active ? p.infoSoft : p.surfaceAlt,
  });
  const dropBtn = {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1 as const, borderColor: p.border, backgroundColor: p.surfaceAlt,
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AdminErrorBanner message={error} />

        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>Attendance</Text>
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>Track and manage worker attendance records</Text>
        </View>

        {/* Stat row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Present Today",    value: `${weeklyStats.todayPresent}/${totalWorkers}`, color: p.accent },
            { label: "Pending Review",   value: String(weeklyStats.pendingCount),              color: p.warning },
            { label: "Hours This Week",  value: `${weeklyStats.weeklyHours.toFixed(1)}h`,      color: p.success },
            { label: "Exceptions",       value: String(exceptions.length),                     color: p.danger  },
          ].map(s => (
            <View key={s.label} style={[card, { flex: 1, padding: 12 }]}>
              <Text style={{ color: s.color, fontSize: 18, fontWeight: "700" }}>{s.value}</Text>
              <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Exceptions Inbox */}
        <View style={[card, { marginBottom: 16 }]}>
          {/* Card header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: p.border, flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Exceptions Inbox</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {(["all", "late", "early", "incomplete", "no-show"] as const).map(f => (
                <TouchableOpacity key={f} style={pill(exceptionFilter === f)} onPress={() => setExceptionFilter(f)}>
                  <Text style={{ color: exceptionFilter === f ? p.accent : p.textMuted, fontSize: 11, fontWeight: "600" }}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Worker filter */}
          <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: p.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 3 }}>
            <View style={{ position: "relative" }}>
              <TouchableOpacity style={dropBtn} onPress={() => setShowWorkerMenu(v => !v)}>
                <Text style={{ color: p.text, fontSize: 12 }}>{workerOptions.find(o => o.id === exceptionWorkerId)?.name || "All workers"}</Text>
                <ChevronDown size={12} color={p.textMuted} />
              </TouchableOpacity>
              {showWorkerMenu && (
                <View style={workerMenuStyle}>
                  {workerOptions.map(opt => (
                    <TouchableOpacity key={opt.id} style={{ paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => { setExceptionWorkerId(opt.id); setShowWorkerMenu(false); }}>
                      <Text style={{ color: exceptionWorkerId === opt.id ? p.accent : p.textMuted, fontSize: 12, fontWeight: exceptionWorkerId === opt.id ? "700" : "400" }}>{opt.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Text style={{ color: p.textMuted, fontSize: 11 }}>Sorted by latest</Text>
          </View>
          {showWorkerMenu && <View style={{ height: 160 }} />}
          {filteredExceptions.length === 0 ? (
            <View style={{ padding: 16 }}><Text style={{ color: p.textMuted, fontSize: 12 }}>No exceptions found</Text></View>
          ) : filteredExceptions.slice(0, 8).map((item, idx) => {
            const log = item.log;
            const wName = workers[log.workerId]?.name || "Worker";
            return (
              <View key={log.refPath} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: idx < Math.min(filteredExceptions.length, 8) - 1 ? 1 : 0, borderBottomColor: p.border, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" }}>{wName}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 11 }}>{log.date || "—"} · {item.type}</Text>
                </View>
                <Text style={{ color: p.textMuted, fontSize: 11 }}>{formatTimeValue(log.clockInTs, log.clockIn)} – {formatTimeValue(log.clockOutTs, log.clockOut)}</Text>
                <TouchableOpacity onPress={() => openDetails(log)} style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                  <Info size={13} color={p.accent} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Attendance Records */}
        <View style={[card, { zIndex: 2 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: p.border, flexWrap: "wrap", gap: 8, position: "relative", zIndex: 2 }}>
            <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Attendance Records</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {/* Worker dropdown */}
              <View style={{ position: "relative" }}>
                <TouchableOpacity style={dropBtn} onPress={() => { setShowAttendanceWorkerMenu(v => !v); setShowWorkerMenu(false); }}>
                  <Text style={{ color: p.text, fontSize: 12 }}>{workerOptions.find(o => o.id === attendanceWorkerId)?.name || "All workers"}</Text>
                  <ChevronDown size={12} color={p.textMuted} />
                </TouchableOpacity>
                {showAttendanceWorkerMenu && (
                  <View style={workerMenuStyle}>
                    {workerOptions.map(opt => (
                      <TouchableOpacity key={opt.id} style={{ paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => { setAttendanceWorkerId(opt.id); setShowAttendanceWorkerMenu(false); }}>
                        <Text style={{ color: attendanceWorkerId === opt.id ? p.accent : p.textMuted, fontSize: 12, fontWeight: attendanceWorkerId === opt.id ? "700" : "400" }}>{opt.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {/* Sort pills */}
              {(["latest", "oldest"] as const).map(s => (
                <TouchableOpacity key={s} style={pill(sortOrder === s)} onPress={() => setSortOrder(s)}>
                  <Text style={{ color: sortOrder === s ? p.accent : p.textMuted, fontSize: 11, fontWeight: "600" }}>{s === "latest" ? "Latest" : "Oldest"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Table head */}
          <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border, backgroundColor: p.surfaceAlt }}>
            {["Worker", "Date", "In", "Out", "Break", "Hours", "OT", "Status", ""].map(h => (
              <Text key={h} style={{ flex: 1, color: p.textMuted, fontSize: 10, fontWeight: "600" }}>{h}</Text>
            ))}
          </View>

          {sortedLogs.length === 0 ? (
            <View style={{ padding: 16 }}><Text style={{ color: p.textMuted, fontSize: 12 }}>No attendance records yet</Text></View>
          ) : sortedLogs.map((log, idx) => {
            const sc = getStatusColor(log.status);
            const wName = workers[log.workerId]?.name || "Worker";
            const otHours = overtimeMap[`${log.workerId}:${log.date}`] ?? 0;
            const breakEntry = breakMap[`${log.workerId}:${log.date}`];
            const breakStr = log.breakStart
              ? `${log.breakStart}–${log.breakEnd || "..."}`
              : breakEntry ? `${breakEntry.startTime || "–"}–${breakEntry.endTime || "–"}` : "–";
            return (
              <View key={log.refPath} style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: idx < sortedLogs.length - 1 ? 1 : 0, borderBottomColor: p.border, alignItems: "center" }}>
                <Text style={{ flex: 1, color: p.text, fontSize: 12, fontWeight: "600" }}>{wName}</Text>
                <Text style={{ flex: 1, color: p.textMuted, fontSize: 11 }}>{log.date || "–"}</Text>
                <Text style={{ flex: 1, color: p.textMuted, fontSize: 11 }}>{formatTimeValue(log.clockInTs, log.clockIn)}</Text>
                <Text style={{ flex: 1, color: p.textMuted, fontSize: 11 }}>{formatTimeValue(log.clockOutTs, log.clockOut)}</Text>
                <Text style={{ flex: 1, color: p.textMuted, fontSize: 11 }}>{breakStr}</Text>
                <Text style={{ flex: 1, color: p.text, fontSize: 11 }}>{getLogHours(log)}h</Text>
                <Text style={{ flex: 1, color: p.textMuted, fontSize: 11 }}>{otHours ? `${otHours}h` : "–"}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ backgroundColor: sc.bg, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}>
                    <Text style={{ color: sc.text, fontSize: 10, fontWeight: "700" }}>{String(log.status || "pending")}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
                  <TouchableOpacity onPress={() => openDetails(log)} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <Info size={12} color={p.accent} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openAdjust(log)} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <Edit2 size={12} color={p.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                  {log.status === "pending" && <>
                    <TouchableOpacity onPress={() => updateStatus(log, "approved")} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: p.successSoft, alignItems: "center", justifyContent: "center" }}>
                      <Check size={12} color={p.success} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => updateStatus(log, "rejected")} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: p.dangerSoft, alignItems: "center", justifyContent: "center" }}>
                      <X size={12} color={p.danger} strokeWidth={2} />
                    </TouchableOpacity>
                  </>}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 440, backgroundColor: p.surface, borderRadius: 14, borderWidth: 1, borderColor: p.border, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: p.border }}>
              <View>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>Pay Breakdown</Text>
                <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 1 }}>{workers[selectedLog.workerId]?.name || "Worker"} · {selectedLog.date || "–"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetails(false)} style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={p.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 8 }}>
              {[
                ["Raw minutes",     `${selectedLog.rawMinutes ?? 0}m`],
                ["Break minutes",   `${selectedLog.breakMinutes ?? 0}m`],
                ["Rounded minutes", `${selectedLog.roundedMinutes ?? 0}m`],
                ["Net hours",       `${selectedLog.netHours ?? selectedLog.hours ?? 0}h`],
                ["Overtime hours",  `${selectedLog.overtimeHours ?? 0}h`],
                ["Base pay",        formatCurrency(selectedLog.basePay)],
                ["Overtime pay",    formatCurrency(selectedLog.overtimePay)],
                ["Final pay",       formatCurrency(selectedLog.finalPay)],
              ].map(([label, value]) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: p.border }}>
                  <Text style={{ color: p.textMuted, fontSize: 12 }}>{label}</Text>
                  <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" }}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: p.border }}>
              <TouchableOpacity onPress={() => setShowDetails(false)} style={{ borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.surfaceAlt, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Adjust Modal */}
      {showAdjust && selectedLog && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 440, backgroundColor: p.surface, borderRadius: 14, borderWidth: 1, borderColor: p.border, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: p.border }}>
              <View>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>Adjust Attendance</Text>
                <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 1 }}>{workers[selectedLog.workerId]?.name || "Worker"} · {selectedLog.date || "–"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdjust(false)} style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={p.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TextInput placeholder="Clock in (HH:MM)" placeholderTextColor={p.textMuted} value={adjustForm.clockIn} onChangeText={v => setAdjustForm(prev => ({ ...prev, clockIn: v }))} style={[inputField, { flex: 1 }]} />
                <TextInput placeholder="Clock out (HH:MM)" placeholderTextColor={p.textMuted} value={adjustForm.clockOut} onChangeText={v => setAdjustForm(prev => ({ ...prev, clockOut: v }))} style={[inputField, { flex: 1 }]} />
              </View>
              <TextInput placeholder="Break minutes" placeholderTextColor={p.textMuted} keyboardType="numeric" value={adjustForm.breakMinutes} onChangeText={v => setAdjustForm(prev => ({ ...prev, breakMinutes: v.replace(/[^0-9]/g, "") }))} style={inputField} />
              <TextInput placeholder="Reason for adjustment *" placeholderTextColor={p.textMuted} value={adjustForm.reason} onChangeText={v => setAdjustForm(prev => ({ ...prev, reason: v }))} style={[inputField, { height: 72 }]} multiline />
              {adjustError ? <Text style={{ color: p.danger, fontSize: 12 }}>{adjustError}</Text> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: p.border }}>
              <TouchableOpacity onPress={() => setShowAdjust(false)} style={{ flex: 1, borderWidth: 1, borderColor: p.border, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.surfaceAlt }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdjustSave} style={{ flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.accentStrong }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const menuSpacer = { height: 160 };

const toLogTimestamp = (log: any) => {
  const date = String(log.date ?? "");
  const time = String(log.clockIn ?? log.start ?? "00:00");
  const timestamp = new Date(`${date}T${time}:00`).getTime();
  if (!Number.isNaN(timestamp)) return timestamp;
  return 0;
};

const sortLogsByDate = (items: any[], order: "latest" | "oldest") => {
  const sorted = [...items].sort((a, b) => toLogTimestamp(a) - toLogTimestamp(b));
  return order === "latest" ? sorted.reverse() : sorted;
};


const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfWeek = (date: Date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatTimeValue = (ts?: number, fallback?: string) => {
  if (typeof ts === "number") {
    const date = new Date(ts);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return fallback || "-";
};

const getOwnerId = (docSnap: any) => {
  return docSnap.ref?.parent?.parent?.id || docSnap.data()?.workerId || "";
};

const buildBreakMap = (entries: any[]) => {
  const map: Record<string, { startTime?: string; endTime?: string }> = {};
  entries.forEach(entry => {
    const workerId = String(entry.workerId ?? "");
    const date = String(entry.date ?? "");
    if (!workerId || !date) return;
    map[`${workerId}:${date}`] = {
      startTime: entry.startTime,
      endTime: entry.endTime,
    };
  });
  return map;
};

const buildOvertimeMap = (entries: any[]) => {
  const map: Record<string, number> = {};
  entries.forEach(entry => {
    const workerId = String(entry.workerId ?? "");
    const date = String(entry.date ?? "");
    if (!workerId || !date) return;
    const hours = getOvertimeHours(entry);
    if (!hours) return;
    map[`${workerId}:${date}`] = (map[`${workerId}:${date}`] ?? 0) + hours;
  });
  return map;
};

const getOvertimeHours = (entry: any) => {
  const hours = Number(entry.hours ?? 0);
  if (hours) return hours;
  if (entry.startTime && entry.endTime) {
    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    if (startMinutes === null || endMinutes === null) return 0;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  }
  return 0;
};

const parseTimeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const buildTimestamp = (dateKey: string, time: string) => {
  const timestamp = new Date(`${dateKey}T${time}:00`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const computeAttendanceMetrics = ({
  clockInTs,
  clockOutTs,
  manualBreakMinutes,
  plannedStart,
  plannedEnd,
  dateKey,
  policy,
  hourlyRate,
}: {
  clockInTs: number;
  clockOutTs: number;
  manualBreakMinutes: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  dateKey: string;
  policy: any;
  hourlyRate: number;
}) => {
  const rawMinutes = Math.max(0, Math.round((clockOutTs - clockInTs) / 60000));
  const breakMinutes = resolveBreakMinutes(rawMinutes, manualBreakMinutes, policy);
  const netMinutes = Math.max(0, rawMinutes - breakMinutes);
  const roundedMinutes = roundMinutes(netMinutes, policy.roundingMinutes, policy.roundingMode);
  const netHours = roundedMinutes / 60;
  const regularHours = Math.min(netHours, policy.otAfterHours);
  const overtimeHours = Math.max(netHours - policy.otAfterHours, 0);
  const overtimeRate =
    policy.overtimeRate > 0 ? policy.overtimeRate : hourlyRate * policy.otMultiplier;
  let basePay = regularHours * hourlyRate;
  let overtimePay = overtimeHours * overtimeRate;
  let dailyPay = basePay + overtimePay;
  if (policy.payType === "daily" && policy.dailyRate > 0) {
    if (netHours >= policy.dailyMinHours) {
      dailyPay = policy.dailyRate + overtimePay;
    } else if (policy.dailyProrate) {
      dailyPay = (policy.dailyRate * netHours) / policy.dailyMinHours + overtimePay;
    }
  }
  const dayMultiplier = resolveDayMultiplier(dateKey, policy);
  const finalPay = dailyPay * dayMultiplier;
  const lateMinutes = getLateMinutes(clockInTs, dateKey, plannedStart, policy);
  const earlyLeaveMinutes = getEarlyLeaveMinutes(clockOutTs, dateKey, plannedEnd, policy);

  return {
    rawMinutes,
    breakMinutes,
    netMinutes,
    roundedMinutes,
    netHours,
    regularHours,
    overtimeHours,
    basePay,
    overtimePay,
    dailyPay,
    dayMultiplier,
    finalPay,
    isLate: lateMinutes > 0,
    lateMinutes,
    isEarlyLeave: earlyLeaveMinutes > 0,
    earlyLeaveMinutes,
  };
};

const resolveBreakMinutes = (
  rawMinutes: number,
  manualBreakMinutes: number,
  policy: any
) => {
  if (policy.breakPaid) return 0;
  if (manualBreakMinutes > 0) return manualBreakMinutes;
  if (policy.breakFixedMinutes > 0) return policy.breakFixedMinutes;
  if (!policy.autoBreak) return 0;
  if (rawMinutes >= 540) return 60;
  if (rawMinutes >= 360) return 30;
  return 0;
};

const roundMinutes = (minutes: number, interval: number, mode: string) => {
  if (!interval || interval <= 1) return minutes;
  const factor = minutes / interval;
  if (mode === "floor") return Math.floor(factor) * interval;
  if (mode === "ceil") return Math.ceil(factor) * interval;
  return Math.round(factor) * interval;
};

const resolveDayMultiplier = (dateKey: string, policy: any) => {
  if (!dateKey) return 1;
  if (Array.isArray(policy.holidays) && policy.holidays.includes(dateKey)) {
    return policy.holidayMultiplier || 1;
  }
  const date = new Date(`${dateKey}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    const day = date.getDay();
    if (day === 0 || day === 6) return policy.weekendMultiplier || 1;
  }
  return 1;
};

const getLateMinutes = (
  clockInTs: number,
  dateKey: string,
  plannedStart: string | null,
  policy: any
) => {
  if (!clockInTs || !plannedStart || !dateKey) return 0;
  const plannedTs = buildTimestamp(dateKey, plannedStart);
  if (!plannedTs) return 0;
  const diffMinutes = Math.round((clockInTs - plannedTs) / 60000);
  return diffMinutes > policy.lateGraceMinutes ? diffMinutes : 0;
};

const getEarlyLeaveMinutes = (
  clockOutTs: number,
  dateKey: string,
  plannedEnd: string | null,
  policy: any
) => {
  if (!clockOutTs || !plannedEnd || !dateKey) return 0;
  const plannedTs = buildTimestamp(dateKey, plannedEnd);
  if (!plannedTs) return 0;
  const diffMinutes = Math.round((plannedTs - clockOutTs) / 60000);
  return diffMinutes > policy.earlyGraceMinutes ? diffMinutes : 0;
};

const getExceptionType = (log: any) => {
  if (log.status === "absent") return "no-show";
  if (log.clockIn && !log.clockOut) return "incomplete";
  if (Number(log.lateMinutes ?? 0) > 0) return "late";
  if (Number(log.earlyLeaveMinutes ?? 0) > 0) return "early";
  return null;
};

const formatCurrency = (value: any) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "RM 0.00";
  return `RM ${amount.toFixed(2)}`;
};

const getLogHours = (log: any) => {
  const hours = Number(log.netHours ?? log.hours ?? 0);
  return Number.isFinite(hours) ? Number(hours.toFixed(1)) : 0;
};

const updateShiftStatusForAttendance = async (log: any, status: string) => {
  const workerId = String(log.workerId || "");
  const date = String(log.date || "");
  if (!workerId || !date) return;
  const shiftStatus =
    status === "approved"
      ? "completed"
      : status === "absent" || status === "rejected"
      ? "absent"
      : "work";
  const shiftsQuery = query(
    collection(db, "shifts"),
    where("workerId", "==", workerId),
    where("date", "==", date)
  );
  const snapshot = await getDocs(shiftsQuery);
  if (snapshot.empty) return;
  const shiftDoc = snapshot.docs[0];
  await updateDoc(shiftDoc.ref, {
    status: shiftStatus,
    updatedAt: serverTimestamp(),
  });
};
