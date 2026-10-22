import { sessionFee } from './sessionFee';

// The fee of a parked car at nowMs, for Home and Find. The screens refresh
// their clock on focus, but the phone's clock can still be set back to before
// started_at (by hand, or by a network time fix). That counts as no time
// parked instead of failing, during render, as a stay that ends before it
// starts. null when the session has no rates.
export function feeSoFar(session, nowMs, holidayDates) {
  return sessionFee(session, Math.max(nowMs, session.started_at), holidayDates);
}
