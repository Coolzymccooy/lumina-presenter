import {
  ChatIcon,
  SparklesIcon,
  HelpIcon,
  HeartIcon,
  UserIcon,
} from '../Icons';
import { AudienceCategory, StageMessageCategory } from '../../types';

export const CAT_CONFIG: Record<
  AudienceCategory,
  { label: string; icon: React.ElementType; color: string; border: string; bg: string }
> = {
  qa:        { label: 'Q&A',       icon: HelpIcon,     color: 'text-blue-400',    border: 'border-blue-900/30',    bg: 'bg-blue-950/20' },
  prayer:    { label: 'Prayer',    icon: HeartIcon,    color: 'text-rose-400',    border: 'border-rose-900/30',    bg: 'bg-rose-950/20' },
  testimony: { label: 'Testimony', icon: SparklesIcon, color: 'text-purple-400',  border: 'border-purple-900/30',  bg: 'bg-purple-950/20' },
  welcome:   { label: 'Welcome',   icon: UserIcon,     color: 'text-emerald-400', border: 'border-emerald-900/30', bg: 'bg-emerald-950/20' },
  poll:      { label: 'Poll',      icon: ChatIcon,     color: 'text-amber-400',   border: 'border-amber-900/30',   bg: 'bg-amber-950/20' },
};

export const STAGE_TEMPLATES: Record<StageMessageCategory, ReadonlyArray<{ key: string; label: string }>> = {
  urgent: [
    { key: 'wrap_up_now',    label: 'Wrap up now' },
    { key: 'hold_position',  label: 'Please hold' },
    { key: 'mic_issue',      label: 'Mic issue' },
  ],
  timing: [
    { key: 'two_mins_left',  label: '2 mins left' },
    { key: 'thirty_seconds', label: '30 seconds' },
    { key: 'overtime',       label: 'Overtime' },
  ],
  logistics: [
    { key: 'move_stage_left', label: 'Move stage left' },
    { key: 'handheld_mic',    label: 'Take handheld mic' },
    { key: 'close_in_prayer', label: 'Close in prayer' },
  ],
};

export const BROADCAST_TEMPLATES: ReadonlyArray<{ key: AudienceCategory; label: string }> = [
  { key: 'welcome',   label: 'Welcome' },
  { key: 'prayer',    label: 'Prayer' },
  { key: 'qa',        label: 'Q&A' },
  { key: 'testimony', label: 'Testimony' },
  { key: 'poll',      label: 'Poll' },
];
