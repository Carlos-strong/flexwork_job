"use client";

export default function ErrorPage({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-8xl font-bold text-[#C0392B]/20">500</p>
        <h1 className="mt-4 text-2xl font-semibold">Erreur serveur</h1>
        <p className="mt-2 text-[#5A5750]">Une erreur inattendue s&apos;est produite. Veuillez réessayer.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset} className="rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors">
            Réessayer
          </button>
          <a href="/" className="rounded-lg border border-[#E2E0D9] px-6 py-2.5 text-sm font-medium hover:bg-[#EEF2FD] transition-colors">
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
