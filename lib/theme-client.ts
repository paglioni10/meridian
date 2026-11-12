import { THEME_COOKIE, isThemePreference, type ThemePreference } from "@/lib/theme";

export const THEME_EVENT = "meridian:theme";

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemePreference(): ThemePreference {
  const value = document.documentElement.getAttribute("data-theme-pref");
  return isThemePreference(value) ? value : "system";
}

export function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  const dark = pref === "dark" || (pref === "system" && prefersDark());
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.setAttribute("data-theme-pref", pref);
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (readThemePreference() === "system") applyTheme("system");
  };
  media.addEventListener("change", onMedia);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    media.removeEventListener("change", onMedia);
    window.removeEventListener(THEME_EVENT, callback);
  };
}
