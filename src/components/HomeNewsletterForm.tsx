"use client";

import NewsletterForm from "@/components/NewsletterForm";
import { trackClientEvent } from "@/lib/track-client-event";

export default function HomeNewsletterForm() {
  return (
    <NewsletterForm
      onSuccess={() =>
        trackClientEvent("home_newsletter_subscribe", {
          position: "homepage",
        })
      }
    />
  );
}
