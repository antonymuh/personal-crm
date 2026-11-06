# Design

## Context

- Мотивация — `proposal.md`, поведение — `specs/user-sign-in`, `specs/data-ownership`, `specs/contact-groups`.
- Сейчас входа нет. Данные читаются и пишутся только на сервере: Server Components (`src/app/page.tsx`, `src/app/contacts/[id]/page.tsx`) и Server Actions (`src/app/actions.ts`). Функции данных в `src/db/` (`contact-list.ts`, `contact-form.ts`, `groups.ts`) принимают `executor`, но не знают о пользователе; часть запросов написана прямо в `actions.ts` и на странице карточки.
- `groups` уникальны по `lower(name)` на всю базу (`groups_name_lower_idx`).
- Миграции — SQL-файлы Drizzle в `drizzle/`, применяются разовым контейнером (`scripts/migrate.mjs`) до старта нового образа; `deploy.sh` перед этим делает бэкап базы. Тесты: Vitest на отдельной тестовой базе (`test/prepare-database.ts` гоняет те же миграции), Playwright на production-сборке и отдельной e2e-базе, каждый тест с пустой базы.
- Ограничения из спеки владельца: Better Auth + MagicLink, Nodemailer, Resend на сервере, Mailpit локально и в CI; одна сборка для всех окружений.
- Проверено по исходникам `better-auth@1.7.18` (последняя стабильная): токен ссылки хранится в таблице `verification` с `identifier = "magic-link:<token>"` и `value = {"type":"magic-link","email":...}`; ссылка гасится атомарно при первом открытии; срок по умолчанию 5 минут (меняется `expiresIn`); старые ссылки при запросе новой **не** гасятся; ошибки проверки ссылки ведут на `errorCallbackURL?error=INVALID_TOKEN`; встроенный лимит запросов — по IP (3 за 10 с на `/sign-in/*`, 5 за 60 с у плагина), а не по почте.

## Goals / Non-Goals

**Goals:**
- Одна точка правил запроса ссылки (нормализация почты, проверка, лимит, отмена старых ссылок), через которую проходят и форма, и прямой HTTP-запрос к Better Auth.
- Пользователь передаётся в каждую функцию данных явно; ни один запрос к `contacts`, `notes`, `groups`, `contact_groups` не обходится без условия на владельца.
- Перенос существующих данных — одной миграцией, атомарно: либо всё перенесено и колонки владельца обязательные, либо ничего не изменилось.

**Non-Goals:**
- Защита на уровне базы (row-level security) — проверка владельца в коде сервера достаточна для этого объёма.
- Лимит запросов по IP — в спеке его нет (см. Decisions).
- Очистка старых сессий и записей лимита по расписанию.

## Decisions

### 1. Better Auth: плагин magicLink + адаптер Drizzle, обработчик `/api/auth/[...all]`
- `src/lib/auth.ts` (server-only): `betterAuth({ database: drizzleAdapter(db, { provider: "pg", schema }), plugins: [magicLink({ expiresIn: 900, sendMagicLink }), nextCookies()] })`. Таблицы `user`, `session`, `account`, `verification` описываются в `src/db/schema.ts` (сгенерировать CLI Better Auth, затем `drizzle-kit generate`), чтобы схема и миграции оставались в коде.
- `src/app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)`: по нему открывается ссылка из письма (`/api/auth/magic-link/verify`).
- `callbackURL = "/"`, `errorCallbackURL = "/sign-in/expired"` — любая ошибка проверки ссылки (устарела, использована, отменена) ведёт на одну страницу «Ссылка устарела, запроси новую».
- Модуль, как и `src/db/index.ts`, не падает при `next build` без настроек: секрет и адрес обязательны только при работе приложения.
- Альтернатива — свой вход на таблице токенов: отклонена, Better Auth задан спекой.

### 2. Правила запроса ссылки — в `hooks.before` Better Auth, форма — Server Action
- Хук на путь `/sign-in/magic-link` выполняется и при вызове `auth.api.signInMagicLink` из Server Action, и при прямом POST на `/api/auth/sign-in/magic-link`. В нём по порядку: почта → `trim().toLowerCase()`; проверка адреса (своя функция `src/lib/email.ts`, та же, что в форме) → ошибка `INVALID_EMAIL`; лимит (решение 3) → ошибка `TOO_MANY_REQUESTS`; удаление прежних записей `verification` этой почты (`identifier like 'magic-link:%' and value::jsonb->>'email' = $email`) — так новая ссылка отменяет старые; подмена `callbackURL`/`errorCallbackURL` на наши, чтобы прямой запрос не задал свои.
- Server Action `requestSignInLink` вызывает `auth.api.signInMagicLink` и превращает коды ошибок в тексты: «Проверь адрес почты» под полем, «Слишком часто, попробуй через несколько минут». При успехе — всегда «Ссылка для входа отправлена на <почта>», независимо от того, есть ли пользователь (Better Auth в ответе этого и не различает).
- Альтернатива — правила только в Server Action и закрыть HTTP-путь через `disabledPaths`: отклонена, правила разъехались бы, а спека требует одинаковой проверки «даже если запрос не из формы».

