const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Current month as "YYYY-MM". `now` is injectable for tests. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthIndex(key: string): number {
  return Number(key.split("-")[1]);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Local-time ISO stamp "YYYY-MM-DDTHH:mm:ss". Use for every stored date that
 *  is later sliced as a calendar string — toISOString() is UTC and shifts
 *  00:00–07:59 PH time onto the previous day. Sorts correctly against legacy
 *  UTC strings (same lexicographic prefix format). */
export function localIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
