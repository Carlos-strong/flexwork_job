"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Erreur de connexion au serveur");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#E6F5EE] border border-[#9FD4B4] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#1A7A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Email envoyé !</h1>
          <p className="text-[#5A5750]">
            Si l&apos;adresse <strong>{email}</strong> correspond à un compte existant, vous recevrez un email avec un lien de réinitialisation.
          </p>
          <p className="text-sm text-[#9C9A95]">
            Pensez à vérifier vos spams. Le lien est valable 1 heure.
          </p>
          <Link href="/connexion" className="inline-block text-[#2D5BE3] hover:underline font-medium">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold text-center">Mot de passe oublié</h1>
        <p className="mt-2 text-center text-sm text-[#5A5750]">
          Entrez votre adresse email pour recevoir un lien de réinitialisation
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fp-email" className="block text-sm font-medium mb-1">
              Adresse email
            </label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
              placeholder="vous@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
          >
            {loading ? "Envoi en cours..." : "Envoyer le lien"}
          </button>

          <p className="text-center text-sm text-[#5A5750]">
            <Link href="/connexion" className="text-[#2D5BE3] hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
