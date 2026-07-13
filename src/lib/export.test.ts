import { describe, expect, it } from "vitest";
import { toCsv } from "./export";

describe("toCsv", () => {
  it("writes a header then one line per row in column order", () => {
    const csv = toCsv(
      [{ a: 1, b: "x" }, { a: 2, b: "y" }],
      [{ key: "a", label: "A" }, { key: "b", label: "B" }],
    );
    expect(csv).toBe("A,B\r\n1,x\r\n2,y");
  });
  it("quotes and doubles quotes for fields with commas, quotes, or newlines", () => {
    const csv = toCsv(
      [{ n: 'a,b' }, { n: 'say "hi"' }, { n: "line\nbreak" }],
      [{ key: "n", label: "N" }],
    );
    expect(csv).toBe('N\r\n"a,b"\r\n"say ""hi"""\r\n"line\nbreak"');
  });
  it("renders empty rows as a header-only file", () => {
    expect(toCsv([], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe("A,B");
  });
  it("renders undefined/null cells as empty", () => {
    expect(toCsv([{ a: undefined, b: null }], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe("A,B\r\n,");
  });
});
