import { LayoutPreset } from '../../../types.ts';
import { createSlideElementSet } from '../utils/presetFactory.ts';

const cornerNotePreset: LayoutPreset = {
  id: 'corner-note',
  label: 'Corner Note',
  description: 'Main content with a smaller corner note.',
  defaultSlideType: 'custom',
  createElements: () => createSlideElementSet('custom', 'corner-note'),
};

export default cornerNotePreset;

