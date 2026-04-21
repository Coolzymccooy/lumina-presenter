
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GOSPEL_TRACKS, GospelTrack } from '../constants';
import { MusicIcon, PlayIcon, PauseIcon, SquareIcon, Volume2Icon } from './Icons';
import type { RecordingLibrary } from '../hooks/useRecordingLibrary';
import type { RecordedTrack } from '../services/recordings/types';

interface AudioLibraryProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  progress: number;
  onPlay: (track: GospelTrack) => void;
  onToggle: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  volume: number;
  recordingLibrary?: RecordingLibrary;
}

export const AudioLibrary: React.FC<AudioLibraryProps> = ({
  currentTrackId,
  isPlaying,
  progress,
  onPlay,
  onToggle,
  onStop,
  onVolumeChange,
  volume,
  recordingLibrary
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center bg-zinc-950">
        <MusicIcon className="w-3 h-3 mr-2" />
        Audio Library
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* My Recordings Section */}
        {recordingLibrary && (
          <div data-testid="my-recordings" className="mb-3">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-2 py-1">
              My Recordings
            </h3>
            {recordingLibrary.tracks.length === 0 ? (
              <div className="px-2 py-2 text-[9px] text-zinc-500">
                Recordings from the Sermon Recorder appear here. Click 'Open in Mixer' after stopping a recording.
              </div>
            ) : (
              <ul className="space-y-1">
                {recordingLibrary.tracks.map((track) => (
                  <RecordingRow
                    key={track.id}
                    track={track}
                    recordingLibrary={recordingLibrary}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Gospel Tracks */}
        {GOSPEL_TRACKS.map((track) => {
          const isThisActive = currentTrackId === track.id;
          return (
            <div
              key={track.id}
              onClick={() => onPlay(track)}
              className={`
                group p-2 rounded-sm border cursor-pointer transition-all flex items-center justify-between
                ${isThisActive ? 'bg-zinc-900 border-zinc-700' : 'bg-transparent border-transparent hover:bg-zinc-900/50'}
              `}
            >
              <div className="flex flex-col min-w-0 mr-2">
                <span className={`text-[11px] font-bold truncate ${isThisActive ? 'text-blue-400' : 'text-zinc-300'}`}>
                  {track.title}
                </span>
                <span className="text-[9px] text-zinc-600 uppercase font-mono">{track.artist}</span>
              </div>

              <div className="flex items-center">
                {isThisActive && isPlaying ? (
                    <div className="flex items-center gap-0.5 h-3 mr-2">
                        <div className="w-0.5 bg-blue-500 animate-[bounce_0.6s_infinite] h-full" style={{ animationDelay: '0s' }}></div>
                        <div className="w-0.5 bg-blue-500 animate-[bounce_0.8s_infinite] h-2/3" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-0.5 bg-blue-500 animate-[bounce_0.7s_infinite] h-3/4" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                ) : (
                    <span className="text-[9px] text-zinc-700 font-mono group-hover:hidden">{track.duration}</span>
                )}
                <PlayIcon className={`w-3 h-3 text-blue-500 group-hover:block ${isThisActive ? 'block' : 'hidden'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini-Player Dock */}
      {currentTrackId && (
          <div className="bg-zinc-900 border-t border-zinc-800 p-3 space-y-2 shadow-2xl">
              <div className="flex items-center justify-between">
                  <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[10px] text-blue-400 font-bold truncate uppercase tracking-tighter">
                          Playing: {GOSPEL_TRACKS.find(t => t.id === currentTrackId)?.title}
                      </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-300 transition-colors"
                      >
                          {isPlaying ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onStop(); }}
                        className="p-1.5 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-red-400 transition-colors"
                      >
                          <SquareIcon className="w-3 h-3" />
                      </button>
                  </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 bg-zinc-950 w-full rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300 ease-linear"
                    style={{ width: `${progress}%` }}
                  ></div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                  <Volume2Icon className="w-3 h-3 text-zinc-600" />
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
              </div>
          </div>
      )}
    </div>
  );
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

interface RecordingRowProps {
  track: RecordedTrack;
  recordingLibrary: RecordingLibrary;
}

const RecordingRow: React.FC<RecordingRowProps> = ({ track, recordingLibrary }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(track.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    try {
      setPlaybackError(null);

      // Clean up previous audio element
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const url = await recordingLibrary.getPlaybackUrl(track.id);
      if (url) {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Playback failed';
          setPlaybackError(message);
          setIsPlaying(false);
        });
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get playback URL';
      setPlaybackError(message);
    }
  }, [track.id, recordingLibrary]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleRename = useCallback(async () => {
    await recordingLibrary.renameRecording(track.id, newTitle);
    setIsRenaming(false);
  }, [track.id, newTitle, recordingLibrary]);

  const handleDeleteConfirm = useCallback(async () => {
    await recordingLibrary.deleteRecording(track.id);
    setConfirmDelete(false);
    setMenuOpen(false);
  }, [track.id, recordingLibrary]);

  const handleSyncToCloud = useCallback(async () => {
    await recordingLibrary.syncToCloud(track.id);
    setMenuOpen(false);
  }, [track.id, recordingLibrary]);

  const syncIcon = (() => {
    switch (track.syncState) {
      case 'synced':
        return '✓';
      case 'uploading':
        return '↑';
      case 'upload_failed':
        return '✗';
      case 'local_only':
        return '•';
      case 'cloud_only':
        return '☁';
      default:
        return '';
    }
  })();

  return (
    <li data-testid={`recording-row-${track.id}`} className="group p-2 rounded-sm border bg-transparent border-transparent hover:bg-zinc-900/50 transition-all flex items-center justify-between">
      <div className="flex items-center min-w-0 mr-2 flex-1 flex-col items-start">
        <div className="flex items-center min-w-0 w-full">
          <button
            onClick={handlePlay}
            className="p-1 hover:bg-zinc-800 rounded-sm text-blue-500 transition-colors flex-shrink-0"
          >
            {isPlaying ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />}
          </button>
          <div className="flex flex-col min-w-0 ml-2 flex-1">
            {isRenaming ? (
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                className="text-[11px] font-bold bg-zinc-800 text-zinc-300 px-1 rounded-sm border border-zinc-700 truncate"
              />
            ) : (
              <button
                onClick={() => setIsRenaming(true)}
                className="text-[11px] font-bold text-zinc-300 text-left hover:text-blue-400 transition-colors truncate"
              >
                {track.title}
              </button>
            )}
            <span className="text-[9px] text-zinc-600 font-mono">
              {formatDuration(track.durationSec)} • {formatFileSize(track.sizeBytes)}
            </span>
          </div>
        </div>
        {playbackError && (
          <span className="text-xs text-red-400 ml-8 mt-1" role="alert">
            {playbackError}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          data-testid={`sync-icon-${track.id}`}
          data-state={track.syncState}
          className="text-[9px] text-zinc-600 w-3 text-center"
        >
          {syncIcon}
        </span>

        <div className="relative">
          <button
            data-testid={`recording-menu-${track.id}`}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ⋮
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-sm shadow-lg z-50"
              role="menu"
              aria-label="Recording actions"
            >
              {track.syncState === 'local_only' && (
                <button
                  role="menuitem"
                  onClick={handleSyncToCloud}
                  className="block w-full px-3 py-1 text-left text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-blue-400 transition-colors whitespace-nowrap"
                >
                  Sync to Cloud
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => setConfirmDelete(true)}
                className="block w-full px-3 py-1 text-left text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-red-400 transition-colors whitespace-nowrap"
              >
                Delete
              </button>
            </div>
          )}

          {confirmDelete && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-sm shadow-lg z-50">
              <div className="px-3 py-2 text-[10px] text-zinc-300 whitespace-nowrap">
                Delete "{track.title}"?
              </div>
              <div className="flex gap-1 px-3 py-1">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-[9px] bg-zinc-700 hover:bg-zinc-600 rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  name="confirm"
                  onClick={handleDeleteConfirm}
                  className="px-2 py-1 text-[9px] bg-red-900 hover:bg-red-800 rounded-sm transition-colors text-red-100"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
};
