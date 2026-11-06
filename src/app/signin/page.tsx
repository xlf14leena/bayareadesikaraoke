import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { primaryButton } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";

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
        <SubmitButton className={`${primaryButton} w-full`}>
          Sign in with Google
        </SubmitButton>
      </form>
    </div>
  );
}
