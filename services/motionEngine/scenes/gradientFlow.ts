/**
 * Gradient Flow Scene – Slow, premium gradient layers with subtle noise movement.
 *
 * Multiple overlapping gradient layers drift at different speeds and angles,
 * producing a calm, meditative look ideal for sermons and scripture readings.
 */

import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface GradientLayer {
  angle: number;
  speed: number;
  phase: number;
  opacity: number;
  colorStops: Array<{ offset: number; color: string }>;
}

export function createGradientFlowScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette, speed, intensity } = def;
  let elapsed = 0;
  let w = 0;
  let h = 0;

  const layers: GradientLayer[] = [
    {
      angle: 0,
      speed: 0.00012 * speed,
      phase: 0,
      opacity: 1.0,
      colorStops: [
        { offset: 0, color: palette.bg || palette.primary },
        { offset: 0.5, color: palette.secondary },
        { offset: 1.0, color: palette.primary },
      ],
    },
    {
      angle: Math.PI * 0.33,
      speed: 0.00018 * speed,
      phase: Math.PI * 0.5,
      opacity: 0.62 * intensity,
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,0)' },
        { offset: 0.35, color: withAlpha(palette.accent || palette.secondary, 0.48) },
        { offset: 0.65, color: withAlpha(palette.glow || palette.primary, 0.27) },
        { offset: 1.0, color: 'rgba(255,255,255,0)' },
      ],
    },
    {
      angle: Math.PI * 0.75,
      speed: 0.00009 * speed,
      phase: Math.PI,
      opacity: 0.45 * intensity,
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 0.4, color: withAlpha(palette.glow || palette.secondary, 0.33) },
        { offset: 1.0, color: 'rgba(0,0,0,0)' },
      ],
    },
  ];

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

      for (const layer of layers) {
        const t = elapsed * layer.speed + layer.phase;
        const currentAngle = layer.angle + Math.sin(t) * 0.15;
        const cx = w / 2 + Math.sin(t * 0.7) * w * 0.15;
        const cy = h / 2 + Math.cos(t * 0.5) * h * 0.12;

        const dx = Math.cos(currentAngle) * diag;
        const dy = Math.sin(currentAngle) * diag;

        const grad = ctx.createLinearGradient(
          cx - dx * 0.5, cy - dy * 0.5,
          cx + dx * 0.5, cy + dy * 0.5,
        );

        for (const stop of layer.colorStops) {
          grad.addColorStop(stop.offset, stop.color);
        }

        ctx.globalAlpha = layer.opacity;
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Subtle radial vignette for depth
      ctx.globalAlpha = 0.18 * intensity;
      const radGrad = ctx.createRadialGradient(w * 0.7, h * 0.2, 0, w * 0.5, h * 0.5, diag * 0.6);
      radGrad.addColorStop(0, withAlpha(palette.glow || '#ffffff', 0.32));
      radGrad.addColorStop(0.5, 'rgba(255,255,255,0.09)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },

    resize(width, height) {
      w = width;
      h = height;
    },

    destroy() {
      // No external resources to clean up
    },
  };
}

function withAlpha(hex: string, alpha: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return `rgba(100,100,180,${alpha})`;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
