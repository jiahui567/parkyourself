import { localMonthKey } from '../lib/time';
import { amountSen } from './summary';

// History's filters (PLAN.md, "Screens", History): by car, by place and by
// month, over the rows from sessions.listHistory. Pure, like the Spending
// totals, so every rule has a Jest test.
//
// A filter is { vehicle, place, month }, each null for all: a vehicle id, a
// place id or NO_PLACE, and a month key ('2026-10', the local month the
// session started in, as everywhere in Spending).

export const FILTER_KINDS = ['vehicle', 'place', 'month'];

export const NO_FILTER = Object.freeze({ vehicle: null, place: null, month: null });

// The place filter's value for sessions with no place, as on the Sessions screen.
export const NO_PLACE = 'none';

// What each filter compares in a row.
const VALUE_OF = {
  vehicle: (row) => row.vehicle_id,
  place: (row) => row.place_id ?? NO_PLACE,
  month: (row) => localMonthKey(row.started_at),
};

// The name a choice shows: null for a month (text formats its key) and for
// no place. A deleted place keeps its name on its sessions.
const NAME_OF = {
  vehicle: (row) => row.vehicle_name,
  place: (row) => (row.place_id == null ? null : row.place_name),
  month: () => null,
};

// True when the row passes every filter except skip.
function passes(row, filter, skip = null) {
  return FILTER_KINDS.every((kind) => kind === skip || filter[kind] == null || VALUE_OF[kind](row) === filter[kind]);
}

const byValue = (a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0);

// Months newest first. Cars and places by name in any case (equal names by
// id, so the order does not jump between loads), with no place last.
function compareChoices(kind) {
  if (kind === 'month') return (a, b) => byValue(b, a);
  return (a, b) => {
    if (a.name == null || b.name == null) return Number(a.name == null) - Number(b.name == null);
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : byValue(a, b);
  };
}

// filter, with every choice that no row has any more (the last session in it
// was deleted) back to all: such a choice could only ever hide everything.
// filter itself when nothing is dropped, so keeping the result in state costs
// no extra render.
export function liveFilter(rows, filter) {
  let live = filter;
  for (const kind of FILTER_KINDS) {
    const value = filter[kind];
    if (value != null && !rows.some((row) => VALUE_OF[kind](row) === value)) live = { ...live, [kind]: null };
  }
  return live;
}

export function isFiltered(filter) {
  return FILTER_KINDS.some((kind) => filter[kind] != null);
}

// The rows the filter keeps, in their order.
export function filterHistory(rows, filter) {
  return rows.filter((row) => passes(row, filter));
}

// One filter's choices, from the rows that pass the other filters, so that
// picking one never empties the list: { all, options }. all counts those rows
// (shown beside "All cars"); options are [{ value, name, sessions }]. The
// choice already made stays listed, with 0 sessions, even when the other
// filters leave it none.
export function filterChoices(rows, filter, kind) {
  const groups = new Map();
  let all = 0;
  for (const row of rows) {
    if (!passes(row, filter, kind)) continue;
    all += 1;
    const value = VALUE_OF[kind](row);
    if (!groups.has(value)) groups.set(value, { value, name: NAME_OF[kind](row), sessions: 0 });
    groups.get(value).sessions += 1;
  }
  const chosen = filter[kind];
  if (chosen != null && !groups.has(chosen)) {
    const row = rows.find((candidate) => VALUE_OF[kind](candidate) === chosen);
    groups.set(chosen, { value: chosen, name: row ? NAME_OF[kind](row) : null, sessions: 0 });
  }
  return { all, options: [...groups.values()].sort(compareChoices(kind)) };
}

// Everything History shows for its filters, from all its rows and the
// filters chosen: { filter, rows, total, choices }.
// - filter: chosen, with any choice no row has any more back to all;
// - rows: the rows it keeps, and total their { totalSen, sessions };
// - choices.vehicle, .place and .month: filterChoices plus selected (the
//   chosen option, or null) and show, false when the whole history offers
//   fewer than two choices and none is chosen (one car needs no car filter).
export function historyFilters(allRows, chosen) {
  const filter = liveFilter(allRows, chosen);
  const rows = filterHistory(allRows, filter);
  const total = { totalSen: rows.reduce((sum, row) => sum + amountSen(row), 0), sessions: rows.length };
  const choices = {};
  for (const kind of FILTER_KINDS) {
    const { all, options } = filterChoices(allRows, filter, kind);
    const distinct = new Set(allRows.map((row) => VALUE_OF[kind](row))).size;
    choices[kind] = {
      all,
      options,
      selected: options.find((option) => option.value === filter[kind]) ?? null,
      show: filter[kind] != null || distinct > 1,
    };
  }
  return { filter, rows, total, choices };
}
