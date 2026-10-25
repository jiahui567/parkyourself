import { DAY_TYPES, holidayRateFromText, rateFromForm } from '../fees';
import { formatDate, parseServerTime } from '../lib/time';
import { dayTypeLabel, rateSummary } from './rateText';

// Text for rate reports (PLAN.md, C10): the report screen, the unverified
// line under a listed car park's rate, and the user's own reports.

// The hint on one of the report screen's folded rate rows: the rate as typed.
// value is a RateForm's value, or for 'holiday' the typed amount.
export function reportRateRowHint(dayType, value) {
  const { rate, error } = dayType === 'holiday' ? holidayRateFromText(value) : rateFromForm(value);
  if (error) return 'Not finished · tap to check it';
  return rate ? rateSummary(rate) : 'Not set · optional';
}

// 'weekday RM 3.00 first hour, then RM 2.00 per hour; public holiday RM 5.00 per entry'.
export function reportRatesText(rates) {
  return DAY_TYPES.filter((dayType) => rates?.[dayType])
    .map((dayType) => `${dayTypeLabel(dayType).toLowerCase()} ${rateSummary(rates[dayType])}`)
    .join('; ');
}

// On the report screen of a listed car park, to compare with what the user
// sends: 'On the list now: weekday RM 3.00 first hour, then RM 2.00 per hour.'
export function listedRatesText(rates) {
  const text = reportRatesText(rates);
  return text ? `On the list now: ${text}.` : 'The list has no rates for it yet.';
}

// Under a listed car park's rate while other users' reports wait for review
// (reports newest first, as carParks.get gives them), or null when none wait.
// Only the newest is spelled out; the count says the rate is in question.
export function pendingReportsText(reports) {
  if (!reports?.length) return null;
  const [newest, ...others] = reports;
  const more =
    others.length === 0 ? '' : ` ${others.length} more ${others.length === 1 ? 'report waits' : 'reports wait'} too.`;
  return (
    `Not verified yet: on ${formatDate(newest.reported_at)} a user reported ` +
    `${reportRatesText(newest.rates)}.${more}`
  );
}

const STATUS_TEXT = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Not approved' };

export function reportStatusText(status) {
  return STATUS_TEXT[status] ?? status;
}

// The report screen's title and the lines above its form. isListed: the
// place has the name of a car park on the list.
export function reportScreenText({ name, isListed, hasLocation }) {
  if (isListed) {
    return {
      title: 'Report a rate change',
      intro: `Send the rates ${name} charges now. The car park list changes only after the developer checks your report.`,
      privacy:
        "Sends the rates, your note and the photo to Park Yourself's server. Only the developer sees your note and " +
        'photo; other users see the rates, marked not verified, until the report is checked.',
    };
  }
  return {
    title: 'Suggest a car park',
    intro: `${name} is not on the car park list. Send its rates, and the developer may add it.`,
    privacy:
      `Sends the name${hasLocation ? ', its location' : ''}, the rates, your note and the photo to Park ` +
      "Yourself's server. Only the developer sees them until the car park is added.",
  };
}

// One of the user's reports on Account, the car park first:
// { name: 'Sunway Pyramid', detail: 'Fri, 23 Oct 2026 · Waiting for review' }.
export function myReportText({ name, created_at, status }) {
  return { name, detail: `${formatDate(parseServerTime(created_at))} · ${reportStatusText(status)}` };
}

// The message after Send report. photoError: why the photo did not arrive
// (sendReport), or null; the report itself was sent either way.
export function reportSentText(photoError) {
  const next = 'The developer checks it before the car park list changes. See its status in Settings, Account.';
  return {
    title: 'Report sent',
    message: photoError
      ? `Your report was sent, but not its photo: ${photoError.message} ${next}`
      : `Thanks. ${next}`,
  };
}
