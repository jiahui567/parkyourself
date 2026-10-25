import { readCode, readEmail } from './signIn';

describe('readEmail', () => {
  it('trims and lower-cases an email', () => {
    expect(readEmail('  Ali@Example.COM ')).toBe('ali@example.com');
  });

  it.each(['', 'ali', 'ali@', 'ali@example', 'a li@example.com', null])('is null for %p', (text) => {
    expect(readEmail(text)).toBeNull();
  });
});

describe('readCode', () => {
  it.each([
    ['123456', '123456'],
    [' 123 456 ', '123456'],
    ['12345678', '12345678'],
  ])('reads %p as %p', (text, code) => {
    expect(readCode(text)).toBe(code);
  });

  it.each(['12345', '12345678901', '12a456', '', undefined])('is null for %p', (text) => {
    expect(readCode(text)).toBeNull();
  });
});
