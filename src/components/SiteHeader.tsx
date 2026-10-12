import Link from "next/link";
import Image from "next/image";
import { signIn, signOut } from "@/auth";
import { getViewer, isAnyAdmin } from "@/lib/roles";

export default async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-rose-700">
          Bay Area Desi Karaoke
        </Link>

        {viewer ? (
          <div className="flex items-center gap-3 text-sm">
            {isAnyAdmin(viewer) && (
              <Link href="/admin" className="font-medium text-gray-700 hover:text-rose-700">
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
              <button type="submit" className="text-gray-600 hover:text-rose-700">
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
              className="whitespace-nowrap rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with Google</span>
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
