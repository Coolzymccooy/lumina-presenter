import type { GuideJourney } from '../types/guide.types';

/**
 * Enable Sync with Multiple Users
 *
 * data-testid targets used:
 *   header-connect-btn              — Connect / share button in AppHeader
 *   connect-modal-tab-audience      — Audience tab in ConnectModal
 *   connect-modal-tab-aether        — Aether tab in ConnectModal
 *   connect-modal-copy-remote-url   — Copy button for the Remote URL
 *   connect-modal-copy-stage-url    — Copy button for the Stage/operator URL
 */
export const multiUserSyncJourney: GuideJourney = {
  id: 'multi-user-sync',
  title: 'Sync with Multiple Users',
  description: 'Share your service with a co-presenter, stage display, or remote operator in real time.',
  mode: ['training'],
  category: 'live',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Real-Time Multi-User Sync',
      description: 'Lumina lets multiple people connect to the same service live.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Multi-User Sync',
        body: 'Lumina can sync your service in real time across multiple devices — a co-presenter on another machine, a stage display showing lyrics to musicians, or a remote operator controlling slides from a tablet.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'connect-btn',
      title: 'Open Connect',
      description: 'The Connect button opens the sharing and sync panel.',
      target: {
        dataTestId: 'header-connect-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Connect Panel',
        body: 'Click the Connect button in the header to open the sharing panel. From here you can generate URLs for the audience screen, stage display, and remote operator view.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'audience-tab',
      title: 'Audience View',
      description: 'The Audience tab gives you the link for the main projection screen.',
      target: {
        dataTestId: 'connect-modal-tab-audience',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Audience Tab',
        body: 'The Audience tab contains links you can use to display your service on any screen — browser source for streaming, a second monitor, or a remote display. Copy and open the URL on the target device.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'aether-tab',
      title: 'Aether — Remote Control',
      description: 'Aether lets a second operator control slides from any device.',
      target: {
        dataTestId: 'connect-modal-tab-aether',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Aether Remote',
        body: 'The Aether tab generates a Remote URL that a co-presenter or operator can open on a phone, tablet, or laptop. They see the run sheet and can advance slides — everything syncs instantly.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'copy-url',
      title: 'Share the URL',
      description: 'Copy and send the relevant URL to each person on your team.',
      target: {
        dataTestId: 'connect-modal-copy-remote-url',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Copy & Share',
        body: 'Click the copy icon next to a URL, then send it via WhatsApp, email, or AirDrop. The recipient opens the link in their browser — no app install needed. Changes on the main machine appear on their screen immediately.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Team is connected',
      description: 'Your service is now live across all connected devices.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Everyone in sync',
        body: 'Any slide change, scripture display, or media item you trigger is reflected on every connected device instantly. Your team stays in sync throughout the service without any manual coordination.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
