/**
 * Fetcher générique pour TanStack Query.
 *
 * Utilisation côté client uniquement (le QueryProvider est en "use client").
 * Retourne parsed.data ou parsed selon la structure de l'API gateway.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}: ${res.statusText}`);
  }

  const parsed = await res.json();

  // L'API gateway wrapper renvoie { success, data } ou directement le body
  if (parsed && typeof parsed === "object" && "success" in parsed && "data" in parsed) {
    return parsed.data as T;
  }

  return parsed as T;
}
