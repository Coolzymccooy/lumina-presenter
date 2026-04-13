/**
 * User Background Preference – Persists the user's last-selected background
 * so it becomes the default for all new slide creation (Bible, Hymns, Sermon, etc.).
 *
 * Stored in localStorage for cross-session persistence.
 * When the user explicitly selects a background from the Motion Library,
 * Quick BG, or any other source, it becomes the new default.
 */

import type { MediaType } from '../types';
import type { BackgroundSnapshot } from './backgroundPersistence';

const STORAGE_KEY = 'lumina-user-default-background';

export interface UserBackgroundPreference {
  url: string;
  mediaType: MediaType;
  provider?: string;
  category?: string;
  title?: string;
  sourceUrl?: string;
  updatedAt: number;
}

/**
 * Get the user's last-selected background.
 * Returns null if no preference has been set.
 */
export function getUserDefaultBackground(): UserBackgroundPreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url) return null;
    return parsed as UserBackgroundPreference;
  } catch {
    return null;
  }
}

/**
 * Save the user's selected background as the new default.
 * This will be used by all slide creation features until changed.
 */
export function setUserDefaultBackground(preference: Omit<UserBackgroundPreference, 'updatedAt'>): void {
  try {
    const entry: UserBackgroundPreference = {
      ...preference,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage not available — silently skip
  }
}

/**
 * Clear the user's default background preference.
 * Features will fall back to their built-in defaults.
 */
export function clearUserDefaultBackground(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently skip
  }
}

/**
 * Get the background URL to use for new slide creation.
 * Returns the user's preference if set, otherwise the provided fallback.
 */
export function getDefaultBackgroundUrl(fallback: string): string {
  const pref = getUserDefaultBackground();
  return pref?.url || fallback;
}

/**
 * Get the media type for the user's default background.
 * Returns the user's preference if set, otherwise the provided fallback.
 */
export function getDefaultBackgroundMediaType(fallback: MediaType): MediaType {
  const pref = getUserDefaultBackground();
  return pref?.mediaType || fallback;
}

/**
 * Get user's default background as a BackgroundSnapshot.
 * This is compatible with the inheritPrevailingBackground pipeline.
 * Returns null if no preference is set.
 */
export function getUserDefaultBackgroundSnapshot(): BackgroundSnapshot | null {
  const pref = getUserDefaultBackground();
  if (!pref?.url) return null;
  return {
    backgroundUrl: pref.url,
    mediaType: pref.mediaType,
    backgroundSourceUrl: pref.sourceUrl,
    backgroundProvider: pref.provider,
    backgroundCategory: pref.category,
    backgroundTitle: pref.title,
  };
}

/**
 * Get theme-compatible background properties from the user's preference.
 * Returns { backgroundUrl, mediaType } for direct use in theme objects.
 * Falls back to provided defaults if no preference is set.
 */
export function getDefaultBgTheme(
  fallbackUrl: string,
  fallbackMediaType: MediaType = 'image',
): { backgroundUrl: string; mediaType: MediaType } {
  const pref = getUserDefaultBackground();
  if (pref?.url) {
    return { backgroundUrl: pref.url, mediaType: pref.mediaType };
  }
  return { backgroundUrl: fallbackUrl, mediaType: fallbackMediaType };
}
