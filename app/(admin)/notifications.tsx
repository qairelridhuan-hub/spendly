import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";
import { useTheme } from "@/lib/context";

export default function AdminNotifications() {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Notifications
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          System alerts and operational reminders.
        </Text>

        <View
          style={{
            marginTop: 20,
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Bell size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Alerts
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, marginTop: 10 }}>
            No notifications yet.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
