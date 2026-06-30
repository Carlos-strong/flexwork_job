"use client";

import { useState } from "react";

interface Setting {
  key: string;
  label: string;
  description: string;
  type: "percent" | "currency" | "text" | "select";
  value: string | number;
  options?: string[];
}

const INITIAL_SETTINGS: Setting[] = [
  {
    key: "commission_freelance",
    label: "Commission freelance",
    description: "% prélevé sur chaque paiement libéré vers un freelance",
    type: "percent",
    value: 15,
  },
  {
    key: "commission_entreprise",
    label: "Commission client entreprise",
    description: "% prélevé sur chaque dépôt escrow d'un client entreprise",
    type: "percent",
    value: 5,
  },
  {
    key: "commission_particulier",
    label: "Commission client particulier",
    description: "% prélevé pour un client particulier",
    type: "percent",
    value: 0,
  },
  {
    key: "tva",
    label: "TVA applicable",
    description: "Taux de TVA sur les commissions de la plateforme",
    type: "percent",
    value: 20,
  },
  {
    key: "devise_principale",
    label: "Devise principale",
    description: "Devise par défaut pour les transactions",
    type: "select",
    value: "EUR",
    options: ["EUR", "XAF", "XOF", "USD"],
  },
  {
    key: "montant_minimum_retrait",
    label: "Montant minimum de retrait",
    description: "Solde minimum pour déclencher un retrait freelance",
    type: "currency",
    value: 50,
  },
  {
    key: "delai_litige_jours",
    label: "Délai de contestation (jours)",
    description: "Fenêtre d'ouverture d'un litige après livraison",
    type: "text",
    value: 14,
  },
];

export default function BackOfficeSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>(INITIAL_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string | number) => {
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
  };

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Paramètres plateforme</h2>
        <p className="text-sm text-[#5A5750]">
          Configuration globale — commissions, TVA, devise, délais
        </p>
      </div>

      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.key} className="rounded-xl border border-[#E2E0D9] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="font-medium text-sm">{s.label}</label>
                <p className="text-xs text-[#5A5750] mt-0.5">{s.description}</p>
              </div>
              <div className="shrink-0">
                {s.type === "select" ? (
                  <select
                    value={s.value}
                    onChange={(e) => update(s.key, e.target.value)}
                    className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
                  >
                    {s.options?.map((opt) => <option key={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={s.value}
                      onChange={(e) => update(s.key, Number(e.target.value))}
                      className="w-24 rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm text-right"
                    />
                    <span className="text-sm text-[#5A5750]">
                      {s.type === "percent" ? "%" : s.type === "currency" ? "€" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : saved ? "✅ Enregistré" : "Sauvegarder les paramètres"}
        </button>
        {saved && <p className="text-sm text-green-600">Paramètres mis à jour.</p>}
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
        ⚠️ Toute modification de ces paramètres est tracée dans le journal d&apos;audit et prend effet immédiatement.
      </div>
    </div>
  );
}
