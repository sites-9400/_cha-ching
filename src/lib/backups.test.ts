import { describe, expect, it } from "vitest";
import { backupsToPrune } from "./backups";

describe("backupsToPrune", () => {
  const ids = [
    "2026-07-18T10:00:00.000Z",
    "2026-07-15T09:00:00.000Z",
    "2026-07-19T08:00:00.000Z",
    "2026-07-01T07:00:00.000Z",
    "2026-07-10T06:00:00.000Z",
    "2026-07-05T05:00:00.000Z",
  ];
  it("keeps the newest N, prunes the rest", () => {
    expect(backupsToPrune(ids, 5).sort()).toEqual(["2026-07-01T07:00:00.000Z"]);
    expect(backupsToPrune(ids, 2).sort()).toEqual([
      "2026-07-01T07:00:00.000Z", "2026-07-05T05:00:00.000Z", "2026-07-10T06:00:00.000Z", "2026-07-15T09:00:00.000Z",
    ]);
  });
  it("prunes nothing at or under the cap", () => {
    expect(backupsToPrune(ids.slice(0, 3), 5)).toEqual([]);
    expect(backupsToPrune([], 5)).toEqual([]);
  });
});
