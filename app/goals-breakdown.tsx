import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ArrowDown, ArrowUp, CheckCircle2, Circle as CircleIcon, Search, X } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/lib/context";
import { ScreenTransition } from "@/components/ScreenTransition";
import { cardShadow } from "@/lib/shadows";

const DURATION = 900;

type Goal = {
  id: string;
  name: string;
  savedAmount: number;
  targetAmount: number;
  completed: boolean;
};

function useCountUp(target: number, decimals = 0, ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    if (!ready) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: target, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const id = anim.addListener(({ value }) => setDisplay(value.toFixed(decimals)));
    return () => anim.removeListener(id);
  }, [target, ready]);
  return display;
}

function AnimatedBar({ pct, color, colors }: { pct: number; color: string; colors: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: pct, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" }}>
      <Animated.View style={{ height: 4, width, backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

const THUMB_W = 52;
const TRACK_W = 108;

function SortSlider({ sortDir, onToggle, colors }: { sortDir: "desc" | "asc"; onToggle: () => void; colors: any }) {
  const thumbAnim = useRef(new Animated.Value(sortDir === "desc" ? 2 : TRACK_W - THUMB_W - 2)).current;

  useEffect(() => {
    Animated.spring(thumbAnim, {
      toValue: sortDir === "desc" ? 2 : TRACK_W - THUMB_W - 2,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  }, [sortDir]);

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
      <View style={{
        width: TRACK_W,
        height: 34,
        borderRadius: 999,
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
      }}>
        {/* Labels */}
        <View style={{ position: "absolute", flexDirection: "row", width: "100%" }}>
          <View style={{ width: THUMB_W, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: sortDir === "desc" ? colors.backgroundStart : colors.textMuted }}>High</Text>
          </View>
          <View style={{ width: THUMB_W, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: sortDir === "asc" ? colors.backgroundStart : colors.textMuted }}>Low</Text>
          </View>
        </View>
        {/* Sliding thumb */}
        <Animated.View style={{
          position: "absolute",
          width: THUMB_W,
          height: 28,
          borderRadius: 999,
          backgroundColor: colors.text,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 4,
          transform: [{ translateX: thumbAnim }],
        }}>
          {sortDir === "desc"
            ? <ArrowDown size={11} color={colors.backgroundStart} strokeWidth={2.5} />
            : <ArrowUp size={11} color={colors.backgroundStart} strokeWidth={2.5} />
          }
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.backgroundStart }}>
            {sortDir === "desc" ? "High" : "Low"}
          </Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

function SummaryBar({ pct, colors }: { pct: number; colors: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" }}>
      <Animated.View style={{ height: 8, width, backgroundColor: colors.text, borderRadius: 999 }} />
    </View>
  );
}

function GoalCard({ goal, colors, index }: { goal: Goal; colors: any; index: number }) {
  const s = makeStyles(colors);
  const gpct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const barColor = goal.completed ? "#16a34a" : colors.text;

  const slideAnim = useRef(new Animated.Value(16)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const dispSaved     = useCountUp(goal.savedAmount, 2, true);
  const dispTarget    = useCountUp(goal.targetAmount, 2, true);
  const dispRemaining = useCountUp(remaining, 2, true);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Name + badge */}
      <View style={s.row}>
        {goal.completed
          ? <CheckCircle2 size={15} color="#16a34a" strokeWidth={2} />
          : <CircleIcon size={15} color={colors.textMuted} strokeWidth={2} />
        }
        <Text style={s.goalName} numberOfLines={1}>{goal.name}</Text>
        <View style={[s.badge, { backgroundColor: goal.completed ? "#16a34a18" : colors.surfaceAlt }]}>
          <Text style={[s.badgeText, { color: goal.completed ? "#16a34a" : colors.textMuted }]}>
            {goal.completed ? "Done" : `${gpct}%`}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <AnimatedBar pct={gpct} color={barColor} colors={colors} />
      </View>

      {/* Amounts — compact single row */}
      <View style={s.amountsRow}>
        <View style={s.amountItem}>
          <Text style={s.amountVal}>RM {dispSaved}</Text>
          <Text style={s.amountLabel}>Saved</Text>
        </View>
        <View style={s.amountItem}>
          <Text style={s.amountVal}>RM {dispTarget}</Text>
          <Text style={s.amountLabel}>Target</Text>
        </View>
        <View style={s.amountItem}>
          <Text style={[s.amountVal, { color: goal.completed ? "#16a34a" : colors.text }]}>
            {goal.completed ? "—" : `RM ${dispRemaining}`}
          </Text>
          <Text style={s.amountLabel}>{goal.completed ? "Achieved" : "Left"}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function GoalsBreakdownScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const params = useLocalSearchParams<{ goals: string }>();

  const goals: Goal[] = params.goals ? JSON.parse(params.goals) : [];
  const completed   = goals.filter(g => g.completed).length;
  const totalSaved  = goals.reduce((sum, g) => sum + g.savedAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallPct  = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [search, setSearch] = useState("");

  const sortedGoals = useMemo(() => {
    const filtered = search.trim()
      ? goals.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
      : goals;
    return [...filtered].sort((a, b) => {
      const pctA = a.targetAmount > 0 ? a.savedAmount / a.targetAmount : 0;
      const pctB = b.targetAmount > 0 ? b.savedAmount / b.targetAmount : 0;
      return sortDir === "desc" ? pctB - pctA : pctA - pctB;
    });
  }, [goals, sortDir, search]);

  const dispSaved   = useCountUp(totalSaved, 2, true);
  const dispTarget  = useCountUp(totalTarget, 2, true);

  return (
    <ScreenTransition>
      <View style={s.screen}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Goals Breakdown</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* Summary card */}
            <View style={s.summaryCard}>
              {/* Top row — pct hero + status */}
              <View style={s.summaryTop}>
                <View style={s.summaryPctWrap}>
                  <Text style={s.summaryPct}>{overallPct}%</Text>
                  <Text style={s.summaryPctLabel}>saved</Text>
                </View>
                <View style={s.summaryRight}>
                  <Text style={s.summaryBig}>RM {dispSaved}</Text>
                  <Text style={s.summarySub}>of RM {dispTarget}</Text>
                  <View style={{ marginTop: 8 }}>
                    <Text style={s.summaryInsight}>
                      {completed === goals.length && goals.length > 0
                        ? "🎉 All goals completed!"
                        : completed > 0
                          ? `${completed} of ${goals.length} goals done · ${goals.length - completed} remaining`
                          : `${goals.length} goals in progress`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Thick animated bar */}
              <View style={{ marginTop: 16 }}>
                <SummaryBar pct={overallPct} colors={colors} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>RM 0</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>RM {dispTarget}</Text>
                </View>
              </View>
            </View>

            {/* Search bar */}
            <View style={s.searchWrap}>
              <Search size={15} color={colors.textMuted} strokeWidth={2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search goals..."
                placeholderTextColor={colors.textMuted}
                style={s.searchInput}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort row */}
            <View style={s.sortRow}>
              <Text style={s.sortLabel}>Sort by progress</Text>
              <SortSlider sortDir={sortDir} onToggle={() => setSortDir(d => d === "desc" ? "asc" : "desc")} colors={colors} />
            </View>

            {/* Goal cards */}
            {sortedGoals.map((g, i) => (
              <GoalCard key={g.id} goal={g} colors={colors} index={i} />
            ))}

            {sortedGoals.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyText}>
                  {search.trim() ? `No goals matching "${search}"` : "No goals to display"}
                </Text>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </View>
    </ScreenTransition>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.backgroundStart },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  scroll: { padding: 16, paddingBottom: 48, gap: 10 },

  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
    marginBottom: 4,
    ...cardShadow,
  },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  summaryPctWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryPct: { fontSize: 18, fontWeight: "800", color: c.text },
  summaryPctLabel: { fontSize: 10, color: c.textMuted, marginTop: 1 },
  summaryRight: { flex: 1 },
  summaryBig: { fontSize: 20, fontWeight: "800", color: c.text },
  summarySub: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  summaryInsight: { fontSize: 11, color: c.textMuted },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#000000",
    padding: 0,
  },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  sortLabel: { fontSize: 11, color: c.textMuted },

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    ...cardShadow,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalName: { flex: 1, fontSize: 13, fontWeight: "700", color: c.text },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  amountsRow: { flexDirection: "row", marginTop: 12 },
  amountItem: { flex: 1, alignItems: "center" },
  amountVal: { fontSize: 12, fontWeight: "700", color: c.text },
  amountLabel: { fontSize: 10, color: c.textMuted, marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 13, color: c.textMuted },
});
