import { carParkCheckedText, carParkRateRows, noPlaceMatchesText } from './carParkText';

const hourly = (first_sen) => ({
  type: 'hourly',
  first_minutes: 60,
  first_sen,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 0,
  daily_cap_sen: null,
});
const flat = (flat_sen) => ({ type: 'flat', flat_sen, grace_minutes: 0, daily_cap_sen: null });

describe('carParkRateRows', () => {
  it('shows each day type with its rate', () => {
    expect(carParkRateRows({ weekday: hourly(300), weekend: hourly(400), holiday: flat(800) })).toEqual([
      { dayType: 'weekday', label: 'Weekday', value: 'RM 3.00 first hour, then RM 2.00 per hour' },
      { dayType: 'weekend', label: 'Weekend', value: 'RM 4.00 first hour, then RM 2.00 per hour' },
      { dayType: 'holiday', label: 'Public holiday', value: 'RM 8.00 per entry' },
    ]);
  });

  it('says a public holiday uses the weekend rate when it has no amount of its own', () => {
    expect(carParkRateRows({ weekday: hourly(300), weekend: hourly(400), holiday: null })[2].value).toBe('Weekend rate');
  });

  it('says when the list has no rate for a day type', () => {
    expect(carParkRateRows({ weekday: hourly(300), weekend: null, holiday: null }).map((row) => row.value)).toEqual([
      'RM 3.00 first hour, then RM 2.00 per hour',
      'Not on the list',
      'Not on the list',
    ]);
    expect(carParkRateRows(undefined).every((row) => row.value === 'Not on the list')).toBe(true);
  });
});

describe('carParkCheckedText', () => {
  it('says when the rates were checked', () => {
    expect(carParkCheckedText({ checked_on: '2026-10-24', effective_from: null })).toBe(
      'Checked Sat, 24 Oct 2026. Check the sign at the car park.'
    );
  });

  it('adds when they took effect, when the list knows', () => {
    expect(carParkCheckedText({ checked_on: '2026-10-24', effective_from: '2024-01-01' })).toBe(
      'Checked Sat, 24 Oct 2026, in effect since Mon, 1 Jan 2024. Check the sign at the car park.'
    );
  });
});

describe('noPlaceMatchesText', () => {
  it('repeats the search without its spaces', () => {
    expect(noPlaceMatchesText('  pavilion ')).toBe('Nothing matches "pavilion".');
  });
});
