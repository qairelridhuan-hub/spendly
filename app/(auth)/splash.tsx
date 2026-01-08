import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { router } from "expo-router";
import { Animated, PanResponder, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

export default function SplashScreen() {
  const [fontsLoaded] = useFonts({
    "SpaceGrotesk-SemiBold": require("../../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const cardFloatAlt = useRef(new Animated.Value(0)).current;
  const cardSlideLeft = useRef(new Animated.Value(-180)).current;
  const cardSlideRight = useRef(new Animated.Value(160)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const sliderPulse = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const maxTranslateRef = useRef(0);

  const sliderHeight = 56;
  const sliderPadding = 2;
  const thumbSize = 52;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(sliderPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(sliderPulse, {
          toValue: 0,
          duration: 1200,
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
  }, []);

  const handleContinue = () => {
    router.replace("/(tabs)");
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isNavigating,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !isNavigating && Math.abs(gesture.dx) > 3,
      onPanResponderMove: (_, gesture) => {
        const maxTranslate = maxTranslateRef.current;
        const nextX = Math.max(0, Math.min(gesture.dx, maxTranslate));
        swipeX.setValue(nextX);
      },
      onPanResponderRelease: (_, gesture) => {
        const maxTranslate = maxTranslateRef.current;
        const releaseX = Math.max(0, Math.min(gesture.dx, maxTranslate));
        const shouldComplete = maxTranslate > 0 && releaseX > maxTranslate * 0.7;

        if (shouldComplete) {
          setIsNavigating(true);
          Animated.timing(swipeX, {
            toValue: maxTranslate,
            duration: 200,
            useNativeDriver: true,
          }).start(() => handleContinue());
          return;
        }

        Animated.spring(swipeX, {
          toValue: 0,
          tension: 120,
          friction: 14,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

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
        <Svg
          width="140%"
          height={240}
          viewBox="0 0 520 240"
          style={{
            position: "absolute",
            left: -120,
            top: 280,
            opacity: 0.55,
            transform: [{ rotate: "-10deg" }],
          }}
        >
          <Path
            d="M-10,40 C110,10 180,110 280,90 C380,70 430,10 560,30"
            stroke="rgba(183,243,77,0.32)"
            strokeWidth={1.2}
            fill="none"
          />
          <Path
            d="M-10,60 C110,30 180,130 280,110 C380,90 430,30 560,50"
            stroke="rgba(183,243,77,0.2)"
            strokeWidth={1.1}
            fill="none"
          />
          <Path
            d="M-20,150 C90,110 200,200 310,170 C400,145 460,120 560,130"
            stroke="rgba(183,243,77,0.3)"
            strokeWidth={1.15}
            fill="none"
          />
          <Path
            d="M-20,170 C90,130 200,220 310,190 C400,165 460,140 560,150"
            stroke="rgba(183,243,77,0.18)"
            strokeWidth={1.05}
            fill="none"
          />
        </Svg>
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
              width: 200,
              height: 120,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.2)",
              backgroundColor: "rgba(15, 23, 42, 0.45)",
              top: 140,
              right: -30,
              opacity: 0.55,
              transform: [
                { translateX: cardSlideRight },
                {
                  translateY: cardFloat.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 12],
                  }),
                },
                { rotate: "16deg" },
              ],
            }}
          >
            <View style={{ padding: 12 }}>
              <Text style={{ color: "#cbd5f5", fontSize: 9 }}>CARD HOLDER NAME</Text>
              <Text style={{ color: "#e5e7eb", fontSize: 13, marginTop: 10, fontWeight: "700" }}>
                4526 7291 8632
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 9, marginTop: 4 }}>06/30</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              width: 180,
              height: 110,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.18)",
              backgroundColor: "rgba(15, 23, 42, 0.38)",
              top: 360,
              right: -26,
              opacity: 0.5,
              transform: [
                { translateX: cardSlideRight },
                {
                  translateY: cardFloatAlt.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
                { rotate: "10deg" },
              ],
            }}
          >
            <View style={{ padding: 10 }}>
              <Text style={{ color: "#cbd5f5", fontSize: 9 }}>CARD HOLDER NAME</Text>
              <Text style={{ color: "#e5e7eb", fontSize: 12, marginTop: 9, fontWeight: "700" }}>
                6341 2208 7759
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 9, marginTop: 4 }}>11/26</Text>
            </View>
          </Animated.View>
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
              fontSize: 34,
              fontWeight: "800",
              color: "#f8fafc",
              lineHeight: 40,
              opacity: textOpacity,
              fontFamily: fontsLoaded ? "SpaceGrotesk-SemiBold" : undefined,
            }}
          >
            Financial{"\n"}Management{"\n"}Is Easier{"\n"}With Spendly
          </Animated.Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <View
            onLayout={event => {
              const width = event.nativeEvent.layout.width;
              maxTranslateRef.current = Math.max(
                0,
                width - thumbSize - sliderPadding * 2
              );
              swipeX.setValue(0);
            }}
            style={{
              width: 260,
              height: sliderHeight,
              borderRadius: sliderHeight / 2,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.35)",
              padding: sliderPadding,
              justifyContent: "center",
              overflow: "hidden",
              opacity: isNavigating ? 0.7 : 1,
            }}
          >
            <Animated.Text
              style={{
                color: "rgba(248, 250, 252, 0.98)",
                fontSize: 12,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: 1.4,
                opacity: sliderPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.55, 0.9],
                }),
                textShadowColor: "rgba(248, 250, 252, 0.9)",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              }}
            >
              {isNavigating ? "Opening..." : "Slide to enter"}
            </Animated.Text>
            <Animated.View
              {...panResponder.panHandlers}
              style={{
                position: "absolute",
                left: sliderPadding,
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: "#b7f34d",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000000",
                shadowOpacity: sliderPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.75, 1],
                }),
                shadowRadius: sliderPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 34],
                }),
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
                opacity: sliderPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
                transform: [{ translateX: swipeX }],
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: thumbSize + 34,
                  height: thumbSize + 34,
                  borderRadius: (thumbSize + 34) / 2,
                  backgroundColor: "rgba(183,243,77,0.32)",
                  transform: [
                    {
                      scale: sliderPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.95, 1.12],
                      }),
                    },
                  ],
                  opacity: sliderPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                }}
              />
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: thumbSize + 60,
                  height: thumbSize + 60,
                  borderRadius: (thumbSize + 60) / 2,
                  backgroundColor: "rgba(183,243,77,0.18)",
                  transform: [
                    {
                      scale: sliderPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1.08],
                      }),
                    },
                  ],
                  opacity: sliderPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 0.7],
                  }),
                }}
              />
              <Text style={{ fontSize: 22, color: "#0b1220" }}>→</Text>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
