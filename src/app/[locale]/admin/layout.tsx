export const dynamic = "force-dynamic";

import AdminLayoutClient from "./AdminLayoutClient";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
