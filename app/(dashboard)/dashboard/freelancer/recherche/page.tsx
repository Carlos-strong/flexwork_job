import { MissionSearch } from "./mission-search";

export const metadata = { title: "Recherche de missions" };

export default function FreelancerSearchPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Recherche de missions</h2>
        <p className="text-sm text-[#5A5750]">Trouvez la mission qui correspond à vos compétences.</p>
      </div>
      <MissionSearch />
    </div>
  );
}
