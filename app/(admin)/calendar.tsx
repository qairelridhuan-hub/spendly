import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Plus } from "lucide-react-native";
import { useTheme } from "@/lib/context";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function AdminCalendar() {
  const { colors } = useTheme();
  const [shiftCount, setShiftCount] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "shifts"), snapshot => {
      setShiftCount(snapshot.size);
    });
    return unsub;
  }, []);

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
              Calendar
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
              Manage shifts and schedules in real time.
            </Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={18} color={colors.text} />
          </View>
        </View>

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
            <Calendar size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Schedule Overview
          </Text>
          </View>
          <Text style={{ color: colors.textMuted, marginTop: 10 }}>
            {shiftCount === 0
              ? "No schedules yet. Auto-generated shifts will appear here once configured."
              : `${shiftCount} shifts generated.`}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
