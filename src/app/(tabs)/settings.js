import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Disclosure } from '../../components/Disclosure';
import { ErrorText } from '../../components/ErrorText';
import { ListRow, ListSection } from '../../components/List';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { exportDatabase, preferences, useDatabase } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useOnAppActive } from '../../hooks/useOnAppActive';
import { formatMinutes } from '../../lib/time';
import { askNotificationPermission, notificationPermission, syncNotifications } from '../../notify/notifications';
import { allowLocationLabel, LOCATION_PURPOSE } from '../../text/locationText';
import { EXTEND_OPTIONS, REMINDER_LEAD_OPTIONS } from '../../timer/timer';

const MODE_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const EXTEND_CHOICES = EXTEND_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));
const LEAD_CHOICES = REMINDER_LEAD_OPTIONS.map((minutes) => ({ value: minutes, label: formatMinutes(minutes) }));

// Settings: appearance, cars, places and holidays, the timer, the location
// and export.
export default function Settings() {
  const db = useDatabase();
  const { mode, setMode, loadError } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadPreferences = useCallback(() => preferences.get(db), [db]);
  const { data: prefs, error: prefsLoadError } = useFocusedLoad(loadPreferences);
  // The choice just made, shown at once; null until the user changes it.
  const [extendChoice, setExtendChoice] = useState(null);
  const [savingExtend, setSavingExtend] = useState(false);
  const [extendError, setExtendError] = useState(null);
  const [leadChoice, setLeadChoice] = useState(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState(null);

  // Read again on focus and when the app comes back to the front, so returning
  // from Android settings shows the change. Home syncs the notifications then.
  const loadPermission = useCallback(() => notificationPermission(), []);
  const { data: permission, error: permissionError, reload: reloadPermission } = useFocusedLoad(loadPermission);
  useOnAppActive(reloadPermission);
  const [allowing, setAllowing] = useState(false);

  // The timer choices are folded rows that show their value (Disclosure).
  const [open, setOpen] = useState({ extend: false, lead: false });
  const toggle = (part) => () => setOpen((current) => ({ ...current, [part]: !current[part] }));

  const location = useLocationPermission();
  const [allowingLocation, setAllowingLocation] = useState(false);
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

  // Only allowing is offered here; it is turned off in Android's own settings.
  const allowLocation = async () => {
    setAllowingLocation(true);
    setLocationError(null);
    try {
      await location.allow();
    } catch (e) {
      setLocationError(e);
    } finally {
      setAllowingLocation(false);
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
      </ListSection>

      <ListSection title="Location">
        <ListRow label="Use my location" value={location.permission && (location.permission.granted ? 'On' : 'Off')} />
        <View style={styles.rowNote}>
          <Text style={styles.hint}>{LOCATION_PURPOSE}</Text>
          {location.permission && !location.permission.granted && (
            <View style={styles.inlineAction}>
              <Button
                title={allowLocationLabel(location.permission)}
                variant="tonal"
                size="small"
                onPress={allowLocation}
                disabled={allowingLocation}
              />
            </View>
          )}
          <ErrorText error={locationError ?? location.error} />
        </View>
      </ListSection>

      <ListSection title="Data">
        {/* While the export runs the row is read-only, so it cannot start twice. */}
        <ListRow
          label="Export database"
          value={exporting ? 'Exporting…' : null}
          onPress={exporting ? undefined : startExport}
        />
        <View style={styles.rowNote}>
          <Text style={styles.hint}>Saves a copy you can send to Google Drive or email.</Text>
          <ErrorText error={exportError} />
        </View>
      </ListSection>

      {__DEV__ && (
        <ListSection title="Developer">
          <ListRow label="Database check" onPress={() => router.push('/debug')} />
        </ListSection>
      )}

      <Text style={styles.footer}>
        Park Yourself {Constants.expoConfig?.version}
        {'\n'}Your data stays on this phone.
      </Text>
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 24 },
    padded: { padding: 12, gap: 8 },
    // Sits under a ListRow in the same card, lined up with the row's label.
    rowNote: { paddingHorizontal: 16, paddingBottom: 14, marginTop: -6, gap: 4 },
    // A row, so the small pill sits at the start instead of the centre.
    inlineAction: { flexDirection: 'row', marginTop: 8 },
    hint: { fontSize: 13, color: c.muted },
    footer: { color: c.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  });
