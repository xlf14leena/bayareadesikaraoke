import { prisma } from "@/lib/prisma";
import { requireAnyAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Placeholder admin home. Group and event management arrive in the next build step.
export default async function AdminPage() {
  const viewer = await requireAnyAdmin("/admin");
  const groups = await prisma.group.findMany({
    where: viewer.isSuperUser ? {} : { id: { in: viewer.adminGroupIds } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Admin</h1>
      <p className="mb-6 text-gray-600">
        {viewer.isSuperUser ? "Super user: you can manage every group." : "Groups you manage."}
      </p>
      {groups.length === 0 ? (
        <p className="text-gray-500">No groups yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 rounded-xl border border-black/10 bg-white">
          {groups.map((g) => (
            <li key={g.id} className="p-4">
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-gray-500">/g/{g.slug}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
