const getInitialApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const urlApi = params.get('api');
    if (urlApi) return urlApi.trim();
    const host = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    // In local/dev sessions prefer local API unless caller explicitly overrides via ?api=
    if (isLocalHost) return 'http://localhost:8787';
  }
  return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').trim();
};

const DEFAULT_PROD_API_BASE_URL = 'https://lumina-presenter-api.onrender.com';
const normalizeApiBaseUrl = (input?: string | null) => String(input || '').trim().replace(/\/+$/, '');
const INITIAL_API_BASE_URL = normalizeApiBaseUrl(getInitialApiBaseUrl());
let activeApiBaseUrl = INITIAL_API_BASE_URL;

const withHostSwap = (sourceUrl: string, from: string, to: string) => {
  if (!sourceUrl) return '';
  try {
    const parsed = new URL(sourceUrl);
    if (!parsed.hostname.includes(from)) return '';
    parsed.hostname = parsed.hostname.replace(from, to);
    return normalizeApiBaseUrl(parsed.toString());
  } catch {
    return '';
  }
};

const buildApiBaseCandidates = (seedBaseUrl: string): string[] => {
  const candidates: string[] = [];
  const addCandidate = (value?: string | null) => {
    const normalized = normalizeApiBaseUrl(value);
    if (!normalized) return;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  addCandidate(seedBaseUrl);
  addCandidate(withHostSwap(seedBaseUrl, '-docker.', '.'));
  addCandidate(withHostSwap(seedBaseUrl, '.onrender.com', '-docker.onrender.com'));
  addCandidate(import.meta.env.VITE_API_BASE_URL || '');
  addCandidate(DEFAULT_PROD_API_BASE_URL);
  return candidates;
};

let apiBaseCandidates = buildApiBaseCandidates(activeApiBaseUrl);
const getApiBaseCandidates = () => {
  const merged: string[] = [];
  const addCandidate = (value?: string | null) => {
    const normalized = normalizeApiBaseUrl(value);
    if (!normalized) return;
    if (!merged.includes(normalized)) merged.push(normalized);
  };
  addCandidate(activeApiBaseUrl);
  buildApiBaseCandidates(INITIAL_API_BASE_URL).forEach(addCandidate);
  apiBaseCandidates.forEach(addCandidate);
  addCandidate('http://localhost:8787');
  return merged;
};

const updateActiveApiBaseUrl = (value: string) => {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) return;
  activeApiBaseUrl = normalized;
  apiBaseCandidates = buildApiBaseCandidates(normalized);
};

const shouldRetryWithNextApiBase = (status: number) => (
  status === 404
  || status === 502
  || status === 503
  || status === 504
);
const CONNECTION_CLIENT_ID_PREFIX = 'lumina_conn_client_v1';

export type ActorLike = {
  uid?: string | null;
  email?: string | null;
  getIdToken?: () => Promise<string>;
} | null | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  user?: ActorLike;
  body?: unknown;
  allowAnonymous?: boolean;
  timeoutMs?: number;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('SERVER_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const buildHeaders = async (user?: ActorLike, allowAnonymous = false): Promise<Record<string, string> | null> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const uid = String(user?.uid || '').trim();
  const email = String(user?.email || '').trim();
  if (uid) headers['x-user-uid'] = uid;
  if (email) headers['x-user-email'] = email;

  if (typeof user?.getIdToken === 'function') {
    try {
      const token = await user.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // Token is optional for now; header fallback still works.
    }
  }

  if (!allowAnonymous && !headers.Authorization && !headers['x-user-uid']) {
    return null;
  }
  return headers;
};

