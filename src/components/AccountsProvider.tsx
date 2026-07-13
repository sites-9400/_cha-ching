import { createContext, useContext, useMemo } from "react";
import { useCollection } from "../hooks/useCollection";
import { accountsCol } from "../lib/paths";
import { mergeAccounts, type AccountInfo } from "../lib/accounts";
import type { Account, Channel } from "../lib/types";

interface AccountsCtx {
  accounts: Account[]; // raw Firestore docs (for the editor)
  infos: AccountInfo[]; // merged built-in + custom
  names: Channel[]; // for channel pickers
  chip: (name: string) => string;
  numberOf: (name: string) => string | undefined;
}
const Ctx = createContext<AccountsCtx | null>(null);

export const useAccounts = (): AccountsCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccounts outside AccountsProvider");
  return v;
};

export default function AccountsProvider({ children }: { children: React.ReactNode }) {
  const accounts = useCollection<Account>(accountsCol());
  const value = useMemo<AccountsCtx>(() => {
    const infos = mergeAccounts(accounts);
    const byName = new Map(infos.map((i) => [String(i.name), i]));
    return {
      accounts,
      infos,
      names: infos.map((i) => i.name),
      chip: (name) => byName.get(name)?.chip ?? "bg-gray-200 text-gray-800",
      numberOf: (name) => byName.get(name)?.number,
    };
  }, [accounts]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
