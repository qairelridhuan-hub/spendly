import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bell, ChevronRight, LogOut, Menu, Minus, Moon, SmilePlus, Sun, Target, TrendingDown, TrendingUp } from "lucide-react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Rect, Stop, Text as SvgText, Circle as SvgCircle } from "react-native-svg";
import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { safeSnapshot } from "@/lib/firebase/safeSnapshot";
import { useTheme } from "@/lib/context";
import { useNotifications } from "@/lib/notifications/useNotifications";
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

// ── Mood helpers ────────────────────────────────────────────────────────────
const MOOD_ORDER = ["awful", "sad", "okay", "good", "great"] as const;
type MoodKey = typeof MOOD_ORDER[number];

const MOOD_COLOR: Record<MoodKey, string> = {
  awful: "#ef4444", sad: "#f97316", okay: "#a3a3a3", good: "#22c55e", great: "#eab308",
};
const MOOD_LABEL: Record<MoodKey, string> = {
  awful: "Awful", sad: "Sad", okay: "Okay", good: "Good", great: "Great",
};
const MOOD_SCORE: Record<MoodKey, number> = {
  awful: 1, sad: 2, okay: 3, good: 4, great: 5,
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLast7Days(): { key: string; label: string }[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ key, label: DAY_NAMES[d.getDay()] });
  }
  return days;
}

