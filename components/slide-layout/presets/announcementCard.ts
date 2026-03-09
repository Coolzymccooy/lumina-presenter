import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const announcementCardPreset: LayoutPreset = {
  id: 'announcement-card',
  label: 'Announcement Card',
  description: 'Card-style title, body, and footer.',
  defaultSlideType: 'announcement',
  createElements: () => createSlideElementSet('announcement', 'announcement-card'),
};

export default announcementCardPreset;

