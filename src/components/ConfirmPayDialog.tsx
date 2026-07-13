import { useState } from "react";
import { peso } from "../lib/format";

interface ConfirmPayDialogProps {
  debtName: string;
  currentBalance: number;
  defaultAmount: number;
  onConfirm: (amount: number) => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmPayDialog({
  debtName, currentBalance, defaultAmount, onConfirm, onCancel,
}: ConfirmPayDialogProps) {
  const [raw, setRaw] = useState(String(Math.round(defaultAmount)));
  const [busy, setBusy] = useState(false);
  const amount = Number(raw);
  const valid = amount > 0;
  const over = amount > currentBalance;

  async function confirm() {
    if (!valid || busy) return;
    setBusy(true);
    try { await onConfirm(amount); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-1">Pay {debtName}</h3>
        <p className="text-xs text-stone-500 mb-3">Balance {peso(currentBalance)}</p>
        <input
          type="number" inputMode="decimal" autoFocus
          value={raw} onChange={(e) => setRaw(e.target.value)}
          className="w-full text-lg font-semibold tabular-nums border-b-2 border-stone-300 outline-none focus:border-emerald-500 pb-1 mb-2"
        />
        {over && (
          <p className="text-[11px] text-amber-600 mb-2">
            More than the balance — pay {peso(currentBalance)} to clear it?
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button
            onClick={() => void confirm()} disabled={!valid || busy}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
