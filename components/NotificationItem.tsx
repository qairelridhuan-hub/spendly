import React, { useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { AlertTriangle, CheckCircle2, Info, Trash2, XCircle } from "lucide-react-native";

interface Props {
  item: any;
  colors: any;
  showDivider: boolean;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  formatTimestamp: (value: any) => string;
}

function getIconForTitle(title: string) {
  const lower = (title || "").toLowerCase();
  if (lower.includes("approved")) return { Icon: CheckCircle2, color: "#16a34a" };
  if (lower.includes("rejected")) return { Icon: XCircle, color: "#dc2626" };
  if (lower.includes("warning") || lower.includes("alert")) return { Icon: AlertTriangle, color: "#f59e0b" };
  return { Icon: Info, color: "#3b82f6" };
}

export function NotificationItem({ item, colors, showDivider, onMarkRead, onDismiss, formatTimestamp }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const { Icon, color } = getIconForTitle(item.title);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => (
    <TouchableOpacity
      style={styles.deleteAction}
      activeOpacity={0.8}
      onPress={() => {
        swipeRef.current?.close();
        onDismiss(item.id);
      }}
    >
      <Animated.View
        style={{
          opacity: progress,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trash2 size={18} color="#ffffff" />
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={40}
    >
      <View
        style={[
          styles.item,
          { backgroundColor: colors.surface },
          showDivider && { borderBottomWidth: 1, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${color}1A` }]}>
          <Icon size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.itemHeaderRow}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || "Notification"}
            </Text>
            {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.text }]} /> : null}
          </View>
          <Text style={[styles.itemMessage, { color: colors.textMuted }]}>
            {item.message || "-"}
          </Text>
          <View style={styles.itemFooter}>
            <Text style={[styles.itemTime, { color: colors.textMuted }]}>
              {formatTimestamp(item.createdAt)}
            </Text>
            {!item.read ? (
              <TouchableOpacity onPress={() => onMarkRead(item.id)}>
                <Text style={[styles.markReadText, { color: colors.text }]}>
                  Mark read
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 14,
    flexDirection: "row",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemTitle: { fontWeight: "600", fontSize: 15, flexShrink: 1 },
  itemMessage: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  itemFooter: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTime: { fontSize: 11 },
  markReadText: { fontSize: 11, fontWeight: "600" },
  deleteAction: {
    width: 64,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
});
