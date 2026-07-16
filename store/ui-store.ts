/**
 * Store UI — état de l'interface utilisateur.
 *
 * Architecture plan5.md :
 *   Préférences (thème, langue) → localStorage ou cookie
 *   Position du scroll → sessionStorage
 */
import { create } from "zustand";

type Theme = "light" | "dark" | "system";
type SidebarSection = "dashboard" | "messages" | "missions" | "candidatures" | "contrats" | "paiements" | "profil";

interface UIState {
  /** Thème actif */
  theme: Theme;
  /** Section sidebar ouverte */
  activeSidebarSection: SidebarSection | null;
  /** Modal ouvert (stocke le nom du modal, null = fermé) */
  activeModal: string | null;
  /** Sidebar réduite */
  sidebarCollapsed: boolean;
  /** ID de la dernière mission consultée (restauration scroll) */
  scrollPositions: Record<string, number>;

  // Actions
  setTheme: (theme: Theme) => void;
  setActiveSidebarSection: (section: SidebarSection | null) => void;
  openModal: (modal: string) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  saveScrollPosition: (key: string, position: number) => void;
  getScrollPosition: (key: string) => number;
}

const THEME_KEY = "flexwork_theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || "system";
  } catch {
    return "system";
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  activeSidebarSection: null,
  activeModal: null,
  sidebarCollapsed: false,
  scrollPositions: {},

  setTheme: (theme) => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },

  setActiveSidebarSection: (section) => set({ activeSidebarSection: section }),

  openModal: (modal) => set({ activeModal: modal }),

  closeModal: () => set({ activeModal: null }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  saveScrollPosition: (key, position) => {
    try { sessionStorage.setItem(`scroll_${key}`, String(position)); } catch { /* ignore */ }
    set((state) => ({
      scrollPositions: { ...state.scrollPositions, [key]: position },
    }));
  },

  getScrollPosition: (key) => {
    const fromState = get().scrollPositions[key];
    if (fromState !== undefined) return fromState;
    try {
      return parseInt(sessionStorage.getItem(`scroll_${key}`) || "0", 10);
    } catch {
      return 0;
    }
  },
}));
