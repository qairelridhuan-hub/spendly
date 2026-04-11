import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
} from "react-native";
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
  ShieldCheck,
  LogOut,
  Bell,
  Layers,
  SlidersHorizontal,
  Moon,
  Sun,
  MapPin,
  BadgeCheck,
} from "lucide-react-native";
import { auth, db } from "@/lib/firebase";
import { AdminThemeProvider, useAdminTheme } from "@/lib/admin/theme";

const navSections = [
  {
    label: "Core",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { label: "Setup", href: "/admin/setup", icon: Settings },
      { label: "Rules", href: "/admin/settings", icon: ShieldCheck },
      { label: "Calendar", href: "/admin/calendar", icon: Calendar },
      { label: "Workers", href: "/admin/workers", icon: Users },
      { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Attendance",
    items: [
      { label: "Workplace", href: "/admin/attendance-settings", icon: MapPin },
      { label: "Verification", href: "/admin/attendance-records", icon: BadgeCheck },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", href: "/admin/reports", icon: FileBarChart2 }],
  },
];
const navItems = navSections.flatMap(section => section.items);

export default function AdminLayout() {
  return (
    <AdminThemeProvider>
      <AdminLayoutInner />
    </AdminThemeProvider>
  );
}

function AdminLayoutInner() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const { colors: adminPalette, mode: adminThemeMode, setMode: setAdminThemeMode } =
    useAdminTheme();
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      Alert.alert("Logout failed", "Please try again.");
    } finally {
      router.replace("/admin/login");
    }
  };
  const confirmLogout = () => {
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm("Are you sure you want to log out?");
      if (ok) {
        void handleLogout();
      }
      return;
    }

    Alert.alert("Logout?", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: handleLogout,
      },
    ]);
  };

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);


  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: adminThemeMode === "dark" ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [adminThemeMode, toggleAnim]);

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      const currentPath = pathnameRef.current;
      if (!user) {
        if (currentPath !== "/admin/login") {
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

      if (currentPath === "/admin/login") {
        router.replace("/admin");
      }
      setChecking(false);
    });

    return unsubscribe;
  }, [router]);

  const pageTitle = useMemo(() => {
    const match = navItems.find(item => item.href === pathname);
    return match?.label ?? "Dashboard";
  }, [pathname]);
  const tooltipBackground = adminThemeMode === "dark" ? "#0b1220" : adminPalette.text;
  const tooltipText = adminThemeMode === "dark" ? adminPalette.text : "#fff";
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });
  const sidebarBackground = adminThemeMode === "dark" ? "#0b0f15" : "#0f172a";
  const sidebarText = "#e2e8f0";
  const sidebarMuted = "#94a3b8";
  const sidebarActive = "#38bdf8";
  const sidebarBorder = adminThemeMode === "dark" ? "#1f2937" : "#111827";

  if (checking) {
    return (
      <LinearGradient
        colors={[adminPalette.backgroundStart, adminPalette.backgroundEnd]}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 380,
            height: 380,
            borderRadius: 190,
            backgroundColor: adminPalette.surfaceAlt,
            opacity: 0.35,
            top: -140,
            right: -120,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 260,
            backgroundColor: adminPalette.surfaceAlt,
            opacity: 0.18,
            bottom: -260,
            left: -220,
          }}
        />
        <View
          style={{
            width: 200,
            height: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: adminPalette.border,
            backgroundColor: adminPalette.surfaceAlt,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 120,
              backgroundColor: adminPalette.accentStrong,
              opacity: 0.15,
              transform: [{ translateX: shimmerTranslate }],
            }}
          />
        </View>
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
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: 260,
          backgroundColor: adminPalette.surfaceAlt,
          opacity: 0.18,
          top: -220,
          right: -160,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 680,
          height: 680,
          borderRadius: 340,
          backgroundColor: adminPalette.surfaceAlt,
          opacity: 0.12,
          bottom: -320,
          left: -260,
        }}
      />
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View
          style={{
            width: 260,
            padding: 22,
            borderRightWidth: 1,
            borderRightColor: sidebarBorder,
            backgroundColor: sidebarBackground,
          }}
        >
          <LinearGradient
            colors={["rgba(56,189,248,0.12)", "rgba(15,23,42,0)"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 140,
            }}
            pointerEvents="none"
          />
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.push("/admin" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              accessibilityLabel="Go to admin dashboard"
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#ffffff",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={require("../../assets/images/spendly-logo.png")}
                  style={{ width: 22, height: 22 }}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text
                  style={{
                    color: sidebarText,
                    fontSize: 17,
                    fontWeight: "700",
                  }}
                >
                  Spendly
                </Text>
                <Text style={{ color: sidebarMuted, fontSize: 12 }}>
                  Admin Panel
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView>
            {navSections.map(section => (
              <View key={section.label} style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {section.label === "Core" ? (
                    <Layers size={12} color={sidebarMuted} />
                  ) : section.label === "Management" ? (
                    <SlidersHorizontal size={12} color={sidebarMuted} />
                  ) : (
                    <FileBarChart2 size={12} color={sidebarMuted} />
                  )}
                  <Text
                    style={{
                      color: sidebarMuted,
                      fontSize: 11,
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                    }}
                  >
                    {section.label}
                  </Text>
                </View>
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  const isHovered = hoveredNav === item.href;
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.href}
                      onPress={() => router.push(item.href as any)}
                      {...(Platform.OS === "web"
                        ? ({
                            onMouseEnter: () => setHoveredNav(item.href),
                            onMouseLeave: () => setHoveredNav(null),
                          } as any)
                        : {})}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: isActive
                          ? "rgba(56,189,248,0.22)"
                          : "transparent",
                        borderLeftWidth: isActive ? 3 : 0,
                        borderLeftColor: sidebarActive,
                        marginBottom: 6,
                        shadowColor: isActive ? sidebarActive : "transparent",
                        shadowOpacity: isActive ? 0.35 : 0,
                        shadowRadius: isActive ? 10 : 0,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: isActive ? 4 : 0,
                      }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          transform: [{ scale: isHovered ? 1.15 : 1 }],
                          backgroundColor: isHovered
                            ? "rgba(148,163,184,0.18)"
                            : "transparent",
                          borderRadius: 8,
                        }}
                      >
                        <Icon size={18} color={isActive ? sidebarActive : sidebarMuted} />
                        {Platform.OS === "web" && isHovered ? (
                          <View
                            style={{
                              position: "absolute",
                              left: 34,
                              top: -6,
                              backgroundColor: tooltipBackground,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 14,
                              zIndex: 20,
                              shadowColor: "#0f172a",
                              shadowOpacity: 0.18,
                              shadowRadius: 8,
                              shadowOffset: { width: 0, height: 4 },
                            }}
                          >
                            <View
                              style={{
                                position: "absolute",
                                left: -4,
                                top: 12,
                                width: 8,
                                height: 8,
                                backgroundColor: tooltipBackground,
                                transform: [{ rotate: "45deg" }],
                              }}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: tooltipText,
                                fontSize: 11,
                                fontWeight: "600",
                              }}
                            >
                              {item.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          color: isActive ? sidebarText : sidebarMuted,
                          fontWeight: "600",
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View
            style={{
              marginTop: 16,
              borderTopWidth: 1,
              borderTopColor: sidebarBorder,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: sidebarBorder,
                backgroundColor: "rgba(148,163,184,0.12)",
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "rgba(56,189,248,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: sidebarText, fontSize: 12 }}>
                    ADM
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: sidebarText, fontSize: 13, fontWeight: "600" }}
                  >
                    {adminName}
                  </Text>
                  <Text style={{ color: sidebarMuted, fontSize: 11 }}>
                    Administrator • Active
                  </Text>
                </View>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#22c55e",
                  }}
                />
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
                backgroundColor: "rgba(248,113,113,0.2)",
              }}
            >
              <LogOut size={16} color="#f87171" />
              <Text style={{ color: "#f87171", fontWeight: "600" }}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            ...(Platform.OS === "web" ? { overflowY: "auto" } : null),
          }}
        >
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push("/admin/workers" as any)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: adminPalette.accent,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                  Add Worker
                </Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                onPress={() =>
                  setAdminThemeMode(adminThemeMode === "light" ? "dark" : "light")
                }
                accessibilityLabel="Dark mode toggle"
                style={{
                  padding: 0,
                  borderRadius: 0,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                }}
              >
                <View
                  style={{
                    width: 78,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: adminPalette.surfaceAlt,
                    borderWidth: 1,
                    borderColor: adminPalette.border,
                    padding: 4,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor:
                        adminThemeMode === "dark" ? "#fff" : adminPalette.accentStrong,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [
                        {
                          translateX: toggleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 38],
                          }),
                        },
                      ],
                    }}
                  >
                    {adminThemeMode === "dark" ? (
                      <Moon size={14} color="#facc15" />
                    ) : (
                      <Sun size={14} color="#fff" />
                    )}
                  </Animated.View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </LinearGradient>
  );
}
