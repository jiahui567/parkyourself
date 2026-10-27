import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { myReports, sendSignInCode, signInWithCode } from '../cloud/supabase';
import { deleteAccountAndForget, loadAccount, pushBeforeSignOut, signOutKeepingData, syncNow } from '../cloud/sync';
import { Button } from '../components/Button';
import { useDialog } from '../components/Dialog';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { IconButton } from '../components/IconButton';
import { MoreIcon } from '../components/icons';
import { ListSection } from '../components/List';
import { radius, space } from '../components/theme';
import { useThemedStyles } from '../components/ThemeProvider';
import { syncState, useDatabase } from '../db';
import { useFocusedLoad } from '../hooks/useFocusedLoad';
import { useNow } from '../hooks/useNow';
import { readCode, readEmail } from '../lib/signIn';
import { myReportText } from '../text/reportText';
import { signOutWarning, syncErrorText, syncStatusText } from '../text/syncText';

// Account (C2, C3): sign in with an email and the code emailed to it, which
// backs up your cars, places, rates, holidays and parking (never photos) and
// lets you send rate reports; signed in, how the backup stands with Sync now,
// your reports, Sign out, and Delete account in the header's menu. Opened
// from Settings, or from a report with from=report, which it goes back to
// once signed in.
export default function AccountScreen() {
  const db = useDatabase();
  const { from } = useLocalSearchParams();
  const showDialog = useDialog();
  // 'sync', 'signOut' or 'delete' while one runs; each locks the others.
  const [busy, setBusy] = useState(null);
  const [signOutError, setSignOutError] = useState(null);
  const load = useCallback(async () => {
    // Kept on the phone too, so Settings shows it without asking the server.
    const account = await loadAccount(db);
    const sync = await syncState.get(db);
    if (!account) return { account: null, sync };
    // The reports need the server; without it the account still shows.
    try {
      return { account, sync, reports: await myReports(), reportsError: null };
    } catch (e) {
      return { account, sync, reports: [], reportsError: e };
    }
  }, [db]);
  const { data, error, loading, reload } = useFocusedLoad(load);

  // The first push starts at once (a second phone on the same account needs
  // nothing more than the code); this screen shows how it went once it ends.
  const signedIn = async (account) => {
    await syncState.setAccount(db, account);
    if (from === 'report' && router.canGoBack()) {
      syncNow(db);
      router.back();
    } else {
      await reload();
      syncNow(db).then(reload);
    }
  };

  const syncAgain = async () => {
    setBusy('sync');
    try {
      await syncNow(db);
    } finally {
      await reload();
      setBusy(null);
    }
  };

  // Reloads whatever happened, so the screen shows the account as it is: one
  // that could not sign out is still signed in. The phone keeps its rows and
  // which account they are backed up to.
  const signOutNow = async () => {
    setBusy('signOut');
    setSignOutError(null);
    try {
      await signOutKeepingData(db);
    } catch (e) {
      setSignOutError(e);
    } finally {
      await reload();
      setBusy(null);
    }
  };

  // A last push first, so this phone's changes reach the account; what could
  // not go is said before signing out (PLAN.md, "How the sync works", step 9).
  const leave = async () => {
    setBusy('signOut');
    setSignOutError(null);
    let notBackedUp;
    try {
      notBackedUp = await pushBeforeSignOut(db);
    } catch (e) {
      setSignOutError(e);
      setBusy(null);
      return;
    }
    if (notBackedUp > 0) {
      await reload();
      setBusy(null);
      showDialog({
        ...signOutWarning(notBackedUp),
        buttons: [
          { text: 'Sign out', style: 'destructive', onPress: signOutNow },
          { text: 'Cancel', style: 'cancel' },
        ],
      });
      return;
    }
    await signOutNow();
  };

  // Delete account is rarely wanted and cannot be undone, so it sits in the
  // header's menu (2026-10-26) and asks again before it runs. Google Play
  // requires it for apps with accounts. A failure shows in a dialog, which
  // stays up when the screen changes to signed out.
  const removeAccount = async () => {
    setBusy('delete');
    try {
      const { localError } = await deleteAccountAndForget(db);
      if (localError) {
        showDialog({ title: 'Your account is deleted', message: `But this phone could not reset its backup: ${localError.message ?? localError}` });
      }
    } catch (e) {
      showDialog({ title: 'Could not delete your account', message: String(e?.message ?? e) });
    } finally {
      await reload();
      setBusy(null);
    }
  };
  const confirmDelete = () =>
    showDialog({
      title: 'Delete your account?',
      message: 'Your backup, your reports and their photos are deleted from the server. Everything on this phone stays.',
      buttons: [
        { text: 'Delete account', style: 'destructive', onPress: removeAccount },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  const openMenu = (email) =>
    showDialog({
      title: email,
      buttons: [
        { text: 'Delete account', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  let body = null;
  if (error) body = <ErrorText error={error} />;
  else if (!loading) {
    body = data.account ? (
      <SignedIn
        email={data.account.email}
        sync={data.sync}
        reports={data.reports}
        reportsError={data.reportsError}
        busy={busy}
        signOutError={signOutError}
        onSync={syncAgain}
        onSignOut={leave}
      />
    ) : (
      <SignIn onSignedIn={signedIn} />
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Account',
          headerRight: data?.account
            ? () => (
                <IconButton
                  icon={MoreIcon}
                  label="More account options"
                  onPress={() => openMenu(data.account.email)}
                  disabled={Boolean(busy)}
                />
              )
            : undefined,
        }}
      />
      {body}
    </>
  );
}

function SignIn({ onSignedIn }) {
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const [emailText, setEmailText] = useState('');
  // The email the code went to; null until one is sent.
  const [sentTo, setSentTo] = useState(null);
  const [codeText, setCodeText] = useState('');
  // True once a new code went out for the same email, so the user knows.
  const [resent, setResent] = useState(false);
  // 'send', 'resend' or 'signIn' while one runs.
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const email = readEmail(emailText);
  const code = readCode(codeText);

  const run = async (kind, action) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  const sendCode = () =>
    run('send', async () => {
      await sendSignInCode(email);
      setSentTo(email);
      setResent(false);
      setCodeText('');
    });
  const signIn = () =>
    run('signIn', async () => {
      await onSignedIn(await signInWithCode(sentTo, code));
    });
  const resendCode = () =>
    run('resend', async () => {
      setResent(false);
      await sendSignInCode(sentTo);
      setResent(true);
      setCodeText('');
    });
  const changeEmail = () => {
    setSentTo(null);
    setError(null);
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {sentTo == null ? (
          <>
            <Text style={styles.intro}>
              Sign in to back up your cars, places, rates, holidays and parking, and to report rates for the car park
              list. Photos stay on this phone.
            </Text>
            <Field
              label="Email"
              value={emailText}
              onChangeText={setEmailText}
              placeholder="e.g. you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
            />
            <ErrorText error={error} />
            <Button title={busy ? 'Sending…' : 'Send code'} onPress={sendCode} disabled={Boolean(busy) || !email} />
          </>
        ) : (
          <>
            <Text style={styles.intro}>
              {resent ? 'We sent a new code' : 'We emailed a code'} to {sentTo}. It works for an hour.
            </Text>
            <View style={styles.row}>
              <Button
                title={busy === 'resend' ? 'Sending…' : 'Send a new code'}
                variant="secondary"
                size="small"
                onPress={resendCode}
                disabled={Boolean(busy)}
              />
              <Button
                title="Use another email"
                variant="secondary"
                size="small"
                onPress={changeEmail}
                disabled={Boolean(busy)}
              />
            </View>
            <Field
              label="Code"
              value={codeText}
              onChangeText={setCodeText}
              placeholder="From the email"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={12}
              editable={!busy}
            />
            <ErrorText error={error} />
            <Button
              title={busy === 'signIn' ? 'Signing in…' : 'Sign in'}
              onPress={signIn}
              disabled={Boolean(busy) || !code}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// busy: 'sync', 'signOut' or 'delete' while AccountScreen runs one.
function SignedIn({ email, sync, reports, reportsError, busy, signOutError, onSync, onSignOut }) {
  const styles = useThemedStyles(createStyles);
  const now = useNow(60 * 1000);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <ListSection title="Back up and sync">
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>{syncStatusText(sync, now)}</Text>
          <ErrorText error={syncErrorText(sync)} />
          {/* Nothing to sync while the phone is backed up to another account. */}
          {!sync.otherAccount && (
            <View style={styles.row}>
              <Button
                title={busy === 'sync' ? 'Syncing…' : 'Sync now'}
                variant="tonal"
                size="small"
                onPress={onSync}
                disabled={Boolean(busy)}
              />
            </View>
          )}
        </View>
      </ListSection>

      <ListSection title="Your reports">
        {reportsError ? (
          <View style={styles.reportRow}>
            <ErrorText error={reportsError} />
          </View>
        ) : (
          reports.length === 0 && (
            <Text style={[styles.reportRow, styles.empty]}>No reports yet. Send one from a place in Places.</Text>
          )
        )}
        {reports.map((report, index) => {
          const text = myReportText(report);
          return (
            <View key={report.id} style={[styles.reportRow, index > 0 && styles.divider]}>
              <Text style={styles.reportName}>{text.name}</Text>
              <Text style={styles.hint}>{text.detail}</Text>
            </View>
          );
        })}
      </ListSection>

      <ErrorText error={signOutError} />
      {/* Deleting takes a few calls to the server, so it says so. */}
      {busy === 'delete' && <Text style={styles.progress}>Deleting your account…</Text>}
      {/* A small pill sizes itself to its label and sits in the middle. */}
      <View style={styles.signOut}>
        <Button
          title={busy === 'signOut' ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          size="small"
          onPress={onSignOut}
          disabled={Boolean(busy)}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    screen: { flex: 1 },
    container: { padding: 16, gap: space },
    intro: { fontSize: 15, lineHeight: 22, color: c.muted },
    // A row, so the small pills sit at the start instead of the centre.
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: { backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 4, boxShadow: c.shadow },
    label: { fontSize: 13, color: c.muted },
    email: { fontSize: 17, fontWeight: '600', color: c.text },
    reportRow: { paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
    syncRow: { paddingVertical: 12, paddingHorizontal: 16, gap: 10 },
    syncText: { fontSize: 15, lineHeight: 22, color: c.text },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    reportName: { fontSize: 16, color: c.text },
    empty: { fontSize: 15, color: c.muted },
    hint: { fontSize: 13, color: c.muted },
    signOut: { marginTop: 12 },
    progress: { fontSize: 15, color: c.muted, textAlign: 'center' },
  });
