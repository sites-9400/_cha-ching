import type { Channel } from "./types";

export const CHANNELS: readonly Channel[] = [
  "CIMB", "GCASH", "MARIBANK", "MAYA", "RCBC",
  "RCBC CREDIT", "CASH", "WISE/KLOOK", "RCBC SAVINGS",
  "LANDBANK", "UNIONBANK",
];

const CHIP: Record<string, string> = {
  CIMB: "bg-red-900 text-red-50",
  GCASH: "bg-blue-800 text-blue-50",
  MARIBANK: "bg-orange-300 text-orange-950",
  MAYA: "bg-green-800 text-green-50",
  RCBC: "bg-blue-200 text-blue-950",
  "RCBC CREDIT": "bg-yellow-200 text-yellow-950",
  CASH: "bg-gray-200 text-gray-800",
  "WISE/KLOOK": "bg-emerald-200 text-emerald-950",
  "RCBC SAVINGS": "bg-cyan-200 text-cyan-950",
  LANDBANK: "bg-green-700 text-green-50",
  UNIONBANK: "bg-orange-600 text-orange-50",
};

/** Swatch palette for custom accounts — key → chip classes. */
export const CHIP_PALETTE: { key: string; className: string }[] = [
  { key: "red", className: "bg-red-800 text-red-50" },
  { key: "orange", className: "bg-orange-600 text-orange-50" },
  { key: "amber", className: "bg-yellow-200 text-yellow-950" },
  { key: "green", className: "bg-green-700 text-green-50" },
  { key: "emerald", className: "bg-emerald-200 text-emerald-950" },
  { key: "teal", className: "bg-teal-700 text-teal-50" },
  { key: "cyan", className: "bg-cyan-200 text-cyan-950" },
  { key: "blue", className: "bg-blue-800 text-blue-50" },
  { key: "sky", className: "bg-sky-200 text-sky-950" },
  { key: "indigo", className: "bg-indigo-700 text-indigo-50" },
  { key: "purple", className: "bg-purple-700 text-purple-50" },
  { key: "pink", className: "bg-pink-300 text-pink-950" },
  { key: "gray", className: "bg-gray-200 text-gray-800" },
];

/** Chip classes for a custom account's palette color key (gray fallback). */
export const paletteChip = (key: string | undefined): string =>
  CHIP_PALETTE.find((p) => p.key === key)?.className ?? "bg-gray-200 text-gray-800";

/** Seed account numbers (baked defaults; user can override/extend in Settings → Accounts). */
export const DEFAULT_ACCOUNT_NUMBERS: Record<string, string> = {
  LANDBANK: "3017054634",
  UNIONBANK: "109421045705",
  RCBC: "9048170868",
  GCASH: "09106342597",
  MAYA: "09106342597",
  MARIBANK: "12018019577",
};

export const isBuiltinChannel = (name: string): boolean => name in CHIP;

export const channelChip = (c: Channel): string => CHIP[c] ?? "bg-gray-200 text-gray-800";

/** For values whose type isn't statically known (e.g. Firestore reads). Built-ins only. */
export const channelChipSafe = (c: string): string =>
  CHIP[c] ?? "bg-gray-200 text-gray-800";
