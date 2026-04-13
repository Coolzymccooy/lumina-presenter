import type { GuideJourney } from '../types/guide.types';

/**
 * Projecting Using the Presenter Tab
 *
 * data-testid targets used:
 *   header-mode-presenter   — Presenter mode button in AppHeader
 */
export const usingPresenterModeJourney: GuideJourney = {
  id: 'using-presenter-mode',
  title: 'Using the Presenter View',
  description: 'Control your service confidently from the full Presenter screen.',
  mode: ['training'],
  category: 'live',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Presenter View',
      description: 'Your command centre for running a live service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Presenter View',
        body: 'The Presenter tab gives you a full-screen control surface — a live preview of the audience screen on the left, your run sheet in the centre, and the output/ops bar on the right. Everything you need to run a service without switching screens.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'switch-to-presenter',
      title: 'Switch to Presenter',
      description: 'Click Presenter in the header to enter presenter mode.',
      target: {
        dataTestId: 'header-mode-presenter',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Presenter Mode',
        body: 'Click the Presenter button at the top of the screen. The layout shifts into the three-pane presenter view. You can switch back to Builder at any time without interrupting the output screen.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'live-preview',
      title: 'Live Preview Pane',
      description: 'The left pane mirrors exactly what your audience sees.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Live Preview',
        body: 'The left pane is a real-time mirror of your audience screen. What you see here is what is on the projection. Use it to verify content before advancing or to catch any unexpected output.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'run-sheet',
      title: 'Centre Run Sheet',
      description: 'Click any item in the centre to send it to the screen.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Run Sheet Control',
        body: 'The centre pane shows your full run sheet. Click any item — a song slide, Bible verse, announcement, or video — to display it instantly on the audience screen. The currently active item is highlighted.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'ops-bar',
      title: 'Ops Bar',
      description: 'Transport controls, timer, and cue tools live in the right pane.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Operations Bar',
        body: 'The right pane holds your operational controls — go live / black screen toggle, service timer, cue next, and any active overlays. Keep an eye on this during the service for one-click access to critical actions.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'done',
      title: 'Ready to present',
      description: 'You have everything you need to run a smooth service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'All set',
        body: 'Use the Presenter view whenever you are running a live service. Switch to Builder to make edits between services and come straight back to Presenter when you go live.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
