import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverContactMessage, getContactMailConfig } from "@/lib/server/contact-mail";
import nodemailer from "nodemailer";

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const message = { name: "Visitor", email: "visitor@example.org", message: "Please help.", botcheck: "" };
const config = { host: "smtp.example.org", port: 587, user: "relay-user", password: "test-secret", recipient: "project@example.org" } as const;

describe("SMTP contact delivery", () => {
  it("keeps sending disabled until explicitly enabled and fully configured", () => {
    vi.stubEnv("CONTACT_FORM_ENABLED", "false");
    expect(getContactMailConfig()).toBeNull();
    vi.stubEnv("CONTACT_FORM_ENABLED", "true");
    vi.stubEnv("CONTACT_SMTP_HOST", "");
    expect(getContactMailConfig()).toBeNull();
  });
  it("uses a fixed sender and recipient, visitor Reply-To, and mandatory TLS", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: [config.recipient] });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    await deliverContactMessage(message, config);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: config.host, port: 587, secure: false, requireTLS: true, disableFileAccess: true, disableUrlAccess: true }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: "SwordWeave website", address: "contact@swordweave.quest" }, to: config.recipient, replyTo: message.email, subject: "SwordWeave website contact", text: "Name: Visitor\nReply to: visitor@example.org\n\nPlease help.",
    }));
    expect(JSON.stringify(sendMail.mock.calls)).not.toContain(config.password);
  });
  it("fails when the relay rejects the fixed recipient", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: [], rejected: [config.recipient] });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    await expect(deliverContactMessage(message, config)).rejects.toThrow("not accepted");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
