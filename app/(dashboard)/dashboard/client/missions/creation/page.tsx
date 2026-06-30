import { MissionFormWizard } from "@/lib/dynamic-imports";

export const metadata = { title: "Créer une mission" };

export default function CreateMissionPage() {
  return (
    <div className="mx-auto flex flex-col gap-6 max-w-[800px] animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="mb-2 text-center sm:text-left">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Créer une mission</h2>
        <p className="text-[14px] text-[#5A5750] mt-1">
          Publiez une offre et trouvez le freelance idéal.
        </p>
      </div>
      <MissionFormWizard />
    </div>
  );
}
