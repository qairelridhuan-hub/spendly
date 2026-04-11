import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Edit, Search, Trash2, UserPlus, Users, X } from "lucide-react-native";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { getPeriodKey } from "@/lib/reports/report";

type Worker = {
  id: string;
  name: string;
  email: string;
  authUid?: string;
  workerCode?: string;
  phone?: string;
  position?: string;
  hourlyRate?: number;
  status?: string;
};

export default function AdminWorkers() {
  const { colors: adminPalette } = useAdminTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [status, setStatus] = useState("");
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [formError, setFormError] = useState("");
  const createWorkerAuth = useMemo(
    () => httpsCallable(functions, "createWorkerAuth"),
    []
  );
  // ── Inline style helpers (theme-aware) ──
  const S = {
    input: {
      borderWidth: 1 as const, borderColor: adminPalette.border, borderRadius: 9,
      paddingHorizontal: 12, paddingVertical: 9,
      backgroundColor: adminPalette.surfaceAlt, color: adminPalette.text, fontSize: 13,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center" as const, justifyContent: "center" as const, padding: 20,
    },
    modal: {
      width: "100%" as const, maxWidth: 480,
      backgroundColor: adminPalette.surface,
      borderRadius: 14, borderWidth: 1 as const, borderColor: adminPalette.border,
      overflow: "hidden" as const,
    },
  };

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: searchOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    if (searchOpen) {
      const focusTimer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 220);
      return () => clearTimeout(focusTimer);
    }
  }, [searchAnim, searchOpen]);

  const getWorkerFormError = () => {
    if (!formData.name.trim()) return "Name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!isValidEmail(formData.email.trim())) return "Enter a valid email address.";
    const rate = Number(formData.hourlyRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return "Hourly rate must be greater than 0.";
    }
    return "";
  };

  const [formData, setFormData] = useState({
    uid: "",
    name: "",
    email: "",
    workerCode: "",
    phone: "",
    position: "",
    hourlyRate: "",
    joinDate: new Date().toISOString().split("T")[0],
    status: "active" as "active" | "inactive",
  });

  useEffect(() => {
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
          authUid: data.authUid || "",
          workerCode: data.workerCode || "",
          phone: data.phone || "",
          position: data.position || "",
          hourlyRate: Number(data.hourlyRate ?? 0),
          status: data.status || "active",
        };
      });
      setWorkers(list);
    });

    const attendanceQuery = collectionGroup(db, "attendance");
    const unsubAttendance = onSnapshot(attendanceQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => docSnap.data() as any);
      setAttendanceLogs(list);
    });

    return () => {
      unsubWorkers();
      unsubAttendance();
    };
  }, []);

  const currentPeriod = getPeriodKey(new Date());
  const totals = useMemo(() => {
    const map: Record<string, { hours: number; earnings: number }> = {};
    attendanceLogs.forEach(log => {
      if (log.status !== "approved") return;
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return;
      const workerId = String(log.workerId ?? "");
      if (!workerId) return;
      const workerRate =
        workers.find(worker => worker.id === workerId)?.hourlyRate ?? 0;
      const hours = getLogHours(log);
      const earnings = getLogEarnings(log, Number(workerRate ?? 0));
      map[workerId] = map[workerId] || { hours: 0, earnings: 0 };
      map[workerId].hours += hours;
      map[workerId].earnings += earnings;
    });
    return map;
  }, [attendanceLogs, currentPeriod, workers]);

  const filteredWorkers = useMemo(
    () =>
      workers.filter(worker =>
        [worker.name, worker.email, worker.position, worker.workerCode]
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [workers, searchQuery]
  );

  const getNextWorkerCode = () => {
    const codes = workers
      .map(worker => String(worker.workerCode || ""))
      .filter(code => code.startsWith("WKR-"))
      .map(code => Number(code.replace("WKR-", "")))
      .filter(value => Number.isFinite(value));
    const max = codes.length ? Math.max(...codes) : 0;
    return `WKR-${String(max + 1).padStart(3, "0")}`;
  };

  const resetForm = () => {
    setFormError("");
    setFormData({
      uid: "",
      name: "",
      email: "",
      workerCode: getNextWorkerCode(),
      phone: "",
      position: "",
      hourlyRate: "",
      joinDate: new Date().toISOString().split("T")[0],
      status: "active",
    });
  };

  const handleAddWorker = async () => {
    setFormError("");
    const error = getWorkerFormError();
    if (error) {
      setFormError(error);
      return;
    }
    const normalizedEmail = formData.email.trim().toLowerCase();
    const uidOverride = formData.uid.trim();
    const emailConflict = workers.find(
      worker =>
        worker.email?.trim().toLowerCase() === normalizedEmail &&
        worker.id !== uidOverride
    );
    if (emailConflict) {
      setFormError("Email is already assigned to another worker.");
      return;
    }
    const payload = {
      fullName: formData.name.trim(),
      email: normalizedEmail,
      workerCode: formData.workerCode || getNextWorkerCode(),
      phone: formData.phone.trim(),
      position: formData.position.trim(),
      hourlyRate: Number(formData.hourlyRate),
      joinDate: formData.joinDate,
      status: formData.status,
      role: "worker",
      updatedAt: serverTimestamp(),
    };
    try {
      const authResult = await createWorkerAuth({
        email: normalizedEmail,
        displayName: formData.name.trim(),
        uid: uidOverride || undefined,
      });
      const resultData = authResult.data as { uid?: string; resetLink?: string; created?: boolean } | null;
      const authUid = String(resultData?.uid || "");
      const resetLink = String(resultData?.resetLink || "");
      const created = Boolean(resultData?.created);
      if (!authUid) {
        setFormError("Failed to create Auth account.");
        return;
      }

      await setDoc(
        doc(db, "users", authUid),
        {
          ...payload,
          authUid,
          ...(uidOverride ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
      setStatus(
        created
          ? `Worker created in Auth. Reset link: ${resetLink}`
          : `Auth account already exists. Reset link: ${resetLink}`
      );
      resetForm();
      setShowAddModal(false);
    } catch (err: any) {
      const message = err?.message || "Failed to add worker.";
      setFormError(message);
    }
  };

  const handleEditWorker = async () => {
    if (!selectedWorker) return;
    setFormError("");
    const error = getWorkerFormError();
    if (error) {
      setFormError(error);
      return;
    }
    try {
      await updateDoc(doc(db, "users", selectedWorker.id), {
        fullName: formData.name.trim(),
        email: formData.email.trim(),
        workerCode: formData.workerCode,
        phone: formData.phone.trim(),
        position: formData.position.trim(),
        hourlyRate: Number(formData.hourlyRate),
        joinDate: formData.joinDate,
        status: formData.status,
        updatedAt: serverTimestamp(),
      });
      resetForm();
      setShowEditModal(false);
      setSelectedWorker(null);
    } catch {
      setFormError("Failed to update worker.");
    }
  };

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return;
    try {
      await deleteDoc(doc(db, "users", workerToDelete.id));
      setShowDeleteConfirm(false);
      setWorkerToDelete(null);
    } catch {
      setStatus("Failed to delete worker.");
    }
  };

  const openEditModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setFormError("");
    setFormData({
      uid: worker.id,
      name: worker.name,
      email: worker.email,
      workerCode: worker.workerCode || "",
      phone: worker.phone || "",
      position: worker.position || "",
      hourlyRate: String(worker.hourlyRate ?? ""),
      joinDate: new Date().toISOString().split("T")[0],
      status: (worker.status as "active" | "inactive") || "active",
    });
    setShowEditModal(true);
  };

  const p = adminPalette;
  const cell = { flex: 1, minWidth: 110 };

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        onScrollBeginDrag={() => { if (searchOpen) { setSearchOpen(false); Keyboard.dismiss(); } }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View>
            <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>Workers</Text>
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>{workers.length} registered</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Search */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Animated.View pointerEvents={searchOpen ? "auto" : "none"} style={{ width: searchAnim.interpolate({ inputRange: [0,1], outputRange: [0, 220] }), opacity: searchAnim, overflow: "hidden" }}>
                <TextInput
                  ref={searchInputRef}
                  placeholder="Search workers..."
                  placeholderTextColor={p.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onBlur={() => setSearchOpen(false)}
                  style={[S.input, { width: 220, marginRight: 8 }]}
                />
              </Animated.View>
              <TouchableOpacity onPress={() => setSearchOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <Search size={14} color={p.textMuted} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => { resetForm(); setShowAddModal(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: p.accentStrong }}
            >
              <UserPlus size={13} color="#fff" strokeWidth={2} />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Add Worker</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Table */}
        {filteredWorkers.length === 0 ? (
          <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 40, alignItems: "center" }}>
            <Users size={32} color={p.textMuted} strokeWidth={1.5} />
            <Text style={{ color: p.text, fontSize: 13, fontWeight: "600", marginTop: 10 }}>No Workers Found</Text>
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 4 }}>{searchQuery ? "Try adjusting your search" : "Add your first worker to get started"}</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border, overflow: "hidden" }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === "web"} style={{ width: "100%" }}>
              <View style={{ minWidth: 900 }}>
                {/* Table head */}
                <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border, backgroundColor: p.surfaceAlt }}>
                  {["Worker", "Position", "Contact", "Rate/hr", "Hours", "Earnings", "Status", ""].map(h => (
                    <Text key={h} style={[{ color: p.textMuted, fontSize: 11, fontWeight: "600" }, cell, h === "Worker" && { minWidth: 200 }]}>{h}</Text>
                  ))}
                </View>
                {/* Rows */}
                {filteredWorkers.map((worker, idx) => {
                  const wt = totals[worker.id] || { hours: 0, earnings: 0 };
                  const isActive = worker.status === "active";
                  return (
                    <View key={worker.id} style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: idx < filteredWorkers.length - 1 ? 1 : 0, borderBottomColor: p.border, alignItems: "center" }}>
                      {/* Worker */}
                      <View style={[{ flexDirection: "row", gap: 10, alignItems: "center", minWidth: 200 }, cell]}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: p.accent, fontSize: 11, fontWeight: "700" }}>{worker.name?.[0] ?? "W"}</Text>
                        </View>
                        <View>
                          <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" }}>{worker.name}</Text>
                          <Text style={{ color: p.textMuted, fontSize: 10, marginTop: 1 }}>{worker.workerCode ? `${worker.workerCode} · ` : ""}{worker.email}</Text>
                        </View>
                      </View>
                      <Text style={[{ color: p.textMuted, fontSize: 12 }, cell]}>{worker.position || "—"}</Text>
                      <Text style={[{ color: p.textMuted, fontSize: 12 }, cell]}>{worker.phone || "—"}</Text>
                      <Text style={[{ color: p.text, fontSize: 12 }, cell]}>RM {Number(worker.hourlyRate || 0).toFixed(2)}</Text>
                      <Text style={[{ color: p.text, fontSize: 12 }, cell]}>{wt.hours.toFixed(1)}h</Text>
                      <Text style={[{ color: p.success, fontSize: 12, fontWeight: "600" }, cell]}>RM {wt.earnings.toFixed(0)}</Text>
                      {/* Status */}
                      <View style={cell}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: isActive ? p.successSoft : p.surfaceAlt, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isActive ? p.success : p.textMuted }} />
                          <Text style={{ color: isActive ? p.success : p.textMuted, fontSize: 10, fontWeight: "600" }}>{isActive ? "Active" : "Inactive"}</Text>
                        </View>
                      </View>
                      {/* Actions */}
                      <View style={[{ flexDirection: "row", gap: 6 }, cell]}>
                        <TouchableOpacity onPress={() => openEditModal(worker)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: p.border, backgroundColor: p.surfaceAlt }}>
                          <Edit size={11} color={p.textMuted} strokeWidth={1.8} />
                          <Text style={{ color: p.textMuted, fontSize: 11, fontWeight: "600" }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setWorkerToDelete(worker); setShowDeleteConfirm(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: p.dangerSoft }}>
                          <Trash2 size={11} color={p.danger} strokeWidth={1.8} />
                          <Text style={{ color: p.danger, fontSize: 11, fontWeight: "600" }}>Del</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {status ? <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 12 }}>{status}</Text> : null}
      </ScrollView>

      {/* ── Add Modal ── */}
      {showAddModal && (
        <View style={S.overlay}>
          <View style={S.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: p.border }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>Add New Worker</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }} style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={p.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {[
                { label: "Auth UID (optional)", key: "uid", placeholder: "Paste Firebase Auth UID", hint: "Leave empty to auto-create account" },
                { label: "Worker Code", key: "workerCode", placeholder: "WKR-001" },
                { label: "Full Name *", key: "name", placeholder: "Worker full name" },
                { label: "Email *", key: "email", placeholder: "worker@example.com" },
                { label: "Phone", key: "phone", placeholder: "+60 12-345 6789" },
                { label: "Position", key: "position", placeholder: "Cashier, Server, Cook" },
                { label: "Hourly Rate (RM) *", key: "hourlyRate", placeholder: "10.00", numeric: true },
                { label: "Join Date", key: "joinDate", placeholder: "YYYY-MM-DD" },
              ].map(field => (
                <View key={field.key}>
                  <Text style={{ color: p.textMuted, fontSize: 11, marginBottom: 4 }}>{field.label}</Text>
                  <TextInput value={(formData as any)[field.key]} onChangeText={v => setFormData(prev => ({ ...prev, [field.key]: v }))} placeholder={field.placeholder} placeholderTextColor={p.textMuted} keyboardType={field.numeric ? "numeric" : "default"} style={S.input} />
                  {field.hint && <Text style={{ color: p.textMuted, fontSize: 10, marginTop: 3 }}>{field.hint}</Text>}
                </View>
              ))}
              {formError ? <Text style={{ color: p.danger, fontSize: 12 }}>{formError}</Text> : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: p.border }}>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1, borderWidth: 1, borderColor: p.border, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.surfaceAlt }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddWorker} style={{ flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.accentStrong }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Add Worker</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && selectedWorker && (
        <View style={S.overlay}>
          <View style={S.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: p.border }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>Edit Worker</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setSelectedWorker(null); resetForm(); }} style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: p.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={p.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {[
                { label: "Worker Code", key: "workerCode", placeholder: "WKR-001" },
                { label: "Full Name *", key: "name", placeholder: "Worker full name" },
                { label: "Email *", key: "email", placeholder: "worker@example.com" },
                { label: "Phone", key: "phone", placeholder: "+60 12-345 6789" },
                { label: "Position", key: "position", placeholder: "Cashier, Server, Cook" },
                { label: "Hourly Rate (RM) *", key: "hourlyRate", placeholder: "10.00", numeric: true },
                { label: "Join Date", key: "joinDate", placeholder: "YYYY-MM-DD" },
              ].map(field => (
                <View key={field.key}>
                  <Text style={{ color: p.textMuted, fontSize: 11, marginBottom: 4 }}>{field.label}</Text>
                  <TextInput value={(formData as any)[field.key]} onChangeText={v => setFormData(prev => ({ ...prev, [field.key]: v }))} placeholder={field.placeholder} placeholderTextColor={p.textMuted} keyboardType={field.numeric ? "numeric" : "default"} style={S.input} />
                </View>
              ))}
              {formError ? <Text style={{ color: p.danger, fontSize: 12 }}>{formError}</Text> : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: p.border }}>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setSelectedWorker(null); resetForm(); }} style={{ flex: 1, borderWidth: 1, borderColor: p.border, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.surfaceAlt }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditWorker} style={{ flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.accentStrong }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Delete Confirm ── */}
      {showDeleteConfirm && workerToDelete && (
        <View style={S.overlay}>
          <View style={[S.modal, { padding: 20 }]}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: "700" }}>Delete Worker</Text>
            <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
              Are you sure you want to delete <Text style={{ color: p.text, fontWeight: "600" }}>{workerToDelete.name}</Text>? This cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={() => { setShowDeleteConfirm(false); setWorkerToDelete(null); }} style={{ flex: 1, borderWidth: 1, borderColor: p.border, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.surfaceAlt }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteWorker} style={{ flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center", backgroundColor: p.danger }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}


const getLogHours = (log: any) => {
  const storedNet = Number(log.netHours ?? log.net_hours ?? 0);
  if (storedNet > 0) return storedNet;
  const stored = Number(log.hours ?? 0);
  if (stored > 0) return stored;
  const breakMinutes = getBreakMinutesForLog(log);
  if (log.clockInTs && log.clockOutTs) {
    const minutes = Math.max(
      0,
      Math.round((log.clockOutTs - log.clockInTs) / 60000) - breakMinutes
    );
    return minutes / 60;
  }
  if (log.clockIn && log.clockOut) {
    return calcHoursFromTimes(log.clockIn, log.clockOut, breakMinutes);
  }
  return 0;
};

const getLogOvertimeHours = (log: any) => {
  const stored = Number(log.overtimeHours ?? log.overtime_hours ?? 0);
  if (stored > 0) return stored;
  return 0;
};

const getLogEarnings = (log: any, hourlyRate: number) => {
  const finalPay = Number(log.finalPay ?? log.final_pay ?? 0);
  if (finalPay > 0) return finalPay;
  const netHours = getLogHours(log);
  const overtimeHours = getLogOvertimeHours(log);
  const regularHours = Math.max(0, netHours - overtimeHours);
  const overtimeRate = hourlyRate * 1.5;
  return regularHours * hourlyRate + overtimeHours * overtimeRate;
};

const getBreakMinutesForLog = (log: any) => {
  const stored = Number(log.breakMinutes ?? 0);
  if (stored > 0) return stored;
  if (log.breakStart && log.breakEnd) {
    return Math.max(0, calcMinutesDiff(log.breakStart, log.breakEnd));
  }
  return 0;
};

const calcHoursFromTimes = (start: string, end: string, breakMinutes = 0) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes - breakMinutes) / 60;
};

const calcMinutesDiff = (start: string, end: string) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return Math.max(0, endMinutes - startMinutes);
};

const parseTimeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};
