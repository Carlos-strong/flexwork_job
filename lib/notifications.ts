/**
 * Service de notifications — centralise tous les envois d'emails
 *
 * Chaque événement du workflow déclenche une notification adaptée
 * au destinataire (client, freelance, ou les deux).
 *
 * Configuration : .env.local → SMTP_HOST / SMTP_PORT
 * Visualisation : Mailpit → http://localhost:8025
 */

import { sendEmail, EmailTemplates } from "./email";

// ── Destinataires de test (Mailpit) ────────────

const TEST_EMAILS = {
  client: process.env.NOTIFY_CLIENT_EMAIL || "client@flexwork.test",
  freelancer: process.env.NOTIFY_FREELANCER_EMAIL || "freelance@flexwork.test",
  admin: process.env.NOTIFY_ADMIN_EMAIL || "admin@flexwork.test",
};

// ── API publique ───────────────────────────────

export const notifications = {
  // ═══ CLIENT ═══════════════════════════════════

  /** Mission créée → confirmation au client */
  async missionCreatedToClient(params: { title: string; budget: number; skills: string[]; score?: number }) {
    const score = params.score ? ` (Score IA: ${params.score}/100)` : "";
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `✅ Mission créée : ${params.title}${score}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">✅ Mission créée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <h3>${params.title}</h3>
            <p>Budget : <strong>${params.budget.toLocaleString()} €</strong></p>
            <p>Compétences : ${params.skills.map(s => `<span style="background:#e0e7ff;padding:2px 8px;border-radius:4px;font-size:14px">${s}</span>`).join(" ")}</p>
            ${params.score !== undefined ? `<p>Score de qualification IA : <strong>${params.score}/100</strong></p>` : ""}
            <p style="color:#6b7280;font-size:14px">Votre mission est en cours de validation par notre IA. Vous serez notifié dès sa publication.</p>
          </div>
        </div>
      `,
    });
  },

  /** Mission publiée → notification au client */
  async missionPublishedToClient(params: { title: string; budget: number }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `📢 Mission publiée : ${params.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📢 Mission publiée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Votre mission <strong>${params.title}</strong> a été validée et publiée.</p>
            <p>Budget : <strong>${params.budget.toLocaleString()} €</strong></p>
            <p>Les freelances peuvent maintenant postuler. Vous recevrez une notification pour chaque candidature.</p>
          </div>
        </div>
      `,
    });
  },

  /** Nouvelle candidature → notification au client */
  async newApplicationToClient(params: { missionTitle: string; freelancerName: string; proposedBudget: number }) {
    const tpl = EmailTemplates.newApplication({
      clientName: "Client",
      missionTitle: params.missionTitle,
      freelancerName: params.freelancerName,
      proposedBudget: params.proposedBudget,
    });
    await sendEmail({ to: TEST_EMAILS.client, ...tpl });
  },

  /** Contrat créé → notification au client */
  async contractCreatedToClient(params: { missionTitle: string; freelancerName: string; escrowAmount: number }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `📋 Contrat créé — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📋 Contrat créé</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Le contrat pour <strong>${params.missionTitle}</strong> a été créé avec <strong>${params.freelancerName}</strong>.</p>
            <p>Montant séquestré : <strong>${params.escrowAmount.toLocaleString()} €</strong></p>
            <p>Les fonds sont sécurisés. Le travail peut commencer.</p>
          </div>
        </div>
      `,
    });
  },

  /** Paiement reçu → notification au client */
  async paymentDepositedToClient(params: { missionTitle: string; amount: number }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `💰 Paiement reçu — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">💰 Paiement confirmé</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Votre paiement de <strong>${params.amount.toLocaleString()} €</strong> pour <strong>${params.missionTitle}</strong> a été reçu.</p>
            <p>Les fonds sont maintenant en escrow et seront libérés au fur et à mesure de l'avancement.</p>
          </div>
        </div>
      `,
    });
  },

  /** Livrable reçu → notification au client */
  async deliverableReceivedToClient(params: { missionTitle: string }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `📦 Livrable reçu — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📦 Livrable soumis</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Un livrable a été soumis pour <strong>${params.missionTitle}</strong>.</p>
            <p>Veuillez le vérifier et l'approuver pour déclencher le paiement.</p>
          </div>
        </div>
      `,
    });
  },

  /** Mission terminée → notification aux deux parties */
  async missionCompletedToBoth(params: { missionTitle: string; amount: number }) {
    const tpl = EmailTemplates.contractCompleted({
      missionTitle: params.missionTitle,
      totalAmount: params.amount,
    });
    await sendEmail({ to: `${TEST_EMAILS.client},${TEST_EMAILS.freelancer}`, ...tpl });
  },

  // ═══ FREELANCE ════════════════════════════════

  /** Candidature acceptée → notification au freelance */
  async applicationAcceptedToFreelancer(params: { freelancerName: string; missionTitle: string; clientName: string }) {
    const tpl = EmailTemplates.applicationAccepted(params);
    await sendEmail({ to: TEST_EMAILS.freelancer, ...tpl });
  },

  /** Sélectionné pour une mission → notification au freelance */
  async selectedForMissionToFreelancer(params: { freelancerName: string; missionTitle: string }) {
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `🎉 Vous avez été sélectionné — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">🎉 Félicitations !</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.freelancerName}</strong>,</p>
            <p>Vous avez été sélectionné pour la mission <strong>${params.missionTitle}</strong>.</p>
            <p>Un contrat va être créé. Vous recevrez les détails sous peu.</p>
          </div>
        </div>
      `,
    });
  },

  /** Contrat signé → notification au freelance */
  async contractCreatedToFreelancer(params: { missionTitle: string; clientName: string; escrowAmount: number }) {
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `📋 Nouveau contrat — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📋 Nouveau contrat</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Un contrat a été créé pour <strong>${params.missionTitle}</strong> avec <strong>${params.clientName}</strong>.</p>
            <p>Montant : <strong>${params.escrowAmount.toLocaleString()} €</strong></p>
            <p>Les fonds sont sécurisés en escrow. Vous pouvez commencer à travailler.</p>
          </div>
        </div>
      `,
    });
  },

  /** Milestone approuvé → notification au freelance */
  async milestoneApprovedToFreelancer(params: { milestoneTitle: string; missionTitle: string; amount: number }) {
    const tpl = EmailTemplates.milestoneReleased({
      milestoneTitle: params.milestoneTitle,
      missionTitle: params.missionTitle,
      amount: params.amount,
    });
    await sendEmail({ to: TEST_EMAILS.freelancer, ...tpl });
  },

  /** Paiement final → notification au freelance */
  async paymentReceivedToFreelancer(params: { missionTitle: string; amount: number }) {
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `💸 Paiement reçu — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">💸 Paiement reçu</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p><strong>${params.amount.toLocaleString()} €</strong> ont été versés sur votre compte pour la mission <strong>${params.missionTitle}</strong>.</p>
          </div>
        </div>
      `,
    });
  },

  // ═══ COMMUN ═══════════════════════════════════

  /** Email d'activation du compte — envoyé après inscription */
  async sendEmailVerification(data: { name: string; email: string; verificationUrl: string }) {
    const tpl = EmailTemplates.emailVerification({ name: data.name, verificationUrl: data.verificationUrl });
    await sendEmail({ to: data.email, ...tpl });
  },

  /** Nouvelle mission disponible (broadcast freelances) */
  async newMissionBroadcast(params: { title: string; budget: number; skills: string[] }) {
    const tpl = EmailTemplates.missionPublished(params);
    await sendEmail({ to: TEST_EMAILS.freelancer, ...tpl });
  },

  // ═══ ADMIN ════════════════════════════════════

  /** Nouvel utilisateur inscrit → notification à l'admin */
  async userRegistered(params: { name: string; email: string; role: string }) {
    await sendEmail({
      to: TEST_EMAILS.admin,
      subject: `👤 Nouvel inscrit : ${params.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">👤 Nouvel utilisateur</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Un nouvel utilisateur vient de s&apos;inscrire sur Flexwork :</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Nom</td><td style="padding:8px 12px">${params.name}</td></tr>
              <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Email</td><td style="padding:8px 12px">${params.email}</td></tr>
              <tr><td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Rôle</td><td style="padding:8px 12px">${params.role}</td></tr>
            </table>
            <p style="margin-top:16px;color:#6b7280;font-size:14px">
              Rendez-vous dans l&apos;admin pour valider son compte si nécessaire.
            </p>
          </div>
        </div>
      `,
    });
  },

  // ═══ OFFRES — NOTIFICATIONS MANQUANTES ═══════

  /** Offre envoyée → notification au freelance */
  async offerSentToFreelancer(params: {
    freelanceName: string; missionTitle: string; offerTitle: string;
    totalBudget?: number; clientName: string; expiresAt?: string;
  }) {
    const budget = params.totalBudget
      ? `<p>Montant : <strong>${params.totalBudget.toLocaleString()} €</strong></p>`
      : "";
    const expires = params.expiresAt
      ? `<p>Expire le : <strong>${new Date(params.expiresAt).toLocaleDateString("fr-FR")}</strong></p>`
      : "";
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `📨 Nouvelle offre — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📨 Nouvelle offre reçue</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.freelanceName}</strong>,</p>
            <p><strong>${params.clientName}</strong> vous a envoyé une offre pour la mission <strong>${params.missionTitle}</strong>.</p>
            <p>Offre : <strong>${params.offerTitle}</strong></p>
            ${budget}
            ${expires}
            <p style="color:#6b7280;font-size:14px">Connectez-vous pour accepter, refuser ou négocier cette offre.</p>
          </div>
        </div>
      `,
    });
  },

  /** Offre acceptée par le freelance → notification au client (contrat créé) */
  async offerAcceptedToClient(params: {
    missionTitle: string; freelancerName: string; totalBudget: number; contractId: string;
  }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `✅ Offre acceptée — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">✅ Offre acceptée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p><strong>${params.freelancerName}</strong> a accepté votre offre pour <strong>${params.missionTitle}</strong>.</p>
            <p>Montant : <strong>${params.totalBudget.toLocaleString()} €</strong></p>
            <p>Le contrat a été créé automatiquement et les fonds sont sécurisés en escrow.</p>
            <p>Rendez-vous dans votre tableau de bord pour suivre l'avancement.</p>
          </div>
        </div>
      `,
    });
  },

  /** Offre refusée par le freelance → notification au client */
  async offerDeclinedToClient(params: {
    missionTitle: string; freelancerName: string; reason?: string;
  }) {
    const reasonHtml = params.reason
      ? `<p>Motif : <em>« ${params.reason} »</em></p>`
      : "";
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `❌ Offre refusée — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">❌ Offre refusée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p><strong>${params.freelancerName}</strong> a refusé votre offre pour <strong>${params.missionTitle}</strong>.</p>
            ${reasonHtml}
            <p style="color:#6b7280;font-size:14px">Vous pouvez consulter d'autres candidatures pour cette mission.</p>
          </div>
        </div>
      `,
    });
  },

  /** Contre-proposition reçue → notification à l'autre partie */
  async counterOfferReceived(params: {
    recipientName: string; actorLabel: string; missionTitle: string;
    offerTitle: string; roundsLeft: number; note?: string;
  }) {
    const noteHtml = params.note
      ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;font-style:italic">« ${params.note} »</p>`
      : "";
    const warning = params.roundsLeft <= 1
      ? `<p style="color:#dc2626;font-weight:600">⚠️ Attention : il reste ${params.roundsLeft} tentative(s) de négociation avant refus automatique.</p>`
      : `<p style="color:#6b7280">Il reste ${params.roundsLeft} tentative(s) de négociation.</p>`;
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `🔄 Contre-proposition — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">🔄 Contre-proposition reçue</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.recipientName}</strong>,</p>
            <p><strong>${params.actorLabel}</strong> a proposé des modifications à l'offre <strong>${params.offerTitle}</strong> pour la mission <strong>${params.missionTitle}</strong>.</p>
            ${noteHtml}
            ${warning}
            <p style="color:#6b7280;font-size:14px">Connectez-vous pour accepter, refuser ou contre-proposer à votre tour.</p>
          </div>
        </div>
      `,
    });
  },

  /** Avertissement de fin de négociation */
  async negotiationWarning(params: {
    recipientName: string; missionTitle: string; roundsLeft: number; isLast: boolean;
  }) {
    const subject = params.isLast
      ? `⚠️ Dernière tentative de négociation — ${params.missionTitle}`
      : `⚠️ Négociation — ${params.missionTitle} (${params.roundsLeft} tentative(s) restante(s))`;
    const message = params.isLast
      ? `<p style="color:#dc2626;font-weight:600">Ceci est la dernière tentative de négociation autorisée. Toute nouvelle contre-proposition entraînera un refus automatique de l'offre.</p>`
      : `<p>Il reste <strong>${params.roundsLeft} tentative(s)</strong> de négociation avant refus automatique de l'offre.</p>`;
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">⚠️ Limite de négociation</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.recipientName}</strong>,</p>
            <p>Concernant la mission <strong>${params.missionTitle}</strong> :</p>
            ${message}
            <p style="color:#6b7280;font-size:14px">Nous vous invitons à accepter ou refuser l'offre pour finaliser la collaboration.</p>
          </div>
        </div>
      `,
    });
  },

  /** Offre expirée → notification aux deux parties */
  async offerExpired(params: {
    recipientName: string; missionTitle: string; offerTitle: string; role: string;
  }) {
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `⏰ Offre expirée — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6b7280,#4b5563);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">⏰ Offre expirée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.recipientName}</strong>,</p>
            <p>L'offre <strong>${params.offerTitle}</strong> pour la mission <strong>${params.missionTitle}</strong> a expiré.</p>
            ${params.role === "CLIENT"
              ? `<p>Le freelance n'a pas répondu dans le délai imparti. Vous pouvez contacter d'autres candidats.</p>`
              : `<p>Le délai de réponse est dépassé. Contactez le client si vous êtes toujours intéressé.</p>`}
          </div>
        </div>
      `,
    });
  },

  /** Offre retirée par le client → notification au freelance */
  async offerWithdrawnToFreelancer(params: {
    freelanceName: string; missionTitle: string; offerTitle: string; reason?: string;
  }) {
    const reasonHtml = params.reason
      ? `<p>Motif : <em>« ${params.reason} »</em></p>`
      : "";
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `↩️ Offre retirée — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#6b7280,#4b5563);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">↩️ Offre retirée</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Bonjour <strong>${params.freelanceName}</strong>,</p>
            <p>L'offre <strong>${params.offerTitle}</strong> pour <strong>${params.missionTitle}</strong> a été retirée par le client.</p>
            ${reasonHtml}
            <p style="color:#6b7280;font-size:14px">Vous pouvez continuer à postuler à d'autres missions.</p>
          </div>
        </div>
      `,
    });
  },

  // ═══ CONTRATS — NOTIFICATIONS MANQUANTES ═════

  /** Contrat passé en ACTIF (escrow créé) → notification aux deux parties */
  async contractActivated(params: {
    missionTitle: string; clientName: string; freelancerName: string; escrowAmount: number;
  }) {
    const html = (toName: string, counterparty: string) => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0">🚀 Contrat actif</h2>
        </div>
        <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
          <p>Bonjour <strong>${toName}</strong>,</p>
          <p>Votre contrat pour <strong>${params.missionTitle}</strong> avec <strong>${counterparty}</strong> est désormais actif.</p>
          <p>Montant séquestré : <strong>${params.escrowAmount.toLocaleString()} €</strong></p>
          <p>Les fonds sont sécurisés. L'espace de travail est disponible.</p>
        </div>
      </div>`;
    await sendEmail({ to: TEST_EMAILS.client, subject: `🚀 Contrat actif — ${params.missionTitle}`, html: html(params.clientName, params.freelancerName) });
    await sendEmail({ to: TEST_EMAILS.freelancer, subject: `🚀 Contrat actif — ${params.missionTitle}`, html: html(params.freelancerName, params.clientName) });
  },

  /** Jalon soumis pour révision → notification au client */
  async milestoneInReviewToClient(params: {
    missionTitle: string; milestoneTitle: string; amount: number; freelancerName: string;
  }) {
    await sendEmail({
      to: TEST_EMAILS.client,
      subject: `📋 Jalon soumis — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">📋 Jalon soumis pour révision</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p><strong>${params.freelancerName}</strong> a soumis le jalon <strong>${params.milestoneTitle}</strong> pour la mission <strong>${params.missionTitle}</strong>.</p>
            <p>Montant du jalon : <strong>${params.amount.toLocaleString()} €</strong></p>
            <p>Connectez-vous pour vérifier et approuver le livrable afin de déclencher le paiement.</p>
          </div>
        </div>
      `,
    });
  },

  /** Jalon approuvé → notification au freelance (déjà défini plus haut) */

  /** Jalon rejeté → notification au freelance */
  async milestoneRejectedToFreelancer(params: {
    missionTitle: string; milestoneTitle: string; reason?: string;
  }) {
    const reasonHtml = params.reason
      ? `<p>Raison : <em>« ${params.reason} »</em></p>`
      : "";
    await sendEmail({
      to: TEST_EMAILS.freelancer,
      subject: `❌ Jalon rejeté — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">❌ Jalon rejeté</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Le jalon <strong>${params.milestoneTitle}</strong> pour <strong>${params.missionTitle}</strong> a été rejeté.</p>
            ${reasonHtml}
            <p>Connectez-vous pour apporter les corrections nécessaires et soumettre à nouveau.</p>
          </div>
        </div>
      `,
    });
  },

  /** Contrat terminé → notification aux deux parties */
  async contractCompleted(params: {
    missionTitle: string; clientName: string; freelancerName: string; totalAmount: number;
  }) {
    const html = (toName: string, role: string) => `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0">🏁 Contrat terminé</h2>
        </div>
        <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
          <p>Bonjour <strong>${toName}</strong>,</p>
          <p>Le contrat pour <strong>${params.missionTitle}</strong> est terminé.</p>
          <p>Montant total : <strong>${params.totalAmount.toLocaleString()} €</strong></p>
          ${role === "client"
            ? `<p>Merci d'avoir collaboré avec <strong>${params.freelancerName}</strong>. N'hésitez pas à laisser un avis.</p>`
            : `<p>Merci d'avoir travaillé avec <strong>${params.clientName}</strong>. N'hésitez pas à laisser un avis.</p>`}
        </div>
      </div>`;
    await sendEmail({ to: TEST_EMAILS.client, subject: `🏁 Contrat terminé — ${params.missionTitle}`, html: html(params.clientName, "client") });
    await sendEmail({ to: TEST_EMAILS.freelancer, subject: `🏁 Contrat terminé — ${params.missionTitle}`, html: html(params.freelancerName, "freelancer") });
  },

  /** Litige ouvert → notification aux deux parties */
  async contractDisputed(params: {
    missionTitle: string; openedBy: string; reason: string;
  }) {
    await sendEmail({
      to: `${TEST_EMAILS.client},${TEST_EMAILS.freelancer}`,
      subject: `⚠️ Litige ouvert — ${params.missionTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h2 style="color:#fff;margin:0">⚠️ Litige ouvert</h2>
          </div>
          <div style="padding:32px;background:#f9fafb;border-radius:0 0 12px 12px">
            <p>Un litige a été ouvert par <strong>${params.openedBy}</strong> pour le contrat <strong>${params.missionTitle}</strong>.</p>
            <p style="background:#fef2f2;padding:12px;border-radius:8px">Motif : « ${params.reason} »</p>
            <p>Un administrateur va prendre en charge votre dossier sous peu.</p>
          </div>
        </div>
      `,
    });
  },
};
