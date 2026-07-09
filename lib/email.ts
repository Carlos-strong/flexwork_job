/**
 * Service d'envoi d'emails via Mailpit (dev) / SMTP (prod)
 *
 * Architecture :
 *   Mailpit (dev) : SMTP port 1025 / Web UI port 8025
 *   Production    : SMTP relay (SendGrid, Mailgun, Resend, etc.)
 *
 * Utilisation :
 *   await sendEmail({ to, subject, html, text });
 *   await sendTemplateEmail("welcome", { name, email });
 */

import nodemailer from "nodemailer";

// ============================================================
// Configuration
// ============================================================

const config = {
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025,
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || "Flexwork <noreply@flexwork.app>",
  secure: process.env.SMTP_SECURE === "true",
};

// ============================================================
// Transporteur singleton
// ============================================================

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const needsAuth = config.user && config.pass;
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(needsAuth ? { auth: { user: config.user, pass: config.pass } } : {}),
      // Ignorer les erreurs TLS en dev (Mailpit utilise HTTP)
      tls: { rejectUnauthorized: false },
    });

    // Vérification silencieuse
    transporter.verify().then(() => {
      console.log(`[Email] 📬 Prêt — serveur SMTP ${config.host}:${config.port}`);
    }).catch((err) => {
      console.warn(`[Email] ⚠️ SMTP indisponible: ${err.message}`);
    });
  }
  return transporter;
}

// ============================================================
// Types
// ============================================================

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}

