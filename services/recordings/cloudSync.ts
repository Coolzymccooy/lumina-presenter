import type { RecordedTrack } from './types';

export interface AuthBridge {
  getIdToken(): Promise<string | null>;
}

async function authHeader(auth: AuthBridge): Promise<Record<string, string>> {
  const token = await auth.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseOrThrow(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export const cloudSync = {
  async upload(track: RecordedTrack, blob: Blob, auth: AuthBridge) {
    const form = new FormData();
    form.append('audio', blob, `${track.id}.webm`);
    form.append('meta', JSON.stringify({
      id: track.id,
      title: track.title,
      durationSec: track.durationSec,
      mime: track.mime,
      createdAt: track.createdAt,
    }));
    const res = await fetch('/api/recordings', {
      method: 'POST',
      headers: await authHeader(auth),
      body: form,
    });
    const body = await parseOrThrow(res);
    return { id: body.id as string, cloudUrl: body.cloudUrl as string, sizeBytes: body.sizeBytes as number };
  },

  async list(auth: AuthBridge): Promise<RecordedTrack[]> {
    const res = await fetch('/api/recordings', { headers: await authHeader(auth) });
    const body = await parseOrThrow(res);
    // Defensive: contract is `{ recordings: [...] }` but cold-start / migration
    // states can return `{}` or `{ recordings: null }`. Always hand callers a
    // real array so they can call `.find()` / `.filter()` without throwing.
    return Array.isArray(body?.recordings) ? (body.recordings as RecordedTrack[]) : [];
  },

  async rename(id: string, title: string, auth: AuthBridge): Promise<void> {
    const res = await fetch(`/api/recordings/${id}`, {
      method: 'PATCH',
      headers: { ...(await authHeader(auth)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await parseOrThrow(res);
  },

  async remove(id: string, auth: AuthBridge): Promise<void> {
    const res = await fetch(`/api/recordings/${id}`, {
      method: 'DELETE',
      headers: await authHeader(auth),
    });
    await parseOrThrow(res);
  },

  async download(id: string, auth: AuthBridge): Promise<Blob> {
    const res = await fetch(`/api/recordings/${id}/audio`, { headers: await authHeader(auth) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
};
