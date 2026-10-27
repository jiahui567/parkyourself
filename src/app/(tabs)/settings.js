import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabaseUrl } from '../../cloud/supabase';
import { Button } from '../../components/Button';
import { Disclosure } from '../../components/Disclosure';
import { ErrorText } from '../../components/ErrorText';
import { ListRow, ListSection } from '../../components/List';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SwitchRow } from '../../components/SwitchRow';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { TimerWheel } from '../../components/TimerWheel';
import { exportDatabase, preferences, syncState, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useNow } from '../../hooks/useNow';
import { useOnAppActive } from '../../hooks/useOnAppActive';
import { formatMinutes } from '../../lib/time';
import { askNotificationPermission, notificationPermission, syncNotifications } from '../../notify/notifications';
import { locationSwitchHint } from '../../text/locationText';
import { dataFooterText, syncErrorText, syncRowValue, syncStatusText } from '../../text/syncText';
import { parkTimerText } from '../../text/timerText';
import { EXTEND_OPTIONS, REMINDER_LEAD_OPTIONS } from '../../timer/timer';

const MODE_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const EXTEND_CHOICES = EXTEND_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));
const LEAD_CHOICES = REMINDER_LEAD_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));

// Settings: appearance, cars, places and holidays, what happens when you park
// (the timer and the location), the timer and its reminders, and the backup.
export default function Settings() {
  const db = useDatabase();
  const { mode, setMode, loadError } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadPreferences = useCallback(() => preferences.get(db), [db]);
  const { data: prefs, error: prefsLoadError } = useFocusedLoad(loadPreferences);
  // What the phone remembers of the account and the last sync: Settings
  // never asks the server (Account does).
  const loadSync = useCallback(() => syncState.get(db), [db]);
  const { data: sync, error: syncError } = useFocusedLoad(loadSync);
  const now = useNow(60 * 1000);
  // The choice just made, shown at once; null until the user changes it.
  const [extendChoice, setExtendChoice] = useState(null);
  const [savingExtend, setSavingExtend] = useState(false);
  const [extendError, setExtendError] = useState(null);
  const [leadChoice, setLeadChoice] = useState(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState(null);
  const [parkTimerChoice, setParkTimerChoice] = useState(null);
  const [parkTimerError, setParkTimerError] = useState(null);

  // Read again on focus and when the app comes back to the front, so returning
  // from Android settings shows the change. Home syncs the notifications then.
  const loadPermission = useCallback(() => notificationPermission(), []);
  const { data: permission, error: permissionError, reload: reloadPermission } = useFocusedLoad(loadPermission);
  useOnAppActive(reloadPermission);
  const [allowing, setAllowing] = useState(false);

  // The timer choices are folded rows that show their value (Disclosure).
  const [open, setOpen] = useState({ parkTimer: false, extend: false, lead: false, battery: false });
  const toggle = (part) => () => setOpen((current) => ({ ...current, [part]: !current[part] }));
  const [batteryError, setBatteryError] = useState(null);

  const location = useLocationPermission();
  const [locationChoice, setLocationChoice] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  // A second tap can land before the row re-renders as busy.
  const exportingRef = useRef(false);

  // One change at a time, so a failed save can never leave the screen and the
  // saved setting disagreeing.
  const changeMode = async (next) => {
    setSaving(true);
    setError(null);
    try {
      await setMode(next);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const parkTimerMinutes = parkTimerChoice ?? prefs?.parkTimerMinutes;

  // Every park starts this timer (0 is Off). Saved each time the wheel
  // settles; a failure puts the old value back only if no newer turn of the
  // wheel came since, so the screen never shows a stale value.
  const latestParkTimer = useRef(0);
  const changeParkTimer = async (next) => {
    const turn = ++latestParkTimer.current;
    const previous = parkTimerMinutes;
    setParkTimerChoice(next);
    setParkTimerError(null);
    try {
      await preferences.setParkTimerMinutes(db, next);
    } catch (e) {
      if (turn === latestParkTimer.current) setParkTimerChoice(previous);
      setParkTimerError(e);
    }
  };

  const extendMinutes = extendChoice ?? prefs?.extendMinutes;

  // Same rule as the theme: one change at a time, and the old choice comes
  // back if saving fails.
  const changeExtend = async (next) => {
    const previous = extendMinutes;
    setExtendChoice(next);
    setSavingExtend(true);
    setExtendError(null);
    try {
      await preferences.setExtendMinutes(db, next);
    } catch (e) {
      setExtendChoice(previous);
      setExtendError(e);
    } finally {
      setSavingExtend(false);
    }
  };

  const leadMinutes = leadChoice ?? prefs?.reminderLeadMinutes;
  const notificationsOff = Boolean(permission) && !permission.granted;

  // Like Extend, but a saved change also moves the reminders already set.
  const changeLead = async (next) => {
    const previous = leadMinutes;
    setLeadChoice(next);
    setSavingLead(true);
    setLeadError(null);
    try {
      await preferences.setReminderLeadMinutes(db, next);
    } catch (e) {
      setLeadChoice(previous);
      setLeadError(e);
      setSavingLead(false);
      return;
    }
    try {
      await syncNotifications(db);
    } catch (e) {
      setLeadError(e);
    }
    setSavingLead(false);
  };

  // Android lets an app ask twice; after that only its settings page can allow it.
  const allowNotifications = async () => {
    setAllowing(true);
    setLeadError(null);
    try {
      if (permission.canAskAgain) {
        await askNotificationPermission();
        await syncNotifications(db);
        await reloadPermission();
      } else {
        await Linking.openSettings();
      }
    } catch (e) {
      setLeadError(e);
    } finally {
      setAllowing(false);
    }
  };

  // Android's settings page for this app, where Battery holds the setting:
  // asking Android to lift its battery limits directly needs a permission
  // Google Play allows only for some apps.
  const openBatterySettings = async () => {
    setBatteryError(null);
    try {
      await Linking.openSettings();
    } catch (e) {
      setBatteryError(e);
    }
  };

  // The switch is on only while the choice is on and Android allows it.
  // Turning it on also asks Android (or opens its settings once it no longer
  // asks); if the user says no there, the switch simply stays off.
  const useLocation = locationChoice ?? prefs?.useLocation;
  const locationOn = Boolean(useLocation && location.permission?.granted);
  const changeUseLocation = async (next) => {
    const previous = useLocation;
    setLocationChoice(next);
    setSavingLocation(true);
    setLocationError(null);
    try {
      // Asked first, so a failure saves nothing; saying no in Android's dialog
      // still saves "on", and the switch stays off until Android allows it.
      if (next && !location.permission.granted) await location.allow();
      await preferences.setUseLocation(db, next);
    } catch (e) {
      setLocationChoice(previous);
      setLocationError(e);
    } finally {
      setSavingLocation(false);
    }
  };

  const startExport = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError(null);
    try {
      await exportDatabase(db);
    } catch (e) {
      setExportError(e);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ListSection title="Appearance">
        <View style={styles.padded}>
          <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={changeMode} disabled={saving} />
          <ErrorText error={error ?? loadError} />
        </View>
      </ListSection>

      <ListSection title="Your cars">
        <ListRow label="Cars" onPress={() => router.push('/vehicles')} />
      </ListSection>

      <ListSection title="Places and rates">
        <ListRow label="Places" onPress={() => router.push('/places')} />
        <ListRow label="Public holidays" onPress={() => router.push('/holidays')} first={false} />
      </ListSection>

      <ListSection title="When you park">
        <Disclosure
          label="Timer when parking"
          value={parkTimerMinutes != null ? parkTimerText(parkTimerMinutes) : null}
          open={open.parkTimer}
          onToggle={toggle('parkTimer')}
        >
          {parkTimerMinutes != null && <TimerWheel value={parkTimerMinutes} onChange={changeParkTimer} />}
          <Text style={styles.hint}>0 h 00 m is off. Change, extend or stop it on Find.</Text>
          <ErrorText error={parkTimerError ?? prefsLoadError} />
        </Disclosure>
        <View style={[styles.switchRow, styles.rowDivider]}>
          <SwitchRow
            label="Use location when parking"
            hint={locationSwitchHint(location.permission)}
            value={locationOn}
            onValueChange={changeUseLocation}
            disabled={savingLocation || !location.permission || useLocation == null}
          />
          <ErrorText error={locationError ?? location.error ?? prefsLoadError} />
        </View>
      </ListSection>

      <ListSection title="Timer">
        <Disclosure
          label="Extend timer by"
          value={extendMinutes != null ? formatMinutes(extendMinutes) : null}
          open={open.extend}
          onToggle={toggle('extend')}
        >
          {extendMinutes != null && (
            <SegmentedControl
              options={EXTEND_CHOICES}
              value={extendMinutes}
              onChange={changeExtend}
              disabled={savingExtend}
            />
          )}
          <Text style={styles.hint}>Added each time you tap Extend timer.</Text>
          <ErrorText error={extendError ?? prefsLoadError} />
        </Disclosure>
        {/* Notifications being off stays in sight on the folded row. */}
        <Disclosure
          label="Remind me before the timer ends"
          value={leadMinutes != null ? formatMinutes(leadMinutes) : null}
          hint={notificationsOff ? 'Notifications are off, so no reminder will ring.' : null}
          open={open.lead}
          onToggle={toggle('lead')}
          first={false}
        >
          {leadMinutes != null && (
            <SegmentedControl options={LEAD_CHOICES} value={leadMinutes} onChange={changeLead} disabled={savingLead} />
          )}
          <Text style={styles.hint}>Another reminder rings when the timer ends.</Text>
          {notificationsOff && (
            <View style={styles.inlineAction}>
              <Button
                title={permission.canAskAgain ? 'Allow notifications' : 'Open Android settings'}
                variant="tonal"
                size="small"
                onPress={allowNotifications}
                disabled={allowing}
              />
            </View>
          )}
          <ErrorText error={leadError ?? permissionError} />
        </Disclosure>
        {/* Battery savers are Android's (PLAN.md, "Notifications"). The app cannot
            tell whether they are already lifted, so the row is always here. */}
        {Platform.OS === 'android' && (
          <Disclosure label="Reminders late?" open={open.battery} onToggle={toggle('battery')} first={false}>
            <Text style={styles.hint}>
              Some phones (Xiaomi, Oppo, Vivo, Samsung) hold back reminders to save battery. In Android settings, find
              this app&apos;s battery setting and remove its limits (Unrestricted or No restrictions on many phones).
            </Text>
            <View style={styles.inlineAction}>
              <Button title="Open Android settings" variant="tonal" size="small" onPress={openBatterySettings} />
            </View>
            <ErrorText error={batteryError} />
          </Disclosure>
        )}
      </ListSection>

      {/* The backup (C3) took Export database's place (2026-10-27). Signing in,
          Sync now, how it went and your rate reports are on Account, the one
          way in since the Car park list row was dropped (2026-10-27). A build
          with no server set up has nothing to sign in to. */}
      {supabaseUrl && (
        <ListSection title="Data">
          <ListRow
            label="Back up and sync"
            value={sync ? syncRowValue(sync) : null}
            onPress={() => router.push('/account')}
          />
          <View style={styles.rowNote}>
            {sync && <Text style={styles.hint}>{syncStatusText(sync, now)}</Text>}
            <ErrorText error={syncError ?? (sync && syncErrorText(sync))} />
          </View>
        </ListSection>
      )}

      {__DEV__ && (
        <ListSection title="Developer">
          <ListRow label="Database check" onPress={() => router.push('/debug')} />
          {/* While the export runs the row is read-only, so it cannot start twice. */}
          <ListRow
            label="Export database"
            value={exporting ? 'Exporting…' : null}
            onPress={exporting ? undefined : startExport}
            first={false}
          />
          <View style={styles.rowNote}>
            <Text style={styles.hint}>Saves a copy you can send to Google Drive or email.</Text>
            <ErrorText error={exportError} />
          </View>
        </ListSection>
      )}

      <Text style={styles.footer}>
        Park Yourself {Constants.expoConfig?.version}
        {'\n'}
        {dataFooterText(sync)}
      </Text>
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 24 },
    padded: { padding: 12, gap: 8 },
    // SwitchRow has no side padding; this lines it up with the Disclosure rows.
    switchRow: { paddingHorizontal: 16, paddingVertical: 6 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    // Sits under a ListRow in the same card, lined up with the row's label.
    rowNote: { paddingHorizontal: 16, paddingBottom: 14, marginTop: -6, gap: 4 },
    // A row, so the small pill sits at the start instead of the centre.
    inlineAction: { flexDirection: 'row', marginTop: 8 },
    hint: { fontSize: 13, color: c.muted },
    footer: { color: c.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  });
