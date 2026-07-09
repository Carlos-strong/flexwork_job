"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ──

type Step = 1 | 2;

/** Étape 1 – Identifiants uniquement (pas d'appel API) */
interface Step1Data {
  email: string;
  password: string;
  confirmPassword: string;
  cguAccepted: boolean;
}

/** Étape 2 – Identité : infos perso uniquement (KYC différé à la 1ère candidature) */
interface Step2Data {
  firstName: string;
  lastName: string;
  phone: string;
  paysResidence: string;
  villeResidence: string;
  quartierResidence: string;
  adresseResidence: string;
}

interface RegistrationState {
  userId: string | null;
  step: Step;
  step1: Step1Data;
  step2: Step2Data;
  error: string;
  loading: boolean;
}

const initialState: RegistrationState = {
  userId: null,
  step: 1,
  step1: { email: "", password: "", confirmPassword: "", cguAccepted: false },
  step2: {
    firstName: "", lastName: "", phone: "",
    paysResidence: "CM", villeResidence: "", quartierResidence: "", adresseResidence: "",
  },
  error: "", loading: false,
};

const REGISTRATION_KEY = "flexwork_prestataire_registration";

// ── Helpers ──

function Input({ label, id, type = "text", value, onChange, required, placeholder, minLength, error, hint }: {
  label: string; id: string; type?: string; value: string | number;
  onChange: (v: string) => void; required?: boolean; placeholder?: string;
  minLength?: number; error?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1A1916] mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <input
        id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required} minLength={minLength}
        className={cn("w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] placeholder:text-[#9C9A95] transition-colors focus:outline-none focus:ring-1", error ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]")}
        placeholder={placeholder}
      />
      {hint && !error && <p className="mt-1 text-[12px] text-[#5A5750]">{hint}</p>}
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

// ── Étape 1 : Identifiants ──

function Step1Form({ data, onChange, onNext, error }: {
  data: Step1Data; onChange: (d: Partial<Step1Data>) => void;
  onNext: () => void; error: string;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Step1Data, string>>>({});

  const validate = () => {
    const e: Partial<Record<keyof Step1Data, string>> = {};
    if (!data.email.trim()) e.email = "L'email est requis";
    else if (!/^\S+@\S+\.\S+$/.test(data.email)) e.email = "Email invalide";
    if (!data.password) e.password = "Mot de passe requis";
    else if (data.password.length < 8) e.password = "8 caractères minimum";
    if (data.password !== data.confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas";
    if (!data.cguAccepted) e.cguAccepted = "Vous devez accepter les CGU pour continuer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (validate()) onNext(); }} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-[20px] font-bold text-[#1A1916] tracking-[-0.01em]">Créer votre compte</h2>
        <p className="text-[14px] text-[#5A5750] mt-1.5">Renseignez vos identifiants de connexion</p>
      </div>
      {error && <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}
      <Input label="Adresse email" id="s1-email" type="email" value={data.email}
        onChange={(v) => { onChange({ email: v }); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
        required placeholder="vous@email.com" error={errors.email} />
      <Input label="Mot de passe" id="s1-password" type="password" value={data.password}
        onChange={(v) => { onChange({ password: v }); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
        required minLength={8} placeholder="8 caractères minimum" error={errors.password} />
      <Input label="Confirmer le mot de passe" id="s1-confirm" type="password" value={data.confirmPassword}
        onChange={(v) => { onChange({ confirmPassword: v }); if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
        required placeholder="Répétez le mot de passe" error={errors.confirmPassword} />

      {/* CGU checkbox */}
      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-[12px] bg-[#FAFAF8] border border-[#E2E0D9] hover:border-[#C3D1F8] transition-colors">
        <input
          type="checkbox"
          checked={data.cguAccepted}
          onChange={(e) => { onChange({ cguAccepted: e.target.checked }); if (errors.cguAccepted) setErrors((p) => ({ ...p, cguAccepted: undefined })); }}
          className="mt-0.5 h-4 w-4 rounded border-[#E2E0D9] text-[#2D5BE3] focus:ring-[#2D5BE3]"
        />
        <span className="text-[12px] leading-relaxed text-[#5A5750]">
          J&apos;accepte les{" "}
          <Link href="/cgu" className="text-[#2D5BE3] font-semibold hover:underline" target="_blank">CGU</Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="text-[#2D5BE3] font-semibold hover:underline" target="_blank">Politique de confidentialité</Link>
        </span>
      </label>
      {errors.cguAccepted && <p className="text-[12px] font-medium text-[#C0392B]">{errors.cguAccepted}</p>}

      <button type="submit" className="w-full rounded-[10px] bg-[#2D5BE3] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm">
        Continuer
      </button>
      <p className="text-center text-[13px] text-[#5A5750]">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-[#2D5BE3] font-semibold hover:underline">Se connecter</Link>
      </p>
    </form>
  );
}

// ── Étape 2 : Identité (infos perso uniquement — KYC différé) ──

function Step2Form({ data, onChange, onPrev, onNext, error, loading }: {
  data: Step2Data; onChange: (d: Partial<Step2Data>) => void;
  onPrev: () => void; onNext: () => void; error: string; loading: boolean;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Step2Data, string>>>({});
  const [paysList, setPaysList] = useState<{ code: string; nom: string }[]>([]);
  const [villesList, setVillesList] = useState<{ nom: string; region: string }[]>([]);
  const [quartiersList, setQuartiersList] = useState<{ nom: string; populaire?: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/localisation?type=pays").then((r) => r.json()).then((d) => setPaysList(d.data || []));
  }, []);
  useEffect(() => {
    if (!data.paysResidence) { setVillesList([]); return; }
    fetch(`/api/localisation?type=villes&pays=${data.paysResidence}`).then((r) => r.json()).then((d) => setVillesList(d.data || []));
  }, [data.paysResidence]);
  useEffect(() => {
    if (!data.villeResidence) { setQuartiersList([]); return; }
    fetch(`/api/localisation?type=quartiers&ville=${encodeURIComponent(data.villeResidence)}`).then((r) => r.json()).then((d) => setQuartiersList(d.data || []));
  }, [data.villeResidence]);

  const validate = () => {
    const e: Partial<Record<keyof Step2Data, string>> = {};
    if (!data.firstName.trim()) e.firstName = "Le prénom est requis";
    if (!data.lastName.trim()) e.lastName = "Le nom est requis";
    if (!data.phone.trim()) e.phone = "Le téléphone est requis";
    else if (!/^[+\d][\d\s.\-]{7,}$/.test(data.phone)) e.phone = "Numéro invalide";
    if (!data.paysResidence) e.paysResidence = "Pays requis";
    if (!data.villeResidence.trim()) e.villeResidence = "Ville requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isComplete = !!data.firstName && !!data.lastName && !!data.phone &&
    !!data.paysResidence && !!data.villeResidence;

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (validate()) onNext(); }} className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-[20px] font-bold text-[#1A1916] tracking-[-0.01em]">Informations personnelles</h2>
        <p className="text-[14px] text-[#5A5750] mt-1.5">Complétez votre profil</p>
      </div>
      {error && <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}

      <div className="rounded-[12px] border border-[#E2E0D9] bg-[#FAFAF8] p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Prénom" id="s2-fn" value={data.firstName}
            onChange={(v) => { onChange({ firstName: v }); if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined })); }}
            required placeholder="Jean" error={errors.firstName} />
          <Input label="Nom" id="s2-ln" value={data.lastName}
            onChange={(v) => { onChange({ lastName: v }); if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined })); }}
            required placeholder="Dupont" error={errors.lastName} />
        </div>
        <Input label="Téléphone" id="s2-phone" type="tel" value={data.phone}
          onChange={(v) => { onChange({ phone: v }); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
          required placeholder="+237 6 XX XX XX XX" error={errors.phone} />

        <div>
          <label htmlFor="s2-pays" className="block text-[13px] font-semibold text-[#1A1916] mb-1">Pays de résidence <span className="text-[#C0392B]">*</span></label>
          <select id="s2-pays" value={data.paysResidence}
            onChange={(e) => { onChange({ paysResidence: e.target.value, villeResidence: "", quartierResidence: "" }); if (errors.paysResidence) setErrors((p) => ({ ...p, paysResidence: undefined })); }}
            className={cn("w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:ring-1", errors.paysResidence ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]")}>
            <option value="">Sélectionnez un pays</option>
            {paysList.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
          </select>
          {errors.paysResidence && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{errors.paysResidence}</p>}
        </div>

        <div>
          <label htmlFor="s2-ville" className="block text-[13px] font-semibold text-[#1A1916] mb-1">Ville <span className="text-[#C0392B]">*</span></label>
          {villesList.length > 0 ? (
            <select id="s2-ville" value={data.villeResidence}
              onChange={(e) => { onChange({ villeResidence: e.target.value, quartierResidence: "" }); if (errors.villeResidence) setErrors((p) => ({ ...p, villeResidence: undefined })); }}
              className={cn("w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:ring-1", errors.villeResidence ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]")}>
              <option value="">Sélectionnez une ville</option>
              {villesList.map((v) => <option key={v.nom} value={v.nom}>{v.nom} ({v.region})</option>)}
            </select>
          ) : (
            <input id="s2-ville" type="text" value={data.villeResidence}
              onChange={(e) => { onChange({ villeResidence: e.target.value }); if (errors.villeResidence) setErrors((p) => ({ ...p, villeResidence: undefined })); }}
              placeholder="Saisir la ville" disabled={!data.paysResidence}
              className={cn("w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] disabled:opacity-50 placeholder:text-[#9C9A95] focus:outline-none focus:ring-1", errors.villeResidence ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]")} />
          )}
          {errors.villeResidence && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{errors.villeResidence}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#1A1916] mb-1">Quartier</label>
          {quartiersList.length > 0 ? (
            <select value={data.quartierResidence}
              onChange={(e) => onChange({ quartierResidence: e.target.value })}
              className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]">
              <option value="">Sélectionnez un quartier</option>
              {quartiersList.map((q) => <option key={q.nom} value={q.nom}>{q.nom}{q.populaire ? " 🔥" : ""}</option>)}
            </select>
          ) : (
            <input type="text" value={data.quartierResidence}
              onChange={(e) => onChange({ quartierResidence: e.target.value })}
              placeholder="Saisir le quartier" disabled={!data.villeResidence}
              className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[14px] text-[#1A1916] disabled:opacity-50 placeholder:text-[#9C9A95] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]" />
          )}
        </div>

        <Input label="Adresse de résidence" id="s2-adresse" value={data.adresseResidence}
          onChange={(v) => onChange({ adresseResidence: v })}
          placeholder="Rue, n°, immeuble..." />
      </div>

      {!isComplete && (
        <div className="rounded-[10px] bg-[#FEF3C7]/40 border border-[#FCD89A] p-4 text-[12px] text-[#B45309]">
          <p className="font-semibold mb-1">Champs obligatoires manquants :</p>
          <ul className="list-disc pl-5 space-y-0.5 font-medium">
            {!data.firstName && <li>Prénom</li>}
            {!data.lastName && <li>Nom</li>}
            {!data.phone && <li>Téléphone</li>}
            {!data.paysResidence && <li>Pays de résidence</li>}
            {!data.villeResidence && <li>Ville</li>}
          </ul>
        </div>
      )}

      <div className="flex gap-4 pt-2">
        <button type="button" onClick={onPrev}
          className="flex-[1] rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">Retour</button>
        <button type="submit" disabled={loading || !isComplete}
          className="flex-[2] rounded-[10px] bg-[#1A7A4A] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0F5C35] transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(26,122,74,0.15)] flex justify-center items-center">
          {loading ? "Création du compte..." : "✅ Continuer"}
        </button>
      </div>
    </form>
  );
}

// ── Succès ──

function SuccessView({ onDashboard }: { onDashboard: () => void }) {
  return (
    <div className="text-center space-y-5 py-8">
      <div className="mx-auto w-16 h-16 rounded-full bg-[#E6F5EE] border border-[#9FD4B4] flex items-center justify-center">
        <svg className="w-8 h-8 text-[#1A7A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-[20px] font-bold text-[#1A1916]">Inscription réussie !</h2>
      <p className="text-[14px] text-[#5A5750]">Un e-mail de confirmation vous a été envoyé. Activez votre compte pour accéder à votre tableau de bord et finaliser votre profil professionnel.</p>
      <button onClick={onDashboard}
        className="rounded-[10px] bg-[#2D5BE3] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm">
        Se connecter
      </button>
    </div>
  );
}

// ── Indicateur d'étapes ──

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1 as const, label: "Compte" },
    { num: 2 as const, label: "Identité" },
  ];
  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1 group">
            <div className="flex flex-col items-center flex-1">
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shadow-sm transition-colors",
                currentStep === step.num ? "bg-[#2D5BE3] text-white"
                  : currentStep > step.num ? "bg-[#1A7A4A] text-white" : "bg-[#FAFAF8] text-[#9C9A95] border border-[#E2E0D9]")}>
                {currentStep > step.num
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  : step.num}
              </div>
              <span className={cn("text-[11px] font-semibold tracking-wide uppercase mt-1.5 text-center transition-colors", currentStep >= step.num ? "text-[#1A1916]" : "text-[#9C9A95]")}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div className={cn("flex-1 h-[2px] mx-2 rounded-full transition-colors", currentStep > step.num ? "bg-[#1A7A4A]" : "bg-[#E2E0D9]")} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Conteneur Principal ──

export function RegisterPrestataireMultiStep() {
  const router = useRouter();
  const [state, setState] = useState<RegistrationState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(REGISTRATION_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          return {
            ...initialState,
            userId: p.userId || null,
            step2: { ...initialState.step2, ...p.step2 },
          };
        }
      } catch {}
    }
    return initialState;
  });
  const [success, setSuccess] = useState(false);

  // Persiste l'état minimal (pas de mot de passe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!state.userId && state.step <= 1) return;
    try {
      sessionStorage.setItem(REGISTRATION_KEY, JSON.stringify({
        userId: state.userId,
        step: state.step,
        step2: {
          firstName: state.step2.firstName, lastName: state.step2.lastName,
          phone: state.step2.phone, paysResidence: state.step2.paysResidence,
          villeResidence: state.step2.villeResidence, quartierResidence: state.step2.quartierResidence,
          adresseResidence: state.step2.adresseResidence,
        },
      }));
    } catch {}
  }, [state.userId, state.step, state.step2.firstName, state.step2.paysResidence]);

  const updateStep1 = (d: Partial<Step1Data>) => setState((s) => ({ ...s, step1: { ...s.step1, ...d }, error: "" }));
  const updateStep2 = (d: Partial<Step2Data>) => setState((s) => ({ ...s, step2: { ...s.step2, ...d }, error: "" }));

  /** Étape 1 → 2 : validation locale uniquement, pas d'appel API */
  const handleStep1Next = () => setState((s) => ({ ...s, step: 2, error: "" }));

  /** Étape 2 → succès : création du compte + enregistrement de l'adresse */
  const handleStep2Next = async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      // 1. Créer le compte
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.step1.email,
          password: state.step1.password,
          confirmPassword: state.step1.confirmPassword,
          firstName: state.step2.firstName,
          lastName: state.step2.lastName,
          phone: state.step2.phone,
          cguAccepted: state.step1.cguAccepted,
          role: "prestataire",
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok || !regData.userId) {
        setState((s) => ({ ...s, loading: false, error: regData.error || regData.message || "Erreur lors de la création du compte" }));
        return;
      }
      const userId: string = regData.userId;

      // 2. Enregistrer l'adresse de résidence
      await fetch("/api/auth/register/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          pays: state.step2.paysResidence,
          ville: state.step2.villeResidence,
          quartier: state.step2.quartierResidence || null,
          adresseDetaillee: state.step2.adresseResidence || null,
        }),
      }).catch(() => {});

      // Compte créé — Phase A terminée. L'email d'activation est envoyé.
      setState((s) => ({ ...s, userId, loading: false }));
      setSuccess(true);
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Erreur de connexion au serveur" }));
    }
  };

  const handleBack = () => setState((s) => ({ ...s, step: 1, error: "" }));

  if (success) return <SuccessView onDashboard={() => router.push("/connexion")} />;

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={state.step} />

      {state.step === 1 && (
        <Step1Form data={state.step1} onChange={updateStep1}
          onNext={handleStep1Next} error={state.error} />
      )}
      {state.step === 2 && (
        <Step2Form data={state.step2} onChange={updateStep2}
          onPrev={handleBack} onNext={handleStep2Next}
          error={state.error} loading={state.loading} />
      )}
    </div>
  );
}
