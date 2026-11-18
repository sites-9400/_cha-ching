import { useState } from "react";
import { setupPin, unlock } from "../lib/pinAuth";

type Mode = "enter" | "setup" | "confirm";

export default function PinPad() {
  const [mode, setMode] = useState<Mode>("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(candidate: string) {
    setBusy(true);
    setError("");
    try {
      if (mode === "enter") {
        await unlock(candidate);
      } else if (mode === "setup") {
        setFirstPin(candidate);
        setMode("confirm");
      } else {
        if (candidate !== firstPin) {
          setError("PINs don't match. Start over.");
          setMode("setup");
        } else {
          await setupPin(candidate);
        }
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/email-already-in-use"
          ? "Already set up. Enter your existing PIN."
          : "Wrong PIN. Try again.",
      );
      if (code === "auth/email-already-in-use") setMode("enter");
    } finally {
      setPin("");
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  const title =
    mode === "enter" ? "Enter PIN" : mode === "setup" ? "Set a 6-digit PIN" : "Confirm PIN";

  return (
    <main className="min-h-screen bg-board text-ink flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-display font-extrabold text-[40px] leading-10 text-ink">Cha-Ching</h1>
      <p className="text-[16px] text-ink-2">{title}</p>
      <div className="flex gap-3" aria-label="PIN progress">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-ink ${i < pin.length ? "bg-ink" : "bg-transparent"}`}
          />
        ))}
      </div>
      {error && <p className="text-marker-red-text text-sm">{error}</p>}
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              aria-label={k === "⌫" ? "Backspace" : undefined}
              className="h-[72px] w-[72px] rounded-full bg-manila border border-rule font-display font-bold text-[28px] text-ink flex items-center justify-center active:bg-rule"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
            >
              {k === "⌫" ? (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" />
                  <path d="M12.5 10l4 4M16.5 10l-4 4" />
                </svg>
              ) : k}
            </button>
          ),
        )}
      </div>
      {mode === "enter" && (
        <button className="text-ink-2 text-sm underline inline-flex items-center min-h-11 px-3" onClick={() => setMode("setup")}>
          First time? Set up your PIN
        </button>
      )}
    </main>
  );
}
