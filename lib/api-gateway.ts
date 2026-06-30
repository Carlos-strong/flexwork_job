import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// ── Types ──────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiContext {
  params: Record<string, string>;
  searchParams: URLSearchParams;
  session: Awaited<ReturnType<typeof getServerSession>>;
}

interface RouteHandlerConfig {
  /** Méthodes HTTP autorisées */
  methods?: HttpMethod[];
  /** Rôle requis (optionnel) */
  requireRole?: "CLIENT" | "FREELANCER" | "ADMIN";
  /** Handler principal */
  handler: (req: NextRequest, ctx: ApiContext) => Promise<NextResponse>;
}

// ── Réponses standardisées ─────────────────────

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status }
  );
}

export function apiPaginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
  });
}

// ── Gateway Factory ────────────────────────────

/**
 * Crée un handler API unifié avec :
 * - Vérification de méthode HTTP
 * - Vérification de rôle
 * - Gestion d'erreur centralisée
 * - Format de réponse standardisé
 */
export function createApiHandler(config: RouteHandlerConfig) {
  return async (req: NextRequest, routeContext?: { params: Record<string, string> }) => {
    try {
      // 1. Vérification méthode HTTP
      if (config.methods) {
        const method = req.method as HttpMethod;
        if (!config.methods.includes(method)) {
          return apiError("Méthode non autorisée", 405);
        }
      }

      // 2. Vérification de rôle (skip en mode simulation)
      const isSimulation = req.headers.get("x-simulation") === "true" && process.env.NODE_ENV !== "production";
      if (config.requireRole && !isSimulation) {
        const session = await getServerSession(authOptions);
        const activeProfile = (session?.user as { activeProfile?: string } | undefined)?.activeProfile;

        if (!session?.user) {
          return apiError("Non authentifié", 401);
        }

        if (config.requireRole === "ADMIN" && activeProfile !== "ADMIN") {
          return apiError("Accès administrateur requis", 403);
        }

        if (
          config.requireRole === "CLIENT" &&
          activeProfile !== "CLIENT" &&
          activeProfile !== "ADMIN"
        ) {
          return apiError("Accès client requis", 403);
        }

        if (
          config.requireRole === "FREELANCER" &&
          activeProfile !== "FREELANCER" &&
          activeProfile !== "ADMIN"
        ) {
          return apiError("Accès freelance requis", 403);
        }
      }

      // 3. Contexte enrichi (session optionnelle si pas de requireRole)
      let session: Awaited<ReturnType<typeof getServerSession>> = null;
      if (config.requireRole) {
        try {
          session = await getServerSession(authOptions);
        } catch {
          // Auth non disponible = pas de session
        }
      }
      const url = new URL(req.url);
      const ctx: ApiContext = {
        params: routeContext?.params || {},
        searchParams: url.searchParams,
        session,
      };

      // 4. Exécution du handler
      return config.handler(req, ctx);
    } catch (err) {
      console.error("[API Gateway] Erreur non gérée:", err);
      return apiError("Erreur interne du serveur", 500);
    }
  };
}

// ── Helpers ────────────────────────────────────

/** Extrait le corps JSON de la requête avec validation typée */
export async function parseBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("Corps de requête invalide", 400);
  }
}

/** Extrait les paramètres de pagination de l'URL */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10))
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

/** Erreur HTTP typée */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Types exportés ─────────────────────────────
export type { ApiContext, HttpMethod, RouteHandlerConfig };
