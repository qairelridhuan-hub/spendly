import React from "react";
import { router } from "expo-router";
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";
import {
  DollarSign,
  CalendarDays,
  FileText,
  Target,
  TrendingUp,
  Clock,
  Wallet,
  PiggyBank,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    icon: null,
    useLogo: true,
    title: "Welcome to Spendly",
    subtitle:
      "Your smart and professional way to track earnings, salaries, and work schedules.",
    preview: null,
  },
  {
    id: "2",
    icon: DollarSign,
    useLogo: false,
    title: "Track Your Earnings",
    subtitle:
      "Track your part-time income, salary, and daily earnings in one place. Always know what you've earned.",
    preview: "earnings",
  },
  {
    id: "3",
    icon: CalendarDays,
    useLogo: false,
    title: "Attendance & Shifts",
    subtitle:
      "Manage attendance, clock-in/out, and work schedules with ease. Never miss a shift.",
    preview: "schedule",
  },
  {
    id: "4",
    icon: Target,
    useLogo: false,
    title: "Goals & Savings",
    subtitle:
      "Set savings goals, track your progress, and stay motivated with smart suggestions.",
    preview: "goals",
  },
  {
    id: "5",
    icon: FileText,
    useLogo: false,
    title: "Reports & Payslips",
    subtitle:
      "Generate clean salary reports and payslips instantly for better financial management.",
    preview: "report",
  },
];

const TILE_W = 130;
const TILE_H = 130;
const GAP = 10;
const COLS = 3;

const hero = StyleSheet.create({
  clipBox: {
    width: "100%",
    height: 310,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  rotatedWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-20deg" }],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: COLS * TILE_W + (COLS - 1) * GAP,
    gap: GAP,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 22,
    padding: 14,
    justifyContent: "flex-end",
  },
  tileLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "500", marginTop: 6 },
  tileValueLg: { fontSize: 18, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5 },
  tileValue: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  tileSub: { fontSize: 10, color: "#6b7280", marginTop: 1 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  trendTxt: { fontSize: 10, color: "#4ade80", fontWeight: "600" },
  progressBg: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: 4, backgroundColor: "#111827", borderRadius: 999 },
});

type TileData = { bg: string; content: React.ReactNode };

