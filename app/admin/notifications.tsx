import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";

export default function AdminNotifications() {
  const { colors: adminPalette } = useAdminTheme();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "notifications"), snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setItems(list);
    });
    return unsub;
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = getTimeValue(a.createdAt);
      const bTime = getTimeValue(b.createdAt);
      return bTime - aTime;
    });
  }, [items]);

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: adminPalette.text, fontSize: 24, fontWeight: "700" }}>
          Notifications
        </Text>
        <Text style={{ color: adminPalette.textMuted, marginTop: 6 }}>
          System alerts and operational reminders.
        </Text>

        <View
          style={{
            marginTop: 20,
            backgroundColor: adminPalette.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: adminPalette.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Bell size={18} color={adminPalette.text} />
            <Text style={{ color: adminPalette.text, fontWeight: "700" }}>
              Alerts
            </Text>
          </View>
          {sorted.length === 0 ? (
            <Text style={{ color: adminPalette.textMuted, marginTop: 10 }}>
              No notifications yet.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              {sorted.map(item => (
                <View
                  key={item.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: adminPalette.border,
                    backgroundColor: adminPalette.surfaceAlt,
                  }}
                >
                  <Text style={{ color: adminPalette.text, fontWeight: "600" }}>
                    {item.title || "Notification"}
                  </Text>
                  <Text style={{ color: adminPalette.textMuted, marginTop: 4 }}>
                    {item.message || "-"}
                  </Text>
                  <Text style={{ color: adminPalette.textMuted, marginTop: 6, fontSize: 11 }}>
                    {formatTimestamp(item.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

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
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
