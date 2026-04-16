import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LogBox } from "react-native";
import { ThemeProvider, useTheme } from "@/lib/context";

function AppShell() {
  const { mode } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const persistRoute = async () => {
      const isTabsRoute = pathname.startsWith("/(tabs)");
      if (!isTabsRoute) return;
      try {
        await AsyncStorage.setItem("spendly:lastRoute", pathname);
      } catch {
        // ignore storage errors
      }
    };
    persistRoute();
  }, [pathname]);

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    LogBox.ignoreLogs([
      "Could not reach Cloud Firestore backend",
      "Connection failed 1 times",
    ]);
  }, []);

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
