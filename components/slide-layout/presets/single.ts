import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const singlePreset: LayoutPreset = {
  id: 'single',
  label: 'Single',
  description: 'One centered text block.',
  defaultSlideType: 'custom',
  createElements: () => createSlideElementSet('custom', 'single'),
};

export default singlePreset;

