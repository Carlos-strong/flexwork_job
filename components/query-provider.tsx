/**
 * Provider TanStack Query pour le cache des données serveur.
 *
 * Architecture plan5.md :
 *   Missions, Profil, Chat → TanStack Query (cache + revalidation)
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const STALE_TIME = 1000 * 30;      // 30s — données considérées fraîches
const GC_TIME = 1000 * 60 * 10;     // 10 min — garbage collection

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME,
            gcTime: GC_TIME,
            retry: 1,
            refetchOnWindowFocus: true,   // rafraîchir quand l'utilisateur revient sur l'onglet
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
