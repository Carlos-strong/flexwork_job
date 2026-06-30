import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

async function getKycStats() {
  try {
    const [freelancePending, freelanceValid, freelanceRejected,
           companyPending, companyValid, companyRejected] = await Promise.all([
      prisma.verificationIdentite.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.verificationIdentite.count({ where: { statut: "VALIDE" } }),
      prisma.verificationIdentite.count({ where: { statut: "REJETE" } }),
      prisma.clientProfile.count({ where: { companyVerificationStatus: "EN_ATTENTE", companyName: { not: null } } }),
      prisma.clientProfile.count({ where: { companyVerificationStatus: "VALIDE", companyName: { not: null } } }),
      prisma.clientProfile.count({ where: { companyVerificationStatus: "REJETE", companyName: { not: null } } }),
    ]);
    return { freelancePending, freelanceValid, freelanceRejected, companyPending, companyValid, companyRejected };
  } catch {
    return { freelancePending: 0, freelanceValid: 0, freelanceRejected: 0, companyPending: 0, companyValid: 0, companyRejected: 0 };
  }
}

export default async function KycDashboardPage() {
  const stats = await getKycStats();

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">KYC — Vérification d&apos;identité</h1>
        <p className="text-[14px] text-[#5A5750] mt-1">Workflow complet de vérification des freelances et entreprises.</p>
      </div>

      {/* ── Sous-rubriques ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Freelance */}
        <Link
          href="/backoffice/kyc/freelances"
          className="rounded-xl border border-[#E2E0D9] bg-white p-6 hover:border-[#C3D1F8] hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🪪</span>
            <div>
              <h2 className="text-lg font-semibold group-hover:text-[#2D5BE3] transition-colors">Vérifier un freelance</h2>
              <p className="text-xs text-[#5A5750]">Pièce d&apos;identité, selfie, validation</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <strong>{stats.freelancePending}</strong> en attente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <strong>{stats.freelanceValid}</strong> validés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <strong>{stats.freelanceRejected}</strong> rejetés
            </span>
          </div>
        </Link>

        {/* Entreprise */}
        <Link
          href="/backoffice/kyc/entreprises"
          className="rounded-xl border border-[#E2E0D9] bg-white p-6 hover:border-[#C3D1F8] hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏢</span>
            <div>
              <h2 className="text-lg font-semibold group-hover:text-[#2D5BE3] transition-colors">Vérifier une entreprise</h2>
              <p className="text-xs text-[#5A5750]">KBIS, RIB, SIRET, validation</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <strong>{stats.companyPending}</strong> en attente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <strong>{stats.companyValid}</strong> validées
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <strong>{stats.companyRejected}</strong> rejetées
            </span>
          </div>
        </Link>
      </div>

      {/* ── Workflow visuel ── */}
      <div className="rounded-xl border border-[#E2E0D9] bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A5750] mb-6">Workflow de vérification</h3>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs font-medium">
          {[
            { step: "1", label: "Création du compte", icon: "📝" },
            { step: "→", label: "", icon: "" },
            { step: "2", label: "Compléter le profil", icon: "👤" },
            { step: "→", label: "", icon: "" },
            { step: "3", label: "Téléversement documents", icon: "📤" },
            { step: "→", label: "", icon: "" },
            { step: "4", label: "Vérif. automatiques", icon: "🤖" },
            { step: "→", label: "", icon: "" },
            { step: "5", label: "Vérif. humaines", icon: "👁️" },
            { step: "→", label: "", icon: "" },
            { step: "6", label: "Validation", icon: "✅" },
            { step: "→", label: "", icon: "" },
            { step: "7", label: "Compte vérifié", icon: "🛡️" },
            { step: "→", label: "", icon: "" },
            { step: "8", label: "Surveillance continue", icon: "🔍" },
          ].map((item, i) =>
            item.icon ? (
              <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FAFAF8] border border-[#E2E0D9] whitespace-nowrap">
                <span>{item.icon}</span>
                <span className="text-[11px] font-bold text-[#2D5BE3]">{item.step}</span>
                <span className="text-[#1A1916]">{item.label}</span>
              </div>
            ) : (
              <span key={i} className="text-[#C3D1F8] font-bold text-lg">→</span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
