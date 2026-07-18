export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const THEME_COLOR = { light: "#0E5A54", dark: "#0c0a09" } as const;

/** Parse a stored preference; anything unrecognized falls back to "system". Pure. */
export function readThemePref(raw: string | null): ThemePref {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** Resolve a preference against the OS setting to the mode actually shown. Pure. */
export function effectiveTheme(pref: ThemePref, systemDark: boolean): "light" | "dark" {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

function systemDark(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePref): void {
  const mode = effectiveTheme(pref, systemDark());
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[mode]);
}

export function getThemePref(): ThemePref {
  return readThemePref(localStorage.getItem(STORAGE_KEY));
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref);
  apply(pref);
}

/** Apply the stored preference now and re-apply on OS appearance changes (for "system"). */
export function initTheme(): void {
  apply(getThemePref());
  if (typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => apply(getThemePref()));
  }
}
