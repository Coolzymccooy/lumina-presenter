import type {
  Hymn,
  HymnAuthor,
  HymnCopyright,
  HymnSection,
  HymnSectionType,
  HymnThemeCategory,
} from '../types/hymns';
import type { HymnSearchResult } from './hymnSearch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CcliCredentials {
  licenseNumber: string;
  clientId: string;
  /** Sentinel only — the actual secret is held server-side and never exposed to the renderer. */
  clientSecret: '';
  connectedAt: number;
}

interface CcliSongResult {
  songNumber: number;
  title: string;
  authors?: string[];
  copyrightYear?: number;
  copyright?: string;
  keySignature?: string;
  bpm?: number;
  themes?: string[];
}

interface CcliLyricsVerse {
  name: string;
  content: string;
}

interface CcliSongLyrics {
  songNumber: number;
  title: string;
  authors?: string[];
  copyright?: string;
  verses: CcliLyricsVerse[];
}

// ─── Auth header helpers ─────────────────────────────────────────────────────
// Server requires a verified Firebase ID token (Authorization: Bearer <token>)
// in production. The x-user-uid header is kept as a dev-only fallback.

interface CcliActor {
  uid: string | null;
  email: string | null;
  /** Optional async function returning a fresh Firebase ID token. */
  getIdToken?: () => Promise<string | null>;
}

let actor: CcliActor = { uid: null, email: null };

/** Set by App.tsx whenever the authenticated user changes. */
export const setCcliActor = (
  uid: string | null,
  email: string | null,
  getIdToken?: () => Promise<string | null>,
): void => {
  actor = { uid, email, getIdToken };
};

const authHeaders = async (extra: Record<string, string> = {}): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-uid': actor.uid ?? '',
    'x-user-email': actor.email ?? '',
    ...extra,
  };
  if (actor.getIdToken) {
    try {
      const token = await actor.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // No token available — server will reject in production
    }
  }
  return headers;
};

// ─── Server proxy calls (no secrets ever leave the server) ───────────────────

/**
 * Persist CCLI API credentials via the server proxy. The client_secret is sent
 * over HTTPS once and immediately encrypted at rest server-side; it is never
 * stored in Firestore, localStorage, or anywhere else on the client.
 */
export const storeCcliCredentials = async (
  workspaceId: string,
  licenseNumber: string,
  clientId: string,
  clientSecret: string,
): Promise<void> => {
  const resp = await fetch('/api/ccli/credentials', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ workspaceId, licenseNumber, clientId, clientSecret }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.message || `CCLI credential save failed (${resp.status})`);
  }
};

/**
 * Read CCLI connection status from the server. Never returns the actual
 * client_secret — only whether a workspace is connected.
 */
export const getCcliCredentials = async (
  workspaceId: string,
): Promise<CcliCredentials | null> => {
  try {
    const url = new URL('/api/ccli/status', window.location.origin);
    url.searchParams.set('workspaceId', workspaceId);
    const resp = await fetch(url.toString().replace(window.location.origin, ''), {
      headers: await authHeaders(),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.ok || !data?.connected) return null;
    return {
      licenseNumber: '',
      clientId: '',
      clientSecret: '',
      connectedAt: Number(data.connectedAt) || Date.now(),
    };
  } catch {
    return null;
  }
};

/** Disconnect CCLI for a workspace. */
export const disconnectCcli = async (workspaceId: string): Promise<void> => {
  const url = new URL('/api/ccli/credentials', window.location.origin);
  url.searchParams.set('workspaceId', workspaceId);
  await fetch(url.toString().replace(window.location.origin, ''), {
    method: 'DELETE',
    headers: await authHeaders(),
  });
};

/** Search SongSelect through the server proxy. */
export const searchSongSelectViaProxy = async (
  workspaceId: string,
  query: string,
  limit = 25,
): Promise<{ licenseNumber: string; results: CcliSongResult[] }> => {
  const resp = await fetch('/api/ccli/search', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ workspaceId, query, limit }),
  });
  if (!resp.ok) {
    if (resp.status === 404) return { licenseNumber: '', results: [] };
    throw new Error(`CCLI search failed (${resp.status})`);
  }
  const data = await resp.json();
  return { licenseNumber: data?.licenseNumber || '', results: (data?.results || []) as CcliSongResult[] };
};

