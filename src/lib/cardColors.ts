/** Brand colour per card/loan, used to mark payment lines (Eve, 2026-11-18). */
const BY_ID: Record<string, string> = {
  "rcbc-gold": "#C9A227",        // RCBC Visa Gold: gold
  "rcbc-classic": "#1F4E9E",     // RCBC Mastercard Classic: RCBC blue
  "maya-black": "#000000",       // Maya Black: black
  "chinabank-landers": "#C8102E",// Landers Chinabank: red
  "maribank-cc": "#F26B21",      // MariBank: orange
  "landers": "#00B464",          // Landers / Maya: Maya green
};

/** Colour for a debt id, or undefined when it has none. EastWest family = purple,
 *  Maya loans/Minis = Maya green. Pure. */
export function cardColor(debtId: string | undefined): string | undefined {
  if (!debtId) return undefined;
  if (BY_ID[debtId]) return BY_ID[debtId];
  if (debtId === "eastwest" || debtId.startsWith("ew-")) return "#6B2C91";
  if (debtId.startsWith("maya-")) return "#00B464";
  return undefined;
}

/** Brand colour per payment channel/account (Eve, 2026-11-18). */
const BY_CHANNEL: Record<string, string> = {
  "RCBC CREDIT": "#C9A227",   // RCBC Gold Visa: gold
  "RCBC": "#1F4E9E",          // RCBC: blue
  "RCBC SAVINGS": "#1F4E9E",  // RCBC Savings: blue
  "CIMB": "#C8102E",          // CIMB: red
  "GCASH": "#007DFE",         // GCash: blue
  "MAYA": "#00B464",          // Maya: green
  "MARIBANK": "#F26B21",      // MariBank: orange
  "WISE": "#9FE870",          // Wise: lime green
  "LANDBANK": "#00843D",      // Landbank: green
  "UNIONBANK": "#FF8000",     // UnionBank: orange
};

/** Colour for a line: its card/loan colour when debt-linked, else its channel's. Pure. */
export function lineColor(debtId: string | undefined, channel: string | undefined): string | undefined {
  return cardColor(debtId) ?? (channel ? BY_CHANNEL[channel] : undefined);
}
