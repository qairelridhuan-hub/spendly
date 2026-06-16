import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, PanResponder, LayoutChangeEvent, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { X, Check, CalendarDays, SmilePlus } from "lucide-react-native";
import { AwfulFace, SadFace, NeutralFace, GoodFace, GreatFace } from "./MoodFaces";

export type MoodKey = "awful" | "sad" | "okay" | "good" | "great";

export interface Mood {
  key: MoodKey;
  emoji: string;
  label: string;
}

export const MOODS: Mood[] = [
  { key: "awful", emoji: "😢", label: "Awful" },
  { key: "sad",   emoji: "😕", label: "Sad"   },
  { key: "okay",  emoji: "😐", label: "Okay"  },
  { key: "good",  emoji: "🙂", label: "Good"  },
  { key: "great", emoji: "😄", label: "Great" },
];

// Feature 1: mood-reactive background colors
const MOOD_BG_COLOR: Record<MoodKey, string> = {
  awful: "#fce7e7",
  sad:   "#fef3e8",
  okay:  "#f3f4f6",
  good:  "#e8f8ef",
  great: "#fffbea",
};

// Feature 3: animated subtitle phrases per mood
const MOOD_PHRASES: Record<MoodKey, string> = {
  awful: "It's okay — tough days happen",
  sad:   "Something weighing on you?",
  okay:  "Just another day, huh?",
  good:  "Things are looking up!",
  great: "You're absolutely thriving!",
};

// Feature 2: context-aware note placeholders
const MOOD_PLACEHOLDER: Record<MoodKey, string> = {
  awful: "What's making things hard right now?",
  sad:   "Want to talk about what's on your mind?",
  okay:  "Anything notable about today?",
  good:  "What's been going well?",
  great: "What's making you smile today?",
};

// Feature 4: dot colors per mood
const MOOD_DOT: Record<MoodKey, string> = {
  awful: "#f87171",
  sad:   "#fb923c",
  okay:  "#9ca3af",
  good:  "#4ade80",
  great: "#facc15",
};

const FACES = [AwfulFace, SadFace, NeutralFace, GoodFace, GreatFace];
const CIRCLE  = 124;
const ICON_SZ = 80;
const SLOT_W  = 100;
const STEP_PX = 80;

const HAPTIC = [
  Haptics.ImpactFeedbackStyle.Light,
  Haptics.ImpactFeedbackStyle.Light,
  Haptics.ImpactFeedbackStyle.Medium,
  Haptics.ImpactFeedbackStyle.Medium,
  Haptics.ImpactFeedbackStyle.Heavy,
];

const targetScale   = (dist: number) => (dist === 0 ? 1 : dist === 1 ? 0.58 : 0.40);
const targetOpacity = (dist: number) => (dist === 0 ? 1 : dist === 1 ? 0.55 : 0.28);
const IDX_RANGE = MOODS.map((_, j) => j);

interface MoodSheetProps {
  mood: Mood | null;
  onSelect: (mood: Mood, note: string) => void;
  onClose: () => void;
  onOpenCalendar?: () => void;
  onOpenMoodChart?: () => void;
  colors: { text: string; surface: string; border: string; textMuted: string };
}

