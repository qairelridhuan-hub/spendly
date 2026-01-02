import { useEffect, useMemo, useState } from "react";
import {
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
  addDoc,
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
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";

type Worker = {
  id: string;
  name: string;
  email: string;
  workerCode?: string;
  phone?: string;
  position?: string;
  hourlyRate?: number;
  status?: string;
  scheduleId?: string;
  scheduleName?: string;
};

export default function AdminWorkers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [totals, setTotals] = useState<Record<string, { hours: number; earnings: number }>>({});
  const [status, setStatus] = useState("");
  const [scheduleMap, setScheduleMap] = useState<Record<string, any>>({});
  const [assignWorkerId, setAssignWorkerId] = useState<string | null>(null);
  const [assignScheduleId, setAssignScheduleId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [formError, setFormError] = useState("");

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
          workerCode: data.workerCode || "",
          phone: data.phone || "",
          position: data.position || "",
          hourlyRate: Number(data.hourlyRate ?? 0),
          status: data.status || "active",
          scheduleId: data.scheduleId || "",
          scheduleName: data.scheduleName || "",
        };
      });
      setWorkers(list);
    });

    const schedulesQuery = collection(db, "workSchedules");
    const unsubSchedules = onSnapshot(schedulesQuery, snapshot => {
      const map: Record<string, any> = {};
      snapshot.forEach(docSnap => {
        map[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      setScheduleMap(map);
    });

    const payrollQuery = collectionGroup(db, "payroll");
    const unsubPayroll = onSnapshot(payrollQuery, snapshot => {
      const map: Record<string, { hours: number; earnings: number }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        const workerId = String(data.workerId ?? "");
        if (!workerId) return;
        map[workerId] = map[workerId] || { hours: 0, earnings: 0 };
        map[workerId].hours += Number(data.totalHours ?? 0);
        map[workerId].earnings += Number(data.totalEarnings ?? 0);
      });
      setTotals(map);
    });

    return () => {
      unsubWorkers();
      unsubPayroll();
      unsubSchedules();
    };
  }, []);

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
    if (!formData.name.trim() || !formData.email.trim() || !formData.hourlyRate) {
      setFormError("Name, email, and hourly rate are required.");
      return;
    }
    const payload = {
      fullName: formData.name.trim(),
      email: formData.email.trim(),
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
      if (formData.uid.trim()) {
        await setDoc(doc(db, "users", formData.uid.trim()), payload, { merge: true });
      } else {
        await addDoc(collection(db, "users"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatus("Worker profile created. Link to Auth UID when available.");
      }
      resetForm();
      setShowAddModal(false);
    } catch {
      setFormError("Failed to add worker.");
    }
  };

  const handleEditWorker = async () => {
    if (!selectedWorker) return;
    setFormError("");
    if (!formData.name.trim() || !formData.email.trim() || !formData.hourlyRate) {
      setFormError("Name, email, and hourly rate are required.");
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

  const handleAssignSchedule = async () => {
    if (!assignWorkerId || !assignScheduleId) {
      setStatus("Select a worker and schedule first.");
      return;
    }
    try {
      const schedule = scheduleMap[assignScheduleId];
      if (!schedule) {
        setStatus("Selected schedule not found.");
        return;
      }
      await updateDoc(doc(db, "users", assignWorkerId), {
        scheduleId: assignScheduleId,
        scheduleName: schedule.name || "",
        updatedAt: serverTimestamp(),
      });
      setStatus("Schedule assigned to worker.");
    } catch {
      setStatus("Failed to assign schedule.");
    }
  };

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={headerRow}>
          <View style={{ flex: 1, maxWidth: 420 }}>
            <View style={{ position: "relative" }}>
              <Search size={18} color={adminPalette.textMuted} style={searchIcon} />
              <TextInput
                placeholder="Search workers..."
                placeholderTextColor={adminPalette.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={searchInput}
              />
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

        <View style={assignCard}>
          <Text style={assignTitle}>Assign Schedule</Text>
          <Text style={assignSubtitle}>
            Select a worker and schedule to link them.
          </Text>
          <View style={assignRow}>
            <View style={{ flex: 1 }}>
              <Text style={inputLabel}>Worker</Text>
              <View style={chipRow}>
                {workers.map(worker => (
                  <TouchableOpacity
                    key={worker.id}
                    style={[
                      chip,
                      assignWorkerId === worker.id && chipActive,
                    ]}
                    onPress={() => setAssignWorkerId(worker.id)}
                  >
                    <Text
                      style={[
                        chipText,
                        assignWorkerId === worker.id && chipTextActive,
                      ]}
                    >
                      {worker.name} {worker.workerCode ? `(${worker.workerCode})` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={inputLabel}>Schedule</Text>
              <View style={chipRow}>
                {Object.values(scheduleMap).map((schedule: any) => (
                  <TouchableOpacity
                    key={schedule.id}
                    style={[
                      chip,
                      assignScheduleId === schedule.id && chipActive,
                    ]}
                    onPress={() => setAssignScheduleId(schedule.id)}
                  >
                    <Text
                      style={[
                        chipText,
                        assignScheduleId === schedule.id && chipTextActive,
                      ]}
                    >
                      {schedule.name || "Schedule"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity style={assignButton} onPress={handleAssignSchedule}>
            <Text style={assignButtonText}>Assign</Text>
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
                "Schedule",
                "Actions",
              ].map(label => (
                <Text key={label} style={tableHeaderText}>
                  {label}
                </Text>
              ))}
            </View>
            {filteredWorkers.map(worker => {
              const workerTotals = totals[worker.id] || { hours: 0, earnings: 0 };
              return (
                <View key={worker.id} style={tableRow}>
                  <View style={[tableCell, { flexDirection: "row", gap: 10 }]}>
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
                  <View style={tableCell}>
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
                    {worker.scheduleId ? (
                      <TouchableOpacity
                        style={scheduleChip}
                        onPress={() => {
                          const schedule = scheduleMap[worker.scheduleId];
                          if (schedule) {
                            setSelectedSchedule(schedule);
                            setShowScheduleModal(true);
                          }
                        }}
                      >
                        <Text style={scheduleChipText}>
                          {worker.scheduleName || "View schedule"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={tableCellMuted}>Not assigned</Text>
                    )}
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
                If you leave this empty, a worker profile will be created but it won’t
                auto-link to login until you set the UID.
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

      {showScheduleModal && selectedSchedule ? (
        <View style={overlay}>
          <View style={modal}>
            <View style={modalHeader}>
              <Text style={modalTitle}>Schedule Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowScheduleModal(false);
                  setSelectedSchedule(null);
                }}
                style={iconButton}
              >
                <X size={16} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={modalBody}>
              <Text style={inputLabel}>Schedule Name</Text>
              <Text style={valueText}>
                {selectedSchedule.name || "Schedule"}
              </Text>
              <Text style={inputLabel}>Working Days</Text>
              <Text style={valueText}>
                {Array.isArray(selectedSchedule.days)
                  ? selectedSchedule.days.join(", ")
                  : "-"}
              </Text>
              <Text style={inputLabel}>Time</Text>
              <Text style={valueText}>
                {selectedSchedule.startTime || "--:--"} -{" "}
                {selectedSchedule.endTime || "--:--"}
              </Text>
              <Text style={inputLabel}>Hourly Rate</Text>
              <Text style={valueText}>
                RM {Number(selectedSchedule.hourlyRate ?? 0).toFixed(2)}
              </Text>
              {selectedSchedule.description ? (
                <>
                  <Text style={inputLabel}>Description</Text>
                  <Text style={valueText}>{selectedSchedule.description}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const headerRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: 16,
};

const searchIcon = {
  position: "absolute" as const,
  left: 12,
  top: 12,
};

const searchInput = {
  borderWidth: 1,
  borderColor: adminPalette.border,
  borderRadius: 10,
  paddingVertical: 10,
  paddingLeft: 40,
  paddingRight: 12,
  backgroundColor: adminPalette.surface,
  color: adminPalette.text,
};

const addButton = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: adminPalette.brand,
};

const addButtonText = { color: "#fff", fontWeight: "600" as const, fontSize: 12 };

const emptyCard = {
  marginTop: 24,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 32,
  alignItems: "center" as const,
  borderWidth: 1,
  borderColor: adminPalette.border,
};

const emptyTitle = {
  color: adminPalette.text,
  fontWeight: "600" as const,
  marginTop: 12,
};
const emptySub = { color: adminPalette.textMuted, fontSize: 12, marginTop: 6 };

const tableCard = {
  marginTop: 24,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: adminPalette.border,
  overflow: "hidden" as const,
};

const tableHeader = {
  flexDirection: "row" as const,
  backgroundColor: adminPalette.surfaceAlt,
  paddingVertical: 12,
  paddingHorizontal: 16,
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
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: adminPalette.border,
  alignItems: "center" as const,
};

const tableCell = { flex: 1, color: adminPalette.text, fontSize: 12 };
const tableCellMuted = { flex: 1, color: adminPalette.textMuted, fontSize: 12 };

const avatar = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: adminPalette.infoSoft,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const avatarText = { color: adminPalette.accent, fontWeight: "600" as const };
const workerName = { color: adminPalette.text, fontSize: 12, fontWeight: "600" as const };
const workerEmail = { color: adminPalette.textMuted, fontSize: 10, marginTop: 2 };

const statusBadge = {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  fontSize: 11,
  overflow: "hidden" as const,
};

const statusActive = {
  backgroundColor: adminPalette.successSoft,
  color: adminPalette.success,
};

const statusInactive = {
  backgroundColor: adminPalette.surfaceAlt,
  color: adminPalette.textMuted,
};

const statusText = { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 };

const iconButton = {
  padding: 8,
  borderRadius: 10,
  backgroundColor: adminPalette.surfaceAlt,
};

const assignCard = {
  marginTop: 16,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: adminPalette.border,
  padding: 16,
};

const assignTitle = { color: adminPalette.text, fontWeight: "600", fontSize: 14 };
const assignSubtitle = { color: adminPalette.textMuted, fontSize: 12, marginTop: 4 };
const assignRow = { flexDirection: "row" as const, gap: 12, marginTop: 12 };
const chipRow = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginTop: 6 };
const chip = {
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: adminPalette.border,
  backgroundColor: adminPalette.surfaceAlt,
};
const chipActive = {
  borderColor: adminPalette.accent,
  backgroundColor: adminPalette.infoSoft,
};
const chipText = { color: adminPalette.textMuted, fontSize: 11 };
const chipTextActive = { color: adminPalette.accent, fontWeight: "600" as const };
const assignButton = {
  marginTop: 12,
  alignSelf: "flex-start" as const,
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 10,
  backgroundColor: adminPalette.brand,
};
const assignButtonText = { color: "#fff", fontSize: 12, fontWeight: "600" as const };

const scheduleChip = {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: adminPalette.infoSoft,
  borderWidth: 1,
  borderColor: adminPalette.accent,
};

const scheduleChipText = { color: adminPalette.accent, fontSize: 11 };

const overlay = {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(15, 23, 42, 0.55)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  padding: 20,
};

const modal = {
  width: "100%",
  maxWidth: 520,
  backgroundColor: adminPalette.surface,
  borderRadius: 16,
  padding: 20,
};

const modalHeader = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  marginBottom: 12,
};

const modalTitle = { color: adminPalette.text, fontWeight: "600" as const };

const modalBody = { gap: 10 };

const inputLabel = { color: adminPalette.textMuted, fontSize: 12 };
const inputHint = { color: adminPalette.textMuted, fontSize: 11 };

const input = {
  borderWidth: 1,
  borderColor: adminPalette.border,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: adminPalette.surfaceAlt,
  color: adminPalette.text,
};

const valueText = { color: adminPalette.text, fontSize: 12, fontWeight: "600" };

const modalActions = { flexDirection: "row" as const, gap: 12, marginTop: 16 };

const secondaryButton = {
  flex: 1,
  borderWidth: 1,
  borderColor: adminPalette.border,
  borderRadius: 10,
  paddingVertical: 10,
  alignItems: "center" as const,
  backgroundColor: adminPalette.surfaceAlt,
};

const secondaryButtonText = { color: adminPalette.text, fontWeight: "600" as const, fontSize: 12 };

const errorText = { color: adminPalette.danger, fontSize: 12 };
const deleteText = { color: adminPalette.textMuted, fontSize: 12, marginTop: 8 };
