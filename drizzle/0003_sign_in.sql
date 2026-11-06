CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sign_in_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "contacts_name_idx";--> statement-breakpoint
DROP INDEX "groups_name_lower_idx";--> statement-breakpoint
-- Existing contacts and groups get an owner: the user with the email from
-- OWNER_EMAIL (passed in as app.owner_email by scripts/apply-migrations.mjs).
-- The columns start nullable, get filled, and only then become NOT NULL.
ALTER TABLE "contacts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "user_id" text;--> statement-breakpoint
DO $$
DECLARE
  owner_email text := nullif(lower(trim(current_setting('app.owner_email', true))), '');
  owner_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "contacts") AND NOT EXISTS (SELECT 1 FROM "groups") THEN
    RETURN;
  END IF;
  IF owner_email IS NULL THEN
    RAISE EXCEPTION 'OWNER_EMAIL is not set: existing contacts and groups need an owner. Add OWNER_EMAIL=<owner email> to .env and run the migrations again.';
  END IF;
  INSERT INTO "user" ("id", "name", "email", "email_verified")
    VALUES (gen_random_uuid()::text, '', owner_email, true)
    ON CONFLICT ("email") DO NOTHING;
  SELECT "id" INTO owner_id FROM "user" WHERE "email" = owner_email;
  UPDATE "contacts" SET "user_id" = owner_id;
  UPDATE "groups" SET "user_id" = owner_id;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sign_in_emails_email_idx" ON "sign_in_emails" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_user_id_name_idx" ON "contacts" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_user_id_name_lower_idx" ON "groups" USING btree ("user_id",lower("name"));