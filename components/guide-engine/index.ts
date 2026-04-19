// Provider
export { GuideProvider } from './providers/GuideProvider';

// Overlay (mount once at app root)
export { GuideOverlay } from './components/GuideOverlay';

// Guided tours picker panel
export { GuidedToursPanel } from './components/GuidedToursPanel';

// Auto-trigger helpers
export { AutoTriggerOnPresenter } from './components/AutoTriggerOnPresenter';

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
  addingNewSlideJourney,
} from './journeys/index';

// Storage service (for hint dismissal etc.)
export { guideStorage } from './services/guide-storage.service';

// Types (re-exported for consumers)
export type {
  GuideJourney,
  GuideStep,
  GuideEngineState,
  GuideMode,
  GuideAnalyticsEvent,
} from './types/guide.types';
