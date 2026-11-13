import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";

import { contactGroups, contacts, groups, notes, user } from "./schema";
import { parseEmail } from "../lib/email";
import { nextBirthday } from "../lib/birthdays";
import {
  CONTACT_FREQUENCIES,
  type ContactFrequency,
} from "../lib/contact-frequency";
import { moscowToday } from "../lib/today";

config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Create .env from .env.example.");
}

// The demo data belongs to the app owner, like the data from before sign-in.
const parsedOwnerEmail = parseEmail(process.env.OWNER_EMAIL);
if (!parsedOwnerEmail.ok) {
  throw new Error(
    "OWNER_EMAIL is not set or is not an email. Add OWNER_EMAIL=<your email> to .env (see .env.example)."
  );
}
const OWNER_EMAIL = parsedOwnerEmail.email;

const TOTAL = 1000;
const GROUP_NAMES = ["Семья", "Друзья", "Знакомые", "Теннис", "Аналитики"];
const RESET_FLAG = "--reset";

const maleFirst = [
  "Александр",
  "Дмитрий",
  "Максим",
  "Сергей",
  "Андрей",
  "Алексей",
  "Артём",
  "Илья",
  "Кирилл",
  "Михаил",
  "Никита",
  "Роман",
  "Егор",
  "Арсений",
  "Иван",
  "Денис",
  "Евгений",
  "Даниил",
  "Тимофей",
  "Владислав",
  "Павел",
  "Георгий",
  "Константин",
  "Пётр",
  "Григорий",
  "Фёдор",
  "Степан",
  "Виктор",
  "Антон",
  "Олег",
];
const femaleFirst = [
  "Анна",
  "Мария",
  "Елена",
  "Дарья",
  "Анастасия",
  "Екатерина",
  "Ольга",
  "Наталья",
  "Татьяна",
  "Ирина",
  "Юлия",
  "Светлана",
  "Виктория",
  "Полина",
  "Ксения",
  "София",
  "Алиса",
  "Вероника",
  "Маргарита",
  "Людмила",
  "Валерия",
  "Евгения",
  "Галина",
  "Алина",
  "Кристина",
  "Оксана",
  "Марина",
  "Любовь",
  "Надежда",
  "Элина",
];
const maleLast = [
  "Иванов",
  "Смирнов",
  "Кузнецов",
  "Попов",
  "Васильев",
  "Петров",
  "Соколов",
  "Михайлов",
  "Новиков",
  "Фёдоров",
  "Морозов",
  "Волков",
  "Алексеев",
  "Лебедев",
  "Семёнов",
  "Егоров",
  "Павлов",
  "Козлов",
  "Степанов",
  "Николаев",
  "Орлов",
  "Андреев",
  "Макаров",
  "Никитин",
  "Захаров",
  "Зайцев",
  "Соловьёв",
  "Борисов",
  "Яковлев",
  "Григорьев",
];
const cities = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Уфа",
  "Ростов-на-Дону",
  "Краснодар",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Сочи",
  "Тюмень",
  "Калининград",
  "Иркутск",
];
const howWeMetTemplates = [
  (c: string) => `Конференция в ${c}`,
  () => "Университет, одногруппник",
  () => "Школа, одноклассник",
  () => "Бывший коллега",
  () => "Через общих друзей",
  () => "Спортзал",
  (c: string) => `Отпуск в ${c}`,
  () => "Сосед",
  () => "Онлайн-курс по программированию",
  () => "Клуб настольных игр",
  () => "Волонтёрство",
  () => "Детский сад детей",
  () => "Профильный чат в Телеграме",
  () => "Собеседование",
  () => "Свадьба друзей",
  (c: string) => `Командировка, ${c}`,
  () => "Книжный клуб",
  () => "Курсы английского",
];
const noteTemplates = [
  "Договорились созвониться на следующей неделе.",
  "Порекомендовал хорошего стоматолога — взять контакт.",
  "Переехал в новый офис, сменил компанию.",
  "У дочки день рождения в марте, не забыть поздравить.",
  "Ищет работу в маркетинге, могу помочь с контактами.",
  "Обсудили совместный проект, жду презентацию.",
  "Любит горные лыжи, звал покататься зимой.",
  "Отдал книгу — надо вернуть.",
  "Помог с переездом, должен ему ужин.",
  "Планирует запускать свой бизнес, нужен совет по налогам.",
  "Познакомил с полезным человеком из банка.",
  "Женился летом, теперь живёт за городом.",
  "Советовал отличный сериал, записал название.",
  "Болел, нужно узнать как самочувствие.",
  "Скинул резюме, обещал посмотреть вакансии.",
  "Говорили про инвестиции, скинет табличку.",
  "Вернулся из путешествия по Азии, много фото.",
  "Просил помочь с ремонтом на выходных.",
  "Сменил телефон — обновить номер при случае.",
  "Отличный контакт по юридическим вопросам.",
];

const translitMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function translit(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => translitMap[ch] ?? (/[a-z0-9]/.test(ch) ? ch : ""))
    .join("");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function feminize(lastName: string): string {
  if (lastName.endsWith("ий")) return lastName.slice(0, -2) + "ая";
  return lastName + "а";
}

const emailDomains = [
  "gmail.com",
  "yandex.ru",
  "mail.ru",
  "outlook.com",
  "icloud.com",
];

type SeedContact = {
  name: string;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  contactFrequency: ContactFrequency | null;
  lastContactedAt: Date | null;
};

const DAY = 1000 * 60 * 60 * 24;
// Approximate period length, only to spread seeded dates around the due date.
const frequencyDays: Record<ContactFrequency, number> = {
  week: 7,
  two_weeks: 14,
  month: 30,
  quarter: 91,
  half_year: 182,
  year: 365,
};

// Birthdays of the first contacts fall today and in the coming week, so the
// "upcoming birthdays" block is never empty after seeding.
const UPCOMING_BIRTHDAY_OFFSETS = [0, 1, 3, 5, 7];
// About half of the contacts have a birth date at all.
const BIRTH_DATE_SHARE = 0.5;
const BLOCK_WINDOW_DAYS = 7;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A birth date whose birthday is `daysAhead` days after `today`.
function birthDateInDays(today: string, daysAhead: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + daysAhead));
  let age = randInt(20, 60);
  // 29 February stays a real date only in leap years.
  if (target.getUTCMonth() === 1 && target.getUTCDate() === 29) {
    age = Math.ceil(age / 4) * 4;
  }
  return isoDate(
    target.getUTCFullYear() - age,
    target.getUTCMonth() + 1,
    target.getUTCDate()
  );
}

// A random birth date whose birthday is not in the block's window.
function birthDateOutsideWindow(today: string): string {
  for (;;) {
    const month = randInt(1, 12);
    const day = randInt(1, month === 2 ? 28 : 30);
    const date = isoDate(randInt(1950, 2005), month, day);
    if (nextBirthday(date, today).daysUntil > BLOCK_WINDOW_DAYS) return date;
  }
}

function buildBirthDate(index: number, today: string): string | null {
  const offset = UPCOMING_BIRTHDAY_OFFSETS[index - 1];
  if (offset !== undefined) return birthDateInDays(today, offset);
  return Math.random() < BIRTH_DATE_SHARE
    ? birthDateOutsideWindow(today)
    : null;
}

function buildContact(index: number, today: string): SeedContact {
  const isMale = Math.random() < 0.5;
  const first = isMale ? pick(maleFirst) : pick(femaleFirst);
  const lastBase = pick(maleLast);
  const last = isMale ? lastBase : feminize(lastBase);
  const name = `${first} ${last}`;

  const city = pick(cities);
  const howWeMet = Math.random() < 0.9 ? pick(howWeMetTemplates)(city) : null;

  const phone =
    Math.random() < 0.9
      ? `+7 9${randInt(10, 99)} ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}`
      : null;

  // Keep emails unique by appending the row index.
  const email =
    Math.random() < 0.85
      ? `${translit(first)}.${translit(last)}${index}@${pick(emailDomains)}`
      : null;

  // About a third of contacts get a frequency. The last contact falls within
  // two periods of it, so roughly half of them are due and half are not yet.
  const contactFrequency =
    Math.random() < 0.33 ? pick(CONTACT_FREQUENCIES.map((f) => f.value)) : null;
  const periodDays = contactFrequency ? frequencyDays[contactFrequency] : 365;
  const lastContactedAt =
    Math.random() < 0.8
      ? new Date(Date.now() - Math.floor(Math.random() * 2 * periodDays * DAY))
      : null;

  return {
    name,
    howWeMet,
    phone,
    email,
    birthDate: buildBirthDate(index, today),
    contactFrequency,
    lastContactedAt,
  };
}

