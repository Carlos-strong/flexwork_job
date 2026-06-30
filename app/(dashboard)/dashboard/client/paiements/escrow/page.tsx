"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EscrowDepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [error, setError] = useState("");
  const [paymentMode, setPaymentMode] = useState<"stripe" | "virtual">("virtual");
  const [receipt, setReceipt] = useState<{
    authorizationCode?: string;
    maskedCard?: string;
    transactionId?: string;
  }>({});

  const handleDeposit = async () => {
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      contractId: "c-1",
      amount: Number(amount),
      type: "DEPOSIT",
      missionTitle: "Mission de test",
      clientId: "client-test-1",
    };

    // ── Mode KYC Différé : Paiement via carte Visa virtuelle ──
    if (paymentMode === "virtual") {
      payload.useVirtualCard = true;
    }

    const payRes = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!payRes.ok) {
      const err = await payRes.json();
      setError(err.error || "Erreur lors du dépôt");
      setLoading(false);
      return;
    }

    const result = await payRes.json();
    const payment = result.data || result;

    // Extraire le reçu si mode virtuel
    if (payment.receipt) {
      setReceipt({
        authorizationCode: payment.receipt.authorizationCode,
        maskedCard: payment.receipt.maskedCard,
        transactionId: payment.receipt.transactionId,
      });
    }

    // Étape 2: Simuler la notification TrustEngine
    await fetch("/api/webhooks/trustengine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "escrow.created",
        escrowId: payment.trustEngineId,
        amount: Number(amount),
      }),
    });

    setLoading(false);
    setStep("done");
  };

  const commission = Number(amount) * 0.05;
  const total = Number(amount);

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Dépôt de fonds</h2>
        <p className="text-sm text-[#5A5750]">
          {paymentMode === "virtual"
            ? "🧪 Mode test — Paiement via carte Visa virtuelle (KYC Différé). Aucune pièce d'identité requise."
            : "🔒 Sécurisez les fonds via Stripe + TrustEngine (escrow)."}
        </p>
      </div>

      {step === "done" ? (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-8 text-center">
          <p className="text-3xl mb-2">
            {paymentMode === "virtual" ? "💳" : "🔒"}
          </p>
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
            {paymentMode === "virtual"
              ? "Paiement virtuel accepté !"
              : "Fonds déposés avec succès !"}
          </h3>
          <p className="mt-2 text-sm text-green-600 dark:text-green-500">
            {Number(amount).toLocaleString()} € sont sécurisés sur le compte escrow TrustEngine.
          </p>
          {receipt.authorizationCode && (
            <div className="mt-4 inline-block rounded-lg bg-green-100 dark:bg-green-900 px-4 py-2 text-xs font-mono">
              <p>Code autorisation : <strong>{receipt.authorizationCode}</strong></p>
              {receipt.maskedCard && <p>Carte : {receipt.maskedCard}</p>}
            </div>
          )}
          <button
            onClick={() => {
              router.refresh();
              router.push("/dashboard/client/paiements");
            }}
            className="mt-6 rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Voir mes paiements
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] p-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">{error}</div>
          )}

          {/* Sélecteur de mode de paiement */}
          <div className="flex gap-2 rounded-lg bg-[#F5F5F0]/30 p-1">
            <button
              onClick={() => setPaymentMode("virtual")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                paymentMode === "virtual"
                  ? "bg-[#2D5BE3] text-white shadow-sm"
                  : "text-[#5A5750] hover:text-[#1A1916]"
              }`}
            >
              💳 Carte Virtuelle (Test)
            </button>
            <button
              onClick={() => setPaymentMode("stripe")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                paymentMode === "stripe"
                  ? "bg-[#2D5BE3] text-white shadow-sm"
                  : "text-[#5A5750] hover:text-[#1A1916]"
              }`}
            >
              🔒 Stripe (Production)
            </button>
          </div>

          {paymentMode === "virtual" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-400">
              <strong>🧪 Mode KYC Différé</strong> — Aucune vérification d&apos;identité ou document requis.
              Le paiement est simulé via une carte Visa virtuelle préchargée. Idéal pour les tests de développement.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Montant à déposer (€)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              min="100"
              className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-3 text-lg font-semibold"
            />
          </div>

          {Number(amount) >= 100 && (
            <div className="rounded-lg bg-[#F5F5F0]/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5A5750]">Montant</span>
                <span className="font-medium">{total.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A5750]">Commission plateforme (5%)</span>
                <span className="font-medium text-[#5A5750]">{commission.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total séquestré</span>
                <span>{(total - commission).toLocaleString()} €</span>
              </div>
            </div>
          )}

          <button
            onClick={handleDeposit}
            disabled={loading || Number(amount) < 100}
            className="w-full rounded-lg bg-[#2D5BE3] px-6 py-3 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
          >
            {loading
              ? "Traitement en cours..."
              : paymentMode === "virtual"
                ? "💳 Payer avec ma carte virtuelle"
                : "💳 Déposer les fonds"}
          </button>

          <p className="text-xs text-[#5A5750] text-center">
            {paymentMode === "virtual"
              ? "Paiement simulé via carte Visa virtuelle. Solde initial : 10 000 €."
              : "Paiement sécurisé via Stripe. Fonds bloqués sur un compte escrow TrustEngine."}
          </p>
        </div>
      )}
    </div>
  );
}