const requestJson = async <T,>(path: string, options: RequestOptions = {}): Promise<T | null> => {
  const apiCandidates = getApiBaseCandidates();
  if (!apiCandidates.length) return null;
  const method = options.method || 'GET';
  const headers = await buildHeaders(options.user, !!options.allowAnonymous);
  if (!headers) return null;
  const timeoutMs = options.timeoutMs || 6000;

  for (let idx = 0; idx < apiCandidates.length; idx += 1) {
    const apiBase = apiCandidates[idx];
    const isLastCandidate = idx >= apiCandidates.length - 1;
    try {
      const response = await withTimeout(fetch(`${apiBase}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      }), timeoutMs);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const canParseJson = contentType.includes('application/json');
      const payload = canParseJson ? await response.json().catch(() => null) : null;

      if (!response.ok) {
        if (!isLastCandidate && shouldRetryWithNextApiBase(response.status)) {
          continue;
        }
        if (payload && typeof payload === 'object') {
          return {
            ...(payload as Record<string, unknown>),
            ok: false,
            status: response.status,
            path,
            apiBase,
          } as T;
        }
        return {
          ok: false,
          status: response.status,
          error: `HTTP_${response.status}`,
          path,
          apiBase,
        } as unknown as T;
      }

      if (payload && typeof payload === 'object') {
        updateActiveApiBaseUrl(apiBase);
        return payload as T;
      }
      if (!isLastCandidate) continue;
      return null;
    } catch {
      if (!isLastCandidate) continue;
      return null;
    }
  }
  return null;
};

export const getServerApiBaseUrl = () => activeApiBaseUrl || INITIAL_API_BASE_URL;
export const getServerApiBaseCandidates = () => getApiBaseCandidates();

export type RemoteMotionAsset = {
  id: string;
  name: string;
  thumb: string;
  url: string;
  mediaType: 'video' | 'image';
  provider: 'pexels' | 'pixabay' | 'curated' | 'stills';
  attribution?: string;
};

export type PexelsMotionSearchResponse = {
  ok: boolean;
  assets: RemoteMotionAsset[];
  cached?: boolean;
  error?: string;
  message?: string;
  status?: number;
};

export const searchPexelsMotion = async (query: string, perPage = 12) => {
  const params = new URLSearchParams();
  const normalizedQuery = String(query || '').trim() || 'worship background';
  params.set('query', normalizedQuery);
  params.set('per_page', String(perPage));
  return await requestJson<PexelsMotionSearchResponse>(`/api/media/pexels/videos?${params.toString()}`, {
    method: 'GET',
    allowAnonymous: true,
    timeoutMs: 12000,
  });
};

export const resolveWorkspaceId = (user: ActorLike, fallback = 'default-workspace') => {
  const uid = String(user?.uid || '').trim();
  return uid || fallback;
};

export type WorkspaceSnapshotPayload = {
  schedule: any[];
  selectedItemId: string;
  activeItemId: string | null;
  activeSlideIndex: number;
  workspaceSettings: any;
  workspaceSettingsUpdatedAt?: number;
  updatedAt: number;
  audienceQrProjection?: any;
  stageTimerFlash?: any;
  stageMessageCenter?: any;
  stageAlert?: any;
};

export const loadLatestWorkspaceSnapshot = async (workspaceId: string, user: ActorLike) => {
  return await requestJson<{
    ok: boolean;
    snapshot: {
      version: number;
      payload: WorkspaceSnapshotPayload;
      updatedAt: number;
    } | null;
  }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/snapshots/latest`, {
    method: 'GET',
    user,
  });
};

export const saveWorkspaceSnapshot = async (workspaceId: string, user: ActorLike, payload: WorkspaceSnapshotPayload) => {
  return await requestJson<{ ok: boolean; version: number; updatedAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/snapshots`,
    {
      method: 'POST',
      user,
      body: { payload },
      timeoutMs: 8000,
    }
  );
};

export const saveWorkspaceSettings = async (workspaceId: string, user: ActorLike, settings: Record<string, any>) => {
  return await requestJson<{ ok: boolean; updatedAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/settings`,
    {
      method: 'PATCH',
      user,
      body: { settings },
    }
  );
};

export const saveServerSessionState = async (workspaceId: string, sessionId: string, user: ActorLike, state: Record<string, any>) => {
  return await requestJson<{ ok: boolean; version: number; updatedAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/state`,
    {
      method: 'POST',
      user,
      body: { state },
      timeoutMs: 6000,
    }
  );
};

export const fetchServerSessionState = async (workspaceId: string, sessionId: string) => {
  return await requestJson<{
    ok: boolean;
    state: Record<string, any> | null;
    version: number;
    updatedAt: number;
  }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/state`,
    {
      method: 'GET',
      allowAnonymous: true,
      timeoutMs: 5000,
    }
  );
};

export const sendServerRemoteCommand = async (
  workspaceId: string,
  sessionId: string,
  user: ActorLike,
  command: string
) => {
  return await requestJson<{ ok: boolean; command: string; updatedAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/commands`,
    {
      method: 'POST',
      user,
      body: { command },
      timeoutMs: 5000,
    }
  );
};

const fileToBase64 = async (file: File) => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const payload = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
      resolve(payload);
    };
    reader.readAsDataURL(file);
  });
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let idx = 0; idx < bytes.length; idx += chunkSize) {
    const chunk = bytes.subarray(idx, idx + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const uploadWorkspaceMedia = async (
  workspaceId: string,
  user: ActorLike,
  media: File | { name: string; mimeType: string; buffer: ArrayBuffer }
) => {
  const headers = await buildHeaders(user, false);
  if (!headers) return null;

  const fileName = media instanceof File ? media.name : String(media.name || 'upload.bin');
  const mimeType = media instanceof File
    ? (media.type || 'application/octet-stream')
    : (String(media.mimeType || '').trim() || 'application/octet-stream');
  const base64 = media instanceof File
    ? await fileToBase64(media)
    : arrayBufferToBase64(media.buffer);

  return await requestJson<{
    ok: boolean;
    url?: string;
    relativeUrl?: string;
    mimeType?: string;
    size?: number;
    error?: string;
    message?: string;
  }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/media`,
    {
      method: 'POST',
      user,
      body: {
        name: fileName,
        mimeType,
        base64,
      },
      timeoutMs: 20000,
    }
  );
};

export type VisualPptxImportResponse = {
  ok: boolean;
  slideCount: number;
  cached?: boolean;
  renderer?: "poppler" | "pdfjs-fallback" | string;
  renderSignature?: string;
  slides: Array<{
    pageNumber: number;
    name: string;
    width: number;
    height: number;
    imageBase64?: string;
    imageUrl?: string;
  }>;
  error?: string;
  message?: string;
};

export const importVisualPptxDeck = async (workspaceId: string, user: ActorLike, file: File) => {
  const fileBase64 = await fileToBase64(file);
  const headers = await buildHeaders(user, false);
  if (!headers) {
    return {
      ok: false,
      slideCount: 0,
      slides: [],
      error: 'AUTH_REQUIRED',
      message: 'Sign in required for visual PowerPoint import.',
    };
  }

  const readErrorPayload = async (response: Response) => {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      return {
        error: payload?.error as string | undefined,
        message: payload?.message as string | undefined,
      };
    }

    const rawText = await response.text().catch(() => '');
    const compact = rawText.replace(/\s+/g, ' ').trim();
    if (!compact) return { error: undefined, message: undefined };
    if (/cannot post \/api\/workspaces\/.+\/imports\/pptx-visual/i.test(compact)) {
      return {
        error: 'PPTX_VISUAL_ENDPOINT_MISSING',
        message: 'Visual PowerPoint import endpoint is not on this server. Deploy latest backend and verify VITE_API_BASE_URL.',
      };
    }
    return {
      error: undefined,
      message: compact.slice(0, 220),
    };
  };

  const apiCandidates = getApiBaseCandidates();
  for (let idx = 0; idx < apiCandidates.length; idx += 1) {
    const apiBase = apiCandidates[idx];
    const isLastCandidate = idx >= apiCandidates.length - 1;
    try {
      const response = await withTimeout(fetch(
        `${apiBase}/api/workspaces/${encodeURIComponent(workspaceId)}/imports/pptx-visual`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filename: file.name || 'import.pptx',
            fileBase64,
          }),
        }
      ), 240000);

      const payload = await (async () => {
        if (response.ok) {
          return await response.json().catch(() => null);
        }
        return await readErrorPayload(response);
      })();

      if (!response.ok) {
        if (!isLastCandidate && shouldRetryWithNextApiBase(response.status)) {
          continue;
        }
        const fallbackMessage = (() => {
          if (response.status === 401) return 'Sign in required for visual PowerPoint import.';
          if (response.status === 403) return 'You do not have access to import into this workspace.';
          if (response.status === 404) return 'Visual PowerPoint import endpoint is not available. Deploy latest backend and verify VITE_API_BASE_URL.';
          if (response.status === 413) return 'PowerPoint file is too large for visual import.';
          if (response.status === 503) return 'Visual import renderer is unavailable on the server (LibreOffice/soffice missing).';
          if (response.status === 504) return 'Visual import timed out on the server. Try a smaller deck.';
          return `Visual PowerPoint import failed (HTTP ${response.status}).`;
        })();
        return {
          ok: false,
          slideCount: 0,
          slides: [],
          error: payload?.error || `HTTP_${response.status}`,
          message: payload?.message || fallbackMessage,
        };
      }

      // Some upstream/proxy paths can return HTTP 200 with an app-level error payload.
      if (payload && payload.ok === false) {
        return {
          ok: false,
          slideCount: 0,
          slides: [],
          error: payload.error || 'VISUAL_IMPORT_FAILED',
          message: payload.message || 'Visual PowerPoint import failed on the server.',
        };
      }

      if (!payload || !Array.isArray(payload.slides)) {
        if (!isLastCandidate) continue;
        const payloadKeys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : 'none';
        return {
          ok: false,
          slideCount: 0,
          slides: [],
          error: 'INVALID_RESPONSE',
          message: `Server returned an invalid visual import payload (keys: ${payloadKeys}).`,
        };
      }

      updateActiveApiBaseUrl(apiBase);
      return payload as VisualPptxImportResponse;
    } catch {
      if (!isLastCandidate) continue;
      return {
        ok: false,
        slideCount: 0,
        slides: [],
        error: 'NETWORK_OR_TIMEOUT',
        message: 'Could not reach server for visual PowerPoint import.',
      };
    }
  }
  return {
    ok: false,
    slideCount: 0,
    slides: [],
    error: 'NETWORK_OR_TIMEOUT',
    message: 'Could not reach server for visual PowerPoint import.',
  };
};

