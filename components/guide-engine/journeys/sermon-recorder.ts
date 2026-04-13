import type { GuideJourney } from '../types/guide.types';

/**
 * Using the Sermon Recorder
 *
 * data-testid targets used:
 *   sermon-recorder-panel        — Root panel
 *   sermon-recorder-start-btn    — Start Recording button
 *   sermon-recorder-pause-btn    — Pause button
 *   sermon-recorder-stop-btn     — Stop & Transcribe button
 *   sermon-recorder-summarize-btn — Summarize with AI button
 *   sermon-recorder-flash-btn    — Flash to Screen button
 */
export const sermonRecorderJourney: GuideJourney = {
  id: 'sermon-recorder',
  title: 'Sermon Recorder',
  description: 'Record, transcribe, and summarise your sermon live — then flash the key points to the screen.',
  mode: ['training'],
  category: 'live',
  audience: ['admin', 'media', 'volunteer'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 4,
  steps: [
    {
      id: 'intro',
      title: 'Sermon Recorder',
      description: "Record your pastor's sermon and let AI do the rest.",
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Sermon Recorder',
        body: "Lumina can record your pastor's voice, transcribe it live, and use AI to generate a key-point summary — all while the service is running. You can then flash the summary to the audience screen.",
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'panel',
      title: 'Open the Recorder',
      description: 'Find the Sermon Recorder panel in the sidebar.',
      target: {
        dataTestId: 'sermon-recorder-panel',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'right',
      action: 'observe',
      tooltip: {
        title: 'Sermon Recorder Panel',
        body: 'The recorder is tucked in the sidebar. You can choose your microphone, set the accent hint for better transcription accuracy, then hit Start.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'start',
      title: 'Start Recording',
      description: 'Hit Start Recording to begin capturing the sermon.',
      target: {
        dataTestId: 'sermon-recorder-start-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Start Recording',
        body: 'Lumina streams audio to Gemini for live transcription. The transcript appears in real-time below. Recording continues in the background even if you switch slides.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'pause-stop',
      title: 'Pause or Stop',
      description: 'Pause to temporarily stop capturing, or stop to finalise the transcript.',
      target: {
        dataTestId: 'sermon-recorder-pause-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Pause & Stop',
        body: 'Pause the recording during worship or announcements to keep the transcript clean. Click Stop & Transcribe when the sermon is done to finalise the full text.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'summarize',
      title: 'AI Summary',
      description: 'Let AI extract the key points from the transcript.',
      target: {
        dataTestId: 'sermon-recorder-summarize-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Summarise with AI',
        body: 'Once the transcript is ready, click this to generate a structured summary — sermon title, main theme, key scriptures, and takeaway points. Takes about 10 seconds.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'flash',
      title: 'Flash to Screen',
      description: 'Send the summary directly to the audience display.',
      target: {
        dataTestId: 'sermon-recorder-flash-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Flash to Screen',
        body: "Click Flash to Screen to display the sermon summary on the audience projection. Perfect for post-sermon recap, altar calls, or giving people something to take home.",
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'success',
      },
    },
    {
      id: 'done',
      title: 'Sermon captured',
      description: 'Your sermon is recorded, transcribed, summarised, and on screen.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'All done',
        body: 'You can also save the summary to your Sermons archive or add it to the run sheet for future reference. Every sermon is stored and searchable.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
