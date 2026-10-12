import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Only allow same-site redirects.
  const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

  const session = await auth();
  if (session?.user) redirect(redirectTo);

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-black/10 bg-white p-6 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-gray-600">
        Sign in with your Google account to sign up for events and see who is singing.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-full bg-rose-700 px-4 py-2.5 font-medium text-white hover:bg-rose-800"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
