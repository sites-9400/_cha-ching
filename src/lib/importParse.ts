/** Pure parser for bank-app "Recent Transactions" screenshot text (OCR'd by
 *  tesseract.js in ImportExpenses). State machine over trimmed non-empty
 *  lines: a date-header line sets the "current date" for rows below it; an
 *  amount line yields a row, pairing with either its own leading text or the
 *  previous merchant-only line (OCR sometimes splits a merchant onto its own
 *  line). Everything else (banners like "You've reached the end of the
 *  list.") is ignored naturally — it's never consumed as a header or amount. */
export interface ParsedTxn {
  date: string | null; // "YYYY-MM-DD" from the nearest date header above
  note: string;        // merchant text
  amount: number;      // absolute value
  credit: boolean;     // negative rows (refunds/rebates)
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const DATE_RE = /^([A-Z][a-z]{2,8})\.? (\d{1,2}),? (\d{4})$/;
const AMOUNT_RE = /(-)?\s*PHP\s*([\d,]+(?:\.\d{2})?)/i;

// Trailing separators between a merchant name and its amount (whitespace,
// dashes, colons, commas) are stripped; a trailing "..." (OCR's truncation
// ellipsis) is part of the merchant text and is left alone.
const TRAILING_SEP_RE = /[\s\-:,]+$/;

export function parseTransactions(text: string): ParsedTxn[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: ParsedTxn[] = [];
  let currentDate: string | null = null;
  let pendingMerchant: string | null = null;

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      const monthIndex = MONTHS.indexOf(dateMatch[1].slice(0, 3).toLowerCase());
      if (monthIndex >= 0) {
        const day = dateMatch[2].padStart(2, "0");
        currentDate = `${dateMatch[3]}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
        pendingMerchant = null;
        continue;
      }
    }

    const amountMatch = line.match(AMOUNT_RE);
    if (amountMatch) {
      const before = line.slice(0, amountMatch.index).replace(TRAILING_SEP_RE, "");
      const note = before || pendingMerchant || "";
      rows.push({
        date: currentDate,
        note,
        amount: Number(amountMatch[2].replace(/,/g, "")),
        credit: amountMatch[1] === "-",
      });
      pendingMerchant = null;
      continue;
    }

    // No date, no amount: a merchant-only line, held for the next amount row.
    pendingMerchant = line;
  }

  return rows;
}
