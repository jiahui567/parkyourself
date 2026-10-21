import { formatRM } from '../lib/money';
import { formatDuration, formatTime } from '../lib/time';

// Text built from a parking_session row, shared by the Find screen, the
// notification and the share message (formats from PLAN.md).

const ACCESS_WORDS = { lift: 'lift', escalator: 'escalator', stairs: 'stairs' };

// 'B2 C14 Blue'
export function spotText(session) {
  return [session.level, session.bay, session.zone_colour_name].filter(Boolean).join(' ');
}

// 'Find Starbucks → take the escalator beside it → B2 → blue zone, pillar C14',
// or null when nothing was recorded.
export function routeBackText(session) {
  const steps = [];
  if (session.landmark) steps.push(`Find ${session.landmark}`);
  const access = ACCESS_WORDS[session.access_type];
  if (access) steps.push(`take the ${access}${session.landmark ? ' beside it' : ''}`);
  if (session.level) steps.push(session.level);
  const zone = session.zone_colour_name ? `${session.zone_colour_name.toLowerCase()} zone` : null;
  const pillar = session.bay ? `pillar ${session.bay}` : null;
  if (zone || pillar) steps.push([zone, pillar].filter(Boolean).join(', '));
  if (steps.length === 0) return null;
  steps[0] = steps[0][0].toUpperCase() + steps[0].slice(1);
  return steps.join(' → ');
}

// 'RM 3.00', 'RM 34.00 (estimate)', or null when there is no fee.
export function feeText(fee) {
  if (fee?.feeSen == null) return null;
  return fee.isEstimate ? `${formatRM(fee.feeSen)} (estimate)` : formatRM(fee.feeSen);
}

// 'My Myvi · Pavilion Bukit Jalil · B2 C14 Blue · 0h 05m · RM 3.00'
export function notificationText({ vehicleName, placeName, session, elapsedMs, fee }) {
  return [vehicleName, placeName, spotText(session), formatDuration(elapsedMs), feeText(fee)]
    .filter(Boolean)
    .join(' · ');
}

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// The WhatsApp message from PLAN.md, "Share your spot". Lines with nothing to
// say are left out.
export function shareMessage({ vehicleName, placeName, session }) {
  const spot = [
    session.level && `Level ${session.level}`,
    session.bay && `bay ${session.bay}`,
    session.zone_colour_name && `${session.zone_colour_name.toLowerCase()} zone`,
  ].filter(Boolean);
  const access = ACCESS_WORDS[session.access_type];
  const route = [
    access && `Took the ${access}`,
    session.landmark && `${access ? 'first' : 'First'} shop: ${session.landmark}`,
  ].filter(Boolean);

  return [
    `${vehicleName} is parked${placeName ? ` at ${placeName}` : ''}`,
    spot.length > 0 && spot.join(', '),
    route.length > 0 && route.join(', '),
    `Parked at ${formatTime(session.started_at)}`,
    session.lat != null && session.lng != null && `Map: ${googleMapsUrl(session.lat, session.lng)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
