import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";


const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * POST /api/users/company-kyc
 * Upload KBIS + RIB pour la vérification entreprise d'un client.
 * Body: multipart/form-data — siret (string), kbis (File), rib (File)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const formData = await req.formData();
    const siret = (formData.get("siret") as string | null)?.trim() ?? "";
    const kbisFile = formData.get("kbis") as File | null;
    const ribFile = formData.get("rib") as File | null;

    // Validation basique du SIRET (14 chiffres)
    if (!/^\d{14}$/.test(siret)) {
      return NextResponse.json(
        { error: "Le SIRET doit contenir exactement 14 chiffres" },
        { status: 400 }
      );
    }
    if (!kbisFile) {
      return NextResponse.json({ error: "Le fichier KBIS est requis" }, { status: 400 });
    }
    if (!ribFile) {
      return NextResponse.json({ error: "Le fichier RIB est requis" }, { status: 400 });
    }

    for (const [label, file] of [["KBIS", kbisFile], ["RIB", ribFile]] as [string, File][]) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Fichier ${label} : format non autorisé (PDF, JPEG ou PNG uniquement)` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Fichier ${label} trop volumineux (max 10 Mo)` },
          { status: 400 }
        );
      }
    }

    // Sauvegarder les fichiers sur disque
    const saveFile = async (file: File, category: string): Promise<string> => {
      const ext = MIME_EXTENSIONS[file.type] || "bin";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "kyc", userId);
      const filePath = path.join(uploadDir, uniqueName);
      await mkdir(uploadDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      const publicUrl = `/uploads/kyc/${userId}/${uniqueName}`;

      // Enregistrement dans la table File polymorphe
      await prisma.file.create({
        data: {
          userId,
          filename: file.name,
          path: publicUrl,
          mimeType: file.type,
          size: file.size,
          entityType: "ClientProfile",
          entityId: userId,
          category,
        },
      });

      return publicUrl;
    };

    const [kbisUrl, ribUrl] = await Promise.all([
      saveFile(kbisFile, "certificat"),
      saveFile(ribFile, "piece_jointe"),
    ]);

    // Mettre à jour le profil client
    const updated = await prisma.clientProfile.updateMany({
      where: { userId },
      data: {
        siret,
        kbisUrl,
        ribUrl,
        companyVerificationStatus: "EN_ATTENTE",
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Profil client introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Documents soumis — votre compte est en cours de vérification",
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
