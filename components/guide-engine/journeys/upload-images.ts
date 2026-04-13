import type { GuideJourney } from '../types/guide.types';

/**
 * Uploading Images
 *
 * data-testid targets used:
 *   files-panel-tab-import        — Import tab in FilesPanel
 *   motion-library-tab-stills     — Stills tab in Motion Library (also covers custom images)
 */
export const uploadImagesJourney: GuideJourney = {
  id: 'upload-images',
  title: 'Uploading Images',
  description: 'Add custom images — announcement graphics, church logos, photos — to your service.',
  mode: ['training'],
  category: 'presentation',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Custom Images',
      description: 'Display your own graphics alongside Lumina built-in backgrounds.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Uploading Images',
        body: 'You can use your own images — announcement graphics, event photos, church branding — as slide backgrounds or standalone slides in the run sheet.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'import-tab',
      title: 'Import Tab',
      description: 'The Import tab in Files supports image files.',
      target: {
        dataTestId: 'files-panel-tab-import',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Files → Import',
        body: 'Open the Files panel and switch to the Import tab. From here you can import image files (.jpg, .png, .webp) directly into your run sheet as slide items.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'as-background',
      title: 'Images as Backgrounds',
      description: 'Use an image as a slide background via the Motion Library.',
      target: {
        dataTestId: 'motion-library-tab-stills',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Stills as Backgrounds',
        body: 'The Stills tab in the Motion Library includes the option to upload a custom image and use it as a background for any slide. Great for branded title screens.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Image added',
      description: 'Your image is now part of your service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Images ready',
        body: 'Once added, images appear in your run sheet just like any other slide. Click to display them, drag to reorder, or remove them at any time.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
