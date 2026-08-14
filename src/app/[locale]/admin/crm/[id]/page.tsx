"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Contact360View } from "@/components/admin/Contact360View";
import type { Contact360 } from "@/lib/crm-contact-360-shared";
import { isEspoRecordId } from "@/lib/crm-contact-360-shared";

export default function AdminCrmContactPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<Contact360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isEspoRecordId(id)) {
      setError("Invalid contact id");
      setLoading(false);
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/admin/crm/contacts/${id}`);
      if (res.status === 503) throw new Error("EspoCRM not configured");
      if (res.status === 404) throw new Error("Contact not found");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Contact360);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contact");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
        <p className="font-mono text-sm text-red-400">{error ?? "Contact not found"}</p>
        <Link
          href="/admin/crm"
          className="text-neon-magenta mt-4 inline-block font-mono text-xs hover:underline"
        >
          ← Contacts
        </Link>
      </div>
    );
  }

  return <Contact360View data={data} />;
}
