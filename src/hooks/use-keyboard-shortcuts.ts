"use client";

import { useEffect } from "react";

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  /** If true, fires even when inside an input/textarea */
  global?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.key.toLowerCase() !== e.key.toLowerCase()) continue;
        if (shortcut.meta && !(e.metaKey || e.ctrlKey)) continue;
        if (shortcut.ctrl && !e.ctrlKey) continue;
        if (shortcut.shift && !e.shiftKey) continue;

        // Skip non-global shortcuts when inside form elements
        if (isInput && !shortcut.global) continue;

        e.preventDefault();
        shortcut.handler();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
