import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronLeft, ChevronRight, Angry, Frown, Meh, Smile, Laugh, X } from "lucide-react-native";
import type { MoodKey } from "./MoodSheet";

const MOOD_ICONS: Record<string, React.ComponentType<any>> = {
  awful: Angry, sad: Frown, okay: Meh, good: Smile, great: Laugh,
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface MoodCalendarSheetProps {
  moodHistory: Record<string, MoodKey | string>;
  onClose: () => void;
  colors: {
    text: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    textMuted: string;
  };
}

export default function MoodCalendarSheet({ moodHistory, onClose, colors }: MoodCalendarSheetProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  return (
    <View style={s.container}>
      <View style={s.navRow}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[s.monthTitle, { color: colors.text }]}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <ChevronRight size={20} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={[s.navBtn, s.closeBtn]}>
          <X size={18} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={s.dayHeaders}>
        {DAYS.map((d) => (
          <Text key={d} style={[s.dayHeader, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>

      <View style={s.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={s.cell} />;
          const key = toKey(year, month, day);
          const moodKey = moodHistory[key];
          const Icon = moodKey ? MOOD_ICONS[moodKey] : null;
          const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();

          return (
            <View key={i} style={s.cell}>
              <View style={[
                s.dayCircle,
                { backgroundColor: colors.surfaceAlt },
                Icon && { backgroundColor: colors.text },
                isToday && !Icon && { backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.text },
              ]}>
                {Icon
                  ? <Icon size={18} color={colors.surface} strokeWidth={1.8} />
                  : <Text style={[s.dayNum, { color: colors.textMuted }, isToday && { color: colors.text, fontWeight: "700" }]}>{day}</Text>
                }
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingBottom: 8 },
  navRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  navBtn: { padding: 6 },
  closeBtn: { marginLeft: 8 },
  monthTitle: { fontSize: 18, fontWeight: "700" },
  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", alignItems: "center", marginBottom: 8 },
  dayCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  dayNum: { fontSize: 12, fontWeight: "500" },
});
