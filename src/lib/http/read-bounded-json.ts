export class RequestSizeError extends Error {
  constructor(readonly limit: number) { super(`Request exceeds ${limit} bytes.`); }
}
/** Enforce actual streamed bytes as well as the optional Content-Length hint. */
export async function readBoundedJson(request: Request, limit = 1_048_576): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) throw new RequestSizeError(limit);
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("JSON body required.");
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      // A cloned request is a tee: awaiting cancellation can wait indefinitely
      // for the other branch. Reject immediately and let cancellation settle.
      if (bytes > limit) { void reader.cancel().catch(() => {}); throw new RequestSizeError(limit); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