export const fetchWorkspaceReportSummary = async (workspaceId: string, user: ActorLike, from?: number, to?: number) => {
  const params = new URLSearchParams();
  if (typeof from === 'number') params.set('from', String(from));
  if (typeof to === 'number') params.set('to', String(to));
  const query = params.toString() ? `?${params.toString()}` : '';
  return await requestJson<{
    ok: boolean;
    range: { from: number; to: number };
    totalEvents: number;
    byAction: Array<{ action: string; count: number }>;
  }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/reports/summary${query}`, {
    method: 'GET',
    user,
    timeoutMs: 7000,
  });
};

// ── Settings (server is source of truth) ─────────────────────────────────────
export const fetchWorkspaceSettings = async (workspaceId: string, user: ActorLike) => {
  return await requestJson<{ ok: boolean; settings: Record<string, any>; updatedAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/settings`,
    { method: 'GET', user, timeoutMs: 6000 }
  );
};

export type ConnectionRole = 'controller' | 'output' | 'stage' | 'remote';
export type SessionConnectionInfo = {
  clientId: string;
  role: ConnectionRole | string;
  lastSeenAt: number;
  metadata: Record<string, any>;
};

export type RunSheetFileRecord = {
  fileId: string;
  title: string;
  payload: {
    items: any[];
    selectedItemId?: string | null;
  };
  createdByUid: string | null;
  createdByEmail: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

export const fetchRunSheetFiles = async (workspaceId: string, user: ActorLike) => {
  return await requestJson<{ ok: boolean; files: RunSheetFileRecord[] }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets`,
    {
      method: 'GET',
      user,
      timeoutMs: 7000,
    }
  );
};

export const archiveRunSheetFile = async (
  workspaceId: string,
  user: ActorLike,
  payload: { title: string; payload: { items: any[]; selectedItemId?: string | null } }
) => {
  return await requestJson<{ ok: boolean; file: RunSheetFileRecord }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets`,
    {
      method: 'POST',
      user,
      body: payload,
      timeoutMs: 7000,
    }
  );
};

