import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarLogo } from '../../components/CarLogo';
import { ErrorText } from '../../components/ErrorText';
import { FindIcon } from '../../components/icons';
import { radius, space } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { sessions, useDatabase, vehicles } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useNow } from '../../hooks/useNow';
import { formatDuration } from '../../lib/time';
import { levelBayText, routeBackText, zoneSinceText } from '../../text/sessionText';
import { swatchFor } from '../../zone/zoneColour';

const PARK_BUTTON_SIZE = 96;

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
  const load = useCallback(async () => {
    const [cars, active] = await Promise.all([vehicles.list(db), sessions.listActive(db)]);
    return { cars, active };
  }, [db]);
  const { data, error } = useFocusedLoad(load);
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
          <CarLogo width={Math.min(340, width - 48)} active={Boolean(session)} />
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
          {session ? (
            <View style={[styles.status, styles.statusParked]}>
              <View style={styles.parkedDot} />
              <Text style={styles.statusParkedText}>
                Parked · {formatDuration(Math.max(0, now - session.started_at))}
              </Text>
            </View>
          ) : (
            <View style={styles.status}>
              <Text style={styles.statusText}>Not parked</Text>
            </View>
          )}
        </View>

        {session ? (
          <SpotCard session={session} styles={styles} />
        ) : (
          <Text style={styles.hint}>Tap Park when you leave the car. We&apos;ll keep the way back for you.</Text>
        )}
      </View>

      <View style={styles.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session ? `Find ${car.name}` : `Park ${car.name}`}
          onPress={() =>
            session
              ? router.push(`/session/${session.id}`)
              : router.push({ pathname: '/park', params: { vehicleId: car.id } })
          }
          style={({ pressed }) => [styles.parkRing, pressed && styles.pressed]}
        >
          <View style={styles.parkButton}>
            {session ? (
              <FindIcon size={30} color={colours.onPrimary} />
            ) : (
              <Text style={styles.parkLetter}>P</Text>
            )}
            <Text style={styles.parkLabel}>{session ? 'Find' : 'Park'}</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// Where the car is: level and bay on the zone colour, then the way back.
function SpotCard({ session, styles }) {
  const swatch = swatchFor(session.zone_colour_name);
  const route = routeBackText(session);
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
    hero: { alignItems: 'center', gap: 12, paddingTop: 12 },
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
