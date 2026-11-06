import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { SignInEmail } from "@/lib/sign-in-email";

// Sends email over SMTP_URL: the Mailpit inbox locally and in tests
// (smtp://localhost:1025), Resend on the server
// (smtps://resend:<API key>@smtp.resend.com:465). Same build everywhere.

export type SendMail = (message: SignInEmail & { to: string }) => Promise<void>;

let transport: Transporter | undefined;

export const sendMail: SendMail = async (message) => {
  if (!transport) {
    const url = process.env.SMTP_URL;
    if (!url) {
      throw new Error(
        "SMTP_URL is not set. Add it to .env (see .env.example)."
      );
    }
    transport = nodemailer.createTransport(url);
  }
  await transport.sendMail(message);
};
