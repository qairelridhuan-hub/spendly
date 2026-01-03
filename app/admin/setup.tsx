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
import { Clock, Edit, Plus, Trash2, X } from "lucide-react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";

type Schedule = {
  id: string;
  name: string;
  days: string[];
  startTime: string;
  endTime: string;
  hourlyRate: number;
  description?: string;
};

const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function AdminSetup() {
  const [workSchedules, setWorkSchedules] = useState<Schedule[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [shiftSortOrder, setShiftSortOrder] = useState<"latest" | "oldest">(
    "latest"
  );
  const [formError, setFormError] = useState("");
  const [workers, setWorkers] = useState<{ id: string; name: string; scheduleId?: string }[]>([]);
  const [workerMap, setWorkerMap] = useState<Record<string, { name: string; code?: string }>>({});
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [showShiftDelete, setShowShiftDelete] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    days: [] as string[],
    startTime: "09:00",
    endTime: "17:00",
    hourlyRate: "",
    description: "",
  });

  useEffect(() => {
    const schedulesQuery = query(
      collection(db, "workSchedules"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(schedulesQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.name || "",
          days: Array.isArray(data.days) ? data.days : [],
          startTime: data.startTime || "09:00",
          endTime: data.endTime || "17:00",
          hourlyRate: Number(data.hourlyRate ?? 0),
          description: data.description || "",
        } as Schedule;
      });
      setWorkSchedules(list);
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
          name: data.fullName || data.displayName || data.email || "Worker",
          scheduleId: data.scheduleId || "",
        };
      });
      setWorkers(list);
      const map: Record<string, { name: string; code?: string }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        map[docSnap.id] = {
          name: data.fullName || data.displayName || data.email || "Worker",
          code: data.workerCode || "",
        };
      });
      setWorkerMap(map);
    });
    const shiftsQuery = query(
      collection(db, "shifts"),
      orderBy("date", "desc")
    );
    const unsubShifts = onSnapshot(shiftsQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setShifts(list);
    });

    return () => {
      unsub();
      unsubWorkers();
      unsubShifts();
    };
  }, []);

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day],
    }));
  };

  const resetForm = () => {
    setFormError("");
    setFormData({
      name: "",
      days: [],
      startTime: "09:00",
      endTime: "17:00",
      hourlyRate: "",
      description: "",
    });
  };

  const validateForm = () => {
    if (!formData.name.trim()) return "Schedule name is required.";
    if (!formData.hourlyRate) return "Hourly rate is required.";
    if (formData.days.length === 0) return "Select at least one working day.";
    return "";
  };

  const handleAddSchedule = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    try {
      await addDoc(collection(db, "workSchedules"), {
        name: formData.name.trim(),
        days: formData.days,
        startTime: formData.startTime,
        endTime: formData.endTime,
        hourlyRate: Number(formData.hourlyRate),
        description: formData.description.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      resetForm();
      setShowAddModal(false);
    } catch {
      setFormError("Failed to add schedule.");
    }
  };

  const handleAssignSchedule = async (schedule: Schedule) => {
    setAssignStatus("");
    if (!selectedWorkerId) {
      setAssignStatus("Select a worker first.");
      return;
    }
    try {
      await setDoc(
        doc(db, "users", selectedWorkerId),
        {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setAssignStatus("Schedule assigned to worker.");
    } catch {
      setAssignStatus("Failed to assign schedule.");
    }
  };

  const handleEditSchedule = async () => {
    const error = validateForm();
    if (error || !selectedSchedule) {
      setFormError(error || "Select a schedule to edit.");
      return;
    }
    try {
      await updateDoc(doc(db, "workSchedules", selectedSchedule), {
        name: formData.name.trim(),
        days: formData.days,
        startTime: formData.startTime,
        endTime: formData.endTime,
        hourlyRate: Number(formData.hourlyRate),
        description: formData.description.trim(),
        updatedAt: serverTimestamp(),
      });
      resetForm();
      setShowEditModal(false);
      setSelectedSchedule(null);
    } catch {
      setFormError("Failed to update schedule.");
    }
  };

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    try {
      await deleteDoc(doc(db, "workSchedules", scheduleToDelete));
      setShowDeleteConfirm(false);
      setScheduleToDelete(null);
    } catch {
      setFormError("Failed to delete schedule.");
    }
  };

  const openEditModal = (scheduleId: string) => {
    const schedule = workSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    setFormData({
      name: schedule.name,
      days: schedule.days,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      hourlyRate: String(schedule.hourlyRate),
      description: schedule.description || "",
    });
    setSelectedSchedule(scheduleId);
    setFormError("");
    setShowEditModal(true);
  };

  const openDeleteConfirm = (scheduleId: string) => {
    setScheduleToDelete(scheduleId);
    setShowDeleteConfirm(true);
  };

  const openShiftDelete = (shiftId: string) => {
    setShiftToDelete(shiftId);
    setShowShiftDelete(true);
  };

  const handleDeleteShift = async () => {
    if (!shiftToDelete) return;
    try {
      await deleteDoc(doc(db, "shifts", shiftToDelete));
      setShowShiftDelete(false);
      setShiftToDelete(null);
    } catch {
      setAssignStatus("Failed to delete shift.");
    }
  };

  const calculateHours = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startMinutes = (startHour || 0) * 60 + (startMin || 0);
    const endMinutes = (endHour || 0) * 60 + (endMin || 0);
    return Math.max(0, (endMinutes - startMinutes) / 60).toFixed(1);
  };

  const estimatedEarnings = useMemo(() => {
    if (!formData.hourlyRate) return "";
    const hours = Number(calculateHours(formData.startTime, formData.endTime));
    const rate = Number(formData.hourlyRate);
    if (!Number.isFinite(hours) || !Number.isFinite(rate)) return "";
    return (hours * rate).toFixed(2);
  }, [formData]);


  const todayKey = new Date().toISOString().slice(0, 10);
  const resolveShiftStatus = (shift: any) => {
    const status = String(shift.status || "scheduled");
    if (status === "absent") return "absent";
    if (status === "completed") return "completed";
    if (shift.date && String(shift.date) < todayKey) return "completed";
    return "scheduled";
  };

  const resolveShiftStatusTextColor = (status: string) => {
    if (status === "completed") return adminPalette.success;
    if (status === "absent") return adminPalette.danger;
    return adminPalette.accent;
  };

  const toShiftTimestamp = (shift: any) => {
    const date = String(shift.date ?? "");
    const time = String(shift.start ?? "00:00");
    const timestamp = new Date(`${date}T${time}:00`).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
    return 0;
  };

  const sortShifts = (items: any[], order: "latest" | "oldest") => {
    const sorted = [...items].sort((a, b) => toShiftTimestamp(a) - toShiftTimestamp(b));
    return order === "latest" ? sorted.reverse() : sorted;
  };

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Work Schedule Setup</Text>
            <Text style={styles.subtitle}>
              Define work schedules and assign them to workers
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Add Schedule</Text>
          </TouchableOpacity>
        </View>

        {workSchedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Clock size={44} color={adminPalette.textMuted} />
            <Text style={styles.emptyTitle}>No Work Schedules</Text>
            <Text style={styles.emptyText}>
              Create your first work schedule to get started
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              <Plus size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Create First Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {workSchedules.map(schedule => {
              const hours = calculateHours(schedule.startTime, schedule.endTime);
              const dailyEarnings = (
                Number(hours) * schedule.hourlyRate
              ).toFixed(2);
              return (
                <View key={schedule.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{schedule.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {schedule.description || "No description"}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => openEditModal(schedule.id)}
                      >
                        <Edit size={16} color={adminPalette.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconButton, styles.dangerButton]}
                        onPress={() => openDeleteConfirm(schedule.id)}
                      >
                        <Trash2 size={16} color={adminPalette.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.label}>Time</Text>
                      <Text style={styles.value}>
                        {schedule.startTime} - {schedule.endTime}
                      </Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.label}>Hours/Day</Text>
                      <Text style={styles.value}>{hours}h</Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.label}>Hourly Rate</Text>
                      <Text style={styles.value}>
                        RM {schedule.hourlyRate.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.label}>Daily Earnings</Text>
                      <Text style={styles.value}>RM {dailyEarnings}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerLabel}>Working Days</Text>
                    <View style={styles.dayRow}>
                      {schedule.days.map(day => (
                        <View key={day} style={styles.dayChip}>
                          <Text style={styles.dayChipText}>
                            {day.slice(0, 3)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.assignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Assign to worker</Text>
                      <View style={styles.workerChips}>
                        {workers.length === 0 ? (
                          <Text style={styles.assignHint}>No workers yet</Text>
                        ) : (
                          workers.map(worker => (
                            <TouchableOpacity
                              key={worker.id}
                              onPress={() => setSelectedWorkerId(worker.id)}
                              style={[
                                styles.workerChip,
                                selectedWorkerId === worker.id &&
                                  styles.workerChipActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.workerChipText,
                                  selectedWorkerId === worker.id &&
                                    styles.workerChipTextActive,
                                ]}
                              >
                                {worker.name}
                              </Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => handleAssignSchedule(schedule)}
                    >
                      <Text style={styles.assignButtonText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {assignStatus ? (
          <Text style={styles.assignStatus}>{assignStatus}</Text>
        ) : null}

        <View style={styles.shiftSection}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Shifts</Text>
              <Text style={styles.subtitle}>Past and upcoming shifts</Text>
            </View>
            <View style={styles.sortControls}>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  shiftSortOrder === "latest" && styles.sortButtonActive,
                ]}
                onPress={() => setShiftSortOrder("latest")}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    shiftSortOrder === "latest" && styles.sortButtonTextActive,
                  ]}
                >
                  Latest First
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  shiftSortOrder === "oldest" && styles.sortButtonActive,
                ]}
                onPress={() => setShiftSortOrder("oldest")}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    shiftSortOrder === "oldest" && styles.sortButtonTextActive,
                  ]}
                >
                  Oldest First
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {shifts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No shifts yet</Text>
              <Text style={styles.emptyText}>
                Generate shifts to see them here.
              </Text>
            </View>
          ) : (
            <View style={styles.shiftList}>
              {sortShifts(shifts, shiftSortOrder).map(shift => {
                const resolvedStatus = resolveShiftStatus(shift);
                const workerInfo = workerMap[String(shift.workerId || "")];
                const workerLabel = workerInfo
                  ? `${workerInfo.name}${workerInfo.code ? ` (${workerInfo.code})` : ""}`
                  : String(shift.workerId || "Worker");
                return (
                <View
                  key={shift.id}
                  style={[
                    styles.shiftRow,
                    resolvedStatus === "completed" && styles.shiftRowCompleted,
                    resolvedStatus === "absent" && styles.shiftRowAbsent,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shiftTitle}>
                      {shift.date || "-"} • {shift.start || "--:--"} - {shift.end || "--:--"}
                    </Text>
                    <Text style={styles.shiftMeta}>
                      {workerLabel} •{" "}
                      <Text style={{ color: resolveShiftStatusTextColor(resolvedStatus) }}>
                        {resolvedStatus}
                      </Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.shiftStatusPill,
                      resolvedStatus === "completed" && styles.shiftStatusCompleted,
                      resolvedStatus === "absent" && styles.shiftStatusAbsent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.shiftStatusText,
                        { color: resolveShiftStatusTextColor(resolvedStatus) },
                      ]}
                    >
                      {resolvedStatus}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.iconButton, styles.dangerButton]}
                    onPress={() => openShiftDelete(shift.id)}
                  >
                    <Trash2 size={16} color={adminPalette.danger} />
                  </TouchableOpacity>
                </View>
              )})}
            </View>
          )}
        </View>
      </ScrollView>

      {showAddModal ? (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Work Schedule</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                style={styles.iconButton}
              >
                <X size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.inputLabel}>Schedule Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={value => setFormData(prev => ({ ...prev, name: value }))}
                placeholder="e.g., Morning Shift"
                placeholderTextColor={adminPalette.textMuted}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                value={formData.description}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, description: value }))
                }
                placeholder="Optional description"
                placeholderTextColor={adminPalette.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
              />

              <Text style={styles.inputLabel}>Working Days *</Text>
              <View style={styles.dayGrid}>
                {dayOptions.map(day => {
                  const active = formData.days.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[
                        styles.dayButton,
                        active && styles.dayButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          active && styles.dayButtonTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time *</Text>
                  <TextInput
                    value={formData.startTime}
                    onChangeText={value =>
                      setFormData(prev => ({ ...prev, startTime: value }))
                    }
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time *</Text>
                  <TextInput
                    value={formData.endTime}
                    onChangeText={value =>
                      setFormData(prev => ({ ...prev, endTime: value }))
                    }
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Hourly Rate (RM) *</Text>
              <TextInput
                value={formData.hourlyRate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, hourlyRate: value }))
                }
                placeholder="10.00"
                keyboardType="numeric"
                placeholderTextColor={adminPalette.textMuted}
                style={styles.input}
              />

              {estimatedEarnings ? (
                <View style={styles.estimateCard}>
                  <Text style={styles.estimateLabel}>Estimated Earnings</Text>
                  <Text style={styles.estimateValue}>
                    RM {estimatedEarnings} / day
                  </Text>
                  <Text style={styles.estimateHint}>
                    {calculateHours(formData.startTime, formData.endTime)} hours per
                    day
                  </Text>
                </View>
              ) : null}

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddSchedule}>
                <Text style={styles.primaryButtonText}>Add Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showEditModal ? (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Work Schedule</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedSchedule(null);
                  resetForm();
                }}
                style={styles.iconButton}
              >
                <X size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.inputLabel}>Schedule Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={value => setFormData(prev => ({ ...prev, name: value }))}
                placeholder="e.g., Morning Shift"
                placeholderTextColor={adminPalette.textMuted}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                value={formData.description}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, description: value }))
                }
                placeholder="Optional description"
                placeholderTextColor={adminPalette.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
              />

              <Text style={styles.inputLabel}>Working Days *</Text>
              <View style={styles.dayGrid}>
                {dayOptions.map(day => {
                  const active = formData.days.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[
                        styles.dayButton,
                        active && styles.dayButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          active && styles.dayButtonTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time *</Text>
                  <TextInput
                    value={formData.startTime}
                    onChangeText={value =>
                      setFormData(prev => ({ ...prev, startTime: value }))
                    }
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time *</Text>
                  <TextInput
                    value={formData.endTime}
                    onChangeText={value =>
                      setFormData(prev => ({ ...prev, endTime: value }))
                    }
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Hourly Rate (RM) *</Text>
              <TextInput
                value={formData.hourlyRate}
                onChangeText={value =>
                  setFormData(prev => ({ ...prev, hourlyRate: value }))
                }
                placeholder="10.00"
                keyboardType="numeric"
                placeholderTextColor={adminPalette.textMuted}
                style={styles.input}
              />

              {estimatedEarnings ? (
                <View style={styles.estimateCard}>
                  <Text style={styles.estimateLabel}>Estimated Earnings</Text>
                  <Text style={styles.estimateValue}>
                    RM {estimatedEarnings} / day
                  </Text>
                  <Text style={styles.estimateHint}>
                    {calculateHours(formData.startTime, formData.endTime)} hours per
                    day
                  </Text>
                </View>
              ) : null}

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedSchedule(null);
                  resetForm();
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleEditSchedule}
              >
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showDeleteConfirm ? (
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.deleteModal]}>
            <Text style={styles.modalTitle}>Delete Schedule</Text>
            <Text style={styles.deleteText}>
              Are you sure you want to delete this schedule? This will also remove
              all related shifts.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setScheduleToDelete(null);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerPrimary]}
                onPress={handleDeleteSchedule}
              >
                <Text style={styles.primaryButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showShiftDelete ? (
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.deleteModal]}>
            <Text style={styles.modalTitle}>Delete Shift</Text>
            <Text style={styles.deleteText}>
              Are you sure you want to delete this shift?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowShiftDelete(false);
                  setShiftToDelete(null);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.dangerPrimary]}
                onPress={handleDeleteShift}
              >
                <Text style={styles.primaryButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 80 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  title: { color: adminPalette.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: adminPalette.textMuted, marginTop: 4, fontSize: 12 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: adminPalette.brand,
  },
  primaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptyCard: {
    marginTop: 24,
    backgroundColor: adminPalette.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: adminPalette.border,
    gap: 10,
  },
  emptyTitle: { color: adminPalette.text, fontWeight: "600", fontSize: 16 },
  emptyText: {
    color: adminPalette.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  grid: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    backgroundColor: adminPalette.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: adminPalette.border,
    width: 300,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: { color: adminPalette.text, fontWeight: "600", fontSize: 14 },
  cardSubtitle: { color: adminPalette.textMuted, fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: adminPalette.surfaceAlt,
  },
  dangerButton: { backgroundColor: adminPalette.dangerSoft },
  cardBody: { gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  label: { color: adminPalette.textMuted, fontSize: 12 },
  value: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: adminPalette.border,
  },
  footerLabel: { color: adminPalette.textMuted, fontSize: 11, marginBottom: 8 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: adminPalette.infoSoft,
  },
  dayChipText: { color: adminPalette.accent, fontSize: 10, fontWeight: "600" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: adminPalette.surface,
    borderRadius: 16,
    padding: 20,
  },
  deleteModal: { maxWidth: 420 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { color: adminPalette.text, fontWeight: "600", fontSize: 16 },
  modalContent: { gap: 12 },
  inputLabel: { color: adminPalette.textMuted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: adminPalette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: adminPalette.surfaceAlt,
    color: adminPalette.text,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surface,
  },
  dayButtonActive: {
    backgroundColor: adminPalette.brand,
    borderColor: adminPalette.brand,
  },
  dayButtonText: { color: adminPalette.text, fontSize: 12 },
  dayButtonTextActive: { color: "#fff", fontWeight: "600" },
  rowGap: { flexDirection: "row", gap: 12 },
  estimateCard: {
    backgroundColor: adminPalette.infoSoft,
    borderRadius: 12,
    padding: 12,
  },
  estimateLabel: { color: adminPalette.textMuted, fontSize: 12 },
  estimateValue: {
    color: adminPalette.accent,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  estimateHint: { color: adminPalette.textMuted, fontSize: 11, marginTop: 4 },
  errorText: { color: adminPalette.danger, fontSize: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: adminPalette.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: adminPalette.surfaceAlt,
  },
  secondaryButtonText: { color: adminPalette.text, fontWeight: "600", fontSize: 12 },
  dangerPrimary: { backgroundColor: adminPalette.danger },
  deleteText: { color: adminPalette.textMuted, fontSize: 12, marginTop: 8 },
  assignRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: adminPalette.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  workerChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  workerChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: adminPalette.surfaceAlt,
    borderWidth: 1,
    borderColor: adminPalette.border,
  },
  workerChipActive: {
    backgroundColor: adminPalette.infoSoft,
    borderColor: adminPalette.accent,
  },
  workerChipText: { color: adminPalette.textMuted, fontSize: 10 },
  workerChipTextActive: { color: adminPalette.accent, fontWeight: "600" },
  assignButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: adminPalette.brand,
  },
  assignButtonText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  assignHint: { color: adminPalette.textMuted, fontSize: 11 },
  assignStatus: { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 },
  shiftSection: { marginTop: 24 },
  sectionTitle: { color: adminPalette.text, fontWeight: "700", fontSize: 16 },
  shiftList: {
    marginTop: 12,
    gap: 10,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surface,
  },
  shiftRowCompleted: {
    borderColor: adminPalette.success,
    backgroundColor: adminPalette.successSoft,
  },
  shiftRowAbsent: {
    borderColor: adminPalette.danger,
    backgroundColor: adminPalette.dangerSoft,
  },
  shiftTitle: { color: adminPalette.text, fontWeight: "600", fontSize: 12 },
  shiftMeta: { color: adminPalette.textMuted, fontSize: 11, marginTop: 4 },
  shiftStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: adminPalette.infoSoft,
    marginRight: 8,
  },
  shiftStatusCompleted: { backgroundColor: adminPalette.successSoft },
  shiftStatusAbsent: { backgroundColor: adminPalette.dangerSoft },
  shiftStatusText: { color: adminPalette.text, fontSize: 10, fontWeight: "700" },
});
