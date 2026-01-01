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
import { useState } from "react";
import {
  Bell,
  LogOut,
  Plus,
  Target,
  X,
} from "lucide-react-native";

/* =====================
   SCREEN
===================== */

export default function GoalsScreen() {
  // ❗ NO DUMMY DATA
  const [goals, setGoals] = useState<any[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);

  // Modal inputs
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const closeModal = () => {
    setShowAddGoal(false);
    setGoalName("");
    setTargetAmount("");
    setDeadline("");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>💰</Text>
          </View>

          <View>
            <Text style={styles.appName}>Spendly</Text>
            <Text style={styles.subText}>Hey, John!</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity>
            <Bell size={22} color="#6b7280" />
            <View style={styles.notifDot} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <LogOut size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== CONTENT ===== */}
      <ScrollView contentContainerStyle={styles.container}>
        {/* TITLE */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Goals</Text>
            <Text style={styles.subtitle}>
              {goals.length} active goals
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddGoal(true)}
          >
            <Plus size={26} color="#fff" />
          </TouchableOpacity>
        </View>

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
              onPress={() => setShowAddGoal(true)}
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
              <Text style={styles.modalTitle}>Create New Goal</Text>
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
              <Text style={styles.label}>Deadline</Text>
              <TextInput
                value={deadline}
                onChangeText={setDeadline}
                placeholder="YYYY-MM-DD"
                style={styles.input}
              />
            </View>

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
                onPress={() => {
                  // Logic will be added next
                  closeModal();
                }}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

/* =====================
   STYLES
===================== */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  /* HEADER */
  header: {
    backgroundColor: "#fff",
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
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 18 },
  appName: { fontSize: 16, fontWeight: "700" },
  subText: { fontSize: 13, color: "#6b7280" },
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
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#6b7280" },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "700" },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  createButton: {
    marginTop: 16,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createText: { color: "#4f46e5", fontWeight: "600" },

  /* MODAL */
  overlay: {
    position: "absolute",
    inset: 0,
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