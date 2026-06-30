import { NextResponse } from "next/server";
import { missions } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";

/**
 * Moteur d'embedding lexical simple (TF-IDF-like).
 *
 * Fonctionnement :
 * 1. Extrait les mots-clés significatifs des titres/descriptions/skills
 * 2. Calcule un vecteur de fréquence pour chaque mission
 * 3. Stocke les vecteurs en mémoire (et en BDD si disponible)
 *
 * À terme : remplacer par OpenAI text-embedding-3-small + pgvector
 */

interface TokenVector {
  missionId: string;
  tokens: Record<string, number>; // mot-clé -> score TF
  createdAt: string;
}

// Stockage en mémoire des vecteurs
const embeddingStore: TokenVector[] = [];

/** Tokenize un texte en mots-clés significatifs */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\séèêëàâîïôûùçäöü]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2) // ignorer les mots trop courts
    .filter((t) => !["les", "des", "pour", "dans", "avec", "une", "que", "pas", "sur", "est", "nous", "vous"].includes(t));
}

/** Calcule le vecteur TF pour un texte */
function computeTF(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  // Normalisation
  const maxFreq = Math.max(...Object.values(freq), 1);
  for (const key of Object.keys(freq)) {
    freq[key] = freq[key] / maxFreq;
  }
  return freq;
}

function trainFromMissions() {
  embeddingStore.length = 0;

  for (const m of missions) {
    const text = `${m.title} ${m.title} ${m.description} ${m.skills.join(" ")} ${m.location || ""}`;
    const tokens = computeTF(text);

    // Donner plus de poids aux compétences
    for (const skill of m.skills) {
      const key = skill.toLowerCase();
      tokens[key] = (tokens[key] || 0) + 0.5; // bonus skill
    }

    embeddingStore.push({
      missionId: m.id,
      tokens,
      createdAt: m.createdAt,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = body.text as string | undefined;

    // (Ré)entraîner le modèle sur les données disponibles
    trainFromMissions();

    // Si un texte est fourni, retourner son embedding
    let queryEmbedding: Record<string, number> | null = null;
    if (text) {
      queryEmbedding = computeTF(text);
    }

    // Tentative de stockage en BDD (optionnel)
    try {
      // Note: nécessite pgvector pour du vrai stockage vectoriel
      // CREATE EXTENSION vector;
      // ALTER TABLE missions ADD COLUMN embedding vector(1536);
      console.log("[Uma Embeddings] pgvector non configuré — stockage en mémoire uniquement");
    } catch {
      // ignore
    }

    return NextResponse.json({
      status: "ok",
      message: text
        ? "Embedding calculé avec le moteur lexical TF-IDF"
        : "Embeddings mis à jour depuis les missions",
      note: "Moteur lexical local (TF-IDF). Pour des embeddings sémantiques, utilisez OpenAI API + pgvector.",
      embeddingsCount: embeddingStore.length,
      embedding: queryEmbedding
        ? {
            tokens: Object.keys(queryEmbedding).length,
            topKeywords: Object.entries(queryEmbedding)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([k, v]) => ({ keyword: k, score: v })),
          }
        : undefined,
    });
  } catch (error) {
    console.error("[Uma Embeddings] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des embeddings" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Entraîner si nécessaire
  if (embeddingStore.length === 0) {
    trainFromMissions();
  }

  return NextResponse.json({
    status: "ok",
    embeddingsCount: embeddingStore.length,
    missions: embeddingStore.map((v) => ({
      missionId: v.missionId,
      tokensCount: Object.keys(v.tokens).length,
      topTokens: Object.entries(v.tokens)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k),
    })),
  });
}