async function main() {
  const client = postgres(connectionString!, { max: 1 });
  const db = drizzle(client, {
    schema: { contacts, notes, groups, contactGroups, user },
  });

  // Seeding replaces everything, so never do it to a non-empty database
  // unless the caller asked for it explicitly.
  const [{ existing, existingGroups }] = await db.execute<{
    existing: number;
    existingGroups: number;
  }>(
    sql`select (select count(*)::int from ${contacts}) as existing, (select count(*)::int from ${groups}) as "existingGroups"`
  );
  const isEmpty = existing === 0 && existingGroups === 0;
  if (!isEmpty && !process.argv.includes(RESET_FLAG)) {
    console.error(
      `Refusing to seed: the database already has ${existing} contacts and ${existingGroups} groups, and seeding deletes all of them.\n` +
        `Nothing was changed. To wipe the database and seed anyway, run: pnpm db:seed ${RESET_FLAG}`
    );
    await client.end();
    process.exit(1);
  }

  if (!isEmpty) {
    console.warn(
      `WARNING: deleting ${existing} existing contacts with all their notes and ${existingGroups} groups…`
    );
    await db.execute(
      sql`truncate table ${contactGroups}, ${groups}, ${notes}, ${contacts} restart identity cascade`
    );
  }

  // The owner signs in with this email later; the first sign-in finds this user.
  await db
    .insert(user)
    .values({
      id: randomUUID(),
      name: "",
      email: OWNER_EMAIL,
      emailVerified: true,
    })
    .onConflictDoNothing();
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, OWNER_EMAIL));
  const userId = owner.id;

  const groupIds = (
    await db
      .insert(groups)
      .values(GROUP_NAMES.map((name) => ({ userId, name })))
      .returning({ id: groups.id })
  ).map((g) => g.id);

  console.log(`Generating ${TOTAL} contacts…`);
  const today = moscowToday();
  const seedContacts: SeedContact[] = Array.from({ length: TOTAL }, (_, i) =>
    buildContact(i + 1, today)
  );

  const now = Date.now();
  const twoYears = 1000 * 60 * 60 * 24 * 365 * 2;
  const CHUNK = 250;
  let totalNotes = 0;
  let totalMemberships = 0;

  for (let i = 0; i < seedContacts.length; i += CHUNK) {
    const chunk = seedContacts.slice(i, i + CHUNK);
    const inserted = await db
      .insert(contacts)
      .values(chunk.map((c) => ({ ...c, userId })))
      .returning({ id: contacts.id });

    const noteRows: { contactId: number; body: string; createdAt: Date }[] = [];
    for (const row of inserted) {
      const count = randInt(0, 4);
      for (let n = 0; n < count; n++) {
        noteRows.push({
          contactId: row.id,
          body: pick(noteTemplates),
          createdAt: new Date(now - Math.floor(Math.random() * twoYears)),
        });
      }
    }
    if (noteRows.length > 0) {
      await db.insert(notes).values(noteRows);
      totalNotes += noteRows.length;
    }

    // About half of the contacts go into one or two groups.
    const membershipRows: { contactId: number; groupId: number }[] = [];
    for (const row of inserted) {
      if (Math.random() >= 0.5) continue;
      const shuffled = [...groupIds].sort(() => Math.random() - 0.5);
      for (const groupId of shuffled.slice(0, randInt(1, 2))) {
        membershipRows.push({ contactId: row.id, groupId });
      }
    }
    if (membershipRows.length > 0) {
      await db.insert(contactGroups).values(membershipRows);
      totalMemberships += membershipRows.length;
    }
    console.log(
      `  inserted ${Math.min(i + CHUNK, seedContacts.length)}/${TOTAL}`
    );
  }

  const [{ c }] = await db.execute<{ c: number }>(
    sql`select count(*)::int as c from ${contacts}`
  );
  console.log(
    `Done for ${OWNER_EMAIL}. Contacts: ${c}, notes: ${totalNotes}, groups: ${groupIds.length}, group memberships: ${totalMemberships}.`
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
