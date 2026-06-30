"use client";

import { useRef, useState } from "react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

function FileInput({
  id,
  label,
  accept,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  onChange: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-[#1A1916]">
        {label}
      </label>
      <div
        onClick={() => ref.current?.click()}
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#E2E0D9] bg-white px-4 py-3 text-sm transition-colors hover:border-primary/60"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 shrink-0 text-[#5A5750]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <span className={name ? "text-[#1A1916]" : "text-[#5A5750]"}>
          {name ?? "Choisir un fichier (PDF, JPEG, PNG)"}
        </span>
      </div>
      <input
        id={id}
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setName(file?.name ?? null);
          onChange(file);
        }}
      />
    </div>
  );
}

export function CompanyKycModal({ onClose, onSuccess }: Props) {
  const [siret, setSiret] = useState("");
  const [kbis, setKbis] = useState<File | null>(null);
  const [rib, setRib] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    siret.length === 14 &&
    /^\d{14}$/.test(siret) &&
    kbis !== null &&
    rib !== null &&
    state !== "uploading";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setState("uploading");
    setError(null);

    const fd = new FormData();
    fd.append("siret", siret);
    fd.append("kbis", kbis!);
    fd.append("rib", rib!);

    try {
      const res = await fetch("/api/users/company-kyc", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de l'envoi");
      }

      setState("success");
      setTimeout(onSuccess, 1500);
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* En-tête */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Vérification entreprise</h2>
            <p className="mt-1 text-sm text-[#5A5750]">
              Fournissez votre SIRET et les documents requis pour activer les fonctionnalités entreprise.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={state === "uploading"}
            className="ml-4 rounded-lg p-1.5 text-[#5A5750] transition-colors hover:bg-[#F5F5F0]"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {state === "success" ? (
          <div className="rounded-xl bg-green-50 px-4 py-6 text-center text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Documents envoyés — votre compte est en cours de vérification.
          </div>
        ) : (
          <div className="space-y-5">
            {/* SIRET */}
            <div className="space-y-1">
              <label htmlFor="siret" className="text-sm font-medium text-[#1A1916]">
                Numéro SIRET
              </label>
              <input
                id="siret"
                type="text"
                inputMode="numeric"
                maxLength={14}
                value={siret}
                onChange={(e) => setSiret(e.target.value.replace(/\D/g, ""))}
                placeholder="14 chiffres"
                className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-3 text-sm tracking-widest"
              />
              {siret.length > 0 && siret.length < 14 && (
                <p className="text-xs text-[#5A5750]">{siret.length} / 14 chiffres</p>
              )}
            </div>

            {/* KBIS */}
            <FileInput
              id="kbis-input"
              label="Extrait KBIS (moins de 3 mois)"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={setKbis}
            />

            {/* RIB */}
            <FileInput
              id="rib-input"
              label="RIB entreprise"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={setRib}
            />

            {/* Erreur */}
            {error && (
              <div className="rounded-lg bg-[#C0392B]/10 px-4 py-3 text-sm text-[#C0392B]">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={state === "uploading"}
                className="flex-1 rounded-lg border border-[#E2E0D9] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#F5F5F0] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              >
                {state === "uploading" ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
