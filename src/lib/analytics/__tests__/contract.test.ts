import { describe, expect, it } from 'vitest';
import { safePage, validEvent, type AnalyticsEvent } from '../contract';
describe('analytics boundary', () => {
  it('retains registered attribution while excluding arbitrary query data and fragments', () => {
    const page = safePage('https://www.swordweave.quest/start?utm_source=chatgpt.com&utm_medium=referral&email=person@example.com&token=secret#private', 'https://chatgpt.com/c/private-conversation?token=secret');
    expect(page.page_location).toBe('https://www.swordweave.quest/start?utm_source=chatgpt.com&utm_medium=referral');
    expect(page.page_referrer).toBe('https://chatgpt.com');
    expect(safePage('/?utm_source=person@example.com').page_location).toBe('https://www.swordweave.quest/');
  });
  it('suppresses public views and strips all private route details', () => {
    for (const path of ['/characters/private-id?name=private#secret', '/u/username', '/sign-in?redirect_url=private', '/library/item/secret']) {
      const page = safePage(path, 'https://www.swordweave.quest/characters/private');
      expect(page.public).toBe(false);
      expect(page.page_location).toBe('https://www.swordweave.quest/measurement/private');
      expect(page.page_title).toBe('Private tools');
      expect(page.page_referrer).toBe('https://www.swordweave.quest');
    }
  });
  it('rejects unknown fields, missing fields and invented labels even if types are bypassed', () => {
    expect(validEvent({ name: 'generate_lead', params: { form_id: 'contact' } })).toBe(true);
    for (const event of [
      { name: 'generate_lead', params: { form_id: 'contact', email: 'secret' } },
      { name: 'discord_invite_click', params: { placement: 'private-title' } },
      { name: 'file_download', params: {} }, { name: 'arbitrary', params: {} },
    ]) expect(validEvent(event as AnalyticsEvent)).toBe(false);
  });
});
