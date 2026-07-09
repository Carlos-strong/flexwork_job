"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ──

type Step = 1 | 2;
type ClientType = "particulier" | "entreprise";

interface Step1Data {
  email: string;
  password: string;
  confirmPassword: string;
  cguAccepted: boolean;
}

interface Step2Data {
  clientType: ClientType;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  secteur: string;
  emailPro: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  pays: string;
  ville: string;
  arrondissement: string;
  quartier: string;
  adresseDetaillee: string;
}

interface RegistrationState {
  userId: string | null;
  step: Step;
  step1: Step1Data;
  step2: Step2Data;
  error: string;
  loading: boolean;
}

const REGISTRATION_KEY = "flexwork_client_registration";

const initialState: RegistrationState = {
  userId: null,
  step: 1,
  step1: { email: "", password: "", confirmPassword: "", cguAccepted: false },
  step2: {
    clientType: "particulier",
    firstName: "", lastName: "", phone: "",
    companyName: "", secteur: "", emailPro: "",
    contactFirstName: "", contactLastName: "", contactPhone: "",
    pays: "CM", ville: "", arrondissement: "", quartier: "", adresseDetaillee: "",
  },
  error: "", loading: false,
};

// ── Helpers ──

function Input({ label, id, type = "text", value, onChange, required, placeholder, minLength, error }: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean; placeholder?: string;
  minLength?: number; error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1A1916] mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <input id={id} type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required} minLength={minLength} placeholder={placeholder}
        className={cn(
          "w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] placeholder:text-[#9C9A95] transition-colors focus:outline-none focus:ring-1",
          error ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]"
        )} />
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

function NativeSelect({ label, id, value, onChange, options, required, error }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1A1916] mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className={cn(
          "w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] transition-colors focus:outline-none focus:ring-1",
          error ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]"
        )}>
        <option value="">Sélectionnez une option</option>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

function TagInput({ label, tags, onChange, placeholder }: {
  label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const addTag = (val: string) => {
    const cleaned = val.trim();
    if (cleaned && !tags.includes(cleaned)) onChange([...tags, cleaned]);
    setInput("");
  };
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#1A1916] mb-1">{label}</label>
      <div className="min-h-[42px] rounded-[10px] border border-[#E2E0D9] bg-white px-2 py-1.5 flex flex-wrap gap-1.5 focus-within:border-[#2D5BE3] focus-within:ring-1 focus-within:ring-[#2D5BE3] transition-colors">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1.5 rounded-[20px] bg-[#EEF2FD] border border-[#C3D1F8] text-[#2D5BE3] px-2.5 py-0.5 text-[12px] font-medium">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-[#2D5BE3] hover:text-[#C0392B] transition-colors">x</button>
          </span>
        ))}
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); } }}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? placeholder : "Ajouter..."}
          className="flex-1 min-w-[120px] bg-transparent text-[14px] text-[#1A1916] placeholder:text-[#9C9A95] outline-none" />
      </div>
      <p className="mt-1.5 text-[11px] text-[#5A5750]">Entree ou virgule pour ajouter</p>
    </div>
  );
}

