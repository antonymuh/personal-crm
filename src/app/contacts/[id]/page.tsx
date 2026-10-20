import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditContactDialog } from "@/components/edit-contact-dialog";
import { DeleteContactDialog } from "@/components/delete-contact-dialog";
import { AddNoteForm } from "@/components/add-note-form";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contactId = Number(id);
  if (!Number.isInteger(contactId)) notFound();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) notFound();

  const noteList = await db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt));

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-blue"
      >
        <ArrowLeft className="h-4 w-4" />
        Ко всем контактам
      </Link>

      <Card className="rounded-window shadow-window">
        <div
          aria-hidden="true"
          className="flex justify-end gap-1.5 rounded-window-bar border-b-[3px] border-ink bg-blue px-3.5 py-2.5"
        >
          <span className="h-3.5 w-3.5 border-2 border-ink bg-yellow" />
          <span className="h-3.5 w-3.5 border-2 border-ink bg-green" />
          <span className="h-3.5 w-3.5 border-2 border-ink bg-red" />
        </div>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-2xl sm:text-3xl">{contact.name}</CardTitle>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <EditContactDialog contact={contact} />
            <DeleteContactDialog contact={contact} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {contact.howWeMet && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{contact.howWeMet}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={`tel:${contact.phone}`} className="font-medium hover:text-blue hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="font-medium hover:text-blue hover:underline">
                {contact.email}
              </a>
            </div>
          )}
          {!contact.howWeMet && !contact.phone && !contact.email && (
            <p className="text-muted-foreground">
              Контактных данных пока нет. Нажмите «Изменить», чтобы добавить.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em]">Заметки</h2>

        <Card className="rounded-sketch-alt p-4 shadow-pop-cyan">
          <AddNoteForm contactId={contact.id} />
        </Card>

        {noteList.length === 0 ? (
          <p className="text-muted-foreground">
            Пока нет заметок. Добавьте первую после разговора.
          </p>
        ) : (
          <ul className="space-y-4">
            {noteList.map((note, i) => (
              <li key={note.id}>
                <div
                  className={`border-[2.5px] border-ink bg-yellow px-4 py-3.5 ${
                    i % 2 === 0
                      ? "rotate-[-0.6deg] rounded-sketch"
                      : "rotate-[0.6deg] rounded-sketch-alt"
                  }`}
                >
                  <p className="font-hand text-lg leading-none font-bold">
                    {formatDateTime(note.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-medium">{note.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
