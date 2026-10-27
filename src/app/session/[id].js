import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { CameraCapture } from '../../components/CameraCapture';
import { useDialog } from '../../components/Dialog';
import { ErrorText } from '../../components/ErrorText';
import { EstimatePill } from '../../components/EstimatePill';
import { IconButton } from '../../components/IconButton';
import { CameraIcon, MapPinIcon, PlusIcon, ShareIcon, TimerIcon, TrashIcon, XIcon } from '../../components/icons';
import { ENTER_MS, SavedTick } from '../../components/motion';
import { PhotoStrip } from '../../components/PhotoStrip';
import { PhotoViewer } from '../../components/PhotoViewer';
import { radius, space } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { TimerSheet } from '../../components/TimerSheet';
import { WayBackCard } from '../../components/WayBackCard';
import {
  deletePhotoFiles,
  holidays,
  photos,
  preferences,
  preparePhoto,
  savingPhotos,
  sessions,
  sharePhoto,
  syncState,
  useDatabase,
} from '../../db';
import { feeSoFar } from '../../fees';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useNow } from '../../hooks/useNow';
import { useOnAppActive } from '../../hooks/useOnAppActive';
import { indexAfterRemoval } from '../../lib/listIndex';
import { formatRM } from '../../lib/money';
import { formatDate, formatDuration, formatTime } from '../../lib/time';
import { syncNotifications } from '../../notify/notifications';
import { endedFeeText, extendTimerText, stayTimesText } from '../../text/findText';
import { addPhotoLabel } from '../../text/photoText';
import { missingRateText } from '../../text/rateText';
import { routeBackText, shareMessage, spotLocation, walkingDirectionsUrl } from '../../text/sessionText';
import { isParkedElsewhere, parkedElsewhereText } from '../../text/syncText';
import { timerStatusText } from '../../text/timerText';
import { timerEndFrom, wheelStartMinutes } from '../../timer/timer';
import { swatchFor, textColourOn } from '../../zone/zoneColour';

const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));
// Only Set timer's handler reads the clock; the React Compiler lint cannot tell
// it from render code, so the read lives out here.
const clockNow = () => Date.now();

