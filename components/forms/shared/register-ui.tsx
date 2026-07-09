"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types partagés ──

export interface Step1Data {
  email: string;
  password: string;
  confirmPassword: string;
  cguAccepted: boolean;
}

// ── Validation partagée ──

export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export function validateStep1(data: Step1Data): Partial<Record<keyof Step1Data, string>> {
  const e: Partial<Record<keyof Step1Data, string>> = {};
  if (!data.email.trim()) e.email = "L'email est requis";
  else if (!EMAIL_REGEX.test(data.email)) e.email = "Email invalide";
  if (!data.password) e.password = "Mot de passe requis";
  else if (data.password.length < 8) e.password = "8 caractères minimum";
  if (data.password !== data.confirmPassword)
    e.confirmPassword = "Les mots de passe ne correspondent pas";
  if (!data.cguAccepted) e.cguAccepted = "Vous devez accepter les CGU pour continuer";
  return e;
}

// ── Composants UI partagés ──

export function Input({
  label, id, type = "text", value, onChange, required,
  placeholder, minLength, error, hint,
}: {
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
        required={required} minLength={minLength} placeholder={placeholder}
        className={cn(
          "w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916]",
          "placeholder:text-[#9C9A95] transition-colors focus:outline-none focus:ring-1",
          error
            ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]"
            : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]"
        )}
      />
      {hint && !error && <p className="mt-1 text-[12px] text-[#5A5750]">{hint}</p>}
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

export function NativeSelect({
  label, id, value, onChange, options, required, error,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1A1916] mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <select
        id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className={cn(
          "w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-[#1A1916]",
          "transition-colors focus:outline-none focus:ring-1",
          error
            ? "border-[#F5BCBC] focus:border-[#C0392B] focus:ring-[#C0392B]"
            : "border-[#E2E0D9] focus:border-[#2D5BE3] focus:ring-[#2D5BE3]"
        )}
      >
        <option value="">Sélectionnez une option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

export function TagInput({
  label, tags, onChange, placeholder,
}: {
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
          <span
            key={t}
            className="flex items-center gap-1.5 rounded-[20px] bg-[#EEF2FD] border border-[#C3D1F8] text-[#2D5BE3] px-2.5 py-0.5 text-[12px] font-medium"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-[#2D5BE3] hover:text-[#C0392B] transition-colors"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
          }}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? placeholder : "Ajouter..."}
          className="flex-1 min-w-[120px] bg-transparent text-[14px] text-[#1A1916] placeholder:text-[#9C9A95] outline-none"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-[#5A5750]">Entrée ou virgule pour ajouter</p>
    </div>
  );
}

export function FileUpload({
  label, accept, file, onChange, error, hint,
}: {
  label: string; accept: string; file: File | null;
  onChange: (f: File | null) => void; error?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#1A1916] mb-2">{label}</label>
      <div
        className={cn(
          "border-2 border-dashed rounded-[10px] p-6 text-center transition-colors hover:bg-[#FAFAF8]",
          error ? "border-[#F5BCBC] bg-[#FDECEA]/30" : "border-[#E2E0D9] bg-white"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="block w-full text-[12px] text-[#5A5750] file:mr-4 file:py-2 file:px-4 file:rounded-[20px] file:border-0 file:text-[12px] file:font-semibold file:bg-[#EEF2FD] file:text-[#2D5BE3] hover:file:bg-[#2D5BE3] hover:file:text-white file:transition-colors cursor-pointer"
        />
        {file && (
          <p className="mt-3 text-[13px] text-[#1A7A4A] font-semibold">
            ✅ Fichier sélectionné : {file.name}
          </p>
        )}
        {hint && !file && <p className="mt-2 text-[12px] text-[#9C9A95]">{hint}</p>}
      </div>
      {error && <p className="mt-1 text-[12px] font-medium text-[#C0392B]">{error}</p>}
    </div>
  );
}

// ── Step1Form partagé (client et freelancer) ──

export function Step1Form({
  data, onChange, onNext, error, title, subtitle,
}: {
  data: Step1Data; onChange: (d: Partial<Step1Data>) => void;
  onNext: () => void; error: string;
  title?: string; subtitle?: string;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Step1Data, string>>>({});

  const validate = () => {
    const e = validateStep1(data);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (validate()) onNext(); }} className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-[20px] font-bold text-[#1A1916] tracking-[-0.01em]">
          {title ?? "Créer votre compte"}
        </h2>
        <p className="text-[14px] text-[#5A5750] mt-1.5">
          {subtitle ?? "Identifiants de connexion"}
        </p>
      </div>
      {error && (
        <div className="rounded-[10px] bg-[#FDECEA] border border-[#F5BCBC] p-3 text-[13px] font-medium text-[#C0392B]">
          {error}
        </div>
      )}
      <Input
        label="Adresse email" id="reg-email" type="email" value={data.email}
        onChange={(v) => { onChange({ email: v }); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
        required placeholder="vous@email.com" error={errors.email}
      />
      <Input
        label="Mot de passe" id="reg-password" type="password" value={data.password}
        onChange={(v) => { onChange({ password: v }); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
        required minLength={8} placeholder="8 caractères minimum" error={errors.password}
      />
      <Input
        label="Confirmer le mot de passe" id="reg-confirm" type="password" value={data.confirmPassword}
        onChange={(v) => { onChange({ confirmPassword: v }); if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined })); }}
        required placeholder="Répétez le mot de passe" error={errors.confirmPassword}
      />
      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-[12px] bg-[#FAFAF8] border border-[#E2E0D9] hover:border-[#C3D1F8] transition-colors">
        <input
          type="checkbox"
          checked={data.cguAccepted}
          onChange={(e) => {
            onChange({ cguAccepted: e.target.checked });
            if (errors.cguAccepted) setErrors((p) => ({ ...p, cguAccepted: undefined }));
          }}
          className="mt-0.5 h-4 w-4 rounded border-[#E2E0D9] text-[#2D5BE3] focus:ring-[#2D5BE3]"
        />
        <span className="text-[12px] leading-relaxed text-[#5A5750]">
          J&apos;accepte les{" "}
          <Link href="/cgu" className="text-[#2D5BE3] font-semibold hover:underline" target="_blank">
            CGU
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="text-[#2D5BE3] font-semibold hover:underline" target="_blank">
            Politique de confidentialité
          </Link>
        </span>
      </label>
      {errors.cguAccepted && (
        <p className="text-[12px] font-medium text-[#C0392B]">{errors.cguAccepted}</p>
      )}
      <button
        type="submit"
        className="w-full rounded-[10px] bg-[#2D5BE3] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors shadow-sm"
      >
        Continuer
      </button>
      <p className="text-center text-[13px] text-[#5A5750]">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-[#2D5BE3] font-semibold hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
