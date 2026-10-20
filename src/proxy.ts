import { NextResponse } from "next/server";
import { isPublicPage, PUBLIC_PAGES, PUBLIC_MARKDOWN_ASSETS, markdownPath } from "@/lib/seo/public-pages";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/atelier(.*)",
  "/sandbox(.*)",
  "/characters(.*)",
  "/settings(.*)",
  "/builds(.*)",
  "/items(.*)",
  "/monsters/new(.*)",
  "/monsters/play(.*)",
]);

// Routes that are explicitly public
const isPublicRoute = createRouteMatcher([
  "/",
  "/u/(.*)",
  "/library(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/api/users/check-username",
]);

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.endsWith('.md')) {
    if (PUBLIC_MARKDOWN_ASSETS.has(req.nextUrl.pathname)) {
      const response = NextResponse.next();
      response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
      response.headers.set('X-Robots-Tag', 'noindex, follow');
      return response;
    }
    if (!Object.keys(PUBLIC_PAGES).some(path => markdownPath(path) === req.nextUrl.pathname)) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    }
    const destination = req.nextUrl.clone();
    destination.pathname = `/api/discovery${req.nextUrl.pathname}`;
    destination.search = '';
    return NextResponse.rewrite(destination);
  }
  const isSheet = /^\/characters\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(req.nextUrl.pathname);
  // The sheet server page checks publication/share access. Editing routes stay protected.
  if (isProtectedRoute(req) && !isSheet) {
    await auth.protect();
  }
  const response = NextResponse.next();
  if (process.env["VERCEL_ENV"] === "preview" || !isPublicPage(req.nextUrl.pathname) || Array.from(req.nextUrl.searchParams.keys()).some(key => !["utm_source", "utm_medium", "utm_campaign", "utm_content"].includes(key))) {
    response.headers.set("X-Robots-Tag", "noindex, follow");
  }
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