export const renameRunSheetFile = async (
  workspaceId: string,
  fileId: string,
  title: string,
  user: ActorLike
) => {
  return await requestJson<{ ok: boolean; file: RunSheetFileRecord }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}`,
    {
      method: 'PATCH',
      user,
      body: { title },
      timeoutMs: 7000,
    }
  );
};

export const reuseRunSheetFile = async (workspaceId: string, fileId: string, user: ActorLike) => {
  return await requestJson<{
    ok: boolean;
    file: RunSheetFileRecord;
    payload: { items: any[]; selectedItemId?: string | null };
  }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}/reuse`,
    {
      method: 'POST',
      user,
      timeoutMs: 7000,
    }
  );
};

export const deleteRunSheetFile = async (workspaceId: string, fileId: string, user: ActorLike) => {
  return await requestJson<{ ok: boolean }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/runsheets/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      user,
      timeoutMs: 7000,
    }
  );
};

const buildConnectionStorageKey = (workspaceId: string, sessionId: string, role: ConnectionRole) =>
  `${CONNECTION_CLIENT_ID_PREFIX}:${workspaceId}:${sessionId}:${role}`;

export const getOrCreateConnectionClientId = (
  workspaceId: string,
  sessionId: string,
  role: ConnectionRole
) => {
  const key = buildConnectionStorageKey(workspaceId, sessionId, role);
  const fallback = `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window === 'undefined') return fallback;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `${role}-${crypto.randomUUID()}`
      : fallback;
    localStorage.setItem(key, generated);
    return generated;
  } catch {
    return fallback;
  }
};

export const heartbeatSessionConnection = async (
  workspaceId: string,
  sessionId: string,
  role: ConnectionRole,
  clientId: string,
  metadata: Record<string, any> = {}
) => {
  return await requestJson<{
    ok: boolean;
    asOf: number;
    ttlMs: number;
    total: number;
    role: string;
    clientId: string;
  }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/connections/heartbeat`,
    {
      method: 'POST',
      body: { role, clientId, metadata },
      allowAnonymous: true,
      timeoutMs: 5000,
    }
  );
};

