/**
 * Motion Engine – Core requestAnimationFrame loop for rendering scenes.
 *
 * Manages the active scene lifecycle, handles resize, and ensures
 * smooth frame delivery. Designed to be controlled by MotionCanvas.tsx.
 */

import type { RuntimeScene } from './types';
import { createScene } from './SceneRegistry';

export class MotionEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private activeScene: RuntimeScene | null = null;
  private activeSceneId: string | null = null;
  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }

  detach(): void {
    this.stop();
    this.destroy();
    this.canvas = null;
    this.ctx = null;
  }

  loadScene(sceneId: string): boolean {
    if (sceneId === this.activeSceneId && this.activeScene) return true;

    this.activeScene?.destroy();
    this.activeScene = null;
    this.activeSceneId = null;

    const scene = createScene(sceneId);
    if (!scene || !this.ctx || !this.canvas) return false;

    this.activeScene = scene;
    this.activeSceneId = sceneId;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth * dpr;
    const h = this.canvas.clientHeight * dpr;
    scene.setup(this.ctx, w, h);
    this.renderOnce();

    return true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.renderOnce();

    const tick = (time: number) => {
      if (!this.running) return;

      const delta = this.lastTime ? time - this.lastTime : 16.67;
      this.lastTime = time;
      this.drawFrame(delta);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resize(): void {
    if (!this.canvas || !this.ctx || !this.activeScene) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.activeScene.resize(w, h);
  }

  renderOnce(delta = 16.67): boolean {
    return this.drawFrame(delta);
  }

  destroy(): void {
    this.stop();
    this.activeScene?.destroy();
    this.activeScene = null;
    this.activeSceneId = null;
  }

  get currentSceneId(): string | null {
    return this.activeSceneId;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private drawFrame(delta: number): boolean {
    if (!this.activeScene || !this.ctx || !this.canvas) return false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cw = w * dpr;
    const ch = h * dpr;

    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.activeScene.resize(w, h);
    }

    this.ctx.save();
    this.ctx.clearRect(0, 0, w, h);
    this.activeScene.update(delta);
    this.activeScene.render(this.ctx, w, h);
    this.ctx.restore();
    return true;
  }
}
