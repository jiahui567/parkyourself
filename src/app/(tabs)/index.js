import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarLogo } from '../../components/CarLogo';
import { ErrorText } from '../../components/ErrorText';
import { FindIcon } from '../../components/icons';
import { Burst, ENTER_MS, playBurst, PressScale, useBurst } from '../../components/motion';
import { radius, space } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { holidays, sessions, useDatabase, vehicles } from '../../db';
import { feeSoFar } from '../../fees';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useNow } from '../../hooks/useNow';
import { useOnAppActive } from '../../hooks/useOnAppActive';
import { homeCarMove } from '../../lib/motion';
import { formatDuration } from '../../lib/time';
import { syncNotifications } from '../../notify/notifications';
import { feeSoFarText } from '../../text/findText';
import { levelBayText, routeBackText, zoneSinceText } from '../../text/sessionText';
import { timerStatusText } from '../../text/timerText';
import { swatchFor } from '../../zone/zoneColour';

const PARK_BUTTON_SIZE = 96;
const DRIVE_SPRING = { damping: 14, stiffness: 110 };
const DRIVE_OFF_MS = 420;

// Home: one car at a time, drawn large, with where it is parked and a round
// Park (or Find) button at the bottom. With several cars, chips at the top
// switch between them; a dot marks the ones that are parked.
export default function Home() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const { colours } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState(null);
  // Set by Found my car, so the car drives off with a small celebration.
  const { foundAt, foundCarId } = useLocalSearchParams();
  const load = useCallback(async () => {
    const [cars, active, holidayDates] = await Promise.all([
      vehicles.list(db),
      sessions.listActive(db),
      holidays.dateSet(db),
    ]);
    return { cars, active, holidayDates };
  }, [db]);
  const { data, error } = useFocusedLoad(load);
  // Coming back to Home follows every change to a parked car (Found my car,
  // Delete), so the notifications are brought up to date here too, and when
  // the app comes back to the front (after allowing them in Android settings).
  const syncLoad = useCallback(() => syncNotifications(db), [db]);
  const { error: notifyError, reload: resyncNotifications } = useFocusedLoad(syncLoad);
  useOnAppActive(resyncNotifications);
  const now = useNow();

  if (error) {
    // Home has no header, so keep the message clear of the status bar.
    return (
      <View style={[styles.errorWrap, { paddingTop: insets.top + space }]}>
        <ErrorText error={error} />
      </View>
    );
  }
  if (!data) return null;
  if (data.cars.length === 0) return <Redirect href="/vehicles/new" />;

  // Cars are listed default first, so the default car shows until you pick another.
  const car = data.cars.find((c) => c.id === selectedId) ?? data.cars[0];
  const sessionFor = (carId) => data.active.find((s) => s.vehicle_id === carId);
  const session = sessionFor(car.id);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + space }]}>
      <View style={styles.top}>
        {data.cars.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carChips}>
            {data.cars.map((c) => {
              const selected = c.id === car.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedId(c.id)}
                  style={[styles.carChip, selected && styles.carChipSelected]}
                >
                  {sessionFor(c.id) && <View style={styles.parkedDot} />}
                  <Text style={selected ? styles.carChipTextSelected : styles.carChipText}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.hero}>
          <HeroCar
            look={{ carId: car.id, parked: Boolean(session), foundAt, foundCarId }}
            width={Math.min(340, width - 48)}
            screenWidth={width}
          />
          <View style={styles.nameBlock}>
            <View style={styles.overlineRow}>
              <View style={styles.hairline} />
              <Text style={styles.overline}>{car.is_default ? 'Default car' : 'Your car'}</Text>
              <View style={styles.hairline} />
            </View>
            <Text style={styles.carName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {car.name}
            </Text>
          </View>
          {/* Keyed by car and state, so the pill and the card fade in again when either changes. */}
          {session ? (
            <Animated.View
              key={`parked-${car.id}`}
              entering={FadeIn.duration(ENTER_MS)}
              style={[styles.status, styles.statusParked]}
            >
              <View style={styles.parkedDot} />
              <Text style={styles.statusParkedText}>
                Parked · {formatDuration(Math.max(0, now - session.started_at))}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View key={`free-${car.id}`} entering={FadeIn.duration(ENTER_MS)} style={styles.status}>
              <Text style={styles.statusText}>Not parked</Text>
            </Animated.View>
          )}
        </View>

        {session ? (
          <Animated.View key={`spot-${session.id}`} entering={FadeInDown.duration(ENTER_MS).delay(80)}>
            <SpotCard session={session} now={now} holidayDates={data.holidayDates} styles={styles} />
          </Animated.View>
        ) : (
          <Animated.Text key={`hint-${car.id}`} entering={FadeIn.duration(ENTER_MS)} style={styles.hint}>
            Tap Park when you leave the car. We&apos;ll keep the way back for you.
          </Animated.Text>
        )}
        <ErrorText error={notifyError} />
      </View>

      <View style={styles.bottom}>
        <PressScale
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={session ? `Find ${car.name}` : `Park ${car.name}`}
          onPress={() =>
            session
              ? router.push(`/session/${session.id}`)
              : router.push({ pathname: '/park', params: { vehicleId: car.id } })
          }
          style={styles.parkRing}
        >
          <View style={styles.parkButton}>
            {session ? (
              <FindIcon size={30} color={colours.onPrimary} />
            ) : (
              <Text style={styles.parkLetter}>P</Text>
            )}
            <Text style={styles.parkLabel}>{session ? 'Find' : 'Park'}</Text>
          </View>
        </PressScale>
      </View>
    </ScrollView>
  );
}

