/**
 * AutoRefresh — composant invisible qui rafraîchit la page serveur
 * parente toutes les N millisecondes via router.refresh().
 *
 * S'intègre dans n'importe quelle page server component pour
 * maintenir les données à jour sans polling explicite dans
 * les composants de données.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** Intervalle en ms (défaut: 10 000 = 10 secondes) */
  intervalMs?: number;
}

export function AutoRefresh({ intervalMs = 10_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
