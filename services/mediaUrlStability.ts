const REMOTE_MEDIA_PATTERN = /^https?:\/\//i;
const BLOB_MEDIA_PATTERN = /^blob:/i;
const DATA_MEDIA_PATTERN = /^data:/i;
const APP_HOSTED_MEDIA_PATHS = ['/media/workspaces/', '/media/vis/'];

export const isRemoteMediaUrl = (url: string): boolean => REMOTE_MEDIA_PATTERN.test(String(url || '').trim());
export const isBlobMediaUrl = (url: string): boolean => BLOB_MEDIA_PATTERN.test(String(url || '').trim());
export const isDataMediaUrl = (url: string): boolean => DATA_MEDIA_PATTERN.test(String(url || '').trim());

export const isAppHostedMediaUrl = (url: string): boolean => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) {
    return APP_HOSTED_MEDIA_PATHS.some((segment) => trimmed.includes(segment));
  }
  try {
    const parsed = new URL(trimmed);
    return APP_HOSTED_MEDIA_PATHS.some((segment) => parsed.pathname.includes(segment));
  } catch {
    return APP_HOSTED_MEDIA_PATHS.some((segment) => trimmed.includes(segment));
  }
};

export const isProjectionSafeBackgroundUrl = (url: string): boolean => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('local://')) return true;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
  if (isAppHostedMediaUrl(trimmed)) return true;
  return !isRemoteMediaUrl(trimmed) && !isBlobMediaUrl(trimmed) && !isDataMediaUrl(trimmed);
};
