import type { Channel } from "./types";

export const CHANNELS: readonly Channel[] = [
  "CIMB", "GCASH", "MARIBANK", "MAYA", "RCBC",
  "RCBC CREDIT", "CASH", "WISE", "RCBC SAVINGS",
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
  WISE: "bg-emerald-200 text-emerald-950",
  "WISE/KLOOK": "bg-emerald-200 text-emerald-950", // legacy alias for existing data
  "RCBC SAVINGS": "bg-cyan-200 text-cyan-950",
  LANDBANK: "bg-green-700 text-green-50",
  UNIONBANK: "bg-orange-600 text-orange-50",
};

/** Display label for a channel — normalizes the legacy "WISE/KLOOK" to "WISE". */
export const channelLabel = (c: string): string => (c === "WISE/KLOOK" ? "WISE" : c);

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

/** Bundled brand logos (public/logos, sourced from Wikimedia Commons).
 *  Channels without a clean official asset (MARIBANK, CASH) fall back to
 *  the initial-letter circle. */
const LOGOS: Record<string, string> = {
  CIMB: "/logos/cimb.svg",
  GCASH: "/logos/gcash.svg",
  MAYA: "/logos/maya.svg",
  RCBC: "/logos/rcbc.svg",
  "RCBC CREDIT": "/logos/rcbc.svg",
  "RCBC SAVINGS": "/logos/rcbc.svg",
  WISE: "/logos/wise.svg",
  "WISE/KLOOK": "/logos/wise.svg",
  LANDBANK: "/logos/landbank.svg",
  UNIONBANK: "/logos/unionbank.svg",
};

/** Logo path for a channel, or undefined when it should use the initial circle. */
export const channelLogo = (c: string): string | undefined => LOGOS[c];

export const isBuiltinChannel = (name: string): boolean => name in CHIP;

export const channelChip = (c: Channel): string => CHIP[c] ?? "bg-gray-200 text-gray-800";

/** For values whose type isn't statically known (e.g. Firestore reads). Built-ins only. */
export const channelChipSafe = (c: string): string =>
  CHIP[c] ?? "bg-gray-200 text-gray-800";
