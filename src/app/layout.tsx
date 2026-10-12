import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Hind, Rozha_One } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const hind = Hind({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-hind" });
const rozha = Rozha_One({ subsets: ["latin"], weight: "400", variable: "--font-rozha" });

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
    <html lang="en" className={`${hind.variable} ${rozha.variable}`}>
      <body className="min-h-screen bg-mist font-sans text-ink antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-sm text-ink-muted">
          <Link href="/privacy" className="hover:text-cobalt">
            Privacy policy
          </Link>
        </footer>
      </body>
    </html>
  );
}
