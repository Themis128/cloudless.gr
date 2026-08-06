import { NextResponse, NextRequest } from 'next/server'

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sitemap\\.xml|robots\\.txt|opengraph-image|twitter-image|icon|apple-icon|portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|map)$).*)",
  ],
}

export default function middleware(req: NextRequest) {
  return NextResponse.next()
}
