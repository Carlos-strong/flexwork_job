"use client";

import { useState } from "react";

export default function StripeOnboardingPage() {
  const [step, setStep] = useState<"info" | "submitted" | "complete">("info");

  const handleStart = () => {
    setStep("submitted");
    // Simuler une redirection Stripe Connect
    setTimeout(() => setStep("complete"), 2000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold">Configuration des paiements</h2>
        <p className="text-sm text-[#5A5750]">Configurez Stripe Connect pour recevoir vos paiements.</p>
      </div>

      {step === "info" && (
        <div className="rounded-xl border border-[#E2E0D9] p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FD] text-sm">🔒</span>
              <div>
                <p className="text-sm font-medium">Paiements sécurisés</p>
                <p className="text-xs text-[#5A5750]">Vos paiements sont traités via Stripe Connect, leader mondial des paiements en ligne.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FD] text-sm">⚡</span>
              <div>
                <p className="text-sm font-medium">Virements automatiques</p>
                <p className="text-xs text-[#5A5750]">Les fonds sont automatiquement virés sur votre compte bancaire après validation des milestones.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FD] text-sm">🛡️</span>
              <div>
                <p className="text-sm font-medium">Protection KYC</p>
                <p className="text-xs text-[#5A5750]">Stripe vérifie votre identité une seule fois, vos futurs paiements sont instantanés.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full rounded-lg bg-[#2D5BE3] px-6 py-3 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Configurer Stripe Connect →
          </button>

          <p className="text-xs text-[#5A5750] text-center">
            Vous serez redirigé vers Stripe pour compléter la vérification d&apos;identité.
          </p>
        </div>
      )}

      {step === "submitted" && (
        <div className="rounded-xl border border-[#E2E0D9] p-8 text-center">
          <p className="text-lg">Redirection vers Stripe...</p>
          <div className="mt-4 mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {step === "complete" && (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-8 text-center">
          <p className="text-3xl mb-2">✅</p>
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">Compte Stripe Connect configuré !</h3>
          <p className="mt-2 text-sm text-green-600 dark:text-green-500">
            Vous pouvez maintenant recevoir des paiements directement sur votre compte bancaire.
          </p>
          <div className="mt-6 rounded-lg bg-green-100 dark:bg-green-900 p-3 text-sm text-green-700 dark:text-green-400">
            💳 Compte vérifié · IBAN: FR76 **** **** **** **** ***
          </div>
        </div>
      )}
    </div>
  );
}
