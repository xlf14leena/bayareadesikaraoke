import { notFound } from "next/navigation";
import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { createSeries } from "@/app/admin/actions";
import SeriesForm from "@/components/admin/SeriesForm";
import { cardClass } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireGroupAdmin } from "@/lib/roles";

export default async function NewEventPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireGroupAdmin(groupId, `/admin/groups/${groupId}/events/new`);
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { href: "/admin", label: "Admin" },
          { href: `/admin/groups/${group.id}`, label: group.name },
          { label: "New event" },
        ]}
      />
      <h1 className="mb-4 font-display text-3xl text-royal">New event</h1>
      <div className={cardClass}>
        <SeriesForm action={createSeries.bind(null, group.id)} />
      </div>
    </div>
  );
}
