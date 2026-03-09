import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const titleBodyPreset: LayoutPreset = {
  id: 'title-body',
  label: 'Title + Body',
  description: 'Large heading with a supporting body block.',
  defaultSlideType: 'announcement',
  createElements: () => createSlideElementSet('announcement', 'title-body'),
};

export default titleBodyPreset;

