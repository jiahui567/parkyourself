import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CarLogo } from './CarLogo';
import { radius } from './theme';
import { useAppTheme, useThemedStyles } from './ThemeProvider';

const CAR_WIDTH = 200;
const SIGN_SIZE = 64;
// The car comes in from the left, rolls a little past the bay and backs into it.
const DRIVE_IN_MS = 520;
const OVERSHOOT = 28;
const SIGN_ON_AT_MS = 640;
const FADE_OUT_AT_MS = 1050;
const FADE_OUT_MS = 250;
const SKIP_FADE_MS = 150;

// Played once per cold start: a later mount (a theme change, a fast refresh of
// another file) must not replay it.
let playedThisLaunch = false;

// The loading animation (PLAN.md, M8): after Android's own still launch
// screen, a little car drives into a bay under a parking sign that lights up
// emerald, then everything fades into Home. About one second; a tap skips it;
// not shown at all when the phone's Reduce motion setting is on. It covers
// the app, which loads underneath.
export function ParkingIntro() {
  const reduceMotion = useReducedMotion();
  const [showing, setShowing] = useState(() => !playedThisLaunch && !reduceMotion);
  useEffect(() => {
    playedThisLaunch = true;
  }, []);
  // Stable, so the scene's timers are not restarted when it re-renders.
  const hide = useCallback(() => setShowing(false), []);
  if (!showing) return null;
  return <IntroScene onDone={hide} />;
}

function IntroScene({ onDone }) {
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const drive = useSharedValue(-400);
  const signOn = useSharedValue(0);
  const cover = useSharedValue(1);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    drive.set(
      withSequence(
        withTiming(OVERSHOOT, { duration: DRIVE_IN_MS, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 12, stiffness: 180 })
      )
    );
    signOn.set(withDelay(SIGN_ON_AT_MS, withTiming(1, { duration: 180 })));
    cover.set(withDelay(FADE_OUT_AT_MS, withTiming(0, { duration: FADE_OUT_MS })));
    // The car's glow turns emerald with the sign; done hands the screen to Home.
    const lights = setTimeout(() => setLit(true), SIGN_ON_AT_MS);
    const done = setTimeout(onDone, FADE_OUT_AT_MS + FADE_OUT_MS);
    return () => {
      clearTimeout(lights);
      clearTimeout(done);
    };
  }, [drive, signOn, cover, onDone]);

  const skipTimer = useRef(null);
  useEffect(() => () => clearTimeout(skipTimer.current), []);
  const skip = () => {
    cover.set(withTiming(0, { duration: SKIP_FADE_MS }));
    skipTimer.current = setTimeout(onDone, SKIP_FADE_MS);
  };

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  const carStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drive.get() }] }));
  const signStyle = useAnimatedStyle(() => {
    const on = signOn.get();
    return {
      backgroundColor: interpolateColor(on, [0, 1], [colours.surface, colours.primary]),
      // A small pop as it lights: up to 1.12 halfway, back to 1.
      transform: [{ scale: 1 + 0.24 * on * (1 - on) * 2 }],
    };
  });
  const letterStyle = useAnimatedStyle(() => ({
    color: interpolateColor(signOn.get(), [0, 1], [colours.muted, colours.onPrimary]),
  }));

  return (
    // Hidden from screen readers, which go straight to Home underneath; a tap still skips.
    <Animated.View
      style={[styles.cover, coverStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Pressable style={styles.fill} onPress={skip}>
        <View style={styles.scene}>
          <Animated.View style={[styles.sign, signStyle]}>
            <Animated.Text style={[styles.letter, letterStyle]}>P</Animated.Text>
          </Animated.View>
          <View style={styles.post} />
          <View style={styles.bay}>
            <View style={styles.bayLine} />
            <Animated.View style={carStyle}>
              <CarLogo width={CAR_WIDTH} active={lit} />
            </Animated.View>
            <View style={styles.bayLine} />
          </View>
          <View style={styles.ground} />
          <Text style={styles.name}>Park Yourself</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    cover: { ...StyleSheet.absoluteFillObject, backgroundColor: c.background, zIndex: 10 },
    fill: { flex: 1 },
    scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sign: {
      width: SIGN_SIZE,
      height: SIGN_SIZE,
      borderRadius: radius.control + 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letter: { fontSize: 38, fontWeight: '800', lineHeight: 44 },
    post: { width: 4, height: 28, backgroundColor: c.border },
    // The bay: a painted line each side of the car, sitting on the ground line.
    bay: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    bayLine: { width: 4, height: 56, borderRadius: 2, backgroundColor: c.border },
    ground: { width: CAR_WIDTH + 64, height: 2, borderRadius: 1, backgroundColor: c.border },
    name: { marginTop: 24, fontSize: 13, fontWeight: '700', letterSpacing: 2.4, color: c.muted, textTransform: 'uppercase' },
  });
