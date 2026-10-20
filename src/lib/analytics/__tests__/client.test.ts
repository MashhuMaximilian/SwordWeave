import { beforeEach, describe, expect, it, vi } from 'vitest';
const consent = vi.hoisted(() => ({ allowed: false }));
vi.mock('@/lib/cookie-consent', () => ({ analyticsConsent: { getSnapshot: () => consent.allowed } }));
beforeEach(() => { vi.resetModules(); consent.allowed = false; vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST123'); });
describe('basic opt-in analytics lifecycle', () => {
  it('loads nothing before consent, sends one view, rejects private data, then stops after withdrawal', async () => {
    const scripts: { src: string }[] = [];
    const target = { location: { href: 'https://www.swordweave.quest/contact?email=secret', hostname: 'www.swordweave.quest' } };
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', { referrer: '', cookie: '_ga=old', createElement: () => ({}), head: { appendChild: (script: { src: string }) => scripts.push(script) } });
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    const { startGoogleAnalytics, googlePageView, stopGoogleAnalytics, track } = await import('../client');
    const action = { name: 'generate_lead', params: { form_id: 'contact' } } as const;
    stopGoogleAnalytics();
    expect(document.cookie).toBe('_ga=old'); // Hydration is not withdrawal.
    startGoogleAnalytics(); track(action); expect(scripts).toHaveLength(0);
    consent.allowed = true; startGoogleAnalytics(); googlePageView(); googlePageView(); track(action);
    expect(scripts).toHaveLength(1);
    const layer = (target as typeof target & { dataLayer: IArguments[] }).dataLayer;
    const commands = layer.map(command => Array.from(command));
    expect(commands.filter(command => command[1] === 'page_view')).toHaveLength(1);
    expect(JSON.stringify(commands)).not.toContain('email=secret');
    expect(commands.filter(command => command[1] === 'generate_lead')).toHaveLength(1);
    consent.allowed = false; stopGoogleAnalytics(); track(action); googlePageView();
    expect(layer).toHaveLength(0);
    expect((target as unknown as Record<string, unknown>)['ga-disable-G-TEST123']).toBe(true);
    expect(scripts).toHaveLength(1);
  });
});
