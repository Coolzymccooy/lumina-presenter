import express from "express";
import cors from "cors";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { createLyricsRouter } from './routes/lyrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requestedDataDir = process.env.LUMINA_DATA_DIR
  ? path.resolve(process.env.LUMINA_DATA_DIR)
  : path.join(__dirname, "data");
const requestedDbPath = process.env.LUMINA_DB_PATH
  ? path.resolve(process.env.LUMINA_DB_PATH)
  : path.join(requestedDataDir, "lumina.sqlite");
const PORT = Number(process.env.PORT || process.env.LUMINA_API_PORT || 8787);
const JSON_LIMIT = process.env.LUMINA_JSON_LIMIT || "100mb";
const SOFFICE_BIN = String(process.env.LUMINA_SOFFICE_BIN || "soffice").trim() || "soffice";
const PDFTOCAIRO_BIN = String(process.env.LUMINA_PDFTOCAIRO_BIN || "pdftocairo").trim() || "pdftocairo";
const PPTX_CONVERT_TIMEOUT_MS = Number(process.env.LUMINA_PPTX_CONVERT_TIMEOUT_MS || 180000);
const MAX_PPTX_IMPORT_BYTES = Number(process.env.LUMINA_MAX_PPTX_IMPORT_BYTES || 80 * 1024 * 1024);
const PPTX_VIS_VIEWPORT_SCALE = Math.max(1, Number(process.env.LUMINA_PPTX_VIS_VIEWPORT_SCALE || 1.0) || 1.0);
const PPTX_VIS_PARALLEL = String(process.env.LUMINA_PPTX_VIS_PARALLEL || "true").toLowerCase() !== "false";
const PPTX_VIS_INCLUDE_BASE64_DEFAULT =
  String(process.env.LUMINA_PPTX_VIS_INCLUDE_BASE64 || "false").toLowerCase() === "true";
const PPTX_VIS_FONTSET_VERSION = String(process.env.LUMINA_VIS_FONTSET_VERSION || "f1").trim() || "f1";
const PPTX_VIS_RASTER_ENGINE = (() => {
  const raw = String(process.env.LUMINA_VIS_RASTER_ENGINE || "auto").trim().toLowerCase();
  if (raw === "poppler" || raw === "pdfjs" || raw === "auto") return raw;
  return "auto";
})();
const PPTX_VIS_RENDERER_DEFAULT = PPTX_VIS_RASTER_ENGINE === "pdfjs" ? "pdfjs-fallback" : "poppler";
const PPTX_PDF_RASTER_DPI = Math.max(72, Number(process.env.LUMINA_PDF_RASTER_DPI || 120) || 120);
const PPTX_VIS_CACHE_VERSION = (() => {
  const safe = String(process.env.LUMINA_VIS_CACHE_VERSION || "v4").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "v4";
})();
const PEXELS_API_KEY = String(process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY || "").trim();
const PEXELS_API_BASE_URL = "https://api.pexels.com/videos/search";
const SCRIPTURE_API_BIBLE_KEY = String(process.env.SCRIPTURE_API_BIBLE_KEY || "").trim();
const SCRIPTURE_API_BASE_URL = "https://rest.api.bible/v1";

// Translation ID map: Lumina translation code → API.Bible Bible ID.
// NIV, NKJV, NLT are the 3 copyrighted translations active on the free-tier account.
// ESV, AMP, MSG are not available on this account — leave as "" to trigger KJV fallback.
const APIBIBLE_TRANSLATION_IDS = {
  niv:  "78a9f6124f344018-01",
  nkjv: "63097d2a0a2f7db3-01",
  esv:  "",
  nlt:  "d6e14a625393b4da-01",
  amp:  "",
  msg:  "",
};

// OSIS book ID map — converts Lumina canonical book names to API.Bible passage IDs.
const OSIS_BOOK_IDS = {
  "Genesis":"GEN","Exodus":"EXO","Leviticus":"LEV","Numbers":"NUM","Deuteronomy":"DEU",
  "Joshua":"JOS","Judges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA",
  "1 Kings":"1KI","2 Kings":"2KI","1 Chronicles":"1CH","2 Chronicles":"2CH",
  "Ezra":"EZR","Nehemiah":"NEH","Esther":"EST","Job":"JOB","Psalms":"PSA",
  "Proverbs":"PRO","Ecclesiastes":"ECC","Song of Solomon":"SNG","Isaiah":"ISA",
  "Jeremiah":"JER","Lamentations":"LAM","Ezekiel":"EZK","Daniel":"DAN",
  "Hosea":"HOS","Joel":"JOL","Amos":"AMO","Obadiah":"OBA","Jonah":"JON",
  "Micah":"MIC","Nahum":"NAM","Habakkuk":"HAB","Zephaniah":"ZEP","Haggai":"HAG",
  "Zechariah":"ZEC","Malachi":"MAL","Matthew":"MAT","Mark":"MRK","Luke":"LUK",
  "John":"JHN","Acts":"ACT","Romans":"ROM","1 Corinthians":"1CO","2 Corinthians":"2CO",
  "Galatians":"GAL","Ephesians":"EPH","Philippians":"PHP","Colossians":"COL",
  "1 Thessalonians":"1TH","2 Thessalonians":"2TH","1 Timothy":"1TI","2 Timothy":"2TI",
  "Titus":"TIT","Philemon":"PHM","Hebrews":"HEB","James":"JAS","1 Peter":"1PE",
  "2 Peter":"2PE","1 John":"1JN","2 John":"2JN","3 John":"3JN","Jude":"JUD",
  "Revelation":"REV",
};
const PEXELS_QUERY_MAX_LENGTH = 120;
const PEXELS_DEFAULT_PER_PAGE = 12;
const PEXELS_MAX_PER_PAGE = 24;
const PEXELS_CACHE_TTL_MS = 10 * 60 * 1000;
const execFileAsync = promisify(execFile);
let sofficeVersionLine = "unknown";
let pdftocairoVersionLine = "unknown";
let cachedPdfToPng = null;
let cachedPdfToPngLoadError = null;
const PEXELS_SEARCH_CACHE = new Map();

function buildApiBiblePassageId(normalizedRef) {
  const matchFull = normalizedRef.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!matchFull) return null;
  const [, bookName, chapter, verseFrom, verseTo] = matchFull;
  const osisBook = OSIS_BOOK_IDS[bookName];
  if (!osisBook) return null;
  if (!verseFrom) {
    return `${osisBook}.${chapter}`;
  }
  const start = `${osisBook}.${chapter}.${verseFrom}`;
  const end = verseTo ? `${osisBook}.${chapter}.${verseTo}` : start;
  return start === end ? start : `${start}-${end}`;
}

