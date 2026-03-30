/**
 * Bible Style Engine
 * Generates rich, theme-aware visual style profiles for Bible scripture slides.
 * Supports 5 style families with seeded randomization and verse-theme detection.
 */

import { makeGradientBackground } from '../constants.ts';
import type { ServiceItem, Slide, TextElementStyle, SlideElement } from '../types.ts';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type BibleStyleFamily =
  | 'classic-scripture'
  | 'cinematic-worship'
  | 'minimal-modern'
  | 'revival-night'
  | 'prayer-atmosphere'
  | 'split-panel';

export type BibleStyleMode = 'classic' | 'smart-random' | 'preset';

export type BibleVerseMood =
  | 'praise' | 'worship' | 'hope' | 'faith' | 'victory'
  | 'holiness' | 'comfort' | 'prayer' | 'salvation' | 'revival'
  | 'thanksgiving' | 'healing' | 'strength' | 'grace' | 'love';

export interface BibleVerseMeta {
  wordCount: number;
  lineCount: number;
  isLong: boolean;         // > 35 words
  isVeryLong: boolean;     // > 60 words
  moods: BibleVerseMood[];
  intensity: 'calm' | 'moderate' | 'bold';
}

export interface BibleStyleProfile {
  id: string;
  family: BibleStyleFamily;
  seed: string;
  backgroundUrl: string;         // SVG gradient data URI (mediaType: 'image')
  fontFamily: string;
  textColor: string;
  referenceColor: string;
  shadow: boolean;
  overlayOpacity: number;        // 0–1, stored as metadata hint
  layoutVariant: 'hero' | 'card' | 'split' | 'lower-ref';
  verseFontSize: number;         // px at 1920-wide canvas
  referencePosition: 'bottom-center' | 'bottom-right' | 'inline-right';
  // Split panel extras
  splitPanelConfig?: number;     // index into SPLIT_PANEL_CONFIGS
  splitPanelTorn?: number;       // index into TORN_PATHS
}

export interface BibleStyleRequest {
  verseText: string;
  reference: string;
  mode: BibleStyleMode;
  family?: BibleStyleFamily;
  manualSeed?: string;
}

// ─── Seeded Random ────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: string) {
  let state = hashString(seed);
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0xffffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Verse Analysis ───────────────────────────────────────────────────────────

const MOOD_KEYWORDS: Record<BibleVerseMood, string[]> = {
  praise:       ['praise', 'glory', 'glorify', 'exalt', 'bless', 'blessed', 'hallelujah', 'hosanna'],
  worship:      ['worship', 'adore', 'bow', 'kneel', 'holy', 'sacred', 'reverend'],
  hope:         ['hope', 'future', 'plans', 'prosper', 'promise', 'wait', 'trust', 'expect'],
  faith:        ['faith', 'believe', 'trust', 'confidence', 'assurance', 'certain'],
  victory:      ['victory', 'overcome', 'conquer', 'triumph', 'win', 'mighty', 'power', 'strong'],
  holiness:     ['holy', 'sanctify', 'sanctified', 'pure', 'righteous', 'blameless'],
  comfort:      ['comfort', 'peace', 'rest', 'still', 'calm', 'fear not', 'gentle'],
  prayer:       ['pray', 'prayer', 'ask', 'seek', 'knock', 'intercede', 'petition'],
  salvation:    ['save', 'saved', 'salvation', 'redeem', 'redeemed', 'forgive', 'eternal life'],
  revival:      ['renew', 'restore', 'revive', 'arise', 'awaken', 'fire', 'pour out'],
  thanksgiving: ['thank', 'grateful', 'gratitude', 'rejoice', 'joyful', 'give thanks'],
  healing:      ['heal', 'healing', 'healed', 'restore', 'wholeness', 'sick', 'disease'],
  strength:     ['strength', 'strong', 'mount up', 'soar', 'run', 'weary', 'faint'],
  grace:        ['grace', 'mercy', 'compassion', 'kindness', 'favor', 'undeserving'],
  love:         ['love', 'beloved', 'loved', 'charity', 'laid down', 'gave'],
};

