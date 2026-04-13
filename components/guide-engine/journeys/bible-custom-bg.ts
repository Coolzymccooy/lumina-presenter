import type { GuideJourney } from '../types/guide.types';

/**
 * Bible Custom Background
 *
 * data-testid targets used:
 *   bible-style-picker              — BibleStylePicker root
 *   bible-style-mode-smart-random   — Smart mode button
 *   bible-style-mode-preset         — Preset mode button
 *   bible-style-shuffle-btn         — Shuffle button
 *   bible-style-family-auto         — Auto family chip
 */
export const bibleCustomBgJourney: GuideJourney = {
  id: 'bible-custom-bg',
  title: 'Bible Custom Background',
  description: "Customise the background style for every Bible verse your church displays.",
  mode: ['training'],
  category: 'scripture',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Bible Style Picker',
      description: 'Choose how your Bible verses look on the projection screen.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Bible Custom Background',
        body: 'Every Bible verse in Lumina can have its own background style. Use Classic for a clean dark look, Smart for automatically changing visuals, or Preset to lock a specific theme for your whole service.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'picker',
      title: 'Style Controls',
      description: 'The style picker lives alongside the scripture display panel.',
      target: {
        dataTestId: 'bible-style-picker',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'right',
      action: 'observe',
      tooltip: {
        title: 'Style Picker',
        body: 'You will see three style modes at the top — Classic, Smart, and Preset — and a family row below. Together they control the visual treatment for all scripture in your service.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'smart-mode',
      title: 'Smart Mode',
      description: 'Backgrounds change intelligently with each verse.',
      target: {
        dataTestId: 'bible-style-mode-smart-random',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Smart Mode',
        body: 'Smart mode picks a new background for each scripture display, choosing from the selected family. It keeps things visually fresh without you having to choose manually every time.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'shuffle',
      title: 'Shuffle',
      description: 'Instantly preview a different random style.',
      target: {
        dataTestId: 'bible-style-shuffle-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Shuffle Style',
        body: 'Click Shuffle at any time to pick a fresh background combination. The preview updates immediately and will be used for the next verse displayed.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'family',
      title: 'Style Family',
      description: 'Pin a visual family to keep a consistent aesthetic.',
      target: {
        dataTestId: 'bible-style-family-auto',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Style Family',
        body: 'The Family row lets you pin a colour palette or visual theme — deep blue, warm amber, minimal grey, and more. Auto lets Lumina choose freely; selecting a family keeps the look cohesive.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Scripture style locked in',
      description: 'Your verse backgrounds will look exactly as configured.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Style ready',
        body: 'Every scripture you display will use your chosen style. You can change it mid-service at any time and the new style takes effect on the next verse.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
