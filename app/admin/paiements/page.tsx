"use client";

import { useState, useEffect } from "react";

interface Payment {
  id: string;
  contractId: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentId?: string;
  trustEngineId?: string;
  stripePayoutId?: string;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/payments");
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setPayments(list);
      } catch {
        // fallback
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalGmv = payments.reduce((sum, p) => sum + p.amount, 0);
  const escrowFunds = payments
    .filter((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
    .reduce((sum, p) => sum + p.amount, 0);
  const commission = Math.round(totalGmv * 0.05);
  const escrowCount = payments.filter((p) => p.type === "DEPOSIT").length;

  const formatAmount = (amount: number) =>
    amount >= 1_000_000
      ? `${(amount / 1_000_000).toFixed(1)} ${payments[0]?.currency || "€"}`
      : `${amount.toLocaleString()} ${payments[0]?.currency || "€"}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR");

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: "Dépôt escrow",
      RELEASE: "Libération",
      PAYOUT: "Virement freelance",
      REFUND: "Remboursement",
    };
    return labels[type] || type;
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      SUCCEEDED: "text-green-600",
      PENDING: "text-yellow-600",
      FAILED: "text-red-600",
      REFUNDED: "text-gray-500",
    };
    return colors[status] || "text-[#5A5750]";
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Suivi financier</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#E2E0D9] p-5 animate-pulse">
              <div className="h-4 w-32 bg-[#F5F5F0] rounded" />
              <div className="mt-2 h-8 w-24 bg-[#F5F5F0] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Suivi financier</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Volume total (GMV)", value: formatAmount(totalGmv), change: `${payments.length} transactions` },
          { label: "Fonds en escrow", value: formatAmount(escrowFunds), change: `${escrowCount} escrows actifs` },
          { label: "Commission plateforme", value: formatAmount(commission), change: "5% du GMV" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E2E0D9] p-5">
            <p className="text-sm text-[#5A5750]">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-[#5A5750] mt-1">{s.change}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#E2E0D9] p-6">
        <h3 className="font-semibold mb-3">Transactions récentes</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-[#5A5750] text-center py-8">Aucune transaction pour le moment.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {payments.slice().reverse().map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#5A5750] font-mono">{t.id}</span>
                  <span className="text-[#5A5750]">{typeLabel(t.type)}</span>
                  <span className={`text-xs font-medium ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{t.amount.toLocaleString()} {t.currency}</span>
                  <p className="text-xs text-[#5A5750]">{formatDate(t.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
