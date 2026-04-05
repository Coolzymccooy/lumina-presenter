import type { SermonSummary } from './sermonSummaryService';

export interface ArchivedSermon {
  id: string;
  savedAt: number;
  wordCount: number;
  summary: SermonSummary;
}

const STORAGE_KEY = 'lumina_sermon_archive';
const MAX_ITEMS = 50;

const makeId = () => `sermon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const archiveSermon = (summary: SermonSummary, wordCount: number): ArchivedSermon => {
  const item: ArchivedSermon = { id: makeId(), savedAt: Date.now(), wordCount, summary };
  const existing = getArchivedSermons();
  const updated = [item, ...existing].slice(0, MAX_ITEMS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* storage quota */ }
  return item;
};

export const getArchivedSermons = (): ArchivedSermon[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArchivedSermon[]) : [];
  } catch { return []; }
};

export const deleteArchivedSermon = (id: string): void => {
  const updated = getArchivedSermons().filter((s) => s.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* storage quota */ }
};
