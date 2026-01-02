import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FileBarChart2 } from "lucide-react-native";
import { useTheme } from "@/lib/context";

export default function AdminReports() {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Reports
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Export payroll, attendance, and performance reports.
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
            <FileBarChart2 size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Report Builder
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, marginTop: 10 }}>
            Reports will appear here once data is available.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
