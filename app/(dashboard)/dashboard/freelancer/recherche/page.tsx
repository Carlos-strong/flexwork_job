import { MissionSearch } from "./mission-search";
import { PageHeader } from "@/components/dashboard/ui";

export const metadata = { title: "Recherche de missions" };

export default function FreelancerSearchPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-8">
        <PageHeader
          title="Recherche de missions"
          subtitle="Trouvez la mission qui correspond à vos compétences."
        />
      </div>
      <MissionSearch />
    </div>
  );
}