function parseApiBiblePassageText(rawContent, bookName, chapter, verseFrom, verseTo) {
  const clean = String(rawContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const safeFrom = Number(verseFrom) || 1;
  const safeTo = Number(verseTo) || safeFrom;

  if (safeFrom === safeTo) {
    return [{
      book_name: bookName,
      book_id: bookName.toLowerCase().replace(/\s+/g, ""),
      chapter: Number(chapter),
      verse: safeFrom,
      text: clean.replace(/^\[\d+\]\s*/, "").trim(),
    }];
  }

  const verses = [];
  const parts = clean.split(/\[(\d+)\]\s*/);
  for (let i = 1; i < parts.length - 1; i += 2) {
    const verseNum = Number(parts[i]);
    const text = String(parts[i + 1] || "").trim();
    if (verseNum >= safeFrom && verseNum <= safeTo && text) {
      verses.push({
        book_name: bookName,
        book_id: bookName.toLowerCase().replace(/\s+/g, ""),
        chapter: Number(chapter),
        verse: verseNum,
        text,
      });
    }
  }
  return verses.length ? verses : [{
    book_name: bookName,
    book_id: bookName.toLowerCase().replace(/\s+/g, ""),
    chapter: Number(chapter),
    verse: safeFrom,
    text: clean,
  }];
}

const loadPdfToPngConverter = async () => {
  if (typeof cachedPdfToPng === "function") return cachedPdfToPng;
  if (cachedPdfToPngLoadError) throw cachedPdfToPngLoadError;
  try {
    const mod = await import("pdf-to-png-converter");
    if (typeof mod?.pdfToPng !== "function") {
      throw new Error("pdf-to-png-converter did not export pdfToPng.");
    }
    cachedPdfToPng = mod.pdfToPng;
    return cachedPdfToPng;
  } catch (error) {
    cachedPdfToPngLoadError = error;
    throw error;
  }
};

const firstNonEmptyLine = (input) =>
  String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";

const normalizePexelsQuery = (input) => {
  const compact = String(input || "").replace(/\s+/g, " ").trim();
  return compact.slice(0, PEXELS_QUERY_MAX_LENGTH) || "worship background";
};

const normalizePexelsPerPage = (input) => {
  const value = Number(input);
  if (!Number.isFinite(value)) return PEXELS_DEFAULT_PER_PAGE;
  return Math.max(1, Math.min(PEXELS_MAX_PER_PAGE, Math.round(value)));
};

const pickBestPexelsVideoUrl = (files) => {
  if (!Array.isArray(files) || !files.length) return null;
  const mp4 = files.filter((file) => String(file?.file_type || "").toLowerCase().includes("mp4"));
  const pool = mp4.length ? mp4 : files;
  const preferred = pool
    .filter((entry) => {
      const width = Number(entry?.width) || 0;
      return width > 0 && width <= 1920;
    })
    .sort((left, right) => {
      const leftWidth = Number(left?.width) || 0;
      const rightWidth = Number(right?.width) || 0;
      return Math.abs(1280 - leftWidth) - Math.abs(1280 - rightWidth);
    });
  const candidate = preferred[0] || pool[0];
  return candidate?.link || candidate?.url || null;
};

const mapPexelsVideos = (videos) => (
  Array.isArray(videos)
    ? videos
      .map((video, idx) => ({
        id: `pexels-${video?.id || idx}`,
        name: String(video?.user?.name || `Pexels #${video?.id || idx}`),
        thumb: String(video?.image || ""),
        url: pickBestPexelsVideoUrl(video?.video_files || []),
        mediaType: "video",
        provider: "pexels",
        attribution: String(video?.url || "Pexels"),
      }))
      .filter((entry) => entry.url)
    : []
);

const logSofficeAvailability = async () => {
  try {
    const result = await execFileAsync(SOFFICE_BIN, ["--version"], {
      timeout: 7000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    sofficeVersionLine = firstNonEmptyLine(result?.stdout || result?.stderr) || "version unknown";
    console.log(`[lumina-server-api] soffice: available (${sofficeVersionLine})`);
  } catch (error) {
    sofficeVersionLine = "missing";
    console.warn(`[lumina-server-api] warning: soffice not found at '${SOFFICE_BIN}'. Visual PPTX import will return 503.`);
    if (error?.code && error?.code !== "ENOENT") {
      console.warn(`[lumina-server-api] warning: soffice version probe failed (${String(error.code)})`);
    }
  }
};

const logPdftocairoAvailability = async () => {
  try {
    const result = await execFileAsync(PDFTOCAIRO_BIN, ["-v"], {
      timeout: 7000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    pdftocairoVersionLine = firstNonEmptyLine(result?.stdout || result?.stderr) || "version unknown";
    console.log(`[lumina-server-api] pdftocairo: available (${pdftocairoVersionLine})`);
  } catch (error) {
    pdftocairoVersionLine = "missing";
    console.warn(`[lumina-server-api] warning: pdftocairo not found at '${PDFTOCAIRO_BIN}'. Falling back to pdfjs renderer for VIS.`);
    if (error?.code && error?.code !== "ENOENT") {
      console.warn(`[lumina-server-api] warning: pdftocairo version probe failed (${String(error.code)})`);
    }
  }
};

const logFontDiagnostics = async () => {
  try {
    const result = await execFileAsync("fc-list", [":", "family"], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    const haystack = String(result?.stdout || "").toLowerCase();
    const families = ["carlito", "caladea", "liberation", "noto", "unifont", "dejavu"];
    const statuses = families.map((family) => `${family}:${haystack.includes(family) ? "yes" : "no"}`);
    console.log(`[lumina-server-api] fonts: ${statuses.join(" ")}`);
  } catch (error) {
    console.warn(`[lumina-server-api] warning: font probe skipped (fc-list unavailable: ${String(error?.code || error?.message || "unknown")})`);
  }
};

const resolveWritableDbPath = (candidatePath) => {
  const filename = path.basename(candidatePath) || "lumina.sqlite";
  try {
    const dir = path.dirname(candidatePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return { dbPath: candidatePath, usedFallback: false };
  } catch {
    const fallbackDir = path.join(os.tmpdir(), "lumina-data");
    fs.mkdirSync(fallbackDir, { recursive: true });
    return { dbPath: path.join(fallbackDir, filename), usedFallback: true };
  }
};

const { dbPath: DB_PATH, usedFallback: USED_EPHEMERAL_FALLBACK } = resolveWritableDbPath(requestedDbPath);
const DATA_DIR = path.dirname(DB_PATH);
const VIS_MEDIA_DIR = process.env.LUMINA_VIS_MEDIA_DIR
  ? path.resolve(process.env.LUMINA_VIS_MEDIA_DIR)
  : path.join(DATA_DIR, "vis-media");
const WORKSPACE_MEDIA_DIR = process.env.LUMINA_WORKSPACE_MEDIA_DIR
  ? path.resolve(process.env.LUMINA_WORKSPACE_MEDIA_DIR)
  : path.join(DATA_DIR, "workspace-media");
const SERMON_PROCESSING_AUDIO_DIR = process.env.LUMINA_SERMON_PROCESSING_AUDIO_DIR
  ? path.resolve(process.env.LUMINA_SERMON_PROCESSING_AUDIO_DIR)
  : path.join(DATA_DIR, "sermon-processing");
const VIS_MEDIA_BASE_PATH = (() => {
  const raw = String(process.env.LUMINA_VIS_MEDIA_BASE_PATH || "/media/vis").trim();
  const normalized = `/${raw.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? "/media/vis" : normalized;
})();
const WORKSPACE_MEDIA_BASE_PATH = (() => {
  const raw = String(process.env.LUMINA_WORKSPACE_MEDIA_BASE_PATH || "/media/workspaces").trim();
  const normalized = `/${raw.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? "/media/workspaces" : normalized;
})();
const VIS_MEDIA_KEEP_IMPORTS_PER_WORKSPACE = Math.max(
  1,
  Number(process.env.LUMINA_VIS_MEDIA_KEEP_IMPORTS_PER_WORKSPACE || 20) || 20,
);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  owner_email TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings_updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_by_uid TEXT NOT NULL,
  created_by_email TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(workspace_id, version),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  version INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(workspace_id, session_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_connections (
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  role TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(workspace_id, session_id, client_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  session_id TEXT,
  actor_uid TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audience_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'qa',
  text TEXT NOT NULL,
  submitter_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_runsheet_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by_uid TEXT,
  created_by_email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS macro_webhook_triggers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  triggered_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sermon_summaries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sermon_processing_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default-workspace',
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT,
  retry_after_ms INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  accent_hint TEXT NOT NULL DEFAULT 'standard',
  locale TEXT NOT NULL DEFAULT 'en-US',
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  audio_file_path TEXT,
  transcript TEXT,
  summary_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_time ON audit_logs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_workspace_time ON workspace_snapshots(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audience_workspace_time ON audience_messages(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_connections_workspace_session_seen ON session_connections(workspace_id, session_id, last_seen_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runsheet_workspace_file_unique ON workspace_runsheet_files(workspace_id, file_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_workspace_updated ON workspace_runsheet_files(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_workspace_time ON sermon_summaries(workspace_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermon_jobs_status_retry ON sermon_processing_jobs(status, next_retry_at, created_at);

CREATE TABLE IF NOT EXISTS workspace_ccli_credentials (
  workspace_id TEXT PRIMARY KEY,
  license_number TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_enc TEXT NOT NULL,
  enc_iv TEXT NOT NULL,
  enc_tag TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS revoked_users (
  uid TEXT PRIMARY KEY,
  reason TEXT,
  revoked_at INTEGER NOT NULL
);
`);

const ensureColumnExists = (tableName, columnName, definitionSql, backfillSql = null) => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((entry) => String(entry?.name || "").toLowerCase() === columnName.toLowerCase());
  if (exists) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
  if (backfillSql) db.exec(backfillSql);
};

ensureColumnExists(
  "workspaces",
  "settings_updated_at",
  "INTEGER NOT NULL DEFAULT 0",
  "UPDATE workspaces SET settings_updated_at = updated_at WHERE settings_updated_at IS NULL OR settings_updated_at = 0",
);
db.prepare(`
  UPDATE sermon_processing_jobs
  SET status = 'queued',
      phase = 'queued',
      updated_at = ?,
      next_retry_at = COALESCE(next_retry_at, ?),
      error = CASE
        WHEN status = 'processing' THEN COALESCE(error, 'Server restarted while processing. Retrying automatically.')
        ELSE error
      END
  WHERE status IN ('processing')
`).run(Date.now(), Date.now() + 5000);

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));
app.use('/api/lyrics', createLyricsRouter());
fs.mkdirSync(VIS_MEDIA_DIR, { recursive: true });
fs.mkdirSync(WORKSPACE_MEDIA_DIR, { recursive: true });
fs.mkdirSync(SERMON_PROCESSING_AUDIO_DIR, { recursive: true });
const audienceMessageStreamClients = new Map();

const getAudienceStreamBucket = (workspaceId) => {
  const key = String(workspaceId || "").trim() || "default-workspace";
  const existing = audienceMessageStreamClients.get(key);
  if (existing) return existing;
  const created = new Set();
  audienceMessageStreamClients.set(key, created);
  return created;
};

const writeAudienceStreamEvent = (res, event, payload) => {
  if (!res || res.writableEnded) return;
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // best effort for disconnected clients
  }
};

const broadcastAudienceMessageEvent = (workspaceId, payload) => {
  const bucket = audienceMessageStreamClients.get(String(workspaceId || "").trim() || "default-workspace");
  if (!bucket || !bucket.size) return;
  const message = {
    workspaceId,
    updatedAt: now(),
    ...payload,
  };
  for (const res of bucket) {
    if (!res || res.writableEnded) continue;
    writeAudienceStreamEvent(res, "audience-message", message);
  }
};

app.use(
  VIS_MEDIA_BASE_PATH,
  express.static(VIS_MEDIA_DIR, { index: false, fallthrough: false }),
);
app.use(
  WORKSPACE_MEDIA_BASE_PATH,
  express.static(WORKSPACE_MEDIA_DIR, { index: false, fallthrough: false }),
);

const now = () => Date.now();

// ── Secret encryption (AES-256-GCM) ──────────────────────────────────────────
// Used to encrypt CCLI client secrets at rest. Key is derived from an env var
// so that even a DB dump cannot be used to recover secrets without the key.
const CCLI_ENCRYPTION_PASSPHRASE = String(process.env.CCLI_ENCRYPTION_KEY || "").trim();
const CCLI_ENCRYPTION_AVAILABLE = CCLI_ENCRYPTION_PASSPHRASE.length >= 16;
const CCLI_ENCRYPTION_KEY = CCLI_ENCRYPTION_AVAILABLE
  ? scryptSync(CCLI_ENCRYPTION_PASSPHRASE, "lumina-ccli-v1", 32)
  : null;

const encryptSecret = (plaintext) => {
  if (!CCLI_ENCRYPTION_KEY) throw new Error("CCLI_ENCRYPTION_KEY not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", CCLI_ENCRYPTION_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: enc.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
};

const decryptSecret = (ciphertextB64, ivB64, tagB64) => {
  if (!CCLI_ENCRYPTION_KEY) throw new Error("CCLI_ENCRYPTION_KEY not configured");
  const decipher = createDecipheriv("aes-256-gcm", CCLI_ENCRYPTION_KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
};
const parseJson = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const toJson = (value) => JSON.stringify(value ?? {});
const cleanupDir = (dirPath) => {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
};
const sanitizeFilename = (name, fallback = "import.pptx") => {
  const safe = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || fallback;
};
const inferExtensionFromMimeType = (mimeType) => {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "video/mp4") return ".mp4";
  if (normalized === "video/webm") return ".webm";
  if (normalized === "video/quicktime") return ".mov";
  return "";
};
const sanitizePathSegment = (name, fallback = "item") => {
  const safe = String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || fallback;
};
const decodeBase64 = (raw) => {
  if (!raw || typeof raw !== "string") return Buffer.alloc(0);
  const clean = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  return Buffer.from(clean, "base64");
};
const getRequestOrigin = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = forwardedHost || String(req.get("host") || "").trim();
  if (!host) return `http://localhost:${PORT}`;
  return `${proto}://${host}`;
};
const parseBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};
/**
 * Extract a short, human-readable message from a Gemini SDK error.
 * The SDK embeds the full JSON response body as the error message string.
 */
const extractGeminiErrorMessage = (error) => {
  const raw = String(error?.message || error || "Unknown error");
  // If it looks like a JSON blob, try to pull out the nested message field
  if (raw.includes('"message"') || raw.startsWith("{")) {
    try {
      const start = raw.indexOf("{");
      const parsed = JSON.parse(raw.slice(start));
      const msg = parsed?.error?.message || parsed?.message;
      if (msg && typeof msg === "string") {
        // Trim at the first newline and cap at 120 chars
        const clean = msg.split("\n")[0].trim();
        return clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
      }
    } catch {
      // Not valid JSON after all — fall through
    }
  }
  const firstLine = raw.split("\n")[0].trim();
  return firstLine.length > 120 ? firstLine.slice(0, 120) + "…" : firstLine;
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isGeminiQuotaError = (error) => {
  const raw = String(error?.message || error || "");
  return raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429") || raw.toLowerCase().includes("quota");
};

const runWithGeminiQuotaRetry = async (task, options = {}) => {
  const retries = Number.isFinite(options.retries) ? options.retries : 1;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 8000;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isGeminiQuotaError(error)) {
        throw error;
      }
      await waitMs(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error("Gemini request failed.");
};

const parseGeminiErrorJson = (error) => {
  const raw = String(error?.message || error || "").trim();
  if (!raw) return null;
  const start = raw.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
};

const parseRetryDelayToMs = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const secondsMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (secondsMatch) return Math.max(0, Math.round(Number(secondsMatch[1]) * 1000));
  const numberValue = Number(raw);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0;
};

const extractGeminiRetryAfterMs = (error) => {
  const parsed = parseGeminiErrorJson(error);
  const details = Array.isArray(parsed?.error?.details) ? parsed.error.details : [];
  const retryInfo = details.find((entry) => String(entry?.["@type"] || "").includes("RetryInfo"));
  const structuredDelay = parseRetryDelayToMs(retryInfo?.retryDelay);
  if (structuredDelay > 0) return structuredDelay;

  const raw = String(error?.message || error || "");
  const retryMatch = raw.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (retryMatch) return Math.max(0, Math.round(Number(retryMatch[1]) * 1000));
  return 0;
};

const inferSermonAudioExtension = (mimeType) => {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (normalized.includes("mp4")) return ".mp4";
  if (normalized.includes("wav")) return ".wav";
  return ".webm";
};

const moveFileSafely = (sourcePath, targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch {
    fs.copyFileSync(sourcePath, targetPath);
    try { fs.unlinkSync(sourcePath); } catch { /* ignore */ }
  }
};

const parseBase64Payload = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const commaIdx = raw.indexOf(",");
  return commaIdx >= 0 ? raw.slice(commaIdx + 1).trim() : raw;
};
const cachedGoogleAiClients = new Map();
const resolveGoogleAiKey = () => (
  String(
    process.env.GOOGLE_AI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.VITE_GOOGLE_AI_API_KEY
    || "",
  ).trim()
);
const resolveSermonGoogleAiKey = () => (
  String(
    process.env.GOOGLE_AI_SERMON_API_KEY
    || process.env.GOOGLE_AI_SERMON_KEY
    || process.env.GEMINI_SERMON_API_KEY
    || process.env.GEMINI_SERMON_KEY
    || resolveGoogleAiKey()
    || "",
  ).trim()
);
const getGoogleAiClientForKey = (key) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;
  if (cachedGoogleAiClients.has(normalizedKey)) return cachedGoogleAiClients.get(normalizedKey);
  const client = new GoogleGenAI({ apiKey: normalizedKey });
  cachedGoogleAiClients.set(normalizedKey, client);
  return client;
};
const getGoogleAiClient = () => {
  return getGoogleAiClientForKey(resolveGoogleAiKey());
};
const getSermonGoogleAiClient = () => {
  return getGoogleAiClientForKey(resolveSermonGoogleAiKey());
};
const ensureGoogleAiClient = (res, options = {}) => {
  const scope = options?.scope === "sermon" ? "sermon" : "general";
  const ai = scope === "sermon" ? getSermonGoogleAiClient() : getGoogleAiClient();
  if (ai) return ai;
  res.status(503).json({
    ok: false,
    error: "AI_KEY_MISSING",
    message: scope === "sermon"
      ? "Missing sermon AI key on server. Set GOOGLE_AI_SERMON_API_KEY (or GOOGLE_AI_API_KEY / GEMINI_API_KEY)."
      : "Missing AI key on server. Set GOOGLE_AI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY).",
  });
  return null;
};
const parseAiJson = (response) => {
  const raw = String(response?.text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const sanitizeSlides = (slides) => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((entry, idx) => ({
      label: String(entry?.label || `Slide ${idx + 1}`).trim().slice(0, 80) || `Slide ${idx + 1}`,
      content: String(entry?.content || "").trim().slice(0, 1200),
    }))
    .filter((entry) => entry.content.length > 0);
};
const fallbackSermonAnalysis = (sermonText) => {
  const scriptureRegex = /\b(?:[1-3]\s)?[A-Za-z]+\s\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;
  const references = Array.from(new Set((String(sermonText || "").match(scriptureRegex) || []).slice(0, 12)));
  const paragraphs = String(sermonText || "")
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
  const keyPoints = paragraphs.slice(0, 8).map((part, index) => {
    const compact = part.replace(/\s+/g, " ").trim();
    return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact || `Point ${index + 1}`;
  });
  const fallbackSlides = Array.from({ length: 20 }).map((_, idx) => ({
    label: idx === 0 ? "Title" : idx <= references.length ? `Scripture ${idx}` : `Point ${idx}`,
    content: idx === 0
      ? "Sermon Overview"
      : idx <= references.length
        ? references[idx - 1]
        : keyPoints[(idx - 1) % Math.max(keyPoints.length, 1)] || `Key takeaway ${idx}`,
  }));
  return {
    scriptureReferences: references,
    keyPoints,
    slides: fallbackSlides,
  };
};
const formatExecErrorDetails = (error) => {
  const code = error?.code ? `code=${String(error.code)}` : "";
  const signal = error?.signal ? `signal=${String(error.signal)}` : "";
  const stdout = firstNonEmptyLine(error?.stdout || "");
  const stderr = firstNonEmptyLine(error?.stderr || "");
  const msg = firstNonEmptyLine(error?.message || "");
  return [code, signal, stderr && `stderr=${stderr}`, stdout && `stdout=${stdout}`, msg && `msg=${msg}`]
    .filter(Boolean)
    .join(" ");
};
const parsePngDimensions = (content) => {
  if (!Buffer.isBuffer(content) || content.length < 24) return { width: 0, height: 0 };
  const isPng = content.readUInt32BE(0) === 0x89504e47 && content.readUInt32BE(4) === 0x0d0a1a0a;
  if (!isPng) return { width: 0, height: 0 };
  return {
    width: Number(content.readUInt32BE(16) || 0),
    height: Number(content.readUInt32BE(20) || 0),
  };
};
const renderPdfToPngWithPoppler = async (pdfPath, outDir, dpi) => {
  const prefix = path.join(outDir, "slide");
  await execFileAsync(
    PDFTOCAIRO_BIN,
    ["-png", "-r", String(dpi), pdfPath, prefix],
    {
      timeout: PPTX_CONVERT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const prefixBase = path.basename(prefix);
  const pages = fs
    .readdirSync(outDir)
    .filter((entry) => entry.startsWith(`${prefixBase}-`) && entry.toLowerCase().endsWith(".png"))
    .map((entry) => {
      const match = entry.match(/-(\d+)\.png$/i);
      const pageNumber = Number(match?.[1] || 0);
      return { entry, pageNumber };
    })
    .filter((entry) => entry.pageNumber > 0)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map(({ entry, pageNumber }) => {
      const content = fs.readFileSync(path.join(outDir, entry));
      const dims = parsePngDimensions(content);
      return {
        pageNumber,
        name: entry,
        content,
        width: dims.width,
        height: dims.height,
      };
    });
  return pages;
};
const renderPdfToPngWithPdfJs = async (pdfPath) => {
  const convertPdfToPng = await loadPdfToPngConverter();
  return await convertPdfToPng(pdfPath, {
    viewportScale: PPTX_VIS_VIEWPORT_SCALE,
    disableFontFace: false,
    useSystemFonts: true,
    returnPageContent: true,
    processPagesInParallel: PPTX_VIS_PARALLEL,
    verbosityLevel: 0,
  });
};
const getVisualRenderSignature = () => {
  const raw = [
    `cache=${PPTX_VIS_CACHE_VERSION}`,
    `fontset=${PPTX_VIS_FONTSET_VERSION}`,
    `soffice=${sofficeVersionLine || "unknown"}`,
    `pdftocairo=${pdftocairoVersionLine || "unknown"}`,
    `engine=${PPTX_VIS_RASTER_ENGINE}`,
    `dpi=${PPTX_PDF_RASTER_DPI}`,
    `scale=${PPTX_VIS_VIEWPORT_SCALE}`,
  ].join("|");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return { raw, hash };
};
const pruneWorkspaceVisualImports = (workspaceSegment) => {
  try {
    const workspaceDir = path.join(VIS_MEDIA_DIR, workspaceSegment);
    if (!fs.existsSync(workspaceDir)) return;
    const folders = fs
      .readdirSync(workspaceDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const fullPath = path.join(workspaceDir, entry.name);
        const stats = fs.statSync(fullPath);
        return { name: entry.name, fullPath, mtimeMs: Number(stats.mtimeMs || 0) };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    folders
      .slice(VIS_MEDIA_KEEP_IMPORTS_PER_WORKSPACE)
      .forEach((entry) => cleanupDir(entry.fullPath));
  } catch {
    // best effort cleanup
  }
};

const normalizeEmails = (raw = "") =>
  String(raw)
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .map((entry) => entry.split(/[:|]/)[0]?.trim())
    .filter(Boolean);

const toRunSheetFileRecord = (row) => ({
  fileId: row.file_id,
  title: row.title,
  payload: parseJson(row.payload_json, { items: [] }),
  createdByUid: row.created_by_uid || null,
  createdByEmail: row.created_by_email || null,
  createdAt: Number(row.created_at || 0),
  updatedAt: Number(row.updated_at || 0),
  lastUsedAt: row.last_used_at == null ? null : Number(row.last_used_at),
});

const createRunSheetFileId = () => {
  return `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

// ── Firebase Admin (ID-token verification) ──────────────────────────────────
// In production, requireActor REQUIRES a verified Firebase ID token. The
// header `x-user-uid` is only honoured in development for local testing.
//
// Configure with one of:
//   FIREBASE_SERVICE_ACCOUNT_JSON  — full JSON string of the service account key
//   FIREBASE_SERVICE_ACCOUNT_PATH  — path to a service account JSON file
//   GOOGLE_APPLICATION_CREDENTIALS — standard Google SDK env var (path)
let firebaseAdminApp = null;
let firebaseAdminInitError = null;
const ALLOW_DEV_HEADER_AUTH = String(process.env.LUMINA_ALLOW_DEV_HEADER_AUTH || "").toLowerCase() === "true"
  || process.env.NODE_ENV !== "production";

const initFirebaseAdmin = async () => {
  try {
    const { initializeApp, cert, applicationDefault, getApps } = await import("firebase-admin/app");
    if (getApps().length > 0) {
      firebaseAdminApp = getApps()[0];
      return firebaseAdminApp;
    }

    const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
    const filePath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();

    if (inlineJson) {
      const parsed = JSON.parse(inlineJson);
      firebaseAdminApp = initializeApp({ credential: cert(parsed) });
    } else if (filePath && fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      firebaseAdminApp = initializeApp({ credential: cert(parsed) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseAdminApp = initializeApp({ credential: applicationDefault() });
    } else {
      throw new Error("No Firebase service account credentials configured (set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS).");
    }

    console.log("[lumina-server-api] firebase-admin initialised — ID token verification active");
    return firebaseAdminApp;
  } catch (err) {
    firebaseAdminInitError = err;
    if (ALLOW_DEV_HEADER_AUTH) {
      console.warn("[lumina-server-api] firebase-admin not initialised:", err?.message || err);
      console.warn("[lumina-server-api] running in DEV-HEADER-AUTH mode — x-user-uid header is trusted (insecure, dev only)");
    } else {
      console.error("[lumina-server-api] firebase-admin REQUIRED in production:", err?.message || err);
      throw err;
    }
    return null;
  }
};

void initFirebaseAdmin();

const verifyIdTokenIfPossible = async (token) => {
  if (!firebaseAdminApp || !token) return null;
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
    return { uid: String(decoded.uid || ""), email: String(decoded.email || "").toLowerCase() };
  } catch (err) {
    console.warn("[lumina-server-api] ID token verification failed:", err?.message || err);
    return null;
  }
};

const readBearerToken = (req) => {
  const header = String(req.header("authorization") || req.header("Authorization") || "");
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
};

const readActor = async (req) => {
  // Prefer verified ID token
  const token = readBearerToken(req);
  if (token && firebaseAdminApp) {
    const verified = await verifyIdTokenIfPossible(token);
    if (verified?.uid) return { uid: verified.uid, email: verified.email, verified: true };
  }

  // Dev fallback: trust headers (only in non-production builds)
  if (ALLOW_DEV_HEADER_AUTH) {
    const uid = String(req.header("x-user-uid") || "").trim();
    const email = String(req.header("x-user-email") || "").trim().toLowerCase();
    return { uid, email, verified: false };
  }

  return { uid: "", email: "", verified: false };
};

const requireActor = async (req, res, next) => {
  try {
    const actor = await readActor(req);
    if (!actor.uid) {
      return res.status(401).json({
        ok: false,
        error: "AUTH_REQUIRED",
        message: firebaseAdminApp
          ? "Missing or invalid Firebase ID token."
          : "Missing x-user-uid header or Firebase ID token.",
      });
    }
    req.actor = actor;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "AUTH_FAILED", message: err?.message || "Authentication failed" });
  }
};

const getWorkspaceRow = db.prepare("SELECT * FROM workspaces WHERE id = ?");
const insertWorkspace = db.prepare(`
  INSERT INTO workspaces (id, owner_uid, owner_email, settings_json, created_at, updated_at, settings_updated_at)
  VALUES (@id, @owner_uid, @owner_email, @settings_json, @created_at, @updated_at, @settings_updated_at)
`);
const updateWorkspace = db.prepare(`
  UPDATE workspaces
  SET settings_json = @settings_json,
      updated_at = @updated_at,
      settings_updated_at = @settings_updated_at
  WHERE id = @id
`);

const listRunSheetFilesByWorkspace = db.prepare(`
  SELECT file_id, title, payload_json, created_by_uid, created_by_email, created_at, updated_at, last_used_at
  FROM workspace_runsheet_files
  WHERE workspace_id = ?
  ORDER BY updated_at DESC
`);
const getRunSheetFileById = db.prepare(`
  SELECT file_id, title, payload_json, created_by_uid, created_by_email, created_at, updated_at, last_used_at
  FROM workspace_runsheet_files
  WHERE workspace_id = ? AND file_id = ?
`);
const insertRunSheetFile = db.prepare(`
  INSERT INTO workspace_runsheet_files (
    workspace_id, file_id, title, payload_json, created_by_uid, created_by_email, created_at, updated_at, last_used_at
  )
  VALUES (
    @workspace_id, @file_id, @title, @payload_json, @created_by_uid, @created_by_email, @created_at, @updated_at, @last_used_at
  )
`);
const updateRunSheetFileTitle = db.prepare(`
  UPDATE workspace_runsheet_files
  SET title = @title, updated_at = @updated_at
  WHERE workspace_id = @workspace_id AND file_id = @file_id
`);
const updateRunSheetFileLastUsed = db.prepare(`
  UPDATE workspace_runsheet_files
  SET last_used_at = @last_used_at, updated_at = @updated_at
  WHERE workspace_id = @workspace_id AND file_id = @file_id
`);
const deleteRunSheetFileById = db.prepare(`
  DELETE FROM workspace_runsheet_files
  WHERE workspace_id = ? AND file_id = ?
`);

const CONNECTION_TTL_MS = 12000;
const ACTIVE_CONNECTION_ROLES = new Set(["controller", "output", "stage", "remote"]);

const upsertSessionConnection = db.prepare(`
  INSERT INTO session_connections (workspace_id, session_id, client_id, role, last_seen_at, metadata_json)
  VALUES (@workspace_id, @session_id, @client_id, @role, @last_seen_at, @metadata_json)
  ON CONFLICT(workspace_id, session_id, client_id) DO UPDATE SET
    role = excluded.role,
    last_seen_at = excluded.last_seen_at,
    metadata_json = excluded.metadata_json
`);
const pruneExpiredSessionConnections = db.prepare(`
  DELETE FROM session_connections
  WHERE workspace_id = ? AND session_id = ? AND last_seen_at < ?
`);
const listActiveSessionConnections = db.prepare(`
  SELECT client_id, role, last_seen_at, metadata_json
  FROM session_connections
  WHERE workspace_id = ? AND session_id = ? AND last_seen_at >= ?
  ORDER BY last_seen_at DESC
`);

const logAudit = db.prepare(`
  INSERT INTO audit_logs (workspace_id, session_id, actor_uid, actor_email, action, details_json, created_at)
  VALUES (@workspace_id, @session_id, @actor_uid, @actor_email, @action, @details_json, @created_at)
`);

const insertWebhookTrigger = db.prepare(`
  INSERT INTO macro_webhook_triggers (id, workspace_id, key, triggered_at)
  VALUES (@id, @workspace_id, @key, @triggered_at)
`);

const listPendingWebhookTriggers = db.prepare(`
  SELECT id, key, triggered_at FROM macro_webhook_triggers
  WHERE workspace_id = ? AND triggered_at > ?
  ORDER BY triggered_at ASC
  LIMIT 100
`);

const pruneOldWebhookTriggers = db.prepare(`
  DELETE FROM macro_webhook_triggers WHERE triggered_at < ?
`);

const canOperateWorkspace = (workspace, actor) => {
  if (!workspace || !actor?.uid) return false;
  if (workspace.owner_uid === actor.uid) return true;
  const settings = parseJson(workspace.settings_json, {});
  const allowed = normalizeEmails(settings?.remoteAdminEmails || "");
  return !!actor.email && allowed.includes(actor.email);
};

const ensureWorkspaceForWrite = (workspaceId, actor, { allowOperator = false } = {}) => {
  let workspace = getWorkspaceRow.get(workspaceId);
  if (!workspace) {
    const createdAt = now();
    insertWorkspace.run({
      id: workspaceId,
      owner_uid: actor.uid,
      owner_email: actor.email || null,
      settings_json: "{}",
      created_at: createdAt,
      updated_at: createdAt,
      settings_updated_at: createdAt,
    });
    workspace = getWorkspaceRow.get(workspaceId);
  }
  const allowed = allowOperator ? canOperateWorkspace(workspace, actor) : workspace.owner_uid === actor.uid;
  if (!allowed) {
    const error = new Error("FORBIDDEN");
    error.code = 403;
    throw error;
  }
  return workspace;
};

const ensureWorkspaceRead = (workspaceId, actor) => {
  const workspace = getWorkspaceRow.get(workspaceId);
  if (!workspace) return null;
  if (!actor) return workspace;
  if (!canOperateWorkspace(workspace, actor)) {
    const error = new Error("FORBIDDEN");
    error.code = 403;
    throw error;
  }
  return workspace;
};

const SEMANTIC_BIBLE_REFERENCE_PATTERN = /\b(?:[1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/i;
const SEMANTIC_JOHN_316_PATTERN = /^john\s+3:16$/i;

const extractBibleReference = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(SEMANTIC_BIBLE_REFERENCE_PATTERN);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
};

const inferSemanticFallbackReference = (query) => {
  const text = String(query || "").toLowerCase();
  const includesAny = (keywords) => keywords.some((keyword) => text.includes(keyword));

  if (includesAny(["peace", "comfort", "anx", "worry", "stress", "trouble"])) return "Philippians 4:6-7";
  if (includesAny(["grief", "mourning", "loss", "broken", "sad"])) return "Psalm 34:18";
  if (includesAny(["fear", "afraid", "panic"])) return "Isaiah 41:10";
  if (includesAny(["strength", "weak", "tired", "weary"])) return "Isaiah 40:31";
  if (includesAny(["guidance", "direction", "decision", "wisdom"])) return "Proverbs 3:5-6";
  if (includesAny(["healing", "sick", "pain", "disease"])) return "Jeremiah 30:17";
  if (includesAny(["forgive", "forgiveness", "guilt", "sin", "shame"])) return "1 John 1:9";
  if (includesAny(["marriage", "family", "relationship", "love"])) return "1 Corinthians 13:4-7";
  if (includesAny(["hope", "future", "discourage", "depress"])) return "Romans 15:13";
  if (includesAny(["protection", "danger", "battle", "war"])) return "Psalm 91:1-2";
  return "Psalm 23:1-4";
};

const TRANSCRIBE_ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
]);
const TRANSCRIBE_MAX_BASE64_BYTES = Math.max(
  64 * 1024,
  Number(process.env.LUMINA_TRANSCRIBE_MAX_BYTES || (1.5 * 1024 * 1024)),
);
const TRANSCRIBE_SOFT_MAX_REQUESTS_PER_MIN = Math.max(
  3,
  Number(process.env.LUMINA_TRANSCRIBE_SOFT_MAX_RPM || 24),
);
const TRANSCRIBE_COOLDOWN_MS = Math.max(
  5000,
  Number(process.env.LUMINA_TRANSCRIBE_COOLDOWN_MS || 15000),
);
const TRANSCRIBE_BUCKETS = new Map();

const pruneTranscribeBuckets = (nowTs) => {
  TRANSCRIBE_BUCKETS.forEach((bucket, key) => {
    if (!bucket || (nowTs - bucket.lastSeenAt) > (10 * 60 * 1000)) {
      TRANSCRIBE_BUCKETS.delete(key);
    }
  });
};

const transcribeBucketKey = (input) => {
  const workspaceId = String(input?.workspaceId || "anon").slice(0, 128);
  const sessionId = String(input?.sessionId || "live").slice(0, 128);
  const clientId = String(input?.clientId || "client").slice(0, 128);
  return `${workspaceId}::${sessionId}::${clientId}`;
};

const checkTranscribeRateLimit = (bucketKey) => {
  const ts = now();
  pruneTranscribeBuckets(ts);
  const existing = TRANSCRIBE_BUCKETS.get(bucketKey) || {
    windowStart: ts,
    count: 0,
    cooldownUntil: 0,
    lastSeenAt: ts,
  };
  existing.lastSeenAt = ts;

  if (existing.cooldownUntil && ts < existing.cooldownUntil) {
    const retryAfterMs = Math.max(0, existing.cooldownUntil - ts);
    TRANSCRIBE_BUCKETS.set(bucketKey, existing);
    return { allowed: false, retryAfterMs };
  }

  if ((ts - existing.windowStart) >= 60000) {
    existing.windowStart = ts;
    existing.count = 0;
  }

  existing.count += 1;
  if (existing.count > TRANSCRIBE_SOFT_MAX_REQUESTS_PER_MIN) {
    existing.cooldownUntil = ts + TRANSCRIBE_COOLDOWN_MS;
    const retryAfterMs = Math.max(0, existing.cooldownUntil - ts);
    TRANSCRIBE_BUCKETS.set(bucketKey, existing);
    return { allowed: false, retryAfterMs };
  }

  TRANSCRIBE_BUCKETS.set(bucketKey, existing);
  return { allowed: true, retryAfterMs: 0 };
};

const SERMON_ACCENT_HINTS = new Set([
  "standard",
  "uk",
  "nigerian",
  "ghanaian",
  "southafrican",
  "kenyan",
]);

const normalizeSermonAccentHint = (value, locale = "en-US") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (SERMON_ACCENT_HINTS.has(normalized)) return normalized;
  return locale === "en-GB" ? "uk" : "standard";
};

const buildSermonTranscriptionPrompt = (locale, accentHintRaw) => {
  const accentHint = normalizeSermonAccentHint(accentHintRaw, locale);
  const localeInstruction = locale === "en-GB"
    ? "Use British English spelling and punctuation."
    : "Use American English spelling and punctuation.";

  const accentInstruction = accentHint === "uk"
    ? "Recognise British English phrasing and pronunciation faithfully."
    : accentHint === "nigerian"
      ? "Recognise Nigerian English and Nigerian Pidgin faithfully. Do not flatten local expressions into Standard English."
      : accentHint === "ghanaian"
        ? "Recognise Ghanaian English and Ghanaian Pidgin faithfully. Preserve local expressions as spoken."
        : accentHint === "southafrican"
          ? "Recognise South African English faithfully, including common Afrikaans, Zulu, Xhosa, or Sotho-influenced words when spoken."
          : accentHint === "kenyan"
            ? "Recognise Kenyan English faithfully, including Swahili or Sheng code-switching when spoken."
            : "Recognise clear spoken English faithfully without inventing missing words.";

  return [
    "Transcribe this church sermon audio.",
    "Return plain transcript text only, with no timestamps, bullets, or speaker labels.",
    localeInstruction,
    accentInstruction,
    "Preserve Bible references, quoted phrases, and code-switching exactly as spoken.",
  ].join(" ");
};

const SERMON_PROCESSING_PARALLELISM = Math.max(
  1,
  Number(process.env.LUMINA_SERMON_PROCESSING_PARALLELISM || 1),
);
const SERMON_PROCESSING_POLL_MS = Math.max(
  3000,
  Number(process.env.LUMINA_SERMON_PROCESSING_POLL_MS || 5000),
);
const SERMON_PROCESSING_RETRY_BASE_MS = Math.max(
  5000,
  Number(process.env.LUMINA_SERMON_PROCESSING_RETRY_BASE_MS || 15000),
);
const SERMON_PROCESSING_MAX_RETRY_MS = Math.max(
  SERMON_PROCESSING_RETRY_BASE_MS,
  Number(process.env.LUMINA_SERMON_PROCESSING_MAX_RETRY_MS || 60000),
);
const SERMON_PROCESSING_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.LUMINA_SERMON_PROCESSING_MAX_ATTEMPTS || 3),
);
const SERMON_PROCESSING_JOB_TTL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.LUMINA_SERMON_PROCESSING_JOB_TTL_MS || (7 * 24 * 60 * 60 * 1000)),
);
const activeSermonProcessingJobs = new Set();

const parseSermonSummaryJson = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const toClientSermonProcessingJob = (row) => {
  if (!row) return null;
  const nextRetryAt = Number(row.next_retry_at || 0) || null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    status: row.status,
    phase: row.phase,
    progress: Number(row.progress || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    completedAt: row.completed_at ? Number(row.completed_at) : null,
    error: row.error ? String(row.error) : null,
    retryAfterMs: nextRetryAt ? Math.max(0, nextRetryAt - now()) : 0,
    nextRetryAt,
    attemptCount: Number(row.attempt_count || 0),
    transcript: row.transcript ? String(row.transcript) : null,
    summary: parseSermonSummaryJson(row.summary_json),
    accentHint: normalizeSermonAccentHint(row.accent_hint, row.locale || "en-US"),
    locale: row.locale === "en-GB" ? "en-GB" : "en-US",
  };
};

const getSermonProcessingJobRow = (jobId) => db.prepare(`
  SELECT id, workspace_id, status, phase, progress, created_at, updated_at, completed_at,
         error, retry_after_ms, next_retry_at, attempt_count, accent_hint, locale,
         mime_type, audio_file_path, transcript, summary_json
  FROM sermon_processing_jobs
  WHERE id = ?
`).get(jobId);

const getSermonProcessingJob = (jobId) => toClientSermonProcessingJob(getSermonProcessingJobRow(jobId));

const updateSermonProcessingJob = (jobId, patch) => {
  const current = getSermonProcessingJobRow(jobId);
  if (!current) return null;
  const next = {
    workspace_id: Object.prototype.hasOwnProperty.call(patch, "workspaceId") ? patch.workspaceId : current.workspace_id,
    status: Object.prototype.hasOwnProperty.call(patch, "status") ? patch.status : current.status,
    phase: Object.prototype.hasOwnProperty.call(patch, "phase") ? patch.phase : current.phase,
    progress: Object.prototype.hasOwnProperty.call(patch, "progress") ? patch.progress : current.progress,
    created_at: current.created_at,
    updated_at: Object.prototype.hasOwnProperty.call(patch, "updatedAt") ? patch.updatedAt : now(),
    completed_at: Object.prototype.hasOwnProperty.call(patch, "completedAt") ? patch.completedAt : current.completed_at,
    error: Object.prototype.hasOwnProperty.call(patch, "error") ? patch.error : current.error,
    retry_after_ms: Object.prototype.hasOwnProperty.call(patch, "retryAfterMs") ? patch.retryAfterMs : current.retry_after_ms,
    next_retry_at: Object.prototype.hasOwnProperty.call(patch, "nextRetryAt") ? patch.nextRetryAt : current.next_retry_at,
    attempt_count: Object.prototype.hasOwnProperty.call(patch, "attemptCount") ? patch.attemptCount : current.attempt_count,
    accent_hint: Object.prototype.hasOwnProperty.call(patch, "accentHint") ? patch.accentHint : current.accent_hint,
    locale: Object.prototype.hasOwnProperty.call(patch, "locale") ? patch.locale : current.locale,
    mime_type: Object.prototype.hasOwnProperty.call(patch, "mimeType") ? patch.mimeType : current.mime_type,
    audio_file_path: Object.prototype.hasOwnProperty.call(patch, "audioFilePath") ? patch.audioFilePath : current.audio_file_path,
    transcript: Object.prototype.hasOwnProperty.call(patch, "transcript") ? patch.transcript : current.transcript,
    summary_json: Object.prototype.hasOwnProperty.call(patch, "summaryJson") ? patch.summaryJson : current.summary_json,
  };

  db.prepare(`
    UPDATE sermon_processing_jobs
    SET workspace_id = ?, status = ?, phase = ?, progress = ?, updated_at = ?, completed_at = ?,
        error = ?, retry_after_ms = ?, next_retry_at = ?, attempt_count = ?, accent_hint = ?,
        locale = ?, mime_type = ?, audio_file_path = ?, transcript = ?, summary_json = ?
    WHERE id = ?
  `).run(
    next.workspace_id,
    next.status,
    next.phase,
    next.progress,
    next.updated_at,
    next.completed_at,
    next.error,
    next.retry_after_ms,
    next.next_retry_at,
    next.attempt_count,
    next.accent_hint,
    next.locale,
    next.mime_type,
    next.audio_file_path,
    next.transcript,
    next.summary_json,
    jobId,
  );

  return getSermonProcessingJob(jobId);
};

const buildFallbackSermonSummary = (transcript) => {
  const greetingMarkers = /\b(welcome|good evening|good morning|good afternoon|joining us|warm welcome|pleased to have|glad you|nice to see|wonderful to have|first time|bless you all)\b/i;
  const scriptureRegex = /\b(?:[1-3]\s)?[A-Za-z]+\s\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;
  const scriptures = Array.from(new Set((String(transcript || "").match(scriptureRegex) || []).slice(0, 10)));
  const sentences = String(transcript || "")
    .split(/[.!?]+(?=\s|$)/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const contentSentences = sentences.filter((sentence) => !greetingMarkers.test(sentence));
  const usable = contentSentences.length >= 3 ? contentSentences : sentences;
  return {
    title: "Sermon",
    mainTheme: usable[0]?.slice(0, 120) || "Faith and purpose",
    keyPoints: usable.slice(1, 6).map((sentence) => sentence.slice(0, 160)),
    scripturesReferenced: scriptures,
    callToAction: usable[usable.length - 1]?.slice(0, 200) || "Walk in faith.",
    quotableLines: [],
  };
};

const sanitizeSermonSummary = (parsed, fallback) => ({
  title: String(parsed?.title || fallback.title || "Sermon").slice(0, 100),
  mainTheme: String(parsed?.mainTheme || fallback.mainTheme || "").slice(0, 300),
  keyPoints: Array.isArray(parsed?.keyPoints)
    ? parsed.keyPoints.slice(0, 7).map((point) => String(point).slice(0, 300))
    : fallback.keyPoints,
  scripturesReferenced: Array.isArray(parsed?.scripturesReferenced)
    ? parsed.scripturesReferenced.slice(0, 20).map(String)
    : fallback.scripturesReferenced,
  callToAction: String(parsed?.callToAction || fallback.callToAction || "").slice(0, 400),
  quotableLines: Array.isArray(parsed?.quotableLines)
    ? parsed.quotableLines.slice(0, 4).map((quote) => String(quote).slice(0, 300))
    : fallback.quotableLines,
});

const summarizeSermonTranscriptInternal = async (transcript, accentHint, options = {}) => {
  const trimmed = String(transcript || "").trim();
  if (!trimmed) {
    return { ok: false, error: "TRANSCRIPT_REQUIRED", summary: null, warning: null };
  }

  const fallback = buildFallbackSermonSummary(trimmed);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const allowShortTranscript = options.allowShortTranscript === true;
  if (wordCount < 40 && !allowShortTranscript) {
    return {
      ok: false,
      error: "TRANSCRIPT_TOO_SHORT",
      summary: null,
      warning: `Only ${wordCount} words were captured. At least 40 words are needed for a meaningful summary. Try recording a longer segment.`,
    };
  }

  const ai = options.ai || getSermonGoogleAiClient();
  if (!ai) {
    return {
      ok: true,
      summary: fallback,
      warning: "Missing AI key on server. Using fallback sermon summary.",
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a sermon note-taker for a church service${accentHint !== "standard" ? ` (${accentHint} English accent)` : ""}.
The following is a live speech transcript from a pastor's sermon captured by a speech-to-text engine. There may be minor transcription errors.

IMPORTANT RULES:
1. Extract ONLY theological/spiritual content explicitly stated in the transcript. Do NOT infer, assume, or fabricate.
2. SKIP all opening pleasantries, greetings, welcomes, and introductions (e.g. "Good evening", "welcome to St John's", "glad you joined us"). These are NOT the sermon content.
3. The mainTheme must describe the central spiritual/theological message — not the opening greeting.
4. keyPoints must be actual points the pastor made about faith, scripture, or the sermon topic — not pleasantries.
5. If a field cannot be determined from the actual sermon content, return an empty string or empty array.
6. Correct obvious transcription artifacts before extracting content: remove duplicate repeated words, fix broken sentences from speech-to-text, and clean up filler words — but preserve the pastor's authentic voice, idioms, and theological vocabulary.

Return a JSON object with:
- title: short sermon title based only on what was said (max 8 words, or "Untitled Sermon" if unclear)
- mainTheme: one sentence describing the central spiritual message
- keyPoints: array of 3 to 7 concise theological points the pastor explicitly made
- scripturesReferenced: array of Bible references explicitly mentioned (book chapter:verse format)
- callToAction: the closing challenge given to the congregation — only if clearly stated, otherwise empty string
- quotableLines: array of up to 4 direct quotes that capture the sermon's spiritual content

Transcript (${wordCount} words):
${trimmed.slice(0, 20000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mainTheme: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            scripturesReferenced: { type: Type.ARRAY, items: { type: Type.STRING } },
            callToAction: { type: Type.STRING },
            quotableLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["title", "mainTheme", "keyPoints", "scripturesReferenced", "callToAction", "quotableLines"],
        },
      },
    });

    const parsed = parseAiJson(response);
    return {
      ok: true,
      summary: sanitizeSermonSummary(parsed, fallback),
      warning: !parsed?.title ? "AI returned incomplete sermon summary. Using fallback content." : null,
    };
  } catch (error) {
    return {
      ok: true,
      summary: fallback,
      warning: String(error?.message || error),
    };
  }
};

const transcribeSermonAudioFileInternal = async (audioFilePath, rawMime, locale, accentHint, ai = getSermonGoogleAiClient()) => {
  if (!ai) {
    const error = new Error("AI_KEY_MISSING");
    error.code = "AI_KEY_MISSING";
    throw error;
  }

  const geminiMimeType = String(rawMime || "audio/webm").trim().toLowerCase().includes(";")
    ? String(rawMime || "audio/webm").trim().toLowerCase().split(";")[0].trim()
    : String(rawMime || "audio/webm").trim().toLowerCase();
  const speechPrompt = buildSermonTranscriptionPrompt(locale, accentHint);
  const fileStat = fs.statSync(audioFilePath);

  if (fileStat.size <= SERMON_INLINE_LIMIT) {
    const fileBuffer = fs.readFileSync(audioFilePath);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: fileBuffer.toString("base64"), mimeType: geminiMimeType } },
            { text: speechPrompt },
          ],
        },
      ],
    });
    return String(response?.text || "").trim();
  }

  let uploadResult;
  try {
    uploadResult = await ai.files.upload({ file: audioFilePath, config: { mimeType: geminiMimeType } });
    const pollStart = Date.now();
    let fileState = await ai.files.get({ name: uploadResult.name });
    while (fileState.state === "PROCESSING") {
      if (Date.now() - pollStart > 5 * 60 * 1000) throw new Error("Gemini File API processing timed out");
      await waitMs(2000);
      fileState = await ai.files.get({ name: uploadResult.name });
    }
    if (fileState.state === "FAILED") throw new Error("Gemini File processing failed.");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: uploadResult.uri, mimeType: geminiMimeType } },
            { text: speechPrompt },
          ],
        },
      ],
    });
    return String(response?.text || "").trim();
  } finally {
    if (uploadResult?.name) {
      ai.files.delete({ name: uploadResult.name }).catch(() => {});
    }
  }
};

const computeSermonProcessingRetryMs = (error, attemptCount = 0) => {
  const hintedMs = extractGeminiRetryAfterMs(error);
  if (hintedMs > 0) {
    return Math.min(SERMON_PROCESSING_MAX_RETRY_MS, hintedMs);
  }
  const backoff = SERMON_PROCESSING_RETRY_BASE_MS * Math.max(1, Math.min(8, attemptCount + 1));
  return Math.min(SERMON_PROCESSING_MAX_RETRY_MS, backoff);
};

const createDeferredSermonProcessingJob = ({ sourcePath, mimeType, locale, accentHint, workspaceId, initialError }) => {
  const jobId = randomUUID();
  const storedPath = path.join(
    SERMON_PROCESSING_AUDIO_DIR,
    `${jobId}${inferSermonAudioExtension(mimeType)}`
  );
  moveFileSafely(sourcePath, storedPath);

  const retryAfterMs = computeSermonProcessingRetryMs(initialError, 0);
  db.prepare(`
    INSERT INTO sermon_processing_jobs (
      id, workspace_id, status, phase, progress, created_at, updated_at, completed_at,
      error, retry_after_ms, next_retry_at, attempt_count, accent_hint, locale,
      mime_type, audio_file_path, transcript, summary_json
    ) VALUES (?, ?, 'queued', 'queued', 4, ?, ?, NULL, ?, ?, ?, 0, ?, ?, ?, ?, NULL, NULL)
  `).run(
    jobId,
    String(workspaceId || "default-workspace").trim() || "default-workspace",
    now(),
    now(),
    "Gemini quota reached. Audio saved and queued for automatic retry.",
    retryAfterMs,
    now() + retryAfterMs,
    normalizeSermonAccentHint(accentHint, locale),
    locale === "en-GB" ? "en-GB" : "en-US",
    String(mimeType || "audio/webm").trim().toLowerCase() || "audio/webm",
    storedPath,
  );

  return getSermonProcessingJob(jobId);
};

const processDeferredSermonJob = async (jobId) => {
  const row = getSermonProcessingJobRow(jobId);
  if (!row) return;

  const currentAttempt = Number(row.attempt_count || 0) + 1;
  updateSermonProcessingJob(jobId, {
    status: "processing",
    phase: "transcribe",
    progress: 12,
    error: null,
    retryAfterMs: 0,
    nextRetryAt: null,
    attemptCount: currentAttempt,
  });

  try {
    if (!row.audio_file_path || !fs.existsSync(row.audio_file_path)) {
      throw new Error("Saved sermon audio could not be found for processing.");
    }

    const transcript = await transcribeSermonAudioFileInternal(
      row.audio_file_path,
      row.mime_type,
      row.locale,
      row.accent_hint,
    );

    updateSermonProcessingJob(jobId, {
      phase: "summarize",
      progress: 74,
      transcript,
    });

    const summaryResult = await summarizeSermonTranscriptInternal(transcript, row.accent_hint, {
      allowShortTranscript: true,
    });
    const summary = summaryResult.summary || buildFallbackSermonSummary(transcript);
    updateSermonProcessingJob(jobId, {
      status: "completed",
      phase: "completed",
      progress: 100,
      completedAt: now(),
      error: summaryResult.warning || null,
      transcript,
      summaryJson: JSON.stringify(summary),
      audioFilePath: null,
    });

    try { fs.unlinkSync(row.audio_file_path); } catch { /* ignore */ }
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      if (currentAttempt >= SERMON_PROCESSING_MAX_ATTEMPTS) {
        updateSermonProcessingJob(jobId, {
          status: "failed",
          phase: "failed",
          progress: 100,
          completedAt: now(),
          error: `Gemini quota is still exhausted after ${SERMON_PROCESSING_MAX_ATTEMPTS} attempts. Saved sermon audio is still available. Retry later.`,
          retryAfterMs: 0,
          nextRetryAt: null,
          attemptCount: currentAttempt,
        });
        return;
      }
      const retryAfterMs = computeSermonProcessingRetryMs(error, currentAttempt);
      updateSermonProcessingJob(jobId, {
        status: "queued",
        phase: "queued",
        progress: 8,
        error: "Gemini quota reached. Saved sermon will retry automatically.",
        retryAfterMs,
        nextRetryAt: now() + retryAfterMs,
        attemptCount: currentAttempt,
      });
      return;
    }

    updateSermonProcessingJob(jobId, {
      status: "failed",
      phase: "failed",
      progress: 100,
      completedAt: now(),
      error: extractGeminiErrorMessage(error),
    });
  } finally {
    activeSermonProcessingJobs.delete(jobId);
  }
};

const drainDeferredSermonJobs = () => {
  const availableSlots = Math.max(0, SERMON_PROCESSING_PARALLELISM - activeSermonProcessingJobs.size);
  if (availableSlots <= 0) return;

  const readyRows = db.prepare(`
    SELECT id
    FROM sermon_processing_jobs
    WHERE status = 'queued'
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY COALESCE(next_retry_at, created_at) ASC, created_at ASC
    LIMIT ?
  `).all(now(), availableSlots);

  readyRows.forEach((entry) => {
    const jobId = String(entry?.id || "").trim();
    if (!jobId || activeSermonProcessingJobs.has(jobId)) return;
    activeSermonProcessingJobs.add(jobId);
    void processDeferredSermonJob(jobId);
  });
};

const pruneDeferredSermonJobs = () => {
  const cutoff = now() - SERMON_PROCESSING_JOB_TTL_MS;
  const staleRows = db.prepare(`
    SELECT id, audio_file_path
    FROM sermon_processing_jobs
    WHERE status IN ('completed', 'failed')
      AND COALESCE(completed_at, updated_at, created_at) < ?
  `).all(cutoff);

  staleRows.forEach((row) => {
    if (row?.audio_file_path) {
      try { fs.unlinkSync(row.audio_file_path); } catch { /* ignore */ }
    }
  });

  db.prepare(`
    DELETE FROM sermon_processing_jobs
    WHERE status IN ('completed', 'failed')
      AND COALESCE(completed_at, updated_at, created_at) < ?
  `).run(cutoff);
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lumina-server-api", db: DB_PATH, now: now() });
});

// ── Paystack payment routes ────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = String(process.env.PAYSTACK_SECRET_KEY || "").trim();

// Map Paystack plan codes → plan/period keys so we can identify what was purchased.
const PAYSTACK_PLAN_MAP = {
  [String(process.env.VITE_PAYSTACK_PLAN_PRO_MONTHLY    || "")]: { plan: "pro",    period: "monthly"   },
  [String(process.env.VITE_PAYSTACK_PLAN_PRO_QUARTERLY  || "")]: { plan: "pro",    period: "quarterly" },
  [String(process.env.VITE_PAYSTACK_PLAN_PRO_ANNUAL     || "")]: { plan: "pro",    period: "annual"    },
  [String(process.env.VITE_PAYSTACK_PLAN_CHURCH_MONTHLY    || "")]: { plan: "church", period: "monthly"   },
  [String(process.env.VITE_PAYSTACK_PLAN_CHURCH_QUARTERLY  || "")]: { plan: "church", period: "quarterly" },
  [String(process.env.VITE_PAYSTACK_PLAN_CHURCH_ANNUAL     || "")]: { plan: "church", period: "annual"    },
};

// Ensure subscriptions table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS user_subscriptions (
    uid TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    period TEXT,
    paystack_customer_code TEXT,
    paystack_subscription_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at INTEGER,
    updated_at INTEGER NOT NULL
  );
`);

// GET /api/payments/verify/:reference — called by browser after successful checkout
app.get("/api/payments/verify/:reference", requireActor, async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ ok: false, message: "Payment service not configured." });
  }
  const reference = String(req.params.reference || "").trim();
  if (!reference) return res.status(400).json({ ok: false, message: "Missing reference." });

  try {
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const psData = await psRes.json();
    if (!psData.status || psData.data?.status !== "success") {
      return res.status(402).json({ ok: false, message: "Transaction not successful." });
    }

    const { metadata, plan, customer } = psData.data;
    const planKey   = metadata?.lumina_plan   || (PAYSTACK_PLAN_MAP[plan?.plan_code]?.plan   ?? "pro");
    const periodKey = metadata?.lumina_period || (PAYSTACK_PLAN_MAP[plan?.plan_code]?.period ?? "monthly");
    const uid  = String(metadata?.lumina_uid || req.actor?.uid || "").trim();
    const email = String(customer?.email || "").trim().toLowerCase();

    if (uid) {
      db.prepare(`
        INSERT INTO user_subscriptions (uid, email, plan, period, paystack_customer_code, status, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?)
        ON CONFLICT(uid) DO UPDATE SET
          plan = excluded.plan,
          period = excluded.period,
          paystack_customer_code = excluded.paystack_customer_code,
          status = 'active',
          updated_at = excluded.updated_at
      `).run(uid, email, planKey, periodKey, customer?.customer_code || null, now());
    }

    return res.json({ ok: true, subscription: { plan: planKey, period: periodKey, status: "active" } });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Verification request failed." });
  }
});

// GET /api/payments/subscription — return current user's plan
app.get("/api/payments/subscription", requireActor, (req, res) => {
  const uid = req.actor?.uid;
  const row = db.prepare("SELECT plan, period, status, expires_at FROM user_subscriptions WHERE uid = ?").get(uid);
  if (!row) return res.json({ ok: true, subscription: { plan: "free", period: null, status: "active" } });
  // Check expiry if set
  if (row.expires_at && row.expires_at < now()) {
    db.prepare("UPDATE user_subscriptions SET status = 'expired', updated_at = ? WHERE uid = ?").run(now(), uid);
    return res.json({ ok: true, subscription: { plan: "free", period: null, status: "expired" } });
  }
  return res.json({ ok: true, subscription: { plan: row.plan, period: row.period, status: row.status } });
});

// POST /api/payments/paystack/webhook — Paystack event push (subscription cancel, charge failure, etc.)
// Must be raw body for signature verification — mount before express.json() processes it.
app.post("/api/payments/paystack/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!PAYSTACK_SECRET_KEY) return res.sendStatus(200);

  const sig  = String(req.headers["x-paystack-signature"] || "");
  const hash = createHash("sha512").update(req.body).update(PAYSTACK_SECRET_KEY).digest("hex");
  if (hash !== sig) return res.sendStatus(401);

  let event;
  try { event = JSON.parse(req.body.toString()); } catch { return res.sendStatus(400); }

  const data = event?.data ?? {};
  const customerCode = String(data?.customer?.customer_code || "").trim();
  const planCode     = String(data?.plan?.plan_code || "").trim();
  const planMeta     = PAYSTACK_PLAN_MAP[planCode];

  if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
    if (customerCode) {
      db.prepare(`
        UPDATE user_subscriptions SET plan = 'free', period = NULL, status = 'cancelled', updated_at = ?
        WHERE paystack_customer_code = ?
      `).run(now(), customerCode);
    }
  }

  if (event.event === "charge.success" && planMeta && customerCode) {
    db.prepare(`
      UPDATE user_subscriptions SET plan = ?, period = ?, status = 'active', updated_at = ?
      WHERE paystack_customer_code = ?
    `).run(planMeta.plan, planMeta.period, now(), customerCode);
  }

  res.sendStatus(200);
});

app.get("/api/media/pexels/videos", async (req, res) => {
  if (!PEXELS_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "PEXELS_API_KEY_MISSING",
      message: "Pexels search is not configured on the server.",
    });
  }

  const query = normalizePexelsQuery(req.query?.query);
  const perPage = normalizePexelsPerPage(req.query?.per_page);
  const cacheKey = `${query.toLowerCase()}::${perPage}`;
  const cached = PEXELS_SEARCH_CACHE.get(cacheKey);
  const ts = now();
  if (cached && cached.expiresAt > ts) {
    return res.json({ ok: true, assets: cached.assets, cached: true });
  }

  try {
    const upstreamUrl = new URL(PEXELS_API_BASE_URL);
    upstreamUrl.searchParams.set("query", query);
    upstreamUrl.searchParams.set("per_page", String(perPage));
    upstreamUrl.searchParams.set("orientation", "landscape");

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstreamResponse.ok) {
      const status = upstreamResponse.status;
      const message = status === 401 || status === 403
        ? "Pexels authentication failed on the server."
        : status === 429
          ? "Pexels rate limit reached. Try again shortly."
          : `Pexels request failed with HTTP ${status}.`;
      return res.status(status === 429 ? 429 : 502).json({
        ok: false,
        error: "PEXELS_UPSTREAM_FAILED",
        message,
        upstreamStatus: status,
      });
    }

    const payload = await upstreamResponse.json().catch(() => null);
    const assets = mapPexelsVideos(payload?.videos || []);
    PEXELS_SEARCH_CACHE.set(cacheKey, {
      assets,
      expiresAt: ts + PEXELS_CACHE_TTL_MS,
    });
    return res.json({ ok: true, assets, cached: false });
  } catch (error) {
    const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: isTimeout ? "PEXELS_TIMEOUT" : "PEXELS_PROXY_FAILED",
      message: isTimeout ? "Pexels request timed out." : "Could not reach Pexels from the server.",
    });
  }
});

app.get("/api/bible/verse", async (req, res) => {
  if (!SCRIPTURE_API_BIBLE_KEY) {
    return res.status(503).json({
      ok: false,
      error: "SCRIPTURE_API_BIBLE_KEY_MISSING",
      message: "API.Bible key not configured on server. Add SCRIPTURE_API_BIBLE_KEY to .env.local.",
    });
  }

  const ref = String(req.query?.ref || "").trim();
  const translation = String(req.query?.translation || "").trim().toLowerCase();
  if (!ref || !translation) {
    return res.status(400).json({ ok: false, error: "REF_AND_TRANSLATION_REQUIRED" });
  }

  const bibleId = APIBIBLE_TRANSLATION_IDS[translation];
  if (!bibleId) {
    return res.status(422).json({
      ok: false,
      error: "TRANSLATION_NOT_CONFIGURED",
      message: `Translation "${translation}" is not in APIBIBLE_TRANSLATION_IDS. Add its Bible ID from scripture.api.bible.`,
    });
  }

  const passageId = buildApiBiblePassageId(ref);
  if (!passageId) {
    return res.status(400).json({ ok: false, error: "INVALID_REFERENCE", message: `Could not parse reference: ${ref}` });
  }

  try {
    const url = new URL(`${SCRIPTURE_API_BASE_URL}/bibles/${bibleId}/passages/${passageId}`);
    url.searchParams.set("content-type", "text");
    url.searchParams.set("include-notes", "false");
    url.searchParams.set("include-titles", "false");
    url.searchParams.set("include-chapter-numbers", "false");
    url.searchParams.set("include-verse-numbers", "true");
    url.searchParams.set("include-verse-spans", "false");

    const upstream = await fetch(url.toString(), {
      headers: { "api-key": SCRIPTURE_API_BIBLE_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      const status = upstream.status;
      const msg = status === 401 || status === 403
        ? "API.Bible authentication failed. Check SCRIPTURE_API_BIBLE_KEY."
        : status === 404
          ? `Passage not found: ${ref} in ${translation}`
          : `API.Bible upstream error ${status}`;
      return res.status(status).json({ ok: false, error: "UPSTREAM_ERROR", message: msg });
    }

    const data = await upstream.json();
    const rawContent = data?.data?.content || "";

    const refMatch = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (!refMatch) return res.status(400).json({ ok: false, error: "PARSE_FAILED" });
    const [, bookName, chapter, verseFrom, verseTo] = refMatch;

    const verses = parseApiBiblePassageText(rawContent, bookName, chapter, verseFrom, verseTo);
    return res.json({ ok: true, verses, translation, reference: ref });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "BIBLE_FETCH_FAILED",
      message: String(error?.message || error),
    });
  }
});

app.post("/api/ai/generate-slides", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "TEXT_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Break the following text into presentation slides for a church service.
Identify sections like "Verse", "Chorus", "Bridge", or "Point".
Keep slide content concise (max 4-6 lines).

Text to process:
${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ["label", "content"],
              },
            },
          },
          required: ["slides"],
        },
      },
    });
    const parsed = parseAiJson(response);
    const slides = sanitizeSlides(parsed?.slides);
    if (!slides.length) {
      return res.status(422).json({ ok: false, error: "INVALID_AI_PAYLOAD", message: "AI did not return valid slides." });
    }
    return res.json({ ok: true, data: { slides } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "AI_GENERATE_SLIDES_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/ai/semantic-bible-search", async (req, res) => {
  const query = String(req.body?.query || "").trim();
  const maxResults = Math.min(5, Math.max(1, parseInt(String(req.body?.maxResults || "1"), 10) || 1));
  if (!query) return res.status(400).json({ ok: false, error: "QUERY_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  try {
    const userAskedForJohn316 = /john\s*3:16|for god so loved|eternal life|believe/i.test(query);
    if (maxResults > 1) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a biblical scholar. Given the user's spoken words (topic, emotion, or situation), provide ${maxResults} distinct and relevant Bible references that address it from different angles.

User Input: "${query}"

Return ONLY ${maxResults} references, one per line, no numbering, no extra text. Example:
Philippians 4:13
Psalm 46:1-3
Romans 8:28`,
      });
      const lines = String(response?.text || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const parsed = lines.map((l) => extractBibleReference(l)).filter(Boolean);
      const filtered = parsed.filter((r) => !SEMANTIC_JOHN_316_PATTERN.test(r) || userAskedForJohn316);
      const references = filtered.length > 0 ? filtered.slice(0, maxResults) : [inferSemanticFallbackReference(query)];
      return res.json({ ok: true, reference: references[0], references });
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a biblical scholar. Given the user's input (topic, emotion, or situation),
provide the single best Bible reference (Book Chapter:Verse) to address it.

User Input: "${query}"

Return ONLY the reference (e.g., "Philippians 4:13" or "Psalm 23:1-4").`,
      });
      const parsedReference = extractBibleReference(response?.text);
      const looksLikeDefaultJohn = parsedReference ? SEMANTIC_JOHN_316_PATTERN.test(parsedReference) : false;
      const reference = parsedReference && (!looksLikeDefaultJohn || userAskedForJohn316)
        ? parsedReference
        : inferSemanticFallbackReference(query);
      return res.json({ ok: true, reference, references: [reference] });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: "AI_SEMANTIC_SEARCH_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/ai/suggest-visual-theme", async (req, res) => {
  const contextText = String(req.body?.contextText || "").trim();
  if (!contextText) return res.status(400).json({ ok: false, error: "TEXT_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on the following lyrics or text, suggest a single visual keyword for a background image search
(e.g., "mountains", "worship", "cross", "sky", "hands", "city"). Return ONLY the keyword.

Text:
${contextText.slice(0, 500)}`,
    });
    const keyword = String(response?.text || "").trim() || "abstract";
    return res.json({ ok: true, keyword });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "AI_THEME_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/ai/generate-visionary-backdrop", async (req, res) => {
  const verseText = String(req.body?.verseText || "").trim();
  if (!verseText) return res.status(400).json({ ok: false, error: "VERSE_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  try {
    const promptResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a Christian Art Director. Translate the essence and visual imagery of this Bible verse
into a detailed prompt for a high-quality cinematic background image.
Focus on atmosphere, lighting, symbolism. Avoid any human faces or text in the image.
Use a 16:9 cinematic style.

Verse: "${verseText}"

Return ONLY the art prompt.`,
    });

    const artPrompt =
      String(promptResponse?.text || "").trim()
      || "A peaceful, atmospheric background with soft golden light and subtle clouds, cinematic 4k, no text.";

    const imageResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `High resolution, cinematic church presentation background: ${artPrompt}.
No text. No people. 16:9. 4k.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    const parts = imageResponse?.candidates?.[0]?.content?.parts || [];
    const base64 = parts.find((part) => part?.inlineData?.data)?.inlineData?.data || null;
    return res.json({ ok: true, imageDataUrl: base64 ? `data:image/png;base64,${base64}` : null });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "AI_BACKDROP_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/ai/analyze-sermon", async (req, res) => {
  const sermonText = String(req.body?.sermonText || "").trim();
  if (!sermonText) return res.status(400).json({ ok: false, error: "SERMON_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  const fallback = fallbackSermonAnalysis(sermonText);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a sermon slide architect. Analyze the sermon text and return JSON with:
1) scriptureReferences: array of references found
2) keyPoints: concise bullet points
3) slides: exactly 20 slides with label/content for a preaching deck.

Sermon Text:
${sermonText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scriptureReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ["label", "content"],
              },
            },
          },
          required: ["scriptureReferences", "keyPoints", "slides"],
        },
      },
    });

    const parsed = parseAiJson(response);
    const slides = sanitizeSlides(parsed?.slides).slice(0, 20);
    while (slides.length < 20) {
      const idx = slides.length + 1;
      slides.push({
        label: `Application ${idx}`,
        content: fallback.keyPoints[idx % Math.max(fallback.keyPoints.length, 1)] || `Reflection point ${idx}`,
      });
    }

    if (!slides.length) {
      return res.json({ ok: true, data: fallback });
    }

    return res.json({
      ok: true,
      data: {
        scriptureReferences: Array.isArray(parsed?.scriptureReferences) && parsed.scriptureReferences.length
          ? parsed.scriptureReferences
          : fallback.scriptureReferences,
        keyPoints: Array.isArray(parsed?.keyPoints) && parsed.keyPoints.length
          ? parsed.keyPoints
          : fallback.keyPoints,
        slides,
      },
    });
  } catch (error) {
    return res.json({ ok: true, data: fallback, warning: String(error?.message || error) });
  }
});

app.post("/api/ai/summarize-sermon", async (req, res) => {
  const transcript = String(req.body?.transcript || "").trim();
  const accentHint = normalizeSermonAccentHint(req.body?.accentHint, "en-US");
  if (!transcript) return res.status(400).json({ ok: false, error: "TRANSCRIPT_REQUIRED" });
  const result = await summarizeSermonTranscriptInternal(transcript, accentHint, {
    ai: getSermonGoogleAiClient(),
  });
  if (!result.ok) {
    return res.status(result.error === "TRANSCRIPT_TOO_SHORT" ? 422 : 500).json({
      ok: false,
      error: result.error || "SUMMARY_FAILED",
      message: result.warning || "Summarization failed.",
    });
  }
  return res.json({
    ok: true,
    summary: result.summary,
    warning: result.warning || undefined,
  });
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  if (wordCount < 40) {
    return res.status(422).json({
      ok: false,
      error: "TRANSCRIPT_TOO_SHORT",
      message: `Only ${wordCount} words were captured. At least 40 words are needed for a meaningful summary. Try recording a longer segment.`,
    });
  }
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;

  const greetingMarkers = /\b(welcome|good evening|good morning|good afternoon|joining us|warm welcome|pleased to have|glad you|nice to see|wonderful to have|first time|bless you all)\b/i;
  const fallbackSummary = () => {
    const scriptureRegex = /\b(?:[1-3]\s)?[A-Za-z]+\s\d{1,3}:\d{1,3}(?:-\d{1,3})?\b/g;
    const scriptures = Array.from(new Set((transcript.match(scriptureRegex) || []).slice(0, 10)));
    // Split on sentence-ending punctuation but only where followed by whitespace (avoids splitting "St. John's")
    const sentences = transcript.split(/[.!?]+(?=\s|$)/).map((s) => s.trim()).filter((s) => s.length > 20);
    // Skip greeting/pleasantry sentences; keep theological content
    const contentSentences = sentences.filter((s) => !greetingMarkers.test(s));
    const usable = contentSentences.length >= 3 ? contentSentences : sentences;
    return {
      title: "Sermon",
      mainTheme: usable[0]?.slice(0, 120) || "Faith and purpose",
      keyPoints: usable.slice(1, 6).map((s) => s.slice(0, 160)),
      scripturesReferenced: scriptures,
      callToAction: usable[usable.length - 1]?.slice(0, 200) || "Walk in faith.",
      quotableLines: [],
    };
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a sermon note-taker for a church service${accentHint !== "standard" ? ` (${accentHint} English accent)` : ""}.
The following is a live speech transcript from a pastor's sermon captured by a speech-to-text engine. There may be minor transcription errors.

IMPORTANT RULES:
1. Extract ONLY theological/spiritual content explicitly stated in the transcript. Do NOT infer, assume, or fabricate.
2. SKIP all opening pleasantries, greetings, welcomes, and introductions (e.g. "Good evening", "welcome to St John's", "glad you joined us"). These are NOT the sermon content.
3. The mainTheme must describe the central spiritual/theological message — not the opening greeting.
4. keyPoints must be actual points the pastor made about faith, scripture, or the sermon topic — not pleasantries.
5. If a field cannot be determined from the actual sermon content, return an empty string or empty array.
6. Correct obvious transcription artifacts before extracting content: remove duplicate repeated words (e.g. "yeah yeah exactly exactly" → omit entirely unless theologically relevant), fix broken sentences from speech-to-text, and clean up filler words — but preserve the pastor's authentic voice, idioms, and theological vocabulary.

Return a JSON object with:
- title: short sermon title based only on what was said (max 8 words, or "Untitled Sermon" if unclear)
- mainTheme: one sentence describing the central spiritual message (NEVER use a greeting or welcome as the theme)
- keyPoints: array of 3 to 7 concise theological points the pastor explicitly made
- scripturesReferenced: array of Bible references explicitly mentioned (book chapter:verse format)
- callToAction: the closing challenge given to the congregation — only if clearly stated, otherwise empty string
- quotableLines: array of up to 4 direct quotes that capture the sermon's spiritual content

Transcript (${wordCount} words):
${transcript.slice(0, 20000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mainTheme: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            scripturesReferenced: { type: Type.ARRAY, items: { type: Type.STRING } },
            callToAction: { type: Type.STRING },
            quotableLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["title", "mainTheme", "keyPoints", "scripturesReferenced", "callToAction", "quotableLines"],
        },
      },
    });

    const parsed = parseAiJson(response);
    if (!parsed?.title) {
      return res.json({ ok: true, summary: fallbackSummary() });
    }

    return res.json({
      ok: true,
      summary: {
        title: String(parsed.title || "Sermon").slice(0, 100),
        mainTheme: String(parsed.mainTheme || "").slice(0, 300),
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 7).map((p) => String(p).slice(0, 300)) : [],
        scripturesReferenced: Array.isArray(parsed.scripturesReferenced) ? parsed.scripturesReferenced.slice(0, 20).map(String) : [],
        callToAction: String(parsed.callToAction || "").slice(0, 400),
        quotableLines: Array.isArray(parsed.quotableLines) ? parsed.quotableLines.slice(0, 4).map((q) => String(q).slice(0, 300)) : [],
      },
    });
  } catch (error) {
    return res.json({ ok: true, summary: fallbackSummary(), warning: String(error?.message || error) });
  }
});

// ─── Sermon Archive ───────────────────────────────────────────────────────────

app.post("/api/sermons", (req, res) => {
  const workspaceId = String(req.body?.workspaceId || "").trim();
  const id = String(req.body?.id || "").trim();
  const wordCount = Number(req.body?.wordCount || 0);
  const summary = req.body?.summary;
  if (!workspaceId || !id || !summary || typeof summary !== "object") {
    return res.status(400).json({ ok: false, error: "INVALID_PAYLOAD" });
  }
  try {
    db.prepare(
      "INSERT OR REPLACE INTO sermon_summaries (id, workspace_id, saved_at, word_count, summary_json) VALUES (?, ?, ?, ?, ?)"
    ).run(id, workspaceId, Date.now(), wordCount, JSON.stringify(summary));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB_ERROR", message: String(err?.message || err) });
  }
});

app.get("/api/sermons", (req, res) => {
  const workspaceId = String(req.query?.workspaceId || "").trim();
  if (!workspaceId) return res.status(400).json({ ok: false, error: "WORKSPACE_ID_REQUIRED" });
  try {
    const rows = db.prepare(
      "SELECT id, saved_at, word_count, summary_json FROM sermon_summaries WHERE workspace_id = ? ORDER BY saved_at DESC LIMIT 100"
    ).all(workspaceId);
    const items = rows.map((r) => ({
      id: r.id,
      savedAt: r.saved_at,
      wordCount: r.word_count,
      summary: JSON.parse(r.summary_json),
    }));
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB_ERROR", message: String(err?.message || err) });
  }
});

app.delete("/api/sermons/:id", (req, res) => {
  const id = String(req.params?.id || "").trim();
  const workspaceId = String(req.query?.workspaceId || "").trim();
  if (!id || !workspaceId) return res.status(400).json({ ok: false, error: "INVALID_PARAMS" });
  try {
    db.prepare("DELETE FROM sermon_summaries WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB_ERROR", message: String(err?.message || err) });
  }
});

app.post("/api/ai/assist-query", async (req, res) => {
  const query = String(req.body?.query || "").trim();
  const mode = String(req.body?.mode || "auto").trim().toLowerCase();
  if (!query) return res.status(400).json({ ok: false, error: "QUERY_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;

  const intentMap = {
    song: "lyrics",
    lyrics: "lyrics",
    sermon: "sermon",
    announcement: "announcement",
    prayer: "prayer",
  };
  const detectedIntent = intentMap[mode] || "unknown";

  const systemPrompt = detectedIntent === "lyrics"
    ? `You are a church lyric content assistant. The user is searching for song lyrics to use in a live presentation.

ACCURACY IS CRITICAL. Different people searching for the same song must get identical, exact lyrics. Do NOT paraphrase, approximate, or invent lyrics.

Rules:
1. If the song is well-known traditional/public-domain (e.g. "Amazing Grace", "How Great Thou Art", "Great Is Thy Faithfulness"): reproduce the exact, canonical public-domain text word-for-word with proper verse/chorus labels.
2. If the song is a modern copyrighted worship song (e.g. Hillsong, Elevation, Bethel, Chris Tomlin, etc.) or you are not 100% certain of the exact lyrics: set requiresManualInput to true and return ONLY the song title and artist in the title field — do NOT generate any lyrics.
3. Never approximate, paraphrase, or fill in gaps — accuracy over completeness.
4. Label each section: "Verse 1", "Verse 2", "Chorus", "Bridge", etc.
Detect the intent as "lyrics".`
    : detectedIntent === "sermon"
    ? `You are a church sermon content assistant.
Task: Given the query, produce a structured sermon outline or content with clearly labelled sections.
Each section should be a key point, scripture basis, or application.
Label each: "Introduction", "Point 1 - Title", "Scripture", "Application", "Conclusion", etc.
Detect the intent as "sermon".`
    : detectedIntent === "announcement"
    ? `You are a church communications assistant.
Task: Given the query, produce concise, warm, presentation-ready announcement text.
Split into logical sections for slides: Title, Main Body, Date/Time/Location, Call to Action.
Detect the intent as "announcement".`
    : detectedIntent === "prayer"
    ? `You are a church liturgy assistant.
Task: Given the query, produce a structured prayer or responsive reading suitable for projection.
Split into: Opening, Body (stanzas), Response prompts if applicable, Closing.
Detect the intent as "prayer".`
    : `You are a church content assistant. Determine intent and produce structured, slide-ready content.
Detect intent as one of: lyrics, sermon, announcement, prayer.
Label every section clearly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\nQuery: "${query}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            intent: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            requiresManualInput: { type: Type.BOOLEAN },
            rawText: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  type: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["label", "type", "text"],
              },
            },
          },
          required: ["title", "intent", "sections", "rawText", "confidence", "requiresManualInput"],
        },
      },
    });

    const parsed = parseAiJson(response);
    if (!parsed) {
      return res.status(500).json({ ok: false, error: "AI_NO_CONTENT" });
    }
    // requiresManualInput: AI recognised the song but won't fabricate copyrighted lyrics —
    // send it through even though sections will be empty
    if (parsed.requiresManualInput === true) {
      return res.json({
        ok: true,
        data: {
          title: String(parsed.title || ""),
          intent: "lyrics",
          sections: [],
          rawText: "",
          confidence: 1,
          source: "ai",
          requiresManualInput: true,
        },
      });
    }
    if (!Array.isArray(parsed.sections) || !parsed.sections.length) {
      return res.status(500).json({ ok: false, error: "AI_NO_CONTENT" });
    }
    return res.json({
      ok: true,
      data: {
        ...parsed,
        source: "ai",
        confidence: Number(parsed.confidence) || 0.8,
        requiresManualInput: false,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
});

app.post("/api/ai/transcribe-sermon-chunk", async (req, res) => {
  const locale = String(req.body?.locale || "").trim();
  const accentHint = normalizeSermonAccentHint(req.body?.accentHint, locale || "en-US");
  const mimeType = String(req.body?.mimeType || "").trim().toLowerCase();
  const audioBase64Raw = parseBase64Payload(req.body?.audioBase64);
  const workspaceId = String(req.body?.workspaceId || "").trim();
  const sessionId = String(req.body?.sessionId || "").trim();
  const clientId = String(req.body?.clientId || "").trim();

  if (!audioBase64Raw) {
    return res.status(400).json({
      ok: false,
      error: "AUDIO_REQUIRED",
      message: "audioBase64 is required.",
    });
  }
  if (!TRANSCRIBE_ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({
      ok: false,
      error: "MIME_TYPE_UNSUPPORTED",
      message: "mimeType must be one of audio/webm, audio/webm;codecs=opus, audio/mp4.",
    });
  }
  if (locale !== "en-GB" && locale !== "en-US") {
    return res.status(400).json({
      ok: false,
      error: "LOCALE_UNSUPPORTED",
      message: "locale must be en-GB or en-US.",
    });
  }

  const estimatedBytes = Math.floor((audioBase64Raw.length * 3) / 4);
  if (estimatedBytes > TRANSCRIBE_MAX_BASE64_BYTES) {
    return res.status(413).json({
      ok: false,
      error: "AUDIO_TOO_LARGE",
      message: `audioBase64 exceeds max chunk size (${TRANSCRIBE_MAX_BASE64_BYTES} bytes).`,
      maxBytes: TRANSCRIBE_MAX_BASE64_BYTES,
    });
  }

  const bucketKey = transcribeBucketKey({ workspaceId, sessionId, clientId });
  const limit = checkTranscribeRateLimit(bucketKey);
  if (!limit.allowed) {
    return res.status(429).json({
      ok: false,
      error: "TRANSCRIBE_COOLDOWN",
      message: "Transcription cooldown active. Retry after a short delay.",
      retryAfterMs: limit.retryAfterMs,
    });
  }

  const audioBuffer = decodeBase64(audioBase64Raw);
  if (!audioBuffer.length) {
    return res.status(400).json({
      ok: false,
      error: "AUDIO_DECODE_FAILED",
      message: "Unable to decode audioBase64 payload.",
    });
  }
  if (audioBuffer.length > TRANSCRIBE_MAX_BASE64_BYTES) {
    return res.status(413).json({
      ok: false,
      error: "AUDIO_TOO_LARGE",
      message: `Decoded audio exceeds max chunk size (${TRANSCRIBE_MAX_BASE64_BYTES} bytes).`,
      maxBytes: TRANSCRIBE_MAX_BASE64_BYTES,
    });
  }

  const ai = ensureGoogleAiClient(res);
  if (!ai) return;

  // Gemini inlineData requires a base MIME type without codec parameters
  const geminiMimeType = mimeType.includes(";") ? mimeType.split(";")[0].trim() : mimeType;

  try {
    const speechPrompt = buildSermonTranscriptionPrompt(locale, accentHint);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: speechPrompt },
            {
              inlineData: {
                mimeType: geminiMimeType,
                data: audioBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const transcript = String(response?.text || "").trim();
    return res.json({
      ok: true,
      transcript,
      locale,
      accentHint,
      bytes: audioBuffer.length,
    });
  } catch (error) {
    const raw = String(error?.message || error);
    const isQuota = raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota");
    return res.status(isQuota ? 429 : 502).json({
      ok: false,
      error: isQuota ? "QUOTA_EXCEEDED" : "TRANSCRIBE_FAILED",
      message: isQuota ? "Gemini quota reached. Will retry shortly." : extractGeminiErrorMessage(error),
    });
  }
});

// Multer for sermon audio upload (disk storage, auto-cleaned after processing)
const sermonAudioUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = file.originalname.endsWith(".mp4") ? ".mp4" : file.originalname.endsWith(".wav") ? ".wav" : ".webm";
      cb(null, `sermon-${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 },
});

const SERMON_INLINE_LIMIT = 15 * 1024 * 1024;

app.post("/api/ai/transcribe-sermon-audio", sermonAudioUpload.single("audio"), async (req, res) => {
  const audioFile = req.file;
  if (!audioFile?.path) {
    return res.status(400).json({ ok: false, error: "AUDIO_REQUIRED", message: "audio file is required." });
  }

  const rawMime = String(req.body?.mimeType || audioFile.mimetype || "audio/webm").trim().toLowerCase();
  const locale = String(req.body?.locale || "en-US").trim();
  const accentHint = normalizeSermonAccentHint(req.body?.accentHint, locale);
  const allowDeferred = parseBool(req.body?.allowDeferred, false);
  const workspaceId = String(req.body?.workspaceId || "default-workspace").trim() || "default-workspace";
  let managedByDeferredJob = false;

  const ai = ensureGoogleAiClient(res, { scope: "sermon" });
  if (!ai) {
    try { fs.unlinkSync(audioFile.path); } catch { /* ignore */ }
    return;
  }

  try {
    const transcript = await runWithGeminiQuotaRetry(
      () => transcribeSermonAudioFileInternal(audioFile.path, rawMime, locale, accentHint, ai),
      { retries: 1, baseDelayMs: 10000 },
    );

    return res.json({ ok: true, transcript });
  } catch (error) {
    const isQuota = isGeminiQuotaError(error);
    if (isQuota && allowDeferred) {
      const job = createDeferredSermonProcessingJob({
        sourcePath: audioFile.path,
        mimeType: rawMime,
        locale: locale === "en-GB" ? "en-GB" : "en-US",
        accentHint,
        workspaceId,
        initialError: error,
      });
      managedByDeferredJob = true;
      drainDeferredSermonJobs();
      return res.status(202).json({
        ok: true,
        deferred: true,
        job,
        message: "Gemini quota reached. Audio saved and queued for automatic transcription.",
      });
    }
    return res.status(isQuota ? 429 : 502).json({
      ok: false,
      error: isQuota ? "QUOTA_EXCEEDED" : "TRANSCRIBE_FAILED",
      message: isQuota ? "Gemini quota reached. Please wait a moment and try again." : extractGeminiErrorMessage(error),
    });
  } finally {
    if (!managedByDeferredJob) {
      try { fs.unlinkSync(audioFile.path); } catch { /* ignore */ }
    }
  }
});

app.get("/api/ai/sermon-processing-jobs/:jobId", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) {
    return res.status(400).json({ ok: false, error: "JOB_ID_REQUIRED", message: "jobId is required." });
  }

  const job = getSermonProcessingJob(jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "JOB_NOT_FOUND", message: "Sermon processing job not found." });
  }

  return res.json({ ok: true, job });
});

app.post("/api/ai/sermon-processing-jobs/:jobId/retry", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) {
    return res.status(400).json({ ok: false, error: "JOB_ID_REQUIRED", message: "jobId is required." });
  }

  const row = getSermonProcessingJobRow(jobId);
  if (!row) {
    return res.status(404).json({ ok: false, error: "JOB_NOT_FOUND", message: "Sermon processing job not found." });
  }
  if (!row.audio_file_path || !fs.existsSync(row.audio_file_path)) {
    return res.status(409).json({
      ok: false,
      error: "JOB_AUDIO_MISSING",
      message: "Saved sermon audio is no longer available for retry.",
    });
  }

  const job = updateSermonProcessingJob(jobId, {
    status: "queued",
    phase: "queued",
    progress: 4,
    completedAt: null,
    error: null,
    retryAfterMs: 0,
    nextRetryAt: now(),
    attemptCount: 0,
    transcript: null,
    summaryJson: null,
  });
  drainDeferredSermonJobs();
  return res.json({ ok: true, job });
});

app.post("/api/ai/generate-macro", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const scheduleItems = Array.isArray(req.body?.scheduleItems) ? req.body.scheduleItems : [];
  if (!prompt) return res.status(400).json({ ok: false, error: "PROMPT_REQUIRED" });
  const ai = ensureGoogleAiClient(res, { scope: "sermon" });
  if (!ai) return;

  const scheduleContext = scheduleItems.length > 0
    ? `\nCurrent run-sheet items: ${scheduleItems.slice(0, 20).map((i, idx) => `${idx + 1}. "${i.title}" (id: ${i.id})`).join(", ")}`
    : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a church production automation expert. Generate a Lumina macro definition based on the user's description.
A macro is a sequence of automation actions for a church presentation software.${scheduleContext}

Available action types: next_slide, prev_slide, go_to_item, go_to_slide, clear_output, show_message, hide_message, start_timer, stop_timer, trigger_aether_scene, wait.
Available trigger types: manual, item_start, slide_enter, timer_end, service_mode_change.
Available categories: service_flow, worship, sermon, streaming, emergency, stage, output, media, custom.

For go_to_item, set payload.itemId to the matching id from the run-sheet (or "__FIRST_ITEM__" if no specific item).
For show_message, set payload.text to the message text.
For wait, set payload.delayMs (number).

User request: "${prompt}"

Return a single JSON object with exactly these fields: name (string), description (string), category, triggerType (one of the trigger types), actions (array of action objects with: type, payload as object, delayMs as number or null, continueOnError as boolean).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            triggerType: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  payload: { type: Type.OBJECT, properties: {}, additionalProperties: true },
                  delayMs: { type: Type.NUMBER },
                  continueOnError: { type: Type.BOOLEAN },
                },
                required: ["type", "payload"],
              },
            },
          },
          required: ["name", "description", "category", "triggerType", "actions"],
        },
      },
    });
    const parsed = parseAiJson(response);
    if (!parsed?.name || !Array.isArray(parsed?.actions)) {
      return res.status(422).json({ ok: false, error: "INVALID_AI_PAYLOAD", message: "AI did not return a valid macro." });
    }
    return res.json({ ok: true, data: parsed });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "AI_MACRO_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId", requireActor, (req, res) => {
  try {
    const workspace = ensureWorkspaceRead(req.params.workspaceId, req.actor);
    if (!workspace) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const latestSnapshot = db
      .prepare("SELECT version, payload_json, created_at FROM workspace_snapshots WHERE workspace_id = ? ORDER BY version DESC LIMIT 1")
      .get(req.params.workspaceId);
    return res.json({
      ok: true,
      workspace: {
        id: workspace.id,
        ownerUid: workspace.owner_uid,
        ownerEmail: workspace.owner_email,
        settings: parseJson(workspace.settings_json, {}),
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
        settingsUpdatedAt: workspace.settings_updated_at || workspace.updated_at,
      },
      latestSnapshot: latestSnapshot
        ? {
          version: latestSnapshot.version,
          payload: parseJson(latestSnapshot.payload_json, {}),
          createdAt: latestSnapshot.created_at,
        }
        : null,
    });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "WORKSPACE_READ_FAILED", message: String(error?.message || error) });
  }
});

// GET — read current workspace settings (server is source of truth)
app.get("/api/workspaces/:workspaceId/settings", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = getWorkspaceRow.get(workspaceId);
    if (!workspace) {
      // Return empty settings if workspace doesn't exist yet
      return res.json({ ok: true, settings: {}, updatedAt: 0 });
    }
    if (!canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const settings = parseJson(workspace.settings_json, {});
    const settingsUpdatedAt = Number(workspace.settings_updated_at || workspace.updated_at || 0);
    return res.json({ ok: true, settings, updatedAt: settingsUpdatedAt });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "SETTINGS_READ_FAILED", message: String(error?.message || error) });
  }
});

app.patch("/api/workspaces/:workspaceId/settings", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const actor = req.actor;
    const workspace = ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: false });
    const currentSettings = parseJson(workspace.settings_json, {});
    const nextSettings = { ...currentSettings, ...(req.body?.settings || {}) };
    const updatedAt = now();
    updateWorkspace.run({
      id: workspaceId,
      settings_json: toJson(nextSettings),
      updated_at: updatedAt,
      settings_updated_at: updatedAt,
    });
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "SETTINGS_UPDATE",
      details_json: toJson({ keys: Object.keys(req.body?.settings || {}) }),
      created_at: updatedAt,
    });
    return res.json({ ok: true, settings: nextSettings, updatedAt });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "SETTINGS_UPDATE_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/snapshots", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: false });
    const payload = req.body?.payload || {};
    const versionRow = db
      .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM workspace_snapshots WHERE workspace_id = ?")
      .get(workspaceId);
    const version = Number(versionRow?.next_version || 1);
    const createdAt = now();
    db.prepare(`
      INSERT INTO workspace_snapshots (workspace_id, version, payload_json, created_by_uid, created_by_email, created_at)
      VALUES (@workspace_id, @version, @payload_json, @created_by_uid, @created_by_email, @created_at)
    `).run({
      workspace_id: workspaceId,
      version,
      payload_json: toJson(payload),
      created_by_uid: actor.uid,
      created_by_email: actor.email || null,
      created_at: createdAt,
    });
    db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(createdAt, workspaceId);
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "SNAPSHOT_SAVE",
      details_json: toJson({ version }),
      created_at: createdAt,
    });

    // Keep history bounded.
    db.prepare(`
      DELETE FROM workspace_snapshots
      WHERE workspace_id = @workspace_id
        AND id NOT IN (
          SELECT id FROM workspace_snapshots
          WHERE workspace_id = @workspace_id
          ORDER BY version DESC
          LIMIT 100
        )
    `).run({ workspace_id: workspaceId });

    return res.json({ ok: true, version, updatedAt: createdAt });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "SNAPSHOT_SAVE_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/snapshots/latest", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    ensureWorkspaceRead(workspaceId, req.actor);
    const row = db
      .prepare("SELECT version, payload_json, created_at FROM workspace_snapshots WHERE workspace_id = ? ORDER BY version DESC LIMIT 1")
      .get(workspaceId);
    if (!row) return res.json({ ok: true, snapshot: null });
    return res.json({
      ok: true,
      snapshot: {
        version: row.version,
        payload: parseJson(row.payload_json, {}),
        updatedAt: row.created_at,
      },
    });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "SNAPSHOT_READ_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/media", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const name = sanitizeFilename(req.body?.name || "upload.bin", "upload.bin");
    const mimeType = String(req.body?.mimeType || "application/octet-stream").trim() || "application/octet-stream";
    const base64Payload = parseBase64Payload(req.body?.base64);
    const content = decodeBase64(base64Payload);
    if (!content.length) {
      return res.status(400).json({ ok: false, error: "MEDIA_EMPTY", message: "Upload payload was empty." });
    }

    const workspaceDir = path.join(WORKSPACE_MEDIA_DIR, sanitizePathSegment(workspaceId, "workspace"));
    fs.mkdirSync(workspaceDir, { recursive: true });
    const ext = path.extname(name) || inferExtensionFromMimeType(mimeType) || ".bin";
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 24);
    const fileName = `${digest}${ext}`;
    const absolutePath = path.join(workspaceDir, fileName);
    fs.writeFileSync(absolutePath, content);

    const relativeUrl = `${WORKSPACE_MEDIA_BASE_PATH}/${encodeURIComponent(sanitizePathSegment(workspaceId, "workspace"))}/${encodeURIComponent(fileName)}`;
    const url = `${getRequestOrigin(req)}${relativeUrl}`;
    return res.json({
      ok: true,
      name,
      mimeType,
      size: content.length,
      url,
      relativeUrl,
    });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "MEDIA_UPLOAD_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/runsheets", requireActor, (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    if (!workspaceId) {
      return res.status(400).json({ ok: false, error: "WORKSPACE_REQUIRED" });
    }
    const workspace = getWorkspaceRow.get(workspaceId);
    if (!workspace) {
      return res.json({ ok: true, files: [] });
    }
    if (!canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const rows = listRunSheetFilesByWorkspace.all(workspaceId);
    return res.json({
      ok: true,
      files: rows.map(toRunSheetFileRecord),
    });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "RUNSHEET_LIST_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/runsheets", requireActor, (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const titleInput = String(req.body?.title || "").trim();
    const title = (titleInput || "Run Sheet").slice(0, 120);
    const rawPayload = req.body?.payload && typeof req.body.payload === "object" && !Array.isArray(req.body.payload)
      ? req.body.payload
      : {};
    const payload = {
      items: Array.isArray(rawPayload.items) ? rawPayload.items : [],
      selectedItemId: typeof rawPayload.selectedItemId === "string" ? rawPayload.selectedItemId : null,
    };

    const createdAt = now();
    let fileId = createRunSheetFileId();
    if (getRunSheetFileById.get(workspaceId, fileId)) {
      fileId = createRunSheetFileId();
    }
    insertRunSheetFile.run({
      workspace_id: workspaceId,
      file_id: fileId,
      title,
      payload_json: toJson(payload),
      created_by_uid: actor.uid || null,
      created_by_email: actor.email || null,
      created_at: createdAt,
      updated_at: createdAt,
      last_used_at: null,
    });
    db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(createdAt, workspaceId);
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "RUNSHEET_ARCHIVE_CREATE",
      details_json: toJson({ fileId, title, itemCount: payload.items.length }),
      created_at: createdAt,
    });
    const row = getRunSheetFileById.get(workspaceId, fileId);
    return res.json({ ok: true, file: toRunSheetFileRecord(row) });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "RUNSHEET_ARCHIVE_FAILED", message: String(error?.message || error) });
  }
});

app.patch("/api/workspaces/:workspaceId/runsheets/:fileId", requireActor, (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const fileId = String(req.params.fileId || "").trim();
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const current = getRunSheetFileById.get(workspaceId, fileId);
    if (!current) return res.status(404).json({ ok: false, error: "RUNSHEET_NOT_FOUND" });

    const rawTitle = String(req.body?.title || "").trim();
    if (!rawTitle) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });
    const nextTitle = rawTitle.slice(0, 120);
    const updatedAt = now();
    updateRunSheetFileTitle.run({
      workspace_id: workspaceId,
      file_id: fileId,
      title: nextTitle,
      updated_at: updatedAt,
    });
    db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(updatedAt, workspaceId);
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "RUNSHEET_ARCHIVE_RENAME",
      details_json: toJson({ fileId, title: nextTitle }),
      created_at: updatedAt,
    });
    const row = getRunSheetFileById.get(workspaceId, fileId);
    return res.json({ ok: true, file: toRunSheetFileRecord(row) });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "RUNSHEET_RENAME_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/runsheets/:fileId/reuse", requireActor, (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const fileId = String(req.params.fileId || "").trim();
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const current = getRunSheetFileById.get(workspaceId, fileId);
    if (!current) return res.status(404).json({ ok: false, error: "RUNSHEET_NOT_FOUND" });
    const updatedAt = now();
    updateRunSheetFileLastUsed.run({
      workspace_id: workspaceId,
      file_id: fileId,
      last_used_at: updatedAt,
      updated_at: updatedAt,
    });
    db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(updatedAt, workspaceId);
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "RUNSHEET_ARCHIVE_REUSE",
      details_json: toJson({ fileId }),
      created_at: updatedAt,
    });
    const row = getRunSheetFileById.get(workspaceId, fileId);
    const file = toRunSheetFileRecord(row);
    return res.json({ ok: true, file, payload: file.payload });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "RUNSHEET_REUSE_FAILED", message: String(error?.message || error) });
  }
});

app.delete("/api/workspaces/:workspaceId/runsheets/:fileId", requireActor, (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const fileId = String(req.params.fileId || "").trim();
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const removed = deleteRunSheetFileById.run(workspaceId, fileId);
    if (!removed?.changes) {
      return res.status(404).json({ ok: false, error: "RUNSHEET_NOT_FOUND" });
    }
    const updatedAt = now();
    db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(updatedAt, workspaceId);
    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "RUNSHEET_ARCHIVE_DELETE",
      details_json: toJson({ fileId }),
      created_at: updatedAt,
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "RUNSHEET_DELETE_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/sessions/:sessionId/state", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const sessionId = req.params.sessionId;
    const actor = req.actor;
    const workspace = ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });
    const current = db
      .prepare("SELECT version, state_json FROM sessions WHERE workspace_id = ? AND session_id = ?")
      .get(workspaceId, sessionId);
    const nextVersion = Number(current?.version || 0) + 1;
    const updatedAt = now();
    const payloadState = req.body?.state || {};
    const currentState = parseJson(current?.state_json, {});
    const state = {
      ...currentState,
      ...payloadState,
      updatedAt,
      controllerOwnerUid: payloadState.controllerOwnerUid || currentState.controllerOwnerUid || workspace.owner_uid,
    };
    db.prepare(`
      INSERT INTO sessions (workspace_id, session_id, owner_uid, version, state_json, updated_at)
      VALUES (@workspace_id, @session_id, @owner_uid, @version, @state_json, @updated_at)
      ON CONFLICT(workspace_id, session_id) DO UPDATE SET
        owner_uid = excluded.owner_uid,
        version = excluded.version,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run({
      workspace_id: workspaceId,
      session_id: sessionId,
      owner_uid: workspace.owner_uid,
      version: nextVersion,
      state_json: toJson(state),
      updated_at: updatedAt,
    });
    logAudit.run({
      workspace_id: workspaceId,
      session_id: sessionId,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "SESSION_STATE_UPSERT",
      details_json: toJson({ version: nextVersion }),
      created_at: updatedAt,
    });
    return res.json({ ok: true, version: nextVersion, updatedAt });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "SESSION_SAVE_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/sessions/:sessionId/commands", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const sessionId = req.params.sessionId;
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });

    const command = String(req.body?.command || "").toUpperCase();
    if (!command) {
      return res.status(400).json({ ok: false, error: "INVALID_COMMAND" });
    }

    const current = db
      .prepare("SELECT version, state_json FROM sessions WHERE workspace_id = ? AND session_id = ?")
      .get(workspaceId, sessionId);
    const currentState = parseJson(current?.state_json, {});
    const updatedAt = now();
    const nextState = {
      ...currentState,
      remoteCommand: command,
      remoteCommandAt: updatedAt,
      updatedAt,
    };
    const nextVersion = Number(current?.version || 0) + 1;
    db.prepare(`
      INSERT INTO sessions (workspace_id, session_id, owner_uid, version, state_json, updated_at)
      VALUES (@workspace_id, @session_id, @owner_uid, @version, @state_json, @updated_at)
      ON CONFLICT(workspace_id, session_id) DO UPDATE SET
        version = excluded.version,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run({
      workspace_id: workspaceId,
      session_id: sessionId,
      owner_uid: currentState?.controllerOwnerUid || actor.uid,
      version: nextVersion,
      state_json: toJson(nextState),
      updated_at: updatedAt,
    });
    logAudit.run({
      workspace_id: workspaceId,
      session_id: sessionId,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "SESSION_COMMAND",
      details_json: toJson({ command }),
      created_at: updatedAt,
    });
    return res.json({ ok: true, command, updatedAt });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "SESSION_COMMAND_FAILED", message: String(error?.message || error) });
  }
});

// ── Audience Studio ─────────────────────────────────────────────────────────
const VALID_CATEGORIES = ["qa", "prayer", "testimony", "poll", "welcome"];
const VALID_STATUSES = ["pending", "approved", "dismissed", "projected"];

// POST — submit a message (no auth required — anyone with the link can submit)
app.post("/api/workspaces/:workspaceId/audience/messages", (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const { category, text, name } = req.body || {};
    const safeCategory = VALID_CATEGORIES.includes(String(category || "").toLowerCase()) ? String(category).toLowerCase() : "qa";
    const safeText = String(text || "").trim().slice(0, 500);
    const safeName = String(name || "").trim().slice(0, 80) || null;
    if (!safeText) return res.status(400).json({ ok: false, error: "TEXT_REQUIRED" });
    const createdAt = now();
    const result = db.prepare(`
      INSERT INTO audience_messages (workspace_id, category, text, submitter_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(workspaceId, safeCategory, safeText, safeName, createdAt, createdAt);
    broadcastAudienceMessageEvent(workspaceId, {
      type: "created",
      messageId: Number(result.lastInsertRowid || 0),
      status: "pending",
    });
    return res.json({ ok: true, id: result.lastInsertRowid, createdAt });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "SUBMIT_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/audience/messages/stream", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = getWorkspaceRow.get(workspaceId);
    if (workspace && !canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const bucket = getAudienceStreamBucket(workspaceId);
    bucket.add(res);
    writeAudienceStreamEvent(res, "ready", {
      workspaceId,
      updatedAt: now(),
    });

    const heartbeatId = setInterval(() => {
      if (res.writableEnded) return;
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        // best effort
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatId);
      bucket.delete(res);
      if (!bucket.size) {
        audienceMessageStreamClients.delete(String(workspaceId || "").trim() || "default-workspace");
      }
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "STREAM_FAILED", message: String(error?.message || error) });
  }
});

