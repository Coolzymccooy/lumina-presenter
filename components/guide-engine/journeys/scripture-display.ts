import type { GuideJourney } from '../types/guide.types';

/**
 * Scripture Display
 *
 * Teaches a user how to search for a Bible passage, add it to the run sheet,
 * and project it on screen.
 *
 * data-testid targets used (existing in BibleBrowser.tsx):
 *   bible-browser-search            — search input
 *   bible-browser-quick-book        — quick-book selector
 *   bible-browser-chapter           — chapter selector
 *   bible-browser-from-verse        — from verse
 *   bible-browser-to-verse          — to verse
 *   bible-browser-structured-preview — passage preview card
 *
 * New targets needed in LibraryTray or PresenterShell:
 *   library-tray-bible-tab          — Bible tab in the library tray
 *   schedule-pane-add-btn           — Add to run sheet button (post-search)
 */
export const scriptureDisplayJourney: GuideJourney = {
  id: 'scripture-display',
  title: 'Display a Scripture Passage',
  description: 'Search for a Bible verse and project it on the output screen.',
  mode: ['onboarding', 'training', 'demo'],
  category: 'scripture',
  audience: ['media', 'volunteer', 'pastor', 'worship-leader'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'Projecting Scripture',
      description: 'Learn how to find and display a Bible passage.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Scripture in 3 steps',
        body: "You can search the Bible, preview the passage, and project it — all from inside Lumina. Let's walk through it.",
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'open-bible-tab',
      title: 'Open the Bible Panel',
      description: 'Click the Bible tab in the library tray.',
      target: {
        dataTestId: 'library-tray-bible-tab',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'right',
      action: 'click',
      tooltip: {
        title: 'Bible Library',
        body: 'Click the Bible tab to open the scripture search panel.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'search-passage',
      title: 'Search for a Passage',
      description: 'Type a book, chapter, or verse into the search bar.',
      target: {
        dataTestId: 'bible-browser-search',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'input',
      tooltip: {
        title: 'Search Scripture',
        body: 'Type a reference like "John 3:16" or a keyword. You can also use the book and chapter pickers below.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'preview-result',
      title: 'Preview the Passage',
      description: 'Check the verse preview before projecting.',
      target: {
        dataTestId: 'bible-browser-structured-preview',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Passage Preview',
        body: "Your selected verses appear here. Review the text before sending it to the screen — especially during a live service.",
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'add-to-run-sheet',
      title: 'Add to Run Sheet',
      description: 'Insert the passage into your service run sheet.',
      target: {
        dataTestId: 'schedule-pane-add-btn',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'left',
      action: 'click',
      tooltip: {
        title: 'Add to Service',
        body: 'Click to add this passage to your run sheet. You can then project it from the Presenter view.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'success',
      },
    },
    {
      id: 'done',
      title: 'Scripture added',
      description: 'The passage is in your run sheet and ready to project.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Ready to project',
        body: "Your passage is in the run sheet. Switch to Presenter and click the slide when you're ready to show it on screen.",
        showBack: false,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
