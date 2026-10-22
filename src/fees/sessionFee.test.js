import { ratesFromSnapshot, sessionFee, snapshotText } from './sessionFee';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a
// Friday, 2026-10-27 a Tuesday.
const at = (localDateTime) => new Date(localDateTime).getTime();

// The rates from PLAN.md's fee test table.
const WEEKDAY = {
  type: 'hourly',
  first_minutes: 60,
  first_sen: 300,
  block_minutes: 60,
  block_sen: 200,
  grace_minutes: 15,
  daily_cap_sen: 2000,
  flat_sen: null,
};
const WEEKEND = { ...WEEKDAY, first_sen: 400, block_sen: 300, grace_minutes: 0, daily_cap_sen: 2500 };

const parkedAt = (started_at, rates) => ({ started_at, rate_snapshot: snapshotText(rates) });

describe('snapshotText', () => {
  it('keeps only the fee fields of the day types that have a rate', () => {
    const saved = { ...WEEKDAY, id: 'rate-1', place_id: 'place-1', day_type: 'weekday', updated_at: 5 };

    expect(JSON.parse(snapshotText({ weekday: saved, weekend: null }))).toEqual({ weekday: WEEKDAY });
  });

  it('is null when there is no rate', () => {
    expect(snapshotText({ weekday: null })).toBeNull();
  });
});

describe('ratesFromSnapshot', () => {
  it('is null for a session with no snapshot', () => {
    expect(ratesFromSnapshot(null)).toBeNull();
  });
});

describe('sessionFee', () => {
  it('prices the stay with the rates in the snapshot', () => {
    const session = parkedAt(at('2026-10-27T10:00'), { weekday: WEEKDAY });

    expect(sessionFee(session, at('2026-10-27T12:10'), new Set()).feeSen).toBe(700);
  });

  it('is null for a session with no rates', () => {
    expect(sessionFee(parkedAt(at('2026-10-27T10:00'), null), at('2026-10-27T12:10'), new Set())).toBeNull();
  });

  it('prices a session that had no rates from a rate typed at the end', () => {
    const session = parkedAt(at('2026-10-27T10:00'), null);

    const fee = sessionFee(session, at('2026-10-27T12:10'), new Set(), { weekday: WEEKDAY });

    expect(fee).toMatchObject({ feeSen: 700, isEstimate: false });
  });

  it('uses a missing rate typed at the end instead of borrowing the other one', () => {
    const session = parkedAt(at('2026-10-23T20:00'), { weekday: WEEKDAY });

    const fee = sessionFee(session, at('2026-10-24T10:00'), new Set(), { weekend: WEEKEND });

    expect(fee).toMatchObject({ feeSen: 3400, missingRates: [] });
  });
});