function FileUpload({ label, accept, file, onChange, error, hint }: {
  label: string; accept: string; file: File | null; onChange: (f: File | null) => void; error?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#1A1916] mb-2">{label}</label>
      <div className={cn(
        "border-2 border-dashed rounded-[10px] p-6 text-center transition-colors hover:bg-[#FAFAF8]",
        error ? "border-[#F5BCBC] bg-[#FDECEA]/30" : "border-[#E2E0D9] bg-white"
      )}>
        <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} className="block w-full text-[12px] text-[#5A5750] file:mr-4 file:py-2 file:px-4 file:rounded-[20px] file:border-0 file:text-[12px] file:font-semibold file:bg-[#EEF2FD] file:text-[#2D5BE3] hover:file:bg-[#2D5BE3] hover:file:text-white file:transition-colors cursor-pointer" />
        {file && <p className="mt-3 text-[13px] text-[#1A7A4A] font-semibold">✅ Fichier sélectionné : {file.name}</p>}
        {hint && !file && <p className="mt-2 text-[12px] text-[#9C9A95]">{hint}</p>}
      </div>
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
    else if (data.password.length < 8) e.password = "8 caracteres minimum";
    if (data.password !== data.confirmPassword) e.confirmPassword = "Les mots de passe ne correspondent pas";
    if (!data.cguAccepted) e.cguAccepted = "Vous devez accepter les CGU pour continuer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (validate()) onNext(); }} className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-[20px] font-bold text-[#1A1916] tracking-[-0.01em]">Créer votre compte client</h2>
        <p className="text-[14px] text-[#5A5750] mt-1.5">Identifiants de connexion</p>
      </div>
      {error && <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}
      <Input label="Adresse email" id="c1-email" type="email" value={data.email}
        onChange={(v) => { onChange({ email: v }); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
        required placeholder="vous@email.com" error={errors.email} />
      <Input label="Mot de passe" id="c1-password" type="password" value={data.password}
        onChange={(v) => { onChange({ password: v }); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
        required minLength={8} placeholder="8 caracteres minimum" error={errors.password} />
      <Input label="Confirmer le mot de passe" id="c1-confirm" type="password" value={data.confirmPassword}
        onChange={(v) => { onChange({ confirmPassword: v }); if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
        required placeholder="Repetez le mot de passe" error={errors.confirmPassword} />

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

// ── Étape 2 : Identite ──

function Step2Form({ data, onChange, onPrev, onNext, error, loading }: {
  data: Step2Data; onChange: (d: Partial<Step2Data>) => void;
  onPrev: () => void; onNext: () => void; error: string; loading: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paysList, setPaysList] = useState<{ code: string; nom: string }[]>([]);
  const [villesList, setVillesList] = useState<{ nom: string; region: string }[]>([]);
  const [quartiersList, setQuartiersList] = useState<{ nom: string; populaire?: boolean }[]>([]);

  useEffect(() => { fetch("/api/localisation?type=pays").then((r) => r.json()).then((d) => setPaysList(d.data || [])); }, []);
  useEffect(() => {
    if (!data.pays) { setVillesList([]); return; }
    fetch("/api/localisation?type=villes&pays=" + data.pays).then((r) => r.json()).then((d) => setVillesList(d.data || []));
  }, [data.pays]);
  useEffect(() => {
    if (!data.ville) { setQuartiersList([]); return; }
    fetch("/api/localisation?type=quartiers&ville=" + encodeURIComponent(data.ville)).then((r) => r.json()).then((d) => setQuartiersList(d.data || []));
  }, [data.ville]);

  const isParticulier = data.clientType === "particulier";
  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.pays) e.pays = "Pays requis";
    if (!data.ville.trim()) e.ville = "Ville requise";
    if (!data.adresseDetaillee.trim()) e.adresseDetaillee = "Adresse requise";
    if (isParticulier) {
      if (!data.firstName.trim()) e.firstName = "Prenom requis";
      if (!data.lastName.trim()) e.lastName = "Nom requis";
      if (!data.phone.trim()) e.phone = "Telephone requis";
    } else {
      if (!data.companyName.trim()) e.companyName = "Nom entreprise requis";
      if (!data.contactFirstName.trim()) e.contactFirstName = "Prenom contact requis";
      if (!data.contactLastName.trim()) e.contactLastName = "Nom contact requis";
      if (!data.contactPhone.trim()) e.contactPhone = "Telephone requis";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (validate()) onNext(); }} className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-[20px] font-bold text-[#1A1916] tracking-[-0.01em]">Vos informations</h2>
        <p className="text-[14px] text-[#5A5750] mt-1.5">Profil et adresse</p>
      </div>
      {error && <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">{error}</div>}
      <div>
        <p className="text-[13px] font-semibold text-[#1A1916] mb-2">Type de compte <span className="text-[#C0392B]">*</span></p>
        <div className="grid grid-cols-2 gap-3">
          {(["particulier", "entreprise"] as ClientType[]).map((type) => (
            <button key={type} type="button" onClick={() => onChange({ clientType: type })}
              className={cn("rounded-[10px] border-2 p-3 text-[13px] font-semibold transition-all text-left", data.clientType === type ? "border-[#2D5BE3] bg-[#EEF2FD] text-[#2D5BE3]" : "border-[#E2E0D9] bg-white text-[#1A1916] hover:border-[#C3D1F8]")}>
              {type === "particulier" ? "Particulier" : "Entreprise"}
            </button>
          ))}
        </div>
      </div>
      {isParticulier && (
        <div className="rounded-[12px] border border-[#E2E0D9] bg-[#FAFAF8] p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-[#5A5750] uppercase tracking-wider">Informations personnelles</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prenom" id="c2-fn" value={data.firstName}
              onChange={(v) => { onChange({ firstName: v }); if (errors.firstName) setErrors((p) => ({ ...p, firstName: "" })); }}
              required placeholder="Jean" error={errors.firstName} />
            <Input label="Nom" id="c2-ln" value={data.lastName}
              onChange={(v) => { onChange({ lastName: v }); if (errors.lastName) setErrors((p) => ({ ...p, lastName: "" })); }}
              required placeholder="Dupont" error={errors.lastName} />
          </div>
          <Input label="Telephone" id="c2-phone" type="tel" value={data.phone}
            onChange={(v) => { onChange({ phone: v }); if (errors.phone) setErrors((p) => ({ ...p, phone: "" })); }}
            required placeholder="+237 6 XX XX XX XX" error={errors.phone} />
        </div>
      )}
      {!isParticulier && (
        <div className="rounded-[12px] border border-[#E2E0D9] bg-[#FAFAF8] p-5 space-y-4 shadow-sm">
          <h3 className="text-[11px] font-bold text-[#5A5750] uppercase tracking-wider">Informations entreprise</h3>
          <Input label="Raison sociale" id="c2-company" value={data.companyName}
            onChange={(v) => { onChange({ companyName: v }); if (errors.companyName) setErrors((p) => ({ ...p, companyName: "" })); }}
            required placeholder="SARL, SA..." error={errors.companyName} />
          <Input label="Secteur d'activite" id="c2-secteur" value={data.secteur}
            onChange={(v) => onChange({ secteur: v })} placeholder="BTP, Services, Commerce..." />
          <Input label="Email professionnel" id="c2-emailpro" type="email" value={data.emailPro}
            onChange={(v) => { onChange({ emailPro: v }); if (errors.emailPro) setErrors((p) => ({ ...p, emailPro: "" })); }}
            placeholder="contact@entreprise.com" error={errors.emailPro} />
          <div className="border-t border-[#E2E0D9] pt-4 mt-2">
            <p className="text-[11px] font-bold text-[#5A5750] uppercase tracking-wider mb-4">Personne de contact</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Prenom" id="c2-cfn" value={data.contactFirstName}
                onChange={(v) => { onChange({ contactFirstName: v }); if (errors.contactFirstName) setErrors((p) => ({ ...p, contactFirstName: "" })); }}
                required placeholder="Jean" error={errors.contactFirstName} />
              <Input label="Nom" id="c2-cln" value={data.contactLastName}
                onChange={(v) => { onChange({ contactLastName: v }); if (errors.contactLastName) setErrors((p) => ({ ...p, contactLastName: "" })); }}
                required placeholder="Dupont" error={errors.contactLastName} />
            </div>
            <div className="mt-4">
              <Input label="Telephone contact" id="c2-cphone" type="tel" value={data.contactPhone}
                onChange={(v) => { onChange({ contactPhone: v }); if (errors.contactPhone) setErrors((p) => ({ ...p, contactPhone: "" })); }}
                required placeholder="+237 6 XX XX XX XX" error={errors.contactPhone} />
            </div>
          </div>
        </div>
      )}
      <div className="rounded-[12px] border border-[#E2E0D9] bg-[#FAFAF8] p-5 space-y-4 shadow-sm">
        <h3 className="text-[11px] font-bold text-[#5A5750] uppercase tracking-wider">Adresse</h3>
        <div>
          <label htmlFor="c2-pays" className="block text-[13px] font-semibold text-[#1A1916] mb-1">Pays <span className="text-[#C0392B]">*</span></label>
          <select id="c2-pays" value={data.pays}
            onChange={(e) => { onChange({ pays: e.target.value, ville: "", arrondissement: "", quartier: "" }); if (errors.pays) setErrors((p) => ({ ...p, pays: "" })); }}
            className={cn("w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:ring-1", errors.pays ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]" : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]")}>
            <option value="">Selectionnez un pays</option>
            {paysList.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
          </select>
          {errors.pays && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{errors.pays}</p>}
        </div>
        <div>
          <label htmlFor="c2-ville" className="block text-[13px] font-semibold text-[#1A1916] mb-1">Ville</label>
          {villesList.length > 0 ? (
            <select id="c2-ville" value={data.ville}
              onChange={(e) => onChange({ ville: e.target.value, arrondissement: "", quartier: "" })}
              className="w-full rounded-[10px] border border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none">
              <option value="">Selectionnez une ville</option>
              {villesList.map((v) => <option key={v.nom} value={v.nom}>{v.nom} ({v.region})</option>)}
            </select>
          ) : (
            <input type="text" value={data.ville}
              onChange={(e) => onChange({ ville: e.target.value })} disabled={!data.pays}
              placeholder="Saisir la ville"
              className="w-full rounded-[10px] border border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] bg-white px-3 py-2 text-[14px] text-[#1A1916] disabled:opacity-50 placeholder:text-[#9C9A95] focus:outline-none" />
          )}
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#1A1916] mb-1">Quartier</label>
          {quartiersList.length > 0 ? (
            <select value={data.quartier} onChange={(e) => onChange({ quartier: e.target.value })}
              className="w-full rounded-[10px] border border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none">
              <option value="">Selectionnez un quartier</option>
              {quartiersList.map((q) => <option key={q.nom} value={q.nom}>{q.nom}</option>)}
            </select>
          ) : (
            <input type="text" value={data.quartier}
              onChange={(e) => onChange({ quartier: e.target.value })} disabled={!data.ville}
              placeholder="Saisir le quartier"
              className="w-full rounded-[10px] border border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] bg-white px-3 py-2 text-[14px] text-[#1A1916] disabled:opacity-50 placeholder:text-[#9C9A95] focus:outline-none" />
          )}
        </div>
        <Input label="Adresse detaillee" id="c2-adresse" value={data.adresseDetaillee}
          onChange={(v) => { onChange({ adresseDetaillee: v }); if (errors.adresseDetaillee) setErrors((p) => ({ ...p, adresseDetaillee: "" })); }}
          required placeholder="Rue, n, immeuble..." error={errors.adresseDetaillee} />
      </div>
      <div className="flex gap-4 pt-2">
        <button type="button" onClick={onPrev}
          className="flex-[1] rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">Retour</button>
        <button type="submit" disabled={loading}
          className="flex-[2] rounded-[10px] bg-[#1A7A4A] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0F5C35] transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(26,122,74,0.15)] flex justify-center items-center">
          {loading ? "Création en cours..." : "✅ Terminer l'inscription"}
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
      <h2 className="text-[20px] font-bold text-[#1A1916]">Compte créé avec succès !</h2>
      <p className="text-[14px] text-[#5A5750]">Un e-mail de confirmation vous a été envoyé. Vous pouvez maintenant vous connecter.</p>
      <button onClick={onDashboard}
        className="rounded-[10px] bg-[#2D5BE3] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm">
        Se connecter
      </button>
    </div>
  );
}

// ── Indicateur d'etapes ──

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

// ── Conteneur principal ──

export function RegisterMultiStep() {
  const router = useRouter();
  const [state, setState] = useState<RegistrationState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(REGISTRATION_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          return {
            ...initialState,
            step2: { ...initialState.step2, ...p.step2 },
          };
        }
      } catch {}
    }
    return initialState;
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(REGISTRATION_KEY, JSON.stringify({
        step2: {
          clientType: state.step2.clientType,
          firstName: state.step2.firstName, lastName: state.step2.lastName, phone: state.step2.phone,
          companyName: state.step2.companyName, contactFirstName: state.step2.contactFirstName,
          contactLastName: state.step2.contactLastName, contactPhone: state.step2.contactPhone,
          pays: state.step2.pays, ville: state.step2.ville, quartier: state.step2.quartier,
          adresseDetaillee: state.step2.adresseDetaillee,
        },
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step2.clientType, state.step2.pays]);

  const updateStep1 = (d: Partial<Step1Data>) => setState((s) => ({ ...s, step1: { ...s.step1, ...d }, error: "" }));
  const updateStep2 = (d: Partial<Step2Data>) => setState((s) => ({ ...s, step2: { ...s.step2, ...d }, error: "" }));

  const handleStep1Next = () => setState((s) => ({ ...s, step: 2, error: "" }));

  const handleStep2Next = async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const isParticulier = state.step2.clientType === "particulier";
      const regBody = (isParticulier
        ? { email: state.step1.email, password: state.step1.password, confirmPassword: state.step1.confirmPassword,
            firstName: state.step2.firstName, lastName: state.step2.lastName, phone: state.step2.phone }
        : { email: state.step1.email, password: state.step1.password, confirmPassword: state.step1.confirmPassword,
            firstName: state.step2.contactFirstName, lastName: state.step2.contactLastName,
            phone: state.step2.contactPhone, companyName: state.step2.companyName,
            secteur: state.step2.secteur, emailPro: state.step2.emailPro, clientType: "ENTREPRISE" }) as Record<string, unknown>;
      regBody.cguAccepted = state.step1.cguAccepted;
      regBody.role = "client";
      const regRes = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(regBody),
      });
      const regData = await regRes.json();
      if (!regRes.ok || !regData.userId) { setState((s) => ({ ...s, loading: false, error: regData.error || regData.message || "Erreur creation compte" })); return; }
      const userId: string = regData.userId;
      await fetch("/api/auth/register/address", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pays: state.step2.pays, ville: state.step2.ville, arrondissement: state.step2.arrondissement, quartier: state.step2.quartier, adresseDetaillee: state.step2.adresseDetaillee }),
      }).catch(() => {});
      if (typeof window !== "undefined") sessionStorage.removeItem(REGISTRATION_KEY);
      setSuccess(true);
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Erreur de connexion au serveur" }));
    }
  };

  const handleBack = () => setState((s) => ({ ...s, step: Math.max(1, s.step - 1) as Step, error: "" }));

  if (success) return <SuccessView onDashboard={() => router.push("/connexion")} />;

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={state.step} />
      {state.step === 1 && (
        <Step1Form data={state.step1} onChange={updateStep1} onNext={handleStep1Next} error={state.error} />
      )}
      {state.step === 2 && (
        <Step2Form data={state.step2} onChange={updateStep2}
          onPrev={handleBack} onNext={handleStep2Next} error={state.error} loading={state.loading} />
      )}
    </div>
  );
}
