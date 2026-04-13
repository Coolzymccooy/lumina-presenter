// Provider
export { GuideProvider } from './providers/GuideProvider';

// Overlay (mount once at app root)
export { GuideOverlay } from './components/GuideOverlay';

// Guided tours picker panel
export { GuidedToursPanel } from './components/GuidedToursPanel';

// Hooks
export { useGuideEngine, useJourney } from './hooks/useGuideEngine';

// Journey definitions + registration
export {
  registerAllJourneys,
  firstTimeSetupJourney,
  scriptureDisplayJourney,
  launchOutputJourney,
  usingBackgroundJourney,
  usingNdiJourney,
  startServiceJourney,
  sermonRecorderJourney,
  uploadPowerpointJourney,
  uploadImagesJourney,
  youtubeVideoJourney,
  bibleCustomBgJourney,
  bibleSessionNameJourney,
  multiUserSyncJourney,
  usingPresenterModeJourney,
  usingStageModeJourney,
  controllingStageViewJourney,
  usingSpeakerNotesJourney,
} from './journeys/index';

// Types (re-exported for consumers)
export type {
  GuideJourney,
  GuideStep,
  GuideEngineState,
  GuideMode,
  GuideAnalyticsEvent,
} from './types/guide.types';
