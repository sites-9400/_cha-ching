import { useCollection } from "../../hooks/useCollection";
import { useCollectionGroup } from "../../hooks/useCollectionGroup";
import { debtsCol, expensesCol } from "../../lib/paths";
import { toCsv, downloadCsv, type Column } from "../../lib/export";
import type { Debt } from "../../lib/types";
import type { PaymentRec } from "../DebtPlan";
import type { ExpenseInput } from "../../lib/repo";

interface Expense extends ExpenseInput { id: string }

export default function ExportData() {
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const expenses = useCollection<Expense>(expensesCol());

  const exports: { label: string; file: string; run: () => void }[] = [
    {
      label: "Expenses", file: "expenses.csv",
      run: () => downloadCsv("expenses.csv", toCsv(expenses, [
        { key: "date", label: "Date" }, { key: "amount", label: "Amount" },
        { key: "category", label: "Category" }, { key: "channel", label: "Channel" },
        { key: "note", label: "Note" },
      ] as Column<Expense>[])),
    },
    {
      label: "Debts", file: "debts.csv",
      run: () => downloadCsv("debts.csv", toCsv(debts, [
        { key: "name", label: "Name" }, { key: "currentBalance", label: "Balance" },
        { key: "startingBalance", label: "Starting" }, { key: "payoffOrder", label: "Order" },
        { key: "dueDay", label: "Due" }, { key: "minimum", label: "Minimum" },
        { key: "channel", label: "Channel" }, { key: "isBNPL", label: "BNPL" },
        { key: "active", label: "Active" },
      ] as Column<Debt>[])),
    },
    {
      label: "Debt payments", file: "payments.csv",
      run: () => downloadCsv("payments.csv", toCsv(payments, [
        { key: "debtId", label: "DebtId" }, { key: "monthKey", label: "Month" },
        { key: "cutoff", label: "Cutoff" }, { key: "amount", label: "Amount" },
      ] as Column<PaymentRec>[])),
    },
  ];

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Export CSV</h2>
      <ul className="flex flex-col gap-2">
        {exports.map((e) => (
          <li key={e.file}>
            <button onClick={e.run} className="w-full bg-white rounded-xl shadow p-3 flex items-center justify-between text-sm">
              {e.label}
              <span className="text-emerald-700 font-semibold">Download</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
