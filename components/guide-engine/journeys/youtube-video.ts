import type { GuideJourney } from '../types/guide.types';

/**
 * Playing YouTube Videos
 *
 * data-testid targets used:
 *   files-panel-tab-import         — Import tab in FilesPanel
 *   files-panel-video-url-input    — YouTube / video URL input
 *   files-panel-add-video-btn      — Add video button
 */
export const youtubeVideoJourney: GuideJourney = {
  id: 'youtube-video',
  title: 'Playing YouTube Videos',
  description: 'Add a YouTube link to your run sheet and play it during a service.',
  mode: ['training'],
  category: 'presentation',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'intro',
      title: 'YouTube & Video URLs',
      description: 'Play any YouTube video or direct video URL in your service.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Video in Lumina',
        body: 'You can add YouTube links or direct video URLs to your run sheet. When you display that item, the video plays fullscreen on your audience screen — no tab switching needed.',
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'import-tab',
      title: 'Open the Import Tab',
      description: 'Go to Files → Import to find the Video URL section.',
      target: {
        dataTestId: 'files-panel-tab-import',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Import Tab',
        body: 'Open the Files panel and click the Import tab. Scroll to the bottom to find the Video URL section where you can paste any YouTube or video link.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'url-input',
      title: 'Paste the URL',
      description: 'Paste your YouTube link into the Video URL field.',
      target: {
        dataTestId: 'files-panel-video-url-input',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Video URL',
        body: 'Paste a YouTube link (e.g. youtube.com/watch?v=…) or a direct .mp4 URL. You can also paste short links like youtu.be/… and they will work fine.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'add-btn',
      title: 'Add to Run Sheet',
      description: 'Click Add to insert the video as a run sheet item.',
      target: {
        dataTestId: 'files-panel-add-video-btn',
        mustBeVisible: true,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Add Video',
        body: 'Click Add (or press Enter) and the video appears as a media item in your run sheet. When you click that item during the service, the video plays immediately on the audience screen.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'success',
      },
    },
    {
      id: 'done',
      title: 'Video is ready',
      description: 'The video item is in your run sheet — click it during service to play.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Video ready',
        body: 'The video is queued in your run sheet. Click it when you want it to play. The audience screen switches to the video player and playback starts automatically.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
