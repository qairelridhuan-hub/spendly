export type AdminPaletteMode = "light" | "dark";

export type AdminPalette = {
  backgroundStart: string;
  backgroundEnd: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  brand: string;
  accent: string;
  accentStrong: string;
  success: string;
  warning: string;
  danger: string;
  infoSoft: string;
  successSoft: string;
  warningSoft: string;
  dangerSoft: string;
};

export const lightAdminPalette: AdminPalette = {
  backgroundStart: "#f9f9f9",
  backgroundEnd:   "#f2f2f2",
  surface:         "#ffffff",
  surfaceAlt:      "#f4f4f5",
  border:          "#e4e4e7",
  text:            "#111111",
  textMuted:       "#71717a",
  brand:           "#18181b",
  accent:          "#18181b",
  accentStrong:    "#000000",
  success:         "#16a34a",
  warning:         "#d97706",
  danger:          "#dc2626",
  infoSoft:        "#f0f9ff",
  successSoft:     "#f0fdf4",
  warningSoft:     "#fffbeb",
  dangerSoft:      "#fef2f2",
};

export const darkAdminPalette: AdminPalette = {
  backgroundStart: "#0a0a0a",
  backgroundEnd:   "#0a0a0a",
  surface:         "#111111",
  surfaceAlt:      "#1a1a1a",
  border:          "#242424",
  text:            "#e8e8e8",
  textMuted:       "#6b7280",
  brand:           "#e8e8e8",
  accent:          "#e8e8e8",
  accentStrong:    "#ffffff",
  success:         "#22c55e",
  warning:         "#f59e0b",
  danger:          "#f87171",
  infoSoft:        "#17171a",
  successSoft:     "#0f1f14",
  warningSoft:     "#1f1a0f",
  dangerSoft:      "#1f1010",
};

export const adminPalettes: Record<AdminPaletteMode, AdminPalette> = {
  light: lightAdminPalette,
  dark:  darkAdminPalette,
};
