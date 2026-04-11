import { ScrollView, Text, View } from "react-native";
import { Bell, Info, CheckCircle, AlertTriangle, DollarSign } from "lucide-react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminNotifications() {
  const { colors: p } = useAdminTheme();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "notifications"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setItems(list);
    });
    return unsub;
  }, []);

  const sorted = useMemo(
    () => [...items].sort((a, b) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt)),
    [items]
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
            Notifications
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>
            System alerts and operational reminders
          </Text>
        </View>

        {/* Card */}
        <View style={{ backgroundColor: p.surface, borderRadius: 12, borderWidth: 1, borderColor: p.border }}>
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
            {sorted.length > 0 && (
              <View style={{
                marginLeft: "auto",
                backgroundColor: p.surfaceAlt,
                borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
              }}>
                <Text style={{ color: p.textMuted, fontSize: 11 }}>{sorted.length}</Text>
              </View>
            )}
          </View>

          {sorted.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>No notifications yet</Text>
            </View>
          ) : (
            sorted.map((item, idx) => {
              const { icon: Icon, color } = getTypeStyle(item.type, p);
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row", gap: 12, alignItems: "flex-start",
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: idx < sorted.length - 1 ? 1 : 0,
                    borderBottomColor: p.border,
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
                      <Text style={{ color: p.text, fontSize: 13, fontWeight: "600", flex: 1 }}>
                        {item.title || "Notification"}
                      </Text>
                      <Text style={{ color: p.textMuted, fontSize: 11, marginLeft: 8 }}>
                        {formatTimestamp(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                      {item.message || "—"}
                    </Text>
                  </View>
                </View>
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
