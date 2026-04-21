export type TranscriptionEngineMode = 'browser_stt' | 'cloud' | 'cloud_fallback' | 'disabled';

export interface ResolveTranscriptionEngineInput {
  autoEnabled: boolean;
  isOnline: boolean;
}

export function resolveTranscriptionEngine({
  autoEnabled,
  isOnline,
}: ResolveTranscriptionEngineInput): TranscriptionEngineMode {
  if (!autoEnabled) return 'disabled';
  return isOnline ? 'cloud' : 'browser_stt';
}
