export const config = {
  matcher: [
    // Match all request paths except static files, Next.js internals, and PWA assets
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html)$).*)",
  ],
};
