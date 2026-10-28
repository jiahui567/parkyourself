// Delete your account on the web (Google Play requires a way that does not
// need the app; PLAN.md, C9). The same sign-in as the app's Account, an email
// and the 6-digit code emailed to it, then the same deletion as its Delete
// account (deleteAccount in src/cloud/supabase.js): the report photos first,
// which the server refuses to leave behind, then delete_my_account, whose
// foreign keys delete the reports and the backup. Row Level Security limits
// all of it to the signed-in user, as in the app.
(() => {
  const PHOTO_BUCKET = 'report-photos';
  const PAGE = 100;
  const OFFLINE_TEXT = 'Could not reach the server. Check your connection and try again.';
  const CODE_TEXT = 'That code is wrong or has expired. Ask for a new one.';
  const STEPS = ['email-step', 'code-step', 'delete-step', 'done-step'];

  const config = window.PARK_YOURSELF_CONFIG || {};
  const el = (id) => document.getElementById(id);

  // No server set up, or supabase-js did not load (offline, or the CDN file
  // did not match its hash): the page keeps saying so, and only the app and
  // email are offered. It says so until here, in case this file fails too.
  if (!config.supabaseUrl || !config.publishableKey || !window.supabase) return;
  el('web-unavailable').hidden = true;

  // Nothing is kept in the browser: the session lasts only while the page is open.
  const client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let email = null;

  const showError = (text) => {
    el('error').textContent = text || '';
    el('error').hidden = !text;
  };

  const show = (step) => {
    for (const id of STEPS) el(id).hidden = id !== step;
    showError(null);
  };

  // A sentence for the user, as src/text/cloudText.js gives the app. A failed
  // fetch comes as a thrown TypeError, from Auth as AuthRetryableFetchError,
  // and from the database and Storage only as its message.
  const errorText = (error) => {
    const offline = /network request failed|failed to fetch|fetch failed/i.test(error.message || '');
    if (offline || error.name === 'AuthRetryableFetchError' || error instanceof TypeError) return OFFLINE_TEXT;
    if (error.code === 'otp_expired') return CODE_TEXT;
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      return 'Too many codes were sent. Try again later.';
    }
    return error.message || OFFLINE_TEXT;
  };

  // Runs action with the button disabled and showing busyText, and shows any error.
  const run = async (button, busyText, action) => {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
    showError(null);
    try {
      await action();
    } catch (e) {
      console.warn(e);
      showError(errorText(e));
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };

  // No account is made here (shouldCreateUser false). The page says the same
  // whether or not an account uses the email. That is not a protection: the
  // server's rate limit, or a direct call with the public key, still tells.
  const sendCode = async (address) => {
    const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    const noAccount = error && (error.code === 'otp_disabled' || /signups not allowed/i.test(error.message || ''));
    if (error && !noAccount) throw error;
    email = address;
    el('code-sent').textContent = `If an account uses ${address}, we emailed it a code. It works for an hour.`;
    el('code').value = '';
    show('code-step');
  };

  const signIn = async (code) => {
    const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    el('signed-in-as').textContent = `Signed in as ${data.user.email}.`;
    show('delete-step');
  };

  // Every photo in the user's own folder, a page at a time.
  const photoPaths = async (userId) => {
    const bucket = client.storage.from(PHOTO_BUCKET);
    const paths = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket.list(userId, { limit: PAGE, offset });
      if (error) throw error;
      paths.push(...data.map((file) => `${userId}/${file.name}`));
      if (data.length < PAGE) return paths;
    }
  };

  const deleteAccount = async () => {
    const { session } = (await client.auth.getSession()).data;
    if (!session) {
      show('email-step');
      throw new Error('You were signed out. Sign in again to delete your account.');
    }
    const paths = await photoPaths(session.user.id);
    if (paths.length) {
      const { error } = await client.storage.from(PHOTO_BUCKET).remove(paths);
      if (error) throw error;
    }
    const { error } = await client.rpc('delete_my_account');
    if (error) throw error;
    show('done-step');
  };

  el('email-step').addEventListener('submit', (event) => {
    event.preventDefault();
    const address = el('email').value.trim();
    if (address) run(el('send-code'), 'Sending…', () => sendCode(address));
  });

  el('code-step').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = el('code').value.replace(/\s/g, '');
    if (code) run(el('sign-in'), 'Signing in…', () => signIn(code));
  });

  el('other-email').addEventListener('click', () => show('email-step'));

  el('delete').addEventListener('click', () => {
    if (!window.confirm('Delete your account for good? This cannot be undone.')) return;
    run(el('delete'), 'Deleting…', deleteAccount);
  });

  show('email-step');
})();
