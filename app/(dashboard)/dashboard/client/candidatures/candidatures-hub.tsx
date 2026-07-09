"use client";

import { useState } from "react";
import Link from "next/link";
import { RecruitmentPipeline } from "@/components/missions/recruitment-pipeline";
import type { PipelineApplication } from "@/components/missions/recruitment-pipeline";

// ─── Types ────────────────────────────────────────────────────────

export interface MissionGroup {
  missionId: string;
  missionTitle: string;
  missionDescription?: string;
  missionSkills?: string[];
  missionBudget?: string;
  missionDuration?: string;
  missionStatus?: string;
  contractId?: string;
  applications: PipelineApplication[];
}

// ─── Component ────────────────────────────────────────────────────

interface Props {
  missions: MissionGroup[];
  defaultMissionId?: string;
}

export function CandidaturesHub({ missions, defaultMissionId }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    defaultMissionId ?? missions[0]?.missionId ?? ""
  );

  const selected = missions.find((m) => m.missionId === selectedId);

  if (missions.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#DADFDD] p-16 text-center">
        <p className="text-3xl mb-3">📩</p>
        <h3
          className="text-[18px] font-medium mb-2"
          style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
        >
          Aucune candidature reçue
        </h3>
        <p className="text-[13.5px] text-[#6B7280] mb-5">
          Les candidatures à vos missions apparaîtront ici.
        </p>
        <Link
          href="/dashboard/client/missions/creation"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white"
          style={{ background: "#1F7A5C" }}
        >
          + Créer une mission
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Mission selector — visible seulement si plusieurs missions */}
      {missions.length > 1 && (
        <div className="flex items-center gap-3 mb-5">
          <label
            className="text-[11px] uppercase tracking-[0.08em] font-medium flex-shrink-0"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
          >
            Mission
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 max-w-[420px] rounded-[10px] border border-[#DADFDD] bg-white px-3 py-2 text-[13.5px] text-[#14213D] focus:outline-none focus:ring-2 focus:ring-[#1F7A5C]/30"
          >
            {missions.map((m) => (
              <option key={m.missionId} value={m.missionId}>
                {m.missionTitle} ({m.applications.length} candidature{m.applications.length !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pipeline — key force un remount complet à chaque changement de mission */}
      {selected ? (
        <RecruitmentPipeline
          key={selected.missionId}
          missionId={selected.missionId}
          missionTitle={selected.missionTitle}
          missionDescription={selected.missionDescription}
          missionSkills={selected.missionSkills}
          missionBudget={selected.missionBudget}
          missionDuration={selected.missionDuration}
          missionStatus={selected.missionStatus}
          initialApplications={selected.applications}
          contractId={selected.contractId}
          editHref={`/dashboard/client/missions/${selected.missionId}/edit`}
        />
      ) : (
        <div className="flex items-center justify-center py-20">
          <p className="text-[13.5px] text-[#6B7280]">Sélectionnez une mission pour gérer ses candidatures.</p>
        </div>
      )}
    </div>
  );
}
