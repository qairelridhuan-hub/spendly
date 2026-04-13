import { Text, View } from "react-native";
import { useAdminTheme } from "./theme";

export function AdminErrorBanner({ message }: { message?: string }) {
  const { colors } = useAdminTheme();
  if (!message) return null;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.danger,
        backgroundColor: colors.dangerSoft,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}>
        Data error
      </Text>
      <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>
        {message}
      </Text>
    </View>
  );
}
