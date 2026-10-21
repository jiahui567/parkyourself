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

// Reads a typed amount such as '3', '3.5', 'RM 3.00' or '1,234.50' into sen.
// Returns null for anything else: empty, negative, letters, more than two
// decimals. Works on the digits as text, so '0.10' is exactly 10 sen.
export function parseRM(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/^RM\s*/i, '')
    .replace(/,/g, '');
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || (match[1] === '' && !match[2])) return null;
  return Number(match[1] || '0') * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
