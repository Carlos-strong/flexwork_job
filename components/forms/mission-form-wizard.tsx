"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { paysList, getCurrencyForCountry } from "@/lib/data/countries";

// ── Types ──
type WorkMode = "REMOTE" | "ON_SITE" | "HYBRID";
type BudgetType = "FIXED" | "OPEN_QUOTE";

const steps = ["Titre", "Besoin", "Budget & Lieu", "Disponibilité", "Publication"];

export function MissionFormWizard({ missionId }: { missionId?: string }) {
  const router = useRouter();
  const isEditing = !!missionId;
  const [loadingData, setLoadingData] = useState(!!missionId);
  const [step, setStep] = useState(isEditing ? 4 : 0);
  const [form, setForm] = useState({
    title: "",
    description: "",
    // Taxonomie (PRD Étape 1 — cascade 3 niveaux)
    categorieId: "",
    categorieAutre: "",
    metierId: "",
    metierAutre: "",
    serviceAutre: "",
    experienceRequise: "" as "DEBUTANT" | "UN_A_TROIS_ANS" | "TROIS_A_CINQ_ANS" | "PLUS_DE_CINQ_ANS" | "",
    cahierDesCharges: null as File | null,
    // Budget
    budget: "",
    budgetType: "FIXED" as BudgetType,
    currency: "EUR",
    // Compétences
    skills: "",
    duration: "",
    // Lieu d'exécution — modèle en 2 niveaux (PRD règle #2)
    workMode: "REMOTE" as WorkMode,
    international: false,
    hybridDaysPerWeek: "",
    missionCity: "",
    missionCountry: "",
    missionDepartement: "",
    // Disponibilité souhaitée (PRD Étape 3)
    missionStartDate: "",
    missionEndDate: "",
    missionDays: "",
    missionStartHour: "",
    missionEndHour: "",
    expiresAt: "",
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [metiers, setMetiers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  // Marquer comme modifié dès qu'un champ change
  const markDirty = () => { if (isEditing) setDirty(true); };

  // Helper pour le bouton d'enregistrement avec état visuel
  const renderSaveBtn = () => {
    if (!isEditing) return null;
    const statusClass = saveStatus === "saved" ? "text-[#1A7A4A] border-[#9FD4B4]" : dirty ? "text-[#B45309] border-[#FCD89A]" : "text-[#9C9A95]";
    const label = saveStatus === "saving" ? "⏳" : saveStatus === "saved" ? "✅ Sauvegardé" : dirty ? "💾 Enregistrer" : "✅ À jour";
    return <button onClick={handleSubmit} disabled={loading || saveStatus === "saved"} className={"shrink-0 rounded-md border px-3 py-1 text-xs font-medium transition-colors " + statusClass}>{label}</button>;
  };

  // Recharger les données depuis la base (mode édition)
  const reloadFromServer = async () => {
    if (!missionId) return;
    try {
      const res = await fetch(`/api/missions/${missionId}`);
      const data = await res.json();
      const m = data.data || data;
      setForm((prev) => ({
        ...prev,
        title: m.title ?? prev.title,
        description: m.description ?? prev.description,
        categorieId: m.categorieId ?? prev.categorieId,
        categorieAutre: m.categorieAutre ?? prev.categorieAutre,
        metierId: m.metierId ?? prev.metierId,
        metierAutre: m.metierAutre ?? prev.metierAutre,
        serviceAutre: m.serviceAutre ?? prev.serviceAutre,
        experienceRequise: m.experienceRequise ?? prev.experienceRequise,
        budget: m.budget?.toString() ?? prev.budget,
        budgetType: m.budgetType ?? prev.budgetType,
        skills: Array.isArray(m.skills) ? m.skills.join(", ") : prev.skills,
        duration: m.duration ?? prev.duration,
        workMode: m.workMode ?? prev.workMode,
        hybridDaysPerWeek: m.hybridDaysPerWeek != null ? m.hybridDaysPerWeek.toString() : prev.hybridDaysPerWeek,
        missionCity: m.missionCity ?? prev.missionCity,
        missionCountry: m.missionCountry ?? prev.missionCountry,
        missionStartDate: m.missionStartDate ? m.missionStartDate.slice(0, 10) : prev.missionStartDate,
        missionEndDate: m.missionEndDate ? m.missionEndDate.slice(0, 10) : prev.missionEndDate,
        expiresAt: (m as any).expiresAt ? (m as any).expiresAt.slice(0, 10) : prev.expiresAt,
        missionDays: m.missionDays ?? prev.missionDays,
        missionStartHour: m.missionStartHour ?? prev.missionStartHour,
        missionEndHour: m.missionEndHour ?? prev.missionEndHour,
      }));
      setDirty(false);
      setSaveStatus("idle");
    } catch { /* silencieux */ }
  };

  const goToStep = async (s: number) => {
    if (isEditing && s !== step) await reloadFromServer();
    setStep(s);
  };

  // Charger les catégories/services au montage
  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()).catch(() => ({ categories: [] })),
      fetch("/api/services").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([catData, srvData]) => {
      const cats = catData.data || [];
      setCategories(cats);
      setServices(srvData.data || []);
      const allMetiers = cats.flatMap((c: any) => (c.metiers || []).map((m: any) => ({ ...m, categorieId: c.id })));
      setMetiers(allMetiers);
    });

    if (missionId) {
      reloadFromServer().then(() => setLoadingData(false)).catch(() => setLoadingData(false));
    }
  }, [missionId]);

  const update = <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
  };

  const canProceed = () => {
    if (step === 0) return form.title.length >= 10;
    if (step === 1) return form.description.length >= 50 && !!form.experienceRequise;
    if (step === 2) return (form.budgetType === "OPEN_QUOTE" || Number(form.budget) >= 100) && !!form.missionCountry;
    if (step === 3) return true; // Disponibilité optionnelle
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSaveStatus("saving");

    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `/api/missions/${missionId}` : "/api/missions";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        categorieId: form.categorieId || null,
        categorieAutre: form.categorieAutre || null,
        metierId: form.metierId || null,
        metierAutre: form.metierAutre || null,
        serviceAutre: form.serviceAutre || null,
        experienceRequise: form.experienceRequise || null,
        budget: form.budgetType === "OPEN_QUOTE" ? null : Number(form.budget),
        budgetType: form.budgetType,
        currency: form.currency,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        duration: form.duration,
        workMode: form.workMode,
        international: form.international,
        hybridDaysPerWeek: form.workMode === "HYBRID" && form.hybridDaysPerWeek
          ? Number(form.hybridDaysPerWeek)
          : null,
        missionCity: form.workMode !== "REMOTE" ? form.missionCity : null,
        missionCountry: form.missionCountry, // Utile pour récupérer la devise même en REMOTE
        missionDepartement: form.workMode !== "REMOTE" ? form.missionDepartement : null,
        missionStartDate: form.missionStartDate || null,
        missionEndDate: form.missionEndDate || null,
        expiresAt: form.expiresAt || null,
        missionDays: form.missionDays || null,
        missionStartHour: form.missionStartHour || null,
        missionEndHour: form.missionEndHour || null,
        // Champ legacy conservé pour rétrocompatibilité
        location: form.workMode === "REMOTE" ? "Remote"
          : form.workMode === "HYBRID" ? "Hybride"
          : "Présentiel",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setSaveStatus("error");
      try {
        const errData = await res.json();
        setError(errData.error || errData.message || `Erreur ${res.status}`);
      } catch {
        setError(`Erreur ${res.status} — veuillez réessayer`);
      }
      return;
    }

    setError("");

    if (isEditing) {
      router.refresh();
      router.push(`/dashboard/client/missions/${missionId}`);
    } else {
      router.push("/dashboard/client");
      router.refresh();
    }
  };

  // Met à jour la devise quand le pays change
  useEffect(() => {
    if (form.missionCountry) {
      const newCurrency = getCurrencyForCountry(form.missionCountry);
      if (newCurrency !== form.currency) {
        setForm((prev) => ({ ...prev, currency: newCurrency }));
      }
    }
  }, [form.missionCountry, form.currency]);

  return (
    <div className="max-w-[800px] mx-auto w-full">
      {loadingData ? (
        <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-8 text-center shadow-sm">
          <p className="text-[14px] text-[#5A5750]">Chargement des données…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Barre de progression */}
          <div className="flex items-center gap-2 mb-8 bg-white p-4 rounded-[12px] border border-[#E2E0D9] shadow-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 flex-1">
            <button
              type="button"
              onClick={() => isEditing && goToStep(i)}
              disabled={!isEditing}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-all shrink-0 ${
                i <= step
                  ? "bg-[#2D5BE3] text-white shadow-sm"
                  : "bg-[#FAFAF8] text-[#9C9A95] border border-[#E2E0D9]"
              } ${isEditing ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            >
              {i + 1}
            </button>
            <button
              type="button"
              onClick={() => isEditing && goToStep(i)}
              disabled={!isEditing}
              className={`text-[12px] font-medium hidden sm:block whitespace-nowrap ${
                i <= step ? "text-[#1A1916]" : "text-[#9C9A95]"
              } ${isEditing ? "cursor-pointer hover:text-[#2D5BE3]" : "cursor-default"}`}
            >
              {s}
            </button>
            {i < steps.length - 1 && (
              <div className={`h-[2px] flex-1 min-w-[20px] mx-2 rounded-full ${
                i < step ? "bg-[#2D5BE3]" : "bg-[#E2E0D9]"
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-[#C3D1F8]/30 transition-all duration-300">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-[#1A1916]">Quel est le titre de votre mission ?</h2>
              {renderSaveBtn()}
            </div>
            <p className="text-[13px] text-[#5A5750]">Soyez précis pour attirer les bons profils.</p>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ex: Développeur React/Next.js pour SaaS"
              className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-3 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
              autoFocus
            />
            <p className="text-[11px] text-[#9C9A95]">{form.title.length} / 10 caractères minimum</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-[#1A1916]">Décrivez votre besoin</h2>
              {renderSaveBtn()}
            </div>
            <p className="text-[13px] text-[#5A5750]">Détaillez les objectifs, le contexte et les livrables attendus.</p>

            {/* Taxonomie dynamique — 3 niveaux en cascade (PRD §4) */}
            <div className="rounded-[12px] border border-[#E2E0D9] bg-[#FAFAF8] p-5 space-y-4">
              <p className="text-[14px] font-semibold text-[#1A1916]">Métier</p>

              {/* Niveau 1 : Domaine d'intervention */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">1. Domaine d'intervention</label>
                <select
                  value={form.categorieId}
                  onChange={(e) => {
                    update("categorieId", e.target.value);
                    update("metierId", ""); // reset cascade
                  }}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                >
                  <option value="">Sélectionnez un domaine</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.libelle || cat.nom}</option>
                  ))}
                  <option value="AUTRE">Autre (précisez)</option>
                </select>
                {form.categorieId === "AUTRE" && (
                  <input
                    type="text" value={form.categorieAutre}
                    onChange={(e) => update("categorieAutre", e.target.value)}
                    placeholder="Ex: Photographie, Traduction..."
                    className="mt-2 w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916]"
                  />
                )}
              </div>

              {/* Niveau 2 : Type d'intervention (métier) — filtré par domaine */}
              {form.categorieId && form.categorieId !== "AUTRE" && (
                <div className="space-y-1 mt-4">
                  <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">2. Type d'intervention</label>
                  <select
                    value={form.metierId}
                    onChange={(e) => update("metierId", e.target.value)}
                    className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]"
                  >
                    <option value="">Sélectionnez un type</option>
                    {metiers
                      .filter((m: any) => m.categorieId === form.categorieId)
                      .map((m: any) => (
                        <option key={m.id} value={m.id}>{m.libelle}</option>
                      ))}
                    <option value="AUTRE">Autre (précisez)</option>
                  </select>
                  {form.metierId === "AUTRE" && (
                    <input
                      type="text" value={form.metierAutre}
                      onChange={(e) => update("metierAutre", e.target.value)}
                      placeholder="Ex: Maçonnerie générale..."
                      className="mt-2 w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916]"
                    />
                  )}
                </div>
              )}

              {/* Niveau 3 : Services — filtrés par métier sélectionné */}
              {form.metierId && form.metierId !== "AUTRE" && (
                <div className="space-y-1 mt-4">
                  <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">3. Services souhaités</label>
                  <p className="text-[11px] text-[#9C9A95] mb-2">Sélectionnez les services attendus parmi ceux proposés :</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {services
                      .filter((s: any) => s.metierId === form.metierId)
                      .slice(0, 12)
                      .map((srv: any) => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => {
                            const tags = form.skills ? form.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
                            if (tags.includes(srv.libelle)) {
                              update("skills", tags.filter((t) => t !== srv.libelle).join(", "));
                            } else {
                              update("skills", [...tags, srv.libelle].join(", "));
                            }
                          }}
                          className={`rounded-[20px] px-3 py-1 text-[11px] font-semibold transition-colors border ${
                            form.skills.split(",").map((s) => s.trim()).includes(srv.libelle)
                              ? "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]"
                              : "bg-white text-[#5A5750] border-[#E2E0D9] hover:bg-[#FAFAF8]"
                          }`}
                        >
                          {srv.libelle}
                        </button>
                      ))}
                  </div>
                  <input
                    type="text"
                    value={form.skills}
                    onChange={(e) => update("skills", e.target.value)}
                    placeholder="Tapez vos mots-clés... (ex: Figma, API...)"
                    className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916]"
                  />
                </div>
              )}
            </div>

            {/* Niveau d'expérience requis */}
            <div className="space-y-2 mt-6">
              <p className="text-[14px] font-semibold text-[#1A1916]">Niveau d'expérience requis <span className="text-[#C0392B]">*</span></p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "DEBUTANT", label: "Débutant", desc: "Moins d'1 an" },
                  { value: "UN_A_TROIS_ANS", label: "1 à 3 ans", desc: "Junior" },
                  { value: "TROIS_A_CINQ_ANS", label: "3 à 5 ans", desc: "Confirmé" },
                  { value: "PLUS_DE_CINQ_ANS", label: "Plus de 5 ans", desc: "Senior" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("experienceRequise", opt.value)}
                    className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                      form.experienceRequise === opt.value
                        ? "border-[#2D5BE3] bg-[#EEF2FD]"
                        : "border-[#E2E0D9] bg-white hover:border-[#C3D1F8]"
                    }`}
                  >
                    <span className={`block font-semibold text-[13px] ${form.experienceRequise === opt.value ? 'text-[#2D5BE3]' : 'text-[#1A1916]'}`}>{opt.label}</span>
                    <span className="block text-[11px] text-[#5A5750] mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Description */}
            <div className="space-y-2 mt-6">
              <p className="text-[14px] font-semibold text-[#1A1916]">Description</p>
              <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Nous recherchons un prestataire pour..."
              rows={4}
              className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-3 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]"
            />
            <p className="text-[11px] text-[#9C9A95]">{form.description.length} / 50 caractères minimum</p>
            </div>

            {/* Cahier des charges */}
            <div className="space-y-2 mt-4">
              <p className="text-[14px] font-semibold text-[#1A1916]">Cahier des charges (optionnel)</p>
              <div className="rounded-[10px] border-2 border-dashed border-[#E2E0D9] bg-[#FAFAF8] p-6 text-center hover:bg-[#EEF2FD] hover:border-[#2D5BE3] transition-colors cursor-pointer group">
                <input
                  type="file"
                  accept=".pdf,image/*,.doc,.docx,.zip"
                  onChange={(e) => update("cahierDesCharges", e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-[24px] block mb-2 opacity-50 group-hover:opacity-100">📎</span>
                  <span className="text-[13px] font-medium text-[#1A1916]">Cliquez pour ajouter un fichier</span>
                  {form.cahierDesCharges && (
                    <p className="mt-2 text-[12px] text-[#1A7A4A] font-semibold">✓ {form.cahierDesCharges.name}</p>
                  )}
                  <p className="mt-1 text-[11px] text-[#9C9A95]">PDF, DOC, ZIP, JPG ou PNG (max 10 Mo)</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Budget & Lieu d'exécution</h2>
              {renderSaveBtn()}
            </div>

            {/* Budget (PRD Étape 2) */}
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[#1A1916]">Budget</p>
              <div className="grid grid-cols-2 gap-3">
                {(["FIXED", "OPEN_QUOTE"] as BudgetType[]).map((type) => (
                  <button key={type} type="button" onClick={() => update("budgetType", type)}
                    className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                      form.budgetType === type ? "border-[#2D5BE3] bg-[#EEF2FD]" : "border-[#E2E0D9] bg-white hover:border-[#C3D1F8]"
                    }`}>
                    {type === "FIXED" ? (
                      <><span className={`block font-semibold text-[13px] ${form.budgetType === type ? 'text-[#2D5BE3]' : 'text-[#1A1916]'}`}>Budget fixé</span><span className="block text-[11px] text-[#5A5750] mt-0.5">Je définis un montant indicatif</span></>
                    ) : (
                      <><span className={`block font-semibold text-[13px] ${form.budgetType === type ? 'text-[#2D5BE3]' : 'text-[#1A1916]'}`}>Ouvert aux devis</span><span className="block text-[11px] text-[#5A5750] mt-0.5">Les prestataires proposent leur prix</span></>
                    )}
                  </button>
                ))}
              </div>
              {form.budgetType === "FIXED" && (
                <div className="flex items-center gap-3 mt-4">
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C9A95] font-semibold text-[14px]">{form.currency}</span>
                    <input type="number" value={form.budget} onChange={(e) => update("budget", e.target.value)}
                      placeholder="5000" min="100"
                      className="w-full rounded-[10px] border border-[#E2E0D9] bg-white pl-14 pr-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]" autoFocus />
                  </div>
                  <span className="text-[12px] text-[#5A5750]">Commission plateforme : 5%</span>
                </div>
              )}
            </div>

            <div className="border-t border-[#E2E0D9] pt-6" />

            {/* Lieu d'exécution — 2 niveaux (PRD règle #2) */}
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[#1A1916]">Lieu d'exécution</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => update("workMode", "REMOTE")}
                  className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                    form.workMode === "REMOTE" ? "border-[#2D5BE3] bg-[#EEF2FD]" : "border-[#E2E0D9] bg-white hover:border-[#C3D1F8]"
                  }`}>
                  <span className={`block font-semibold text-[13px] ${form.workMode === "REMOTE" ? 'text-[#2D5BE3]' : 'text-[#1A1916]'}`}>100% À distance</span>
                  <span className="block text-[11px] text-[#5A5750] mt-0.5">Aucun déplacement requis</span>
                </button>
                <button type="button"
                  onClick={() => update("workMode", form.workMode === "REMOTE" ? "ON_SITE" : form.workMode)}
                  className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                    form.workMode !== "REMOTE" ? "border-[#2D5BE3] bg-[#EEF2FD]" : "border-[#E2E0D9] bg-white hover:border-[#C3D1F8]"
                  }`}>
                  <span className={`block font-semibold text-[13px] ${form.workMode !== "REMOTE" ? 'text-[#2D5BE3]' : 'text-[#1A1916]'}`}>Présentiel</span>
                  <span className="block text-[11px] text-[#5A5750] mt-0.5">Sur site ou Hybride</span>
                </button>
              </div>

              {/* Option "Ouvrir à l'international" pour Remote */}
              {form.workMode === "REMOTE" && (
                <div className="space-y-4 pl-4 border-l-2 border-[#C3D1F8] mt-4 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.international}
                      onChange={(e) => update("international", e.target.checked)}
                      className="rounded border-[#E2E0D9] text-[#2D5BE3] focus:ring-[#2D5BE3] h-4 w-4" />
                    <span className="text-[13px] font-medium text-[#1A1916]">Ouvrir à l'international</span>
                  </label>
                  <div className="space-y-1 max-w-sm mt-3">
                    <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Pays / Devise de paiement <span className="text-[#C0392B]">*</span></label>
                    <select value={form.missionCountry}
                      onChange={(e) => update("missionCountry", e.target.value)}
                      className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]">
                      <option value="">Sélectionnez un pays</option>
                      {paysList.map((p) => (
                        <option key={p.code} value={p.code}>{p.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Sous-type + champs géo pour Présentiel */}
              {form.workMode !== "REMOTE" && (
                <div className="space-y-4 pl-4 border-l-2 border-[#C3D1F8] mt-4 py-2">
                  <p className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Type de présence</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => update("workMode", "ON_SITE")}
                      className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                        form.workMode === "ON_SITE" ? "border-[#2D5BE3] bg-[#FEF3C7]" : "border-[#E2E0D9] bg-white hover:border-[#FCD89A]"
                      }`}>
                      <span className={`block font-semibold text-[13px] ${form.workMode === "ON_SITE" ? 'text-[#B45309]' : 'text-[#1A1916]'}`}>100% Sur site</span>
                      <span className="block text-[11px] text-[#5A5750] mt-0.5">Tous les jours en présentiel</span>
                    </button>
                    <button type="button" onClick={() => update("workMode", "HYBRID")}
                      className={`rounded-[12px] border-2 px-4 py-3 text-left transition-all ${
                        form.workMode === "HYBRID" ? "border-[#2D5BE3] bg-[#FEF3C7]" : "border-[#E2E0D9] bg-white hover:border-[#FCD89A]"
                      }`}>
                      <span className={`block font-semibold text-[13px] ${form.workMode === "HYBRID" ? 'text-[#B45309]' : 'text-[#1A1916]'}`}>Hybride</span>
                      <span className="block text-[11px] text-[#5A5750] mt-0.5">Mix présentiel + remote</span>
                    </button>
                  </div>
                  {form.workMode === "HYBRID" && (
                    <div className="mt-3">
                      <label className="text-[12px] text-[#5A5750] font-medium mb-1 block">Jours/semaine sur site</label>
                      <input type="number" min="1" max="6" value={form.hybridDaysPerWeek}
                        onChange={(e) => update("hybridDaysPerWeek", e.target.value)}
                        placeholder="Ex: 2" className="w-32 rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A5750] uppercase tracking-wider">Pays <span className="text-[#C0392B]">*</span></label>
                      <select value={form.missionCountry}
                        onChange={(e) => update("missionCountry", e.target.value)}
                        className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[13px] text-[#1A1916] focus:border-[#2D5BE3]">
                        <option value="">Sélectionnez un pays</option>
                        {paysList.map((p) => (
                          <option key={p.code} value={p.code}>{p.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A5750] uppercase tracking-wider">Département (opt.)</label>
                      <input type="text" value={form.missionDepartement}
                        onChange={(e) => update("missionDepartement", e.target.value)}
                        placeholder="Littoral" className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[13px] text-[#1A1916] focus:border-[#2D5BE3]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A5750] uppercase tracking-wider">Ville</label>
                      <input type="text" value={form.missionCity}
                        onChange={(e) => update("missionCity", e.target.value)}
                        placeholder="Douala" className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[13px] text-[#1A1916] focus:border-[#2D5BE3]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-[#1A1916]">Disponibilité souhaitée</h2>
              {renderSaveBtn()}
            </div>
            <p className="text-[13px] text-[#5A5750]">Indiquez les plages horaires et les jours d'intervention souhaités (optionnel).</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Date de démarrage souhaitée</label>
                <input type="date" value={form.missionStartDate}
                  onChange={(e) => update("missionStartDate", e.target.value)}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Date de fin souhaitée</label>
                <input type="date" value={form.missionEndDate}
                  onChange={(e) => update("missionEndDate", e.target.value)}
                  min={form.missionStartDate || undefined}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Jours d'intervention</label>
                <select value={form.missionDays}
                  onChange={(e) => update("missionDays", e.target.value)}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]">
                  <option value="">Indifférent</option>
                  <option value="LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI">Lun-Ven (semaine)</option>
                  <option value="LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI,SAMEDI">Lun-Sam</option>
                  <option value="LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI,SAMEDI,DIMANCHE">Tous les jours</option>
                  <option value="SAMEDI,DIMANCHE">Week-end</option>
                  <option value="SUR_RDV">Sur rendez-vous</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Heure début</label>
                <input type="time" value={form.missionStartHour}
                  onChange={(e) => update("missionStartHour", e.target.value)}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Heure fin</label>
                <input type="time" value={form.missionEndHour}
                  onChange={(e) => update("missionEndHour", e.target.value)}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
              </div>
            </div>

            {/* Durée estimée */}
            <div className="space-y-1 mt-6">
              <label className="text-[12px] font-semibold text-[#5A5750] uppercase tracking-wider">Durée estimée de la mission (optionnel)</label>
              <input type="text" value={form.duration}
                onChange={(e) => update("duration", e.target.value)}
                placeholder="Ex: 3 mois"
                className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
            </div>

            <div className="border-t border-[#E2E0D9] pt-6 mt-6" />
            <div className="space-y-3">
              <h3 className="text-[14px] font-semibold text-[#1A1916]">Expiration de l'offre</h3>
              <p className="text-[12px] text-[#9C9A95]">Passé ce délai, la mission sera retirée des résultats de recherche.</p>
              <div className="space-y-1 w-1/2 mt-2">
                <input type="date" value={form.expiresAt}
                  onChange={(e) => update("expiresAt", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2.5 text-[14px] text-[#1A1916] focus:border-[#2D5BE3]" />
              </div>
            </div>
          </div>

          
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-[#1A1916]">Aperçu & Publication</h2>
            <p className="text-[13px] text-[#5A5750]">Vérifiez les informations avant de publier. Cliquez sur ✏️ pour modifier une rubrique.</p>

            <div className="rounded-[16px] border border-[#E2E0D9] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] divide-y divide-[#E2E0D9] overflow-hidden">

              {/* ══════ ÉTAPE 1 — TITRE ══════ */}
              <div className="px-5 py-3 bg-[#FAFAF8] border-b border-[#E2E0D9]">
                <p className="text-[11px] text-[#5A5750] font-semibold uppercase tracking-wider">📌 Étape 1 — Titre</p>
              </div>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Titre</p>
                  <p className="text-[14px] font-semibold text-[#1A1916]">{form.title || <span className="italic text-[#9C9A95]">Non renseigné</span>}</p>
                </div>
                <button type="button" onClick={() => goToStep(0)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
              </div>

              {/* ══════ ÉTAPE 2 — BESOIN ══════ */}
              <div className="px-5 py-3 bg-[#FAFAF8] border-b border-[#E2E0D9]">
                <p className="text-[11px] text-[#5A5750] font-semibold uppercase tracking-wider">📝 Étape 2 — Description du besoin</p>
              </div>
              <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-[#E2E0D9]">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Description</p>
                  <p className="text-[13px] text-[#5A5750] line-clamp-3 whitespace-pre-line leading-relaxed">{form.description || <span className="italic text-[#9C9A95]">Non renseigné</span>}</p>
                </div>
                <button type="button" onClick={() => goToStep(1)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
              </div>

              {(form.categorieId || form.categorieAutre) && (
                <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-[#E2E0D9]">
                  <div>
                    <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Domaine & Métier</p>
                    <p className="text-[13px] text-[#1A1916] font-medium">
                      {form.categorieId === "AUTRE" ? form.categorieAutre
                        : categories.find((c: any) => c.id === form.categorieId)?.libelle || form.categorieId}
                      {form.metierId && form.metierId !== "AUTRE" && (
                        <> <span className="text-[#9C9A95]">→</span> {metiers.find((m: any) => m.id === form.metierId)?.libelle}</>
                      )}
                      {form.metierId === "AUTRE" && <> <span className="text-[#9C9A95]">→</span> {form.metierAutre}</>}
                    </p>
                    {form.serviceAutre && <p className="text-[12px] text-[#5A5750] mt-1">Précision : {form.serviceAutre}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.skills.split(",").map((s, i) => s.trim() && (
                        <span key={i} className="rounded-[20px] bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-2 py-0.5 text-[11px] font-medium">{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => goToStep(1)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
                </div>
              )}

              {form.experienceRequise && (
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Niveau d'expérience requis</p>
                    <p className="text-[13px] text-[#1A1916] font-medium">{{ DEBUTANT: "Débutant", UN_A_TROIS_ANS: "1 à 3 ans", TROIS_A_CINQ_ANS: "3 à 5 ans", PLUS_DE_CINQ_ANS: "Plus de 5 ans" }[form.experienceRequise] || form.experienceRequise}</p>
                  </div>
                  <button type="button" onClick={() => goToStep(1)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
                </div>
              )}

              {/* ══════ ÉTAPE 3 — BUDGET & LIEU ══════ */}
              <div className="px-5 py-3 bg-[#FAFAF8] border-b border-[#E2E0D9]">
                <p className="text-[11px] text-[#5A5750] font-semibold uppercase tracking-wider">💰 Étape 3 — Budget & Lieu</p>
              </div>
              <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-[#E2E0D9]">
                <div>
                  <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Budget</p>
                  <p className="text-[14px] font-bold text-[#1A7A4A] bg-[#E6F5EE] border border-[#9FD4B4] px-2 py-0.5 rounded-[6px] inline-block">
                    {form.budgetType === "FIXED" ? `${Number(form.budget).toLocaleString()} €` : "Ouvert aux devis"}
                  </p>
                </div>
                <button type="button" onClick={() => goToStep(2)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
              </div>

              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-1">Lieu d'exécution</p>
                  <p className="text-[13px] text-[#1A1916] font-medium">
                    {form.workMode === "REMOTE"
                      ? <span className="flex items-center gap-1.5"><span className="text-[#2D5BE3]">🌍</span> 100% À distance{form.international ? " (International)" : ""}</span>
                      : form.workMode === "HYBRID"
                      ? <span className="flex items-center gap-1.5"><span className="text-[#B45309]">🏢</span> Hybride — {form.missionCity}, {form.missionCountry}{form.missionDepartement ? ` (${form.missionDepartement})` : ""} — <span className="bg-[#FAFAF8] px-1.5 rounded">{form.hybridDaysPerWeek}j/sem sur site</span></span>
                      : <span className="flex items-center gap-1.5"><span className="text-[#B45309]">📍</span> Sur site — {form.missionCity}, {form.missionCountry}{form.missionDepartement ? ` (${form.missionDepartement})` : ""}</span>}
                  </p>
                </div>
                <button type="button" onClick={() => goToStep(2)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
              </div>

              {/* ══════ ÉTAPE 4 — DISPONIBILITÉ ══════ */}
              <div className="px-5 py-3 bg-[#FAFAF8] border-b border-[#E2E0D9]">
                <p className="text-[11px] text-[#5A5750] font-semibold uppercase tracking-wider">📅 Étape 4 — Disponibilité</p>
              </div>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] text-[#9C9A95] uppercase tracking-wide font-semibold mb-2">Période</p>
                  <div className="text-[13px] text-[#5A5750] space-y-1.5">
                    {form.duration && <p>Durée estimée : <strong className="text-[#1A1916] font-medium bg-[#FAFAF8] px-1.5 rounded">{form.duration}</strong></p>}
                    {form.missionStartDate && <p>Démarrage : <strong className="text-[#1A1916] font-medium">{new Date(form.missionStartDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong></p>}
                    {form.missionEndDate && <p>Fin souhaitée : <strong className="text-[#1A1916] font-medium">{new Date(form.missionEndDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong></p>}
                    {form.missionDays && <p>Jours actifs : <strong className="text-[#1A1916] font-medium bg-[#FAFAF8] px-1.5 rounded">{form.missionDays.replace(/,/g, ", ")}</strong></p>}
                    {form.missionStartHour && form.missionEndHour && (
                      <p>Créneaux : <strong className="text-[#1A1916] font-mono">{form.missionStartHour} — {form.missionEndHour}</strong></p>
                    )}
                    {!form.duration && !form.missionStartDate && !form.missionEndDate && !form.missionDays && !form.missionStartHour && (
                      <span className="italic text-[#9C9A95]">Non renseigné (optionnel)</span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => goToStep(3)} className="shrink-0 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">✏️ Modifier</button>
              </div>
            </div>

            {error && <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => goToStep(3)}
                className="flex-[1] rounded-[10px] border border-[#E2E0D9] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
                ← Retour
              </button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-[2] rounded-[10px] bg-[#1A7A4A] px-8 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0F5C35] transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(26,122,74,0.15)] flex justify-center items-center gap-2">
                {loading ? "Traitement..." : isEditing ? "💾 Enregistrer les modifications" : "✅ Publier définitivement"}
              </button>
            </div>
          </div>
        )}

        {error && step < 4 && <div className="mt-6 rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}

        {/* Boutons de navigation (steps 0-3 uniquement) */}
        {step < 4 && (
          <div className="mt-8 flex justify-between gap-4 border-t border-[#E2E0D9] pt-6">
            {step > 0 ? (
              <button onClick={() => goToStep(step - 1)} className="rounded-[10px] border border-[#E2E0D9] bg-white px-6 py-2.5 text-[13px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
                ← Retour
              </button>
            ) : <div className="w-1" />}
            
            {isEditing ? (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-[10px] bg-[#2D5BE3] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? "⏳" : saveStatus === "saved" ? "✅ Sauvegardé" : "💾 Valider en brouillon"}
              </button>
            ) : (
              <button
                onClick={() => goToStep(step + 1)}
                disabled={!canProceed()}
                className="rounded-[10px] bg-[#1A1916] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#5A5750] transition-colors disabled:opacity-50 shadow-sm"
              >
                Étape Suivante →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    )}
    </div>
  );
}
