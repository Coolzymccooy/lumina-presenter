export type SyncState =
  | 'local_only'
  | 'uploading'
  | 'synced'
  | 'cloud_only'
  | 'upload_failed';

export interface RecordedTrack {
  id: string;
  kind: 'recording';
  title: string;
  durationSec: number;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  syncState: SyncState;
  cloudUrl?: string;
  lastError?: string;
}

export interface LocalRecordingRow extends RecordedTrack {
  blob: Blob;
}
