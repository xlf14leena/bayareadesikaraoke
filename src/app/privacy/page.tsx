export const metadata = { title: "Privacy policy · Bay Area Desi Karaoke" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-gray-800">
      <h1 className="text-2xl font-bold">Privacy policy</h1>
      <p className="text-sm text-gray-500">Last updated October 12, 2026</p>

      <p>
        Bay Area Desi Karaoke lists karaoke events run by local groups and lets people sign up for them.
        This page explains what we collect and why.
      </p>

      <h2 className="pt-2 text-lg font-semibold">What we collect</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>From Google sign-in: your name, email address and profile picture.</li>
        <li>Event sign-ups: whether you are a singer or listener, the songs and YouTube links you enter, and when you entered them.</li>
        <li>Payment proof: the screenshot of your Zelle payment and the memo code. We never see or store your bank login or card details.</li>
      </ul>

      <h2 className="pt-2 text-lg font-semibold">How we use it</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>To sign you in and show your sign-ups.</li>
        <li>To let the group running an event confirm your payment and manage its sign-up list.</li>
        <li>To show signed-in members who is singing and which songs are taken.</li>
        <li>To email you about your sign-ups, such as approvals or a waitlist spot opening.</li>
      </ul>

      <h2 className="pt-2 text-lg font-semibold">Who can see it</h2>
      <p>
        Payment screenshots are visible only to you, that event&apos;s group admins and site administrators.
        Your name and songs are visible to signed-in members viewing that event. We do not sell your information
        or share it with advertisers.
      </p>

      <h2 className="pt-2 text-lg font-semibold">Deleting your data</h2>
      <p>
        To have your account and sign-ups deleted, contact the site administrator through the group that runs your
        event, and we will remove them.
      </p>
    </article>
  );
}
