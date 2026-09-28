/** Keep HTML error pages, expired-auth redirects, and empty responses out of JSON.parse errors. */
export async function readJsonResponse<T = Awaited<ReturnType<Response["json"]>>>(response: Response): Promise<T> {
  const text = await response.text();
  const authentication = response.status === 401 || response.status === 403 || (response.redirected && /sign-in|sign-up|clerk/i.test(response.url));
  let value: unknown;
  try { value = JSON.parse(text); }
  catch {
    const reason = authentication ? "Your session needs attention. Sign in again, then retry." : response.status >= 500 ? "The server could not complete this request. Please retry." : "The server returned an unexpected response. Please retry.";
    throw new Error(`${reason} Your current edits have not been cleared. (HTTP ${response.status})`);
  }
  return value as T;
}
