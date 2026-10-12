import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-sm py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mb-6 text-sm text-gray-600">Ask a group admin or super user if you think you should.</p>
      <Link href="/" className="text-cobalt underline">
        Back to events
      </Link>
    </div>
  );
}
