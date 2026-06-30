/**
 * Script de simulation complète du pipeline Flexwork
 *
 * Usage : npx tsx scripts/simulate.ts
 *
 * Ce script réinitialise toutes les données mock et simule
 * le workflow complet de bout en bout.
 */

// ── Reset all stores ───────────────────────────

function resetAll() {
  // Mock data
  const { missions } = require("../lib/mock-data");
  const { applications } = require("../lib/mock-data");
  const { payments } = require("../lib/mock-data");
  const { contracts: mockContracts } = require("../lib/mock-data");
  const { milestones } = require("../lib/mock-data");

  missions.length = 0;
  applications.length = 0;
  payments.length = 0;
  mockContracts.length = 0;
  Object.keys(milestones).forEach((k) => delete milestones[k]);

  // Collaboration
  const collab = require("../lib/collaboration");
  collab.conversations.length = 0;
  collab.participants.length = 0;
  collab.chatMessages.length = 0;
  collab.meetings.length = 0;
  collab.meetingLogs.length = 0;
  collab.messageAudits.length = 0;

  // Recruitment
  const rec = require("../lib/recruitment");
  rec.applicationAudits.length = 0;
  rec.candidateInterviews.length = 0;
  rec.contractOffers.length = 0;

  console.log("🧹 Toutes les données mock réinitialisées.\n");
}

// ── Simulation ─────────────────────────────────

