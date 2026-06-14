import { auth } from "@/auth";
import { localPreviewSession, resolveAdminSession } from "./admin-access";

export function isLocalAdminPreviewEnabled() {
  return process.env.LOCAL_ADMIN_PREVIEW === "true" && process.env.VERCEL !== "1";
}

export async function requireAdmin() {
  if (isLocalAdminPreviewEnabled()) {
    return localPreviewSession();
  }

  return resolveAdminSession(await auth(), false);
}

export async function requireAdminSession() {
  if (isLocalAdminPreviewEnabled()) {
    return requireAdmin();
  }

  const session = await auth();
  return session?.user?.role === "ADMIN" ? session : null;
}
