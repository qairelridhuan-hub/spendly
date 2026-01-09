import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export function AuthWaveBackground() {
  const waveShift = useRef(new Animated.Value(0)).current;
  const waveShiftAlt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(waveShift, {
          toValue: 1,
          duration: 9000,
          useNativeDriver: true,
        }),
        Animated.timing(waveShift, {
          toValue: 0,
          duration: 9000,
          useNativeDriver: true,
        }),
      ])
    );
    const animAlt = Animated.loop(
      Animated.sequence([
        Animated.timing(waveShiftAlt, {
          toValue: 1,
          duration: 11000,
          useNativeDriver: true,
        }),
        Animated.timing(waveShiftAlt, {
          toValue: 0,
          duration: 11000,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    animAlt.start();
    return () => {
      anim.stop();
      animAlt.stop();
    };
  }, [waveShift, waveShiftAlt]);

  const translateX = waveShift.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 34],
  });
  const translateXAlt = waveShiftAlt.interpolate({
    inputRange: [0, 1],
    outputRange: [28, -28],
  });

  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="none">
      <Animated.View
        style={{
          position: "absolute",
          left: -110,
          right: -110,
          top: "40%",
          opacity: 0.75,
          transform: [{ translateY: -120 }, { translateX }, { rotate: "-10deg" }],
        }}
      >
        <Svg width="140%" height={240} viewBox="0 0 520 240">
          <Path
            d="M-10,40 C110,10 180,110 280,90 C380,70 430,10 560,30"
            stroke="rgba(183,243,77,0.45)"
            strokeWidth={1.4}
            fill="none"
          />
          <Path
            d="M-10,60 C110,30 180,130 280,110 C380,90 430,30 560,50"
            stroke="rgba(183,243,77,0.32)"
            strokeWidth={1.3}
            fill="none"
          />
          <Path
            d="M-20,150 C90,110 200,200 310,170 C400,145 460,120 560,130"
            stroke="rgba(183,243,77,0.4)"
            strokeWidth={1.35}
            fill="none"
          />
          <Path
            d="M-20,170 C90,130 200,220 310,190 C400,165 460,140 560,150"
            stroke="rgba(183,243,77,0.28)"
            strokeWidth={1.2}
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: -120,
          right: -120,
          top: "60%",
          opacity: 0.6,
          transform: [{ translateY: -110 }, { translateX: translateXAlt }, { rotate: "6deg" }],
        }}
      >
        <Svg width="140%" height={220} viewBox="0 0 520 220">
          <Path
            d="M-20,40 C100,20 190,90 290,70 C390,50 440,10 560,30"
            stroke="rgba(183,243,77,0.28)"
            strokeWidth={1.1}
            fill="none"
          />
          <Path
            d="M-10,120 C110,90 210,170 320,150 C410,130 470,110 560,120"
            stroke="rgba(183,243,77,0.24)"
            strokeWidth={1.05}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
