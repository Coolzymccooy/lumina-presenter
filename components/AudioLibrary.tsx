
import React, { useState } from 'react';
import { GOSPEL_TRACKS, GospelTrack } from '../constants';
import { MusicIcon, PlayIcon, PauseIcon, SquareIcon, Volume2Icon } from './Icons';

interface AudioLibraryProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  progress: number;
  onPlay: (track: GospelTrack) => void;
  onToggle: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  volume: number;
}

export const AudioLibrary: React.FC<AudioLibraryProps> = ({
  currentTrackId,
  isPlaying,
  progress,
  onPlay,
  onToggle,
  onStop,
  onVolumeChange,
  volume
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center bg-zinc-950">
        <MusicIcon className="w-3 h-3 mr-2" />
        Audio Library
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
