"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KycInfo {
  kycStatut: "EN_ATTENTE" | "VALIDE" | "REJETE" | null;
  motifRejet: string | null;
  taux: number | null;
  modeTarification: string | null;
  metierLibelle: string | null;
}

interface ApplyModalProps {
  /** ID de la mission ciblée */
  missionId: string;
  /** Titre de la mission (affiché dans le modal) */
  missionTitle: string;
  /** Budget indicatif de la mission (pour contextualiser la proposition) */
  missionBudget?: string | number;
  /** Callback appelé à la fermeture du modal */
  onClose: () => void;
}

// ── Labels tarification ────────────────────────────────────────────────────────
const TARIF_LABELS: Record<string, string> = {
  HORAIRE: "/h",
  JOURNALIER: "/jour",
  HEBDOMADAIRE: "/sem.",
  MENSUEL: "/mois",
  PAR_PRESTATION: "",
};

// ── Composant principal ────────────────────────────────────────────────────────

export function ApplyModal({ missionId, missionTitle, missionBudget, onClose }: ApplyModalProps) {
  const { data: session } = useSession();

  // États
  const [kycInfo, setKycInfo] = useState<KycInfo | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [proposedBudget, setProposedBudget] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    identityPending?: boolean;
    message: string;
  } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Fermer sur clic en dehors du modal ──
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  // ── Fermer sur Escape ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Charger le profil + statut KYC au montage ──
  useEffect(() => {
    if (!session?.user) { setLoadingProfile(false); return; }

    fetch("/api/prestataire/verification")
      .then((r) => r.json())
      .then((data: KycInfo) => {
        setKycInfo(data);
        // Pré-remplir le taux si disponible
        if (data.taux != null) {
          setProposedBudget(String(data.taux));
        }
      })
      .catch(() => setKycInfo(null))
      .finally(() => setLoadingProfile(false));
  }, [session]);

  // ── Soumission ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    setSubmitting(true);

    const userId = (session.user as { id?: string }).id;

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId,
          freelancerId: userId,
          freelancerName: session.user.name || "Freelancer",
          proposedBudget: proposedBudget ? Number(proposedBudget) : undefined,
          coverLetter,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: data.error || "Une erreur est survenue." });
      } else {
        setResult({
          success: true,
          identityPending: data.data?.identityPending === true,
          message: data.data?.identityPending
            ? "Candidature soumise ! Votre vérification d'identité est en cours de traitement par notre équipe. Elle sera visible du client dès validation."
            : "Votre candidature a bien été envoyée au client !",
        });
      }
    } catch {
      setResult({ success: false, message: "Erreur réseau. Veuillez réessayer." });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Bannière KYC contextuelle ──
  const renderKycBanner = () => {
    if (!kycInfo) return null;

    if (kycInfo.kycStatut === "REJETE") {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Vérification d'identité rejetée
          </p>
          {kycInfo.motifRejet && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motif : {kycInfo.motifRejet}</p>
          )}
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            Vous devez soumettre de nouveaux documents avant de pouvoir postuler.{" "}
            <Link href="/inscription" className="font-medium underline">Soumettre à nouveau</Link>
          </p>
        </div>
      );
    }

    if (kycInfo.kycStatut === "EN_ATTENTE") {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Vérification d'identité en cours
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Votre candidature sera visible du client mais il ne pourra pas l'accepter tant que votre identité n'est pas validée.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (kycInfo.kycStatut === null) {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Vérification d'identité requise
              </p>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                C'est votre 1ère candidature. Votre pièce d'identité sera demandée. Vous pouvez tout de même postuler — votre dossier sera visible du client avec le badge "Vérification en cours".
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null; // VALIDE → aucune bannière
  };

  // ── Rendu : résultat après soumission ──
  if (result) {
    return (
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-[#E2E0D9] bg-white shadow-xl">
          <div className="p-8 text-center space-y-4">
            {result.success ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <svg className="h-7 w-7 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">
                  {result.identityPending ? "Candidature en attente" : "Candidature envoyée !"}
                </h3>
                <p className="text-sm text-[#5A5750]">{result.message}</p>
                {result.identityPending && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Badge visible du client : <strong>Vérification d'identité en cours</strong>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <svg className="h-7 w-7 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Erreur</h3>
                <p className="text-sm text-[#5A5750]">{result.message}</p>
              </>
            )}
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Rendu : formulaire de candidature ──
  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E0D9] bg-white shadow-xl">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[#E2E0D9] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Postuler à la mission</h2>
            <p className="mt-0.5 text-sm text-[#5A5750] line-clamp-1">{missionTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Chargement profil */}
          {loadingProfile ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-[#F5F5F0]" />
              <div className="h-12 rounded bg-[#F5F5F0]" />
            </div>
          ) : kycInfo?.metierLibelle === null ? (
            /* ── Profil prestataire absent — bloquer + rediriger ── */
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      Profil prestataire requis
                    </p>
                    <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                      Vous devez créer votre profil professionnel (métier, zone, tarif) avant de pouvoir postuler à des missions.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/inscription"
                className="block w-full rounded-[10px] bg-[#2D5BE3] px-4 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Créer mon profil prestataire
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="block w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-center text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Bannière KYC contextuelle */}
              {renderKycBanner()}

              {/* Champ proposition tarifaire — pré-rempli depuis le profil */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-[#1A1916]">
                  Votre proposition tarifaire
                  {kycInfo?.taux != null && kycInfo.modeTarification && (
                    <span className="ml-2 text-[12px] font-normal text-[#5A5750]">
                      (tarif profil : {kycInfo.taux.toLocaleString()} XAF
                      {TARIF_LABELS[kycInfo.modeTarification] ?? ""})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-[#5A5750] select-none">
                    XAF
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={proposedBudget}
                    onChange={(e) => setProposedBudget(e.target.value)}
                    placeholder={kycInfo?.taux != null ? String(kycInfo.taux) : "Montant proposé"}
                    className="w-full rounded-[10px] border border-[#E2E0D9] bg-white pl-14 pr-4 py-2.5 text-[14px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/50 placeholder:text-[#9C9A95]"
                  />
                </div>
                {missionBudget && (
                  <p className="text-[12px] text-[#5A5750]">Budget de référence du client : {missionBudget}</p>
                )}
              </div>

              {/* Message de motivation */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-[#1A1916]">
                  Message de motivation
                  <span className="ml-1 text-[12px] font-normal text-[#5A5750]">(optionnel)</span>
                </label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Décrivez brièvement pourquoi vous êtes le meilleur candidat pour cette mission..."
                  rows={4}
                  maxLength={1000}
                  className="w-full resize-none rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/50 placeholder:text-[#9C9A95]"
                />
                <p className="text-right text-[12px] text-[#5A5750]">{coverLetter.length} / 1000</p>
              </div>

              {/* Blocage si KYC rejeté */}
              {kycInfo?.kycStatut === "REJETE" ? (
                <div className="rounded-[10px] bg-[#F5F5F0] px-4 py-2.5 text-center text-[14px] text-[#5A5750]">
                  Soumettez de nouveaux documents KYC avant de pouvoir postuler.
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !session?.user}
                  className="w-full rounded-[10px] bg-[#2D5BE3] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Envoi en cours...
                    </span>
                  ) : (
                    "Envoyer ma candidature"
                  )}
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