### 3. Лимит писем — своя таблица `sign_in_emails`
- Колонки: `id`, `email`, `sent_at`. В транзакции: `pg_advisory_xact_lock(hashtext(email))` (два одновременных запроса не проскочат лимит), удалить записи этой почты старше 10 минут, посчитать оставшиеся; `>= 3` → отказ, иначе вставить запись. Скользящее окно 10 минут от первого письма в окне.
- Встроенный лимит Better Auth по IP выключаем (`rateLimit: { enabled: false }`): в спеке лимит только по почте; встроенный (5 открытий ссылки в минуту с одного IP) ломает e2e, где все тесты идут с `127.0.0.1`, а за nginx требует настройки пересылки IP. Если нужна защита по IP — отдельное решение владельца.

### 4. Сессия 30 дней со скольжением, проверка в `proxy.ts` и на сервере
- `session: { expiresIn: 30 дней, updateAge: 1 час }`: заход продлевает срок до «сейчас + 30 дней» (не чаще раза в час — лишняя запись в базу не на каждый запрос). Сессии на каждом устройстве свои; «Выйти» (`auth.api.signOut`) удаляет только текущую.
- `src/proxy.ts` (Next.js 16, бывший middleware, Node runtime): для всех путей, кроме `/sign-in*`, `/api/auth/*`, `/health` и статики, вызывает `auth.api.getSession({ headers, returnHeaders: true })`; нет сессии → редирект на `/sign-in`; есть — переносит `Set-Cookie` в ответ, чтобы продлевалась и кука, а не только запись в базе (Server Components куки менять не могут).
- `proxy.ts` — только первая линия. Настоящая проверка — `requireUser()` (`src/lib/session.ts`, server-only) в каждой странице и в каждом Server Action первым делом: нет сессии → редирект на `/sign-in`, Server Action ничего не меняет.
- Залогиненный пользователь на `/sign-in` перенаправляется на `/`.

### 5. Владелец в данных
- `contacts.user_id` и `groups.user_id`: `text not null references "user"(id) on delete cascade`. Индексы: `contacts (user_id, name)` вместо `contacts_name_idx`; уникальный `groups (user_id, lower(name))` вместо `groups_name_lower_idx`. У `notes` и `contact_groups` своей колонки нет: заметка принадлежит владельцу контакта, членство — паре своих контакта и группы.
- Все функции данных получают `userId` первым аргументом: `listContacts`, `getContactGroups`, `listGroups`, `findOrCreateGroup`, `setContactGroups`, `renameGroup`, `deleteGroup`, `createContactFromForm`, `updateContactFromForm`; запросы из `actions.ts` (удалить контакт, заметка, «Пообщались») и со страницы карточки переезжают в `src/db/contacts.ts` с тем же правилом.
- Чужая запись = несуществующая: условие `and(eq(id), eq(userId))` в `where` у select/update/delete; при 0 строк — «Контакт не найден» / «Группа не найдена» / `notFound()`. Заметка вставляется через `insert ... select ... where contact.user_id = $userId`. `setContactGroups` берёт только группы этого пользователя — чужой `groupId` из формы молча отбрасывается, как сейчас удалённая группа.
- Альтернатива — `user_id` и в `notes`/`contact_groups`: отклонена, дублирует владельца и может разойтись с контактом.

### 6. Миграция с переносом данных: почта владельца из настройки окружения
- Одна миграция Drizzle (SQL сгенерирован `drizzle-kit generate` и дописан руками), вся в одной транзакции мигратора: создать таблицы Better Auth и `sign_in_emails`; добавить `user_id` как `null`-разрешённые; блок `DO`: если в `contacts` или `groups` есть строки — взять `lower(trim(current_setting('app.owner_email', true)))`, пусто → `RAISE EXCEPTION 'OWNER_EMAIL is not set...'`; создать пользователя с этой почтой, если его нет (`id = gen_random_uuid()::text`, `name = ''`, `email_verified = true`); проставить его `id` во все строки `contacts` и `groups`; затем `SET NOT NULL`, внешние ключи, замена индексов.
- `scripts/migrate.mjs` и `test/prepare-database.ts` перед `migrate()` делают `select set_config('app.owner_email', $OWNER_EMAIL, false)` на том же единственном соединении (`max: 1`). Почта не попадает в git.
- Нет настройки при непустой базе → миграция падает → `deploy.sh` останавливается до старта нового образа (уже так устроен), база не изменена. Пустая база (CI, тесты) — настройка не нужна.
- Миграция меняет существующие данные — по правилам проекта показать её владельцу до merge.
- Альтернатива — отдельный скрипт «присвоить данные» после миграций: отклонена, тогда `NOT NULL` нельзя поставить в той же миграции, и появляется окно, когда новая версия работает с данными без владельца.

