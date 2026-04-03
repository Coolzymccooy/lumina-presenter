export type AetherBridgeEvent =
  | 'lumina.bridge.ping'
  | 'lumina.state.sync'
  | 'lumina.scene.switch'
  // Presentation state events
  | 'lumina.slide.changed'
  | 'lumina.item.started'
  // Timer events
  | 'lumina.countdown.started'
  | 'lumina.countdown.ended'
  // Service mode
  | 'lumina.service.mode.changed'
  // Production requests (Lumina → Aether)
  | 'lumina.stream.request'
  | 'lumina.recording.request';

export type AetherBridgeRequest = {
  endpointUrl: string;
  accessToken?: string;
  event: AetherBridgeEvent;
  workspaceId: string;
  sessionId: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
};

export type AetherBridgeResult = {
  ok: boolean;
  status: number;
  endpointUrl: string;
  event: AetherBridgeEvent;
  durationMs: number;
  message?: string;
  error?: string;
  response?: Record<string, unknown> | null;
};

const DEFAULT_TIMEOUT_MS = 5000;

const normalizeEndpointUrl = (value: string) => String(value || '').trim().replace(/\/+$/, '');

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message || 'Unknown bridge error';
  return String(error || 'Unknown bridge error');
};

const parseJsonResponse = async (response: Response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) return null;
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
};

export const dispatchAetherBridgeEvent = async (request: AetherBridgeRequest): Promise<AetherBridgeResult> => {
  const endpointUrl = normalizeEndpointUrl(request.endpointUrl);
  if (!endpointUrl) {
    return {
      ok: false,
      status: 0,
      endpointUrl: '',
      event: request.event,
      durationMs: 0,
      error: 'AETHER_ENDPOINT_MISSING',
      message: 'Set an Aether bridge endpoint URL first.',
    };
  }

  const startedAt = performance.now();
  const timeoutMs = Math.max(1000, Number(request.timeoutMs || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-lumina-event': request.event,
        'x-lumina-workspace': request.workspaceId,
        'x-lumina-session': request.sessionId,
        ...(request.accessToken ? { 'x-lumina-token': request.accessToken } : {}),
      },
      body: JSON.stringify({
        source: 'lumina-presenter',
        version: '1.0',
        event: request.event,
        sentAt: new Date().toISOString(),
        workspaceId: request.workspaceId,
        sessionId: request.sessionId,
        payload: request.payload,
      }),
      signal: controller.signal,
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const parsed = await parseJsonResponse(response);
    const message = String(parsed?.message || '').trim();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        endpointUrl,
        event: request.event,
        durationMs,
        message: message || `Bridge request failed with HTTP ${response.status}.`,
        error: `HTTP_${response.status}`,
        response: parsed,
      };
    }

    return {
      ok: true,
      status: response.status,
      endpointUrl,
      event: request.event,
      durationMs,
      message: message || 'Bridge accepted event.',
      response: parsed,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      status: 0,
      endpointUrl,
      event: request.event,
      durationMs,
      error: aborted ? 'AETHER_TIMEOUT' : 'AETHER_NETWORK_ERROR',
      message: aborted
        ? `Bridge request timed out after ${timeoutMs}ms.`
        : toErrorMessage(error),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