export function analyzeVerse(text: string, reference: string): BibleVerseMeta {
  const lower = (text + ' ' + reference).toLowerCase();
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;
  const lineCount = Math.ceil(wordCount / 8);

  const moods: BibleVerseMood[] = [];
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as [BibleVerseMood, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) moods.push(mood);
  }
  if (moods.length === 0) moods.push('faith');

  const boldMoods: BibleVerseMood[] = ['victory', 'revival', 'strength', 'praise'];
  const calmMoods: BibleVerseMood[] = ['prayer', 'comfort', 'healing'];
  const intensity: BibleVerseMeta['intensity'] =
    moods.some((m) => boldMoods.includes(m)) ? 'bold' :
    moods.some((m) => calmMoods.includes(m)) ? 'calm' : 'moderate';

  return {
    wordCount,
    lineCount,
    isLong: wordCount > 35,
    isVeryLong: wordCount > 60,
    moods,
    intensity,
  };
}

// ─── Style Family Definitions ─────────────────────────────────────────────────

interface FamilyVariant {
  bg: [string, string, string];  // gradient stops
  textColor: string;
  referenceColor: string;
}

// split-panel uses its own SPLIT_PANEL_CONFIGS, so this entry is a stub
const FAMILY_VARIANTS: Record<BibleStyleFamily, FamilyVariant[]> = {
  'split-panel': [],
  'classic-scripture': [
    { bg: ['#1a0f07', '#2d1a09', '#3d2510'], textColor: '#fff8e7', referenceColor: '#f0c060' },
    { bg: ['#1c1005', '#30180a', '#42200d'], textColor: '#fdf4e3', referenceColor: '#e8b84b' },
    { bg: ['#140c04', '#261404', '#341c06'], textColor: '#fef9f0', referenceColor: '#d4a044' },
    { bg: ['#180e06', '#2a1608', '#3a1f0c'], textColor: '#fffbf2', referenceColor: '#f2c855' },
  ],
  'cinematic-worship': [
    { bg: ['#020610', '#061020', '#081830'], textColor: '#ffffff', referenceColor: '#94b8ff' },
    { bg: ['#030810', '#081426', '#0c1e3a'], textColor: '#f0f6ff', referenceColor: '#7ec8f4' },
    { bg: ['#050212', '#0a0820', '#100a2e'], textColor: '#ffffff', referenceColor: '#a78bff' },
    { bg: ['#040410', '#080c24', '#0a1030'], textColor: '#f5f5ff', referenceColor: '#80b8ff' },
  ],
  'minimal-modern': [
    { bg: ['#080808', '#111111', '#181818'], textColor: '#ffffff', referenceColor: '#a0a0a0' },
    { bg: ['#0a0a10', '#12121a', '#1a1a24'], textColor: '#f8f8ff', referenceColor: '#8888bb' },
    { bg: ['#060606', '#0e0e0e', '#161616'], textColor: '#eeeeee', referenceColor: '#888888' },
    { bg: ['#090912', '#111118', '#181820'], textColor: '#ffffff', referenceColor: '#9090bb' },
  ],
  'revival-night': [
    { bg: ['#0d0618', '#1a0d2e', '#240a3a'], textColor: '#ffffff', referenceColor: '#fbbf24' },
    { bg: ['#0a0420', '#180830', '#220a3c'], textColor: '#f8f0ff', referenceColor: '#f59e0b' },
    { bg: ['#100420', '#1e0c34', '#2a0e42'], textColor: '#ffffff', referenceColor: '#fcd34d' },
    { bg: ['#0c0618', '#1c0a2c', '#280c38'], textColor: '#fff0ff', referenceColor: '#fbbf24' },
  ],
  'prayer-atmosphere': [
    { bg: ['#060c1a', '#0e1830', '#162040'], textColor: '#d4e4f8', referenceColor: '#7eb8e8' },
    { bg: ['#04081a', '#0a1428', '#121e38'], textColor: '#ccddf4', referenceColor: '#6aaad4' },
    { bg: ['#070d1e', '#0f1a32', '#172244'], textColor: '#d8e8f8', referenceColor: '#80b4e0' },
    { bg: ['#050a18', '#0c162c', '#141e3c'], textColor: '#dce8f4', referenceColor: '#74aed8' },
  ],
};

const FAMILY_FONTS: Record<BibleStyleFamily, string[]> = {
  'classic-scripture':  ['Georgia', 'Georgia', 'serif'],
  'cinematic-worship':  ['Aptos', 'Arial', 'sans-serif'],
  'minimal-modern':     ['Aptos', 'Aptos', 'sans-serif'],
  'revival-night':      ['Georgia', 'Arial', 'sans-serif'],
  'prayer-atmosphere':  ['Georgia', 'Georgia', 'serif'],
  'split-panel':        ['Georgia', 'Aptos', 'sans-serif'],
};

