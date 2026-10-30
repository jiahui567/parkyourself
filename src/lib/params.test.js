import { oneParam } from './params';

describe('oneParam', () => {
  it('keeps a single value', () => {
    expect(oneParam('2026-10')).toBe('2026-10');
    expect(oneParam('')).toBe('');
  });

  it.each([[['1', '2']], [undefined], [null]])('drops %p', (value) => {
    expect(oneParam(value)).toBeUndefined();
  });
});
