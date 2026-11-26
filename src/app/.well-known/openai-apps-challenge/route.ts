export const dynamic = "force-dynamic";

export function GET() {
  const token = process.env["OPENAI_APPS_CHALLENGE_TOKEN"];
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };

  if (!token || !/^[!-~]{1,1024}$/.test(token)) {
    return new Response(null, { status: 404, headers });
  }

  return new Response(token, { headers });
}
