"use client";

import { useState, useEffect } from "react";

type KycStatus = "EN_ATTENTE" | "VALIDE" | "REJETE";

const STATUS_CONFIG: Record<KycStatus, { label: string; color: string; icon: string }> = {
  EN_ATTENTE: { label: "En attente de validation",  color: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400", icon: "⏳" },
  VALIDE:     { label: "Entreprise vérifiée",        color: "border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",   icon: "✅" },
  REJETE:     { label: "Vérification rejetée",       color: "border-red-400 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",           icon: "❌" },
};

interface CompanyProfile {
  companyName?: string;
  siret?: string;
  kbisUrl?: string;
  ribUrl?: string;
  companyVerificationStatus: KycStatus;
  companyVerifiedAt?: string;
}

export default function ClientEntreprisePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    siret: "",
  });

  useEffect(() => {
    fetch("/api/users/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.clientProfile) {
          const cp = d.clientProfile;
          setProfile({
            companyName: cp.companyName,
            siret: cp.siret,
            kbisUrl: cp.kbisUrl,
            ribUrl: cp.ribUrl,
            companyVerificationStatus: cp.companyVerificationStatus || "EN_ATTENTE",
            companyVerifiedAt: cp.companyVerifiedAt,
          });
          setForm({ companyName: cp.companyName || "", siret: cp.siret || "" });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientProfile: form }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-20 rounded-xl bg-[#F5F5F0]" />)}
      </div>
    );
  }

  const kycStatus = profile?.companyVerificationStatus || "EN_ATTENTE";
  const statusCfg = STATUS_CONFIG[kycStatus];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Mon entreprise</h2>
        <p className="text-sm text-[#5A5750]">
          KYC Entreprise — requis pour signer un contrat ou effectuer un paiement
        </p>
      </div>

      {/* Statut KYC */}
      <div className={`rounded-xl border-2 p-5 ${statusCfg.color}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusCfg.icon}</span>
          <div>
            <p className="font-semibold">{statusCfg.label}</p>
            {kycStatus === "EN_ATTENTE" && profile?.siret && (
              <p className="text-sm opacity-80 mt-0.5">Votre dossier est en cours d&apos;examen par notre équipe.</p>
            )}
            {kycStatus === "VALIDE" && profile?.companyVerifiedAt && (
              <p className="text-sm opacity-80 mt-0.5">
                Vérifié le {new Date(profile.companyVerifiedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
            {kycStatus === "REJETE" && (
              <p className="text-sm opacity-80 mt-0.5">
                Votre dossier a été rejeté. Corrigez les informations et soumettez à nouveau.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="rounded-xl border border-[#E2E0D9] p-6 space-y-6">
        <h3 className="font-semibold">Informations de l&apos;entreprise</h3>

        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nom de l&apos;entreprise</label>
            <input
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              placeholder="ACME SAS"
              className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Numéro SIRET</label>
            <input
              value={form.siret}
              onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value }))}
              placeholder="12345678901234"
              maxLength={14}
              className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm font-mono"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#2D5BE3] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : saved ? "✅ Enregistré" : "Enregistrer"}
        </button>
      </div>

      {/* Documents */}
      <div className="rounded-xl border border-[#E2E0D9] p-6 space-y-5">
        <h3 className="font-semibold">Documents justificatifs</h3>
        <p className="text-sm text-[#5A5750]">
          Ces documents sont requis pour valider votre compte entreprise et effectuer des paiements.
        </p>

        {[
          { label: "Extrait KBIS (PDF)", description: "Moins de 3 mois", field: "kbisUrl", icon: "📄", current: profile?.kbisUrl },
          { label: "RIB entreprise", description: "Au nom de la société", field: "ribUrl", icon: "🏦", current: profile?.ribUrl },
        ].map((doc) => (
          <div key={doc.field} className="flex items-center justify-between rounded-lg border border-[#E2E0D9]/50 p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{doc.icon}</span>
              <div>
                <p className="text-sm font-medium">{doc.label}</p>
                <p className="text-xs text-[#5A5750]">{doc.description}</p>
              </div>
            </div>
            {doc.current ? (
              <span className="text-xs font-medium text-green-600 dark:text-green-400">✅ Uploadé</span>
            ) : (
              <label className="cursor-pointer rounded-lg border border-[#E2E0D9] px-3 py-1.5 text-xs font-medium text-[#5A5750] hover:bg-[#EEF2FD] transition-colors">
                Choisir un fichier
                <input type="file" accept=".pdf,image/*" className="sr-only" />
              </label>
            )}
          </div>
        ))}

        <div className="rounded-lg bg-[#F5F5F0]/40 px-4 py-3 text-xs text-[#5A5750]">
          🔒 Vos documents sont chiffrés et accessibles uniquement par notre équipe de vérification.
        </div>
      </div>
    </div>
  );
}
