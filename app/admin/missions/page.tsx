"use client";

import { useState, useEffect } from "react";

interface Mission {
  id: string;
  title: string;
  clientId: string;
  budget: number;
  status: string;
  skills: string[];
}

export default function AdminMissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderating, setModerating] = useState<string | null>(null);

  const loadMissions = async () => {
    try {
      const res = await fetch("/api/missions");
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setMissions(list);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const handleModerate = async (id: string, action: string) => {
    setModerating(id);
    try {
      await fetch(`/api/missions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action === "approve" ? "OPEN" : "CANCELLED" }),
      });
      await loadMissions();
    } catch {
      // ignore
    } finally {
      setModerating(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Modération des missions</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#E2E0D9] p-5 animate-pulse">
              <div className="h-5 w-48 bg-[#F5F5F0] rounded" />
              <div className="mt-2 h-4 w-32 bg-[#F5F5F0] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Modération des missions</h2>
      {missions.length === 0 ? (
        <p className="text-sm text-[#5A5750] text-center py-8">Aucune mission à modérer.</p>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#E2E0D9] p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-[#5A5750]">
                  Client #{m.clientId} · {m.budget.toLocaleString()} €
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.skills?.map((s) => (
                    <span key={s} className="text-xs text-[#5A5750] bg-[#F5F5F0]/50 rounded-full px-2 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.status === "OPEN" ? "bg-green-100 text-green-700" :
                  m.status === "DRAFT" ? "bg-yellow-100 text-yellow-700" :
                  "bg-blue-100 text-blue-700"
                }`}>{m.status}</span>
                {m.status !== "CANCELLED" && (
                  <>
                    <button
                      onClick={() => handleModerate(m.id, "approve")}
                      disabled={moderating === m.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {moderating === m.id ? "..." : "Approuver"}
                    </button>
                    <button
                      onClick={() => handleModerate(m.id, "reject")}
                      disabled={moderating === m.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