// GET — list messages for operator panel (auth required)
app.get("/api/workspaces/:workspaceId/audience/messages", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = getWorkspaceRow.get(workspaceId);
    if (workspace && !canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const status = req.query.status ? String(req.query.status) : null;
    const rows = status
      ? db.prepare("SELECT * FROM audience_messages WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT 200").all(workspaceId, status)
      : db.prepare("SELECT * FROM audience_messages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200").all(workspaceId);
    return res.json({ ok: true, messages: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "LIST_FAILED", message: String(error?.message || error) });
  }
});

// PATCH — update message status (approve / dismiss / projected)
app.patch("/api/workspaces/:workspaceId/audience/messages/:msgId", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const msgId = Number(req.params.msgId);
    const workspace = getWorkspaceRow.get(workspaceId);
    if (workspace && !canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const status = String(req.body?.status || "").toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }
    const updatedAt = now();
    db.prepare("UPDATE audience_messages SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .run(status, updatedAt, msgId, workspaceId);
    const row = db.prepare("SELECT * FROM audience_messages WHERE id = ?").get(msgId);
    broadcastAudienceMessageEvent(workspaceId, {
      type: "updated",
      messageId: msgId,
      status,
    });
    return res.json({ ok: true, message: row });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "PATCH_FAILED", message: String(error?.message || error) });
  }
});

