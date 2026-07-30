"use client";

import { AuthProvider } from "@/context/AuthContext";
import type { ReactNode } from "react";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
