import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { NavbarAuth } from "../components/navbar-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Copilot - AI Co-Pilot for Test Engineers",
  description: "Production-ready AI SaaS for test generation, bug analysis, release risk, and QA automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-[1360px] px-4 py-4 sm:px-6 lg:px-8">
          <header className="sticky top-4 z-50 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-[#dbe4ff] bg-white/78 px-5 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <Link href="/" className="flex items-center gap-3 rounded-full pr-3 text-[var(--foreground)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#111827_0%,#3730a3_55%,#0ea5e9_100%)] text-white shadow-[0_12px_28px_rgba(79,70,229,0.24)]">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-[-0.02em]">QA Copilot</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Structured AI for test teams</p>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <nav className="hidden items-center gap-2 rounded-full border border-[#dbe4ff] bg-[#f8fbff]/92 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:flex">
                  <Link className="rounded-full px-4 py-2 text-sm text-[var(--foreground)]/80 transition duration-200 hover:bg-white" href="/#features">
                    Features
                  </Link>
                  <Link className="rounded-full px-4 py-2 text-sm text-[var(--foreground)]/80 transition duration-200 hover:bg-white" href="/#pricing">
                    Pricing
                  </Link>
                </nav>
              <NavbarAuth />
            </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
