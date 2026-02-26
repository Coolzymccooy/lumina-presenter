const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').trim();
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

type ActorLike = {
  uid?: string | null;
  email?: string | null;
  getIdToken?: () => Promise<string>;
} | null | undefined;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
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
  if (!API_BASE_URL) return null;
  const method = options.method || 'GET';
  const headers = await buildHeaders(options.user, !!options.allowAnonymous);
  if (!headers) return null;
  const timeoutMs = options.timeoutMs || 6000;

  try {
    const response = await withTimeout(fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }), timeoutMs);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
};

export const getServerApiBaseUrl = () => API_BASE_URL;

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
  updatedAt: number;
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

  try {
    const response = await withTimeout(fetch(
      `${API_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/imports/pptx-visual`,
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
      const payloadKeys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : 'none';
      return {
        ok: false,
        slideCount: 0,
        slides: [],
        error: 'INVALID_RESPONSE',
        message: `Server returned an invalid visual import payload (keys: ${payloadKeys}).`,
      };
    }
    return payload as VisualPptxImportResponse;
  } catch {
    return {
      ok: false,
      slideCount: 0,
      slides: [],
      error: 'NETWORK_OR_TIMEOUT',
      message: 'Could not reach server for visual PowerPoint import.',
    };
  }
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

// ── Audience Studio ───────────────────────────────────────────────────────────
export type AudienceCategory = 'qa' | 'prayer' | 'testimony' | 'poll' | 'welcome';
export type AudienceStatus = 'pending' | 'approved' | 'dismissed' | 'projected';

export interface AudienceMessage {
  id: number;
  workspace_id: string;
  category: AudienceCategory;
  text: string;
  submitter_name: string | null;
  status: AudienceStatus;
  created_at: number;
  updated_at: number;
}

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
