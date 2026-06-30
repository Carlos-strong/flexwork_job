"use client";

import { useState } from "react";
import { paysList } from "@/lib/data/countries";

const HIERARCHY = [
  {
    level: "Pays",
    icon: "🌍",
    examples: ["France", "Cameroun", "Sénégal", "Côte d'Ivoire"],
    description: "Pays d'intervention de la plateforme",
  },
  {
    level: "Département / Région",
    icon: "🗺️",
    examples: ["Île-de-France", "Centre", "Littoral", "Dakar"],
    description: "Découpages administratifs régionaux",
  },
  {
    level: "Commune / Arrondissement",
    icon: "🏙️",
    examples: ["Paris 11e", "Douala 3e", "Dakar Plateau"],
    description: "Communes et arrondissements",
  },
  {
    level: "Ville",
    icon: "📍",
    examples: ["Paris", "Douala", "Dakar", "Abidjan"],
    description: "Villes principales",
  },
  {
    level: "Quartier",
    icon: "🏘️",
    examples: ["Akwa", "Bonanjo", "Médina", "Cocody"],
    description: "Quartiers utilisés pour la localisation précise",
  },
];

const COUNTRIES = [
  { name: "Bénin", code: "BJ", active: true, currency: "XOF", symbol: "FCFA" },
  { name: "France", code: "FR", active: true, currency: "EUR", symbol: "€" },
  { name: "États-Unis", code: "US", active: true, currency: "USD", symbol: "$" },
  { name: "Royaume-Uni", code: "GB", active: true, currency: "GBP", symbol: "£" },
  { name: "Nigéria", code: "NG", active: true, currency: "NGN", symbol: "₦" },
  { name: "Ghana", code: "GH", active: true, currency: "GHS", symbol: "GH₵" },
];

