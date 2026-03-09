import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const scriptureReferencePreset: LayoutPreset = {
  id: 'scripture-reference',
  label: 'Scripture + Reference',
  description: 'Reference line with scripture text block.',
  defaultSlideType: 'scripture',
  createElements: () => createSlideElementSet('scripture', 'scripture-reference'),
};

export default scriptureReferencePreset;

