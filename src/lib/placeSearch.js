// The rows whose name or area contains query, in any case, as the place
// search on Park finds listed car parks (carParks.search). Places filters
// your saved places ({ name }) and the car park list ({ name, area }) with it
// as you type. An empty query keeps every row.
export function filterByQuery(rows, query) {
  const wanted = String(query ?? '').trim().toLowerCase();
  if (!wanted) return rows;
  return rows.filter((row) => [row.name, row.area].some((text) => text?.toLowerCase().includes(wanted)));
}
