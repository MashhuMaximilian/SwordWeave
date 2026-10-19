import { afterEach, describe, expect, it, vi } from "vitest";
import { sendContactMessage } from "@/lib/contact";
import { handleContactRequest, reserveContactAttempt } from "@/lib/server/contact-handler";

const message = { name: "Visitor", email: "visitor@example.org", message: "A question about SwordWeave.", botcheck: "" };
afterEach(() => { vi.unstubAllGlobals(); });

describe("first-party contact form", () => {
  it("posts only validated fields to this website", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await sendContactMessage({ ...message, name: "  Visitor  ", message: "  A question.  " });
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/contact");
    expect(request.credentials).toBe("same-origin");
    expect(JSON.parse(request.body)).toEqual({ ...message, message: "A question." });
  });
  it.each([{ ...message, email: "invalid" }, { ...message, message: "   " }, { ...message, message: "x".repeat(5001) }, { ...message, botcheck: "filled" }])("rejects invalid input before making a request", async input => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendContactMessage(input)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([Response.json({ success: false }), Response.json({ success: "true" }), new Response("not JSON"), Response.json({ success: true }, { status: 500 })])("does not report false success", async response => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(sendContactMessage(message)).rejects.toThrow("couldn’t send");
  });
  it("reports a rate limit without retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendContactMessage(message)).rejects.toThrow("try again later");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not retry uncertain network delivery", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection lost"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendContactMessage(message)).rejects.toThrow("couldn’t confirm");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function request(input: unknown = message, headers: Record<string, string> = {}) {
  return new Request("https://www.swordweave.quest/api/contact", {
    method: "POST", headers: { origin: "https://www.swordweave.quest", "content-type": "application/json", ...headers }, body: JSON.stringify(input),
  });
}

describe("contact backend", () => {
  it("validates on the server and strips injected delivery fields", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const response = await handleContactRequest(request({ ...message, to: "attacker@example.org", from: "forged@example.org" }), { configured: true, deliver, reserve: () => true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(deliver).toHaveBeenCalledWith(message);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([
    [request(message, { origin: "https://other.example" }), 403],
    [request(message, { "content-type": "text/plain" }), 415],
    [request({ ...message, email: "invalid" }), 400],
    [request({ ...message, botcheck: "filled" }), 400],
    [request({ ...message, message: "x".repeat(40_000) }), 413],
  ] as const)("blocks invalid requests without sending mail", async (req, status) => {
    const deliver = vi.fn();
    const response = await handleContactRequest(req, { configured: true, deliver, reserve: () => true });
    expect(response.status).toBe(status);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("fails closed when mail delivery is not configured", async () => {
    const deliver = vi.fn();
    expect((await handleContactRequest(request(), { configured: false, deliver })).status).toBe(503);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("returns Retry-After when the limiter rejects", async () => {
    const deliver = vi.fn();
    const response = await handleContactRequest(request(), { configured: true, deliver, reserve: () => false });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(deliver).not.toHaveBeenCalled();
  });
  it("does not expose SMTP errors or report success when delivery fails", async () => {
    const deliver = vi.fn().mockRejectedValue(new Error("secret SMTP transaction"));
    const response = await handleContactRequest(request(), { configured: true, deliver, reserve: () => true });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
    expect(deliver).toHaveBeenCalledTimes(1);
  });
  it("limits attempts and allows them again after the time window", () => {
    for (let i = 0; i < 5; i++) expect(reserveContactAttempt("rate-limit-test", 100)).toBe(true);
    expect(reserveContactAttempt("rate-limit-test", 101)).toBe(false);
    expect(reserveContactAttempt("rate-limit-test", 901_000)).toBe(true);
  });
});
