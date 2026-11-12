"use client";

import { useEffect } from "react";
import { applyTheme, readThemePreference, subscribeTheme } from "@/lib/theme-client";
import type { ThemePreference } from "@/lib/theme";

export function ThemeSync({ saved }: { saved: ThemePreference }) {
  useEffect(() => {
    if (readThemePreference() !== saved) applyTheme(saved);
  }, [saved]);

  useEffect(() => subscribeTheme(() => {}), []);

  return null;
}
