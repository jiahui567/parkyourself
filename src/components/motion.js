import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { burstPoints, countUpAt } from '../lib/motion';
import { CheckIcon } from './icons';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

// The app's shared motion (PLAN.md, M8): short and quiet. Reanimated jumps
// every animation to its end when the phone's Reduce motion setting is on.

export const ENTER_MS = 260;
// The first screenful of cards in a list fades up one after another. Cards
// further down are mounted as the list scrolls, and appear without animating,
// so a fast scroll never shows blank rows.
const STAGGER_MS = 40;
const FIRST_SCREENFUL = 8;
const PRESS_SPRING = { damping: 15, stiffness: 320 };
const COUNT_UP_MS = 600;

// For a list card's entering prop: fade up, later cards a moment later;
// undefined (no animation) past the first screenful.
export const enterUp = (index = 0) =>
  index < FIRST_SCREENFUL ? FadeInDown.duration(ENTER_MS).delay(index * STAGGER_MS) : undefined;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that sinks a little under the finger and springs back. style
// must be a style, not a function of the pressed state.
export function PressScale({ scaleTo = 0.94, style, onPressIn, onPressOut, ...props }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, PRESS_SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, PRESS_SPRING));
        onPressOut?.(e);
      }}
    />
  );
}

// A sen amount that counts up from 0 when it first shows or changes. format
// turns the number into text (formatRM).
export function CountUpText({ value, format, style, ...props }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduceMotion) return undefined;
    const start = Date.now();
    let frame;
    const tick = () => {
      const elapsed = Date.now() - start;
      setShown(countUpAt(value, elapsed, COUNT_UP_MS));
      if (elapsed < COUNT_UP_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduceMotion]);
  // Screen readers get the real amount, never a number on its way up.
  return (
    <Text style={style} accessibilityLabel={format(value)} {...props}>
      {format(reduceMotion ? value : shown)}
    </Text>
  );
}

const BURST_COUNT = 10;
const BURST_RADIUS = 96;
const BURST_MS = 750;

// A shared value for Burst, at rest (nothing shown).
export const useBurst = () => useSharedValue(1);

// Plays a Burst once.
export function playBurst(progress) {
  progress.set(0);
  progress.set(withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }));
}

// A small burst of emerald dots from the middle of its parent, shown while
// progress (from useBurst) runs from 0 to 1. It covers its parent and lets
// touches through.
export function Burst({ progress }) {
  const { colours } = useAppTheme();
  const tints = [colours.primary, colours.accent];
  return (
    <View pointerEvents="none" style={burstStyles.cover}>
      {burstPoints(BURST_COUNT, BURST_RADIUS).map((point, i) => (
        <Particle key={i} point={point} progress={progress} colour={tints[i % 2]} />
      ))}
    </View>
  );
}

function Particle({ point, progress, colour }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // Hidden at rest (progress 1), bright at the start, gone by the end.
      opacity: p >= 1 ? 0 : p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
      transform: [{ translateX: point.x * p }, { translateY: point.y * p }, { scale: 1 - 0.5 * p }],
    };
  });
  return <Animated.View style={[burstStyles.dot, { backgroundColor: colour }, style]} />;
}

const burstStyles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
});

const TICK_SHOWN_MS = 1200;
const TICK_FADE_MS = 300;

// A check mark and a word that pop in at the top of the screen, stay a moment
// and fade away, to say something was saved; screen readers hear the word.
// With Reduce motion on it appears and goes without moving, but still shows.
// Mount it with a new key to play it again.
export function SavedTick({ label }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createTickStyles);
  const fade = useSharedValue(1);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
    // Timers rather than withDelay: Reanimated drops delays under Reduce motion.
    const fadeOut = setTimeout(() => fade.set(withTiming(0, { duration: TICK_FADE_MS })), TICK_SHOWN_MS);
    const remove = setTimeout(() => setShown(false), TICK_SHOWN_MS + TICK_FADE_MS);
    return () => {
      clearTimeout(fadeOut);
      clearTimeout(remove);
    };
  }, [fade, label]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, fadeStyle]}
    >
      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.pill}>
        <View style={styles.tick}>
          <CheckIcon size={16} color={colours.onPrimary} />
        </View>
        <Text style={styles.text}>{label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const createTickStyles = (c) =>
  StyleSheet.create({
    wrap: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 1 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 16,
      borderRadius: radius.pill,
      backgroundColor: c.card,
      boxShadow: c.shadow,
    },
    tick: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { color: c.text, fontWeight: '600' },
  });
