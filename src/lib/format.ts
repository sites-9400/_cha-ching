const fmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export const peso = (n: number): string => fmt.format(n);

/** "2026-07" + 3 → "2026-10" */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
