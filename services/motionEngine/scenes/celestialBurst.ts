/**
 * celestialBurst – Bright radiating light beams from center with floating star shapes.
 * Inspired by worship celebration backgrounds with rays and stars.
 */
import type { MotionSceneDefinition, RuntimeScene } from '../types';

interface Ray {
  angle: number;
  width: number;
  length: number;
  speed: number;
  phase: number;
  opacity: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  points: number;
  rotation: number;
  rotationSpeed: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number;
  driftY: number;
  opacity: number;
}

export function createCelestialBurstScene(def: MotionSceneDefinition): RuntimeScene {
  const { palette } = def;
  const colors = [palette.primary, palette.secondary, palette.bg || palette.primary];
  const RAY_COUNT = 14;
  const STAR_COUNT = 35;
  let rays: Ray[] = [];
  let stars: Star[] = [];
  let elapsed = 0;
  let w = 0;
  let h = 0;

  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  function initRays() {
    rays = [];
    const baseAngle = (Math.PI * 2) / RAY_COUNT;
    for (let i = 0; i < RAY_COUNT; i++) {
      rays.push({
        angle: baseAngle * i + rand(-0.1, 0.1),
        width: rand(0.04, 0.12),
        length: rand(0.7, 1.2),
        speed: rand(0.15, 0.4),
        phase: rand(0, Math.PI * 2),
        opacity: rand(0.15, 0.4),
      });
    }
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: rand(0, 1),
        y: rand(0, 1),
        size: rand(3, 18),
        points: Math.random() > 0.5 ? 4 : 5,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-0.3, 0.3),
        twinkleSpeed: rand(0.8, 2.5),
        twinklePhase: rand(0, Math.PI * 2),
        driftX: rand(-8, 8),
        driftY: rand(-8, 8),
        opacity: rand(0.3, 0.9),
      });
    }
  }

  function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number, rotation: number) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = rotation + (i * Math.PI) / points;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  return {
    setup(_ctx, width, height) {
      w = width;
      h = height;
      initRays();
      initStars();
    },
    update(deltaMs) {
      elapsed += deltaMs / 1000;
    },
    render(ctx, width, height) {
      w = width;
      h = height;

      // Background gradient — bright blue base
      const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bgGrad.addColorStop(0, colors[0] || '#4da6ff');
      bgGrad.addColorStop(0.5, colors[1] || '#1a6dd4');
      bgGrad.addColorStop(1, colors[2] || '#0a2d6e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Source glow at center — large, vivid bloom
      const cx = w * 0.5;
      const cy = h * 0.3;
      const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.5);
      glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      glowGrad.addColorStop(0.15, 'rgba(220, 240, 255, 0.35)');
      glowGrad.addColorStop(0.4, 'rgba(200, 230, 255, 0.12)');
      glowGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Light rays radiating from center
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const maxDim = Math.max(w, h);
      for (const ray of rays) {
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * ray.speed + ray.phase);
        const alpha = ray.opacity * (0.55 + 0.45 * pulse);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ray.angle + Math.sin(elapsed * 0.2 + ray.phase) * 0.03);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const halfWidth = maxDim * ray.width;
        const len = maxDim * ray.length;
        ctx.lineTo(-halfWidth, len);
        ctx.lineTo(halfWidth, len);
        ctx.closePath();
        const rayGrad = ctx.createLinearGradient(0, 0, 0, len);
        rayGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        rayGrad.addColorStop(0.3, `rgba(200, 230, 255, ${alpha * 0.5})`);
        rayGrad.addColorStop(1, `rgba(200, 230, 255, 0)`);
        ctx.fillStyle = rayGrad;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Floating stars
      ctx.save();
      for (const star of stars) {
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * star.twinkleSpeed + star.twinklePhase));
        const alpha = star.opacity * twinkle;
        const sx = star.x * w + Math.sin(elapsed * 0.3 + star.twinklePhase) * star.driftX;
        const sy = star.y * h + Math.cos(elapsed * 0.25 + star.twinklePhase) * star.driftY;
        const rot = star.rotation + elapsed * star.rotationSpeed;
        const outerR = star.size * (0.8 + 0.2 * twinkle);
        const innerR = outerR * 0.4;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 1)';
        ctx.shadowBlur = star.size * 4;
        drawStar(ctx, sx, sy, outerR, innerR, star.points, rot);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();

      // Soft vignette — light touch to preserve glow
      const vigGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.4, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,20,0.15)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    },
    resize(width, height) {
      w = width;
      h = height;
    },
    destroy() {
      rays = [];
      stars = [];
    },
  };
}
