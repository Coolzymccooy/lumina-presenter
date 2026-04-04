import JSZip from 'jszip';
import type { ImportedDeck, ImportedDeckSlide } from './pptxImport';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/u, '').trim();

/**
 * Parse OpenSong XML content into an ImportedDeck.
 *
 * OpenSong XML structure:
 *   <song>
 *     <title>Amazing Grace</title>   (or attribute: <song title="...">)
 *     <lyrics>[V1]
 * Line 1 of verse
 * Line 2 of verse
 *
 * [C]
 * Chorus line 1
 *     </lyrics>
 *   </song>
 *
 * Verse markers start with '['. Lines starting with '.' are chord lines (skip).
 * Blank lines separate verses/choruses inside a single marker block.
 */
const parseOpenSongXml = (doc: Document, fileName: string): ImportedDeck => {
  const songEl = doc.querySelector('song, Song');
  if (!songEl) {
    throw new Error('No <song> element found. This does not appear to be an OpenSong file.');
  }

  // Title: child element or attribute
  const titleEl = songEl.querySelector('title, Title');
  const title =
    titleEl?.textContent?.trim() ||
    songEl.getAttribute('title') ||
    stripExtension(fileName);

  const lyricsEl = songEl.querySelector('lyrics, Lyrics');
  const rawLyrics = lyricsEl?.textContent ?? '';

  if (!rawLyrics.trim()) {
    return { title, slides: [{ label: 'Slide 1', content: '[No lyrics found]' }] };
  }

  const slides: ImportedDeckSlide[] = [];
  let currentLabel = 'Verse 1';
  let currentLines: string[] = [];
  let slideIndex = 0;

  const flushSlide = () => {
    const content = currentLines.join('\n').trim();
    if (content) {
      slides.push({ label: currentLabel, content });
    }
    currentLines = [];
  };

  const lines = rawLyrics.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Verse/section marker: [V1], [C], [B], [V2], etc.
    if (/^\s*\[/.test(line)) {
      flushSlide();
      slideIndex++;
      const marker = line.replace(/[\[\]\s]/g, '');
      currentLabel = expandMarker(marker, slideIndex);
      continue;
    }

    // Skip chord lines (start with '.')
    if (line.startsWith('.')) continue;

    // Skip comment lines (start with ';')
    if (line.startsWith(';')) continue;

    currentLines.push(line);
  }
  flushSlide();

  if (slides.length === 0) {
    return { title, slides: [{ label: 'Slide 1', content: rawLyrics.trim() }] };
  }

  return { title, slides };
};

/** Convert OpenSong abbreviated marker to a human-readable label */
const expandMarker = (marker: string, fallbackIndex: number): string => {
  const m = marker.toUpperCase();
  if (/^V\d+$/.test(m)) return `Verse ${m.slice(1)}`;
  if (m === 'C' || m === 'CH') return 'Chorus';
  if (/^C\d+$/.test(m)) return `Chorus ${m.slice(1)}`;
  if (m === 'B' || m === 'BR') return 'Bridge';
  if (/^B\d+$/.test(m)) return `Bridge ${m.slice(1)}`;
  if (m === 'T' || m === 'TAG') return 'Tag';
  if (m === 'O' || m === 'OUTRO') return 'Outro';
  if (m === 'I' || m === 'INTRO') return 'Intro';
  if (m === 'P' || m === 'PRE') return 'Pre-Chorus';
  return marker || `Part ${fallbackIndex}`;
};

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Parse an OpenSong file (.ofs, .xml, or a ZIP bundle) into an ImportedDeck.
 *
 * OpenSong songs may be:
 *  - Plain XML files (no extension, or .xml, or .ofs)
 *  - ZIP archives containing a root-level XML file with the song name
 */
export const parseOpenSongFile = async (file: File): Promise<ImportedDeck> => {
  const lowerName = file.name.toLowerCase();
  const isKnownExt =
    lowerName.endsWith('.ofs') ||
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.opensong');

  // Accept known extensions OR any file the user explicitly passes
  const buffer = await file.arrayBuffer();

  // Try ZIP first (OpenSong bundles / OpenSong 2 packages)
  try {
    const zip = await JSZip.loadAsync(buffer);
    const xmlFiles = zip.file(/\.xml$/i);
    const rootFiles = Object.values(zip.files).filter(
      (f) => !f.dir && !f.name.includes('/')
    );

    // Prefer XML files, then root-level files (OpenSong stores songs without extension)
    const candidates = [...xmlFiles, ...rootFiles].filter(
      (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i
    );

    for (const candidate of candidates) {
      const text = await candidate.async('text');
      if (!text.includes('<song') && !text.includes('<Song')) continue;
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      if (!doc.querySelector('parsererror')) {
        return parseOpenSongXml(doc, file.name);
      }
    }
  } catch {
    // Not a ZIP — fall through to raw XML
  }

  // Raw XML (most common single-song case)
  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawText, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error(
      'This file could not be parsed as OpenSong XML. ' +
      'Please export your song from OpenSong as an XML file and try again.'
    );
  }

  if (!doc.querySelector('song, Song')) {
    throw new Error(
      'No <song> element found. This does not appear to be an OpenSong file. ' +
      'Supported formats: OpenSong XML (.ofs, .xml) and OpenSong ZIP bundles.'
    );
  }

  return parseOpenSongXml(doc, file.name);
};
