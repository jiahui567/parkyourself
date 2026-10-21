import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { radius } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import { DATABASE_NAME, useDatabase } from '../db';
import { readDatabaseInfo } from '../db/debug';
import { runSelfTest } from '../db/selfTest';

async function selfTestAndLog() {
  const results = await runSelfTest();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`[selftest] ${results.length - failed}/${results.length} passed`, JSON.stringify(results));
  return results;
}

// Database check (development builds): database facts and the data layer
// self-test, which checks what only the real phone driver can show.
export default function DatabaseCheck() {
  const db = useDatabase();
  const styles = useThemedStyles(createStyles);
  const [info, setInfo] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readDatabaseInfo(db).then((i) => !cancelled && setInfo(i));
    if (__DEV__) selfTestAndLog().then((r) => !cancelled && setResults(r));
    return () => {
      cancelled = true;
    };
  }, [db]);

  const rerun = async () => {
    setResults(null);
    setResults(await selfTestAndLog());
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Database check' }} />
      <Text style={styles.heading}>Database</Text>
      {info && (
        <View style={styles.card}>
          <Text style={styles.body}>File: {DATABASE_NAME}</Text>
          <Text style={styles.body}>Schema version: v{info.user_version}</Text>
          <Text style={styles.body}>Foreign keys: {info.foreign_keys ? 'on' : 'OFF'}</Text>
          <Text style={styles.body}>Journal mode: {info.journal_mode}</Text>
          <Text style={styles.subheading}>Tables</Text>
          {info.tables.map((t) => (
            <Text key={t.name} style={styles.body}>
              {t.name} ({t.rows} rows)
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.heading}>Data layer self-test</Text>
      <View style={styles.card}>
        {!results && <Text style={styles.body}>Running…</Text>}
        {results?.map((r) => (
          <Text key={r.name} style={r.ok ? styles.pass : styles.fail}>
            {r.ok ? 'PASS' : 'FAIL'} {r.name}
            {!r.ok && `: ${r.detail}`}
          </Text>
        ))}
      </View>
      <Button title="Run self-test again" onPress={rerun} />
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
