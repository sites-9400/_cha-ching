import { describe, expect, it } from "vitest";
import { savingsHistory } from "./savings";
import type { SavingsMove } from "./types";

const MV = (o: Partial<SavingsMove>): SavingsMove =>
  ({ id: "m", amount: 1000, direction: "in", source: "Side gig", date: "2026-07-20T00:00:00.000Z", ...o });
const EX = (o: Partial<{ id: string; amount: number; date: string; note?: string; category?: string; fundedBySavings?: boolean }>) =>
  ({ id: "e", amount: 500, date: "2026-07-21T00:00:00.000Z", fundedBySavings: true, ...o });

describe("savingsHistory", () => {
  it("merges moves and savings-funded expenses into one list", () => {
    const rows = savingsHistory([MV({ id: "m1" })], [EX({ id: "e1", note: "Laptop repair" })]);
    expect(rows.map((r) => r.id)).toEqual(["e1", "m1"]); // e1 is the later date
    expect(rows.map((r) => r.kind)).toEqual(["expense", "move"]);
  });

  it("sorts by date descending", () => {
    const rows = savingsHistory(
      [MV({ id: "old", date: "2026-07-01T00:00:00.000Z" }), MV({ id: "new", date: "2026-07-25T00:00:00.000Z" })],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("caps at the limit, defaulting to 8", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      MV({ id: `m${i}`, date: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }));
    expect(savingsHistory(many, [])).toHaveLength(8);
    expect(savingsHistory(many, [], 3)).toHaveLength(3);
  });

  it("ignores expenses not funded by savings", () => {
    expect(savingsHistory([], [EX({ id: "e1", fundedBySavings: false })])).toEqual([]);
    expect(savingsHistory([], [EX({ id: "e2", fundedBySavings: undefined })])).toEqual([]);
  });

  it("takes an expense's source from note, then category, then a fallback", () => {
    const [a] = savingsHistory([], [EX({ note: "Laptop repair", category: "Tech" })]);
    expect(a.source).toBe("Laptop repair");
    const [b] = savingsHistory([], [EX({ category: "Tech" })]);
    expect(b.source).toBe("Tech");
    const [c] = savingsHistory([], [EX({})]);
    expect(c.source).toBe("Expense");
  });

  it("always marks expense entries as outgoing and read-only in kind", () => {
    const [e] = savingsHistory([], [EX({ amount: 3200 })]);
    expect(e).toMatchObject({ amount: 3200, direction: "out", kind: "expense" });
  });
});