// ============================================================
// Envoi d'email
// ============================================================

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const info = await getTransporter().sendMail({
      from: config.from,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ""),
      attachments: payload.attachments,
    });

    console.log(`[Email] ✅ Envoyé à ${payload.to} — sujet: "${payload.subject}" (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error(`[Email] ❌ Échec pour ${payload.to}: ${message}`);
    return { success: false, error: message };
  }
}

// ============================================================
// Helpers : raccourcis par type d'email
// ============================================================

export const EmailTemplates = {
  /** Email d'activation du compte avec lien de vérification (24h) */
  emailVerification: (data: { name: string; verificationUrl: string }) => ({
    subject: "Activez votre compte Flexwork",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Bienvenue sur Flexwork 🎉</h1>
          <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Une dernière étape pour activer votre compte</p>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="font-size: 16px; line-height: 1.6;">Bonjour <strong>${data.name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Merci de vous être inscrit sur Flexwork. Pour finaliser la création de votre compte,
            cliquez sur le bouton ci-dessous :
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.verificationUrl}"
               style="display: inline-block; background: #6366f1; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; letter-spacing: 0.3px;">
              ✅ Activer mon compte
            </a>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280;">
              <strong>Lien valable 24 heures.</strong><br/>
              Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
            </p>
            <p style="margin: 12px 0 0; font-size: 12px; color: #9ca3af; word-break: break-all;">
              Lien de secours : <a href="${data.verificationUrl}" style="color: #6366f1;">${data.verificationUrl}</a>
            </p>
          </div>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          Flexwork — La plateforme qui connecte freelances et clients
        </p>
      </div>
    `,
  }),

  newApplication: (data: { clientName: string; missionTitle: string; freelancerName: string; proposedBudget: number }) => ({
    subject: `Nouvelle candidature — ${data.missionTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">📩 Nouvelle candidature</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p>Bonjour <strong>${data.clientName}</strong>,</p>
          <p><strong>${data.freelancerName}</strong> a postulé à votre mission <strong>${data.missionTitle}</strong>.</p>
          <p>Budget proposé : <strong>${data.proposedBudget.toLocaleString()} €</strong></p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/client/missions"
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Voir les candidatures
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  applicationAccepted: (data: { freelancerName: string; missionTitle: string; clientName: string }) => ({
    subject: `Candidature acceptée — ${data.missionTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">✅ Candidature acceptée</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p>Bonjour <strong>${data.freelancerName}</strong>,</p>
          <p>Félicitations ! <strong>${data.clientName}</strong> a accepté votre candidature pour la mission <strong>${data.missionTitle}</strong>.</p>
          <p>Le contrat va être créé sous peu. Vous recevrez un email avec les détails.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/freelancer"
               style="display: inline-block; background: #22c55e; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Accéder au workroom
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  contractCreated: (data: { missionTitle: string; freelancerName: string; clientName: string; escrowAmount: number }) => ({
    subject: `Contrat signé — ${data.missionTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">📋 Contrat créé</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p>Bonjour,</p>
          <p>Le contrat pour la mission <strong>${data.missionTitle}</strong> a été créé entre <strong>${data.clientName}</strong> et <strong>${data.freelancerName}</strong>.</p>
          <p>Montant séquestré : <strong>${data.escrowAmount.toLocaleString()} €</strong></p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/freelancer/contrat"
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Voir le contrat
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  milestoneReleased: (data: { milestoneTitle: string; missionTitle: string; amount: number }) => ({
    subject: `💰 Paiement libéré — ${data.milestoneTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">💰 Paiement libéré</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p>Bonjour,</p>
          <p>Le milestone <strong>${data.milestoneTitle}</strong> pour la mission <strong>${data.missionTitle}</strong> a été approuvé.</p>
          <p><strong>${data.amount.toLocaleString()} €</strong> ont été libérés et sont en cours de transfert.</p>
        </div>
      </div>
    `,
  }),

  missionCreated: (data: { title: string; budget: number; skills: string[] }) => ({
    subject: `🚀 Nouvelle mission : ${data.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">🚀 Nouvelle mission disponible</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <h3>${data.title}</h3>
          <p>Budget : <strong>${data.budget.toLocaleString()} €</strong></p>
          <p>Compétences : ${data.skills.map(s => `<span style="background: #e0e7ff; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${s}</span>`).join(" ")}</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/missions"
               style="display: inline-block; background: #f59e0b; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Voir la mission
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  missionPublished: (data: { title: string; budget: number; skills: string[] }) => ({
    subject: `📢 Nouvelle mission publiée : ${data.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">📢 Mission validée et publiée</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <h3>${data.title}</h3>
          <p>Budget : <strong>${data.budget.toLocaleString()} €</strong></p>
          <p>Compétences : ${data.skills.map(s => `<span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px; font-size: 14px;">${s}</span>`).join(" ")}</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/missions"
               style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
              Postuler maintenant
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  contractCompleted: (data: { missionTitle: string; totalAmount: number }) => ({
    subject: `✅ Mission terminée — ${data.missionTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0;">✅ Mission terminée</h2>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p>La mission <strong>${data.missionTitle}</strong> est terminée.</p>
          <p>Montant total : <strong>${data.totalAmount.toLocaleString()} €</strong></p>
          <p>N'oubliez pas de laisser un avis sur votre expérience !</p>
        </div>
      </div>
    `,
  }),

  /** Email de réinitialisation de mot de passe */
  passwordReset: (data: { name: string; resetUrl: string }) => ({
    subject: "Réinitialisation de votre mot de passe Flexwork",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Mot de passe oublié 🔑</h1>
          <p style="color: #fef3c7; margin: 8px 0 0; font-size: 14px;">Réinitialisation demandée</p>
        </div>
        <div style="padding: 32px; background: #f9fafb;">
          <p style="font-size: 16px; line-height: 1.6;">Bonjour${data.name ? ` <strong>${data.name}</strong>` : ""},</p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.resetUrl}"
               style="display: inline-block; background: #f59e0b; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; letter-spacing: 0.3px;">
              🔑 Réinitialiser mon mot de passe
            </a>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280;">
              <strong>Lien valable 1 heure.</strong><br/>
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe actuel reste inchangé.
            </p>
            <p style="margin: 12px 0 0; font-size: 12px; color: #9ca3af; word-break: break-all;">
              Lien de secours : <a href="${data.resetUrl}" style="color: #6366f1;">${data.resetUrl}</a>
            </p>
          </div>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          Flexwork — La plateforme qui connecte freelances et clients
        </p>
      </div>
    `,
  }),

  /** Candidature consultée → confirmation au freelancer */
  applicationViewed: (data: {
    freelancerName: string;
    missionTitle: string;
    clientName: string;
    applicationUrl?: string;
  }) => ({
    subject: `👀 Votre candidature a été consultée — ${data.missionTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2D5BE3, #4f6fe8); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">👀 Candidature consultée</h1>
          <p style="color: #c7d7ff; margin: 8px 0 0; font-size: 14px;">Un client a regardé votre profil</p>
        </div>
        <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; line-height: 1.6;">Bonjour <strong>${data.freelancerName}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #374151;">
            Bonne nouvelle ! <strong>${data.clientName}</strong> vient de consulter votre candidature
            pour la mission <strong>« ${data.missionTitle} »</strong>.
          </p>
          <div style="background: #EEF2FD; border-left: 4px solid #2D5BE3; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
              💡 <strong>Conseil :</strong> Le client examine votre profil avec attention.
              C'est le moment de vous assurer que votre présentation et vos tarifs sont à jour.
            </p>
          </div>
          ${data.applicationUrl ? `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${data.applicationUrl}"
               style="display: inline-block; background: #2D5BE3; color: white; padding: 13px 32px;
                      border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Voir ma candidature →
            </a>
          </div>
          ` : ""}
          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            Restez disponible — une réponse du client pourrait arriver prochainement.
          </p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
          Flexwork — La plateforme qui connecte freelances et clients
        </p>
      </div>
    `,
  }),
};

export type TemplateName = keyof typeof EmailTemplates;
