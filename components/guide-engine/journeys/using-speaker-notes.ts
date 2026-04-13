import type { GuideJourney } from '../types/guide.types';

/**
 * Using Speaker Notes / Speaker Preset
 *
 * All steps are tooltip-only (placement: center) because the speaker notes
 * panel does not yet have data-testid attributes. Once testids are added to
 * BuilderPreviewPanel and StageWorkspace, steps can be upgraded to targeted.
 */
export const usingSpeakerNotesJourney: GuideJourney = {
  id: 'using-speaker-notes',
  title: 'Using Speaker Notes',
  description: 'Add notes to any slide and surface them on the stage screen for your speaker or worship leader.',
  mode: ['training'],
  category: 'stage',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Speaker Notes',
      description: 'Private notes for your speaker — invisible to the audience.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Speaker Notes',
        body: 'Every slide in Lumina can carry speaker notes — sermon talking points, song key reminders, or cue instructions. Notes appear on the stage screen for the speaker and worship leader, but never on the audience projection.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'add-notes-in-builder',
      title: 'Adding Notes in Builder',
      description: 'Open a slide in Builder and look for the Notes panel below the preview.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Notes Panel in Builder',
        body: 'In the Builder view, click any slide to select it. Below the slide preview you will see the Notes panel. Type your talking points, scriptures, or reminders directly into the text area — they are saved automatically with the slide.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'speaker-preset',
      title: 'Speaker Preset',
      description: 'Use a preset template to quickly structure your notes.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Notes Presets',
        body: 'The notes area includes preset templates — "Scripture Reference", "Illustration", "Application Point" — that help you structure your preparation consistently. Select a preset to insert a formatted outline, then fill in your content.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'notes-on-stage',
      title: 'Notes on Stage Screen',
      description: 'Notes appear automatically on the stage display when the slide is live.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Live Stage Notes',
        body: 'When you display a slide during the service, its notes appear on the stage screen immediately. The speaker sees their talking points at the moment they need them — no paper, no prompting, no distractions.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'done',
      title: 'Notes ready',
      description: 'Your speaker is prepared for every slide in the service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'All set',
        body: 'Notes are attached to each slide and update on the stage screen in real time. Your speaker can focus on delivery, knowing their preparation is right there whenever a slide changes.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
