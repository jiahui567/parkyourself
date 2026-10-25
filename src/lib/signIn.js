// The sign-in form as typed (PLAN.md, C2): an email, then the code emailed to it.

// The email trimmed and in lower case, or null while it cannot be one. The
// server checks it properly; this only keeps Send code off until it looks right.
export function readEmail(text) {
  const email = String(text ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// The code from the email, with any spaces left out, or null. Supabase sends
// 6 digits by default and can be set to send up to 10.
export function readCode(text) {
  const code = String(text ?? '').replace(/\s/g, '');
  return /^\d{6,10}$/.test(code) ? code : null;
}
