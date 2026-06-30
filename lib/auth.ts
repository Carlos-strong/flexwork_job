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
