"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/ui";

// ── Types ──

interface PrixService {
  serviceId: string;
  prix: number;
}

interface DisponibiliteDay {
  jour: "LUNDI" | "MARDI" | "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI" | "DIMANCHE";
  estDisponible: boolean;
  heureDebut: string;
  heureFin: string;
}

interface ProfilData {
  // Expertise
  metierId: string;
  metierLibelle: string;
  experience: "DEBUTANT" | "UN_A_TROIS_ANS" | "TROIS_A_CINQ_ANS" | "PLUS_DE_CINQ_ANS" | "";
  competences: string[];
  description: string;
  portfolioUrl: string;
  // Zone
  paysIntervention: string;
  departement: string;
  ville: string;
  quartier: string;
  rayonKm: number;
  // Tarification
  modeTarification: "HORAIRE" | "JOURNALIER" | "HEBDOMADAIRE" | "MENSUEL" | "PAR_PRESTATION" | "";
  taux: number | undefined;
  prixServices: PrixService[];
  // Disponibilité
  disponibilites: DisponibiliteDay[];
}

const JOURS: DisponibiliteDay["jour"][] = [
  "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE",
];

const LABELS_TARIF: Record<string, string> = {
  HORAIRE: "Prix fixé — Horaire",
  JOURNALIER: "Prix fixé — Journalier",
  HEBDOMADAIRE: "Prix fixé — Hebdomadaire",
  MENSUEL: "Prix fixé — Mensuel",
  PAR_PRESTATION: "Devis libre",
};

const UNITES_TARIF: Record<string, string> = {
  HORAIRE: "FCFA/h",
  JOURNALIER: "FCFA/jour",
  HEBDOMADAIRE: "FCFA/sem.",
  MENSUEL: "FCFA/mois",
  PAR_PRESTATION: "",
};

// ── Composant principal ──

