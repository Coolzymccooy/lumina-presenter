import type { GuideJourney } from '../types/guide.types';

/**
 * Launch Output Screen
 *
 * Walks the operator through sending Lumina content to the projection screen.
 * Critical for live-service reliability — must be clear and fast.
 *
 * data-testid targets used:
 *   header-mode-presenter    — Presenter tab
 *   header-launch-live-btn   — Launch Live / Projection On button
 *   presenter-classic-shell  — Presenter view container (existing)
 *   live-pane-current-slide  — The currently active/live slide in the live pane
 */
export const launchOutputJourney: GuideJourney = {
  id: 'launch-output',
  title: 'Launch the Projection Screen',
  description: 'Open the output screen and send your first slide to the audience.',
  mode: ['onboarding', 'training', 'demo'],
  category: 'output',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: false,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Going Live',
      description: 'Learn how to open the projection screen and control what your audience sees.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Launching the Output',
        body: "The output screen is what your audience sees on the projector or display. You control it from inside Lumina — let's get it open.",
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'switch-to-presenter',
      title: 'Switch to Presenter',
      description: 'Move to the Presenter view to control your live service.',
      target: {
        dataTestId: 'header-mode-presenter',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'click',
      tooltip: {
        title: 'Switch to Presenter',
        body: 'The Presenter view is your live control panel. Click here to switch to it now.',
        showBack: false,
        showNext: true,
        showSkip: true,
      },
      validate: [
        { type: 'visible', selector: '[data-testid="presenter-classic-shell"]' },
      ],
    },
    {
      id: 'click-launch-live',
      title: 'Launch Live',
      description: 'Click LAUNCH LIVE to open the projection output.',
      target: {
        dataTestId: 'header-launch-live-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'click',
      tooltip: {
        title: 'Launch Live',
        body: "Click this button to open a new output window on your projector or secondary display. The button turns green when the output is active.",
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'output-active',
      title: 'Output is Live',
      description: 'The output screen is now open and showing your content.',
      target: {
        dataTestId: 'header-launch-live-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Output is active',
        body: "The button is now green — your projection screen is live. Click any slide in the run sheet to display it instantly.",
        showBack: false,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
    {
      id: 'done',
      title: "You're live",
      description: 'Control your projection from the Presenter view.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: "You're live",
        body: "Click slides in the run sheet to project them. Use BLACKOUT to blank the screen instantly. Use the STAGE button to open the speaker confidence monitor.",
        showBack: false,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
