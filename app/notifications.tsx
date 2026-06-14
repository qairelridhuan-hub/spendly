import { useMemo } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowDownUp, Bell, BellOff, Check, ChevronLeft, Trash2 } from "lucide-react-native";
import { useTheme } from "@/lib/context";
import { router } from "expo-router";
import { NotificationItem } from "@/components/NotificationItem";
import { getTimeValue, useNotifications } from "@/lib/notifications/useNotifications";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const {
    items,
    unreadCount,
    sortOrder,
    toggleSortOrder,
    markRead,
    markAllRead,
    clearAll,
    dismiss,
  } = useNotifications();

  const groups = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    const today: any[] = [];
    const yesterday: any[] = [];
    const earlier: any[] = [];

    items.forEach((item) => {
      const ms = getTimeValue(item.createdAt);
      if (ms >= startOfToday) today.push(item);
      else if (ms >= startOfYesterday) yesterday.push(item);
      else earlier.push(item);
    });

    const sections = [
      { label: "Today", data: today },
      { label: "Yesterday", data: yesterday },
      { label: "Earlier", data: earlier },
    ].filter((section) => section.data.length > 0);

    return sections;
  }, [items]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.screen, { backgroundColor: "#ffffff" }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={toggleSortOrder}
              activeOpacity={0.8}
            >
              <ArrowDownUp size={14} color={colors.text} />
              <Text style={[styles.actionText, { color: colors.text }]}>
                {sortOrder === "newest" ? "Newest first" : "Oldest first"}
              </Text>
            </TouchableOpacity>

            {unreadCount > 0 ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={markAllRead}
                activeOpacity={0.8}
              >
                <Check size={14} color={colors.text} />
                <Text style={[styles.actionText, { color: colors.text }]}>Mark all read</Text>
              </TouchableOpacity>
            ) : null}

            {items.length > 0 ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#000000", borderColor: "#000000" }]}
                onPress={clearAll}
                activeOpacity={0.8}
              >
                <Trash2 size={14} color="#ffffff" />
                <Text style={[styles.actionText, { color: "#ffffff" }]}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <BellOff size={28} color={colors.textMuted} strokeWidth={1.6} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>You're all caught up</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No new notifications right now.
              </Text>
            </View>
          ) : (
            groups.map((section) => (
              <View key={section.label} style={styles.section}>
                <View style={styles.cardHeader}>
                  <Bell size={16} color={colors.textMuted} strokeWidth={1.8} />
                  <Text style={[styles.cardTitle, { color: colors.textMuted }]}>{section.label}</Text>
                </View>
                <View style={styles.list}>
                  {section.data.map((item, index) => (
                    <NotificationItem
                      key={item.id}
                      item={item}
                      colors={colors}
                      showDivider={index < section.data.length - 1}
                      onMarkRead={markRead}
                      onDismiss={dismiss}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700" },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
  section: { marginBottom: 18 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  list: { marginTop: 8 },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptyText: { fontSize: 13 },
});
