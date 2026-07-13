export interface Column<T> { key: keyof T & string; label: string }

const cell = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC-4180-ish CSV: CRLF rows, header from labels, fields escaped. Pure. */
export function toCsv<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

/** Trigger a client-side download of `text` as `filename`. Best-effort; no data mutation. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
