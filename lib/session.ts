import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Session mise en cache par requête via React cache().
 * Évite les appels BDD redondants quand getServerSession est appelé
 * plusieurs fois dans la même requête (layout + page + composants).
 */
export const getSession = cache(async () => {
  return getServerSession(authOptions);
});

/**
 * Récupère le profil actif de l'utilisateur courant (avec cache).
 */
export async function getActiveProfile(): Promise<string | null> {
  const session = await getSession();
  return (session?.user as { activeProfile?: string } | undefined)?.activeProfile ?? null;
}

/**
 * Vérifie si l'utilisateur a un profil freelance actif.
 */
export async function isFreelancer(): Promise<boolean> {
  const profile = await getActiveProfile();
  return profile === "FREELANCER";
}

/**
 * Vérifie si l'utilisateur a un profil client actif.
 */
export async function isClient(): Promise<boolean> {
  const profile = await getActiveProfile();
  return profile === "CLIENT";
}

/**
 * Vérifie si l'utilisateur est authentifié (avec cache).
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}
