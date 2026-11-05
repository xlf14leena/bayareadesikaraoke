import Link from "next/link";
import { deleteComment, postComment, setCommentsEnabled } from "@/app/g/[slug]/[event]/comment-actions";
import { CommentForm, DeleteCommentButton, ReplyForm } from "@/components/comments/CommentForm";
import { cardClass, primaryButton, secondaryButton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Viewer } from "@/lib/roles";

// "Comments and questions" on an event page. Signed-in members read and post;
// visitors are asked to sign in. When an admin turns comments off, members
// don't see the section at all, and admins see it with a note and the switch.

type Props = {
  date: { id: string; commentsEnabled: boolean; series: { groupId: string } };
  viewer: Viewer | null;
  isAdmin: boolean;
  privateKey: string | null;
  here: string;
};

export default async function EventComments({ date, viewer, isAdmin, privateKey, here }: Props) {
  if (!date.commentsEnabled && !isAdmin) return null;

  const [comments, admins] = viewer
    ? await Promise.all([
        prisma.eventComment.findMany({
          where: { eventDateId: date.id, parentId: null },
          orderBy: { createdAt: "desc" },
          include: { replies: { orderBy: { createdAt: "asc" } } },
        }),
        prisma.groupAdmin.findMany({ where: { groupId: date.series.groupId }, select: { userId: true } }),
      ])
    : [[], []];
  const adminIds = new Set(admins.map((a) => a.userId));
  const isOrganizer = (userId: string | null) => !!userId && adminIds.has(userId);
  const canDelete = (userId: string | null) => isAdmin || (!!viewer && userId === viewer.id);
  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <section id="comments" className={`${cardClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Comments and questions
            {count > 0 && <span className="ml-2 text-base font-normal text-ink-muted">{count}</span>}
          </h2>
          {date.commentsEnabled ? (
            <p className="text-sm text-ink-muted">Ask the organizers anything, or chat with others coming.</p>
          ) : (
            <p className="text-sm text-ink-muted">
              Comments are off. Members don&apos;t see this section; only admins can see what was posted.
            </p>
          )}
        </div>
        {isAdmin && (
          <form action={setCommentsEnabled.bind(null, date.id, !date.commentsEnabled)}>
            <button type="submit" className={date.commentsEnabled ? secondaryButton : primaryButton}>
              {date.commentsEnabled ? "Turn off comments" : "Turn on comments"}
            </button>
          </form>
        )}
      </div>

      {!viewer ? (
        <p className="text-ink-muted">
          <Link href={`/signin?callbackUrl=${encodeURIComponent(`${here}#comments`)}`} className="font-medium text-cobalt hover:underline">
            Sign in
          </Link>{" "}
          to read comments and ask a question.
        </p>
      ) : (
        <>
          {date.commentsEnabled && <CommentForm action={postComment.bind(null, date.id, privateKey, null)} />}
          {comments.length === 0 ? (
            date.commentsEnabled && <p className="text-sm text-ink-muted">No comments yet. Be the first to say something.</p>
          ) : (
            <ul className="divide-y divide-line">
              {comments.map((c) => {
                const answered = c.isQuestion && c.replies.some((r) => isOrganizer(r.userId));
                return (
                  <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                    <Comment
                      name={c.authorName}
                      organizer={isOrganizer(c.userId)}
                      at={c.createdAt}
                      body={c.body}
                      badge={c.isQuestion ? (answered ? "Answered" : "Question") : null}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {date.commentsEnabled && <ReplyForm action={postComment.bind(null, date.id, privateKey, c.id)} />}
                      {canDelete(c.userId) && (
                        <DeleteCommentButton action={deleteComment.bind(null, c.id)} hasReplies={c.replies.length > 0} />
                      )}
                    </div>
                    {c.replies.length > 0 && (
                      <ul className="mt-3 space-y-3 border-l-2 border-line pl-4">
                        {c.replies.map((r) => (
                          <li key={r.id}>
                            <Comment name={r.authorName} organizer={isOrganizer(r.userId)} at={r.createdAt} body={r.body} badge={null} />
                            {canDelete(r.userId) && (
                              <div className="mt-2">
                                <DeleteCommentButton action={deleteComment.bind(null, r.id)} hasReplies={false} />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Comment({
  name,
  organizer,
  at,
  body,
  badge,
}: {
  name: string;
  organizer: boolean;
  at: Date;
  body: string;
  badge: "Question" | "Answered" | null;
}) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-ink">{name}</span>
        {organizer && <span className="rounded-full bg-royal px-2 py-0.5 text-xs font-medium text-white">Organizer</span>}
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              badge === "Answered" ? "bg-emerald-50 text-emerald-800" : "bg-gold/30 text-gold-ink"
            }`}
          >
            {badge}
          </span>
        )}
        <span className="text-ink-muted">{formatDateTime(at)}</span>
      </p>
      <p className="mt-1 whitespace-pre-line break-words text-ink">{body}</p>
    </div>
  );
}