// The car drawing. When this car is parked it drives in from the left; after
// Found my car it drives off to the right, a small burst marks it, and it
// rolls back in, ready for next time. homeCarMove (tested) decides; each move
// plays once. The glow breathes only while Home is on screen.
function HeroCar({ look, width, screenWidth }) {
  const reduceMotion = useReducedMotion();
  const drive = useSharedValue(0);
  const burst = useBurst();
  const lastLook = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnScreen(true);
      return () => setOnScreen(false);
    }, [])
  );

  const { carId, parked, foundAt, foundCarId } = look;
  useEffect(() => {
    const now = { carId, parked, foundAt, foundCarId };
    const move = homeCarMove(lastLook.current, now);
    lastLook.current = now;
    if (!move || reduceMotion) return;
    if (move === 'in') {
      drive.set(-screenWidth);
      drive.set(withSpring(0, DRIVE_SPRING));
      return;
    }
    drive.set(
      withSequence(
        withTiming(screenWidth, { duration: DRIVE_OFF_MS, easing: Easing.in(Easing.quad) }),
        withTiming(-screenWidth, { duration: 0 }),
        withDelay(250, withSpring(0, DRIVE_SPRING))
      )
    );
    playBurst(burst);
  }, [carId, parked, foundAt, foundCarId, reduceMotion, screenWidth, drive, burst]);
  const driveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drive.get() }] }));

  return (
    <View>
      <Animated.View style={driveStyle}>
        <CarLogo width={width} active={parked} breathe={parked && onScreen} />
      </Animated.View>
      <Burst progress={burst} />
    </View>
  );
}

// Where the car is: level and bay on the zone colour, the way back, then the
// fee so far and the timer in muted text.
function SpotCard({ session, now, holidayDates, styles }) {
  const swatch = swatchFor(session.zone_colour_name);
  const route = routeBackText(session);
  const fee = feeSoFarText(feeSoFar(session, now, holidayDates));
  const timer = timerStatusText(session.timer_ends_at, now);
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/session/${session.id}`)}
    >
      <View style={styles.spotRow}>
        {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
        <Text style={styles.spot}>{levelBayText(session) ?? 'No level or bay recorded'}</Text>
      </View>
      <Text style={styles.muted}>{zoneSinceText(session)}</Text>
      {route && (
        <Text style={styles.route} numberOfLines={2}>
          {route}
        </Text>
      )}
      {(fee || timer) && (
        <View style={styles.cardFooter}>
          {fee && <Text style={styles.footerText}>{fee}</Text>}
          {timer && <Text style={styles.footerText}>{timer}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 24 },
    top: { gap: 20 },
    carChips: { gap: 8, paddingHorizontal: 2, flexGrow: 1, justifyContent: 'center' },
    carChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
    },
    carChipSelected: { backgroundColor: c.accentSoft },
    carChipText: { color: c.muted, fontWeight: '600' },
    carChipTextSelected: { color: c.accent, fontWeight: '600' },
    errorWrap: { paddingHorizontal: 16 },
    hero: { alignItems: 'center', gap: space, paddingTop: 12 },
    nameBlock: { alignItems: 'center', gap: 2, alignSelf: 'stretch', paddingHorizontal: 16 },
    overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    hairline: { width: 32, height: StyleSheet.hairlineWidth * 2, backgroundColor: c.border },
    overline: { color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase' },
    carName: { fontSize: 32, fontWeight: '800', color: c.text, letterSpacing: -0.6 },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
    },
    statusText: { color: c.muted, fontWeight: '600' },
    statusParked: { backgroundColor: c.accentSoft },
    statusParkedText: { color: c.accent, fontWeight: '600' },
    parkedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    hint: { color: c.muted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 6, boxShadow: c.shadow },
    spotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: c.border },
    spot: { fontSize: 24, fontWeight: '700', color: c.text },
    muted: { color: c.muted },
    route: { color: c.text, lineHeight: 20 },
    // A hairline keeps the fee and timer apart from where the car is.
    cardFooter: {
      gap: 2,
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    footerText: { color: c.muted, fontSize: 13, lineHeight: 18 },
    bottom: { alignItems: 'center', paddingTop: 32 },
    // A faint ring around the button, like a glow.
    parkRing: {
      padding: 10,
      borderRadius: radius.pill,
      backgroundColor: c.accentSoft,
    },
    parkButton: {
      width: PARK_BUTTON_SIZE,
      height: PARK_BUTTON_SIZE,
      borderRadius: PARK_BUTTON_SIZE / 2,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: c.primaryGlow,
    },
    parkLetter: { fontSize: 38, fontWeight: '800', color: c.onPrimary, lineHeight: 42 },
    parkLabel: { fontSize: 13, fontWeight: '700', color: c.onPrimary, letterSpacing: 0.5 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  });
