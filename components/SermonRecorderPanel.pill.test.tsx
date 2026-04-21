/**
 * RecordingSavedPill.test.tsx
 *
 * Tests for the pill component that appears after a sermon recording is saved,
 * showing sync state and offering actions: Sync, Delete, Rename, Open in Mixer.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingSavedPill } from './RecordingSavedPill';
import type { RecordedTrack } from '../services/recordings/types';

describe('RecordingSavedPill', () => {
  const mockTrack: RecordedTrack = {
    id: 'rec-123',
    kind: 'recording',
    title: 'Sermon — 2026-04-21',
    durationSec: 1200,
    mime: 'audio/webm;codecs=opus',
    sizeBytes: 5000000,
    createdAt: new Date().toISOString(),
    syncState: 'local_only',
  };

  it('renders the pill with track title', () => {
    render(
      <RecordingSavedPill
        track={mockTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    expect(screen.getByText('Sermon — 2026-04-21')).toBeInTheDocument();
  });

  it('shows sync status badge for local_only state', () => {
    const localTrack = { ...mockTrack, syncState: 'local_only' as const };
    render(
      <RecordingSavedPill
        track={localTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    expect(screen.getByText('Local Only')).toBeInTheDocument();
  });

  it('shows sync status badge for uploading state', () => {
    const uploadingTrack = { ...mockTrack, syncState: 'uploading' as const };
    render(
      <RecordingSavedPill
        track={uploadingTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('shows sync status badge for synced state', () => {
    const syncedTrack = { ...mockTrack, syncState: 'synced' as const };
    render(
      <RecordingSavedPill
        track={syncedTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('shows sync status badge for upload_failed state', () => {
    const failedTrack = { ...mockTrack, syncState: 'upload_failed' as const };
    render(
      <RecordingSavedPill
        track={failedTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    expect(screen.getByText('Upload Failed')).toBeInTheDocument();
  });

  it('calls onDelete when Delete button is clicked and confirmed', async () => {
    const onDelete = vi.fn();
    render(
      <RecordingSavedPill
        track={mockTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog should appear
    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
      expect(confirmBtn).toBeInTheDocument();
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalled();
    });
  });

  it('calls onRename when user submits a new title', async () => {
    const onRename = vi.fn();
    render(
      <RecordingSavedPill
        track={mockTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
        onOpenInMixer={vi.fn()}
      />
    );

    const renameBtn = screen.getByRole('button', { name: /rename/i });
    fireEvent.click(renameBtn);

    // Edit mode should be shown
    await waitFor(() => {
      const input = screen.getByDisplayValue('Sermon — 2026-04-21');
      expect(input).toBeInTheDocument();

      // Change the name
      fireEvent.change(input, { target: { value: 'New Title' } });

      // Submit the rename
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith('New Title');
    });
  });

  it('calls onSync when Sync button is clicked and canSync is true', async () => {
    const onSync = vi.fn();
    const localTrack = { ...mockTrack, syncState: 'local_only' as const };
    render(
      <RecordingSavedPill
        track={localTrack}
        signedIn={true}
        canSync={true}
        onSync={onSync}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={vi.fn()}
      />
    );

    const syncBtn = screen.getByRole('button', { name: /sync/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(onSync).toHaveBeenCalled();
    });
  });

  it('calls onOpenInMixer when Open in Mixer button is clicked', async () => {
    const onOpenInMixer = vi.fn();
    render(
      <RecordingSavedPill
        track={mockTrack}
        signedIn={false}
        canSync={false}
        onSync={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onOpenInMixer={onOpenInMixer}
      />
    );

    const openMixerBtn = screen.getByRole('button', { name: /open in mixer/i });
    fireEvent.click(openMixerBtn);

    await waitFor(() => {
      expect(onOpenInMixer).toHaveBeenCalled();
    });
  });
});
