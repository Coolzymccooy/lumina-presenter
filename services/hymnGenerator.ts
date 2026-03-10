import { getTypographyPreset, DEFAULT_HYMN_TYPOGRAPHY_PRESET_ID } from '../presets/hymnTypographyPresets.ts';
import type { ServiceItem, Slide, TextTransform, TextSlideElement } from '../types.ts';
import { ItemType } from '../types.ts';
import type {
  ExpandedHymnSection,
  GeneratedSlide,
  Hymn,
  HymnChorusStrategy,
  HymnGeneratorOptions,
  HymnGenerationSnapshot,
  HymnThemeCategory,
  SuggestedHymnBackground,
  TypographyPreset,
} from '../types/hymns.ts';
import { getSuggestedBackgroundForHymn } from './hymnThemeRouter.ts';

export interface GeneratedHymnResult {
  hymn: Hymn;
  item: ServiceItem;
  slides: Slide[];
  generatedSlides: GeneratedSlide[];
  snapshot: HymnGenerationSnapshot;
  typographyPreset: TypographyPreset;
  suggestedBackground: SuggestedHymnBackground;
}

const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const splitLines = (text: string) => text
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const isSoftPunctuationEnding = (line: string) => /[,;:-]$/.test(line.trim());
const isHardPunctuationEnding = (line: string) => /[.!?]$/.test(line.trim());

const scoreWindow = (lines: string[], preferredCharsPerLine: number) => {
  const totalChars = lines.reduce((sum, entry) => sum + entry.length, 0);
  const linePenalty = Math.max(0, totalChars - (preferredCharsPerLine * lines.length)) * 0.4;
  const punctuationPenalty = lines.length >= 2 && !isHardPunctuationEnding(lines[lines.length - 1]) && !isSoftPunctuationEnding(lines[lines.length - 1]) ? 7 : 0;
  return totalChars + linePenalty + punctuationPenalty;
};

const chooseWindowSize = (
  lines: string[],
  startIndex: number,
  maxLinesPerSlide: number,
  preferredCharsPerLine: number,
  allowThreeLineSlides: boolean,
) => {
  const remaining = lines.length - startIndex;
  if (remaining <= maxLinesPerSlide) return remaining;
  if (maxLinesPerSlide >= 3) return Math.min(3, remaining);
  if (!allowThreeLineSlides || remaining < 3) return Math.min(maxLinesPerSlide, remaining);

  const twoLines = lines.slice(startIndex, startIndex + 2);
  const threeLines = lines.slice(startIndex, startIndex + 3);
  const shortTriple = threeLines.every((entry) => entry.length <= preferredCharsPerLine * 0.85);
  const continuationBias = isSoftPunctuationEnding(twoLines[1] || '') || (!isHardPunctuationEnding(twoLines[1] || '') && (threeLines[2]?.length || 0) <= preferredCharsPerLine * 0.8);
  const oneLineLeftPenalty = remaining === 3 ? -12 : 0;
  const threeScore = scoreWindow(threeLines, preferredCharsPerLine) + (shortTriple ? -10 : 8) + (continuationBias ? -8 : 0) + oneLineLeftPenalty;
  const twoScore = scoreWindow(twoLines, preferredCharsPerLine);
  return threeScore <= twoScore ? 3 : 2;
};

export const splitSectionIntoSlides = (
  section: Hymn['sections'][number],
  options: {
    maxLinesPerSlide?: number;
    preferredCharsPerLine?: number;
    allowThreeLineSlides?: boolean;
  } = {},
) => {
  const lines = splitLines(section.text);
  const maxLinesPerSlide = Math.max(1, Math.min(3, Math.round(options.maxLinesPerSlide || 2)));
  const preferredCharsPerLine = Math.max(18, Math.min(64, Math.round(options.preferredCharsPerLine || 32)));
  const allowThreeLineSlides = options.allowThreeLineSlides !== false;
  const groups: string[][] = [];

  for (let idx = 0; idx < lines.length;) {
    const size = chooseWindowSize(lines, idx, maxLinesPerSlide, preferredCharsPerLine, allowThreeLineSlides);
    groups.push(lines.slice(idx, idx + size));
    idx += size;
  }

  return groups.map((entry) => ({
    lines: entry,
    text: entry.join('\n'),
  }));
};

const shouldAppendRepeat = (
  strategy: HymnChorusStrategy,
  currentSection: Hymn['sections'][number],
  nextSection: Hymn['sections'][number] | undefined,
  repeatableSection: Hymn['sections'][number] | undefined,
) => {
  if (!repeatableSection) return false;
  if (strategy === 'explicit-only') return false;
  if (strategy === 'suppress-repeats') return false;
  if (currentSection.type !== 'verse') return false;
  if (nextSection?.id === repeatableSection.id) return false;
  return true;
};

