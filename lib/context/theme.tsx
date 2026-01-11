import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";

type ThemeColors = {
  backgroundStart: string;
  backgroundEnd: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentStrong: string;
  success: string;
  danger: string;
  warning: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = "spendly:theme";

const themes: Record<ThemeMode, ThemeColors> = {
  light: {
    backgroundStart: "#f8fafc",
    backgroundEnd: "#eef2f7",
    surface: "#ffffff",
    surfaceAlt: "#f1f5f9",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    accent: "#0ea5e9",
    accentStrong: "#0f172a",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f97316",
  },
  dark: {
    backgroundStart: "#0b1220",
    backgroundEnd: "#111827",
    surface: "#141c2a",
    surfaceAlt: "#1b2636",
    text: "#e5e7eb",
    textMuted: "#9ca3af",
    border: "#273244",
    accent: "#b7f34d",
    accentStrong: "#9ae642",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
  },
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setMode("dark");
          return;
        }
        setMode("dark");
      } catch {
        // ignore storage errors
        setMode("dark");
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const persistTheme = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // ignore storage errors
      }
    };
    persistTheme();
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      colors: themes[mode],
      toggleTheme: () => setMode(prev => (prev === "light" ? "dark" : "light")),
      setMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
