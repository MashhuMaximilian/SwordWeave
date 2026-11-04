const prefix = "/api/icons/blob/";
const keyPattern = /^user-uploads\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.(png|jpe?g|webp|gif|svg)$/i;
const blobHost = /^[a-z0-9-]+\.(?:(?:private|public)\.)?blob\.vercel-storage\.com$/;

export function isUploadKey(value: string): boolean {
  return value.length <= 512 && !value.includes("..") && keyPattern.test(value);
}

export function legacyUploadAlias(value: string): { unsignedUrl: string; key: string } | null {
  const unsigned = value.split(/[?#]/, 1)[0] ?? "";
  if (!value.startsWith("https://") || /[\\\s%]/.test(unsigned) || unsigned.includes("..")) return null;
  try {
    const url = new URL(value);
    const key = url.pathname.slice(1);
    if (url.username || url.password || url.port || !blobHost.test(url.hostname) || !isUploadKey(key)) return null;
    return { unsignedUrl: url.origin + url.pathname, key };
  } catch {
    return null;
  }
}

export function uploadKey(value: string): string | null {
  const key = value.startsWith(prefix) ? value.slice(prefix.length) : value.replace(/^\//, "");
  if (isUploadKey(key)) return key;
  return legacyUploadAlias(value)?.key ?? null;
}

export function displayArtworkUrl(value: string): string {
  const key = uploadKey(value);
  return key ? prefix + key : value;
}