// DELETE — remove a message
app.delete("/api/workspaces/:workspaceId/audience/messages/:msgId", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const msgId = Number(req.params.msgId);
    const workspace = getWorkspaceRow.get(workspaceId);
    if (workspace && !canOperateWorkspace(workspace, req.actor)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    db.prepare("DELETE FROM audience_messages WHERE id = ? AND workspace_id = ?").run(msgId, workspaceId);
    broadcastAudienceMessageEvent(workspaceId, {
      type: "deleted",
      messageId: msgId,
      status: "dismissed",
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "DELETE_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/sessions/:sessionId/state", (req, res) => {
  try {
    const row = db
      .prepare("SELECT state_json, version, updated_at FROM sessions WHERE workspace_id = ? AND session_id = ?")
      .get(req.params.workspaceId, req.params.sessionId);
    if (!row) return res.json({ ok: true, state: null, version: 0, updatedAt: 0 });
    return res.json({
      ok: true,
      state: parseJson(row.state_json, {}),
      version: row.version,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "SESSION_READ_FAILED", message: String(error?.message || error) });
  }
});

app.post("/api/workspaces/:workspaceId/sessions/:sessionId/connections/heartbeat", (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const sessionId = String(req.params.sessionId || "").trim();
    if (!workspaceId || !sessionId) {
      return res.status(400).json({ ok: false, error: "INVALID_SESSION" });
    }

    const workspace = getWorkspaceRow.get(workspaceId);
    if (!workspace) {
      return res.status(404).json({ ok: false, error: "WORKSPACE_NOT_FOUND" });
    }

    const clientId = String(req.body?.clientId || "").trim().slice(0, 120);
    if (!clientId) {
      return res.status(400).json({ ok: false, error: "CLIENT_ID_REQUIRED" });
    }

    const requestedRole = String(req.body?.role || "").trim().toLowerCase();
    const role = ACTIVE_CONNECTION_ROLES.has(requestedRole) ? requestedRole : "output";
    const heartbeatAt = now();
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
      ? req.body.metadata
      : {};
    const cutoff = heartbeatAt - CONNECTION_TTL_MS;

    upsertSessionConnection.run({
      workspace_id: workspaceId,
      session_id: sessionId,
      client_id: clientId,
      role,
      last_seen_at: heartbeatAt,
      metadata_json: toJson(metadata),
    });
    pruneExpiredSessionConnections.run(workspaceId, sessionId, cutoff);

    const activeRows = listActiveSessionConnections.all(workspaceId, sessionId, cutoff);
    return res.json({
      ok: true,
      asOf: heartbeatAt,
      ttlMs: CONNECTION_TTL_MS,
      clientId,
      role,
      total: activeRows.length,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "CONNECTION_HEARTBEAT_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/sessions/:sessionId/connections", (req, res) => {
  try {
    const workspaceId = String(req.params.workspaceId || "").trim();
    const sessionId = String(req.params.sessionId || "").trim();
    if (!workspaceId || !sessionId) {
      return res.status(400).json({ ok: false, error: "INVALID_SESSION" });
    }
    const workspace = getWorkspaceRow.get(workspaceId);
    if (!workspace) {
      return res.status(404).json({ ok: false, error: "WORKSPACE_NOT_FOUND" });
    }

    const asOf = now();
    const cutoff = asOf - CONNECTION_TTL_MS;
    pruneExpiredSessionConnections.run(workspaceId, sessionId, cutoff);
    const rows = listActiveSessionConnections.all(workspaceId, sessionId, cutoff);
    const connections = rows.map((row) => ({
      clientId: row.client_id,
      role: row.role,
      lastSeenAt: row.last_seen_at,
      metadata: parseJson(row.metadata_json, {}),
    }));
    const byRole = connections.reduce((acc, entry) => {
      acc[entry.role] = Number(acc[entry.role] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      ok: true,
      asOf,
      ttlMs: CONNECTION_TTL_MS,
      connections,
      counts: {
        total: connections.length,
        byRole,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "CONNECTION_LIST_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/reports/summary", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = ensureWorkspaceRead(workspaceId, req.actor);
    if (!workspace || workspace.owner_uid !== req.actor.uid) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const from = Number(req.query.from || now() - 7 * 24 * 60 * 60 * 1000);
    const to = Number(req.query.to || now());
    const actionRows = db
      .prepare(`
        SELECT action, COUNT(*) AS count
        FROM audit_logs
        WHERE workspace_id = ? AND created_at BETWEEN ? AND ?
        GROUP BY action
        ORDER BY count DESC
      `)
      .all(workspaceId, from, to);
    const total = actionRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    return res.json({ ok: true, range: { from, to }, totalEvents: total, byAction: actionRows });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "REPORT_FAILED", message: String(error?.message || error) });
  }
});

app.get("/api/workspaces/:workspaceId/reports/audit", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const workspace = ensureWorkspaceRead(workspaceId, req.actor);
    if (!workspace || workspace.owner_uid !== req.actor.uid) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
    const rows = db
      .prepare(`
        SELECT id, session_id, actor_uid, actor_email, action, details_json, created_at
        FROM audit_logs
        WHERE workspace_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(workspaceId, limit);
    return res.json({
      ok: true,
      logs: rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        actorUid: row.actor_uid,
        actorEmail: row.actor_email,
        action: row.action,
        details: parseJson(row.details_json, {}),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "AUDIT_REPORT_FAILED", message: String(error?.message || error) });
  }
});

// ─── CCLI SongSelect proxy ───────────────────────────────────────────────────
// All CCLI OAuth and SongSelect calls happen server-side so the client_secret
// never reaches the renderer (or the binary). The client secret is encrypted
// at rest using AES-256-GCM with a server-side key.

const CCLI_TOKEN_ENDPOINT = "https://identity.ccli.com/connect/token";
const CCLI_API_BASE = "https://songselect.ccli.com/api/v1";

// Server-side token cache, keyed by workspace_id
const ccliTokenCache = new Map(); // workspace_id → { token, expiresAt }

const getCcliCredentialsRow = db.prepare(
  "SELECT license_number, client_id, client_secret_enc, enc_iv, enc_tag, connected_at FROM workspace_ccli_credentials WHERE workspace_id = ?"
);
const upsertCcliCredentialsStmt = db.prepare(`
  INSERT INTO workspace_ccli_credentials (workspace_id, license_number, client_id, client_secret_enc, enc_iv, enc_tag, connected_at, updated_at)
  VALUES (@workspace_id, @license_number, @client_id, @client_secret_enc, @enc_iv, @enc_tag, @connected_at, @updated_at)
  ON CONFLICT(workspace_id) DO UPDATE SET
    license_number = excluded.license_number,
    client_id = excluded.client_id,
    client_secret_enc = excluded.client_secret_enc,
    enc_iv = excluded.enc_iv,
    enc_tag = excluded.enc_tag,
    updated_at = excluded.updated_at
`);
const deleteCcliCredentialsStmt = db.prepare("DELETE FROM workspace_ccli_credentials WHERE workspace_id = ?");

const loadCcliCredentials = (workspaceId) => {
  const row = getCcliCredentialsRow.get(String(workspaceId || ""));
  if (!row) return null;
  try {
    const clientSecret = decryptSecret(row.client_secret_enc, row.enc_iv, row.enc_tag);
    return {
      licenseNumber: row.license_number,
      clientId: row.client_id,
      clientSecret,
      connectedAt: row.connected_at,
    };
  } catch (err) {
    console.error("[ccli] failed to decrypt client_secret for workspace", workspaceId, err?.message);
    return null;
  }
};

const acquireCcliToken = async (workspaceId, creds) => {
  const cached = ccliTokenCache.get(workspaceId);
  if (cached && now() < cached.expiresAt - 60_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "SongSelect",
  });
  const response = await fetch(CCLI_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`CCLI auth ${response.status}: ${msg}`);
  }
  const data = await response.json();
  if (!data?.access_token) throw new Error("CCLI auth: missing access_token");
  const ttlMs = Math.max(60_000, (Number(data.expires_in) || 3600) * 1000);
  ccliTokenCache.set(workspaceId, { token: data.access_token, expiresAt: now() + ttlMs });
  return data.access_token;
};

// POST /api/ccli/credentials — store encrypted credentials
app.post("/api/ccli/credentials", requireActor, async (req, res) => {
  if (!CCLI_ENCRYPTION_AVAILABLE) {
    return res.status(503).json({ ok: false, error: "ENCRYPTION_UNAVAILABLE", message: "CCLI_ENCRYPTION_KEY is not configured on the server." });
  }
  const workspaceId = String(req.body?.workspaceId || req.actor?.uid || "").trim();
  const licenseNumber = String(req.body?.licenseNumber || "").trim();
  const clientId = String(req.body?.clientId || "").trim();
  const clientSecret = String(req.body?.clientSecret || "").trim();
  if (!workspaceId || !clientId || !clientSecret) {
    return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
  }

  // Verify credentials by attempting to acquire a token before storing
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "SongSelect",
    });
    const verifyResp = await fetch(CCLI_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!verifyResp.ok) {
      return res.status(401).json({ ok: false, error: "CCLI_AUTH_FAILED", message: `CCLI rejected credentials (${verifyResp.status})` });
    }
  } catch (err) {
    return res.status(502).json({ ok: false, error: "CCLI_UNREACHABLE", message: err?.message || "CCLI verification failed" });
  }

  const { ciphertext, iv, tag } = encryptSecret(clientSecret);
  const ts = now();
  upsertCcliCredentialsStmt.run({
    workspace_id: workspaceId,
    license_number: licenseNumber,
    client_id: clientId,
    client_secret_enc: ciphertext,
    enc_iv: iv,
    enc_tag: tag,
    connected_at: ts,
    updated_at: ts,
  });
  ccliTokenCache.delete(workspaceId); // invalidate cached token on re-save
  return res.json({ ok: true, connected: true });
});

// GET /api/ccli/status — check whether a workspace has connected creds
app.get("/api/ccli/status", requireActor, (req, res) => {
  const workspaceId = String(req.query?.workspaceId || req.actor?.uid || "").trim();
  if (!workspaceId) return res.status(400).json({ ok: false, error: "MISSING_WORKSPACE" });
  const row = getCcliCredentialsRow.get(workspaceId);
  return res.json({ ok: true, connected: !!row, connectedAt: row?.connected_at || null });
});

// DELETE /api/ccli/credentials — disconnect
app.delete("/api/ccli/credentials", requireActor, (req, res) => {
  const workspaceId = String(req.query?.workspaceId || req.actor?.uid || "").trim();
  if (!workspaceId) return res.status(400).json({ ok: false, error: "MISSING_WORKSPACE" });
  deleteCcliCredentialsStmt.run(workspaceId);
  ccliTokenCache.delete(workspaceId);
  return res.json({ ok: true });
});

// POST /api/ccli/search — proxied SongSelect search
app.post("/api/ccli/search", requireActor, async (req, res) => {
  const workspaceId = String(req.body?.workspaceId || req.actor?.uid || "").trim();
  const query = String(req.body?.query || "").trim();
  const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 25));
  if (!workspaceId || !query) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

  const creds = loadCcliCredentials(workspaceId);
  if (!creds) return res.status(404).json({ ok: false, error: "NOT_CONNECTED" });

  try {
    const token = await acquireCcliToken(workspaceId, creds);
    const url = new URL(`${CCLI_API_BASE}/songs/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(limit));
    const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!resp.ok) {
      if (resp.status === 401) ccliTokenCache.delete(workspaceId);
      return res.status(resp.status).json({ ok: false, error: "CCLI_SEARCH_FAILED", message: resp.statusText });
    }
    const data = await resp.json();
    const raw = data?.results ?? data?.songs ?? [];
    return res.json({ ok: true, licenseNumber: creds.licenseNumber, results: raw });
  } catch (err) {
    return res.status(502).json({ ok: false, error: "CCLI_UNREACHABLE", message: err?.message || "CCLI request failed" });
  }
});

// GET /api/ccli/lyrics/:songNumber — proxied lyrics fetch
app.get("/api/ccli/lyrics/:songNumber", requireActor, async (req, res) => {
  const workspaceId = String(req.query?.workspaceId || req.actor?.uid || "").trim();
  const songNumber = parseInt(String(req.params?.songNumber || ""), 10);
  if (!workspaceId || !Number.isFinite(songNumber) || songNumber <= 0) {
    return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
  }
  const creds = loadCcliCredentials(workspaceId);
  if (!creds) return res.status(404).json({ ok: false, error: "NOT_CONNECTED" });

  try {
    const token = await acquireCcliToken(workspaceId, creds);
    const resp = await fetch(`${CCLI_API_BASE}/songs/${songNumber}/lyrics`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      if (resp.status === 401) ccliTokenCache.delete(workspaceId);
      return res.status(resp.status).json({ ok: false, error: "CCLI_LYRICS_FAILED", message: resp.statusText });
    }
    const data = await resp.json();
    return res.json({ ok: true, licenseNumber: creds.licenseNumber, lyrics: data });
  } catch (err) {
    return res.status(502).json({ ok: false, error: "CCLI_UNREACHABLE", message: err?.message || "CCLI request failed" });
  }
});

// ─── Session / license validation ────────────────────────────────────────────
// The client calls this on startup and periodically. It returns the user's
// plan (free/pro/church) and a revoked flag. The free plan is explicitly
// supported — users on "free" are considered valid.

const getRevokedUserRow = db.prepare("SELECT reason, revoked_at FROM revoked_users WHERE uid = ?");

app.get("/api/session/validate", requireActor, (req, res) => {
  const uid = req.actor?.uid;

  // Check revocation list first
  const revoked = getRevokedUserRow.get(uid);
  if (revoked) {
    return res.status(403).json({
      ok: false,
      valid: false,
      revoked: true,
      reason: revoked.reason || "Account revoked",
      revokedAt: revoked.revoked_at,
    });
  }

  // Fetch subscription (free plan is fine)
  const row = db.prepare("SELECT plan, period, status, expires_at FROM user_subscriptions WHERE uid = ?").get(uid);
  const plan = row?.plan || "free";
  const status = row?.status || "active";
  const expiresAt = row?.expires_at || null;
  const expired = !!(expiresAt && expiresAt < now());

  return res.json({
    ok: true,
    valid: true,
    revoked: false,
    plan: expired ? "free" : plan,
    status: expired ? "expired" : status,
    expiresAt,
    serverTime: now(),
  });
});

// Global error handler — catches body-parser 413, JSON parse errors, etc.
// Must have 4 params for Express to treat it as an error middleware.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.type === "entity.too.large" || err.status === 413) {
    console.warn(
      `[lumina-server-api] 413 payload too large on ${req.method} ${req.path} ` +
      `(limit=${JSON_LIMIT}) — client should strip base64 data before syncing`
    );
    return res.status(413).json({ ok: false, error: "PAYLOAD_TOO_LARGE", message: `Request body exceeds ${JSON_LIMIT} limit.` });
  }
  console.error("[lumina-server-api] unhandled error:", err?.message || err);
  return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: String(err?.message || err) });
});

