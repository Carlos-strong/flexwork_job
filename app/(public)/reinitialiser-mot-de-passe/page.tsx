"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse mt-8">
      <div className="h-10 bg-[#F5F5F0] rounded-md" />
      <div className="h-10 bg-[#F5F5F0] rounded-md" />
      <div className="h-10 bg-[#F5F5F0] rounded-md" />
      <div className="h-11 bg-[#F5F5F0] rounded-md" />
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Vérifier que le token et l'email sont présents
  if (!token || !email) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ❌ Lien de réinitialisation invalide. Le token ou l&apos;email sont manquants.
        </div>
        <Link href="/mot-de-passe-oublie" className="inline-block text-[#2D5BE3] hover:underline font-medium">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erreur de connexion au serveur");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#E6F5EE] border border-[#9FD4B4] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1A7A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Mot de passe modifié !</h2>
        <p className="text-[#5A5750]">
          Votre mot de passe a été réinitialisé avec succès.
        </p>
        <button
          onClick={() => router.push("/connexion")}
          className="rounded-md bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="rp-password" className="block text-sm font-medium mb-1">
          Nouveau mot de passe
        </label>
        <input
          id="rp-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
          placeholder="8 caractères minimum"
        />
      </div>

      <div>
        <label htmlFor="rp-confirm" className="block text-sm font-medium mb-1">
          Confirmer le mot de passe
        </label>
        <input
          id="rp-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
          placeholder="Répétez le mot de passe"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[#1A7A4A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0F5C35] transition-colors disabled:opacity-50"
      >
        {loading ? "Modification..." : "Réinitialiser le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold text-center">Réinitialiser le mot de passe</h1>
        <p className="mt-2 text-center text-sm text-[#5A5750]">
          Choisissez un nouveau mot de passe pour votre compte
        </p>

        <div className="mt-8">
          <Suspense fallback={<Skeleton />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
