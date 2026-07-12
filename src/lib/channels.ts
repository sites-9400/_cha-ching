import type { Channel } from "./types";

export const CHANNELS: readonly Channel[] = [
  "CIMB", "GCASH", "MARIBANK", "MAYA", "RCBC",
  "RCBC CREDIT", "CASH", "WISE/KLOOK", "RCBC SAVINGS",
];

const CHIP: Record<Channel, string> = {
  CIMB: "bg-red-900 text-red-50",
  GCASH: "bg-blue-800 text-blue-50",
  MARIBANK: "bg-orange-300 text-orange-950",
  MAYA: "bg-green-800 text-green-50",
  RCBC: "bg-blue-200 text-blue-950",
  "RCBC CREDIT": "bg-yellow-200 text-yellow-950",
  CASH: "bg-gray-200 text-gray-800",
  "WISE/KLOOK": "bg-emerald-200 text-emerald-950",
  "RCBC SAVINGS": "bg-cyan-200 text-cyan-950",
};

export const channelChip = (c: Channel): string => CHIP[c];

/** For values whose type isn't statically known (e.g. Firestore reads). */
export const channelChipSafe = (c: string): string =>
  (CHIP as Record<string, string>)[c] ?? "bg-gray-200 text-gray-800";
