import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { Bell, Info, CheckCircle, AlertTriangle, DollarSign, Trash2, X, ArrowUpDown } from "lucide-react-native";
import { collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { AdminErrorBanner } from "@/lib/admin/error-banner";
import { makeSnapshotErrorHandler } from "@/lib/firebase/errors";
import { adminCardShadow } from "@/lib/admin/shadows";

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "payroll", label: "Payroll" },
  { key: "attendance", label: "Attendance" },
  { key: "alert", label: "Alerts" },
  { key: "other", label: "Other" },
];

export default function AdminNotifications() {
  const { colors: p } = useAdminTheme();
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/notifications");
    const unsub = onSnapshot(collection(db, "notifications"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setItems(list);
    }, onSnapError);
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (typeFilter !== "all") {
      list = list.filter(item => {
        const t = item.type;
        if (typeFilter === "alert") return t === "alert" || t === "warning";
        if (typeFilter === "other") return !["payroll", "attendance", "alert", "warning"].includes(t);
        return t === typeFilter;
      });
    }
    list.sort((a, b) => sortOrder === "newest"
      ? getTimeValue(b.createdAt) - getTimeValue(a.createdAt)
      : getTimeValue(a.createdAt) - getTimeValue(b.createdAt));
    return list;
  }, [items, typeFilter, sortOrder]);

  const markAsRead = async (item: any) => {
    if (item.read) return;
    await updateDoc(doc(db, "notifications", item.id), { read: true });
  };

  const deleteNotification = async (item: any) => {
    await deleteDoc(doc(db, "notifications", item.id));
  };

  const clearAll = async () => {
    if (filtered.length === 0) return;
    const batch = writeBatch(db);
    filtered.forEach(item => batch.delete(doc(db, "notifications", item.id)));
    await batch.commit();
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AdminErrorBanner message={error} />

        {/* Header */}
        <View style={{ marginBottom: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
              Notifications
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
              System alerts and operational reminders
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearAll}
            disabled={filtered.length === 0}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 10, paddingVertical: 7,
              borderRadius: 8, borderWidth: 1, borderColor: p.border,
              backgroundColor: p.surface, opacity: filtered.length === 0 ? 0.5 : 1,
            }}
          >
            <Trash2 size={13} color={p.danger} strokeWidth={1.8} />
            <Text style={{ color: p.danger, fontSize: 12, fontWeight: "600" }}>Clear all</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map(f => {
            const active = typeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setTypeFilter(f.key)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 99, borderWidth: 1,
                  borderColor: active ? p.text : p.border,
                  backgroundColor: active ? p.text : p.surface,
                }}
              >
                <Text style={{ color: active ? p.backgroundStart : p.textMuted, fontSize: 12, fontWeight: "600" }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={() => setSortOrder(o => (o === "newest" ? "oldest" : "newest"))}
            style={{
              marginLeft: "auto",
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 10, paddingVertical: 6,
              borderRadius: 99, borderWidth: 1, borderColor: p.border,
              backgroundColor: p.surface,
            }}
          >
            <ArrowUpDown size={12} color={p.textMuted} strokeWidth={1.8} />
            <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: "600" }}>
              {sortOrder === "newest" ? "Newest first" : "Oldest first"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card */}
        <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border, ...adminCardShadow }}>
          {/* Card header */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: p.border,
          }}>
            <Bell size={14} color={p.textMuted} strokeWidth={1.8} />
            <Text style={{ color: p.text, fontSize: 13, fontWeight: "600" }}>
              All Notifications
            </Text>
            {filtered.length > 0 && (
              <View style={{
                marginLeft: "auto",
                backgroundColor: p.surfaceAlt,
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
              }}>
                <Text style={{ color: p.textMuted, fontSize: 11 }}>{filtered.length}</Text>
              </View>
            )}
          </View>

          {filtered.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>No notifications yet</Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const { icon: Icon, color } = getTypeStyle(item.type, p);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => markAsRead(item)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row", gap: 12, alignItems: "flex-start",
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                    borderBottomColor: p.border,
                    backgroundColor: item.read ? "transparent" : p.surfaceAlt,
                  }}
                >
                  <View style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: p.surfaceAlt,
                    alignItems: "center", justifyContent: "center",
                    marginTop: 1, flexShrink: 0,
                  }}>
                    <Icon size={14} color={color} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        {!item.read && (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.accent }} />
                        )}
                        <Text style={{ color: p.text, fontSize: 13, fontWeight: "600", flex: 1 }}>
                          {item.title || "Notification"}
                        </Text>
                      </View>
                      <Text style={{ color: p.textMuted, fontSize: 11, marginLeft: 8 }}>
                        {formatTimestamp(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                      {item.message || "—"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteNotification(item)}
                    style={{ padding: 4, marginTop: -2, marginLeft: 4 }}
                  >
                    <X size={14} color={p.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getTypeStyle = (type: string, p: any) => {
  if (type === "payroll") return { icon: DollarSign, color: p.success };
  if (type === "attendance") return { icon: CheckCircle, color: p.accent };
  if (type === "alert" || type === "warning") return { icon: AlertTriangle, color: p.warning };
  return { icon: Info, color: p.textMuted };
};

const getTimeValue = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const formatTimestamp = (value: any) => {
  const ms = getTimeValue(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};
