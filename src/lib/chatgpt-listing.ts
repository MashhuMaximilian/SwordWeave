export const CHATGPT_GUIDE_PATH = "/chatgpt";
export const CHATGPT_INSTALL_LABEL = "Get SwordWeave in ChatGPT";

// Set this to the public listing URL from the plugin submission portal after publication.
const PUBLISHED_CHATGPT_LISTING_URL: string | null = null;

export function getChatGptListingUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.origin === "https://chatgpt.com" &&
      /^\/plugins\/[a-z0-9_-]+\/?$/i.test(url.pathname) &&
      !url.username && !url.password && !url.search && !url.hash
    ) {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

export const CHATGPT_LISTING_URL = getChatGptListingUrl(PUBLISHED_CHATGPT_LISTING_URL);
