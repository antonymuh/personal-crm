import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTACT_FREQUENCIES,
  NO_FREQUENCY_LABEL,
} from "@/lib/contact-frequency";

type Defaults = {
  name?: string | null;
  howWeMet?: string | null;
  phone?: string | null;
  email?: string | null;
  contactFrequency?: string | null;
  groupIds?: number[];
};

export type GroupOption = { id: number; name: string };

export function ContactFields({
  defaults,
  groups = [],
}: {
  defaults?: Defaults;
  groups?: GroupOption[];
}) {
  const checked = new Set(defaults?.groupIds ?? []);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Имя *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults?.name ?? ""}
          placeholder="Иван Петров"
          required
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="howWeMet">Откуда знакомы</Label>
        <Input
          id="howWeMet"
          name="howWeMet"
          defaultValue={defaults?.howWeMet ?? ""}
          placeholder="Конференция, 2024"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaults?.phone ?? ""}
          placeholder="+7 900 000-00-00"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaults?.email ?? ""}
          placeholder="ivan@example.com"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactFrequency">Частота общения</Label>
        {/* Native select: shadcn Select would need a new dependency. */}
        <select
          id="contactFrequency"
          name="contactFrequency"
          defaultValue={defaults?.contactFrequency ?? ""}
          className="flex h-11 w-full rounded-sketch-alt border-[2.5px] border-input bg-paper px-4 py-1 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{NO_FREQUENCY_LABEL}</option>
          {CONTACT_FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold leading-none">Группы</legend>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label
                key={g.id}
                className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-blob border-2 border-ink bg-paper px-3 py-1.5 text-sm font-medium has-[:checked]:bg-cyan has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="checkbox"
                  name="groupIds"
                  value={g.id}
                  defaultChecked={checked.has(g.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-ink focus-visible:outline-none"
                />
                <span className="truncate">{g.name}</span>
              </label>
            ))}
          </div>
        )}
        <Label
          htmlFor="newGroup"
          className="mt-1 font-normal text-muted-foreground"
        >
          Новая группа
        </Label>
        <Input
          id="newGroup"
          name="newGroup"
          placeholder="Например, Теннис"
          autoComplete="off"
        />
      </fieldset>
    </div>
  );
}
