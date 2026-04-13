import type { GuideJourney } from '../types/guide.types';

/**
 * Adding Church Name / Session on Bible Smart Background
 *
 * The Smart Custom Background overlays the church name and service session
 * (e.g. "Sunday Morning Service") on top of scripture slides.
 *
 * data-testid targets used:
 *   bible-style-mode-smart-random   — Smart mode button (entry point)
 *   bible-style-picker              — Picker root (for context)
 */
export const bibleSessionNameJourney: GuideJourney = {
  id: 'bible-session-name',
  title: 'Church Name on Bible Slides',
  description: 'Add your church name and service session to Bible Smart backgrounds for branded scripture slides.',
  mode: ['training'],
  category: 'scripture',
  audience: ['admin'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Branded Scripture Slides',
      description: 'Show your church name and service title on every verse.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Church Branding on Scripture',
        body: 'In Smart mode, Lumina can overlay your church name and the current service session name (e.g. "Sunday 1st Service") on every Bible verse slide — keeping your branding front and centre.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'smart-mode',
      title: 'Enable Smart Mode',
      description: 'Church name overlay is available in Smart mode.',
      target: {
        dataTestId: 'bible-style-mode-smart-random',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Switch to Smart',
        body: 'Click the Smart button to enable dynamic backgrounds. Once active, you can set your church name and session in the settings that appear below the style picker.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'church-name-setting',
      title: 'Enter Your Church Name',
      description: 'Go to Settings → Church Profile to set your church name.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Church Name',
        body: "Your church name is set in Settings → Church Profile. Once saved, it appears as a small watermark or header on Smart scripture slides every time you display a verse.",
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'session-name',
      title: 'Service Session Name',
      description: "Set today's service session — it shows on every scripture slide.",
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Session Name',
        body: 'Before each service you can set the session name (e.g. "Easter Sunday" or "Thursday Bible Study"). This overlays on Smart scripture slides so viewers always know what service they are in.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Branding live',
      description: 'Your church name and session are on every verse.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Branding active',
        body: 'Every time you display a Bible verse in Smart mode, your church name and session title appear on screen. No extra steps required during the service.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
