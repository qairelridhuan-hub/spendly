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
  const {
    statCard,
    statIcon,
    statTitle,
    statSub,
    tableCard,
    tableHeader,
    tableTitle,
    tableRowHeader,
    tableHeaderText,
    tableRow,
    tableCell,
    tableCellMuted,
    tableCellStatus,
    tableActions,
    actionButton,
    emptyText,
    sortControls,
    sortButton,
    sortButtonActive,
    sortButtonText,
    sortButtonTextActive,
    exceptionToolbar,
    exceptionHint,
    workerButton,
    workerButtonText,
    workerMenu,
    workerMenuItem,
    workerMenuText,
    workerMenuTextActive,
    modalOverlay,
    modalCard,
    modalHeader,
    modalTitle,
    modalSubtitle,
    modalRow,
    modalLabel,
    modalValue,
    modalButton,
    inputField,
  } = useMemo(
    () => ({
      statCard: {
        flex: 1,
        minWidth: 240,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
      statIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      statTitle: { color: adminPalette.text, fontWeight: "600" },
      statSub: { color: adminPalette.textMuted, marginTop: 4, fontSize: 12 },
      tableCard: {
        marginTop: 24,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
        overflow: "visible" as const,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
      },
      tableHeader: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        position: "relative" as const,
        zIndex: 3,
        overflow: "visible" as const,
      },
      tableTitle: { color: adminPalette.text, fontWeight: "600" },
      tableRowHeader: {
        flexDirection: "row" as const,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: adminPalette.surfaceAlt,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
      },
      tableHeaderText: {
        flex: 1,
        color: adminPalette.textMuted,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      tableRow: {
        flexDirection: "row" as const,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
        alignItems: "center" as const,
      },
      tableCell: { flex: 1, color: adminPalette.text, fontSize: 13 },
      tableCellMuted: { flex: 1, color: adminPalette.textMuted, fontSize: 13 },
      tableCellStatus: { flex: 1 },
      tableActions: { flex: 1, alignItems: "flex-start" as const },
      actionButton: {
        padding: 8,
        borderRadius: 10,
      },
      emptyText: { color: adminPalette.textMuted, fontSize: 12 },
      sortControls: { flexDirection: "row", gap: 8 },
      sortButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: adminPalette.border,
        backgroundColor: adminPalette.surfaceAlt,
      },
      sortButtonActive: {
        borderColor: adminPalette.accent,
        backgroundColor: adminPalette.infoSoft,
      },
      sortButtonText: { color: adminPalette.textMuted, fontSize: 11 },
      sortButtonTextActive: { color: adminPalette.accent, fontWeight: "700" },
      exceptionToolbar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        position: "relative" as const,
        zIndex: 2,
      },
      exceptionHint: { color: adminPalette.textMuted, fontSize: 12 },
      workerButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: adminPalette.border,
        backgroundColor: adminPalette.surfaceAlt,
      },
      workerButtonText: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
      workerMenu: {
        position: "absolute" as const,
        top: 42,
        left: 0,
        minWidth: 180,
        backgroundColor: adminPalette.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: adminPalette.border,
        paddingVertical: 6,
        zIndex: 20,
        elevation: 10,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      workerMenuItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      workerMenuText: { color: adminPalette.textMuted, fontSize: 12 },
      workerMenuTextActive: { color: adminPalette.accent, fontWeight: "700" },
      modalOverlay: {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        padding: 24,
      },
      modalCard: {
        width: "100%" as const,
        maxWidth: 520,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
        shadowColor: "#000",
        shadowOpacity: 0.24,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
        elevation: 5,
      },
      modalHeader: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
      },
      modalTitle: {
        color: adminPalette.text,
        fontWeight: "700" as const,
        fontSize: 16,
      },
      modalSubtitle: { color: adminPalette.textMuted, marginTop: 6, fontSize: 12 },
      modalRow: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
      },
      modalLabel: { color: adminPalette.textMuted, fontSize: 12 },
      modalValue: { color: adminPalette.text, fontSize: 12, fontWeight: "600" as const },
      modalButton: {
        flex: 1,
        alignItems: "center" as const,
        paddingVertical: 10,
        borderRadius: 12,
      },
      inputField: {
        borderWidth: 1,
        borderColor: adminPalette.border,
        borderRadius: 12,
        padding: 10,
        color: adminPalette.text,
        backgroundColor: adminPalette.surfaceAlt,
      },
    }),
    [adminPalette]
  );
  const getStatusStyle = (status: string) => {
    if (status === "approved") {
      return {
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: adminPalette.successSoft,
          fontSize: 12,
        },
        text: { color: adminPalette.success },
      };
    }
    if (status === "rejected" || status === "absent") {
      return {
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: adminPalette.dangerSoft,
          fontSize: 12,
        },
        text: { color: adminPalette.danger },
      };
    }
    return {
      badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: adminPalette.warningSoft,
        fontSize: 12,
      },
      text: { color: adminPalette.warning },
    };
  };

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, "attendance"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        refPath: docSnap.ref.path,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setLogs(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubBreaks = onSnapshot(collectionGroup(db, "breaks"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setBreakLogs(list);
    });
    const unsubOvertime = onSnapshot(collectionGroup(db, "overtime"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        workerId: getOwnerId(docSnap),
        ...docSnap.data(),
      }));
      setOvertimeLogs(list);
    });
    return () => {
      unsubBreaks();
      unsubOvertime();
    };
  }, []);

  useEffect(() => {
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
    });
    return unsub;
  }, []);

  useEffect(() => {
    const auditQuery = query(
      collection(db, "adminAudits"),
      orderBy("updatedAt", "desc"),
      limit(1)
    );
    const unsub = onSnapshot(auditQuery, snapshot => {
      const docSnap = snapshot.docs[0];
      setLatestAudit(docSnap ? { id: docSnap.id, ...docSnap.data() } : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
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
    });
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

  return (
    <View style={{ flex: 1, backgroundColor: adminPalette.backgroundStart }}>
      
      
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[statIcon, { backgroundColor: adminPalette.infoSoft }]}>
                <Clock size={18} color={adminPalette.accent} />
              </View>
              <View>
                <Text style={statTitle}>{"Today's Attendance"}</Text>
                <Text style={statSub}>
                  {weeklyStats.todayPresent} of {totalWorkers} workers present
                </Text>
              </View>
            </View>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[statIcon, { backgroundColor: adminPalette.warningSoft }]}>
                <Calendar size={18} color={adminPalette.warning} />
              </View>
              <View>
                <Text style={statTitle}>Pending Approval</Text>
                <Text style={statSub}>
                  {weeklyStats.pendingCount} records to review
                </Text>
              </View>
            </View>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[statIcon, { backgroundColor: adminPalette.successSoft }]}>
                <Check size={18} color={adminPalette.success} />
              </View>
              <View>
                <Text style={statTitle}>This Week</Text>
                <Text style={statSub}>
                  {weeklyStats.weeklyHours.toFixed(1)} hours logged
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[statIcon, { backgroundColor: adminPalette.warningSoft }]}>
                <Info size={18} color={adminPalette.warning} />
              </View>
              <View>
                <Text style={statTitle}>Latest Audit</Text>
                <Text style={statSub}>
                  {latestAudit
                    ? `${latestAudit.issueCount || 0} issue(s) in ${latestAudit.period || latestAudit.id}`
                    : "No mismatch audits yet"}
                </Text>
              </View>
            </View>
          </View>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[statIcon, { backgroundColor: adminPalette.dangerSoft }]}>
                <Calendar size={18} color={adminPalette.danger} />
              </View>
              <View>
                <Text style={statTitle}>Exceptions</Text>
                <Text style={statSub}>
                  {exceptions.length} record(s) need attention
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            tableCard,
            { marginTop: 16 },
            showWorkerMenu && { marginBottom: 180 },
          ]}
        >
          <View style={tableHeader}>
            <Text style={tableTitle}>Exceptions Inbox</Text>
            <View style={sortControls}>
              {(["all", "late", "early", "incomplete", "no-show"] as const).map(
                filter => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                      sortButton,
                      exceptionFilter === filter && sortButtonActive,
                    ]}
                    onPress={() => setExceptionFilter(filter)}
                  >
                    <Text
                      style={[
                        sortButtonText,
                        exceptionFilter === filter && sortButtonTextActive,
                      ]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          </View>
          <View style={exceptionToolbar}>
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                style={workerButton}
                onPress={() => setShowWorkerMenu(prev => !prev)}
              >
                <Text style={workerButtonText}>
                  {workerOptions.find(option => option.id === exceptionWorkerId)?.name ||
                    "All workers"}
                </Text>
                <ChevronDown size={14} color={adminPalette.textMuted} />
              </TouchableOpacity>
              {showWorkerMenu ? (
                <View style={workerMenu}>
                  {workerOptions.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={workerMenuItem}
                      onPress={() => {
                        setExceptionWorkerId(option.id);
                        setShowWorkerMenu(false);
                      }}
                    >
                      <Text
                        style={[
                          workerMenuText,
                          exceptionWorkerId === option.id && workerMenuTextActive,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={exceptionHint}>Sorted by latest</Text>
          </View>
          {showWorkerMenu ? <View style={menuSpacer} /> : null}
          {filteredExceptions.length === 0 ? (
            <View style={{ padding: 20 }}>
              <Text style={emptyText}>No exceptions found.</Text>
            </View>
          ) : (
            <View>
              {filteredExceptions.slice(0, 8).map((item, index) => {
                const log = item.log;
                const workerName =
                  workers[log.workerId]?.name || log.workerId || "Worker";
                return (
                  <View
                    key={log.refPath}
                    style={[
                      tableRow,
                      index % 2 === 1 ? { backgroundColor: adminPalette.surfaceAlt } : null,
                    ]}
                  >
                    <View style={{ flex: 2 }}>
                      <Text style={tableCell}>{workerName}</Text>
                      <Text style={tableCellMuted}>
                        {log.date || "-"} • {item.type}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={tableCellMuted}>
                        {formatTimeValue(log.clockInTs, log.clockIn)} -{" "}
                        {formatTimeValue(log.clockOutTs, log.clockOut)}
                      </Text>
                    </View>
                    <View style={tableActions}>
                      <TouchableOpacity
                        onPress={() => openDetails(log)}
                        style={[actionButton, { backgroundColor: adminPalette.infoSoft }]}
                      >
                        <Info size={16} color={adminPalette.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={tableCard}>
          <View style={tableHeader}>
            <Text style={tableTitle}>Attendance Records</Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  style={workerButton}
                  onPress={() => {
                    setShowAttendanceWorkerMenu(prev => !prev);
                    if (showWorkerMenu) setShowWorkerMenu(false);
                  }}
                >
                  <Text style={workerButtonText}>
                    {workerOptions.find(option => option.id === attendanceWorkerId)?.name ||
                      "All workers"}
                  </Text>
                  <ChevronDown size={14} color={adminPalette.textMuted} />
                </TouchableOpacity>
                {showAttendanceWorkerMenu ? (
                  <View style={workerMenu}>
                    {workerOptions.map(option => (
                      <TouchableOpacity
                        key={option.id}
                        style={workerMenuItem}
                        onPress={() => {
                          setAttendanceWorkerId(option.id);
                          setShowAttendanceWorkerMenu(false);
                        }}
                      >
                        <Text
                          style={[
                            workerMenuText,
                            attendanceWorkerId === option.id &&
                              workerMenuTextActive,
                          ]}
                        >
                          {option.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={sortControls}>
                <TouchableOpacity
                  style={[sortButton, sortOrder === "latest" && sortButtonActive]}
                  onPress={() => setSortOrder("latest")}
                >
                  <Text
                    style={[
                      sortButtonText,
                      sortOrder === "latest" && sortButtonTextActive,
                    ]}
                  >
                    Latest First
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sortButton, sortOrder === "oldest" && sortButtonActive]}
                  onPress={() => setSortOrder("oldest")}
                >
                  <Text
                    style={[
                      sortButtonText,
                      sortOrder === "oldest" && sortButtonTextActive,
                    ]}
                  >
                    Oldest First
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {showAttendanceWorkerMenu ? <View style={menuSpacer} /> : null}
          {sortedLogs.length === 0 ? (
            <View style={{ padding: 20 }}>
              <Text style={emptyText}>No attendance records yet.</Text>
            </View>
          ) : (
            <View>
              <View style={tableRowHeader}>
                {[
                  "Worker",
                  "Date",
                  "Clock In",
                  "Clock Out",
                  "Break",
                  "Hours",
                  "Overtime",
                  "Status",
                  "Actions",
                ].map(label => (
                  <Text key={label} style={tableHeaderText}>
                    {label}
                  </Text>
                ))}
              </View>
              {sortedLogs.map((log, index) => {
                const statusStyle = getStatusStyle(log.status);
                const workerName =
                  workers[log.workerId]?.name || log.workerId || "Worker";
                const overtimeHours = overtimeMap[`${log.workerId}:${log.date}`] ?? 0;
                const breakEntry = breakMap[`${log.workerId}:${log.date}`];
                return (
                  <View
                    key={log.refPath}
                    style={[
                      tableRow,
                      index % 2 === 1 ? { backgroundColor: adminPalette.surfaceAlt } : null,
                    ]}
                  >
                    <Text style={tableCell}>{workerName}</Text>
                    <Text style={tableCellMuted}>{log.date || "-"}</Text>
                    <Text style={tableCellMuted}>
                      {formatTimeValue(log.clockInTs, log.clockIn)}
                    </Text>
                    <Text style={tableCellMuted}>
                      {formatTimeValue(log.clockOutTs, log.clockOut)}
                    </Text>
                    <Text style={tableCellMuted}>
                      {log.breakStartTs || log.breakEndTs
                        ? `${formatTimeValue(log.breakStartTs, log.breakStart)}-${formatTimeValue(
                            log.breakEndTs,
                            log.breakEnd
                          )}`
                        : log.breakStart
                        ? log.breakEnd
                          ? `${log.breakStart}-${log.breakEnd}`
                          : `${log.breakStart}-...`
                        : breakEntry
                        ? `${breakEntry.startTime || "-"}-${breakEntry.endTime || "-"}`
                        : "-"}
                    </Text>
                    <Text style={tableCell}>{getLogHours(log)}h</Text>
                    <Text style={tableCellMuted}>
                      {overtimeHours ? `${overtimeHours}h` : "-"}
                    </Text>
                    <View style={tableCellStatus}>
                      <Text style={[statusStyle.badge, statusStyle.text]}>
                        {String(log.status || "pending")}
                      </Text>
                    </View>
                    <View style={tableActions}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => openDetails(log)}
                          style={[
                            actionButton,
                            { backgroundColor: adminPalette.infoSoft },
                          ]}
                        >
                          <Info size={16} color={adminPalette.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openAdjust(log)}
                          style={[
                            actionButton,
                            { backgroundColor: adminPalette.surfaceAlt },
                          ]}
                        >
                          <Edit2 size={16} color={adminPalette.textMuted} />
                        </TouchableOpacity>
                        {log.status === "pending" ? (
                          <>
                            <TouchableOpacity
                              onPress={() => updateStatus(log, "approved")}
                              style={[
                                actionButton,
                                { backgroundColor: adminPalette.successSoft },
                              ]}
                            >
                              <Check size={16} color={adminPalette.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => updateStatus(log, "rejected")}
                              style={[
                                actionButton,
                                { backgroundColor: adminPalette.dangerSoft },
                              ]}
                            >
                              <X size={16} color={adminPalette.danger} />
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {showDetails && selectedLog ? (
        <View style={modalOverlay}>
          <View style={modalCard}>
            <View style={modalHeader}>
              <Text style={modalTitle}>Pay Breakdown</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <X size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={modalSubtitle}>
              {workers[selectedLog.workerId]?.name || selectedLog.workerId || "Worker"} •{" "}
              {selectedLog.date || "-"}
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={modalRow}>
                <Text style={modalLabel}>Raw minutes</Text>
                <Text style={modalValue}>{selectedLog.rawMinutes ?? 0}m</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Break minutes</Text>
                <Text style={modalValue}>{selectedLog.breakMinutes ?? 0}m</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Rounded minutes</Text>
                <Text style={modalValue}>{selectedLog.roundedMinutes ?? 0}m</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Net hours</Text>
                <Text style={modalValue}>{selectedLog.netHours ?? selectedLog.hours ?? 0}h</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Overtime hours</Text>
                <Text style={modalValue}>{selectedLog.overtimeHours ?? 0}h</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Base pay</Text>
                <Text style={modalValue}>{formatCurrency(selectedLog.basePay)}</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Overtime pay</Text>
                <Text style={modalValue}>{formatCurrency(selectedLog.overtimePay)}</Text>
              </View>
              <View style={modalRow}>
                <Text style={modalLabel}>Final pay</Text>
                <Text style={modalValue}>{formatCurrency(selectedLog.finalPay)}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[modalButton, { backgroundColor: adminPalette.surfaceAlt }]}
              onPress={() => setShowDetails(false)}
            >
              <Text style={{ color: adminPalette.text, fontWeight: "600" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showAdjust && selectedLog ? (
        <View style={modalOverlay}>
          <View style={modalCard}>
            <View style={modalHeader}>
              <Text style={modalTitle}>Adjust Attendance</Text>
              <TouchableOpacity onPress={() => setShowAdjust(false)}>
                <X size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={modalSubtitle}>
              {workers[selectedLog.workerId]?.name || selectedLog.workerId || "Worker"} •{" "}
              {selectedLog.date || "-"}
            </Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextInput
                  placeholder="Clock in (HH:MM)"
                  placeholderTextColor={adminPalette.textMuted}
                  value={adjustForm.clockIn}
                  onChangeText={value =>
                    setAdjustForm(prev => ({ ...prev, clockIn: value }))
                  }
                  style={[inputField, { flex: 1 }]}
                />
                <TextInput
                  placeholder="Clock out (HH:MM)"
                  placeholderTextColor={adminPalette.textMuted}
                  value={adjustForm.clockOut}
                  onChangeText={value =>
                    setAdjustForm(prev => ({ ...prev, clockOut: value }))
                  }
                  style={[inputField, { flex: 1 }]}
                />
              </View>
              <TextInput
                placeholder="Break minutes"
                placeholderTextColor={adminPalette.textMuted}
                keyboardType="numeric"
                value={adjustForm.breakMinutes}
                onChangeText={value =>
                  setAdjustForm(prev => ({
                    ...prev,
                    breakMinutes: value.replace(/[^0-9]/g, ""),
                  }))
                }
                style={inputField}
              />
              <TextInput
                placeholder="Reason for adjustment *"
                placeholderTextColor={adminPalette.textMuted}
                value={adjustForm.reason}
                onChangeText={value =>
                  setAdjustForm(prev => ({ ...prev, reason: value }))
                }
                style={[inputField, { height: 80 }]}
                multiline
              />
              {adjustError ? (
                <Text style={{ color: adminPalette.danger, fontSize: 12 }}>
                  {adjustError}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[modalButton, { backgroundColor: adminPalette.surfaceAlt }]}
                onPress={() => setShowAdjust(false)}
              >
                <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalButton, { backgroundColor: adminPalette.accentStrong }]}
                onPress={handleAdjustSave}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
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
