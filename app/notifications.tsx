import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, Check, ChevronLeft } from "lucide-react-native";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useTheme } from "@/lib/context";
import { router } from "expo-router";
import { cardShadow } from "@/lib/shadows";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetRole", "in", ["worker", "all"])
    );
    const unsub = onSnapshot(notificationsQuery, snapshot => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setItems(list);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const list = items.filter(item => {
      if (item.targetRole === "all") return true;
      if (!userId) return false;
      if (item.workerId && item.workerId !== userId) return false;
      return true;
    });
    return list.sort((a, b) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt));
  }, [items, userId]);

  const unreadCount = useMemo(
    () => filtered.filter(item => !item.readAt).length,
    [filtered]
  );

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), {
      readAt: serverTimestamp(),
    });
  };

  const markAllRead = async () => {
    const unread = filtered.filter(item => !item.readAt);
    await Promise.all(unread.map(item =>
      updateDoc(doc(db, "notifications", item.id), {
        readAt: serverTimestamp(),
      })
    ));
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.backgroundStart, colors.backgroundEnd]} style={styles.screen}>
        <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
              {unreadCount > 0 ? (
                <TouchableOpacity style={styles.markAllButton} onPress={markAllRead}>
                  <Check size={14} color={colors.text} />
                  <Text style={[styles.markAllText, { color: colors.text }]}>
                    Mark all read
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.cardHeader}>
              <Bell size={18} color={colors.text} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Alerts</Text>
            </View>

            {filtered.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No notifications yet.
              </Text>
            ) : (
              <View style={styles.list}>
                {filtered.map(item => (
                  <View
                    key={item.id}
                    style={[
                      styles.item,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      !item.readAt && styles.itemUnread,
                    ]}
                  >
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {item.title || "Notification"}
                    </Text>
                    <Text style={[styles.itemMessage, { color: colors.textMuted }]}>
                      {item.message || "-"}
                    </Text>
                    <View style={styles.itemFooter}>
                      <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                        {formatTimestamp(item.createdAt)}
                      </Text>
                      {!item.readAt ? (
                        <TouchableOpacity onPress={() => markRead(item.id)}>
                          <Text style={[styles.markReadText, { color: colors.text }]}>
                            Mark read
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 120 },
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
    flex: 1,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  markAllText: { fontSize: 11, fontWeight: "600" },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  title: { fontSize: 20, fontWeight: "700" },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    ...cardShadow,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontWeight: "700" },
  emptyText: { marginTop: 10 },
  list: { marginTop: 12, gap: 10 },
  item: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemUnread: {
    borderWidth: 2,
  },
  itemTitle: { fontWeight: "600" },
  itemMessage: { marginTop: 4 },
  itemFooter: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTime: { fontSize: 11 },
  markReadText: { fontSize: 11, fontWeight: "600" },
});
