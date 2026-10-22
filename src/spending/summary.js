import { addMonths, localMonthKey } from '../lib/time';

// Spending totals (PLAN.md, "Monthly spending"). Pure functions over the rows
// from sessions.listHistory: no database or React code, so every rule is
// covered by Jest tests. A session counts in the local month it started.

// What a session cost: the amount paid when one was entered, otherwise the
// calculated fee. A session with neither (no rate) adds nothing but still
// counts as a session. ?? keeps a paid amount of 0 (free with validation).
export function amountSen(session) {
  return session.paid_sen ?? session.fee_sen ?? 0;
}

// Equal totals sort by name, any case, so the order does not jump between
// loads; the group with no place goes last.
function byName(a, b) {
  if (a.name === b.name) return 0;
  if (a.name == null) return 1;
  if (b.name == null) return -1;
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

// [{ id, name, totalSen, sessions }], highest total first.
function totalsBy(rows, idKey, nameKey) {
  const groups = new Map();
  for (const row of rows) {
    const id = row[idKey];
    if (!groups.has(id)) groups.set(id, { id, name: row[nameKey], totalSen: 0, sessions: 0 });
    const group = groups.get(id);
    group.totalSen += amountSen(row);
    group.sessions += 1;
  }
  return [...groups.values()].sort((a, b) => b.totalSen - a.totalSen || byName(a, b));
}

// Totals for one month's rows. byPlace has id null (name null) for sessions
// with no place.
export function monthSummary(rows) {
  let totalSen = 0;
  let durationMs = 0;
  for (const row of rows) {
    totalSen += amountSen(row);
    durationMs += row.ended_at - row.started_at;
  }
  return {
    totalSen,
    sessions: rows.length,
    durationMs,
    byPlace: totalsBy(rows, 'place_id', 'place_name'),
    byVehicle: totalsBy(rows, 'vehicle_id', 'vehicle_name'),
  };
}

// History's month groups, in the order the rows come (newest first from
// sessions.listHistory): [{ key: '2026-10', totalSen, sessions, data }], data
// being that month's rows, for a SectionList.
export function historyByMonth(rows) {
  const months = new Map();
  for (const row of rows) {
    const key = localMonthKey(row.started_at);
    if (!months.has(key)) months.set(key, { key, totalSen: 0, sessions: 0, data: [] });
    const month = months.get(key);
    month.totalSen += amountSen(row);
    month.sessions += 1;
    month.data.push(row);
  }
  return [...months.values()];
}

// [{ key, totalSen, sessions }] for the count months ending at endMonthKey,
// oldest first, for the bar chart. Months with nothing are 0; rows outside
// these months are left out.
export function monthlyTotals(rows, endMonthKey, count = 12) {
  const months = Array.from({ length: count }, (_, i) => ({
    key: addMonths(endMonthKey, i - count + 1),
    totalSen: 0,
    sessions: 0,
  }));
  const byKey = new Map(months.map((month) => [month.key, month]));
  for (const row of rows) {
    const month = byKey.get(localMonthKey(row.started_at));
    if (!month) continue;
    month.totalSen += amountSen(row);
    month.sessions += 1;
  }
  return months;
}
