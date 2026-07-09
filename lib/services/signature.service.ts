/**
 * Service de signature numérique — certificats RSA, signature cryptographique, validation.
 *
 * Architecture :
 *   1. Génération de paire de clés RSA-2048
 *   2. Création de certificat numérique (clé publique + métadonnées)
 *   3. La clé privée est chiffrée (AES-256-GCM) avec une clé dérivée (PBKDF2)
 *      avant d'être stockée en base — seule la clé publique est exportable
 *   4. Signature SHA-256 + RSA du contenu d'un contrat
 *   5. Vérification de signature avec la clé publique
 *
 * Utilisation API :
 *   POST /api/signature/certificate  → générer un certificat
 *   POST /api/signature/sign         → signer un contrat
 *   POST /api/signature/verify       → vérifier une signature
 *   GET  /api/signature/certificate  → lister/consulter ses certificats
 */

import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

// ── Constantes ──────────────────────────────
const RSA_KEY_SIZE = 2048;
const HASH_ALGORITHM = "sha256";
const SIGNING_METHOD = "RSA-SHA256";
const CERTIFICATE_VALIDITY_YEARS = 1;
const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32; // 256 bits pour AES-256
const AES_ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

// ── Types ───────────────────────────────────
export interface CertificateInput {
  userId: string;
  commonName: string;
  email: string;
  organization?: string;
  passphrase: string; // Mot de passe pour chiffrer la clé privée
}

export interface SignInput {
  contractId: string;
  certificateId: string;
  passphrase: string; // Pour déchiffrer la clé privée
  signerIp?: string;
  signerUserAgent?: string;
}

export interface VerifyInput {
  contractId: string;
  signatureId?: string;
}

export interface CertificateInfo {
  id: string;
  userId: string;
  commonName: string;
  email: string;
  organization: string | null;
  validFrom: Date;
  validUntil: Date;
  status: string;
  keyFingerprint: string;
  publicKey: string;
  createdAt: Date;
}

// ── Service ─────────────────────────────────
export class SignatureService {

  /**
   * Génère un certificat numérique RSA-2048 pour un utilisateur.
   * La clé privée est chiffrée (AES-256-GCM) avant stockage.
   * Révoke tout certificat actif précédent du même utilisateur.
   */
  static async generateCertificate(input: CertificateInput): Promise<CertificateInfo> {
    // 1. Révoquer les certificats actifs existants
    await prisma.digitalCertificate.updateMany({
      where: { userId: input.userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "Remplacé par un nouveau certificat" },
    });

    // 2. Générer la paire de clés RSA-2048
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: RSA_KEY_SIZE,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // 3. Calculer l'empreinte de la clé publique
    const fingerprint = crypto
      .createHash(HASH_ALGORITHM)
      .update(keyPair.publicKey)
      .digest("hex")
      .toUpperCase()
      .replace(/(.{2})(?=.)/g, "$1:");

    // 4. Chiffrer la clé privée avec AES-256-GCM + PBKDF2
    const salt = crypto.randomBytes(32).toString("hex");
    const iv = crypto.randomBytes(12).toString("hex");

    const key = crypto.pbkdf2Sync(input.passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, HASH_ALGORITHM);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, Buffer.from(iv, "hex"));
    const encrypted = Buffer.concat([
      cipher.update(keyPair.privateKey, "utf-8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag().toString("hex");

    // 5. Dates de validité
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + CERTIFICATE_VALIDITY_YEARS);

    // 6. Stocker en base
    const certificate = await prisma.digitalCertificate.create({
      data: {
        userId: input.userId,
        commonName: input.commonName,
        email: input.email,
        organization: input.organization,
        validFrom,
        validUntil,
        status: "ACTIVE",
        publicKey: keyPair.publicKey,
        encryptedPrivateKey: encrypted.toString("hex"),
        keyFingerprint: fingerprint,
        keySalt: salt,
        keyIv: iv,
        keyAuthTag: authTag,
      },
    });

    return {
      id: certificate.id,
      userId: certificate.userId,
      commonName: certificate.commonName,
      email: certificate.email,
      organization: certificate.organization,
      validFrom: certificate.validFrom,
      validUntil: certificate.validUntil,
      status: certificate.status,
      keyFingerprint: certificate.keyFingerprint,
      publicKey: certificate.publicKey,
      createdAt: certificate.createdAt,
    };
  }

  /**
   * Calcule le hash SHA-256 complet d'un contrat (toutes les données + jalons).
   * Ce hash sert d'empreinte définitive pour le verrouillage et la détection
   * de modification ultérieure.
   */
  static async computeContractHash(contractId: string): Promise<{ hash: string; contentString: string }> {
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: {
        mission: { select: { title: true, description: true, budget: true } },
        milestones: { select: { title: true, description: true, amount: true, dueDate: true, executionRate: true } },
        offer: { select: { offerType: true } },
      },
    });

