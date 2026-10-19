import nodemailer from "nodemailer";
import { z } from "zod";
import { CONTACT_EMAIL } from "@/lib/community";
import type { ContactMessage } from "@/lib/contact";

const mailConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().refine(port => port === 465 || port === 587),
  user: z.string().min(1),
  password: z.string().min(1),
  recipient: z.email(),
});

export function getContactMailConfig() {
  if (process.env["CONTACT_FORM_ENABLED"] !== "true") return null;
  const parsed = mailConfigSchema.safeParse({
    host: process.env["CONTACT_SMTP_HOST"],
    port: process.env["CONTACT_SMTP_PORT"] ?? "587",
    user: process.env["CONTACT_SMTP_USER"],
    password: process.env["CONTACT_SMTP_PASSWORD"],
    recipient: process.env["CONTACT_RECIPIENT"],
  });
  return parsed.success ? parsed.data : null;
}

export async function deliverContactMessage(message: ContactMessage, config: NonNullable<ReturnType<typeof getContactMailConfig>>) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    dnsTimeout: 8_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  // Recipient, sender and subject are server-controlled; visitors cannot
  // email arbitrary people or forge their own From address.
  const result = await transport.sendMail({
    from: { name: "SwordWeave website", address: CONTACT_EMAIL },
    to: config.recipient,
    replyTo: message.email,
    subject: "SwordWeave website contact",
    text: `Name: ${message.name || "Not provided"}\nReply to: ${message.email}\n\n${message.message}`,
  });
  if (!result.accepted?.some((address: string | { address: string }) =>
    (typeof address === "string" ? address : address.address).toLowerCase() === config.recipient.toLowerCase())) {
    throw new Error("Contact message was not accepted by the mail relay.");
  }
}
