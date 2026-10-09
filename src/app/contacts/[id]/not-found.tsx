import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">Контакт не найден</h1>
      <p className="text-muted-foreground">
        Возможно, его удалили или ссылка неверная.
      </p>
      <Button asChild>
        <Link href="/">Ко всем контактам</Link>
      </Button>
    </div>
  );
}
