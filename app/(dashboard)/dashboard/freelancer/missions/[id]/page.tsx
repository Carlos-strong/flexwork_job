"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ApplyMissionPage() {
  const router = useRouter();
  const params = useParams();
  const [mission, setMission] = useState<{id:string;title:string;description:string;budget:number;skills:string[];duration:string;location:string;status:string} | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedBudget, setProposedBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/missions/${params.id}`)
      .then((r) => r.json())
      .then((json) => setMission(json.data ?? json))
      .catch(() => {});
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Récupérer l'utilisateur connecté
    let freelancerId = "guest";
    let freelancerName = "Freelancer";
    let freelancerTitle = "Freelancer";
    let skills: string[] = [];
    let rate = 0;
    try {
      const [authRes, profRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/users/freelancers/profile"),
      ]);
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.user) {
          freelancerId = authData.user.id || "guest";
          freelancerName = authData.user.name || "Freelancer";
        }
      }
      if (profRes.ok) {
        const profData = await profRes.json();
        if (profData.profile) {
          freelancerTitle = profData.profile.title || "Freelancer";
          skills = profData.profile.skills || [];
          rate = profData.profile.hourlyRate || 0;
        }
      }
    } catch { /* ignore */ }

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: params.id,
        freelancerId,
        freelancerName,
        freelancerTitle,
        skills,
        rate,
        coverLetter,
        proposedBudget: Number(proposedBudget),
      }),
    });

    setLoading(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur lors de l'envoi de votre candidature");
    }
  };

  if (!mission) return <div className="text-center py-12 text-[#5A5750]">Chargement...</div>;

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-2xl font-semibold">Candidature envoyée !</h2>
        <p className="mt-2 text-[#5A5750]">Votre candidature a été transmise au client. Vous recevrez une notification dès qu&apos;il aura pris une décision.</p>
        <button onClick={() => router.push("/dashboard/freelancer")} className="mt-6 rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors">
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-[#E2E0D9] p-6 mb-8">
        <h2 className="text-xl font-semibold">{mission.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {mission.skills?.map((s: string) => (
            <span key={s} className="rounded-full bg-[#F5F5F0] px-2.5 py-0.5 text-xs font-medium">{s}</span>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#5A5750]">{mission.description}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="font-semibold text-[#2D5BE3]">{mission.budget?.toLocaleString() ?? 'N/A'} €</span>
          <span className="text-[#5A5750]">{mission.duration}</span>
          <span className="text-[#5A5750]">{mission.location}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Lettre de motivation</label>
          <p className="text-xs text-[#5A5750] mb-2">Présentez-vous et expliquez pourquoi vous êtes le candidat idéal.</p>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            required
            rows={5}
            placeholder="Bonjour, je suis très intéressé(e) par cette mission car..."
            className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Budget proposé (€)</label>
          <input
            type="number"
            value={proposedBudget}
            onChange={(e) => setProposedBudget(e.target.value)}
            required
            placeholder={String(mission.budget)}
            className="w-full rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#2D5BE3] px-8 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {loading ? "Envoi en cours..." : "Envoyer ma candidature"}
        </button>
      </form>
    </div>
  );
}
