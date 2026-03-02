import { spawn } from "node:child_process";
import process from "node:process";

const devUrl = process.env.ELECTRON_DEV_URL || "http://localhost:5173";
const waitTimeoutMs = Number(process.env.ELECTRON_DEV_WAIT_MS || 120000);
const npmCli = process.env.npm_execpath;

let shuttingDown = false;
let viteProcess = null;
let electronProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stopProcess = (child) => {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch {
    // best effort
  }
};

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcess(electronProcess);
  stopProcess(viteProcess);
  process.exit(code);
};

const waitForDevServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for dev server at ${url}`);
};

const runNpm = (args) => {
  if (npmCli) {
    // Most reliable on Windows/Git Bash: call npm CLI via the current Node runtime.
    return spawn(process.execPath, [npmCli, ...args], {
      stdio: "inherit",
      env: process.env,
    });
  }
  // Fallback for direct invocation outside npm context.
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
};

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

viteProcess = runNpm(["run", "dev"]);

viteProcess.on("exit", (code) => {
  if (!shuttingDown && !electronProcess) {
    console.error(`[electron-dev] Vite exited before Electron start (code ${code ?? 0}).`);
    shutdown(typeof code === "number" ? code : 1);
  }
});

try {
  await waitForDevServer(devUrl, waitTimeoutMs);
} catch (error) {
  console.error(`[electron-dev] ${String(error?.message || error)}`);
  shutdown(1);
}

electronProcess = runNpm(["run", "electron:dev:raw"]);

electronProcess.on("exit", (code) => {
  shutdown(typeof code === "number" ? code : 0);
});
