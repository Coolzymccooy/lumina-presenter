import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const offeringSplitPreset: LayoutPreset = {
  id: 'offering-split',
  label: 'Offering Split',
  description: 'Offering and project details side by side.',
  defaultSlideType: 'offering',
  createElements: () => createSlideElementSet('offering', 'offering-split'),
};

export default offeringSplitPreset;

