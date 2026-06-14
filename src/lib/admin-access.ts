import type { Session } from "next-auth";

export function isAdminSession(session: Pick<Session, "user"> | null | undefined) {
  return session?.user?.role === "ADMIN";
}

export function localPreviewSession(): Session {
  return {
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    user: {
      email: "local-preview@admin.dev",
      name: "Local Admin Preview",
      role: "ADMIN"
    }
  };
}

export function resolveAdminSession(session: Session | null | undefined, localPreview: boolean): Session {
  if (localPreview) {
    return localPreviewSession();
  }

  if (!session || session.user?.role !== "ADMIN") {
    throw new Error("Unauthorized admin action.");
  }

  return {
    ...session,
    user: session.user
  };
}