function WelcomeHero() {
  const tiles: TileData[] = [
    {
      bg: "#111827", content: (
        <>
          <Wallet size={18} color="#fff" />
          <Text style={hero.tileLabel}>Earnings</Text>
          <Text style={hero.tileValueLg}>RM 1,240</Text>
          <View style={hero.trendRow}><TrendingUp size={11} color="#4ade80" /><Text style={hero.trendTxt}>+12%</Text></View>
        </>
      )
    },
    {
      bg: "#f3f4f6", content: (
        <>
          <Clock size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Hours</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>144h</Text>
        </>
      )
    },
    {
      bg: "#ffffff", content: (
        <>
          <CalendarDays size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Shift</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>Mon</Text>
          <Text style={hero.tileSub}>9:00 AM</Text>
        </>
      )
    },
    {
      bg: "#f3f4f6", content: (
        <>
          <PiggyBank size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Savings</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>65%</Text>
          <View style={hero.progressBg}><View style={[hero.progressFill, { width: "65%" }]} /></View>
        </>
      )
    },
    {
      bg: "#111827", content: (
        <>
          <Target size={18} color="#fff" />
          <Text style={hero.tileLabel}>Goal</Text>
          <Text style={hero.tileValueLg}>Travel</Text>
          <View style={hero.trendRow}><TrendingUp size={11} color="#4ade80" /><Text style={hero.trendTxt}>On track</Text></View>
        </>
      )
    },
    {
      bg: "#f3f4f6", content: (
        <>
          <FileText size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Report</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>Apr</Text>
          <Text style={hero.tileSub}>18 days</Text>
        </>
      )
    },
    {
      bg: "#ffffff", content: (
        <>
          <DollarSign size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Rate</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>RM 8.50</Text>
          <Text style={hero.tileSub}>per hour</Text>
        </>
      )
    },
    {
      bg: "#f3f4f6", content: (
        <>
          <CalendarDays size={18} color="#111827" />
          <Text style={[hero.tileLabel, { color: "#6b7280" }]}>Days</Text>
          <Text style={[hero.tileValue, { color: "#111827" }]}>18</Text>
          <Text style={hero.tileSub}>this month</Text>
        </>
      )
    },
    {
      bg: "#111827", content: (
        <>
          <TrendingUp size={18} color="#fff" />
          <Text style={hero.tileLabel}>Growth</Text>
          <Text style={hero.tileValueLg}>+26%</Text>
        </>
      )
    },
  ];

  return (
    <View style={hero.clipBox}>
      <View style={hero.rotatedWrap}>
        <View style={hero.grid}>
          {tiles.map((t, i) => (
            <View
              key={i}
              style={[
                hero.tile,
                {
                  backgroundColor: t.bg,
                  borderColor: t.bg === "#ffffff" || t.bg === "#f3f4f6" ? "#e5e7eb" : "transparent",
                  borderWidth: 1,
                },
              ]}
            >
              {t.content}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function EarningsPreview() {
  return (
    <View style={preview.wrap}>
      <View style={preview.row}>
        <View style={preview.rowLeft}>
          <View style={[preview.dot, { backgroundColor: "#22c55e" }]} />
          <Text style={preview.rowLabel}>This Month</Text>
        </View>
        <Text style={preview.rowValue}>RM 1,240.00</Text>
      </View>
      <View style={preview.divider} />
      <View style={preview.row}>
        <View style={preview.rowLeft}>
          <View style={[preview.dot, { backgroundColor: "#6b7280" }]} />
          <Text style={preview.rowLabel}>Last Month</Text>
        </View>
        <Text style={[preview.rowValue, { color: "#6b7280" }]}>RM 980.00</Text>
      </View>
      <View style={preview.divider} />
      <View style={preview.row}>
        <View style={preview.rowLeft}>
          <View style={[preview.dot, { backgroundColor: "#111827" }]} />
          <Text style={preview.rowLabel}>Hourly Rate</Text>
        </View>
        <Text style={preview.rowValue}>RM 8.50 / hr</Text>
      </View>
    </View>
  );
}

function SchedulePreview() {
  return (
    <View style={preview.wrap}>
      {[
        { day: "Mon", time: "9:00 AM – 5:00 PM", status: "Approved" },
        { day: "Tue", time: "9:00 AM – 5:00 PM", status: "Approved" },
        { day: "Wed", time: "Off", status: "Off" },
      ].map((item, i) => (
        <View key={i}>
          <View style={preview.row}>
            <View style={preview.rowLeft}>
              <View
                style={[
                  preview.dot,
                  {
                    backgroundColor:
                      item.status === "Off" ? "#d1d5db" : "#111827",
                  },
                ]}
              />
              <View>
                <Text style={preview.rowLabel}>{item.day}</Text>
                <Text style={preview.rowSub}>{item.time}</Text>
              </View>
            </View>
            <View
              style={[
                preview.badge,
                {
                  backgroundColor:
                    item.status === "Off" ? "#f3f4f6" : "#f0fdf4",
                },
              ]}
            >
              <Text
                style={[
                  preview.badgeText,
                  {
                    color: item.status === "Off" ? "#6b7280" : "#16a34a",
                  },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>
          {i < 2 && <View style={preview.divider} />}
        </View>
      ))}
    </View>
  );
}

function GoalsPreview() {
  return (
    <View style={preview.wrap}>
      {[
        { name: "Travel Trip", pct: 65, color: "#111827" },
        { name: "New Phone", pct: 30, color: "#111827" },
      ].map((g, i) => (
        <View key={i}>
          <View style={{ marginBottom: 4 }}>
            <View style={preview.row}>
              <Text style={preview.rowLabel}>{g.name}</Text>
              <Text style={preview.rowValue}>{g.pct}%</Text>
            </View>
            <View style={preview.trackBg}>
              <View style={[preview.trackFill, { width: `${g.pct}%`, backgroundColor: g.color }]} />
            </View>
          </View>
          {i === 0 && <View style={[preview.divider, { marginVertical: 10 }]} />}
        </View>
      ))}
    </View>
  );
}

function ReportPreview() {
  return (
    <View style={preview.wrap}>
      <View style={preview.reportHeader}>
        <Text style={preview.reportTitle}>Monthly Summary</Text>
        <Text style={preview.reportSub}>April 2026</Text>
      </View>
      <View style={preview.divider} />
      {[
        { label: "Days Worked", value: "18 days" },
        { label: "Total Hours", value: "144h" },
        { label: "Gross Earnings", value: "RM 1,224.00" },
        { label: "Status", value: "Approved" },
      ].map((r, i) => (
        <View key={i} style={preview.row}>
          <Text style={preview.rowLabel}>{r.label}</Text>
          <Text style={preview.rowValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const preview = StyleSheet.create({
  wrap: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontSize: 13, color: "#111827", fontWeight: "500" },
  rowSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  rowValue: { fontSize: 13, color: "#111827", fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  divider: { height: 1, backgroundColor: "#f0f0f0" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  trackBg: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  trackFill: { height: 6, borderRadius: 999 },
  reportHeader: { marginBottom: 8 },
  reportTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  reportSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});

function Slide({ item }: { item: typeof slides[0] }) {
  const Icon = item.icon;

  if (item.useLogo) {
    return (
      <View style={[styles.welcomeSlide, { width }]}>
        <View style={styles.heroWrap}>
          <WelcomeHero />
        </View>
        <View style={styles.welcomeTextWrap}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.illustrationWrap}>
        {Icon && (
          <View style={styles.iconBubble}>
            <Icon size={36} color="#111827" />
          </View>
        )}
        {item.preview === "earnings" && <EarningsPreview />}
        {item.preview === "schedule" && <SchedulePreview />}
        {item.preview === "goals" && <GoalsPreview />}
        {item.preview === "report" && <ReportPreview />}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const handleNext = () => {
    if (current < slides.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1, animated: true });
    } else {
      router.replace("/(auth)/splash");
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, current === i && styles.dotActive]}
            />
          ))}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatRef}
          data={slides}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrent(idx);
          }}
          renderItem={({ item }) => <Slide item={item} />}
        />

        {/* Bottom CTA */}
        <View style={styles.bottomArea}>
          {current < slides.length - 1 ? (
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => router.replace("/(auth)/splash")}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={styles.nextBtn}
                  onPress={handleNext}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  activeOpacity={1}
                >
                  <Text style={styles.nextBtnText}>Next</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : (
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.getStartedBtn}
                onPress={handleNext}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                activeOpacity={1}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  safe: { flex: 1 },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#111827",
    borderRadius: 3,
  },

  slide: {
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: "center",
  },
  illustrationWrap: {
    width: "100%",
    height: 310,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    gap: 20,
  },
  logoBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  logoImg: { width: 52, height: 52 },
  iconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingBottom: 16,
    paddingTop: 20,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    color: "#9ca3af",
    fontWeight: "600",
  },
  nextBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  nextBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  getStartedBtn: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  getStartedText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },

  welcomeSlide: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  heroWrap: {
    width: "100%",
    marginBottom: 32,
  },
  welcomeTextWrap: {
    alignItems: "center",
    paddingHorizontal: 4,
  },
});
