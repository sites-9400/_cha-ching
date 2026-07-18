import { describe, expect, it } from "vitest";
import { CHANNELS, channelChip, channelChipSafe, channelLogo } from "./channels";

describe("channels", () => {
  it("lists the built-in channels incl. LANDBANK and UNIONBANK", () => {
    expect(CHANNELS).toHaveLength(11);
    expect(CHANNELS).toContain("CIMB");
    expect(CHANNELS).toContain("RCBC SAVINGS");
    expect(CHANNELS).toContain("LANDBANK");
    expect(CHANNELS).toContain("UNIONBANK");
  });
  it("returns the exact chip classes per channel", () => {
    expect(channelChip("CIMB")).toBe("bg-red-900 text-red-50");
    expect(channelChip("MAYA")).toBe("bg-green-800 text-green-50");
  });
  it("safe variant falls back to neutral for unknown strings", () => {
    expect(channelChipSafe("CIMB")).toBe("bg-red-900 text-red-50");
    expect(channelChipSafe("NONSENSE")).toBe("bg-gray-200 text-gray-800");
  });
  it("maps channels to bundled logos, undefined where none exists", () => {
    expect(channelLogo("GCASH")).toBe("/logos/gcash.svg");
    expect(channelLogo("RCBC CREDIT")).toBe("/logos/rcbc.svg");
    expect(channelLogo("MARIBANK")).toBeUndefined();
    expect(channelLogo("CASH")).toBeUndefined();
  });
});
