/**
 * Reserved username list for SwordWeave. Enforced at signup and on rename.
 * Lowercase only — validation normalizes input before comparing.
 */
export const RESERVED_USERNAMES: ReadonlyArray<{
  username: string;
  reason: string;
}> = [
  // System / staff
  { username: "admin", reason: "system" },
  { username: "administrator", reason: "system" },
  { username: "root", reason: "system" },
  { username: "system", reason: "system" },
  { username: "support", reason: "system" },
  { username: "staff", reason: "system" },
  { username: "mod", reason: "system" },
  { username: "moderator", reason: "system" },
  { username: "swordweave", reason: "brand" },
  { username: "official", reason: "brand" },

  // Reserved keywords
  { username: "null", reason: "reserved" },
  { username: "undefined", reason: "reserved" },
  { username: "deleted", reason: "reserved" },
  { username: "anonymous", reason: "reserved" },
  { username: "anon", reason: "reserved" },
  { username: "api", reason: "reserved" },
  { username: "help", reason: "reserved" },
  { username: "security", reason: "reserved" },
  { username: "dm", reason: "reserved" },
  { username: "dungeonmaster", reason: "reserved" },
  { username: "master", reason: "reserved" },
  { username: "postmaster", reason: "reserved" },
  { username: "webmaster", reason: "reserved" },
  { username: "abuse", reason: "reserved" },
  { username: "spam", reason: "reserved" },
  { username: "test", reason: "reserved" },
  { username: "testing", reason: "reserved" },
  { username: "dev", reason: "reserved" },
  { username: "developer", reason: "reserved" },
  { username: "beta", reason: "reserved" },
  { username: "alpha", reason: "reserved" },
  { username: "www", reason: "reserved" },
  { username: "mail", reason: "reserved" },
  { username: "ftp", reason: "reserved" },
  { username: "ssh", reason: "reserved" },

  // 4-letter common words
  { username: "info", reason: "common-word" },
  { username: "news", reason: "common-word" },
  { username: "blog", reason: "common-word" },
  { username: "shop", reason: "common-word" },
  { username: "store", reason: "common-word" },
  { username: "user", reason: "common-word" },
  { username: "users", reason: "common-word" },
  { username: "post", reason: "common-word" },
  { username: "posts", reason: "common-word" },
  { username: "page", reason: "common-word" },
  { username: "pages", reason: "common-word" },
] as const;