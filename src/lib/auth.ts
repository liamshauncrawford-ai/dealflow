import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

// Admin emails — auto-approved with ADMIN role on first sign-in
const ADMIN_EMAILS = [
  "liamshauncrawford@gmail.com",
  "liam@crawfordholdings.co",
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || "common"}/v2.0`,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      const email = user.email.toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(email);

      // Update last login timestamp
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email },
        });

        if (dbUser) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { lastLoginAt: new Date() },
          });

          // Create login history
          await prisma.loginHistory.create({
            data: {
              userId: dbUser.id,
              provider: account?.provider ?? "unknown",
            },
          });
        }
      } catch (error) {
        console.error("[Auth] Failed to update login data:", error);
      }

      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;

        // Fetch role and approval status from DB
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isApproved: true },
        });

        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.isApproved = dbUser.isApproved;
        }
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;

      const email = user.email.toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(email);

      if (isAdmin) {
        // Auto-approve admin users
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: "ADMIN",
            isApproved: true,
          },
        });
      } else {
        // Create pending access request for non-admin users
        await prisma.accessRequest.create({
          data: {
            userId: user.id,
            status: "PENDING",
          },
        });

        // Create notification for admins
        await prisma.notification.create({
          data: {
            type: "ACCESS_REQUEST",
            title: "New Access Request",
            message: `${user.name || user.email} is requesting access to DealFlow.`,
          },
        });
      }
    },
  },
});

// Type helper for session user
export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: UserRole;
  isApproved: boolean;
};
