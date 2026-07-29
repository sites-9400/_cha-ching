import { describe, expect, it } from "vitest";
import { lineComparators, LINE_SORTS, parseLineSortKey } from "./lineSort";
import type { LineStatus } from "./types";

const line = (name: string, order: number, status: LineStatus) =>
  ({ name, amount: 100, channel: "CASH" as const, order, status });

describe("paid-first sort", () => {
  it("puts ticked lines above unticked ones", () => {
    const rows = [line("a", 0, ""), line("b", 1, "PAID"), line("c", 2, "")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["b", "a", "c"]);
  });

  it("treats every non-empty status as ticked", () => {
    const rows = [line("a", 0, ""), line("b", 1, "SENT"), line("c", 2, "RECEIVED"), line("d", 3, "TRANSFERRED")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["b", "c", "d", "a"]);
  });

  it("keeps manual order within each group", () => {
    const rows = [line("late", 5, "PAID"), line("early", 1, "PAID"), line("u2", 4, ""), line("u1", 2, "")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["early", "late", "u1", "u2"]);
  });

  it("is offered as a sort option", () => {
    expect(LINE_SORTS.map((s) => s.key)).toContain("paid");
  });
});

describe("parseLineSortKey", () => {
  it("passes through every known key", () => {
    for (const s of LINE_SORTS) expect(parseLineSortKey(s.key)).toBe(s.key);
  });

  it("falls back to order for garbage or null", () => {
    expect(parseLineSortKey("bogus")).toBe("order");
    expect(parseLineSortKey(null)).toBe("order");
    expect(parseLineSortKey("")).toBe("order");
  });
});