export const expandHymnSectionsForPresentation = (
  hymn: Hymn,
  strategy: HymnChorusStrategy = 'smart',
): ExpandedHymnSection[] => {
  const sections = [...hymn.sections].sort((left, right) => left.order - right.order);
  const repeatableSection = sections.find((entry) => (
    (entry.type === 'chorus' || entry.type === 'refrain')
    && (
      entry.presentation?.repeatMode === 'each-verse'
      || entry.presentation?.repeatAfterSectionTypes?.includes('verse')
    )
  ));

  const expanded: ExpandedHymnSection[] = [];
  let chorusSeen = false;

  sections.forEach((section, index) => {
    const nextSection = sections[index + 1];
    const isRepeatableChorus = repeatableSection && section.id === repeatableSection.id;
    if (strategy === 'suppress-repeats' && isRepeatableChorus && chorusSeen) {
      return;
    }

    expanded.push({
      section,
      sourceSectionId: section.id,
      occurrenceIndex: expanded.length,
      repeated: false,
    });

    if (isRepeatableChorus) chorusSeen = true;

    if (shouldAppendRepeat(strategy, section, nextSection, repeatableSection)) {
      expanded.push({
        section: repeatableSection as Hymn['sections'][number],
        sourceSectionId: repeatableSection!.id,
        occurrenceIndex: expanded.length,
        repeated: true,
      });
      chorusSeen = true;
    }
  });

  return expanded;
};

const toTextTransform = (value: TypographyPreset['caseTransform']): TextTransform => {
  if (value === 'uppercase' || value === 'lowercase' || value === 'capitalize') return value;
  return 'none';
};

const createHymnTextElement = (
  name: string,
  role: TextSlideElement['role'],
  content: string,
  frame: TextSlideElement['frame'],
  style: TextSlideElement['style'],
  zIndex: number,
): TextSlideElement => ({
  id: nextId(`hymn-element-${name.toLowerCase().replace(/\s+/g, '-')}`),
  type: 'text',
  name,
  role,
  content,
  frame: {
    x: Math.max(0, Math.min(1, frame.x)),
    y: Math.max(0, Math.min(1, frame.y)),
    width: Math.max(0.05, Math.min(1, frame.width)),
    height: Math.max(0.05, Math.min(1, frame.height)),
    zIndex,
  },
  visible: true,
  locked: false,
  style,
});

const buildSlideElements = (
  preset: TypographyPreset,
  label: string,
  content: string,
  isDistinct: boolean,
) => {
  const bodyFontSize = preset.fontSizeToken === 'xlarge' ? 80 : preset.fontSizeToken === 'large' ? 68 : 56;
  const labelFontSize = preset.safeAreaBehavior === 'lower-third' ? 20 : 24;

  return [
    createHymnTextElement(
      'Hymn Label',
      'note',
      label,
      { ...preset.labelFrame, zIndex: 2 },
      {
        fontFamily: preset.fontFamily,
        fontSize: labelFontSize,
        fontWeight: 800,
        textAlign: 'center',
        lineHeight: 1,
        textTransform: toTextTransform(preset.caseTransform),
        color: preset.labelColor,
        outlineColor: 'rgba(0,0,0,0.65)',
        outlineWidth: Math.max(1, Math.round(preset.outlineStrength)),
        backgroundColor: isDistinct ? 'rgba(15,23,42,0.48)' : 'rgba(0,0,0,0.24)',
        borderRadius: 12,
        padding: 10,
      },
      2,
    ),
    createHymnTextElement(
      'Hymn Body',
      'body',
      content,
      { ...preset.bodyFrame, zIndex: 1 },
      {
        fontFamily: preset.fontFamily,
        fontSize: bodyFontSize,
        fontWeight: preset.fontCategory === 'hymnal' ? 700 : 800,
        textAlign: preset.alignment,
        lineHeight: preset.lineHeight,
        letterSpacing: preset.letterSpacing,
        textTransform: toTextTransform(preset.caseTransform),
        color: preset.textColor,
        outlineColor: 'rgba(0,0,0,0.82)',
        outlineWidth: preset.outlineStrength,
        backgroundColor: 'transparent',
        shadow: preset.shadow ? '0 4px 18px rgba(0,0,0,0.55)' : 'none',
        padding: preset.safeAreaBehavior === 'choir' ? 18 : 14,
      },
      1,
    ),
  ];
};

const buildItemTitle = (hymn: Hymn) => hymn.title;

const resolveThemeCategory = (hymn: Hymn, suggestion: SuggestedHymnBackground): HymnThemeCategory => (
  hymn.themes.find((entry) => entry === suggestion.category)
  || hymn.presentationDefaults.defaultThemeCategory
);

const assertProjectableRights = (hymn: Hymn) => {
  if (!hymn.usageRights.canProject) {
    throw new Error(`Hymn "${hymn.title}" is not cleared for projection.`);
  }
};

