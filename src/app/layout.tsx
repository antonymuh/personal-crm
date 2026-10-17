import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";

import "./globals.css";

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        <header className="border-b-[3px] border-ink bg-card">
          <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4">
            <Link
              href="/"
              className="flex items-center gap-3 font-display text-lg font-bold tracking-[-0.01em]"
            >
              <Logo className="h-9 w-9" />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
