/**
 * Light Rays Scene – Directional beams with haze and dust.
 *
 * Soft light beams emanate from a configurable source point,
 * with floating dust motes and gentle brightness pulsing.
 * Ideal for prayer or altar-call moments.
 */

import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface Ray {
  angle: number;
  width: number;
  length: number;
  opacity: number;
  speed: number;
  phase: number;
}

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
}

export function createLightRaysScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette, speed, intensity, particleDensity = 0.5 } = def;
  let elapsed = 0;
  let w = 0;
  let h = 0;

  const rayCount = 8;
  const rays: Ray[] = [];
  for (let i = 0; i < rayCount; i++) {
    rays.push({
      angle: (i / rayCount) * Math.PI * 0.6 - Math.PI * 0.15,
      width: 0.04 + Math.random() * 0.06,
      length: 0.8 + Math.random() * 0.4,
      opacity: 0.13 + Math.random() * 0.18,
      speed: (0.00008 + Math.random() * 0.00012) * speed,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const dustCount = Math.floor(30 * particleDensity);
  let dustMotes: DustMote[] = [];

  function initDust() {
    dustMotes = [];
    for (let i = 0; i < dustCount; i++) {
      dustMotes.push(createDustMote(w, h, true));
    }
  }

  return {
    setup(_ctx, width, height) {
      w = width;
      h = height;
      initDust();
    },

    update(deltaMs) {
      elapsed += deltaMs;
      for (const mote of dustMotes) {
        mote.x += mote.vx * deltaMs;
        mote.y += mote.vy * deltaMs;
        if (mote.x < -20 || mote.x > w + 20 || mote.y < -20 || mote.y > h + 20) {
          Object.assign(mote, createDustMote(w, h, false));
        }
      }
    },

    render(ctx, width, height) {
      w = width;
      h = height;

      // Dark atmospheric background
      const bgGrad = ctx.createRadialGradient(
        w * 0.3, h * 0.15, 0,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.9,
      );
      bgGrad.addColorStop(0, darken(palette.primary, 0.3));
      bgGrad.addColorStop(0.4, darken(palette.primary, 0.55));
      bgGrad.addColorStop(1, palette.bg || darken(palette.primary, 0.75));
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Source point (upper-left area)
      const srcX = w * 0.25;
      const srcY = h * 0.08;

      // Draw rays
      for (const ray of rays) {
        const t = elapsed * ray.speed + ray.phase;
        const currentAngle = ray.angle + Math.sin(t) * 0.08;
        const pulseOpacity = ray.opacity * (0.7 + 0.3 * Math.sin(t * 1.3)) * intensity;

        const endX = srcX + Math.cos(currentAngle) * Math.max(w, h) * ray.length;
        const endY = srcY + Math.sin(currentAngle) * Math.max(w, h) * ray.length;

        const halfWidth = ray.width * Math.max(w, h) * 0.5;
        const perpAngle = currentAngle + Math.PI / 2;
        const dx = Math.cos(perpAngle) * halfWidth;
        const dy = Math.sin(perpAngle) * halfWidth;

        ctx.beginPath();
        ctx.moveTo(srcX, srcY);
        ctx.lineTo(endX + dx * 2, endY + dy * 2);
        ctx.lineTo(endX - dx * 2, endY - dy * 2);
        ctx.closePath();

        const rayGrad = ctx.createLinearGradient(srcX, srcY, endX, endY);
        rayGrad.addColorStop(0, withAlpha(palette.glow || palette.accent || '#ffffff', Math.min(1.0, pulseOpacity * 1.5)));
        rayGrad.addColorStop(0.3, withAlpha(palette.glow || '#ffffff', Math.min(1.0, pulseOpacity * 0.75)));
        rayGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.globalAlpha = 1;
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }

      // Source glow
      ctx.globalAlpha = 0.65 * intensity;
      const glowGrad = ctx.createRadialGradient(srcX, srcY, 0, srcX, srcY, w * 0.3);
      glowGrad.addColorStop(0, withAlpha(palette.glow || '#ffffff', 0.75));
      glowGrad.addColorStop(0.3, withAlpha(palette.accent || palette.secondary, 0.22));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Dust motes
      for (const mote of dustMotes) {
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 0.003 + mote.phase);
        ctx.globalAlpha = mote.opacity * twinkle * intensity;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
        ctx.fillStyle = palette.glow || '#ffffff';
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    },

    resize(width, height) {
      w = width;
      h = height;
      initDust();
    },

    destroy() {
      dustMotes = [];
    },
  };
}

function createDustMote(w: number, h: number, scatter: boolean): DustMote {
  return {
    x: scatter ? Math.random() * w : (Math.random() < 0.5 ? -10 : w + 10),
    y: Math.random() * h,
    vx: (Math.random() - 0.3) * 0.012,
    vy: (Math.random() - 0.6) * 0.008,
    size: 1 + Math.random() * 2.5,
    opacity: 0.22 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return `rgba(200,180,120,${alpha})`;
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
