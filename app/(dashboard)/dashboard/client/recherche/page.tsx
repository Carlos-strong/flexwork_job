import { FreelancerSearch } from "@/lib/dynamic-imports";

export const metadata = { title: "Recherche de freelances" };

export default function ClientSearchPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Recherche de freelances</h2>
        <p className="text-sm text-[#5A5750]">
          Trouvez le talent idéal pour votre projet.
        </p>
      </div>
      <FreelancerSearch basePath="/dashboard/client" />
    </div>
  );
}
