import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  const {
    headerRow,
    searchRow,
    searchIcon,
    searchIconButton,
    searchFieldWrap,
    searchInput,
    addButton,
    addButtonText,
    emptyCard,
    emptyTitle,
    emptySub,
    tableCard,
    tableHeader,
    tableHeaderText,
    tableRow,
    tableCell,
    tableCellMuted,
    avatar,
    avatarText,
    workerName,
    workerEmail,
    statusBadge,
    statusActive,
    statusInactive,
    statusText,
    iconButton,
    overlay,
    modal,
    modalHeader,
    modalTitle,
    modalBody,
    inputLabel,
    inputHint,
    input,
    valueText,
    modalActions,
    secondaryButton,
    secondaryButtonText,
    errorText,
    deleteText,
  } = useMemo(
    () => ({
      headerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: 16,
      },
      searchRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
      },
      searchIcon: {
        position: "absolute" as const,
        left: 12,
        top: 12,
      },
      searchIconButton: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        borderWidth: 1,
        borderColor: adminPalette.border,
        backgroundColor: adminPalette.surface,
      },
      searchFieldWrap: {
        overflow: "hidden" as const,
      },
      searchInput: {
        borderWidth: 1,
        borderColor: adminPalette.border,
        borderRadius: 10,
        paddingVertical: 10,
        paddingLeft: 40,
        paddingRight: 12,
        backgroundColor: adminPalette.surface,
        color: adminPalette.text,
        width: 260,
      },
      addButton: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: adminPalette.brand,
      },
      addButtonText: { color: "#fff", fontWeight: "600" as const, fontSize: 12 },
      emptyCard: {
        marginTop: 24,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: "center" as const,
        borderWidth: 1,
        borderColor: adminPalette.border,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
      emptyTitle: {
        color: adminPalette.text,
        fontWeight: "600" as const,
        marginTop: 12,
      },
      emptySub: { color: adminPalette.textMuted, fontSize: 12, marginTop: 6 },
      tableCard: {
        marginTop: 24,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: adminPalette.border,
        overflow: "hidden" as const,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
      },
      tableHeader: {
        flexDirection: "row" as const,
        backgroundColor: adminPalette.surfaceAlt,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
      },
      tableHeaderText: {
        flex: 1,
        minWidth: 110,
        color: adminPalette.textMuted,
        fontSize: 12,
        fontWeight: "600" as const,
      },
      tableRow: {
        flexDirection: "row" as const,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: adminPalette.border,
        alignItems: "center" as const,
      },
      tableCell: { flex: 1, minWidth: 110, color: adminPalette.text, fontSize: 12 },
      tableCellMuted: {
        flex: 1,
        minWidth: 110,
        color: adminPalette.textMuted,
        fontSize: 12,
      },
      avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: adminPalette.infoSoft,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
      avatarText: { color: adminPalette.accent, fontWeight: "600" as const },
      workerName: { color: adminPalette.text, fontSize: 12, fontWeight: "600" as const },
      workerEmail: { color: adminPalette.textMuted, fontSize: 10, marginTop: 2 },
      statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: adminPalette.surfaceAlt,
      },
      statusActive: {
        backgroundColor: adminPalette.successSoft,
      },
      statusInactive: {
        backgroundColor: adminPalette.surfaceAlt,
      },
      statusText: { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 },
      iconButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: adminPalette.surfaceAlt,
      },
      overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        padding: 20,
      },
      modal: {
        width: "100%" as const,
        maxWidth: 520,
        backgroundColor: adminPalette.surface,
        borderRadius: 16,
        padding: 20,
      },
      modalHeader: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
        marginBottom: 12,
      },
      modalTitle: { color: adminPalette.text, fontWeight: "600" as const },
      modalBody: { gap: 10 },
      inputLabel: { color: adminPalette.textMuted, fontSize: 12 },
      inputHint: { color: adminPalette.textMuted, fontSize: 11 },
      input: {
        borderWidth: 1,
        borderColor: adminPalette.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: adminPalette.surfaceAlt,
        color: adminPalette.text,
      },
      valueText: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
      modalActions: { flexDirection: "row" as const, gap: 12, marginTop: 16 },
      secondaryButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: adminPalette.border,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center" as const,
        backgroundColor: adminPalette.surfaceAlt,
      },
      secondaryButtonText: {
        color: adminPalette.text,
        fontWeight: "600" as const,
        fontSize: 12,
      },
      errorText: { color: adminPalette.danger, fontSize: 12 },
      deleteText: { color: adminPalette.textMuted, fontSize: 12, marginTop: 8 },
    }),
    [adminPalette]
  );

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
      const authUid = String(authResult.data?.uid || "");
      const resetLink = String(authResult.data?.resetLink || "");
      const created = Boolean(authResult.data?.created);
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
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        onScrollBeginDrag={() => {
          if (searchOpen) {
            setSearchOpen(false);
            Keyboard.dismiss();
          }
        }}
      >
        <View style={headerRow}>
          <View style={{ flex: 1, maxWidth: 420 }}>
            <View style={searchRow}>
              <TouchableOpacity
                style={searchIconButton}
                onPress={() => setSearchOpen(true)}
              >
                <Search size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
              <Animated.View
                pointerEvents={searchOpen ? "auto" : "none"}
                style={[
                  searchFieldWrap,
                  {
                    width: searchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 260],
                    }),
                    opacity: searchAnim,
                    transform: [
                      {
                        translateX: searchAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={{ position: "relative" }}>
                  <Search size={18} color={adminPalette.textMuted} style={searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    placeholder="Search workers..."
                    placeholderTextColor={adminPalette.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={searchInput}
                    onBlur={() => setSearchOpen(false)}
                    autoFocus={searchOpen}
                  />
                </View>
              </Animated.View>
            </View>
          </View>
          <TouchableOpacity
            style={addButton}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <UserPlus size={18} color="#fff" />
            <Text style={addButtonText}>Add Worker</Text>
          </TouchableOpacity>
        </View>

        {filteredWorkers.length === 0 ? (
          <View style={emptyCard}>
            <Users size={44} color={adminPalette.textMuted} />
            <Text style={emptyTitle}>No Workers Found</Text>
            <Text style={emptySub}>
              {searchQuery ? "Try adjusting your search" : "No workers yet."}
            </Text>
          </View>
        ) : (
          <View style={tableCard}>
            <View style={tableHeader}>
              {[
                "Worker",
                "Position",
                "Contact",
                "Rate/Hour",
                "Total Hours",
                "Earnings",
                "Status",
                "Actions",
              ].map(label => (
                <Text
                  key={label}
                  style={[
                    tableHeaderText,
                    label === "Worker" && { minWidth: 220 },
                    label === "Status" && { minWidth: 140 },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
            {filteredWorkers.map((worker, index) => {
              const workerTotals = totals[worker.id] || { hours: 0, earnings: 0 };
              return (
                <View
                  key={worker.id}
                  style={[
                    tableRow,
                    index % 2 === 1 ? { backgroundColor: adminPalette.surfaceAlt } : null,
                  ]}
                >
                  <View style={[tableCell, { flexDirection: "row", gap: 10, minWidth: 220 }]}>
                    <View style={avatar}>
                      <Text style={avatarText}>
                        {worker.name ? worker.name[0] : "W"}
                      </Text>
                    </View>
                    <View>
                      <Text style={workerName}>{worker.name}</Text>
                      <Text style={workerEmail}>
                        {worker.workerCode ? `${worker.workerCode} • ` : ""}{worker.email}
                      </Text>
                    </View>
                  </View>
                  <Text style={tableCellMuted}>{worker.position || "-"}</Text>
                  <Text style={tableCellMuted}>{worker.phone || "-"}</Text>
                  <Text style={tableCell}>
                    RM {Number(worker.hourlyRate || 0).toFixed(2)}
                  </Text>
                  <Text style={tableCell}>
                    {workerTotals.hours.toFixed(1)}h
                  </Text>
                  <Text style={tableCell}>
                    RM {workerTotals.earnings.toFixed(2)}
                  </Text>
                  <View style={[tableCell, { minWidth: 140 }]}>
                    <Text
                      style={[
                        statusBadge,
                        worker.status === "active"
                          ? statusActive
                          : statusInactive,
                      ]}
                    >
                      {worker.status === "active" ? "Active" : "Inactive"}
                    </Text>
                  </View>
                  <View style={tableCell}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={iconButton}
                        onPress={() => openEditModal(worker)}
                      >
                        <Edit size={14} color={adminPalette.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[iconButton, { backgroundColor: adminPalette.dangerSoft }]}
                        onPress={() => {
                          setWorkerToDelete(worker);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 size={14} color={adminPalette.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {status ? <Text style={statusText}>{status}</Text> : null}
      </ScrollView>

      {showAddModal ? (
        <View style={overlay}>
          <View style={modal}>
            <View style={modalHeader}>
              <Text style={modalTitle}>Add New Worker</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                style={iconButton}
              >
                <X size={16} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={modalBody}>
              <Text style={inputLabel}>Auth UID (optional)</Text>
              <TextInput
                value={formData.uid}
                onChangeText={value => setFormData(prev => ({ ...prev, uid: value }))}
                placeholder="Paste Firebase Auth UID"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputHint}>
                Leave this empty to auto-create an Auth account and show a reset link.
              </Text>

              <Text style={inputLabel}>Worker Code</Text>
              <TextInput
                value={formData.workerCode}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, workerCode: value }))
                }
                placeholder="WKR-001"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />

              <Text style={inputLabel}>Full Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={value => setFormData(prev => ({ ...prev, name: value }))}
                placeholder="Worker full name"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Email *</Text>
              <TextInput
                value={formData.email}
                onChangeText={value => setFormData(prev => ({ ...prev, email: value }))}
                placeholder="worker@example.com"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Phone</Text>
              <TextInput
                value={formData.phone}
                onChangeText={value => setFormData(prev => ({ ...prev, phone: value }))}
                placeholder="+60 12-345 6789"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Position</Text>
              <TextInput
                value={formData.position}
                onChangeText={value => setFormData(prev => ({ ...prev, position: value }))}
                placeholder="Cashier, Server, Cook"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Hourly Rate (RM) *</Text>
              <TextInput
                value={formData.hourlyRate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, hourlyRate: value }))
                }
                placeholder="10.00"
                keyboardType="numeric"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Join Date</Text>
              <TextInput
                value={formData.joinDate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, joinDate: value }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              {formError ? <Text style={errorText}>{formError}</Text> : null}
            </View>
            <View style={modalActions}>
              <TouchableOpacity
                style={secondaryButton}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Text style={secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={addButton} onPress={handleAddWorker}>
                <Text style={addButtonText}>Add Worker</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showEditModal && selectedWorker ? (
        <View style={overlay}>
          <View style={modal}>
            <View style={modalHeader}>
              <Text style={modalTitle}>Edit Worker</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedWorker(null);
                  resetForm();
                }}
                style={iconButton}
              >
                <X size={16} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={modalBody}>
              <Text style={inputLabel}>Worker Code</Text>
              <TextInput
                value={formData.workerCode}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, workerCode: value }))
                }
                placeholder="WKR-001"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />

              <Text style={inputLabel}>Full Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={value => setFormData(prev => ({ ...prev, name: value }))}
                placeholder="Worker full name"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Email *</Text>
              <TextInput
                value={formData.email}
                onChangeText={value => setFormData(prev => ({ ...prev, email: value }))}
                placeholder="worker@example.com"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Phone</Text>
              <TextInput
                value={formData.phone}
                onChangeText={value => setFormData(prev => ({ ...prev, phone: value }))}
                placeholder="+60 12-345 6789"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Position</Text>
              <TextInput
                value={formData.position}
                onChangeText={value => setFormData(prev => ({ ...prev, position: value }))}
                placeholder="Cashier, Server, Cook"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Hourly Rate (RM) *</Text>
              <TextInput
                value={formData.hourlyRate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, hourlyRate: value }))
                }
                placeholder="10.00"
                keyboardType="numeric"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              <Text style={inputLabel}>Join Date</Text>
              <TextInput
                value={formData.joinDate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, joinDate: value }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={adminPalette.textMuted}
                style={input}
              />
              {formError ? <Text style={errorText}>{formError}</Text> : null}
            </View>
            <View style={modalActions}>
              <TouchableOpacity
                style={secondaryButton}
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedWorker(null);
                  resetForm();
                }}
              >
                <Text style={secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={addButton} onPress={handleEditWorker}>
                <Text style={addButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showDeleteConfirm && workerToDelete ? (
        <View style={overlay}>
          <View style={modal}>
            <Text style={modalTitle}>Delete Worker</Text>
            <Text style={deleteText}>
              Are you sure you want to delete this worker? This action cannot be
              undone.
            </Text>
            <View style={modalActions}>
              <TouchableOpacity
                style={secondaryButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setWorkerToDelete(null);
                }}
              >
                <Text style={secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[addButton, { backgroundColor: adminPalette.danger }]}
                onPress={handleDeleteWorker}
              >
                <Text style={addButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

    </LinearGradient>
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
