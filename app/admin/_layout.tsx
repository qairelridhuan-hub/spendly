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
  Easing,
} from "react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  Users,
  FileBarChart2,
  FileText,
  Settings,
  ShieldCheck,
  MapPin,
  LogOut,
  Bell,
  Moon,
  Sun,
  ChevronsLeft,
  ChevronsRight,
  Wallet,
} from "lucide-react-native";
import { auth, db } from "@/lib/firebase";
import { AdminThemeProvider, useAdminTheme } from "@/lib/admin/theme";

// ─── Nav config ───────────────────────────────────────────────────────────────

const navSections = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { label: "Setup",       href: "/admin/setup",       icon: Settings       },
      { label: "Rules",       href: "/admin/settings",    icon: ShieldCheck    },
      { label: "Workplaces",  href: "/admin/workplaces",  icon: MapPin         },
      { label: "Calendar",    href: "/admin/calendar",    icon: Calendar       },
      { label: "Workers",     href: "/admin/workers",     icon: Users          },
      { label: "Attendance",  href: "/admin/attendance",  icon: ClipboardCheck },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", href: "/admin/reports", icon: FileBarChart2 },
      { label: "Payslip", href: "/admin/payslip", icon: FileText      },
      { label: "Payroll", href: "/admin/payroll", icon: Wallet        },
    ],
  },
];
const navItems = navSections.flatMap(s => s.items);

const EXPANDED_W = 264;
const COLLAPSED_W = 64;

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  return (
    <AdminThemeProvider>
      <AdminLayoutInner />
    </AdminThemeProvider>
  );
}

// ─── Inner layout ─────────────────────────────────────────────────────────────

