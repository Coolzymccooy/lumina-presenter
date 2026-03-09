import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const lowerThirdPreset: LayoutPreset = {
  id: 'lower-third',
  label: 'Lower Third',
  description: 'Name and role lower-third overlay.',
  defaultSlideType: 'announcement',
  createElements: () => createSlideElementSet('announcement', 'lower-third'),
};

export default lowerThirdPreset;

