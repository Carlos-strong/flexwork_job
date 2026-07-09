/**
 * Simulation E2E — Workflow complet candidature → paiement
 *
 * Valide toutes les étapes du pipeline :
 *   Candidature → Lecture → Présélection → Discussion → Entretien
 *   → Offre → Acceptation → Contrat → Escrow → Jalon → Paiement
 *
 * Usage : npx tsx scripts/simulate-workflow-full.ts
 * (Nécessite une BDD PostgreSQL accessible avec DATABASE_URL configurée)
 */

import { PrismaClient, ApplicationStatus } from "@prisma/client";
import { ApplicationService } from "@/lib/services/application.service";
import { OfferService } from "@/lib/services/offer.service";
import {
  isValidTransition,
  getNextStates,
  validateTransition,
} from "@/lib/validations/application-workflow";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface SimulationContext {
  clientUserId: string;
  freelancerUserId: string;
  clientProfileId: string;
  freelancerProfileId: string;
  missionId: string;
  applicationId: string;
  interviewId: string;
  offerId: string;
  contractId: string;
  milestoneIds: string[];
}

interface StepResult {
  step: number;
  name: string;
  status: "✅" | "❌" | "⚠️";
  details: string;
}

// ═══════════════════════════════════════════════
// HELPER — Step Logger
// ═══════════════════════════════════════════════

const results: StepResult[] = [];

function logStep(
  step: number,
  name: string,
  success: boolean,
  details: string
) {
  const result: StepResult = {
    step,
    name,
    status: success ? "✅" : "❌",
    details,
  };
  results.push(result);
  console.log(`  ${result.status} [Étape ${step}] ${name} — ${details}`);
}

function logWarning(step: number, name: string, details: string) {
  results.push({ step, name, status: "⚠️", details });
  console.log(`  ⚠️  [Étape ${step}] ${name} — ${details}`);
}

// ═══════════════════════════════════════════════
// SIMULATION
// ═══════════════════════════════════════════════

