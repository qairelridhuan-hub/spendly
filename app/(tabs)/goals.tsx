import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  LogOut,
  Plus,
  Target,
  X,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

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
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("User");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const approvedLogs = useMemo(
    () => attendanceLogs.filter(log => log.status === "approved"),
    [attendanceLogs]
  );

  // Modal inputs
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedAmount, setSavedAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<GoalPriority>("medium");
  const [notes, setNotes] = useState("");

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

    if (!userId) {
      setError("Please log in to save goals");
      return;
    }

    try {
      if (editingGoalId) {
        const goalRef = doc(db, "users", userId, "goals", editingGoalId);
        await updateDoc(goalRef, {
          name: goalName.trim(),
          targetAmount: target,
          savedAmount: saved,
          deadline: deadline.trim(),
          priority,
          notes: notes.trim(),
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch {
      setError("Failed to save goal. Please try again.");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "goals", goalId));
    } catch {
      setError("Failed to delete goal. Please try again.");
    }
  };

  const getProgress = (goal: Goal) => {
    if (goal.targetAmount <= 0) return 0;
    return Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
  };

  const getWeeklyPace = (goal: Goal) => {
    const today = new Date();
    const end = new Date(goal.deadline);
    const diffMs = end.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const weeks = Math.max(1, Math.ceil(diffDays / 7));
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    return remaining / weeks;
  };

  const getTotalWeeks = (goal: Goal) => {
    const start = new Date(goal.createdAt);
    const end = new Date(goal.deadline);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
  };

  const getWeeksElapsed = (goal: Goal) => {
    const start = new Date(goal.createdAt);
    const today = new Date();
    const diffMs = Math.max(0, today.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
  };

  const getStreakWeeks = (goal: Goal) => {
    const totalWeeks = getTotalWeeks(goal);
    const expectedPerWeek = goal.targetAmount / totalWeeks;
    const expectedByNow = expectedPerWeek * getWeeksElapsed(goal);
    return goal.savedAmount >= expectedByNow ? getWeeksElapsed(goal) : 0;
  };

  const getNextContributionDate = () => {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return next.toISOString().slice(0, 10);
  };

  const pad = (value: number) => String(value).padStart(2, "0");
  const getPeriodKey = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const currentPeriod = getPeriodKey(new Date());
  const monthlyEarnings = useMemo(() => {
    const totalHours = approvedLogs.reduce((sum, log) => {
      const date = String(log.date ?? "");
      if (!date.startsWith(currentPeriod)) return sum;
      return sum + Number(log.hours ?? 0);
    }, 0);
    return totalHours * hourlyRate;
  }, [approvedLogs, hourlyRate, currentPeriod]);

  const estimateMonthsToGoal = (goal: Goal) => {
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    if (monthlyEarnings <= 0) return null;
    return Math.ceil(remaining / monthlyEarnings);
  };

  const filteredGoals = useMemo(() => {
    if (filter === "all") return goals;
    return goals.filter(goal => goal.priority === filter);
  }, [filter, goals]);

  return (
    <LinearGradient colors={["#f8fafc", "#eef2f7"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.logo}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={styles.logoText}>💰</Text>
            </TouchableOpacity>

            <View>
              <Text style={styles.appName}>Spendly</Text>
              <Text style={styles.subText}>Hey, {displayName}!</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")}>
              <Bell size={22} color="#0f172a" />
              <View style={styles.notifDot} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                try {
                  await signOut(auth);
                } finally {
                  router.replace("/(auth)/login");
                }
              }}
            >
              <LogOut size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== CONTENT ===== */}
        <ScrollView contentContainerStyle={styles.container}>
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
            <Plus size={26} color="#fff" />
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
        </View>

        {filteredGoals.length > 0 && (
          <View style={styles.goalList}>
            {filteredGoals.map(goal => {
                const progress = getProgress(goal);
                const weeklyPace = getWeeklyPace(goal);
                const streakWeeks = getStreakWeeks(goal);
                const nextContribution = getNextContributionDate();
                const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
                const monthsToGoal = estimateMonthsToGoal(goal);
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        RM {goal.savedAmount.toFixed(2)} / RM {goal.targetAmount.toFixed(2)}
                      </Text>
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

                  <View style={styles.streakRow}>
                    <Text style={styles.streakText}>
                      {streakWeeks > 0
                        ? `${streakWeeks} weeks on track`
                        : "Behind pace"}
                    </Text>
                    <Text style={styles.streakHint}>
                      Weekly target RM {weeklyPace.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>{progress}% saved</Text>
                    <Text style={styles.progressLabel}>
                      Deadline: {goal.deadline}
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
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

                  <View style={styles.nextCard}>
                    <View>
                      <Text style={styles.nextTitle}>Next contribution</Text>
                      <Text style={styles.nextAmount}>
                        RM {weeklyPace.toFixed(2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.nextTitle}>Deadline</Text>
                      <Text style={styles.nextAmount}>{goal.deadline}</Text>
                    </View>
                  </View>

                  {goal.notes ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteLabel}>Why this goal</Text>
                      <Text style={styles.noteText}>{goal.notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.miniChart}>
                    {[0.2, 0.35, 0.55, 0.8].map((ratio, index) => (
                      <View key={index} style={styles.miniBarWrap}>
                        <View
                          style={[
                            styles.miniBar,
                            { height: Math.max(8, ratio * 56) },
                          ]}
                        />
                      </View>
                    ))}
                  </View>

                  <View style={styles.goalFooter}>
                    <View>
                      <Text style={styles.goalFootLabel}>Weekly pace</Text>
                      <Text style={styles.goalFootValue}>
                        RM {weeklyPace.toFixed(2)} / week
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.goalFootLabel}>Remaining</Text>
                      <Text style={styles.goalFootValue}>
                        RM {remaining.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.earningsRow}>
                    <View>
                      <Text style={styles.goalFootLabel}>Current earnings</Text>
                      <Text style={styles.goalFootValue}>
                        RM {monthlyEarnings.toFixed(2)} / month
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.goalFootLabel}>Time to reach</Text>
                      <Text style={styles.goalFootValue}>
                        {monthsToGoal ? `${monthsToGoal} mo` : "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* EMPTY STATE */}
        {goals.length === 0 && (
          <View style={styles.emptyCard}>
            <Target size={40} color="#6366f1" />
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
                  <X size={22} color="#6b7280" />
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
                  onChangeText={setTargetAmount}
                  placeholder="e.g. 2000"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Saved Amount (RM)</Text>
                <TextInput
                  value={savedAmount}
                  onChangeText={setSavedAmount}
                  placeholder="e.g. 250"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deadline</Text>
              <TextInput
                value={deadline}
                onChangeText={setDeadline}
                placeholder="YYYY-MM-DD"
                style={styles.input}
              />
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
    backgroundColor: "rgba(14,165,233,0.12)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.12)",
    bottom: -120,
    left: -80,
  },

  /* HEADER */
  header: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
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
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  subText: { fontSize: 13, color: "#64748b" },
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
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b" },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "700" },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  createButton: {
    marginTop: 16,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createText: { color: "#0f172a", fontWeight: "600" },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  filterChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  filterText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  filterTextActive: { color: "#ffffff" },
  goalList: { gap: 14 },
  goalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
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
  goalName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  goalMeta: { color: "#64748b", marginTop: 4 },
  goalActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priorityText: { fontSize: 10, fontWeight: "700", color: "#0f172a" },
  priorityhigh: { backgroundColor: "#fee2e2" },
  prioritymedium: { backgroundColor: "#fef3c7" },
  prioritylow: { backgroundColor: "#dcfce7" },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  streakText: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  streakHint: { fontSize: 12, color: "#64748b" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { color: "#64748b", fontSize: 12 },
  progressBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#0ea5e9",
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
    backgroundColor: "#e2e8f0",
  },
  milestoneDotActive: { backgroundColor: "#0ea5e9" },
  milestoneText: { fontSize: 10, color: "#94a3b8" },
  nextCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  nextTitle: { fontSize: 11, color: "#64748b" },
  nextAmount: { fontWeight: "700", color: "#0f172a", marginTop: 2 },
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  noteLabel: { fontSize: 11, color: "#475569", fontWeight: "700" },
  noteText: { marginTop: 6, color: "#0f172a", fontSize: 12 },
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
    backgroundColor: "#0f172a",
    borderRadius: 8,
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  goalFootLabel: { color: "#64748b", fontSize: 12 },
  goalFootValue: { fontWeight: "700", marginTop: 2 },
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
    backgroundColor: "#fff",
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
  modalTitle: { fontSize: 18, fontWeight: "700" },

  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  input: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  priorityButtonActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  priorityButtonText: { color: "#64748b", fontWeight: "600" },
  priorityButtonTextActive: { color: "#ffffff" },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
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
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelText: { color: "#374151", fontWeight: "600" },
  createBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#4f46e5",
    alignItems: "center",
  },
  createBtnText: { color: "#fff", fontWeight: "600" },
});