export default function BackOfficeLocationsPage() {
  const [countries, setCountries] = useState(COUNTRIES);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  
  // Data Manager State
  const [managingLevel, setManagingLevel] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchData, setSearchData] = useState("");

  const handleManage = async (level: string) => {
    setManagingLevel(level);
    setLoadingData(true);
    setLocationData([]);
    setSearchData("");

    try {
      let type = "";
      if (level === "Pays") type = "pays";
      else if (level.includes("Région")) type = "regions";
      else if (level.includes("Ville")) type = "villes";
      else if (level.includes("Quartier")) type = "quartiers&ville=Douala"; // Demo
      else type = "pays"; // default

      const res = await fetch(`/api/localisation?type=${type}`);
      const json = await res.json();
      setLocationData(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const addCountry = () => {
    if (!selectedCountry) return;
    const countryData = paysList.find(c => c.code === selectedCountry);
    if (!countryData) return;

    if (!countries.some(c => c.code === countryData.code)) {
      setCountries(prev => [...prev, { name: countryData.nom, code: countryData.code, active: true, currency: countryData.devise, symbol: countryData.symbole || "" }]);
    }
    setIsAdding(false);
    setSelectedCountry("");
  };

  const toggleCountry = (code: string) => {
    setCountries((prev) =>
      prev.map((c) => c.code === code ? { ...c, active: !c.active } : c)
    );
  };

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="mb-2">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Localisation</h2>
        <p className="text-[14px] text-[#5A5750] mt-1">
          Gestion géographique de la plateforme — pays actifs, découpages, villes
        </p>
      </div>

      {/* Pays actifs */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E0D9] bg-[#FAFAF8] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            <span className="inline-flex items-center justify-center bg-white text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
              {countries.length}
            </span>
            Pays actifs
          </div>
        </div>
        <div className="divide-y divide-[#E2E0D9]">
          {countries.map((country) => (
            <div key={country.code} className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAF8] transition-colors">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1916]">{country.name}</p>
                <p className="text-[12px] text-[#5A5750] mt-0.5 font-mono">{country.code} · {country.currency}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold border leading-none ${
                  country.active
                    ? "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]"
                    : "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]"
                }`}>
                  {country.active ? "Actif" : "Inactif"}
                </span>
                <button
                  onClick={() => toggleCountry(country.code)}
                  className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors"
                >
                  {country.active ? "Désactiver" : "Activer"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#E2E0D9] bg-[#FAFAF8]">
          {!isAdding ? (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full rounded-[10px] border border-dashed border-[#E2E0D9] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#2D5BE3] hover:border-[#C3D1F8] transition-colors"
            >
              + Ajouter un pays
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <select 
                className="flex-1 rounded-[10px] border border-[#E2E0D9] px-3 py-2 text-[13px] text-[#1A1916] bg-white focus:outline-none focus:border-[#2D5BE3]"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option value="">Sélectionner un pays</option>
                {paysList
                  .filter(p => !countries.some(c => c.code === p.code))
                  .map(p => (
                    <option key={p.code} value={p.code}>
                      {p.nom} - {p.devise}
                    </option>
                  ))}
              </select>
              <button 
                onClick={addCountry}
                disabled={!selectedCountry}
                className="rounded-[10px] bg-[#2D5BE3] text-white px-4 py-2 text-[13px] font-semibold hover:bg-[#1F4DD4] disabled:opacity-50 transition-colors"
              >
                Ajouter
              </button>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setSelectedCountry("");
                }}
                className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hiérarchie géographique */}
      <div>
        <h3 className="text-[16px] font-semibold mb-4 text-[#1A1916]">Hiérarchie géographique</h3>
        <div className="space-y-3">
          {HIERARCHY.map((h, i) => (
            <div key={h.level} className="flex items-start gap-4 rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm hover:border-[#C3D1F8] transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FAFAF8] border border-[#E2E0D9] text-[20px]">
                {h.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-[#9C9A95] uppercase tracking-wider">Niveau {i + 1}</span>
                </div>
                <p className="text-[14px] font-semibold text-[#1A1916]">{h.level}</p>
                <p className="text-[12px] text-[#5A5750] mt-0.5">{h.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {h.examples.map((e) => (
                    <span key={e} className="rounded-[20px] bg-[#FAFAF8] border border-[#E2E0D9] px-2 py-0.5 text-[11px] font-medium text-[#5A5750]">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => handleManage(h.level)}
                className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors"
              >
                Gérer
              </button>
            </div>
          ))}
        </div>
      </div>

      {managingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/20 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[#1A1916]">Gestion des données : {managingLevel}</h3>
              <button 
                onClick={() => setManagingLevel(null)}
                className="text-[#9C9A95] hover:text-[#1A1916] transition-colors font-medium text-[13px]"
              >
                ✕ Fermer
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="w-full rounded-[10px] border border-[#E2E0D9] px-4 py-2.5 mb-4 bg-white text-[14px] text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] transition-all"
              value={searchData}
              onChange={(e) => setSearchData(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto rounded-[12px] border border-[#E2E0D9] divide-y divide-[#E2E0D9] bg-[#FAFAF8]">
              {loadingData ? (
                <div className="p-8 text-center text-[13px] text-[#5A5750]">Chargement des données...</div>
              ) : (
                locationData
                  .filter(d => (d.nom || d.name || "").toLowerCase().includes(searchData.toLowerCase()))
                  .slice(0, 100) // limite pour les perfs si "villes"
                  .map((item, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-white transition-colors">
                    <div>
                      <p className="font-semibold text-[14px] text-[#1A1916]">{item.nom || item.name}</p>
                      {(item.region || item.chefLieu || item.devise) && (
                        <p className="text-[12px] text-[#5A5750] mt-0.5">
                          {item.region || item.chefLieu || `Devise: ${item.devise}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {!loadingData && locationData.length === 0 && (
                <div className="p-8 text-center text-[13px] text-[#5A5750]">Aucune donnée trouvée.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
