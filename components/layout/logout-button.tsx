"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    // signOut avec callbackUrl : une seule opération, redirection serveur native
    await signOut({ callbackUrl: "/" });
  };

  const label = loading ? "Déconnexion..." : "Déconnexion";

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#C0392B]/10 hover:text-[#C0392B] transition-colors disabled:opacity-50"
      >
        <span className="h-4 w-4 flex items-center justify-center text-xs">🚪</span>
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}
