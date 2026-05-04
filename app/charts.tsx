import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle2, Circle as CircleIcon, Target, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop, Text as SvgText, Circle as SvgCircle } from "react-native-svg";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { safeSnapshot } from "@/lib/firebase/safeSnapshot";
import { useTheme } from "@/lib/context";
import { ScreenTransition } from "@/components/ScreenTransition";
import { cardShadow } from "@/lib/shadows";

const RING_SIZE = 160;
const STROKE = 14;
const SCREEN_W = Dimensions.get("window").width;
const Y_AXIS_W = 24;
const CHART_W = SCREEN_W - 16 * 2 - 18 * 2 - Y_AXIS_W; // scroll padding + card padding + y-axis
const CHART_H = 120;

type MonthPoint = { month: string; label: string; fullLabel: string; earnings: number };

/* Build last 6 months keys YYYY-MM */
function lastSixMonths(): { period: string; label: string; fullLabel: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short" });
    const fullLabel = d.toLocaleString("default", { month: "long", year: "numeric" });
    result.push({ period, label, fullLabel });
  }
  return result;
}

function niceMax(val: number): number {
  if (val <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

type TooltipPoint = { x: number; y: number; label: string; fullLabel: string; earnings: number; index: number } | null;

function EarningsLineChart({ data, colors, ready, showYAxis, showXAxis }: { data: MonthPoint[]; colors: any; ready: boolean; showYAxis: boolean; showXAxis: boolean }) {
  const animProgress = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipPoint>(null);
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready || data.every(d => d.earnings === 0)) return;
    animProgress.setValue(0);
    Animated.timing(animProgress, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = animProgress.addListener(({ value }) => setProgress(value));
    return () => animProgress.removeListener(id);
  }, [ready, data]);

  if (data.length === 0) return null;

  const maxVal = niceMax(Math.max(...data.map(d => d.earnings), 1));
  const pad = { top: 20, right: 8, bottom: 28, left: 10 };
  const innerW = CHART_W - pad.left - pad.right;
  const innerH = CHART_H - pad.top - pad.bottom;

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * innerW,
    y: pad.top + innerH - (d.earnings / maxVal) * innerH,
    earnings: d.earnings,
    label: d.label,
    fullLabel: d.fullLabel,
  }));

  // Build SVG path clipped to progress
  const visiblePts = pts.map((p, i) => {
    if (data.length < 2) return p;
    const segPct = i / (data.length - 1);
    if (segPct > progress) {
      // interpolate between prev and current
      const prevPct = (i - 1) / (data.length - 1);
      const localT = (progress - prevPct) / (1 / (data.length - 1));
      const prev = pts[i - 1] ?? p;
      return { ...p, x: prev.x + (p.x - prev.x) * localT, y: prev.y + (p.y - prev.y) * localT, partial: true };
    }
    return p;
  });

  const pathD = visiblePts
    .filter((_, i) => {
      const segPct = i / (data.length - 1);
      return segPct <= progress + 1 / (data.length - 1);
    })
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  // Area fill path
  const firstX = pts[0].x;
  const lastX = visiblePts[visiblePts.filter((_, i) => i / (data.length - 1) <= progress + 1 / (data.length - 1)).length - 1]?.x ?? pts[0].x;
  const areaD = pathD + ` L${lastX.toFixed(1)},${(pad.top + innerH).toFixed(1)} L${firstX.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

  // Y-axis labels
  const ySteps = [0, maxVal / 2, maxVal];

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {/* Y-axis */}
        {showYAxis && (
          <View style={{ width: Y_AXIS_W, height: CHART_H, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4, paddingTop: pad.top - 6, paddingBottom: pad.bottom - 6 }}>
            {[...ySteps].reverse().map((v, i) => (
              <Text key={i} style={{ fontSize: 9, color: colors.textMuted }}>{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}</Text>
            ))}
          </View>
        )}
        {/* Chart area */}
        <Svg width={showYAxis ? CHART_W : CHART_W + Y_AXIS_W} height={CHART_H}>
          <Defs>
            <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.text} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={colors.text} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          {/* Grid lines */}
          {showYAxis && ySteps.map((v, i) => {
            const y = pad.top + innerH - (v / maxVal) * innerH;
            return <Line key={i} x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="3,4" />;
          })}
          {/* Area fill */}
          {progress > 0 && <Path d={areaD} fill="url(#areaGrad)" />}
          {/* Line */}
          {progress > 0 && <Path d={pathD} fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
          {/* Dots — only for fully reached points */}
          {pts.map((p, i) => {
            const segPct = i / (data.length - 1);
            if (segPct > progress) return null;
            const isSelected = tooltip?.index === i;
            return (
              <SvgCircle
                key={i}
                cx={p.x} cy={p.y}
                r={isSelected ? 6 : 4}
                fill={isSelected ? colors.text : colors.surface}
                stroke={colors.text}
                strokeWidth={2}
                onPress={() => {
                  if (tooltip?.index === i) {
                    Animated.timing(tooltipAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setTooltip(null));
                  } else {
                    tooltipAnim.setValue(0);
                    setTooltip({ x: p.x, y: p.y, label: p.label, fullLabel: p.fullLabel, earnings: p.earnings, index: i });
                    Animated.spring(tooltipAnim, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start();
                  }
                }}
              />
            );
          })}
          {/* Inline label beside selected dot */}
          {tooltip && (() => {
            const p = pts[tooltip.index];
            if (!p) return null;
            const chartW = showYAxis ? CHART_W : CHART_W + Y_AXIS_W;
            const goLeft = p.x > chartW / 2;
            const labelX = goLeft ? p.x - 10 : p.x + 10;
            const anchor = goLeft ? "end" : "start";
            return (
              <>
                <SvgText x={labelX} y={p.y - 24} textAnchor={anchor} fontSize={11} fontWeight="700" fill={colors.text}>
                  {`RM ${tooltip.earnings.toFixed(0)}`}
                </SvgText>
                <SvgText x={labelX} y={p.y - 13} textAnchor={anchor} fontSize={9} fill={colors.textMuted}>
                  {tooltip.fullLabel}
                </SvgText>
              </>
            );
          })()}
          {/* X-axis labels */}
          {showXAxis && pts.map((p, i) => (
            <SvgText key={i} x={p.x} y={CHART_H - 4} textAnchor="middle" fontSize={10} fill={colors.textMuted}>{p.label}</SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DURATION = 1000;

type Goal = {
  id: string;
  name: string;
  savedAmount: number;
  targetAmount: number;
  completed: boolean;
};

/* Animates a number from 0 → target, returns current display value */
function useCountUp(target: number, decimals = 0, ready: boolean) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!ready) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: target,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value }) => {
      setDisplay(value.toFixed(decimals));
    });
    return () => anim.removeListener(id);
  }, [target, ready]);

  return display;
}

/* Animated ring arc — animates fill from 0 → pct */
function RingChart({
  pct,
  label,
  sub,
  colors,
  ready,
}: {
  pct: number;
  label: string;
  sub: string;
  colors: any;
  ready: boolean;
}) {
  const animPct = useRef(new Animated.Value(0)).current;
  const [arcFilled, setArcFilled] = useState(0);

  useEffect(() => {
    if (!ready) return;
    animPct.setValue(0);
    Animated.timing(animPct, {
      toValue: pct,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = animPct.addListener(({ value }) => setArcFilled(value));
    return () => animPct.removeListener(id);
  }, [pct, ready]);

  const filled = CIRCUMFERENCE * Math.min(arcFilled / 100, 1);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle cx={cx} cy={cy} r={RADIUS} fill="none" stroke={colors.border} strokeWidth={STROKE} />
      <Circle
        cx={cx} cy={cy} r={RADIUS} fill="none"
        stroke={colors.text} strokeWidth={STROKE}
        strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
        strokeDashoffset={CIRCUMFERENCE / 4}
        strokeLinecap="round"
      />
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={30} fontWeight="800" fill={colors.text}>
        {label}
      </SvgText>
      <SvgText x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill={colors.textMuted}>
        {sub}
      </SvgText>
    </Svg>
  );
}

/* Shimmer pulse for skeleton loading */
function Shimmer({ width, height, borderRadius, colors }: { width: number; height: number; borderRadius: number; colors: any }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ width, height, borderRadius, backgroundColor: colors.border, opacity: pulse }} />
  );
}

export default function ChartsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [payrollLoaded, setPayrollLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [showYAxis, setShowYAxis] = useState(true);
  const [showXAxis, setShowXAxis] = useState(true);

  /* Fade-in for the whole screen */
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return onAuthStateChanged(auth, user => setUserId(user ? user.uid : null));
  }, []);

  useEffect(() => {
    if (!userId) { setGoals([]); setPayrollRecords([]); setGoalsLoaded(false); setPayrollLoaded(false); return; }
    const goalsRef = collection(db, "users", userId, "goals");
    const payrollRef = collection(db, "users", userId, "payroll");
    const unsubGoals = safeSnapshot(goalsRef, snapshot => {
      const list: Goal[] = snapshot.docs.map((d: any) => {
        const g = d.data() as any;
        const saved = Number(g.savedAmount ?? 0);
        const target = Number(g.targetAmount ?? 0);
        return { id: d.id, name: String(g.name ?? "Unnamed"), savedAmount: saved, targetAmount: target, completed: target > 0 && saved >= target };
      });
      setGoals(list);
      setGoalsLoaded(true);
    });
    const unsubPayroll = safeSnapshot(payrollRef, snapshot => {
      setPayrollRecords(snapshot.docs.map((d: any) => d.data() as any));
      setPayrollLoaded(true);
    });
    return () => { unsubGoals(); unsubPayroll(); };
  }, [userId]);

  useEffect(() => {
    if (!goalsLoaded || !payrollLoaded || ready) return;
    const t = setTimeout(() => {
      setReady(true);
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 100);
    return () => clearTimeout(t);
  }, [goalsLoaded, payrollLoaded]);

  const completedCount = goals.filter(g => g.completed).length;
  const total = goals.length;
  const totalSaved = goals.reduce((sum, g) => sum + g.savedAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const savingsPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  // Build last-6-months earnings from payroll records
  const earningsData: MonthPoint[] = lastSixMonths().map(({ period, label, fullLabel }) => {
    const record = payrollRecords.find((r: any) => String(r.period ?? "") === period);
    return { month: period, label, fullLabel, earnings: record ? Number(record.totalEarnings ?? 0) : 0 };
  });
  const lastTwo = earningsData.slice(-2);
  const trendDiff = lastTwo.length === 2 ? lastTwo[1].earnings - lastTwo[0].earnings : 0;
  const trendPct = lastTwo[0]?.earnings > 0 ? Math.abs(Math.round((trendDiff / lastTwo[0].earnings) * 100)) : 0;
  const totalEarnings6m = earningsData.reduce((s, d) => s + d.earnings, 0);
  const avgMonthly = earningsData.filter(d => d.earnings > 0).length > 0
    ? totalEarnings6m / earningsData.filter(d => d.earnings > 0).length
    : 0;

  /* Animated display values */
  const dispCompleted    = useCountUp(completedCount, 0, ready);
  const dispInProgress   = useCountUp(total - completedCount, 0, ready);
  const dispTotal        = useCountUp(total, 0, ready);
  const dispPct          = useCountUp(overallPct, 0, ready);
  const dispSaved        = useCountUp(totalSaved, 2, ready);
  const dispTarget       = useCountUp(totalTarget, 2, ready);
  const dispSavingsPct   = useCountUp(savingsPct, 0, ready);
  const dispTotal6m      = useCountUp(totalEarnings6m, 2, ready);
  const dispAvgMonthly   = useCountUp(avgMonthly, 2, ready);

  return (
    <ScreenTransition>
      <View style={s.screen}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Analytics</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <Animated.View style={{ opacity: fadeIn, gap: 12 }}>

              {/* ── Goals Completion ── */}
              <View style={s.card}>
                <View style={s.row}>
                  <View style={[s.iconWrap, { backgroundColor: colors.text }]}>
                    <Target size={13} color={colors.backgroundStart} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Goals Completion</Text>
                    <Text style={s.cardSub}>Savings goals progress</Text>
                  </View>
                  {total > 0 && (
                    <View style={[s.pill, { backgroundColor: completedCount === total ? "#16a34a22" : colors.surfaceAlt }]}>
                      <Text style={[s.pillText, { color: completedCount === total ? "#16a34a" : colors.textMuted }]}>
                        {completedCount === total ? "All done" : `${total - completedCount} left`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Ring + side stats */}
                {!ready ? (
                  <View style={[s.row, { justifyContent: "center", gap: 24, marginTop: 12 }]}>
                    <Shimmer width={RING_SIZE} height={RING_SIZE} borderRadius={RING_SIZE / 2} colors={colors} />
                    <View style={{ gap: 16 }}>
                      <Shimmer width={60} height={28} borderRadius={6} colors={colors} />
                      <Shimmer width={60} height={28} borderRadius={6} colors={colors} />
                      <Shimmer width={60} height={28} borderRadius={6} colors={colors} />
                    </View>
                  </View>
                ) : (
                  <View style={[s.row, { justifyContent: "center", gap: 24, marginTop: 8 }]}>
                    <RingChart
                      pct={overallPct}
                      label={`${dispPct}%`}
                      sub={`${dispCompleted} of ${dispTotal}`}
                      colors={colors}
                      ready={ready}
                    />
                    <View style={{ gap: 16, justifyContent: "center" }}>
                      <View>
                        <Text style={s.sideStatVal}>{dispCompleted}</Text>
                        <Text style={s.sideStatLabel}>Completed</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: colors.border }} />
                      <View>
                        <Text style={s.sideStatVal}>{dispInProgress}</Text>
                        <Text style={s.sideStatLabel}>In Progress</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: colors.border }} />
                      <View>
                        <Text style={s.sideStatVal}>{dispTotal}</Text>
                        <Text style={s.sideStatLabel}>Total</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Savings bar */}
                <View style={s.savingsBar}>
                  <View style={s.row}>
                    <Text style={s.savingsLabel}>Total savings</Text>
                    <Text style={s.savingsPct}>{dispSavingsPct}%</Text>
                  </View>
                  {!ready ? (
                    <Shimmer width={CHART_W + Y_AXIS_W} height={4} borderRadius={999} colors={colors} />
                  ) : (
                    <AnimatedTrack pct={savingsPct} colors={colors} ready={ready} />
                  )}
                  <View style={s.row}>
                    <Text style={s.savingsAmt}>RM {dispSaved}</Text>
                    <Text style={[s.savingsAmt, { textAlign: "right" }]}>RM {dispTarget}</Text>
                  </View>
                </View>

                {/* View Breakdown button */}
                <View style={{ height: 1, backgroundColor: colors.border, marginTop: 18, marginBottom: 14 }} />
                <View style={s.row}>
                  <Text style={{ flex: 1, fontSize: 12, color: colors.textMuted }}>
                    {goals.length} goal{goals.length !== 1 ? "s" : ""} tracked
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/goals-breakdown", params: { goals: JSON.stringify(goals) } })}
                    style={[s.pill, { backgroundColor: colors.text, paddingHorizontal: 16, paddingVertical: 8 }]}
                  >
                    <Text style={{ color: colors.backgroundStart, fontSize: 12, fontWeight: "700" }}>View Breakdown</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {goals.length === 0 && ready && (
                <View style={s.empty}>
                  <Text style={s.emptyText}>No goals added yet</Text>
                </View>
              )}

              {/* ── Monthly Earnings Trend ── */}
              <View style={s.card}>
                {/* Header */}
                <View style={s.row}>
                  <View style={[s.iconWrap, { backgroundColor: colors.text }]}>
                    {trendDiff > 0
                      ? <TrendingUp size={13} color={colors.backgroundStart} strokeWidth={2} />
                      : trendDiff < 0
                        ? <TrendingDown size={13} color={colors.backgroundStart} strokeWidth={2} />
                        : <Minus size={13} color={colors.backgroundStart} strokeWidth={2} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Monthly Earnings</Text>
                    <Text style={s.cardSub}>Last 6 months</Text>
                  </View>
                  {trendPct > 0 && (
                    <View style={[s.pill, { backgroundColor: trendDiff >= 0 ? "#16a34a22" : "#dc262622" }]}>
                      <Text style={[s.pillText, { color: trendDiff >= 0 ? "#16a34a" : "#dc2626" }]}>
                        {trendDiff >= 0 ? "+" : "-"}{trendPct}% vs last month
                      </Text>
                    </View>
                  )}
                </View>

                {/* Summary stats */}
                <View style={[s.row, { marginTop: 16, marginBottom: 20 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
                      RM {dispTotal6m}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Total (6 months)</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                      RM {dispAvgMonthly}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Monthly avg</Text>
                  </View>
                </View>

                {/* Axis toggles */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowYAxis(v => !v)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: showYAxis ? colors.text : colors.surfaceAlt }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "600", color: showYAxis ? colors.backgroundStart : colors.textMuted }}>Y Axis</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowXAxis(v => !v)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: showXAxis ? colors.text : colors.surfaceAlt }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "600", color: showXAxis ? colors.backgroundStart : colors.textMuted }}>X Axis</Text>
                  </TouchableOpacity>
                </View>

                {/* Line chart */}
                {!ready ? (
                  <Shimmer width={CHART_W + Y_AXIS_W} height={CHART_H} borderRadius={8} colors={colors} />
                ) : (
                  <EarningsLineChart data={earningsData} colors={colors} ready={ready} showYAxis={showYAxis} showXAxis={showXAxis} />
                )}
              </View>

            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </ScreenTransition>
  );
}

/* Animated progress track */
function AnimatedTrack({ pct, colors, ready }: { pct: number; colors: any; ready: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: pct, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, ready]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" }}>
      <Animated.View style={{ height: 4, width, backgroundColor: colors.text, borderRadius: 999 }} />
    </View>
  );
}

/* Individual goal row with animated bar */
function GoalRow({ goal, gpct, colors, ready, isLast }: { goal: Goal; gpct: number; colors: any; ready: boolean; isLast: boolean }) {
  const s = makeStyles(colors);
  const dispSaved  = useCountUp(goal.savedAmount, 2, ready);
  const dispTarget = useCountUp(goal.targetAmount, 2, ready);

  return (
    <View style={[s.goalRow, !isLast && s.goalRowBorder]}>
      <View style={s.row}>
        {goal.completed
          ? <CheckCircle2 size={14} color="#16a34a" strokeWidth={2} />
          : <CircleIcon size={14} color={colors.textMuted} strokeWidth={2} />
        }
        <Text style={s.goalName} numberOfLines={1}>{goal.name}</Text>
        <Text style={[s.goalPct, { color: goal.completed ? "#16a34a" : colors.text }]}>{gpct}%</Text>
      </View>
      <AnimatedTrack pct={gpct} colors={{ ...colors, text: goal.completed ? "#16a34a" : colors.text }} ready={ready} />
      <View style={[s.row, { marginTop: 5 }]}>
        <Text style={s.goalAmt}>RM {dispSaved} saved</Text>
        <Text style={[s.goalAmt, { textAlign: "right" }]}>of RM {dispTarget}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.backgroundStart },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  scroll: { padding: 16, paddingBottom: 48 },

  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 12, ...cardShadow },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: c.text },
  cardSub: { fontSize: 11, color: c.textMuted, marginTop: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "600" },

  sideStatVal: { fontSize: 22, fontWeight: "800", color: c.text },
  sideStatLabel: { fontSize: 11, color: c.textMuted, marginTop: 2 },

  savingsBar: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border, gap: 6 },
  savingsLabel: { flex: 1, fontSize: 11, color: c.textMuted },
  savingsPct: { fontSize: 11, fontWeight: "700", color: c.text },
  savingsAmt: { flex: 1, fontSize: 10, color: c.textMuted },

  sectionLabel: { fontSize: 10, fontWeight: "700", color: c.textMuted, letterSpacing: 0.8, marginBottom: 14 },
  goalRow: { paddingVertical: 12 },
  goalRowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  goalName: { flex: 1, fontSize: 13, fontWeight: "600", color: c.text },
  goalPct: { fontSize: 12, fontWeight: "700" },
  goalAmt: { flex: 1, fontSize: 10, color: c.textMuted },

  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 13, color: c.textMuted },
  trendBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
