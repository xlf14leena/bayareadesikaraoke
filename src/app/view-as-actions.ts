"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_AS_COOKIE, canSwitchView, getViewer } from "@/lib/roles";

/**
 * Switches what the site shows: "" for the person's own roles, "singer", or
 * "group:<id>". getViewer re-checks the choice against their real roles on
 * every request, so this can never grant anything.
 */
export async function setViewAs(form: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!canSwitchView(viewer)) redirect("/");
  const value = String(form.get("viewAs") ?? "");
  const jar = await cookies();

  if (value === "singer" || value.startsWith("group:")) {
    jar.set(VIEW_AS_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
    redirect(value === "singer" ? "/" : `/admin/groups/${value.slice("group:".length)}`);
  }
  jar.delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
