export type Mode = 'broadcast' | 'stage' | 'queue' | 'submissions';

export interface ModeCounts {
  broadcast: number;
  stage: number;
  queue: number;
  submissions: number;
}
