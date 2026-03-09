import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const twoColumnPreset: LayoutPreset = {
  id: 'two-column',
  label: 'Two Column',
  description: 'Split content into left and right blocks.',
  defaultSlideType: 'custom',
  createElements: () => createSlideElementSet('custom', 'two-column'),
};

export default twoColumnPreset;

