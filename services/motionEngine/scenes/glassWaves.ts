/**
 * Glass Waves Scene – Lumina signature look.
 *
 * Translucent flowing wave layers with soft bloom and depth,
 * producing a premium glass-like aesthetic.
 */

import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface WaveLayer {
  yOffset: number;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  color: string;
  opacity: number;
}

export function createGlassWavesScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette, speed, intensity, bloom = 0.5 } = def;
  let elapsed = 0;
  let w = 0;
  let h = 0;

  const waveLayers: WaveLayer[] = [
    {
      yOffset: 0.55,
      amplitude: 0.08,
      frequency: 1.2,
      speed: 0.00025 * speed,
      phase: 0,
      color: palette.primary,
      opacity: 0.52 * intensity,
    },
    {
      yOffset: 0.5,
      amplitude: 0.12,
      frequency: 0.8,
      speed: 0.00018 * speed,
      phase: Math.PI * 0.4,
      color: palette.secondary,
      opacity: 0.42 * intensity,
    },
    {
      yOffset: 0.6,
      amplitude: 0.06,
      frequency: 1.6,
      speed: 0.00032 * speed,
      phase: Math.PI * 0.8,
      color: palette.accent || palette.secondary,
      opacity: 0.33 * intensity,
    },
    {
      yOffset: 0.45,
      amplitude: 0.1,
      frequency: 0.6,
      speed: 0.00014 * speed,
      phase: Math.PI * 1.2,
      color: palette.glow || palette.primary,
      opacity: 0.27 * intensity,
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

      // Base background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, palette.bg || darken(palette.primary, 0.6));
      bgGrad.addColorStop(0.5, darken(palette.primary, 0.4));
      bgGrad.addColorStop(1, darken(palette.secondary, 0.5));
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw wave layers
      for (const wave of waveLayers) {
        drawWave(ctx, wave, elapsed, w, h);
      }

      // Bloom / glow overlay
      if (bloom > 0) {
        ctx.globalAlpha = bloom * 0.32 * intensity;
        const bloomGrad = ctx.createRadialGradient(
          w * 0.5, h * 0.35, 0,
          w * 0.5, h * 0.5, Math.max(w, h) * 0.7,
        );
        bloomGrad.addColorStop(0, withAlpha(palette.glow || '#ffffff', 0.45));
        bloomGrad.addColorStop(0.4, withAlpha(palette.glow || '#ffffff', 0.12));
        bloomGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
    },

    resize(width, height) {
      w = width;
      h = height;
    },

    destroy() {},
  };
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  wave: WaveLayer,
  elapsed: number,
  w: number,
  h: number,
) {
  const t = elapsed * wave.speed + wave.phase;
  const baseY = h * wave.yOffset + Math.sin(t * 0.3) * h * 0.03;
  const amp = h * wave.amplitude;

  ctx.beginPath();
  ctx.moveTo(0, h);

  const steps = Math.ceil(w / 4);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const nx = x / w;
    const y = baseY
      + Math.sin(nx * Math.PI * 2 * wave.frequency + t) * amp
      + Math.sin(nx * Math.PI * 3.7 * wave.frequency + t * 1.3) * amp * 0.3
      + Math.cos(nx * Math.PI * 1.2 + t * 0.7) * amp * 0.15;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(w, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, baseY - amp, 0, h);
  grad.addColorStop(0, withAlpha(wave.color, wave.opacity));
  grad.addColorStop(0.4, withAlpha(wave.color, wave.opacity * 0.6));
  grad.addColorStop(1, withAlpha(wave.color, wave.opacity * 0.15));

  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fill();
}

function withAlpha(hex: string, alpha: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return `rgba(100,100,180,${alpha})`;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return '#0a0a14';
  const r = Math.round(parseInt(match[1], 16) * (1 - amount));
  const g = Math.round(parseInt(match[2], 16) * (1 - amount));
  const b = Math.round(parseInt(match[3], 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}
