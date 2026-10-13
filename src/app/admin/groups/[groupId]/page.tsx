import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { addGroupAdmin, deleteGroup, removeGroupAdmin, updateGroup } from "@/app/admin/actions";
import AddAdminForm from "@/components/admin/AddAdminForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import GroupForm from "@/components/admin/GroupForm";
import { cardClass, primaryButton } from "@/components/ui";
import { formatClock, formatEventDate, formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";
import { describeSchedule, ruleOf, syncAllSeries } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function GroupAdminPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const viewer = await requireGroupAdmin(groupId, `/admin/groups/${groupId}`);
  await syncAllSeries({ groupId });
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      admins: { include: { user: true }, orderBy: { createdAt: "asc" } },
      series: {
        orderBy: { createdAt: "asc" },
        include: {
          dates: {
            where: { startsAt: { gte: new Date() }, status: "SCHEDULED" },
            orderBy: { startsAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!group) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs items={[{ href: "/admin", label: "Admin" }, { label: group.name }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-royal">{group.name}</h1>
            <Link href={`/g/${group.slug}`} className="text-sm text-ink-muted hover:text-cobalt">
              /g/{group.slug}
            </Link>
          </div>
          <Link href={`/admin/groups/${group.id}/events/new`} className={primaryButton}>
            New event
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Events</h2>
        {group.series.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-ink-muted">
            No events yet. Create one to start publishing dates.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {group.series.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/events/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-mist/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {s.title}
                      {s.theme && <span className="text-lapis"> · {s.theme}</span>}
                      {s.visibility === "PRIVATE" && (
                        <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-xs font-medium text-gold-ink">Private</span>
                      )}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {describeSchedule(ruleOf(s))}, {formatClock(s.startTime)} – {formatClock(s.endTime)} · {s.venueName}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Singer {formatPrice(s.singerPriceCents)} · Listener {formatPrice(s.listenerPriceCents)}
                      {s.dates[0] ? ` · Next: ${formatEventDate(s.dates[0].startsAt)}` : " · No upcoming dates"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-cobalt">Manage →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-4 text-xl font-semibold">Group details</h2>
        <GroupForm action={updateGroup.bind(null, group.id)} group={group} />
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-xl font-semibold">Admins</h2>
        <p className="mb-4 text-sm text-ink-muted">Admins can manage this group&apos;s details, events and sign-ups.</p>
        {group.admins.length === 0 ? (
          <p className="mb-4 text-sm text-ink-muted">No admins yet{viewer.isSuperUser ? "; super users can still manage it" : ""}.</p>
        ) : (
          <ul className="mb-4 divide-y divide-line">
            {group.admins.map((a) => (
              <li key={a.userId} className="flex items-center gap-3 py-2">
                {a.user.image && <Image src={a.user.image} alt="" width={28} height={28} className="rounded-full" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.user.name ?? a.user.email}</p>
                  <p className="truncate text-sm text-ink-muted">{a.user.email}</p>
                </div>
                <ConfirmButton
                  action={removeGroupAdmin.bind(null, group.id, a.userId)}
                  label="Remove"
                  confirm={`Remove ${a.user.name ?? a.user.email} as an admin of ${group.name}?`}
                />
              </li>
            ))}
          </ul>
        )}
        <AddAdminForm action={addGroupAdmin.bind(null, group.id)} />
      </section>

      {viewer.isSuperUser && (
        <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-6">
          <h2 className="mb-1 text-xl font-semibold">Delete group</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Deletes the group with all its events, dates and sign-ups. This can&apos;t be undone.
          </p>
          <ConfirmButton
            action={deleteGroup.bind(null, group.id)}
            label="Delete group"
            confirm={`Delete ${group.name} and all its events and sign-ups? This can't be undone.`}
          />
        </section>
      )}
    </div>
  );
}
