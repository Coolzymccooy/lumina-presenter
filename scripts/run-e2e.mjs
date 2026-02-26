import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_PORT = 4173;
const SERVER_PORT = 8877;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const SERVER_HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/api/health`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const nodeBin = process.execPath;

const prefixOutput = (name, raw) => {
  const text = String(raw);
  if (!text) return;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    process.stdout.write(`[${name}] ${line}\n`);
  }
};

const startProcess = (name, args, env = {}) => {
  const child = spawn(nodeBin, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => prefixOutput(name, data));
  child.stderr.on('data', (data) => prefixOutput(name, data));
  return child;
};

const waitForHttp = async (url, timeoutMs, owner) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (owner.exitCode !== null) {
      throw new Error(`Process exited before ready (exitCode=${owner.exitCode}) while waiting for ${url}`);
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
      if (response.ok) return;
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const killProcessTree = async (child) => {
  if (!child || child.exitCode !== null || !child.pid) return;
  try {
    child.kill();
  } catch {
    // Process may already be gone.
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (child.exitCode === null) {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process may already be gone.
    }
  }
};

const run = async () => {
  const extraArgs = process.argv.slice(2);
  const e2eDbPath = path.join(os.tmpdir(), 'lumina-presenter-e2e.sqlite');
  let server = null;
  let frontend = null;

  try {
    server = startProcess('server', [path.join(rootDir, 'server', 'index.js')], {
      LUMINA_API_PORT: String(SERVER_PORT),
      LUMINA_DB_PATH: e2eDbPath,
    });
    await waitForHttp(SERVER_HEALTH_URL, 60_000, server);

    frontend = startProcess('frontend', [path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(FRONTEND_PORT)], {
      VITE_API_BASE_URL: `http://127.0.0.1:${SERVER_PORT}`,
    });
    await waitForHttp(FRONTEND_URL, 90_000, frontend);

    const playwrightCli = path.join(rootDir, 'node_modules', '@playwright', 'test', 'cli.js');
    const testExitCode = await new Promise((resolve) => {
      const runner = spawn(nodeBin, [playwrightCli, 'test', ...extraArgs], {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_API_BASE_URL: `http://127.0.0.1:${SERVER_PORT}`,
        },
      });
      runner.on('error', () => resolve(1));
      runner.on('exit', (code) => resolve(code ?? 1));
    });

    process.exitCode = Number(testExitCode);
  } finally {
    await killProcessTree(frontend);
    await killProcessTree(server);
  }
};

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