export default function FreelancerProfilPage() {
  const [profils, setProfils] = useState<ProfilData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metiers, setMetiers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [paysList, setPaysList] = useState<{ code: string; nom: string }[]>([]);
  const [section, setSection] = useState<"liste" | "creation">("liste");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // État du formulaire d'un profil
  const emptyProfil = (): ProfilData => ({
    metierId: "", metierLibelle: "", experience: "", competences: [], description: "",
    portfolioUrl: "", paysIntervention: "CM", departement: "", ville: "", quartier: "",
    rayonKm: 10, modeTarification: "", taux: undefined, prixServices: [],
    disponibilites: JOURS.map((j) => ({ jour: j, estDisponible: true, heureDebut: "09:00", heureFin: "17:00" })),
  });

  const [form, setForm] = useState<ProfilData>(emptyProfil());

  // Chargement initial
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, srvRes, paysRes, profilRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/services"),
          fetch("/api/localisation?type=pays"),
          fetch("/api/prestataire/metier"),
        ]);
        const catData = catRes.ok ? await catRes.json() : { data: [] };
        setMetiers((catData.data || []).flatMap((c: any) => c.metiers || []));
        const srvData = srvRes.ok ? await srvRes.json() : { data: [] };
        setServices(srvData.data || []);
        setPaysList(paysRes.ok ? (await paysRes.json()).data || [] : []);

        // Charger les profils existants
        if (profilRes.ok) {
          const profilData = await profilRes.json();
          const existingProfils = Array.isArray(profilData) ? profilData
            : profilData.profils ? profilData.profils
            : profilData.data ? profilData.data
            : profilData.prestataireMetierId ? [profilData] : [];
          if (existingProfils.length > 0) {
            setProfils(existingProfils.map((p: any) => ({
              metierId: p.metierId || "",
              metierLibelle: p.metier?.libelle || p.metierLibelle || "",
              experience: p.experience || "",
              competences: p.competences || [],
              description: p.description || "",
              portfolioUrl: p.portfolioUrl || "",
              paysIntervention: p.paysIntervention || "CM",
              departement: p.departement || "",
              ville: p.ville || "",
              quartier: p.quartier || "",
              rayonKm: p.rayonKm || 10,
              modeTarification: p.modeTarification || "",
              taux: p.taux ?? undefined,
              prixServices: p.prixServices || [],
              disponibilites: p.disponibilites || JOURS.map((j) => ({ jour: j, estDisponible: true, heureDebut: "09:00", heureFin: "17:00" })),
            })));
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const updateForm = useCallback((d: Partial<ProfilData>) => {
    setForm((prev) => ({ ...prev, ...d }));
  }, []);

  // ── Créer un nouveau profil ──
  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/prestataire/metier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metierId: form.metierId,
          experience: form.experience,
          description: form.description,
          modeTarification: form.modeTarification,
          taux: form.taux,
          prixServices: form.prixServices,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'enregistrement");
      }
      const data = await res.json();

      // Zone
      await fetch("/api/prestataire/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestataireMetierId: data.prestataireMetierId,
          paysIntervention: form.paysIntervention,
          departement: form.departement || undefined,
          ville: form.ville || undefined,
          quartier: form.quartier || undefined,
          rayonKm: form.rayonKm,
        }),
      });

      // Services
      if (form.competences.length > 0 || form.prixServices.length > 0) {
        await fetch("/api/prestataire/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prestataireMetierId: data.prestataireMetierId,
            services: form.competences,
            prixServices: form.prixServices,
          }),
        });
      }

      // Disponibilité
      await fetch("/api/prestataire/disponibilite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestataireMetierId: data.prestataireMetierId,
          disponibilites: form.disponibilites,
        }),
      });

      toast.success("Profil professionnel créé avec succès !");
      setProfils((prev) => [...prev, { ...form, metierLibelle: metiers.find((m) => m.id === form.metierId)?.libelle || "" }]);
      setForm(emptyProfil());
      setSection("liste");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création du profil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[14px] text-[#5A5750]">Chargement...</div>;
  }

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="mb-8">
        <PageHeader
          title="Mes profils professionnels"
          subtitle="Créez et gérez vos profils. Un freelance peut avoir plusieurs profils."
          actions={
            section === "liste" ? (
              <button
                onClick={() => { setForm(emptyProfil()); setSection("creation"); setEditingIndex(null); }}
                className="rounded-[10px] bg-[#2D5BE3] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm"
              >
                + Nouveau profil
              </button>
            ) : undefined
          }
        />
      </div>

      {section === "liste" && (
        <div className="space-y-4">
          {profils.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-[#E2E0D9] bg-[#FAFAF8] rounded-[16px]">
              <p className="text-4xl mb-4">🛠️</p>
              <p className="text-[16px] font-bold text-[#1A1916] mb-2">Aucun profil professionnel</p>
              <p className="text-[14px] text-[#5A5750] mb-6">
                Créez votre premier profil pour commencer à postuler aux missions.
              </p>
              <button
                onClick={() => { setForm(emptyProfil()); setSection("creation"); }}
                className="rounded-[10px] bg-[#2D5BE3] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm"
              >
                Créer un profil professionnel
              </button>
            </div>
          ) : (
            profils.map((p, i) => (
              <div key={i} className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-[16px] text-[#1A1916]">{p.metierLibelle || `Profil ${i + 1}`}</p>
                    <p className="text-[13px] text-[#5A5750] mt-1 font-medium">
                      {p.experience && EXP_LABELS[p.experience]} 
                      {p.taux ? ` · ${p.taux.toLocaleString()} ${UNITES_TARIF[p.modeTarification] || "FCFA"}` : ""}
                      {p.ville ? ` · 📍 ${p.ville}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold border leading-none ${p.competences.length > 0 ? "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]" : "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]"}`}>
                    {p.competences.length} compétence(s)
                  </span>
                </div>
                {p.description && (
                  <p className="mt-3 text-[13px] text-[#5A5750] line-clamp-2 leading-relaxed">{p.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.competences.slice(0, 6).map((s) => (
                    <span key={s} className="rounded-[20px] bg-[#FAFAF8] border border-[#E2E0D9] px-2.5 py-0.5 text-[11px] font-medium text-[#5A5750]">{s}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === "creation" && (
        <div className="space-y-8 pb-10">
          {/* ═══ Étape 1 : Expertise ═══ */}
          <section className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#E2E0D9] pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[14px] font-bold text-[#2D5BE3]">1</span>
              <h3 className="text-[16px] font-bold text-[#1A1916]">Expertise</h3>
            </div>
            <div className="space-y-5">
              {/* Métier principal */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Métier principal <span className="text-[#C0392B]">*</span></label>
                <select value={form.metierId}
                  onChange={(e) => updateForm({ metierId: e.target.value, metierLibelle: metiers.find((m) => m.id === e.target.value)?.libelle || "" })}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none">
                  <option value="">Sélectionnez un métier</option>
                  {metiers.map((m: any) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
                </select>
              </div>

              {/* Expérience */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Niveau d'expérience <span className="text-[#C0392B]">*</span></label>
                <select value={form.experience}
                  onChange={(e) => updateForm({ experience: e.target.value as ProfilData["experience"] })}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none">
                  <option value="">Sélectionnez</option>
                  <option value="DEBUTANT">Débutant (&lt; 1 an)</option>
                  <option value="UN_A_TROIS_ANS">1 à 3 ans</option>
                  <option value="TROIS_A_CINQ_ANS">3 à 5 ans</option>
                  <option value="PLUS_DE_CINQ_ANS">Plus de 5 ans</option>
                </select>
              </div>

              {/* Compétences (tags) */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Compétences</label>
                <CompTagInput values={form.competences} onChange={(v) => updateForm({ competences: v })} services={services} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Description <span className="text-[#C0392B]">*</span></label>
                <textarea value={form.description} onChange={(e) => updateForm({ description: e.target.value })}
                  rows={3} className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]"
                  placeholder="Décrivez votre expertise, vos réalisations..." />
              </div>

              {/* Portfolio */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Portfolio (URL)</label>
                <input type="url" value={form.portfolioUrl} onChange={(e) => updateForm({ portfolioUrl: e.target.value })}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="https://..." />
              </div>
            </div>
          </section>

          {/* ═══ Étape 2 : Logistique & Tarification ═══ */}
          <section className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#E2E0D9] pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[14px] font-bold text-[#2D5BE3]">2</span>
              <h3 className="text-[16px] font-bold text-[#1A1916]">Logistique &amp; Tarification</h3>
            </div>
            <div className="space-y-5">
              {/* Zone */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Zone d'intervention <span className="text-[#C0392B]">*</span></label>
                <select value={form.paysIntervention}
                  onChange={(e) => updateForm({ paysIntervention: e.target.value })}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none">
                  {paysList.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
                  <option value="INTERNATIONAL">🌍 International / À distance</option>
                </select>
              </div>
              {form.paysIntervention !== "INTERNATIONAL" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={form.departement} onChange={(e) => updateForm({ departement: e.target.value })}
                    className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="Département (opt.)" />
                  <input value={form.ville} onChange={(e) => updateForm({ ville: e.target.value })}
                    className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="Ville" />
                  <input value={form.quartier} onChange={(e) => updateForm({ quartier: e.target.value })}
                    className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="Quartier" />
                </div>
              )}
              {form.paysIntervention !== "INTERNATIONAL" && (
                <div>
                  <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5 flex items-center justify-between">Rayon d'intervention <span className="bg-[#FAFAF8] px-2 py-0.5 rounded text-[11px] font-mono text-[#5A5750]">{form.rayonKm} km</span></label>
                  <input type="range" min={1} max={50} value={form.rayonKm}
                    onChange={(e) => updateForm({ rayonKm: parseInt(e.target.value) })} className="w-full accent-[#2D5BE3]" />
                </div>
              )}

              {/* Tarif */}
              <div>
                <label className="block text-[13px] font-semibold text-[#1A1916] mb-1.5">Tarif <span className="text-[#C0392B]">*</span></label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select value={form.modeTarification}
                    onChange={(e) => updateForm({ modeTarification: e.target.value as ProfilData["modeTarification"] })}
                    className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none">
                    <option value="">Choisissez</option>
                    <option value="HORAIRE">Prix fixé — Horaire</option>
                    <option value="JOURNALIER">Prix fixé — Journalier</option>
                    <option value="HEBDOMADAIRE">Prix fixé — Hebdomadaire</option>
                    <option value="MENSUEL">Prix fixé — Mensuel</option>
                    <option value="PAR_PRESTATION">Devis libre</option>
                  </select>
                  {form.modeTarification && form.modeTarification !== "PAR_PRESTATION" && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={form.taux ?? ""}
                        onChange={(e) => updateForm({ taux: e.target.value ? Number(e.target.value) : undefined })}
                        className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="Montant" />
                      <span className="text-[13px] text-[#5A5750] whitespace-nowrap font-mono">{UNITES_TARIF[form.modeTarification]}</span>
                    </div>
                  )}
                  {form.modeTarification === "PAR_PRESTATION" && (
                    <p className="text-[13px] text-[#5A5750]">Aucun montant par défaut — le freelance fixe son prix à la candidature.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Étape 3 : Disponibilité ═══ */}
          <section className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-[#E2E0D9] pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[14px] font-bold text-[#2D5BE3]">3</span>
              <h3 className="text-[16px] font-bold text-[#1A1916]">Disponibilité</h3>
            </div>
            <div className="space-y-3">
              {form.disponibilites.map((d, i) => (
                <div key={d.jour} className="flex items-center gap-4 py-2 hover:bg-[#FAFAF8] px-3 rounded-[10px] transition-colors">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={d.estDisponible}
                      onChange={(e) => {
                        const newDispos = [...form.disponibilites];
                        newDispos[i] = { ...newDispos[i], estDisponible: e.target.checked };
                        updateForm({ disponibilites: newDispos });
                      }}
                      className="h-4 w-4 rounded border-[#E2E0D9] text-[#2D5BE3] focus:ring-[#2D5BE3] cursor-pointer" />
                    <span className="w-28 text-[14px] font-semibold text-[#1A1916]">{d.jour.charAt(0) + d.jour.slice(1).toLowerCase()}</span>
                  </label>
                  {d.estDisponible && (
                    <div className="flex items-center gap-2">
                      <input type="time" value={d.heureDebut}
                        onChange={(e) => {
                          const newDispos = [...form.disponibilites];
                          newDispos[i] = { ...newDispos[i], heureDebut: e.target.value };
                          updateForm({ disponibilites: newDispos });
                        }}
                        className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none transition-colors" />
                      <span className="text-[13px] text-[#5A5750]">à</span>
                      <input type="time" value={d.heureFin}
                        onChange={(e) => {
                          const newDispos = [...form.disponibilites];
                          newDispos[i] = { ...newDispos[i], heureFin: e.target.value };
                          updateForm({ disponibilites: newDispos });
                        }}
                        className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none transition-colors" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setSection("liste")}
              className="rounded-[10px] border border-[#E2E0D9] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
              ← Retour
            </button>
            <button onClick={handleCreate} disabled={saving || !form.metierId || !form.description || !form.modeTarification}
              className="rounded-[10px] bg-[#1A7A4A] px-8 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0F5C35] transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(26,122,74,0.15)]">
              {saving ? "Création..." : "✅ Créer le profil professionnel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant Tags (Compétences) ──

function CompTagInput({ values, onChange, services }: { values: string[]; onChange: (v: string[]) => void; services: any[] }) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  const suggestions = services
    .map((s: any) => s.libelle || s.nom || "")
    .filter((s: string) => s.toLowerCase().includes(input.toLowerCase()) && !values.includes(s));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-[20px] bg-[#EEF2FD] border border-[#C3D1F8] px-2.5 py-1 text-[12px] font-medium text-[#2D5BE3]">
            {v}
            <button type="button" onClick={() => removeTag(i)} className="text-[#2D5BE3] hover:text-[#C0392B] transition-colors">&times;</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(input); } }}
          className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]" placeholder="Tapez une compétence et Entrée" />
        {input && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-[10px] border border-[#E2E0D9] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden">
            {suggestions.slice(0, 6).map((s: string) => (
              <button key={s} type="button" onClick={() => addTag(s)}
                className="block w-full text-left px-3 py-2 text-[14px] text-[#1A1916] hover:bg-[#EEF2FD] transition-colors border-b border-[#E2E0D9] last:border-b-0">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const EXP_LABELS: Record<string, string> = {
  DEBUTANT: "Débutant",
  UN_A_TROIS_ANS: "1-3 ans",
  TROIS_A_CINQ_ANS: "3-5 ans",
  PLUS_DE_CINQ_ANS: "+5 ans",
};
