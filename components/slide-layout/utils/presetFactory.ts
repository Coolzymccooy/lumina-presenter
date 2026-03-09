import { ServiceItem, SlideElement, SlideType, TextElementStyle } from '../../../types.ts';
import { createTextElement } from './slideHydration.ts';

export const createSlideElementSet = (
  slideType: SlideType,
  layoutType: string,
  item?: ServiceItem | null,
): SlideElement[] => {
  const build = (name: string, role: SlideElement['role'], content: string, frame: SlideElement['frame'], style?: Partial<TextElementStyle>) =>
    createTextElement({ name, role, content, frame, item, style });

  switch (layoutType) {
    case 'title-body':
      return [
        build('Title', 'title', 'Slide Title', { x: 0.1, y: 0.11, width: 0.8, height: 0.12, zIndex: 1 }, { fontSize: 64 }),
        build('Body', 'body', 'Main content goes here', { x: 0.16, y: 0.32, width: 0.68, height: 0.28, zIndex: 2 }, { fontSize: 42, lineHeight: 1.12 }),
      ];
    case 'two-column':
      return [
        build('Left Column', 'body', 'Left content', { x: 0.1, y: 0.2, width: 0.32, height: 0.42, zIndex: 1 }, { textAlign: 'left', fontSize: 38 }),
        build('Right Column', 'body', 'Right content', { x: 0.58, y: 0.2, width: 0.32, height: 0.42, zIndex: 2 }, { textAlign: 'left', fontSize: 38 }),
      ];
    case 'offering-split':
      return [
        build('Offering Title', 'title', 'Offering', { x: 0.1, y: 0.1, width: 0.32, height: 0.1, zIndex: 1 }, { textAlign: 'left', fontSize: 48 }),
        build('Offering Body', 'body', 'Bank details or giving prompt', { x: 0.1, y: 0.24, width: 0.32, height: 0.28, zIndex: 2 }, { textAlign: 'left', fontSize: 30, lineHeight: 1.18 }),
        build('Project Title', 'title', 'Building Project', { x: 0.58, y: 0.1, width: 0.32, height: 0.1, zIndex: 3 }, { textAlign: 'left', fontSize: 48 }),
        build('Project Body', 'body', 'Special project details', { x: 0.58, y: 0.24, width: 0.32, height: 0.28, zIndex: 4 }, { textAlign: 'left', fontSize: 30, lineHeight: 1.18 }),
      ];
    case 'scripture-reference':
      return [
        build('Scripture Body', 'body', '"For God so loved the world..."', { x: 0.18, y: 0.28, width: 0.64, height: 0.18, zIndex: 1 }, { fontSize: 34, lineHeight: 1.18, fontStyle: 'italic' }),
        build('Reference', 'reference', 'John 3:16', { x: 0.62, y: 0.58, width: 0.24, height: 0.08, zIndex: 2 }, { textAlign: 'right', fontSize: 24, textTransform: 'uppercase', letterSpacing: 2 }),
      ];
    case 'announcement-card':
      return [
        build('Announcement Title', 'title', 'Church Announcement', { x: 0.16, y: 0.16, width: 0.68, height: 0.1, zIndex: 1 }, { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 18, padding: 18, fontSize: 46 }),
        build('Announcement Body', 'body', 'Event details go here', { x: 0.16, y: 0.34, width: 0.68, height: 0.22, zIndex: 2 }, { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 18, padding: 18, fontSize: 34, lineHeight: 1.16 }),
        build('Footer', 'footer', 'Sunday 10AM • Main Auditorium', { x: 0.18, y: 0.72, width: 0.64, height: 0.08, zIndex: 3 }, { fontSize: 24 }),
      ];
    case 'lower-third':
      return [
        build('Name', 'title', 'Speaker Name', { x: 0.08, y: 0.74, width: 0.34, height: 0.08, zIndex: 1 }, { textAlign: 'left', fontSize: 34, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 16, padding: 14 }),
        build('Title', 'subtitle', 'Senior Pastor', { x: 0.08, y: 0.83, width: 0.26, height: 0.055, zIndex: 2 }, { textAlign: 'left', fontSize: 20, backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 16, padding: 10 }),
      ];
    case 'corner-note':
      return [
        build('Main Body', 'body', 'Main slide content', { x: 0.16, y: 0.26, width: 0.68, height: 0.22, zIndex: 1 }, { fontSize: 40, lineHeight: 1.14 }),
        build('Corner Note', 'note', 'Optional corner note', { x: 0.72, y: 0.08, width: 0.18, height: 0.08, zIndex: 2 }, { textAlign: 'center', fontSize: 16 }),
      ];
    case 'single':
    default:
      return [
        build('Body', slideType === 'announcement' ? 'title' : 'body', 'Your text here', { x: 0.18, y: 0.34, width: 0.64, height: 0.14, zIndex: 1 }, { fontSize: 42 }),
      ];
  }
};
