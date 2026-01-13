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
  backgroundStart: "#050505",
  backgroundEnd: "#0c0c0c",
  surface: "#0f0f0f",
  surfaceAlt: "#171717",
  border: "#2a2a2a",
  text: "#f5f5f5",
  textMuted: "#9ca3af",
  brand: "#e5e5e5",
  accent: "#e5e5e5",
  accentStrong: "#ffffff",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#f87171",
  infoSoft: "#1a1a1a",
  successSoft: "#12301a",
  warningSoft: "#33230d",
  dangerSoft: "#331616",
};

export const adminPalettes: Record<AdminPaletteMode, AdminPalette> = {
  light: lightAdminPalette,
  dark: darkAdminPalette,
};
