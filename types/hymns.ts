export type HymnSectionType = 'verse' | 'refrain' | 'chorus' | 'bridge' | 'ending' | 'doxology';
export type HymnThemeCategory =
  | 'grace'
  | 'prayer'
  | 'reflection'
  | 'praise'
  | 'majesty'
  | 'victory'
  | 'creation'
  | 'communion'
  | 'guidance'
  | 'thanksgiving'
  | 'assurance'
  | 'holiness'
  | 'comfort'
  | 'mission'
  | 'surrender';
export type HymnChorusStrategy = 'smart' | 'repeat-after-every-verse' | 'explicit-only' | 'suppress-repeats';
export type TypographyFontCategory = 'serif' | 'sans' | 'hymnal' | 'broadcast';
export type TypographyCaseTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TypographyAlignment = 'left' | 'center' | 'right';
export type SafeAreaBehavior = 'standard' | 'wide' | 'choir' | 'lower-third';
export type HymnBackgroundMotionMode = 'still' | 'motion' | 'either';
export type HymnSectionRepeatMode = 'none' | 'each-verse' | 'explicit';
export type HymnLibrarySourceKind = 'bundled-pd' | 'licensed' | 'imported';
export type HymnLicenseScope = 'bundled-distribution' | 'provider-streaming' | 'provider-projection' | 'single-workspace-import';

export interface HymnLibrarySource {
  kind: HymnLibrarySourceKind;
  isBundled: boolean;
  providerId?: string;
  providerName?: string;
  catalogId?: string;
  externalId?: string;
  importBatchId?: string;
  displayLabel: string;
}

export interface HymnUsageRights {
  licenseScope: HymnLicenseScope;
  canStoreText: boolean;
  canDistributeInApp: boolean;
  canProject: boolean;
  canStream: boolean;
  requiresAttribution: boolean;
  requiresLicenseCheck: boolean;
  notice?: string;
  entitlementId?: string;
  expiresAt?: number;
}

export interface HymnAuthor {
  name: string;
  role: 'text' | 'tune' | 'translator' | 'paraphrase' | 'attribution';
  birthYear?: number;
  deathYear?: number;
  notes?: string;
}

export interface HymnTune {
  name: string;
  alternateNames?: string[];
  composer?: string;
  meter?: string;
  year?: number;
  publicDomain: boolean;
  requiresReview?: boolean;
}

export interface HymnCopyright {
  publicDomain: boolean;
  requiresReview: boolean;
  textPd: boolean;
  tunePd: boolean;
  textAttribution: string;
  tuneAttribution: string;
  publicDomainBasis?: string;
  notes?: string[];
  variantWarnings?: string[];
}

export interface HymnSectionPresentation {
  repeatMode?: HymnSectionRepeatMode;
  repeatAfterSectionIds?: string[];
  repeatAfterSectionTypes?: HymnSectionType[];
  suppressRepeatedInPreview?: boolean;
  visuallyDistinct?: boolean;
}

export interface HymnSection {
  id: string;
  type: HymnSectionType;
  label: string;
  order: number;
  text: string;
  presentation?: HymnSectionPresentation;
}

export interface HymnPresentationDefaults {
  defaultTypographyPresetId: string;
  defaultThemeCategory: HymnThemeCategory;
  defaultChorusStrategy: HymnChorusStrategy;
  preferredBackgroundMotion: HymnBackgroundMotionMode;
  maxLinesPerSlide: number;
  preferredCharsPerLine: number;
  allowThreeLineSlides: boolean;
  chorusVisuallyDistinct: boolean;
}

export interface HymnSearchIndex {
  normalizedTitle: string;
  normalizedFirstLine: string;
  keywords: string[];
  themes: string[];
  tokens: string[];
  searchableText: string;
}

export interface Hymn {
  id: string;
  title: string;
  alternateTitles: string[];
  firstLine: string;
  meter?: string;
  /** Hymnal book numbers, e.g. { 'UMH': 57, 'SBC': 104, 'LW': 362 } */
  hymnalNumbers?: Record<string, number>;
  authors: HymnAuthor[];
  tunes: HymnTune[];
  themes: HymnThemeCategory[];
  scriptureThemes: string[];
  copyright: HymnCopyright;
  sections: HymnSection[];
  searchKeywords: string[];
  presentationDefaults: HymnPresentationDefaults;
  librarySource: HymnLibrarySource;
  usageRights: HymnUsageRights;
  searchIndex: HymnSearchIndex;
}

