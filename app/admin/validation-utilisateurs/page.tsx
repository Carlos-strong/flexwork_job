"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PrestataireMetier {
  id: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  metier: {
    libelle: string;
  };
  experience: string;
  description: string;
  statutValidation: string;
  createdAt: string;
}

export default function UserValidationPage() {
  const [prestataires, setPrestataires] = useState<PrestataireMetier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPendingPrestataires();
  }, []);

  const fetchPendingPrestataires = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/validation-utilisateurs");
      const data = await response.json();
      setPrestataires(data.data || data);
    } catch (err) {
      setError("Erreur lors du chargement des prestataires");
      console.error("Failed to fetch prestataires:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (prestataireMetierId: string) => {
    try {
      const res = await fetch("/api/admin/validation-utilisateurs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prestataireMetierId,
          statut: "VALIDE",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors de la validation");
        return;
      }

      fetchPendingPrestataires();
    } catch (err) {
      setError("Erreur lors de la validation");
      console.error("Failed to validate prestataire:", err);
    }
  };

  const handleReject = async (prestataireMetierId: string) => {
    const motif = prompt("Motif du rejet:");
    if (!motif) return;

    try {
      const res = await fetch("/api/admin/validation-utilisateurs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prestataireMetierId,
          statut: "REJETE",
          motifRejet: motif,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors du rejet");
        return;
      }

      fetchPendingPrestataires();
    } catch (err) {
      setError("Erreur lors du rejet");
      console.error("Failed to reject prestataire:", err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Validation des prestataires</h1>
        <p className="text-[#5A5750]">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Validation des prestataires</h1>
        <div className="text-sm text-[#5A5750]">
          {prestataires.length} prestataire(s) en attente
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-[#C0392B]/10 p-3 text-sm text-[#C0392B] mb-4">
          {error}
        </div>
      )}

      {prestataires.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E2E0D9] p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-[#5A5750] mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[#5A5750]">
            Aucun prestataire en attente de validation
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {prestataires.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-[#E2E0D9] overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {p.user.firstName} {p.user.lastName}
                    </h3>
                    <p className="text-sm text-[#5A5750]">{p.user.email}</p>
                    {p.user.phone && (
                      <p className="text-sm text-[#5A5750]">{p.user.phone}</p>
                    )}

                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-xs font-medium text-[#5A5750]">Métier:</span>
                        <p className="text-sm">{p.metier.libelle}</p>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-[#5A5750]">Expérience:</span>
                        <p className="text-sm">{p.experience}</p>
                      </div>

                      <div>
                        <span className="text-xs font-medium text-[#5A5750]">Description:</span>
                        <p className="text-sm text-[#5A5750]">{p.description}</p>
                      </div>

                      <div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            p.statutValidation === "EN_ATTENTE"
                              ? "bg-yellow-100 text-yellow-700"
                              : p.statutValidation === "VALIDE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {p.statutValidation}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/validation-utilisateurs/${p.id}`}
                      className="px-3 py-2 text-sm font-medium rounded-md border border-[#E2E0D9] hover:bg-[#EEF2FD] transition-colors"
                    >
                      Détail
                    </Link>
                    <button
                      onClick={() => handleValidate(p.id)}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      ✓ Valider
                    </button>
                    <button
                      onClick={() => handleReject(p.id)}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      ✕ Rejeter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}