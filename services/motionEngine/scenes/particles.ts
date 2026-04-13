/**
 * Particles Scene – Floating bokeh, ambient glow, layered drift.
 *
 * Multiple depth layers of softly glowing circles drift upward
 * at different speeds, producing a warm worship ambience.
 */

import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
  phase: number;
  depthLayer: number;
}

export function createParticlesScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette, speed, intensity, particleDensity = 0.6, bloom = 0.5 } = def;
  let elapsed = 0;
  let w = 0;
  let h = 0;
  let particles: Particle[] = [];

  const colors = [
    palette.primary,
    palette.secondary,
    palette.accent || palette.primary,
    palette.glow || '#ffffff',
  ];

  function initParticles() {
    const count = Math.floor(50 * particleDensity);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(createParticle(w, h, colors, true));
    }
  }

  return {
    setup(_ctx, width, height) {
      w = width;
      h = height;
      initParticles();
    },

    update(deltaMs) {
      elapsed += deltaMs;
      const dt = deltaMs * speed;
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Gentle sway
        p.x += Math.sin(elapsed * 0.0004 + p.phase) * 0.02 * dt;

        // Wrap around
        if (p.y < -p.radius * 2) {
          Object.assign(p, createParticle(w, h, colors, false));
          p.y = h + p.radius * 2;
        }
        if (p.x < -p.radius * 4) p.x = w + p.radius * 2;
        if (p.x > w + p.radius * 4) p.x = -p.radius * 2;
      }
    },

    render(ctx, width, height) {
      w = width;
      h = height;

      // Deep background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w * 0.3, h);
      bgGrad.addColorStop(0, palette.bg || darken(palette.primary, 0.7));
      bgGrad.addColorStop(0.5, darken(palette.primary, 0.55));
      bgGrad.addColorStop(1, darken(palette.secondary, 0.65));
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Sort by depth so far particles render first
      const sorted = [...particles].sort((a, b) => a.depthLayer - b.depthLayer);

      for (const p of sorted) {
        const twinkle = 0.6 + 0.4 * Math.sin(elapsed * 0.002 + p.phase);
        const alpha = p.opacity * twinkle * intensity;

        // Soft glow halo
        const glowRadius = p.radius * (3.1 + p.depthLayer * 0.65);
        ctx.globalAlpha = alpha * 0.5;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        glow.addColorStop(0, withAlpha(p.color, 0.6));
        glow.addColorStop(0.5, withAlpha(p.color, 0.15));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core bokeh circle
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(p.color, 0.8);
        ctx.fill();

        // Bright center
        ctx.globalAlpha = alpha * 1.0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha('#ffffff', 0.75);
        ctx.fill();
      }

      // Overall bloom
      if (bloom > 0) {
        ctx.globalAlpha = bloom * 0.2 * intensity;
        const bloomGrad = ctx.createRadialGradient(
          w * 0.5, h * 0.4, 0,
          w * 0.5, h * 0.5, Math.max(w, h) * 0.6,
        );
        bloomGrad.addColorStop(0, withAlpha(palette.glow || '#ffffff', 0.3));
        bloomGrad.addColorStop(0.5, withAlpha(palette.secondary, 0.09));
        bloomGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
    },

    resize(width, height) {
      w = width;
      h = height;
      initParticles();
    },

    destroy() {
      particles = [];
    },
  };
}

function createParticle(w: number, h: number, colors: string[], scatter: boolean): Particle {
  const depthLayer = Math.random();
  const sizeScale = 0.3 + depthLayer * 0.7;
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : h + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.008,
    vy: -(0.01 + Math.random() * 0.025) * sizeScale,
    radius: (3 + Math.random() * 8) * sizeScale,
    opacity: (0.2 + Math.random() * 0.5) * sizeScale,
    color: colors[Math.floor(Math.random() * colors.length)],
    phase: Math.random() * Math.PI * 2,
    depthLayer,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return `rgba(180,160,220,${alpha})`;
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
