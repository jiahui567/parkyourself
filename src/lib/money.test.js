import { formatAmountInput, formatRM, parseRM } from './money';

describe('formatAmountInput', () => {
  it.each([
    [300, '3.00'],
    [5, '0.05'],
    [123450, '1234.50'],
    [null, ''],
  ])('%p sen -> %p, which parseRM reads back', (sen, text) => {
    expect(formatAmountInput(sen)).toBe(text);
    if (sen != null) expect(parseRM(text)).toBe(sen);
  });
});

describe('formatRM', () => {
  it.each([
    [0, 'RM 0.00'],
    [5, 'RM 0.05'],
    [300, 'RM 3.00'],
    [3450, 'RM 34.50'],
    [123450, 'RM 1,234.50'],
    [100000000, 'RM 1,000,000.00'],
    [-350, '-RM 3.50'],
  ])('%i sen -> %s', (sen, text) => {
    expect(formatRM(sen)).toBe(text);
  });

  it('rejects amounts that are not whole sen', () => {
    expect(() => formatRM(3.5)).toThrow('whole sen');
  });
});

describe('parseRM', () => {
  it.each([
    ['3', 300],
    ['3.5', 350],
    ['3.50', 350],
    ['3.', 300],
    ['.5', 50],
    ['0.10', 10],
    ['RM 3.00', 300],
    ['rm3', 300],
    [' 1,234.50 ', 123450],
  ])('%p -> %i sen', (text, sen) => {
    expect(parseRM(text)).toBe(sen);
  });

  it.each(['', '.', 'abc', '-3', '3.505', '3,50.1.2', null, undefined])('%p -> null', (text) => {
    expect(parseRM(text)).toBeNull();
  });
});
