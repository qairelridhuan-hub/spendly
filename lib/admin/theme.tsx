import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminPalettes, type AdminPalette, type AdminPaletteMode } from "./palette";

type AdminThemeContextValue = {
  mode: AdminPaletteMode;
  colors: AdminPalette;
  toggleMode: () => void;
  setMode: (mode: AdminPaletteMode) => void;
};

const STORAGE_KEY = "spendly:admin-theme:v2";

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AdminPaletteMode>("dark");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setMode(stored);
          return;
        }
      } catch {
        // ignore storage errors
      }
      setMode("dark");
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
      colors: adminPalettes[mode],
      toggleMode: () => setMode(prev => (prev === "light" ? "dark" : "light")),
      setMode,
    }),
    [mode]
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return context;
}
