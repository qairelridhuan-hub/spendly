import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
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
import { MapPin, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react-native";

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
  email: string;
  workplaceId?: string;
  adminId?: string;
};

type FormState = {
  name: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  latitude: "",
  longitude: "",
  allowedRadiusMeters: "",
};

export default function AdminWorkplaces() {
  const { colors: p } = useAdminTheme();

  const [adminId, setAdminId] = useState<string | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [expandedWorkplace, setExpandedWorkplace] = useState<string | null>(null);
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);

  const [status, setStatus] = useState("");

  const card = {
    backgroundColor: p.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.border,
    marginTop: 12,
    ...adminCardShadow,
  };
  const cardHeader = {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  };
  const inp = {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 8,
    padding: 10,
    color: p.text,
    backgroundColor: p.surfaceAlt,
    fontSize: 13,
  };
  const FL = { color: p.textMuted, fontSize: 11, marginBottom: 6 };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) setAdminId(user.uid);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!adminId) return;

    const unsubWorkplaces = onSnapshot(
      collection(db, "users", adminId, "workplaces"),
      snapshot => {
        const list = snapshot.docs.map(docSnap => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: d.name || "",
            latitude: Number(d.latitude ?? 0),
            longitude: Number(d.longitude ?? 0),
            allowedRadiusMeters: Number(d.allowedRadiusMeters ?? 0),
          };
        });
        setWorkplaces(list);
      }
    );

    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: d.fullName || d.displayName || "Worker",
          email: d.email || "",
          workplaceId: d.workplaceId || "",
          adminId: d.adminId || "",
        };
      });
      setWorkers(list);
    });

    return () => {
      unsubWorkplaces();
      unsubWorkers();
    };
  }, [adminId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (wp: Workplace) => {
    setEditingId(wp.id);
    setForm({
      name: wp.name,
      latitude: String(wp.latitude),
      longitude: String(wp.longitude),
      allowedRadiusMeters: String(wp.allowedRadiusMeters),
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const validateForm = (): string => {
    if (!form.name.trim()) return "Name is required.";
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.allowedRadiusMeters);
    if (form.latitude.trim() === "" || isNaN(lat) || lat < -90 || lat > 90)
      return "Latitude must be a number between -90 and 90.";
    if (form.longitude.trim() === "" || isNaN(lng) || lng < -180 || lng > 180)
      return "Longitude must be a number between -180 and 180.";
    if (form.allowedRadiusMeters.trim() === "" || isNaN(radius) || radius <= 0)
      return "Allowed radius must be greater than 0.";
    return "";
  };

  const handleSave = async () => {
    if (!adminId) return;
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      allowedRadiusMeters: Number(form.allowedRadiusMeters),
    };
    try {
      if (editingId) {
        await setDoc(
          doc(db, "users", adminId, "workplaces", editingId),
          payload
        );
        setStatus("Workplace updated.");
      } else {
        await addDoc(collection(db, "users", adminId, "workplaces"), payload);
        setStatus("Workplace created.");
      }
      closeForm();
    } catch {
      setFormError("Failed to save workplace. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workplaceId: string) => {
    if (!adminId) return;
    try {
      await deleteDoc(doc(db, "users", adminId, "workplaces", workplaceId));
      setStatus("Workplace deleted.");
      if (expandedWorkplace === workplaceId) setExpandedWorkplace(null);
    } catch {
      setStatus("Failed to delete workplace.");
    }
  };

  const handleAssignWorker = async (workerId: string, workplaceId: string) => {
    if (!adminId) return;
    setAssigningWorkerId(workerId);
    try {
      await updateDoc(doc(db, "users", workerId), {
        adminId,
        workplaceId,
      });
      setStatus("Worker assigned to workplace.");
    } catch {
      setStatus("Failed to assign worker.");
    } finally {
      setAssigningWorkerId(null);
    }
  };

  const handleUnassignWorker = async (workerId: string) => {
    setAssigningWorkerId(workerId);
    try {
      await updateDoc(doc(db, "users", workerId), {
        adminId: "",
        workplaceId: "",
      });
      setStatus("Worker unassigned.");
    } catch {
      setStatus("Failed to unassign worker.");
    } finally {
      setAssigningWorkerId(null);
    }
  };

  const sanitizeNumberInput = (value: string) =>
    value.replace(/[^0-9.\-]/g, "");

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <View>
            <Text
              style={{
                color: p.text,
                fontSize: 16,
                fontWeight: "700",
                letterSpacing: -0.3,
              }}
            >
              Workplaces
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
              Manage locations and assign workers
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreate}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: p.text,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Plus size={14} color={p.surface} />
            <Text style={{ color: p.surface, fontWeight: "600", fontSize: 13 }}>
              New Workplace
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status bar */}
        {status !== "" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: p.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: p.border,
              padding: 12,
              marginBottom: 4,
            }}
          >
            <Text style={{ color: p.textMuted, fontSize: 12, flex: 1 }}>
              {status}
            </Text>
            <TouchableOpacity onPress={() => setStatus("")}>
              <X size={14} color={p.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <View style={{ ...card }}>
            <View
              style={{
                ...cardHeader,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: p.text, fontSize: 13, fontWeight: "700" }}>
                {editingId ? "Edit Workplace" : "New Workplace"}
              </Text>
              <TouchableOpacity onPress={closeForm}>
                <X size={16} color={p.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 12 }}>
              <View>
                <Text style={FL}>Name</Text>
                <TextInput
                  placeholder="e.g. HQ Office"
                  placeholderTextColor={p.textMuted}
                  value={form.name}
                  onChangeText={v => setForm(prev => ({ ...prev, name: v }))}
                  style={inp}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={FL}>Latitude</Text>
                  <TextInput
                    placeholder="3.1390"
                    placeholderTextColor={p.textMuted}
                    keyboardType="numeric"
                    value={form.latitude}
                    onChangeText={v =>
                      setForm(prev => ({
                        ...prev,
                        latitude: sanitizeNumberInput(v),
                      }))
                    }
                    style={inp}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={FL}>Longitude</Text>
                  <TextInput
                    placeholder="101.6869"
                    placeholderTextColor={p.textMuted}
                    keyboardType="numeric"
                    value={form.longitude}
                    onChangeText={v =>
                      setForm(prev => ({
                        ...prev,
                        longitude: sanitizeNumberInput(v),
                      }))
                    }
                    style={inp}
                  />
                </View>
              </View>
              <View>
                <Text style={FL}>Allowed Radius (meters)</Text>
                <TextInput
                  placeholder="100"
                  placeholderTextColor={p.textMuted}
                  keyboardType="numeric"
                  value={form.allowedRadiusMeters}
                  onChangeText={v =>
                    setForm(prev => ({
                      ...prev,
                      allowedRadiusMeters: sanitizeNumberInput(v),
                    }))
                  }
                  style={inp}
                />
              </View>
              {formError !== "" && (
                <Text style={{ color: "#ef4444", fontSize: 12 }}>
                  {formError}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={closeForm}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: p.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: p.textMuted, fontWeight: "600", fontSize: 13 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: p.text,
                    alignItems: "center",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={p.surface} />
                  ) : (
                    <Text
                      style={{
                        color: p.surface,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {editingId ? "Update Workplace" : "Create Workplace"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Workplace list */}
        {workplaces.length === 0 && !showForm && (
          <View
            style={{
              ...card,
              padding: 32,
              alignItems: "center",
              gap: 8,
            }}
          >
            <MapPin size={28} color={p.textMuted} />
            <Text style={{ color: p.textMuted, fontSize: 13, textAlign: "center" }}>
              No workplaces yet.{"\n"}Create one to get started.
            </Text>
          </View>
        )}

        {workplaces.map(wp => {
          const isExpanded = expandedWorkplace === wp.id;
          const assignedWorkers = workers.filter(
            w => w.workplaceId === wp.id && w.adminId === adminId
          );
          const unassignedWorkers = workers.filter(
            w => w.workplaceId !== wp.id || w.adminId !== adminId
          );

          return (
            <View key={wp.id} style={{ ...card }}>
              {/* Card header row */}
              <View
                style={{
                  ...cardHeader,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: p.text, fontSize: 13, fontWeight: "700" }}
                  >
                    {wp.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 3,
                    }}
                  >
                    <MapPin size={11} color={p.textMuted} />
                    <Text style={{ color: p.textMuted, fontSize: 11 }}>
                      {wp.latitude.toFixed(6)}, {wp.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 2 }}>
                    Radius: {wp.allowedRadiusMeters} m
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => openEdit(wp)}
                    style={{
                      padding: 7,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surfaceAlt,
                    }}
                  >
                    <Pencil size={13} color={p.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(wp.id)}
                    style={{
                      padding: 7,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#fecaca",
                      backgroundColor: "#fef2f2",
                    }}
                  >
                    <Trash2 size={13} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Assigned workers summary */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
                <Text style={{ color: p.textMuted, fontSize: 11, marginBottom: 6 }}>
                  {assignedWorkers.length === 0
                    ? "No workers assigned"
                    : `${assignedWorkers.length} worker${assignedWorkers.length > 1 ? "s" : ""} assigned`}
                </Text>
                {assignedWorkers.map(w => (
                  <View
                    key={w.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 7,
                      borderTopWidth: 1,
                      borderTopColor: p.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 12, fontWeight: "600" }}>
                        {w.name}
                      </Text>
                      <Text style={{ color: p.textMuted, fontSize: 11 }}>
                        {w.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUnassignWorker(w.id)}
                      disabled={assigningWorkerId === w.id}
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: p.border,
                        backgroundColor: p.surfaceAlt,
                        opacity: assigningWorkerId === w.id ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: p.textMuted, fontSize: 11 }}>
                        Unassign
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Expand / collapse assign section */}
              <TouchableOpacity
                onPress={() =>
                  setExpandedWorkplace(isExpanded ? null : wp.id)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  margin: 12,
                  marginTop: 4,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: p.border,
                  backgroundColor: p.surfaceAlt,
                  justifyContent: "center",
                }}
              >
                <UserPlus size={13} color={p.textMuted} />
                <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: "600" }}>
                  {isExpanded ? "Hide worker list" : "Assign a worker"}
                </Text>
              </TouchableOpacity>

              {/* Assign worker panel */}
              {isExpanded && (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: p.border,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    paddingTop: 10,
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: p.textMuted,
                      fontSize: 11,
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    Available Workers
                  </Text>
                  {unassignedWorkers.length === 0 ? (
                    <Text style={{ color: p.textMuted, fontSize: 12 }}>
                      All workers are already assigned here.
                    </Text>
                  ) : (
                    unassignedWorkers.map(w => (
                      <View
                        key={w.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: p.border,
                          backgroundColor: p.surfaceAlt,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: p.text,
                              fontSize: 12,
                              fontWeight: "600",
                            }}
                          >
                            {w.name}
                          </Text>
                          <Text style={{ color: p.textMuted, fontSize: 11 }}>
                            {w.email}
                          </Text>
                          {w.workplaceId && w.adminId === adminId && (
                            <Text
                              style={{
                                color: p.textMuted,
                                fontSize: 10,
                                marginTop: 2,
                              }}
                            >
                              Currently:{" "}
                              {workplaces.find(x => x.id === w.workplaceId)
                                ?.name ?? w.workplaceId}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleAssignWorker(w.id, wp.id)}
                          disabled={assigningWorkerId === w.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            backgroundColor: p.text,
                            opacity: assigningWorkerId === w.id ? 0.5 : 1,
                          }}
                        >
                          {assigningWorkerId === w.id ? (
                            <ActivityIndicator size="small" color={p.surface} />
                          ) : (
                            <>
                              <UserPlus size={11} color={p.surface} />
                              <Text
                                style={{
                                  color: p.surface,
                                  fontSize: 11,
                                  fontWeight: "600",
                                }}
                              >
                                Assign
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
