import { describe, expect, it } from "vitest";
import { parseTransactions } from "./importParse";

// Verbatim from Eve's real EastWest screenshot (spec: docs/superpowers/specs/2026-07-29-screenshot-import-design.md).
const EASTWEST_SAMPLE = `Transactions after latest statement
Jul 25 2026
CHATBOT CASH REBATE -PHP 1,000.00
Jul 23 2026
fp*Food Panda https://... PHP 259.00
Buyandship Limited H... PHP 1,209.50
Jul 22 2026
fp*Food Panda https://... PHP 516.00
HONGKONG DISNEYLA... PHP 1,526.30
Jul 21 2026
ICHIRAN HONG KONG... PHP 2,888.10
Jul 20 2026
Iris Galerie Ngong Ping... PHP 4,351.46`;

describe("parseTransactions — EastWest sample", () => {
  const rows = parseTransactions(EASTWEST_SAMPLE);

  it("finds all 7 rows", () => {
    expect(rows).toHaveLength(7);
  });

  it("parses each row's date, note, amount, and credit flag", () => {
    expect(rows).toEqual([
      { date: "2026-07-25", note: "CHATBOT CASH REBATE", amount: 1000, credit: true },
      { date: "2026-07-23", note: "fp*Food Panda https://...", amount: 259, credit: false },
      { date: "2026-07-23", note: "Buyandship Limited H...", amount: 1209.5, credit: false },
      { date: "2026-07-22", note: "fp*Food Panda https://...", amount: 516, credit: false },
      { date: "2026-07-22", note: "HONGKONG DISNEYLA...", amount: 1526.3, credit: false },
      { date: "2026-07-21", note: "ICHIRAN HONG KONG...", amount: 2888.1, credit: false },
      { date: "2026-07-20", note: "Iris Galerie Ngong Ping...", amount: 4351.46, credit: false },
    ]);
  });

  it("ignores banner lines that are never consumed as a header or amount", () => {
    expect(rows.some((r) => r.note.includes("Transactions after latest statement"))).toBe(false);
  });
});

describe("parseTransactions — additional heuristics", () => {
  it("pairs a merchant on its own line with the amount on the next line", () => {
    const text = `Jul 15 2026
Some Merchant Name
PHP 750.00`;
    expect(parseTransactions(text)).toEqual([
      { date: "2026-07-15", note: "Some Merchant Name", amount: 750, credit: false },
    ]);
  });

  it("defaults date to null when there is no date header before the first row", () => {
    const text = `Coffee Shop PHP 150.00`;
    expect(parseTransactions(text)).toEqual([
      { date: null, note: "Coffee Shop", amount: 150, credit: false },
    ]);
  });

  it("parses comma-less and decimal-less amounts", () => {
    const text = `Jul 10 2026
Grocery Store PHP 2000`;
    expect(parseTransactions(text)).toEqual([
      { date: "2026-07-10", note: "Grocery Store", amount: 2000, credit: false },
    ]);
  });

  it("ignores footer banners like the end-of-list message", () => {
    const text = `Jul 10 2026
Grocery Store PHP 2000
You've reached the end of the list.`;
    expect(parseTransactions(text)).toEqual([
      { date: "2026-07-10", note: "Grocery Store", amount: 2000, credit: false },
    ]);
  });
});