export const generateSlidesFromHymn = (
  hymn: Hymn,
  options: HymnGeneratorOptions = {},
): GeneratedHymnResult => {
  if (options.requireProjectableRights !== false) {
    assertProjectableRights(hymn);
  }
  const typographyPreset = getTypographyPreset(options.typographyPresetId || hymn.presentationDefaults.defaultTypographyPresetId || DEFAULT_HYMN_TYPOGRAPHY_PRESET_ID);
  const suggestedBackground = options.backgroundOverride
    ? {
      ...getSuggestedBackgroundForHymn(hymn, hymn.presentationDefaults.defaultThemeCategory),
      candidate: options.backgroundOverride,
    }
    : getSuggestedBackgroundForHymn(hymn, hymn.presentationDefaults.defaultThemeCategory);
  const chorusStrategy = options.chorusStrategy || hymn.presentationDefaults.defaultChorusStrategy;
  const expandedSections = expandHymnSectionsForPresentation(hymn, chorusStrategy);
  const maxLinesPerSlide = options.maxLinesPerSlide || hymn.presentationDefaults.maxLinesPerSlide;
  const preferredCharsPerLine = options.preferredCharsPerLine || hymn.presentationDefaults.preferredCharsPerLine;
  const previewSuppressedRepeatedChorus = !!options.suppressRepeatedChorusInPreview;

  const slides: Slide[] = [];
  const generatedSlides: GeneratedSlide[] = [];

  expandedSections.forEach((expandedSection) => {
    const lineGroups = splitSectionIntoSlides(expandedSection.section, {
      maxLinesPerSlide,
      preferredCharsPerLine,
      allowThreeLineSlides: hymn.presentationDefaults.allowThreeLineSlides,
    });

    lineGroups.forEach((group, groupIndex) => {
      const sequence = slides.length;
      const suffix = lineGroups.length > 1 ? ` (${groupIndex + 1})` : '';
      const label = `${expandedSection.section.label}${expandedSection.repeated ? ' Repeat' : ''}${suffix}`;
      const elements = buildSlideElements(
        typographyPreset,
        expandedSection.section.label,
        group.text,
        !!expandedSection.section.presentation?.visuallyDistinct || expandedSection.section.type === 'chorus' || expandedSection.section.type === 'refrain',
      );

      const slide: Slide = {
        id: nextId(`hymn-slide-${hymn.id}`),
        type: 'hymn',
        label,
        content: group.text,
        elements,
        metadata: {
          hymn: {
            hymnId: hymn.id,
            hymnTitle: hymn.title,
            sourceKind: hymn.librarySource.kind,
            sectionId: expandedSection.section.id,
            sectionType: expandedSection.section.type,
            sectionLabel: expandedSection.section.label,
            sequence,
            repeated: expandedSection.repeated,
          },
        },
      };

      slides.push(slide);
      generatedSlides.push({
        id: slide.id,
        label,
        content: group.text,
        sectionId: expandedSection.section.id,
        sectionType: expandedSection.section.type,
        sequence,
        repeated: expandedSection.repeated,
        backgroundUrl: suggestedBackground.candidate.backgroundUrl,
        mediaType: suggestedBackground.candidate.mediaType,
      });
    });
  });

  const snapshot: HymnGenerationSnapshot = {
    hymnId: hymn.id,
    hymnTitle: hymn.title,
    sourceKind: hymn.librarySource.kind,
    providerId: hymn.librarySource.providerId,
    providerName: hymn.librarySource.providerName,
    licenseScope: hymn.usageRights.licenseScope,
    generatedAt: Date.now(),
    typographyPresetId: typographyPreset.id,
    chorusStrategy,
    themeCategory: resolveThemeCategory(hymn, suggestedBackground),
    backgroundUrl: suggestedBackground.candidate.backgroundUrl,
    mediaType: suggestedBackground.candidate.mediaType,
    previewSuppressedRepeatedChorus,
  };

  const item: ServiceItem = {
    id: nextId(`hymn-item-${hymn.id}`),
    title: buildItemTitle(hymn),
    type: ItemType.HYMN,
    slides,
    metadata: {
      source: 'hymn-library',
      createdAt: snapshot.generatedAt,
      hymn: {
        source: 'hymn-library',
        hymnId: hymn.id,
        hymnTitle: hymn.title,
        sourceKind: hymn.librarySource.kind,
        providerId: hymn.librarySource.providerId,
        providerName: hymn.librarySource.providerName,
        publicDomain: hymn.copyright.publicDomain,
        requiresReview: hymn.copyright.requiresReview,
        licenseScope: hymn.usageRights.licenseScope,
        requiresLicenseCheck: hymn.usageRights.requiresLicenseCheck,
        generation: snapshot,
      },
    },
    theme: {
      backgroundUrl: suggestedBackground.candidate.backgroundUrl,
      mediaType: suggestedBackground.candidate.mediaType,
      fontFamily: typographyPreset.fallbackFontFamily,
      textColor: typographyPreset.textColor,
      shadow: typographyPreset.shadow,
      fontSize: typographyPreset.fontSizeToken,
    },
  };

  return {
    hymn,
    item,
    slides,
    generatedSlides,
    snapshot,
    typographyPreset,
    suggestedBackground,
  };
};
