import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

type AnimatedBlobsProps = {
  blobStyle: Record<string, unknown>;
  blobAltStyle: Record<string, unknown>;
};

export function AnimatedBlobs({ blobStyle, blobAltStyle }: AnimatedBlobsProps) {
  const xAnim = useRef(new Animated.Value(0)).current;
  const yAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(xAnim, {
            toValue: 1,
            duration: 2800,
            useNativeDriver: true,
          }),
          Animated.timing(xAnim, {
            toValue: 0,
            duration: 2800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(yAnim, {
            toValue: 1,
            duration: 3600,
            useNativeDriver: true,
          }),
          Animated.timing(yAnim, {
            toValue: 0,
            duration: 3600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [xAnim, yAnim]);

  const driftX = xAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });
  const driftY = yAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });
  const driftAltX = xAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [140, -140],
  });
  const driftAltY = yAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, -120],
  });
  const driftThirdX = xAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 40],
  });
  const driftThirdY = yAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 30],
  });

  return (
    <>
      <Animated.View
        style={[
          blobStyle,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      />
      <Animated.View
        style={[
          blobAltStyle,
          { transform: [{ translateX: driftAltX }, { translateY: driftAltY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.globalBottomBlob,
          {
            transform: [
              { translateX: driftThirdX },
              { translateY: driftThirdY },
              { scale: 0.9 },
            ],
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  globalBottomBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(95, 120, 60, 0.35)",
    bottom: -80,
    left: -60,
    zIndex: 0,
  },
});
