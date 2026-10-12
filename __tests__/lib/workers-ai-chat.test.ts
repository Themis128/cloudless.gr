import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  runTool: vi.fn(),
  callWorkersAiChat: vi.fn(),
  isNvidiaProxyConfigured: vi.fn(),
  callNvidiaProxyChat: vi.fn(),
  isOllamaConfigured: vi.fn(),
  callOllamaChat: vi.fn(),
  getAvailableSlots: vi.fn(),
}));

vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [{ name: "book_slot", description: "Book", input_schema: {} }],
  runTool: m.runTool,
}));
// Real parser/protocol — only the transport is mocked.
vi.mock("@/lib/workers-ai-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/workers-ai-client")>();
  return { ...actual, callWorkersAiChat: m.callWorkersAiChat };
});
vi.mock("@/lib/nvidia-proxy-client", () => ({
  isNvidiaProxyConfigured: m.isNvidiaProxyConfigured,
  callNvidiaProxyChat: m.callNvidiaProxyChat,
}));
vi.mock("@/lib/ollama-client", () => ({
  isOllamaConfigured: m.isOllamaConfigured,
  callOllamaChat: m.callOllamaChat,
}));
vi.mock("@/lib/cal-com", () => ({ getAvailableSlots: m.getAvailableSlots }));

import { runWorkersAiChatLoop } from "@/lib/workers-ai-chat";

const user = (content: string) => ({ role: "user" as const, content });
const asst = (content: string) => ({ role: "assistant" as const, content });

beforeEach(() => {
  vi.clearAllMocks();
  m.isNvidiaProxyConfigured.mockReturnValue(false);
  m.isOllamaConfigured.mockReturnValue(false);
});

describe("backend chain", () => {
  it("prefers NVIDIA proxy, falls back through Workers AI then Ollama", async () => {
    m.isNvidiaProxyConfigured.mockReturnValue(true);
    m.callNvidiaProxyChat.mockResolvedValueOnce("nvidia says hi");
    expect(await runWorkersAiChatLoop("sys", [user("hi")])).toBe("nvidia says hi");

    m.callNvidiaProxyChat.mockRejectedValueOnce(new Error("nvidia down"));
    m.callWorkersAiChat.mockResolvedValueOnce("cf says hi");
    expect(await runWorkersAiChatLoop("sys", [user("hi")])).toBe("cf says hi");

    m.isOllamaConfigured.mockReturnValue(true);
    m.callWorkersAiChat.mockRejectedValueOnce(new Error("cf down"));
    m.callOllamaChat.mockResolvedValueOnce("ollama says hi");
    expect(await runWorkersAiChatLoop("sys", [user("hi")])).toBe("ollama says hi");
  });

  it("throws last backend error, or UnauthorizedException when nothing configured", async () => {
    m.callWorkersAiChat.mockRejectedValueOnce(new Error("cf blew up"));
    await expect(runWorkersAiChatLoop("sys", [user("hi")])).rejects.toThrow("cf blew up");
    await expect(runWorkersAiChatLoop("sys", [user("hi")])).rejects.toMatchObject({
      name: "UnauthorizedException",
      message: "No chat backend configured",
    });
  });
});

