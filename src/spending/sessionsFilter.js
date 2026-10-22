import { monthRange } from '../lib/time';

// The /sessions screen (tap-through from Spending) is opened with
// ?month=YYYY-MM and either placeId=<id> ('none' for sessions with no place)
// or vehicleId=<id>.

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const given = (value) => typeof value === 'string' && value !== '';

// -> { filter, error }. filter: { month, kind: 'place'|'vehicle', id, query },
// where query is for sessions.listHistory and id is null for "No place".
// error: a sentence for the user, or null.
export function sessionsFilter({ month, placeId, vehicleId }) {
  if (!given(month) || !MONTH_KEY.test(month)) {
    return { filter: null, error: 'This list has no month to show.' };
  }
  if (given(placeId) === given(vehicleId)) {
    return { filter: null, error: 'This list needs a place or a car.' };
  }
  const { start, end } = monthRange(month);
  const query = { from: start, to: end };
  if (given(placeId)) {
    query.place_id = placeId === 'none' ? null : placeId;
    return { filter: { month, kind: 'place', id: query.place_id, query }, error: null };
  }
  query.vehicle_id = vehicleId;
  return { filter: { month, kind: 'vehicle', id: vehicleId, query }, error: null };
}

// The place or car the list is about. The sessions carry the name even for a
// deleted place; owner (the place or car row, or null) covers an empty list.
export function ownerName(filter, rows, owner) {
  if (filter.kind === 'place' && filter.id === null) return 'No place';
  const key = filter.kind === 'place' ? 'place_name' : 'vehicle_name';
  return rows[0]?.[key] ?? owner?.name ?? null;
}