// Find: where the car is and the way back. A parked car shows its fee so far
// and timer, and "Found my car" opens the summary that ends it; an ended
// session (opened from History) shows what it cost and can be deleted.
export default function SessionScreen() {
  const db = useDatabase();
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const showDialog = useDialog();
  // extendedAt: set when Extend timer on a notification opened this screen.
  // savedAt: set when Park has just saved this session.
  const { id, extendedAt, savedAt } = useLocalSearchParams();
  const load = useCallback(async () => {
    const [session, holidayDates, prefs, sessionPhotos, refusal] = await Promise.all([
      sessions.getDetails(db, id),
      holidays.dateSet(db),
      preferences.get(db),
      photos.listForSession(db, id),
      syncState.refusedSession(db, id),
    ]);
    return { session, holidayDates, prefs, sessionPhotos, refusal };
  }, [db, id]);
  const { data, error, loading, reload } = useFocusedLoad(load);
  // Find opens after Park and from a notification, and Extend changes the
  // timer, so the notifications are brought up to date here, also when the
  // app comes back to the front. Right after parking is when the permission
  // is first asked for.
  const syncLoad = useCallback(() => syncNotifications(db, { askPermission: true }), [db]);
  // After a pull, Home brings them up to date (it stays mounted under Find).
  const { error: notifyError, reload: resyncNotifications } = useFocusedLoad(syncLoad, { reloadOnPull: false });
  useOnAppActive(resyncNotifications);
  // When this Find was already open, Extend timer on a notification only
  // changes extendedAt, so the new end is loaded and synced here.
  useEffect(() => {
    if (extendedAt) {
      reload();
      resyncNotifications();
    }
  }, [extendedAt, reload, resyncNotifications]);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [wayBackError, setWayBackError] = useState(null);
  const [timerSheetOpen, setTimerSheetOpen] = useState(false);

  if (error) return <ErrorText error={error} />;
  if (loading) return null;
  const { session, holidayDates, prefs, sessionPhotos, refusal } = data;
  if (!session) return <ErrorText error={new Error('This parking session no longer exists.')} />;

  const active = session.status === 'active';
  const swatch = swatchFor(session.zone_colour_name);
  const spotColours = swatch ? { backgroundColor: swatch } : { backgroundColor: colours.card };
  const spotTextStyle = { color: swatch ? textColourOn(swatch) : colours.text };
  const route = routeBackText(session);
  const durationMs = Math.max(0, (active ? now : session.ended_at) - session.started_at);
  const fee = active ? feeSoFar(session, now, holidayDates) : null;
  const missingRate = missingRateText(fee);
  const timerText = active ? timerStatusText(session.timer_ends_at, now) : null;
  const paid = active ? null : endedFeeText(session);
  const photoUris = sessionPhotos.map((photo) => photo.file_uri);
  const location = active ? spotLocation(session) : null;

  // A failure shows in a dialog: Delete is in the header, often far above the
  // error line at the end of the screen.
  const remove = async () => {
    setBusy(true);
    try {
      await sessions.remove(db, session.id);
      goHome();
    } catch (e) {
      setBusy(false);
      showDialog({ title: 'Could not delete this parking session', message: String(e?.message ?? e) });
    }
  };

  // Extend counts from the real clock, not the screen's, which ticks every 30 s.
  // The button stays disabled until the new end time is on screen, so a quick
  // second tap extends from it instead of saving the same time again.
  const extend = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await sessions.extend(db, session.id);
      await reload();
      await resyncNotifications();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  // The wheel's length counts from now, like setting an alarm. A failure stays
  // in the sheet, which shows it.
  const setTimerTo = async (minutes) => {
    await sessions.setTimer(db, session.id, timerEndFrom(clockNow(), minutes));
    setTimerSheetOpen(false);
    await reload();
    try {
      await resyncNotifications();
    } catch (e) {
      setActionError(e);
    }
  };

  // Drops the timer for this park (Timer when parking starts one on every
  // park). Extend can only start a new one from now, so it asks first.
  const confirmStopTimer = () =>
    showDialog({
      title: 'Stop the timer?',
      message: 'Its reminders are cancelled.',
      buttons: [
        { text: 'Stop timer', style: 'destructive', onPress: stopTimer },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  const stopTimer = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await sessions.setTimer(db, session.id, null);
      await reload();
      await resyncNotifications();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  // The way back is added here while parked, as the user walks out; each
  // part is saved as it is given.
  const saveWayBack = async (changes) => {
    setWayBackError(null);
    try {
      await sessions.setWayBack(db, session.id, changes);
      await reload();
    } catch (e) {
      setWayBackError(e);
    }
  };

  // An extra photo, taken while parked, is kept at once. If keeping it fails
  // there is nothing to try again with, so the prepared file goes too.
  const addPhoto = async (picture) => {
    setCameraOpen(false);
    setBusy(true);
    setPhotoError(null);
    let prepared = null;
    try {
      prepared = await preparePhoto(picture);
      await savingPhotos([prepared], ([file_uri]) => photos.add(db, { session_id: session.id, file_uri }));
      await reload();
    } catch (e) {
      if (prepared) deletePhotoFiles([prepared]);
      setPhotoError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletePhoto = (index) =>
    showDialog({
      title: 'Delete this photo?',
      message: 'It is deleted from the phone.',
      buttons: [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setPhotoError(null);
            try {
              await photos.remove(db, sessionPhotos[index].id);
              setViewing(indexAfterRemoval(index, sessionPhotos.length));
              await reload();
            } catch (e) {
              setViewing(null);
              setPhotoError(e);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  // Sharing happens only when the user taps Share (PLAN.md, "Share your spot"):
  // the parking info as a message, or one photo from the viewer.
  const shareSpot = async () => {
    setActionError(null);
    try {
      const message = shareMessage({ vehicleName: session.vehicle_name, placeName: session.place_name, session });
      await Share.share({ message });
    } catch (e) {
      setActionError(e);
    }
  };

  // Walking directions in Google Maps, to where the car was saved or else to
  // its place. Opened only when the user taps it (AGENTS.md, "Privacy").
  const openMaps = async () => {
    setActionError(null);
    try {
      await Linking.openURL(walkingDirectionsUrl(location));
    } catch (e) {
      setActionError(e);
    }
  };

  // A dialog, because the viewer covers the screen's own error line.
  const sharePhotoAt = async (index) => {
    try {
      await sharePhoto(photoUris[index]);
    } catch (e) {
      showDialog({ title: 'Could not share the photo', message: String(e?.message ?? e) });
    }
  };

  const confirmDelete = () =>
    showDialog({
      title: 'Delete this parking session?',
      message: 'Its photos are deleted too.',
      buttons: [
        { text: 'Delete', style: 'destructive', onPress: remove },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  return (
    <View style={styles.screen}>
      {/* A finished session can be deleted, from the header's corner (a parked
          one ends with Found my car instead). */}
      <Stack.Screen
        options={{
          title: session.vehicle_name,
          headerRight: active
            ? undefined
            : () => (
                <IconButton
                  icon={TrashIcon}
                  label="Delete this parking session"
                  tone="danger"
                  onPress={confirmDelete}
                  disabled={busy}
                />
              ),
        }}
      />
      {savedAt && active && <SavedTick key={savedAt} label="Parked" />}
      {/* handled: with the keyboard up for the shop, a tap on a chip or button
          still works instead of only closing the keyboard. */}
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <Animated.View entering={FadeInDown.duration(ENTER_MS)} style={[styles.spot, spotColours]}>
          {session.level || session.bay ? (
            <>
              {/* "Level" is what people look for on the signs; the bay is the
                  code on the pillar, so it needs no word. */}
              {session.level && (
                <Text style={[styles.level, spotTextStyle]} numberOfLines={1} adjustsFontSizeToFit>
                  Level {session.level}
                </Text>
              )}
              {session.bay && (
                <Text style={[styles.bay, spotTextStyle]} accessibilityLabel={`Bay ${session.bay}`}>
                  {session.bay}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.bay, spotTextStyle]}>No level or bay recorded</Text>
          )}
          {session.zone_colour_name && <Text style={spotTextStyle}>{session.zone_colour_name} zone</Text>}
        </Animated.View>

        {/* The server keeps one active session per car, so this one waits
            until one of the two ends (PLAN.md, "How the sync works", step 8). */}
        {active && isParkedElsewhere(refusal) && (
          <View style={styles.elsewhere}>
            <Text style={styles.elsewhereText}>{parkedElsewhereText(refusal, now)}</Text>
          </View>
        )}

        {active ? (
          <WayBackCard session={session} route={route} onSave={saveWayBack} error={wayBackError} />
        ) : (
          route && (
            <View style={styles.card}>
              <Text style={styles.label}>Way back</Text>
              <Text style={styles.route}>{route}</Text>
            </View>
          )
        )}

        {(photoUris.length > 0 || active) && (
          <View style={styles.card}>
            <Text style={styles.label}>Photos</Text>
            <PhotoStrip uris={photoUris} onOpen={setViewing} />
            <ErrorText error={photoError} />
            {active && (
              <View style={styles.sideActions}>
                <Button
                  title={addPhotoLabel(photoUris.length)}
                  variant="tonal"
                  size="small"
                  icon={CameraIcon}
                  onPress={() => setCameraOpen(true)}
                  disabled={busy}
                />
              </View>
            )}
          </View>
        )}
        <CameraCapture visible={cameraOpen} onCapture={addPhoto} onClose={() => setCameraOpen(false)} />
        <TimerSheet
          visible={timerSheetOpen}
          initialMinutes={wheelStartMinutes(session.timer_ends_at, now, prefs.parkTimerMinutes)}
          now={now}
          onSet={setTimerTo}
          onClose={() => setTimerSheetOpen(false)}
        />
        <PhotoViewer
          uris={photoUris}
          index={viewing}
          onClose={() => setViewing(null)}
          onShare={sharePhotoAt}
          onDelete={confirmDeletePhoto}
        />

        <View style={styles.card}>
          {session.place_name && <Text style={styles.label}>{session.place_name}</Text>}
          <Text style={styles.body}>
            {active
              ? `${formatDate(session.started_at)}, ${formatTime(session.started_at)}`
              : stayTimesText(session.started_at, session.ended_at)}
          </Text>
          <Text style={styles.muted}>{active ? 'Parked for ' : 'Parked '}{formatDuration(durationMs)}</Text>
          {timerText && <Text style={styles.body}>{timerText}</Text>}
          {session.note && <Text style={styles.body}>{session.note}</Text>}
        </View>

        {fee?.feeSen != null && (
          <View style={styles.card}>
            <View style={styles.feeHeader}>
              <Text style={styles.label}>Fee so far</Text>
              {fee.isEstimate && <EstimatePill />}
            </View>
            <Text style={styles.fee}>{formatRM(fee.feeSen)}</Text>
            {missingRate && <Text style={styles.muted}>{missingRate}</Text>}
          </View>
        )}

        {paid && (
          <View style={styles.card}>
            <Text style={styles.paid}>{paid.paid}</Text>
            {paid.calculated && <Text style={styles.muted}>{paid.calculated}</Text>}
          </View>
        )}

        {active && (
          <View style={styles.sideActions}>
            <Button
              title="Set timer"
              variant="tonal"
              size="small"
              icon={TimerIcon}
              onPress={() => setTimerSheetOpen(true)}
              disabled={busy}
            />
            <Button
              title={extendTimerText(session.timer_ends_at, prefs.extendMinutes)}
              variant="tonal"
              size="small"
              icon={PlusIcon}
              onPress={extend}
              disabled={busy}
            />
            {session.timer_ends_at != null && (
              <Button
                title="Stop timer"
                variant="tonal"
                size="small"
                icon={XIcon}
                onPress={confirmStopTimer}
                disabled={busy}
              />
            )}
            <Button title="Share" variant="tonal" size="small" icon={ShareIcon} onPress={shareSpot} disabled={busy} />
            {location && (
              <Button
                title="Open in Google Maps"
                variant="tonal"
                size="small"
                icon={MapPinIcon}
                onPress={openMaps}
                disabled={busy}
              />
            )}
          </View>
        )}

        {!active && <ErrorText error={actionError ?? notifyError} />}
      </ScrollView>
      {/* Found my car stays in sight below the scrolling content, so it never
          has to be scrolled to when the user is back at the car. */}
      {active && (
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <ErrorText error={actionError ?? notifyError} />
          <Button title="Found my car" onPress={() => router.push(`/session/end/${session.id}`)} disabled={busy} />
        </View>
      )}
    </View>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: space },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    spot: { borderRadius: radius.card, padding: 24, alignItems: 'center', gap: 4, boxShadow: c.shadow },
    level: { fontSize: 56, fontWeight: '800' },
    bay: { fontSize: 28, fontWeight: '700' },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 6, boxShadow: c.shadow },
    // Amber, like the overnight line on Found my car: it needs the user to act.
    elsewhere: {
      backgroundColor: c.warningSoft,
      borderRadius: radius.control,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    elsewhereText: { color: c.warning, fontWeight: '600' },
    label: { fontWeight: '600', color: c.text },
    route: { fontSize: 17, lineHeight: 24, color: c.text },
    body: { color: c.text },
    muted: { color: c.muted },
    feeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    fee: { fontSize: 24, fontWeight: '700', color: c.text },
    paid: { fontSize: 17, fontWeight: '600', color: c.text },
    // A row, so the small pill sits at the start instead of the centre.
    sideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
