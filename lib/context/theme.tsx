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
    backgroundStart: "#ffffff",
    backgroundEnd: "#f5f5f5",
    surface: "#ffffff",
    surfaceAlt: "#f5f5f5",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    accent: "#111827",
    accentStrong: "#374151",
    success: "#16a34a",
    danger: "#dc2626",
    warning: "#d97706",
  },
  dark: {
    backgroundStart: "#000000",
    backgroundEnd: "#0a0a0a",
    surface: "#111111",
    surfaceAlt: "#1a1a1a",
    text: "#f5f5f5",
    textMuted: "#9ca3af",
    border: "#2a2a2a",
    accent: "#b7f34d",
    accentStrong: "#9ae642",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
  },
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setMode(stored);
          return;
        }
        setMode("light");
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
