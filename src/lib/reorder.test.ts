import { describe, expect, it } from "vitest";
import { adjacentSwap } from "./reorder";

const items = [
  { id: "a", order: 1 }, { id: "b", order: 2 }, { id: "c", order: 3 },
];

describe("adjacentSwap", () => {
  it("swaps order values with the next item moving down", () => {
    expect(adjacentSwap(items, 0, 1, "order")).toEqual([
      { id: "a", order: 2 }, { id: "b", order: 1 },
    ]);
  });
  it("swaps with the previous item moving up", () => {
    expect(adjacentSwap(items, 2, -1, "order")).toEqual([
      { id: "c", order: 2 }, { id: "b", order: 3 },
    ]);
  });
  it("returns null at the top edge moving up", () => {
    expect(adjacentSwap(items, 0, -1, "order")).toBeNull();
  });
  it("returns null at the bottom edge moving down", () => {
    expect(adjacentSwap(items, 2, 1, "order")).toBeNull();
  });
  it("works with a custom key like payoffOrder", () => {
    const d = [{ id: "x", payoffOrder: 5 }, { id: "y", payoffOrder: 9 }];
    expect(adjacentSwap(d, 0, 1, "payoffOrder")).toEqual([
      { id: "x", payoffOrder: 9 }, { id: "y", payoffOrder: 5 },
    ]);
  });
});
