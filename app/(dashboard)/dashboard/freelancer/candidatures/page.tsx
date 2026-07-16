import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/elements/auto-refresh";
import { PageHeader } from "@/components/dashboard/ui";

export const revalidate = 0;

// ── Pipeline stages from freelancer POV ──────────────────────────
const PIPELINE_STAGES = [
  { key: "SUBMITTED",  label: "Soumise" },
  { key: "SHORTLISTED", label: "Présélectionné" },
  { key: "INTERVIEW",  label: "Entretien" },
  { key: "OFFER_SENT", label: "Offre reçue" },
  { key: "ACCEPTED",   label: "Contrat" },
] as const;

const STATUS_STAGE: Record<string, number> = {
  UNREAD: 0, PENDING: 0, READ: 0,
  SHORTLISTED: 1,
  DISCUSSION: 2, INTERVIEW: 2, INTERVIEW_PENDING: 2, INTERVIEW_COMPLETED: 2,
  OFFER_SENT: 3,
  OFFER_ACCEPTED: 4, ACCEPTED: 4, SELECTED: 4,
  REJECTED: -1, WITHDRAWN: -1, ARCHIVED: -1,
};

const STATUS_LABEL: Record<string, string> = {
  UNREAD: "Envoyée", PENDING: "Envoyée", READ: "Consultée",
  SHORTLISTED: "Présélectionné",
  DISCUSSION: "En discussion", INTERVIEW: "Entretien", INTERVIEW_PENDING: "Entretien planifié",
  INTERVIEW_COMPLETED: "Entretien passé",
  OFFER_SENT: "Offre reçue",
  OFFER_ACCEPTED: "Offre acceptée", ACCEPTED: "Acceptée", SELECTED: "Sélectionné",
  REJECTED: "Refusée", WITHDRAWN: "Retirée", ARCHIVED: "Archivée",
  IDENTITY_PENDING: "Vérification ID",
};

const STATUS_COLORS: Record<string, string> = {
  UNREAD: "bg-[#EAECF3] text-[#4A5178]",
  PENDING: "bg-[#EAECF3] text-[#4A5178]",
  READ: "bg-[#EAECF3] text-[#4A5178]",
  SHORTLISTED: "bg-[#E4F1EC] text-[#1F7A5C]",
  DISCUSSION: "bg-[#FBEDD8] text-[#B8720A]",
  INTERVIEW: "bg-[#FBEDD8] text-[#B8720A]",
  INTERVIEW_PENDING: "bg-[#FBEDD8] text-[#B8720A]",
  INTERVIEW_COMPLETED: "bg-[#FBEDD8] text-[#B8720A]",
  OFFER_SENT: "bg-[#E4F1EC] text-[#1F7A5C]",
  OFFER_ACCEPTED: "bg-[#1F7A5C] text-white",
  ACCEPTED: "bg-[#1F7A5C] text-white",
  SELECTED: "bg-[#1F7A5C] text-white",
  REJECTED: "bg-[#F8E7E4] text-[#B23A2E]",
  WITHDRAWN: "bg-[#F0F0EE] text-[#6B7280]",
  ARCHIVED: "bg-[#F0F0EE] text-[#6B7280]",
  IDENTITY_PENDING: "bg-[#FBEDD8] text-[#B8720A]",
};

interface Application {
  id: string;
  missionId: string;
  missionTitle: string;
  clientName: string;
  proposedBudget: number;
  status: string;
  createdAt: string;
  coverLetter?: string;
}

async function getApplications(): Promise<Application[]> {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const freelancerProfile = await prisma.freelancerProfile.findUnique({ where: { userId } });
  if (!freelancerProfile) return [];

  const dbApps = await prisma.application.findMany({
    where: { freelancerId: freelancerProfile.id },
    orderBy: { createdAt: "desc" },
    include: { mission: { include: { client: true } } },
  });

  return dbApps.map((a) => ({
    id: a.id,
    missionId: a.missionId,
    missionTitle: a.mission.title,
    clientName: a.mission.client.companyName ?? "Client",
    proposedBudget: a.proposedBudget ?? 0,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    coverLetter: a.coverLetter ?? undefined,
  }));
}

