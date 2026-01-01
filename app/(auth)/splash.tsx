import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Animated, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      const unsubscribe = onAuthStateChanged(auth, async user => {
        if (user) {
          try {
            const lastRoute = await AsyncStorage.getItem("spendly:lastRoute");
            if (lastRoute && lastRoute.startsWith("/(tabs)")) {
              router.replace(lastRoute);
            } else {
              router.replace("/(tabs)");
            }
          } catch {
            router.replace("/(tabs)");
          }
        } else {
          router.replace("/(auth)/login");
        }
        unsubscribe();
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={["#0f172a", "#1e293b"]} style={{ flex: 1 }}>
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Animated.View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: "#22c55e",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Text style={{ fontSize: 30, color: "#fff" }}>💰</Text>
        </Animated.View>

        <Animated.Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: "#fff",
            marginBottom: 8,
            opacity: textOpacity,
          }}
        >
          Spendly
        </Animated.Text>
        <Animated.Text
          style={{ color: "#cbd5f5", textAlign: "center", opacity: textOpacity }}
        >
          Part-Time Work Management System
        </Animated.Text>
      </SafeAreaView>
    </LinearGradient>
  );
}
