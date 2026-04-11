type ToneType = "sine" | "square" | "sawtooth" | "triangle";

type ToneOptions = {
  frequency: number;
  durationMs: number;
  volume?: number;
  type?: ToneType;
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  return audioContext;
}

function playTone({
  frequency,
  durationMs,
  volume = 0.04,
  type = "sine",
}: ToneOptions) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(volume, 0.0001),
      now + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Ignore audio failures to avoid interrupting UI interactions.
  }
}

export function playUiClickSound() {
  playTone({ frequency: 860, durationMs: 45, volume: 0.03, type: "triangle" });
}

export function playUiSuccessSound() {
  playTone({ frequency: 660, durationMs: 70, volume: 0.04, type: "sine" });
  setTimeout(
    () =>
      playTone({ frequency: 990, durationMs: 90, volume: 0.04, type: "sine" }),
    70,
  );
}
