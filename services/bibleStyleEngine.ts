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
  | 'prayer-atmosphere';

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

const FAMILY_VARIANTS: Record<BibleStyleFamily, FamilyVariant[]> = {
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
};

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
    const elements = buildStyledElements(text, label, profile, meta);
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
  { id: 'classic-scripture',  label: 'Classic',   description: 'Warm parchment tones, elegant serif',    previewColors: ['#2d1a09', '#f0c060'] },
  { id: 'cinematic-worship',  label: 'Cinematic', description: 'Deep dark blue, cinematic drama',         previewColors: ['#061020', '#94b8ff'] },
  { id: 'minimal-modern',     label: 'Minimal',   description: 'Clean black canvas, modern sans-serif',   previewColors: ['#111111', '#a0a0a0'] },
  { id: 'revival-night',      label: 'Revival',   description: 'Deep purple, bold proclamation, gold',    previewColors: ['#1a0d2e', '#fbbf24'] },
  { id: 'prayer-atmosphere',  label: 'Prayer',    description: 'Deep blue, soft light, contemplative',    previewColors: ['#0e1830', '#7eb8e8'] },
];
