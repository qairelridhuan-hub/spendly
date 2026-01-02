import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "@/lib/context";

export default function RootLayout() {
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
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
