"use client";

import NextAuthProvider from "@/components/NextAuthProvider";
import { AuthProvider } from "@/context/AuthContext";
import type { ReactNode } from "react";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <NextAuthProvider>
      <AuthProvider>{children}</AuthProvider>
    </NextAuthProvider>
  );
}