export default function MoodSheet({ mood, onSelect, onClose, onOpenCalendar, onOpenMoodChart, colors }: MoodSheetProps) {
  const defaultIdx = mood ? Math.max(0, MOODS.findIndex((m) => m.key === mood.key)) : 2;
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx);
  const [note, setNote] = useState("");
  const idxRef = useRef(defaultIdx);
  const [carouselWidth, setCarouselWidth] = useState(0);

  const position    = useRef(new Animated.Value(defaultIdx)).current;
  const reactionTX  = useRef(new Animated.Value(0)).current;
  const reactionTY  = useRef(new Animated.Value(0)).current;
  const reactionSc  = useRef(new Animated.Value(1)).current;

  // Feature 1: background color animation (JS-driven)
  const bgAnim = useRef(new Animated.Value(defaultIdx)).current;

  // Feature 3: phrase slide animation
  const phraseOpacity    = useRef(new Animated.Value(1)).current;
  const phraseTranslateY = useRef(new Animated.Value(0)).current;
  const [displayPhrase, setDisplayPhrase] = useState(MOOD_PHRASES[MOODS[defaultIdx].key]);

  const onCarouselLayout = (e: LayoutChangeEvent) =>
    setCarouselWidth(e.nativeEvent.layout.width);

  const rowTranslateX = position.interpolate({
    inputRange:  IDX_RANGE,
    outputRange: IDX_RANGE.map((i) => carouselWidth / 2 - (i + 0.5) * SLOT_W),
    extrapolate: "clamp",
  });

  const getScale   = (i: number) => position.interpolate({ inputRange: IDX_RANGE, outputRange: IDX_RANGE.map((j) => targetScale(Math.abs(j - i))),   extrapolate: "clamp" });
  const getOpacity = (i: number) => position.interpolate({ inputRange: IDX_RANGE, outputRange: IDX_RANGE.map((j) => targetOpacity(Math.abs(j - i))), extrapolate: "clamp" });

  const triggerReaction = (key: MoodKey) => {
    reactionTX.setValue(0);
    reactionTY.setValue(0);
    reactionSc.setValue(1);

    if (key === "awful") {
      Animated.sequence([
        Animated.timing(reactionTX, { toValue: -9,  duration: 90,  easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionTX, { toValue:  9,  duration: 130, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionTX, { toValue: -6,  duration: 110, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionTX, { toValue:  4,  duration: 100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionTX, { toValue:  0,  duration: 90,  easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start();
    } else if (key === "sad") {
      Animated.sequence([
        Animated.timing(reactionSc, { toValue: 0.84, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionSc, { toValue: 1.03, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionSc, { toValue: 1,    duration: 120, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ]).start();
    } else if (key === "okay") {
      Animated.sequence([
        Animated.timing(reactionSc, { toValue: 1.09, duration: 130, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(reactionSc, { toValue: 1,    duration: 130, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ]).start();
    } else if (key === "good") {
      Animated.sequence([
        Animated.timing(reactionSc, { toValue: 1.25, duration: 110, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(reactionSc, { toValue: 0.96, duration: 90,  easing: Easing.in(Easing.ease),     useNativeDriver: true }),
        Animated.timing(reactionSc, { toValue: 1,    duration: 80,  easing: Easing.out(Easing.ease),    useNativeDriver: true }),
      ]).start();
    } else if (key === "great") {
      Animated.sequence([
        Animated.timing(reactionTY, { toValue: -18, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(reactionTY, { toValue:   0, duration: 120, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.timing(reactionTY, { toValue: -10, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(reactionTY, { toValue:   0, duration: 100, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      ]).start();
    }
  };

  const animatePhrase = (idx: number) => {
    Animated.parallel([
      Animated.timing(phraseOpacity,    { toValue: 0,  duration: 110, useNativeDriver: true }),
      Animated.timing(phraseTranslateY, { toValue: -8, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setDisplayPhrase(MOOD_PHRASES[MOODS[idx].key]);
      phraseTranslateY.setValue(8);
      Animated.parallel([
        Animated.timing(phraseOpacity,    { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(phraseTranslateY, { toValue: 0, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
  };

  const getReactionTransform = (i: number) => {
    if (i !== selectedIdx) return [];
    const key = MOODS[i].key;
    if (key === "awful") return [{ translateX: reactionTX }];
    if (key === "great") return [{ translateY: reactionTY }];
    return [{ scale: reactionSc }];
  };

  const snapTo = (idx: number) => {
    idxRef.current = idx;
    setSelectedIdx(idx);
    Haptics.impactAsync(HAPTIC[idx]);
    Animated.spring(position, { toValue: idx, useNativeDriver: true, damping: 16, stiffness: 200 }).start();
    triggerReaction(MOODS[idx].key);
    Animated.spring(bgAnim, { toValue: idx, useNativeDriver: false, damping: 22, stiffness: 130 }).start();
    animatePhrase(idx);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: (_, g) => {
        const raw = idxRef.current - g.dx / STEP_PX;
        const clamped = Math.max(0, Math.min(MOODS.length - 1, raw));
        position.setValue(clamped);
        bgAnim.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const cur = idxRef.current;
        let next = cur;
        if (g.dx < -25 && cur < MOODS.length - 1) next = cur + 1;
        else if (g.dx > 25 && cur > 0)             next = cur - 1;
        snapTo(next);
      },
    })
  ).current;

  const bgColor = bgAnim.interpolate({
    inputRange:  IDX_RANGE,
    outputRange: MOODS.map((m) => MOOD_BG_COLOR[m.key]),
    extrapolate: "clamp",
  });

  const confirm = () => { onSelect(MOODS[selectedIdx], note.trim()); onClose(); };

  const currentMoodKey = MOODS[selectedIdx].key;

  return (
    <Animated.View style={[s.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity style={[s.headerBtn, { borderColor: colors.border }]} onPress={onClose} activeOpacity={0.7}>
          <X size={18} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: 999, overflow: "hidden" }}>
          <TouchableOpacity onPress={onOpenCalendar} activeOpacity={0.7} style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
            <CalendarDays size={18} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />
          <TouchableOpacity onPress={onOpenMoodChart} activeOpacity={0.7} style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
            <SmilePlus size={18} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[s.headerBtn, { backgroundColor: colors.text, borderColor: colors.text }]} onPress={confirm} activeOpacity={0.8}>
          <Check size={18} color={colors.surface} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={[s.subtitle, { color: colors.textMuted }]}>Mood</Text>
      <Text style={[s.title, { color: colors.text }]}>How are you feeling?</Text>

      {/* Feature 3: animated subtitle phrase */}
      <Animated.Text style={[s.phrase, { color: colors.textMuted, opacity: phraseOpacity, transform: [{ translateY: phraseTranslateY }] }]}>
        {displayPhrase}
      </Animated.Text>

      {/* Carousel */}
      <View style={s.carousel} onLayout={onCarouselLayout} {...panResponder.panHandlers}>
        <Animated.View style={[s.iconRow, { transform: [{ translateX: rowTranslateX }] }]}>
          {MOODS.map((m, i) => {
            const Face = FACES[i];
            return (
              <TouchableOpacity key={m.key} onPress={() => snapTo(i)} activeOpacity={0.8} style={s.iconSlot}>
                <Animated.View style={[s.circle, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, opacity: getOpacity(i), transform: [{ scale: getScale(i) }] }]}>
                  <Animated.View style={{ transform: getReactionTransform(i) }}>
                    <Face size={ICON_SZ} color={colors.text} />
                  </Animated.View>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>

      {/* Feature 4: dot indicators */}
      <View style={s.dotsRow}>
        {MOODS.map((m, i) => (
          <Animated.View
            key={m.key}
            style={[
              s.dot,
              {
                backgroundColor: MOOD_DOT[m.key],
                opacity: position.interpolate({
                  inputRange:  IDX_RANGE,
                  outputRange: IDX_RANGE.map((j) => (j === i ? 1 : 0.22)),
                  extrapolate: "clamp",
                }),
                transform: [{
                  scale: position.interpolate({
                    inputRange:  IDX_RANGE,
                    outputRange: IDX_RANGE.map((j) => (j === i ? 1.5 : 1)),
                    extrapolate: "clamp",
                  }),
                }],
              },
            ]}
          />
        ))}
      </View>

      {/* Mood label */}
      <Text style={[s.moodLabel, { color: colors.text }]}>{MOODS[selectedIdx].label}</Text>

      {/* Feature 2: context-aware placeholder + note input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={MOOD_PLACEHOLDER[currentMoodKey]}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
          style={[s.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        {note.length > 0 && (
          <Text style={[s.noteCount, { color: colors.textMuted }]}>{note.length}/200</Text>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container:  { padding: 20, paddingBottom: 28, borderRadius: 24 },
  headerRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  headerBtn:  { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  subtitle:   { fontSize: 12, fontWeight: "500", textAlign: "center", marginBottom: 6, letterSpacing: 0.5 },
  title:      { fontSize: 22, fontWeight: "600", textAlign: "center", lineHeight: 30, marginBottom: 4 },
  phrase:     { fontSize: 13, textAlign: "center", marginBottom: 34, letterSpacing: 0.1 },
  carousel:   { height: CIRCLE + 24, overflow: "hidden" },
  iconRow:    { flexDirection: "row", position: "absolute", top: 0, height: CIRCLE + 24, width: SLOT_W * MOODS.length },
  iconSlot:   { width: SLOT_W, height: CIRCLE + 24, alignItems: "center", justifyContent: "center" },
  circle:     { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  dotsRow:    { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 14 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  moodLabel:  { fontSize: 16, fontWeight: "500", textAlign: "center", marginTop: 12 },
  noteInput: {
    marginTop: 16, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, minHeight: 60, textAlignVertical: "top",
  },
  noteCount: { fontSize: 10, textAlign: "right", marginTop: 4 },
});
