
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

const makeGradientBackground = (a: string, b: string, c: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${a}'/><stop offset='55%' stop-color='${b}'/><stop offset='100%' stop-color='${c}'/></linearGradient><radialGradient id='r' cx='70%' cy='20%' r='80%'><stop offset='0%' stop-color='rgba(255,255,255,0.22)'/><stop offset='100%' stop-color='rgba(255,255,255,0)'/></radialGradient></defs><rect width='1920' height='1080' fill='url(#g)'/><rect width='1920' height='1080' fill='url(#r)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const DEFAULT_BACKGROUNDS = [
  makeGradientBackground('#112240', '#1a365d', '#2d3748'),
  makeGradientBackground('#3c1053', '#ad5389', '#1e1b4b'),
  makeGradientBackground('#0b132b', '#1c2541', '#3a506b'),
  makeGradientBackground('#2f4f4f', '#3b6978', '#84a9ac'),
  makeGradientBackground('#1b4332', '#2d6a4f', '#40916c'),
  makeGradientBackground('#2c003e', '#5f0f40', '#9a031e'),
  makeGradientBackground('#1d3557', '#457b9d', '#a8dadc'),
  makeGradientBackground('#2b2d42', '#3a506b', '#5bc0be'),
  makeGradientBackground('#4a4e69', '#22223b', '#1b1b2f'),
  makeGradientBackground('#102a43', '#243b53', '#334e68'),
  makeGradientBackground('#3d0c02', '#7f1d1d', '#991b1b'),
  makeGradientBackground('#0f172a', '#1e293b', '#334155'),
];

export const VIDEO_BACKGROUNDS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"
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
