export const dynamic = "force-dynamic";

import { permanentRedirect } from "next/navigation";

export default function RootPage() {
  permanentRedirect("/en");
}
