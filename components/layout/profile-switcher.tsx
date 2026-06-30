"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface ProfileSwitcherProps {
  currentProfile: string;
  hasFreelancerProfile: boolean;
  hasClientProfile: boolean;
}

export function ProfileSwitcher({
  currentProfile,
  hasFreelancerProfile,
  hasClientProfile,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSwitch = async (targetProfile: "FREELANCER" | "CLIENT") => {
    if (targetProfile === currentProfile) return;

    setLoading(true);

    try {
      const res = await fetch("/api/auth/switch-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfile }),
      });

      if (!res.ok) {
        console.error("Erreur lors du changement de profil");
        setLoading(false);
        return;
      }

      // Déconnexion + reconnexion pour rafraîchir le token JWT
      await signOut({ redirect: false });
      router.push("/connexion");
    } catch {
      setLoading(false);
    }
  };

  // Ne montrer le sélecteur que si l'utilisateur a les deux profils ou peut en créer un second
  if (!hasFreelancerProfile && !hasClientProfile) return null;

  return (
    <div className="border-t px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5750] mb-2">
        Changer de profil
      </p>
      <div className="space-y-1">
        {hasFreelancerProfile && (
          <button
            onClick={() => handleSwitch("FREELANCER")}
            disabled={loading || currentProfile === "FREELANCER"}
            className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              currentProfile === "FREELANCER"
                ? "bg-[#EEF2FD] text-[#2D5BE3]"
                : "text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916]"
            }`}
          >
            👨‍💻 Mode freelance
            {currentProfile === "FREELANCER" && (
              <span className="ml-2 text-xs text-[#2D5BE3]">(actif)</span>
            )}
          </button>
        )}
        {hasClientProfile && (
          <button
            onClick={() => handleSwitch("CLIENT")}
            disabled={loading || currentProfile === "CLIENT"}
            className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              currentProfile === "CLIENT"
                ? "bg-[#EEF2FD] text-[#2D5BE3]"
                : "text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916]"
            }`}
          >
            🏢 Mode client
            {currentProfile === "CLIENT" && (
              <span className="ml-2 text-xs text-[#2D5BE3]">(actif)</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
