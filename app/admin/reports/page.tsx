"use client";

import { useState } from "react";

type ReportStatus = "OUVERT" | "EN_COURS" | "RESOLU" | "REJETE";
type ReportType = "SPAM" | "FAUSSE_IDENTITE" | "CONTENU_INAPPROPRIE" | "ARNAQUE" | "AUTRE";

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string }> = {
  OUVERT:   { label: "Ouvert",    color: "bg-red-100 text-red-700" },
  EN_COURS: { label: "En cours",  color: "bg-orange-100 text-orange-700" },
  RESOLU:   { label: "Résolu",    color: "bg-green-100 text-green-700" },
  REJETE:   { label: "Rejeté",    color: "bg-[#F5F5F0] text-[#5A5750]" },
};

const TYPE_LABELS: Record<ReportType, string> = {
  SPAM:               "Spam",
  FAUSSE_IDENTITE:    "Fausse identité",
  CONTENU_INAPPROPRIE:"Contenu inapproprié",
  ARNAQUE:            "Arnaque",
  AUTRE:              "Autre",
};

interface Report {
  id: string;
  reportedBy: string;
  targetType: "USER" | "MISSION" | "MESSAGE";
  targetId: string;
  targetName: string;
  type: ReportType;
  description: string;
  status: ReportStatus;
  createdAt: string;
}

const MOCK: Report[] = [];

export default function AdminReportsPage() {
  const [reports] = useState<Report[]>(MOCK);
  const [filter, setFilter] = useState<"ALL" | ReportStatus>("OUVERT");

  const counts: Record<ReportStatus, number> = {
    OUVERT:   reports.filter((r) => r.status === "OUVERT").length,
    EN_COURS: reports.filter((r) => r.status === "EN_COURS").length,
    RESOLU:   reports.filter((r) => r.status === "RESOLU").length,
    REJETE:   reports.filter((r) => r.status === "REJETE").length,
  };

  const displayed = filter === "ALL" ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Signalements</h2>
        <p className="text-sm text-[#5A5750]">
          Signalements d&apos;utilisateurs, de missions ou de messages par la communauté
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["OUVERT", "EN_COURS", "RESOLU", "REJETE"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "ALL" : s)}
              className={`rounded-xl border p-4 text-left transition-all ${
                filter === s ? "border-primary ring-2 ring-[#2D5BE3]/20" : "border-[#E2E0D9] hover:border-[#C3D1F8]"
              }`}
            >
              <p className="text-2xl font-bold">{counts[s]}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
          <p className="text-4xl mb-3">🚩</p>
          <h3 className="font-semibold text-lg">Aucun signalement</h3>
          <p className="mt-1 text-sm text-[#5A5750]">
            Les signalements effectués par les utilisateurs apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F5F5F0]/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Cible</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Description</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-[#5A5750]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((r) => {
                const cfg = STATUS_CONFIG[r.status];
                return (
                  <tr key={r.id} className="hover:bg-[#F5F5F0]/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.targetName}</p>
                      <p className="text-xs text-[#5A5750]">{r.targetType} · par {r.reportedBy}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#F5F5F0] px-2 py-0.5 text-xs">
                        {TYPE_LABELS[r.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A5750] max-w-xs line-clamp-2">
                      {r.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button className="rounded-lg bg-[#2D5BE3] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1F4DD4] transition-colors">
                          Traiter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
