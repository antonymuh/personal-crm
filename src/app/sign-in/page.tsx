import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SignInForm } from "@/components/sign-in-form";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Вход — Личная CRM" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
        Вход
      </h1>
      <Card className="rounded-window p-5 shadow-pop-sm sm:p-6">
        <SignInForm />
      </Card>
    </div>
  );
}
