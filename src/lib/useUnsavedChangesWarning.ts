import { useEffect } from "react";

/** Warn before the page actually closes/reloads while there is unsaved work.
 * (Plain tab switches never trigger this — they are already safe; this guards
 * the destructive cases: closing the tab, reloading, navigating away.) */
export function useUnsavedChangesWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set for the prompt to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
