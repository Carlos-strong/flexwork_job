import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";



export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  // Pas d'URL fixe : NextAuth auto-détecte depuis le Host header, ce qui permet
  // l'accès depuis d'autres appareils du réseau local (ex: 192.168.1.84:3000)
  pages: {
    signIn: "/connexion",
    newUser: "/inscription",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // ✅ Normalisation email
        const email = credentials.email.trim().toLowerCase();
        const isDev = process.env.NODE_ENV !== "production";

        // Tentative avec Prisma (PostgreSQL)
        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (user && user.passwordHash) {
            const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
            if (isValid) {
              const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
              return {
                id: user.id,
                email: user.email,
                name: displayName,
                activeProfile: user.activeProfile,
                emailVerified: user.emailVerified?.toISOString() || null,
                image: user.image,
              };
            }
          }
        } catch {
          console.log("[Auth] ⚠️ BDD indisponible");
          return null;
        }

        return null;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // URLs relatives : renvoyées telles quelles → le navigateur les résout
      // par rapport à l'origine courante (localhost ou 192.168.x.x)
      if (url.startsWith("/")) return url;
      // URLs absolues : autoriser si c'est le même site (localhost ou IP locale)
      try {
        const urlObj = new URL(url);
        if (
          urlObj.hostname === "localhost" ||
          /^192\.168\.\d+\.\d+$/.test(urlObj.hostname) ||
          /^10\.\d+\.\d+\.\d+$/.test(urlObj.hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(urlObj.hostname)
        ) {
          return url;
        }
      } catch { /* URL invalide, on laisse passer */ }
      return baseUrl;
    },
    async jwt({ token, user, account }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          activeProfile: (user as { activeProfile?: string }).activeProfile || "FREELANCER",
          emailVerified: (user as { emailVerified?: string | null }).emailVerified || null,
        };
      }
      if (account && !token.activeProfile) {
        token.activeProfile = "FREELANCER";
      }
      // Rafraîchir emailVerified depuis la BDD si le token ne l'a pas encore
      // (cas où l'utilisateur vérifie son email après s'être connecté)
      if (!token.emailVerified && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { emailVerified: true },
          });
          if (dbUser?.emailVerified) {
            token.emailVerified = dbUser.emailVerified.toISOString();
          }
        } catch {
          // Silencieux — on réessaiera au prochain rafraîchissement
        }
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          activeProfile: token.activeProfile as string,
          emailVerified: token.emailVerified as string | null,
        },
      };
    },
  },
};
