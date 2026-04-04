import JSZip from 'jszip';
import type { ImportedDeck, ImportedDeckSlide } from './pptxImport';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/u, '').trim();

const parseXml = (xml: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
};

/**
 * Strip RTF control sequences to yield plain text.
 * Handles the most common PP6 RTF patterns.
 */
const stripRtf = (rtf: string): string => {
  return rtf
    .replace(/\{\\rtf[^}]*\}/g, '')   // opening rtf header group
    .replace(/\\[a-z]+\d*\s?/gi, ' ') // control words (\par, \pard, \b, \cf0, etc.)
    .replace(/\\\*/g, '')              // ignored destinations
    .replace(/[{}]/g, '')             // braces
    .replace(/\\\\/g, '\\')           // escaped backslash
    .replace(/\\~/g, '\u00a0')        // non-breaking space
    .replace(/\\'/g, "'")             // escaped quote
    .replace(/\\line\b/gi, '\n')      // line break
    .replace(/\\par\b/gi, '\n')       // paragraph break
    .replace(/\\tab\b/gi, '\t')       // tab
    .replace(/[ \t]+/g, ' ')          // collapse runs of space
    .replace(/\n{3,}/g, '\n\n')       // collapse extra blank lines
    .trim();
};

const decodeRtfData = (base64: string): string => {
  try {
    const binary = atob(base64.trim());
    return stripRtf(binary);
  } catch {
    return '';
  }
};

// ─── ProPresenter 6 ──────────────────────────────────────────────────────────

const extractSlideTextPP6 = (slideEl: Element): string => {
  const textEls = Array.from(slideEl.querySelectorAll('RVTextElement'));
  for (const el of textEls) {
    // 'source' attribute sometimes holds plain text directly
    const source = el.getAttribute('source') ?? '';
    if (source && !source.includes('{\\rtf')) {
      const cleaned = source.replace(/\\\n/g, '\n').trim();
      if (cleaned.length > 0) return cleaned;
    }
    // Try base64-encoded RTF in <RTFData> child element
    const rtfEl = el.querySelector('RTFData');
    if (rtfEl?.textContent) {
      const decoded = decodeRtfData(rtfEl.textContent);
      if (decoded.trim()) return decoded.trim();
    }
  }
  return '';
};

const parsePP6Xml = (doc: Document, fileName: string): ImportedDeck => {
  const root = doc.documentElement;
  const title = root.getAttribute('name') || stripExtension(fileName);
  const slides: ImportedDeckSlide[] = [];

  const slideEls = Array.from(doc.getElementsByTagName('RVDisplaySlide'));
  for (let i = 0; i < slideEls.length; i++) {
    const slideEl = slideEls[i];
    const label = slideEl.getAttribute('label') || `Slide ${i + 1}`;
    const notes = slideEl.getAttribute('notes') || '';
    const content = extractSlideTextPP6(slideEl) || `[Slide ${i + 1}]`;
    slides.push({
      label: label || `Slide ${i + 1}`,
      content,
      ...(notes ? { notes } : {}),
    });
  }

  if (!slides.length) {
    throw new Error('No slides found in this ProPresenter 6 file.');
  }
  return { title, slides };
};

// ─── ProPresenter 7 ──────────────────────────────────────────────────────────

const extractSlideTextPP7 = (slideEl: Element): string => {
  const pieces: string[] = [];
  // PP7 text lives in <textElement><textBody><string> or similar
  const textBodyEls = Array.from(slideEl.querySelectorAll('textBody, textElement, string'));
  for (const el of textBodyEls) {
    const val =
      el.textContent?.trim() ||
      el.getAttribute('textContent') ||
      el.getAttribute('content') ||
      '';
    if (val) pieces.push(val);
  }
  return pieces.join('\n').trim();
};

const parsePP7Xml = (doc: Document, fileName: string): ImportedDeck => {
  const root = doc.documentElement;
  const title = root.getAttribute('name') || stripExtension(fileName);
  const slides: ImportedDeckSlide[] = [];

  const slideEls = Array.from(doc.querySelectorAll('slide'));
  for (let i = 0; i < slideEls.length; i++) {
    const slideEl = slideEls[i];
    const label = slideEl.getAttribute('label') || `Slide ${i + 1}`;
    const notes = slideEl.getAttribute('notes') || '';
    const content = extractSlideTextPP7(slideEl) || `[Slide ${i + 1}]`;
    slides.push({
      label: label || `Slide ${i + 1}`,
      content,
      ...(notes ? { notes } : {}),
    });
  }

  // If PP7 parsing found nothing, fall back to PP6 element names
  if (!slides.length) {
    return parsePP6Xml(doc, fileName);
  }
  return { title, slides };
};

// ─── Public entry point ───────────────────────────────────────────────────────

export const parseProPresenterFile = async (file: File): Promise<ImportedDeck> => {
  const lowerName = file.name.toLowerCase();
  const isPro6 = lowerName.endsWith('.pro6') || lowerName.endsWith('.pro6x');
  const isPro7 = lowerName.endsWith('.pro');

  if (!isPro6 && !isPro7) {
    throw new Error('Please upload a ProPresenter .pro6 or .pro file.');
  }

  const buffer = await file.arrayBuffer();

  if (isPro6) {
    // PP6 is always raw XML
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const doc = parseXml(rawText);
    if (doc.querySelector('parsererror')) {
      throw new Error('This ProPresenter 6 file could not be parsed. It may be corrupted.');
    }
    return parsePP6Xml(doc, file.name);
  }

  // PP7 .pro: try as ZIP (contains presentation.xml), then fall back to raw XML
  try {
    const zip = await JSZip.loadAsync(buffer);
    const candidates = [
      zip.file('presentation.xml'),
      ...(zip.file(/presentation\.xml$/i) ?? []),
    ].filter(Boolean) as JSZip.JSZipObject[];

    if (candidates.length > 0) {
      const xmlText = await candidates[0].async('text');
      const doc = parseXml(xmlText);
      if (!doc.querySelector('parsererror')) {
        return parsePP7Xml(doc, file.name);
      }
    }
  } catch {
    // Not a valid ZIP — try raw XML below
  }

  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const doc = parseXml(rawText);
  if (doc.querySelector('parsererror')) {
    throw new Error(
      'This ProPresenter 7 file format is not supported. ' +
      'In ProPresenter, go to File → Export → ProPresenter 6 and import the .pro6 file instead.'
    );
  }
  return parsePP6Xml(doc, file.name);
};
