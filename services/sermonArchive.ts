import type { SermonSummary } from './sermonSummaryService';
import { getServerApiBaseUrl } from './serverApi';

export interface ArchivedSermon {
  id: string;
  savedAt: number;
  wordCount: number;
  summary: SermonSummary;
}

const makeId = () => `sermon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const apiBase = () => getServerApiBaseUrl().replace(/\/+$/, '');

export const archiveSermon = async (
  summary: SermonSummary,
  wordCount: number,
  workspaceId: string
): Promise<ArchivedSermon | null> => {
  const item: ArchivedSermon = { id: makeId(), savedAt: Date.now(), wordCount, summary };
  try {
    const res = await fetch(`${apiBase()}/api/sermons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, workspaceId, wordCount, summary }),
    });
    if (!res.ok) return null;
    return item;
  } catch {
    return null;
  }
};

export const getArchivedSermons = async (workspaceId: string): Promise<ArchivedSermon[]> => {
  try {
    const res = await fetch(`${apiBase()}/api/sermons?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.items) ? (json.items as ArchivedSermon[]) : [];
  } catch {
    return [];
  }
};

export const deleteArchivedSermon = async (id: string, workspaceId: string): Promise<void> => {
  try {
    await fetch(`${apiBase()}/api/sermons/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: 'DELETE',
    });
  } catch { /* best-effort */ }
};
