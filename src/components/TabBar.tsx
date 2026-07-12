import type { ComponentType } from "react";
import { BarChartIcon, CalendarIcon, CreditCardIcon, PlusIcon, SettingsIcon } from "./icons";

export type TabId = "month" | "add" | "debts" | "dashboard" | "settings";

const TABS: { id: TabId; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "month", label: "This Month", Icon: CalendarIcon },
  { id: "debts", label: "Debts", Icon: CreditCardIcon },
  { id: "add", label: "Add", Icon: PlusIcon },
  { id: "dashboard", label: "Stats", Icon: BarChartIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function TabBar({
  active, onChange,
}: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 flex justify-around pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${
            active === id ? "text-emerald-700 font-semibold" : "text-stone-500"
          }`}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon className="w-6 h-6" />
          {label}
        </button>
      ))}
    </nav>
  );
}
