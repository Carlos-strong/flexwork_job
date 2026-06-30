import { MissionFormWizard } from "@/lib/dynamic-imports";

export const metadata = { title: "Modifier la mission" };

export default function EditMissionPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Modifier la mission</h2>
        <p className="text-sm text-[#5A5750]">
          Prévisualisez et modifiez les informations de votre mission.
        </p>
      </div>
      <MissionFormWizard missionId={params.id} />
    </div>
  );
}