### 7. Почта: Nodemailer, транспорт из `SMTP_URL`
- `src/lib/mail.ts`: `nodemailer.createTransport(process.env.SMTP_URL)`. Локально и в CI `smtp://localhost:1025` (Mailpit), на сервере `smtps://resend:<API-ключ>@smtp.resend.com:465`. Сборка одна, различаются только настройки.
- Письмо собирает чистая функция `buildSignInEmail(url)` → `{ from, subject, html, text }`: `from` = `"Личная CRM" <noreply@mail.crm.pocketcrm.co>` (константа: адрес задан спекой), тема «Вход в Личную CRM», кнопка «Войти», «Ссылка работает 15 минут», «Если вы не запрашивали вход - просто проигнорируйте письмо».
- `sendMagicLink` получает отправителя через параметр фабрики `createAuth({ sendMail })`: приложение передаёт Nodemailer, Vitest-тесты — сборщик писем в память (в job `checks` CI нет Mailpit). e2e — без подмен, через настоящий Mailpit.
- `nodemailer@10` содержит свои типы, `@types/nodemailer` не нужен.

### 8. Mailpit локально и в CI, e2e входит через него
- `docker-compose.yml`: сервис `mailpit` (`axllent/mailpit:v1.33`), порты `1025` (SMTP) и `8025` (страница ящика в браузере). CI, job `e2e`: тот же образ как service.
- `e2e/mailpit.ts`: найти последнее письмо на адрес через API Mailpit (`/api/v1/search?query=to:...`), достать ссылку «Войти»; очистка ящика (`DELETE /api/v1/messages`) в авто-фикстуре вместе с очисткой базы.
- `e2e/fixtures.ts`: фикстура `signIn(page, email)` — форма → письмо в Mailpit → открыть ссылку. Существующие тесты (`main-scenario`, `groups`, `keep-in-touch`, `mobile`) перед сценарием входят под `owner@example.com`; «другой браузер» в главном сценарии — новый контекст, вошедший под той же почтой. Новый `e2e/sign-in.spec.ts` — сценарии входа и критерий успеха с пользователями A и B.
- Сценарии про время (15 минут, 30 дней, окно лимита 10 минут) — сдвигом времени в базе e2e/тестовой базы (`expires_at` у `verification`/`session`, `sent_at` у `sign_in_emails`), без ожидания.
- В `playwright.config.ts` в `webServer.env` добавляются `SMTP_URL`, `BETTER_AUTH_URL=http://127.0.0.1:3100`, тестовый `BETTER_AUTH_SECRET`.

### 9. Настройки
- Новые переменные в `.env.example` и `deploy/.env.example` (без значений, с подсказками): `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (`http://localhost:3000` / `https://app.pocketcrm.co`), `SMTP_URL`, `OWNER_EMAIL`.
- `pnpm db:seed` берёт `OWNER_EMAIL` из `.env`, находит или создаёт пользователя и создаёт демо-данные у него; без `OWNER_EMAIL` — понятная ошибка.

## Risks / Trade-offs

- [Забыть условие на владельца в новом запросе] → `userId` — обязательный первый аргумент всех функций данных; Vitest-тест на каждую функцию «пользователь B не видит/не меняет запись A»; e2e A/B из спеки.
- [Better Auth меняет формат `verification` и отмена старых ссылок перестаёт работать] → отмена покрыта тестом «запросил новую — первая устарела»; версия фиксируется в `pnpm-lock.yaml`, обновления Dependabot идут через CI.
- [Откат после выкатки] → только вместе: база из бэкапа, снятого `deploy.sh` перед этой выкаткой, и прошлый образ. Прошлая версия не понимает новых таблиц и `NOT NULL user_id` — откатывать один образ нельзя. Описать в README.
- [На сервере не заданы новые настройки] → без `OWNER_EMAIL` миграция падает до старта нового образа; без `BETTER_AUTH_SECRET`/`SMTP_URL` приложение падает при старте — smoke `/health` красный, выкатка считается упавшей, владелец решает про откат.
- [Resend: ключ и домен] → ключ создаёт владелец (доступ только на отправку, только домен `mail.crm.pocketcrm.co`) и сам кладёт в `.env` сервера; проверка — настоящей выкаткой и письмом себе.
- [Без лимита по IP можно слать письма на много разных адресов] → принятое ограничение спеки; при злоупотреблении — включить лимит Better Auth по IP отдельной правкой.
- [Кука не продлевается, если запрос не прошёл через `proxy.ts`] → `proxy.ts` покрывает все страницы приложения; e2e-тест «вернулся через неделю» проверяет продление срока.

## Migration Plan

1. Владелец добавляет в `.env` на сервере (права 600) строки `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://app.pocketcrm.co`, `SMTP_URL` с ключом Resend, `OWNER_EMAIL=<своя почта>` — до merge.
2. Владелец смотрит SQL миграции переноса данных до merge.
3. Merge → обычная выкатка: бэкап базы → миграция (таблицы входа, владелец у данных, перенос на `OWNER_EMAIL`) → новый образ → smoke `/health`.
4. Проверка руками: открыть приложение — страница входа; войти своей почтой — все прежние контакты на месте, их число совпадает с числом до выкатки.
5. Откат (запускает только владелец): restore бэкапа `before-<прошлая версия>` и `./deploy.sh <прошлая версия>` — вместе.