describe("booking short-circuit", () => {
  const slotTable = asst("| Row | Day |\n| 1 | Mon 3 Nov Athens |");

  it("books directly when user replies with row, name, email", async () => {
    m.getAvailableSlots.mockResolvedValueOnce([
      { start: "2026-11-03T09:00:00Z", end: "2026-11-03T09:30:00Z" },
      { start: "2026-11-04T09:00:00Z", end: "2026-11-04T09:30:00Z" },
    ]);
    m.runTool.mockResolvedValueOnce("Booked! Meet: https://meet/x");
    const out = await runWorkersAiChatLoop("sys", [
      user("show me slots"),
      slotTable,
      user("2, Jane Doe, JANE@Example.COM"),
    ]);
    expect(out).toBe("Booked! Meet: https://meet/x");
    expect(m.runTool).toHaveBeenCalledWith("book_slot", {
      name: "Jane Doe",
      email: "jane@example.com",
      start: "2026-11-04T09:00:00Z",
      end: "2026-11-04T09:30:00Z",
    });
    expect(m.callWorkersAiChat).not.toHaveBeenCalled();
  });

  it("re-shows slots when the row is out of range", async () => {
    m.getAvailableSlots.mockResolvedValueOnce([
      { start: "2026-11-03T09:00:00Z", end: "2026-11-03T09:30:00Z" },
    ]);
    const out = await runWorkersAiChatLoop("sys", [
      slotTable,
      user("9, Jane Doe, jane@example.com"),
    ]);
    expect(out).toContain("Row 9 isn't in the current list");
    expect(out).toContain("1. Tue 3 Nov");
    expect(m.runTool).not.toHaveBeenCalled();
  });

  it("returns a friendly error when slot lookup throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.getAvailableSlots.mockRejectedValueOnce(new Error("cal down"));
    const out = await runWorkersAiChatLoop("sys", [slotTable, user("1, Jane Doe, jane@example.com")]);
    expect(out).toContain("ran into a problem while booking");
    err.mockRestore();
  });

  it("does not short-circuit without a slot-table-looking assistant turn", async () => {
    m.callWorkersAiChat.mockResolvedValueOnce("model reply");
    const out = await runWorkersAiChatLoop("sys", [
      asst("plain answer"),
      user("1, Jane Doe, jane@example.com"),
    ]);
    expect(out).toBe("model reply");
    expect(m.getAvailableSlots).not.toHaveBeenCalled();
  });
});

describe("tool loop", () => {
  it("runs tool calls then returns the final reply", async () => {
    m.callWorkersAiChat
      .mockResolvedValueOnce('{"tool":"book_slot","args":{"name":"J"}}')
      .mockResolvedValueOnce("All booked!");
    m.runTool.mockResolvedValueOnce("ok: booked");
    expect(await runWorkersAiChatLoop("sys", [user("book me")])).toBe("All booked!");
    expect(m.runTool).toHaveBeenCalledWith("book_slot", { name: "J" });
  });

  it("returns the friendly recovery for a leaked raw tool call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // malformed JSON — parser returns null, text still looks like a leaked call
    m.callWorkersAiChat.mockResolvedValueOnce('{ "tool": "book_slot", "args": }');
    const out = await runWorkersAiChatLoop("sys", [user("book")]);
    expect(out).toContain("lost track of the context");
    warn.mockRestore();
  });

  it("retries once on leaked reasoning then returns the clean reply", async () => {
    m.callWorkersAiChat
      .mockResolvedValueOnce("We need to check the calendar first for the user")
      .mockResolvedValueOnce("Here are the slots!");
    expect(await runWorkersAiChatLoop("sys", [user("slots?")])).toBe("Here are the slots!");
    expect(m.callWorkersAiChat).toHaveBeenCalledTimes(2);
  });

  it("returns reasoning text when the retry already happened", async () => {
    m.callWorkersAiChat
      .mockResolvedValueOnce("Let me think about this")
      .mockResolvedValueOnce("Let me think some more");
    const out = await runWorkersAiChatLoop("sys", [user("q")]);
    expect(out).toBe("Let me think some more");
  });

  it("hits the tool-call cap after 4 iterations", async () => {
    m.callWorkersAiChat.mockResolvedValue('{"tool":"book_slot","args":{}}');
    m.runTool.mockResolvedValue("ok");
    const out = await runWorkersAiChatLoop("sys", [user("loop")]);
    expect(out).toContain("tool-call limit");
    expect(m.callWorkersAiChat).toHaveBeenCalledTimes(4);
  });

  it("falls back to the apology when the reply is empty", async () => {
    m.callWorkersAiChat.mockResolvedValueOnce("");
    expect(await runWorkersAiChatLoop("sys", [user("hi")])).toContain("could not generate");
  });
});
