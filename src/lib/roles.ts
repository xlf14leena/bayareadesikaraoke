import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Roles (see spec, "Roles and permissions"):
//   visitor     – signed out
//   member      – any signed-in user; signs up as a singer or listener per event
//   group admin – a GroupAdmin row for that group; powers limited to that group
//   super user  – User.isSuperUser; everything, for every group

export type Viewer = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isSuperUser: boolean;
  adminGroupIds: string[];
};

export function isConfiguredSuperUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** The signed-in user with their roles, or null for a visitor. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admins = await prisma.groupAdmin.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  });
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isSuperUser: session.user.isSuperUser,
    adminGroupIds: admins.map((a) => a.groupId),
  };
}

export function canAdminGroup(viewer: Viewer | null, groupId: string): boolean {
  if (!viewer) return false;
  return viewer.isSuperUser || viewer.adminGroupIds.includes(groupId);
}

export function isAnyAdmin(viewer: Viewer | null): boolean {
  return !!viewer && (viewer.isSuperUser || viewer.adminGroupIds.length > 0);
}

/** Signed-in members only; visitors are sent to sign in and brought back. */
export async function requireViewer(callbackUrl = "/"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return viewer;
}

export async function requireGroupAdmin(groupId: string, callbackUrl = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(callbackUrl);
  if (!canAdminGroup(viewer, groupId)) forbidden();
  return viewer;
}

export async function requireAnyAdmin(callbackUrl = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(callbackUrl);
  if (!isAnyAdmin(viewer)) forbidden();
  return viewer;
}

export async function requireSuperUser(callbackUrl = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(callbackUrl);
  if (!viewer.isSuperUser) forbidden();
  return viewer;
}
