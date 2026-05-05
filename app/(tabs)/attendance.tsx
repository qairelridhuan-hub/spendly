import { useCallback, useEffect, useRef, useState } from "react";
import { cardShadow } from "@/lib/shadows";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, useCalendar } from "@/lib/context";
import { router } from "expo-router";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  loadAttendanceData,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  type WorkplaceSettings,
  type TodayAttendanceState,
} from "../../src/utils/attendanceFetch";
import {
  requestLocationPermission,
  getCurrentLocation,
  isWithinAllowedRadius,
  calculateDistanceInMeters,
} from "../../src/utils/locationHelpers";
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
import { ScreenTransition } from "@/components/ScreenTransition";
import WebView from "react-native-webview";
import { Map, MapControls } from "@/components/ui/map";

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
  distanceMeters: number | null;
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
  if (!granted) return { granted: false, coords: null, withinRadius: false, distanceMeters: null };
  try {
    const coords = await getCurrentLocation();
    const distance = calculateDistanceInMeters(
      coords.latitude, coords.longitude,
      workplace.workplaceLatitude, workplace.workplaceLongitude,
    );
    const within = distance <= workplace.allowedRadiusMeters;
    return { granted: true, coords, withinRadius: within, distanceMeters: Math.round(distance) };
  } catch {
    return { granted: true, coords: null, withinRadius: false, distanceMeters: null };
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

const TILE_H = 84;
const TILE_W = 80;
const TILE_FONT = 50;

function FlipTile({ value, colors: c }: { value: string; colors: any }) {
  const prevRef = useRef(value);
  const anim = useRef(new Animated.Value(0)).current;
  const [prev, setPrev] = useState(value);
  const [next, setNext] = useState(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    const old = prevRef.current;
    prevRef.current = value;
    setPrev(old);
    setNext(value);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value]);

  // outgoing: slides up + fades out
  const outY   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -TILE_H * 0.35] });
  const outOp  = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  // incoming: slides up from below + fades in
  const inY    = anim.interpolate({ inputRange: [0, 1], outputRange: [TILE_H * 0.35, 0] });
  const inOp   = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

  const digitStyle: any = {
    fontSize: TILE_FONT, fontWeight: "800", color: "#fff",
    textAlign: "center", fontVariant: ["tabular-nums"],
  };

  return (
    <View style={{ width: TILE_W, height: TILE_H, borderRadius: 16, overflow: "hidden", backgroundColor: "#1a1a1a", justifyContent: "center", alignItems: "center" }}>
      {/* Outgoing number */}
      <Animated.Text style={[digitStyle, { position: "absolute", opacity: outOp, transform: [{ translateY: outY }] }]}>
        {prev}
      </Animated.Text>
      {/* Incoming number */}
      <Animated.Text style={[digitStyle, { position: "absolute", opacity: inOp, transform: [{ translateY: inY }] }]}>
        {next}
      </Animated.Text>
      {/* Centre divider */}
      <View style={{ position: "absolute", top: TILE_H / 2 - 1, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.08)" }} pointerEvents="none" />
    </View>
  );
}

