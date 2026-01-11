type GameXpInputs = {
  approvedLogsCount: number;
  goalsCount: number;
  completedGoalsCount: number;
  completedChallengesCount: number;
};

type TotalXpInputs = {
  baseXp: number;
  bonusXp?: number;
  storedTotalXp?: number | null;
};

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900];

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const getConsecutiveStreakDays = (logs: any[]) => {
  if (!logs.length) return 0;
  const dates = new Set(
    logs
      .filter(log => log?.date)
      .map(log => String(log.date).slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (!dates.has(getDateKey(d))) break;
    streak += 1;
  }
  return streak;
};

export const getLevelProgress = (xp: number) => {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const currentFloor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextXp = LEVEL_THRESHOLDS[level] ?? (currentFloor + 600);
  const progress = Math.min(
    100,
    Math.round(((xp - currentFloor) / (nextXp - currentFloor)) * 100)
  );
  return { level, nextXp, progress };
};

export const getBaseXp = ({
  approvedLogsCount,
  goalsCount,
  completedGoalsCount,
  completedChallengesCount,
}: GameXpInputs) => {
  const base =
    approvedLogsCount * 10 +
    goalsCount * 20 +
    completedGoalsCount * 50 +
    completedChallengesCount * 30;
  return Math.max(0, base);
};

export const getTotalXp = ({ baseXp, bonusXp = 0, storedTotalXp }: TotalXpInputs) => {
  if (typeof storedTotalXp === "number" && storedTotalXp > 0) {
    return storedTotalXp;
  }
  return Math.max(0, baseXp + bonusXp);
};
