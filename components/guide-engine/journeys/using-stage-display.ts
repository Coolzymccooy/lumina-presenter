import type { GuideJourney } from '../types/guide.types';

/**
 * Presenting Using the Stage Tab
 *
 * data-testid targets used:
 *   header-mode-stage   — Stage mode button in AppHeader
 */
export const usingStageModeJourney: GuideJourney = {
  id: 'using-stage-display',
  title: 'Using the Stage Display',
  description: 'Set up the stage screen so musicians and speakers always know what is coming next.',
  mode: ['training'],
  category: 'stage',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Stage Display',
      description: 'A dedicated screen just for your musicians and speakers.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Stage Display',
        body: 'The Stage tab opens a view designed for the people on stage — musicians, worship leaders, and speakers. It shows the current slide lyrics, an upcoming cue, a service timer, and alerts — all on a separate screen facing the stage.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'switch-to-stage',
      title: 'Open Stage View',
      description: 'Click Stage in the header to open the stage display.',
      target: {
        dataTestId: 'header-mode-stage',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stage Tab',
        body: 'Click Stage in the top navigation. This opens the stage display in the current window. In practice, you would open this on the monitor facing the stage — either drag the window across or use a second browser window with the stage URL from Connect.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'current-slide',
      title: 'Current Slide Area',
      description: 'The large centre panel always shows the current slide content.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Current Slide',
        body: 'The biggest section of the stage view mirrors the live slide — song lyrics, Bible verses, or announcement text. Musicians can read from this instead of looking up at the projection, keeping them focused on the stage.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'run-order',
      title: 'Service Run Order',
      description: 'A sidebar shows the upcoming items so the team can prepare.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Run Order Panel',
        body: 'The run order panel on the side lists every item still to come in the service. Worship leaders and speakers can see what is next without needing a printed sheet — the list updates automatically as items are completed.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'timer-widget',
      title: 'Service Timer',
      description: 'The timer widget shows elapsed or countdown time.',
      target: {
        dataTestId: 'stage-timer-widget',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stage Timer',
        body: 'The timer widget displays the current service time — elapsed or countdown. You can position it anywhere on the stage screen by dragging. The speaker or worship leader sees it directly and can pace themselves without a separate clock.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'done',
      title: 'Stage screen ready',
      description: 'Your stage team is fully informed throughout the service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Stage set',
        body: 'The stage display runs automatically alongside your main presentation. Every slide change, cue, and alert appears on the stage screen in real time — no separate operator needed.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
