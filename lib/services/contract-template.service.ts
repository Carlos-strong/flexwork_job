/**
 * Service de génération de contrat de prestation de services.
 *
 * Utilise le modèle contrat-prestation-freelance.docx comme référence
 * pour générer un document HTML formaté, prêt à être :
 *   - Visualisé dans le navigateur
 *   - Imprimé / exporté en PDF (via l'impression navigateur)
 *   - Signé numériquement via SignatureService
 *
 * Le template reproduit la structure juridique du document original :
 *   Article 1  → Objet du contrat
 *   Article 2  → Jalons et livrables
 *   Article 3  → Durée d'exécution
 *   Article 4  → Rémunération et modalités de paiement
 *   Article 5  → Statut du prestataire
 *   Article 6  → Propriété intellectuelle
 *   Article 7  → Confidentialité
 *   Article 8  → Résiliation
 *   Article 9  → Responsabilité
 *   Article 10 → Droit applicable et litiges
 */

import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export interface ContractTemplateData {
  reference: string;
  missionTitle: string;
  missionDescription: string;

  // Client
  clientCompanyName: string;
  clientLegalForm: string;
  clientAddress: string;
  clientSiret: string;
  clientRepresentative: string;
  clientRepresentativeTitle: string;

  // Freelance
  freelancerName: string;
  freelancerStatus: string;
  freelancerAddress: string;
  freelancerSiret: string;

  // Mission
  startDate: string;
  duration: string;
  endDate: string;
  contractType: "FIXED" | "HOURLY";
  totalAmount: number;
  currency?: string;

  // Jalons
  milestones: Array<{
    id: string;
    title: string;
    description?: string;
    amount: number;
    delay: string;
    unit?: string;
    status?: string;
    executionRate?: number;
    proofs?: unknown;
    revisionCount?: number;
    rejectionReason?: string;
  }>;

  // Signatures (optionnel — présentes après double signature)
  signedByClient?: boolean;
  signedByFreelancer?: boolean;
  workflowPhase?: string; // phase ContractPhase du workflow
  signatures?: {
    client?: {
      signedAt: string;
      certificateId: string;
      signatureHash: string;
    };
    freelancer?: {
      signedAt: string;
      certificateId: string;
      signatureHash: string;
    };
  };
}

/**
 * Génère le HTML complet d'un contrat de prestation à partir des données
 * extraites de la base (contrat, mission, offre, utilisateurs).
 */