// ─── Split Panel SVG Generator ────────────────────────────────────────────────

interface SplitPanelConfig {
  leftBg: string;          // left panel base color
  rightBg: string;         // right panel (verse) color
  accent1: string;         // primary shape accent
  accent2: string;         // secondary shape accent
  accent3: string;         // tertiary shape accent
  shapeVariant: 0 | 1 | 2 | 3;  // which geometric arrangement to use
  divideX: number;         // left panel width in px (out of 1920)
}

const SPLIT_PANEL_CONFIGS: SplitPanelConfig[] = [
  // 1. Teal/Geometric (Audacious-style — teal shapes, deep blue right)
  { leftBg: '#1a7a8a', rightBg: '#2a1a7a', accent1: '#e84040', accent2: '#f5c842', accent3: '#2cb8c8', shapeVariant: 0, divideX: 700 },
  // 2. Warm Amber (orange shapes, deep navy right)
  { leftBg: '#7a3a1a', rightBg: '#0a1540', accent1: '#f5a020', accent2: '#e84040', accent3: '#fccd60', shapeVariant: 1, divideX: 680 },
  // 3. Deep Purple (gold shapes, rich purple right)
  { leftBg: '#3a1a6a', rightBg: '#180830', accent1: '#f0b830', accent2: '#c060f0', accent3: '#80d0ff', shapeVariant: 2, divideX: 720 },
  // 4. Emerald (green shapes, near-black right)
  { leftBg: '#0a5a3a', rightBg: '#060f1a', accent1: '#30e890', accent2: '#f5c842', accent3: '#0080c0', shapeVariant: 3, divideX: 690 },
  // 5. Crimson (bold red shapes, deep charcoal right)
  { leftBg: '#6a1a1a', rightBg: '#0a0a18', accent1: '#f54040', accent2: '#f5c842', accent3: '#c080f0', shapeVariant: 0, divideX: 710 },
  // 6. Royal Blue (yellow shapes, navy right)
  { leftBg: '#1a2a7a', rightBg: '#050e28', accent1: '#f5c842', accent2: '#e04040', accent3: '#40c8f0', shapeVariant: 1, divideX: 700 },
  // 7. Midnight Copper — dark copper left, deep brown-black right
  { leftBg: '#3d1f0a', rightBg: '#0d0806', accent1: '#c8601a', accent2: '#f0a050', accent3: '#e8c880', shapeVariant: 2, divideX: 660 },
  // 8. Ocean Depth — stormy teal left, ink-black right
  { leftBg: '#0a3040', rightBg: '#040c12', accent1: '#20c8e8', accent2: '#f0f040', accent3: '#4080c0', shapeVariant: 3, divideX: 730 },
  // 9. Neon Gospel — electric violet left, near-black right (contemporary praise)
  { leftBg: '#280060', rightBg: '#080010', accent1: '#c040ff', accent2: '#40e0ff', accent3: '#ff4080', shapeVariant: 0, divideX: 670 },
  // 10. Desert Gold — sandy gold left, dark terracotta right
  { leftBg: '#7a5a10', rightBg: '#200800', accent1: '#f0d040', accent2: '#e87820', accent3: '#c0a840', shapeVariant: 1, divideX: 695 },
  // 11. Arctic — icy steel-blue left, almost-white right text on deep navy
  { leftBg: '#0a2040', rightBg: '#030812', accent1: '#80d8f8', accent2: '#f8f8ff', accent3: '#4090c0', shapeVariant: 2, divideX: 710 },
  // 12. Rose Gold — blush left, rich plum right (worship ballads)
  { leftBg: '#6a2040', rightBg: '#120010', accent1: '#f080a8', accent2: '#f8c080', accent3: '#e840a0', shapeVariant: 3, divideX: 680 },
];

// Pre-defined torn-paper path profiles — x variation at each y-step
// Each array is [dx at y=0, dy-steps...] alternating left/right
const TORN_PATHS: number[][] = [
  [0, -18, 12, -22, 8, -16, 20, -10, 14, -20, 16, -8, 22, -14, 10, -18, 20, -12, 16, -22, 8, -18, 14, -10, 20, -16, 12, -18, 22, -8, 16, -20, 10, -14, 18, 0],
  [0, 15, -20, 10, -24, 18, -12, 22, -8, 16, -18, 10, -22, 14, -20, 8, -16, 20, -10, 18, -22, 12, -16, 20, -8, 24, -14, 10, -20, 16, -12, 18, -22, 8, -16, 0],
  [0, -10, 20, -15, 25, -8, 18, -22, 12, -16, 24, -10, 20, -14, 16, -22, 8, -18, 12, -24, 16, -10, 22, -14, 18, -8, 20, -16, 12, -22, 14, -10, 18, -16, 20, 0],
];

