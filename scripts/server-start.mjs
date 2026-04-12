import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Auto-heal better-sqlite3 ABI mismatch: if the native module was compiled for
// Electron (higher ABI) it won't load under system Node. Run prebuild-install to
// swap in the correct prebuilt before importing the server.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
try {
  const _require = createRequire(import.meta.url);
  _require(path.join(rootDir, 'node_modules', 'better-sqlite3'));
} catch (err) {
  if (err?.code === 'ERR_DLOPEN_FAILED' || String(err).includes('NODE_MODULE_VERSION')) {
    console.log('[server-start] better-sqlite3 ABI mismatch — fetching system-Node prebuilt...');
    const prebuildBin = path.join(rootDir, 'node_modules', 'prebuild-install', 'bin.js');
    const sqliteDir = path.join(rootDir, 'node_modules', 'better-sqlite3');
    execFileSync(process.execPath, [prebuildBin], { cwd: sqliteDir, stdio: 'inherit' });
    console.log('[server-start] better-sqlite3 prebuilt installed.');
  }
}

const loadEnvFile = (filename) => {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');

process.env.LUMINA_VIS_CACHE_VERSION = process.env.LUMINA_VIS_CACHE_VERSION || 'v4';
process.env.LUMINA_VIS_FONTSET_VERSION = process.env.LUMINA_VIS_FONTSET_VERSION || 'f2';
process.env.LUMINA_PPTX_VIS_VIEWPORT_SCALE = process.env.LUMINA_PPTX_VIS_VIEWPORT_SCALE || '1.0';
process.env.LUMINA_PDF_RASTER_DPI = process.env.LUMINA_PDF_RASTER_DPI || '120';
process.env.LUMINA_VIS_RASTER_ENGINE = process.env.LUMINA_VIS_RASTER_ENGINE || 'auto';

// If LUMINA_SOFFICE_BIN is already set (e.g. system env), resolve any NTFS
// junction or symlink to the real path so Node child_process.spawn can use it.
// If the set path doesn't exist, fall through to the candidate auto-discovery.
if (process.env.LUMINA_SOFFICE_BIN) {
  try {
    process.env.LUMINA_SOFFICE_BIN = fs.realpathSync(process.env.LUMINA_SOFFICE_BIN);
  } catch {
    // Path doesn't exist or can't be resolved — clear so candidates run below.
    delete process.env.LUMINA_SOFFICE_BIN;
  }
}

if (!process.env.LUMINA_SOFFICE_BIN) {
  // Candidate paths in priority order. Program Files is checked first because
  // Scoop installs use NTFS junction points which can fail when spawned via
  // Node.js child_process even though fs.existsSync resolves them correctly.
  const candidates = [
    // Standard Windows installer locations — prefer .exe over .com because
    // Node.js child_process.execFile cannot spawn .com files directly on
    // Windows (they need cmd.exe); .exe is a proper PE executable.
    path.join('C:\\Program Files\\LibreOffice\\program\\soffice.exe'),
    path.join('C:\\Program Files\\LibreOffice\\program\\soffice.com'),
    path.join('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'),
    path.join('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com'),
    // Scoop per-user install — resolve junctions to real versioned path
    path.join(os.homedir(), 'scoop', 'apps', 'libreoffice', 'current', 'LibreOffice', 'program', 'soffice.exe'),
    path.join(os.homedir(), 'scoop', 'apps', 'libreoffice', 'current', 'LibreOffice', 'program', 'soffice.com'),
    // macOS
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    // Linux
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        // Resolve junctions/symlinks so spawn works reliably on Windows.
        process.env.LUMINA_SOFFICE_BIN = fs.realpathSync(candidate);
      } catch {
        process.env.LUMINA_SOFFICE_BIN = candidate;
      }
      break;
    }
  }
}

await import('../server/index.js');
