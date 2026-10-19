import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieConsentConfig } from "vanilla-cookieconsent";

const consent = vi.hoisted(() => ({ allowed: false, config: undefined as CookieConsentConfig | undefined }));
vi.mock("vanilla-cookieconsent", () => ({
  run: vi.fn(async (config: CookieConsentConfig) => { consent.config = config; }),
  acceptedCategory: () => consent.allowed,
  showPreferences: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  consent.allowed = false;
  consent.config = undefined;
});

describe("analytics consent", () => {
  it("blocks before consent, strips URL secrets, and blocks after withdrawal", async () => {
    const { initializeCookieConsent, filterAnalyticsEvent, analyticsConsent } = await import("@/lib/cookie-consent");
    const event = { type: "pageview", url: "https://www.swordweave.quest/contact?email=private@example.org#secret" };
    expect(filterAnalyticsEvent(event)).toBeNull();
    await initializeCookieConsent();
    expect(consent.config?.mode).toBe("opt-in");
    expect(consent.config?.categories["analytics"]?.enabled).toBe(false);
    const listener = vi.fn();
    const unsubscribe = analyticsConsent.subscribe(listener);
    consent.allowed = true;
    consent.config?.onConsent?.({ cookie: {} as never });
    expect(filterAnalyticsEvent(event)).toEqual({ ...event, url: "https://www.swordweave.quest/contact" });
    consent.allowed = false;
    consent.config?.onChange?.({ cookie: {} as never, changedCategories: ["analytics"], changedServices: {} });
    expect(filterAnalyticsEvent(event)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it("initializes once across repeated mounts and preferences requests", async () => {
    const { initializeCookieConsent, showCookiePreferences } = await import("@/lib/cookie-consent");
    const cookieConsent = await import("vanilla-cookieconsent");
    const before = vi.mocked(cookieConsent.run).mock.calls.length;
    await Promise.all([initializeCookieConsent(), initializeCookieConsent(), showCookiePreferences()]);
    expect(vi.mocked(cookieConsent.run).mock.calls.length - before).toBe(1);
    expect(cookieConsent.showPreferences).toHaveBeenCalled();
  });
});
