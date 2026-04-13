import type { GuideJourney } from '../types/guide.types';

/**
 * First-Time Setup
 *
 * Walks a new user through the Lumina interface — from landing on the Builder
 * to understanding the three main areas (run sheet, output, stage display).
 *
 * data-testid targets used:
 *   guide-welcome-cta       — "Get Started" / "Open Lumina" entry point (center screen)
 *   header-mode-builder     — Builder tab in AppHeader
 *   header-mode-presenter   — Presenter tab in AppHeader
 *   header-launch-live-btn  — Launch Live / Projection button
 *   header-stage-btn        — Stage display button
 *   files-panel-new-btn     — New / start fresh run sheet button
 */
export const firstTimeSetupJourney: GuideJourney = {
  id: 'first-time-setup',
  title: 'Welcome to Lumina',
  description: 'Get oriented in 4 steps — understand the workspace, create a run sheet, and prepare for a live service.',
  mode: ['onboarding', 'training'],
  category: 'setup',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Lumina',
      description: 'Your church service operating system.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Welcome to Lumina',
        body: "Lumina helps your team prepare, control, and run church services from one place. This quick tour takes about 3 minutes.",
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'builder-mode',
      title: 'The Builder',
      description: 'This is where you prepare your service content before going live.',
      target: {
        dataTestId: 'header-mode-builder',
        mustBeVisible: true,
        scrollIntoView: false,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Builder',
        body: 'Use Builder to add songs, scripture, videos, and slides to your service run sheet before the service starts.',
        showBack: false,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'presenter-mode',
      title: 'The Presenter',
      description: 'Switch to Presenter when the service is live.',
      target: {
        dataTestId: 'header-mode-presenter',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Presenter',
        body: 'During a live service, switch to Presenter view to control what your audience sees on the projection screen.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'launch-live',
      title: 'Launch Live',
      description: 'This button sends content to the projection screen.',
      target: {
        dataTestId: 'header-launch-live-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Launch Live',
        body: "When you're ready to go live, click this to open the projection output. Your audience will see whatever slide you display.",
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'stage-display',
      title: 'Stage Display',
      description: 'The confidence monitor for your speakers and worship leaders.',
      target: {
        dataTestId: 'header-stage-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stage Display',
        body: 'Stage Display shows lyrics, speaker notes, and timers on a separate screen — only your team sees it, not the audience.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: "You're ready",
      description: 'Start preparing your first service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: "You're set up",
        body: "That's the core of Lumina. Use the Builder to prepare content, then switch to Presenter when the service starts. Next: add your first scripture passage.",
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
