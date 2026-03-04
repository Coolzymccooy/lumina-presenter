import { spawn } from 'node:child_process';

const launch = (label, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[dev:all] ${label} exited via signal ${signal}`);
      return;
    }
    console.log(`[dev:all] ${label} exited with code ${code}`);
  });

  return child;
};

const server = launch('server', 'npm', ['run', 'server']);
const frontend = launch('frontend', 'npm', ['run', 'dev']);

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[dev:all] received ${signal}, stopping child processes...`);
  if (!server.killed) server.kill('SIGINT');
  if (!frontend.killed) frontend.kill('SIGINT');
  setTimeout(() => process.exit(0), 200);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

