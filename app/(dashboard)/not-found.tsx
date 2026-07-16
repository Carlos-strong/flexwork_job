import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary/20">404</p>
        <h1 className="mt-4 text-xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-[#5A5750]">
          Cette ressource n&apos;existe pas ou vous n&apos;y avez pas acc&egrave;s.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
        >
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
