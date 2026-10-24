// When the app downloads the car park list again (PLAN.md, M12): at most once
// a day.

export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

// True when no check was made yet (lastMs null or 0), a day has passed since
// the last one, or the phone's clock went back before it (a check stamped in
// the future would otherwise block updates until then).
export function isCheckDue(lastMs, nowMs) {
  if (!lastMs) return true;
  return nowMs < lastMs || nowMs - lastMs >= CHECK_EVERY_MS;
}
