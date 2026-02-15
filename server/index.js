import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.LUMINA_DATA_DIR
  ? path.resolve(process.env.LUMINA_DATA_DIR)
  : path.join(__dirname, "data");
const DB_PATH = process.env.LUMINA_DB_PATH
  ? path.resolve(process.env.LUMINA_DB_PATH)
  : path.join(DATA_DIR, "lumina.sqlite");
const PORT = Number(process.env.PORT || process.env.LUMINA_API_PORT || 8787);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
  updated_at INTEGER NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_audit_workspace_time ON audit_logs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_workspace_time ON workspace_snapshots(workspace_id, created_at);
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

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

const normalizeEmails = (raw = "") =>
  String(raw)
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .map((entry) => entry.split(/[:|]/)[0]?.trim())
    .filter(Boolean);

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
  INSERT INTO workspaces (id, owner_uid, owner_email, settings_json, created_at, updated_at)
  VALUES (@id, @owner_uid, @owner_email, @settings_json, @created_at, @updated_at)
`);
const updateWorkspace = db.prepare(`
  UPDATE workspaces SET settings_json = @settings_json, updated_at = @updated_at WHERE id = @id
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

app.patch("/api/workspaces/:workspaceId/settings", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const actor = req.actor;
    const workspace = ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: false });
    const currentSettings = parseJson(workspace.settings_json, {});
    const nextSettings = { ...currentSettings, ...(req.body?.settings || {}) };
    const updatedAt = now();
    updateWorkspace.run({ id: workspaceId, settings_json: toJson(nextSettings), updated_at: updatedAt });
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

app.post("/api/workspaces/:workspaceId/sessions/:sessionId/state", requireActor, (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const sessionId = req.params.sessionId;
    const actor = req.actor;
    const workspace = ensureWorkspaceForWrite(workspaceId, actor, { allowOperator: true });
    const current = db
      .prepare("SELECT version FROM sessions WHERE workspace_id = ? AND session_id = ?")
      .get(workspaceId, sessionId);
    const nextVersion = Number(current?.version || 0) + 1;
    const updatedAt = now();
    const payloadState = req.body?.state || {};
    const state = {
      ...payloadState,
      updatedAt,
      controllerOwnerUid: payloadState.controllerOwnerUid || workspace.owner_uid,
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
});
