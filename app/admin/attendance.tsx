import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Check, Clock, X } from "lucide-react-native";
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { adminPalette } from "@/lib/admin/palette";

export default function AdminAttendance() {
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<Record<string, { name?: string }>>({});
  const [breakLogs, setBreakLogs] = useState<any[]>([]);
  const [overtimeLogs, setOvertimeLogs] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");

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
      const map: Record<string, { name?: string }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] = {
          name: data.fullName || data.displayName || data.email,
        };
      });
      setWorkers(map);
    });
    return unsub;
  }, []);

  const updateStatus = async (log: any, status: string) => {
    await updateDoc(doc(db, log.refPath), { status });
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
        weeklyHours += Number(log.hours ?? 0);
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
  const sortedLogs = useMemo(() => sortLogsByDate(logs, sortOrder), [logs, sortOrder]);
  const breakMap = useMemo(() => buildBreakMap(breakLogs), [breakLogs]);
  const overtimeMap = useMemo(() => buildOvertimeMap(overtimeLogs), [overtimeLogs]);

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <View style={statCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[statIcon, { backgroundColor: adminPalette.infoSoft }]}>
                <Clock size={18} color={adminPalette.accent} />
              </View>
              <View>
                <Text style={statTitle}>Today's Attendance</Text>
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

        <View style={tableCard}>
          <View style={tableHeader}>
            <Text style={tableTitle}>Attendance Records</Text>
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
              {sortedLogs.map(log => {
                const statusStyle = getStatusStyle(log.status);
                const workerName =
                  workers[log.workerId]?.name || log.workerId || "Worker";
                const overtimeHours = overtimeMap[`${log.workerId}:${log.date}`] ?? 0;
                const breakEntry = breakMap[`${log.workerId}:${log.date}`];
                return (
                  <View key={log.refPath} style={tableRow}>
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
                    <Text style={tableCell}>{log.hours || 0}h</Text>
                    <Text style={tableCellMuted}>
                      {overtimeHours ? `${overtimeHours}h` : "-"}
                    </Text>
                    <View style={tableCellStatus}>
                      <Text style={[statusStyle.badge, statusStyle.text]}>
                        {String(log.status || "pending")}
                      </Text>
                    </View>
                    <View style={tableActions}>
                      {log.status === "pending" ? (
                        <View style={{ flexDirection: "row", gap: 8 }}>
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
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const statCard = {
  flex: 1,
  minWidth: 240,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 16,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const statIcon = {
  width: 40,
  height: 40,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const statTitle = { color: adminPalette.text, fontWeight: "600" };
const statSub = { color: adminPalette.textMuted, marginTop: 4, fontSize: 12 };

const tableCard = {
  marginTop: 24,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: adminPalette.border,
  overflow: "hidden" as const,
};

const tableHeader = {
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
};

const tableTitle = { color: adminPalette.text, fontWeight: "600" };

const tableRowHeader = {
  flexDirection: "row" as const,
  paddingHorizontal: 20,
  paddingVertical: 12,
  backgroundColor: adminPalette.surfaceAlt,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
};

const tableHeaderText = {
  flex: 1,
  color: adminPalette.textMuted,
  fontSize: 12,
  fontWeight: "600" as const,
};

const tableRow = {
  flexDirection: "row" as const,
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
  alignItems: "center" as const,
};

const tableCell = { flex: 1, color: adminPalette.text, fontSize: 13 };
const tableCellMuted = { flex: 1, color: adminPalette.textMuted, fontSize: 13 };

const tableCellStatus = { flex: 1 };
const tableActions = { flex: 1, alignItems: "flex-start" as const };

const actionButton = {
  padding: 8,
  borderRadius: 10,
};

const emptyText = { color: adminPalette.textMuted, fontSize: 12 };

const sortControls = { flexDirection: "row", gap: 8 };
const sortButton = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: adminPalette.border,
  backgroundColor: adminPalette.surfaceAlt,
};
const sortButtonActive = {
  borderColor: adminPalette.accent,
  backgroundColor: adminPalette.infoSoft,
};
const sortButtonText = { color: adminPalette.textMuted, fontSize: 11 };
const sortButtonTextActive = { color: adminPalette.accent, fontWeight: "700" };

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
