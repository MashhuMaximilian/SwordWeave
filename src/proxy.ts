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
  const isSheet = /^\/characters\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/?$/i.test(req.nextUrl.pathname);
  // The sheet server page checks publication/share access. Editing routes stay protected.
  if (isProtectedRoute(req) && !isSheet) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
