/**
 * Chat loop for /api/chat (Cloudless Assistant).
 *
 * Primary backend: NVIDIA postiz-ai-proxy Worker (nemotron-3.5-lightning-30b-a3b
 * with extended thinking). Reasoning content is stripped in the Worker before
 * returning, so visitors only see the final reply.
 *
 * Fallback: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) when
 * NVIDIA_PROXY_URL / NVIDIA_PROXY_TOKEN are not set in the pod env.
 *
 * Tool calling uses the same lightweight JSON protocol (TOOL_CALL/TOOL_RESULT)
 * regardless of which backend is active.
 */

import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";
import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  parseWorkersAiToolCall,
} from "@/lib/workers-ai-client";
import { isNvidiaProxyConfigured, callNvidiaProxyChat } from "@/lib/nvidia-proxy-client";
import { isOllamaConfigured, callOllamaChat } from "@/lib/ollama-client";
import { getAvailableSlots } from "@/lib/google-calendar";
import { DEFAULT_DAYS_AHEAD } from "@/lib/booking-slots";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

// ---------------------------------------------------------------------------
// Booking-reply short-circuit
// ---------------------------------------------------------------------------
// The model reliably loops back to check_calendar_availability when the
// visitor sends "row, name, email" because BOOKING_ISO_DATA only lives inside
// the tool-call exchange of the previous turn and is not preserved in the
// client-side message history. We intercept this pattern server-side and call
// book_slot directly — the model only generates the confirmation text.

// Matches "5, Themis Baltzakis, themis@example.com" with optional whitespace
const BOOKING_REPLY_RE =
  /^\s*(\d+)\s*,\s*([^,]+?)\s*,\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\s*$/;

function tryParseBookingReply(msg: string): { row: number; name: string; email: string } | null {
  const m = BOOKING_REPLY_RE.exec(msg.trim());
  if (!m) return null;
  return { row: parseInt(m[1], 10), name: m[2].trim(), email: m[3].trim().toLowerCase() };
}

