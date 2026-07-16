/**
 * Utilitaire de persistance des brouillons (localStorage).
 *
 * Architecture plan5.md :
 *   Brouillons → localStorage (auto-save toutes les 5s)
 *
 * Usage :
 *   const [draft, saveDraft, clearDraft] = useDraft<MissionDraft>('mission-create');
 *   // saveDraft est appelé automatiquement via useEffect toutes les 5s
 */

const DRAFT_PREFIX = "flexwork_draft_";

export function getDraftKey(entity: string, id?: string): string {
  return `${DRAFT_PREFIX}${entity}${id ? `_${id}` : ""}`;
}

/**
 * Sauvegarde un brouillon dans localStorage.
 */
export function saveDraft<T>(entity: string, data: T, id?: string): void {
  try {
    const key = getDraftKey(entity, id);
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage plein ou désactivé — silence
  }
}

/**
 * Charge un brouillon depuis localStorage.
 */
export function loadDraft<T>(entity: string, id?: string): T | null {
  try {
    const key = getDraftKey(entity, id);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Supprime un brouillon.
 */
export function clearDraft(entity: string, id?: string): void {
  try {
    const key = getDraftKey(entity, id);
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * Vérifie si un brouillon existe.
 */
export function hasDraft(entity: string, id?: string): boolean {
  try {
    return localStorage.getItem(getDraftKey(entity, id)) !== null;
  } catch {
    return false;
  }
}
