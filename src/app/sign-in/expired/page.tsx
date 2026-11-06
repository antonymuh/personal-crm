import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ссылка устарела — Личная CRM" };

// Where an old, used or replaced sign-in link leads.
export default function LinkExpiredPage() {
  return (
    <div className="space-y-6 py-10 text-center">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        Ссылка устарела, запроси новую
      </h1>
      <Button asChild>
        <Link href="/sign-in">Получить новую ссылку</Link>
      </Button>
    </div>
  );
}
