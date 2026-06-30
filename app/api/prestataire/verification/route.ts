import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verificationIdentiteSchema } from "@/lib/validations/auth";
import { PieceType } from "@prisma/client";

/**
 * GET /api/prestataire/verification
 * Retourne le statut KYC de l'utilisateur connecté.
 * Utilisé par le modal de candidature pour savoir si un avertissement doit être affiché.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      // Retourner null au lieu d'une 401 — le client gère déjà l'absence de données
      return NextResponse.json({
        kycStatut: null,
        motifRejet: null,
        taux: null,
        modeTarification: null,
        metierLibelle: null,
      });
    }

    const kyc = await prisma.verificationIdentite.findFirst({
      where: { userId },
      orderBy: { dateSoumission: "desc" },
      select: { statut: true, dateSoumission: true, motifRejet: true },
    });

    // Fetch du premier métier actif pour pré-remplissage du taux
    const premierMetier = await prisma.prestataireMetier.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, taux: true, modeTarification: true, metier: { select: { libelle: true } } },
    });

    return NextResponse.json({
      kycStatut: kyc?.statut ?? null,        // "EN_ATTENTE" | "VALIDE" | "REJETE" | null
      motifRejet: kyc?.motifRejet ?? null,
      taux: premierMetier?.taux ?? null,
      modeTarification: premierMetier?.modeTarification ?? null,
      metierLibelle: premierMetier?.metier?.libelle ?? null,
    });
  } catch {
    return NextResponse.json({
      kycStatut: null,
      motifRejet: null,
      taux: null,
      modeTarification: null,
      metierLibelle: null,
    });
  }
}

/**
 * POST /api/prestataire/verification
 * Soumet une vérification d'identité pour devenir prestataire.
 * Cette étape n'est faite qu'une seule fois par utilisateur.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Auth: session ou userId depuis le formData (flux d'inscription)
    const session = await getServerSession(authOptions);
    let userId: string | undefined = (session?.user as { id?: string })?.id;

    if (!userId) {
      const bodyUserId = formData.get("userId") as string | null;
      if (bodyUserId) {
        const user = await prisma.user.findUnique({ where: { id: bodyUserId }, select: { id: true } });
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      console.warn("[VERIFICATION] Pas d'authentification");
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    console.log("[VERIFICATION] Début vérification pour userId:", userId);

    const pieceTypeRaw = formData.get("pieceType") as string;
    const numeroPiece = formData.get("numeroPiece") as string;
    const photoRecto = formData.get("photoRecto") as File | string;
    const photoVerso = formData.get("photoVerso") as File | string | null;
    const selfieUrl = formData.get("selfieUrl") as File | string | null;

    console.log("[VERIFICATION] Données reçues:", {
      pieceType: pieceTypeRaw,
      numeroPiece: numeroPiece?.substring(0, 5) + "***",
      hasPhotoRecto: !!photoRecto,
      hasPhotoVerso: !!photoVerso,
      hasSelfieUrl: !!selfieUrl,
    });

    // Valider le type de pièce
    const PIECE_TYPES = ["CARTE_NATIONALE", "PASSEPORT", "PERMIS"] as const;
    if (!pieceTypeRaw || !PIECE_TYPES.includes(pieceTypeRaw as any)) {
      console.error("[VERIFICATION] Type de pièce invalide:", pieceTypeRaw);
      return NextResponse.json(
        { error: "Type de pièce invalide. Valeurs acceptées : CARTE_NATIONALE, PASSEPORT, PERMIS" },
        { status: 400 }
      );
    }
    const pieceType = pieceTypeRaw as PieceType;

    if (!numeroPiece || !photoRecto) {
      console.error("[VERIFICATION] Données manquantes:", { numeroPiece: !!numeroPiece, photoRecto: !!photoRecto });
      return NextResponse.json(
        { error: "Numéro de pièce et photo recto sont requis" },
        { status: 400 }
      );
    }

    if (numeroPiece.trim().length < 3) {
      console.error("[VERIFICATION] Numéro trop court:", numeroPiece.trim().length);
      return NextResponse.json(
        { error: "Le numéro de pièce doit contenir au moins 3 caractères" },
        { status: 400 }
      );
    }

    // Créer des URLs temporaires pour les fichiers
    // TODO: Intégrer S3 ou un service de stockage pour les fichiers
    const photoRectoName = typeof photoRecto === "string" ? photoRecto : photoRecto.name;
    const photoRectoUrl = `/uploads/${Date.now()}-recto-${photoRectoName}`;
    const photoVersoUrl = photoVerso
      ? `/uploads/${Date.now()}-verso-${typeof photoVerso === "string" ? photoVerso : photoVerso.name}`
      : null;
    const selfieUrl_ = selfieUrl
      ? `/uploads/${Date.now()}-selfie-${typeof selfieUrl === "string" ? selfieUrl : selfieUrl.name}`
      : null;

    // Valider avec le schéma Zod avant insertion
    const validation = verificationIdentiteSchema.safeParse({
      pieceType,
      numeroPiece: numeroPiece.trim(),
      photoRecto: photoRectoUrl,
      photoVerso: photoVersoUrl,
      selfieUrl: selfieUrl_,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      console.error("[VERIFICATION] Validation Zod échouée:", firstError);
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    console.log("[VERIFICATION] Validation Zod réussie, vérification de doublon...");

    // Vérifier si l'utilisateur a déjà soumis une vérification
    const existing = await prisma.verificationIdentite.findFirst({
      where: { userId },
      orderBy: { dateSoumission: "desc" },
    });

    if (existing?.statut === "EN_ATTENTE") {
      console.warn("[VERIFICATION] Vérification déjà en attente pour userId:", userId);
      return NextResponse.json(
        { error: "Vous avez déjà une vérification en cours de traitement" },
        { status: 409 }
      );
    }

    if (existing?.statut === "VALIDE") {
      console.warn("[VERIFICATION] Vérification déjà validée pour userId:", userId);
      return NextResponse.json(
        { error: "Votre identité a déjà été vérifiée" },
        { status: 409 }
      );
    }

    console.log("[VERIFICATION] Création de la vérification en BD...");

    // Créer la vérification
    const verification = await prisma.verificationIdentite.create({
      data: {
        userId,
        pieceType,
        numeroPiece,
        photoRecto: photoRectoUrl,
        photoVerso: photoVersoUrl,
        selfieUrl: selfieUrl_,
        statut: "EN_ATTENTE",
      },
    });

    console.log("[VERIFICATION] Vérification créée avec ID:", verification.id);

    // Attribuer le rôle PRESTATAIRE
    const rolePrestataire = await prisma.role.findUnique({ where: { libelle: "PRESTATAIRE" } });
    if (rolePrestataire) {
      const existingRole = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: rolePrestataire.id } },
      });
      if (!existingRole) {
        await prisma.userRole.create({
          data: { userId, roleId: rolePrestataire.id },
        });
        console.log("[VERIFICATION] Rôle PRESTATAIRE attribué");
      }
    }

    console.log("[VERIFICATION] Succès - vérification soumise");

    return NextResponse.json({
      message: "Vérification soumise avec succès. En attente de validation administrative.",
      verification: {
        id: verification.id,
        statut: verification.statut,
        dateSoumission: verification.dateSoumission,
      },
    });
  } catch (err) {
    console.error("[VERIFICATION] Erreur:", err);
    return NextResponse.json(
      { error: "Erreur lors de la soumission de la vérification" },
      { status: 500 }
    );
  }
}


