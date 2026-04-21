/**
 * RecordingSavedPill
 *
 * Displays after the user stops recording a sermon.
 * Shows the recording title, sync state, and action buttons:
 * - Sync: upload to cloud (if signedIn and canSync)
 * - Delete: remove locally and from cloud
 * - Rename: edit the recording title
 * - Open in Mixer: open in AudioLibrary (sidebar)
 *
 * The pill reflects live sync state changes from the recording library:
 * local_only → uploading → synced, or upload_failed
 */

import React, { useCallback, useState } from 'react';
import type { RecordedTrack } from '../services/recordings/types';

export interface RecordingSavedPillProps {
  track: RecordedTrack;
  signedIn: boolean;
  canSync: boolean;
  onSync: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onRename: (title: string) => Promise<void> | void;
  onOpenInMixer: () => void;
}

const syncStateBadge = (
  state: RecordedTrack['syncState'],
): { label: string; color: string } => {
  switch (state) {
    case 'local_only':
      return { label: 'Local Only', color: 'bg-zinc-700/40 text-zinc-300' };
    case 'uploading':
      return { label: 'Uploading...', color: 'bg-blue-700/40 text-blue-300' };
    case 'synced':
      return { label: 'Synced', color: 'bg-emerald-700/40 text-emerald-300' };
    case 'upload_failed':
      return { label: 'Upload Failed', color: 'bg-red-700/40 text-red-300' };
    case 'cloud_only':
      return { label: 'Cloud Only', color: 'bg-purple-700/40 text-purple-300' };
    default:
      return { label: 'Unknown', color: 'bg-zinc-700/40 text-zinc-300' };
  }
};

export const RecordingSavedPill: React.FC<RecordingSavedPillProps> = ({
  track,
  signedIn,
  canSync,
  onSync,
  onDelete,
  onRename,
  onOpenInMixer,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(track.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const badge = syncStateBadge(track.syncState);

  const handleRenameStart = useCallback(() => {
    setEditedTitle(track.title);
    setIsEditing(true);
  }, [track.title]);

  const handleRenameSave = useCallback(async () => {
    if (editedTitle.trim() === track.title) {
      setIsEditing(false);
      return;
    }
    try {
      setIsRenaming(true);
      await onRename(editedTitle.trim());
      setIsEditing(false);
    } finally {
      setIsRenaming(false);
    }
  }, [editedTitle, track.title, onRename]);

  const handleRenameCancel = useCallback(() => {
    setEditedTitle(track.title);
    setIsEditing(false);
  }, [track.title]);

  const handleSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onSync]);

  const handleDelete = useCallback(async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete]);

  return (
    <div className="rounded-lg bg-zinc-900/70 border border-zinc-700/50 px-3 py-2.5 space-y-2">
      {/* Title row with badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.currentTarget.value)}
              placeholder="Recording title..."
              className="w-full rounded bg-zinc-800 border border-zinc-600 focus:border-purple-500 outline-none px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-500 transition-colors"
            />
          ) : (
            <p className="text-[11px] font-semibold text-zinc-300 truncate">
              {track.title}
            </p>
          )}
        </div>
        <span
          className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {isEditing ? (
          <>
            <button
              onClick={handleRenameSave}
              disabled={isRenaming || editedTitle.trim() === track.title}
              className="px-2 py-1 rounded bg-purple-700/50 hover:bg-purple-600/50 text-purple-200 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRenaming ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleRenameCancel}
              className="px-2 py-1 rounded border border-zinc-600 text-zinc-400 hover:text-zinc-300 font-bold transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {canSync && signedIn && track.syncState !== 'synced' && (
              <button
                onClick={handleSync}
                disabled={isSyncing || track.syncState === 'uploading'}
                className="px-2 py-1 rounded bg-blue-700/50 hover:bg-blue-600/50 text-blue-200 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing || track.syncState === 'uploading' ? 'Syncing...' : 'Sync'}
              </button>
            )}

            <button
              onClick={handleRenameStart}
              className="px-2 py-1 rounded border border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300 font-bold transition-colors"
            >
              Rename
            </button>

            <button
              onClick={onOpenInMixer}
              className="px-2 py-1 rounded border border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300 font-bold transition-colors"
            >
              Open in Mixer
            </button>

            {showDeleteConfirm ? (
              <>
                <span className="text-zinc-500 font-semibold text-[9px] px-1 py-1 flex items-center">
                  Confirm?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2 py-1 rounded bg-red-700/50 hover:bg-red-600/50 text-red-200 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 rounded border border-zinc-600 text-zinc-400 hover:text-zinc-300 font-bold transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2 py-1 rounded border border-red-700/50 text-red-400 hover:text-red-300 hover:bg-red-950/40 font-bold transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>

      {/* Error message if upload failed */}
      {track.syncState === 'upload_failed' && track.lastError && (
        <p className="text-[9px] text-red-300">{track.lastError}</p>
      )}
    </div>
  );
};
