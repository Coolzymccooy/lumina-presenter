import { buildStructuredBibleReference } from './bibleLookup.ts';

export const isStructuredBibleRangeReady = (
  bookName: string,
  verseTo: number | null,
) => !!String(bookName || '').trim() && verseTo !== null;

export const buildStructuredBibleRange = (
  bookName: string,
  chapter: number,
  verseFrom: number,
  verseTo: number | null,
) => {
  if (!isStructuredBibleRangeReady(bookName, verseTo)) return '';
  return buildStructuredBibleReference(bookName, chapter, verseFrom, verseTo);
};

export const buildStructuredBibleDraft = (
  bookName: string,
  chapter: number,
  verseFrom: number,
  verseTo: number | null,
) => {
  const safeBookName = String(bookName || '').trim();
  if (!safeBookName) return '';
  if (verseTo === null) return `${safeBookName} ${chapter}:${verseFrom} - Select destination verse`;
  return buildStructuredBibleReference(safeBookName, chapter, verseFrom, verseTo);
};
