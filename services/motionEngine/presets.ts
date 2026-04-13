/**
 * Lumina Motion Presets – Worship-ready scene configurations.
 *
 * Each preset maps a scene kind to a curated palette and intensity
 * that produces a distinct visual identity for Lumina.
 */

import type { MotionSceneDefinition } from './types';
import { buildMotionUrl } from './types';

export const LUMINA_MOTION_PRESETS: MotionSceneDefinition[] = [
  {
    id: 'royal-worship',
    name: 'Royal Worship',
    category: 'worship',
    kind: 'glassWaves',
    palette: {
      primary: '#3b2d8e',
      secondary: '#6d28d9',
      accent: '#c084fc',
      glow: '#dbb8ff',
      bg: '#0f0a2e',
    },
    speed: 1.0,
    intensity: 1.0,
    bloom: 0.55,
  },
  {
    id: 'prayer-glow',
    name: 'Prayer Glow',
    category: 'prayer',
    kind: 'lightRays',
    palette: {
      primary: '#1e2a4a',
      secondary: '#1e3a5f',
      accent: '#d4a044',
      glow: '#fbbf24',
      bg: '#0c1524',
    },
    speed: 0.8,
    intensity: 0.9,
    particleDensity: 0.5,
  },
  {
    id: 'sermon-clean',
    name: 'Sermon Clean',
    category: 'sermon',
    kind: 'gradientFlow',
    palette: {
      primary: '#1e293b',
      secondary: '#334155',
      accent: '#64748b',
      glow: '#94a3b8',
      bg: '#0f172a',
    },
    speed: 0.6,
    intensity: 0.7,
  },
  {
    id: 'celebration-light',
    name: 'Celebration Light',
    category: 'celebration',
    kind: 'particles',
    palette: {
      primary: '#7c3aed',
      secondary: '#db2777',
      accent: '#f59e0b',
      glow: '#ffffff',
      bg: '#1a0533',
    },
    speed: 1.2,
    intensity: 1.0,
    particleDensity: 0.8,
    bloom: 0.6,
  },
  {
    id: 'heaven-white',
    name: 'Heaven White',
    category: 'worship',
    kind: 'heavenGlow',
    palette: {
      primary: '#f5f0e8',
      secondary: '#e8dcc8',
      accent: '#d4a044',
      glow: '#ffffff',
      bg: '#f0ebe0',
    },
    speed: 0.7,
    intensity: 0.85,
    bloom: 0.7,
  },
  {
    id: 'ocean-peace',
    name: 'Ocean Peace',
    category: 'prayer',
    kind: 'glassWaves',
    palette: {
      primary: '#0c4a6e',
      secondary: '#0369a1',
      accent: '#38bdf8',
      glow: '#bae6fd',
      bg: '#082f49',
    },
    speed: 0.9,
    intensity: 0.9,
    bloom: 0.4,
  },
  {
    id: 'golden-altar',
    name: 'Golden Altar',
    category: 'worship',
    kind: 'lightRays',
    palette: {
      primary: '#451a03',
      secondary: '#78350f',
      accent: '#f59e0b',
      glow: '#fde68a',
      bg: '#1c0a00',
    },
    speed: 0.7,
    intensity: 0.95,
    particleDensity: 0.6,
  },
  {
    id: 'morning-mercy',
    name: 'Morning Mercy',
    category: 'sermon',
    kind: 'gradientFlow',
    palette: {
      primary: '#1e40af',
      secondary: '#3b82f6',
      accent: '#93c5fd',
      glow: '#dbeafe',
      bg: '#0c1e4a',
    },
    speed: 0.8,
    intensity: 0.85,
  },
  {
    id: 'spirit-fire',
    name: 'Spirit Fire',
    category: 'celebration',
    kind: 'particles',
    palette: {
      primary: '#7f1d1d',
      secondary: '#dc2626',
      accent: '#f97316',
      glow: '#fde047',
      bg: '#1a0505',
    },
    speed: 1.1,
    intensity: 1.0,
    particleDensity: 0.7,
    bloom: 0.5,
  },
  {
    id: 'grace-mist',
    name: 'Grace Mist',
    category: 'prayer',
    kind: 'heavenGlow',
    palette: {
      primary: '#c7d2e8',
      secondary: '#a5b4d4',
      accent: '#7c8dba',
      glow: '#e8ecf4',
      bg: '#d0d8ea',
    },
    speed: 0.6,
    intensity: 0.8,
    bloom: 0.65,
  },
  {
    id: 'deep-praise',
    name: 'Deep Praise',
    category: 'worship',
    kind: 'glassWaves',
    palette: {
      primary: '#1e1b4b',
      secondary: '#3730a3',
      accent: '#818cf8',
      glow: '#c7d2fe',
      bg: '#0c0a2a',
    },
    speed: 1.0,
    intensity: 1.0,
    bloom: 0.5,
  },
  {
    id: 'sunrise-hope',
    name: 'Sunrise Hope',
    category: 'celebration',
    kind: 'gradientFlow',
    palette: {
      primary: '#7c2d12',
      secondary: '#ea580c',
      accent: '#fbbf24',
      glow: '#fef3c7',
      bg: '#3b1106',
    },
    speed: 0.9,
    intensity: 0.9,
  },
  {
    id: 'glory-rays',
    name: 'Glory Rays',
    category: 'celebration',
    kind: 'celestialBurst',
    palette: {
      primary: '#4da6ff',
      secondary: '#1a6dd4',
      accent: '#ffffff',
      glow: '#c8e6ff',
      bg: '#0a2d6e',
    },
    speed: 0.9,
    intensity: 1.0,
    bloom: 0.6,
  },
  {
    id: 'starlight-worship',
    name: 'Starlight Worship',
    category: 'worship',
    kind: 'starlightCanopy',
    palette: {
      primary: '#0f2040',
      secondary: '#1a3a6e',
      accent: '#6ea8d7',
      glow: '#c8dcf0',
      bg: '#0a1628',
    },
    speed: 0.7,
    intensity: 0.85,
    bloom: 0.4,
  },
];

/** Map of sceneId → definition for fast lookup */
export const MOTION_PRESET_MAP = new Map<string, MotionSceneDefinition>(
  LUMINA_MOTION_PRESETS.map((p) => [p.id, p]),
);

/** All Lumina motion background URLs */
export const LUMINA_MOTION_URLS = LUMINA_MOTION_PRESETS.map((p) => buildMotionUrl(p.id));

/** Generate a static poster SVG data-URI for a motion preset (used for thumbnails) */
export function generateMotionPoster(def: MotionSceneDefinition): string {
  const { palette } = def;
  const p = palette.primary;
  const s = palette.secondary;
  const g = palette.glow || palette.accent || '#ffffff';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${palette.bg || p}'/><stop offset='50%' stop-color='${p}'/><stop offset='100%' stop-color='${s}'/></linearGradient><radialGradient id='r' cx='50%' cy='35%' r='60%'><stop offset='0%' stop-color='${g}' stop-opacity='0.25'/><stop offset='100%' stop-color='${g}' stop-opacity='0'/></radialGradient></defs><rect width='1920' height='1080' fill='url(#g)'/><rect width='1920' height='1080' fill='url(#r)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
