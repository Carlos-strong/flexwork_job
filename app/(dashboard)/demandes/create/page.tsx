import { CreateDemandForm } from "@/components/forms/create-demande-form";

export const metadata = { title: "Créer une demande de service" };

export default function CreateDemandePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <CreateDemandForm />
      </div>
    </div>
  );
}
