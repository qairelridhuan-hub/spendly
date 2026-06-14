import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface FaceProps { size?: number; color?: string; }

export function AwfulFace({ size = 60, color = '#111' }: FaceProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="20" cy="22" r="3" fill={color} />
      <Circle cx="40" cy="22" r="3" fill={color} />
      <Rect x="21" y="35" width="18" height="9" rx="4" fill={color} />
    </Svg>
  );
}

export function SadFace({ size = 60, color = '#111' }: FaceProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="20" cy="22" r="2.8" fill={color} />
      <Circle cx="40" cy="22" r="2.8" fill={color} />
      <Path
        d="M 18 42 Q 30 33 42 42"
        stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none"
      />
    </Svg>
  );
}

export function NeutralFace({ size = 60, color = '#111' }: FaceProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="20" cy="21" r="4.5" fill={color} />
      <Circle cx="40" cy="21" r="4.5" fill={color} />
      <Rect x="17" y="36" width="26" height="5" rx="2.5" fill={color} />
    </Svg>
  );
}

export function GoodFace({ size = 60, color = '#111' }: FaceProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="20" cy="22" r="2.8" fill={color} />
      <Circle cx="40" cy="22" r="2.8" fill={color} />
      <Path
        d="M 18 36 Q 30 45 42 36"
        stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none"
      />
    </Svg>
  );
}

export function GreatFace({ size = 60, color = '#111' }: FaceProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Circle cx="20" cy="22" r="2.8" fill={color} />
      <Circle cx="40" cy="22" r="2.8" fill={color} />
      <Path
        d="M 15 33 Q 30 50 45 33"
        stroke={color} strokeWidth="3.2" strokeLinecap="round" fill="none"
      />
    </Svg>
  );
}
