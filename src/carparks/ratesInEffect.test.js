import { ratesInEffect } from './ratesInEffect';

const rate = (day_type, effective_from, first_sen) => ({
  day_type,
  effective_from,
  type: 'hourly',
  first_minutes: 60,
  first_sen,
  block_minutes: 60,
  block_sen: 100,
  grace_minutes: 0,
  daily_cap_sen: null,
});

describe('ratesInEffect', () => {
  it('uses the only rate when it has no date', () => {
    const result = ratesInEffect([rate('weekday', null, 300)], '2026-10-24');

    expect(result.weekday.first_sen).toBe(300);
    expect(result.weekend).toBeNull();
    expect(result.effective_from).toBeNull();
  });

  it('uses the latest rate that has started', () => {
    const rows = [rate('weekday', null, 300), rate('weekday', '2024-01-01', 400), rate('weekend', '2024-01-01', 500)];

    const result = ratesInEffect(rows, '2026-10-24');

    expect(result.weekday.first_sen).toBe(400);
    expect(result.weekend.first_sen).toBe(500);
    expect(result.effective_from).toBe('2024-01-01');
  });

  it('keeps the current rate until a future change starts', () => {
    const rows = [rate('weekday', '2024-01-01', 400), rate('weekday', '2027-01-01', 500)];

    expect(ratesInEffect(rows, '2026-12-31').weekday.first_sen).toBe(400);
    expect(ratesInEffect(rows, '2027-01-01').weekday.first_sen).toBe(500);
  });

  it('has no rate for a day type whose only rate starts later', () => {
    expect(ratesInEffect([rate('weekday', '2027-01-01', 500)], '2026-10-24').weekday).toBeNull();
  });

  it('needs the day', () => {
    expect(() => ratesInEffect([rate('weekday', '2027-01-01', 500)], undefined)).toThrow('Not a day');
  });

  it('gives the latest start among the rates chosen', () => {
    const rows = [rate('weekday', '2024-01-01', 400), rate('weekend', '2025-06-01', 500)];

    expect(ratesInEffect(rows, '2026-10-24').effective_from).toBe('2025-06-01');
  });
});
