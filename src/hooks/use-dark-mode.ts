"use client";

import { useState, useEffect } from "react";

/**
 * Watches `<html>` class for "dark" to detect theme changes.
 * Returns `isDark` boolean that updates live on toggle.
 * Charts use this as a key to force re-render on theme switch.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
