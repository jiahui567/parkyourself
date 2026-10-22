import { formatRM } from '../lib/money';
import { formatDate, formatMinutes, formatTime, localDateKey } from '../lib/time';
import { amountSen } from '../spending/summary';
import { dayTypeLabel } from './rateText';
import { feeText } from './sessionText';

// Text for Find, the "Found my car" summary and the Home spot card.

// 'Fee so far RM 3.00', 'Fee so far RM 34.00 (estimate)', or null with no fee.
export function feeSoFarText(fee) {
  const amount = feeText(fee);
  return amount ? `Fee so far ${amount}` : null;
}

// The Extend pill on Find: 'Extend timer by 30 min', or 'Start a 30 min timer'
// when the car has no timer yet (Extend then starts one, PLAN.md "User flow").
export function extendTimerText(timerEndsAt, minutes) {
  return timerEndsAt == null ? `Start a ${formatMinutes(minutes)} timer` : `Extend timer by ${formatMinutes(minutes)}`;
}

// 'Tue, 27 Oct 2026, 10:00 AM to 12:10 PM', with the end date too when the
// stay ran past midnight: 'Fri, 23 Oct 2026, 8:00 PM to Sat, 24 Oct 2026, 10:00 AM'.
export function stayTimesText(startMs, endMs) {
  const start = `${formatDate(startMs)}, ${formatTime(startMs)}`;
  const end =
    localDateKey(startMs) === localDateKey(endMs) ? formatTime(endMs) : `${formatDate(endMs)}, ${formatTime(endMs)}`;
  return `${start} to ${end}`;
}

// What an ended session cost, for Find opened from History:
// { paid: 'Paid RM 5.00', calculated: 'Calculated RM 7.00' } when the amount
// paid differs from the calculated fee, calculated null when it does not or
// there was no fee, and null when there is neither a fee nor an amount.
export function endedFeeText(session) {
  const { fee_sen, paid_sen } = session;
  if (fee_sen == null && paid_sen == null) return null;
  const differs = fee_sen != null && paid_sen != null && paid_sen !== fee_sen;
  return {
    // The same amount Spending adds up.
    paid: `Paid ${formatRM(amountSen(session))}`,
    calculated: differs ? `Calculated ${formatRM(fee_sen)}` : null,
  };
}

// 'Weekend rate for Pavilion Bukit Jalil', the title of a missing-rate form.
export function missingRateTitle(dayType, placeName) {
  return `${dayTypeLabel(dayType)} rate for ${placeName}`;
}

// The line under that title: whether the rate is saved to the place
// (savesMissingRate), and that it is optional. estimated: without this rate
// the fee shown is an estimate; with no rate to borrow there is none to keep.
export function missingRateHint(placeName, saved, estimated) {
  const where = saved ? `It is saved to ${placeName} for next time.` : 'Used for this stay only.';
  return `${where} ${estimated ? 'Leave it empty to keep the estimate.' : "Leave it empty if you don't know it."}`;
}