// Detect raw JSON tool-call leaking as final text — happens with llama-3.1-8b
// when context is lost and the model outputs the tool call as prose.
function looksLikeLeakedToolCall(text: string): boolean {
  return /^\s*\{[\s\S]*"tool"\s*:/.test(text.trim());
}

// Detect when the model outputs reasoning instead of a visitor-facing reply
const REASONING_PATTERNS =
  /^(we need to|i need to|let me|the user|we should|to book|looking at|it seems|we must|however we|given the|since we|the slot|need iso|the tool|let's assume)/i;

function looksLikeLeakedReasoning(text: string): boolean {
  const t = text.trim();
  return (
    REASONING_PATTERNS.test(t) ||
    (t.length > 250 &&
      /we need to|i need to|let me think|we should call|we must|the model/i.test(t))
  );
}

async function callChatBackend(messages: { role: string; content: string }[]): Promise<string> {
  if (isNvidiaProxyConfigured()) {
    return callNvidiaProxyChat(messages, { maxTokens: MAX_TOKENS });
  }
  // Try Workers AI directly; if credentials are absent it throws UnauthorizedException
  // which we catch to fall through to the next backend.
  try {
    return await callWorkersAiChat(messages, { maxTokens: MAX_TOKENS });
  } catch (e) {
    if (!(e instanceof Error && e.name === "UnauthorizedException")) throw e;
  }
  if (isOllamaConfigured()) {
    return callOllamaChat(messages, { maxTokens: MAX_TOKENS });
  }
  const err = new Error("No chat backend configured");
  err.name = "UnauthorizedException";
  throw err;
}

/**
 * Run the chat-tool loop.
 * May throw on config/API errors; caller maps them to HTTP status codes.
 */
export async function runWorkersAiChatLoop(
  systemPrompt: string,
  initialMessages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\n${buildWorkersAiToolProtocol(CHAT_TOOLS)}`,
    },
    ...initialMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // --- Booking-reply short-circuit ---
  // If the last user message matches "row, name, email", handle the booking
  // server-side and skip the model's tool loop entirely. llama-3.1-8b reliably
  // loops back to check_calendar_availability because BOOKING_ISO_DATA only
  // lives in the prior tool-call exchange and is not in the client message
  // history. We fire this whenever the pattern matches — the previous assistant
  // message check is lenient: "Athens" alone (covers tab-separated tables, pipe
  // tables, and any format the model chooses).
  const lastUserMsg = initialMessages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const bookingReply = tryParseBookingReply(lastUserMsg);
  if (bookingReply) {
    const prevAssistant = [...initialMessages].reverse().find((m) => m.role === "assistant");
    // Accept any prior assistant message that looks like a slot table:
    // - markdown pipe table (|), tab-separated table, or the prompt phrase
    const prevContent = prevAssistant?.content ?? "";
    const looksLikeSlotTable =
      prevContent.includes("Athens") ||
      /please reply with your row/i.test(prevContent) ||
      /\d+\s*[,\t|]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(prevContent);
    if (looksLikeSlotTable) {
      try {
        const slots = await getAvailableSlots(DEFAULT_DAYS_AHEAD);
        const slot = slots[bookingReply.row - 1];
        if (slot) {
          const bookResult = await runTool("book_slot", {
            name: bookingReply.name,
            email: bookingReply.email,
            start: slot.start,
            end: slot.end,
          });
          // Ask the model to turn the raw tool result into a friendly reply
          messages.push({
            role: "user",
            content: `TOOL_RESULT for book_slot:\n${bookResult}\n\nConfirm the booking to the visitor in 2-3 warm sentences. Include the Meet link if provided.`,
          });
          const confirmation = await callChatBackend(messages);
          return confirmation || bookResult;
        }
        // Row out of range — show current slots so visitor can pick again
        const slotLines = slots
          .map(
            (s, i) =>
              `${i + 1}. ${new Date(s.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${new Date(s.start).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" })}–${new Date(s.end).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" })}`
          )
          .join("\n");
        return `Row ${bookingReply.row} isn't in the current list — the available slots may have refreshed. Here are the current ones:\n\n${slotLines}\n\nPlease reply with your row number, full name, and email all at once.`;
      } catch (err) {
        console.error("[chat] booking short-circuit failed:", err);
        return "Sorry, I ran into a problem while booking your slot. Please try again or contact us directly at hello@cloudless.gr.";
      }
    }
  }

  let reasoningRetried = false;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const reply = await callChatBackend(messages);
    const toolCall = parseWorkersAiToolCall(reply);
    if (!toolCall) {
      // If the model leaked a raw JSON tool call as prose (common with llama-3.1-8b
      // when context is lost), return a friendly recovery message instead.
      if (looksLikeLeakedToolCall(reply)) {
        console.warn("[chat] model leaked raw tool call as final reply:", reply.slice(0, 120));
        return 'Sorry, I lost track of the context. Could you rephrase your request? If you were trying to book, please tell me your preferred slot number, full name, and email — e.g. "3, Jane Smith, jane@example.com".';
      }
      // If the model leaked reasoning as plain text, give it one silent retry
      if (!reasoningRetried && looksLikeLeakedReasoning(reply)) {
        reasoningRetried = true;
        messages.push({ role: "assistant", content: reply });
        messages.push({
          role: "user",
          content:
            "Please send your final reply to the visitor now. No reasoning — just the message they should read.",
        });
        continue;
      }
      return reply || "Sorry — I could not generate a reply.";
    }

    messages.push({ role: "assistant", content: reply });
    const toolResult = await runTool(toolCall.name, toolCall.args);
    messages.push({
      role: "user",
      content: `TOOL_RESULT for ${toolCall.name}:\n${toolResult}`,
    });
  }

  return "I hit a tool-call limit — please try again with a simpler question, or use the Contact page.";
}

/** @deprecated name kept for gradual call-site migration */
export const runBedrockChatLoop = runWorkersAiChatLoop;
