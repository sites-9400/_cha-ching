import { CHANNELS, DEFAULT_ACCOUNT_NUMBERS, channelChipSafe, paletteChip } from "./channels";
import type { Account, Channel } from "./types";

export interface AccountInfo {
  name: Channel;
  number?: string;
  chip: string;
  custom: boolean;
  docId?: string; // the Firestore doc id, when one exists (override or custom)
}

/**
 * Merge built-in channels with the user's Firestore account docs. Built-ins keep
 * their fixed chip + baked default number (a doc may override the number); docs
 * whose name isn't a built-in are appended as custom accounts with a palette chip.
 * Pure.
 */
export function mergeAccounts(custom: Account[]): AccountInfo[] {
  const builtinNames = CHANNELS.map((c) => String(c));
  const byName = new Map(custom.map((a) => [a.name, a]));

  const builtin: AccountInfo[] = CHANNELS.map((name) => {
    const doc = byName.get(String(name));
    return {
      name,
      number: doc?.number ?? DEFAULT_ACCOUNT_NUMBERS[String(name)],
      chip: channelChipSafe(String(name)),
      custom: false,
      docId: doc?.id,
    };
  });

  const customInfos: AccountInfo[] = custom
    .filter((a) => !builtinNames.includes(a.name))
    .map((a) => ({
      name: a.name,
      number: a.number,
      chip: paletteChip(a.color),
      custom: true,
      docId: a.id,
    }));

  return [...builtin, ...customInfos];
}
