"use client";

import { useState } from "react";

const REPORTS = [
  {
    id: "freelance_activity",
    label: "Activité freelances",
    description: "Inscriptions, profils validés, taux d'activité, revenus générés",
    icon: "👤",
    formats: ["CSV", "Excel", "PDF"],
  },
  {
    id: "client_missions",
    label: "Missions clients",
    description: "Missions publiées, budget total, taux de complétion, délais",
    icon: "📋",
    formats: ["CSV", "Excel"],
  },
  {
    id: "financial_summary",
    label: "Résumé financier",
    description: "Commissions perçues, escrow actifs, retraits freelances, TVA",
    icon: "💰",
    formats: ["CSV", "Excel", "PDF"],
  },
  {
    id: "kyc_compliance",
    label: "Conformité KYC",
    description: "Vérifications en attente, validées, rejetées — délais moyens",
    icon: "🛡️",
    formats: ["CSV", "PDF"],
  },
  {
    id: "disputes",
    label: "Litiges & résolutions",
    description: "Volume de litiges, taux de résolution, montants contestés",
    icon: "⚖️",
    formats: ["CSV", "Excel", "PDF"],
  },
  {
    id: "categories_activity",
    label: "Activité par catégorie",
    description: "Missions et freelances par catégorie / métier / service",
    icon: "📊",
    formats: ["CSV", "Excel"],
  },
];

type Format = "CSV" | "Excel" | "PDF";

export default function BackOfficeReportsPage() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (reportId: string, format: Format) => {
    const key = `${reportId}_${format}`;
    setLoading(key);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(null);
    alert(`Export ${format} pour "${reportId}" déclenché du ${startDate} au ${endDate}`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Reporting & Exports</h2>
        <p className="text-sm text-[#5A5750]">
          Génération de rapports et exports CSV / Excel / PDF
        </p>
      </div>

      {/* Sélection de période */}
      <div className="rounded-xl border border-[#E2E0D9] p-5">
        <h3 className="font-semibold mb-3 text-sm">Période</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-[#5A5750] mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5A5750] mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 self-end">
            {["Ce mois", "3 mois", "6 mois", "Année"].map((label) => (
              <button
                key={label}
                className="rounded-lg border border-[#E2E0D9] px-3 py-2 text-xs hover:bg-[#EEF2FD] transition-colors"
                onClick={() => {
                  const now = new Date();
                  const end = now.toISOString().split("T")[0];
                  let start = now;
                  if (label === "Ce mois") start = new Date(now.getFullYear(), now.getMonth(), 1);
                  if (label === "3 mois") start = new Date(now.setMonth(now.getMonth() - 3));
                  if (label === "6 mois") start = new Date(now.setMonth(now.getMonth() - 6));
                  if (label === "Année") start = new Date(new Date().getFullYear(), 0, 1);
                  setEndDate(end);
                  setStartDate(start.toISOString().split("T")[0]);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rapports disponibles */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Rapports disponibles</h3>
        {REPORTS.map((report) => (
          <div key={report.id} className="flex items-center gap-4 rounded-xl border border-[#E2E0D9] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F0] text-xl">
              {report.icon}
            </div>
            <div className="flex-1">
              <p className="font-medium">{report.label}</p>
              <p className="text-xs text-[#5A5750] mt-0.5">{report.description}</p>
            </div>
            <div className="flex gap-2">
              {(report.formats as Format[]).map((fmt) => {
                const key = `${report.id}_${fmt}`;
                const isLoading = loading === key;
                return (
                  <button
                    key={fmt}
                    onClick={() => handleExport(report.id, fmt)}
                    disabled={isLoading || loading !== null}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      fmt === "CSV"
                        ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                        : fmt === "Excel"
                        ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {isLoading ? "…" : `📥 ${fmt}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#5A5750]">
        Les exports dépassant 10 000 lignes sont envoyés par e-mail à l&apos;adresse du compte administrateur.
      </p>
    </div>
  );
}
