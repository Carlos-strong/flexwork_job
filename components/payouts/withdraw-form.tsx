"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface WithdrawFormProps {
  available: number;
  currency: string;
  defaultHolder?: string;
}

export function WithdrawForm({ available, currency, defaultHolder }: WithdrawFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"IBAN" | "PAYONEER">("IBAN");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [holder, setHolder] = useState(defaultHolder ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWithdraw = available > 0;

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Saisissez un montant valide.");
      return;
    }
    if (amt > available) {
      setError(`Le montant dépasse le solde disponible (${available.toLocaleString()} ${currency}).`);
      return;
    }
    if (!destination.trim()) {
      setError(method === "IBAN" ? "Saisissez votre IBAN." : "Saisissez votre email Payoneer.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method, destination: destination.trim(), accountHolder: holder.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Échec de la demande.");
        return;
      }
      setOpen(false);
      setAmount("");
      setDestination("");
      router.refresh();
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!canWithdraw}
        className="inline-flex items-center gap-2 rounded-lg bg-[#2D5BE3] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={canWithdraw ? undefined : "Aucun solde disponible au retrait"}
      >
        💸 Demander un retrait
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E0D9] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1A1916]">Demande de retrait</h3>
        <span className="text-xs text-[#5A5750]">
          Disponible : <b>{available.toLocaleString()} {currency}</b>
        </span>
      </div>

      <div className="space-y-4">
        {/* Méthode */}
        <div className="flex gap-2">
          {(["IBAN", "PAYONEER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                method === m
                  ? "border-[#2D5BE3] bg-[#EEF2FD] text-[#2D5BE3]"
                  : "border-[#E2E0D9] text-[#5A5750] hover:border-[#c5c8ba]"
              }`}
            >
              {m === "IBAN" ? "Virement bancaire (IBAN)" : "Payoneer"}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1A1916]">Montant ({currency})</label>
          <input
            type="number"
            min={0}
            max={available}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Jusqu'à ${available.toLocaleString()}`}
            className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1A1916]">
            {method === "IBAN" ? "IBAN" : "Email Payoneer"}
          </label>
          <input
            type={method === "IBAN" ? "text" : "email"}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={method === "IBAN" ? "FR76 3000 …" : "vous@exemple.com"}
            className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#1A1916]">Titulaire du compte (facultatif)</label>
          <input
            type="text"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setOpen(false); setError(null); }}
            className="rounded-lg border border-[#E2E0D9] px-4 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#F4F3EF]"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-[#2D5BE3] px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Envoi…" : "Confirmer la demande"}
          </button>
        </div>
      </div>
    </div>
  );
}
