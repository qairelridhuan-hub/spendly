import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, LayoutChangeEvent } from "react-native";
import { X, Check, CalendarDays } from "lucide-react-native";
import { AwfulFace, SadFace, NeutralFace, GoodFace, GreatFace } from "./MoodFaces";

export type MoodKey = "awful" | "sad" | "okay" | "good" | "great";

export interface Mood {
  key: MoodKey;
  emoji: string;
  label: string;
}

export const MOODS: Mood[] = [
  { key: "awful", emoji: "😢", label: "Awful" },
  { key: "sad", emoji: "😕", label: "Sad" },
  { key: "okay", emoji: "😐", label: "Okay" },
  { key: "good", emoji: "🙂", label: "Good" },
  { key: "great", emoji: "😄", label: "Great" },
];

const FACES = [AwfulFace, SadFace, NeutralFace, GoodFace, GreatFace];
const CIRCLE = 124;
const ICON_SZ = 80;
const SLOT_W = 100;
const STEP_PX = 80;

const targetScale = (dist: number) => (dist === 0 ? 1 : dist === 1 ? 0.58 : 0.40);
const targetOpacity = (dist: number) => (dist === 0 ? 1 : dist === 1 ? 0.55 : 0.28);

const IDX_RANGE = MOODS.map((_, j) => j);

interface MoodSheetProps {
  mood: Mood | null;
  onSelect: (mood: Mood) => void;
  onClose: () => void;
  onOpenCalendar?: () => void;
  colors: {
    text: string;
    surface: string;
    border: string;
    textMuted: string;
  };
}

export default function MoodSheet({ mood, onSelect, onClose, onOpenCalendar, colors }: MoodSheetProps) {
  const defaultIdx = mood ? Math.max(0, MOODS.findIndex((m) => m.key === mood.key)) : 2;
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx);
  const idxRef = useRef(defaultIdx);
  const [carouselWidth, setCarouselWidth] = useState(0);

  const position = useRef(new Animated.Value(defaultIdx)).current;

  const onCarouselLayout = (e: LayoutChangeEvent) => {
    setCarouselWidth(e.nativeEvent.layout.width);
  };

  const rowTranslateX = position.interpolate({
    inputRange: IDX_RANGE,
    outputRange: IDX_RANGE.map((i) => carouselWidth / 2 - (i + 0.5) * SLOT_W),
    extrapolate: "clamp",
  });

  const getScale = (i: number) =>
    position.interpolate({
      inputRange: IDX_RANGE,
      outputRange: IDX_RANGE.map((j) => targetScale(Math.abs(j - i))),
      extrapolate: "clamp",
    });

  const getOpacity = (i: number) =>
    position.interpolate({
      inputRange: IDX_RANGE,
      outputRange: IDX_RANGE.map((j) => targetOpacity(Math.abs(j - i))),
      extrapolate: "clamp",
    });

  const snapTo = (idx: number) => {
    idxRef.current = idx;
    setSelectedIdx(idx);
    Animated.spring(position, {
      toValue: idx, useNativeDriver: true, damping: 16, stiffness: 200,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: (_, g) => {
        const raw = idxRef.current - g.dx / STEP_PX;
        position.setValue(Math.max(0, Math.min(MOODS.length - 1, raw)));
      },
      onPanResponderRelease: (_, g) => {
        const cur = idxRef.current;
        let next = cur;
        if (g.dx < -25 && cur < MOODS.length - 1) next = cur + 1;
        else if (g.dx > 25 && cur > 0) next = cur - 1;
        snapTo(next);
      },
    })
  ).current;

  const confirm = () => {
    onSelect(MOODS[selectedIdx]);
    onClose();
  };

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <TouchableOpacity style={[s.headerBtn, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
          <X size={18} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.headerBtn, { borderColor: colors.border }]} onPress={onOpenCalendar} activeOpacity={0.7}>
          <CalendarDays size={18} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.headerBtn, { backgroundColor: colors.text, borderColor: colors.text }]} onPress={confirm} activeOpacity={0.8}>
          <Check size={18} color={colors.surface} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Text style={[s.subtitle, { color: colors.textMuted }]}>Mood</Text>
      <Text style={[s.title, { color: colors.text }]}>Choose how you're{"\n"}feeling right now</Text>

      <View style={s.carousel} onLayout={onCarouselLayout} {...panResponder.panHandlers}>
        <Animated.View style={[s.iconRow, { transform: [{ translateX: rowTranslateX }] }]}>
          {MOODS.map((m, i) => {
            const Face = FACES[i];
            return (
              <TouchableOpacity key={m.key} onPress={() => snapTo(i)} activeOpacity={0.8} style={s.iconSlot}>
                <Animated.View style={[s.circle, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, opacity: getOpacity(i), transform: [{ scale: getScale(i) }] }]}>
                  <Face size={ICON_SZ} color={colors.text} />
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>

      <Text style={[s.moodLabel, { color: colors.text }]}>{MOODS[selectedIdx].label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingBottom: 24 },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 32,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  subtitle: {
    fontSize: 12, fontWeight: "500",
    textAlign: "center", marginBottom: 6, letterSpacing: 0.5,
  },
  title: {
    fontSize: 22, fontWeight: "600",
    textAlign: "center", lineHeight: 30, marginBottom: 48,
  },
  carousel: {
    height: CIRCLE + 24,
    overflow: "hidden",
  },
  iconRow: {
    flexDirection: "row",
    position: "absolute",
    top: 0,
    height: CIRCLE + 24,
    width: SLOT_W * MOODS.length,
  },
  iconSlot: {
    width: SLOT_W,
    height: CIRCLE + 24,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  moodLabel: {
    fontSize: 16, fontWeight: "500",
    textAlign: "center", marginTop: 28,
  },
});
