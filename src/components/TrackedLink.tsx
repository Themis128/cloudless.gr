"use client";

import { Link } from "@/i18n/navigation";
import { trackClientEvent } from "@/lib/track-client-event";
import type { ComponentProps } from "react";

type TrackedLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  event: string;
  params?: Record<string, unknown>;
};

export default function TrackedLink({ event, params, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={() => trackClientEvent(event, params ?? {})}
      className={props.className}
    />
  );
}
