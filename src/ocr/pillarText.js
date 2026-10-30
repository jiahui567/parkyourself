// Level and bay suggestions from the text OCR reads off a pillar sign
// (PLAN.md, "OCR for the pillar sign"). The Park screen shows every code on
// the sign as a chip and the user picks, so this suggests generously within
// the sign; readSign leaves out what is clearly not the sign.

// GF is the ground floor and RF the roof in many Malaysian car parks.
const LEVEL = /^(?:[BP][1-9]|L(?:[1-9]|1[0-9]|20)|LG|UG|LL|GF|RF|G|M)$/;
const LETTER = /^[A-Z]$/;
const NUMBER = /^\d{1,4}$/;
const LETTER_NUMBER = /^[A-Z]\d{1,3}$/;

// pillarCandidates('LEVEL B2 ZONE C-14') -> { levels: ['B2'], bays: ['C14'] }
export function pillarCandidates(text) {
  const tokens = String(text ?? '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const levels = [];
  const bays = [];
  const add = (list, value) => {
    if (!list.includes(value)) list.push(value);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];

    // "B 2", "C 14" and "C-14" arrive as a letter followed by a number.
    if (LETTER.test(token) && next !== undefined && NUMBER.test(next)) {
      const joined = token + next;
      if (LEVEL.test(joined)) {
        add(levels, joined);
      } else {
        if (LEVEL.test(token)) add(levels, token); // "M 12": level M, or bay M12
        add(bays, joined);
      }
      i++;
    } else if (LEVEL.test(token)) {
      add(levels, token);
    } else if (LETTER_NUMBER.test(token) || NUMBER.test(token)) {
      add(bays, token);
    }
  }
  return { levels, bays };
}

// The codes Park offers in its Level row and its Bay row. The patterns cannot
// always tell a level from a bay (a sign reading "G3 A2" gives two bays), so
// each row offers every code read, the likelier ones first.
// codeRows({ levels: ['B2'], bays: ['C14'] }) -> { level: ['B2', 'C14'], bay: ['C14', 'B2'] }
export function codeRows({ levels, bays }) {
  return { level: [...levels, ...bays], bay: [...bays, ...levels] };
}

// A typed value read the way pillarCandidates reads the sign: 'c-14' is C14.
const sameCode = (text, code) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === code;
const blank = (text) => String(text ?? '').trim() === '';

// True when one tap can fill both fields: exactly two codes, and not two
// readings of the same characters ('M 12' gives M and M12, one of which is
// the whole sign), where the code left over would be wrong.
export function fillsOther(codes) {
  if (codes.length !== 2) return false;
  const [a, b] = codes;
  return !a.startsWith(b) && !b.startsWith(a);
}

// Park's level and bay ({ level, bay }, as typed) after the user taps code in
// the field's row ('level' or 'bay'), or clears it (code null). When
// fillsOther(codes), one tap does both: the other field gets the code left
// over when it is empty or held the code just taken, so tapping the other row
// swaps them. Any other typed value is kept. A code is never left in both
// fields.
export function pickCode(spot, field, code, codes) {
  const other = field === 'level' ? 'bay' : 'level';
  const next = { level: spot.level, bay: spot.bay, [field]: code ?? '' };
  if (code == null) return next;
  const otherTaken = sameCode(spot[other], code);
  if (fillsOther(codes) && (blank(spot[other]) || otherTaken)) next[other] = codes.find((c) => c !== code);
  else if (otherTaken) next[other] = '';
  return next;
}

const hasAny = ({ levels, bays }) => levels.length > 0 || bays.length > 0;

// Reading a whole sign (PLAN.md, "OCR for the pillar sign"). A photo of a
// pillar also catches car plates, ads and notices, so each line OCR found is
// weighed: lines that are clearly not the sign are dropped, big text beats
// small print, and a code next to a word such as LEVEL or ZONE comes first.
// A read is { text, lines: [{ text, box: { x, y, width, height } }] } from
// readText.js, boxes in the photo's pixels. Plain text (no boxes) is read
// line by line, every line the same size.

