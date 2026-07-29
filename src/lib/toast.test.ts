import { afterEach, describe, expect, it } from "vitest";
import { onToast, resetToastDedupe, showToast, type ToastMsg } from "./toast";

describe("toast", () => {
  afterEach(() => {
    resetToastDedupe();
  });

  it("delivers a fired toast to the listener", () => {
    const received: ToastMsg[] = [];
    const off = onToast((t) => received.push(t));
    showToast("Saved");
    off();
    expect(received).toHaveLength(1);
    expect(received[0].text).toBe("Saved");
  });

  it("dedupes identical text fired within the window", () => {
    resetToastDedupe();
    const received: ToastMsg[] = [];
    const off = onToast((t) => received.push(t));
    showToast("Sync error — check connection or reload");
    showToast("Sync error — check connection or reload");
    off();
    expect(received).toHaveLength(1);
  });

  it("does not dedupe different text", () => {
    resetToastDedupe();
    const received: ToastMsg[] = [];
    const off = onToast((t) => received.push(t));
    showToast("Saved");
    showToast("Delete failed — check connection");
    off();
    expect(received).toHaveLength(2);
    expect(received[1].text).toBe("Delete failed — check connection");
  });

  it("passes action and duration through, with a default duration", () => {
    resetToastDedupe();
    const received: ToastMsg[] = [];
    const off = onToast((t) => received.push(t));
    const run = () => {};
    showToast("Update ready", { action: { label: "Reload", run }, duration: 0 });
    showToast("Deleted ₱50 · Food");
    off();
    expect(received[0].action).toEqual({ label: "Reload", run });
    expect(received[0].duration).toBe(0);
    expect(received[1].duration).toBe(4000);
    expect(received[1].action).toBeUndefined();
  });
});
