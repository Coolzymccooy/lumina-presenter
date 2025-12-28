
import { ItemType, ServiceItem } from './types';

export interface GospelTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: string;
}

export const GOSPEL_TRACKS: GospelTrack[] = [
  { id: 't1', title: "Amazing Grace (Piano)", artist: "Lumina Worship", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "6:12" },
  { id: 't2', title: "Deep Prayer Pad", artist: "Ambient Faith", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "8:45" },
  { id: 't3', title: "Great Is Thy Faithfulness", artist: "Hymnal Strings", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: "4:30" },
  { id: 't4', title: "Morning Mercy", artist: "Lumina Worship", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", duration: "5:15" },
  { id: 't5', title: "Altar Call (Soft Keys)", artist: "Ambient Faith", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", duration: "10:00" },
  { id: 't6', title: "Joyful Celebration", artist: "Orchestral Praise", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3", duration: "3:45" },
  { id: 't7', title: "Cathedral Organ Solo", artist: "Tradition Series", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3", duration: "7:20" },
  { id: 't8', title: "Peace Like A River", artist: "Acoustic Reflection", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3", duration: "5:50" },
  { id: 't9', title: "Uplifting Hope", artist: "Cinematic Worship", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3", duration: "4:15" },
  { id: 't10', title: "Holy Holy Holy (Brass)", artist: "Royal Praise", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3", duration: "3:10" },
];

export const DEFAULT_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1438232992991-995b705861de?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1518655061710-5ccf392c275a?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1532274402911-5a3b027c90be?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1920",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&q=80&w=1920",
];

export const VIDEO_BACKGROUNDS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
];

export const SOLID_COLORS = [
  "#000000", // Black
  "#1a365d", // Navy
  "#2d3748", // Dark Gray
  "#2f855a", // Dark Green
  "#742a2a", // Dark Red
  "#283e4a", // Slate Blue
  "#4a2828", // Deep Brown
];

export const MOCK_SONGS = [
  {
    title: "Amazing Grace",
    lyrics: `Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed`
  },
  {
    title: "Way Maker",
    lyrics: `You are here moving in our midst
I worship You I worship You
You are here working in this place
I worship You I worship You

Way Maker Miracle Worker Promise Keeper
Light in the darkness my God that is who You are`
  }
];

export const INITIAL_SCHEDULE: ServiceItem[] = [
  {
    id: '1',
    title: 'Welcome & Announcements',
    type: ItemType.ANNOUNCEMENT,
    theme: {
      backgroundUrl: DEFAULT_BACKGROUNDS[4],
      mediaType: 'image',
      fontFamily: 'sans-serif',
      textColor: '#ffffff',
      shadow: true,
      fontSize: 'medium'
    },
    slides: [
      { id: 's1', content: "Welcome to Sunday Service", label: "Intro" },
      { id: 's2', content: "Coffee & Fellowship in the Lobby", label: "Info" },
      { id: 's3', content: "Please silence your cell phones", label: "Alert" }
    ]
  },
  {
    id: '2',
    title: 'Amazing Grace',
    type: ItemType.SONG,
    theme: {
      backgroundUrl: DEFAULT_BACKGROUNDS[0],
      mediaType: 'image',
      fontFamily: 'serif',
      textColor: '#ffffff',
      shadow: true,
      fontSize: 'large'
    },
    slides: [
      { id: 'v1', content: "Amazing grace how sweet the sound\nThat saved a wretch like me", label: "Verse 1" },
      { id: 'v2', content: "I once was lost but now am found\nWas blind but now I see", label: "Verse 1" },
      { id: 'v3', content: "'Twas grace that taught my heart to fear\nAnd grace my fears relieved", label: "Verse 2" },
      { id: 'v4', content: "How precious did that grace appear\nThe hour I first believed", label: "Verse 2" }
    ]
  }
];
