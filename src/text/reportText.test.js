import { EMPTY_RATE_FORM, formFromRate } from '../fees';
import {
  listedRatesText,
  myReportText,
  pendingReportsText,
  reportRateRowHint,
  reportRatesText,
  reportScreenText,
  reportSentText,
  reportStatusText,
} from './reportText';

const HOURLY = { type: 'hourly', first_minutes: 60, first_sen: 300, block_minutes: 60, block_sen: 200, grace_minutes: 0, daily_cap_sen: null };
const FLAT = { type: 'flat', flat_sen: 500, grace_minutes: 0, daily_cap_sen: null };
// Local phone time (jest.config.js pins Asia/Kuala_Lumpur). 2026-10-23 is a Friday.
const at = (localDateTime) => new Date(localDateTime).getTime();

describe('reportRateRowHint', () => {
  it.each([
    { what: 'a typed rate', dayType: 'weekday', value: formFromRate(HOURLY), hint: 'RM 3.00 first hour, then RM 2.00 per hour' },
    { what: 'an empty form', dayType: 'weekend', value: EMPTY_RATE_FORM, hint: 'Not set · optional' },
    { what: 'a form not finished', dayType: 'weekday', value: { ...EMPTY_RATE_FORM, firstPrice: '3', blockPrice: 'x' }, hint: 'Not finished · tap to check it' },
    { what: 'a holiday amount', dayType: 'holiday', value: '5', hint: 'RM 5.00 per entry' },
    { what: 'no holiday amount', dayType: 'holiday', value: '', hint: 'Not set · optional' },
    { what: 'a holiday amount not finished', dayType: 'holiday', value: 'abc', hint: 'Not finished · tap to check it' },
  ])('shows $what', ({ dayType, value, hint }) => {
    expect(reportRateRowHint(dayType, value)).toBe(hint);
  });
});

describe('reportRatesText', () => {
  it('names each day type that has a rate, in the usual order', () => {
    expect(reportRatesText({ holiday: FLAT, weekday: HOURLY, weekend: null })).toBe(
      'weekday RM 3.00 first hour, then RM 2.00 per hour; public holiday RM 5.00 per entry'
    );
  });
});

describe('listedRatesText', () => {
  it('gives the rates the list has now', () => {
    expect(listedRatesText({ weekday: HOURLY, weekend: null, holiday: null })).toBe(
      'On the list now: weekday RM 3.00 first hour, then RM 2.00 per hour.'
    );
  });

  it('says when the list has none', () => {
    expect(listedRatesText({ weekday: null, weekend: null, holiday: null })).toBe('The list has no rates for it yet.');
  });
});

describe('pendingReportsText', () => {
  const report = (reported_at, rates) => ({ id: String(reported_at), reported_at, rates });

  it('is null when no report waits', () => {
    expect(pendingReportsText([])).toBeNull();
    expect(pendingReportsText(undefined)).toBeNull();
  });

  it('spells out the newest report', () => {
    expect(pendingReportsText([report(at('2026-10-23T10:00'), { weekend: FLAT })])).toBe(
      'Not verified yet: on Fri, 23 Oct 2026 a user reported weekend RM 5.00 per entry.'
    );
  });

  it.each([
    { others: 1, tail: ' 1 more report waits too.' },
    { others: 2, tail: ' 2 more reports wait too.' },
  ])('counts $others other reports', ({ others, tail }) => {
    const older = Array.from({ length: others }, (_, i) => report(at('2026-10-20T10:00') - i, { weekday: HOURLY }));

    expect(pendingReportsText([report(at('2026-10-23T10:00'), { weekend: FLAT }), ...older])).toBe(
      `Not verified yet: on Fri, 23 Oct 2026 a user reported weekend RM 5.00 per entry.${tail}`
    );
  });
});

describe('reportStatusText', () => {
  it.each([
    ['pending', 'Waiting for review'],
    ['approved', 'Approved'],
    ['rejected', 'Not approved'],
  ])('%s reads %s', (status, text) => {
    expect(reportStatusText(status)).toBe(text);
  });
});

describe('reportScreenText', () => {
  it('reports a rate change for a listed car park', () => {
    const text = reportScreenText({ name: 'Sunway Pyramid', isListed: true, hasLocation: true });

    expect(text.title).toBe('Report a rate change');
    expect(text.intro).toMatch(/^Send the rates Sunway Pyramid charges now\./);
    expect(text.privacy).toMatch(/other users see the rates, marked not verified/);
  });

  it.each([
    { hasLocation: true, sends: 'Sends the name, its location, the rates' },
    { hasLocation: false, sends: 'Sends the name, the rates' },
  ])('suggests a new car park, location sent: $hasLocation', ({ hasLocation, sends }) => {
    const text = reportScreenText({ name: 'Kedai Parking', isListed: false, hasLocation });

    expect(text.title).toBe('Suggest a car park');
    expect(text.intro).toBe('Kedai Parking is not on the car park list. Send its rates, and the developer may add it.');
    expect(text.privacy.startsWith(sends)).toBe(true);
  });
});

describe('reportSentText', () => {
  it('thanks the user', () => {
    expect(reportSentText(null)).toEqual({
      title: 'Report sent',
      message: 'Thanks. The developer checks it before the car park list changes. See its status in Settings, Account.',
    });
  });

  it('says when the photo did not arrive', () => {
    expect(reportSentText(new Error('Could not reach the server.')).message).toMatch(
      /^Your report was sent, but not its photo: Could not reach the server\. The developer checks it/
    );
  });
});

describe('myReportText', () => {
  it('gives the car park, the day it was sent and its status', () => {
    expect(myReportText({ name: 'Sunway Pyramid', created_at: '2026-10-23T02:00:00.123456+00:00', status: 'pending' })).toEqual({
      name: 'Sunway Pyramid',
      detail: 'Fri, 23 Oct 2026 · Waiting for review',
    });
  });
});