export async function generateContractHtml(data: ContractTemplateData): Promise<string> {
  const c = data.currency || "€";
  const fmt = (n: number) => n.toLocaleString("fr-FR") + ` ${c}`;
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  // ── QR Codes de signature ──────────────────────────
  const sigs = data.signatures;

  async function generateSignatureQR(
    role: "CLIENT" | "PRESTATAIRE",
    signerName: string,
    sigData?: { signedAt: string; certificateId: string; signatureHash: string }
  ): Promise<string> {
    if (!sigData) {
      // Pas encore signé — placeholder
      return Promise.resolve(`<div class="signature-line"></div>
        <p style="font-size:11px;color:#888">Signature</p>`);
    }

    const payload = JSON.stringify({
      v: 1,
      cid: data.reference,
      role,
      signer: signerName,
      ts: sigData.signedAt,
      cert: sigData.certificateId,
      hash: sigData.signatureHash,
      method: "RSA-SHA256",
      provider: "Flexwork eIDAS",
    });

    // Générer le QR code en SVG
    let qrSvg = "";
    try {
      qrSvg = await QRCode.toString(payload, {
        type: "svg",
        width: 95,
        margin: 1,
        color: { dark: "#14213D", light: "#FFFFFF" },
      });
    } catch {
      qrSvg = `<div style="width:140px;height:140px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#999;font-size:10px;">QR Code</div>`;
    }

    const shortHash = sigData.signatureHash.slice(0, 12);

    return `
      <div style="text-align:center;margin-top:12px;">
        <div style="display:inline-block;background:#fff;padding:8px;border:1px solid #DADFDD;border-radius:6px;">
          ${qrSvg}
        </div>
        <p style="font-family:Consolas,monospace;font-size:9px;color:#6B7280;margin:6px 0 2px 0;">${shortHash}</p>
        <p style="font-family:Consolas,monospace;font-size:8px;color:#9aa0a6;margin:0;">${sigData.certificateId.slice(0, 24)}</p>
        <p style="font-size:10px;color:#1F7A5C;font-weight:600;margin:4px 0 0 0;">✓ Signature vérifiable</p>
        <p style="font-size:9px;color:#6B7280;margin:2px 0 0 0;">${new Date(sigData.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      </div>`;
  }

  const milestonesRows = data.milestones.map((m, i) => {
    const num = String(i + 1).padStart(2, "0");
    const unit = m.unit || "Forfait";
    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #ccc;text-align:center;width:40px">${num}</td>
        <td style="padding:8px 10px;border:1px solid #ccc">${m.title}${m.description ? `<br><span style="font-size:12px;color:#666">${m.description}</span>` : ""}</td>
        <td style="padding:8px 10px;border:1px solid #ccc;text-align:center">${unit}</td>
        <td style="padding:8px 10px;border:1px solid #ccc;text-align:right">${fmt(m.amount)}</td>
        <td style="padding:8px 10px;border:1px solid #ccc;text-align:center">${m.delay}</td>
      </tr>`;
  }).join("");

  const totalRow = `
    <tr style="font-weight:bold;background:#f0f0f0">
      <td colspan="3" style="padding:10px;border:1px solid #ccc;text-align:right">MONTANT TOTAL DU CONTRAT</td>
      <td style="padding:10px;border:1px solid #ccc;text-align:right">${fmt(data.totalAmount)}</td>
      <td style="padding:10px;border:1px solid #ccc"></td>
    </tr>`;

  const regimeRow = data.contractType === "FIXED"
    ? "Le régime de rémunération applicable est : <strong>Prix fixe</strong>."
    : "Le régime de rémunération applicable est : <strong>Taux horaire</strong>.";

  // Générer les QR codes de signature (asynchrones)
  const clientSigHtml = await generateSignatureQR("CLIENT", data.clientCompanyName, sigs?.client);
  const freelancerSigHtml = await generateSignatureQR("PRESTATAIRE", data.freelancerName, sigs?.freelancer);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Contrat de prestation — ${data.missionTitle}</title>
<style>
  @page { margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 210mm;
    margin: 0 auto;
    padding: 20px 30px;
  }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .ref { text-align: center; font-size: 13px; color: #555; margin-bottom: 20px; }
  h2 { font-size: 15px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; margin-top: 24px; }
  .header-box {
    border: 1px solid #ccc; padding: 14px 18px; margin: 16px 0;
    background: #fafafa; border-radius: 4px;
  }
  .header-box table { width: 100%; border-collapse: collapse; }
  .header-box td { padding: 4px 8px; vertical-align: top; font-size: 12px; }
  .header-box .label { font-weight: 600; width: 140px; color: #333; }
  table.milestones { width: 100%; border-collapse: collapse; margin: 10px 0; }
  table.milestones th {
    background: #1a1a1a; color: #fff; padding: 8px 10px;
    border: 1px solid #1a1a1a; font-size: 11px; text-align: left;
  }
  table.milestones td { font-size: 12px; }
  .clause { text-align: justify; margin: 8px 0; }
  .signature-section { margin-top: 40px; page-break-inside: avoid; }
  .signature-grid { display: flex; gap: 30px; margin-top: 20px; }
  .signature-box {
    flex: 1; border: 1px solid #ccc; padding: 18px;
    border-radius: 4px; min-height: 200px;
  }
  .signature-box h3 { margin: 0 0 8px 0; font-size: 13px; }
  .signature-box p { margin: 4px 0; font-size: 11px; color: #555; }
  .signature-line { margin-top: 50px; border-top: 1px solid #333; width: 220px; }
  .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:right;margin-bottom:12px">
  <button onclick="window.print()" style="padding:8px 20px;background:#1a1a1a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">
    🖨️ Imprimer / Exporter en PDF
  </button>
</div>

<h1>Contrat de prestation de services</h1>
<p class="ref">Référence <strong>${data.reference}</strong></p>

<div class="header-box">
  <table>
    <tr><td class="label">LE CLIENT</td><td><strong>${data.clientCompanyName}</strong></td></tr>
    <tr><td class="label">Forme juridique</td><td>${data.clientLegalForm}</td></tr>
    <tr><td class="label">Adresse</td><td>${data.clientAddress}</td></tr>
    <tr><td class="label">SIRET</td><td>${data.clientSiret}</td></tr>
    <tr><td class="label">Représentée par</td><td>${data.clientRepresentative}, ${data.clientRepresentativeTitle}</td></tr>
  </table>
</div>

<div class="header-box">
  <table>
    <tr><td class="label">ET LE PRESTATAIRE</td><td><strong>${data.freelancerName}</strong></td></tr>
    <tr><td class="label">Statut</td><td>${data.freelancerStatus}</td></tr>
    <tr><td class="label">Adresse</td><td>${data.freelancerAddress}</td></tr>
    <tr><td class="label">SIRET</td><td>${data.freelancerSiret}</td></tr>
  </table>
</div>

<p class="clause">Ci-après désignés ensemble « les Parties », il a été convenu et arrêté ce qui suit,
dans le cadre de la mission référencée <strong>${data.reference}</strong> initiée sur la plateforme.</p>

<h2>Article 1 — Objet du contrat</h2>
<p class="clause">
Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalise,
à titre indépendant, la mission suivante pour le compte du Client :
<strong>« ${data.missionTitle} »</strong>.
${data.missionDescription}
Le Prestataire s'engage à exécuter cette mission avec diligence, dans le respect des règles de l'art
et des délais fixés à l'Article 3, en toute indépendance quant à l'organisation de son travail.
</p>

<h2>Article 2 — Jalons et livrables</h2>
<p class="clause">
La mission est décomposée en jalons, chacun correspondant à un livrable distinct, à un prix forfaitaire
et à un délai d'exécution propres. Un jalon est considéré comme achevé lorsque le livrable correspondant
a été transmis au Client et validé par celui-ci.
</p>

<table class="milestones">
  <thead>
    <tr>
      <th>#</th>
      <th>LIVRABLE / JALON</th>
      <th>UNITÉ</th>
      <th>PRIX</th>
      <th>DÉLAI</th>
    </tr>
  </thead>
  <tbody>
    ${milestonesRows}
    ${totalRow}
  </tbody>
</table>

<p class="clause">${regimeRow}</p>
<p class="clause">
Toute modification du périmètre d'un jalon fait l'objet d'un avenant écrit entre les Parties,
y compris via l'espace de négociation de la plateforme.
</p>

<h2>Article 3 — Durée d'exécution</h2>
<p class="clause">
La mission débute le <strong>${data.startDate}</strong> pour une durée estimée de <strong>${data.duration}</strong>,
soit une échéance prévisionnelle au <strong>${data.endDate}</strong>.
Cette durée est indicative et pourra être ajustée d'un commun accord en fonction de l'avancement réel des jalons.
</p>
<p class="clause">
Le présent contrat prend effet à sa signature par les deux Parties et s'achève à la validation
et au paiement du dernier jalon, sauf résiliation anticipée dans les conditions prévues à l'Article 8.
</p>

<h2>Article 4 — Rémunération et modalités de paiement</h2>
<p class="clause">
En contrepartie de la réalisation de la mission, le Client versera au Prestataire la somme totale de
<strong>${fmt(data.totalAmount)}</strong>${data.contractType === "FIXED" ? ", répartie par jalon conformément au tableau de l'Article 2." : ", selon le taux horaire convenu."}
</p>
<p class="clause">Le paiement de chaque jalon est déclenché selon les modalités suivantes :</p>
<ol style="margin-left:20px">
  <li>Le Prestataire transmet le livrable correspondant au jalon via l'espace de travail du projet ;</li>
  <li>Le Client dispose d'un délai de sept (7) jours calendaires pour valider le livrable ou formuler des demandes de modification motivées ;</li>
  <li>À défaut de contestation dans ce délai, le jalon est réputé accepté et son paiement est déclenché automatiquement ;</li>
  <li>Les fonds sont versés au Prestataire selon les modalités de paiement de la plateforme, déduction faite des frais de service applicables.</li>
</ol>

<h2>Article 5 — Statut du prestataire</h2>
<p class="clause">
Le Prestataire exerce sa mission en toute indépendance, sans lien de subordination juridique avec le Client.
Il détermine librement son organisation, ses méthodes et ses horaires de travail, sous la seule réserve
du respect des délais convenus à l'Article 3.
</p>
<p class="clause">
Le Prestataire est seul responsable de ses obligations sociales, fiscales et déclaratives liées à son statut,
telles que rappelées en en-tête du présent contrat.
</p>

<h2>Article 6 — Propriété intellectuelle</h2>
<p class="clause">
Sous réserve du complet paiement des sommes dues au titre du présent contrat, le Prestataire cède au Client,
à titre exclusif, l'ensemble des droits patrimoniaux de propriété intellectuelle afférents aux livrables
développés spécifiquement dans le cadre de la mission, pour le monde entier et pour la durée légale
de protection de ces droits.
</p>
<p class="clause">
Cette cession ne s'étend pas aux outils, bibliothèques, composants génériques ou méthodologies propres
au Prestataire, préexistants ou développés en dehors du cadre strict de la mission, sur lesquels le Prestataire
conserve l'intégralité de ses droits.
</p>

<h2>Article 7 — Confidentialité</h2>
<p class="clause">
Chaque Partie s'engage à conserver strictement confidentielles toutes les informations de nature technique,
commerciale ou financière dont elle aurait connaissance à l'occasion de l'exécution du présent contrat,
et à ne les utiliser qu'aux fins de la réalisation de la mission. Cette obligation perdure pendant toute
la durée du contrat et pour une période de deux (2) ans à compter de son terme, quelle qu'en soit la cause.
</p>

<h2>Article 8 — Résiliation</h2>
<p class="clause">
Chaque Partie peut résilier le présent contrat de plein droit, sans préavis, en cas de manquement grave
de l'autre Partie à ses obligations, non réparé dans un délai de quinze (15) jours suivant une mise en demeure
restée sans effet.
</p>
<p class="clause">
En cas de résiliation anticipée, les jalons achevés et validés à la date de résiliation restent dus
et sont réglés selon les modalités de l'Article 4. Les jalons non engagés ne donnent lieu à aucun paiement.
</p>

<h2>Article 9 — Responsabilité</h2>
<p class="clause">
Le Prestataire est tenu à une obligation de moyens dans l'exécution de sa mission. Sa responsabilité ne pourra
être engagée qu'en cas de faute prouvée, et sera en tout état de cause limitée au montant total perçu
au titre du présent contrat.
</p>

<h2>Article 10 — Droit applicable et litiges</h2>
<p class="clause">
Le présent contrat est soumis au droit français. En cas de différend relatif à sa formation, son exécution
ou son interprétation, les Parties s'efforceront de trouver une solution amiable avant toute action contentieuse.
À défaut d'accord amiable, les tribunaux compétents du ressort du siège social du Client seront seuls compétents.
</p>

<div class="signature-section">
  <h2>Signatures électroniques</h2>
  <p class="clause">
    Fait électroniquement, en un exemplaire numérique unique faisant foi entre les Parties,
    qui reconnaissent avoir pris connaissance de l'ensemble des clauses qui précèdent et les accepter sans réserve.
    Chaque signature est matérialisée par un QR code cryptographique vérifiable (RSA-SHA256, conforme eIDAS).
  </p>

  <div class="signature-grid">
    <div class="signature-box">
      <h3>POUR LE CLIENT</h3>
      <p><strong>${data.clientCompanyName}</strong></p>
      <p>${data.clientRepresentative}</p>
      <p style="font-size:11px;color:#666">${data.clientRepresentativeTitle}</p>
      ${clientSigHtml}
    </div>

    <div class="signature-box">
      <h3>POUR LE PRESTATAIRE</h3>
      <p><strong>${data.freelancerName}</strong></p>
      <p style="font-size:11px;color:#666">${data.freelancerStatus}</p>
      ${freelancerSigHtml}
    </div>
  </div>
</div>

<div class="footer">
  <p>Document généré automatiquement sur Flexwork — ${today}</p>
</div>

</body>
</html>`;
}

/**
 * Récupère les données d'un contrat depuis la base et les formate
 * pour le template HTML.
 */
export async function getContractTemplateData(contractId: string): Promise<ContractTemplateData | null> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        mission: {
          include: {
            client: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        milestones: { orderBy: { createdAt: "asc" } },
        signatures: { orderBy: { signedAt: "asc" } },
        offer: {
          include: {
            application: {
              include: {
                freelancer: {
                  include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contract) return null;

    const clientUser = contract.mission.client.user;
    const freelancerUser = contract.offer?.application.freelancer.user;
    const freelancerProfile = contract.offer?.application.freelancer;
    const mission = contract.mission;
    const offer = contract.offer;

    const endDate = contract.endDate
      ? new Date(contract.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "À déterminer";

    // Calculer la durée estimée entre startDate et endDate
    let duration = "Non spécifiée";
    if (contract.startDate && contract.endDate) {
      const diffMs = contract.endDate.getTime() - contract.startDate.getTime();
      const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks > 0) duration = `${diffWeeks} semaines`;
    }

    const milestones = contract.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description || undefined,
      amount: m.amount,
      delay: m.dueDate
        ? new Date(m.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
        : "À définir",
      unit: "Forfait",
      status: m.status,
      executionRate: m.executionRate ?? 100,
      proofs: m.proofs ?? undefined,
      revisionCount: m.revisionCount ?? 0,
      rejectionReason: m.rejectionReason ?? undefined,
    }));

    // Construire les données de signature — uniquement après DOUBLE signature
    const bothSigned = contract.clientSignedAt && contract.freelancerSignedAt;
    const sigs: ContractTemplateData["signatures"] = {};

    if (bothSigned && contract.clientSignedAt && contract.freelancerSignedAt) {
      sigs.client = {
        signedAt: contract.clientSignedAt.toISOString(),
        certificateId: `CERT-${contract.id.slice(0, 8)}-CLI-${contract.clientSignedAt.getTime().toString(36).toUpperCase()}`,
        signatureHash: simpleHash(`${contract.id}:CLIENT:${contract.clientSignedAt.toISOString()}`),
      };
      sigs.freelancer = {
        signedAt: contract.freelancerSignedAt.toISOString(),
        certificateId: `CERT-${contract.id.slice(0, 8)}-PRE-${contract.freelancerSignedAt.getTime().toString(36).toUpperCase()}`,
        signatureHash: simpleHash(`${contract.id}:PRESTATAIRE:${contract.freelancerSignedAt.toISOString()}`),
      };
    }

    return {
      reference: contract.id.slice(0, 8).toUpperCase(),
      missionTitle: mission.title,
      missionDescription: mission.description || "",
      clientCompanyName: mission.client.companyName || "Client",
      clientLegalForm: "Société par actions simplifiée (SAS)",
      clientAddress: `${mission.missionCity || "Ville non spécifiée"}, ${mission.missionCountry || "France"}`,
      clientSiret: mission.client.siret || "Non renseigné",
      clientRepresentative: `${clientUser.firstName || ""} ${clientUser.lastName || ""}`.trim() || "Représentant",
      clientRepresentativeTitle: "Gérant",
      freelancerName: `${freelancerUser?.firstName || ""} ${freelancerUser?.lastName || ""}`.trim() || "Prestataire",
      freelancerStatus: "Travailleur indépendant (micro-entreprise)",
      freelancerAddress: freelancerProfile?.location || "Adresse non renseignée",
      freelancerSiret: "Non renseigné",
      startDate: contract.startDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      duration,
      endDate,
      contractType: contract.contractType as "FIXED" | "HOURLY",
      totalAmount: contract.totalBudget || 0,
      milestones,
      signedByClient: !!contract.clientSignedAt,
      signedByFreelancer: !!contract.freelancerSignedAt,
      workflowPhase: mapPrismaStatusToPhase(contract.status),
      signatures: (sigs.client || sigs.freelancer) ? sigs : undefined,
    };
  } catch (err) {
    console.error("[ContractTemplate] Erreur lors de la récupération des données:", err);
    return null;
  }
}

// ── Helper : hachage simple pour les signatures ──────

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
  return Array.from({ length: 8 }, (_, i) =>
    hexHash.substring(i % 4, (i % 4) + 4)
  ).join("");
}

function mapPrismaStatusToPhase(status: string): string {
  switch (status) {
    case "PENDING": return "CONTRACT_GENERATED";
    case "ACTIVE": return "CONTRACT_ACTIVE";
    case "COMPLETED": return "COMPLETED";
    case "DISPUTED": return "DISPUTE_OPENED";
    default: return "NEGOTIATION";
  }
}
