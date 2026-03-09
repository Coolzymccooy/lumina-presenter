import { LayoutPreset } from '../../../types.ts';
import announcementCardPreset from './announcementCard.ts';
import cornerNotePreset from './cornerNote.ts';
import lowerThirdPreset from './lowerThird.ts';
import offeringSplitPreset from './offeringSplit.ts';
import singlePreset from './single.ts';
import scriptureReferencePreset from './scriptureReference.ts';
import titleBodyPreset from './titleBody.ts';
import twoColumnPreset from './twoColumn.ts';

export const layoutPresets: LayoutPreset[] = [
  singlePreset,
  titleBodyPreset,
  twoColumnPreset,
  offeringSplitPreset,
  scriptureReferencePreset,
  announcementCardPreset,
  lowerThirdPreset,
  cornerNotePreset,
];

export const getLayoutPreset = (presetId?: string | null) => layoutPresets.find((entry) => entry.id === presetId) || singlePreset;

