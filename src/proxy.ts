import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/characters(.*)",
  "/monsters(.*)",
  "/items(.*)",
  "/admin(.*)",
]);

const isProtectedWriteApi = createRouteMatcher([
  "/api/effects(.*)",
  "/api/primitives/import(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const isWriteRequest = !["GET", "HEAD", "OPTIONS"].includes(request.method);

  if (
    isProtectedRoute(request) ||
    (isWriteRequest && isProtectedWriteApi(request))
  ) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
