import { useState } from "react";
import { changePin } from "../../lib/pinAuth";

export default function ChangePin() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = /^\d{6}$/.test(current) && /^\d{6}$/.test(next) && next === confirm;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await changePin(current, next);
      setMsg({ ok: true, text: "PIN changed." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch {
      setMsg({ ok: false, text: "Couldn't change PIN — check your current PIN." });
    } finally {
      setBusy(false);
    }
  }

  const box = "w-full text-lg tracking-widest text-center tabular-nums border-b-2 border-stone-300 outline-none focus:border-emerald-500 py-1";

  return (
    <div className="flex flex-col gap-4 max-w-xs">
      <h2 className="font-bold text-lg">Change PIN</h2>
      <input type="password" inputMode="numeric" maxLength={6} placeholder="Current PIN" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} className={box} />
      <input type="password" inputMode="numeric" maxLength={6} placeholder="New 6-digit PIN" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} className={box} />
      <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm new PIN" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} className={box} />
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <button onClick={() => void save()} disabled={!valid || busy} className="py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Change PIN</button>
    </div>
  );
}
