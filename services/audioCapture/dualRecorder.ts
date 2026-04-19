export interface DualRecorderOptions {
  stream: MediaStream;
  mimeType: string;
  segmentMs: number;
  audioBitsPerSecond?: number;
  onSegment: (blob: Blob, slotIdx: number) => void;
}

export interface DualRecorderHandle {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
}

export function createDualRecorder(opts: DualRecorderOptions): DualRecorderHandle {
  const { stream, mimeType, segmentMs, audioBitsPerSecond, onSegment } = opts;

  let active = false;
  let nextSlotIdx = 0;
  let cycleTimer: ReturnType<typeof setTimeout> | null = null;
  let currentRecorder: MediaRecorder | null = null;

  function clearCycleTimer(): void {
    if (cycleTimer !== null) {
      clearTimeout(cycleTimer);
      cycleTimer = null;
    }
  }

  function spawn(): void {
    if (!active) return;

    const slotIdx = nextSlotIdx++;
    const chunks: Blob[] = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        ...(audioBitsPerSecond !== undefined ? { audioBitsPerSecond } : {}),
      });
    } catch {
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch {
        return;
      }
    }

    currentRecorder = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      if (currentRecorder === recorder) {
        currentRecorder = null;
      }
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType });
        try {
          onSegment(blob, slotIdx);
        } catch {
          /* swallow callback errors */
        }
      }
    };

    try {
      recorder.start();
    } catch {
      currentRecorder = null;
      return;
    }

    cycleTimer = setTimeout(() => {
      cycleTimer = null;
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* no-op */ }
      }
      spawn();
    }, segmentMs);
  }

  return {
    start(): void {
      if (active) return;
      active = true;
      nextSlotIdx = 0;
      spawn();
    },
    stop(): void {
      if (!active) return;
      active = false;
      clearCycleTimer();
      const r = currentRecorder;
      currentRecorder = null;
      if (r && r.state !== 'inactive') {
        try { r.stop(); } catch { /* no-op */ }
      }
    },
    isActive(): boolean {
      return active;
    },
  };
}
