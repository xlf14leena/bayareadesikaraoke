import Link from "next/link";
import Image from "next/image";
import { signIn, signOut } from "@/auth";
import { setViewAs } from "@/app/view-as-actions";
import ViewAsSelect from "@/components/ViewAsSelect";
import { prisma } from "@/lib/prisma";
import { canSwitchView, getViewer, isAnyAdmin, type Viewer } from "@/lib/roles";

export default async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-mist/90 backdrop-blur">
      <div className="toran" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-display text-xl text-royal sm:text-2xl">
          Bay Area <span className="text-lapis">Desi</span> Karaoke
        </Link>

        {viewer ? (
          <div className="flex items-center gap-3 text-sm">
            {isAnyAdmin(viewer) && (
              <Link href="/admin" className="font-medium text-ink hover:text-cobalt">
                Admin
              </Link>
            )}
            {viewer.image && (
              <Image
                src={viewer.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="text-ink-muted hover:text-cobalt">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="whitespace-nowrap rounded-full bg-royal px-4 py-2 text-sm font-medium text-white hover:bg-cobalt"
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with Google</span>
            </button>
          </form>
        )}
      </div>
      {canSwitchView(viewer) && <ViewAsBar viewer={viewer!} />}
    </header>
  );
}

// Lets an admin see the site as a singer, or a super user as one group's admin.
async function ViewAsBar({ viewer }: { viewer: Viewer }) {
  const groups = await prisma.group.findMany({
    where: viewer.real.isSuperUser ? {} : { id: { in: viewer.real.adminGroupIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const options = [
    { value: "", label: viewer.real.isSuperUser ? "Super user (you)" : "Group admin (you)" },
    // Narrowing to one group only means something for super users and admins of several groups.
    ...(viewer.real.isSuperUser || groups.length > 1
      ? groups.map((g) => ({ value: `group:${g.id}`, label: `Admin of ${g.name}` }))
      : []),
    { value: "singer", label: "Singer" },
  ];
  const current = !viewer.viewAs ? "" : viewer.viewAs.kind === "singer" ? "singer" : `group:${viewer.viewAs.groupId}`;

  if (!viewer.viewAs) {
    return (
      <div className="border-t border-line/70 bg-white/60">
        <div className="mx-auto flex max-w-5xl justify-end px-4 py-1.5 text-xs text-ink-muted">
          <ViewAsSelect current={current} options={options} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gold text-gold-ink">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2 text-sm">
        <p className="font-medium">
          {viewer.viewAs.kind === "singer"
            ? "You're viewing the site as a singer."
            : `You're viewing the site as an admin of ${viewer.viewAs.groupName}.`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ViewAsSelect current={current} options={options} />
          <form action={setViewAs}>
            <input type="hidden" name="viewAs" value="" />
            <button type="submit" className="rounded-full bg-royal px-3 py-1 text-xs font-medium text-white hover:bg-cobalt">
              Back to my view
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