function buildTornPath(divideX: number, pathIdx: number): string {
  const offsets = TORN_PATHS[pathIdx % TORN_PATHS.length];
  const steps = offsets.length;
  const stepH = 1080 / (steps - 1);
  let x = divideX;
  let d = `M${x},0 `;
  for (let i = 1; i < steps; i++) {
    x = Math.max(divideX - 30, Math.min(divideX + 30, x + offsets[i]));
    d += `L${x.toFixed(1)},${(i * stepH).toFixed(1)} `;
  }
  d += `L0,1080 L0,0 Z`;
  return d;
}

function buildShapes(cfg: SplitPanelConfig): string {
  const { leftBg: _, rightBg: __, accent1, accent2, accent3, shapeVariant, divideX: dx } = cfg;
  const shapes: string[] = [];
  const ox = dx - 40; // shapes stay within left panel

  if (shapeVariant === 0) {
    // Large triangle upper-left + medium lower-left + horizontal bar
    shapes.push(`<polygon points="0,0 ${ox * 0.55},0 0,${1080 * 0.48}" fill="${accent1}" opacity="0.88"/>`);
    shapes.push(`<polygon points="0,${1080 * 0.52} ${ox * 0.40},${1080 * 0.52} 0,${1080 * 0.82}" fill="${accent2}" opacity="0.82"/>`);
    shapes.push(`<rect x="0" y="${1080 * 0.44}" width="${ox * 0.75}" height="${1080 * 0.07}" fill="${accent3}" opacity="0.70"/>`);
    shapes.push(`<polygon points="${ox * 0.45},${1080 * 0.52} ${ox * 0.85},${1080 * 0.52} ${ox * 0.65},${1080 * 0.78}" fill="${accent1}" opacity="0.55"/>`);
  } else if (shapeVariant === 1) {
    // Stacked parallelogram bars
    shapes.push(`<rect x="0" y="${1080 * 0.30}" width="${ox * 0.9}" height="${1080 * 0.08}" fill="${accent1}" opacity="0.85" transform="skewY(-3)"/>`);
    shapes.push(`<rect x="0" y="${1080 * 0.42}" width="${ox * 0.75}" height="${1080 * 0.06}" fill="${accent2}" opacity="0.75" transform="skewY(-3)"/>`);
    shapes.push(`<rect x="0" y="${1080 * 0.52}" width="${ox * 0.60}" height="${1080 * 0.05}" fill="${accent3}" opacity="0.65" transform="skewY(-3)"/>`);
    shapes.push(`<polygon points="0,0 ${ox * 0.45},0 0,${1080 * 0.28}" fill="${accent1}" opacity="0.60"/>`);
    shapes.push(`<polygon points="0,${1080 * 0.72} ${ox * 0.55},${1080} 0,${1080}" fill="${accent2}" opacity="0.60"/>`);
  } else if (shapeVariant === 2) {
    // Diamond / rhombus cluster
    const cx = ox * 0.35; const cy = 1080 * 0.38; const r = 160;
    shapes.push(`<polygon points="${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}" fill="${accent1}" opacity="0.82"/>`);
    const cx2 = ox * 0.20; const cy2 = 1080 * 0.65; const r2 = 110;
    shapes.push(`<polygon points="${cx2},${cy2 - r2} ${cx2 + r2 * 0.7},${cy2} ${cx2},${cy2 + r2} ${cx2 - r2 * 0.7},${cy2}" fill="${accent2}" opacity="0.72"/>`);
    shapes.push(`<polygon points="0,0 ${ox * 0.38},0 0,${1080 * 0.22}" fill="${accent3}" opacity="0.55"/>`);
    shapes.push(`<polygon points="0,${1080 * 0.78} ${ox * 0.35},${1080} 0,${1080}" fill="${accent3}" opacity="0.55"/>`);
  } else {
    // Stepped rectangles — modern editorial
    shapes.push(`<rect x="0" y="0" width="${ox * 0.6}" height="${1080 * 0.35}" fill="${accent1}" opacity="0.70"/>`);
    shapes.push(`<rect x="0" y="${1080 * 0.35}" width="${ox * 0.45}" height="${1080 * 0.12}" fill="${accent2}" opacity="0.65"/>`);
    shapes.push(`<rect x="0" y="${1080 * 0.65}" width="${ox * 0.7}" height="${1080 * 0.35}" fill="${accent3}" opacity="0.60"/>`);
    shapes.push(`<rect x="${ox * 0.15}" y="${1080 * 0.35}" width="${ox * 0.30}" height="${1080 * 0.30}" fill="${accent1}" opacity="0.45"/>`);
  }
  return shapes.join('\n  ');
}

