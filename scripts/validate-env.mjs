#!/usr/bin/env node
// Validates required server env vars without printing any secrets.
// Run with:  node scripts/validate-env.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');

// Tiny .env parser — handles single-line KEY=value (with optional quotes).
// Skips comments and blanks. Multi-line values are intentionally NOT supported,
// because the runtime env loader you use almost certainly does not support them
// either. Use a file path env var (e.g. FIREBASE_SERVICE_ACCOUNT_PATH) instead.
function readEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

const env = { ...readEnvFile(envPath), ...process.env };
const issues = [];
const okMsgs = [];

function ok(msg)   { okMsgs.push(`  OK     ${msg}`); }
function warn(msg) { issues.push(`  WARN   ${msg}`); }
function fail(msg) { issues.push(`  FAIL   ${msg}`); }

console.log(`\nValidating env file: ${envPath}\n`);
if (!fs.existsSync(envPath)) {
  fail(`.env.local does not exist`);
} else {
  ok(`.env.local exists`);
}

// ── CCLI_ENCRYPTION_KEY ─────────────────────────────────────────────────────
const ccliKey = env.CCLI_ENCRYPTION_KEY;
if (!ccliKey) {
  fail('CCLI_ENCRYPTION_KEY is missing — generate one with:\n           node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"');
} else if (ccliKey.length < 16) {
  fail(`CCLI_ENCRYPTION_KEY is too short (${ccliKey.length} chars). Minimum 16, recommended >= 32.`);
} else {
  ok(`CCLI_ENCRYPTION_KEY present (${ccliKey.length} chars)`);
}

// ── Firebase service account ────────────────────────────────────────────────
const fbInline = env.FIREBASE_SERVICE_ACCOUNT_JSON;
const fbPath   = env.FIREBASE_SERVICE_ACCOUNT_PATH;
const gac      = env.GOOGLE_APPLICATION_CREDENTIALS;

let firebaseSource = null;
let serviceAccount = null;

if (fbPath) {
  firebaseSource = `FIREBASE_SERVICE_ACCOUNT_PATH (${fbPath})`;
  if (!fs.existsSync(fbPath)) {
    fail(`FIREBASE_SERVICE_ACCOUNT_PATH points to a missing file: ${fbPath}`);
  } else {
    try {
      serviceAccount = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
      ok(`FIREBASE_SERVICE_ACCOUNT_PATH points to a valid JSON file`);
    } catch (e) {
      fail(`Failed to parse JSON at FIREBASE_SERVICE_ACCOUNT_PATH: ${e.message}`);
    }
  }
} else if (fbInline) {
  firebaseSource = 'FIREBASE_SERVICE_ACCOUNT_JSON (inline)';
  try {
    serviceAccount = JSON.parse(fbInline);
    ok(`FIREBASE_SERVICE_ACCOUNT_JSON parsed successfully`);
  } catch (e) {
    fail(`FIREBASE_SERVICE_ACCOUNT_JSON failed to parse: ${e.message}\n           HINT: env files require a single line. Multi-line JSON values do NOT work.\n           Recommended fix: use FIREBASE_SERVICE_ACCOUNT_PATH and a separate file.`);
  }
} else if (gac) {
  firebaseSource = `GOOGLE_APPLICATION_CREDENTIALS (${gac})`;
  if (!fs.existsSync(gac)) {
    fail(`GOOGLE_APPLICATION_CREDENTIALS points to a missing file: ${gac}`);
  } else {
    try {
      serviceAccount = JSON.parse(fs.readFileSync(gac, 'utf8'));
      ok(`GOOGLE_APPLICATION_CREDENTIALS points to a valid JSON file`);
    } catch (e) {
      fail(`Failed to parse JSON at GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`);
    }
  }
} else {
  warn('No Firebase service account configured. The server will run in DEV-HEADER-AUTH mode (insecure, dev only).\n           Set one of: FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS');
}

if (serviceAccount) {
  console.log(`\n  Firebase source: ${firebaseSource}`);
  const required = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri'];
  const missing = required.filter((k) => !serviceAccount[k]);
  if (missing.length) {
    fail(`Service account JSON is missing required fields: ${missing.join(', ')}`);
  } else {
    ok(`Service account JSON has all required fields`);
  }
  if (serviceAccount.type !== 'service_account') {
    fail(`Service account "type" should be "service_account", got "${serviceAccount.type}"`);
  } else {
    ok(`Service account type is "service_account"`);
  }
  if (serviceAccount.project_id) {
    ok(`Service account project_id present`);
  }
  const pk = String(serviceAccount.private_key || '');
  if (!pk.includes('-----BEGIN PRIVATE KEY-----') || !pk.includes('-----END PRIVATE KEY-----')) {
    fail(`private_key is missing BEGIN/END markers — is the field truncated or escaped wrong?`);
  } else {
    ok(`private_key has BEGIN and END markers`);
  }
  if (!/@.*\.iam\.gserviceaccount\.com$/.test(serviceAccount.client_email || '')) {
    warn(`client_email format is unusual: expected something@<project>.iam.gserviceaccount.com`);
  } else {
    ok(`client_email format looks right`);
  }
}

// ── Optional: Paystack ──────────────────────────────────────────────────────
if (!env.PAYSTACK_SECRET_KEY) {
  warn('PAYSTACK_SECRET_KEY not set — payment endpoints will return 503 (fine if you are not testing payments).');
} else {
  ok('PAYSTACK_SECRET_KEY present');
}

// ── Output ──────────────────────────────────────────────────────────────────
console.log('\nResults:');
for (const m of okMsgs) console.log(m);
for (const m of issues) console.log(m);

const failCount = issues.filter((m) => m.startsWith('  FAIL')).length;
console.log(`\n${failCount === 0 ? 'PASS' : 'FAIL'} — ${okMsgs.length} ok, ${issues.filter(m => m.startsWith('  WARN')).length} warning, ${failCount} error\n`);
process.exit(failCount > 0 ? 1 : 0);
