import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { adminCardShadow } from "@/lib/admin/shadows";
import { MapPin, Plus, Trash2, Pencil, X, Check, Users } from "lucide-react-native";

type Workplace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
};

type Worker = {
  id: string;
  name: string;
  workplaceId?: string;
  adminId?: string;
};

type FormState = {
  name: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
};

const emptyForm = (): FormState => ({ name: "", latitude: "", longitude: "", allowedRadiusMeters: "100" });

export default function WorkplacesScreen() {
  const { mode } = useAdminTheme();
  const isDark = mode === "dark";

  const S = {
    bg:          isDark ? "#08080e"                : "#f4f4f6",
    card:        isDark ? "rgba(20,20,28,0.95)"    : "#ffffff",
    border:      isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    text:        isDark ? "#e4e4e7"                : "#18181b",
    muted:       isDark ? "#71717a"                : "#6b7280",
    input:       isDark ? "rgba(255,255,255,0.05)" : "#f9fafb",
    inputBorder: isDark ? "rgba(255,255,255,0.1)"  : "#e5e7eb",
    btnBg:       isDark ? "#ffffff"                : "#18181b",
    btnText:     isDark ? "#18181b"                : "#ffffff",
    tag:         isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6",
    danger:      "#ef4444",
  };

  const [adminId, setAdminId]       = useState<string | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [workers, setWorkers]       = useState<Worker[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setAdminId(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!adminId) return;
    const unsub = onSnapshot(collection(db, "users", adminId, "workplaces"), snap => {
      setWorkplaces(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Workplace, "id">) })));
    });
    return unsub;
  }, [adminId]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users"), where("role", "==", "worker")), snap => {
      setWorkers(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? d.data().displayName ?? "Unnamed",
        workplaceId: d.data().workplaceId,
        adminId: d.data().adminId,
      })));
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!adminId) return;
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.allowedRadiusMeters, 10);
    if (!form.name.trim()) { alert("Name is required."); return; }
    if (isNaN(lat) || isNaN(lng)) { alert("Enter valid latitude and longitude."); return; }
    if (isNaN(radius) || radius <= 0) { alert("Enter a valid radius."); return; }

    setSaving(true);
    try {
      const payload = { name: form.name.trim(), latitude: lat, longitude: lng, allowedRadiusMeters: radius };
      if (editingId) {
        await setDoc(doc(db, "users", adminId, "workplaces", editingId), payload);
      } else {
        await addDoc(collection(db, "users", adminId, "workplaces"), payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (wp: Workplace) => {
    if (!adminId) return;
    const doDelete = async () => {
      await deleteDoc(doc(db, "users", adminId, "workplaces", wp.id));
      const assigned = workers.filter(w => w.workplaceId === wp.id);
      await Promise.all(assigned.map(w => updateDoc(doc(db, "users", w.id), { workplaceId: null, adminId: null })));
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${wp.name}"? Workers will be unlinked.`)) void doDelete();
    } else {
      Alert.alert("Delete Workplace", `Delete "${wp.name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleAssign = async (worker: Worker, workplaceId: string) => {
    if (!adminId) return;
    const alreadyAssigned = worker.workplaceId === workplaceId;
    await updateDoc(doc(db, "users", worker.id), {
      adminId: alreadyAssigned ? null : adminId,
      workplaceId: alreadyAssigned ? null : workplaceId,
    });
  };

  const openEdit = (wp: Workplace) => {
    setEditingId(wp.id);
    setForm({ name: wp.name, latitude: String(wp.latitude), longitude: String(wp.longitude), allowedRadiusMeters: String(wp.allowedRadiusMeters) });
    setShowForm(true);
  };

  const inputStyle = [st.input, { backgroundColor: S.input, borderColor: S.inputBorder, color: S.text }];

  return (
    <ScrollView style={[st.root, { backgroundColor: S.bg }]} contentContainerStyle={st.content}>

      <View style={st.headerRow}>
        <View>
          <Text style={[st.pageTitle, { color: S.text }]}>Workplaces</Text>
          <Text style={[st.pageSub, { color: S.muted }]}>Set location zones and assign workers</Text>
        </View>
        <TouchableOpacity style={[st.addBtn, { backgroundColor: S.btnBg }]} onPress={() => { setEditingId(null); setForm(emptyForm()); setShowForm(true); }}>
          <Plus size={14} color={S.btnText} strokeWidth={2.5} />
          <Text style={[st.addBtnText, { color: S.btnText }]}>New Workplace</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={[st.card, { backgroundColor: S.card, borderColor: S.border }, adminCardShadow]}>
          <View style={st.cardHeader}>
            <Text style={[st.cardTitle, { color: S.text }]}>{editingId ? "Edit Workplace" : "New Workplace"}</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); }}>
              <X size={16} color={S.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={st.formGrid}>
            <View style={st.formField}>
              <Text style={[st.label, { color: S.muted }]}>Name</Text>
              <TextInput style={inputStyle} placeholder="e.g. Main Office" placeholderTextColor={S.muted} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
            </View>
            <View style={st.formRow}>
              <View style={[st.formField, { flex: 1 }]}>
                <Text style={[st.label, { color: S.muted }]}>Latitude</Text>
                <TextInput style={inputStyle} placeholder="e.g. 3.1390" placeholderTextColor={S.muted} keyboardType="decimal-pad" value={form.latitude} onChangeText={v => setForm(f => ({ ...f, latitude: v }))} />
              </View>
              <View style={[st.formField, { flex: 1 }]}>
                <Text style={[st.label, { color: S.muted }]}>Longitude</Text>
                <TextInput style={inputStyle} placeholder="e.g. 101.6869" placeholderTextColor={S.muted} keyboardType="decimal-pad" value={form.longitude} onChangeText={v => setForm(f => ({ ...f, longitude: v }))} />
              </View>
              <View style={[st.formField, { flex: 1 }]}>
                <Text style={[st.label, { color: S.muted }]}>Radius (m)</Text>
                <TextInput style={inputStyle} placeholder="e.g. 100" placeholderTextColor={S.muted} keyboardType="number-pad" value={form.allowedRadiusMeters} onChangeText={v => setForm(f => ({ ...f, allowedRadiusMeters: v }))} />
              </View>
            </View>
          </View>

          <View style={st.formActions}>
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: S.btnBg, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
              <Check size={14} color={S.btnText} strokeWidth={2.5} />
              <Text style={[st.saveBtnText, { color: S.btnText }]}>{saving ? "Saving…" : editingId ? "Update" : "Create"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {workplaces.length === 0 && !showForm && (
        <View style={[st.emptyCard, { backgroundColor: S.card, borderColor: S.border }]}>
          <MapPin size={28} color={S.muted} strokeWidth={1.5} />
          <Text style={[st.emptyText, { color: S.muted }]}>No workplaces yet. Create one to enable real location-based attendance.</Text>
        </View>
      )}

      {workplaces.map(wp => {
        const assignedWorkers = workers.filter(w => w.workplaceId === wp.id);
        const isExpanded = expandedId === wp.id;
        return (
          <View key={wp.id} style={[st.card, { backgroundColor: S.card, borderColor: S.border }, adminCardShadow]}>
            <View style={st.wpRow}>
              <View style={[st.wpIconBg, { backgroundColor: S.tag }]}>
                <MapPin size={16} color={S.text} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.wpName, { color: S.text }]}>{wp.name}</Text>
                <Text style={[st.wpMeta, { color: S.muted }]}>
                  {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)} · {wp.allowedRadiusMeters}m radius
                </Text>
              </View>
              <View style={st.wpActions}>
                <TouchableOpacity style={st.iconBtn} onPress={() => openEdit(wp)}>
                  <Pencil size={14} color={S.muted} strokeWidth={1.8} />
                </TouchableOpacity>
                <TouchableOpacity style={st.iconBtn} onPress={() => handleDelete(wp)}>
                  <Trash2 size={14} color={S.danger} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[st.workerToggle, { borderTopColor: S.border }]} onPress={() => setExpandedId(isExpanded ? null : wp.id)}>
              <Users size={13} color={S.muted} strokeWidth={1.8} />
              <Text style={[st.workerToggleText, { color: S.muted }]}>{assignedWorkers.length} worker{assignedWorkers.length !== 1 ? "s" : ""} assigned</Text>
              <Text style={{ color: S.muted, fontSize: 10 }}>{isExpanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={[st.workerList, { borderTopColor: S.border }]}>
                {workers.length === 0 && <Text style={[st.workerEmpty, { color: S.muted }]}>No workers found.</Text>}
                {workers.map(worker => {
                  const isAssigned = worker.workplaceId === wp.id;
                  return (
                    <View key={worker.id} style={[st.workerRow, { borderBottomColor: S.border }]}>
                      <Text style={[st.workerName, { color: S.text }]}>{worker.name}</Text>
                      {worker.workplaceId && worker.workplaceId !== wp.id && (
                        <Text style={[st.workerBadge, { backgroundColor: S.tag, color: S.muted }]}>Other</Text>
                      )}
                      <TouchableOpacity
                        style={[st.assignBtn, isAssigned ? { backgroundColor: S.tag, borderColor: S.border } : { backgroundColor: S.btnBg, borderColor: S.btnBg }]}
                        onPress={() => handleAssign(worker, wp.id)}
                      >
                        <Text style={[st.assignBtnText, { color: isAssigned ? S.muted : S.btnText }]}>
                          {isAssigned ? "Unassign" : "Assign"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root:             { flex: 1 },
  content:          { padding: 24, gap: 16, paddingBottom: 60 },
  headerRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  pageTitle:        { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  pageSub:          { fontSize: 13, marginTop: 2 },
  addBtn:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText:       { fontSize: 13, fontWeight: "600" },
  card:             { borderRadius: 14, borderWidth: 1, padding: 18 },
  cardHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardTitle:        { fontSize: 15, fontWeight: "700" },
  formGrid:         { gap: 12 },
  formRow:          { flexDirection: "row", gap: 10 },
  formField:        { gap: 5 },
  label:            { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input:            { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  formActions:      { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  saveBtn:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  saveBtnText:      { fontSize: 13, fontWeight: "600" },
  emptyCard:        { borderRadius: 14, borderWidth: 1, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 10 },
  emptyText:        { fontSize: 13, textAlign: "center", lineHeight: 20 },
  wpRow:            { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 },
  wpIconBg:         { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  wpName:           { fontSize: 14, fontWeight: "700" },
  wpMeta:           { fontSize: 12, marginTop: 2 },
  wpActions:        { flexDirection: "row", gap: 4 },
  iconBtn:          { padding: 7, borderRadius: 8 },
  workerToggle:     { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingTop: 12 },
  workerToggleText: { flex: 1, fontSize: 12 },
  workerList:       { borderTopWidth: 1, marginTop: 10, paddingTop: 10, gap: 2 },
  workerEmpty:      { fontSize: 12, paddingVertical: 8 },
  workerRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  workerName:       { flex: 1, fontSize: 13, fontWeight: "500" },
  workerBadge:      { fontSize: 10, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  assignBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  assignBtnText:    { fontSize: 12, fontWeight: "600" },
});
