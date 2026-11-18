import { peso } from "../lib/format";
import { splitsRemainder } from "../lib/debtSplits";
import type { Debt, DebtSplit } from "../lib/types";
import { CloseIcon } from "./icons";

const activeSorted = (debts: Debt[]) => [...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);

/**
 * "Pays debt" picker that can address one debt (a plain select, as before) or
 * several (a list of debt+amount rows). Single mode emits `{debtId}`, split
 * mode emits `{debtSplits}`. The parent decides how to persist the switch
 * (clearing the field that's no longer in use). Disabled while the line is
 * already ticked, since re-linking would orphan a logged payment.
 */
export default function DebtSplitsEditor({
  debts, amount, debtId, debtSplits, disabled, onChange,
}: {
  debts: Debt[];
  amount: number;
  debtId?: string;
  debtSplits?: DebtSplit[];
  disabled?: boolean;
  onChange: (v: { debtId?: string; debtSplits?: DebtSplit[] }) => void;
}) {
  const splitting = !!debtSplits && debtSplits.length > 0;
  const rows = debtSplits ?? [];
  const remainder = splitsRemainder(amount, rows);

  function setRows(next: DebtSplit[]) {
    onChange({ debtId: undefined, debtSplits: next });
  }

  function startSplitting() {
    const seed: DebtSplit[] = debtId ? [{ debtId, amount }] : [{ debtId: "", amount: 0 }];
    onChange({ debtId: undefined, debtSplits: seed });
  }

  function stopSplitting() {
    onChange({ debtId: undefined, debtSplits: undefined });
  }

  if (!splitting) {
    return (
      <>
        <label className="flex items-center justify-between text-sm min-h-11 gap-2">
          <span className="shrink-0">Pays debt</span>
          <select
            value={debtId ?? ""}
            aria-label="Pays debt"
            disabled={disabled}
            onChange={(e) => onChange({ debtId: e.target.value || undefined, debtSplits: undefined })}
            className="text-sm min-h-11 border-b border-stone-300 outline-none min-w-0 flex-1 text-right disabled:opacity-40"
          >
            <option value="">— none —</option>
            {activeSorted(debts).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-ink-2 -mt-1">
          {disabled ? "Untick the line first to change which debt it pays." : "Ticking this line PAID logs a payment to that debt."}
        </p>
        {!disabled && (
          <button type="button" onClick={startSplitting} className="text-xs font-semibold text-ink underline underline-offset-2 self-start inline-flex items-center min-h-11 px-2 -mx-2">
            Split across debts
          </button>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">Pays debts</span>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              value={row.debtId}
              aria-label={`Debt ${i + 1}`}
              disabled={disabled}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, debtId: e.target.value } : r)))}
              className="text-sm min-h-11 border-b border-stone-300 outline-none min-w-0 flex-1 disabled:opacity-40"
            >
              <option value="">— choose —</option>
              {activeSorted(debts).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input
              type="number" inputMode="decimal" aria-label={`Amount for debt ${i + 1}`} value={row.amount || ""} disabled={disabled}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) } : r)))}
              className="w-20 min-h-11 text-right border-b border-stone-300 outline-none tabular-nums disabled:opacity-40"
            />
            {!disabled && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove" className="text-marker-red-text inline-flex items-center justify-center min-h-11 min-w-11"><CloseIcon /></button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button type="button" onClick={() => setRows([...rows, { debtId: "", amount: 0 }])} className="text-xs font-semibold text-ink underline underline-offset-2 self-start inline-flex items-center min-h-11 px-2 -mx-2">
          + add debt
        </button>
      )}
      <p className={`text-xs ${remainder === 0 ? "text-ink-2" : "text-amber-600"}`}>
        {peso(remainder)} unallocated
      </p>
      <p className="text-xs text-ink-2 -mt-1">
        {disabled ? "Untick the line first to change which debt it pays." : "Ticking this line PAID logs one payment per debt above."}
      </p>
      {!disabled && (
        <button type="button" onClick={stopSplitting} className="text-xs font-semibold text-ink underline underline-offset-2 self-start inline-flex items-center min-h-11 px-2 -mx-2">
          Use one debt instead
        </button>
      )}
    </div>
  );
}
