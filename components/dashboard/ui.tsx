import React from "react";

/**
 * Kit de primitives partagées du tableau de bord.
 *
 * Objectif : unifier la structure (en-têtes, cartes de stats, sections, états
 * vides) sur toutes les pages du dashboard, sur la charte existante
 * (#1A1916 encre, #5A5750 atténué, #E2E0D9 bordures, #2D5BE3 bleu, cartes 16px).
 *
 * Composants purement présentationnels (aucun hook) → utilisables aussi bien
 * dans un Server Component que dans un Client Component.
 */

// ── Palette de tons pour les accents (stats, icônes) ──
export type Tone = "blue" | "green" | "purple" | "amber" | "red" | "neutral";

const TONE_ACCENT: Record<Tone, { text: string; bg: string }> = {
  blue: { text: "text-[#2D5BE3]", bg: "bg-[#EEF2FD]" },
  green: { text: "text-[#0F6E56]", bg: "bg-[#E1F5EE]" },
  purple: { text: "text-[#6D28D9]", bg: "bg-[#F1EBFE]" },
  amber: { text: "text-[#854F0B]", bg: "bg-[#FAEEDA]" },
  red: { text: "text-[#A32D2D]", bg: "bg-[#FCEBEB]" },
  neutral: { text: "text-[#1A1916]", bg: "bg-[#F1EFE8]" },
};

// ═══════════════════════════════════════════════════════════
// PageHeader — en-tête de page uniforme (titre + sous-titre + actions)
// ═══════════════════════════════════════════════════════════

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-[#5A5750]">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-[640px] text-[14px] text-[#5A5750]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StatCard — carte de statistique (icône + valeur + libellé)
// ═══════════════════════════════════════════════════════════

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  hint?: React.ReactNode;
}) {
  const accent = TONE_ACCENT[tone];
  return (
    <div className="rounded-[14px] border border-[#E2E0D9] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#5A5750]">
          {label}
        </p>
        {icon != null && (
          <span
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] text-[15px] ${accent.bg}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-2 text-[24px] font-bold leading-none ${accent.text}`}>{value}</p>
      {hint != null && <p className="mt-1.5 text-[12px] text-[#9C9A95]">{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SectionCard — carte de section avec en-tête (titre + compteur + aside)
// ═══════════════════════════════════════════════════════════

export function SectionCard({
  title,
  count,
  aside,
  children,
  bodyClassName,
  className,
}: {
  title?: React.ReactNode;
  count?: number;
  aside?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  const showHeader = title != null || aside != null;
  return (
    <div
      className={`overflow-hidden rounded-[16px] border border-[#E2E0D9] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] ${className ?? ""}`}
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E0D9] px-5 py-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            {typeof count === "number" && (
              <span className="inline-flex items-center justify-center rounded-[20px] border border-[#E2E0D9] bg-[#FAFAF8] px-2.5 py-1 text-[11px] text-[#5A5750]">
                {count > 0 && count < 10 ? `0${count}` : count}
              </span>
            )}
            {title}
          </div>
          {aside && <div className="flex items-center gap-2 text-[12px] text-[#9C9A95]">{aside}</div>}
        </div>
      )}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EmptyState — état vide uniforme (icône + titre + description + action)
// ═══════════════════════════════════════════════════════════

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  dashed = true,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[16px] px-6 py-16 text-center ${
        dashed ? "border border-dashed border-[#E2E0D9]" : ""
      }`}
    >
      <p className="mb-3 text-4xl">{icon}</p>
      <h3 className="text-[17px] font-semibold text-[#1A1916]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-[420px] text-[14px] text-[#5A5750]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
