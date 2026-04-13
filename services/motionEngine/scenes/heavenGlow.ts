/**
 * Heaven Glow Scene – White/gold mist with soft radiant bloom.
 *
 * Ethereal, restrained movement with warm light emanating
 * from a central radiance. Very subtle and reverent.
 */

import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface MistLayer {
  cx: number;
  cy: number;
  radius: number;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  opacity: number;
  color: string;
}

export function createHeavenGlowScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette, speed, intensity, bloom = 0.7 } = def;
  let elapsed = 0;
  let w = 0;
  let h = 0;

  const mistCount = 6;
  const mistLayers: MistLayer[] = [];
  for (let i = 0; i < mistCount; i++) {
    const t = i / mistCount;
    mistLayers.push({
      cx: 0.3 + t * 0.4,
      cy: 0.2 + t * 0.3,
      radius: 0.3 + Math.random() * 0.39,
      driftX: (Math.random() - 0.5) * 0.08,
      driftY: (Math.random() - 0.5) * 0.05,
      speed: (0.00015 + Math.random() * 0.0001) * speed,
      phase: Math.random() * Math.PI * 2,
      opacity: (0.13 + Math.random() * 0.18) * intensity,
      color: i % 2 === 0
        ? (palette.glow || '#ffffff')
        : (palette.accent || palette.secondary),
    });
  }

  return {
    setup(_ctx, width, height) {
      w = width;
      h = height;
    },

    update(deltaMs) {
      elapsed += deltaMs;
    },

    render(ctx, width, height) {
      w = width;
      h = height;
      const diag = Math.sqrt(w * w + h * h);

      // Warm, light base
      const bgGrad = ctx.createLinearGradient(0, 0, w * 0.4, h);
      bgGrad.addColorStop(0, palette.bg || darken(palette.primary, 0.2));
      bgGrad.addColorStop(0.4, palette.primary);
      bgGrad.addColorStop(1, darken(palette.secondary, 0.15));
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Central radiance
      const radT = elapsed * 0.0001 * speed;
      const radPulse = 0.85 + 0.15 * Math.sin(radT);
      ctx.globalAlpha = bloom * 0.8 * radPulse * intensity;
      const radGrad = ctx.createRadialGradient(
        w * 0.5, h * 0.35, 0,
        w * 0.5, h * 0.4, diag * 0.45,
      );
      radGrad.addColorStop(0, withAlpha(palette.glow || '#ffffff', 0.85));
      radGrad.addColorStop(0.2, withAlpha(palette.glow || '#fffbe6', 0.45));
      radGrad.addColorStop(0.5, withAlpha(palette.accent || palette.secondary, 0.15));
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, w, h);

      // Drifting mist layers
      for (const mist of mistLayers) {
        const t = elapsed * mist.speed + mist.phase;
        const cx = (mist.cx + Math.sin(t) * mist.driftX) * w;
        const cy = (mist.cy + Math.cos(t * 0.7) * mist.driftY) * h;
        const r = mist.radius * diag;

        ctx.globalAlpha = mist.opacity * (0.7 + 0.3 * Math.sin(t * 1.2));
        const mistGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        mistGrad.addColorStop(0, withAlpha(mist.color, 0.38));
        mistGrad.addColorStop(0.3, withAlpha(mist.color, 0.18));
        mistGrad.addColorStop(0.7, withAlpha(mist.color, 0.05));
        mistGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mistGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // Subtle warm vignette at edges
      ctx.globalAlpha = 0.1 * intensity;
      const vigGrad = ctx.createRadialGradient(
        w * 0.5, h * 0.5, diag * 0.3,
        w * 0.5, h * 0.5, diag * 0.7,
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, withAlpha(darken(palette.primary, 0.5), 0.28));
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1;
    },

    resize(width, height) {
      w = width;
      h = height;
    },

    destroy() {},
  };
}

function withAlpha(hex: string, alpha: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) {
    // Handle rgb() format
    const rgbMatch = hex.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`;
    }
    return `rgba(255,250,230,${alpha})`;
  }
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return '#1a1510';
  const r = Math.round(parseInt(match[1], 16) * (1 - amount));
  const g = Math.round(parseInt(match[2], 16) * (1 - amount));
  const b = Math.round(parseInt(match[3], 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}
