/**
 * starlightCanopy - A twinkling starfield with layered atmospheric glow.
 * Multiple star layers at different depths create a canopy effect,
 * with slow drift and subtle color pulsing.
 */
import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface StarLayer {
  stars: {
    x: number;
    y: number;
    size: number;
    brightness: number;
    twinkleSpeed: number;
    twinklePhase: number;
  }[];
  driftSpeedX: number;
  driftSpeedY: number;
  baseAlpha: number;
}

interface GlowOrb {
  x: number;
  y: number;
  radius: number;
  color: string;
  driftSpeedX: number;
  driftSpeedY: number;
  phase: number;
  pulseSpeed: number;
}

export function createStarlightCanopyScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette } = def;
  const colors = [palette.bg || palette.primary, palette.primary, palette.secondary, palette.accent || palette.glow || '#4488cc'];
  let elapsed = 0;
  let w = 0;
  let h = 0;
  let layers: StarLayer[] = [];
  let glowOrbs: GlowOrb[] = [];

  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  function init() {
    layers = [
      { stars: [], driftSpeedX: 1.5, driftSpeedY: 0.8, baseAlpha: 0.35 },
      { stars: [], driftSpeedX: 3, driftSpeedY: 1.5, baseAlpha: 0.55 },
      { stars: [], driftSpeedX: 5, driftSpeedY: 2.5, baseAlpha: 0.85 },
    ];
    const starCounts = [60, 40, 25];
    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      for (let i = 0; i < starCounts[l]; i++) {
        const sizeRange = l === 0 ? [0.5, 1.5] : l === 1 ? [1, 3] : [2, 5];
        layer.stars.push({
          x: rand(0, 1),
          y: rand(0, 1),
          size: rand(sizeRange[0], sizeRange[1]),
          brightness: rand(0.4, 1),
          twinkleSpeed: rand(0.5, 3),
          twinklePhase: rand(0, Math.PI * 2),
        });
      }
    }
    glowOrbs = [];
    for (let i = 0; i < 4; i++) {
      glowOrbs.push({
        x: rand(0.1, 0.9),
        y: rand(0.1, 0.9),
        radius: rand(0.15, 0.35),
        color: colors[i % colors.length] || '#4488cc',
        driftSpeedX: rand(-0.015, 0.015),
        driftSpeedY: rand(-0.01, 0.01),
        phase: rand(0, Math.PI * 2),
        pulseSpeed: rand(0.2, 0.5),
      });
    }
  }

  return {
    setup(_ctx: CanvasRenderingContext2D, width: number, height: number) {
      w = width; h = height; init();
    },
    update(deltaMs: number) {
      elapsed += deltaMs / 1000;
    },
    render(ctx: CanvasRenderingContext2D, width: number, height: number) {
      w = width; h = height;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, colors[0] || '#0a1628');
      bgGrad.addColorStop(0.5, colors[1] || '#0f2040');
      bgGrad.addColorStop(1, colors[2] || '#08101e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
      for (const orb of glowOrbs) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * orb.pulseSpeed + orb.phase);
        const ox = (orb.x + Math.sin(elapsed * orb.driftSpeedX * 2 + orb.phase) * 0.08) * w;
        const oy = (orb.y + Math.cos(elapsed * orb.driftSpeedY * 2 + orb.phase) * 0.06) * h;
        const r = orb.radius * Math.max(w, h);
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        const a = 0.12 + 0.10 * pulse;
        const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
        grad.addColorStop(0, orb.color + hex(a));
        grad.addColorStop(0.4, orb.color + hex(a * 0.5));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      for (const layer of layers) {
        for (const star of layer.stars) {
          const twinkle = 0.2 + 0.8 * Math.abs(Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase));
          const alpha = layer.baseAlpha * star.brightness * twinkle;
          const driftX = Math.sin(elapsed * 0.1) * layer.driftSpeedX;
          const driftY = Math.cos(elapsed * 0.08) * layer.driftSpeedY;
          let sx = (star.x * w + driftX) % w;
          let sy = (star.y * h + driftY) % h;
          if (sx < 0) sx += w;
          if (sy < 0) sy += h;
          const sz = star.size * (0.7 + 0.3 * twinkle);
          ctx.save();
          ctx.globalAlpha = alpha * 0.6;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = sz * 8;
          ctx.beginPath();
          ctx.arc(sx, sy, sz * 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(200,220,255,0.4)';
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowColor = 'rgba(255,255,255,0.9)';
          ctx.shadowBlur = sz * 3;
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          if (star.size > 2.5 && twinkle > 0.5) {
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            const sparkleLen = sz * 4;
            ctx.beginPath();
            ctx.moveTo(sx - sparkleLen, sy);
            ctx.lineTo(sx + sparkleLen, sy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, sy - sparkleLen);
            ctx.lineTo(sx, sy + sparkleLen);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      topGrad.addColorStop(0, 'rgba(180,210,255,0.12)');
      topGrad.addColorStop(0.5, 'rgba(180,210,255,0.04)');
      topGrad.addColorStop(1, 'rgba(180,210,255,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, h * 0.5);
    },
    resize(width: number, height: number) {
      w = width; h = height;
    },
    destroy() {
      layers = []; glowOrbs = [];
    },
  };
}
