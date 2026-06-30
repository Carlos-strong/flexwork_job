"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Freelancer {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  skills?: string[];
  hourlyRate?: number;
  location?: string;
  isValidated?: boolean;
  rating?: number;
}

const METIERS = ["Tous", "Développement", "Design", "Marketing", "BTP", "Plomberie", "Électricité", "Maçonnerie", "Menuiserie"];

export default function ClientFreelancersPage() {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMetier, setSelectedMetier] = useState("Tous");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    fetch("/api/freelancers")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setFreelancers(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setFreelancers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = freelancers.filter((f) => {
    const name = `${f.firstName ?? ""} ${f.lastName ?? ""} ${f.name ?? ""} ${f.title ?? ""}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchVerified = !verifiedOnly || f.isValidated;
    const matchMetier = selectedMetier === "Tous" || (f.skills ?? []).some((s) =>
      s.toLowerCase().includes(selectedMetier.toLowerCase())
    );
    return matchSearch && matchVerified && matchMetier;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Recherche de freelances</h2>
        <p className="text-[14px] text-[#5A5750]">Trouvez le professionnel idéal pour votre mission</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, métier, compétence…"
          className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]"
        />
        <select
          value={selectedMetier}
          onChange={(e) => setSelectedMetier(e.target.value)}
          className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none"
        >
          {METIERS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] cursor-pointer text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded border-[#E2E0D9] text-[#2D5BE3] focus:ring-[#2D5BE3]"
          />
          ✅ Vérifiés uniquement
        </label>
      </div>

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-[16px] border border-[#E2E0D9] p-6 animate-pulse bg-white">
              <div className="flex gap-3">
                <div className="h-12 w-12 rounded-[10px] bg-[#F5F5F0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-[#F5F5F0] rounded" />
                  <div className="h-3 w-24 bg-[#F5F5F0] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#E2E0D9] bg-white p-16 text-center">
          <p className="text-[32px] mb-3">🔍</p>
          <h3 className="font-semibold text-[18px] text-[#1A1916]">Aucun freelance trouvé</h3>
          <p className="mt-1 text-[14px] text-[#5A5750]">Essayez d&apos;élargir vos critères de recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => {
            const fullName = f.name || `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || "Professionnel";
            return (
              <Link
                key={f.id}
                href={`/dashboard/client/freelancer/${f.id}`}
                className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 hover:border-[#C3D1F8] hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[18px] font-semibold text-[#2D5BE3]">
                    {fullName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-[#1A1916] truncate">{fullName}</p>
                      {f.isValidated && (
                        <span className="text-[14px]" title="Identité vérifiée">✅</span>
                      )}
                    </div>
                    {f.title && (
                      <p className="text-[14px] text-[#5A5750] truncate">{f.title}</p>
                    )}
                  </div>
                </div>

                {f.skills && f.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {f.skills.slice(0, 4).map((s) => (
                      <span key={s} className="rounded-[20px] bg-[#FAFAF8] border border-[#E2E0D9] px-2 py-0.5 text-[12px] font-medium text-[#5A5750]">{s}</span>
                    ))}
                    {f.skills.length > 4 && (
                      <span className="text-[12px] text-[#5A5750]">+{f.skills.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[14px]">
                  {f.hourlyRate ? (
                    <span className="font-semibold text-[#2D5BE3]">{f.hourlyRate.toLocaleString()} €/h</span>
                  ) : (
                    <span className="text-[#5A5750]">Sur devis</span>
                  )}
                  {f.location && (
                    <span className="text-[#5A5750] text-[12px]">📍 {f.location}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