function getMoodInsights(history: Record<string, string>): string[] {
  const entries = Object.entries(history);
  if (entries.length === 0) return ["Log your mood daily to see insights here."];

  const insights: string[] = [];

  // Most common mood
  const counts: Record<string, number> = {};
  entries.forEach(([, m]) => { counts[m] = (counts[m] || 0) + 1; });
  const topMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topMood) insights.push(`Your most common mood is ${MOOD_LABEL[topMood[0] as MoodKey] ?? topMood[0]}.`);

  // Day-of-week analysis
  const dayScores: Record<number, number[]> = {};
  entries.forEach(([date, m]) => {
    const day = new Date(`${date}T00:00:00`).getDay();
    if (!dayScores[day]) dayScores[day] = [];
    dayScores[day].push(MOOD_SCORE[m as MoodKey] ?? 3);
  });
  const dayAvgs = Object.entries(dayScores).map(([d, scores]) => ({
    day: Number(d), avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  if (dayAvgs.length >= 3) {
    const best  = dayAvgs.sort((a, b) => b.avg - a.avg)[0];
    const worst = dayAvgs.sort((a, b) => a.avg - b.avg)[0];
    if (best.avg > worst.avg + 0.5) {
      insights.push(`You feel best on ${DAY_NAMES[best.day]}s.`);
      insights.push(`${DAY_NAMES[worst.day]}s tend to be your toughest days.`);
    }
  }

  // Last 7 days trend
  const last7 = getLast7Days().map(({ key }) => history[key]).filter(Boolean);
  if (last7.length >= 4) {
    const half = Math.floor(last7.length / 2);
    const early = last7.slice(0, half).reduce((s, m) => s + (MOOD_SCORE[m as MoodKey] ?? 3), 0) / half;
    const recent = last7.slice(half).reduce((s, m) => s + (MOOD_SCORE[m as MoodKey] ?? 3), 0) / (last7.length - half);
    if (recent - early > 0.5) insights.push("Your mood has been improving this week. 📈");
    else if (early - recent > 0.5) insights.push("Your mood has dipped a bit this week — take it easy. 🤍");
  }

  return insights.slice(0, 3);
}

function MoodBarChart({ history, colors }: { history: Record<string, string>; colors: any }) {
  const days = getLast7Days();
  const BAR_H = 80;
  const BAR_W = 28;
  const anims = useRef(days.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(60, days.map((d, i) => {
      const mood = history[d.key] as MoodKey | undefined;
      return Animated.timing(anims[i], {
        toValue: mood ? MOOD_SCORE[mood] / 5 : 0,
        duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      });
    })).start();
  }, [history]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
      {days.map((d, i) => {
        const mood = history[d.key] as MoodKey | undefined;
        const color = mood ? MOOD_COLOR[mood] : colors.border;
        const barHeight = anims[i].interpolate({ inputRange: [0, 1], outputRange: [4, BAR_H] });
        return (
          <View key={d.key} style={{ alignItems: "center", gap: 6 }}>
            <View style={{ height: BAR_H, justifyContent: "flex-end" }}>
              <Animated.View style={{ width: BAR_W, height: barHeight, borderRadius: 8, backgroundColor: color }} />
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ChartsScreen() {
  const { colors, mode, toggleTheme, pillExpanded, togglePill } = useTheme();
  const { unreadCount: unreadNotifications } = useNotifications();
  const s = makeStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("there");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [payrollLoaded, setPayrollLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [showYAxis, setShowYAxis] = useState(true);
  const [moodHistory, setMoodHistory] = useState<Record<string, string>>({});
  const [showMoodChart, setShowMoodChart] = useState(false);
  const moodChartAnim = useRef(new Animated.Value(0)).current;
  const [showXAxis, setShowXAxis] = useState(true);
  const [goalsCardH, setGoalsCardH] = useState(200);
  const [earningsCardH, setEarningsCardH] = useState(200);

  // ── Card stack (Goals=0, Earnings=1, Mood=2) ────────────────────────────────
  const PEEK1        = 130;  // px of 1st-behind card visible below front
  const PEEK2        = 162;  // px of 2nd-behind card bottom from front (32px peeks below PEEK1)
  const BACK_INSET   = 10;   // extra inset per order level
  const BACK_OPACITY = 1;
  const NUM_CARDS    = 3;
  const SP_CFG       = { damping: 26, stiffness: 180, useNativeDriver: true } as const;

  // order: 0=front, 1=next, 2=furthest back
  const backOrder = (curr: number, i: number) =>
    i === curr ? 0 : ((i - curr + NUM_CARDS) % NUM_CARDS);

  const [activeCard, setActiveCard] = useState(0);
  const activeCardRef = useRef(0);
  const [moodCardH, setMoodCardH] = useState(200);

  const c0X  = useRef(new Animated.Value(0)).current;
  const c0Y  = useRef(new Animated.Value(0)).current;
  const c0Op = useRef(new Animated.Value(1)).current;
  const c1X  = useRef(new Animated.Value(0)).current;
  const c1Y  = useRef(new Animated.Value(0)).current;
  const c1Op = useRef(new Animated.Value(BACK_OPACITY)).current;
  const c2X  = useRef(new Animated.Value(0)).current;
  const c2Y  = useRef(new Animated.Value(0)).current;
  const c2Op = useRef(new Animated.Value(BACK_OPACITY)).current;

  const c0Href = useRef(goalsCardH);
  const c1Href = useRef(earningsCardH);
  const c2Href = useRef(moodCardH);
  useEffect(() => { c0Href.current = goalsCardH; }, [goalsCardH]);
  useEffect(() => { c1Href.current = earningsCardH; }, [earningsCardH]);
  useEffect(() => { c2Href.current = moodCardH; }, [moodCardH]);

  const cX  = [c0X,  c1X,  c2X];
  const cY  = [c0Y,  c1Y,  c2Y];
  const cOp = [c0Op, c1Op, c2Op];
  const cHref = [c0Href, c1Href, c2Href];

  const getH = (idx: number) => cHref[idx].current;

  const calcBackY = (frontIdx: number, backIdx: number) => {
    const ord = backOrder(frontIdx, backIdx);
    const peek = ord === 2 ? PEEK2 : PEEK1;
    return getH(frontIdx) + peek - getH(backIdx);
  };

  // Position non-front cards below on height change
  useEffect(() => {
    const curr = activeCardRef.current;
    for (let i = 0; i < NUM_CARDS; i++) {
      if (i !== curr) cY[i].setValue(calcBackY(curr, i));
    }
  }, [goalsCardH, earningsCardH, moodCardH]);

  const sp = (val: Animated.Value, toValue: number) =>
    Animated.spring(val, { toValue, ...SP_CFG });

  const snapToBack = (idx: number, frontIdx: number) =>
    Animated.parallel([
      sp(cX[idx], 0), sp(cY[idx], calcBackY(frontIdx, idx)),
      Animated.timing(cOp[idx], { toValue: BACK_OPACITY, duration: 200, useNativeDriver: true }),
    ]);

  const snapToFront = (idx: number) =>
    Animated.parallel([
      sp(cX[idx], 0), sp(cY[idx], 0),
      Animated.timing(cOp[idx], { toValue: 1, duration: 200, useNativeDriver: true }),
    ]);

  const goToCard = (next: number) => {
    const curr = activeCardRef.current;
    const anims = [snapToFront(next)];
    for (let i = 0; i < NUM_CARDS; i++) {
      if (i !== next) anims.push(snapToBack(i, next));
    }
    Animated.parallel(anims).start();
    setActiveCard(next);
    activeCardRef.current = next;
  };

  const doVertToggle = (curr: number) => {
    const next = (curr + 1) % NUM_CARDS;
    goToCard(next);
  };

  const doHorzToggle = (curr: number, dir: number) => {
    const next = dir > 0
      ? (curr - 1 + NUM_CARDS) % NUM_CARDS
      : (curr + 1) % NUM_CARDS;
    const W = SCREEN_W * 1.2;
    Animated.parallel([
      sp(cX[curr], dir * -W),
      Animated.timing(cOp[curr], { toValue: 0, duration: 220, useNativeDriver: true }),
      sp(cX[next], 0), sp(cY[next], 0),
      Animated.timing(cOp[next], { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      for (let i = 0; i < NUM_CARDS; i++) {
        if (i !== next) {
          cX[i].setValue(0);
          cY[i].setValue(calcBackY(next, i));
          cOp[i].setValue(BACK_OPACITY);
        }
      }
    });
    setActiveCard(next);
    activeCardRef.current = next;
  };

  const snapBack = (curr: number) => {
    const anims = [snapToFront(curr)];
    for (let i = 0; i < NUM_CARDS; i++) {
      if (i !== curr) anims.push(snapToBack(i, curr));
    }
    Animated.parallel(anims).start();
  };

  const doVertRef   = useRef(doVertToggle);
  const doHorzRef   = useRef(doHorzToggle);
  const snapBackRef = useRef(snapBack);
  useEffect(() => { doVertRef.current   = doVertToggle; });
  useEffect(() => { doHorzRef.current   = doHorzToggle; });
  useEffect(() => { snapBackRef.current = snapBack; });

  const dragDir  = useRef<"none"|"vertical"|"horizontal">("none");
  const dragSign = useRef(0);

  const chartCardPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderGrant: () => { dragDir.current = "none"; dragSign.current = 0; },
      onPanResponderMove: (_, g) => {
        const absX = Math.abs(g.dx), absY = Math.abs(g.dy);
        if (dragDir.current === "none") {
          if (absX < 8 && absY < 8) return;
          dragDir.current = absX > absY ? "horizontal" : "vertical";
          if (dragDir.current === "horizontal") dragSign.current = g.dx > 0 ? 1 : -1;
        }
        const curr = activeCardRef.current;
        const next = dragDir.current === "horizontal"
          ? (dragSign.current > 0 ? (curr - 1 + NUM_CARDS) % NUM_CARDS : (curr + 1) % NUM_CARDS)
          : (curr + 1) % NUM_CARDS;
        const fH  = getH(curr);
        const bY  = calcBackY(curr, next);
        if (dragDir.current === "vertical") {
          const p = Math.max(0, Math.min(1, absY / Math.max(1, fH)));
          cY[curr].setValue(bY * p);
          cOp[curr].setValue(1 - (1 - BACK_OPACITY) * p);
          cY[next].setValue(bY * (1 - p));
          cOp[next].setValue(BACK_OPACITY + (1 - BACK_OPACITY) * p);
        } else {
          cX[curr].setValue(g.dx);
          const p = Math.max(0, Math.min(1, absX / SCREEN_W));
          cX[next].setValue(-dragSign.current * SCREEN_W * (1 - p));
          cY[next].setValue(bY * (1 - p));
          cOp[next].setValue(BACK_OPACITY + (1 - BACK_OPACITY) * p);
        }
      },
      onPanResponderRelease: (_, g) => {
        const curr = activeCardRef.current;
        const fH   = Math.max(1, getH(curr));
        if (dragDir.current === "vertical") {
          if (Math.abs(g.dy) / fH > 0.22 || Math.abs(g.vy) > 0.35)
            doVertRef.current(curr);
          else
            snapBackRef.current(curr);
        } else if (dragDir.current === "horizontal") {
          if (Math.abs(g.dx) / SCREEN_W > 0.22 || Math.abs(g.vx) > 0.35)
            doHorzRef.current(curr, dragSign.current);
          else
            snapBackRef.current(curr);
        }
        dragDir.current = "none";
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;
  const pillAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(pillAnim, { toValue: pillExpanded ? 1 : 0, duration: pillExpanded ? 150 : 0, useNativeDriver: false }).start();
  }, [pillExpanded]);

  /* Fade-in for the whole screen */
  const fadeIn = useRef(new Animated.Value(0)).current;

  const handleLogout = async () => { try { await signOut(auth); router.replace("/(auth)/login" as any); } catch {} };

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setUserId(user ? user.uid : null);
      setDisplayName(user?.displayName?.split(" ")[0] ?? "there");
    });
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
    const moodsRef = collection(db, "users", userId, "moods");
    const unsubMoods = safeSnapshot(moodsRef, snapshot => {
      const h: Record<string, string> = {};
      snapshot.docs.forEach((d: any) => { h[d.id] = d.data().mood; });
      setMoodHistory(h);
    });
    return () => { unsubGoals(); unsubPayroll(); unsubMoods(); };
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

  const toggleMoodChart = () => {
    const next = !showMoodChart;
    setShowMoodChart(next);
    Animated.spring(moodChartAnim, { toValue: next ? 1 : 0, useNativeDriver: false, damping: 18, stiffness: 160 }).start();
  };

  const moodInsights = getMoodInsights(moodHistory);

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <View>
                <Text style={s.headerTitle}>Analytics</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Hey, {displayName}!</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={toggleMoodChart}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: showMoodChart ? colors.text : colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}
              activeOpacity={0.8}
            >
              <SmilePlus size={18} color={showMoodChart ? colors.backgroundStart : colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <View style={[s.iconPill, !pillExpanded && { backgroundColor: "transparent", borderColor: "transparent", shadowOpacity: 0, elevation: 0 }]}>
              <Animated.View style={{ overflow: "hidden", width: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }), opacity: pillAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] }) }}>
                <TouchableOpacity style={{ backgroundColor: "#000000", borderRadius: 999, width: 32, height: 32, alignItems: "center", justifyContent: "center" }} onPress={togglePill}>
                  <Menu size={18} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={{ flexDirection: "row", alignItems: "center", overflow: "hidden", width: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }), opacity: pillAnim }}>
                <TouchableOpacity style={s.iconPillBtn} onPress={toggleTheme}>
                  {mode === "dark" ? <Moon size={20} color={colors.text} /> : <Sun size={20} color={colors.text} />}
                </TouchableOpacity>
                <View style={s.iconPillDivider} />
                <TouchableOpacity style={s.iconPillBtn} onPress={() => router.push("/notifications")}>
                  <Bell size={20} color={colors.text} />
                  {unreadNotifications > 0 ? (
                    <View style={s.notificationBadge}>
                      <Text style={s.notificationBadgeText}>
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
                <View style={s.iconPillDivider} />
                <TouchableOpacity style={s.iconPillBtn} onPress={handleLogout}>
                  <LogOut size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={s.iconPillDivider} />
                <TouchableOpacity style={s.iconPillBtn} onPress={togglePill}>
                  <ChevronRight size={20} color={colors.text} />
                </TouchableOpacity>
              </Animated.View>
            </View>
            </View>
          </View>

          <View style={s.scroll}>
            <Animated.View style={{ opacity: fadeIn }}>

              {/* ── Card Stack: Goals (0) + Earnings (1) + Mood (2) ── */}
              <View style={{
                height: Math.max(goalsCardH, earningsCardH, moodCardH) + PEEK2,
                overflow: "hidden",
              }} {...chartCardPan.panHandlers}>

              {/* Card 0 — Goals Completion */}
              <Animated.View style={{
                position: "absolute", top: 0,
                left:  backOrder(activeCard, 0) * BACK_INSET,
                right: backOrder(activeCard, 0) * BACK_INSET,
                transform: [{ translateX: c0X }, { translateY: c0Y }],
                opacity: c0Op,
                zIndex: NUM_CARDS - backOrder(activeCard, 0),
              }}>
              <View style={s.card} onLayout={e => setGoalsCardH(e.nativeEvent.layout.height)}>
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
              </Animated.View>

              {goals.length === 0 && ready && (
                <View style={[s.empty, { position: "absolute", top: 8, left: 0, right: 0 }]}>
                  <Text style={s.emptyText}>No goals added yet</Text>
                </View>
              )}

              {/* Card 1 — Monthly Earnings */}
              <Animated.View style={{
                position: "absolute", top: 0,
                left:  backOrder(activeCard, 1) * BACK_INSET,
                right: backOrder(activeCard, 1) * BACK_INSET,
                transform: [{ translateX: c1X }, { translateY: c1Y }],
                opacity: c1Op,
                zIndex: NUM_CARDS - backOrder(activeCard, 1),
              }}>
              <View style={s.card} onLayout={e => setEarningsCardH(e.nativeEvent.layout.height)}>
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

              {/* Card 2 — Mood This Week */}
              <Animated.View style={{
                position: "absolute", top: 0,
                left:  backOrder(activeCard, 2) * BACK_INSET,
                right: backOrder(activeCard, 2) * BACK_INSET,
                transform: [{ translateX: c2X }, { translateY: c2Y }],
                opacity: c2Op,
                zIndex: NUM_CARDS - backOrder(activeCard, 2),
              }}>
              <View style={s.card} onLayout={e => setMoodCardH(e.nativeEvent.layout.height)}>
                <View style={s.row}>
                  <View style={[s.iconWrap, { backgroundColor: colors.text }]}>
                    <SmilePlus size={13} color={colors.backgroundStart} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Mood This Week</Text>
                    <Text style={s.cardSub}>How you've been feeling</Text>
                  </View>
                </View>

                <MoodBarChart history={moodHistory} colors={colors} />

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {MOOD_ORDER.map(k => (
                    <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MOOD_COLOR[k] }} />
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>{MOOD_LABEL[k]}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ marginTop: 14, gap: 8 }}>
                  {moodInsights.map((insight, i) => (
                    <View key={i} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10 }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>{insight}</Text>
                    </View>
                  ))}
                </View>
              </View>
              </Animated.View>

              </View>{/* end card stack */}

              {/* Dot indicators */}
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14 }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{
                    width: activeCard === i ? 24 : 8, height: 8, borderRadius: 4,
                    backgroundColor: activeCard === i ? colors.text : colors.border,
                  }} />
                ))}
              </View>

            </Animated.View>
          </View>

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

const makeStyles = (c: any) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.backgroundStart },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, marginBottom: 8 },
  iconPill: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 4, paddingVertical: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  iconPillBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  iconPillDivider: { width: 1, height: 16, backgroundColor: c.border },
  notificationBadge: {
    position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7,
    paddingHorizontal: 3, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center",
  },
  notificationBadgeText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  scroll: { padding: 16, paddingBottom: 48 },

  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 0 },
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
