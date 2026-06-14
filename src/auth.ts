import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { User as AuthUser } from "next-auth";
import { isAdminEmail } from "@/lib/admin-emails";
import { prisma } from "@/lib/prisma";

type AppRole = "ADMIN" | "ARTIST" | "CUSTOMER";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getArtistAllowlist() {
  return new Set(
    (process.env.ARTIST_ALLOWLIST_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function resolveRoleByEmail(email?: string | null): AppRole {
  if (!email) return "CUSTOMER";
  if (isAdminEmail(email)) return "ADMIN";
  if (getArtistAllowlist().has(normalizeEmail(email))) return "ARTIST";
  return "CUSTOMER";
}

async function syncUserProfile({
  user,
  providerAccountId
}: {
  user: AuthUser;
  providerAccountId?: string;
}) {
  const email = user.email ? normalizeEmail(user.email) : null;

  if (!email) {
    return null;
  }

  const fallbackRole = resolveRoleByEmail(email);

  try {
    return await prisma.user.upsert({
      where: {
        normalizedEmail: email
      },
      create: {
        email,
        normalizedEmail: email,
        fullName: user.name?.trim() || email,
        googleSubject: providerAccountId,
        googleEmail: email,
        role: fallbackRole
      },
      update: {
        email,
        fullName: user.name?.trim() || email,
        googleSubject: providerAccountId ?? undefined,
        googleEmail: email,
        role: fallbackRole,
        isActive: true
      },
      select: {
        id: true,
        role: true,
        venueId: true,
        email: true,
        fullName: true
      }
    });
  } catch {
    return {
      id: providerAccountId ?? email,
      role: fallbackRole,
      venueId: null,
      email,
      fullName: user.name?.trim() || email
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV !== "production" ? "local-development-secret-change-before-deploy" : undefined),
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
    verifyRequest: "/admin/login?check=email"
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async jwt({ token, user, account }) {
      if (!user?.email) {
        return token;
      }

      const dbUser = await syncUserProfile({
        user,
        providerAccountId: account?.providerAccountId
      });

      token.role = dbUser?.role ?? resolveRoleByEmail(user.email);
      token.venueId = dbUser?.venueId ?? null;
      token.userId = dbUser?.id ?? token.sub ?? null;

      return token;
    },
    async session({ session, token }) {
      session.user = { ...session.user };

      session.user.role = (token.role as AppRole | undefined) ?? "CUSTOMER";
      session.user.venueId = (token.venueId as string | null | undefined) ?? null;
      session.user.id = String(token.userId ?? token.sub ?? "");

      return session;
    }
  }
});
