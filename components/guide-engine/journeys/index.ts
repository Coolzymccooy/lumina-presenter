import { registerJourney } from '../engine/guide-registry';
import { firstTimeSetupJourney } from './first-time-setup';
import { scriptureDisplayJourney } from './scripture-display';
import { launchOutputJourney } from './launch-output';
import { usingBackgroundJourney } from './using-background';
import { usingNdiJourney } from './using-ndi';
import { startServiceJourney } from './start-service';
import { sermonRecorderJourney } from './sermon-recorder';
import { uploadPowerpointJourney } from './upload-powerpoint';
import { uploadImagesJourney } from './upload-images';
import { youtubeVideoJourney } from './youtube-video';
import { bibleCustomBgJourney } from './bible-custom-bg';
import { bibleSessionNameJourney } from './bible-session-name';
import { multiUserSyncJourney } from './multi-user-sync';
import { usingPresenterModeJourney } from './using-presenter-mode';
import { usingStageModeJourney } from './using-stage-display';
import { controllingStageViewJourney } from './controlling-stage-view';
import { usingSpeakerNotesJourney } from './using-speaker-notes';

export function registerAllJourneys(): void {
  registerJourney(firstTimeSetupJourney);
  registerJourney(scriptureDisplayJourney);
  registerJourney(launchOutputJourney);
  registerJourney(usingBackgroundJourney);
  registerJourney(usingNdiJourney);
  registerJourney(startServiceJourney);
  registerJourney(sermonRecorderJourney);
  registerJourney(uploadPowerpointJourney);
  registerJourney(uploadImagesJourney);
  registerJourney(youtubeVideoJourney);
  registerJourney(bibleCustomBgJourney);
  registerJourney(bibleSessionNameJourney);
  registerJourney(multiUserSyncJourney);
  registerJourney(usingPresenterModeJourney);
  registerJourney(usingStageModeJourney);
  registerJourney(controllingStageViewJourney);
  registerJourney(usingSpeakerNotesJourney);
}

export {
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
};
