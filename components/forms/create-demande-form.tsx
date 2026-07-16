"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAutoSave } from "@/hooks/use-auto-save";

interface DemandeFormData {
  categorieId: string;
  serviceId: string;
  description: string;
  photos: File[];
  adresseId: string;
  dateSouhaitee: string;
  heureSouhaitee: string;
  budgetPropose: number;
}

interface Categorie {
  id: string;
  libelle: string;
  icon?: string;
}

interface Service {
  id: string;
  metierId: string;
  libelle: string;
}

interface Adresse {
  id: string;
  intitule?: string;
  ville: string;
  quartier: string;
  adresseDetaillee: string;
}

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Input({
  label,
  id,
  type = "text",
  value,
  onChange,
  required,
  placeholder,
  error,
}: {
  label: string;
  id: string;
  type?: string;
  value: string | number;
  onChange: (v: string | number) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) =>
          onChange(type === "number" ? parseInt(e.target.value, 10) || 0 : e.target.value)
        }
        required={required}
        className={classNames(
          "w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors",
          error ? "border-destructive" : "border-[#E2E0D9]"
        )}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-[#C0392B]">{error}</p>}
    </div>
  );
}

function Select({
  label,
  id,
  value,
  onChange,
  options,
  required,
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-[#C0392B]">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={classNames(
          "w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors",
          error ? "border-destructive" : "border-[#E2E0D9]"
        )}
      >
        <option value="">Sélectionnez une option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-[#C0392B]">{error}</p>}
    </div>
  );
}

export function CreateDemandForm() {
  const router = useRouter();
  const [data, setData] = useState<DemandeFormData>({
    categorieId: "",
    serviceId: "",
    description: "",
    photos: [],
    adresseId: "",
    dateSouhaitee: "",
    heureSouhaitee: "",
    budgetPropose: 0,
  });

  const [categories, setCategories] = useState<Categorie[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [adresses, setAdresses] = useState<Adresse[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-save du brouillon toutes les 5s (plan5.md §4)
  const { restored, clearDraft, hasSavedDraft } = useAutoSave("demande-create", data as unknown as Record<string, unknown>);
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (restored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setData((prev) => ({ ...prev, ...restored }));
    }
  }, [restored]);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, adrRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/users/adresses"),
        ]);

        if (catRes.ok) {
          const cats = await catRes.json();
          setCategories(cats.data || cats);
        }

        if (adrRes.ok) {
          const addrs = await adrRes.json();
          setAdresses(addrs.data || addrs);
        }
      } catch (e) {
        console.error("Erreur lors du chargement", e);
      }
    };

    loadData();
  }, []);

  // Charger les services quand la catégorie change
  useEffect(() => {
    if (!data.categorieId) {
      setServices([]);
      return;
    }

    const loadServices = async () => {
      try {
        const res = await fetch(`/api/services?categorieId=${data.categorieId}`);
        if (res.ok) {
          const svcs = await res.json();
          setServices(svcs.data || svcs);
        }
      } catch (e) {
        console.error("Erreur lors du chargement des services", e);
      }
    };

    loadServices();
  }, [data.categorieId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.categorieId) newErrors.categorieId = "Catégorie requise";
    if (!data.serviceId) newErrors.serviceId = "Service requis";
    if (!data.description.trim()) newErrors.description = "Description requise";
    if (!data.adresseId) newErrors.adresseId = "Adresse requise";
    if (!data.dateSouhaitee) newErrors.dateSouhaitee = "Date requise";
    if (!data.heureSouhaitee) newErrors.heureSouhaitee = "Heure requise";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos].slice(0, 5), // Max 5 photos
      }));
    }
  };

  const removePhoto = (index: number) => {
    setData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("categorieId", data.categorieId);
      formData.append("serviceId", data.serviceId);
      formData.append("description", data.description);
      formData.append("adresseId", data.adresseId);
      formData.append("dateSouhaitee", data.dateSouhaitee);
      formData.append("heureSouhaitee", data.heureSouhaitee);
      formData.append("budgetPropose", data.budgetPropose.toString());

      data.photos.forEach((photo, idx) => {
        formData.append(`photos`, photo);
      });

      const res = await fetch("/api/demandes", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      // Redirection vers le détail de la demande
      clearDraft();
      router.push(`/demandes/${result.id}`);
    } catch (e) {
      setError("Erreur de connexion au serveur");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bannière de brouillon restauré */}
      {hasSavedDraft && (
        <div className="rounded-[10px] border border-[#FCD89A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E] flex items-center gap-2">
          <span>📝</span>
          <span><strong>Brouillon restauré</strong> — vos modifications non sauvegardées ont été récupérées.</span>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">Créer une demande de service</h1>
        <p className="text-[#5A5750] mt-1">
          Décrivez le service dont vous avez besoin
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      {/* Catégorie et Service */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Catégorie de service"
          id="categorie"
          value={data.categorieId}
          onChange={(v) => setData({ ...data, categorieId: v, serviceId: "" })}
          options={categories.map((c) => ({ value: c.id, label: c.libelle }))}
          required
          error={errors.categorieId}
        />

        <Select
          label="Type de service"
          id="service"
          value={data.serviceId}
          onChange={(v) => setData({ ...data, serviceId: v })}
          options={services.map((s) => ({ value: s.id, label: s.libelle }))}
          required
          error={errors.serviceId}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description du problème <span className="text-[#C0392B]">*</span>
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          required
          placeholder="Décrivez votre problème en détail (ex: Fuite importante sous l'évier de la cuisine)"
          className={classNames(
            "w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors",
            errors.description ? "border-destructive" : "border-[#E2E0D9]"
          )}
          rows={4}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-[#C0392B]">{errors.description}</p>
        )}
      </div>

      {/* Photos */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Photos (optionnel - max 5)
        </label>
        <div className="border-2 border-dashed border-[#E2E0D9] rounded-md p-6 text-center">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-sm"
          />
          <p className="text-xs text-[#5A5750] mt-2">
            Drag & drop ou cliquez pour sélectionner les images
          </p>
        </div>

        {data.photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            {data.photos.map((photo, idx) => (
              <div
                key={idx}
                className="relative group rounded-md overflow-hidden bg-[#F5F5F0]"
              >
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-24 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adresse */}
      <Select
        label="Adresse d'intervention"
        id="adresse"
        value={data.adresseId}
        onChange={(v) => setData({ ...data, adresseId: v })}
        options={adresses.map((a) => ({
          value: a.id,
          label: `${a.intitule || "Adresse"} - ${a.ville}, ${a.quartier}`,
        }))}
        required
        error={errors.adresseId}
      />

      {/* Date et Heure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date souhaitée"
          id="date"
          type="date"
          value={data.dateSouhaitee}
          onChange={(v) => setData({ ...data, dateSouhaitee: String(v) })}
          required
          error={errors.dateSouhaitee}
        />

        <Input
          label="Heure souhaitée"
          id="heure"
          type="time"
          value={data.heureSouhaitee}
          onChange={(v) => setData({ ...data, heureSouhaitee: String(v) })}
          required
          error={errors.heureSouhaitee}
        />
      </div>

      {/* Budget */}
      <Input
        label="Budget proposé (FCFA - optionnel)"
        id="budget"
        type="number"
        value={data.budgetPropose}
        onChange={(v) => setData({ ...data, budgetPropose: Number(v) || 0 })}
        placeholder="5000"
      />

      {/* Boutons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-[#E2E0D9] px-4 py-2.5 text-sm font-medium hover:bg-[#EEF2FD] transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-[2] rounded-md bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer la demande"}
        </button>
      </div>
    </form>
  );
}
