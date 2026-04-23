import React from 'react';
import { ItemType } from '../types';
import { SlideRenderer } from './SlideRenderer';
import { useNdiSceneState } from './ndi/useNdiSceneState';

const LYRIC_ITEM_TYPES = new Set<ItemType>([ItemType.SONG, ItemType.HYMN]);

export const LyricsNdiRoute: React.FC = () => {
  const { effective, params } = useNdiSceneState('lyrics-ndi');

  const isLyricItem = !!effective.item && LYRIC_ITEM_TYPES.has(effective.item.type);
  const shouldRender = isLyricItem
    && effective.hasRenderable
    && !effective.blackout
    && effective.holdScreenMode === 'none';

  return (
    <div className="h-screen w-screen" style={params.fillKey ? { background: 'transparent' } : { background: '#000' }}>
      {params.fillKey && (
        <style>{'html,body,#root{background:transparent !important;}'}</style>
      )}
      {shouldRender && (
        <SlideRenderer
          slide={effective.slide}
          item={effective.item}
          fitContainer
          isPlaying={effective.isPlaying}
          isMuted
          isProjector
          hideBackground
          showProjectorHelper={false}
        />
      )}
    </div>
  );
};
