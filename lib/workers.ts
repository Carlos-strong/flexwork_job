/**
 * Workers BullMQ pour le traitement des jobs
 *
 * Chaque queue a son propre worker.
 * À lancer séparément via : `npx tsx lib/workers.ts`
 * OU inclus dans le processus Next.js (déconseillé en prod).
 */

import { Worker } from "bullmq";
import { getConnection, enqueueJob, type QueueName } from "./queue";
import { sendEmail, EmailTemplates } from "./email";
import { notifications } from "./notifications";
import { pushNotification } from "./socket-server-client";
import { conversations, addSystemMessage } from "./collaboration";
import { stripeEscrow } from "./escrow/stripe";
import { contracts } from "./mock-data";

// ============================================================
// Handlers métier pour chaque type de job
// ============================================================

async function handleMissionCreated(data: Record<string, unknown>): Promise<void> {
  const { title, skills, budget } = data as {
    missionId: string; title: string; skills: string[]; budget: number;
  };
  console.log(`[Worker] 🚀 Nouvelle mission: "${title}"`);
  await notifications.missionCreatedToClient({ title, budget, skills });
}

async function handleMissionUpdated(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, changes } = data as {
    missionId: string; title: string; changes: string[];
  };
  console.log(`[Worker] 📝 Mission mise à jour: "${title}" (${missionId})`);
  console.log(`[Worker]   → Modifications: ${changes?.join(", ")}`);
}

async function handleApplicationSubmitted(data: Record<string, unknown>): Promise<void> {
  const { freelancerName, proposedBudget } = data as {
    applicationId: string; missionId: string; freelancerName: string; proposedBudget: number;
  };
  console.log(`[Worker] 📩 Nouvelle candidature de ${freelancerName} — ${proposedBudget}€`);
  await notifications.newApplicationToClient({
    missionTitle: (data as { missionId?: string }).missionId || "Mission",
    freelancerName,
    proposedBudget,
  });
}

