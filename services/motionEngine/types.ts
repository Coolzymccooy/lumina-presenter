/**
 * Lumina Motion Engine – Type definitions
 *
 * Canvas-based animated backgrounds that run fully offline.
 * Zero external dependencies – uses native Canvas 2D API only.
 */

export interface MotionPalette {
  primary: string;
  secondary: string;
  accent?: string;
  glow?: string;
  bg?: string;
}

export type MotionSceneKind =
  | 'gradientFlow'
  | 'glassWaves'
  | 'lightRays'
  | 'particles'
  | 'heavenGlow'
  | 'celestialBurst'
  | 'starlightCanopy';

export type MotionSceneCategory =
  | 'worship'
  | 'sermon'
  | 'prayer'
  | 'celebration'
  | 'seasonal';

export interface MotionSceneDefinition {
  id: string;
  name: string;
  category: MotionSceneCategory;
  kind: MotionSceneKind;
  palette: MotionPalette;
  speed: number;
  intensity: number;
  particleDensity?: number;
  bloom?: number;
  blur?: number;
}

export interface RuntimeScene {
  setup(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  update(deltaMs: number): void;
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export type SceneFactory = (definition: MotionSceneDefinition) => RuntimeScene;

/** URL prefix for Lumina motion backgrounds: `motion://scene-id` */
export const MOTION_URL_PREFIX = 'motion://';

export function isMotionUrl(url: string): boolean {
  return String(url || '').startsWith(MOTION_URL_PREFIX);
}

export function extractMotionSceneId(url: string): string {
  return String(url || '').replace(MOTION_URL_PREFIX, '');
}

export function buildMotionUrl(sceneId: string): string {
  return `${MOTION_URL_PREFIX}${sceneId}`;
}
