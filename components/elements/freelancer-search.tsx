"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useScrollRestore } from "@/hooks/use-scroll-restore";

interface Freelancer {
  id: string;
  name: string;
  title: string;
  rate: number;
  currency: string;
  skills: string[];
  rating: number;
  completedMissions: number;
  availability: string;
  location: string;
  avatar: string;
}

interface FreelancerSearchProps {
  basePath?: string;
}

export function FreelancerSearch({ basePath = "/dashboard/client" }: FreelancerSearchProps) {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const { filters, setFilter, clearFilters } = useUrlFilters<{
    search?: string;
    skill?: string;
    maxRate?: string;
  }>();
  const { search = "", skill: skillFilter = "", maxRate = "" } = filters;

  // Restaurer la position de scroll au retour (plan5.md §7)
  useScrollRestore("client-freelancer-search", { mode: "page" });

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (skillFilter) params.set("skill", skillFilter);
    if (maxRate) params.set("maxRate", maxRate);

    fetch(`/api/users/freelancers?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { setFreelancers(data); setLoading(false); });
  }, [search, skillFilter, maxRate]);

  const hasFilters = search || skillFilter || maxRate;

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setFilter("search", e.target.value)}
          placeholder="Rechercher par nom ou compétence..."
          className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
        />
        <input
          type="text"
          value={skillFilter}
          onChange={(e) => setFilter("skill", e.target.value)}
          placeholder="Filtrer par compétence"
          className="w-full sm:w-48 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
        />
        <input
          type="number"
          value={maxRate}
          onChange={(e) => setFilter("maxRate", e.target.value)}
          placeholder="TJM max (€)"
          className="w-full sm:w-40 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2.5 text-xs text-[#5A5750] hover:bg-[#F5F5F0] transition-colors whitespace-nowrap"
          >
            ✕ Effacer
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#5A5750]">Chargement...</div>
      ) : freelancers.length === 0 ? (
        <div className="text-center py-12 text-[#5A5750]">Aucun freelance trouvé.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((f) => (
            <div key={f.id} className="rounded-xl border border-[#E2E0D9] p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FD] text-sm font-semibold text-[#2D5BE3]">{f.avatar}</div>
                <div>
                  <p className="font-semibold text-sm">{f.name}</p>
                  <p className="text-xs text-[#5A5750]">{f.title}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.skills.slice(0, 4).map((s) => (
                  <span key={s} className="rounded-full bg-[#F5F5F0] px-2 py-0.5 text-xs">{s}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-[#2D5BE3]">{f.rate} €/jour</span>
                <span className="text-[#5A5750]">★ {f.rating}</span>
              </div>
              <div className="mt-1 text-xs text-[#5A5750]">
                {f.location} · {f.availability === "full-time" ? "Temps plein" : f.availability === "part-time" ? "Temps partiel" : "Weekends"} · {f.completedMissions} missions
              </div>
              <Link
                href={`${basePath}/freelancer/${f.id}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-xs font-medium hover:bg-[#EEF2FD] transition-colors"
              >
                Voir le profil
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
