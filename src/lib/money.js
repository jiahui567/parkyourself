// Money is stored as integer sen (RM 3.00 = 300) so sums never pick up
// floating-point errors. These two functions are the only conversions to and
// from text.

// formatRM(300) -> 'RM 3.00', formatRM(123450) -> 'RM 1,234.50'
export function formatRM(sen) {
  if (!Number.isInteger(sen)) throw new Error(`Money must be whole sen, got ${sen}`);
  const sign = sen < 0 ? '-' : '';
  const abs = Math.abs(sen);
  const ringgit = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}RM ${ringgit}.${cents}`;
}

// The text to prefill an amount field with, which has its own RM label:
// formatAmountInput(123450) -> '1234.50', and '' for no amount. No thousands
// separator, so the user can edit it digit by digit.
export function formatAmountInput(sen) {
  if (sen == null) return '';
  if (!Number.isInteger(sen) || sen < 0) throw new Error(`An amount must be whole sen of 0 or more, got ${sen}`);
  return `${Math.floor(sen / 100)}.${String(sen % 100).padStart(2, '0')}`;
}

// Reads a typed amount such as '3', '3.5', 'RM 3.00' or '1,234.50' into sen.
// Returns null for anything else: empty, negative, letters, more than two
// decimals, more than nine digits of ringgit (a typo: no parking costs that,
// and from 14 digits a number would lose sen), or a comma that does not
// group thousands: some number pads have a decimal
// comma, and '3,50' could mean RM 3.50 or RM 350, so it is refused rather than
// guessed. Works on the digits as text, so '0.10' is exactly 10 sen.
export function parseRM(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/^RM\s*/i, '');
  if (cleaned.includes(',') && !/^\d{1,3}(?:,\d{3})+(?:\.\d{0,2})?$/.test(cleaned)) return null;
  const match = /^(\d{0,9})(?:\.(\d{0,2}))?$/.exec(cleaned.replace(/,/g, ''));
  if (!match || (match[1] === '' && !match[2])) return null;
  return Number(match[1] || '0') * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
