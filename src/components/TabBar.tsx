export type TabId = "month" | "add" | "debts" | "dashboard" | "settings";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "month", label: "This Month", icon: "📅" },
  { id: "debts", label: "Debts", icon: "💳" },
  { id: "add", label: "Add", icon: "➕" },
  { id: "dashboard", label: "Stats", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function TabBar({
  active, onChange,
}: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 flex justify-around pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${
            active === t.id ? "text-emerald-700 font-semibold" : "text-stone-500"
          }`}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
