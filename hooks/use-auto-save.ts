/**
 * Hook useAutoSave — sauvegarde automatique d'un brouillon toutes les 5s.
 *
 * Architecture plan5.md (section 4) :
 *   Brouillons → localStorage (auto-save toutes les 5s)
 *
 * Cycle de vie :
 *   1. Au montage : restore depuis localStorage (si `restore` = true)
 *   2. Pendant l'édition : save toutes les 5s si des changements sont détectés
 *   3. À la soumission réussie : clear le brouillon
 *   4. À la fermeture de l'onglet : save immédiat (beforeunload)
 *
 * Usage :
 *   const { restored, clearDraft, hasSavedDraft } = useAutoSave('mission-create', formData);
 *   // restored contient les données restaurées au montage (ou null)
 *   // clearDraft() à appeler après soumission réussie
 *   // hasSavedDraft indique si un brouillon existait
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadDraft, saveDraft, clearDraft as clearDraftStorage, hasDraft } from "@/lib/draft-persist";

const AUTO_SAVE_INTERVAL = 5000; // 5 secondes

export function useAutoSave<T extends Record<string, unknown>>(
  entity: string,
  data: T,
  id?: string
) {
  const prevDataRef = useRef<string>("");
  const [restored, setRestored] = useState<T | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const initializedRef = useRef(false);

  // Au montage : restaurer le brouillon
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const saved = loadDraft<T>(entity, id);
    if (saved) {
      setRestored(saved);
      setHasSavedDraft(true);
    }
  }, [entity, id]);

  // Auto-save toutes les 5 secondes si les données ont changé
  useEffect(() => {
    const serialized = JSON.stringify(data);
    if (serialized === prevDataRef.current) return;
    prevDataRef.current = serialized;

    const timer = setInterval(() => {
      saveDraft(entity, data, id);
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [entity, data, id]);

  // Sauvegarde immédiate à la fermeture de l'onglet
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraft(entity, data, id);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [entity, data, id]);

  const clear = useCallback(() => {
    clearDraftStorage(entity, id);
    setHasSavedDraft(false);
  }, [entity, id]);

  return { restored, clearDraft: clear, hasSavedDraft };
}
