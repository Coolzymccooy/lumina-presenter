/**
 * Scene Registry – Maps scene kinds to their factory functions
 * and resolves scene definitions by ID.
 */

import type { MotionSceneDefinition, RuntimeScene, SceneFactory } from './types';
import { MOTION_PRESET_MAP } from './presets';
import { buildMotionUrl, extractMotionSceneId, isMotionUrl } from './types';
import { createGradientFlowScene } from './scenes/gradientFlow';
import { createGlassWavesScene } from './scenes/glassWaves';
import { createLightRaysScene } from './scenes/lightRays';
import { createParticlesScene } from './scenes/particles';
import { createHeavenGlowScene } from './scenes/heavenGlow';
import { createCelestialBurstScene } from './scenes/celestialBurst';
import { createStarlightCanopyScene } from './scenes/starlightCanopy';

const SCENE_FACTORIES: Record<string, SceneFactory> = {
  gradientFlow: createGradientFlowScene,
  glassWaves: createGlassWavesScene,
  lightRays: createLightRaysScene,
  particles: createParticlesScene,
  heavenGlow: createHeavenGlowScene,
  celestialBurst: createCelestialBurstScene,
  starlightCanopy: createStarlightCanopyScene,
};

export function getSceneDefinition(sceneId: string): MotionSceneDefinition | null {
  return MOTION_PRESET_MAP.get(sceneId) || null;
}

export function hasMotionScene(sceneId: string): boolean {
  return MOTION_PRESET_MAP.has(String(sceneId || '').trim());
}

export function isRegisteredMotionUrl(url: string): boolean {
  const trimmed = String(url || '').trim();
  return isMotionUrl(trimmed) && hasMotionScene(extractMotionSceneId(trimmed));
}

export function normalizeMotionSceneId(sceneId: string, fallbackSceneId = 'sermon-clean'): string {
  const trimmed = String(sceneId || '').trim();
  if (hasMotionScene(trimmed)) return trimmed;
  return hasMotionScene(fallbackSceneId) ? fallbackSceneId : trimmed;
}

export function normalizeMotionUrl(url: string, fallbackSceneId = 'sermon-clean'): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) return buildMotionUrl(normalizeMotionSceneId(fallbackSceneId, fallbackSceneId));
  if (!isMotionUrl(trimmed)) return trimmed;
  return buildMotionUrl(normalizeMotionSceneId(extractMotionSceneId(trimmed), fallbackSceneId));
}

export function createScene(sceneId: string): RuntimeScene | null {
  const definition = getSceneDefinition(sceneId);
  if (!definition) return null;
  const factory = SCENE_FACTORIES[definition.kind];
  if (!factory) return null;
  return factory(definition);
}

export function createSceneFromDefinition(definition: MotionSceneDefinition): RuntimeScene | null {
  const factory = SCENE_FACTORIES[definition.kind];
  if (!factory) return null;
  return factory(definition);
}
