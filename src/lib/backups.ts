import type { Income, MonthLine } from "./types";

export const BACKUP_KEEP = 5;

/** One safety snapshot of a month's restorable state, stored at
 *  months/{key}/backups/{ISO timestamp}. */
export interface MonthBackup {
  id: string; // ISO timestamp = creation time
  reason: string; // what write triggered it ("template sync", "month generate", "restore")
  lines: MonthLine[];
  incomes: Income[]; // month one-off incomes subcollection
  receivedIncomes: Record<string, boolean>;
}

/** Backup ids (ISO timestamps) beyond the newest `keep` — the ones to delete. Pure. */
export function backupsToPrune(ids: readonly string[], keep: number): string[] {
  return [...ids].sort().reverse().slice(keep);
}
