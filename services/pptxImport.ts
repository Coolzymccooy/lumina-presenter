import JSZip from 'jszip';

export type ImportedDeckSlide = {
  label: string;
  content: string;
  notes?: string;
};

export type ImportedDeck = {
  title: string;
  slides: ImportedDeckSlide[];
};

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPT_MIME = 'application/vnd.ms-powerpoint';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/u, '').trim();

const normalizePartPath = (path: string) => {
  const chunks = path.split('/');
  const normalized: string[] = [];
  for (const chunk of chunks) {
    if (!chunk || chunk === '.') continue;
    if (chunk === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(chunk);
  }
  return normalized.join('/');
};

const resolveTargetPath = (sourcePath: string, target: string) => {
  const cleanTarget = String(target || '').trim();
  if (!cleanTarget) return '';
  if (cleanTarget.startsWith('/')) return normalizePartPath(cleanTarget.slice(1));
  const sourceDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';
  return normalizePartPath(`${sourceDir}${cleanTarget}`);
};

const parseXml = (xml: string) => {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
};

const readZipText = async (zip: JSZip, partPath: string) => {
  const file = zip.file(partPath);
  if (!file) return null;
  return await file.async('text');
};

const getParagraphText = (paragraph: Element) => {
  const pieces: string[] = [];
  const textNodes = Array.from(paragraph.getElementsByTagName('a:t'));
  for (const node of textNodes) {
    const value = node.textContent || '';
    if (value) pieces.push(value);
  }
  return pieces.join('').trim();
};

const extractTextFromSlideXml = (xml: string) => {
  const doc = parseXml(xml);
  const paragraphNodes = Array.from(doc.getElementsByTagName('a:p'));
  const lines = paragraphNodes
    .map((paragraph) => getParagraphText(paragraph))
    .filter(Boolean);

  if (lines.length) return lines.join('\n').trim();

  const textNodes = Array.from(doc.getElementsByTagName('a:t'));
  const fallback = textNodes.map((node) => (node.textContent || '').trim()).filter(Boolean).join('\n').trim();
  return fallback;
};

const getRelationshipMap = (xml: string, relFilePath: string) => {
  const doc = parseXml(xml);
  const relNodes = Array.from(doc.getElementsByTagName('Relationship'));
  const map = new Map<string, string>();

  for (const node of relNodes) {
    const id = node.getAttribute('Id') || '';
    const target = node.getAttribute('Target') || '';
    if (!id || !target) continue;
    map.set(id, resolveTargetPath(relFilePath, target));
  }
  return map;
};

const getSlideOrder = async (zip: JSZip) => {
  const presentationXml = await readZipText(zip, 'ppt/presentation.xml');
  const relsXml = await readZipText(zip, 'ppt/_rels/presentation.xml.rels');
  if (!presentationXml || !relsXml) return [];

  const relMap = getRelationshipMap(relsXml, 'ppt/_rels/presentation.xml.rels');
  const presentationDoc = parseXml(presentationXml);
  const slideIdNodes = Array.from(presentationDoc.getElementsByTagName('p:sldId'));
  const byRels = slideIdNodes
    .map((node) => node.getAttribute('r:id') || '')
    .map((rid) => relMap.get(rid) || '')
    .filter((path) => !!zip.file(path));

  return byRels;
};

const getFallbackSlides = (zip: JSZip) => {
  const names = Object.keys(zip.files)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/u.test(entry))
    .sort((left, right) => {
      const ln = Number((left.match(/slide(\d+)\.xml$/u) || [])[1] || 0);
      const rn = Number((right.match(/slide(\d+)\.xml$/u) || [])[1] || 0);
      return ln - rn;
    });
  return names;
};

const getNotesPathForSlide = async (zip: JSZip, slidePath: string) => {
  const filename = slidePath.slice(slidePath.lastIndexOf('/') + 1);
  const relPath = `ppt/slides/_rels/${filename}.rels`;
  const relXml = await readZipText(zip, relPath);
  if (!relXml) return null;
  const relMap = getRelationshipMap(relXml, relPath);
  const noteCandidate = Array.from(relMap.values()).find((path) => path.includes('/notesSlides/'));
  if (!noteCandidate || !zip.file(noteCandidate)) return null;
  return noteCandidate;
};

const assertSupportedFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  const isPptx = lowerName.endsWith('.pptx') || file.type === PPTX_MIME;
  const isPpt = lowerName.endsWith('.ppt') || file.type === PPT_MIME;
  if (isPpt) {
    throw new Error('Legacy .ppt is not supported yet. Save the file as .pptx and import again.');
  }
  if (!isPptx) {
    throw new Error('Please upload a PowerPoint .pptx file.');
  }
};

export const parsePptxFile = async (file: File): Promise<ImportedDeck> => {
  assertSupportedFile(file);

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const orderedSlides = await getSlideOrder(zip);
  const slideParts = orderedSlides.length ? orderedSlides : getFallbackSlides(zip);
  if (!slideParts.length) {
    throw new Error('Could not find slides in this file. Please confirm it is a valid .pptx.');
  }

  const slides: ImportedDeckSlide[] = [];
  for (let idx = 0; idx < slideParts.length; idx += 1) {
    const slidePath = slideParts[idx];
    const xml = await readZipText(zip, slidePath);
    if (!xml) continue;

    const content = extractTextFromSlideXml(xml).trim();
    const notesPath = await getNotesPathForSlide(zip, slidePath);
    const notesXml = notesPath ? await readZipText(zip, notesPath) : null;
    const notes = notesXml ? extractTextFromSlideXml(notesXml).trim() : '';

    slides.push({
      label: `Slide ${idx + 1}`,
      content: content || '[No text extracted from this slide]',
      ...(notes ? { notes } : {}),
    });
  }

  if (!slides.length) {
    throw new Error('No importable slide text found in this file.');
  }

  return {
    title: stripExtension(file.name) || 'Imported Presentation',
    slides,
  };
};
