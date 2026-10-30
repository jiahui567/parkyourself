import {
  codeRows,
  fillFromSign,
  fillsOther,
  isNotSignLine,
  pickCode,
  pillarCandidates,
  readSign,
  shouldReadNextPhoto,
  suggestionsFromPhotos,
  zoneFromPhotos,
} from './pillarText';

// An OCR line as readText.js gives it: text and its box, height h px.
const line = (text, h, y = 0) => ({ text, box: { x: 100, y, width: h * text.length * 0.6, height: h } });
const photo = (...lines) => ({ text: lines.map((l) => l.text).join('\n'), lines });

describe('pillarCandidates', () => {
  it.each([
    ['LEVEL B2\nZONE C-14', ['B2'], ['C14']],
    ['B2 C14', ['B2'], ['C14']],
    ['b2 c14', ['B2'], ['C14']],
    ['B 2  C 14', ['B2'], ['C14']],
    ['P3 - 25', ['P3'], ['25']],
    ['LG / A 07', ['LG'], ['A07']],
    ['L12 BAY 108', ['L12'], ['108']],
    ['UG ZONE D', ['UG'], []],
    ['LL 5', ['LL'], ['5']],
    ['B1 B2', ['B1', 'B2'], []],
    ['B2 B2 C14 C14', ['B2'], ['C14']],
  ])('%p -> levels %p, bays %p', (text, levels, bays) => {
    expect(pillarCandidates(text)).toEqual({ levels, bays });
  });

  it('offers both readings when a level letter is followed by a number', () => {
    expect(pillarCandidates('M 12')).toEqual({ levels: ['M'], bays: ['M12'] });
  });

  it('treats L21 as a bay, because levels stop at L20', () => {
    expect(pillarCandidates('L21')).toEqual({ levels: [], bays: ['L21'] });
  });

  it.each(['', 'EXIT', null, undefined])('finds nothing in %p', (text) => {
    expect(pillarCandidates(text)).toEqual({ levels: [], bays: [] });
  });
});

describe('suggestionsFromPhotos', () => {
  it('takes the suggestions from the first photo', () => {
    expect(suggestionsFromPhotos(['B2 C14', null])).toEqual({ levels: ['B2'], bays: ['C14'] });
  });

  it('moves on to the next photo when the first gave nothing', () => {
    expect(suggestionsFromPhotos(['EXIT', 'LEVEL B3 ZONE D-20'])).toEqual({ levels: ['B3'], bays: ['D20'] });
  });

  it('does not mix suggestions from two photos', () => {
    expect(suggestionsFromPhotos(['B2', 'C14'])).toEqual({ levels: ['B2'], bays: [] });
  });

  it('skips photos that were not read', () => {
    expect(suggestionsFromPhotos([null, 'B2 C14'])).toEqual({ levels: ['B2'], bays: ['C14'] });
  });

  it('has nothing to suggest without photos', () => {
    expect(suggestionsFromPhotos([])).toEqual({ levels: [], bays: [] });
  });
});

describe('shouldReadNextPhoto', () => {
  it('reads the first photo', () => {
    expect(shouldReadNextPhoto([])).toBe(true);
  });

  it('reads another photo only while the ones before gave nothing', () => {
    expect(shouldReadNextPhoto(['EXIT'])).toBe(true);
    expect(shouldReadNextPhoto(['B2 C14'])).toBe(false);
  });

  it('reads the next photo when OCR failed on the one before', () => {
    expect(shouldReadNextPhoto([null])).toBe(true);
  });
});

describe('codeRows', () => {
  it('offers every code in both rows, the likelier ones first', () => {
    expect(codeRows(pillarCandidates('B2 C14'))).toEqual({ level: ['B2', 'C14'], bay: ['C14', 'B2'] });
  });

  it('offers a sign whose codes all look like bays for the level too', () => {
    expect(codeRows(pillarCandidates('G3 A2'))).toEqual({ level: ['G3', 'A2'], bay: ['G3', 'A2'] });
  });
});

