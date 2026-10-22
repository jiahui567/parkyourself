import { feeSoFar } from './feeSoFar';
import { snapshotText } from './sessionFee';

// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-27 is a Tuesday.
const at = (localDateTime) => new Date(localDateTime).getTime();

// The weekday rate from PLAN.md's fee test table.
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

const parked = { started_at: at('2026-10-27T10:00'), rate_snapshot: snapshotText({ weekday: WEEKDAY }) };

describe('feeSoFar', () => {
  it('prices the stay from the start up to now', () => {
    expect(feeSoFar(parked, at('2026-10-27T12:10'), new Set()).feeSen).toBe(700);
  });

  it('counts a clock set back to before the start as no time parked instead of failing', () => {
    expect(feeSoFar(parked, parked.started_at - 20 * 1000, new Set()).feeSen).toBe(0);
  });
});
