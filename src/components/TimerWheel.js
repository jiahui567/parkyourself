import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { nearestIndex, wheelIndexAt } from '../lib/wheel';
import { MAX_TIMER_HOURS, splitMinutes, TIMER_STEP_MINUTES } from '../timer/timer';
import { radius } from './theme';
import { useThemedStyles } from './ThemeProvider';

const ROW = 44;
// Rows shown: the chosen one in the middle and two each side.
const VISIBLE = 5;
const HOURS = Array.from({ length: MAX_TIMER_HOURS + 1 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 / TIMER_STEP_MINUTES }, (_, i) => i * TIMER_STEP_MINUTES);

// A timer length picked like an alarm (PLAN.md, M10): an hours wheel and a
// minutes wheel that snap to a row. value and onChange are whole minutes;
// 0 h 00 m is 0. onChange runs once a wheel settles, not while it spins.
export function TimerWheel({ value, onChange }) {
  const styles = useThemedStyles(createStyles);
  const { hours, minutes } = splitMinutes(value);
  return (
    <View style={styles.wheels}>
      {/* The band behind the middle row marks the chosen value. */}
      <View pointerEvents="none" style={styles.band} />
      <Column
        values={HOURS}
        value={hours}
        unit="h"
        label="Hours"
        spoken={['hour', 'hours']}
        onChange={(next) => onChange(next * 60 + minutes)}
        styles={styles}
      />
      <Column
        values={MINUTES}
        value={minutes}
        unit="min"
        label="Minutes"
        spoken={['minute', 'minutes']}
        onChange={(next) => onChange(hours * 60 + next)}
        styles={styles}
      />
    </View>
  );
}

// A column of numbers, with its unit said once beside the middle row.
function Column({ values, value, unit, label, spoken, onChange, styles }) {
  const scroller = useAnimatedRef();
  const offset = useSharedValue(nearestIndex(values, value) * ROW);
  const shown = useRef(value);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.set(event.contentOffset.y);
  });

  // A value set from outside (a saved setting loading) turns the wheel to it.
  useEffect(() => {
    if (value === shown.current) return;
    shown.current = value;
    scroller.current?.scrollTo({ y: nearestIndex(values, value) * ROW, animated: true });
  }, [value, values, scroller]);

  const settle = (event) => {
    const next = values[wheelIndexAt(event.nativeEvent.contentOffset.y, ROW, values.length)];
    if (next === shown.current) return;
    shown.current = next;
    onChange(next);
  };

  // Screen readers adjust the wheel a row at a time instead of scrolling it.
  const step = (direction) => {
    const index = nearestIndex(values, value) + direction;
    if (index < 0 || index >= values.length) return;
    shown.current = values[index];
    scroller.current?.scrollTo({ y: index * ROW, animated: true });
    onChange(values[index]);
  };

  return (
    <View
      style={styles.column}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${spoken[value === 1 ? 0 : 1]}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Animated.ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        // Settings scrolls too; this lets the wheel take the drag on Android.
        nestedScrollEnabled
        contentOffset={{ x: 0, y: nearestIndex(values, value) * ROW }}
        contentContainerStyle={styles.columnContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        // Android snaps, and so ends with momentum, even after a slow release;
        // settling on the drag's end too would change the value twice. iOS
        // sends no momentum after a slow release, so there the drag's end counts.
        onScrollEndDrag={
          Platform.OS === 'android'
            ? undefined
            : (event) => {
                if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) settle(event);
              }
        }
        importantForAccessibility="no-hide-descendants"
      >
        {values.map((v, i) => (
          <Row key={v} index={i} offset={offset} text={String(v).padStart(2, '0')} styles={styles} />
        ))}
      </Animated.ScrollView>
      <View pointerEvents="none" style={styles.unit}>
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

// Rows fade and shrink away from the middle, like a drum turning.
function Row({ index, offset, text, styles }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.get() / ROW - index);
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.45, 0.2], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 2], [1, 0.82], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={styles.rowText}>{text}</Text>
    </Animated.View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    wheels: { flexDirection: 'row', justifyContent: 'center', gap: 24, height: ROW * VISIBLE },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: ROW * Math.floor(VISIBLE / 2),
      height: ROW,
      borderRadius: radius.control,
      backgroundColor: c.surface,
    },
    column: { width: 96 },
    columnContent: { paddingVertical: ROW * Math.floor(VISIBLE / 2) },
    // The numbers sit left of centre, leaving room for the unit on the band.
    row: { height: ROW, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 20 },
    rowText: { fontSize: 22, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] },
    unit: {
      position: 'absolute',
      top: ROW * Math.floor(VISIBLE / 2),
      height: ROW,
      left: 56,
      justifyContent: 'center',
    },
    unitText: { fontSize: 15, fontWeight: '600', color: c.muted },
  });
