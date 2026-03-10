import { DEFAULT_BACKGROUNDS, VIDEO_BACKGROUNDS } from '../constants.ts';
import type { Hymn, HymnThemeCategory, SuggestedHymnBackground, ThemeBackgroundMapping } from '../types/hymns.ts';

const still = (id: string, label: string, backgroundUrl: string) => ({
  id,
  label,
  backgroundUrl,
  mediaType: 'image' as const,
  source: 'built-in' as const,
});

const motion = (id: string, label: string, backgroundUrl: string) => ({
  id,
  label,
  backgroundUrl,
  mediaType: 'video' as const,
  source: 'motion-library' as const,
});

export const HYMN_THEME_BACKGROUND_MAPPINGS: ThemeBackgroundMapping[] = [
  {
    category: 'grace',
    label: 'Grace',
    summary: 'Soft mercy-driven tones with calm movement or gentle gradients.',
    keywords: ['grace', 'mercy', 'salvation', 'atonement', 'redemption'],
    candidates: [still('grace-still-1', 'Mercy Gradient', DEFAULT_BACKGROUNDS[0]), motion('grace-motion-1', 'Soft Blue Motion', VIDEO_BACKGROUNDS[0])],
  },
  {
    category: 'prayer',
    label: 'Prayer',
    summary: 'Quiet, intimate backgrounds that keep lyric focus at the center.',
    keywords: ['prayer', 'dependence', 'communion', 'supplication', 'devotion'],
    candidates: [still('prayer-still-1', 'Midnight Prayer', DEFAULT_BACKGROUNDS[9]), motion('prayer-motion-1', 'Calm Moonlit Sea', VIDEO_BACKGROUNDS[12])],
  },
  {
    category: 'reflection',
    label: 'Reflection',
    summary: 'Still and contemplative atmospheres for solemn hymn texts.',
    keywords: ['reflection', 'meditation', 'evening', 'stillness'],
    candidates: [still('reflection-still-1', 'Slate Reflection', DEFAULT_BACKGROUNDS[8]), motion('reflection-motion-1', 'Slow Clouds', VIDEO_BACKGROUNDS[2])],
  },
  {
    category: 'praise',
    label: 'Praise',
    summary: 'Open, luminous backgrounds for celebratory congregational singing.',
    keywords: ['praise', 'worship', 'adoration', 'doxology', 'joy'],
    candidates: [still('praise-still-1', 'Bright Sky Gradient', DEFAULT_BACKGROUNDS[6]), motion('praise-motion-1', 'Golden Hour Glow', VIDEO_BACKGROUNDS[8])],
  },
  {
    category: 'majesty',
    label: 'Majesty',
    summary: 'Regal color fields and elevated motion for kingship and enthronement hymns.',
    keywords: ['majesty', 'king', 'throne', 'glory', 'crown'],
    candidates: [still('majesty-still-1', 'Royal Depth', DEFAULT_BACKGROUNDS[1]), motion('majesty-motion-1', 'Abstract Geometry', VIDEO_BACKGROUNDS[9])],
  },
  {
    category: 'victory',
    label: 'Victory',
    summary: 'Forward-moving, resilient visuals for militant and triumphant texts.',
    keywords: ['victory', 'battle', 'fortress', 'mission', 'march'],
    candidates: [still('victory-still-1', 'Battle Steel', DEFAULT_BACKGROUNDS[11]), motion('victory-motion-1', 'Abstract Mesh', VIDEO_BACKGROUNDS[4])],
  },
  {
    category: 'creation',
    label: 'Creation',
    summary: 'Nature-forward stills and scenic loops that widen the visual horizon.',
    keywords: ['creation', 'earth', 'beauty', 'sun', 'moon', 'nature'],
    candidates: [still('creation-still-1', 'Earth Bloom', DEFAULT_BACKGROUNDS[4]), motion('creation-motion-1', 'Forest Sunbeams', VIDEO_BACKGROUNDS[6])],
  },
  {
    category: 'communion',
    label: 'Communion',
    summary: 'Warm, gathered-room tones suited for unity and fellowship texts.',
    keywords: ['communion', 'fellowship', 'unity', 'church', 'table'],
    candidates: [still('communion-still-1', 'Gathered Ember', DEFAULT_BACKGROUNDS[3]), motion('communion-motion-1', 'Warm Water Horizon', VIDEO_BACKGROUNDS[14])],
  },
  {
    category: 'guidance',
    label: 'Guidance',
    summary: 'Directional and pilgrimage-oriented imagery with clear depth and light.',
    keywords: ['guidance', 'journey', 'light', 'lead', 'pilgrim'],
    candidates: [still('guidance-still-1', 'Pathway Gradient', DEFAULT_BACKGROUNDS[7]), motion('guidance-motion-1', 'Clouds and Blue Sky', VIDEO_BACKGROUNDS[14])],
  },
  {
    category: 'thanksgiving',
    label: 'Thanksgiving',
    summary: 'Warm celebratory palettes for gratitude, harvest, and offering moments.',
    keywords: ['thanksgiving', 'gratitude', 'thanks', 'offering', 'blessing'],
    candidates: [still('thanksgiving-still-1', 'Harvest Glow', DEFAULT_BACKGROUNDS[10]), motion('thanksgiving-motion-1', 'Sunset Water', VIDEO_BACKGROUNDS[15])],
  },
  {
    category: 'assurance',
    label: 'Assurance',
    summary: 'Clear stable visuals for testimony, confidence, and settled peace.',
    keywords: ['assurance', 'story', 'confidence', 'certainty', 'peace'],
    candidates: [still('assurance-still-1', 'Stable Horizon', DEFAULT_BACKGROUNDS[5]), motion('assurance-motion-1', 'Soft Ocean Waves', VIDEO_BACKGROUNDS[7])],
  },
  {
    category: 'holiness',
    label: 'Holiness',
    summary: 'Set-apart, luminous tones that preserve reverence and awe.',
    keywords: ['holiness', 'holy', 'trinity', 'sacred', 'reverence'],
    candidates: [still('holiness-still-1', 'Sanctuary Light', DEFAULT_BACKGROUNDS[2]), motion('holiness-motion-1', 'Purple Particles', VIDEO_BACKGROUNDS[1])],
  },
  {
    category: 'comfort',
    label: 'Comfort',
    summary: 'Safe, low-distraction backgrounds for grief, refuge, and consolation.',
    keywords: ['comfort', 'refuge', 'peace', 'sorrow', 'abide'],
    candidates: [still('comfort-still-1', 'Shelter Blue', DEFAULT_BACKGROUNDS[0]), motion('comfort-motion-1', 'Calm Sea', VIDEO_BACKGROUNDS[11])],
  },
  {
    category: 'mission',
    label: 'Mission',
    summary: 'Purposeful directional imagery for sending, marching, and witness.',
    keywords: ['mission', 'send', 'march', 'forward', 'church'],
    candidates: [still('mission-still-1', 'Forward Steel', DEFAULT_BACKGROUNDS[11]), motion('mission-motion-1', 'Waterfall Energy', VIDEO_BACKGROUNDS[10])],
  },
  {
    category: 'surrender',
    label: 'Surrender',
    summary: 'Gentle subdued scenes for longing, yielding, and nearness to God.',
    keywords: ['surrender', 'nearer', 'yield', 'cross', 'longing'],
    candidates: [still('surrender-still-1', 'Quiet Evening', DEFAULT_BACKGROUNDS[8]), motion('surrender-motion-1', 'Moonlit Sea', VIDEO_BACKGROUNDS[11])],
  },
];