function FlipClock({ now, colors: c }: { now: Date; colors: any }) {
  let h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const hStr = String(h).padStart(2, "0");
  const mStr = String(m).padStart(2, "0");
  const sStr = String(s).padStart(2, "0");

  const dot = <Text style={{ fontSize: 28, fontWeight: "900", color: c.text, marginBottom: 6, marginHorizontal: 4 }}>:</Text>;

  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <FlipTile value={hStr} colors={c} />
        {dot}
        <FlipTile value={mStr} colors={c} />
        {dot}
        <FlipTile value={sStr} colors={c} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.textMuted, letterSpacing: 2 }}>{ampm}</Text>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

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
  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (value === today)    return "Today";
  if (value === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Map HTML ────────────────────────────────────────────────────────────────

function buildAttendanceMapHtml(
  wpLat: number, wpLng: number, radius: number,
  userLat?: number, userLng?: number,
  inside?: boolean,
): string {
  const centerLat = userLat ?? wpLat;
  const centerLng = userLng ?? wpLng;
  const zoneColor = inside ? "#16a34a" : "#dc2626";
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body,#map { width:100%; height:100%; background:#f1f5f9; }
    .leaflet-control-zoom { display:none; }
    .leaflet-control-attribution { display:none; }

    /* Custom controls panel */
    #controls {
      position:absolute;
      right:12px;
      bottom:12px;
      z-index:1000;
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .ctrl-btn {
      width:36px;
      height:36px;
      background:#fff;
      border:none;
      border-radius:10px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      box-shadow:0 1px 6px rgba(0,0,0,0.12);
      font-size:18px;
      line-height:1;
      color:#18181b;
      font-family:sans-serif;
      -webkit-tap-highlight-color:transparent;
    }
    .ctrl-btn:active { background:#f4f4f5; }
    .ctrl-divider {
      width:36px;
      height:1px;
      background:#e4e4e7;
    }

    /* Viewport info */
    #info {
      position:absolute;
      left:10px;
      top:10px;
      z-index:1000;
      background:rgba(255,255,255,0.85);
      backdrop-filter:blur(6px);
      -webkit-backdrop-filter:blur(6px);
      border-radius:8px;
      padding:6px 10px;
      font-size:10px;
      color:#52525b;
      font-family:monospace;
      line-height:1.7;
      pointer-events:none;
    }

    /* Fullscreen */
    body.fs #map { position:fixed; top:0;left:0;width:100vw;height:100vh;z-index:9999; }
    body.fs #controls { position:fixed; }
    body.fs #info { position:fixed; }
  </style>
</head>
<body>
<div id="map"></div>
<div id="info">— —</div>
<div id="controls">
  <button class="ctrl-btn" id="btn-fs" title="Fullscreen">⤢</button>
  <button class="ctrl-btn" id="btn-loc" title="My location">◎</button>
  <div class="ctrl-divider"></div>
  <button class="ctrl-btn" id="btn-plus" title="Zoom in">+</button>
  <button class="ctrl-btn" id="btn-minus" title="Zoom out">−</button>
</div>
<script>
  var map = L.map('map', { zoomControl:false, attributionControl:false })
    .setView([${centerLat}, ${centerLng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

  // Zone circle
  L.circle([${wpLat}, ${wpLng}], {
    radius: ${radius}, color: '${zoneColor}', fillColor: '${zoneColor}',
    fillOpacity: 0.12, weight: 2
  }).addTo(map);

  // Workplace marker
  var wpIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:#18181b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.4)"></div>',
    iconSize:[14,14], iconAnchor:[7,7], className:''
  });
  L.marker([${wpLat}, ${wpLng}], { icon: wpIcon })
    .bindTooltip('Workplace', { permanent:true, direction:'top', offset:[0,-10] })
    .addTo(map);

  ${userLat != null ? `
  // User marker
  var userIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;background:${zoneColor};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.4)"></div>',
    iconSize:[14,14], iconAnchor:[7,7], className:''
  });
  L.marker([${userLat}, ${userLng}], { icon: userIcon })
    .bindTooltip('You', { permanent:true, direction:'top', offset:[0,-10] })
    .addTo(map);
  var userLatLng = L.latLng(${userLat}, ${userLng});
  ` : "var userLatLng = null;"}

  var wpLatLng = L.latLng(${wpLat}, ${wpLng});

  // Viewport info
  var info = document.getElementById('info');
  function updateInfo() {
    var c = map.getCenter();
    info.textContent = c.lng.toFixed(5) + '  ' + c.lat.toFixed(5) + '  z' + map.getZoom();
  }
  map.on('move zoom', updateInfo);
  updateInfo();

  // Controls
  document.getElementById('btn-plus').addEventListener('click', function(){ map.zoomIn(); });
  document.getElementById('btn-minus').addEventListener('click', function(){ map.zoomOut(); });

  var liveMarker = null;
  document.getElementById('btn-loc').addEventListener('click', function(){
    if (!navigator.geolocation) {
      map.setView(userLatLng || wpLatLng, 17, { animate:true });
      return;
    }
    navigator.geolocation.getCurrentPosition(function(pos) {
      var ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      map.setView(ll, 17, { animate:true });
      if (liveMarker) { map.removeLayer(liveMarker); }
      var liveIcon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(37,99,235,0.5)"></div>',
        iconSize:[14,14], iconAnchor:[7,7], className:''
      });
      liveMarker = L.marker(ll, { icon: liveIcon })
        .bindTooltip('You (live)', { permanent:true, direction:'top', offset:[0,-10] })
        .addTo(map);
    }, function() {
      var target = userLatLng || wpLatLng;
      map.setView(target, 17, { animate:true });
    }, { enableHighAccuracy:true, timeout:8000 });
  });

  var fsActive = false;
  document.getElementById('btn-fs').addEventListener('click', function(){
    fsActive = !fsActive;
    document.body.classList.toggle('fs', fsActive);
    this.textContent = fsActive ? '⤡' : '⤢';
    setTimeout(function(){ map.invalidateSize(); }, 100);
  });
</script>
</body>
</html>`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const { colors: c, mode, toggleTheme } = useTheme();
  const { shifts } = useCalendar();

  const [state, setState]             = useState<ScreenState>({ phase: "loading" });
  const [actionLoading, setActionLoading] = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [pendingAction, setPendingAction] = useState<"clock-in" | "clock-out" | "break-start" | "break-end" | null>(null);
  const [now, setNow]                 = useState(new Date());
  const [userCoords, setUserCoords]   = useState<{ latitude: number; longitude: number } | null>(null);
  const slideAnim                     = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: showModal ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [showModal]);

  const handleLogout = async () => {
    try { await signOut(auth); router.replace("/login"); } catch {}
  };

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
    const { granted, withinRadius, coords, distanceMeters } = await resolveLocation(workplace);
    if (coords) setUserCoords(coords);

    setState({
      phase: "ready",
      userId: userInfo.uid,
      displayName: userInfo.displayName,
      workplace,
      today,
      withinRadius: result.ok ? withinRadius : true,
      locationDenied: !granted,
      distanceMeters: result.ok ? distanceMeters : null,
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Action ────────────────────────────────────────────────────────────────

  type AttendanceAction = "clock-in" | "clock-out" | "break-start" | "break-end";

  const runAttendanceAction = async (action: AttendanceAction) => {
    if (state.phase !== "ready" || actionLoading) return;
    setActionLoading(true);
    setShowModal(false);

    try {
      const { granted, coords, withinRadius } = await resolveLocation(state.workplace);

      if (!granted) {
        Alert.alert("Permission Required", "Location permission is needed.");
        return;
      }
      if (!withinRadius || !coords) {
        Alert.alert("Outside Workplace", `You must be within ${state.workplace.allowedRadiusMeters}m of your workplace.`);
        return;
      }

      if (action === "clock-in")       await clockIn(state.userId, coords, state.workplace);
      else if (action === "clock-out") await clockOut(state.userId, coords, state.workplace);
      else if (action === "break-start") await startBreak(state.userId, coords, state.workplace);
      else                             await endBreak(state.userId, coords, state.workplace, state.today.breakStartTs);

      await load();
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirm = (action: "clock-in" | "clock-out" | "break-start" | "break-end") => {
    setPendingAction(action);
    setShowModal(true);
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

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

  // ── Ready (also renders during loading with safe defaults) ───────────────

  const isLoading = state.phase === "loading";
  const today        = state.phase === "ready" ? state.today        : { clockedIn: false, clockedOut: false, onBreak: false } as TodayAttendanceState;
  const withinRadius = state.phase === "ready" ? state.withinRadius : false;
  const locationDenied = state.phase === "ready" ? state.locationDenied : false;
  const distanceMeters = state.phase === "ready" ? state.distanceMeters : null;
  const workplace    = state.phase === "ready" ? state.workplace    : null;
  const displayName  = state.phase === "ready" ? state.displayName  : "";
  const checkedIn  = today.clockedIn && !today.clockedOut;
  const checkedOut = today.clockedOut;
  const onBreak    = today.onBreak;
  const nextShift  = getNextShift(shifts as Shift[]);

  const locationIcon = locationDenied ? "#ca8a04" : withinRadius ? "#16a34a" : "#dc2626";

  return (
    <ScreenTransition>
    <SafeAreaView style={[s.safe, { backgroundColor: c.backgroundStart }]} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <TouchableOpacity style={[s.logo, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Image source={require("../../assets/images/spendly-logo.png")} style={s.logoImage} resizeMode="contain" />
            </TouchableOpacity>
            <View>
              <Text style={[s.appName, { color: c.text }]}>Spendly</Text>
              <Text style={[s.headerGreet, { color: c.textMuted }]}>Hey, {displayName}!</Text>
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

        {/* ── Time card ── */}
        <View style={[s.timeCard, { backgroundColor: c.surface, borderColor: c.border, alignItems: "center" }]}>
          <Text style={[s.timeCardLabel, { color: c.textMuted, marginBottom: 16 }]}>CURRENT TIME</Text>
          <FlipClock now={now} colors={c} />
          <Text style={[s.timeCardDate, { color: c.textMuted, marginTop: 12 }]}>{formatDate(now)}</Text>
        </View>

        {/* ── Clock timestamps + buttons ── */}
        <View style={[s.shiftCard, { backgroundColor: c.surface, borderColor: c.border }]}>
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

          {/* ── Outside zone warning ── */}
          {workplace && workplace.workplaceId !== "dev" && !withinRadius && !locationDenied && !isLoading && (
            <View style={{ backgroundColor: "#fff7ed", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: "#fed7aa" }}>
              <MapPin size={15} color="#f97316" strokeWidth={2} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#c2410c", marginBottom: 2 }}>You are outside the workplace zone</Text>
                <Text style={{ fontSize: 11, color: "#9a3412", lineHeight: 16 }}>
                  Please go to your designated workplace location to clock in. Attendance is only allowed within {workplace?.allowedRadiusMeters ?? 15}m of the workplace.
                </Text>
              </View>
            </View>
          )}

          <View style={s.clockActions}>
            {/* Clock In */}
            <TouchableOpacity
              style={[s.clockBtn, checkedIn || checkedOut ? { backgroundColor: c.border } : { backgroundColor: c.text }]}
              onPress={() => !checkedIn && !checkedOut && openConfirm("clock-in")}
              disabled={checkedIn || checkedOut || actionLoading}
            >
              {actionLoading && pendingAction === null && !checkedIn ? (
                <ActivityIndicator size="small" color={c.backgroundStart} />
              ) : (
                <Text style={[s.clockBtnText, { color: checkedIn || checkedOut ? c.textMuted : c.backgroundStart }]}>Clock in</Text>
              )}
            </TouchableOpacity>

            {/* Clock Out */}
            <TouchableOpacity
              style={[s.clockBtn, (!checkedIn || checkedOut || onBreak) ? { backgroundColor: c.border } : { backgroundColor: c.text }]}
              onPress={() => checkedIn && !checkedOut && !onBreak && openConfirm("clock-out")}
              disabled={!checkedIn || checkedOut || onBreak || actionLoading}
            >
              <Text style={[s.clockBtnText, { color: !checkedIn || checkedOut ? c.textMuted : c.backgroundStart }]}>Clock out</Text>
            </TouchableOpacity>

            {/* Break toggle */}
            <TouchableOpacity
              style={[s.clockBtn, { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }]}
              onPress={() => checkedIn && (onBreak ? openConfirm("break-end") : openConfirm("break-start"))}
              disabled={!checkedIn || checkedOut || actionLoading}
            >
              {actionLoading && (onBreak || today.onBreak) ? (
                <ActivityIndicator size="small" color={c.text} />
              ) : (
                <Text style={[s.clockBtnText, { color: checkedIn && !checkedOut ? c.text : c.textMuted }]}>
                  {onBreak ? "End break" : "Break"}
                </Text>
              )}
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
          <View style={[s.detailIconBg, { backgroundColor: c.text }]}>
            <Clock size={18} color={c.backgroundStart} strokeWidth={1.8} />
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
          <View style={[s.detailIconBg, { backgroundColor: c.text }]}>
            <MapPin size={18}
              color={c.backgroundStart}
              strokeWidth={1.8}
            />
          </View>
          <View style={s.detailBody}>
            <Text style={[s.detailTitle, { color: c.text }]}>Location Zone</Text>
            <Text style={[s.detailSub, { color: c.textMuted }]}>
              {!workplace || workplace.workplaceId === "dev"
                ? "No location set up — contact your admin"
                : locationDenied
                ? "Permission denied"
                : withinRadius
                ? `Within workplace${distanceMeters != null ? ` · ${distanceMeters}m away` : ""}`
                : `Outside — ${distanceMeters != null ? `${distanceMeters}m away, ` : ""}must be within ${workplace.allowedRadiusMeters}m`}
            </Text>
          </View>
          {workplace && workplace.workplaceId !== "dev" && withinRadius && !locationDenied && (
            <CheckCircle2 size={18} color="#16a34a" strokeWidth={1.8} />
          )}
        </View>

        {/* ── Map View ── */}
        {workplace && workplace.workplaceId !== "dev" && (
          <View style={[s.mapCard, { borderColor: c.border, ...cardShadow }]}>
            {Platform.OS === "web" ? (
              <Map
                center={[workplace.workplaceLongitude, workplace.workplaceLatitude]}
                zoom={16}
                marker={userCoords
                  ? { lat: userCoords.latitude, lng: userCoords.longitude }
                  : { lat: workplace.workplaceLatitude, lng: workplace.workplaceLongitude }
                }
                radiusMeters={workplace.allowedRadiusMeters}
                inside={withinRadius}
              >
                <MapControls position="top-right" showZoom showLocate showFullscreen />
              </Map>
            ) : (
              <WebView
                source={{ html: buildAttendanceMapHtml(
                  workplace.workplaceLatitude,
                  workplace.workplaceLongitude,
                  workplace.allowedRadiusMeters,
                  userCoords?.latitude,
                  userCoords?.longitude,
                  withinRadius,
                )}}
                style={{ flex: 1, borderRadius: 14 }}
                javaScriptEnabled
                geolocationEnabled
                scrollEnabled={false}
              />
            )}
            <View style={{ padding: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: withinRadius ? "#16a34a" : "#dc2626" }} />
              <Text style={{ fontSize: 11, color: c.textMuted }}>
                {withinRadius ? "You are inside the workplace zone" : "You are outside the workplace zone"}
              </Text>
            </View>
          </View>
        )}

        <View style={[s.detailCard, { backgroundColor: c.surface, borderColor: c.border, marginBottom: 32 }]}>
          <View style={[s.detailIconBg, { backgroundColor: c.text }]}>
            <WifiOff size={18} color={c.backgroundStart} strokeWidth={1.8} />
          </View>
          <View style={s.detailBody}>
            <Text style={[s.detailTitle, { color: c.text }]}>Verification</Text>
            <Text style={[s.detailSub, { color: c.textMuted }]}>GPS location required</Text>
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
            <View>
              <Text style={[s.modalTitle, { color: c.text }]}>
                {pendingAction === "clock-in" ? "Clock In"
                  : pendingAction === "clock-out" ? "Clock Out"
                  : pendingAction === "break-start" ? "Start Break"
                  : "End Break"}
              </Text>
              <Text style={[s.modalSub, { color: c.textMuted }]}>Confirm your location to proceed</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={20} color={c.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          {/* Live map in modal */}
          {workplace && workplace.workplaceId !== "dev" && (
            <View style={s.modalMapWrapper}>
              {Platform.OS === "web" ? (
                <Map
                  center={[workplace.workplaceLongitude, workplace.workplaceLatitude]}
                  zoom={16}
                  marker={userCoords
                    ? { lat: userCoords.latitude, lng: userCoords.longitude }
                    : { lat: workplace.workplaceLatitude, lng: workplace.workplaceLongitude }
                  }
                  radiusMeters={workplace.allowedRadiusMeters}
                  inside={withinRadius}
                >
                  <MapControls position="top-right" showZoom showLocate />
                </Map>
              ) : (
                <WebView
                  source={{ html: buildAttendanceMapHtml(
                    workplace.workplaceLatitude,
                    workplace.workplaceLongitude,
                    workplace.allowedRadiusMeters,
                    userCoords?.latitude,
                    userCoords?.longitude,
                    withinRadius,
                  )}}
                  style={{ flex: 1 }}
                  javaScriptEnabled
                  geolocationEnabled
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/* Status row */}
          <View style={[s.modalStatusRow, { backgroundColor: c.surfaceAlt }]}>
            <View style={[s.modalStatusDot, { backgroundColor: withinRadius ? "#16a34a" : "#dc2626" }]} />
            <Text style={[s.modalStatusText, { color: c.text }]}>
              {withinRadius
                ? `Within zone${distanceMeters != null ? ` · ${distanceMeters}m away` : ""}`
                : `Outside zone${distanceMeters != null ? ` · ${distanceMeters}m away` : ""}`}
            </Text>
            {withinRadius && <CheckCircle2 size={14} color="#16a34a" strokeWidth={2} />}
          </View>

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: c.text, opacity: actionLoading ? 0.7 : 1 }]}
            onPress={() => pendingAction && runAttendanceAction(pendingAction)}
            activeOpacity={0.9}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color={c.backgroundStart} />
              : <Text style={[s.confirmBtnText, { color: c.backgroundStart }]}>
                  Confirm {pendingAction === "clock-in" ? "Clock In"
                    : pendingAction === "clock-out" ? "Clock Out"
                    : pendingAction === "break-start" ? "Start Break"
                    : "End Break"}
                </Text>
            }
          </TouchableOpacity>

          <Text style={[s.modalSecondary, { color: c.textMuted }]}>Location is verified before saving</Text>
        </Animated.View>
      </Modal>
    </SafeAreaView>
    </ScreenTransition>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:             { flex: 1 },
  scroll:           { padding: 16, paddingTop: 20, paddingBottom: 120 },
  loadingCenter:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:      { fontSize: 13 },
  errorText:        { fontSize: 14, fontWeight: "600", textAlign: "center" },
  retryBtn:         { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  retryText:        { fontSize: 13, fontWeight: "600" },

  // Header
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
  logo:             { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  logoImage:        { width: 24, height: 24 },
  appName:          { fontWeight: "700", fontSize: 16 },
  headerGreet:      { fontSize: 13 },
  iconPill:         { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  iconPillBtn:      { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  iconPillDivider:  { width: 1, height: 16 },

  // Time card
  timeCard:         { borderRadius: 20, paddingVertical: 24, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, ...cardShadow },
  timeCardLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 },
  timeCardClock:    { fontSize: 52, fontWeight: "800", letterSpacing: -1 },
  timeCardDate:     { fontSize: 14, marginTop: 4 },

  // Shift card
  shiftCard:        { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, ...cardShadow },
  stampsRow:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  stampCol:         { alignItems: "center", flex: 1 },
  stampDivider:     { width: 1 },
  clockLabel:       { fontSize: 9, fontWeight: "500" },
  clockValue:       { fontWeight: "700", marginTop: 2, fontSize: 11 },
  clockActions:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  clockBtn:         { flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10, alignItems: "center" },
  clockBtnText:     { fontWeight: "600", fontSize: 11 },
  upcomingRow:      { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  upcomingLabel:    { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  shiftMeta:        { fontSize: 12 },

  // Work details
  sectionTitle:     { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  detailCard:       { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, ...cardShadow },
  mapCard:          { height: 240, borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 10 },
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
  modalTitle:       { fontSize: 18, fontWeight: "800" },
  modalSub:         { fontSize: 12, marginTop: 2 },
  modalMapWrapper:  { height: 220, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  modalStatusRow:   { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  modalStatusDot:   { width: 8, height: 8, borderRadius: 4 },
  modalStatusText:  { flex: 1, fontSize: 13, fontWeight: "600" },
  confirmBtn:       { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  confirmBtnText:   { fontSize: 15, fontWeight: "800" },
  modalSecondary:   { fontSize: 12, textAlign: "center" },
});
