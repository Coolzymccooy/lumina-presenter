const GENIUS_NOISE_PATTERNS: RegExp[] = [
  /^you might also like.*$/gim,
  /^see .+ live.*$/gim,
  /^get tickets.*$/gim,
  /^tickets as low as.*$/gim,
  /^\d+\s*contributors?.*$/gim,
  /^embed$/gim,
  /^advertisement$/gim,
];

function stripParentheticalAdlibs(line: string): string {
  return line.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

function repairGluedPunctuation(text: string): string {
  return text
    .replace(/([,.!?;:])(?=[A-Z])/g, '$1\n')
    .replace(/([a-z])(?=[A-Z][a-z])/g, '$1 ');
}

function normalizeSectionHeader(raw: string): string | null {
  const inner = raw.replace(/^\[|\]$/g, '').trim();
  if (!inner) return null;
  const label = inner.split(':')[0]?.trim() || inner;
  return label;
}

export function sanitizeLyricsForSlideGeneration(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let text = input.replace(/\r\n/g, '\n');

  for (const pattern of GENIUS_NOISE_PATTERNS) {
    text = text.replace(pattern, '');
  }

  const lines = text.split('\n');
  const out: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      out.push('');
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      const label = normalizeSectionHeader(line);
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      if (label) out.push(label);
      continue;
    }
    const stripped = stripParentheticalAdlibs(line);
    if (!stripped) continue;
    out.push(repairGluedPunctuation(stripped));
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
}
