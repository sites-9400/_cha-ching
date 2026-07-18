# Cha-Ching — Dark Mode — Design Spec

**Date:** 2026-07-18
**Owner:** Eve (gamaliel)
**Status:** Approved in-session (override layer + System/Light/Dark)

## Design

**Approach: theme override layer.** The app's light palette is consistent
(white cards, `stone-50/100` surfaces, `stone-*` text), so dark mode is a CSS
layer in `src/index.css` scoped under `html.dark` that remaps those recurring
utilities to a dark stone palette (cards ≈ stone-900, page bg ≈ stone-950,
text lightened, borders/dividers darkened, shadows reduced). Account chips,
emerald accents, and red/amber alerts keep their colors (verified for
contrast; chip text may darken slightly via the layer if needed). No
per-component `dark:` variants.

**Mode selection: System / Light / Dark** segmented control at the top of
Settings (above the section list, styled like existing pill toggles).

- Stored in `localStorage("theme")`: `"system" | "light" | "dark"`; default
  `"system"`.
- A small `src/lib/theme.ts` applies it: sets/removes the `dark` class on
  `document.documentElement`; for `system`, follows
  `matchMedia("(prefers-color-scheme: dark)")` including live changes.
  Applied on startup (main.tsx) before render to avoid a light flash.
- `<meta name="theme-color">` updated per effective mode so the iOS status
  bar matches.

## Error handling

- Unknown/corrupt stored value → treated as `system`.
- `matchMedia` unavailable → falls back to light.

## Testing

`theme.ts` resolution logic (stored value + system preference → effective
mode) unit-tested. Visual pass on phone: every tab, dialogs, chips, calendar,
bars in both modes.

## Out of scope

- Per-component dark: variant pass; custom accent themes; scheduling.
