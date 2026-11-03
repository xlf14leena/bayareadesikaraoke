"use server";

import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { FormError, type FormState, text } from "@/lib/forms";
import { eventPathById } from "@/lib/event-url";
import { prisma } from "@/lib/prisma";
import { type Viewer, canAdminGroup, requireGroupAdmin, requireViewer } from "@/lib/roles";

// Comments and questions on an event page (src/components/comments/EventComments.tsx).
// Any signed-in member who can open the page can post, before, during or after
// the event, unless an admin turned comments off for that date.

const MAX_COMMENT = 1000; // also the textarea limit in CommentForm

function refresh() {
  revalidatePath("/g/[slug]/[event]", "page");
}

/** Same rule as the event page: a private event opens for admins, with the link's key, or for people who signed up. */
async function canOpen(
  viewer: Viewer,
  date: { id: string; series: { groupId: string; visibility: string; privateToken: string | null } },
  privateKey: string | null,
): Promise<boolean> {
  if (date.series.visibility !== "PRIVATE" || canAdminGroup(viewer, date.series.groupId)) return true;
  if (privateKey && privateKey === date.series.privateToken) return true;
  return (await prisma.signUp.count({ where: { eventDateId: date.id, userId: viewer.id } })) > 0;
}

/** Posts a comment or question, or a reply to one when parentId is set. */
export async function postComment(
  dateId: string,
  privateKey: string | null,
  parentId: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const viewer = await requireViewer(await eventPathById(dateId));
  try {
    const date = await prisma.eventDate.findUnique({
      where: { id: dateId },
      select: {
        id: true,
        status: true,
        commentsEnabled: true,
        series: { select: { groupId: true, visibility: true, privateToken: true } },
      },
    });
    if (!date || date.status === "DELETED") throw new FormError("This date no longer exists.");
    if (!(await canOpen(viewer, date, privateKey))) {
      throw new FormError("This private event's link has changed. Ask the organizers for the new one.");
    }
    if (!date.commentsEnabled) throw new FormError("Comments are turned off for this event.");
    const body = text(form, "body", parentId ? "Your reply" : "Your comment", { max: MAX_COMMENT });
    if (parentId) {
      const parent = await prisma.eventComment.findUnique({ where: { id: parentId }, select: { eventDateId: true, parentId: true } });
      if (!parent || parent.eventDateId !== dateId) throw new FormError("That comment was deleted.");
      // Replies stay one level deep: a reply to a reply joins the same thread.
      if (parent.parentId) parentId = parent.parentId;
    }
    await prisma.eventComment.create({
      data: {
        eventDateId: dateId,
        userId: viewer.id,
        authorName: viewer.name?.trim() || "Member",
        parentId,
        isQuestion: !parentId && form.get("isQuestion") === "on",
        body,
      },
    });
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: parentId ? "Reply posted." : "Posted." };
}

/** Deletes a comment and its replies. The author or the group's admins can. */
export async function deleteComment(commentId: string): Promise<void> {
  const viewer = await requireViewer();
  const comment = await prisma.eventComment.findUnique({
    where: { id: commentId },
    select: { userId: true, eventDate: { select: { series: { select: { groupId: true } } } } },
  });
  if (!comment) return;
  if (comment.userId !== viewer.id && !canAdminGroup(viewer, comment.eventDate.series.groupId)) forbidden();
  await prisma.eventComment.delete({ where: { id: commentId } });
  refresh();
}

/** Turns the comment section on or off for one date. Turning it off hides it from members but keeps the comments. */
export async function setCommentsEnabled(dateId: string, enabled: boolean): Promise<void> {
  const date = await prisma.eventDate.findUniqueOrThrow({ where: { id: dateId }, select: { series: { select: { groupId: true } } } });
  await requireGroupAdmin(date.series.groupId);
  await prisma.eventDate.update({ where: { id: dateId }, data: { commentsEnabled: enabled } });
  refresh();
  revalidatePath(`/admin/dates/${dateId}`);
}
