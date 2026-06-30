"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminUmaPage() {
  const [weights, setWeights] = useState({ skills: 50, semantic: 30, rate: 20 });
  const [saving, setSaving] = useState(false);
  const [matchingLogs, setMatchingLogs] = useState<{ mission: string; score: number; date: string }[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    // Charger les poids sauvegardés
    const savedWeights = localStorage.getItem("uma_weights");
    if (savedWeights) {
      try { setWeights(JSON.parse(savedWeights)); } catch { /* ignore */ }
    }

    // Charger les logs depuis l'API embeddings
    const loadLogs = async () => {
      try {
        const res = await fetch("/api/uma/embeddings");
        if (res.ok) {
          const data = await res.json();
          if (data.missions) {
            setMatchingLogs(
              data.missions.map((m: { missionId: string; tokensCount: number; topTokens: string[] }) => ({
                mission: m.topTokens?.slice(0, 3).join(", ") || `Mission #${m.missionId}`,
                score: m.tokensCount,
                date: new Date().toLocaleDateString("fr-FR"),
              }))
            );
          }
        }
      } catch { /* ignore */ }
      setLoadingLogs(false);
    };
    loadLogs();
  }, []);

  const updateWeight = (key: keyof typeof weights, val: number) => {
    setWeights((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("uma_weights", JSON.stringify(weights));
      sessionStorage.setItem("uma_weights", JSON.stringify(weights));
      toast.success("Configuration IA Uma mise à jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = weights.skills + weights.semantic + weights.rate;
  const isBalanced = totalWeight === 100;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🤖</span>
        <div>
          <h2 className="text-2xl font-semibold">Configuration IA Uma</h2>
          <p className="text-sm text-[#5A5750]">
            Ajustez les poids de l&apos;algorithme de matching. Total: {totalWeight}%{!isBalanced && <span className="text-yellow-600"> (devrait être 100%)</span>}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {[
          { key: "skills" as const, label: "Compétences", desc: "Correspondance des compétences techniques", emoji: "🎯" },
          { key: "semantic" as const, label: "Sémantique", desc: "Similarité de sens via embeddings (futur)", emoji: "🧠" },
          { key: "rate" as const, label: "Budget", desc: "Compatibilité du taux journalier / budget", emoji: "💰" },
        ].map((item) => (
          <div key={item.key} className="rounded-xl border border-[#E2E0D9] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>{item.emoji}</span>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-[#5A5750]">{item.desc}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-[#2D5BE3]">{weights[item.key]}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[item.key]}
              onChange={(e) => updateWeight(item.key, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Enregistrer la configuration"}
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-[#E2E0D9] p-5">
        <h3 className="font-semibold mb-2">📊 Logs de matching</h3>
        {loadingLogs ? (
          <p className="text-sm text-[#5A5750] text-center py-4">Chargement...</p>
        ) : matchingLogs.length === 0 ? (
          <p className="text-sm text-[#5A5750] text-center py-4">
            Aucun log pour le moment. Générez des recommandations Uma pour voir les logs.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {matchingLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-[#5A5750]">
                <span>{log.mission}</span>
                <span className="font-medium text-[#2D5BE3]">{log.score} tokens · {log.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
