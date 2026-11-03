import Breadcrumbs from "@/app/admin/Breadcrumbs";
import CopyEmails from "@/components/admin/CopyEmails";
import { prisma } from "@/lib/prisma";
import { requireSuperUser } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// Auth.js keeps a database session for 30 days and pushes its expiry forward
// at most once a day while the person uses the site, so the latest expiry
// minus 30 days tells us, to within a day, when they were last on the site.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Super users only: everyone who has signed in with Google.
export default async function UsersPage() {
  await requireSuperUser("/admin/users");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperUser: true,
      createdAt: true,
      sessions: { select: { expires: true }, orderBy: { expires: "desc" }, take: 1 },
      adminOf: { select: { group: { select: { name: true } } } },
      _count: { select: { signUps: true } },
    },
  });
  const emails = users.map((u) => u.email).filter((e): e is string => !!e);

  return (
    <div>
      <Breadcrumbs items={[{ href: "/admin", label: "Admin" }, { label: "Signed-in users" }]} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-royal">Signed-in users</h1>
          <p className="text-ink-muted">
            {users.length} {users.length === 1 ? "person has" : "people have"} signed in with Google, newest first.
          </p>
        </div>
        <CopyEmails emails={emails} />
      </div>
      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-ink-muted">
          Nobody has signed in yet.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {users.map((u) => {
            const lastSession = u.sessions[0];
            const lastSeen = lastSession ? new Date(lastSession.expires.getTime() - SESSION_MAX_AGE_MS) : null;
            const roles = [
              u.isSuperUser && "Super user",
              u.adminOf.length > 0 && `Admin of ${u.adminOf.map((a) => a.group.name).join(", ")}`,
            ].filter(Boolean);
            return (
              <li key={u.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{u.name ?? "No name"}</p>
                  <p className="break-all text-sm text-cobalt">{u.email ?? "No email"}</p>
                  {roles.length > 0 && <p className="text-xs text-ink-muted">{roles.join(" · ")}</p>}
                </div>
                <div className="text-sm text-ink-muted sm:text-right">
                  <p>First signed in {formatDateTime(u.createdAt)}</p>
                  <p>{lastSeen ? `Last on the site around ${formatDateTime(lastSeen)}` : "Signed out"}</p>
                  <p>
                    {u._count.signUps} {u._count.signUps === 1 ? "sign-up" : "sign-ups"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
