import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface FaceProps { size?: number; color?: string; }

type EmotionCfg = {
  glanceDuration: number;
  glancePause:    number;
  glanceShift:    number;
  glanceEasing:   (t: number) => number;
  blinkClose:     number;
  blinkOpen:      number;
  blinkMin:       number;
  blinkMax:       number;
  initialDelay:   number;
  openRyRatio:    number; // fraction of rx — <1 gives droopy/heavy-lidded look
};

const CFG: Record<string, EmotionCfg> = {
  awful: {
    glanceDuration: 2600, glancePause: 1400, glanceShift: 1.5,
    glanceEasing: Easing.inOut(Easing.ease),
    blinkClose: 160, blinkOpen: 220, blinkMin: 4500, blinkMax: 7000, initialDelay: 3500,
    openRyRatio: 0.68,
  },
  sad: {
    glanceDuration: 1900, glancePause: 900, glanceShift: 1.8,
    glanceEasing: Easing.inOut(Easing.ease),
    blinkClose: 120, blinkOpen: 170, blinkMin: 3200, blinkMax: 5500, initialDelay: 2500,
    openRyRatio: 0.85,
  },
  neutral: {
    glanceDuration: 900, glancePause: 350, glanceShift: 2,
    glanceEasing: Easing.inOut(Easing.quad),
    blinkClose: 60, blinkOpen: 90, blinkMin: 2000, blinkMax: 3800, initialDelay: 1500,
    openRyRatio: 1,
  },
  good: {
    glanceDuration: 600, glancePause: 180, glanceShift: 2.2,
    glanceEasing: Easing.out(Easing.quad),
    blinkClose: 45, blinkOpen: 65, blinkMin: 1400, blinkMax: 2800, initialDelay: 900,
    openRyRatio: 1,
  },
  great: {
    glanceDuration: 380, glancePause: 80, glanceShift: 2.5,
    glanceEasing: Easing.out(Easing.back(1.5)),
    blinkClose: 35, blinkOpen: 50, blinkMin: 900, blinkMax: 2000, initialDelay: 500,
    openRyRatio: 1,
  },
};

function useEyeAnims(rx: number, emotion: keyof typeof CFG) {
  const cfg = CFG[emotion];
  const blinkAnim  = useRef(new Animated.Value(1)).current;
  const glanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const glance = Animated.loop(
      Animated.sequence([
        Animated.timing(glanceAnim, {
          toValue: -1, duration: cfg.glanceDuration,
          easing: cfg.glanceEasing, useNativeDriver: false,
        }),
        Animated.delay(cfg.glancePause),
        Animated.timing(glanceAnim, {
          toValue: 1, duration: cfg.glanceDuration,
          easing: cfg.glanceEasing, useNativeDriver: false,
        }),
        Animated.delay(cfg.glancePause),
      ])
    );
    glance.start();

    let blinkTimer: ReturnType<typeof setTimeout>;
    const doBlink = () => {
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0, duration: cfg.blinkClose, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 1, duration: cfg.blinkOpen,  easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]).start(() => {
        blinkTimer = setTimeout(doBlink, cfg.blinkMin + Math.random() * (cfg.blinkMax - cfg.blinkMin));
      });
    };
    blinkTimer = setTimeout(doBlink, cfg.initialDelay + Math.random() * 800);

    return () => { glance.stop(); clearTimeout(blinkTimer); };
  }, []);

  const openRy = rx * cfg.openRyRatio;
  const S = cfg.glanceShift;
  return {
    leftCx:  (cx: number) => glanceAnim.interpolate({ inputRange: [-1, 1], outputRange: [cx - S, cx + S] }),
    rightCx: (cx: number) => glanceAnim.interpolate({ inputRange: [-1, 1], outputRange: [cx - S, cx + S] }),
    eyeRy:   blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, openRy] }),
    eyeRx:   rx,
  };
}

export function AwfulFace({ size = 60, color = '#111' }: FaceProps) {
  const { leftCx, rightCx, eyeRy, eyeRx } = useEyeAnims(3, 'awful');
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <AnimatedEllipse cx={leftCx(20)}  cy="23" rx={eyeRx} ry={eyeRy} fill={color} />
      <AnimatedEllipse cx={rightCx(40)} cy="23" rx={eyeRx} ry={eyeRy} fill={color} />
      <Rect x="21" y="35" width="18" height="9" rx="4" fill={color} />
    </Svg>
  );
}

export function SadFace({ size = 60, color = '#111' }: FaceProps) {
  const { leftCx, rightCx, eyeRy, eyeRx } = useEyeAnims(2.8, 'sad');
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <AnimatedEllipse cx={leftCx(20)}  cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <AnimatedEllipse cx={rightCx(40)} cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <Path d="M 18 42 Q 30 33 42 42" stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function NeutralFace({ size = 60, color = '#111' }: FaceProps) {
  const { leftCx, rightCx, eyeRy, eyeRx } = useEyeAnims(4.5, 'neutral');
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <AnimatedEllipse cx={leftCx(20)}  cy="21" rx={eyeRx} ry={eyeRy} fill={color} />
      <AnimatedEllipse cx={rightCx(40)} cy="21" rx={eyeRx} ry={eyeRy} fill={color} />
      <Rect x="17" y="36" width="26" height="5" rx="2.5" fill={color} />
    </Svg>
  );
}

export function GoodFace({ size = 60, color = '#111' }: FaceProps) {
  const { leftCx, rightCx, eyeRy, eyeRx } = useEyeAnims(2.8, 'good');
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <AnimatedEllipse cx={leftCx(20)}  cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <AnimatedEllipse cx={rightCx(40)} cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <Path d="M 18 36 Q 30 45 42 36" stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function GreatFace({ size = 60, color = '#111' }: FaceProps) {
  const { leftCx, rightCx, eyeRy, eyeRx } = useEyeAnims(2.8, 'great');
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <AnimatedEllipse cx={leftCx(20)}  cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <AnimatedEllipse cx={rightCx(40)} cy="22" rx={eyeRx} ry={eyeRy} fill={color} />
      <Path d="M 15 33 Q 30 50 45 33" stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}