// ── Mini pipeline bar ─────────────────────────────────────────────
function PipelineBar({ status }: { status: string }) {
  const currentStage = STATUS_STAGE[status] ?? 0;
  const isNegative = currentStage === -1;

  if (isNegative) {
    return (
      <div className="flex items-center gap-1 mt-3">
        <span
          className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full"
          style={{ background: "#F8E7E4", color: "#B23A2E" }}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-0">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = i < currentStage;
        const active = i === currentStage;
        return (
          <div key={stage.key} className="flex items-center gap-0 flex-1 last:flex-none">
            {/* Node */}
            <div className="flex flex-col items-center" style={{ minWidth: 48 }}>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                style={{
                  background: done || active ? "#1F7A5C" : "#EAECF3",
                  color: done || active ? "#fff" : "#9CA3AF",
                  border: active ? "2px solid #B7E4D4" : "2px solid transparent",
                  boxShadow: active ? "0 0 0 3px rgba(31,122,92,0.2)" : "none",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="text-[9.5px] mt-1 text-center leading-tight whitespace-nowrap"
                style={{ color: done || active ? "#1F7A5C" : "#9CA3AF", fontWeight: active ? 600 : 400 }}
              >
                {stage.label}
              </span>
            </div>
            {/* Connector */}
            {i < PIPELINE_STAGES.length - 1 && (
              <div
                className="flex-1 h-[2px] mb-4 mx-0.5"
                style={{ background: done ? "#1F7A5C" : "#DADFDD" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── CTA per status ────────────────────────────────────────────────
function StatusCTA({ app }: { app: Application }) {
  const stage = STATUS_STAGE[app.status] ?? 0;

  if (app.status === "OFFER_SENT") {
    return (
      <Link
        href={`/dashboard/freelancer/candidatures/${app.id}`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-semibold text-white transition-colors"
        style={{ background: "#1F7A5C" }}
      >
        📋 Voir l&apos;offre
      </Link>
    );
  }
  if (stage === 2) {
    return (
      <Link
        href={`/dashboard/freelancer/candidatures/${app.id}`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors border border-[#DADFDD] bg-white text-[#14213D] hover:border-[#1F7A5C] hover:text-[#1F7A5C]"
      >
        💬 Ouvrir la discussion
      </Link>
    );
  }
  if (stage >= 4) {
    return (
      <Link
        href={`/dashboard/freelancer/contrats`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-semibold text-white transition-colors"
        style={{ background: "#14213D" }}
      >
        📝 Voir le contrat
      </Link>
    );
  }
  return null;
}

export default async function CandidaturesPage() {
  const applications = await getApplications();

  const active = applications.filter((a) => !["REJECTED", "WITHDRAWN", "ARCHIVED"].includes(a.status));
  const closed = applications.filter((a) => ["REJECTED", "WITHDRAWN", "ARCHIVED"].includes(a.status));

  const counts = {
    total: applications.length,
    active: active.length,
    offers: applications.filter((a) => a.status === "OFFER_SENT").length,
    accepted: applications.filter((a) => ["ACCEPTED", "OFFER_ACCEPTED", "SELECTED"].includes(a.status)).length,
  };

  return (
    <div
      className="space-y-8"
      style={{ fontFamily: "var(--font-space-grotesk, Inter, sans-serif)" }}
    >
      {/* Header */}
      <PageHeader
        eyebrow={<span className="uppercase tracking-[0.08em] text-[#1F7A5C]">Pipeline de candidatures</span>}
        title="Mes candidatures"
        subtitle="Suivez votre progression dans chaque processus de recrutement."
        actions={
          <Link
            href="/dashboard/freelancer/recherche"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
            style={{ background: "#1F7A5C" }}
          >
            🔍 Trouver des missions
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total envoyées", value: counts.total, icon: "📩", accent: false },
          { label: "En cours", value: counts.active, icon: "⏳", accent: counts.active > 0 },
          { label: "Offres reçues", value: counts.offers, icon: "📋", accent: counts.offers > 0, highlight: true },
          { label: "Acceptées", value: counts.accepted, icon: "✅", accent: counts.accepted > 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border p-4"
            style={{
              borderColor: s.highlight && s.value > 0 ? "#1F7A5C" : "#DADFDD",
              background: s.highlight && s.value > 0 ? "#E4F1EC" : "#FFFFFF",
            }}
          >
            <p className="text-[18px] mb-1">{s.icon}</p>
            <p
              className="text-[24px] font-bold"
              style={{ color: s.highlight && s.value > 0 ? "#1F7A5C" : "#14213D" }}
            >
              {s.value}
            </p>
            <p className="text-[11.5px] text-[#6B7280]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Offer alert */}
      {counts.offers > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-[10px] border"
          style={{ background: "#E4F1EC", borderColor: "#1F7A5C" }}
        >
          <span className="text-[20px]">📋</span>
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold" style={{ color: "#14213D" }}>
              {counts.offers} offre{counts.offers > 1 ? "s" : ""} en attente de votre réponse
            </p>
            <p className="text-[12px] text-[#1F7A5C]">Consultez-les pour accepter ou refuser.</p>
          </div>
        </div>
      )}

      {/* Application list */}
      {applications.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#DADFDD] p-16 text-center">
          <p className="text-3xl mb-3">📩</p>
          <h3
            className="text-[18px] font-medium mb-1"
            style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
          >
            Aucune candidature
          </h3>
          <p className="text-[13.5px] text-[#6B7280]">
            Parcourez les missions disponibles et postulez pour apparaître ici.
          </p>
          <Link
            href="/dashboard/freelancer/recherche"
            className="mt-5 inline-flex px-5 py-2.5 rounded-[8px] text-[13px] font-semibold text-white"
            style={{ background: "#1F7A5C" }}
          >
            Voir les missions
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active applications */}
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((app) => {
                const badge = STATUS_COLORS[app.status] ?? STATUS_COLORS.PENDING;
                const label = STATUS_LABEL[app.status] ?? app.status;
                return (
                  <div
                    key={app.id}
                    className="rounded-[12px] border bg-white overflow-hidden transition-all"
                    style={{
                      borderColor: app.status === "OFFER_SENT" ? "#1F7A5C" : "#DADFDD",
                      boxShadow: app.status === "OFFER_SENT" ? "0 0 0 3px rgba(31,122,92,0.12)" : "none",
                    }}
                  >
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/dashboard/freelancer/candidatures/${app.id}`}
                            className="font-semibold text-[15px] hover:text-[#1F7A5C] transition-colors"
                            style={{ color: "#14213D" }}
                          >
                            {app.missionTitle}
                          </Link>
                          <p className="text-[12.5px] text-[#6B7280] mt-0.5">
                            Client : {app.clientName} · {new Date(app.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                          {app.coverLetter && (
                            <p className="text-[12.5px] text-[#6B7280] mt-1.5 line-clamp-1 italic">
                              &ldquo;{app.coverLetter}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-full ${badge}`}
                          >
                            {label}
                          </span>
                          {app.proposedBudget > 0 && (
                            <span
                              className="text-[13px] font-semibold"
                              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                            >
                              {app.proposedBudget.toLocaleString()} €
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pipeline bar */}
                      <PipelineBar status={app.status} />

                      {/* Status-specific alerts */}
                      {app.status === "OFFER_SENT" && (
                        <div
                          className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-[8px]"
                          style={{ background: "#E4F1EC" }}
                        >
                          <p className="text-[12.5px] font-medium" style={{ color: "#1F7A5C" }}>
                            🎉 Le client vous a envoyé une offre — répondez pour continuer
                          </p>
                          <StatusCTA app={app} />
                        </div>
                      )}
                      {(app.status === "DISCUSSION" || app.status === "INTERVIEW") && (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-[12.5px] text-[#6B7280]">
                            💬 Le client souhaite échanger avec vous
                          </p>
                          <StatusCTA app={app} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Closed applications */}
          {closed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-[12.5px] text-[#6B7280] font-medium px-1 py-2 list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                Candidatures clôturées ({closed.length})
              </summary>
              <div className="mt-2 space-y-2">
                {closed.map((app) => {
                  const badge = STATUS_COLORS[app.status] ?? STATUS_COLORS.REJECTED;
                  const label = STATUS_LABEL[app.status] ?? app.status;
                  return (
                    <div
                      key={app.id}
                      className="rounded-[12px] border border-[#DADFDD] bg-white px-5 py-4 opacity-70"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-[14px]" style={{ color: "#14213D" }}>
                            {app.missionTitle}
                          </p>
                          <p className="text-[12px] text-[#6B7280] mt-0.5">
                            {app.clientName} · {new Date(app.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <span className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-full ${badge}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