export const fetchSessionConnections = async (workspaceId: string, sessionId: string) => {
  return await requestJson<{
    ok: boolean;
    asOf: number;
    ttlMs: number;
    connections: SessionConnectionInfo[];
    counts: {
      total: number;
      byRole: Record<string, number>;
    };
  }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/connections`,
    {
      method: 'GET',
      allowAnonymous: true,
      timeoutMs: 5000,
    }
  );
};

// ── Audience Studio ───────────────────────────────────────────────────────────
import type {
  AudienceCategory,
  AudienceStatus,
  AudienceMessage
} from '../types';

export type {
  AudienceCategory,
  AudienceStatus,
  AudienceMessage
};

export const submitAudienceMessage = async (
  workspaceId: string,
  payload: { category: AudienceCategory; text: string; name?: string }
) => {
  return await requestJson<{ ok: boolean; id: number; createdAt: number }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/audience/messages`,
    { method: 'POST', body: payload, allowAnonymous: true, timeoutMs: 6000 }
  );
};

export const fetchAudienceMessages = async (workspaceId: string, user: ActorLike, status?: string) => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return await requestJson<{ ok: boolean; messages: AudienceMessage[] }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/audience/messages${q}`,
    { method: 'GET', user, timeoutMs: 6000 }
  );
};

export const updateAudienceMessageStatus = async (
  workspaceId: string,
  msgId: number,
  status: AudienceStatus,
  user: ActorLike
) => {
  return await requestJson<{ ok: boolean; message: AudienceMessage }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/audience/messages/${msgId}`,
    { method: 'PATCH', body: { status }, user, timeoutMs: 6000 }
  );
};

export const deleteAudienceMessage = async (workspaceId: string, msgId: number, user: ActorLike) => {
  return await requestJson<{ ok: boolean }>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/audience/messages/${msgId}`,
    { method: 'PATCH', body: { status: 'dismissed' }, user, timeoutMs: 6000 }
  );
};
