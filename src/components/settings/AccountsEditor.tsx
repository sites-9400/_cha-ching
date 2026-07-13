import { useState } from "react";
import { CHIP_PALETTE, paletteChip } from "../../lib/channels";
import { addAccount, deleteAccount, setAccountNumber, updateAccount } from "../../lib/repo";
import type { Account } from "../../lib/types";
import type { AccountInfo } from "../../lib/accounts";
import { useAccounts } from "../AccountsProvider";
import ConfirmDialog from "../ConfirmDialog";

export default function AccountsEditor() {
  const { infos, accounts } = useAccounts();
  const [editing, setEditing] = useState<AccountInfo | "new" | null>(null);

  if (editing) {
    return <Form target={editing} accounts={accounts} onDone={() => setEditing(null)} />;
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Accounts</h2>
      <p className="text-xs text-stone-400 mb-3">Your account numbers for transfers — tap to edit.</p>
      <ul className="flex flex-col gap-2">
        {infos.map((a) => (
          <li key={String(a.name)}>
            <button onClick={() => setEditing(a)} className="w-full bg-white rounded-xl shadow p-3 flex items-center gap-3 text-left">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${a.chip}`}>{a.name}</span>
              <span className={`flex-1 text-sm tabular-nums ${a.number ? "text-stone-700" : "text-stone-400"}`}>
                {a.number ?? "add number"}
              </span>
              <span className="text-stone-300 text-xs">edit</span>
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing("new")} className="mt-3 text-sm font-semibold text-emerald-700">+ Add account</button>
    </div>
  );
}

function Form({ target, accounts, onDone }: { target: AccountInfo | "new"; accounts: Account[]; onDone: () => void }) {
  const isNew = target === "new";
  const info = isNew ? null : target;
  const custom = isNew || info!.custom; // new + custom accounts have editable name/color
  const [name, setName] = useState(isNew ? "" : String(info!.name));
  const [number, setNumber] = useState(isNew ? "" : info!.number ?? "");
  const savedColor = !isNew && info!.custom ? accounts.find((a) => a.id === info!.docId)?.color : undefined;
  const [color, setColor] = useState<string>(savedColor ?? "blue");
  const [confirmDel, setConfirmDel] = useState(false);

  const valid = name.trim() !== "";

  async function save() {
    if (!valid) return;
    if (isNew) {
      await addAccount({ name: name.trim(), number: number.trim() || undefined, color });
    } else if (info!.custom) {
      await updateAccount(info!.docId!, { name: name.trim(), number: number.trim() || undefined, color });
    } else {
      // built-in: only the number is editable, stored as an override doc
      const existing = accounts.find((a) => a.name === String(info!.name));
      await setAccountNumber(existing, String(info!.name), number.trim());
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{isNew ? "Add account" : `Edit ${info!.name}`}</h2>

      {custom ? (
        <input placeholder="Account name (e.g. SEABANK)" value={name} onChange={(e) => setName(e.target.value.toUpperCase())}
          className="text-sm border-b border-stone-300 outline-none pb-1" />
      ) : (
        <p className="text-sm text-stone-500">Built-in account — edit its number below.</p>
      )}

      <label className="flex items-center justify-between text-sm">Account number
        <input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)}
          className="w-44 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>

      {custom && (
        <div>
          <p className="text-sm mb-1">Chip color</p>
          <div className="flex flex-wrap gap-2">
            {CHIP_PALETTE.map((p) => (
              <button key={p.key} onClick={() => setColor(p.key)}
                className={`h-8 w-8 rounded-full ${p.className.split(" ")[0]} ${color === p.key ? "ring-2 ring-offset-2 ring-stone-800" : ""}`}
                aria-label={p.key} />
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">Preview:
            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${paletteChip(color)}`}>{name || "NAME"}</span>
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>

      {!isNew && info!.custom && (
        <button onClick={() => setConfirmDel(true)} className="text-sm text-red-500 font-medium mt-1">Delete account</button>
      )}
      {confirmDel && info && info.custom && (
        <ConfirmDialog
          title="Delete account?"
          message={`Removes ${info.name} from the account list. Lines still referencing it show a neutral chip.`}
          onConfirm={async () => { await deleteAccount(info.docId!); setConfirmDel(false); onDone(); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
