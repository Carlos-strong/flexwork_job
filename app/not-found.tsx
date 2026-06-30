import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-8xl font-bold text-primary/20">404</p>
        <h1 className="mt-4 text-2xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-[#5A5750]">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