const sermonProcessingPollTimer = setInterval(() => {
  try {
    drainDeferredSermonJobs();
  } catch (error) {
    console.warn("[lumina-server-api] sermon-processing: poll error", error?.message || error);
  }
}, SERMON_PROCESSING_POLL_MS);
sermonProcessingPollTimer.unref?.();

const sermonProcessingPruneTimer = setInterval(() => {
  try {
    pruneDeferredSermonJobs();
  } catch (error) {
    console.warn("[lumina-server-api] sermon-processing: prune error", error?.message || error);
  }
}, 60 * 60 * 1000);
sermonProcessingPruneTimer.unref?.();

setTimeout(() => {
  try {
    drainDeferredSermonJobs();
  } catch {
    // ignore boot-time drain failures; poll loop will retry
  }
}, 1000).unref?.();

app.listen(PORT, () => {
  console.log(`[lumina-server-api] listening on http://localhost:${PORT}`);
  console.log(`[lumina-server-api] sqlite: ${DB_PATH}`);
  if (USED_EPHEMERAL_FALLBACK) {
    console.warn("[lumina-server-api] warning: requested data path was not writable; using ephemeral /tmp fallback.");
  }
  void (async () => {
    await logSofficeAvailability();
    await logPdftocairoAvailability();
    await logFontDiagnostics();
  })();

  // Keep-alive: ping /api/health every 14 minutes so Render free tier doesn't spin down.
  // Set LUMINA_KEEP_ALIVE_URL to the public URL of this service (e.g. https://lumina-presenter-api.onrender.com).
  const keepAliveUrl = process.env.LUMINA_KEEP_ALIVE_URL
    ? `${String(process.env.LUMINA_KEEP_ALIVE_URL).replace(/\/+$/, "")}/api/health`
    : null;
  if (keepAliveUrl) {
    const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
    console.log(`[lumina-server-api] keep-alive: pinging ${keepAliveUrl} every 14 min`);
    setInterval(async () => {
      try {
        const res = await fetch(keepAliveUrl, { signal: AbortSignal.timeout(10000) });
        console.log(`[lumina-server-api] keep-alive: ping ${res.ok ? "ok" : `failed (${res.status})`}`);
      } catch (err) {
        console.warn(`[lumina-server-api] keep-alive: ping error — ${String(err?.message || err)}`);
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }
});

app.post("/api/workspaces/:workspaceId/imports/pptx-visual", requireActor, async (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumina-pptx-"));
  try {
    const workspaceId = req.params.workspaceId;
    const actor = req.actor;
    ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });
    const workspaceSegment = sanitizePathSegment(workspaceId, "workspace");
    const requestOrigin = getRequestOrigin(req);
    const includeBase64 =
      parseBool(req.body?.includeBase64, PPTX_VIS_INCLUDE_BASE64_DEFAULT)
      || parseBool(req.query?.includeBase64, false);

    const filename = sanitizeFilename(req.body?.filename, "import.pptx");
    const lowerFilename = filename.toLowerCase();
    const isPptx = lowerFilename.endsWith(".pptx");
    const isPdf = lowerFilename.endsWith(".pdf");
    if (!isPptx && !isPdf) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_FILE",
        message: "Only .pptx or .pdf files are supported for visual import.",
      });
    }

    const bytes = decodeBase64(req.body?.fileBase64);
    if (!bytes.length) {
      return res.status(400).json({ ok: false, error: "INVALID_PAYLOAD", message: "Missing PowerPoint file bytes." });
    }
    if (bytes.length > MAX_PPTX_IMPORT_BYTES) {
      return res.status(413).json({
        ok: false,
        error: "FILE_TOO_LARGE",
        message: `PowerPoint file is too large. Max supported size is ${Math.floor(MAX_PPTX_IMPORT_BYTES / (1024 * 1024))}MB.`,
      });
    }

    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const { hash: renderSignatureHash } = getVisualRenderSignature();
    const importSegment = sanitizePathSegment(
      `${renderSignatureHash}_${fileHash.slice(0, 20)}_${bytes.length}`,
      "import",
    );
    const importDir = path.join(VIS_MEDIA_DIR, workspaceSegment, importSegment);
    const metaPath = path.join(importDir, "meta.json");
    if (fs.existsSync(metaPath)) {
      try {
        const rawMeta = fs.readFileSync(metaPath, "utf8");
        const parsed = JSON.parse(rawMeta);
        const cachedRenderer = String(parsed?.renderer || PPTX_VIS_RENDERER_DEFAULT);
        const cachedRenderSignature = String(parsed?.renderSignature || renderSignatureHash);
        const cachedSlides = Array.isArray(parsed?.slides) ? parsed.slides : [];
        const slides = cachedSlides
          .filter((entry) => entry?.fileName)
          .map((entry) => {
            const imagePath = `${VIS_MEDIA_BASE_PATH}/${encodeURIComponent(workspaceSegment)}/${encodeURIComponent(importSegment)}/${encodeURIComponent(entry.fileName)}`;
            const out = {
              pageNumber: Number(entry.pageNumber || 0),
              name: String(entry.name || entry.fileName),
              width: Number(entry.width || 0),
              height: Number(entry.height || 0),
              imageUrl: `${requestOrigin}${imagePath}`,
            };
            if (includeBase64) {
              const filePath = path.join(importDir, entry.fileName);
              if (fs.existsSync(filePath)) {
                out.imageBase64 = fs.readFileSync(filePath).toString("base64");
              }
            }
            return out;
          });
        if (slides.length) {
          try {
            const nowDate = new Date();
            fs.utimesSync(importDir, nowDate, nowDate);
          } catch {
            // best effort touch
          }
          return res.json({
            ok: true,
            slideCount: slides.length,
            slides,
            cached: true,
            renderer: cachedRenderer,
            renderSignature: cachedRenderSignature,
          });
        }
      } catch {
        // fall through to full re-render if metadata is unreadable
      }
    }
    fs.mkdirSync(importDir, { recursive: true });

    const inputPath = path.join(tempDir, filename);
    fs.writeFileSync(inputPath, bytes);

    if (isPptx) {
      const loProfileDir = path.join(tempDir, "lo-profile");
      fs.mkdirSync(loProfileDir, { recursive: true });
      const normalizedProfilePath = loProfileDir
        .replace(/\\/g, "/")
        .replace(/^([A-Za-z]):/, "/$1:");
      const profileUri = `file://${normalizedProfilePath}`;
      try {
        await execFileAsync(SOFFICE_BIN, [
          "--headless",
          "--nologo",
          "--nodefault",
          "--nolockcheck",
          "--norestore",
          "--invisible",
          `-env:UserInstallation=${profileUri}`,
          "--convert-to",
          "pdf:impress_pdf_Export",
          "--outdir",
          tempDir,
          inputPath,
        ], {
          timeout: PPTX_CONVERT_TIMEOUT_MS,
          windowsHide: true,
          maxBuffer: 20 * 1024 * 1024,
        });
      } catch (error) {
        const missing = error?.code === "ENOENT";
        const details = formatExecErrorDetails(error);
        return res.status(missing ? 503 : 422).json({
          ok: false,
          error: missing ? "PPTX_RENDERER_UNAVAILABLE" : "PPTX_CONVERT_FAILED",
          message: missing
            ? "Visual PowerPoint import requires LibreOffice (`soffice`) installed on the server."
            : `Failed to convert PowerPoint to PDF for visual import.${details ? ` ${details}` : ""}`,
        });
      }
    }

    const pdfFile = isPdf
      ? path.basename(inputPath)
      : fs.readdirSync(tempDir).find((entry) => entry.toLowerCase().endsWith(".pdf"));
    if (!pdfFile) {
      return res.status(422).json({
        ok: false,
        error: "PDF_NOT_FOUND",
        message: isPdf
          ? "Uploaded PDF could not be read for visual import."
          : "PowerPoint conversion did not produce a PDF output.",
      });
    }

    const pdfPath = path.join(tempDir, pdfFile);
    const popplerOutputDir = path.join(tempDir, "poppler-png");
    fs.mkdirSync(popplerOutputDir, { recursive: true });
    let pages = [];
    let renderer = "pdfjs-fallback";
    let popplerError = null;
    const tryPoppler = PPTX_VIS_RASTER_ENGINE === "auto" || PPTX_VIS_RASTER_ENGINE === "poppler";
    if (tryPoppler) {
      try {
        pages = await renderPdfToPngWithPoppler(pdfPath, popplerOutputDir, PPTX_PDF_RASTER_DPI);
        renderer = "poppler";
      } catch (error) {
        popplerError = error;
        if (PPTX_VIS_RASTER_ENGINE === "poppler") {
          const details = formatExecErrorDetails(error);
          return res.status(422).json({
            ok: false,
            error: "PNG_RENDER_FAILED",
            message: `Failed to render PDF pages with pdftocairo.${details ? ` ${details}` : ""}`,
          });
        }
      }
    }

    if (!pages.length) {
      try {
        pages = await renderPdfToPngWithPdfJs(pdfPath);
        renderer = "pdfjs-fallback";
      } catch (error) {
        const dependencyMissing =
          error?.code === "ERR_MODULE_NOT_FOUND"
          || String(error?.message || "").toLowerCase().includes("pdf-to-png-converter");
        if (dependencyMissing) {
          return res.status(503).json({
            ok: false,
            error: "PPTX_VISUAL_DEPENDENCY_MISSING",
            message: "Visual PowerPoint import dependency is missing on the server. Ensure `pdf-to-png-converter` is installed and redeploy.",
          });
        }
        const details = formatExecErrorDetails(error);
        const popplerDetails = popplerError ? formatExecErrorDetails(popplerError) : "";
        return res.status(422).json({
          ok: false,
          error: "PNG_RENDER_FAILED",
          message: `Failed to render converted PDF pages as PNG slides.${details ? ` ${details}` : ""}${popplerDetails ? ` popplerFallback=${popplerDetails}` : ""}`,
        });
      }
    }

    if (!pages.length) {
      return res.status(422).json({
        ok: false,
        error: "NO_SLIDES",
        message: "No slides were rendered from this PowerPoint/PDF file.",
      });
    }

    const slideMeta = pages
      .filter((page) => page?.content)
      .map((page, idx) => {
        const pageNumber = Number(page.pageNumber || idx + 1);
        const fileName = `slide-${String(pageNumber).padStart(3, "0")}.png`;
        const outputPath = path.join(importDir, fileName);
        fs.writeFileSync(outputPath, page.content);
        return {
          pageNumber,
          fileName,
          name: page.name || fileName,
          width: Number(page.width || 0),
          height: Number(page.height || 0),
        };
      });

    const slides = pages
      .filter((page) => page?.content)
      .map((page, idx) => {
        const pageNumber = Number(page.pageNumber || idx + 1);
        const fileName = `slide-${String(pageNumber).padStart(3, "0")}.png`;
        const imagePath = `${VIS_MEDIA_BASE_PATH}/${encodeURIComponent(workspaceSegment)}/${encodeURIComponent(importSegment)}/${encodeURIComponent(fileName)}`;
        const out = {
          pageNumber,
          name: page.name || fileName,
          width: Number(page.width || 0),
          height: Number(page.height || 0),
          imageUrl: `${requestOrigin}${imagePath}`,
        };
        if (includeBase64) {
          out.imageBase64 = page.content.toString("base64");
        }
        return out;
      });

    if (!slides.length) {
      return res.status(422).json({
        ok: false,
        error: "NO_SLIDES",
        message: "No slides were rendered from this PowerPoint/PDF file.",
      });
    }

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          workspaceId,
          fileHash,
          renderSignature: renderSignatureHash,
          renderer,
          importedAt: now(),
          sourceFilename: filename,
          slides: slideMeta,
        },
        null,
        2,
      ),
      "utf8",
    );

    logAudit.run({
      workspace_id: workspaceId,
      session_id: null,
      actor_uid: actor.uid,
      actor_email: actor.email || null,
      action: "PPTX_VISUAL_IMPORT",
      details_json: toJson({ filename, slideCount: slides.length, cached: false, renderer, renderSignature: renderSignatureHash }),
      created_at: now(),
    });
    pruneWorkspaceVisualImports(workspaceSegment);

    return res.json({ ok: true, slideCount: slides.length, slides, cached: false, renderer, renderSignature: renderSignatureHash });
  } catch (error) {
    if (error?.code === 403) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return res.status(500).json({ ok: false, error: "PPTX_IMPORT_FAILED", message: String(error?.message || error) });
  } finally {
    cleanupDir(tempDir);
  }
});

