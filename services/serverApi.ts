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
