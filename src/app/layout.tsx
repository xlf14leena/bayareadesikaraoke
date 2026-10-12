import type { Metadata, Viewport } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bay Area Desi Karaoke",
  description: "Find and sign up for Bay Area Desi karaoke nights.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-rose-50/40 text-gray-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-rose-700">
            Privacy policy
          </Link>
        </footer>
      </body>
    </html>
  );
}
