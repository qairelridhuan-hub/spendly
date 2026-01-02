import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  Wallet,
  FileBarChart2,
  Bell,
  Settings,
} from "lucide-react-native";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/lib/context";

const navItems = [
  { label: "Dashboard", href: "/(admin)", icon: LayoutDashboard },
  { label: "Calendar", href: "/(admin)/calendar", icon: Calendar },
  { label: "Attendance", href: "/(admin)/attendance", icon: ClipboardCheck },
  { label: "Payroll", href: "/(admin)/payroll", icon: Wallet },
  { label: "Reports", href: "/(admin)/reports", icon: FileBarChart2 },
  { label: "Notifications", href: "/(admin)/notifications", icon: Bell },
  { label: "Settings", href: "/(admin)/settings", icon: Settings },
];

export default function AdminLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        if (pathname !== "/(admin)/login") {
          router.replace("/(admin)/login");
        }
        setChecking(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.data()?.role;
      if (role !== "admin") {
        await signOut(auth);
        router.replace("/(admin)/login");
        setChecking(false);
        return;
      }

      if (pathname === "/(admin)/login") {
        router.replace("/(admin)");
      }
      setChecking(false);
    });

    return unsubscribe;
  }, [pathname, router]);

  if (checking) {
    return (
      <LinearGradient
        colors={[colors.backgroundStart, colors.backgroundEnd]}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: colors.text }}>Loading admin...</Text>
      </LinearGradient>
    );
  }

  if (pathname === "/(admin)/login") {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          style={{
            width: 260,
            padding: 20,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
              Spendly Admin
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>
              Control Center
            </Text>
          </View>

          <ScrollView>
            {navItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isActive ? colors.surfaceAlt : "transparent",
                    marginBottom: 6,
                  }}
                >
                  <Icon size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
              Authorized personnel only. All actions are logged for compliance.
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.accentStrong,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16 }}>💰</Text>
              </View>
              <View>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Spendly Admin
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Secure operations console
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await signOut(auth);
                router.replace("/(admin)/login");
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Log out
              </Text>
            </TouchableOpacity>
          </View>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </LinearGradient>
  );
}
