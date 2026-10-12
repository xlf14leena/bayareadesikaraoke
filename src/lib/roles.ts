import { cache } from "react";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Roles (see spec, "Roles and permissions"):
//   visitor     – signed out
//   member      – any signed-in user; signs up as a singer or listener per event
//   group admin – a GroupAdmin row for that group; powers limited to that group
//   super user  – User.isSuperUser; everything, for every group
//
// "View as": an admin can preview the site as a singer, or a super user as
// one group's admin. The choice lives in a cookie and only ever narrows the
// viewer's roles (it is checked against their real roles), so every page and
// action behaves exactly as it would for that role. Switching back restores
// the real roles.

export type Viewer = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isSuperUser: boolean;
  adminGroupIds: string[];
  /** Set while previewing the site as another role. */
  viewAs: ViewAs | null;
  /** The person's actual roles, whatever they are viewing as. */
  real: { isSuperUser: boolean; adminGroupIds: string[] };
};

export const VIEW_AS_COOKIE = "view-as";

export type ViewAs = { kind: "singer" } | { kind: "group-admin"; groupId: string; groupName: string };

/** Parses the cookie value ("singer" or "group:<id>") against the person's real roles. */
async function resolveViewAs(
  raw: string | undefined,
  real: { isSuperUser: boolean; adminGroupIds: string[] },
): Promise<ViewAs | null> {
  if (!raw || (!real.isSuperUser && real.adminGroupIds.length === 0)) return null;
  if (raw === "singer") return { kind: "singer" };
  if (raw.startsWith("group:")) {
    const groupId = raw.slice("group:".length);
    // Only a super user, or an admin of several groups, can narrow to one group they could already manage.
    if (!real.isSuperUser && !real.adminGroupIds.includes(groupId)) return null;
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
    if (!group) return null;
    return { kind: "group-admin", groupId, groupName: group.name };
  }
  return null;
}

export function isConfiguredSuperUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_USER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** The signed-in user with their roles (narrowed by "View as"), or null for a visitor. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admins = await prisma.groupAdmin.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  });
  const real = { isSuperUser: session.user.isSuperUser, adminGroupIds: admins.map((a) => a.groupId) };
  const viewAs = await resolveViewAs((await cookies()).get(VIEW_AS_COOKIE)?.value, real);
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    isSuperUser: viewAs ? false : real.isSuperUser,
    adminGroupIds: !viewAs ? real.adminGroupIds : viewAs.kind === "group-admin" ? [viewAs.groupId] : [],
    viewAs,
    real,
  };
});

/** True when the person is an admin in real life, so they can use "View as". */
export function canSwitchView(viewer: Viewer | null): boolean {
  return !!viewer && (viewer.real.isSuperUser || viewer.real.adminGroupIds.length > 0);
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
