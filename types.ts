
export enum ItemType {
  SONG = 'SONG',
  SCRIPTURE = 'SCRIPTURE',
  MEDIA = 'MEDIA',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  BIBLE = 'BIBLE'
}

export type MediaType = 'image' | 'video' | 'color';

export interface Slide {
  id: string;
  content: string; // The text content
  label?: string; // e.g., "Verse 1", "Chorus"
  backgroundUrl?: string; // Specific background for this slide, overrides item default
  mediaType?: MediaType; // Explicitly define type to avoid guessing
  notes?: string; // Presenter notes
}

export interface ServiceItem {
  id: string;
  title: string;
  type: ItemType;
  slides: Slide[];
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
