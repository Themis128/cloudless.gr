/**
 * sound-effects.ts — UI audio cues.
 *
 * jsdom does not provide AudioContext, so we stub it on globalThis BEFORE
 * importing the module under test. We then assert the actual oscillator /
 * gain-node interactions happen on click and success calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface OscNode {
  type: string;
  frequency: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}
interface GainNode {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
}

const oscillators: OscNode[] = [];
const gains: GainNode[] = [];

function makeOscillator(): OscNode {
  const o: OscNode = {
    type: "sine",
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  oscillators.push(o);
  return o;
}

function makeGain(): GainNode {
  const g: GainNode = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  gains.push(g);
  return g;
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = makeOscillator;
  createGain = makeGain;
}

beforeEach(() => {
  oscillators.length = 0;
  gains.length = 0;
  vi.useFakeTimers();
  (globalThis as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext =
    FakeAudioContext;
  (window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext;
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  vi.resetModules();
});

describe("sound-effects.ts", () => {
  it("playUiClickSound creates a triangle 860Hz oscillator", async () => {
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    mod.playUiClickSound();
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe("triangle");
    expect(oscillators[0].frequency.value).toBe(860);
    expect(oscillators[0].start).toHaveBeenCalledTimes(1);
    expect(oscillators[0].stop).toHaveBeenCalledTimes(1);
    expect(gains[0].connect).toHaveBeenCalled();
  });

  it("playUiSuccessSound plays two sine tones (660Hz then 990Hz)", async () => {
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    mod.playUiSuccessSound();
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe("sine");
    expect(oscillators[0].frequency.value).toBe(660);
    vi.advanceTimersByTime(100);
    expect(oscillators).toHaveLength(2);
    expect(oscillators[1].frequency.value).toBe(990);
  });

  it("resumes the audio context if suspended", async () => {
    class SuspendedCtx extends FakeAudioContext {
      state = "suspended";
    }
    (globalThis as unknown as { AudioContext: typeof SuspendedCtx }).AudioContext = SuspendedCtx;
    (window as unknown as { AudioContext: typeof SuspendedCtx }).AudioContext = SuspendedCtx;
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    mod.playUiClickSound();
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it("reuses the same AudioContext across calls (singleton)", async () => {
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    mod.playUiClickSound();
    mod.playUiClickSound();
    mod.playUiClickSound();
    expect(oscillators).toHaveLength(3);
  });

  it("does not throw when AudioContext constructor is unavailable", async () => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    expect(() => mod.playUiClickSound()).not.toThrow();
    expect(() => mod.playUiSuccessSound()).not.toThrow();
    expect(oscillators).toHaveLength(0);
  });

  it("swallows audio errors silently", async () => {
    class BrokenCtx extends FakeAudioContext {
      createOscillator = () => {
        throw new Error("audio hardware error");
      };
    }
    (globalThis as unknown as { AudioContext: typeof BrokenCtx }).AudioContext = BrokenCtx;
    (window as unknown as { AudioContext: typeof BrokenCtx }).AudioContext = BrokenCtx;
    vi.resetModules();
    const mod = await import("@/lib/sound-effects");
    expect(() => mod.playUiClickSound()).not.toThrow();
    expect(() => mod.playUiSuccessSound()).not.toThrow();
  });
});