export const getSuggestedBackgroundForHymn = (
  hymn: Hymn,
  preferredCategory?: HymnThemeCategory | null,
): SuggestedHymnBackground => {
  const matchedFields = new Set<string>();
  const requestedCategory = preferredCategory || hymn.presentationDefaults.defaultThemeCategory;
  const hymnWords = [
    ...hymn.themes,
    ...hymn.searchKeywords,
    ...hymn.scriptureThemes,
    hymn.title,
  ].join(' ').toLowerCase();

  const mapping = HYMN_THEME_BACKGROUND_MAPPINGS.find((entry) => entry.category === requestedCategory)
    || HYMN_THEME_BACKGROUND_MAPPINGS.find((entry) => hymn.themes.includes(entry.category))
    || HYMN_THEME_BACKGROUND_MAPPINGS[0];

  mapping.keywords.forEach((keyword) => {
    if (hymnWords.includes(keyword.toLowerCase())) {
      matchedFields.add(keyword);
    }
  });

  const candidate = hymn.presentationDefaults.preferredBackgroundMotion === 'still'
    ? (mapping.candidates.find((entry) => entry.mediaType === 'image') || mapping.candidates[0])
    : hymn.presentationDefaults.preferredBackgroundMotion === 'motion'
      ? (mapping.candidates.find((entry) => entry.mediaType === 'video') || mapping.candidates[0])
      : mapping.candidates[0];

  return {
    category: mapping.category,
    label: mapping.label,
    summary: mapping.summary,
    candidate,
    matchedFrom: Array.from(matchedFields),
  };
};
