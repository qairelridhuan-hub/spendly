import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { router } from "expo-router";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SplashScreen() {
  const [fontsLoaded] = useFonts({
    "SpaceGrotesk-SemiBold": require("../../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
  });
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const cardFloatAlt = useRef(new Animated.Value(0)).current;
  const cardSlideLeft = useRef(new Animated.Value(-180)).current;
  const cardSlideRight = useRef(new Animated.Value(160)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: 1,
          duration: 3600,
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 0,
          duration: 3600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloatAlt, {
          toValue: 1,
          duration: 4200,
          useNativeDriver: true,
        }),
        Animated.timing(cardFloatAlt, {
          toValue: 0,
          duration: 4200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.parallel([
      Animated.timing(cardSlideLeft, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideRight, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

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
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={["#0b1220", "#0f1a1a", "#0b0f12"]} style={{ flex: 1 }}>
      <View style={{ position: "absolute", inset: 0 }}>
        <Animated.View
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: "rgba(183,243,77,0.12)",
            top: -120,
            left: -140,
            opacity: glowPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.8],
            }),
            transform: [
              {
                scale: glowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1.05],
                }),
              },
            ],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            bottom: -120,
            right: -80,
          }}
        />
      </View>
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "space-between",
          padding: 24,
        }}
      >
        <View>
          <Animated.View
            style={{
              position: "absolute",
              width: 260,
              height: 160,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.35)",
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              top: 20,
              left: 0,
              opacity: 0.8,
              transform: [
                { translateX: cardSlideLeft },
                {
                  translateY: cardFloat.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10],
                  }),
                },
                { rotate: "-10deg" },
              ],
            }}
          >
            <View style={{ padding: 16 }}>
              <Text style={{ color: "#cbd5f5", fontSize: 11 }}>CARD HOLDER NAME</Text>
              <Text style={{ color: "#e5e7eb", fontSize: 16, marginTop: 14, fontWeight: "700" }}>
                2361 5426 7658
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 6 }}>05/29</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              width: 160,
              height: 100,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.25)",
              backgroundColor: "rgba(15, 23, 42, 0.5)",
              top: 40,
              right: -4,
              opacity: 0.7,
              transform: [
                { translateX: cardSlideRight },
                {
                  translateY: cardFloatAlt.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
                { rotate: "12deg" },
              ],
            }}
          />
          <View
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: 140,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.2)",
              top: 120,
              left: -120,
              opacity: 0.3,
            }}
          />
        </View>

        <View>
          <Animated.View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#b7f34d",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            }}
          >
            <Text style={{ fontSize: 24, color: "#0b1220" }}>💰</Text>
          </Animated.View>

          <Animated.Text
            style={{
              fontSize: 30,
              fontWeight: "800",
              color: "#f8fafc",
              lineHeight: 36,
              opacity: textOpacity,
              fontFamily: fontsLoaded ? "SpaceGrotesk-SemiBold" : undefined,
            }}
          >
            Financial{"\n"}Management{"\n"}Is Easier{"\n"}With Spendly
          </Animated.Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#b7f34d",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000000",
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 22, color: "#0b1220" }}>→</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
