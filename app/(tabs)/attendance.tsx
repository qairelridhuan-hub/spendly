import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, useCalendar } from "@/lib/context";
import { Image } from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  loadAttendanceData,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  ATTENDANCE_CONFIG,
  type WorkplaceSettings,
  type TodayAttendanceState,
} from "../../src/utils/attendanceFetch";
import {
  requestLocationPermission,
  getCurrentLocation,
  isWithinAllowedRadius,
} from "../../src/utils/locationHelpers";
import { captureSelfie } from "../../src/utils/selfieHelper";
import {
  Bell,
  CheckCircle2,
  Clock,
  Gamepad2,
  LogOut,
  MapPin,
  Moon,
  Sun,
  WifiOff,
  X,
} from "lucide-react-native";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type ReadyState = {
  phase: "ready";
  userId: string;
  displayName: string;
  workplace: WorkplaceSettings;
  today: TodayAttendanceState;
  withinRadius: boolean;
  locationDenied: boolean;
};

type ScreenState =
  | { phase: "loading" }
  | { phase: "error"; reason: string }
  | ReadyState;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserInfo(): Promise<{ uid: string; displayName: string } | null> {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { resolve(null); return; }
      // Try Firestore name first, fallback to auth displayName
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const name = snap.data()?.name ?? snap.data()?.displayName ?? user.displayName ?? "there";
        resolve({ uid: user.uid, displayName: name });
      } catch {
        resolve({ uid: user.uid, displayName: user.displayName ?? "there" });
      }
    });
  });
}

async function resolveLocation(workplace: WorkplaceSettings) {
  const granted = await requestLocationPermission();
  if (!granted) return { granted: false, coords: null, withinRadius: false };
  try {
    const coords = await getCurrentLocation();
    const within = isWithinAllowedRadius(
      coords.latitude, coords.longitude,
      workplace.workplaceLatitude, workplace.workplaceLongitude,
      workplace.allowedRadiusMeters
    );
    return { granted: true, coords, withinRadius: within };
  } catch {
    return { granted: true, coords: null, withinRadius: false };
  }
}

function formatTime(date: Date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// ─── Shift helpers ────────────────────────────────────────────────────────────

type Shift = { date: string; start: string; end: string; status?: string };

function getNextShift(shifts: Shift[]) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return shifts
    .filter(s => {
      if (s.date > todayKey) return true;
      if (s.date < todayKey) return false;
      const [h, m] = s.start.split(":").map(Number);
      return (h || 0) * 60 + (m || 0) > currentMinutes;
    })
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))[0] ?? null;
}

