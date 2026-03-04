import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const launch = (label, command, args = [], extraOptions = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...extraOptions,
  });

  return child;
};

const npmExecPath = typeof process.env.npm_execpath === 'string'
  ? process.env.npm_execpath
  : '';
const bundledNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

const launchNpmScript = (label, scriptName) => {
  // Primary path when launched from `npm run ...`.
  if (npmExecPath && npmExecPath.toLowerCase().endsWith('.js') && fs.existsSync(npmExecPath)) {
    return launch(label, process.execPath, [npmExecPath, 'run', scriptName]);
  }

  // Fallback for direct `node scripts/dev-all.mjs` invocation.
  if (fs.existsSync(bundledNpmCli)) {
    return launch(label, process.execPath, [bundledNpmCli, 'run', scriptName]);
  }

  // Last resort for unusual Node installs: run via shell command text (no args array).
  return launch(label, `npm run ${scriptName}`, [], { shell: true });
};

const server = launchNpmScript('server', 'server');
const frontend = launchNpmScript('frontend', 'dev');

let shuttingDown = false;
const stopChildren = () => {
  if (!server.killed) server.kill('SIGINT');
  if (!frontend.killed) frontend.kill('SIGINT');
};

const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[dev:all] received ${signal}, stopping child processes...`);
  stopChildren();
  setTimeout(() => process.exit(exitCode), 300);
};

const handleUnexpectedExit = (label, code, signal) => {
  if (shuttingDown) return;
  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.log(`[dev:all] ${label} exited unexpectedly (${reason}). Stopping remaining process...`);
  shuttingDown = true;
  stopChildren();
  setTimeout(() => process.exit(code ?? 1), 300);
};

server.on('exit', (code, signal) => handleUnexpectedExit('server', code, signal));
frontend.on('exit', (code, signal) => handleUnexpectedExit('frontend', code, signal));

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
