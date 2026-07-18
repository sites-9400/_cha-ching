import { describe, expect, it } from "vitest";
import { reconcileLines } from "./reconcile";
import type { MonthLine, TemplateLine } from "./types";

const T = (o: Partial<TemplateLine>): TemplateLine =>
  ({ id: "t", name: "t", amount: 0, channel: "CIMB", cutoff: 1, order: 0, ...o });
const M = (o: Partial<MonthLine>): MonthLine =>
  ({ id: "t", name: "t", amount: 0, channel: "CIMB", cutoff: 1, order: 0, status: "", oneOff: false, ...o });

describe("reconcileLines", () => {
  it("updates an existing line's fields but keeps its status/paidDate", () => {
    const template = [T({ id: "a", name: "Rent", amount: 12000, order: 3 })];
    const month = [M({ id: "a", name: "Rent", amount: 10000, status: "PAID", paidDate: "2026-07-05" })];
    const { upserts, deletes } = reconcileLines(template, month);
    expect(deletes).toEqual([]);
    expect(upserts[0]).toMatchObject({ id: "a", amount: 12000, order: 3, status: "PAID", paidDate: "2026-07-05" });
  });
  it("adds a new template line as a blank month line", () => {
    const { upserts } = reconcileLines([T({ id: "new", name: "Gym", amount: 500 })], []);
    expect(upserts[0]).toMatchObject({ id: "new", name: "Gym", amount: 500, status: "", oneOff: false });
  });
  it("carries the template line's debtId through to the month line", () => {
    const { upserts } = reconcileLines([T({ id: "rent", name: "Rent", debtId: "d9" })], []);
    expect(upserts[0].debtId).toBe("d9");
  });
  it("carries isEnvelope onto the month line", () => {
    const { upserts } = reconcileLines([T({ id: "allow", isEnvelope: true })], []);
    expect(upserts[0].isEnvelope).toBe(true);
  });
  it("deletes a template-derived line whose template is gone", () => {
    const { deletes } = reconcileLines([], [M({ id: "gone" })]);
    expect(deletes).toEqual(["gone"]);
  });
  it("never touches one-off lines", () => {
    const month = [M({ id: "event-1", oneOff: true })];
    const { upserts, deletes } = reconcileLines([], month);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });
  it("leaves an inline-overridden line completely untouched (no upsert, no delete)", () => {
    const template = [T({ id: "tithes", name: "Tithes", amount: 5000 })];
    const month = [M({ id: "tithes", name: "Tithes (church B)", amount: 3000, status: "PAID", overridden: true })];
    const { upserts, deletes } = reconcileLines(template, month);
    expect(deletes).toEqual([]);
    expect(upserts.find((u) => u.id === "tithes")).toBeUndefined();
  });
  it("keeps an overridden line even if its template was deleted", () => {
    const month = [M({ id: "tithes", overridden: true })];
    const { deletes } = reconcileLines([], month);
    expect(deletes).toEqual([]);
  });
  it("migrates a tick to the template's id when ids diverged (name+cutoff fallback)", () => {
    // template line was re-created with a new id; the month line still has the old id + PAID tick.
    const template = [T({ id: "new-id", name: "Tithes", amount: 5000, cutoff: 2 })];
    const month = [M({ id: "old-id", name: "Tithes", cutoff: 2, status: "PAID", paidDate: "2026-07-05" })];
    const { upserts, deletes } = reconcileLines(template, month);
    // status migrated onto the template's id, old-id doc removed — tick NOT lost
    expect(upserts).toEqual([
      expect.objectContaining({ id: "new-id", name: "Tithes", status: "PAID", paidDate: "2026-07-05" }),
    ]);
    expect(deletes).toEqual(["old-id"]);
  });
  it("does not fallback-match across a different cutoff", () => {
    const template = [T({ id: "new-id", name: "Tithes", cutoff: 1 })];
    const month = [M({ id: "old-id", name: "Tithes", cutoff: 2, status: "PAID" })];
    const { upserts } = reconcileLines(template, month);
    expect(upserts[0].status).toBe(""); // different cutoff → treated as a new blank line
  });
});

describe("reconcileLines with closed cutoffs", () => {
  it("does not upsert a new template line into a closed cutoff", () => {
    const { upserts } = reconcileLines(
      [T({ id: "new", cutoff: 1 })],
      [M({ id: "a", cutoff: 1, status: "PAID" })],
      new Set([1]),
    );
    expect(upserts.find((u) => u.id === "new")).toBeUndefined();
  });
  it("does not delete lines that live in a closed cutoff", () => {
    // "orphan" has no template counterpart — normally it would be deleted.
    const { deletes } = reconcileLines([], [M({ id: "orphan", cutoff: 1, status: "PAID" })], new Set([1]));
    expect(deletes).toEqual([]);
  });
  it("does not move an existing line out of a closed cutoff", () => {
    // Template moved the line to cutoff 2, but its month doc sits in closed cutoff 1.
    const { upserts, deletes } = reconcileLines(
      [T({ id: "a", cutoff: 2 })],
      [M({ id: "a", cutoff: 1, status: "PAID" })],
      new Set([1]),
    );
    expect(upserts.find((u) => u.id === "a")).toBeUndefined();
    expect(deletes).toEqual([]);
  });
  it("still reconciles open cutoffs normally", () => {
    const { upserts, deletes } = reconcileLines(
      [T({ id: "new2", cutoff: 2 })],
      [M({ id: "a", cutoff: 1, status: "PAID" }), M({ id: "gone", name: "gone", cutoff: 2 })],
      new Set([1]),
    );
    expect(upserts.map((u) => u.id)).toContain("new2");
    expect(deletes).toContain("gone");
  });
  it("defaults to no closed cutoffs (back-compat)", () => {
    const { upserts } = reconcileLines([T({ id: "new", cutoff: 1 })], [M({ id: "a", cutoff: 1, status: "PAID" })]);
    expect(upserts.map((u) => u.id)).toContain("new");
  });

  it("budget metadata still flows into a closed cutoff as a patch (no upsert)", () => {
    const { upserts, deletes, patches } = reconcileLines(
      [T({ id: "allow", cutoff: 1, isEnvelope: true, budgetGroup: "Allowance" })],
      [M({ id: "allow", cutoff: 1, status: "PAID" })],
      new Set([1]),
    );
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
    expect(patches).toEqual([{ id: "allow", isEnvelope: true, budgetGroup: "Allowance" }]);
  });
  it("emits no patch when the closed line's metadata already matches", () => {
    const { patches } = reconcileLines(
      [T({ id: "allow", cutoff: 1, isEnvelope: true, budgetGroup: "Allowance" })],
      [M({ id: "allow", cutoff: 1, status: "PAID", isEnvelope: true, budgetGroup: "Allowance" })],
      new Set([1]),
    );
    expect(patches).toEqual([]);
  });
  it("does not patch overridden lines (dialog edits win)", () => {
    const { patches } = reconcileLines(
      [T({ id: "allow", cutoff: 1, budgetGroup: "Allowance" })],
      [M({ id: "allow", cutoff: 1, status: "PAID", overridden: true })],
      new Set([1]),
    );
    expect(patches).toEqual([]);
  });
  it("open cutoffs get metadata via the normal upsert, not a patch", () => {
    const { upserts, patches } = reconcileLines(
      [T({ id: "allow", cutoff: 1, isEnvelope: true, budgetGroup: "Allowance" })],
      [M({ id: "allow", cutoff: 1 })],
    );
    expect(upserts[0]).toMatchObject({ id: "allow", isEnvelope: true, budgetGroup: "Allowance" });
    expect(patches).toEqual([]);
  });
});
