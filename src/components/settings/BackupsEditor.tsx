import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { currentMonthKey, monthLabel } from "../../lib/clock";
import { addMonths } from "../../lib/format";
import { monthBackups } from "../../lib/paths";
import { restoreMonthBackup } from "../../lib/repo";
import type { MonthBackup } from "../../lib/backups";
import ConfirmDialog from "../ConfirmDialog";

/** Safety snapshots taken before any month rewrite; restore replaces the
 *  month's lines/incomes/ticks with the snapshot (after snapshotting current). */
export default function BackupsEditor() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const backups = useCollection<MonthBackup>(monthBackups(monthKey));
  const sorted = [...backups].sort((a, b) => b.id.localeCompare(a.id));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Backups</h2>
      <p className="text-xs text-stone-400 mb-3">
        Snapshots taken automatically before anything rewrites a month's lines. Restoring
        replaces the month's lines, one-offs, and ticks with the snapshot.
      </p>
      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => setMonthKey((k) => addMonths(k, -1))} className="h-8 w-8 rounded-full bg-white shadow text-emerald-700">‹</button>
        <span className="text-sm font-semibold min-w-[8rem] text-center">{monthLabel(monthKey)}</span>
        <button onClick={() => setMonthKey((k) => addMonths(k, 1))} className="h-8 w-8 rounded-full bg-white shadow text-emerald-700">›</button>
      </div>
      <ul className="flex flex-col gap-2">
        {sorted.map((b) => {
          const ticked = b.lines.filter((l) => l.status !== "").length;
          return (
            <li key={b.id} className="bg-white rounded-xl shadow p-3 flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-sm">{new Date(b.id).toLocaleString()}</span>
                <span className="block text-[11px] text-stone-400">
                  before {b.reason} · {b.lines.length} lines · {ticked} ticked
                </span>
              </span>
              <button
                onClick={() => setConfirmId(b.id)}
                disabled={busy}
                className="text-xs font-semibold text-emerald-700 shrink-0 disabled:opacity-40"
              >Restore</button>
            </li>
          );
        })}
        {sorted.length === 0 && <li className="text-sm text-stone-400 px-1">No snapshots for {monthLabel(monthKey)} yet.</li>}
      </ul>
      {confirmId && (
        <ConfirmDialog
          title={`Restore ${monthLabel(monthKey)}?`}
          message="Current lines and ticks will be replaced by this snapshot. The current state is snapshotted first, so you can restore back."
          onConfirm={async () => {
            setBusy(true);
            try {
              await restoreMonthBackup(monthKey, confirmId);
            } finally {
              setBusy(false);
              setConfirmId(null);
            }
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