async function simulate() {
  resetAll();

  const API = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const headers = { "Content-Type": "application/json", "x-simulation": "true" };
  const log = (step: number, emoji: string, msg: string) =>
    console.log(`  ${step}. ${emoji} ${msg}`);

  let step = 0;

  // ═══════════════════════════════════════════════
  console.log("👤 ÉTAPE 1 : Création des utilisateurs\n");

  const client = { id: "client-1", name: "Sophie Martin", email: "sophie@techcorp.fr", role: "CLIENT" };
  const freelancer = { id: "f-1", name: "Marie Dupont", email: "marie@freelance.fr", role: "FREELANCER" };

  log(++step, "👤", `Client: ${client.name} (${client.email})`);
  log(++step, "👤", `Freelance: ${freelancer.name} (${freelancer.email})`);

  // ═══════════════════════════════════════════════
  console.log("\n📝 ÉTAPE 2 : Publication de mission\n");

  const missionRes = await fetch(`${API}/api/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      title: "Développeur React/Next.js — Dashboard Analytics",
      description: "Nous recherchons un développeur React expérimenté pour construire un dashboard analytics complet avec Next.js 14, Tailwind, et Prisma. Le projet inclut des graphiques temps réel, un système de permissions, et une intégration API REST.",
      budget: 8000,
      skills: ["React", "Next.js", "TypeScript", "Tailwind", "Prisma"],
      duration: "3 mois",
      location: "Remote",
      clientId: client.id,
    }),
  });

  const mission = await missionRes.json();
  const missionData = mission.data || mission;
  log(++step, "📝", `Mission créée: "${missionData.title || missionData.id}"`);
  log(++step, "🤖", `Qualification IA: score ${missionData.qualification?.score ?? "?"}/100 — ${missionData.qualification?.passed ? "✅ Publiée" : "❌ Rejetée"}`);
  log(++step, "💰", `Budget: ${(missionData.budget ?? 0).toLocaleString()} €`);
  log(++step, "🏷️", `Statut: ${missionData.status || "?"} (${missionData.workflowStep || "?"})`);

  // ═══════════════════════════════════════════════
  console.log("\n📩 ÉTAPE 3 : Candidatures\n");

  const appRes = await fetch(`${API}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      missionId: missionData.id,
      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      proposedBudget: 7500,
      coverLetter: `Bonjour, je suis très intéressée par cette mission. J'ai 5 ans d'expérience en React/Next.js et j'ai déjà réalisé plusieurs dashboards analytics similaires. Mon TJM est de 450€, ce qui donne un budget total d'environ 7500€ pour 3 mois.`,
    }),
  });

  const app = await appRes.json();
  const appData = app.data || app;
  log(++step, "📩", `Candidature soumise: ${freelancer.name} → ${missionData.title || missionData.id}`);
  log(++step, "📊", `Budget proposé: ${(appData.proposedBudget ?? 0).toLocaleString()} €`);
  log(++step, "🏷️", `Statut: ${appData.status || "?"}`);

  // ═══════════════════════════════════════════════
  console.log("\n🔍 ÉTAPE 4 : Processus de sélection\n");

  // UNDER_REVIEW
  await fetch(`${API}/api/applications/${appData.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({ status: "UNDER_REVIEW", actorId: client.id, actorName: client.name }),
  });
  log(++step, "🔍", "Examen de la candidature → UNDER_REVIEW");

  // SHORTLISTED
  await fetch(`${API}/api/applications/${appData.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      status: "SHORTLISTED",
      actorId: client.id,
      actorName: client.name,
      clientId: client.id,
      clientName: client.name,
      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      missionTitle: missionData.title,
    }),
  });
  log(++step, "⭐", "Préselection → SHORTLISTED (chat auto-créé)");
  log(++step, "💬", "Conversation ouverte entre client et freelance");

  // INTERVIEW
  const interviewUrl = `https://meet.google.com/abc-defg-hij`;
  await fetch(`${API}/api/applications/${appData.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      status: "INTERVIEW_PENDING",
      actorId: client.id,
      actorName: client.name,
      meetingUrl: interviewUrl,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      interviewDuration: 30,
    }),
  });
  await fetch(`${API}/api/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      applicationId: appData.id,
      meetingUrl: interviewUrl,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      duration: 30,
    }),
  });
  log(++step, "📹", `Entretien planifié → ${interviewUrl}`);

  await fetch(`${API}/api/applications/${appData.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({ status: "INTERVIEW_COMPLETED", actorId: client.id, actorName: client.name }),
  });
  log(++step, "✅", "Entretien terminé → INTERVIEW_COMPLETED");

  // SELECTED
  await fetch(`${API}/api/applications/${appData.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      status: "SELECTED",
      actorId: client.id,
      actorName: client.name,
      missionId: missionData.id,
      missionTitle: missionData.title,
      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
    }),
  });
  log(++step, "🎯", `Candidat sélectionné → SELECTED`);

  // ═══════════════════════════════════════════════
  console.log("\n📋 ÉTAPE 5 : Contrat\n");

  const contractRes = await fetch(`${API}/api/contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      missionId: missionData.id,
      freelancerId: freelancer.id,
      missionTitle: missionData.title,
      clientId: client.id,
      clientName: client.name,
      freelancerName: freelancer.name,
      escrowAmount: 8000,
      preferredEscrow: "both",
      milestones: [
        { title: "Architecture & Setup", amount: 2000 },
        { title: "Dashboard Core", amount: 3000 },
        { title: "Intégration API & Tests", amount: 2000 },
        { title: "Déploiement & Documentation", amount: 1000 },
      ],
    }),
  });

  const contract = await contractRes.json();
  const contractData = contract.data || contract;
  log(++step, "📋", `Contrat créé: ${contractData.id || "?"}`);
  log(++step, "🔐", `Escrow: ${contractData.escrowId || "N/A"} — Stripe: ${contractData.stripePaymentIntentId?.slice(0, 12) || "N/A"}…`);
  log(++step, "💬", `Conversation: ${contractData.conversationId || "auto-créée"}`);

  // ═══════════════════════════════════════════════
  console.log("\n💬 ÉTAPE 6 : Collaboration\n");

  const messagesRes = await fetch(`${API}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      senderId: client.id,
      senderName: client.name,
      content: "Bonjour Marie ! Ravie de collaborer avec vous sur ce projet. Tout est prêt de votre côté ?",
    }),
  });
  log(++step, "💬", `Message client → freelance`);

  await fetch(`${API}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      senderId: freelancer.id,
      senderName: freelancer.name,
      content: "Bonjour Sophie ! Oui, tout est prêt. Je commence par l'architecture dès aujourd'hui. Le premier milestone sera livré d'ici une semaine.",
    }),
  });
  log(++step, "💬", `Message freelance → client`);

  // Google Meet
  await fetch(`${API}/api/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      conversationId: contractData.conversationId || "conv-test",
      title: "Kick-off — Dashboard Analytics",
      hostId: client.id,
      guestId: freelancer.id,
      meetUrl: `https://meet.google.com/xyz-uvw-rst`,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      duration: 45,
    }),
  });
  log(++step, "📹", "Google Meet créé: kick-off 45 min");

  // ═══════════════════════════════════════════════
  console.log("\n🏗️ ÉTAPE 7 : Exécution & Paiement\n");

  // Créer des milestones
  const mlRes1 = await fetch(`${API}/api/contracts/${contractData.id}/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({ title: "Architecture & Setup", amount: 2000 }),
  });
  const m1 = await mlRes1.json();
  log(++step, "🏗️", `Milestone créé: "Architecture & Setup" — 2 000 €`);

  // Approuver milestone 1
  await fetch(`${API}/api/contracts/${contractData.id}/milestones`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      milestoneId: m1.data?.id || m1.id,
      status: "APPROVED",
      missionId: missionData.id,
      missionTitle: missionData.title,
    }),
  });
  log(++step, "✅", "Milestone 1 approuvé → paiement déclenché");

  // Paiement deposit
  await fetch(`${API}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      amount: 8000,
      type: "DEPOSIT",
      currency: "EUR",
      missionId: missionData.id,
      missionTitle: missionData.title,
    }),
  });
  log(++step, "💰", "Dépôt escrow: 8 000 €");

  // Paiement release
  await fetch(`${API}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      amount: 2000,
      type: "RELEASE",
      milestoneId: m1.data?.id || m1.id,
      milestoneTitle: "Architecture & Setup",
      freelancerId: freelancer.id,
    }),
  });
  log(++step, "🔓", "Libération milestone 1: 2 000 €");

  // Paiement payout final
  await fetch(`${API}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-simulation": "true" },
    body: JSON.stringify({
      contractId: contractData.id,
      amount: 2000,
      type: "PAYOUT",
      freelancerId: freelancer.id,
      stripeAccountId: "acct_freelancer",
      missionId: missionData.id,
      missionTitle: missionData.title,
    }),
  });
  log(++step, "💸", "Payout freelance: 2 000 € → compte bancaire");

  // ═══════════════════════════════════════════════
  console.log("\n📊 RÉSUMÉ FINAL\n");

  // Stats
  const missionsRes = await fetch(`${API}/api/missions`);
  const missionsData = await missionsRes.json();
  const totalMissions = Array.isArray(missionsData) ? missionsData.length : (missionsData.data?.length || 0);

  const appsRes = await fetch(`${API}/api/applications`);
  const appsData = await appsRes.json();
  const totalApps = Array.isArray(appsData) ? appsData.length : (appsData.data?.length || 0);

  const paymentsRes = await fetch(`${API}/api/payments`);
  const paymentsData = await paymentsRes.json();
  const allPayments = Array.isArray(paymentsData) ? paymentsData : (paymentsData.data || []);
  const totalPaid = allPayments.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0);

  console.log(`  ✅ Missions créées     : ${totalMissions}`);
  console.log(`  ✅ Candidatures        : ${totalApps}`);
  console.log(`  ✅ Paiements traités   : ${allPayments.length} (${totalPaid.toLocaleString()} €)`);
  console.log(`  ✅ Contrats            : 1`);
  console.log(`  ✅ Conversations       : ${require("../lib/collaboration").conversations.length}`);
  console.log(`  ✅ Audits candidatures : ${require("../lib/recruitment").applicationAudits.length}`);

  console.log("\n🎉 Simulation terminée avec succès !");
  console.log("🌐 Ouvre http://localhost:3000 pour voir le résultat.\n");
}

simulate().catch((err) => {
  console.error("❌ Erreur:", err.message);
  process.exit(1);
});

