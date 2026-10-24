// Which of a listed car park's rates apply on a day (PLAN.md, M12). A car
// park keeps its rate history: each row has a day_type and an effective_from
// ('YYYY-MM-DD', or null for "since before it was first checked").

const DAY_TYPES = ['weekday', 'weekend', 'holiday'];

// { weekday, weekend, holiday, effective_from } for the day todayKey
// ('YYYY-MM-DD'): per day type the row with the latest effective_from not
// after today (null counts as earliest), or null when none applies yet.
// effective_from is the latest date among the rows chosen, or null when none
// has one, for "in effect since" on Park.
export function ratesInEffect(rows, todayKey) {
  // Without a day every future rate would count as started.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey ?? '')) throw new Error(`Not a day: ${todayKey}`);
  const chosen = { weekday: null, weekend: null, holiday: null };
  for (const row of rows) {
    if (!DAY_TYPES.includes(row.day_type)) continue;
    if (row.effective_from != null && row.effective_from > todayKey) continue;
    const current = chosen[row.day_type];
    if (!current || (row.effective_from ?? '') > (current.effective_from ?? '')) chosen[row.day_type] = row;
  }
  const dates = DAY_TYPES.map((dayType) => chosen[dayType]?.effective_from).filter(Boolean);
  return { ...chosen, effective_from: dates.length ? dates.sort().at(-1) : null };
}
