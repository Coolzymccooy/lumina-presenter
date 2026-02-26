import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.LUMINA_VIS_CACHE_VERSION = process.env.LUMINA_VIS_CACHE_VERSION || 'v4';
process.env.LUMINA_VIS_FONTSET_VERSION = process.env.LUMINA_VIS_FONTSET_VERSION || 'f2';
process.env.LUMINA_PPTX_VIS_VIEWPORT_SCALE = process.env.LUMINA_PPTX_VIS_VIEWPORT_SCALE || '1.0';
process.env.LUMINA_PDF_RASTER_DPI = process.env.LUMINA_PDF_RASTER_DPI || '120';
process.env.LUMINA_VIS_RASTER_ENGINE = process.env.LUMINA_VIS_RASTER_ENGINE || 'auto';

if (!process.env.LUMINA_SOFFICE_BIN) {
  const scoopLibreOfficeDir = path.join(
    os.homedir(),
    'scoop',
    'apps',
    'libreoffice',
    'current',
    'LibreOffice',
    'program',
  );
  const sofficeCom = path.join(scoopLibreOfficeDir, 'soffice.com');
  const sofficeExe = path.join(scoopLibreOfficeDir, 'soffice.exe');
  if (fs.existsSync(sofficeCom)) {
    process.env.LUMINA_SOFFICE_BIN = sofficeCom;
  } else if (fs.existsSync(sofficeExe)) {
    process.env.LUMINA_SOFFICE_BIN = sofficeExe;
  }
}

await import('../server/index.js');
