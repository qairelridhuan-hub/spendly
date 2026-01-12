import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronDown, Clock, Edit, Plus, Trash2, X } from "lucide-react-native";
import {
  addDoc,
  collection,
  collectionGroup,
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
import { useAdminTheme } from "@/lib/admin/theme";
import type { AdminPalette } from "@/lib/admin/palette";

type Schedule = {
  id: string;
  name: string;
  days: string[];
  startTime: string;
  endTime: string;
  hourlyRate: number;
  description?: string;
  location?: string;
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

const padDatePart = (value: number) => String(value).padStart(2, "0");
const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;

const baseRoleOptions = [
  "Cashier",
  "Barista",
  "Server",
  "Kitchen Staff",
  "Cleaner",
  "Supervisor",
];

const baseLocationOptions = [
  "Main Branch",
  "Cafe A",
  "Cafe B",
  "Kiosk 1",
  "Kiosk 2",
];

export default function AdminSetup() {
  const { colors: adminPalette } = useAdminTheme();
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
  const [workers, setWorkers] = useState<
    { id: string; name: string; scheduleId?: string; position?: string; location?: string }[]
  >([]);
  const [workerMap, setWorkerMap] = useState<Record<string, { name: string; code?: string }>>({});
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [assignStatus, setAssignStatus] = useState("");
  const [shiftAssignStatus, setShiftAssignStatus] = useState("");
  const [shiftFormError, setShiftFormError] = useState("");
  const [showShiftAssign, setShowShiftAssign] = useState(false);
  const [showShiftDatePicker, setShowShiftDatePicker] = useState(false);
  const [draftShiftDate, setDraftShiftDate] = useState(new Date());
  const [shiftDateConfirmed, setShiftDateConfirmed] = useState(false);
  const [shiftWorkerIds, setShiftWorkerIds] = useState<string[]>([]);
  const [activeRoleMenuWorkerId, setActiveRoleMenuWorkerId] = useState<string | null>(
    null
  );
  const [activeLocationMenuWorkerId, setActiveLocationMenuWorkerId] = useState<
    string | null
  >(null);
  const [showStartTimeMenu, setShowStartTimeMenu] = useState(false);
  const [showEndTimeMenu, setShowEndTimeMenu] = useState(false);
  const [configRoles, setConfigRoles] = useState<string[]>([]);
  const [configLocations, setConfigLocations] = useState<string[]>([]);
  const [shiftForm, setShiftForm] = useState({
    date: "",
    start: "09:00",
    end: "17:00",
  });
  const [shiftAssignments, setShiftAssignments] = useState<
    Record<string, { role: string; location: string }>
  >({});
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [showShiftDelete, setShowShiftDelete] = useState(false);
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});

  const [formData, setFormData] = useState({
    name: "",
    days: [] as string[],
    startTime: "09:00",
    endTime: "17:00",
    hourlyRate: "",
    description: "",
  });
  const styles = useMemo(() => createStyles(adminPalette), [adminPalette]);

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
          location: data.location || "",
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
          position: data.position || "",
          location: data.location || "",
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
    const unsubAttendance = onSnapshot(
      collectionGroup(db, "attendance"),
      snapshot => {
        const map: Record<string, any> = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as any;
          const workerId = String(data.workerId || getAttendanceOwnerId(docSnap) || "");
          const date = String(data.date || "");
          if (!workerId || !date) return;
          map[`${workerId}:${date}`] = data;
        });
        setAttendanceMap(map);
      }
    );
    const configRef = doc(db, "config", "system");
    const unsubConfig = onSnapshot(configRef, snap => {
      const data = snap.data() as any;
      setConfigRoles(Array.isArray(data?.roles) ? data.roles.map(String) : []);
      setConfigLocations(
        Array.isArray(data?.locations) ? data.locations.map(String) : []
      );
    });

    return () => {
      unsub();
      unsubWorkers();
      unsubShifts();
      unsubAttendance();
      unsubConfig();
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

  const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  };
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const validateForm = () => {
    if (!formData.name.trim()) return "Schedule name is required.";
    const hourlyRate = Number(formData.hourlyRate);
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      return "Hourly rate must be greater than 0.";
    }
    if (formData.days.length === 0) return "Select at least one working day.";
    if (!isValidTime(formData.startTime) || !isValidTime(formData.endTime)) {
      return "Start and end time must be in HH:MM format.";
    }
    if (toMinutes(formData.startTime) >= toMinutes(formData.endTime)) {
      return "End time must be after start time.";
    }
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
    if (!selectedWorkerIds.length) {
      setAssignStatus("Select at least one worker.");
      return;
    }
    try {
      await Promise.all(
        selectedWorkerIds.map(workerId =>
          setDoc(
            doc(db, "users", workerId),
            {
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );
      setAssignStatus(
        `Schedule assigned to ${selectedWorkerIds.length} worker(s).`
      );
    } catch {
      setAssignStatus("Failed to assign schedule.");
    }
  };

  const getWorkerSchedule = (workerId: string) => {
    const worker = workers.find(item => item.id === workerId);
    if (!worker?.scheduleId) return null;
    return workSchedules.find(item => item.id === worker.scheduleId) || null;
  };

  const toggleScheduleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const selectShiftWorker = (workerId: string) => {
    setShiftWorkerIds(prev => {
      const exists = prev.includes(workerId);
      const next = exists ? prev.filter(id => id !== workerId) : [...prev, workerId];
      const nextSelected = next.length === 1 ? next[0] : null;
      if (nextSelected) {
        const schedule = getWorkerSchedule(nextSelected);
        if (schedule) {
          setShiftForm(form => ({
            ...form,
            start: schedule.startTime || form.start,
            end: schedule.endTime || form.end,
          }));
        }
      }
      return next;
    });
    setShiftAssignStatus("");
    setShiftFormError("");
    setShiftAssignments(prev => {
      const next = { ...prev };
      if (next[workerId]) {
        delete next[workerId];
      } else {
        next[workerId] = { role: "", location: "" };
      }
      return next;
    });
  };

  const handleAssignShift = async () => {
    setShiftAssignStatus("");
    setShiftFormError("");
    const error = validateShiftForm();
    if (error) {
      setShiftFormError(error);
      return;
    }
    const duplicate = shifts.some(shift => {
      if (!shiftWorkerIds.includes(String(shift.workerId ?? ""))) return false;
      return (
        String(shift.date ?? "") === shiftForm.date &&
        String(shift.start ?? "") === shiftForm.start &&
        String(shift.end ?? "") === shiftForm.end
      );
    });
    if (duplicate) {
      setShiftFormError("Shift already exists for one or more selected workers.");
      return;
    }
    const hours = Number(calculateHours(shiftForm.start, shiftForm.end));
    try {
      await Promise.all(
        shiftWorkerIds.map(workerId => {
          const assignment = shiftAssignments[workerId];
          const schedule = getWorkerSchedule(workerId);
          const payload: Record<string, any> = {
            workerId,
            date: shiftForm.date,
            start: shiftForm.start,
            end: shiftForm.end,
            hours: Number.isFinite(hours) ? hours : 0,
            type: "normal",
            status: "scheduled",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (assignment?.role) payload.role = assignment.role;
          if (assignment?.location) payload.location = assignment.location;
          if (schedule) {
            payload.scheduleId = schedule.id;
            payload.scheduleName = schedule.name;
          }
          return addDoc(collection(db, "shifts"), payload);
        })
      );
      setShiftAssignStatus(
        `Shift assigned to ${shiftWorkerIds.length} worker(s).`
      );
    } catch {
      setShiftFormError("Failed to assign shift.");
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

  const openShiftDetails = (shift: any) => {
    setActiveShift(shift);
    setShowShiftDetails(true);
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

  const shiftSchedule = useMemo(() => {
    if (shiftWorkerIds.length !== 1) return null;
    return getWorkerSchedule(shiftWorkerIds[0]);
  }, [shiftWorkerIds, workers, workSchedules]);

  const validateShiftForm = () => {
    if (!shiftWorkerIds.length) return "Select at least one worker.";
    if (!shiftDateConfirmed || !isValidDate(shiftForm.date)) {
      return "Confirm a shift date.";
    }
    if (!isValidTime(shiftForm.start) || !isValidTime(shiftForm.end)) {
      return "Start and end time must be in HH:MM format.";
    }
    if (toMinutes(shiftForm.start) >= toMinutes(shiftForm.end)) {
      return "End time must be after start time.";
    }
    const missingRole = shiftWorkerIds.find(
      workerId => !shiftAssignments[workerId]?.role?.trim()
    );
    if (missingRole) return "Select a role for each worker.";
    const missingLocation = shiftWorkerIds.find(
      workerId => !shiftAssignments[workerId]?.location?.trim()
    );
    if (missingLocation) return "Select a location for each worker.";
    return "";
  };

  const canAssignShift = useMemo(
    () => !validateShiftForm(),
    [shiftAssignments, shiftDateConfirmed, shiftForm, shiftWorkerIds]
  );

  const canEditTime = useMemo(
    () => shiftDateConfirmed && isValidDate(shiftForm.date),
    [shiftDateConfirmed, shiftForm.date]
  );

  const canEditRoleLocation = useMemo(() => {
    if (!canEditTime) return false;
    if (!isValidTime(shiftForm.start) || !isValidTime(shiftForm.end)) return false;
    return toMinutes(shiftForm.start) < toMinutes(shiftForm.end);
  }, [canEditTime, shiftForm.end, shiftForm.start]);

  const roleOptions = useMemo(() => {
    if (!shiftWorkerIds.length) return [];
    const options = new Set<string>();
    baseRoleOptions.forEach(role => options.add(role));
    shiftWorkerIds.forEach(workerId => {
      const worker = workers.find(item => item.id === workerId);
      const position = String(worker?.position ?? "").trim();
      if (position) options.add(position);
      const schedule = getWorkerSchedule(workerId);
      const scheduleName = String(schedule?.name ?? "").trim();
      if (scheduleName) options.add(scheduleName);
    });
    shifts.forEach(shift => {
      if (!shiftWorkerIds.includes(String(shift.workerId ?? ""))) return;
      const role = String(shift.role ?? "").trim();
      if (role) options.add(role);
    });
    configRoles.forEach(role => {
      const value = String(role ?? "").trim();
      if (value) options.add(value);
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [configRoles, shiftWorkerIds, shifts, workers, workSchedules]);

  const locationOptions = useMemo(() => {
    if (!shiftWorkerIds.length) return [];
    const options = new Set<string>();
    baseLocationOptions.forEach(location => options.add(location));
    shiftWorkerIds.forEach(workerId => {
      const worker = workers.find(item => item.id === workerId);
      const location = String(worker?.location ?? "").trim();
      if (location) options.add(location);
      const schedule = getWorkerSchedule(workerId) as any;
      const scheduleLocation = String(schedule?.location ?? "").trim();
      if (scheduleLocation) options.add(scheduleLocation);
    });
    shifts.forEach(shift => {
      if (!shiftWorkerIds.includes(String(shift.workerId ?? ""))) return;
      const location = String(shift.location ?? "").trim();
      if (location) options.add(location);
    });
    configLocations.forEach(location => {
      const value = String(location ?? "").trim();
      if (value) options.add(value);
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [configLocations, shiftWorkerIds, shifts, workers, workSchedules]);


  const todayKey = new Date().toISOString().slice(0, 10);
  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const monthEnd = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }, []);

  const calendarDays = useMemo(() => {
    const daysInMonth = monthEnd.getDate();
    const firstDay = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      1
    ).getDay();
    const slots: Array<number | null> = [];
    for (let i = 0; i < firstDay; i += 1) slots.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) slots.push(day);
    return slots;
  }, [monthEnd, monthStart]);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 30) {
        const h = String(hour).padStart(2, "0");
        const m = String(minute).padStart(2, "0");
        options.push(`${h}:${m}`);
      }
    }
    return options;
  }, []);
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

  const shiftSummary = useMemo(() => {
    const pastDates = new Set<string>();
    const currentDates = new Set<string>();
    const completedDates = new Set<string>();
    shifts.forEach(shift => {
      const date = String(shift.date ?? "");
      if (!date) return;
      const status = resolveShiftStatus(shift);
      if (status === "completed") completedDates.add(date);
      if (date === todayKey) currentDates.add(date);
      if (date < todayKey) pastDates.add(date);
    });
    return {
      pastCount: pastDates.size,
      currentCount: currentDates.size,
      completedCount: completedDates.size,
    };
  }, [shifts, todayKey]);

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
              setShowShiftAssign(prev => !prev);
            }}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Add Schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          {[
            { label: "Past shifts", value: shiftSummary.pastCount },
            { label: "Current shifts", value: shiftSummary.currentCount },
            { label: "Completed shifts", value: shiftSummary.completedCount },
          ].map(item => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {assignStatus ? (
          <Text style={styles.assignStatus}>{assignStatus}</Text>
        ) : null}

        {showShiftAssign ? (
          <View style={[styles.card, styles.shiftAssignCard]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>Assign Shift Date</Text>
                <Text style={styles.subtitle}>
                  Choose worker(s) and date for a shift.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.assignButton, !canAssignShift && styles.assignButtonDisabled]}
                onPress={handleAssignShift}
                disabled={!canAssignShift}
              >
                <Text style={styles.assignButtonText}>Assign Shift</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12, gap: 12 }}>
              <View>
                <Text style={styles.inputLabel}>Workers *</Text>
                <View style={styles.workerChips}>
                  {workers.length === 0 ? (
                    <Text style={styles.assignHint}>No workers yet</Text>
                  ) : (
                    workers.map(worker => (
                      <TouchableOpacity
                        key={worker.id}
                        onPress={() => selectShiftWorker(worker.id)}
                        style={[
                          styles.workerChip,
                          shiftWorkerIds.includes(worker.id) &&
                            styles.workerChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.workerChipText,
                            shiftWorkerIds.includes(worker.id) &&
                              styles.workerChipTextActive,
                          ]}
                        >
                          {worker.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                {shiftWorkerIds.length === 1 ? (
                  shiftSchedule ? (
                    <Text style={styles.assignHint}>
                      Using {shiftSchedule.name} ({shiftSchedule.startTime}-
                      {shiftSchedule.endTime})
                    </Text>
                  ) : (
                    <Text style={styles.assignHint}>
                      No schedule assigned. Set time manually.
                    </Text>
                  )
                ) : null}
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Shift Date *</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => {
                      const parsed = isValidDate(shiftForm.date)
                        ? new Date(`${shiftForm.date}T00:00:00`)
                        : new Date();
                      setDraftShiftDate(parsed);
                      setShowShiftDatePicker(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.inputText,
                        !shiftDateConfirmed && styles.inputPlaceholderText,
                      ]}
                    >
                      {shiftDateConfirmed ? shiftForm.date : "Select date"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time *</Text>
                  <View style={styles.dropdownWrap}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownButton,
                        !canEditTime && styles.dropdownButtonDisabled,
                      ]}
                      onPress={() => {
                        if (!canEditTime) return;
                        setShowStartTimeMenu(true);
                        setShowEndTimeMenu(false);
                        setActiveRoleMenuWorkerId(null);
                        setActiveLocationMenuWorkerId(null);
                      }}
                      disabled={!canEditTime}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !shiftForm.start && styles.dropdownPlaceholder,
                        ]}
                      >
                        {shiftForm.start || "Select time"}
                      </Text>
                      <ChevronDown size={14} color={adminPalette.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Time *</Text>
                  <View style={styles.dropdownWrap}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownButton,
                        !canEditTime && styles.dropdownButtonDisabled,
                      ]}
                      onPress={() => {
                        if (!canEditTime) return;
                        setShowEndTimeMenu(true);
                        setShowStartTimeMenu(false);
                        setActiveRoleMenuWorkerId(null);
                        setActiveLocationMenuWorkerId(null);
                      }}
                      disabled={!canEditTime}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !shiftForm.end && styles.dropdownPlaceholder,
                        ]}
                      >
                        {shiftForm.end || "Select time"}
                      </Text>
                      <ChevronDown size={14} color={adminPalette.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>Role & Location *</Text>
                {shiftWorkerIds.length === 0 ? (
                  <Text style={styles.assignHint}>Select workers first.</Text>
                ) : (
                  shiftWorkerIds.map(workerId => {
                    const worker = workers.find(item => item.id === workerId);
                    const assignment = shiftAssignments[workerId] || {
                      role: "",
                      location: "",
                    };
                    return (
                      <View key={workerId} style={styles.assignmentRow}>
                        <Text style={styles.assignmentName}>
                          {worker?.name || workerId}
                        </Text>
                        <View style={styles.rowGap}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.dropdownWrap}>
                              <TouchableOpacity
                                style={[
                                  styles.dropdownButton,
                                  !canEditRoleLocation && styles.dropdownButtonDisabled,
                                ]}
                                onPress={() => {
                                  if (!canEditRoleLocation) return;
                                  setActiveRoleMenuWorkerId(workerId);
                                  setActiveLocationMenuWorkerId(null);
                                }}
                                disabled={!canEditRoleLocation}
                              >
                                <Text
                                  style={[
                                    styles.dropdownText,
                                    !assignment.role && styles.dropdownPlaceholder,
                                  ]}
                                >
                                  {assignment.role || "Select role"}
                                </Text>
                                <ChevronDown size={14} color={adminPalette.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.dropdownWrap}>
                              <TouchableOpacity
                                style={[
                                  styles.dropdownButton,
                                  !canEditRoleLocation && styles.dropdownButtonDisabled,
                                ]}
                                onPress={() => {
                                  if (!canEditRoleLocation) return;
                                  setActiveLocationMenuWorkerId(workerId);
                                  setActiveRoleMenuWorkerId(null);
                                }}
                                disabled={!canEditRoleLocation}
                              >
                                <Text
                                  style={[
                                    styles.dropdownText,
                                    !assignment.location && styles.dropdownPlaceholder,
                                  ]}
                                >
                                  {assignment.location || "Select location"}
                                </Text>
                                <ChevronDown size={14} color={adminPalette.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {shiftFormError ? (
                <Text style={styles.errorText}>{shiftFormError}</Text>
              ) : null}
              {shiftAssignStatus ? (
                <Text style={styles.assignStatus}>{shiftAssignStatus}</Text>
              ) : null}
            </View>
          </View>
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
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => openShiftDetails(shift)}
                  >
                    <Text style={styles.viewButtonText}>View details</Text>
                  </TouchableOpacity>
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

      <Modal
        visible={showShiftDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShiftDatePicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dateModal}>
            <Text style={styles.modalTitle}>Select shift date</Text>
            <Text style={styles.calendarTitle}>
              {draftShiftDate.toLocaleString("en-US", { month: "long" })}{" "}
              {draftShiftDate.getFullYear()}
            </Text>
            <View style={styles.calendarWeekRow}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(label => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarCellEmpty} />;
                }
                const dateValue = new Date(
                  monthStart.getFullYear(),
                  monthStart.getMonth(),
                  day
                );
                const isSelected = formatLocalDate(dateValue) === formatLocalDate(draftShiftDate);
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.calendarCell,
                      isSelected && styles.calendarCellSelected,
                    ]}
                    onPress={() => setDraftShiftDate(dateValue)}
                  >
                    <Text
                      style={[
                        styles.calendarCellText,
                        isSelected && styles.calendarCellTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowShiftDatePicker(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  const formatted = formatLocalDate(draftShiftDate);
                  setShiftForm(prev => ({ ...prev, date: formatted }));
                  setShiftDateConfirmed(true);
                  setShowShiftDatePicker(false);
                }}
              >
                <Text style={styles.primaryButtonText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showStartTimeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartTimeMenu(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>Select start time</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {timeOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setShiftForm(prev => ({ ...prev, start: option }));
                    setShowStartTimeMenu(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowStartTimeMenu(false)}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEndTimeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndTimeMenu(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>Select end time</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {timeOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setShiftForm(prev => ({ ...prev, end: option }));
                    setShowEndTimeMenu(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowEndTimeMenu(false)}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeRoleMenuWorkerId}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveRoleMenuWorkerId(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>Select role</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {roleOptions.length === 0 ? (
                <Text style={styles.dropdownEmptyText}>No roles found</Text>
              ) : (
                roleOptions.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (!activeRoleMenuWorkerId) return;
                      setShiftAssignments(prev => ({
                        ...prev,
                        [activeRoleMenuWorkerId]: {
                          ...prev[activeRoleMenuWorkerId],
                          role: option,
                        },
                      }));
                      setActiveRoleMenuWorkerId(null);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setActiveRoleMenuWorkerId(null)}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!activeLocationMenuWorkerId}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveLocationMenuWorkerId(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>Select location</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {locationOptions.length === 0 ? (
                <Text style={styles.dropdownEmptyText}>No locations found</Text>
              ) : (
                locationOptions.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (!activeLocationMenuWorkerId) return;
                      setShiftAssignments(prev => ({
                        ...prev,
                        [activeLocationMenuWorkerId]: {
                          ...prev[activeLocationMenuWorkerId],
                          location: option,
                        },
                      }));
                      setActiveLocationMenuWorkerId(null);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setActiveLocationMenuWorkerId(null)}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {showShiftDetails && activeShift ? (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shift Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowShiftDetails(false);
                  setActiveShift(null);
                }}
                style={styles.iconButton}
              >
                <X size={18} color={adminPalette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              {(() => {
                const attendance =
                  attendanceMap[`${String(activeShift.workerId || "")}:${String(
                    activeShift.date || ""
                  )}`] || null;
                return attendance ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.detailSectionTitle}>Attendance</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Clock in</Text>
                      <Text style={styles.detailValue}>
                        {attendance.clockIn || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Clock out</Text>
                      <Text style={styles.detailValue}>
                        {attendance.clockOut || "--:--"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Break</Text>
                      <Text style={styles.detailValue}>
                        {attendance.breakStart
                          ? attendance.breakEnd
                            ? `${attendance.breakStart}-${attendance.breakEnd}`
                            : `${attendance.breakStart}-...`
                          : attendance.breakMinutes
                          ? `${attendance.breakMinutes} min`
                          : "--"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Net hours</Text>
                      <Text style={styles.detailValue}>
                        {Number(attendance.netHours ?? attendance.hours ?? 0).toFixed(1)}h
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Final pay</Text>
                      <Text style={styles.detailValue}>
                        RM {Number(attendance.finalPay ?? 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ) : null;
              })()}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{activeShift.date || "-"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>
                  {activeShift.start || "--:--"} - {activeShift.end || "--:--"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Worker</Text>
                <Text style={styles.detailValue}>
                  {workerMap[String(activeShift.workerId || "")]?.name ||
                    activeShift.workerId ||
                    "Worker"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>
                  {resolveShiftStatus(activeShift)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hours</Text>
                <Text style={styles.detailValue}>
                  {activeShift.hours ||
                    calculateHours(activeShift.start || "", activeShift.end || "")}
                  h
                </Text>
              </View>
              {activeShift.role ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>{activeShift.role}</Text>
                </View>
              ) : null}
              {activeShift.location ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{activeShift.location}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}


const createStyles = (adminPalette: AdminPalette) => StyleSheet.create({
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
  summaryRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    minWidth: 160,
    flex: 1,
    backgroundColor: adminPalette.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: adminPalette.border,
  },
  summaryLabel: { color: adminPalette.textMuted, fontSize: 12 },
  summaryValue: { color: adminPalette.text, fontSize: 18, fontWeight: "700" },
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
  dateModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: adminPalette.surface,
    borderRadius: 16,
    padding: 20,
  },
  dropdownModal: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: adminPalette.surface,
    borderRadius: 16,
    padding: 16,
  },
  calendarTitle: {
    color: adminPalette.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calendarWeekLabel: { width: 36, textAlign: "center", color: adminPalette.textMuted, fontSize: 11 },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  calendarCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: adminPalette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: adminPalette.surfaceAlt,
  },
  calendarCellEmpty: { width: 36, height: 36 },
  calendarCellSelected: {
    backgroundColor: adminPalette.brand,
    borderColor: adminPalette.brand,
  },
  calendarCellText: { color: adminPalette.text, fontSize: 12 },
  calendarCellTextSelected: { color: "#fff", fontWeight: "700" },
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
  inputText: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
  inputPlaceholderText: { color: adminPalette.textMuted, fontWeight: "500" },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: adminPalette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: adminPalette.surfaceAlt,
  },
  dropdownButtonDisabled: {
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surfaceAlt,
    opacity: 0.6,
  },
  dropdownText: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
  dropdownPlaceholder: { color: adminPalette.textMuted, fontWeight: "500" },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownItemText: { color: adminPalette.text, fontSize: 12 },
  dropdownEmptyText: {
    color: adminPalette.textMuted,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  assignmentRow: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surface,
    gap: 8,
  },
  assignmentName: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
  dropdownWrap: { position: "relative" as const, zIndex: 1 },
  dateButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  dateButtonText: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
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
  assignButtonDisabled: {
    backgroundColor: adminPalette.border,
  },
  assignButtonText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  assignHint: { color: adminPalette.textMuted, fontSize: 11 },
  assignStatus: { color: adminPalette.textMuted, fontSize: 12, marginTop: 12 },
  shiftSection: { marginTop: 24 },
  shiftAssignCard: {
    width: "100%",
    marginTop: 16,
  },
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
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surface,
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
  viewButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: adminPalette.border,
    backgroundColor: adminPalette.surfaceAlt,
  },
  viewButtonText: { color: adminPalette.textMuted, fontSize: 11, fontWeight: "600" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailLabel: { color: adminPalette.textMuted, fontSize: 12 },
  detailValue: { color: adminPalette.text, fontSize: 12, fontWeight: "600" },
  detailSectionTitle: {
    color: adminPalette.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
});

const getAttendanceOwnerId = (docSnap: any) => {
  return docSnap.ref?.parent?.parent?.id || docSnap.data()?.workerId || "";
};
