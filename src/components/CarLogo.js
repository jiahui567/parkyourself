import { useEffect, useId } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useAppTheme } from './ThemeProvider';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
// One slow breath in, one out.
const BREATH_MS = 1600;

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 128;

const BODY =
  'M24 94 L22 76 Q22 64 36 61 L66 57 C88 43 120 31 152 29 L194 29 C214 30 232 43 248 55 L284 61 ' +
  'Q302 65 304 80 L304 89 Q304 94 299 94 L270 94 A28 28 0 0 0 214 94 L110 94 A28 28 0 0 0 54 94 Z';

// The car drawn on Home, seen from the side. active (parked) turns the glow
// under it emerald; otherwise the glow is neutral grey. breathe lets an active
// glow fade slowly in and out; turn it off while the drawing is not on screen.
export function CarLogo({ width, active = false, breathe = false }) {
  const { colours } = useAppTheme();
  const car = colours.car;
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (active && breathe && !reduceMotion) {
      breath.set(withRepeat(withTiming(0.5, { duration: BREATH_MS, easing: Easing.inOut(Easing.ease) }), -1, true));
    } else {
      breath.set(withTiming(1, { duration: 200 }));
    }
    return () => cancelAnimation(breath);
  }, [active, breathe, reduceMotion, breath]);
  const glowProps = useAnimatedProps(() => ({ opacity: breath.get() }));
  // Gradient ids must be unique on the page and safe inside url(#...). React's
  // id format has changed between versions (':r0:', '«r0»', '_r_0_'), so keep
  // only characters that are always safe.
  const id = useId().replace(/[^\w-]/g, '');
  const glow = active ? colours.primary : colours.muted;

  return (
    <Svg
      width={width}
      height={(width * VIEW_HEIGHT) / VIEW_WIDTH}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      accessible={false}
    >
      <Defs>
        <LinearGradient id={`body${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={car.bodyTop} />
          <Stop offset="1" stopColor={car.bodyBottom} />
        </LinearGradient>
        <RadialGradient id={`glow${id}`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={glow} stopOpacity={active ? 0.55 : 0.3} />
          <Stop offset="1" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <AnimatedEllipse cx="162" cy="110" rx="150" ry="14" fill={`url(#glow${id})`} animatedProps={glowProps} />
      <Ellipse cx="162" cy="106" rx="128" ry="5" fill={car.shadow} opacity={0.35} />

      <Path d={BODY} fill={`url(#body${id})`} stroke={car.edge} strokeWidth={1} />
      <Path d="M80 56 C98 45 124 36 152 35 L157 35 L157 56 Z" fill={car.glass} />
      <Path d="M164 35 L193 35 C209 36 224 45 236 56 L164 56 Z" fill={car.glass} />
      <Path d="M30 70 L300 74" stroke={car.edge} strokeWidth={1} opacity={0.7} />
      <Path d="M286 66 L300 70" stroke={colours.primary} strokeWidth={3} strokeLinecap="round" />
      <Path d="M24 66 L32 65" stroke={car.tailLight} strokeWidth={3} strokeLinecap="round" opacity={0.85} />

      {[82, 242].map((cx) => (
        <Wheel key={cx} cx={cx} car={car} />
      ))}
    </Svg>
  );
}

function Wheel({ cx, car }) {
  return (
    <>
      <Circle cx={cx} cy="94" r="21" fill={car.tyre} />
      <Circle cx={cx} cy="94" r="13" fill={car.rim} />
      <Circle cx={cx} cy="94" r="4" fill={car.hub} />
    </>
  );
}
