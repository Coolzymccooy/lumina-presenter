export function isWebLyricsFetchEnabled(): boolean {
  const raw = String(import.meta.env.VITE_AI_WEB_LYRICS_FETCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