function AdminLayoutInner() {
  const router       = useRouter();
  const pathname     = usePathname();
  const pathnameRef  = useRef(pathname);
  const shimmerAnim  = useRef(new Animated.Value(0)).current;
  const collapseAnim = useRef(new Animated.Value(0)).current;

  const [checking,   setChecking]   = useState(true);
  const [adminName,  setAdminName]  = useState("Admin");
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [collapsed,  setCollapsed]  = useState(false);

  const { mode, setMode } = useAdminTheme();
  const isDark = mode === "dark";

  // ── Theme-aware sidebar tokens ──
  const S = {
    bg:         isDark ? "#000000"               : "rgba(248,248,252,0.92)",
    border:     isDark ? "rgba(255,255,255,0.07)": "rgba(0,0,0,0.08)",
    text:       isDark ? "#d4d4d8"               : "#18181b",
    muted:      isDark ? "#52525b"               : "#71717a",
    activeBg:   isDark ? "#ffffff"               : "#000000",
    activeText: isDark ? "#000000"               : "#ffffff",
    hoverBg:    isDark ? "rgba(255,255,255,0.04)": "rgba(0,0,0,0.03)",
    sectionBg:  isDark ? "rgba(255,255,255,0.05)": "#ffffff",
    sectionBorder: isDark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.05)",
    toggleBg:   isDark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.06)",
    toggleBorder: isDark ? "rgba(255,255,255,0.1)": "rgba(0,0,0,0.1)",
    toggleIcon: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
    userCard:   isDark ? "rgba(255,255,255,0.05)": "rgba(0,0,0,0.04)",
    userBorder: isDark ? "rgba(255,255,255,0.08)": "rgba(0,0,0,0.08)",
    avatarBg:   isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    divider:    isDark ? "rgba(255,255,255,0.07)": "rgba(0,0,0,0.07)",
    logoutText: isDark ? "rgba(255,255,255,0.35)": "rgba(0,0,0,0.4)",
    topbar:     isDark ? "#000000"               : "rgba(255,255,255,0.95)",
    topbarBorder: isDark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.08)",
    topbarText: isDark ? "#d4d4d8"               : "#18181b",
    iconBtn:    isDark ? "rgba(255,255,255,0.05)": "rgba(0,0,0,0.05)",
    iconBtnBorder: isDark ? "rgba(255,255,255,0.08)": "rgba(0,0,0,0.08)",
    iconColor:  isDark ? "rgba(255,255,255,0.45)": "rgba(0,0,0,0.45)",
    pageBg:     isDark ? "#08080e"               : "#f4f4f6",
  };

  // Web-only glass blur
  const glassStyle: any = Platform.OS === "web"
    ? { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }
    : {};

  // ── Animated values ──
  const sidebarWidth = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [EXPANDED_W, COLLAPSED_W],
  });
  const labelOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
  });
  const logoOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
  });
  const sectionLabelOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
  });

  const toggleCollapse = () => {
    Animated.timing(collapseAnim, {
      toValue: collapsed ? 0 : 1,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setCollapsed(v => !v);
  };

  // ── Auth ──
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      const path = pathnameRef.current;
      if (!user) {
        if (path !== "/admin/login") router.replace("/admin/login");
        setChecking(false);
        return;
      }
      let snap;
      try {
        snap = await getDoc(doc(db, "users", user.uid));
      } catch (err) {
        console.error("[Admin] Failed to fetch user doc:", err);
        await signOut(auth);
        router.replace("/admin/login");
        setChecking(false);
        return;
      }
      if (!snap.exists() || snap.data()?.role !== "admin") {
        await signOut(auth);
        router.replace("/admin/login");
        setChecking(false);
        return;
      }
      const data = snap.data();
      setAdminName(data?.fullName || data?.displayName || user.displayName || "Admin");
      if (path === "/admin/login") router.replace("/admin");
      setChecking(false);
    });
    return unsub;
  }, [router]);

  const confirmLogout = () => {
    const doLogout = async () => {
      try { await signOut(auth); } catch {}
      router.replace("/admin/login");
    };
    if (Platform.OS === "web") {
      if (window.confirm("Log out?")) void doLogout();
      return;
    }
    Alert.alert("Log out?", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: doLogout },
    ]);
  };

  const pageTitle = useMemo(
    () => navItems.find(i => i.href === pathname)?.label ?? "Dashboard",
    [pathname]
  );

  // ── Loading ──
  if (checking) {
    const tx = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#08080e" }}>
        <View style={{ width: 180, height: 3, borderRadius: 99, backgroundColor: "#1a1a2e", overflow: "hidden", marginBottom: 14 }}>
          <Animated.View style={{ position: "absolute", top: 0, bottom: 0, width: 80, backgroundColor: "#3f3f46", transform: [{ translateX: tx }] }} />
        </View>
        <Text style={{ color: "#52525b", fontSize: 13 }}>Loading…</Text>
      </View>
    );
  }

  if (pathname === "/admin/login") {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: S.pageBg, padding: 12, gap: 12 }}>

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <Animated.View style={[
        {
          width: sidebarWidth,
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: S.bg,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: S.border,
          shadowColor: "#000",
          shadowOpacity: isDark ? 0 : 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        glassStyle,
      ]}>

        {/* ── Logo row ── */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: collapsed ? 0 : 16,
          paddingRight: collapsed ? 0 : 10,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: S.divider,
          justifyContent: collapsed ? "center" : "space-between",
          minHeight: 60,
        }}>
          {/* Logo: hidden when collapsed */}
          <TouchableOpacity
            onPress={() => router.push("/admin" as any)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: collapsed ? 0 : 1, overflow: "hidden", display: collapsed ? "none" : "flex" }}
          >
            <Animated.View style={{
              opacity: logoOpacity,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}>
              <View style={{
                width: 28, height: 28,
                borderRadius: 8,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Image
                  source={require("../../assets/images/spendly-logo.png")}
                  style={{ width: 22, height: 22 }}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={{ color: S.text, fontSize: 14, fontWeight: "700", letterSpacing: -0.3 }}>
                  Spendly
                </Text>
                <Text style={{ color: S.muted, fontSize: 10 }}>Admin</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* Collapse toggle */}
          <TouchableOpacity
            onPress={toggleCollapse}
            style={{
              width: 26, height: 26,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: S.activeBg,
              borderWidth: 1,
              borderColor: S.activeBg,
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            {collapsed
              ? <ChevronsRight size={12} color={S.activeText} strokeWidth={2} />
              : <ChevronsLeft  size={12} color={S.activeText} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Nav ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 14, paddingBottom: 12 }}
        >
          {navSections.map(section => (
            <View key={section.label} style={{ marginBottom: 14 }}>
              <Animated.Text style={{
                opacity: sectionLabelOpacity,
                color: S.muted,
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 0.9,
                textTransform: "uppercase",
                paddingHorizontal: 8,
                marginBottom: 4,
              }}>
                {section.label}
              </Animated.Text>

              <View style={{
                backgroundColor: S.sectionBg,
                borderWidth: 1,
                borderColor: S.sectionBorder,
                borderRadius: collapsed ? 28 : 18,
                padding: 6,
                gap: 2,
              }}>
                {section.items.map(item => {
                  const isActive  = pathname === item.href;
                  const isHovered = hoveredNav === item.href;
                  return (
                    <NavItem
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      isHovered={isHovered}
                      collapsed={collapsed}
                      labelOpacity={labelOpacity}
                      S={S}
                      onPress={() => router.push(item.href as any)}
                      onHoverIn={() => setHoveredNav(item.href)}
                      onHoverOut={() => setHoveredNav(null)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ── Bottom: user + logout ── */}
        <View style={{ borderTopWidth: 1, borderTopColor: S.divider, padding: 10, gap: 4 }}>
          {/* User card */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? 0 : 10,
            borderRadius: collapsed ? 999 : 12,
            backgroundColor: collapsed ? "transparent" : S.userCard,
            borderWidth: collapsed ? 0 : 1,
            borderColor: S.userBorder,
            justifyContent: collapsed ? "center" : "flex-start",
            alignSelf: collapsed ? "center" : "stretch",
          }}>
            {/* Avatar */}
            <View style={{ position: "relative", flexShrink: 0 }}>
              <View style={{
                width: 28, height: 28,
                borderRadius: 14,
                backgroundColor: S.avatarBg,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: S.border,
              }}>
                <Text style={{ color: S.text, fontSize: 11, fontWeight: "700" }}>
                  {adminName.charAt(0).toUpperCase()}
                </Text>
              </View>
              {/* Online dot — no glow */}
              <View style={{
                position: "absolute",
                bottom: 0, right: 0,
                width: 7, height: 7,
                borderRadius: 4,
                backgroundColor: "#22c55e",
                borderWidth: 1.5,
                borderColor: isDark ? "#0e0e14" : "#f4f4f6",
              }} />
            </View>

            {/* Name */}
            {!collapsed && (
              <Animated.View style={{ opacity: labelOpacity, flex: 1, overflow: "hidden" }}>
                <Text style={{ color: S.text, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                  {adminName}
                </Text>
                <Text style={{ color: S.muted, fontSize: 10 }}>Administrator</Text>
              </Animated.View>
            )}
          </View>

          {/* Logout */}
          <TouchableOpacity
            onPress={confirmLogout}
            {...(Platform.OS === "web" ? ({
              onMouseEnter: () => setHoveredNav("__logout__"),
              onMouseLeave: () => setHoveredNav(null),
            } as any) : {})}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 9,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: hoveredNav === "__logout__" ? "rgba(239,68,68,0.07)" : "transparent",
            }}
          >
            <LogOut
              size={14}
              color={hoveredNav === "__logout__" ? "#ef4444" : S.logoutText}
              strokeWidth={1.8}
            />
            {!collapsed && (
              <Animated.Text style={{
                opacity: labelOpacity,
                color: hoveredNav === "__logout__" ? "#ef4444" : S.logoutText,
                fontSize: 13,
              }}>
                Log out
              </Animated.Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ══════════════════ MAIN ══════════════════ */}
      <View style={{
        flex: 1,
        backgroundColor: S.bg,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: S.border,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        ...(Platform.OS === "web" ? { overflowY: "auto" } as any : {}),
      }}>
        {/* Top bar */}
        <View style={[
          {
            height: 60,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            borderBottomWidth: 1,
            borderBottomColor: S.topbarBorder,
            backgroundColor: S.topbar,
          },
          glassStyle,
        ]}>
          <Text style={{ color: S.topbarText, fontSize: 14, fontWeight: "600", letterSpacing: -0.2 }}>
            {pageTitle}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Notifications */}
            <TouchableOpacity
              onPress={() => router.push("/admin/notifications" as any)}
              style={{
                width: 32, height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: S.activeBg,
                borderWidth: 1,
                borderColor: S.activeBg,
              }}
            >
              <Bell size={14} color={S.activeText} strokeWidth={1.8} />
              <View style={{
                position: "absolute",
                top: 7, right: 7,
                width: 5, height: 5,
                borderRadius: 3,
                backgroundColor: "#ef4444",
              }} />
            </TouchableOpacity>

            {/* Theme toggle */}
            <TouchableOpacity
              onPress={() => setMode(isDark ? "light" : "dark")}
              style={{
                width: 32, height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: S.activeBg,
                borderWidth: 1,
                borderColor: S.activeBg,
              }}
            >
              {isDark
                ? <Moon size={14} color={S.activeText} strokeWidth={1.8} />
                : <Sun  size={14} color={S.activeText} strokeWidth={1.8} />
              }
            </TouchableOpacity>
          </View>
        </View>

        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

type NavItemProps = {
  item: { label: string; href: string; icon: any };
  isActive: boolean;
  isHovered: boolean;
  collapsed: boolean;
  labelOpacity: Animated.AnimatedInterpolation<number>;
  S: Record<string, string>;
  onPress: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
};

function NavItem({
  item, isActive, isHovered, collapsed,
  labelOpacity, S, onPress, onHoverIn, onHoverOut,
}: NavItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const Icon = item.icon;

  const handleHoverIn = () => {
    onHoverIn();
    if (collapsed) setShowTooltip(true);
  };
  const handleHoverOut = () => {
    onHoverOut();
    setShowTooltip(false);
  };

  return (
    <View style={{ position: "relative", marginBottom: 3, alignItems: collapsed ? "center" : "stretch" }}>
      <TouchableOpacity
        onPress={onPress}
        {...(Platform.OS === "web" ? ({
          onMouseEnter: handleHoverIn,
          onMouseLeave: handleHoverOut,
        } as any) : {})}
        style={collapsed ? {
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: isActive
            ? S.activeBg
            : isHovered
            ? S.hoverBg
            : "transparent",
        } : {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 999,
          justifyContent: "flex-start",
          backgroundColor: isActive
            ? S.activeBg
            : isHovered
            ? S.hoverBg
            : "transparent",
        }}
      >
        <Icon
          size={16}
          color={
            isActive  ? S.activeText
            : isHovered ? S.text
            : S.muted
          }
          strokeWidth={isActive ? 2.2 : 1.8}
        />

        {!collapsed && (
          <Animated.Text style={{
            opacity: labelOpacity,
            color: isActive ? S.activeText : isHovered ? S.text : S.muted,
            fontSize: 13,
            fontWeight: isActive ? "600" : "400",
            flex: 1,
          }}>
            {item.label}
          </Animated.Text>
        )}
      </TouchableOpacity>

      {/* Tooltip (collapsed mode) */}
      {collapsed && showTooltip && Platform.OS === "web" && (
        <View style={{
          position: "absolute",
          left: COLLAPSED_W - 4,
          top: "50%" as any,
          transform: [{ translateY: -13 }],
          zIndex: 999,
          backgroundColor: S.bg,
          borderRadius: 7,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: S.border,
          pointerEvents: "none" as any,
          ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } as any : {}),
        }}>
          <Text style={{ color: S.text, fontSize: 12, fontWeight: "500" }}>
            {item.label}
          </Text>
        </View>
      )}
    </View>
  );
}