export interface HymnMetadataRecord {
  id: string;
  title: string;
  alternateTitles: string[];
  firstLine: string;
  meter?: string;
  hymnalNumbers?: Record<string, number>;
  authors: HymnAuthor[];
  tunes: HymnTune[];
  themes: HymnThemeCategory[];
  scriptureThemes: string[];
  copyright: HymnCopyright;
  searchKeywords: string[];
  presentationDefaults: HymnPresentationDefaults;
  librarySource: HymnLibrarySource;
  usageRights: HymnUsageRights;
  searchIndex: HymnSearchIndex;
  sectionCount: number;
}

export interface TypographyPreset {
  id: string;
  label: string;
  description: string;
  fontCategory: TypographyFontCategory;
  fontFamily: string;
  fallbackFontFamily: string;
  fontSizeToken: 'medium' | 'large' | 'xlarge';
  lineHeight: number;
  alignment: TypographyAlignment;
  caseTransform: TypographyCaseTransform;
  outlineStrength: number;
  letterSpacing: number;
  safeAreaBehavior: SafeAreaBehavior;
  bodyFrame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  labelFrame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textColor: string;
  labelColor: string;
  shadow: boolean;
}

export interface ThemeBackgroundCandidate {
  id: string;
  label: string;
  backgroundUrl: string;
  mediaType: 'image' | 'video' | 'color';
  source: 'built-in' | 'motion-library';
}

export interface ThemeBackgroundMapping {
  category: HymnThemeCategory;
  label: string;
  summary: string;
  keywords: string[];
  candidates: ThemeBackgroundCandidate[];
}

export interface SuggestedHymnBackground {
  category: HymnThemeCategory;
  label: string;
  summary: string;
  candidate: ThemeBackgroundCandidate;
  matchedFrom: string[];
}

export interface HymnGeneratorOptions {
  typographyPresetId?: string;
  chorusStrategy?: HymnChorusStrategy;
  backgroundOverride?: ThemeBackgroundCandidate | null;
  maxLinesPerSlide?: number;
  preferredCharsPerLine?: number;
  suppressRepeatedChorusInPreview?: boolean;
  requireProjectableRights?: boolean;
}

export interface ExpandedHymnSection {
  section: HymnSection;
  sourceSectionId: string;
  occurrenceIndex: number;
  repeated: boolean;
}

export interface GeneratedSlide {
  id: string;
  label: string;
  content: string;
  sectionId: string;
  sectionType: HymnSectionType;
  sequence: number;
  repeated: boolean;
  backgroundUrl?: string;
  mediaType?: 'image' | 'video' | 'color';
}

export interface HymnGenerationSnapshot {
  hymnId: string;
  hymnTitle: string;
  sourceKind: HymnLibrarySourceKind;
  providerId?: string;
  providerName?: string;
  licenseScope: HymnLicenseScope;
  generatedAt: number;
  typographyPresetId: string;
  chorusStrategy: HymnChorusStrategy;
  themeCategory: HymnThemeCategory;
  backgroundUrl: string;
  mediaType: 'image' | 'video' | 'color';
  previewSuppressedRepeatedChorus: boolean;
}

export interface HymnGeneratedSlideMetadata {
  hymnId: string;
  hymnTitle: string;
  sourceKind: HymnLibrarySourceKind;
  sectionId: string;
  sectionType: HymnSectionType;
  sectionLabel: string;
  sequence: number;
  repeated: boolean;
}

export interface HymnGeneratedItemMetadata {
  source: 'hymn-library';
  hymnId: string;
  hymnTitle: string;
  sourceKind: HymnLibrarySourceKind;
  providerId?: string;
  providerName?: string;
  publicDomain: boolean;
  requiresReview: boolean;
  licenseScope: HymnLicenseScope;
  requiresLicenseCheck: boolean;
  generation: HymnGenerationSnapshot;
}

export interface GeneratedRunSheetItem {
  title: string;
  itemType: 'HYMN' | 'SONG';
  backgroundUrl: string;
  mediaType: 'image' | 'video' | 'color';
  typographyPresetId: string;
  slides: GeneratedSlide[];
  metadata: HymnGeneratedItemMetadata;
}
