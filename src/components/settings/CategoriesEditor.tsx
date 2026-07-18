import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { categoriesCol } from "../../lib/paths";
import { addCategory, updateCategory, deleteCategory, setCategoryBudget } from "../../lib/repo";
import { adjacentSwap } from "../../lib/reorder";
import type { Category } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

export default function CategoriesEditor() {
  const cats = useCollection<Category>(categoriesCol());
  const sorted = [...cats].sort((a, b) => a.order - b.order);
  const [newName, setNewName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim()) return;
    const maxOrder = sorted.reduce((m, c) => Math.max(m, c.order), 0);
    await addCategory({ name: newName.trim(), order: maxOrder + 1 });
    setNewName("");
  }
  async function move(index: number, dir: -1 | 1) {
    const pair = adjacentSwap(sorted, index, dir, "order");
    if (!pair) return;
    await Promise.all(pair.map((p) => updateCategory(p.id, { order: p.order })));
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Categories</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((c, i) => (
          <li key={c.id} className="bg-white rounded-xl shadow p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex flex-col">
                <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-stone-400 disabled:opacity-20 leading-none">▲</button>
                <button onClick={() => void move(i, 1)} disabled={i === sorted.length - 1} className="text-stone-400 disabled:opacity-20 leading-none">▼</button>
              </span>
              <input defaultValue={c.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) void updateCategory(c.id, { name: e.target.value.trim() }); }}
                className="flex-1 text-sm outline-none border-b border-transparent focus:border-stone-300" />
              <button onClick={() => setConfirmId(c.id)} className="text-red-500 text-xs px-1">✕</button>
            </div>
            <label className="flex items-center justify-between text-xs text-stone-400 pl-5">
              Monthly budget
              <input
                type="number" inputMode="decimal" placeholder="—"
                defaultValue={c.budget ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value;
                  // Blank (or 0) clears the budget outright; deleteField happens in the repo.
                  const budget = raw === "" || Number(raw) === 0 ? null : Number(raw);
                  if ((budget ?? undefined) === c.budget) return;
                  void setCategoryBudget(c.id, budget);
                }}
                className="w-24 text-right border-b border-stone-200 outline-none tabular-nums text-sm text-stone-700"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 text-sm border-b border-stone-300 outline-none" />
        <button onClick={() => void add()} disabled={!newName.trim()} className="text-sm font-semibold text-emerald-700 disabled:opacity-40">Add</button>
      </div>
      {confirmId && (
        <ConfirmDialog title="Delete category?" message="Quick Add will no longer suggest it."
          onConfirm={async () => { await deleteCategory(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}
