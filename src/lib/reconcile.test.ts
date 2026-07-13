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
});
