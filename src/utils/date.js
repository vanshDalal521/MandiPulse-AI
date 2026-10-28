// API datetimes are UTC ISO strings. Accept both "…Z" and naive values.
export function parseApiDate(value) {
  if (!value) return null;
  const raw = String(value);
  const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(hasZone ? raw : `${raw}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
