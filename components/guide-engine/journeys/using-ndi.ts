import type { GuideJourney } from '../types/guide.types';

/**
 * Using NDI / vMix Capture
 *
 * data-testid targets used:
 *   display-setup-ndi-btn     — "Launch for NDI Capture" button in DisplaySetupModal
 */
export const usingNdiJourney: GuideJourney = {
  id: 'using-ndi',
  title: 'Using NDI Output',
  description: 'Capture Lumina output in NDI Tools, vMix, or OBS via the dedicated NDI window.',
  mode: ['training'],
  category: 'output',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'NDI / vMix Capture',
      description: 'Send Lumina output to a production switcher or OBS without any extra hardware.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'NDI Output',
        body: 'Lumina can open a dedicated 1920×1080 output window that you capture by name in NDI Tools Screen Capture, vMix Window Capture, or OBS Window Capture — no display assignment required.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'open-display-setup',
      title: 'Open Display Setup',
      description: 'Find Display Setup in the toolbar to access the NDI controls.',
      target: {
        dataTestId: 'header-display-setup-btn',
        mustBeVisible: false,
        scrollIntoView: false,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Display Setup',
        body: 'Click Display Setup (or the monitor icon) in the header to open the display configuration panel where the NDI option lives.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'ndi-section',
      title: 'NDI Capture Section',
      description: 'The purple NDI section in the sidebar explains how to capture.',
      target: {
        dataTestId: 'display-setup-ndi-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'left',
      action: 'observe',
      tooltip: {
        title: 'Launch for NDI Capture',
        body: 'Clicking this opens a borderless 1920×1080 window named "Lumina Output (Projector)". In your capture software, select that window by name to bring in the feed.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'capture-instructions',
      title: 'Capturing the Feed',
      description: 'How to pick up the NDI window in common software.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'In Your Capture Software',
        body: 'NDI Tools: use Screen Capture → select "Lumina Output (Projector)". vMix: add a Window Capture input with the same name. OBS: add a Window Capture source. The feed updates in real-time.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'NDI ready',
      description: "You're set up for production-grade capture.",
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'NDI output is live',
        body: 'Once the NDI window is open, whatever you display in Lumina — slides, scripture, videos — flows directly into your production or streaming software.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
