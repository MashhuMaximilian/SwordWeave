import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().max(80),
  email: z.string().trim().max(254).pipe(z.email()),
  message: z.string().trim().min(1).max(5000),
  botcheck: z.string().max(0),
});
export type ContactMessage = z.input<typeof contactSchema>;
export class ContactDeliveryError extends Error {}

export async function sendContactMessage(input: ContactMessage) {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) throw new ContactDeliveryError("Check your email address and message, then try again.");
  let response: Response;
  try {
    response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify(parsed.data),
    });
  } catch {
    throw new ContactDeliveryError("We couldn’t confirm delivery. Your message is still here; please try again.");
  }
  if (response.status === 429) throw new ContactDeliveryError("Too many messages have been sent. Please try again later.");
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object" || !("success" in result) || result.success !== true) {
    throw new ContactDeliveryError("We couldn’t send your message. Your text is still here; please try again later.");
  }
}
