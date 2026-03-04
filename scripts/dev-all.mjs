import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const launch = (label, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  return child;
};

const server = launch('server', npmCommand, ['run', 'server']);
const frontend = launch('frontend', npmCommand, ['run', 'dev']);

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
