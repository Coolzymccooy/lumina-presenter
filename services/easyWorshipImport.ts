import JSZip from 'jszip';
import type { ImportedDeck, ImportedDeckSlide } from './pptxImport';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/u, '').trim();

const parseXml = (xml: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
};

const findMainXmlInZip = async (zip: JSZip): Promise<string | null> => {
  const priorityNames = ['SongData.xml', 'data.xml', 'content.xml', 'song.xml'];
  for (const name of priorityNames) {
    const matches = zip.file(new RegExp(`^${name}$`, 'i'));
    if (matches.length > 0) return await matches[0].async('text');
  }
  const xmlFiles = zip.file(/\.xml$/i);
  if (xmlFiles.length > 0) return await xmlFiles[0].async('text');
  return null;
};

const extractSlidesFromXml = (doc: Document, fileName: string): ImportedDeck => {
  // EasyWorship "Songs" export format
  const songs = Array.from(doc.getElementsByTagName('Song'));
  if (songs.length > 0) {
    const song = songs[0];
    const titleEl =
      song.querySelector('Title') ??
      song.querySelector('title') ??
      song.querySelector('Name') ??
      song.querySelector('name');
    const title = titleEl?.textContent?.trim() || stripExtension(fileName);
    const slides: ImportedDeckSlide[] = [];

    const verseEls = Array.from(
      song.querySelectorAll('Verse, verse, Slide, slide, Part, part')
    );
    for (let i = 0; i < verseEls.length; i++) {
      const verse = verseEls[i];
      const captionEl =
        verse.querySelector('Caption') ??
        verse.querySelector('caption') ??
        verse.querySelector('Label') ??
        verse.querySelector('label');
      const lyricsEl =
        verse.querySelector('Lyrics') ??
        verse.querySelector('lyrics') ??
        verse.querySelector('Text') ??
        verse.querySelector('text') ??
        verse.querySelector('Content') ??
        verse.querySelector('content');
      const caption = captionEl?.textContent?.trim() || `Slide ${i + 1}`;
      const content = lyricsEl?.textContent?.trim() || verse.textContent?.trim() || '';
      if (content) {
        slides.push({ label: caption, content });
      }
    }

    if (slides.length > 0) return { title, slides };
  }

  // Generic XML fallback: collect substantive leaf-level text nodes
  const candidates = Array.from(
    doc.querySelectorAll('slide, Slide, lyric, Lyric, text, Text, verse, Verse, content, Content')
  );
  const fallbackSlides: ImportedDeckSlide[] = [];
  for (const el of candidates) {
    const hasChildElements = Array.from(el.children).length > 0;
    if (hasChildElements) continue;
    const text = el.textContent?.trim() || '';
    if (text.length > 3) {
      fallbackSlides.push({ label: `Slide ${fallbackSlides.length + 1}`, content: text });
    }
  }

  return {
    title: stripExtension(fileName),
    slides: fallbackSlides.length > 0
      ? fallbackSlides
      : [{ label: 'Slide 1', content: '[No text could be extracted from this file]' }],
  };
};

export const parseEasyWorshipFile = async (file: File): Promise<ImportedDeck> => {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.ewsx') && !lowerName.endsWith('.ewp')) {
    throw new Error('Please upload an EasyWorship .ewsx file.');
  }

  const buffer = await file.arrayBuffer();
  let xmlText: string | null = null;

  try {
    const zip = await JSZip.loadAsync(buffer);
    xmlText = await findMainXmlInZip(zip);
  } catch {
    // Not a ZIP — may be raw XML
    xmlText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }

  if (!xmlText) {
    throw new Error('Could not find content in this EasyWorship file.');
  }

  const doc = parseXml(xmlText);
  if (doc.querySelector('parsererror')) {
    throw new Error('This EasyWorship file could not be parsed. It may be corrupted.');
  }

  return extractSlidesFromXml(doc, file.name);
};
