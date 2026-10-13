import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getAvailableSlots: vi.fn(),
  isConfiguredAsync: vi.fn(),
  buildWorkersAiToolProtocol: vi.fn(),
  callWorkersAiChat: vi.fn(),
  parseWorkersAiToolCall: vi.fn(),
}));

vi.mock("@/lib/cal-com", () => ({ getAvailableSlots: m.getAvailableSlots }));
vi.mock("@/lib/integrations", () => ({ isConfiguredAsync: m.isConfiguredAsync }));
vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: m.buildWorkersAiToolProtocol,
  callWorkersAiChat: m.callWorkersAiChat,
  parseWorkersAiToolCall: m.parseWorkersAiToolCall,
}));

import { isAgentBookConfigured, proposeBookingSlot } from "@/lib/agent-book";

const SLOT = { start: "2026-06-03T11:00:00.000Z", end: "2026-06-03T11:30:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  m.buildWorkersAiToolProtocol.mockReturnValue("TOOL_PROTOCOL");
  m.getAvailableSlots.mockResolvedValue([SLOT]);
});

describe("isAgentBookConfigured", () => {
  it("delegates to CAL_API_KEY", async () => {
    m.isConfiguredAsync.mockResolvedValue(true);
    expect(await isAgentBookConfigured()).toBe(true);
    expect(m.isConfiguredAsync).toHaveBeenCalledWith("CAL_API_KEY");
  });
});

describe("proposeBookingSlot", () => {
  it("returns the proposed slot with Athens formatting", async () => {
    m.callWorkersAiChat.mockResolvedValue("reply text");
    m.parseWorkersAiToolCall.mockReturnValue({
      name: "propose_slot",
      args: { start: SLOT.start, end: SLOT.end, reasoning: "fits Tuesday" },
    });
    const out = await proposeBookingSlot("next Tuesday afternoon");
    expect(out.status).toBe("proposed");
    expect(out).toMatchObject({
      proposed: { start: SLOT.start, end: SLOT.end },
      reasoning: "fits Tuesday",
    });
    // System prompt carries the tool protocol.
    expect(m.callWorkersAiChat.mock.calls[0][0][0].content).toContain("TOOL_PROTOCOL");
  });

  it("runs the calendar tool then proposes from the fetched list", async () => {
    m.callWorkersAiChat.mockResolvedValue("r");
    m.parseWorkersAiToolCall
      .mockReturnValueOnce({ name: "check_calendar_availability", args: { days_ahead: 3 } })
      .mockReturnValueOnce({
        name: "propose_slot",
        args: { start: SLOT.start, end: SLOT.end, reasoning: "only slot" },
      });
    const out = await proposeBookingSlot("soon");
    expect(out.status).toBe("proposed");
    expect(m.getAvailableSlots).toHaveBeenCalledWith(3);
    const toolResult = m.callWorkersAiChat.mock.calls[1][0].at(-1).content;
    expect(toolResult).toContain("TOOL_RESULT for check_calendar_availability");
    expect(toolResult).toContain(`start=${SLOT.start}`);
  });

  it("reports no open slots and lookup failures inside the tool result", async () => {
    m.getAvailableSlots.mockResolvedValue([]);
    m.callWorkersAiChat.mockResolvedValue("r");
    m.parseWorkersAiToolCall
      .mockReturnValueOnce({ name: "check_calendar_availability", args: {} })
      .mockReturnValueOnce({ name: "propose_slot", args: { start: "", end: "", reasoning: "none" } });
    const out = await proposeBookingSlot("soon");
    const toolResult = m.callWorkersAiChat.mock.calls[1][0].at(-1).content;
    expect(toolResult).toContain("No open slots");
    expect(out).toEqual({ status: "no_match", reasoning: "none" });

    m.getAvailableSlots.mockRejectedValue(new Error("down"));
    m.callWorkersAiChat.mockClear();
    m.parseWorkersAiToolCall.mockReset();
    m.callWorkersAiChat.mockResolvedValue("r");
    m.parseWorkersAiToolCall
      .mockReturnValueOnce({ name: "check_calendar_availability", args: {} })
      .mockReturnValueOnce({ name: "propose_slot", args: { start: "", end: "", reasoning: "" } });
    const out2 = await proposeBookingSlot("soon");
    expect(m.callWorkersAiChat.mock.calls[1][0].at(-1).content).toContain(
      "Calendar lookup failed."
    );
    expect(out2).toEqual({ status: "no_match", reasoning: "No matching slot." });
  });

  it("no_match when the model emits plain text (or empty reply)", async () => {
    m.callWorkersAiChat.mockResolvedValue("I cannot schedule");
    m.parseWorkersAiToolCall.mockReturnValue(null);
    expect(await proposeBookingSlot("x")).toEqual({
      status: "no_match",
      reasoning: "I cannot schedule",
    });
    m.callWorkersAiChat.mockResolvedValue("");
    expect(await proposeBookingSlot("x")).toEqual({
      status: "no_match",
      reasoning: "Model did not propose a slot.",
    });
  });

  it("pushes an unknown-tool result and exhausts the iteration budget", async () => {
    m.callWorkersAiChat.mockResolvedValue("r");
    m.parseWorkersAiToolCall.mockReturnValue({ name: "mystery_tool", args: {} });
    const out = await proposeBookingSlot("x");
    expect(out.status).toBe("no_match");
    expect(out).toMatchObject({ reasoning: expect.stringContaining("iteration budget") });
    expect(m.callWorkersAiChat).toHaveBeenCalledTimes(4);
    expect(m.callWorkersAiChat.mock.calls[1][0].at(-1).content).toContain(
      "Unknown tool: mystery_tool"
    );
  });

  it("treats non-string propose fields as empty → no_match", async () => {
    m.callWorkersAiChat.mockResolvedValue("r");
    m.parseWorkersAiToolCall.mockReturnValue({
      name: "propose_slot",
      args: { start: 123, end: null },
    });
    const out = await proposeBookingSlot("x");
    expect(out).toEqual({ status: "no_match", reasoning: "No matching slot." });
  });
});
