import { NextResponse } from "next/server";
/** Permission-dependent JSON must never be retained by a shared cache. */
export function privateJson(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(value, {...init, headers});
}
