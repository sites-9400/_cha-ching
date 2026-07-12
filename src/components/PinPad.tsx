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
          setError("PINs don't match — start over.");
          setMode("setup");
        } else {
          await setupPin(candidate);
        }
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/email-already-in-use"
          ? "Already set up — enter your existing PIN."
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
    <main className="min-h-screen bg-emerald-950 text-emerald-50 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Cha-Ching</h1>
      <p className="text-emerald-300">{title}</p>
      <div className="flex gap-3" aria-label="PIN progress">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-emerald-300" : "bg-emerald-800"}`}
          />
        ))}
      </div>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              className="h-16 w-16 rounded-full bg-emerald-900 text-2xl font-semibold active:bg-emerald-700"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
            >
              {k}
            </button>
          ),
        )}
      </div>
      {mode === "enter" && (
        <button className="text-emerald-400 text-sm underline" onClick={() => setMode("setup")}>
          First time? Set up your PIN
        </button>
      )}
    </main>
  );
}
