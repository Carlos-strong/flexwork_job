"use client";

import { useState, useEffect } from "react";

interface Categorie {
  id: string;
  libelle: string;
  description?: string;
  icon?: string;
  _count?: { metiers?: number };
  metiers?: Metier[];
}

interface Metier {
  id: string;
  categorieId: string;
  libelle: string;
  _count?: { services?: number };
}

interface ServiceItem {
  id: string;
  metierId: string;
  libelle: string;
  description?: string;
  dureeEstimee?: number;
}

export default function BackOfficeCatalogPage() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [selected, setSelected] = useState<Categorie | null>(null);
  const [selectedMetier, setSelectedMetier] = useState<Metier | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);

  // Formulaires d'ajout
  const [newCat, setNewCat] = useState({ libelle: "", description: "", icon: "" });
  const [newMetier, setNewMetier] = useState({ libelle: "" });
  const [newService, setNewService] = useState({ libelle: "", description: "", dureeEstimee: "" });
  const [adding, setAdding] = useState(false);
  const [addingMetier, setAddingMetier] = useState(false);
  const [addingService, setAddingService] = useState(false);

  // Édition inline
  const [editCat, setEditCat] = useState<{ id: string; libelle: string } | null>(null);
  const [editMetier, setEditMetier] = useState<{ id: string; libelle: string } | null>(null);
  const [editService, setEditService] = useState<{ id: string; libelle: string; dureeEstimee: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setCategories(list);
      if (list.length > 0 && !selected) {
        setSelected(list[0]);
        setSelectedMetier(null);
        setServices([]);
      }
    } catch { setCategories([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadServicesForMetier = async (metierId: string) => {
    setLoadingServices(true);
    try {
      const res = await fetch(`/api/services?metierId=${metierId}`);
      const data = await res.json();
      setServices(data.data ?? []);
    } catch { setServices([]); }
    finally { setLoadingServices(false); }
  };

  const handleSelectCategory = (cat: Categorie) => {
    setSelected(cat);
    setSelectedMetier(null);
    setServices([]);
  };

  const handleSelectMetier = (m: Metier) => {
    setSelectedMetier(m);
    loadServicesForMetier(m.id);
  };

  const addCategory = async () => {
    if (!newCat.libelle.trim()) return;
    setAdding(true);
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCat),
      });
      setNewCat({ libelle: "", description: "", icon: "" });
      await load();
    } finally { setAdding(false); }
  };

  const addMetier = async () => {
    if (!newMetier.libelle.trim() || !selected) return;
    setAddingMetier(true);
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorieId: selected.id, metierLibelle: newMetier.libelle }),
      });
      setNewMetier({ libelle: "" });
      await load();
    } finally { setAddingMetier(false); }
  };

  const addService = async () => {
    if (!newService.libelle.trim() || !selectedMetier) return;
    setAddingService(true);
    try {
      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metierId: selectedMetier.id,
          libelle: newService.libelle,
          description: newService.description || undefined,
          dureeEstimee: newService.dureeEstimee ? Number(newService.dureeEstimee) : undefined,
        }),
      });
      setNewService({ libelle: "", description: "", dureeEstimee: "" });
      await loadServicesForMetier(selectedMetier.id);
      await load(); // refresh counts
    } finally { setAddingService(false); }
  };

  // ── Édition ──

  const saveCategory = async () => {
    if (!editCat || !editCat.libelle.trim()) return;
    setSaving(true);
    await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editCat.id, libelle: editCat.libelle, type: "category" }) });
    setEditCat(null);
    setSaving(false);
    await load();
  };

  const saveMetier = async () => {
    if (!editMetier || !editMetier.libelle.trim()) return;
    setSaving(true);
    await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editMetier.id, libelle: editMetier.libelle, type: "metier" }) });
    setEditMetier(null);
    setSaving(false);
    await load();
  };

  const saveService = async () => {
    if (!editService || !editService.libelle.trim()) return;
    setSaving(true);
    await fetch("/api/services", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editService.id, libelle: editService.libelle, dureeEstimee: editService.dureeEstimee }) });
    setEditService(null);
    setSaving(false);
    await loadServicesForMetier(selectedMetier!.id);
    await load();
  };

  // ── Suppression ──

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    const { id, type } = confirmDelete;
    const url = type === "service" ? "/api/services" : "/api/categories";
    await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: type === "category" ? "category" : type === "metier" ? "metier" : "service" }) });
    setConfirmDelete(null);
    setSaving(false);
    if (type === "category") { setSelectedMetier(null); setServices([]); }
    if (type === "metier") { setSelectedMetier(null); setServices([]); }
    if (type === "service" && selectedMetier) await loadServicesForMetier(selectedMetier.id);
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Taxonomie</h2>
        <p className="text-[14px] text-[#5A5750]">
          Hiérarchie : Catégorie → Métier → Service
        </p>
      </div>

      {/* Arborescence visuelle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne 1 — Catégories */}
        <div className="rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[#E2E0D9] bg-[#FAFAF8] flex items-center justify-between">
            <h3 className="font-semibold text-[14px] text-[#1A1916]">Catégories</h3>
            <span className="text-[12px] text-[#5A5750]">{categories.length}</span>
          </div>
          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-10 rounded-[10px] bg-[#F5F5F0]" />)}
              </div>
            ) : categories.map((cat) => (
              <div key={cat.id} className="flex items-center border-b border-[#E2E0D9] last:border-b-0 group">
                <button
                  onClick={() => handleSelectCategory(cat)}
                  className={`flex-1 text-left px-4 py-3 text-[14px] transition-colors hover:bg-[#EEF2FD] ${selected?.id === cat.id ? "bg-[#EEF2FD] font-medium text-[#1A1916]" : "text-[#1A1916]"}`}
                >
                  {editCat?.id === cat.id ? (
                    <span className="inline-flex gap-1">
                      <input value={editCat.libelle} onChange={(e) => setEditCat((p) => p ? { ...p, libelle: e.target.value } : null)} className="flex-1 rounded border px-1 text-xs" autoFocus onKeyDown={(e) => e.key === "Enter" && saveCategory()} />
                      <button onClick={saveCategory} disabled={saving} className="text-xs text-[#1A7A4A] hover:underline">✓</button>
                      <button onClick={() => setEditCat(null)} className="text-xs text-[#5A5750] hover:underline">✕</button>
                    </span>
                  ) : (
                    <>{cat.libelle}</>
                  )}
                  <span className="ml-2 text-[12px] text-[#5A5750]">({cat._count?.metiers ?? cat.metiers?.length ?? 0})</span>
                </button>
                {!editCat && (
                  <span className="flex pr-2 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditCat({ id: cat.id, libelle: cat.libelle })} className="p-1 text-xs text-[#5A5750] hover:text-[#1A1916]" title="Modifier">✏️</button>
                    <button onClick={() => setConfirmDelete({ id: cat.id, type: "category", label: cat.libelle })} className="p-1 text-xs text-[#5A5750] hover:text-[#C0392B]" title="Supprimer">🗑️</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Ajout catégorie */}
          <div className="p-3 border-t border-[#E2E0D9] space-y-2">
            <input
              value={newCat.libelle}
              onChange={(e) => setNewCat((p) => ({ ...p, libelle: e.target.value }))}
              placeholder="Nom de la catégorie…"
              className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[12px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <div className="flex gap-2">
              <button
                onClick={addCategory}
                disabled={adding || !newCat.libelle.trim()}
                className="flex-1 rounded-[10px] bg-[#2D5BE3] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1F4DD4] disabled:opacity-50 transition-colors"
              >
                {adding ? "…" : "+ Ajouter"}
              </button>
            </div>
          </div>
        </div>

        {/* Colonne 2 — Métiers */}
        <div className="rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[#E2E0D9] bg-[#FAFAF8]">
            <h3 className="font-semibold text-[14px] text-[#1A1916]">
              Métiers
              {selected && <span className="ml-1 text-[#5A5750] font-normal">— {selected.libelle}</span>}
            </h3>
          </div>
          <div className="overflow-y-auto max-h-80">
            {!selected ? (
              <p className="p-4 text-[14px] text-[#5A5750]">Sélectionnez une catégorie</p>
            ) : (selected.metiers ?? []).length === 0 ? (
              <p className="p-4 text-[14px] text-[#5A5750]">Aucun métier</p>
            ) : (selected.metiers ?? []).map((m) => (
              <div key={m.id} className="flex items-center border-b border-[#E2E0D9] last:border-b-0 group">
                <button
                  onClick={() => handleSelectMetier(m)}
                  className={`flex-1 text-left px-4 py-3 text-[14px] transition-colors hover:bg-[#EEF2FD] ${selectedMetier?.id === m.id ? "bg-[#EEF2FD] font-medium text-[#1A1916]" : "text-[#1A1916]"}`}
                >
                  {editMetier?.id === m.id ? (
                    <span className="inline-flex gap-1">
                      <input value={editMetier.libelle} onChange={(e) => setEditMetier((p) => p ? { ...p, libelle: e.target.value } : null)} className="flex-1 rounded border px-1 text-xs" autoFocus onKeyDown={(e) => e.key === "Enter" && saveMetier()} />
                      <button onClick={saveMetier} disabled={saving} className="text-xs text-[#1A7A4A] hover:underline">✓</button>
                      <button onClick={() => setEditMetier(null)} className="text-xs text-[#5A5750] hover:underline">✕</button>
                    </span>
                  ) : <>{m.libelle}</>}
                </button>
                {!editMetier && (
                  <span className="flex pr-2 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditMetier({ id: m.id, libelle: m.libelle })} className="p-1 text-xs text-[#5A5750] hover:text-[#1A1916]" title="Modifier">✏️</button>
                    <button onClick={() => setConfirmDelete({ id: m.id, type: "metier", label: m.libelle })} className="p-1 text-xs text-[#5A5750] hover:text-[#C0392B]" title="Supprimer">🗑️</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {selected && (
            <div className="p-3 border-t border-[#E2E0D9]">
              <div className="flex gap-2">
                <input
                  value={newMetier.libelle}
                  onChange={(e) => setNewMetier({ libelle: e.target.value })}
                  placeholder="Nom du métier…"
                  className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[12px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]"
                  onKeyDown={(e) => e.key === "Enter" && addMetier()}
                />
                <button
                  onClick={addMetier}
                  disabled={addingMetier || !newMetier.libelle.trim()}
                  className="rounded-[10px] bg-[#2D5BE3] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1F4DD4] disabled:opacity-50 transition-colors"
                >
                  {addingMetier ? "…" : "+"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Colonne 3 — Services */}
        <div className="rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-[#E2E0D9] bg-[#FAFAF8] flex items-center justify-between">
            <h3 className="font-semibold text-[14px] text-[#1A1916]">
              Services
              {selectedMetier && <span className="ml-1 text-[#5A5750] font-normal">— {selectedMetier.libelle}</span>}
            </h3>
            <span className="text-[12px] text-[#5A5750]">{services.length}</span>
          </div>
          <div className="overflow-y-auto max-h-60">
            {!selectedMetier ? (
              <p className="p-4 text-[14px] text-[#5A5750]">Sélectionnez un métier pour voir ses services.</p>
            ) : loadingServices ? (
              <div className="p-3 space-y-2">
                {[1, 2].map((i) => <div key={i} className="animate-pulse h-8 rounded-[10px] bg-[#F5F5F0]" />)}
              </div>
            ) : services.length === 0 ? (
              <p className="p-4 text-[14px] text-[#5A5750]">Aucun service</p>
            ) : services.map((s) => (
              <div key={s.id} className="px-4 py-2.5 text-[14px] border-b border-[#E2E0D9] last:border-b-0 flex items-center justify-between group">
                {editService?.id === s.id ? (
                  <span className="flex-1 flex gap-1 items-center">
                    <input value={editService.libelle} onChange={(e) => setEditService((p) => p ? { ...p, libelle: e.target.value } : null)} className="flex-1 rounded border px-1 text-xs" autoFocus onKeyDown={(e) => e.key === "Enter" && saveService()} />
                    <input value={editService.dureeEstimee} onChange={(e) => setEditService((p) => p ? { ...p, dureeEstimee: e.target.value } : null)} type="number" className="w-14 rounded border px-1 text-xs text-center" placeholder="min" />
                    <button onClick={saveService} disabled={saving} className="text-xs text-[#1A7A4A] hover:underline">✓</button>
                    <button onClick={() => setEditService(null)} className="text-xs text-[#5A5750] hover:underline">✕</button>
                  </span>
                ) : (
                  <>
                    <span className="text-[#1A1916]">• {s.libelle}</span>
                    <span className="flex items-center gap-2">
                      {s.dureeEstimee && <span className="text-[12px] text-[#5A5750]">{s.dureeEstimee} min</span>}
                      <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditService({ id: s.id, libelle: s.libelle, dureeEstimee: s.dureeEstimee?.toString() || "" })} className="p-0.5 text-xs text-[#5A5750] hover:text-[#1A1916]" title="Modifier">✏️</button>
                        <button onClick={() => setConfirmDelete({ id: s.id, type: "service", label: s.libelle })} className="p-0.5 text-xs text-[#5A5750] hover:text-[#C0392B]" title="Supprimer">🗑️</button>
                      </span>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          {selectedMetier && (
            <div className="p-3 border-t border-[#E2E0D9] space-y-2">
              <input
                value={newService.libelle}
                onChange={(e) => setNewService((p) => ({ ...p, libelle: e.target.value }))}
                placeholder="Nom du service…"
                className="w-full rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[12px] text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none placeholder:text-[#9C9A95]"
                onKeyDown={(e) => e.key === "Enter" && addService()}
              />
              <div className="flex gap-2">
                <input
                  value={newService.dureeEstimee}
                  onChange={(e) => setNewService((p) => ({ ...p, dureeEstimee: e.target.value }))}
                  placeholder="Durée (min)"
                  type="number"
                  className="w-20 rounded-[10px] border border-[#E2E0D9] bg-white px-2 py-2 text-[12px] text-center text-[#1A1916] focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3] outline-none"
                />
                <button
                  onClick={addService}
                  disabled={addingService || !newService.libelle.trim()}
                  className="flex-1 rounded-[10px] bg-[#2D5BE3] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1F4DD4] disabled:opacity-50 transition-colors"
                >
                  {addingService ? "…" : "+ Ajouter"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation de suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/40 backdrop-blur-sm">
          <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 max-w-sm w-full shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
            <h3 className="font-semibold text-[#1A1916] mb-2">Confirmer la suppression</h3>
            <p className="text-[14px] text-[#5A5750] mb-4">
              Supprimer <strong>{confirmDelete.label}</strong> {confirmDelete.type === "category" ? "et tous ses métiers/services" : confirmDelete.type === "metier" ? "et ses services" : ""} ?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} disabled={saving} className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">Annuler</button>
              <button onClick={executeDelete} disabled={saving} className="rounded-[10px] bg-[#C0392B] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A93226] disabled:opacity-50 transition-colors">
                {saving ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exemple d'arborescence */}
      <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-[14px] text-[#1A1916]">Exemple de hiérarchie</h3>
        <div className="font-mono text-[12px] text-[#5A5750] space-y-0.5">
          <p>🏗️ BTP</p>
          <p className="ml-4">└─ 🔧 Plombier</p>
          <p className="ml-8">├─ Débouchage</p>
          <p className="ml-8">├─ Réparation fuite</p>
          <p className="ml-8">└─ Installation sanitaire</p>
          <p className="ml-4">└─ 🔌 Électricien</p>
          <p className="ml-8">├─ Mise aux normes</p>
          <p className="ml-8">└─ Installation tableau</p>
        </div>
      </div>
    </div>
  );
}
