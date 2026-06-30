"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Mission {
  id: string; title: string; description: string; budget: number;
  currency: string; budgetType: string; skills: string[];
  duration: string; location: string; status: string;
  workMode: string; missionCity: string | null; missionCountry: string | null;
  applicationsCount: number; expiresAt: string | null; createdAt: string;
}

/** Format de réponse paginée de l'API Gateway */
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean };
}

export function MissionSearch() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "OPEN" });
      if (skillFilter) params.set("skill", skillFilter);

      const res = await fetch(`/api/missions?${params.toString()}`);
      const json: PaginatedResponse<Mission> | Mission[] = await res.json();

      // Gère à la fois l'ancien format (tableau brut) et le nouveau (paginé)
      const items: Mission[] = Array.isArray(json) ? json : (json as PaginatedResponse<Mission>).data ?? [];

      const filtered = search
        ? items.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
        : items;

      setMissions(filtered);
    } catch {
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, [search, skillFilter]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une mission..."
          className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
        />
        <input
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          placeholder="Compétence"
          className="w-full sm:w-48 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#5A5750]">Chargement...</div>
      ) : missions.length === 0 ? (
        <div className="text-center py-12 text-[#5A5750]">Aucune mission trouvée.</div>
      ) : (
        <div className="space-y-4">
          {missions.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/freelancer/missions/${m.id}`}
              className="block rounded-xl border border-[#E2E0D9] p-6 hover:border-[#C3D1F8] hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="mt-1 text-xs text-[#5A5750]">
                    {m.workMode === "REMOTE" && "🌐 À distance"}
                    {m.workMode === "ON_SITE" && `📍 Sur site${m.missionCity ? ` — ${m.missionCity}` : ""}`}
                    {m.workMode === "HYBRID" && `🔄 Hybride${m.missionCity ? ` — ${m.missionCity}` : ""}`}
                    {!m.workMode && (m.location || "")}
                    {m.duration ? ` · ${m.duration}` : ""}
                  </p>
                </div>
                <span className="text-lg font-bold text-[#2D5BE3]">
                  {m.budgetType === "OPEN_QUOTE" ? "Budget libre" : formatCurrency(m.budget, m.currency)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {m.skills.map((s) => (
                  <span key={s} className="rounded-full bg-[#F5F5F0] px-2.5 py-0.5 text-xs font-medium">{s}</span>
                ))}
              </div>
              <div className="mt-2 text-xs text-amber-600 font-medium">
                {m.expiresAt
                  ? (() => {
                      const days = Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return days > 0 ? `⏰ Expire dans ${days} jour(s)` : "⏰ Expirée";
                    })()
                  : "⏰ Ouverte en continu"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
