
import type { HymnGeneratedItemMetadata, HymnGeneratedSlideMetadata } from './types/hymns.ts';

export enum ItemType {
  SONG = 'SONG',
  HYMN = 'HYMN',
  SCRIPTURE = 'SCRIPTURE',
  MEDIA = 'MEDIA',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  BIBLE = 'BIBLE'
}

export type MediaType = 'image' | 'video' | 'color';

export type SlideType = 'custom' | 'lyrics' | 'scripture' | 'announcement' | 'offering' | 'hymn';
export type SlideElementType = 'text';
export type SlideElementRole = 'title' | 'subtitle' | 'body' | 'reference' | 'footer' | 'note';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TextListStyle = 'none' | 'disc' | 'circle' | 'square' | 'decimal';
export type SlideEditorTool = 'select' | 'add-text';

export interface ElementFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
}

export interface TextElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  color?: string;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: TextTransform;
  outlineColor?: string;
  outlineWidth?: number;
  shadow?: string;
  backgroundColor?: string;
  opacity?: number;
  borderRadius?: number;
  padding?: number;
  listStyleType?: TextListStyle;
  listIndent?: number;
}

export interface BaseSlideElement {
  id: string;
  type: SlideElementType;
  role?: SlideElementRole;
  name: string;
  frame: ElementFrame;
  visible: boolean;
  locked: boolean;
}

export interface TextSlideElement extends BaseSlideElement {
  type: 'text';
  content: string;
  style: TextElementStyle;
}

export type SlideElement = TextSlideElement;

export interface SlideMetadata {
  templateId?: string;
  notes?: string;
  hymn?: HymnGeneratedSlideMetadata;
}

export interface ServiceItemMetadata {
  createdAt?: number;
  source?: 'manual' | 'ai' | 'bible' | 'hymn-library' | 'import' | 'audience';
  hymn?: HymnGeneratedItemMetadata;
}

export interface LayoutPreset {
  id: string;
  label: string;
  description?: string;
  defaultSlideType: SlideType;
  createElements: () => SlideElement[];
}

export interface SlideEditorState {
  currentSlideId: string | null;
  selectedElementId: string | null;
  hoveredElementId: string | null;
  slides: Slide[];
  activeTool: SlideEditorTool;
  showSafeArea: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
}

export interface Slide {
  id: string;
  content: string; // The text content
  label?: string; // e.g., "Verse 1", "Chorus"
  type?: SlideType;
  layoutType?: string;
  elements?: SlideElement[];
  backgroundUrl?: string; // Specific background for this slide, overrides item default
  mediaType?: MediaType; // Explicitly define type to avoid guessing
  mediaFit?: 'cover' | 'contain';
  notes?: string; // Presenter notes
  metadata?: SlideMetadata;
}

export interface TimerCue {
  enabled: boolean;
  durationSec: number;
  speakerName?: string;
  autoStartNext?: boolean;
  amberPercent?: number;
  redPercent?: number;
  presetId?: string;
}

export type StageTimerVariant = 'top-right' | 'top-left' | 'bottom-right' | 'compact-bar';
export type StageFlowLayout = 'balanced' | 'speaker_focus' | 'preview_focus' | 'minimal_next';

export interface StageTimerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  fontScale: number;
  variant: StageTimerVariant;
  locked: boolean;
}

export interface StageAlertLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  fontScale: number;
  locked: boolean;
}

export type ConnectionRole = 'controller' | 'output' | 'stage' | 'remote';

export type StageMessageCategory = 'urgent' | 'timing' | 'logistics';
export type StageMessagePriority = 'normal' | 'high';
export type StageMessageTarget = 'stage_only';

export interface StageMessage {
  id: string;
  category: StageMessageCategory;
  text: string;
  priority: StageMessagePriority;
  target: StageMessageTarget;
  createdAt: number;
  author: string | null;
  templateKey?: string;
}

export interface StageMessageCenterState {
  queue: StageMessage[];
  activeMessageId: string | null;
  lastSentAt: number;
}

export interface SpeakerTimerPreset {
  id: string;
  name: string;
  durationSec: number;
  amberPercent: number;
  redPercent: number;
  autoStartNextDefault: boolean;
  speakerName?: string;
}

export interface RunSheetFileRecord {
  fileId: string;
  title: string;
  payload: {
    items: ServiceItem[];
    selectedItemId?: string | null;
  };
  createdByUid: string | null;
  createdByEmail: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface ServiceItem {
  id: string;
  title: string;
  type: ItemType;
  slides: Slide[];
  metadata?: ServiceItemMetadata;
  timerCue?: TimerCue;
  theme: {
    backgroundUrl: string;
    mediaType?: MediaType;
    fontFamily: string;
    textColor: string;
    shadow: boolean;
    fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  };
}

export interface Schedule {
  id: string;
  date: string;
  title: string;
  items: ServiceItem[];
}

export type ViewMode = 'BUILDER' | 'PRESENTER';

// Gemini related types
export interface GeneratedSlideData {
  slides: {
    label: string;
    content: string;
  }[];
}

export type AudienceCategory = 'qa' | 'prayer' | 'testimony' | 'poll' | 'welcome';
export type AudienceStatus = 'pending' | 'approved' | 'dismissed' | 'projected';

export interface AudienceMessage {
  id: number;
  workspace_id: string;
  category: AudienceCategory;
  text: string;
  submitter_name: string | null;
  status: AudienceStatus;
  created_at: number;
  updated_at: number;
}

export interface AudienceDisplayState {
  queue: AudienceMessage[];
  autoRotate: boolean;
  rotateSeconds: number;
  pinnedMessageId: number | null;
  tickerEnabled: boolean;
  activeMessageId: number | null;
}

export interface AudienceQrProjectionState {
  visible: boolean;
  audienceUrl: string;
  scale: number;
  updatedAt: number;
}

export interface StageAlertState {
  active: boolean;
  text: string;
  updatedAt: number;
  author: string | null;
}
