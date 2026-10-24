import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabaseUrl } from '../cloud/supabase';
import { Button } from '../components/Button';
import { ErrorText } from '../components/ErrorText';
import { radius } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import { carParks, DATABASE_NAME, readDatabaseInfo, runSelfTest, useDatabase } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';

// One run at a time, even across leaving and reopening this screen: a second
// run would try to delete the test database the first one still has open.
let inFlight = null;

function selfTestAndLog() {
  inFlight ??= runSelfTest()
    .then((results) => {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`[selftest] ${results.length - failed}/${results.length} passed`, JSON.stringify(results));
      return results;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

// Database check (development builds): database facts and the data layer
// self-test, which checks what only the real phone driver can show.
export default function DatabaseCheck() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const loadInfo = useCallback(async () => {
    const [facts, list] = await Promise.all([readDatabaseInfo(db), carParks.info(db)]);
    return { ...facts, list };
  }, [db]);
  const { data: info, error: infoError } = useFocusedLoad(loadInfo);
  const [results, setResults] = useState(null);
  const [testError, setTestError] = useState(null);
  // The self-test starts by itself only in development builds.
  const running = __DEV__ && !results && !testError;

  // The self-test builds and deletes a throwaway database, so it runs once
  // when the screen opens and again only when asked, not on every focus.
  useEffect(() => {
    let cancelled = false;
    if (__DEV__) {
      selfTestAndLog().then(
        (r) => !cancelled && setResults(r),
        (e) => !cancelled && setTestError(e)
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const rerun = async () => {
    setResults(null);
    setTestError(null);
    try {
      setResults(await selfTestAndLog());
    } catch (e) {
      setTestError(e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Database check' }} />
      <Text style={styles.heading}>Database</Text>
      <ErrorText error={infoError} />
      {info && (
        <View style={styles.card}>
          <Text style={styles.body}>File: {DATABASE_NAME}</Text>
          <Text style={styles.body}>Schema version: v{info.user_version}</Text>
          <Text style={styles.body}>Foreign keys: {info.foreign_keys ? 'on' : 'OFF'}</Text>
          <Text style={styles.body}>Journal mode: {info.journal_mode}</Text>
          <Text style={styles.body}>
            Car park list: {info.list.carParks} car parks, {info.list.rates} rates, from{' '}
            {info.list.source === 'server' ? 'Supabase' : 'the built-in copy'}
          </Text>
          {/* Refreshing or downloading the list never stops the app; the last failure is kept here. */}
          {info.list.error && <Text style={styles.fail}>Car park list not updated: {info.list.error}</Text>}
          <Text style={styles.subheading}>Tables</Text>
          {info.tables.map((t) => (
            <Text key={t.name} style={styles.body}>
              {t.name} ({t.rows} rows)
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.heading}>Supabase</Text>
      <View style={styles.card}>
        <Text style={styles.body}>Server: {supabaseUrl ?? 'Not set up'}</Text>
      </View>

      <Text style={styles.heading}>Data layer self-test</Text>
      <View style={styles.card}>
        {running && <Text style={styles.body}>Running…</Text>}
        <ErrorText error={testError} />
        {results?.map((r) => (
          <Text key={r.name} style={r.ok ? styles.pass : styles.fail}>
            {r.ok ? 'PASS' : 'FAIL'} {r.name}
            {!r.ok && `: ${r.detail}`}
          </Text>
        ))}
      </View>
      {/* A second run while one is going would try to delete the open test database. */}
      <Button title="Run self-test again" onPress={rerun} disabled={running} />
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 8 },
    heading: { fontSize: 18, fontWeight: '600', marginTop: 8, color: c.text },
    subheading: { fontWeight: '600', marginTop: 8, color: c.text },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 2, boxShadow: c.shadow },
    body: { color: c.text },
    pass: { color: c.accent },
    fail: { color: c.danger },
  });
