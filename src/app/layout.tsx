import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

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
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <Users className="h-5 w-5" />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
