import type { Metadata, Viewport } from "next";
import { Hind, Rozha_One } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
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
      <body className="flex min-h-screen flex-col overflow-x-clip bg-mist font-sans text-ink antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
