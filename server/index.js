import express from "express";
import cors from "cors";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { GoogleGenAI, Type } from "@google/genai";

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
const execFileAsync = promisify(execFile);
let sofficeVersionLine = "unknown";
let pdftocairoVersionLine = "unknown";
let cachedPdfToPng = null;
let cachedPdfToPngLoadError = null;

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
const VIS_MEDIA_BASE_PATH = (() => {
  const raw = String(process.env.LUMINA_VIS_MEDIA_BASE_PATH || "/media/vis").trim();
  const normalized = `/${raw.replace(/^\/+|\/+$/g, "")}`;
  return normalized === "/" ? "/media/vis" : normalized;
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

CREATE INDEX IF NOT EXISTS idx_audit_workspace_time ON audit_logs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_workspace_time ON workspace_snapshots(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audience_workspace_time ON audience_messages(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_connections_workspace_session_seen ON session_connections(workspace_id, session_id, last_seen_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runsheet_workspace_file_unique ON workspace_runsheet_files(workspace_id, file_id);
CREATE INDEX IF NOT EXISTS idx_runsheet_workspace_updated ON workspace_runsheet_files(workspace_id, updated_at DESC);
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

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));
fs.mkdirSync(VIS_MEDIA_DIR, { recursive: true });
app.use(
  VIS_MEDIA_BASE_PATH,
  express.static(VIS_MEDIA_DIR, { index: false, fallthrough: false }),
);

const now = () => Date.now();
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
let cachedGoogleAiClient = null;
let cachedGoogleAiKey = "";
const getGoogleAiClient = () => {
  const key = String(process.env.GOOGLE_AI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY || "").trim();
  if (!key) return null;
  if (cachedGoogleAiClient && cachedGoogleAiKey === key) return cachedGoogleAiClient;
  cachedGoogleAiClient = new GoogleGenAI({ apiKey: key });
  cachedGoogleAiKey = key;
  return cachedGoogleAiClient;
};
const ensureGoogleAiClient = (res) => {
  const ai = getGoogleAiClient();
  if (ai) return ai;
  res.status(503).json({
    ok: false,
    error: "AI_KEY_MISSING",
    message: "Missing GOOGLE_AI_API_KEY on server. Set it in backend environment variables.",
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

const readActor = (req) => {
  const uid = String(req.header("x-user-uid") || "").trim();
  const email = String(req.header("x-user-email") || "").trim().toLowerCase();
  return { uid, email };
};

const requireActor = (req, res, next) => {
  const actor = readActor(req);
  if (!actor.uid) {
    return res.status(401).json({ ok: false, error: "AUTH_REQUIRED", message: "Missing x-user-uid header." });
  }
  req.actor = actor;
  return next();
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lumina-server-api", db: DB_PATH, now: now() });
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
  if (!query) return res.status(400).json({ ok: false, error: "QUERY_REQUIRED" });
  const ai = ensureGoogleAiClient(res);
  if (!ai) return;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a biblical scholar. Given the user's input (topic, emotion, or situation),
provide the single best Bible reference (Book Chapter:Verse) to address it.

User Input: "${query}"

Return ONLY the reference (e.g., "Philippians 4:13" or "Psalm 23:1-4").`,
    });
    const reference = String(response?.text || "").trim() || "John 3:16";
    return res.json({ ok: true, reference });
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
    return res.json({ ok: true, id: result.lastInsertRowid, createdAt });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "SUBMIT_FAILED", message: String(error?.message || error) });
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