describe('pickCode', () => {
  const EMPTY = { level: '', bay: '' };
  const TWO = ['G3', 'A2'];

  it('fills the other field with the code left over, either way round', () => {
    expect(pickCode(EMPTY, 'bay', 'G3', TWO)).toEqual({ level: 'A2', bay: 'G3' });
    expect(pickCode(EMPTY, 'level', 'G3', TWO)).toEqual({ level: 'G3', bay: 'A2' });
  });

  it('swaps the two when the other row is tapped', () => {
    expect(pickCode({ level: 'A2', bay: 'G3' }, 'level', 'G3', TWO)).toEqual({ level: 'G3', bay: 'A2' });
  });

  it('keeps a value the user typed in the other field', () => {
    expect(pickCode({ level: 'B1', bay: '' }, 'bay', 'G3', TWO)).toEqual({ level: 'B1', bay: 'G3' });
  });

  it('fills only the field tapped when more than one code is left', () => {
    expect(pickCode(EMPTY, 'bay', 'G3', ['G3', 'A2', '12'])).toEqual({ level: '', bay: 'G3' });
  });

  it('never leaves a code in both fields', () => {
    expect(pickCode({ level: 'G3', bay: '' }, 'bay', 'G3', ['G3', 'A2', '12'])).toEqual({ level: '', bay: 'G3' });
    expect(pickCode({ level: ' g3 ', bay: '' }, 'bay', 'G3', TWO)).toEqual({ level: 'A2', bay: 'G3' });
  });

  it('clears only the field whose chip was tapped again', () => {
    expect(pickCode({ level: 'A2', bay: 'G3' }, 'bay', null, TWO)).toEqual({ level: 'A2', bay: '' });
  });

  it('fills nothing else when only one code was read', () => {
    expect(pickCode(EMPTY, 'level', 'B2', ['B2'])).toEqual({ level: 'B2', bay: '' });
  });

  it.each(['M 12', 'G-3'])('fills nothing else for %p, two readings of the same characters', (sign) => {
    const codes = codeRows(pillarCandidates(sign)).level;

    expect(codes).toHaveLength(2);
    expect(pickCode(EMPTY, 'bay', codes[1], codes)).toEqual({ level: '', bay: codes[1] });
  });

  it('reads a typed value as the sign is read, so a code is not left in both fields', () => {
    expect(pickCode({ level: 'c-14', bay: '' }, 'bay', 'C14', ['B2', 'C14', '7'])).toEqual({ level: '', bay: 'C14' });
  });
});

describe('fillsOther', () => {
  it.each([
    { codes: ['G3', 'A2'], fills: true },
    { codes: ['B2', 'C14'], fills: true },
    { codes: ['M', 'M12'], fills: false },
    { codes: ['G3', 'G'], fills: false },
    { codes: ['B2'], fills: false },
    { codes: ['B2', 'C14', '7'], fills: false },
  ])('is $fills for $codes', ({ codes, fills }) => {
    expect(fillsOther(codes)).toBe(fills);
  });
});

describe('isNotSignLine', () => {
  it.each([
    { rule: 'a car plate', text: 'WXY 1234', not: true },
    { rule: 'a car plate with a letter after', text: 'VBA 123 A', not: true },
    { rule: 'an old one-letter plate', text: 'W 1234 A', not: true },
    { rule: 'an old one-letter plate without spaces', text: 'W1234', not: true },
    { rule: 'a mobile number', text: '012-345 6789', not: true },
    { rule: 'a range of bays', text: 'B2 C101-C120', not: false },
    { rule: 'a range of numbered bays', text: 'LOT 1201-1250', not: false },
    { rule: 'the ground floor', text: 'GF 12', not: false },
    { rule: 'a double-letter zone', text: 'AA 12', not: false },
    { rule: 'a phone number', text: 'Call 03-2786 8888', not: true },
    { rule: 'a hotline without a word', text: '1300 88 1234', not: true },
    { rule: 'a price', text: 'Only RM5 per entry', not: true },
    { rule: 'a web address', text: 'www.pavilion-kl.com', not: true },
    { rule: 'an ad', text: '50% OFF ALL ITEMS', not: true },
    { rule: 'a level and bay', text: 'B2 C14', not: false },
    { rule: 'a level word and code', text: 'LEVEL B2', not: false },
    { rule: 'a level that looks like plate letters', text: 'LG 12', not: false },
    { rule: 'a level with a zone letter', text: 'B1 C', not: false },
    { rule: 'a level with a zone letter, no space', text: 'P2A', not: false },
    { rule: 'an upper level with a zone letter', text: 'L3 B', not: false },
    { rule: 'a Malay zone word and number', text: 'ZON 3', not: false },
    { rule: 'a bay code', text: 'C 14', not: false },
  ])('$rule: $text', ({ text, not }) => {
    expect(isNotSignLine(text)).toBe(not);
  });
});

