"use client";

import { ErrorMessage } from "@/components/error-message";

import "./globals.css";

// Replaces the root layout when the layout itself fails, so it brings its own
// <html> and <body>.
export default function GlobalError({
  retry,
}: {
  error: unknown;
  reset: () => void;
  retry: () => void;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <ErrorMessage retry={retry} />
        </main>
      </body>
    </html>
  );
}
