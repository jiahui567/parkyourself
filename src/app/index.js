import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DATABASE_NAME, useDatabase } from '../db';
import { readDatabaseInfo } from '../db/debug';
import { runSelfTest } from '../db/selfTest';

async function selfTestAndLog() {
  const results = await runSelfTest();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`[selftest] ${results.length - failed}/${results.length} passed`, JSON.stringify(results));
  return results;
}

// M0 status screen: shows the database is set up. Replaced by the real Home
// screen in M1.
export default function M0Status() {
  const db = useDatabase();
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
      <Text style={styles.heading}>Database</Text>
      {info && (
        <View style={styles.card}>
          <Text>File: {DATABASE_NAME}</Text>
          <Text>Schema version: v{info.user_version}</Text>
          <Text>Foreign keys: {info.foreign_keys ? 'on' : 'OFF'}</Text>
          <Text>Journal mode: {info.journal_mode}</Text>
          <Text style={styles.subheading}>Tables</Text>
          {info.tables.map((t) => (
            <Text key={t.name}>
              {t.name} ({t.rows} rows)
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.heading}>Data layer self-test</Text>
      <View style={styles.card}>
        {!results && <Text>Running…</Text>}
        {results?.map((r) => (
          <Text key={r.name} style={r.ok ? styles.pass : styles.fail}>
            {r.ok ? 'PASS' : 'FAIL'} {r.name}
            {!r.ok && `: ${r.detail}`}
          </Text>
        ))}
      </View>
      <Pressable style={styles.button} onPress={rerun}>
        <Text style={styles.buttonText}>Run self-test again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  subheading: { fontWeight: '600', marginTop: 8 },
  card: { backgroundColor: '#f2f2f2', borderRadius: 8, padding: 12, gap: 2 },
  pass: { color: '#1b7f3b' },
  fail: { color: '#c62828' },
  button: { backgroundColor: '#1E5BD8', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
