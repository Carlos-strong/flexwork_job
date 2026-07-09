import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

const WORKFLOW_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  OPEN: "Ouverte",
  PROPOSALS_RECEIVED: "Candidatures reçues",
  FREELANCER_SELECTED: "Freelance sélectionné",
  CONTRACT_CREATED: "Contrat créé",
  FUNDED: "Financée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  APPROVED: "Approuvée",
  PAID: "Payée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

const WORK_MODE_LABELS: Record<string, string> = {
  REMOTE: "Télétravail",
  ON_SITE: "Sur site",
  HYBRID: "Hybride",
};

const BUDGET_TYPE_LABELS: Record<string, string> = {
  FIXED: "Forfait fixe",
  HOURLY: "Taux horaire",
  OPEN_QUOTE: "Devis sur mesure",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  DEBUTANT: "Débutant",
  UN_A_TROIS_ANS: "1 à 3 ans",
  TROIS_A_CINQ_ANS: "3 à 5 ans",
  PLUS_DE_CINQ_ANS: "Plus de 5 ans",
};

async function getMissionDetail(id: string) {
  return prisma.mission.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  });
}

function formatDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function MissionDetailPage({ params }: { params: { id: string } }) {
  const mission = await getMissionDetail(params.id);
  if (!mission) notFound();

  const statusLabel = WORKFLOW_LABELS[mission.status] ?? mission.status;
  const workModeLabel = WORK_MODE_LABELS[mission.workMode] ?? mission.workMode;
  const budgetTypeLabel = BUDGET_TYPE_LABELS[mission.budgetType] ?? mission.budgetType;
  const experienceLabel = mission.experienceRequise ? EXPERIENCE_LABELS[mission.experienceRequise] : null;

  return (
    <div
      className="max-w-[860px] mx-auto"
      style={{ fontFamily: "var(--font-space-grotesk, Inter, sans-serif)", color: "#14213D" }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-[#6B7280] mb-5">
        <Link href="/dashboard/client/missions" className="hover:text-[#1F7A5C] transition-colors">
          Mes missions
        </Link>
        <span>/</span>
        <span className="text-[#14213D] font-medium truncate max-w-[280px]">{mission.title}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-[16px] border border-[#DADFDD] bg-white overflow-hidden mb-5">
        <div className="px-7 pt-7 pb-5 border-b border-[#DADFDD]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1"
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
              >
                Fiche mission
              </p>
              <h1
                className="text-[26px] font-medium tracking-[-0.02em] leading-tight"
                style={{ fontFamily: "var(--font-fraunces, serif)" }}
              >
                {mission.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* Status badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{
                    background: ["IN_PROGRESS", "FUNDED", "APPROVED"].includes(mission.status)
                      ? "#E4F1EC"
                      : ["CANCELLED"].includes(mission.status)
                      ? "#F8E7E4"
                      : "#F5F6F4",
                    color: ["IN_PROGRESS", "FUNDED", "APPROVED"].includes(mission.status)
                      ? "#1F7A5C"
                      : ["CANCELLED"].includes(mission.status)
                      ? "#B23A2E"
                      : "#6B7280",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel}
                </span>
                {/* App count */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{ background: "#F5F6F4", color: "#14213D" }}
                >
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                  </svg>
                  {mission._count.applications} candidature{mission._count.applications !== 1 ? "s" : ""}
                </span>
                {/* Created */}
                <span className="text-[12px] text-[#6B7280]">
                  Publiée le {formatDate(mission.createdAt)}
                </span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/dashboard/client/missions/${params.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border border-[#DADFDD] text-[#14213D] hover:bg-[#F5F6F4] transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Modifier
              </Link>
              {mission._count.applications > 0 && (
                <Link
                  href={`/dashboard/client/candidatures?mission=${params.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
                  style={{ background: "#1F7A5C" }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Gérer les candidatures
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-7 py-6 border-b border-[#DADFDD]">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-3">
            Description
          </h2>
          <p className="text-[14.5px] leading-[1.7] text-[#14213D] whitespace-pre-wrap">
            {mission.description}
          </p>
        </div>

        {/* Key info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-[#DADFDD]">
          <InfoCell label="Budget" value={
            mission.budgetType === "OPEN_QUOTE"
              ? "Devis sur mesure"
              : mission.budget
              ? `${mission.budget.toLocaleString("fr-FR")} ${mission.currency ?? "XAF"}`
              : "—"
          } sub={budgetTypeLabel} />
          <InfoCell label="Durée estimée" value={mission.duration ?? "—"} />
          <InfoCell label="Mode de travail" value={workModeLabel} sub={
            mission.workMode === "HYBRID" && mission.hybridDaysPerWeek
              ? `${mission.hybridDaysPerWeek} jour(s)/sem. sur site`
              : undefined
          } />
          {(mission.missionCity || mission.missionCountry) && (
            <InfoCell
              label="Localisation"
              value={[mission.missionCity, mission.missionCountry].filter(Boolean).join(", ")}
            />
          )}
          {experienceLabel && <InfoCell label="Expérience requise" value={experienceLabel} />}
          {mission.expiresAt && (
            <InfoCell
              label="Expiration"
              value={formatDate(mission.expiresAt) ?? "—"}
              highlight={new Date(mission.expiresAt) < new Date()}
            />
          )}
          {mission.missionStartDate && (
            <InfoCell label="Début souhaité" value={formatDate(mission.missionStartDate) ?? "—"} />
          )}
          {mission.missionEndDate && (
            <InfoCell label="Fin souhaitée" value={formatDate(mission.missionEndDate) ?? "—"} />
          )}
          {(mission.missionStartHour || mission.missionEndHour) && (
            <InfoCell
              label="Horaires"
              value={`${mission.missionStartHour ?? "?"} – ${mission.missionEndHour ?? "?"}`}
            />
          )}
        </div>
      </div>

      {/* Skills */}
      {mission.skills && mission.skills.length > 0 && (
        <div className="rounded-[16px] border border-[#DADFDD] bg-white px-7 py-6 mb-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-4">
            Compétences recherchées
          </h2>
          <div className="flex flex-wrap gap-2">
            {mission.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium"
                style={{ background: "#E4F1EC", color: "#1F7A5C" }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Taxonomy */}
      {(mission.categorieId || mission.categorieAutre || mission.metierId || mission.metierAutre || mission.serviceAutre) && (
        <div className="rounded-[16px] border border-[#DADFDD] bg-white px-7 py-6 mb-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] mb-4">
            Catégorie & Métier
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(mission.categorieId || mission.categorieAutre) && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mb-1">Domaine</p>
                <p className="text-[14px] font-medium">{mission.categorieAutre ?? mission.categorieId}</p>
              </div>
            )}
            {(mission.metierId || mission.metierAutre) && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mb-1">Métier</p>
                <p className="text-[14px] font-medium">{mission.metierAutre ?? mission.metierId}</p>
              </div>
            )}
            {mission.serviceAutre && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mb-1">Type d'intervention</p>
                <p className="text-[14px] font-medium">{mission.serviceAutre}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="px-6 py-5">
      <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mb-1">{label}</p>
      <p
        className="text-[14px] font-semibold"
        style={{ color: highlight ? "#B23A2E" : "#14213D" }}
      >
        {value}
      </p>
      {sub && <p className="text-[12px] text-[#6B7280] mt-0.5">{sub}</p>}
    </div>
  );
}