const PLATE = /^([A-Z]{1,3}) ?(\d{1,4}) ?([A-Z]?)$/;
// Digits joined only by spaces or hyphens: '03-2786 8888' is one run.
const DIGIT_RUN = /\d(?: ?\d)*/g;
const NOT_A_SIGN = /\b(?:WWW|HTTPS?|COM|TEL|HOTLINE|CALL|WHATSAPP|SALE|PROMO|DISCOUNT|OFF)\b|\bRM ?\d|@|%/;
const LEVEL_WORDS = /\b(?:LEVEL|LVL|ARAS|TINGKAT|FLOOR|FLR)\b/;
const BAY_WORDS = /\b(?:ZONE|ZON|BAY|LOT|PETAK|PILLAR|TIANG)\b/;
const SIGN_WORDS = new Set(['LEVEL', 'LVL', 'ARAS', 'TINGKAT', 'FLOOR', 'FLR', 'ZONE', 'ZON', 'BAY', 'LOT', 'PETAK', 'PILLAR', 'TIANG']);
// A Malaysian phone number has 9 or more digits in one run; a range of bays
// such as 1201-1250 has 8.
const PHONE_DIGITS = 9;
// A code in text smaller than this share of the biggest code is small print.
const SMALL_PRINT = 0.35;
// A line with more words than this reads like an ad or a notice.
const LONG_LINE = 5;

// Zone colour words in English and Malay, longest first so MERAH JAMBU (pink)
// is not read as MERAH (red). Names match ZONE_COLOURS (src/zone/zoneColour.js).
const COLOUR_WORDS = [
  ['MERAH JAMBU', 'Pink'],
  ['RED', 'Red'],
  ['MERAH', 'Red'],
  ['ORANGE', 'Orange'],
  ['OREN', 'Orange'],
  ['JINGGA', 'Orange'],
  ['YELLOW', 'Yellow'],
  ['KUNING', 'Yellow'],
  ['GREEN', 'Green'],
  ['HIJAU', 'Green'],
  ['BLUE', 'Blue'],
  ['BIRU', 'Blue'],
  ['PURPLE', 'Purple'],
  ['VIOLET', 'Purple'],
  ['UNGU', 'Purple'],
  ['PINK', 'Pink'],
  ['BROWN', 'Brown'],
  ['COKLAT', 'Brown'],
  ['GREY', 'Grey'],
  ['GRAY', 'Grey'],
  ['KELABU', 'Grey'],
  ['WHITE', 'White'],
  ['PUTIH', 'White'],
  ['BLACK', 'Black'],
  ['HITAM', 'Black'],
];
const COLOUR_WORD_SET = new Set(COLOUR_WORDS.flatMap(([words]) => words.split(' ')));

