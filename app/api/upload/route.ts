import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "text/plain",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/zip": "zip",
  "text/plain": "txt",
};

const CATEGORY_ALLOWED = [
  "avatar", "photo_recto", "photo_verso", "selfie",
  "cahier_des_charges", "certificat", "portfolio",
  "photo_demande", "piece_jointe", "general",
];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const contractId = formData.get("contractId") as string | null;

    // Paramètres pour la table File polymorphe
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;
    const category = (formData.get("category") as string) || "general";
    const userId = formData.get("userId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 10MB)" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${file.type}. Formats acceptés : PDF, JPEG, PNG, GIF, WebP, DOC, DOCX, ZIP, TXT` },
        { status: 400 }
      );
    }

    if (!CATEGORY_ALLOWED.includes(category)) {
      return NextResponse.json({ error: `Catégorie non valide : ${category}` }, { status: 400 });
    }

    // Générer un nom de fichier unique
    const ext = MIME_EXTENSIONS[file.type] || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const relativePath = contractId ? `contracts/${contractId}` : category;
    const uploadDir = path.join(process.cwd(), "public", "uploads", relativePath);
    const filePath = path.join(uploadDir, uniqueName);

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${relativePath}/${uniqueName}`;

    // Enregistrer dans la table File polymorphe
    const fileRecord = await prisma.file.create({
      data: {
        userId: userId || undefined,
        filename: file.name,
        path: publicUrl,
        mimeType: file.type,
        size: file.size,
        entityType: entityType || "general",
        entityId: entityId || "",
        category,
      },
    });

    return NextResponse.json({
      message: "Fichier uploadé avec succès",
      file: {
        id: fileRecord.id,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        url: publicUrl,
        category,
      },
    });
  } catch (error) {
    console.error("[Upload] Erreur:", error);
    return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
  }
}
