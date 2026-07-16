import dynamic from "next/dynamic";

// ──────────────────────────────────────────────
// Composants lourds — chargés uniquement quand nécessaire
// ──────────────────────────────────────────────

/** Wizard de création de mission (multi-étapes, formulaire lourd) */
export const MissionFormWizard = dynamic(
  () => import("@/components/forms/mission-form-wizard").then((m) => ({ default: m.MissionFormWizard })),
  {
    loading: () => <MissionFormSkeleton />,
    ssr: false, // Formulaire purement client-side
  }
);

/** Time Tracker (timer, état local uniquement) */
export const TimeTracker = dynamic(
  () => import("@/components/elements/time-tracker").then((m) => ({ default: m.TimeTracker })),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

/** File Uploader (File API navigateur seulement) */
export const FileUploader = dynamic(
  () => import("@/components/elements/file-uploader").then((m) => ({ default: m.FileUploader })),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false,
  }
);

/** Recherche de freelances (filtres + fetch + grid) */
export const FreelancerSearch = dynamic(
  () => import("@/components/elements/freelancer-search").then((m) => ({ default: m.FreelancerSearch })),
  {
    loading: () => <SearchSkeleton />,
    ssr: false,
  }
);

/** Bulle de chat flottante (WebSocket, hors écran serveur) */
export const FloatingChatBubble = dynamic(
  () => import("@/components/chat/floating-chat-bubble").then((m) => ({ default: m.FloatingChatBubble })),
  { ssr: false }
);

/** FAQ Accordion — chargé seulement sur la page FAQ */
export const FaqAccordion = dynamic(
  () => import("@/components/elements/faq-accordion").then((m) => ({ default: m.FaqAccordion })),
  { loading: () => <FaqSkeleton /> }
);

/** CandidatureList avec Optimistic UI */
export const CandidatureList = dynamic(
  () => import("@/components/elements/candidature-list-optimistic").then((m) => ({ default: m.CandidatureListOptimistic })),
  {
    loading: () => <ListSkeleton rows={3} />,
    ssr: false,
  }
);

/** Section Hero — rarement modifiée, peut être lazy */
export const HeroSection = dynamic(
  () => import("@/components/elements/hero-section").then((m) => ({ default: m.HeroSection })),
  { ssr: true } // SSR pour le SEO
);

/** Section Stats — compteurs animés */
export const StatsSection = dynamic(
  () => import("@/components/elements/stats-section").then((m) => ({ default: m.StatsSection })),
  { loading: () => <StatsSkeleton /> }
);

// ──────────────────────────────────────────────
// Skeletons de chargement
// ──────────────────────────────────────────────

function MissionFormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-1">
            <div className="h-2 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-8 space-y-4">
        <div className="h-7 w-3/4 bg-muted rounded" />
        <div className="h-4 w-1/2 bg-muted rounded" />
        <div className="h-12 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-border p-6 animate-pulse">
      <div className="h-5 w-32 bg-muted rounded mb-4" />
      <div className="h-24 bg-muted rounded" />
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="flex-1 h-10 bg-muted rounded-lg" />
        <div className="w-48 h-10 bg-muted rounded-lg" />
        <div className="w-40 h-10 bg-muted rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-5 w-48 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-20 bg-muted rounded-full" />
            <div className="h-5 w-14 bg-muted rounded-full" />
          </div>
          <div className="h-3 w-2/3 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function FaqSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 bg-muted rounded-lg" />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border p-8 text-center">
          <div className="h-10 w-16 bg-muted rounded mx-auto" />
          <div className="h-4 w-24 bg-muted rounded mx-auto mt-2" />
        </div>
      ))}
    </div>
  );
}
