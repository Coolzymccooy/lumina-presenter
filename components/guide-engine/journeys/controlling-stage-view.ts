import type { GuideJourney } from '../types/guide.types';

/**
 * Controlling the Stage View
 *
 * data-testid targets used:
 *   stage-timer-widget   — Timer widget on the stage display
 *   stage-alert-widget   — Alert widget on the stage display
 */
export const controllingStageViewJourney: GuideJourney = {
  id: 'controlling-stage-view',
  title: 'Controlling the Stage View',
  description: 'Customise the stage screen layout — widgets, alerts, and real-time updates — for your team.',
  mode: ['training'],
  category: 'stage',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Stage View Controls',
      description: 'Position and manage what your stage team sees.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Stage View Controls',
        body: 'The stage screen is fully customisable. You can move widgets, send real-time alerts to the stage, and adjust the layout so your musicians and speakers see exactly what they need.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'timer-widget',
      title: 'Timer Widget',
      description: 'Drag the timer to place it where the speaker can see it easily.',
      target: {
        dataTestId: 'stage-timer-widget',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Moving the Timer',
        body: 'Click and drag the timer widget to reposition it anywhere on the stage screen. Resize it using the corner handle so the numbers are readable from the stage distance. The position is saved between sessions.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'alert-widget',
      title: 'Alert Widget',
      description: 'Send a real-time text alert to the stage screen.',
      target: {
        dataTestId: 'stage-alert-widget',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stage Alerts',
        body: 'The alert widget lets you push a short text message to the stage screen at any moment — "Extend worship", "2 more minutes", "Next: offering". The band or speaker sees it immediately without any disruption to the audience screen.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'stt-panel',
      title: 'Live Transcription',
      description: 'Enable live speech-to-text so the stage team can follow the sermon.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Speech-to-Text Panel',
        body: 'The stage view includes a live transcription panel that can follow the speaker in real time. Activate it from the stage controls and the spoken words appear as rolling text — useful for the worship team to know where the sermon is heading.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'layout-profiles',
      title: 'Layout Profiles',
      description: 'Switch between Classic, Compact, and High Contrast layouts.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Stage Layouts',
        body: 'Choose a layout that suits your stage environment: Classic for a balanced view, Compact for a smaller monitor, and High Contrast for bright stage lighting where readability matters most. Switch at any time without losing your widget positions.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'done',
      title: 'Stage view configured',
      description: 'Your stage team has a clear, real-time view throughout the service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Stage ready',
        body: 'Widget positions, layout, and alert preferences are all saved. Your stage screen is set up for your team — musicians, speakers, and operators all stay informed without needing to watch the audience projection.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