// ── Macro Webhook Triggers ─────────────────────────────────────────────────────

/**
 * POST /api/workspaces/:workspaceId/macro-trigger/:key
 * Called by external systems (physical buttons, automation) to fire a macro trigger.
 * If MACRO_WEBHOOK_SECRET env var is set, requires Authorization: Bearer <secret>
 * or X-Webhook-Secret header matching that value.
 */
app.post("/api/workspaces/:workspaceId/macro-trigger/:key", (req, res) => {
  const secret = process.env.MACRO_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = String(req.headers["authorization"] || "");
    const secretHeader = String(req.headers["x-webhook-secret"] || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (bearerToken !== secret && secretHeader !== secret) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
  }
  const workspaceId = sanitizePathSegment(req.params.workspaceId, "workspace");
  const key = String(req.params.key || "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120);
  if (!workspaceId || workspaceId === "workspace" || !key) {
    return res.status(400).json({ ok: false, error: "INVALID_PARAMS" });
  }
  const triggerId = `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    insertWebhookTrigger.run({ id: triggerId, workspace_id: workspaceId, key, triggered_at: now() });
    // Prune triggers older than 5 minutes to keep the table small
    pruneOldWebhookTriggers.run(now() - 300000);
    return res.json({ ok: true, triggerId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: String(error?.message || error) });
  }
});

/**
 * GET /api/workspaces/:workspaceId/macro-triggers/pending?since=<timestamp_ms>
 * Frontend polls this to get triggers fired after the given timestamp.
 */
app.get("/api/workspaces/:workspaceId/macro-triggers/pending", (req, res) => {
  const workspaceId = String(req.params.workspaceId || "").trim();
  if (!workspaceId) return res.status(400).json({ ok: false, error: "INVALID_PARAMS" });
  const since = Math.max(0, Number(req.query.since || 0));
  try {
    const triggers = listPendingWebhookTriggers.all(workspaceId, since);
    return res.json({ ok: true, triggers });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: String(error?.message || error) });
  }
});
