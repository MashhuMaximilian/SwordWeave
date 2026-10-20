import { PUBLIC_PAGES, SITE_URL } from '@/lib/seo/public-pages';

export const CAMPAIGNS = {
  utm_source: ['discord', 'itch.io', 'youtube', 'instagram', 'reddit', 'newsletter', 'chatgpt.com', 'perplexity.ai', 'claude.ai'],
  utm_medium: ['referral', 'social', 'video', 'email', 'organic'],
  utm_campaign: ['alpha_01'],
  utm_content: ['profile', 'project_page', 'release', 'first_session_demo', 'creator_kit'],
} as const;
export const DEFINITIONS = {
  sign_up: { method: ['unknown'] }, login: { method: ['unknown'] },
  character_created: { creation_flow: ['quickbuild', 'complete'] },
  generate_lead: { form_id: ['contact'] }, contact_form_started: { form_id: ['contact'] },
  contact_form_error: { form_id: ['contact'], error_type: ['validation', 'rate_limited', 'unavailable', 'delivery_unconfirmed'] },
  discord_invite_click: { placement: ['hero', 'fab', 'footer', 'about', 'contact', 'playtest'] },
  file_download: { book_id: ['phb', 'gm_guide', 'srd'], edition: ['interwoven', 'interwoven_full', 'earlier_dark', 'light', 'dark'], release_version: ['v0.1-alpha'], placement: ['home', 'books', 'reader'] },
  support_click: { placement: ['fab', 'book', 'footer', 'other'] },
  copy_contact_email: { placement: ['contact'] },
} as const;
export type EventName = keyof typeof DEFINITIONS;
type AllowedParams<K extends EventName> = { [P in keyof typeof DEFINITIONS[K]]: typeof DEFINITIONS[K][P] extends readonly string[] ? typeof DEFINITIONS[K][P][number] : never };
export type AnalyticsEvent = { [K in EventName]: { name: K; params: AllowedParams<K> } }[EventName];
export function validEvent(event: AnalyticsEvent): boolean {
  const fields = DEFINITIONS[event.name] as Record<string, readonly string[]> | undefined;
  if (!fields || !event.params || Object.keys(fields).length !== Object.keys(event.params).length) return false;
  return Object.entries(event.params).every(([key, value]) => fields[key]?.includes(value) === true);
}
export function safePage(input: string, referrer = '') {
  const url = new URL(input, SITE_URL);
  const page = PUBLIC_PAGES[url.pathname];
  const location = new URL(page ? url.pathname : '/measurement/private', SITE_URL);
  if (page) for (const [key, allowed] of Object.entries(CAMPAIGNS)) {
    const value = url.searchParams.get(key);
    if (value && (allowed as readonly string[]).includes(value)) location.searchParams.set(key, value);
  }
  let safeReferrer = '';
  try {
    const ref = new URL(referrer);
    if (ref.protocol === 'https:' || ref.protocol === 'http:') {
      safeReferrer = ref.origin === SITE_URL ? (PUBLIC_PAGES[ref.pathname] ? `${SITE_URL}${ref.pathname}` : SITE_URL) : ref.origin;
    }
  } catch { /* Missing referrer is normal. */ }
  return { page_location: location.href, page_title: page?.title ?? 'Private tools', page_referrer: safeReferrer, page_group: page?.group ?? 'private_tools', public: Boolean(page) };
}
