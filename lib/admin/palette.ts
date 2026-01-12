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
  backgroundStart: "#f8fafc",
  backgroundEnd: "#eef2f7",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  brand: "#0ea5e9",
  accent: "#0ea5e9",
  accentStrong: "#0284c7",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  infoSoft: "#e0f2fe",
  successSoft: "#dcfce7",
  warningSoft: "#ffedd5",
  dangerSoft: "#fee2e2",
};

export const darkAdminPalette: AdminPalette = {
  backgroundStart: "#0b1220",
  backgroundEnd: "#0f172a",
  surface: "#121b2b",
  surfaceAlt: "#1b2636",
  border: "#273244",
  text: "#e5e7eb",
  textMuted: "#a1a1aa",
  brand: "#38bdf8",
  accent: "#38bdf8",
  accentStrong: "#7dd3fc",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#f87171",
  infoSoft: "#1f2f46",
  successSoft: "#123521",
  warningSoft: "#3d2a10",
  dangerSoft: "#3b1b1b",
};

export const adminPalettes: Record<AdminPaletteMode, AdminPalette> = {
  light: lightAdminPalette,
  dark: darkAdminPalette,
};
