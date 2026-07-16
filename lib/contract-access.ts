/**
 * Contrôle d'accès aux contrats.
 *
 * Un contrat n'a que deux parties légitimes : le client (via la mission) et
 * le prestataire (via le profil freelance). Ces helpers résolvent l'identité
 * des parties et refusent tout appelant qui n'en fait pas partie.
 *
 * Utilisé par toutes les routes de mutation de contrat pour garantir qu'un
 * appelant authentifié ne peut agir que sur ses propres contrats, et
 * uniquement dans le rôle qui est le sien.
 */

import { prisma } from "./prisma";

export type ContractRole = "client" | "freelancer";

export interface ContractParties {
  contractId: string;
  clientUserId: string | null;
  freelancerUserId: string | null;
}

/**
 * Résout les identifiants utilisateur des deux parties d'un contrat.
 * Retourne `null` si le contrat n'existe pas.
 */
export async function resolveContractParties(
  contractId: string
): Promise<ContractParties | null> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      freelancer: { select: { userId: true } },
      mission: { select: { client: { select: { userId: true } } } },
    },
  });

  if (!contract) return null;

  return {
    contractId: contract.id,
    clientUserId: contract.mission?.client?.userId ?? null,
    freelancerUserId: contract.freelancer?.userId ?? null,
  };
}

export type ContractAccessResult =
  | { ok: true; role: ContractRole; parties: ContractParties }
  | { ok: false; status: 404 | 403; error: string };

/**
 * Vérifie qu'un utilisateur est bien partie au contrat et détermine son rôle.
 *
 * @param requiredRole si fourni, l'appel n'est autorisé que pour ce rôle
 *                     précis (ex. seul le client peut financer/valider).
 */
export async function checkContractAccess(
  contractId: string,
  userId: string | undefined,
  requiredRole?: ContractRole
): Promise<ContractAccessResult> {
  if (!userId) {
    return { ok: false, status: 403, error: "Non authentifié" };
  }

  const parties = await resolveContractParties(contractId);
  if (!parties) {
    return { ok: false, status: 404, error: "Contrat introuvable" };
  }

  let role: ContractRole;
  if (userId === parties.freelancerUserId) role = "freelancer";
  else if (userId === parties.clientUserId) role = "client";
  else return { ok: false, status: 403, error: "Vous n'êtes pas partie à ce contrat" };

  if (requiredRole && role !== requiredRole) {
    return {
      ok: false,
      status: 403,
      error:
        requiredRole === "client"
          ? "Cette action est réservée au client"
          : "Cette action est réservée au prestataire",
    };
  }

  return { ok: true, role, parties };
}
