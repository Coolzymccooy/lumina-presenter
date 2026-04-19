import type { GuideJourney } from '../types/guide.types';

/**
 * Adding a New Slide
 *
 * Auto-triggered the first time a user enters Presenter mode.
 * Spotlights the three Run Sheet header buttons that all lead to the
 * Smart Layout Slide Editor.
 *
 * data-testid targets used:
 *   runsheet-add-slide-btn   — "+" button (creates a blank item, opens Smart Slide Editor)
 *   runsheet-template-btn    — "TPL" button (template gallery)
 *   runsheet-lyrics-btn      — "LYR" button (lyrics import)
 */
export const addingNewSlideJourney: GuideJourney = {
  id: 'adding-new-slide',
  title: 'Adding a New Slide',
  description: 'Discover the three ways to add a slide and open the Smart Layout Slide Editor.',
  mode: ['onboarding', 'contextual'],
  category: 'presentation',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 1,
  steps: [
    {
      id: 'intro',
      title: 'Add your first slide',
      description: 'Three buttons in the Run Sheet header create new slides.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Adding a slide',
        body: "Every slide in your service starts from one of three buttons at the top of the Run Sheet. Let's look at each one.",
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'plus-button',
      title: 'The + button',
      description: 'Creates a blank slide and opens the Smart Layout Slide Editor.',
      target: {
        dataTestId: 'runsheet-add-slide-btn',
        mustBeVisible: true,
      },
      placement: 'left',
      action: 'observe',
      tooltip: {
        title: '+ — Blank slide',
        body: 'Click + to add a blank item to your run sheet and jump straight into the Smart Layout Slide Editor where you design what the audience sees.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'template-button',
      title: 'TPL — Templates',
      description: 'Pick from pre-built slide templates.',
      target: {
        dataTestId: 'runsheet-template-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'TPL — Templates',
        body: 'Open the template gallery to start from a ready-made slide (announcements, scripture cards, sermon titles, etc).',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'lyrics-button',
      title: 'LYR — Lyrics import',
      description: 'Paste song lyrics and Lumina splits them into slides.',
      target: {
        dataTestId: 'runsheet-lyrics-btn',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'LYR — Lyrics',
        body: 'Paste song lyrics here. Lumina automatically splits verses, choruses, and bridges into individual slides ready to project.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: "You're ready to create",
      description: 'Pick a button and start designing your first slide.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'You know the entry points',
        body: "Tap +, TPL, or LYR whenever you need a new slide. After you save in the editor, your slide appears at the bottom of the Run Sheet — tap it, then press NEXT or Spacebar to project it.",
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
