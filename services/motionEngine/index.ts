/**
 * Lumina Motion Engine – Public API
 */

export { MotionEngine } from './MotionEngine';
export {
  createScene,
  createSceneFromDefinition,
  getSceneDefinition,
  hasMotionScene,
  isRegisteredMotionUrl,
  normalizeMotionSceneId,
  normalizeMotionUrl,
} from './SceneRegistry';
export {
  LUMINA_MOTION_PRESETS,
  LUMINA_MOTION_URLS,
  MOTION_PRESET_MAP,
  generateMotionPoster,
} from './presets';
export {
  MOTION_URL_PREFIX,
  buildMotionUrl,
  extractMotionSceneId,
  isMotionUrl,
} from './types';
export type {
  MotionPalette,
  MotionSceneCategory,
  MotionSceneDefinition,
  MotionSceneKind,
  RuntimeScene,
  SceneFactory,
} from './types';
