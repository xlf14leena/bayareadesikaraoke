import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAnyAdmin } from "@/lib/roles";
import { primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

// Admin home: the groups this person can manage.
export default async function AdminPage() {
  const viewer = await requireAnyAdmin("/admin");
  const groups = await prisma.group.findMany({
    where: viewer.isSuperUser ? {} : { id: { in: viewer.adminGroupIds } },
    orderBy: { name: "asc" },
    include: { _count: { select: { series: true, admins: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-royal">Admin</h1>
          <p className="text-ink-muted">
            {viewer.isSuperUser ? "Super user: you can manage every group." : "Groups you manage."}
          </p>
        </div>
        {viewer.isSuperUser && (
          <Link href="/admin/groups/new" className={primaryButton}>
            New group
          </Link>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
          No groups yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/admin/groups/${g.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-mist/60"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-sm text-ink-muted">
                    /g/{g.slug} · {g._count.series} {g._count.series === 1 ? "event" : "events"} ·{" "}
                    {g._count.admins} {g._count.admins === 1 ? "admin" : "admins"}
                  </p>
                </div>
                <span className="text-sm font-medium text-cobalt">Manage →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
