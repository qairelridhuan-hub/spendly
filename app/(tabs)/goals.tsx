import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  LogOut,
  Plus,
  Target,
  X,
  Pencil,
  Trash2,
  ChevronDown,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useCalendar } from "@/lib/context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";

type GoalPriority = "high" | "medium" | "low";

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
  createdAt: string;
  priority: GoalPriority;
  notes: string;
  progressHistory: { weekStart: string; savedAmount: number }[];
};

const formatDate = (value: Date) => {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const getWeekStartKey = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return formatDate(start);
};

const getShiftHours = (shift: { hours?: number; start?: string; end?: string }) => {
  if (typeof shift.hours === "number") return shift.hours;
  if (!shift.start || !shift.end) return 0;
  const [startH, startM] = shift.start.split(":").map(Number);
  const [endH, endM] = shift.end.split(":").map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

/* =====================
   SCREEN
===================== */

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | GoalPriority>("all");
  const [timeFilter, setTimeFilter] = useState<"current" | "past" | "all">("current");
  const [statusFilter, setStatusFilter] = useState<"all" | "ongoing" | "completed">("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [paceUnit, setPaceUnit] = useState<"day" | "week" | "month">("week");
  const [paceMenuFor, setPaceMenuFor] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("User");
  const scrollRef = useRef<ScrollView>(null);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const { shifts } = useCalendar();
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (userId) {
        const arcadeRef = doc(db, "users", userId, "arcade", "state");
        setDoc(arcadeRef, { lastGoalsReviewAt: serverTimestamp() }, { merge: true });
      }
    }, [userId])
  );

  // Modal inputs
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedAmount, setSavedAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [notes, setNotes] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(new Date());

  const confirmLogout = () => {
    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } finally {
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

  const activeGoalsLabel = useMemo(() => `${goals.length} active goals`, [goals]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
      if (!user) {
        setDisplayName("User");
        return;
      }
      if (user.displayName) setDisplayName(user.displayName);
      const userRef = doc(db, "users", user.uid);
      const unsubProfile = onSnapshot(userRef, snap => {
        const data = snap.data() as { fullName?: string; hourlyRate?: number } | undefined;
        if (data?.fullName) setDisplayName(data.fullName);
        if (data?.hourlyRate != null) setHourlyRate(Number(data.hourlyRate));
      });
      return () => unsubProfile();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      return;
    }

    const goalsRef = collection(db, "users", userId, "goals");
    const unsubscribe = onSnapshot(goalsRef, snapshot => {
      const nextGoals = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        const createdAtValue =
          typeof data.createdAt?.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === "string"
              ? data.createdAt
              : new Date().toISOString();

        return {
          id: docSnap.id,
          name: data.name ?? "",
          targetAmount: Number(data.targetAmount ?? 0),
          savedAmount: Number(data.savedAmount ?? 0),
          deadline: data.deadline ?? "",
          createdAt: createdAtValue,
          priority: (data.priority as GoalPriority) ?? "medium",
          notes: data.notes ?? "",
          progressHistory: Array.isArray(data.progressHistory)
            ? data.progressHistory
                .filter((item: any) => item && item.weekStart)
                .map((item: any) => ({
                  weekStart: String(item.weekStart),
                  savedAmount: Number(item.savedAmount ?? 0),
                }))
            : [],
        } as Goal;
      });
      setGoals(nextGoals);
    });

    return unsubscribe;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAttendanceLogs([]);
      return;
    }
    const attendanceRef = collection(db, "users", userId, "attendance");
    const unsubscribe = onSnapshot(attendanceRef, snapshot => {
      const logs = snapshot.docs.map(docSnap => docSnap.data() as any);
      setAttendanceLogs(logs);
    });
    return unsubscribe;
  }, [userId]);

  useEffect(() => {
    if (!userId || goals.length === 0) return;
    const currentWeek = getWeekStartKey(new Date());
    const updates: Promise<void>[] = [];
    goals.forEach(goal => {
      const history = Array.isArray(goal.progressHistory)
        ? [...goal.progressHistory]
        : [];
      const last = history[history.length - 1];
      if (!last || last.weekStart !== currentWeek) {
        history.push({ weekStart: currentWeek, savedAmount: goal.savedAmount });
      } else if (last.savedAmount !== goal.savedAmount) {
        history[history.length - 1] = {
          weekStart: currentWeek,
          savedAmount: goal.savedAmount,
        };
      } else {
        return;
      }
      updates.push(
        updateDoc(doc(db, "users", userId, "goals", goal.id), {
          progressHistory: history,
          updatedAt: serverTimestamp(),
        }) as Promise<void>
      );
    });
    if (updates.length) {
      Promise.all(updates).catch(() => {
        // ignore history update errors
      });
    }
  }, [goals, userId]);

  const resetForm = () => {
    setGoalName("");
    setTargetAmount("");
    setSavedAmount("");
    setDeadline("");
    setPriority("medium");
    setNotes("");
    setEditingGoalId(null);
    setError("");
  };

  const closeModal = () => {
    setShowAddGoal(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setShowAddGoal(true);
  };

  const openEditModal = (goal: Goal) => {
    setGoalName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setSavedAmount(String(goal.savedAmount));
    setDeadline(goal.deadline);
    setPriority(goal.priority);
    setNotes(goal.notes);
    setEditingGoalId(goal.id);
    setShowAddGoal(true);
  };

  const parseMoney = (value: string) => Number(value.replace(/,/g, ""));
  const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const sanitizeAmount = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join("")}`;
  };
  const validateAmountInput = (raw: string, cleaned: string) => {
    if (!raw) {
      setError("");
      return true;
    }
    if (raw !== cleaned) {
      setError("Please enter price amount only");
      return false;
    }
    setError("");
    return true;
  };
  const toDateFromString = (value: string) => {
    if (!isValidDate(value)) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const handleSaveGoal = async () => {
    setError("");

    if (!goalName.trim()) {
      setError("Goal name is required");
      return;
    }

    const target = parseMoney(targetAmount);
    const saved = parseMoney(savedAmount || "0");

    if (!Number.isFinite(target) || target <= 0) {
      setError("Target amount must be a number greater than 0");
      return;
    }

    if (!Number.isFinite(saved) || saved < 0) {
      setError("Saved amount must be a valid number");
      return;
    }

    if (!deadline.trim()) {
      setError("Deadline is required");
      return;
    }
    if (!isValidDate(deadline.trim())) {
      setError("Deadline must be in YYYY-MM-DD format");
      return;
    }

    if (!userId) {
      setError("Please log in to save goals");
      return;
    }

    Alert.alert(
      "Save goal?",
      "Are you sure you want to save this goal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            try {
              const currentWeek = getWeekStartKey(new Date());
              if (editingGoalId) {
                const existing = goals.find(goal => goal.id === editingGoalId);
                const history = Array.isArray(existing?.progressHistory)
                  ? [...(existing?.progressHistory ?? [])]
                  : [];
                const last = history[history.length - 1];
                if (!last || last.weekStart !== currentWeek) {
                  history.push({ weekStart: currentWeek, savedAmount: saved });
                } else {
                  history[history.length - 1] = {
                    weekStart: currentWeek,
                    savedAmount: saved,
                  };
                }
                const goalRef = doc(db, "users", userId, "goals", editingGoalId);
                await updateDoc(goalRef, {
                  name: goalName.trim(),
                  targetAmount: target,
                  savedAmount: saved,
                  deadline: deadline.trim(),
                  priority,
                  notes: notes.trim(),
                  progressHistory: history,
                  updatedAt: serverTimestamp(),
                });
              } else {
                const goalsRef = collection(db, "users", userId, "goals");
                await addDoc(goalsRef, {
                  name: goalName.trim(),
                  targetAmount: target,
                  savedAmount: saved,
                  deadline: deadline.trim(),
                  priority,
                  notes: notes.trim(),
                  progressHistory: [
                    { weekStart: currentWeek, savedAmount: saved },
                  ],
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              closeModal();
            } catch {
              setError("Failed to save goal. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) return;
    Alert.alert(
      "Delete goal?",
      "Are you sure you want to delete this goal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", userId, "goals", goalId));
            } catch {
              setError("Failed to delete goal. Please try again.");
            }
          },
        },
      ]
    );
  };

  const openDatePicker = () => {
    const parsed = toDateFromString(deadline);
    setDraftDate(parsed ?? new Date());
    setShowDatePicker(true);
  };

  const confirmDate = () => {
    setDeadline(formatDate(draftDate));
    setShowDatePicker(false);
  };

  const getProgress = (goal: Goal) => {
    if (goal.targetAmount <= 0) return 0;
    return Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
  };

  const getRemainingUnits = (goal: Goal, unit: "day" | "week" | "month") => {
    const today = new Date();
    const end = new Date(goal.deadline);
    const diffMs = end.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (unit === "day") return Math.max(1, diffDays);
    if (unit === "week") return Math.max(1, Math.ceil(diffDays / 7));
    return Math.max(1, Math.ceil(diffDays / 30.44));
  };

  const pad = (value: number) => String(value).padStart(2, "0");
  const getPeriodKey = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const currentPeriod = getPeriodKey(new Date());
  const assignedHoursSoFar = useMemo(() => {
    const cutoffDate = new Date();
    return shifts
      .filter(shift => {
        if (!shift.date?.startsWith(currentPeriod)) return false;
        if (["absent", "off", "leave"].includes(shift.status)) return false;
        const shiftDate = new Date(`${shift.date}T00:00:00`);
        if (Number.isNaN(shiftDate.getTime())) return false;
        return shiftDate <= cutoffDate;
      })
      .reduce((sum, shift) => sum + getShiftHours(shift), 0);
  }, [shifts, currentPeriod]);
  const monthlyEarnings = useMemo(() => {
    if (assignedHoursSoFar > 0) {
      return assignedHoursSoFar * hourlyRate;
    }
    const totalHours = approvedLogs.reduce((sum, log) => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return sum;
      return sum + Number(log.hours ?? 0);
    }, 0);
    return totalHours * hourlyRate;
  }, [assignedHoursSoFar, approvedLogs, hourlyRate, currentPeriod]);

  const filteredGoals = useMemo(() => {
    const todayKey = formatDate(new Date());
    return goals
      .filter(goal => {
      const isCompleted = goal.savedAmount >= goal.targetAmount;
      const isPast = goal.deadline && goal.deadline < todayKey;
      if (filter !== "all" && goal.priority !== filter) return false;
      if (timeFilter === "current" && isPast) return false;
      if (timeFilter === "past" && !isPast) return false;
      if (statusFilter === "completed" && !isCompleted) return false;
      if (statusFilter === "ongoing" && isCompleted) return false;
      return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [filter, goals, timeFilter, statusFilter]);

  return (
    <LinearGradient colors={["#0b1220", "#111827"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.logo}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Image
                source={require("../../assets/images/spendly-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.subText}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push("/notifications")}>
            <Bell size={22} color="#e5e7eb" />
            <View style={styles.notifDot} />
          </TouchableOpacity>

            <TouchableOpacity onPress={confirmLogout}>
              <LogOut size={22} color="#e5e7eb" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== CONTENT ===== */}
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        {/* TITLE */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Goals</Text>
            <Text style={styles.subtitle}>{activeGoalsLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={openCreateModal}
          >
            <Plus size={26} color="#0b1220" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {(["all", "high", "medium", "low"] as const).map(value => (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterChip,
                filter === value && styles.filterChipActive,
              ]}
              onPress={() => setFilter(value)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === value && styles.filterTextActive,
                ]}
              >
                {value === "all"
                  ? "All"
                  : value.charAt(0).toUpperCase() + value.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.filterMenuButton,
              showFilterMenu && styles.filterMenuButtonActive,
            ]}
            onPress={() => setShowFilterMenu(prev => !prev)}
          >
            <Text
              style={[
                styles.filterMenuText,
                showFilterMenu && styles.filterMenuTextActive,
              ]}
            >
              Goal details
            </Text>
          </TouchableOpacity>
        </View>
        {showFilterMenu ? (
          <View style={styles.filterMenu}>
            <Text style={styles.filterMenuTitle}>Show</Text>
            <View style={styles.filterMenuRow}>
              {(["current", "past", "all"] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterMenuChip,
                    timeFilter === value && styles.filterMenuChipActive,
                  ]}
                  onPress={() => setTimeFilter(value)}
                >
                  <Text
                    style={[
                      styles.filterMenuChipText,
                      timeFilter === value && styles.filterMenuChipTextActive,
                    ]}
                  >
                    {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterMenuTitle}>Status</Text>
            <View style={styles.filterMenuRow}>
              {(["all", "ongoing", "completed"] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterMenuChip,
                    statusFilter === value && styles.filterMenuChipActive,
                  ]}
                  onPress={() => setStatusFilter(value)}
                >
                  <Text
                    style={[
                      styles.filterMenuChipText,
                      statusFilter === value && styles.filterMenuChipTextActive,
                    ]}
                  >
                    {value === "all"
                      ? "All"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {filteredGoals.length > 0 && (
          <View style={styles.goalList}>
            {filteredGoals.map(goal => {
              const progress = getProgress(goal);
              const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
              const unitsRemaining = getRemainingUnits(goal, paceUnit);
              const requiredPerUnit = unitsRemaining ? remaining / unitsRemaining : 0;
              const earningsPerUnit =
                paceUnit === "month"
                  ? monthlyEarnings
                  : paceUnit === "week"
                  ? monthlyEarnings / 4.33
                  : monthlyEarnings / 30.44;
              const earningsShare =
                earningsPerUnit > 0
                  ? Math.min(100, Math.round((requiredPerUnit / earningsPerUnit) * 100))
                  : null;
              const unitLabel = paceUnit === "day" ? "day" : paceUnit === "week" ? "week" : "month";
              const isPaceMenuOpen = paceMenuFor === goal.id;
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.goalMeta}>
                          RM {goal.savedAmount.toFixed(2)} / RM{" "}
                          {goal.targetAmount.toFixed(2)}
                        </Text>
                        <TouchableOpacity
                          style={styles.editSavedButton}
                          onPress={() => openEditModal(goal)}
                        >
                          <Text style={styles.editSavedText}>Edit saved</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.goalHeaderRight}>
                      <View style={[styles.priorityChip, styles[`priority${goal.priority}`]]}>
                        <Text style={styles.priorityText}>
                          {goal.priority.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.goalActions}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => openEditModal(goal)}
                        >
                          <Pencil size={16} color="#4f46e5" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>{progress}% saved</Text>
                    <Text style={styles.progressLabel}>
                      Deadline: {goal.deadline}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor:
                            progress < 50
                              ? "#ef4444"
                              : progress < 75
                              ? "#f59e0b"
                              : "#22c55e",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.milestoneRow}>
                    {[25, 50, 75, 100].map(milestone => (
                      <View key={milestone} style={styles.milestoneItem}>
                        <View
                          style={[
                            styles.milestoneDot,
                            progress >= milestone && styles.milestoneDotActive,
                          ]}
                        />
                        <Text style={styles.milestoneText}>{milestone}%</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.collectionHeader}>
                    <Text style={styles.collectionTitle}>Collection plan</Text>
                    <View style={styles.paceDropdown}>
                      <TouchableOpacity
                        style={styles.paceButton}
                        onPress={() =>
                          setPaceMenuFor(prev => (prev === goal.id ? null : goal.id))
                        }
                      >
                        <Text style={styles.paceButtonText}>
                          {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}
                        </Text>
                        <ChevronDown size={14} color="#9ca3af" />
                      </TouchableOpacity>
                      {isPaceMenuOpen ? (
                        <View style={styles.paceMenu}>
                          {(["day", "week", "month"] as const).map(option => (
                            <TouchableOpacity
                              key={option}
                              style={styles.paceMenuItem}
                              onPress={() => {
                                setPaceUnit(option);
                                setPaceMenuFor(null);
                              }}
                            >
                              <Text
                                style={[
                                  styles.paceMenuText,
                                  option === paceUnit && styles.paceMenuTextActive,
                                ]}
                              >
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.summaryCard}>
                    <View>
                      <Text style={styles.summaryLabel}>Saved total</Text>
                      <Text style={styles.summaryValue}>
                        RM {goal.savedAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.summaryLabel}>Remaining</Text>
                      <Text style={styles.summaryValue}>
                        RM {remaining.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planCard}>
                    <View style={styles.planRow}>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Need to collect</Text>
                        <Text style={styles.planValue}>
                          RM {requiredPerUnit.toFixed(2)} / {unitLabel}
                        </Text>
                      </View>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Time left</Text>
                        <Text style={styles.planValue}>
                          {unitsRemaining} {unitLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.planDivider} />
                    <View style={styles.planRow}>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Total earnings</Text>
                        <Text style={styles.planValue}>
                          RM {Math.max(0, earningsPerUnit).toFixed(2)} / {unitLabel}
                        </Text>
                      </View>
                      <View style={styles.planItem}>
                        <Text style={styles.planLabel}>Needed from earnings</Text>
                        <Text style={styles.planValue}>
                          {earningsShare !== null ? `${earningsShare}%` : "—"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {goal.notes ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteLabel}>Why this goal</Text>
                      <Text style={styles.noteText}>{goal.notes}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* EMPTY STATE */}
        {goals.length === 0 && (
          <View style={styles.emptyCard}>
            <Target size={40} color="#b7f34d" />
            <Text style={styles.emptyTitle}>No goals yet</Text>
            <Text style={styles.emptyText}>
              Start by creating your first financial goal
            </Text>

            <TouchableOpacity
              style={styles.createButton}
              onPress={openCreateModal}
            >
              <Text style={styles.createText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>

        {/* =====================
           ADD GOAL MODAL
        ===================== */}
        {showAddGoal && (
          <View style={styles.overlay}>
            <SafeAreaView style={styles.modal} edges={["bottom"]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingGoalId ? "Edit Goal" : "Create New Goal"}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <X size={22} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Goal Name</Text>
                <TextInput
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder="e.g. Buy new phone"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Target Amount (RM)</Text>
                <TextInput
                  value={targetAmount}
                  onChangeText={value => {
                    const cleaned = sanitizeAmount(value);
                    if (validateAmountInput(value, cleaned)) {
                      setTargetAmount(cleaned);
                    }
                  }}
                  placeholder="e.g. 2000"
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    !goalName.trim() && styles.inputDisabled,
                  ]}
                  editable={!!goalName.trim()}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Saved so far (RM)</Text>
                <TextInput
                  value={savedAmount}
                  onChangeText={value => {
                    const cleaned = sanitizeAmount(value);
                    if (validateAmountInput(value, cleaned)) {
                      setSavedAmount(cleaned);
                    }
                  }}
                  placeholder="e.g. 250"
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    (!goalName.trim() ||
                      !Number.isFinite(parseMoney(targetAmount)) ||
                      parseMoney(targetAmount) <= 0) &&
                      styles.inputDisabled,
                  ]}
                  editable={
                    !!goalName.trim() &&
                    Number.isFinite(parseMoney(targetAmount)) &&
                    parseMoney(targetAmount) > 0
                  }
                />
              </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deadline</Text>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  (!goalName.trim() ||
                    !Number.isFinite(parseMoney(targetAmount)) ||
                    parseMoney(targetAmount) <= 0 ||
                    !Number.isFinite(parseMoney(savedAmount || "0")) ||
                    parseMoney(savedAmount || "0") < 0) &&
                    styles.inputDisabled,
                ]}
                onPress={openDatePicker}
                disabled={
                  !goalName.trim() ||
                  !Number.isFinite(parseMoney(targetAmount)) ||
                  parseMoney(targetAmount) <= 0 ||
                  !Number.isFinite(parseMoney(savedAmount || "0")) ||
                  parseMoney(savedAmount || "0") < 0
                }
              >
                <Text style={styles.dateButtonText}>
                  {deadline ? `Deadline: ${deadline}` : "Choose deadline"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityRow}>
                {(["high", "medium", "low"] as const).map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.priorityButton,
                      priority === value && styles.priorityButtonActive,
                    ]}
                    onPress={() => setPriority(value)}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        priority === value && styles.priorityButtonTextActive,
                      ]}
                    >
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Goal Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Why this goal matters"
                style={[styles.input, styles.notesInput]}
                multiline
                editable={!!deadline}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleSaveGoal}
                >
                  <Text style={styles.createBtnText}>
                    {editingGoalId ? "Save" : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        )}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dateModal}>
              <Text style={styles.modalTitle}>Select deadline</Text>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  if (date) setDraftDate(date);
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, styles.modalButton]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtn, styles.modalButton]}
                  onPress={confirmDate}
                >
                  <Text style={styles.createBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  container: {
    padding: 16,
    paddingBottom: 120,
  },
  bgBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(183,243,77,0.14)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.6)",
    bottom: -120,
    left: -80,
  },

  /* HEADER */
  header: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  logoImage: { width: 24, height: 24 },
  appName: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  subText: { fontSize: 13, color: "#9ca3af" },
  headerRight: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
  },
  notifDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },

  /* CONTENT */
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#e5e7eb" },
  subtitle: { fontSize: 14, color: "#9ca3af" },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#b7f34d",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: "#141c2a",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#273244",
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "700", color: "#e5e7eb" },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  createButton: {
    marginTop: 16,
    backgroundColor: "#b7f34d",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createText: { color: "#0b1220", fontWeight: "700" },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  filterMenuButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
  },
  filterMenuButtonActive: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  filterMenuText: { color: "#e5e7eb", fontWeight: "600", fontSize: 12 },
  filterMenuTextActive: { color: "#0b1220" },
  filterMenu: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
    gap: 10,
  },
  filterMenuTitle: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  filterMenuRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterMenuChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
  },
  filterMenuChipActive: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  filterMenuChipText: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  filterMenuChipTextActive: { color: "#0b1220" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
  },
  filterChipActive: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  filterText: { fontSize: 12, color: "#9ca3af", fontWeight: "600" },
  filterTextActive: { color: "#0b1220" },
  goalList: { gap: 14 },
  goalCard: {
    backgroundColor: "#141c2a",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#273244",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  goalHeaderRight: { alignItems: "flex-end", gap: 8 },
  goalName: { fontSize: 18, fontWeight: "700", color: "#e5e7eb" },
  goalMeta: { color: "#9ca3af" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  editSavedButton: { paddingVertical: 2 },
  editSavedText: { color: "#b7f34d", fontSize: 12, fontWeight: "600" },
  goalActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#273244",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101826",
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priorityText: { fontSize: 10, fontWeight: "700", color: "#e5e7eb" },
  priorityhigh: { backgroundColor: "#2a1114" },
  prioritymedium: { backgroundColor: "#2a200f" },
  prioritylow: { backgroundColor: "#12251b" },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  streakText: { fontSize: 12, fontWeight: "700", color: "#e5e7eb" },
  streakHint: { fontSize: 12, color: "#9ca3af" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { color: "#9ca3af", fontSize: 12 },
  progressBar: {
    height: 8,
    backgroundColor: "#273244",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#b7f34d",
  },
  milestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  milestoneItem: { alignItems: "center", gap: 4 },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#273244",
  },
  milestoneDotActive: { backgroundColor: "#b7f34d" },
  milestoneText: { fontSize: 10, color: "#9ca3af" },
  collectionHeader: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  collectionTitle: { fontSize: 13, fontWeight: "700", color: "#e5e7eb" },
  paceDropdown: { position: "relative" },
  paceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
  },
  paceButtonText: { color: "#e5e7eb", fontSize: 12, fontWeight: "600" },
  paceMenu: {
    position: "absolute",
    top: 34,
    right: 0,
    minWidth: 120,
    backgroundColor: "#101826",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#273244",
    paddingVertical: 6,
    zIndex: 10,
  },
  paceMenuItem: { paddingHorizontal: 10, paddingVertical: 8 },
  paceMenuText: { color: "#9ca3af", fontSize: 12 },
  paceMenuTextActive: { color: "#b7f34d", fontWeight: "700" },
  summaryCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#101826",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: { color: "#9ca3af", fontSize: 12 },
  summaryValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "700", marginTop: 2 },
  planCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273244",
    backgroundColor: "#141c2a",
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  planItem: { flex: 1 },
  planLabel: { color: "#9ca3af", fontSize: 12 },
  planValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "700", marginTop: 2 },
  planDivider: {
    height: 1,
    backgroundColor: "#273244",
    marginVertical: 10,
  },
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#101826",
  },
  noteLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "700" },
  noteText: { marginTop: 6, color: "#e5e7eb", fontSize: 12 },
  miniChart: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    alignItems: "flex-end",
  },
  miniBarWrap: {
    flex: 1,
    height: 60,
    justifyContent: "flex-end",
  },
  miniBar: {
    backgroundColor: "#b7f34d",
    borderRadius: 8,
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  goalFootLabel: { color: "#9ca3af", fontSize: 12 },
  goalFootValue: { fontWeight: "700", marginTop: 2, color: "#e5e7eb" },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  /* MODAL */
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#141c2a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#e5e7eb" },

  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  input: {
    backgroundColor: "#101826",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#273244",
    color: "#e5e7eb",
  },
  inputDisabled: {
    opacity: 0.6,
  },
  dateButton: {
    backgroundColor: "#101826",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#273244",
  },
  dateButtonText: {
    color: "#e5e7eb",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#273244",
    alignItems: "center",
    backgroundColor: "#101826",
  },
  priorityButtonActive: {
    backgroundColor: "#b7f34d",
    borderColor: "#b7f34d",
  },
  priorityButtonText: { color: "#9ca3af", fontWeight: "600" },
  priorityButtonTextActive: { color: "#0b1220" },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dateModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#141c2a",
    borderRadius: 16,
    padding: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    alignItems: "center",
  },
  errorText: { color: "#ef4444", marginBottom: 8, textAlign: "center" },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#1b2636",
    borderWidth: 1,
    borderColor: "#273244",
    alignItems: "center",
  },
  cancelText: { color: "#e5e7eb", fontWeight: "600" },
  createBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#b7f34d",
    alignItems: "center",
  },
  createBtnText: { color: "#0b1220", fontWeight: "700" },
});
