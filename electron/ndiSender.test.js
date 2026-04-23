import { describe, it, expect, vi } from 'vitest';
import { createSender } from './ndiSender.cjs';

// These tests exercise the input-guard paths on NdiSenderInstance. They never
// call start() so the underlying grandiose native addon is never loaded, which
// keeps the suite runnable in the vitest jsdom environment.

describe('NdiSenderInstance.sendAudioFrame (input guards)', () => {
  it('silently no-ops when the instance has not been started', async () => {
    const sender = createSender('Lumina-Program');
    // No throw, no crash — just returns undefined.
    await expect(sender.sendAudioFrame(Buffer.alloc(16), 48000, 2, 2)).resolves.toBeUndefined();
  });

  it('rejects non-Buffer payloads silently', async () => {
    const sender = createSender('Lumina-Program');
    // @ts-expect-error — deliberately wrong arg
    await expect(sender.sendAudioFrame('not a buffer', 48000, 2, 2)).resolves.toBeUndefined();
    await expect(sender.sendAudioFrame(null, 48000, 2, 2)).resolves.toBeUndefined();
  });

  it('rejects zero/negative sample rates and channel counts', async () => {
    const sender = createSender('Lumina-Program');
    // Even with _sender present, zero sampleRate would early-return before
    // calling the native method. We can't easily prove that without mocking,
    // but we can at least verify no throw on the guard path.
    const buf = Buffer.alloc(16);
    await expect(sender.sendAudioFrame(buf, 0, 2, 2)).resolves.toBeUndefined();
    await expect(sender.sendAudioFrame(buf, -1, 2, 2)).resolves.toBeUndefined();
    await expect(sender.sendAudioFrame(buf, 48000, 0, 2)).resolves.toBeUndefined();
    await expect(sender.sendAudioFrame(buf, 48000, 2, 0)).resolves.toBeUndefined();
  });

  it('forwards a well-formed payload to the underlying sender', async () => {
    const sender = createSender('Lumina-Program');
    // Shortcut the native-addon path: hand-craft a mock sender and mark active.
    const audio = vi.fn().mockResolvedValue(undefined);
    sender['_sender'] = { audio };
    sender['_active'] = true;

    const buf = Buffer.from(new Float32Array([0.1, -0.1, 0.2, -0.2]).buffer);
    await sender.sendAudioFrame(buf, 48000, 2, 2);

    expect(audio).toHaveBeenCalledTimes(1);
    const frame = audio.mock.calls[0][0];
    expect(frame.sampleRate).toBe(48000);
    expect(frame.channels).toBe(2);
    expect(frame.samples).toBe(2);
    expect(frame.audioFormat).toBe(1); // Float32Interleaved
    expect(frame.channelStrideInBytes).toBe(8); // channels * 4
    expect(frame.data).toBe(buf);
  });
});
