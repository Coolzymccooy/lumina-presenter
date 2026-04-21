import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioLibrary } from './AudioLibrary';

const libraryFixture = {
  ready: true,
  tracks: [
    { id: 'r1', kind: 'recording' as const, title: 'Sunday', durationSec: 754, mime: 'audio/webm', sizeBytes: 4_200_000, createdAt: '2026-04-21T14:03:00Z', syncState: 'synced' as const, cloudUrl: '/api/recordings/r1/audio' },
    { id: 'r2', kind: 'recording' as const, title: 'Wed Bible Study', durationSec: 900, mime: 'audio/webm', sizeBytes: 5_000_000, createdAt: '2026-04-17T19:00:00Z', syncState: 'local_only' as const },
  ],
  addLocal: vi.fn(),
  syncToCloud: vi.fn(),
  deleteRecording: vi.fn(),
  renameRecording: vi.fn(),
  getPlaybackUrl: vi.fn().mockResolvedValue('blob:abc'),
};

describe('AudioLibrary — My Recordings section', () => {
  it('renders recordings alongside gospel tracks', () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    expect(screen.getByText(/my recordings/i)).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Wed Bible Study')).toBeInTheDocument();
  });

  it('shows sync icon state for each recording', () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    expect(screen.getByTestId('sync-icon-r1')).toHaveAttribute('data-state', 'synced');
    expect(screen.getByTestId('sync-icon-r2')).toHaveAttribute('data-state', 'local_only');
  });

  it('Delete on recording calls deleteRecording', async () => {
    render(<AudioLibrary recordingLibrary={libraryFixture as any} {...({} as any)} />);
    fireEvent.click(screen.getByTestId('recording-menu-r1'));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(libraryFixture.deleteRecording).toHaveBeenCalledWith('r1'));
  });

  it('empty state shows helpful hint', () => {
    render(<AudioLibrary recordingLibrary={{ ...libraryFixture, tracks: [] } as any} {...({} as any)} />);
    expect(screen.getByText(/Recordings from the Sermon Recorder appear here/i)).toBeInTheDocument();
  });
});
