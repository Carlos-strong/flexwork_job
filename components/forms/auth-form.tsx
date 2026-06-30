"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email ou mot de passe incorrect",
  OAuthSignin: "Erreur lors de la connexion avec le fournisseur",
  OAuthCallback: "Erreur lors de la vérification du compte",
  OAuthCreateAccount: "Impossible de créer le compte via ce fournisseur",
  EmailCreateAccount: "Impossible de créer le compte",
  Callback: "Erreur lors de la connexion",
  OAuthAccountNotLinked: "Ce compte est déjà lié à une autre méthode de connexion",
  EmailSignin: "Erreur lors de l'envoi de l'email de connexion",
  Verification: "Le lien de vérification a expiré ou est invalide",
  SessionRequired: "Veuillez vous connecter pour accéder à cette page",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  // Détecter les erreurs renvoyées par NextAuth dans l'URL (redirect: true)
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Respecter le callbackUrl passé par le middleware (ex: /admin)
    // Fallback intelligent selon le rôle si aucun callbackUrl n'est fourni
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard/client";

    // redirect: true → redirection full-page native NextAuth (le + rapide)
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: true,
      callbackUrl,
    });

    // Si on arrive ici, c'est que le redirect a échoué
    setLoading(false);
    if (result?.error) {
      setError("Email ou mot de passe incorrect");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bannière compte activé avec succès */}
      {searchParams.get("verified") === "true" && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          ✅ Votre email a bien été vérifié. Vous pouvez maintenant vous connecter.
        </div>
      )}
      {searchParams.get("error") === "expired_token" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          ⏰ Le lien d'activation a expiré (valable 24h). Contactez le support pour un nouveau lien.
        </div>
      )}
      {searchParams.get("error") === "invalid_token" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ❌ Lien d'activation invalide ou déjà utilisé.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[#C0392B]/10 p-3 text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
          placeholder="vous@email.com"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium mb-1">
          Mot de passe
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-[#E2E0D9] bg-white px-3 py-2 text-sm"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <p className="text-center text-sm text-[#5A5750]">
        <Link href="/mot-de-passe-oublie" className="text-[#2D5BE3] hover:underline">
          Mot de passe oublié ?
        </Link>
      </p>

      <p className="text-center text-sm text-[#5A5750]">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-[#2D5BE3] hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
