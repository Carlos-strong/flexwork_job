/**
 * Hook useUrlFilters — synchronise les filtres de recherche avec l'URL.
 *
 * Architecture plan5.md (section 3) :
 *   Filtres de recherche → URL (`searchParams`)
 *
 * Avantages :
 *   - Partage de lien (/missions?skill=plomberie&page=2)
 *   - Conservation des filtres au rechargement
 *   - Navigation précédente/suivante cohérente
 *
 * Usage :
 *   const { filters, setFilter, setFilters, clearFilters } = useUrlFilters({
 *     defaultValues: { status: "OPEN", page: "1" },
 *   });
 *   // filters = { status: "OPEN", skill: "plomberie", page: "2" }
 *   // setFilter("skill", "maçonnerie") → met à jour l'URL + state
 */
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

interface UseUrlFiltersOptions {
  /** Valeurs par défaut appliquées si le paramètre est absent de l'URL */
  defaultValues?: Record<string, string>;
}

export function useUrlFilters<T extends Record<string, string> = Record<string, string>>(
  options: UseUrlFiltersOptions = {}
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { defaultValues = {} } = options;

  // Lire tous les filtres depuis l'URL, avec fallback aux defaults
  const filters = useMemo(() => {
    const result: Record<string, string> = { ...defaultValues };
    for (const [key, value] of Array.from(searchParams.entries())) {
      result[key] = value;
    }
    return result as T;
  }, [searchParams, JSON.stringify(defaultValues)]);

  // Mettre à jour un filtre (Met à jour l'URL + re-render)
  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key as string, value);
      } else {
        params.delete(key as string);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Mettre à jour plusieurs filtres à la fois
  const setFilters = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Réinitialiser tous les filtres aux valeurs par défaut
  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(defaultValues)) {
      if (value) params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, JSON.stringify(defaultValues)]);

  return { filters, setFilter, setFilters, clearFilters };
}