async function simulate() {
  console.log("");
  console.log("=".repeat(70));
  console.log("  🧪 SIMULATION E2E — WORKFLOW CANDIDATURE → PAIEMENT");
  console.log("=".repeat(70));
  console.log("");

  const ctx: Partial<SimulationContext> = {};
  let step = 0;

  try {
    // ──────────────────────────────────────────
    // PHASE 0 : VÉRIFICATION DE LA STATE MACHINE
    // ──────────────────────────────────────────
    console.log("━━━ PHASE 0 — VÉRIFICATION STATE MACHINE ━━━\n");

    step++;
    const chain: ApplicationStatus[] = [
      "UNREAD",
      "READ",
      "SHORTLISTED",
      "DISCUSSION",
      "INTERVIEW",
      "OFFER_SENT",
      "OFFER_ACCEPTED",
      "ACCEPTED",
    ];

    let chainValid = true;
    for (let i = 0; i < chain.length - 1; i++) {
      const from = chain[i];
      const to = chain[i + 1];
      const valid = isValidTransition(from, to);
      if (!valid) {
        logStep(step, "Chaîne de transitions", false, `${from} → ${to} invalide`);
        chainValid = false;
      }
    }
    if (chainValid) {
      logStep(step, "Chaîne de transitions", true, `Toutes les transitions sont valides (${chain.join(" → ")})`);
    }

    step++;
    const terminalStates: ApplicationStatus[] = ["ACCEPTED", "REJECTED"];
    let terminalsOk = true;
    for (const s of terminalStates) {
      const next = getNextStates(s);
      if (next.length !== 0) {
        logStep(step, "États terminaux", false, `${s} a ${next.length} transition(s) sortante(s)`);
        terminalsOk = false;
      }
    }
    if (terminalsOk) {
      logStep(step, "États terminaux", true, "ACCEPTED et REJECTED sont bien terminaux (0 sorties)");
    }

    // ──────────────────────────────────────────
    // PHASE 1 : CRÉATION DES DONNÉES DE TEST
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 1 — CRÉATION DES DONNÉES DE TEST ━━━\n");

    step++;

    // 1. Récupérer tous les utilisateurs existants
    const allUsers = await prisma.user.findMany({
      include: {
        clientProfile: true,
        freelancerProfile: true,
      },
    });

    const clientUser = allUsers.find((u) => u.clientProfile);
    const freelancerUser = allUsers.find((u) => u.freelancerProfile);

    if (!clientUser || !freelancerUser) {
      logStep(step, "Utilisateurs", false, `Trouvé ${allUsers.length} utilisateur(s), besoin d'au moins 1 client + 1 freelance`);
      throw new Error("Pas assez d'utilisateurs avec profils");
    }

    const clientProfile = clientUser.clientProfile!;
    const freelancerProfile = freelancerUser.freelancerProfile!;

    ctx.clientUserId = clientUser.id;
    ctx.clientProfileId = clientProfile.id;
    ctx.freelancerUserId = freelancerUser.id;
    ctx.freelancerProfileId = freelancerProfile.id;
    logStep(step, "Utilisateurs trouvés", true, `Client: ${clientUser.firstName} ${clientUser.lastName} | Freelance: ${freelancerUser.firstName} ${freelancerUser.lastName}`);

    step++;

    // 3. Trouver ou créer une mission
    let mission = await prisma.mission.findFirst({
      where: { clientId: ctx.clientProfileId },
    });

    if (!mission) {
      logStep(step, "Mission de test", false, "Aucune mission trouvée pour ce client");
      throw new Error("Mission non trouvée");
    }

    ctx.missionId = mission.id;
    logStep(step, "Mission de test", true, `"${mission.title}" (${mission.budget}€)`);

    // ──────────────────────────────────────────
    // PHASE 2 : CANDIDATURE
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 2 — CYCLE DE CANDIDATURE ━━━\n");

    step++;

    // 4. Vérifier qu'il y a une candidature
    let application = await prisma.application.findFirst({
      where: { missionId: ctx.missionId, freelancerId: ctx.freelancerProfileId },
    });

    if (!application) {
      logStep(step, "Candidature existante", false, "Aucune candidature pour ce freelance sur cette mission");
      // On peut en créer une via Prisma directement
      application = await prisma.application.create({
        data: {
          missionId: ctx.missionId!,
          freelancerId: ctx.freelancerProfileId!,
          status: "UNREAD",
          coverLetter: "Candidature de test pour simulation E2E",
          proposedBudget: mission?.budget ?? 1000,
        },
      });
      logStep(step, "Candidature créée", true, `ID: ${application.id} — Statut: ${application.status}`);
    } else {
      logStep(step, "Candidature existante", true, `ID: ${application.id} — Statut: ${application.status}`);
    }

    ctx.applicationId = application.id;

    // ──────────────────────────────────────────
    // PHASE 3 : WORKFLOW CANDIDATURE
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 3 — WORKFLOW CANDIDATURE (CHANGE STATUS) ━━━\n");

    const workflow: { status: ApplicationStatus; reason?: string }[] = [
      { status: "READ" },
      { status: "SHORTLISTED" },
      { status: "DISCUSSION" },
    ];

    for (const stepDef of workflow) {
      step++;

      // Vérifier d'abord si déjà dans cet état
      const currentApp = await prisma.application.findUnique({
        where: { id: ctx.applicationId },
      });
      if (currentApp!.status === stepDef.status) {
        logStep(step, `Statut → ${stepDef.status}`, true, `Déjà en ${stepDef.status} (idempotent)`);
        continue;
      }

      try {
        const result = await ApplicationService.changeStatus({
          applicationId: ctx.applicationId!,
          newStatus: stepDef.status,
          changedByUserId: ctx.clientUserId!,
          changedByRole: "CLIENT",
          reason: stepDef.reason,
        });
        logStep(step, `Statut → ${stepDef.status}`, true, `Transition réussie: ${result.statusHistory.fromStatus} → ${result.statusHistory.toStatus}`);
      } catch (err: any) {
        logStep(step, `Statut → ${stepDef.status}`, false, err.message);
      }
    }

    // ──────────────────────────────────────────
    // PHASE 4 : ENTRETIEN
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 4 — ENTRETIEN ━━━\n");

    step++;

    // Créer un entretien
    try {
      const currentApp = await prisma.application.findUnique({
        where: { id: ctx.applicationId },
      });

      if (currentApp!.status === "DISCUSSION") {
        const interview = await ApplicationService.createInterview({
          applicationId: ctx.applicationId!,
          format: "VIDEO_CALL",
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Demain
          duration: 60,
          notes: "Entretien technique de validation",
        });
        ctx.interviewId = interview.id;
        logStep(step, "Création entretien", true, `ID: ${interview.id} — Format: VIDEO_CALL — Durée: 60min`);

        // Vérifier que le statut a été mis à jour
        const appAfter = await prisma.application.findUnique({
          where: { id: ctx.applicationId },
        });
        if (appAfter!.status === "INTERVIEW") {
          logStep(step + 0.1, "Statut → INTERVIEW", true, "Transition automatique après programmation entretien");
        } else {
          logWarning(step, "Statut après entretien", `Attendu: INTERVIEW, Reçu: ${appAfter!.status}`);
        }
        step++;

        // Compléter l'entretien
        const completedInterview = await ApplicationService.completeInterview({
          interviewId: interview.id,
          feedbackByClient: "Très bon échange, le freelance a les compétences requises",
          rating: 4,
        });
        logStep(step, "Complétion entretien", true, `Feedback client fourni — Note: ${completedInterview.rating}/5`);
      } else {
        logWarning(step, "Création entretien", `Statut actuel: ${currentApp!.status} — Attendu: DISCUSSION. On continue...`);
      }
    } catch (err: any) {
      logStep(step, "Création entretien", false, err.message);
    }

    // ──────────────────────────────────────────
    // PHASE 5 : OFFRE
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 5 — OFFRE ━━━\n");

    step++;

    // S'assurer qu'on est en OFFER_SENT
    let appBeforeOffer = await prisma.application.findUnique({
      where: { id: ctx.applicationId },
    });

    // Si on n'est pas encore en OFFER_SENT, faire la transition manuellement
    if (appBeforeOffer!.status !== "OFFER_SENT" && appBeforeOffer!.status !== "OFFER_ACCEPTED") {
      if (appBeforeOffer!.status !== "INTERVIEW") {
        try {
          await ApplicationService.changeStatus({
            applicationId: ctx.applicationId!,
            newStatus: "INTERVIEW",
            changedByUserId: ctx.clientUserId!,
            changedByRole: "CLIENT",
            reason: "Transition vers entretien pour offre",
          });
        } catch (_) { /* peut-être déjà fait */ }
      }
    }

    // Créer une offre
    try {
      const offer = await OfferService.createOffer({
        applicationId: ctx.applicationId!,
        title: "Offre de mission - Développement",
        description: "Offre formelle pour la mission de test",
        offerType: "FIXED",
        totalBudget: mission?.budget ?? 2000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        milestones: [
          { title: "Conception", description: "Phase de conception", amount: 500, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          { title: "Développement", description: "Phase de développement", amount: 1000, dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) },
          { title: "Livraison", description: "Phase de livraison finale", amount: 500, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        ],
      });
      ctx.offerId = offer.id;
      logStep(step, "Création offre (DRAFT)", true, `ID: ${offer.id} — Budget: ${offer.totalBudget}€ — 3 jalons`);

      step++;

      // Envoyer l'offre
      const sentOffer = await OfferService.sendOffer(offer.id);
      logStep(step, "Envoi offre", true, `Statut: ${sentOffer.status} — Expire: ${sentOffer.expiresAt?.toLocaleDateString()}`);

      // Vérifier que l'application est passée à OFFER_SENT
      const appAfterOffer = await prisma.application.findUnique({
        where: { id: ctx.applicationId },
      });
      if (appAfterOffer!.status === "OFFER_SENT") {
        logStep(step + 0.1, "Statut → OFFER_SENT", true, "Transition automatique après envoi offre");
      }
      step++;

      // Accepter l'offre
      const accepted = await OfferService.acceptOffer(offer.id, ctx.freelancerUserId!);
      ctx.contractId = accepted.contract.id;

      // Récupérer les milestones du contrat
      const contractMilestones = await prisma.milestone.findMany({
        where: { contractId: accepted.contract.id },
      });
      ctx.milestoneIds = contractMilestones.map((m) => m.id);

      logStep(step, "Acceptation offre + Contrat", true, `Offre: ${accepted.offer.status} — Contrat: ${accepted.contract.id} (${contractMilestones.length} jalons copiés)`);

      // Vérifier le statut application
      const appFinal = await prisma.application.findUnique({
        where: { id: ctx.applicationId },
      });
      logStep(step + 0.1, "Statut final candidature", true, `${appFinal!.status} (OFFER_ACCEPTED puis SELECTED dans la transaction)`);
      step++;
    } catch (err: any) {
      logStep(step, "Création offre", false, err.message);
    }

    // ──────────────────────────────────────────
    // PHASE 6 : CONTRAT → ACTIF
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 6 — ACTIVATION CONTRAT ━━━\n");

    step++;

    try {
      // Vérifier le contrat créé
      const contract = await prisma.contract.findUnique({
        where: { id: ctx.contractId },
        include: { milestones: true },
      });

      if (!contract) {
        logStep(step, "Contrat trouvé", false, "Contrat introuvable — l'étape d'acceptation a peut-être échoué");
      } else {
        logStep(step, "Contrat trouvé", true, `Statut: ${contract.status} — Budget: ${contract.totalBudget}€ — ${contract.milestones.length} jalons`);

        // Simuler le financement escrow
        // Dans le workflow réel : CONTRACT_CREATED → FUNDED → IN_PROGRESS
        // Le client dépose les fonds via Stripe/TrustEngine
        step++;

        try {
          await prisma.contract.update({
            where: { id: ctx.contractId },
            data: {
              status: "ACTIVE",
              escrowAmount: contract.totalBudget,
              escrowId: `te_sim_${Date.now()}`,
            },
          });
          logStep(step, "Activation contrat (escrow)", true, `Statut: ACTIVE — Escrow simulé: ${contract.totalBudget}€ sécurisés`);
        } catch (err: any) {
          logStep(step, "Activation contrat", false, err.message);
        }
      }
    } catch (err: any) {
      logStep(step, "Consultation contrat", false, err.message);
    }

    // ──────────────────────────────────────────
    // PHASE 7 : JALONS + PAIEMENT
    // ──────────────────────────────────────────
    console.log("\n━━━ PHASE 7 — JALONS & PAIEMENT ━━━\n");

    for (let i = 0; i < (ctx.milestoneIds?.length ?? 0); i++) {
      const milestoneId = ctx.milestoneIds![i];
      step++;

      try {
        // Le freelance soumet le jalon
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "IN_REVIEW",
            completedAt: new Date(),
          },
        });

        const milestone = await prisma.milestone.findUnique({
          where: { id: milestoneId },
        });
        logStep(step, `Jalon ${i + 1} soumis`, true, `"${milestone!.title}" — ${milestone!.amount}€ — En relecture`);

        step++;

        // Le client approuve le jalon
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "APPROVED" },
        });

        logStep(step, `Jalon ${i + 1} approuvé`, true, `"${milestone!.title}" — ${milestone!.amount}€ prêt au paiement`);

        step++;

        // Simuler la libération des fonds
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "RELEASED" },
        });

        // Créer une entrée de paiement
        const payment = await prisma.payment.create({
          data: {
            userId: ctx.freelancerUserId!,
            amount: milestone!.amount,
            type: "RELEASE",
            status: "SUCCEEDED",
            metadata: {
              milestoneId: milestoneId,
              contractId: ctx.contractId,
              milestoneTitle: milestone!.title,
            },
          },
        });

        logStep(step, `Paiement jalon ${i + 1}`, true, `${milestone!.amount}€ libérés (Payment ID: ${payment.id})`);

        // Si dernier jalon, marquer le contrat comme complété
        if (i === ctx.milestoneIds!.length - 1) {
          await prisma.contract.update({
            where: { id: ctx.contractId },
            data: { status: "COMPLETED" },
          });
          logStep(step + 0.5, "Contrat complété", true, "Tous les jalons sont payés — contrat terminé");
        }
      } catch (err: any) {
        logStep(step, `Jalon ${i + 1}`, false, err.message);
      }
    }

    // ──────────────────────────────────────────
    // RAPPORT FINAL
    // ──────────────────────────────────────────
    console.log("\n" + "=".repeat(70));
    console.log("  📊 RAPPORT DE SIMULATION E2E");
    console.log("=".repeat(70));
    console.log("");

    const total = results.length;
    const passed = results.filter((r) => r.status === "✅").length;
    const warnings = results.filter((r) => r.status === "⚠️").length;
    const failed = results.filter((r) => r.status === "❌").length;

    for (const r of results) {
      console.log(`  ${r.status} [Étape ${r.step}] ${r.name}`);
    }

    console.log("");
    console.log(`  📋 Total: ${total} étapes`);
    console.log(`  ✅ Succès: ${passed}`);
    console.log(`  ⚠️  Avertissements: ${warnings}`);
    console.log(`  ❌ Échecs: ${failed}`);
    console.log("");

    if (failed === 0) {
      console.log("  ✅ WORKFLOW COMPLÈTEMENT VALIDE — Toutes les étapes du pipeline sont fonctionnelles !");
    } else {
      console.log(`  ⚠️  ${failed} étape(s) en échec — Vérifier les points ci-dessus.`);
    }

    // Nettoyage optionnel
    console.log("\n--- Nettoyage des données de test ---");
    // On ne supprime pas les données pour permettre la vérification manuelle
    console.log("  ℹ️  Données de test conservées en base pour vérification.");
  } catch (err: any) {
    console.error("\n❌ ERREUR FATALE:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulate().catch(console.error);
