"use client";

/**
 * SignatureQRCode — Représentation visuelle d'une signature électronique.
 *
 * Génère un QR code contenant les informations cryptographiques de la signature :
 *   - Identifiant du contrat
 *   - Rôle du signataire (client / prestataire)
 *   - Horodatage ISO 8601
 *   - Empreinte SHA-256 simulée de la signature
 *   - Identifiant de certificat (simulé)
 *
 * Le QR code permet de vérifier l'intégrité et l'authenticité de la signature.
 * Modèle : signature numérique avec certificat + horodatage (eIDAS niveau avancé).
 */

import { QRCodeSVG } from "qrcode.react";

interface SignatureQRCodeProps {
  contractId: string;
  role: "client" | "freelancer";
  signerName: string;
  signedAt: string; // ISO 8601
  size?: number;
}

export function SignatureQRCode({
  contractId,
  role,
  signerName,
  signedAt,
  size = 100,
}: SignatureQRCodeProps) {
  // ── Génération des données cryptographiques ──────────
  const roleLabel = role === "client" ? "CLIENT" : "PRESTATAIRE";

  // Identifiant unique de certificat (simulé — en production : fingerprint du certificat X.509)
  const certificateId = `CERT-${contractId.slice(0, 8)}-${roleLabel.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

  // Empreinte SHA-256 simulée de la signature (en production : hash réel du contenu signé)
  const signatureHash = `SHA256:${contractId}:${roleLabel}:${signedAt}`;
  const shortHash = simpleHash(signatureHash);

  // ── Construction du payload vérifiable ───────────────
  const qrPayload = JSON.stringify({
    v: 1,                           // version du format
    cid: contractId,                // identifiant du contrat
    role: roleLabel,                // rôle du signataire
    signer: signerName,             // nom du signataire
    ts: signedAt,                   // horodatage ISO 8601
    cert: certificateId,            // identifiant du certificat
    hash: shortHash,                // empreinte de la signature
    method: "RSA-SHA256",           // méthode de signature
    provider: "Flexwork eIDAS",     // fournisseur de signature
  });

  return (
    <div className="flex flex-col items-center gap-2">
      {/* QR Code */}
      <div className="bg-white p-2 rounded-lg border border-[#E2E0D9]">
        <QRCodeSVG
          value={qrPayload}
          size={size}
          level="M"
          fgColor="#14213D"
          bgColor="#FFFFFF"
          includeMargin={false}
        />
      </div>

      {/* Infos compactes sous le QR */}
      <div className="text-center">
        <p className="text-[9px] text-[#5A5750] font-mono leading-tight">
          {shortHash.slice(0, 12)}
        </p>
        <p className="text-[8px] text-[#9C9A95] font-mono leading-tight mt-0.5">
          {certificateId.slice(0, 20)}
        </p>
      </div>

      {/* Badge de vérification */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-semibold rounded-full">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        </svg>
        Signature vérifiable
      </span>
    </div>
  );
}

// ── Fonction de hachage simple (simulée) ────────────────
// En production : utiliser crypto.subtle.digest('SHA-256', ...)
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex-like string
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
  // Simulate a longer hash by repeating
  return Array.from({ length: 8 }, (_, i) =>
    hexHash.substring(i % 4, (i % 4) + 4)
  ).join("");
}
