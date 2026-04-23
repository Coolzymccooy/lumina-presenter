import React from 'react';
import { SlideRenderer } from './SlideRenderer';
import { useNdiSceneState } from './ndi/useNdiSceneState';

export const LowerThirdsNdiRoute: React.FC = () => {
  const { effective, params } = useNdiSceneState('lower-thirds-ndi');

  const shouldRender = effective.lowerThirdsEnabled
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
          lowerThirds
          hideBackground
          showProjectorHelper={false}
        />
      )}
    </div>
  );
};