async function handleApplicationAccepted(data: Record<string, unknown>): Promise<void> {
  const { missionTitle, freelancerName } = data as {
    applicationId: string; missionTitle: string; freelancerName: string; missionId: string;
  };
  console.log(`[Worker] ✅ Candidature acceptée: ${freelancerName} — ${missionTitle}`);
  await notifications.applicationAcceptedToFreelancer({
    freelancerName,
    missionTitle,
    clientName: "Client",
  });
}
async function handleApplicationViewed(data: Record<string, unknown>): Promise<void> {
  const { applicationId, missionTitle, freelancerUserId, freelancerName, freelancerEmail, clientName } = data as {
    applicationId: string; missionId: string; missionTitle: string;
    freelancerId: string; freelancerUserId: string; freelancerName: string; freelancerEmail: string; clientName: string;
  };
  console.log(`[Worker] \ud83d\udc40 Candidature consult\u00e9e: ${freelancerName} \u2014 \u00ab ${missionTitle} \u00bb par ${clientName}`);

  // Email de notification au freelancer
  const tpl = EmailTemplates.applicationViewed({
    freelancerName,
    missionTitle,
    clientName,
    applicationUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard/freelancer/candidatures/${applicationId}`,
  });
  await sendEmail({ to: freelancerEmail, ...tpl });

  // Notification temps réel (cloche) au freelancer
  pushNotification({
    userId: freelancerUserId,
    type: "application",
    title: "Candidature consultée",
    body: `${clientName} a consulté votre candidature pour « ${missionTitle} ».`,
    link: `/dashboard/freelancer/candidatures`,
  });
}
async function handleContractCreated(data: Record<string, unknown>): Promise<void> {
  const { missionTitle, escrowAmount, freelancerId } = data as {
    contractId: string; missionTitle: string; escrowAmount: number; freelancerId: string;
  };
  console.log(`[Worker] 📋 Contrat créé — ${missionTitle} — ${escrowAmount}€`);
  await notifications.contractCreatedToClient({
    missionTitle,
    freelancerName: freelancerId || "Freelancer",
    escrowAmount,
  });
  await notifications.contractCreatedToFreelancer({
    missionTitle,
    clientName: "Client",
    escrowAmount,
  });
}

async function handleContractCompleted(data: Record<string, unknown>): Promise<void> {
  const { contractId, missionTitle, totalAmount } = data as {
    contractId: string; missionTitle: string; totalAmount: number;
  };
  console.log(`[Worker] ✅ Contrat terminé: "${missionTitle}" (${contractId})`);
  console.log(`[Worker]   → Montant: ${totalAmount}€`);

  // Email demande d'avis
  await sendEmail({
    to: "client+freelancer@flexwork.app",
    subject: `✅ Mission terminée — ${missionTitle}`,
    html: EmailTemplates.contractCompleted({ missionTitle, totalAmount }).html,
  });
}

async function handlePaymentDeposit(data: Record<string, unknown>): Promise<void> {
  const { paymentId, contractId, amount } = data as {
    paymentId: string; contractId: string; amount: number;
  };
  console.log(`[Worker] 💰 Dépôt escrow (${paymentId})`);
  console.log(`[Worker]   → Contrat: ${contractId}, Montant: ${amount}€`);
  // TODO: Vérifier PaymentIntent Stripe, confirmer escrow
}

async function handlePaymentRelease(data: Record<string, unknown>): Promise<void> {
  const { paymentId, milestoneTitle, amount, contractId } = data as {
    paymentId: string; milestoneTitle: string; amount: number; contractId: string;
  };
  console.log(`[Worker] 🔓 Libération: "${milestoneTitle}" (${paymentId}) — ${amount}€`);
  await notifications.milestoneApprovedToFreelancer({
    milestoneTitle,
    missionTitle: `Contrat ${contractId}`,
    amount,
  });
}

async function handlePaymentPayout(data: Record<string, unknown>): Promise<void> {
  const { paymentId, amount, stripeAccountId } = data as {
    paymentId: string; amount: number; stripeAccountId: string;
  };
  console.log(`[Worker] 💸 Payout (${paymentId})`);
  console.log(`[Worker]   → Montant: ${amount}€, Compte: ${stripeAccountId}`);
  // TODO: Transfert Stripe Connect
}

async function handleMilestoneCompleted(data: Record<string, unknown>): Promise<void> {
  const { milestoneId, title, amount } = data as {
    milestoneId: string; title: string; amount: number;
  };
  console.log(`[Worker] 🏁 Milestone complété: "${title}" (${milestoneId})`);
  console.log(`[Worker]   → Montant: ${amount}€`);
}

// ── Nouveaux handlers pipeline ─────────────────

async function handleMissionQualified(data: Record<string, unknown>): Promise<void> {
  const { missionId: _mid, title, score, passed, warnings, suggestedSkills, suggestedBudget } = data as {
    missionId: string; title: string; score: number; passed: boolean; warnings: string[]; suggestedSkills: string[]; suggestedBudget: number | null;
  };
  console.log(`[Worker] 🤖 Qualification IA — "${title}"`);
  console.log(`[Worker]   → Score: ${score}/100 — ${passed ? "✅ Validé" : "❌ Rejeté"}`);
  if (warnings.length > 0) {
    console.log(`[Worker]   → Avertissements: ${warnings.join(", ")}`);
  }
  if (suggestedSkills.length > 0) {
    console.log(`[Worker]   → Compétences suggérées: ${suggestedSkills.join(", ")}`);
  }
  if (suggestedBudget) {
    console.log(`[Worker]   → Budget suggéré: ${suggestedBudget}€`);
  }
  // Si passé, on enchaîne automatiquement vers MISSION_PUBLISHED
  if (passed) {
    console.log(`[Worker]   → Publication automatique enclenchée`);
  }
}

async function handleMissionPublished(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, skills, budget } = data as {
    missionId: string; title: string; skills: string[]; budget: number;
  };
  console.log(`[Worker] 📢 Mission publiée: "${title}" (${missionId})`);
  void missionId;
  await notifications.newMissionBroadcast({ title, budget, skills });
  await notifications.missionPublishedToClient({ title, budget });
}

// ── Nouveaux handlers pipeline ─────────────────

async function handleMissionProposalsReceived(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, count } = data as {
    missionId: string; title: string; count: number;
  };
  void missionId;
  console.log(`[Worker] 📩 ${count} proposition(s) reçue(s) pour "${title}" (${missionId})`);
}

async function handleMissionFreelancerSelected(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, freelancerName } = data as {
    missionId: string; title: string; freelancerId: string; freelancerName: string;
  };
  void missionId;
  console.log(`[Worker] ✅ Freelance sélectionné: ${freelancerName} pour "${title}"`);
  await notifications.selectedForMissionToFreelancer({ freelancerName, missionTitle: title });
}

async function handleMissionFunded(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, amount, paymentIntentId } = data as {
    missionId: string; title: string; amount: number; paymentIntentId: string;
  };
  void missionId; void paymentIntentId;
  console.log(`[Worker] 💰 Mission financée: "${title}" — ${amount}€ en escrow`);
  await notifications.paymentDepositedToClient({ missionTitle: title, amount });
  const convFunded = conversations.find((c) => c.title.includes(title));
  if (convFunded) addSystemMessage(convFunded.id, `💰 Milestone financé — ${amount.toLocaleString()} € déposés en escrow.`);
}

async function handleMissionDelivered(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, contractId } = data as {
    missionId: string; title: string; contractId: string;
  };
  void contractId;
  console.log(`[Worker] 📦 Livrable soumis pour "${title}" (${missionId})`);
  void missionId;
  await notifications.deliverableReceivedToClient({ missionTitle: title });
  const convDelivered = conversations.find((c) => c.title.includes(title));
  if (convDelivered) addSystemMessage(convDelivered.id, "📦 Livrable soumis — en attente de validation.");
}

async function handleMissionApproved(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, contractId } = data as {
    missionId: string; title: string; contractId: string;
  };
  void missionId; void contractId;
  console.log(`[Worker] ✅ Mission approuvée: "${title}" — déclenchement paiement`);
  const convApproved = conversations.find((c) => c.title.includes(title));
  if (convApproved) addSystemMessage(convApproved.id, `✅ Mission approuvée — le paiement de ${title} est déclenché.`);
}

async function handleMissionPaid(data: Record<string, unknown>): Promise<void> {
  const { missionId, title, amount } = data as {
    missionId: string; title: string; amount: number;
  };
  void missionId;
  console.log(`[Worker] 💸 Mission payée: "${title}" — ${amount}€ versés`);
  await notifications.missionCompletedToBoth({ missionTitle: title, amount });
  await notifications.paymentReceivedToFreelancer({ missionTitle: title, amount });
  const convPaid = conversations.find((c) => c.title.includes(title));
  if (convPaid) addSystemMessage(convPaid.id, `💸 Paiement final — ${amount.toLocaleString()} € versés. Mission terminée ✅`);
}

async function handleContractEscrowCreated(data: Record<string, unknown>): Promise<void> {
  const { contractId, escrowId, missionTitle, amount } = data as {
    contractId: string; escrowId: string; missionTitle: string; amount: number;
  };
  console.log(`[Worker] 🔐 Escrow TrustEngine créé (${escrowId})`);
  console.log(`[Worker]   → Contrat: ${contractId}, Montant: ${amount}€`);
  console.log(`[Worker]   → Fonds sécurisés pour "${missionTitle}"`);
}

async function handleMilestoneSubmitted(data: Record<string, unknown>): Promise<void> {
  const { milestoneId, contractId, title } = data as {
    milestoneId: string; contractId: string; title: string;
  };
  void contractId;
  console.log(`[Worker] 📤 Milestone soumis: "${title}" (${milestoneId})`);
  console.log(`[Worker]   → En attente de validation client`);
}

async function handleMilestoneApproved(data: Record<string, unknown>): Promise<void> {
  const { milestoneId, contractId, title, amount } = data as {
    milestoneId: string; contractId: string; title: string; amount: number;
  };
  void contractId;
  console.log(`[Worker] ✅ Milestone approuvé: "${title}" (${milestoneId})`);
  console.log(`[Worker]   → Déclenchement libération de ${amount}€`);
}

async function handleMilestoneReleased(data: Record<string, unknown>): Promise<void> {
  const { milestoneId, contractId, title, amount } = data as {
    milestoneId: string; contractId: string; title: string; amount: number;
  };
  void milestoneId; void contractId;
  console.log(`[Worker] 💸 Milestone libéré: "${title}" — ${amount}€ vers le freelance`);
}

async function handleWebhookStripe(data: Record<string, unknown>): Promise<void> {
  const { eventType, eventId } = data as {
    eventType: string; eventId: string; data?: Record<string, unknown>;
  };
  console.log(`[Worker] 🔔 Webhook Stripe: ${eventType} (${eventId})`);

  switch (eventType) {
    case "payment_intent.succeeded": {
      // Capturer le PaymentIntent et passer la mission en FUNDED
      const piData = (data as { data?: { object?: { id?: string; metadata?: Record<string, string> } } }).data?.object;
      const paymentIntentId = piData?.id;
      const contractId = piData?.metadata?.contract_id;
      const missionId = piData?.metadata?.mission_id || "";
      const amount = Number(piData?.metadata?.amount || 0);

      if (!paymentIntentId) {
        console.error("[Worker] ❌ payment_intent.succeeded sans id");
        break;
      }

      console.log(`[Worker]   → Capture PaymentIntent ${paymentIntentId} (contrat: ${contractId})`);
      try {
        await stripeEscrow.capture(paymentIntentId);
        console.log(`[Worker]   ✅ Fonds capturés en escrow`);
      } catch (err) {
        console.error(`[Worker]   ❌ Erreur capture:`, (err as Error).message);
      }

      // Mettre à jour le contrat en mémoire
      if (contractId) {
        const contract = contracts.find((c) => c.id === contractId);
        if (contract) {
          (contract as Record<string, unknown>).status = "FUNDED";
        }
      }

      // Déclencher MISSION_FUNDED pour auto-transition workflow
      await enqueueJob("MISSION_FUNDED", {
        missionId,
        title: piData?.metadata?.mission_title || "Mission",
        amount,
        paymentIntentId,
      }).catch(() => {});

      break;
    }
    case "checkout.session.completed":
      console.log(`[Worker]   → Paiement Stripe confirmé`);
      break;
    case "account.updated":
      console.log(`[Worker]   → Compte Connect mis à jour`);
      break;
    case "payout.paid":
      console.log(`[Worker]   → Payout Stripe effectué`);
      break;
    default:
      console.log(`[Worker]   → Événement non géré: ${eventType}`);
  }
}

async function handleWebhookTrustEngine(data: Record<string, unknown>): Promise<void> {
  const { event, escrowId } = data as {
    event: string; escrowId: string;
  };
  console.log(`[Worker] 🔔 Webhook TrustEngine: ${event} (${escrowId})`);

  switch (event) {
    case "escrow.created":
      console.log(`[Worker]   → Escrow créé`);
      break;
    case "milestone.released":
      console.log(`[Worker]   → Milestone libéré`);
      break;
    case "dispute.opened":
      console.log(`[Worker]   → Litige ouvert`);
      break;
    case "dispute.resolved":
      console.log(`[Worker]   → Litige résolu`);
      break;
  }
}

async function handleNotificationEmail(data: Record<string, unknown>): Promise<void> {
  const { to, subject, template, templateData } = data as {
    to: string; subject: string; template: string; templateData?: Record<string, unknown>;
  };
  console.log(`[Worker] 📧 Email à ${to}: "${subject}" (template: ${template})`);

  // Utilise le template demandé ou envoie un email simple
  if (template && template in EmailTemplates && templateData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = EmailTemplates[template as keyof typeof EmailTemplates](templateData as any);
    await sendEmail({ to, subject: tpl.subject, html: tpl.html });
  } else {
    await sendEmail({ to, subject, html: `<p>${subject}</p><p>${JSON.stringify(templateData || {})}</p>` });
  }
}

// ============================================================
// Mapping : JobType → Handler
// ============================================================

const handlers: Record<string, (data: Record<string, unknown>) => Promise<void>> = {
  MISSION_CREATED: handleMissionCreated,
  MISSION_QUALIFIED: handleMissionQualified,
  MISSION_PUBLISHED: handleMissionPublished,
  MISSION_PROPOSALS_RECEIVED: handleMissionProposalsReceived,
  MISSION_FREELANCER_SELECTED: handleMissionFreelancerSelected,
  MISSION_FUNDED: handleMissionFunded,
  MISSION_DELIVERED: handleMissionDelivered,
  MISSION_APPROVED: handleMissionApproved,
  MISSION_PAID: handleMissionPaid,
  MISSION_UPDATED: handleMissionUpdated,
  APPLICATION_SUBMITTED: handleApplicationSubmitted,
  APPLICATION_ACCEPTED: handleApplicationAccepted,
  APPLICATION_VIEWED: handleApplicationViewed,
  CONTRACT_CREATED: handleContractCreated,
  CONTRACT_ESCROW_CREATED: handleContractEscrowCreated,
  CONTRACT_COMPLETED: handleContractCompleted,
  MILESTONE_SUBMITTED: handleMilestoneSubmitted,
  MILESTONE_APPROVED: handleMilestoneApproved,
  MILESTONE_RELEASED: handleMilestoneReleased,
  MILESTONE_COMPLETED: handleMilestoneCompleted,
  PAYMENT_DEPOSIT: handlePaymentDeposit,
  PAYMENT_RELEASE: handlePaymentRelease,
  PAYMENT_PAYOUT: handlePaymentPayout,
  WEBHOOK_STRIPE: handleWebhookStripe,
  WEBHOOK_TRUSTENGINE: handleWebhookTrustEngine,
  NOTIFICATION_EMAIL: handleNotificationEmail,
};

// ============================================================
// Création des workers BullMQ
// ============================================================

const queueNames: QueueName[] = ["missions", "applications", "contracts", "payments", "webhooks", "notifications"];

const workers: Worker[] = [];

function startWorkers(): void {
  for (const name of queueNames) {
    const worker = new Worker(
      name,
      async (job) => {
        const handler = handlers[job.name];
        if (handler) {
          console.log(`[Worker] 🔄 Traitement ${job.name} (${job.id})`);
          await handler(job.data as Record<string, unknown>);
          console.log(`[Worker] ✅ ${job.name} terminé (${job.id})`);
        } else {
          console.warn(`[Worker] ⚠️ Aucun handler pour ${job.name}`);
        }
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(getConnection() as any),
        concurrency: 5,
        lockDuration: 30000,
        stalledInterval: 15000,
      },
    );

    worker.on("failed", (job, err) => {
      console.error(`[Worker] ❌ ${job?.name} échoué (${job?.id}): ${err.message}`);
    });

    worker.on("completed", (job) => {
      console.log(`[Worker] ✅ ${job.name} complété (${job.id})`);
    });

    worker.on("error", (err) => {
      console.error(`[Worker] 🔴 Erreur worker "${name}":`, err.message);
    });

    workers.push(worker);
    console.log(`[Worker] 👷 Worker "${name}" démarré`);
  }

  console.log(`\n[Worker] ✅ ${workers.length} workers BullMQ actifs`);
  console.log(`[Worker] 📋 Queues: ${queueNames.join(", ")}`);
}

function stopWorkers(): void {
  for (const worker of workers) {
    worker.close();
  }
  workers.length = 0;
  console.log("[Worker] 🛑 Workers arrêtés");
}

// ============================================================
// Démarrage autonome (CLI)
// ============================================================

const isMainModule = process.argv[1]?.endsWith("workers.ts") || process.argv[1]?.includes("workers");

if (isMainModule) {
  console.log("=".repeat(60));
  console.log("  🏗️  Flexwork — Workers BullMQ");
  console.log("=".repeat(60));
  startWorkers();

  process.on("SIGTERM", () => {
    console.log("\n[Worker] 🛑 Arrêt demandé...");
    stopWorkers();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    console.log("\n[Worker] 🛑 Arrêt demandé...");
    stopWorkers();
    process.exit(0);
  });
}

export { startWorkers, stopWorkers };
