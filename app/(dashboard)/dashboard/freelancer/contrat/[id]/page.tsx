/**
 * Page contrat freelance → redirige vers la vue de pilotage unifiée.
 *
 * La vue de pilotage (/dashboard/pilotage/[contractId]) gère à la fois
 * le rôle client et freelance avec ContractWorkflowPanel.
 */
import { redirect } from "next/navigation";

export default function FreelancerContratPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/pilotage/${params.id}`);
}
