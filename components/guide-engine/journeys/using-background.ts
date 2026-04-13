import type { GuideJourney } from '../types/guide.types';

/**
 * Using Backgrounds (Motion Library)
 *
 * data-testid targets used:
 *   motion-library            — MotionLibrary root container
 *   motion-library-tab-curated     — Curated tab
 *   motion-library-tab-stills      — Stills tab
 *   motion-library-tab-saved       — Saved tab
 *   motion-library-search          — Search input
 */
export const usingBackgroundJourney: GuideJourney = {
  id: 'using-background',
  title: 'Using Backgrounds',
  description: 'Browse the Motion Library and set a beautiful background for your service.',
  mode: ['training'],
  category: 'presentation',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Background Library',
      description: 'Lumina includes hundreds of motion backgrounds and stills.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Motion Library',
        body: 'The Motion Library gives you access to curated video loops, still images, and alpha overlays to set the mood for every moment of your service.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'open-library',
      title: 'Open the Motion Library',
      description: 'Click the Backgrounds button in the toolbar to open the library.',
      target: {
        dataTestId: 'motion-library',
        mustBeVisible: false,
        scrollIntoView: false,
      },
      placement: 'right',
      action: 'observe',
      tooltip: {
        title: 'Motion Library Panel',
        body: 'The Motion Library panel opens on the side. You can browse categories, search, and preview backgrounds without interrupting your live output.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'curated-tab',
      title: 'Curated Backgrounds',
      description: 'The Curated tab has professionally selected motion loops.',
      target: {
        dataTestId: 'motion-library-tab-curated',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Curated',
        body: 'These are hand-picked motion backgrounds categorised by mood — worship, prayer, announcements, and more. Perfect for most services.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'stills-tab',
      title: 'Still Backgrounds',
      description: 'Clean, high-resolution still images for a minimal look.',
      target: {
        dataTestId: 'motion-library-tab-stills',
        mustBeVisible: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stills',
        body: "Use still backgrounds when motion would be distracting — scripture readings, sermon titles, or anywhere you want the text to stand out clearly.",
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'search',
      title: 'Search Backgrounds',
      description: 'Type a keyword to find the perfect background quickly.',
      target: {
        dataTestId: 'motion-library-search',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Search',
        body: 'Type words like "worship", "cross", "sunrise", or "abstract" to filter results instantly across all categories.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Backgrounds set up',
      description: 'Click any thumbnail to apply it as your background.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'You know backgrounds',
        body: 'Click any thumbnail to instantly set it as your current slide background. Your selection goes live as soon as the slide is displayed to the audience.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
