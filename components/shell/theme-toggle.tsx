"use client";

import { useSyncExternalStore, useTransition } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { setTheme } from "@/features/settings/actions";
import { applyTheme, readThemePreference, subscribeTheme } from "@/lib/theme-client";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribeTheme, readThemePreference, () => null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function choose(next: ThemePreference) {
    applyTheme(next);
    startTransition(async () => {
      try {
        await setTheme(next);
      } catch {
        toast("Tema aplicado só neste aparelho.", "alert");
      }
    });
  }

  return <Segmented label="Tema" options={OPTIONS} value={pref} onChange={choose} className={className} />;
}
