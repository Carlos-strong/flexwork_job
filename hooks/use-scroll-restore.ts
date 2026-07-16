/**
 * Hook useScrollRestore — restaure la position du scroll après navigation.
 *
 * Architecture plan5.md (section 7) :
 *   Position du scroll → sessionStorage
 *
 * Deux modes :
 *   1. Container scroll (défaut) : attachez le ref à un <div> scrollable
 *      const { ref, handleScroll } = useScrollRestore('key');
 *      <div ref={ref} onScroll={handleScroll}> ... </div>
 *
 *   2. Page scroll (mode="page") : restaure window.scrollY automatiquement
 *      useScrollRestore('mission-list', { mode: 'page' });
 *      // utilise useEffect avec window pour save/restore
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/store/ui-store";

interface Options {
  mode?: "container" | "page";
}

export function useScrollRestore(key: string, options: Options = {}) {
  const { mode = "container" } = options;
  const ref = useRef<HTMLDivElement>(null);
  const saveScrollPosition = useUIStore((s) => s.saveScrollPosition);
  const getScrollPosition = useUIStore((s) => s.getScrollPosition);

  // Restaurer la position au montage
  useEffect(() => {
    const saved = getScrollPosition(key);
    if (saved > 0) {
      if (mode === "page") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
        });
      } else if (ref.current) {
        requestAnimationFrame(() => {
          ref.current?.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Sauvegarder au scroll
  const handleScroll = useCallback(() => {
    if (mode === "page") {
      saveScrollPosition(key, window.scrollY);
    } else if (ref.current) {
      saveScrollPosition(key, ref.current.scrollTop);
    }
  }, [key, saveScrollPosition, mode]);

  // En mode page, attacher l'événement scroll à window
  useEffect(() => {
    if (mode !== "page") return;
    const onScroll = () => saveScrollPosition(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key, saveScrollPosition, mode]);

  return { ref, handleScroll };
}
