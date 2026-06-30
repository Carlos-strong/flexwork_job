"use client";

import { useState } from "react";

export function EmailVerificationBanner({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 5000);
      }
    } catch {
      // Silently fail
    }
    setSending(false);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
      <div className="flex items-center justify-between gap-4 px-6 py-3 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <p>
            <strong>{name}</strong>, votre adresse email n&apos;a pas encore été vérifiée.
            Consultez votre boîte de réception (<strong>{email}</strong>) et cliquez sur le lien
            d&apos;activation pour profiter de toutes les fonctionnalités.
          </p>
        </div>
        <button
          onClick={resend}
          disabled={sending || sent}
          className="shrink-0 rounded-lg bg-amber-100 px-4 py-2 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
        >
          {sending ? "Envoi…" : sent ? "✅ Envoyé" : "Renvoyer"}
        </button>
      </div>
    </div>
  );
}
