"use client";

import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  type: "DEPOT" | "RETRAIT" | "COMMISSION" | "REMBOURSEMENT";
  montant: number;
  devise: string;
  source: string;
  destination: string;
  date: string;
  statut: "COMPLETED" | "PENDING" | "FAILED";
}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_001",
    type: "DEPOT",
    montant: 5000,
    devise: "EUR",
    source: "Client — ABC SARL",
    destination: "Escrow Flexwork",
    date: '2026-06-25T12:00:00.000Z',
    statut: "COMPLETED",
  },
  {
    id: "tx_002",
    type: "COMMISSION",
    montant: 750,
    devise: "EUR",
    source: "Escrow — Mission #1024",
    destination: "Compte plateforme",
    date: '2026-06-24T12:00:00.000Z',
    statut: "COMPLETED",
  },
  {
    id: "tx_003",
    type: "RETRAIT",
    montant: 2000,
    devise: "EUR",
    source: "Compte freelance",
    destination: "RIB freelance — Jean Dupont",
    date: '2026-06-23T12:00:00.000Z',
    statut: "PENDING",
  },
  {
    id: "tx_004",
    type: "REMBOURSEMENT",
    montant: 500,
    devise: "EUR",
    source: "Escrow Flexwork",
    destination: "Client — Martin Particulier",
    date: '2026-06-22T12:00:00.000Z',
    statut: "COMPLETED",
  },
];

const TYPE_STYLES: Record<string, string> = {
  DEPOT: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  RETRAIT: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  COMMISSION: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  REMBOURSEMENT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const KPI_CARDS = [
  { label: "Volume total (mois)", value: "45 200 €", change: "+12%", positive: true },
  { label: "Commissions perçues", value: "6 780 €", change: "+8%", positive: true },
  { label: "Retraits en attente", value: "3 400 €", change: "2 retraits", positive: false },
  { label: "Escrow actifs", value: "28", change: "15 missions", positive: true },
];

export default function BackOfficeFinancePage() {
  const [period, setPeriod] = useState<"7j" | "30j" | "90j">("30j");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Finance</h2>
        <p className="text-[14px] text-[#5A5750]">
          Suivi des flux financiers — escrow, commissions, retraits
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
            <p className="text-[14px] text-[#5A5750]">{kpi.label}</p>
            <p className="text-[24px] font-bold mt-1 text-[#1A1916]">{kpi.value}</p>
            <p className={`text-[12px] mt-1 font-medium ${kpi.positive ? "text-[#1A7A4A]" : "text-[#E67E22]"}`}>
              {kpi.change}
            </p>
          </div>
        ))}
      </div>

      {/* Période et export */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["7j", "30j", "90j"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                period === p
                  ? "bg-[#2D5BE3] text-white"
                  : "border border-[#E2E0D9] bg-white text-[#1A1916] hover:bg-[#FAFAF8]"
              }`}
            >
              {p === "7j" ? "7 jours" : p === "30j" ? "30 jours" : "90 jours"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
            📥 CSV
          </button>
          <button className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
            📊 Rapport
          </button>
        </div>
      </div>

      {/* Tableau des transactions */}
      <div className="rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
        <table className="w-full text-[14px]">
          <thead className="border-b border-[#E2E0D9] bg-[#FAFAF8]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Montant</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Source</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Destination</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E0D9]">
            {MOCK_TRANSACTIONS.map((tx) => (
              <tr key={tx.id} className="hover:bg-[#FAFAF8] transition-colors">
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[tx.type]}`}>
                    {tx.type === "DEPOT" ? "💰 Dépôt"
                      : tx.type === "RETRAIT" ? "🏦 Retrait"
                      : tx.type === "COMMISSION" ? "📊 Commission"
                      : "↩️ Remboursement"}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-[#1A1916]">
                  {tx.montant.toLocaleString()} {tx.devise}
                </td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px]">{tx.source}</td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px]">{tx.destination}</td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px]">
                  {new Date(tx.date).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    tx.statut === "COMPLETED"
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : tx.statut === "PENDING"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {tx.statut === "COMPLETED" ? "✅ Complété"
                      : tx.statut === "PENDING" ? "⏳ En attente"
                      : "❌ Échoué"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résumé mensuel */}
      <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-[#1A1916] text-[16px]">Résumé mensuel</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[14px]">
          <div>
            <p className="text-[#5A5750] text-[13px]">Dépôts escrow</p>
            <p className="font-semibold text-[#1A7A4A]">+32 500 €</p>
          </div>
          <div>
            <p className="text-[#5A5750] text-[13px]">Commissions</p>
            <p className="font-semibold text-[#2D5BE3]">+6 780 €</p>
          </div>
          <div>
            <p className="text-[#5A5750] text-[13px]">Retraits freelance</p>
            <p className="font-semibold text-[#E67E22]">-21 400 €</p>
          </div>
          <div>
            <p className="text-[#5A5750] text-[13px]">Remboursements</p>
            <p className="font-semibold text-[#C0392B]">-1 200 €</p>
          </div>
        </div>
      </div>
    </div>
  );
}