function formatDateLabel(value: string) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (value === today) return "Today";
  if (value === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const { colors: c, mode, toggleTheme } = useTheme();
  const { shifts } = useCalendar();

  const handleLogout = async () => {
    try { await signOut(auth); router.replace("/login"); } catch {}
  };
  const [state, setState]               = useState<ScreenState>({ phase: "loading" });
  const [actionLoading, setActionLoading] = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [pendingAction, setPendingAction] = useState<"clock-in" | "clock-out" | null>(null);
  const [now, setNow]                   = useState(new Date());
  const slideAnim                       = useRef(new Animated.Value(SCREEN_H)).current;

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Modal animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: showModal ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [showModal]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setState({ phase: "loading" });

    const userInfo = await getUserInfo();
    if (!userInfo) { setState({ phase: "error", reason: "Not signed in." }); return; }

    const result = await loadAttendanceData(userInfo.uid);

    const workplace = result.ok ? result.workplace : {
      workplaceId: "dev",
      workplaceLatitude: 0,
      workplaceLongitude: 0,
      allowedRadiusMeters: 9999999,
    };
    const today = result.ok ? result.today : { clockedIn: false, clockedOut: false, onBreak: false };

    const { granted, withinRadius } = await resolveLocation(workplace);

    setState({
      phase: "ready",
      userId: userInfo.uid,
      displayName: userInfo.displayName,
      workplace,
      today,
      withinRadius: result.ok ? withinRadius : true,
      locationDenied: !granted,
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Action ────────────────────────────────────────────────────────────────

  type AttendanceAction = "clock-in" | "clock-out" | "break-start" | "break-end";

  const needsSelfie = (action: AttendanceAction) =>
    action === "clock-in" || action === "clock-out" ||
    (ATTENDANCE_CONFIG.requireSelfieForBreak && (action === "break-start" || action === "break-end"));

  const runAttendanceAction = async (action: AttendanceAction) => {
    if (state.phase !== "ready" || actionLoading) return;
    setActionLoading(true);
    setShowModal(false);

    try {
      const { granted, coords, withinRadius } = await resolveLocation(state.workplace);
      if (!granted) { Alert.alert("Permission Required", "Location permission is needed."); return; }
      if (!withinRadius || !coords) {
        Alert.alert("Outside Workplace", `You must be within ${state.workplace.allowedRadiusMeters}m of your workplace.`);
        return;
      }

      let selfieUrl: string | undefined;
      if (needsSelfie(action)) {
        const selfie = await captureSelfie(state.userId, action === "clock-in" || action === "clock-out" ? action : "clock-in");
        if (!selfie.captured) {
          if (selfie.reason === "cancelled") return;
          if (selfie.reason === "permission-denied") { Alert.alert("Camera Required", "Camera permission is needed."); return; }
          Alert.alert("Upload Failed", "Could not upload selfie. Please try again.");
          return;
        }
        selfieUrl = selfie.url;
      }

      if (action === "clock-in")      await clockIn(state.userId, coords, selfieUrl!, state.workplace);
      else if (action === "clock-out") await clockOut(state.userId, coords, selfieUrl!, state.workplace);
      else if (action === "break-start") await startBreak(state.userId, coords, state.workplace, selfieUrl);
      else                             await endBreak(state.userId, coords, state.workplace, state.today.breakStartTs, selfieUrl);

      await load();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirm = (action: "clock-in" | "clock-out") => {
    setPendingAction(action);
    setShowModal(true);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (state.phase === "loading") {
    return (
      <View style={[s.loadingCenter, { backgroundColor: c.backgroundStart }]}>
        <ActivityIndicator size="large" color={c.text} />
        <Text style={[s.loadingText, { color: c.textMuted }]}>Loading attendance…</Text>
      </View>
    );
  }

  if (state.phase === "error") {
    return (
      <View style={[s.loadingCenter, { backgroundColor: c.backgroundStart }]}>
        <Text style={[s.errorText, { color: c.text }]}>{state.reason}</Text>
        <TouchableOpacity style={[s.retryBtn, { borderColor: c.border }]} onPress={load}>
          <Text style={[s.retryText, { color: c.text }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  const { today, withinRadius, locationDenied, workplace, displayName } = state;

  const checkedIn  = today.clockedIn && !today.clockedOut;
  const checkedOut = today.clockedOut;
  const onBreak    = today.onBreak;

  const statusLabel = checkedOut
    ? "Checked out"
    : onBreak
    ? "On break"
    : checkedIn
    ? "Checked in"
    : "Not checked in yet";

  const statusDotColor = checkedOut ? "#9ca3af" : checkedIn ? "#22c55e" : "#9ca3af";

  const locationIcon = locationDenied ? "#ca8a04" : withinRadius ? "#16a34a" : "#dc2626";
  const nextShift = getNextShift(shifts as Shift[]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: c.backgroundStart }]} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header (matches calendar/home) ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <TouchableOpacity style={[s.logo, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Image
                source={require("../../assets/images/spendly-logo.png")}
                style={s.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View>
              <Text style={[s.appName, { color: c.text }]}>Spendly</Text>
              <Text style={[s.headerGreet, { color: c.textMuted }]}>Hey, {state.phase === "ready" ? state.displayName : "…"}!</Text>
            </View>
          </View>
          <View style={[s.iconPill, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TouchableOpacity style={s.iconPillBtn} onPress={toggleTheme}>
              {mode === "dark" ? <Moon size={20} color={c.text} /> : <Sun size={20} color={c.text} />}
            </TouchableOpacity>
            <View style={[s.iconPillDivider, { backgroundColor: c.border }]} />
            <TouchableOpacity style={s.iconPillBtn} onPress={() => router.push("/game")}>
              <Gamepad2 size={20} color={c.text} />
            </TouchableOpacity>
            <View style={[s.iconPillDivider, { backgroundColor: c.border }]} />
            <TouchableOpacity style={s.iconPillBtn} onPress={() => router.push("/notifications")}>
              <Bell size={20} color={c.text} />
            </TouchableOpacity>
            <View style={[s.iconPillDivider, { backgroundColor: c.border }]} />
            <TouchableOpacity style={s.iconPillBtn} onPress={handleLogout}>
              <LogOut size={20} color={c.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Time Card ── */}

        <View style={[s.timeCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.timeCardLabel, { color: c.textMuted }]}>CURRENT TIME</Text>
          <Text style={[s.timeCardClock, { color: c.text }]}>{formatTime(now)}</Text>
          <Text style={[s.timeCardDate, { color: c.textMuted }]}>{formatDate(now)}</Text>
        </View>

        {/* ── Clock timestamps + buttons ── */}
        <View style={[s.shiftCard, { backgroundColor: c.surface, borderColor: c.border }]}>

          {/* Timestamps row */}
          <View style={s.stampsRow}>
            <View style={s.stampCol}>
              <Text style={[s.clockLabel, { color: c.textMuted }]}>Clock in</Text>
              <Text style={[s.clockValue, { color: c.text }]}>{today.clockIn ?? "--:--"}</Text>
            </View>
            <View style={[s.stampDivider, { backgroundColor: c.border }]} />
            <View style={s.stampCol}>
              <Text style={[s.clockLabel, { color: c.textMuted }]}>Clock out</Text>
              <Text style={[s.clockValue, { color: c.text }]}>{today.clockOut ?? "--:--"}</Text>
            </View>
            <View style={[s.stampDivider, { backgroundColor: c.border }]} />
            <View style={s.stampCol}>
              <Text style={[s.clockLabel, { color: c.textMuted }]}>Break</Text>
              <Text style={[s.clockValue, { color: c.text }]}>
                {today.breakStart
                  ? today.breakEnd ? `${today.breakStart}–${today.breakEnd}` : `${today.breakStart}–...`
                  : "--:--"}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={s.clockActions}>
            <TouchableOpacity
              style={[s.clockBtn, checkedIn || checkedOut ? { backgroundColor: c.border } : { backgroundColor: c.text }]}
              onPress={() => !checkedIn && !checkedOut && openConfirm("clock-in")}
              disabled={checkedIn || checkedOut || actionLoading}
            >
              <Text style={[s.clockBtnText, { color: checkedIn || checkedOut ? c.textMuted : c.backgroundStart }]}>
                Clock in
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.clockBtn, (!checkedIn || checkedOut || onBreak) ? { backgroundColor: c.border } : { backgroundColor: c.text }]}
              onPress={() => checkedIn && !checkedOut && !onBreak && openConfirm("clock-out")}
              disabled={!checkedIn || checkedOut || onBreak || actionLoading}
            >
              <Text style={[s.clockBtnText, { color: !checkedIn || checkedOut ? c.textMuted : c.backgroundStart }]}>
                Clock out
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.clockBtn, { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }]}
              onPress={() => checkedIn && (onBreak ? runAttendanceAction("break-end") : runAttendanceAction("break-start"))}
              disabled={!checkedIn || checkedOut || actionLoading}
            >
              <Text style={[s.clockBtnText, { color: c.text }]}>
                {onBreak ? "End break" : "Break"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {/* reset handled by admin */}}>
              <Text style={s.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Upcoming shift */}
          <View style={[s.upcomingRow, { borderTopColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.upcomingLabel, { color: c.textMuted }]}>Upcoming shift</Text>
              <Text style={[s.shiftMeta, { color: c.text }]}>
                {nextShift
                  ? `${formatDateLabel(nextShift.date)} · ${nextShift.start} – ${nextShift.end}`
                  : "No upcoming shift"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Work Details ── */}
        <Text style={[s.sectionTitle, { color: c.text }]}>Work Details</Text>

        <View style={[s.detailCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.detailIconBg, { backgroundColor: c.surfaceAlt }]}>
            <Clock size={18} color={c.text} strokeWidth={1.8} />
          </View>
          <View style={s.detailBody}>
            <Text style={[s.detailTitle, { color: c.text }]}>Work Hours</Text>
            <Text style={[s.detailSub, { color: c.textMuted }]}>Today's record</Text>
          </View>
          <Text style={[s.detailRight, { color: c.text }]}>
            {today.clockIn ? (today.clockOut ? today.clockOut : "Active") : "—"}
          </Text>
        </View>

        <View style={[s.detailCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.detailIconBg, { backgroundColor: c.surfaceAlt }]}>
            <MapPin size={18} color={locationIcon} strokeWidth={1.8} />
          </View>
          <View style={s.detailBody}>
            <Text style={[s.detailTitle, { color: c.text }]}>Location Zone</Text>
            <Text style={[s.detailSub, { color: c.textMuted }]}>
              {locationDenied ? "Permission denied" : withinRadius ? "Within workplace" : `Outside (${workplace.allowedRadiusMeters}m radius)`}
            </Text>
          </View>
          {withinRadius && !locationDenied && <CheckCircle2 size={18} color="#16a34a" strokeWidth={1.8} />}
        </View>

        <View style={[s.detailCard, { backgroundColor: c.surface, borderColor: c.border, marginBottom: 32 }]}>
          <View style={[s.detailIconBg, { backgroundColor: c.surfaceAlt }]}>
            <WifiOff size={18} color={c.text} strokeWidth={1.8} />
          </View>
          <View style={s.detailBody}>
            <Text style={[s.detailTitle, { color: c.text }]}>Verification</Text>
            <Text style={[s.detailSub, { color: c.textMuted }]}>Selfie + GPS required</Text>
          </View>
          <CheckCircle2 size={18} color="#16a34a" strokeWidth={1.8} />
        </View>

      </ScrollView>

      {/* ── Confirm Modal ── */}
      <Modal transparent visible={showModal} animationType="none" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        <Animated.View style={[s.modalSheet, { backgroundColor: c.surface, transform: [{ translateY: slideAnim }] }]}>
          <View style={[s.modalHandle, { backgroundColor: c.border }]} />

          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: c.text }]}>Attendance System</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={20} color={c.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          <View style={[s.locationBadge, { backgroundColor: c.surfaceAlt }]}>
            <CheckCircle2 size={14} color="#16a34a" strokeWidth={2} />
            <Text style={[s.locationBadgeText, { color: c.text }]}>Location Detected</Text>
          </View>

          <Text style={[s.modalReadyText, { color: c.text }]}>
            {pendingAction === "clock-in" ? "Ready to Check In" : "Ready to Check Out"}
          </Text>

          <View style={s.mapPlaceholder}>
            <View style={[s.mapGradient, { backgroundColor: c.surfaceAlt }]}>
              <MapPin size={28} color={c.text} strokeWidth={1.8} />
            </View>
          </View>

          <Text style={[s.modalWorkplace, { color: c.text }]}>
            {workplace.workplaceId === "dev" ? "Your Workplace" : workplace.workplaceId}
          </Text>

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: c.text }]}
            onPress={() => pendingAction && runAttendanceAction(pendingAction)}
            activeOpacity={0.9}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color={c.backgroundStart} />
              : <Text style={[s.confirmBtnText, { color: c.backgroundStart }]}>
                  Confirm {pendingAction === "clock-in" ? "Check-In" : "Check-Out"}
                </Text>
            }
          </TouchableOpacity>

          <Text style={[s.modalSecondary, { color: c.textMuted }]}>Not at this location?</Text>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:             { flex: 1 },
  scroll:           { padding: 16, paddingTop: 20, paddingBottom: 120 },

  // Header — matches calendar/home exactly
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
  logo:             { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  logoImage:        { width: 24, height: 24 },
  appName:          { fontWeight: "700", fontSize: 16 },
  headerGreet:      { fontSize: 13 },
  iconPill:         { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  iconPillBtn:      { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  iconPillDivider:  { width: 1, height: 16 },
  loadingCenter:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { fontSize: 13 },
  errorText:        { fontSize: 14, fontWeight: "600", textAlign: "center" },
  retryBtn:         { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  retryText:        { fontSize: 13, fontWeight: "600" },

  // Greeting
  greetRow:         { marginBottom: 20 },
  greetText:        { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  statusBadge:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  statusDot:        { width: 7, height: 7, borderRadius: 4 },
  statusLabel:      { fontSize: 13 },

  // Time card
  timeCard:         { borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  timeCardLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 },
  timeCardClock:    { fontSize: 52, fontWeight: "800", letterSpacing: -1 },
  timeCardDate:     { fontSize: 14, marginTop: 4 },

  // Shift card
  shiftCard:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  stampsRow:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  stampCol:         { alignItems: "center", flex: 1 },
  stampDivider:     { width: 1 },
  clockLabel:       { fontSize: 9, fontWeight: "500" },
  clockValue:       { fontWeight: "700", marginTop: 2, fontSize: 11 },
  clockActions:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  clockBtn:         { flex: 1, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8, alignItems: "center" },
  clockBtnText:     { fontWeight: "600", fontSize: 11 },
  resetText:        { fontSize: 10, fontWeight: "600", color: "#ef4444", paddingHorizontal: 4 },
  upcomingRow:      { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  upcomingLabel:    { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  shiftMeta:        { fontSize: 12 },

  // Work details
  sectionTitle:     { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  detailCard:       { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  detailIconBg:     { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 14 },
  detailBody:       { flex: 1 },
  detailTitle:      { fontSize: 14, fontWeight: "700" },
  detailSub:        { fontSize: 12, marginTop: 2 },
  detailRight:      { fontSize: 13, fontWeight: "700" },

  // Modal
  modalOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet:       { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle:      { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle:       { fontSize: 17, fontWeight: "800" },
  locationBadge:    { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 12 },
  locationBadgeText:{ fontSize: 12, fontWeight: "700" },
  modalReadyText:   { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  mapPlaceholder:   { alignSelf: "center", marginBottom: 12 },
  mapGradient:      { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center" },
  modalWorkplace:   { fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  confirmBtn:       { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  confirmBtnText:   { fontSize: 15, fontWeight: "800" },
  modalSecondary:   { fontSize: 12, textAlign: "center" },
});