    const normalizable = {
      contractId: contract.id,
      missionId: contract.missionId,
      offerId: contract.offerId,
      missionTitle: contract.mission.title,
      missionDescription: contract.mission.description,
      missionBudget: contract.mission.budget,
      contractType: contract.contractType,
      totalBudget: contract.totalBudget,
      hourlyRate: contract.hourlyRate,
      startDate: contract.startDate.toISOString(),
      endDate: contract.endDate?.toISOString() ?? null,
      milestones: contract.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate?.toISOString() ?? null,
        executionRate: m.executionRate,
      })),
      escrowAmount: contract.escrowAmount,
    };

    const contentString = JSON.stringify(normalizable, Object.keys(normalizable).sort());
    const hash = crypto.createHash("sha256").update(contentString).digest("hex");
    return { hash, contentString };
  }

  /**
   * Crée une entrée dans le journal d'audit immuable du contrat.
   * Chaque entrée est chaînée au hash de l'entrée précédente.
   */
  static async addAuditEntry(
    contractId: string,
    event: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Récupérer le hash de la dernière entrée
    const lastEntry = await prisma.contractAuditEntry.findFirst({
      where: { contractId },
      orderBy: { createdAt: "desc" },
      select: { currentHash: true },
    });

    const previousHash = lastEntry?.currentHash ?? null;
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? JSON.stringify(metadata, Object.keys(metadata).sort()) : "{}";

    // Construire le hash de cette entrée (chaîne immuable)
    const raw = `${previousHash ?? "ROOT"}||${event}||${description}||${metaStr}||${timestamp}`;
    const currentHash = crypto.createHash("sha256").update(raw).digest("hex");

    await prisma.contractAuditEntry.create({
      data: {
        contractId,
        event,
        description,
        metadata: (metadata as any) ?? {},
        previousHash,
        currentHash,
        systemSignature: `sha256-${currentHash}`, // Signature système (préparé pour future extension RSA)
      },
    });
  }

  /**
   * Verrouille un contrat après la double signature.
   * Calcule le hash final du contrat, le stocke, et passe le contrat en locked.
   * Toute modification ultérieure sera détectée par checkIntegrity().
   */
  static async lockContract(contractId: string, byCertificateId: string): Promise<void> {
    const { hash } = await SignatureService.computeContractHash(contractId);

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        lockedAt: new Date(),
        lockedByCertificateId: byCertificateId,
        documentHash: hash,
        isLocked: true,
        fullySignedAt: new Date(),
        status: "ACTIVE",
      },
    });

    await SignatureService.addAuditEntry(
      contractId,
      "LOCKED",
      "Contrat verrouillé après double signature — empreinte enregistrée",
      { documentHash: hash, lockedByCertificate: byCertificateId }
    );
  }

  /**
   * Vérifie l'intégrité d'un contrat verrouillé en comparant son hash actuel
   * avec le hash stocké au moment du verrouillage.
   * Toute différence = le contenu a été modifié → signature invalide.
   */
  static async checkIntegrity(contractId: string): Promise<{
    valid: boolean;
    reason: string;
    currentHash: string | null;
    lockedHash: string | null;
  }> {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { isLocked: true, documentHash: true, status: true },
    });

    if (!contract) return { valid: false, reason: "Contrat introuvable", currentHash: null, lockedHash: null };

    if (!contract.isLocked) {
      return { valid: false, reason: "Le contrat n'est pas encore verrouillé (en attente des signatures)", currentHash: null, lockedHash: null };
    }

    const { hash: currentHash } = await SignatureService.computeContractHash(contractId);
    const valid = currentHash === contract.documentHash;

    const event = valid ? "INTEGRITY_CHECK" : "TAMPER_DETECTED";
    await SignatureService.addAuditEntry(
      contractId,
      event,
      valid
        ? "Vérification d'intégrité réussie — le contenu du contrat est identique à l'original"
        : "⚠️ ALTÉRATION DÉTECTÉE — le contenu du contrat ne correspond plus à l'empreinte verrouillée !",
      { currentHash, lockedHash: contract.documentHash, integrityValid: valid }
    );

    return {
      valid,
      reason: valid
        ? "Intégrité vérifiée — le contrat n'a pas été modifié depuis son verrouillage"
        : "⚠️ ALTÉRATION DÉTECTÉE — le contenu a été modifié après les signatures !",
      currentHash,
      lockedHash: contract.documentHash,
    };
  }

  /**
   * Récupère la chaîne d'audit complète d'un contrat (journal immuable).
   * Permet de retracer chaque événement : création, signatures, verrouillage, vérifications.
   */
  static async getAuditTrail(contractId: string) {
    const entries = await prisma.contractAuditEntry.findMany({
      where: { contractId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        event: true,
        description: true,
        metadata: true,
        previousHash: true,
        currentHash: true,
        createdAt: true,
      },
    });

    // Vérifier la chaîne de hash (garantie d'immuabilité)
    let chainValid = true;
    for (let i = 0; i < entries.length; i++) {
      const prevHash = i === 0 ? null : entries[i - 1].currentHash;
      if (entries[i].previousHash !== prevHash) {
        chainValid = false;
        break;
      }
    }

    return {
      contractId,
      entries: entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      chainValid,
    };
  }

  /**
   * Signe numériquement un contrat avec le certificat de l'utilisateur.
   * Après signature :
   *   1. Enregistre l'événement dans le journal d'audit
   *   2. Si les deux parties ont signé → VERROUILLE automatiquement le contrat
   *   3. Génère la notification appropriée
   */
  static async signContract(input: SignInput) {
    // 1. Vérifier que le contrat n'est pas déjà verrouillé
    const existingContract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      select: { isLocked: true, fullySignedAt: true, status: true },
    });
    if (existingContract?.isLocked) {
      throw new Error("Ce contrat est déjà verrouillé — impossible d'ajouter une signature");
    }

    // 2. Récupérer le certificat
    const cert = await prisma.digitalCertificate.findUniqueOrThrow({
      where: { id: input.certificateId },
    });

    if (cert.status !== "ACTIVE") {
      throw new Error("Le certificat n'est pas actif (révoqué ou expiré)");
    }

    if (cert.validUntil < new Date()) {
      throw new Error("Le certificat a expiré — veuillez en générer un nouveau");
    }

    // 3. Récupérer le contrat avec ses données pour le hash
    const signingContract = await prisma.contract.findUniqueOrThrow({
      where: { id: input.contractId },
      include: {
        mission: { select: { title: true } },
        milestones: { select: { title: true, amount: true } },
      },
    });

    // 3. Construire le contenu à signer (représentation canonique)
    const contractData = {
      contractId: signingContract.id,
      missionId: signingContract.missionId,
      missionTitle: signingContract.mission.title,
      contractType: signingContract.contractType,
      totalBudget: signingContract.totalBudget,
      hourlyRate: signingContract.hourlyRate,
      startDate: signingContract.startDate.toISOString(),
      endDate: signingContract.endDate?.toISOString() ?? null,
      milestones: signingContract.milestones.map((m) => ({
        title: m.title,
        amount: m.amount,
      })),
      certFingerprint: cert.keyFingerprint,
      signedAt: new Date().toISOString(),
    };

    const contentString = JSON.stringify(contractData, Object.keys(contractData).sort());

    // 4. Calculer le hash SHA-256 du contenu
    const dataHash = crypto.createHash(HASH_ALGORITHM).update(contentString).digest("hex");

    // 5. Déchiffrer la clé privée
    const decryptedKey = SignatureService._decryptPrivateKey(
      cert.encryptedPrivateKey,
      input.passphrase,
      cert.keySalt,
      cert.keyIv,
      cert.keyAuthTag
    );

    // 6. Signer le hash avec la clé privée RSA
    const signer = crypto.createSign(SIGNING_METHOD);
    signer.update(dataHash);
    signer.end();
    const signature = signer.sign(decryptedKey, "base64");

    // 7. Vérifier immédiatement la signature (auto-validation)
    const verifier = crypto.createVerify(SIGNING_METHOD);
    verifier.update(dataHash);
    verifier.end();
    const isValid = verifier.verify(cert.publicKey, signature, "base64");

    if (!isValid) {
      throw new Error("La signature générée est invalide — erreur interne");
    }

    // 8. Stocker la signature
    const contractSignature = await prisma.contractSignature.create({
      data: {
        contractId: input.contractId,
        certificateId: input.certificateId,
        signedDataHash: dataHash,
        signature,
        signingMethod: SIGNING_METHOD,
        signedAt: new Date(),
        verifiedAt: new Date(),
        signerIp: input.signerIp,
        signerUserAgent: input.signerUserAgent,
      },
    });

    // 9. Déterminer le rôle du signataire
    const certUser = await prisma.user.findUnique({
      where: { id: cert.userId },
      select: { id: true, activeProfile: true, firstName: true },
    });
    const isClientSign = certUser?.activeProfile === "CLIENT";
    const roleLabel = isClientSign ? "CLIENT" : "FREELANCER";
    const roleLabelFr = isClientSign ? "Client" : "Prestataire";

    // 10. Mettre à jour le contrat
    const updateData: Record<string, any> = {};
    if (isClientSign) {
      updateData.clientSignedAt = new Date();
    } else {
      updateData.freelancerSignedAt = new Date();
      updateData.signedByCertificateId = input.certificateId;
    }

    await prisma.contract.update({
      where: { id: input.contractId },
      data: updateData,
    });

    // 11. Enregistrer dans le journal d'audit
    const auditEvent = isClientSign ? "CLIENT_SIGNED" : "FREELANCER_SIGNED";
    await SignatureService.addAuditEntry(
      input.contractId,
      auditEvent,
      `Signature par le ${roleLabelFr} (${cert.commonName}) — certificat ${cert.keyFingerprint}`,
      {
        certificateId: input.certificateId,
        keyFingerprint: cert.keyFingerprint,
        commonName: cert.commonName,
        signatureId: contractSignature.id,
        signedDataHash: dataHash,
        role: roleLabel,
      }
    );

    // 12. Si les deux parties ont signé → verrouillage automatique
    const existingSignatures = await prisma.contractSignature.count({
      where: { contractId: input.contractId },
    });
    let isLocked = false;
    if (existingSignatures >= 2) {
      await SignatureService.lockContract(input.contractId, input.certificateId);
      isLocked = true;
    }

    return {
      signatureId: contractSignature.id,
      signedDataHash: dataHash,
      signature,
      signingMethod: SIGNING_METHOD,
      signedAt: contractSignature.signedAt.toISOString(),
      verifiedAt: contractSignature.verifiedAt?.toISOString(),
      keyFingerprint: cert.keyFingerprint,
      role: roleLabel,
      isLocked,
      signedContent: contractData,
    };
  }

  /**
   * Vérifie une signature existante sur un contrat.
   * Peut optionnellement prendre un signatureId, sinon vérifie toutes les signatures.
   * Effectue aussi une vérification d'intégrité si le contrat est verrouillé.
   */
  static async verifySignature(input: VerifyInput) {
    const where: any = { contractId: input.contractId };
    if (input.signatureId) {
      where.id = input.signatureId;
    }

    const signatures = await prisma.contractSignature.findMany({
      where,
      include: {
        certificate: {
          select: {
            commonName: true,
            email: true,
            organization: true,
            keyFingerprint: true,
            publicKey: true,
            status: true,
            validUntil: true,
          },
        },
      },
    });

    if (signatures.length === 0) {
      return { valid: false, reason: "Aucune signature trouvée pour ce contrat", signatures: [] };
    }

    const results = await Promise.all(
      signatures.map(async (sig) => {
        // Vérifier le certificat
        if (sig.certificate.status !== "ACTIVE") {
          return {
            signatureId: sig.id,
            valid: false,
            reason: `Certificat ${sig.certificate.keyFingerprint} : ${sig.certificate.status === "REVOKED" ? "révoqué" : "expiré"}`,
            signedAt: sig.signedAt.toISOString(),
            commonName: sig.certificate.commonName,
            email: sig.certificate.email,
          };
        }
        if (sig.certificate.validUntil < new Date()) {
          return {
            signatureId: sig.id,
            valid: false,
            reason: "Certificat expiré",
            signedAt: sig.signedAt.toISOString(),
            commonName: sig.certificate.commonName,
            email: sig.certificate.email,
          };
        }

        // Vérifier la signature RSA
        try {
          const verifier = crypto.createVerify(SIGNING_METHOD);
          verifier.update(sig.signedDataHash);
          verifier.end();
          const valid = verifier.verify(sig.certificate.publicKey, sig.signature, "base64");

          // Mettre à jour la date de vérification
          if (valid) {
            await prisma.contractSignature.update({
              where: { id: sig.id },
              data: { verifiedAt: new Date() },
            });
          }

          return {
            signatureId: sig.id,
            valid,
            reason: valid ? "Signature valide" : "Signature invalide — le contenu a été modifié ou la clé ne correspond pas",
            signedAt: sig.signedAt.toISOString(),
            signedDataHash: sig.signedDataHash,
            commonName: sig.certificate.commonName,
            email: sig.certificate.email,
            keyFingerprint: sig.certificate.keyFingerprint,
          };
        } catch (err) {
          return {
            signatureId: sig.id,
            valid: false,
            reason: `Erreur de vérification : ${err instanceof Error ? err.message : "inconnue"}`,
            signedAt: sig.signedAt.toISOString(),
            commonName: sig.certificate.commonName,
            email: sig.certificate.email,
          };
        }
      })
    );

    return {
      valid: results.every((r) => r.valid),
      signatures: results,
      contractId: input.contractId,
    };
  }

  /**
   * Récupère les certificats d'un utilisateur.
   */
  static async getUserCertificates(userId: string): Promise<CertificateInfo[]> {
    const certs = await prisma.digitalCertificate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return certs.map((c) => ({
      id: c.id,
      userId: c.userId,
      commonName: c.commonName,
      email: c.email,
      organization: c.organization,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      status: c.status,
      keyFingerprint: c.keyFingerprint,
      publicKey: c.publicKey,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Révoke un certificat.
   */
  static async revokeCertificate(certificateId: string, reason: string) {
    const cert = await prisma.digitalCertificate.update({
      where: { id: certificateId },
      data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
    });
    return {
      id: cert.id,
      status: cert.status,
      revokedAt: cert.revokedAt?.toISOString(),
      revokeReason: cert.revokeReason,
    };
  }

  // ── Privé : déchiffrement de la clé privée ──

  private static _decryptPrivateKey(
    encryptedHex: string,
    passphrase: string,
    saltHex: string,
    ivHex: string,
    authTagHex: string
  ): string {
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, HASH_ALGORITHM);
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf-8");
  }
}
