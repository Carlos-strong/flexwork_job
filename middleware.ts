import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Rate limiting simple (en mémoire) avec nettoyage périodique
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requêtes par minute (plus permissif pour la navigation)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Nettoyage toutes les 5 minutes

// Nettoyage périodique pour éviter la fuite mémoire
let lastCleanup = Date.now();
function cleanupRateLimit(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of Array.from(rateLimit)) {
    if (now > entry.resetTime) rateLimit.delete(key);
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  cleanupRateLimit(now);
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cache léger pour le token JWT (TTL 5 secondes) — évite de décoder le JWT à chaque requête
const tokenCache = new Map<string, { token: unknown; ts: number }>();
const TOKEN_CACHE_TTL = 30_000; // 30 secondes

async function getCachedToken(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  // Utiliser un hash simple du cookie session comme clé
  const sessionToken = cookieHeader.match(/next-auth\.session-token=([^;]+)/)?.[1];
  if (!sessionToken) return null;

  const now = Date.now();
  const cached = tokenCache.get(sessionToken);
  if (cached && now - cached.ts < TOKEN_CACHE_TTL) {
    return cached.token;
  }

  const token = await getToken({ req });
  tokenCache.set(sessionToken, { token, ts: now });
  return token;
}

const protectedPaths = ["/dashboard", "/admin"];
const clientPaths = ["/dashboard/client"];
const freelancerPaths = ["/dashboard/freelancer"];
const adminPaths = ["/admin"];
const sensitiveApiPaths = ["/api/payments", "/api/webhooks", "/api/auth/register"];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // Rate limiting sur les routes sensibles
  if (sensitiveApiPaths.some((p) => pathname.startsWith(p))) {
    if (!checkRateLimit(ip)) {
      return new NextResponse("Trop de requêtes", { status: 429 });
    }
  }

  // Rate limiting général sur les API
  if (pathname.startsWith("/api/") && !checkRateLimit(ip + "-api")) {
    return new NextResponse("Trop de requêtes", { status: 429 });
  }

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAdmin = adminPaths.some((path) => pathname.startsWith(path));
  const isClient = clientPaths.some((path) => pathname.startsWith(path));
  const isFreelancer = freelancerPaths.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token = await getCachedToken(req);

    if (!token) {
      const loginUrl = new URL("/connexion", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const activeProfile = ((token as Record<string, unknown>)?.activeProfile as string) || "FREELANCER";

    if (isAdmin && activeProfile !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/client", req.url));
    }

    if (isClient && activeProfile !== "CLIENT" && activeProfile !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/freelancer", req.url));
    }

    if (isFreelancer && activeProfile !== "FREELANCER" && activeProfile !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/client", req.url));
    }

    if (activeProfile === "ADMIN" && !isAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  // Security headers + cache pour assets statiques
  const response = NextResponse.next();
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Cache navigateur pour les assets statiques servis via Next
  if (pathname.match(/\.(ico|svg|png|jpg|jpeg|webp|avif|woff2?|css)$/)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return response;
}

export const config = {
  matcher: [
    // Exclure les fichiers statiques, _next, favicon, etc.
    "/((?!_next|_vercel|favicon\\.ico|icon\\.svg|.*\\.(?:png|jpg|jpeg|webp|avif|svg|woff2?|css|js|map)).*)",
  ],
};
