import type { GuideJourney } from '../types/guide.types';

/**
 * Uploading PowerPoints
 *
 * data-testid targets used:
 *   files-panel-tab-import        — Import tab in FilesPanel
 *   files-panel-import-pptx-btn   — PowerPoint / PDF import button
 */
export const uploadPowerpointJourney: GuideJourney = {
  id: 'upload-powerpoint',
  title: 'Uploading PowerPoints',
  description: 'Import a .pptx or .pdf file and add it to your service run sheet.',
  mode: ['training'],
  category: 'presentation',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'PowerPoint & PDF Import',
      description: 'Bring your existing presentation slides into Lumina.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Import Slides',
        body: 'Lumina can import PowerPoint (.pptx) and PDF files, converting each page into a slide item in your run sheet. Your existing sermon slides, announcements, and graphics all work.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'import-tab',
      title: 'Open the Import Tab',
      description: 'Go to Files → Import tab.',
      target: {
        dataTestId: 'files-panel-tab-import',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Import Tab',
        body: 'The Import tab is in the Files panel. Open Files from the sidebar or header, then click Import to see all the supported formats.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'pptx-btn',
      title: 'Select PowerPoint / PDF',
      description: 'Click the PowerPoint / PDF button to pick your file.',
      target: {
        dataTestId: 'files-panel-import-pptx-btn',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'PowerPoint / PDF',
        body: 'Click this button and choose your .pptx or .pdf file. Lumina will convert each slide into a high-quality image and add them as a deck to your current run sheet.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'done',
      title: 'Slides imported',
      description: 'Your slides appear as a deck item in the run sheet.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Slides ready',
        body: 'The imported slides are now a deck item in your run sheet. Click the deck to expand it, then click any slide to display it. You can reorder or remove individual slides.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
