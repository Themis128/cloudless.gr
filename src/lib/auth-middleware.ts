import { NextRequest, NextResponse } from "next/server";
import { auth } from "@auth/nextjs";
import { getSession } from "@auth/nextjs/edge";

export async function requireAuth(request: NextRequest) {
  const session = await getSession(request);

  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export async function requireAdmin(request: NextRequest) {
  const { user } = await auth(request);

  if (!user || !user.role || user.role !== "admin") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export async function optionalAuth(request: NextRequest) {
  const session = await getSession(request);
  return NextResponse.next({ request: { headers: { "x-auth-user": session?.user?.id || "" } } });
}