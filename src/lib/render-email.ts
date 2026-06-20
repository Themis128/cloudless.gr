import { render } from "@react-email/components";
import { createElement } from "react";

/**
 * Render a React Email component to HTML + plaintext for SES.
 * Usage: const { html, text } = await renderEmail(OrderConfirmation, { orderId, total });
 */
export async function renderEmail<P extends Record<string, unknown>>(
  component: React.ComponentType<P>,
  props: P
): Promise<{ html: string; text: string }> {
  const element = createElement(component, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}