const wordsOf = (text) =>
  String(text ?? '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

// A Malaysian car plate: two or three letters then three or four digits
// (WXY 1234), or one letter with four digits or a letter after (W 1234 A).
// Letters that are a level (LG, GF) or a sign word (ZON, LOT) are the sign,
// and so is a level with a zone letter after (B1 C, P2 A) and a short number
// after two letters (a zone such as AA 12).
function isPlate(line) {
  const match = PLATE.exec(line);
  if (!match) return false;
  const [, letters, digits, suffix] = match;
  if (LEVEL.test(letters) || LEVEL.test(letters + digits) || SIGN_WORDS.has(letters)) return false;
  if (letters.length > 1) return digits.length >= 3;
  return digits.length === 4 || suffix !== '';
}

// True for a line that is clearly not the parking sign: a car plate, a phone
// number, a price, a web address or an ad word.
export function isNotSignLine(text) {
  const line = wordsOf(text).join(' ');
  if (isPlate(line)) return true;
  const runs = line.match(DIGIT_RUN) ?? [];
  if (runs.some((run) => run.replace(/ /g, '').length >= PHONE_DIGITS)) return true;
  return NOT_A_SIGN.test(String(text ?? '').toUpperCase());
}

function linesOf(read) {
  if (read == null) return [];
  if (typeof read === 'string') return read.split('\n').map((text) => ({ text, box: null }));
  if (read.lines?.length > 0) return read.lines;
  return linesOf(read.text ?? '');
}

const unique = (codes) => codes.filter((code, i) => codes.indexOf(code) === i);

// The colour a sign names, or null: a colour word beside ZONE (or a line of
// colour words alone under it) comes first, then one on a line with a code,
// then a line of colour words alone. A brand under the ZONE line ('RED BULL')
// is not a colour of its own line.
function colourOf(lines, signLine) {
  let best = null;
  lines.forEach((line, i) => {
    if (!signLine[i]) return;
    const words = wordsOf(line.text);
    const spaced = ` ${words.join(' ')} `;
    const match = COLOUR_WORDS.find(([word]) => spaced.includes(` ${word} `));
    if (!match) return;
    const colourOnly = words.every((word) => COLOUR_WORD_SET.has(word) || SIGN_WORDS.has(word));
    const zoneAbove = BAY_WORDS.test(String(lines[i - 1]?.text ?? '').toUpperCase());
    const { levels, bays } = pillarCandidates(line.text);
    let score = 0;
    if (BAY_WORDS.test(line.text.toUpperCase()) || (zoneAbove && colourOnly)) score = 3;
    else if (levels.length > 0 || bays.length > 0) score = 2;
    else if (colourOnly) score = 1;
    if (score > (best?.score ?? 0)) best = { score, name: match[1] };
  });
  return best?.name ?? null;
}

// readSign(read) -> { levels, bays, box, colour }: the codes on the sign, the
// likeliest first; the box of the likeliest code (where the sign is, for its
// colour), or null without boxes; and the zone colour the sign names, or null.
export function readSign(read) {
  const lines = linesOf(read);
  const signLine = lines.map((line) => !isNotSignLine(line.text));
  const found = [];
  let biggest = 0;
  lines.forEach((line, i) => {
    if (!signLine[i]) return;
    const { levels, bays } = pillarCandidates(line.text);
    if (levels.length === 0 && bays.length === 0) return;
    const size = line.box?.height > 0 ? line.box.height : 1;
    biggest = Math.max(biggest, size);
    // A word such as LEVEL may sit on the line above its code.
    const near = `${lines[i - 1]?.text ?? ''} ${line.text}`.toUpperCase();
    const long = wordsOf(line.text).length > LONG_LINE;
    const weigh = (code, words) => {
      let score = size;
      if (words.test(near)) score *= 2;
      if (long) score *= 0.5;
      if (/^\d{4}$/.test(code)) score *= 0.5; // a year or an ad's number, rarely a bay
      return score;
    };
    const box = line.box ?? null;
    for (const code of levels) found.push({ code, kind: 'level', size, score: weigh(code, LEVEL_WORDS), box });
    for (const code of bays) found.push({ code, kind: 'bay', size, score: weigh(code, BAY_WORDS), box });
  });
  // Sorting is stable, so codes that weigh the same keep the sign's order.
  const kept = found.filter((f) => f.size >= biggest * SMALL_PRINT).sort((a, b) => b.score - a.score);
  const codes = (kind) => unique(kept.filter((f) => f.kind === kind).map((f) => f.code));
  return { levels: codes('level'), bays: codes('bay'), box: kept[0]?.box ?? null, colour: colourOf(lines, signLine) };
}

// The suggestions Park shows: from the first photo whose sign gives any.
// reads holds each photo's read in order (readSign's input), null for a photo
// that was not read. Only the first photo is read, and the next only when the
// ones before gave nothing (PLAN.md, "Decisions made", Pillar photo).
export function suggestionsFromPhotos(reads) {
  for (const read of reads) {
    if (read == null) continue;
    const { levels, bays } = readSign(read);
    if (hasAny({ levels, bays })) return { levels, bays };
  }
  return { levels: [], bays: [] };
}

// Whether the next photo taken should be read.
export function shouldReadNextPhoto(reads) {
  return !hasAny(suggestionsFromPhotos(reads));
}

const sameCharacters = (a, b) => a.startsWith(b) || b.startsWith(a);

// Park's level and bay ({ level, bay }) with the likeliest codes filled into
// the fields still empty, so most photos need no tap. Left for the user to
// tap: two codes and no level ('G3 A2', either could be the bay), and a level
// and bay that are two readings of the same characters ('M 12' gives M and
// M12, as in fillsOther). A typed value is never replaced.
export function fillFromSign(spot, { levels, bays }) {
  const level = levels[0];
  if (level && bays[0] && sameCharacters(level, bays[0])) return { ...spot };
  const next = { ...spot };
  if (blank(spot.level) && level) next.level = level;
  const bay = bays.find((code) => code !== next.level);
  if (blank(spot.bay) && bay && (levels.length > 0 || bays.length === 1)) next.bay = bay;
  return next;
}

// The zone colour from the photos ([{ read, sampled }], sampled the colour
// read off the sign's paint, { name, hex } with name null when too plain to
// suggest, or null): a colour the sign names comes first, with that photo's
// sampled hex; else the first sampled colour with a name; else the first
// sampled hex alone ({ name: null, hex }), kept for improving the mapping.
// null when there is neither.
export function zoneFromPhotos(photos) {
  for (const { read, sampled } of photos) {
    const colour = read == null ? null : readSign(read).colour;
    if (colour) return { name: colour, hex: sampled?.hex ?? null };
  }
  const named = photos.find(({ sampled }) => sampled?.name);
  return (named ?? photos.find(({ sampled }) => sampled?.hex))?.sampled ?? null;
}
