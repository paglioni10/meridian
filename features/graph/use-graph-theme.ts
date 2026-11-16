"use client";

import { useSyncExternalStore } from "react";
import type { GraphTheme } from "./draw-node";

const FALLBACK: GraphTheme = {
  paper: "#F4F2EC",
  ink: "#111111",
  muted: "#6b6b6b",
  rule: "#cfcac0",
  blue: "#1F3FFF",
  red: "#E4002B",
};

let cache: GraphTheme = FALLBACK;
let cacheKey = "";

function read(): GraphTheme {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const next = {
    paper: get("--paper", FALLBACK.paper),
    ink: get("--ink", FALLBACK.ink),
    muted: get("--ink-muted", FALLBACK.muted),
    rule: get("--rule", FALLBACK.rule),
    blue: get("--blue", FALLBACK.blue),
    red: get("--red", FALLBACK.red),
  };
  const key = Object.values(next).join("|");
  if (key !== cacheKey) {
    cache = next;
    cacheKey = key;
  }
  return cache;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class", "style"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function useGraphTheme(): GraphTheme {
  return useSyncExternalStore(subscribe, read, () => FALLBACK);
}