export function makeSplitPanelBackground(cfg: SplitPanelConfig, tornPathIdx: number): string {
  const { leftBg, rightBg, divideX } = cfg;
  const torn = buildTornPath(divideX, tornPathIdx);
  const shapes = buildShapes(cfg);
  // Subtle horizontal lines pattern on right panel for texture
  const linePattern = Array.from({ length: 14 }, (_, i) => {
    const y = 80 + i * 72;
    return `<line x1="${divideX + 30}" y1="${y}" x2="1920" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`;
  }).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'>
  <rect width='1920' height='1080' fill='${rightBg}'/>
  ${linePattern}
  <path d='${torn}' fill='${leftBg}'/>
  ${shapes}
  <rect x='${divideX + 2}' y='0' width='6' height='1080' fill='rgba(255,255,255,0.07)'/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Parse "Matthew 21:1 (KJV)" → { book, chapterVerse, version }
function parseBibleLabel(label: string): { book: string; chapterVerse: string; version: string } {
  const m = label.match(/^(.+?)\s+(\d+:\d+(?:-\d+)?)\s*(?:\((.+?)\))?/);
  if (m) return { book: m[1].trim(), chapterVerse: m[2].trim(), version: m[3]?.trim() || '' };
  return { book: label, chapterVerse: '', version: '' };
}

/**
 * Builds elements for the split-panel layout.
 * Left panel: book name + chapter:verse + version badge
 * Right panel: verse body text
 */
export function buildSplitPanelElements(
  verseText: string,
  label: string,
  cfg: SplitPanelConfig,
  meta: BibleVerseMeta,
  fontFamily: string,
): SlideElement[] {
  const uid = () => `se-${Math.random().toString(36).slice(2, 9)}`;
  const { book, chapterVerse, version } = parseBibleLabel(label);

  // Normalised x boundary of left panel (out of 1920)
  const divX = cfg.divideX / 1920;
  // Right panel text starts after divider + small margin
  const rightX = divX + 0.03;
  const rightW = 0.96 - rightX;

  // ── Left panel: Book name ──
  const bookEl: SlideElement = {
    id: uid(), type: 'text', role: 'title', name: 'Book Name',
    frame: { x: 0.02, y: 0.32, width: divX - 0.04, height: 0.12, zIndex: 2 },
    visible: true, locked: false,
    content: book,
    style: {
      fontFamily, fontSize: 52, fontWeight: 700, fontStyle: 'normal',
      textAlign: 'left', verticalAlign: 'bottom',
      color: '#ffffff', lineHeight: 1.1, letterSpacing: 0,
      outlineColor: 'rgba(0,0,0,0.6)', outlineWidth: 1.0,
      shadow: '0 2px 12px rgba(0,0,0,0.5)', opacity: 1,
      backgroundColor: 'transparent', borderRadius: 0, padding: 0,
      listStyleType: 'none', listIndent: 28,
    },
  };

  // ── Left panel: Chapter:Verse (large) ──
  const cvEl: SlideElement = {
    id: uid(), type: 'text', role: 'reference', name: 'Chapter Verse',
    frame: { x: 0.02, y: 0.44, width: divX - 0.04, height: 0.22, zIndex: 2 },
    visible: true, locked: false,
    content: chapterVerse,
    style: {
      fontFamily, fontSize: 110, fontWeight: 800, fontStyle: 'normal',
      textAlign: 'left', verticalAlign: 'top',
      color: '#ffffff', lineHeight: 1.0, letterSpacing: -1,
      outlineColor: 'rgba(0,0,0,0.5)', outlineWidth: 1.2,
      shadow: '0 4px 20px rgba(0,0,0,0.6)', opacity: 1,
      backgroundColor: 'transparent', borderRadius: 0, padding: 0,
      listStyleType: 'none', listIndent: 28,
    },
  };

  // ── Left panel: Version badge ──
  const versionEl: SlideElement = {
    id: uid(), type: 'text', role: 'footer', name: 'Version Badge',
    frame: { x: 0.03, y: 0.68, width: divX - 0.06, height: 0.06, zIndex: 2 },
    visible: true, locked: false,
    content: version,
    style: {
      fontFamily, fontSize: 22, fontWeight: 700, fontStyle: 'normal',
      textAlign: 'left', verticalAlign: 'middle',
      color: cfg.accent1, lineHeight: 1.1, letterSpacing: 0.8,
      textTransform: 'uppercase',
      outlineColor: 'transparent', outlineWidth: 0, shadow: 'none', opacity: 1,
      backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10,
      listStyleType: 'none', listIndent: 28,
    },
  };

  // ── Right panel: Verse body ──
  const bodyHeight = meta.isVeryLong ? 0.72 : meta.isLong ? 0.62 : 0.52;
  const bodyY = (1 - bodyHeight) / 2;
  const verseFontSize = meta.isVeryLong ? 42 : meta.isLong ? 50 : 58;

  const bodyEl: SlideElement = {
    id: uid(), type: 'text', role: 'body', name: 'Scripture Body',
    frame: { x: rightX, y: bodyY, width: rightW, height: bodyHeight, zIndex: 1 },
    visible: true, locked: false,
    content: verseText,
    style: {
      fontFamily, fontSize: verseFontSize, fontWeight: 600, fontStyle: 'normal',
      textAlign: 'left', verticalAlign: 'middle',
      color: '#ffffff', lineHeight: 1.32, letterSpacing: 0,
      outlineColor: 'rgba(0,0,0,0.7)', outlineWidth: 1.0,
      shadow: '0 3px 16px rgba(0,0,0,0.7)', opacity: 1,
      backgroundColor: 'transparent', borderRadius: 0, padding: 8,
      listStyleType: 'none', listIndent: 28,
    },
  };

  return [bodyEl, bookEl, cvEl, versionEl];
}

// Variants available for split-panel family
const SPLIT_PANEL_FAMILY_VARIANTS: Array<{ configIdx: number; tornIdx: number; fontFamily: string }> = [
  { configIdx: 0, tornIdx: 0, fontFamily: 'Georgia' },
  { configIdx: 1, tornIdx: 1, fontFamily: 'Aptos'   },
  { configIdx: 2, tornIdx: 2, fontFamily: 'Georgia' },
  { configIdx: 3, tornIdx: 0, fontFamily: 'Aptos'   },
  { configIdx: 4, tornIdx: 1, fontFamily: 'Georgia' },
  { configIdx: 5, tornIdx: 2, fontFamily: 'Aptos'   },
];

// ─── Layout Builders ──────────────────────────────────────────────────────────

/**
 * Creates structured slide elements for a scripture slide from a style profile.
 * Returns elements array (replaces legacy content/layoutType flow).
 */
export function buildStyledElements(
  verseText: string,
  label: string,
  profile: BibleStyleProfile,
  meta: BibleVerseMeta,
): SlideElement[] {
  const uid = () => `se-${Math.random().toString(36).slice(2, 9)}`;

  const bodyStyle: TextElementStyle = {
    fontFamily: profile.fontFamily,
    fontSize: profile.verseFontSize,
    fontWeight: profile.family === 'revival-night' ? 800 : profile.family === 'cinematic-worship' ? 700 : 600,
    fontStyle: (profile.family === 'classic-scripture' || profile.family === 'prayer-atmosphere') ? 'italic' : 'normal',
    textAlign: 'center',
    verticalAlign: 'middle',
    color: profile.textColor,
    lineHeight: meta.isLong ? 1.28 : 1.2,
    letterSpacing: profile.family === 'minimal-modern' ? 0.5 : 0,
    outlineColor: 'rgba(0,0,0,0.85)',
    outlineWidth: profile.shadow ? 1.4 : 0,
    shadow: profile.shadow ? '0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.4)' : 'none',
    opacity: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 24,
    listStyleType: 'none',
    listIndent: 28,
  };

  // For 'card' layout, add a frosted card background to verse
  const cardBg = profile.layoutVariant === 'card'
    ? { backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 20, padding: 36 }
    : {};

  // Verse body frame — adjust height for long verses
  const bodyHeight = meta.isVeryLong ? 0.52 : meta.isLong ? 0.42 : 0.28;
  const bodyY = profile.layoutVariant === 'lower-ref' ? 0.18 : 0.22;

  const bodyEl: SlideElement = {
    id: uid(),
    type: 'text',
    role: 'body',
    name: 'Scripture Body',
    frame: { x: 0.12, y: bodyY, width: 0.76, height: bodyHeight, zIndex: 1 },
    visible: true,
    locked: false,
    content: verseText,
    style: { ...bodyStyle, ...cardBg },
  };

  // Reference element
  const refStyle: TextElementStyle = {
    fontFamily: profile.fontFamily,
    fontSize: profile.family === 'minimal-modern' ? 28 : 32,
    fontWeight: profile.family === 'revival-night' ? 800 : 600,
    fontStyle: 'normal',
    textTransform: profile.family === 'revival-night' ? 'uppercase' : 'none',
    letterSpacing: profile.family === 'revival-night' ? 2.5 : 1.2,
    textAlign: profile.referencePosition === 'bottom-right' ? 'right' : 'center',
    verticalAlign: 'middle',
    color: profile.referenceColor,
    lineHeight: 1.1,
    outlineColor: 'rgba(0,0,0,0.7)',
    outlineWidth: profile.shadow ? 1.0 : 0,
    shadow: profile.shadow ? '0 2px 12px rgba(0,0,0,0.6)' : 'none',
    opacity: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 8,
    listStyleType: 'none',
    listIndent: 28,
  };

  const refX = profile.referencePosition === 'bottom-right' ? 0.6 : 0.25;
  const refWidth = profile.referencePosition === 'bottom-right' ? 0.28 : 0.5;
  const refY = bodyY + bodyHeight + 0.04;

  const refEl: SlideElement = {
    id: uid(),
    type: 'text',
    role: 'reference',
    name: 'Reference',
    frame: { x: refX, y: refY, width: refWidth, height: 0.08, zIndex: 2 },
    visible: true,
    locked: false,
    content: label,
    style: refStyle,
  };

  return [bodyEl, refEl];
}

// ─── Family Selector ──────────────────────────────────────────────────────────

function chooseFamilyForMoods(moods: BibleVerseMood[], intensity: BibleVerseMeta['intensity']): BibleStyleFamily {
  const boldFamilies: BibleStyleFamily[] = ['revival-night', 'cinematic-worship'];
  const calmFamilies: BibleStyleFamily[] = ['prayer-atmosphere', 'classic-scripture'];
  const worshipFamilies: BibleStyleFamily[] = ['cinematic-worship', 'classic-scripture'];

  if (moods.includes('prayer') || moods.includes('comfort') || moods.includes('healing')) {
    return 'prayer-atmosphere';
  }
  if (moods.includes('victory') || moods.includes('revival') || moods.includes('strength')) {
    return pick(boldFamilies, makeRng(moods.join('')));
  }
  if (moods.includes('praise') || moods.includes('worship') || moods.includes('thanksgiving')) {
    return pick(worshipFamilies, makeRng(moods.join('')));
  }
  if (moods.includes('holiness') || moods.includes('salvation')) {
    return 'classic-scripture';
  }
  if (intensity === 'bold') return 'revival-night';
  if (intensity === 'calm') return pick(calmFamilies, makeRng(moods.join('')));
  return 'classic-scripture';
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function generateBibleStyle(request: BibleStyleRequest): BibleStyleProfile {
  const meta = analyzeVerse(request.verseText, request.reference);

  // Determine family
  const family: BibleStyleFamily = (() => {
    if (request.mode === 'classic') return 'classic-scripture';
    if (request.family) return request.family;
    return chooseFamilyForMoods(meta.moods, meta.intensity);
  })();

  const seed = request.manualSeed ?? `${request.reference}::${family}::${request.mode}`;
  const rng = makeRng(seed);

  // ── Split Panel family has its own generation path ──
  if (family === 'split-panel') {
    const spv = pick(SPLIT_PANEL_FAMILY_VARIANTS, rng);
    const cfg = SPLIT_PANEL_CONFIGS[spv.configIdx];
    const backgroundUrl = makeSplitPanelBackground(cfg, spv.tornIdx);
    return {
      id: `bsp-${hashString(seed).toString(16)}`,
      family,
      seed,
      backgroundUrl,
      fontFamily: spv.fontFamily,
      textColor: '#ffffff',
      referenceColor: cfg.accent1,
      shadow: true,
      overlayOpacity: 0,
      layoutVariant: 'split',
      verseFontSize: 58,
      referencePosition: 'bottom-center',
      splitPanelConfig: spv.configIdx,
      splitPanelTorn: spv.tornIdx,
    } as BibleStyleProfile;
  }

  const variants = FAMILY_VARIANTS[family];
  const variant = pick(variants, rng);
  const fontFamily = pick(FAMILY_FONTS[family], rng);

  // Layout variant — use card for long verses, lower-ref for short ones
  const layoutVariant: BibleStyleProfile['layoutVariant'] =
    meta.isVeryLong ? 'hero' :
    meta.isLong ? 'card' :
    family === 'cinematic-worship' ? 'hero' :
    family === 'revival-night' ? 'split' :
    family === 'minimal-modern' ? 'lower-ref' :
    'hero';

  // Reference position
  const referencePosition: BibleStyleProfile['referencePosition'] =
    family === 'classic-scripture' ? 'bottom-center' :
    family === 'revival-night' ? 'bottom-right' :
    family === 'minimal-modern' ? 'bottom-right' :
    'bottom-center';

  // Font size — smaller for long verses
  const baseFontSize =
    family === 'revival-night' ? 72 :
    family === 'cinematic-worship' ? 70 :
    family === 'minimal-modern' ? 60 :
    family === 'prayer-atmosphere' ? 58 :
    62; // classic-scripture
  const verseFontSize = meta.isVeryLong ? baseFontSize - 18 : meta.isLong ? baseFontSize - 10 : baseFontSize;

  const backgroundUrl = makeGradientBackground(variant.bg[0], variant.bg[1], variant.bg[2]);

  return {
    id: `bsp-${hashString(seed).toString(16)}`,
    family,
    seed,
    backgroundUrl,
    fontFamily,
    textColor: variant.textColor,
    referenceColor: variant.referenceColor,
    shadow: family !== 'minimal-modern',
    overlayOpacity: family === 'minimal-modern' ? 0 : 0.15,
    layoutVariant,
    verseFontSize,
    referencePosition,
  };
}

/**
 * Applies a BibleStyleProfile to produce the theme + per-slide elements
 * ready to merge into a ServiceItem.
 */
export function applyBibleStyle(
  verses: Array<{ text: string; label: string }>,
  profile: BibleStyleProfile,
): {
  theme: ServiceItem['theme'];
  slides: Array<Pick<Slide, 'backgroundUrl' | 'mediaType' | 'elements'>>;
} {
  const theme: ServiceItem['theme'] = {
    backgroundUrl: profile.backgroundUrl,
    mediaType: 'image',
    fontFamily: profile.fontFamily,
    textColor: profile.textColor,
    shadow: profile.shadow,
  };

  const slides = verses.map(({ text, label }) => {
    const meta = analyzeVerse(text, label);
    let elements: SlideElement[];
    if (profile.family === 'split-panel' && profile.splitPanelConfig !== undefined && profile.splitPanelTorn !== undefined) {
      const cfg = SPLIT_PANEL_CONFIGS[profile.splitPanelConfig];
      elements = buildSplitPanelElements(text, label, cfg, meta, profile.fontFamily);
    } else {
      elements = buildStyledElements(text, label, profile, meta);
    }
    return {
      backgroundUrl: profile.backgroundUrl,
      mediaType: 'image' as const,
      elements,
    };
  });

  return { theme, slides };
}

// ─── Family Metadata (for UI) ─────────────────────────────────────────────────

export interface BibleStyleFamilyMeta {
  id: BibleStyleFamily;
  label: string;
  description: string;
  previewColors: [string, string];   // for mini swatch
}

export const BIBLE_STYLE_FAMILIES: BibleStyleFamilyMeta[] = [
  { id: 'classic-scripture',  label: 'Classic',   description: 'Warm parchment tones, elegant serif',             previewColors: ['#2d1a09', '#f0c060'] },
  { id: 'cinematic-worship',  label: 'Cinematic', description: 'Deep dark blue, cinematic drama',                  previewColors: ['#061020', '#94b8ff'] },
  { id: 'minimal-modern',     label: 'Minimal',   description: 'Clean black canvas, modern sans-serif',            previewColors: ['#111111', '#a0a0a0'] },
  { id: 'revival-night',      label: 'Revival',   description: 'Deep purple, bold proclamation, gold',             previewColors: ['#1a0d2e', '#fbbf24'] },
  { id: 'prayer-atmosphere',  label: 'Prayer',    description: 'Deep blue, soft light, contemplative',             previewColors: ['#0e1830', '#7eb8e8'] },
  { id: 'split-panel',        label: 'Split',     description: 'Reference panel left, verse right — editorial style', previewColors: ['#1a7a8a', '#2a1a7a'] },
];
