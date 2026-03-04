import { spawn } from 'node:child_process';

const launch = (label, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
  });

  return child;
};

const npmExecPath = typeof process.env.npm_execpath === 'string'
  ? process.env.npm_execpath
  : '';

const launchNpmScript = (label, scriptName) => {
  // When this script is launched via `npm run ...`, npm exposes its JS entrypoint.
  // Running that entrypoint with the current Node binary is cross-platform and avoids shell spawning issues.
  if (npmExecPath && npmExecPath.toLowerCase().endsWith('.js')) {
    return launch(label, process.execPath, [npmExecPath, 'run', scriptName]);
  }

  // Fallback for non-npm invocation contexts.
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return launch(label, npmCommand, ['run', scriptName]);
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
