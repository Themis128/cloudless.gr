import { NextRequest, NextResponse } from "next/server";
import { NextAuth } from "@auth/nextjs";
import { getServerSession } from "@auth/nextjs";

export async function requireAuth(request: NextRequest) {
  const session = await auth(request);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export async function requireAdmin(request: NextRequest) {
  const session = await auth(request);
const { user } = session || {};

  if (!user || !user.role || user.role !== "admin") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export async function optionalAuth(request: NextRequest) {
  const session = await getSession(request);
  return NextResponse.next({ request: { headers: { "x-auth-user": session?.user?.id || "" } } });
}