/**
 * Store auth — état de session côté client.
 * Complète NextAuth en rendant accessible l'utilisateur connecté,
 * le profil actif et l'état de chargement sans passer par useSession().
 *
 * Architecture plan5.md :
 *   Utilisateur connecté → Zustand + cookie HTTP Only (NextAuth)
 */
import { create } from "zustand";

export type ActiveProfile = "FREELANCER" | "CLIENT" | "ADMIN" | null;

interface AuthState {
  /** ID unique de l'utilisateur */
  userId: string | null;
  /** Email de l'utilisateur */
  email: string | null;
  /** Nom affiché */
  name: string | null;
  /** Profil actif (FREELANCER | CLIENT | ADMIN) */
  activeProfile: ActiveProfile;
  /** Indique si la session est en cours de chargement */
  loading: boolean;

  // Actions
  setUser: (user: { id: string; email: string; name: string; activeProfile: ActiveProfile }) => void;
  setActiveProfile: (profile: ActiveProfile) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  name: null,
  activeProfile: null,
  loading: true,

  setUser: (user) =>
    set({
      userId: user.id,
      email: user.email,
      name: user.name,
      activeProfile: user.activeProfile,
      loading: false,
    }),

  setActiveProfile: (profile) => set({ activeProfile: profile }),

  setLoading: (loading) => set({ loading }),

  clear: () =>
    set({
      userId: null,
      email: null,
      name: null,
      activeProfile: null,
      loading: false,
    }),
}));
