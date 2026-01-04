import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  Users,
  FileBarChart2,
  Settings,
  LogOut,
  Bell,
} from "lucide-react-native";
import { auth, db } from "@/lib/firebase";
import { adminPalette } from "@/lib/admin/palette";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Setup", href: "/admin/setup", icon: Settings },
  { label: "Calendar", href: "/admin/calendar", icon: Calendar },
  { label: "Workers", href: "/admin/workers", icon: Users },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  { label: "Reports", href: "/admin/reports", icon: FileBarChart2 },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const confirmLogout = () => {
    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/admin/login");
        },
      },
    ]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        if (pathname !== "/admin/login") {
          router.replace("/admin/login");
        }
        setChecking(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.data()?.role;
      if (role !== "admin") {
        await signOut(auth);
        router.replace("/admin/login");
        setChecking(false);
        return;
      }

      const name =
        snap.data()?.fullName ||
        snap.data()?.displayName ||
        user.displayName ||
        "Admin";
      setAdminName(name);

      if (pathname === "/admin/login") {
        router.replace("/admin");
      }
      setChecking(false);
    });

    return unsubscribe;
  }, [pathname, router]);

  const pageTitle = useMemo(() => {
    const match = navItems.find(item => item.href === pathname);
    return match?.label ?? "Dashboard";
  }, [pathname]);

  if (checking) {
    return (
      <LinearGradient
        colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: adminPalette.text }}>Loading admin...</Text>
      </LinearGradient>
    );
  }

  if (pathname === "/admin/login") {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <LinearGradient
      colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <AnimatedBlobs
        blobStyle={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: 999,
          backgroundColor: "rgba(14,165,233,0.12)",
          top: -140,
          right: -120,
        }}
        blobAltStyle={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: 999,
          backgroundColor: "rgba(249,115,22,0.12)",
          bottom: -180,
          left: -140,
        }}
      />
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          style={{
            width: 260,
            padding: 20,
            borderRightWidth: 1,
            borderRightColor: adminPalette.border,
            backgroundColor: adminPalette.surface,
          }}
        >
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: adminPalette.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 18 }}>💰</Text>
              </View>
              <View>
                <Text
                  style={{
                    color: adminPalette.brand,
                    fontSize: 18,
                    fontWeight: "700",
                  }}
                >
                  Spendly
                </Text>
                <Text style={{ color: adminPalette.textMuted, fontSize: 12 }}>
                  Admin Panel
                </Text>
              </View>
            </View>
          </View>

          <ScrollView>
            {navItems.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.href}
                  onPress={() => router.push(item.href as any)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isActive
                      ? adminPalette.infoSoft
                      : "transparent",
                    marginBottom: 6,
                  }}
                >
                  <Icon
                    size={18}
                    color={isActive ? adminPalette.accent : adminPalette.textMuted}
                  />
                  <Text
                    style={{
                      color: isActive ? adminPalette.accent : adminPalette.textMuted,
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderTopColor: adminPalette.border,
              paddingTop: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: adminPalette.infoSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: adminPalette.accent, fontSize: 14 }}>
                  👤
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: adminPalette.text, fontSize: 13, fontWeight: "600" }}
                >
                  {adminName}
                </Text>
                <Text style={{ color: adminPalette.textMuted, fontSize: 11 }}>
                  Administrator
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={confirmLogout}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: adminPalette.dangerSoft,
              }}
            >
              <LogOut size={16} color={adminPalette.danger} />
              <Text style={{ color: adminPalette.danger, fontWeight: "600" }}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: adminPalette.border,
              backgroundColor: adminPalette.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{ color: adminPalette.text, fontWeight: "700", fontSize: 18 }}
              >
                {pageTitle}
              </Text>
              <Text style={{ color: adminPalette.textMuted, fontSize: 12 }}>
                Welcome back, {adminName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/admin/notifications" as any)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: adminPalette.border,
                backgroundColor: adminPalette.surfaceAlt,
              }}
            >
              <Bell size={18} color={adminPalette.textMuted} />
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: adminPalette.danger,
                }}
              />
            </TouchableOpacity>
          </View>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </LinearGradient>
  );
}
