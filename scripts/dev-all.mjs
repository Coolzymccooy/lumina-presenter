import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const SERVER_PORT = Number(process.env.LUMINA_API_PORT || 8787);
const VITE_PORT = Number(process.env.LUMINA_DEV_PORT || process.env.VITE_PORT || 5173);
const VITE_CLI_PATH = path.resolve('node_modules', 'vite', 'bin', 'vite.js');

const launch = (label, command, args = [], extraOptions = {}) => (
  spawn(command, args, {
    stdio: 'inherit',
    windowsHide: false,
    ...extraOptions,
  })
);

const ensurePortAvailable = (port, label) => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe
    .once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        reject(new Error(`${label} port ${port} is already in use.`));
        return;
      }
      reject(error);
    })
    .once('listening', () => {
      probe.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve();
      });
    });
  probe.listen(port);
});

const killChildTree = (child) => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  child.kill('SIGINT');
};

const launchServer = () => launch('server', process.execPath, ['scripts/server-start.mjs']);
const launchFrontend = () => {
  if (fs.existsSync(VITE_CLI_PATH)) {
    return launch('frontend', process.execPath, [VITE_CLI_PATH, '--port', String(VITE_PORT), '--strictPort']);
  }
  return launch('frontend', `npm run dev -- --port ${VITE_PORT} --strictPort`, [], { shell: true });
};

let server = null;
let frontend = null;
let shuttingDown = false;

const stopChildren = () => {
  killChildTree(server);
  killChildTree(frontend);
};

const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[dev:all] received ${signal}, stopping child processes...`);
  stopChildren();
  setTimeout(() => process.exit(exitCode), 400);
};

const handleUnexpectedExit = (label, code, signal) => {
  if (shuttingDown) return;
  const reason = signal ? `signal ${signal}` : `code ${code}`;
  const exitCode = typeof code === 'number' ? code : (signal ? 1 : 0);
  console.log(`[dev:all] ${label} exited (${reason}). Stopping remaining process...`);
  shuttingDown = true;
  stopChildren();
  setTimeout(() => process.exit(exitCode), 400);
};

const main = async () => {
  try {
    await ensurePortAvailable(SERVER_PORT, 'Server');
    await ensurePortAvailable(VITE_PORT, 'Frontend');
  } catch (error) {
    console.error(`[dev:all] ${String(error?.message || error)}`);
    console.error('[dev:all] Stop the process using the port and retry.');
    process.exit(1);
    return;
  }

  console.log(`[dev:all] starting server on :${SERVER_PORT} and frontend on :${VITE_PORT}`);
  server = launchServer();
  frontend = launchFrontend();

  server.on('exit', (code, signal) => handleUnexpectedExit('server', code, signal));
  frontend.on('exit', (code, signal) => handleUnexpectedExit('frontend', code, signal));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

void main();