/** Fetch full lyrics through the server proxy. */
export const getSongSelectLyricsViaProxy = async (
  workspaceId: string,
  songNumber: number,
): Promise<{ licenseNumber: string; lyrics: CcliSongLyrics } | null> => {
  const url = new URL(`/api/ccli/lyrics/${encodeURIComponent(String(songNumber))}`, window.location.origin);
  url.searchParams.set('workspaceId', workspaceId);
  const resp = await fetch(url.toString().replace(window.location.origin, ''), {
    headers: await authHeaders(),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data?.ok || !data?.lyrics) return null;
  return { licenseNumber: data.licenseNumber || '', lyrics: data.lyrics as CcliSongLyrics };
};

// ─── Hymn mapping helpers (unchanged from before — pure transformation) ──────

const CCLI_VERSE_TYPE_MAP: Record<string, { type: HymnSectionType; prefix: string }> = {
  verse: { type: 'verse', prefix: 'Verse' },
  chorus: { type: 'chorus', prefix: 'Chorus' },
  bridge: { type: 'bridge', prefix: 'Bridge' },
  tag: { type: 'refrain', prefix: 'Tag' },
  ending: { type: 'ending', prefix: 'Ending' },
  pre: { type: 'refrain', prefix: 'Pre-Chorus' },
  prechorus: { type: 'refrain', prefix: 'Pre-Chorus' },
};

const resolveVerseKind = (name: string): { type: HymnSectionType; label: string } => {
  const lower = name.toLowerCase().trim();
  for (const [key, def] of Object.entries(CCLI_VERSE_TYPE_MAP)) {
    if (lower === key || lower.startsWith(`${key} `)) {
      return { type: def.type, label: name };
    }
  }
  return { type: 'verse', label: name };
};

const normalizeText = (s: string) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const buildCcliHymn = (
  song: CcliSongResult,
  lyrics: CcliSongLyrics | null,
  licenseNumber: string,
): Hymn => {
  const title = lyrics?.title ?? song.title;
  const authors: HymnAuthor[] = (lyrics?.authors ?? song.authors ?? []).map((name) => ({
    name,
    role: 'text' as const,
  }));

  const copyrightText = lyrics?.copyright ?? song.copyright ?? '';
  const copyright: HymnCopyright = {
    publicDomain: false,
    requiresReview: false,
    textPd: false,
    tunePd: false,
    textAttribution: copyrightText,
    tuneAttribution: '',
  };

  const sections: HymnSection[] = (lyrics?.verses ?? []).map((verse, i) => {
    const { type, label } = resolveVerseKind(verse.name);
    return {
      id: `ccli-${song.songNumber}-${i}`,
      type,
      label,
      order: i,
      text: verse.content.trim(),
    };
  });

  const firstLine = sections[0]?.text.split('\n')[0]?.trim() ?? '';
  const id = `ccli-${song.songNumber}`;
  const normalizedTitle = normalizeText(title.toLowerCase());
  const tokens = [...new Set(normalizedTitle.split(' ').filter((t) => t.length > 2))];
  const themes: HymnThemeCategory[] = ['praise'];

  return {
    id,
    title,
    alternateTitles: [],
    firstLine,
    authors,
    tunes: [],
    themes,
    scriptureThemes: [],
    copyright,
    sections,
    searchKeywords: tokens,
    presentationDefaults: {
      defaultTypographyPresetId: 'classic-worship-serif',
      defaultThemeCategory: 'praise',
      defaultChorusStrategy: 'smart',
      preferredBackgroundMotion: 'either',
      maxLinesPerSlide: 4,
      preferredCharsPerLine: 40,
      allowThreeLineSlides: true,
      chorusVisuallyDistinct: true,
    },
    librarySource: {
      kind: 'licensed',
      isBundled: false,
      providerId: 'ccli',
      providerName: 'CCLI SongSelect',
      externalId: String(song.songNumber),
      displayLabel: 'CCLI SongSelect',
    },
    usageRights: {
      licenseScope: 'provider-projection',
      canProject: true,
      canStream: true,
      requiresLicenseCheck: true,
      entitlementId: licenseNumber,
      canStoreText: false,
      canDistributeInApp: false,
      requiresAttribution: true,
    },
    searchIndex: {
      normalizedTitle,
      normalizedFirstLine: normalizeText(firstLine.toLowerCase()),
      keywords: tokens,
      themes,
      tokens,
      searchableText: normalizedTitle,
    },
  };
};

export const mapCcliResultToSearchResult = (
  song: CcliSongResult,
  licenseNumber: string,
): HymnSearchResult => ({
  hymn: buildCcliHymn(song, null, licenseNumber),
  score: 80,
  matchedFields: ['title'],
});

export const mapCcliLyricsToHymn = (
  song: CcliSongResult,
  lyrics: CcliSongLyrics,
  licenseNumber: string,
): Hymn => buildCcliHymn(song, lyrics, licenseNumber);
