"use server";

import { revalidatePath } from "next/cache";

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Change le statut d'une candidature (ACCEPTED / REJECTED).
 * Appelé depuis le composant optimiste côté client.
 */
export async function updateApplicationStatus(id: string, status: string) {
  const res = await fetch(`${API_BASE}/api/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error("Échec de la mise à jour du statut");
  }

  revalidatePath("/dashboard/client/missions");
  return res.json();
}

/**
 * Change le statut d'un milestone (APPROVED / REJECTED).
 */
export async function updateMilestoneStatus(
  contractId: string,
  milestoneId: string,
  status: string
) {
  const res = await fetch(
    `${API_BASE}/api/contracts/${contractId}/milestones`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId, status }),
    }
  );

  if (!res.ok) {
    throw new Error("Échec de la mise à jour du milestone");
  }

  revalidatePath(`/dashboard/client/contrat/${contractId}`);
  return res.json();
}
