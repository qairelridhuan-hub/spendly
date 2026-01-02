import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { Users, Clock, Wallet, AlertTriangle } from "lucide-react-native";
import { db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";

export default function AdminDashboard() {
  const { colors } = useTheme();
  const [workerCount, setWorkerCount] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);

  useEffect(() => {
    const workersQuery = query(
      collection(db, "users"),
      where("role", "==", "worker")
    );
    const unsubWorkers = onSnapshot(workersQuery, snapshot => {
      setWorkerCount(snapshot.size);
    });

    const earningsQuery = collectionGroup(db, "earnings");
    const unsubEarnings = onSnapshot(earningsQuery, snapshot => {
      let earningsSum = 0;
      let hoursSum = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        earningsSum += Number(data.amount ?? 0);
        hoursSum += Number(data.hours ?? 0);
      });
      setTotalEarnings(earningsSum);
      setTotalHours(hoursSum);
    });

    const attendanceQuery = collectionGroup(db, "attendance");
    const unsubAttendance = onSnapshot(attendanceQuery, snapshot => {
      let absent = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as any;
        if (data.status === "absent") absent += 1;
      });
      setAbsentCount(absent);
    });

    return () => {
      unsubWorkers();
      unsubEarnings();
      unsubAttendance();
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Active Workers",
        value: String(workerCount),
        icon: Users,
      },
      {
        label: "Total Hours",
        value: `${totalHours}h`,
        icon: Clock,
      },
      {
        label: "Total Earnings",
        value: `RM ${totalEarnings.toFixed(2)}`,
        icon: Wallet,
      },
      {
        label: "Absences",
        value: String(absentCount),
        icon: AlertTriangle,
      },
    ],
    [workerCount, totalHours, totalEarnings, absentCount]
  );

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Dashboard
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Live system overview and workforce performance.
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }}>
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <View
                key={card.label}
                style={{
                  width: "48%",
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} color={colors.text} />
                  </View>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {card.value}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, marginTop: 8 }}>
                  {card.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
