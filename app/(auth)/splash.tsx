import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/lib/firebase";

export default function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
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
        duration: 500,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }
      });
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.logoBubble,
              { opacity: logoOpacity, transform: [{ scale: logoScale }] },
            ]}
          >
            <Image
              source={require("../../assets/images/spendly-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={{ opacity: textOpacity, alignItems: "center" }}>
            <Text style={styles.appName}>Spendly</Text>
            <Text style={styles.tagline}>Smart Work & Finance Tracker</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  logoBubble: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logo: { width: 56, height: 56 },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
    letterSpacing: 0.2,
  },
});