describe('readSign', () => {
  it('reads the big sign and drops the car plate and the ad beside it', () => {
    const sign = readSign(photo(line('B2', 120, 100), line('C14', 90, 240), line('WXY 1234', 40, 600), line('CALL 03-2786 8888', 20, 700)));

    expect(sign.levels).toEqual(['B2']);
    expect(sign.bays).toEqual(['C14']);
    expect(sign.box).toEqual(line('B2', 120, 100).box);
  });

  it('leaves out small print far smaller than the sign', () => {
    const sign = readSign(photo(line('C14', 100), line('Lot 7 reserved', 20)));

    expect(sign.bays).toEqual(['C14']);
  });

  it('puts bigger codes first', () => {
    expect(readSign(photo(line('A3', 50), line('D20', 110))).bays).toEqual(['D20', 'A3']);
  });

  it('puts a code beside a level word first, also from the line above', () => {
    expect(readSign(photo(line('G', 80), line('ARAS', 60), line('B1', 80))).levels).toEqual(['B1', 'G']);
  });

  it('weighs a long line of notice text down', () => {
    const sign = readSign(photo(line('Do not leave valuables in car 24 hours', 60), line('17', 60)));

    expect(sign.bays).toEqual(['17', '24']);
  });

  it('reads plain text line by line when there are no boxes', () => {
    expect(readSign('LEVEL B3\nZONE D-20\nWXY 1234')).toMatchObject({ levels: ['B3'], bays: ['D20'], box: null });
  });

  it('finds nothing in an empty read', () => {
    expect(readSign({ text: '', lines: [] })).toEqual({ levels: [], bays: [], box: null, colour: null });
  });

  describe('colour', () => {
    it.each([
      { rule: 'an English colour beside ZONE', text: 'B2\nBLUE ZONE C14', colour: 'Blue' },
      { rule: 'a Malay colour beside ZON', text: 'ZON BIRU\nB2', colour: 'Blue' },
      { rule: 'a colour under ZONE', text: 'ZONE\nHIJAU', colour: 'Green' },
      { rule: 'pink in Malay, not red', text: 'ZON MERAH JAMBU', colour: 'Pink' },
      { rule: 'a colour on a line with a code', text: 'YELLOW B2', colour: 'Yellow' },
      { rule: 'a colour on a line of its own', text: 'B2 C14\nORANGE', colour: 'Orange' },
      { rule: 'grey spelled the American way', text: 'GRAY ZONE', colour: 'Grey' },
      { rule: 'no colour word', text: 'B2 C14', colour: null },
      { rule: 'a colour in a brand name', text: 'B2\nRED BULL ENERGY', colour: null },
      { rule: 'a colour in an ad', text: 'B2\nRED SALE 50% OFF', colour: null },
      { rule: 'a brand under the ZONE line', text: 'ZONE C\nRED BULL', colour: null },
    ])('$rule', ({ text, colour }) => {
      expect(readSign(text).colour).toBe(colour);
    });

    it('prefers a colour beside ZONE over one alone', () => {
      expect(readSign('RED\nZONE GREEN').colour).toBe('Green');
    });
  });
});

describe('suggestionsFromPhotos with reads', () => {
  it('ranks the codes of a read with boxes', () => {
    expect(suggestionsFromPhotos([photo(line('A3', 50), line('L2', 40), line('D20', 110))])).toEqual({
      levels: ['L2'],
      bays: ['D20', 'A3'],
    });
  });
});

describe('fillFromSign', () => {
  const empty = { level: '', bay: '' };

  it('fills the empty fields with the likeliest level and bay', () => {
    expect(fillFromSign(empty, { levels: ['B2'], bays: ['C14', 'A3'] })).toEqual({ level: 'B2', bay: 'C14' });
  });

  it('never replaces what was typed', () => {
    expect(fillFromSign({ level: 'B3', bay: ' ' }, { levels: ['B2'], bays: ['C14'] })).toEqual({ level: 'B3', bay: 'C14' });
  });

  it('fills a single code as the bay', () => {
    expect(fillFromSign(empty, { levels: [], bays: ['C14'] })).toEqual({ level: '', bay: 'C14' });
  });

  it('leaves two codes without a level for the user to tap', () => {
    expect(fillFromSign(empty, { levels: [], bays: ['G3', 'A2'] })).toEqual(empty);
  });

  it('leaves two readings of the same characters for the user to tap', () => {
    expect(fillFromSign(empty, pillarCandidates('M 12'))).toEqual(empty);
  });

  it('keeps the other fields', () => {
    expect(fillFromSign({ ...empty, note: 'Near lift' }, { levels: ['B2'], bays: [] })).toEqual({
      level: 'B2',
      bay: '',
      note: 'Near lift',
    });
  });
});

describe('zoneFromPhotos', () => {
  const sampledBlue = { name: 'Blue', hex: '#1E5BD8' };

  it('takes the colour the sign names, with its sampled hex', () => {
    expect(zoneFromPhotos([{ read: 'ZONE GREEN', sampled: sampledBlue }])).toEqual({ name: 'Green', hex: '#1E5BD8' });
  });

  it('takes the sampled colour when the sign names none', () => {
    expect(zoneFromPhotos([{ read: 'B2 C14', sampled: sampledBlue }])).toEqual(sampledBlue);
  });

  it('keeps the hex of a sampled colour too plain to name, without a name', () => {
    expect(zoneFromPhotos([{ read: 'B2', sampled: { name: null, hex: '#808080' } }])).toEqual({
      name: null,
      hex: '#808080',
    });
  });

  it('prefers a named sampled colour over a plain one', () => {
    const plain = { read: 'B2', sampled: { name: null, hex: '#808080' } };

    expect(zoneFromPhotos([plain, { read: null, sampled: sampledBlue }])).toEqual(sampledBlue);
  });

  it('looks through every photo', () => {
    expect(zoneFromPhotos([{ read: null, sampled: null }, { read: 'ZON KUNING', sampled: null }])).toEqual({
      name: 'Yellow',
      hex: null,
    });
  });

  it('has nothing to suggest without photos', () => {
    expect(zoneFromPhotos([])).toBeNull();
  });
});
